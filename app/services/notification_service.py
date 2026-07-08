# app/services/notification_service.py

import base64
import logging
from pathlib import Path
from typing import Any, Dict, Optional, List
from datetime import datetime
import uuid
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.email_service import email_service
from app.models.notification import (
    Notification, 
    NotificationChannel, 
    NotificationStatus, 
    NotificationCategory
)
from app.models.meetings.action_tracker import Meeting, MeetingParticipant
from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for sending notifications with database logging."""
    
    @staticmethod
    def get_organization_name() -> str:
        """Get organization name from settings."""
        return getattr(settings, 'ORGANIZATION_NAME', 'Your Organization')
    
    @staticmethod
    def get_organization_short() -> str:
        """Get short organization name."""
        org_name = NotificationService.get_organization_name()
        return org_name[:10] if len(org_name) > 10 else org_name
    
    @staticmethod
    def get_support_email() -> str:
        """Get support email from settings."""
        return getattr(settings, 'SUPPORT_EMAIL', 'support@example.com')
    
    @staticmethod
    def _find_logo_file() -> Optional[Path]:
        """Centralized logo discovery."""
        base_dir = Path(__file__).resolve().parent.parent
        candidates = [
            base_dir / "static" / "images.jpeg",
            base_dir / "static" / "images.jpg",
            base_dir / "static" / "logo.jpeg",
            base_dir / "static" / "logo.jpg",
            base_dir / "static" / "images" / "logo.jpg",
            base_dir / "static" / "images" / "logo.jpeg",
            base_dir / "static" / "images" / "images.jpg",
            base_dir / "static" / "images" / "images.jpeg",
            Path("app/static/images.jpeg"),
            Path("app/static/images.jpg"),
            Path("static/images.jpeg"),
            Path("static/images.jpg"),
        ]
        for p in candidates:
            if p.exists():
                return p
        return None
    
    @staticmethod
    def get_logo_for_email() -> Optional[Dict[str, Any]]:
        """
        Returns dict with 'url' or 'cid' + 'content' for proper embedding.
        """
        try:
            from app.core.config import settings
            
            # 1. Preferred: Configured public URL (best for most clients)
            logo_url = getattr(settings, 'LOGO_URL', None)
            if logo_url and logo_url.startswith(('http://', 'https://')):
                logger.info(f"✅ Using public LOGO_URL: {logo_url}")
                return {"type": "url", "value": logo_url}
            
            # 2. Try to find local file and prepare for CID embedding
            logo_path = NotificationService._find_logo_file()
            if logo_path and logo_path.exists():
                logger.info(f"✅ Found logo file: {logo_path}")
                with open(logo_path, 'rb') as f:
                    image_data = f.read()
                
                ext = logo_path.suffix.lower()
                mime_type = 'image/jpeg' if ext in ['.jpg', '.jpeg'] else 'image/png'
                
                cid = f"logo_{uuid.uuid4().hex[:8]}"
                
                return {
                    "type": "cid",
                    "cid": cid,
                    "mime_type": mime_type,
                    "data": image_data,  # raw bytes
                    "base64": base64.b64encode(image_data).decode('utf-8'),
                    "value": f"data:{mime_type};base64,{base64.b64encode(image_data).decode('utf-8')}"  # For template
                }
            
            # 3. Fallback: Use a text-based SVG (always works)
            org_name = NotificationService.get_organization_name()
            svg_data = f'''<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60">
                <rect width="200" height="60" rx="8" fill="#1e293b"/>
                <text x="20" y="38" font-family="Arial, sans-serif" font-size="20" fill="white" font-weight="bold">{org_name}</text>
            </svg>'''
            svg_base64 = base64.b64encode(svg_data.encode('utf-8')).decode('utf-8')
            
            logger.info(f"✅ Using SVG text logo for: {org_name}")
            return {
                "type": "url",
                "value": f"data:image/svg+xml;base64,{svg_base64}"
            }
            
        except Exception as e:
            logger.error(f"Error preparing logo: {e}")
            return None
    
    @staticmethod
    def convert_to_serializable(obj):
        """Convert asyncpg UUID and other non-serializable objects to strings."""
        if hasattr(obj, '__class__') and obj.__class__.__module__ == 'asyncpg.pgproto.pgproto':
            return str(obj)
        elif hasattr(obj, 'isoformat') and callable(getattr(obj, 'isoformat')):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {k: NotificationService.convert_to_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [NotificationService.convert_to_serializable(item) for item in obj]
        else:
            return obj
    
    @staticmethod
    def safe_get_attr(obj, attr, default=None):
        """Safely get attribute, handling UUID conversion."""
        try:
            value = getattr(obj, attr, default)
            return NotificationService.convert_to_serializable(value)
        except Exception:
            return default
    
    @staticmethod
    async def create_notification_record(
        db: AsyncSession,
        channel: NotificationChannel,
        recipient: str,
        recipient_name: Optional[str],
        content: str,
        subject: Optional[str] = None,
        category: NotificationCategory = NotificationCategory.MEETING_NOTIFICATION,
        template_name: str = "meeting_invitation",
        meeting_id: Optional[uuid.UUID] = None,
        participant_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
        status: NotificationStatus = NotificationStatus.PENDING,
        error_message: Optional[str] = None,
        provider_message_id: Optional[str] = None,
        extra_data: Optional[Dict] = None,
    ) -> Notification:
        """Create a notification record in the database."""
        notification = Notification(
            id=uuid.uuid4(),
            channel=channel,
            recipient=recipient,
            recipient_name=recipient_name,
            content=content,
            subject=subject,
            template_name=template_name,
            category=category,
            meeting_id=meeting_id,
            participant_id=participant_id,
            user_id=user_id,
            status=status,
            error_message=error_message,
            provider_message_id=provider_message_id,
            extra_data=extra_data or {},
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        
        logger.info(f"📝 Created notification record: {notification.id} ({channel.value} to {recipient})")
        return notification
    
    @staticmethod
    async def update_notification_status(
        db: AsyncSession,
        notification_id: uuid.UUID,
        status: NotificationStatus,
        error_message: Optional[str] = None,
        provider_message_id: Optional[str] = None,
        sent_at: Optional[datetime] = None,
    ) -> Optional[Notification]:
        """Update the status of a notification."""
        result = await db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            logger.warning(f"Notification {notification_id} not found")
            return None
        
        notification.status = status
        notification.updated_at = datetime.now()
        
        if error_message:
            notification.error_message = error_message
        
        if provider_message_id:
            notification.provider_message_id = provider_message_id
        
        if sent_at:
            notification.sent_at = sent_at
        elif status == NotificationStatus.SUCCESSFUL:
            notification.sent_at = datetime.now()
        
        await db.commit()
        await db.refresh(notification)
        
        logger.info(f"📝 Updated notification {notification_id} status to {status.value}")
        return notification
    
    @staticmethod
    async def send_meeting_invitation(
        db: AsyncSession,
        meeting: Meeting,
        participant: MeetingParticipant,
        custom_message: Optional[str] = None,
        channel: NotificationChannel = NotificationChannel.EMAIL,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Send a meeting invitation with logo and log to database."""
        notification_record = None
        
        try:
            # Get the absolute path to the templates directory
            current_dir = Path(__file__).resolve().parent.parent
            template_dir = current_dir / "templates" / "meetings"
            
            if not template_dir.exists():
                template_dir = Path("app/templates/meetings")
            
            logger.info(f"Looking for templates in: {template_dir}")
            
            # Get organization info from settings
            organization_name = NotificationService.get_organization_name()
            organization_short = NotificationService.get_organization_short()
            support_email = NotificationService.get_support_email()
            
            # ==================== LOGO HANDLING ====================
            logo_info = NotificationService.get_logo_for_email()

            # Safe logging - check if logo_info is a dict
            logger.info("=" * 80)
            if logo_info and isinstance(logo_info, dict):
                logo_type = logo_info.get('type', 'unknown')
                if logo_type == 'url':
                    logger.info(f"✅ Using logo URL: {logo_info.get('value', '')[:60]}...")
                elif logo_type == 'cid':
                    logger.info(f"✅ Using embedded logo (CID): {logo_info.get('cid', 'unknown')}")
                else:
                    logger.info(f"✅ Logo type: {logo_type}")
            else:
                logger.warning("⚠️ No logo found or invalid format")
            logger.info("=" * 80)
            
            # Prepare meeting data
            meeting_id_str = NotificationService.convert_to_serializable(meeting.id)
            
            meeting_date = "Date TBD"
            if hasattr(meeting, 'meeting_date') and meeting.meeting_date:
                try:
                    meeting_date = meeting.meeting_date.strftime("%A, %B %d, %Y")
                except:
                    meeting_date = str(meeting.meeting_date)
            
            meeting_time = "Time TBD"
            if hasattr(meeting, 'start_time') and meeting.start_time:
                try:
                    start_time = meeting.start_time.strftime("%I:%M %p")
                except:
                    start_time = str(meeting.start_time)
                
                if hasattr(meeting, 'end_time') and meeting.end_time:
                    try:
                        end_time = meeting.end_time.strftime("%I:%M %p")
                    except:
                        end_time = str(meeting.end_time)
                    meeting_time = f"{start_time} - {end_time}"
                else:
                    meeting_time = start_time
            
            participants_count = 0
            chairpersons_count = 0
            secretaries_count = 0
            
            if hasattr(meeting, 'participants') and meeting.participants:
                participants_count = len(meeting.participants)
                chairpersons_count = sum(1 for p in meeting.participants if getattr(p, 'is_chairperson', False))
                secretaries_count = sum(1 for p in meeting.participants if getattr(p, 'is_secretary', False))
            
            meeting_link = None
            if hasattr(meeting, 'meeting_link'):
                meeting_link = getattr(meeting, 'meeting_link', None)
            if not meeting_link and hasattr(meeting, 'virtual_link'):
                meeting_link = getattr(meeting, 'virtual_link', None)
            
            title = NotificationService.safe_get_attr(meeting, 'title', 'Meeting')
            description = NotificationService.safe_get_attr(meeting, 'description', '')
            location_text = NotificationService.safe_get_attr(meeting, 'location_text', 'Location TBD')
            is_virtual = NotificationService.safe_get_attr(meeting, 'is_virtual', False)
            passcode = NotificationService.safe_get_attr(meeting, 'passcode', None)
            
            created_by_name = "System"
            if hasattr(meeting, 'created_by') and meeting.created_by:
                if hasattr(meeting.created_by, 'full_name') and meeting.created_by.full_name:
                    created_by_name = meeting.created_by.full_name
                elif hasattr(meeting.created_by, 'username'):
                    created_by_name = meeting.created_by.username
            
            status_name = "Scheduled"
            if hasattr(meeting, 'status') and meeting.status:
                if hasattr(meeting.status, 'name') and meeting.status.name:
                    status_name = meeting.status.name
                elif hasattr(meeting.status, 'short_name'):
                    status_name = meeting.status.short_name

            # ==================== TEMPLATE DATA ====================
            template_data = {
                "meeting": meeting,
                "meeting_id": meeting_id_str[:8] if meeting_id_str else "N/A",
                "meeting_title": title,
                "meeting_description": description,
                "meeting_date": meeting_date,
                "meeting_time": meeting_time,
                "location_text": location_text,
                "participant_name": participant.name if hasattr(participant, 'name') else "Participant",
                "participant_email": NotificationService.safe_get_attr(participant, 'email', ''),
                "participants_count": participants_count,
                "chairpersons_count": chairpersons_count,
                "secretaries_count": secretaries_count,
                "agenda_items": [],
                "custom_message": custom_message or "",
                "is_virtual": is_virtual,
                "meeting_link": meeting_link,
                "passcode": passcode,
                "organization_name": organization_name,
                "organization_short": organization_short,
                "support_email": support_email,
                "created_by_name": created_by_name,
                "status_name": status_name,
                "year": datetime.now().year,
                "frontend_url": getattr(settings, 'FRONTEND_URL', 'http://localhost:8001'),
                # Logo handling for template - extract the URL from logo_info
                "logo_url": logo_info.get('value') if logo_info and isinstance(logo_info, dict) else None,
                "logo_cid": logo_info.get('cid') if logo_info and isinstance(logo_info, dict) else None,
                "logo_type": logo_info.get('type') if logo_info and isinstance(logo_info, dict) else None,
            }
            
            # Set up Jinja2 environment
            env = Environment(
                loader=FileSystemLoader(str(template_dir)),
                autoescape=select_autoescape(['html', 'xml'])
            )
            
            # Determine template name
            if channel == NotificationChannel.EMAIL:
                template_name = 'email/meeting_invitation.html'
            elif channel == NotificationChannel.SMS:
                template_name = 'sms/meeting_invitation.txt'
            elif channel == NotificationChannel.WHATSAPP:
                template_name = 'whatsapp/meeting_invitation.txt'
            else:
                template_name = 'email/meeting_invitation.html'
            
            # Render the template
            try:
                template = env.get_template(template_name)
                content = template.render(**template_data)
                logger.info(f"Successfully rendered template: {template_name}")
            except Exception as e:
                logger.error(f"Failed to render template {template_name}: {e}")
                import traceback
                logger.error(traceback.format_exc())
                
                # Fallback content with organization name
                content = f"""
                <html>
                <body>
                    <h1>Meeting Invitation</h1>
                    <p>Dear {participant.name if hasattr(participant, 'name') else 'Participant'},</p>
                    <p>You are invited to: {title}</p>
                    <p>Date: {meeting_date}</p>
                    <p>Time: {meeting_time}</p>
                    <p>Location: {location_text}</p>
                    {f'<p>Join: <a href="{meeting_link}">{meeting_link}</a></p>' if meeting_link else ''}
                    <hr>
                    <p style="font-size: 12px; color: #666;">{organization_name} | Support: {support_email}</p>
                </body>
                </html>
                """
            
            # Get recipient
            if channel == NotificationChannel.EMAIL:
                recipient = participant.email if hasattr(participant, 'email') and participant.email else None
            else:
                recipient = participant.telephone if hasattr(participant, 'telephone') and participant.telephone else None
            
            if not recipient:
                logger.warning(f"No {channel.value} contact found for participant: {participant.name}")
                return {
                    "success": False,
                    "error": f"No {channel.value} contact found for participant",
                    "content": content
                }
            
            # ===== CREATE NOTIFICATION RECORD =====
            notification_record = await NotificationService.create_notification_record(
                db=db,
                channel=channel,
                recipient=recipient,
                recipient_name=participant.name if hasattr(participant, 'name') else None,
                content=content,
                subject=f"📅 Meeting Invitation: {title}" if channel == NotificationChannel.EMAIL else None,
                category=NotificationCategory.MEETING_NOTIFICATION,
                template_name=template_name,
                meeting_id=meeting.id,
                participant_id=participant.id,
                user_id=user_id,
                status=NotificationStatus.PENDING,
                extra_data={
                    "meeting_title": title,
                    "meeting_date": meeting_date,
                    "custom_message": custom_message,
                    "logo_used": logo_info is not None,
                    "organization": organization_name,
                }
            )
            
            # ===== SEND THE NOTIFICATION =====
            try:
                if channel == NotificationChannel.EMAIL:
                    # Send email - pass logo_info if needed by email service
                    result = await email_service.send_email(
                        to_email=recipient,
                        subject=f"📅 Meeting Invitation: {title}",
                        html_content=content
                    )
                    
                    if result:
                        # Update notification status to SUCCESSFUL
                        await NotificationService.update_notification_status(
                            db=db,
                            notification_id=notification_record.id,
                            status=NotificationStatus.SUCCESSFUL,
                            sent_at=datetime.now()
                        )
                        
                        logger.info(f"✅ Email sent successfully to {recipient}")
                        
                        return {
                            "success": True,
                            "content": content,
                            "recipient": recipient,
                            "subject": f"📅 Meeting Invitation: {title}",
                            "notification_id": str(notification_record.id),
                            "logo_used": logo_info is not None,
                            "email_sent": True
                        }
                    else:
                        # Update notification status to FAILED
                        await NotificationService.update_notification_status(
                            db=db,
                            notification_id=notification_record.id,
                            status=NotificationStatus.FAILED,
                            error_message="Email service returned failure"
                        )
                        
                        return {
                            "success": False,
                            "error": "Email service returned failure",
                            "notification_id": str(notification_record.id)
                        }
                
                elif channel == NotificationChannel.SMS:
                    logger.warning("SMS sending not yet implemented")
                    await NotificationService.update_notification_status(
                        db=db,
                        notification_id=notification_record.id,
                        status=NotificationStatus.FAILED,
                        error_message="SMS sending not implemented"
                    )
                    return {
                        "success": False,
                        "error": "SMS sending not implemented",
                        "notification_id": str(notification_record.id)
                    }
                
                elif channel == NotificationChannel.WHATSAPP:
                    logger.warning("WhatsApp sending not yet implemented")
                    await NotificationService.update_notification_status(
                        db=db,
                        notification_id=notification_record.id,
                        status=NotificationStatus.FAILED,
                        error_message="WhatsApp sending not implemented"
                    )
                    return {
                        "success": False,
                        "error": "WhatsApp sending not implemented",
                        "notification_id": str(notification_record.id)
                    }
                
                else:
                    return {
                        "success": False,
                        "error": f"Unsupported channel: {channel}"
                    }
                
            except Exception as send_error:
                logger.error(f"Failed to send {channel.value}: {send_error}")
                import traceback
                logger.error(traceback.format_exc())
                
                if notification_record:
                    await NotificationService.update_notification_status(
                        db=db,
                        notification_id=notification_record.id,
                        status=NotificationStatus.FAILED,
                        error_message=str(send_error)
                    )
                
                return {
                    "success": False,
                    "error": f"Failed to send {channel.value}: {str(send_error)}",
                    "notification_id": str(notification_record.id) if notification_record else None
                }
            
        except Exception as e:
            logger.error(f"Error sending invitation: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
            if notification_record:
                try:
                    await NotificationService.update_notification_status(
                        db=db,
                        notification_id=notification_record.id,
                        status=NotificationStatus.FAILED,
                        error_message=str(e)
                    )
                except:
                    pass
            
            return {"success": False, "error": str(e)}