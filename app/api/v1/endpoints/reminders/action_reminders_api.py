"""
API endpoints for action reminder notifications - FIXED ADMIN CHECK VERSION
Async version for FastAPI with SQLAlchemy async.

This version uses a flexible admin check that works with any User model structure.

Endpoints:
- POST /api/v1/action-reminders/send - Trigger reminder job manually
- GET /api/v1/action-reminders/status/{action_id} - Get reminder status for an action
- GET /api/v1/actions/{action_id}/reminder-history - Get reminder history for an action
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from app.db.session import get_db
from app.models.meetings.action_tracker import MeetingAction
from app.models.notification import Notification, NotificationCategory
from app.models.user import User
from app.services.action_reminder_service import ActionReminderService
from app.services.email_service import EmailService
from app.core.security import get_current_user

router = APIRouter(prefix="/reminders", tags=["action-reminders"])


# ==================== FLEXIBLE ADMIN CHECK ====================

def is_user_admin(user: User) -> bool:
    """
    Universal admin check that works with any User model structure.
    
    Tries multiple possible admin field names:
    - is_staff (Django-like)
    - is_admin (simple models)
    - is_superuser (auth systems)
    - role.is_admin (role-based)
    - role.code == 'ADMIN' (role code-based)
    - 'admin' in permissions (permission-based)
    
    Returns:
        True if user has admin privileges, False otherwise
    """
    # Check is_staff (most common)
    if getattr(user, 'is_staff', False):
        return True
    
    # Check is_admin
    if getattr(user, 'is_admin', False):
        return True
    
    # Check is_superuser
    if getattr(user, 'is_superuser', False):
        return True
    
    # Check role.is_admin (role relationship)
    if hasattr(user, 'role') and user.role:
        if getattr(user.role, 'is_admin', False):
            return True
        # Check role code
        if getattr(user.role, 'code', None) == 'ADMIN':
            return True
    
    # Check permissions list
    if hasattr(user, 'permissions'):
        if 'admin' in getattr(user, 'permissions', []):
            return True
    
    return False


# ==================== API ENDPOINTS ====================

@router.post("/send")
async def trigger_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    action_ids: Optional[List[str]] = Query(None, description="Specific action IDs to remind. If None, all eligible actions will be processed."),
    dry_run: bool = Query(False, description="If true, find actions but don't send emails")
):
    """
    Trigger action reminders to be sent.
    
    Can be:
    - Called manually via this endpoint
    - Scheduled to run daily via Celery Beat or APScheduler
    
    Args:
        action_ids: Specific action UUIDs to send reminders for (optional)
        dry_run: If true, only find actions but don't send emails
    
    Returns:
        Results of the reminder job
    """
    # Check authorization - only admins can trigger
    if not is_user_admin(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only administrators can trigger reminders"
        )
    
    email_service = EmailService()
    service = ActionReminderService(db, email_service)
    
    if action_ids:
        # Send reminders for specific actions
        results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_type": "specific_actions",
            "dry_run": dry_run,
            "action_results": [],
            "total_sent": 0,
            "total_failed": 0,
            "errors": []
        }
        
        for action_id_str in action_ids:
            try:
                action_id = UUID(action_id_str)
                
                # Query for action
                stmt = select(MeetingAction).where(MeetingAction.id == action_id)
                result = await db.execute(stmt)
                action = result.scalar_one_or_none()
                
                if not action:
                    results["errors"].append(f"Action {action_id_str} not found")
                    continue
                
                if not action.should_send_reminder:
                    results["errors"].append(
                        f"Action {action_id_str} doesn't need reminders "
                        f"(completed={action.is_completed}, "
                        f"reminder_count={action.reminder_count})"
                    )
                    continue
                
                if dry_run:
                    results["action_results"].append({
                        "action_id": str(action.id),
                        "would_remind": True,
                        "implementers_count": len(action.implementers) if action.implementers else 0
                    })
                else:
                    action_result = await service.send_reminders_for_action(
                        action,
                        current_user.id
                    )
                    results["action_results"].append(action_result)
                    results["total_sent"] += action_result["successful_notifications"]
                    results["total_failed"] += action_result["failed_notifications"]
            
            except Exception as e:
                results["errors"].append(f"Error processing {action_id_str}: {str(e)}")
    
    else:
        # Send reminders for all eligible actions
        if dry_run:
            actions = await service.find_actions_needing_reminders()
            results = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "request_type": "all_eligible",
                "dry_run": True,
                "actions_found": len(actions),
                "action_preview": [
                    {
                        "id": str(action.id),
                        "title": action.title,
                        "reminder_count": action.reminder_count,
                        "implementers_count": len(action.implementers) if action.implementers else 0,
                    }
                    for action in actions[:10]  # Preview first 10
                ]
            }
        else:
            results = await service.send_all_pending_reminders(current_user.id)
            results["request_type"] = "all_eligible"
    
    return results


@router.get("/status/{action_id}")
async def get_action_reminder_status(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get reminder status for a specific action.
    
    Returns:
        - Reminder count (0-3)
        - Last reminder sent time
        - Whether more reminders can be sent
        - All notifications sent for this action
    """
    stmt = select(MeetingAction).where(MeetingAction.id == action_id)
    result = await db.execute(stmt)
    action = result.scalar_one_or_none()
    
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    # Get all notifications for this action
    stmt_notif = select(Notification).where(
        Notification.extra_data.astext.contains(f'"{action_id}"')
    )
    result_notif = await db.execute(stmt_notif)
    notifications = result_notif.scalars().all()
    
    return {
        "action_id": str(action.id),
        "reminder_count": action.reminder_count,
        "reminder_batch_number": action.reminder_batch_number,
        "can_send_more_reminders": action.can_send_more_reminders,
        "last_reminder_sent_at": action.last_reminder_sent_at.isoformat() if action.last_reminder_sent_at else None,
        "last_reminder_sent_by": action.last_reminder_sent_by_name,
        "should_send_reminder": action.should_send_reminder,
        "is_completed": action.is_completed,
        "total_notifications_sent": len([n for n in notifications if n.channel.value == "email"]),
        "implementers": [
            {
                "id": str(impl.id),
                "name": impl.name,
                "email": impl.email,
                "notified_at": impl.notified_at.isoformat() if impl.notified_at else None,
            }
            for impl in (action.implementers or [])
        ]
    }


@router.get("/actions/{action_id}/reminder-history")
async def get_action_reminder_history(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Get detailed reminder notification history for an action.
    
    Includes all emails sent and their delivery status.
    """
    # Check action exists
    stmt = select(MeetingAction).where(MeetingAction.id == action_id)
    result = await db.execute(stmt)
    action = result.scalar_one_or_none()
    
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    # Query notifications for this action
    stmt_notif = select(Notification).where(
        Notification.category == NotificationCategory.MEETING_NOTIFICATION,
        Notification.extra_data.astext.contains(f'"{action_id}"')
    ).order_by(
        Notification.created_at.desc()
    ).offset(skip).limit(limit)
    
    result_notif = await db.execute(stmt_notif)
    notifications = result_notif.scalars().all()
    
    return {
        "action_id": str(action.id),
        "action_title": action.title,
        "total_reminders_sent": action.reminder_count,
        "notifications": [
            {
                "id": str(notif.id),
                "recipient": notif.recipient,
                "recipient_name": notif.recipient_name,
                "status": notif.status.value if notif.status else None,
                "sent_at": notif.sent_at.isoformat() if notif.sent_at else None,
                "is_opened": notif.is_opened,
                "opened_at": notif.opened_at.isoformat() if notif.opened_at else None,
                "error_message": notif.error_message,
                "created_at": notif.created_at.isoformat() if notif.created_at else None,
            }
            for notif in notifications
        ],
        "pagination": {
            "skip": skip,
            "limit": limit,
            "total": len(notifications)
        }
    }


@router.post("/actions/{action_id}/send-reminder")
async def send_reminder_for_action(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    force: bool = Query(False, description="Override 24-hour wait and reminder count limits"),
):
    """
    Send a reminder for a specific action immediately.
    
    Args:
        action_id: UUID of the action
        force: If true, bypass normal checks (reminder count, wait time)
    
    Returns:
        Results of sending reminders
    """
    # Check authorization - only admins can send reminders
    if not is_user_admin(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only administrators can send reminders"
        )
    
    stmt = select(MeetingAction).where(MeetingAction.id == action_id)
    result = await db.execute(stmt)
    action = result.scalar_one_or_none()
    
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    # Check if reminder can be sent
    if not force and not action.should_send_reminder:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot send reminder. Action is completed={action.is_completed}, "
                   f"reminder_count={action.reminder_count}, "
                   f"should_send_reminder={action.should_send_reminder}"
        )
    
    email_service = EmailService()
    service = ActionReminderService(db, email_service)
    
    results = await service.send_reminders_for_action(action, current_user.id)
    
    return {
        **results,
        "force_sent": force,
    }


@router.patch("/actions/{action_id}/reset-reminders")
async def reset_reminder_count(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reset reminder count for an action (admin only).
    
    Useful if a reminder was sent in error and needs to be resent.
    """
    # Check authorization - only admins can reset
    if not is_user_admin(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only administrators can reset reminders"
        )
    
    stmt = select(MeetingAction).where(MeetingAction.id == action_id)
    result = await db.execute(stmt)
    action = result.scalar_one_or_none()
    
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    # Reset reminder tracking
    old_count = action.reminder_count
    action.reminder_count = 0
    action.last_reminder_sent_at = None
    action.last_reminder_sent_by_id = None
    action.updated_at = datetime.now(timezone.utc)
    action.updated_by_id = current_user.id
    
    await db.commit()
    
    return {
        "action_id": str(action.id),
        "message": f"Reminder count reset from {old_count} to 0",
        "new_reminder_count": action.reminder_count,
    }