import uuid
import logging
from typing import Optional, List
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func
from pydantic import BaseModel, Field

from app.api import deps
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.meetings.action_tracker import MeetingParticipant, Meeting
from app.models.notification import (
    Notification, 
    NotificationChannel, 
    NotificationStatus, 
    NotificationCategory
)
from app.services.email_service import email_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Setup Jinja2 environment pointing to app/templates base directory
jinja_env = Environment(loader=FileSystemLoader("app/templates"))

# 1x1 transparent PNG pixel
_TRANSPARENT_PIXEL = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a4944415478da6360000002000155273de50000000049454e44ae426082"
)

# ========== REQUEST MODELS ==========

class SendNotificationRequest(BaseModel):
    """
    ✅ Send notifications to meeting participants
    Frontend sends only IDs, backend looks up emails
    """
    meeting_id: uuid.UUID
    participant_ids: List[uuid.UUID] = Field(
        ..., 
        description="Participant IDs to notify - backend will look up their emails"
    )
    notification_type: List[str] = Field(
        ..., 
        description="Channels: 'email', 'whatsapp', 'sms'"
    )
    custom_message: Optional[str] = Field(
        default="",
        max_length=1000,
        description="Custom message for notification"
    )

class NotificationResponse(BaseModel):
    """Response for sent notification"""
    success: bool
    message: str
    notification_id: Optional[uuid.UUID] = None
    channel: Optional[str] = None
    recipient: Optional[str] = None
    status: Optional[str] = None

# ========== HELPER FUNCTIONS ==========

def _serialize(record) -> dict:
    """Serialize notification record to dict."""
    return {
        "id": str(record.id),
        "channel": record.channel.value if record.channel else None,
        "user_id": str(record.user_id) if record.user_id else None,
        "participant_id": str(record.participant_id) if record.participant_id else None,
        "meeting_id": str(record.meeting_id) if record.meeting_id else None,
        "recipient": record.recipient,
        "recipient_name": record.recipient_name,
        "subject": record.subject,
        "content": record.content,
        "template_name": record.template_name,
        "category": record.category.value if record.category else None,
        "status": record.status.value if record.status else None,
        "error_message": record.error_message,
        "sent_at": record.sent_at.isoformat() if record.sent_at else None,
        "is_opened": record.is_opened,
        "opened_at": record.opened_at.isoformat() if record.opened_at else None,
        "open_count": record.open_count,
        "provider_message_id": record.provider_message_id,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "retry_count": getattr(record, 'retry_count', 0),
        "last_retry_at": record.last_retry_at.isoformat() if hasattr(record, 'last_retry_at') and record.last_retry_at else None,
    }

# ========== SEND NOTIFICATION ENDPOINT ==========

@router.post("/send-meeting-notification", operation_id="notifications_send_meeting")
async def send_meeting_notification(
    request: SendNotificationRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    ✅ Send notifications to meeting participants
    
    Frontend sends participant_ids, backend looks up their emails
    
    Supports:
    - Email notifications via SMTP
    - WhatsApp (if integrated)
    - SMS (if integrated)
    
    Returns tracking of each sent notification
    """
    
    logger.info(f"📧 Notification request from {current_user.email}")
    logger.info(f"   Meeting: {request.meeting_id}")
    logger.info(f"   Participant IDs: {len(request.participant_ids)}")
    logger.info(f"   Channels: {request.notification_type}")
    
    # Validate participant IDs
    if not request.participant_ids or len(request.participant_ids) == 0:
        logger.error("❌ No participant IDs provided")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No participant IDs provided"
        )
    
    # Validate notification types
    allowed_channels = ['email', 'whatsapp', 'sms']
    for channel in request.notification_type:
        if channel not in allowed_channels:
            logger.error(f"❌ Invalid notification type: {channel}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid notification type: {channel}. Allowed: {allowed_channels}"
            )
    
    # Fetch meeting details for context
    meeting_result = await db.execute(
        select(Meeting).where(Meeting.id == request.meeting_id)
    )
    meeting = meeting_result.scalar_one_or_none()
    
    # LOOKUP: Fetch participants from database using IDs
    logger.info(f"🔍 Looking up participant details from database...")
    
    result = await db.execute(
        select(MeetingParticipant).where(
            MeetingParticipant.id.in_(request.participant_ids),
            MeetingParticipant.meeting_id == request.meeting_id
        )
    )
    participants_from_db = result.scalars().all()
    
    if not participants_from_db:
        logger.error("❌ No participants found in database for provided IDs")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No participants found for the provided IDs in this meeting"
        )
    
    logger.info(f"   ✅ Found {len(participants_from_db)} participants in database")
    
    results = {
        "total_recipients": len(participants_from_db),
        "total_sent": 0,
        "total_failed": 0,
        "by_channel": {
            "email": {"sent": 0, "failed": 0},
            "whatsapp": {"sent": 0, "failed": 0},
            "sms": {"sent": 0, "failed": 0},
        },
        "details": []
    }
    
    # Build absolute frontend URL for email template links
    base_frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    meeting_detail_url = f"{base_frontend_url}/meetings/{request.meeting_id}"

    # ========== SEND EMAILS ==========
    if "email" in request.notification_type:
        logger.info("📧 Sending emails...")
        
        for participant in participants_from_db:
            notification_id = uuid.uuid4()
            
            try:
                target_email = None
                name = getattr(participant, 'name', None) or getattr(participant, 'full_name', None) or "Participant"

                # 1. Direct participant email check
                if getattr(participant, 'email', None) and "@" in participant.email:
                    target_email = participant.email

                # 2. Extract from JSON field (assigned_to_name)
                if not target_email and hasattr(participant, 'assigned_to_name') and participant.assigned_to_name:
                    assigned_data = participant.assigned_to_name
                    if isinstance(assigned_data, dict):
                        json_email = assigned_data.get("email")
                        if json_email and "@" in json_email:
                            target_email = json_email
                            if not name or name == "Participant":
                                name = assigned_data.get("name") or name

                # 3. Lookup via User relationship (assigned_to_id or user_id)
                user_id_to_check = getattr(participant, 'assigned_to_id', None) or getattr(participant, 'user_id', None)
                if not target_email and user_id_to_check:
                    user_result = await db.execute(
                        select(User).where(User.id == user_id_to_check)
                    )
                    user_obj = user_result.scalar_one_or_none()
                    if user_obj and user_obj.email and "@" in user_obj.email:
                        target_email = user_obj.email
                        if not name or name == "Participant":
                            name = getattr(user_obj, 'full_name', user_obj.email)

                # Skip if no valid domain email is available
                if not target_email or "@" not in target_email:
                    logger.warning(f"   ⚠️ Participant {participant.id} has no valid email address, skipping")
                    results["total_failed"] += 1
                    results["by_channel"]["email"]["failed"] += 1
                    results["details"].append({
                        "participant_id": str(participant.id),
                        "channel": "email",
                        "status": "failed",
                        "error": "No valid email address on file"
                    })
                    continue
                
                logger.debug(f"   → Sending email to: {target_email}")
                
                email_subject = f"Meeting Reminder: {getattr(meeting, 'title', 'Upcoming Meeting')}" if meeting else "Meeting Notification"
                
                # Render Jinja2 template from email/meeting_reminder.html
                try:
                    template = jinja_env.get_template("email/meeting_reminder.html")
                    email_body = template.render(
                        participant_name=name,
                        meeting_title=getattr(meeting, 'title', 'Upcoming Meeting') if meeting else 'Upcoming Meeting',
                        time_until=getattr(meeting, 'time_until', 'Soon') if meeting else 'Soon',
                        meeting_datetime=getattr(meeting, 'start_time', datetime.now()).strftime("%B %d, %Y at %I:%M %p") if meeting and getattr(meeting, 'start_time', None) else "TBD",
                        platform=getattr(meeting, 'platform', 'online') if meeting else 'online',
                        location=getattr(meeting, 'location', 'N/A') if meeting else 'N/A',
                        meeting_link=getattr(meeting, 'meeting_link', None) if meeting else None,
                        meeting_detail_link=meeting_detail_url,
                        primary_color="#1e40af",
                        project_name="ECATMIS",
                        custom_message=request.custom_message
                    )
                except Exception as t_err:
                    logger.warning(f"Failed to load template, falling back to layout: {t_err}")
                    email_body = f"""
                    <html>
                        <body style="font-family: Arial, sans-serif; color: #333;">
                            <div style="max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #1e40af;">Meeting Notification</h2>
                                <p>Dear {name},</p>
                                <p>You have been notified about an upcoming meeting.</p>
                                {f'<div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #1e40af; margin: 20px 0;"><strong>Message:</strong><p>{request.custom_message}</p></div>' if request.custom_message else ''}
                                <p style="margin-top: 20px;">
                                    <a href="{meeting_detail_url}" style="background-color: #1e40af; color: #ffffff; padding: 10px 15px; text-decoration: none; border-radius: 4px;">View Meeting Details</a>
                                </p>
                                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                                <p style="font-size: 12px; color: #999;">
                                    This email was sent to {target_email}. This is an automated notification.
                                </p>
                            </div>
                        </body>
                    </html>
                    """
                
                # Send via email service
                email_result = await email_service.send_email(
                    to_email=target_email,
                    subject=email_subject,
                    html_content=email_body
                )
                
                category_val = getattr(NotificationCategory, 'MEETING', getattr(NotificationCategory, 'GENERAL', None))

                try:
                    if email_result.get("success"):
                        notification = Notification(
                            id=notification_id,
                            user_id=current_user.id,
                            participant_id=participant.id,
                            meeting_id=request.meeting_id,
                            channel=NotificationChannel.EMAIL,
                            recipient=target_email,
                            recipient_name=name,
                            subject=email_subject,
                            content=request.custom_message or email_subject,
                            template_name="email/meeting_reminder.html",
                            status=NotificationStatus.SUCCESSFUL,
                            sent_at=datetime.now(),
                            category=category_val,
                        )
                        db.add(notification)
                        await db.commit()

                        results["total_sent"] += 1
                        results["by_channel"]["email"]["sent"] += 1
                        results["details"].append({
                            "participant_id": str(participant.id),
                            "email": target_email,
                            "channel": "email",
                            "status": "success",
                            "notification_id": str(notification_id)
                        })
                        logger.info(f"   ✅ Email sent & logged to DB for {target_email} (ID: {notification_id})")
                    else:
                        notification = Notification(
                            id=notification_id,
                            user_id=current_user.id,
                            participant_id=participant.id,
                            meeting_id=request.meeting_id,
                            channel=NotificationChannel.EMAIL,
                            recipient=target_email,
                            recipient_name=name,
                            subject=email_subject,
                            content=request.custom_message or email_subject,
                            template_name="email/meeting_reminder.html",
                            status=NotificationStatus.FAILED,
                            error_message=email_result.get("message", "Unknown error"),
                            category=category_val,
                        )
                        db.add(notification)
                        await db.commit()

                        results["total_failed"] += 1
                        results["by_channel"]["email"]["failed"] += 1
                        results["details"].append({
                            "participant_id": str(participant.id),
                            "email": target_email,
                            "channel": "email",
                            "status": "failed",
                            "error": email_result.get("message"),
                            "notification_id": str(notification_id)
                        })
                        logger.error(f"   ❌ Email failed for {target_email}: {email_result.get('message')}")

                except Exception as db_err:
                    await db.rollback()
                    logger.error(f"   ❌ DB Error saving notification log: {str(db_err)}")

            except Exception as e:
                logger.error(f"   ❌ Exception sending email to participant {participant.id}: {str(e)}")
                await db.rollback()
                try:
                    category_val = getattr(NotificationCategory, 'MEETING', getattr(NotificationCategory, 'GENERAL', None))
                    notification = Notification(
                        id=notification_id,
                        user_id=current_user.id,
                        participant_id=participant.id,
                        meeting_id=request.meeting_id,
                        channel=NotificationChannel.EMAIL,
                        recipient=target_email or "unknown",
                        recipient_name=name if 'name' in locals() else "Unknown",
                        subject=email_subject if 'email_subject' in locals() else "Meeting Notification",
                        content=request.custom_message or "Meeting notification delivery failed",
                        template_name="email/meeting_reminder.html",
                        status=NotificationStatus.FAILED,
                        error_message=str(e),
                        category=category_val,
                    )
                    db.add(notification)
                    await db.commit()
                except Exception as db_error:
                    logger.error(f"   Failed to record notification in database: {str(db_error)}")
                    await db.rollback()
                
                results["total_failed"] += 1
                results["by_channel"]["email"]["failed"] += 1
                results["details"].append({
                    "participant_id": str(participant.id),
                    "channel": "email",
                    "status": "failed",
                    "error": str(e),
                    "notification_id": str(notification_id)
                })
    
    # ========== SEND WHATSAPP (stub - for integration) ==========
    if "whatsapp" in request.notification_type:
        logger.info("📱 WhatsApp support pending integration")
        for participant in participants_from_db:
            results["details"].append({
                "participant_id": str(participant.id),
                "phone": getattr(participant, 'phone', None),
                "channel": "whatsapp",
                "status": "pending",
                "message": "WhatsApp integration not yet implemented"
            })
    
    # ========== SEND SMS (stub - for integration) ==========
    if "sms" in request.notification_type:
        logger.info("📲 SMS support pending integration")
        for participant in participants_from_db:
            results["details"].append({
                "participant_id": str(participant.id),
                "phone": getattr(participant, 'phone', None),
                "channel": "sms",
                "status": "pending",
                "message": "SMS integration not yet implemented"
            })
    
    # ========== RETURN RESULTS ==========
    logger.info(f"✅ Notifications completed: {results['total_sent']} sent, {results['total_failed']} failed")
    
    return {
        "success": results["total_failed"] == 0,
        "message": f"Sent {results['total_sent']} notifications to {len(participants_from_db)} recipients, {results['total_failed']} failed",
        "results": results
    }

# ========== TRACKING PIXEL ==========

@router.get("/track/{tracking_id}.png", include_in_schema=False)
async def track_notification_open(
    tracking_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
):
    """
    Tracking pixel endpoint - records notification opens.
    Returns a 1x1 transparent PNG.
    """
    try:
        result = await db.execute(
            select(Notification).where(Notification.tracking_id == tracking_id)
        )
        notification = result.scalar_one_or_none()
        
        if notification:
            notification.is_opened = True
            notification.opened_at = datetime.now()
            notification.open_count = (notification.open_count or 0) + 1
            
            if request.client:
                ip = request.client.host
                if not notification.extra_data:
                    notification.extra_data = {}
                if 'opens' not in notification.extra_data:
                    notification.extra_data['opens'] = []
                notification.extra_data['opens'].append({
                    'timestamp': datetime.now().isoformat(),
                    'ip': ip,
                    'user_agent': request.headers.get('user-agent'),
                })
            
            await db.commit()
            logger.info(f"✅ Tracked notification open: {notification.id}")
        else:
            logger.warning(f"⚠️ Notification not found for tracking_id: {tracking_id}")
            
    except Exception as e:
        logger.warning(f"Failed to record notification open for {tracking_id}: {e}")
        await db.rollback()
    
    return Response(content=_TRANSPARENT_PIXEL, media_type="image/png")

# ========== GET NOTIFICATIONS ==========

@router.get("/me", operation_id="notifications_get_my_history")
async def get_my_notifications(
    channel: Optional[NotificationChannel] = Query(None),
    status_filter: Optional[NotificationStatus] = Query(None, alias="status"),
    category: Optional[NotificationCategory] = Query(None),
    meeting_id: Optional[uuid.UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get current user's notification history."""
    
    query = select(Notification).where(
        Notification.user_id == current_user.id,
    )
    
    if meeting_id:
        query = query.where(Notification.meeting_id == meeting_id)
    if channel:
        query = query.where(Notification.channel == channel)
    if status_filter:
        query = query.where(Notification.status == status_filter)
    if category:
        query = query.where(Notification.category == category)
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    query = query.order_by(desc(Notification.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return {
        "items": [_serialize(n) for n in notifications],
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@router.get("", include_in_schema=False)
@router.get("/", operation_id="notifications_list_all")
async def list_notifications(
    channel: Optional[NotificationChannel] = Query(None),
    status_filter: Optional[NotificationStatus] = Query(None, alias="status"),
    category: Optional[NotificationCategory] = Query(None),
    meeting_id: Optional[uuid.UUID] = Query(None),
    user_id: Optional[uuid.UUID] = Query(None),
    participant_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    List notifications with filters.
    Superusers can see all; regular users see only their own.
    """
    
    query = select(Notification)
    
    if not current_user.is_superuser:
        query = query.where(Notification.user_id == current_user.id)
    elif user_id:
        query = query.where(Notification.user_id == user_id)
    
    if meeting_id:
        query = query.where(Notification.meeting_id == meeting_id)
    if participant_id:
        query = query.where(Notification.participant_id == participant_id)
    if channel:
        query = query.where(Notification.channel == channel)
    if status_filter:
        query = query.where(Notification.status == status_filter)
    if category:
        query = query.where(Notification.category == category)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Notification.recipient.ilike(search_term),
                Notification.recipient_name.ilike(search_term),
                Notification.subject.ilike(search_term),
            )
        )
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    query = query.order_by(desc(Notification.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return {
        "items": [_serialize(n) for n in notifications],
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@router.get("/statistics", operation_id="notifications_get_statistics")
async def get_notification_statistics(
    meeting_id: Optional[uuid.UUID] = Query(None),
    channel: Optional[NotificationChannel] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get notification statistics."""
    
    query = select(Notification)
    
    if not current_user.is_superuser:
        query = query.where(Notification.user_id == current_user.id)
    
    if meeting_id:
        query = query.where(Notification.meeting_id == meeting_id)
    if channel:
        query = query.where(Notification.channel == channel)
    if start_date:
        query = query.where(Notification.created_at >= start_date)
    if end_date:
        query = query.where(Notification.created_at <= end_date)
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    total = len(notifications)
    successful = sum(1 for n in notifications if n.status == NotificationStatus.SUCCESSFUL)
    failed = sum(1 for n in notifications if n.status == NotificationStatus.FAILED)
    pending = sum(1 for n in notifications if n.status == NotificationStatus.PENDING)
    opened = sum(1 for n in notifications if n.is_opened)
    
    channel_counts = {}
    for n in notifications:
        if n.channel:
            key = n.channel.value
            channel_counts[key] = channel_counts.get(key, 0) + 1
    
    return {
        "total": total,
        "successful": successful,
        "failed": failed,
        "pending": pending,
        "opened": opened,
        "open_rate": round((opened / total * 100) if total > 0 else 0, 2),
        "by_status": {
            "successful": successful,
            "failed": failed,
            "pending": pending,
        },
        "by_channel": channel_counts,
    }

@router.get("/{notification_id}", operation_id="notifications_get_one")
async def get_notification_detail(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get notification details."""
    
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Notification not found"
        )
    
    if notification.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized to view this notification"
        )
    
    return _serialize(notification)

@router.post("/resend/{notification_id}", operation_id="notifications_resend")
async def resend_notification(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Resend a failed notification."""
    
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Notification not found"
        )
    
    if notification.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized to resend this notification"
        )
    
    if notification.status != NotificationStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot resend notification with status: {notification.status.value}"
        )
    
    notification.status = NotificationStatus.PENDING
    notification.error_message = None
    notification.retry_count = (getattr(notification, 'retry_count', 0) or 0) + 1
    notification.last_retry_at = datetime.now()
    notification.updated_at = datetime.now()
    
    await db.commit()
    await db.refresh(notification)
    
    return {
        "success": True,
        "message": "Notification queued for resend",
        "notification_id": str(notification.id),
    }