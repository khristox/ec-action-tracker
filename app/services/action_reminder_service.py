# app/services/action_reminder_service.py
"""
Async Service for sending action reminder notifications to implementers.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
import logging
from pathlib import Path
import os

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from jinja2 import Environment, FileSystemLoader

from app.models.meetings.action_tracker import MeetingAction, ActionImplementer
from app.models.notification import Notification, NotificationChannel, NotificationStatus, NotificationCategory
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


class ActionReminderService:
    """Async service for managing action reminder notifications"""
    
    TEMPLATE_NAME = "action_reminder"
    MAX_REMINDERS = 3
    REMINDER_INTERVAL_HOURS = 24
    
    def __init__(self, db: AsyncSession, email_service: EmailService):
        self.db = db
        self.email_service = email_service
        self.jinja_env = self._setup_jinja_env()
    
    def _setup_jinja_env(self) -> Environment:
        """Setup Jinja2 environment pointing to templates/email"""
        template_dir = Path(__file__).resolve().parent.parent / "templates" / "email"
        logger.info(f"Email template directory resolved to: {template_dir}")
        
        if not template_dir.exists():
            logger.error(f"Template directory does not exist at {template_dir}")
            
        return Environment(loader=FileSystemLoader(str(template_dir)))
    
    async def find_actions_needing_reminders(self) -> List[MeetingAction]:
        """Find all actions that need reminders sent with eager-loaded relationships."""
        now = datetime.now(timezone.utc)
        cutoff_time = now - timedelta(hours=self.REMINDER_INTERVAL_HOURS)
        
        stmt = (
            select(MeetingAction)
            .options(
                selectinload(MeetingAction.implementers),
                selectinload(MeetingAction.overall_status),
            )
            .where(
                and_(
                    MeetingAction.is_active == True,
                    MeetingAction.completed_at.is_(None),
                    MeetingAction.reminder_count < self.MAX_REMINDERS,
                    or_(
                        MeetingAction.last_reminder_sent_at.is_(None),
                        MeetingAction.last_reminder_sent_at <= cutoff_time
                    )
                )
            )
        )
        
        result = await self.db.execute(stmt)
        actions = result.scalars().unique().all()
        
        active_actions = []
        for action in actions:
            if action.overall_status and getattr(action.overall_status, 'code', None) == 'CANCELLED':
                continue
            active_actions.append(action)
        
        logger.info(f"Found {len(active_actions)} actions needing reminders")
        return active_actions
    
    async def send_reminders_for_action(
        self, 
        action: MeetingAction, 
        triggered_by_user_id: UUID
    ) -> Dict[str, Any]:
        """Send reminders to all implementers of an action."""
        result = {
            "action_id": str(action.id),
            "title": action.title,
            "total_implementers": len(action.implementers) if action.implementers else 0,
            "successful_notifications": 0,
            "failed_notifications": 0,
            "notifications": [],
            "error": None
        }
        
        try:
            if not action.implementers:
                logger.warning(f"Action {action.id} has no implementers to remind")
                return result
            
            # Extract plain primitive dictionary values to avoid MissingGreenlet triggers
            implementer_data = [
                {
                    "id": str(impl.id),
                    "name": impl.name,
                    "email": impl.email,
                    "user_id": getattr(impl, 'user_id', None),
                    "model_ref": impl
                }
                for impl in action.implementers
            ]
            
            template_data = self._prepare_template_data(action)
            
            for impl_info in implementer_data:
                try:
                    notification = await self._send_reminder_email(
                        action=action,
                        impl_info=impl_info,
                        template_data=template_data,
                    )
                    
                    status_val = notification.status.value if notification and notification.status else "FAILED"
                    result["notifications"].append({
                        "implementer_id": impl_info["id"],
                        "implementer_name": impl_info["name"],
                        "implementer_email": impl_info["email"],
                        "status": status_val,
                    })
                    
                    if notification and notification.status == NotificationStatus.SUCCESSFUL:
                        result["successful_notifications"] += 1
                        impl_info["model_ref"].notified_at = datetime.now(timezone.utc)
                    else:
                        result["failed_notifications"] += 1
                
                except Exception as e:
                    result["failed_notifications"] += 1
                    logger.error(f"Failed to send to {impl_info['email']}: {str(e)}", exc_info=True)
                    result["notifications"].append({
                        "implementer_id": impl_info["id"],
                        "implementer_name": impl_info["name"],
                        "error": str(e)
                    })
            
            if result["successful_notifications"] > 0:
                action.reminder_count = min(action.reminder_count + 1, self.MAX_REMINDERS)
                action.last_reminder_sent_by_id = triggered_by_user_id
                action.last_reminder_sent_at = datetime.now(timezone.utc)
                action.updated_at = datetime.now(timezone.utc)
                
                await self.db.commit()
                result["reminder_count"] = action.reminder_count
                logger.info(f"Sent {result['successful_notifications']} reminders for action {action.id}")
        
        except Exception as e:
            result["error"] = str(e)
            logger.error(f"Error in send_reminders_for_action: {str(e)}", exc_info=True)
            await self.db.rollback()
        
        return result
    
    def _prepare_template_data(self, action: MeetingAction) -> Dict[str, Any]:
        """Prepare data dictionary for email template."""
        all_implementers = []
        if action.implementers:
            all_implementers = [
                {"name": impl.name, "email": impl.email}
                for impl in action.implementers
            ]
        
        return {
            "action_title": action.title or "Action Item",
            "action_description": action.description or "",
            "due_date_formatted": self._format_date(action.due_date),
            "priority_label": getattr(action, 'priority_label', 'Medium'),
            "priority_css_class": self._get_priority_css_class(getattr(action, 'priority', 2)),
            "status_display": getattr(action, 'status_display', 'Pending'),
            "progress_percentage": getattr(action, 'overall_progress_percentage', 0),
            "issue_challenge": action.issue_challenge or "",
            "remarks": action.remarks or "",
            "is_overdue": getattr(action, 'is_overdue', False),
            "all_implementers": all_implementers,
            "last_updated_formatted": self._format_date(action.updated_at),
        }
    
    async def _send_reminder_email(
        self,
        action: MeetingAction,
        impl_info: Dict[str, Any],
        template_data: Dict[str, Any]
    ) -> Optional[Notification]:
        """Render template, persist notification record, and invoke email delivery."""
        try:
            template = self.jinja_env.get_template(f"{self.TEMPLATE_NAME}.html")
            
            email_data = {
                **template_data,
                "implementer_name": impl_info["name"],
                "reminder_batch_number": f"{action.reminder_count + 1}/{self.MAX_REMINDERS}",
                "action_url": self._build_action_url(action),
                "unsubscribe_url": self._build_unsubscribe_url(),
            }
            
            html_content = template.render(**email_data)
            
            notification = Notification(
                channel=NotificationChannel.EMAIL,
                user_id=impl_info["user_id"],
                recipient=impl_info["email"],
                recipient_name=impl_info["name"],
                subject=f"Action Reminder: {action.title or 'Task'} ({action.reminder_count + 1}/{self.MAX_REMINDERS})",
                content=html_content,
                template_name=self.TEMPLATE_NAME,
                category=NotificationCategory.MEETING_NOTIFICATION,
                status=NotificationStatus.PENDING,
                extra_data={
                    "action_id": str(action.id),
                    "implementer_id": impl_info["id"],
                    "reminder_count": action.reminder_count + 1,
                    "reminder_batch_number": f"{action.reminder_count + 1}/{self.MAX_REMINDERS}",
                }
            )
            self.db.add(notification)
            await self.db.flush()
            
            # Direct await on Async EmailService using matching parameter names
            success = await self.email_service.send_email(
                to_email=impl_info["email"],
                subject=notification.subject,
                html_content=html_content
            )
            
            if success:
                notification.status = NotificationStatus.SUCCESSFUL
                notification.sent_at = datetime.now(timezone.utc)
                logger.info(f"✅ Email sent to {impl_info['email']}")
            else:
                notification.status = NotificationStatus.FAILED
                notification.error_message = "Email Service dispatch returned False"
                logger.error(f"❌ Email dispatch failed for {impl_info['email']}")

            await self.db.commit()
            return notification

        except Exception as e:
            logger.error(f"Error in _send_reminder_email for {impl_info.get('email')}: {str(e)}", exc_info=True)
            try:
                await self.db.rollback()
            except Exception:
                pass
            return None

    async def send_all_pending_reminders(self, triggered_by_user_id: UUID) -> Dict[str, Any]:
        """Find and send reminders for all eligible actions."""
        results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actions_found": 0,
            "actions_processed": 0,
            "total_implementers_reminded": 0,
            "total_notifications_sent": 0,
            "total_notifications_failed": 0,
            "action_results": [],
            "errors": []
        }
        
        try:
            actions = await self.find_actions_needing_reminders()
            results["actions_found"] = len(actions)
            
            for action in actions:
                try:
                    action_result = await self.send_reminders_for_action(action, triggered_by_user_id)
                    results["action_results"].append(action_result)
                    results["actions_processed"] += 1
                    results["total_implementers_reminded"] += action_result["total_implementers"]
                    results["total_notifications_sent"] += action_result["successful_notifications"]
                    results["total_notifications_failed"] += action_result["failed_notifications"]
                except Exception as e:
                    error_msg = f"Error processing action {action.id}: {str(e)}"
                    results["errors"].append(error_msg)
                    logger.error(error_msg, exc_info=True)
        
        except Exception as e:
            error_msg = f"Critical error in send_all_pending_reminders: {str(e)}"
            results["errors"].append(error_msg)
            logger.error(error_msg, exc_info=True)
        
        return results

    def _format_date(self, dt: Optional[datetime]) -> str:
        if not dt:
            return "Not specified"
        return dt.strftime("%b %d, %Y at %I:%M %p")

    def _get_priority_css_class(self, priority: int) -> str:
        priority_classes = {1: "high", 2: "medium", 3: "low", 4: "very-low"}
        return priority_classes.get(priority, "medium")

    def _build_action_url(self, action: MeetingAction) -> str:
        base_url = os.getenv("FRONTEND_BASE_URL", "https://app.ecactiontracker.com")
        return f"{base_url}/actions/{action.id}"

    def _build_unsubscribe_url(self) -> str:
        base_url = os.getenv("FRONTEND_BASE_URL", "https://app.ecactiontracker.com")
        return f"{base_url}/settings/notifications"