# app/api/v1/endpoints/notifications.py
# ✅ FULLY FIXED: Use created_by_id instead of user_id with enhanced debugging

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

# Setup Jinja2 environment
jinja_env = Environment(loader=FileSystemLoader("app/templates"))

# 1x1 transparent PNG pixel
_TRANSPARENT_PIXEL = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a4944415478da6360000002000155273de50000000049454e44ae426082"
)

# ========== REQUEST MODELS ==========

class SendNotificationRequest(BaseModel):
    meeting_id: uuid.UUID
    participant_ids: List[uuid.UUID] = Field(
        ...,
        description="Participant IDs to notify - accepts MeetingParticipant.id"
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


async def lookup_participants_by_ids(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    participant_ids: List[uuid.UUID]
) -> List[MeetingParticipant]:
    """
    ✅ Look up participants by multiple ID types:
    1. MeetingParticipant.id (primary method)
    2. created_by_id (User who created the participant record)
    3. Email (if the ID is actually an email)
    4. User.id (via email match)

    Returns: List of MeetingParticipant objects
    """

    if not participant_ids:
        logger.info("   ℹ️ No participant IDs provided")
        return []

    participants_found = []
    found_ids = set()

    # ============================================
    # METHOD 1: Try to find by MeetingParticipant.id
    # ============================================
    logger.info("   🔍 METHOD 1: Looking up by MeetingParticipant.id...")
    query = select(MeetingParticipant).where(
        MeetingParticipant.id.in_(participant_ids),
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.is_active == True
    )
    result = await db.execute(query)
    participants = result.scalars().all()

    for p in participants:
        if p.id not in found_ids:
            participants_found.append(p)
            found_ids.add(p.id)
            logger.info(f"      ✅ Found: {p.id} ({p.name})")

    # ============================================
    # METHOD 2: Try to find by created_by_id (User ID)
    # ============================================
    if len(participants_found) < len(participant_ids):
        logger.info("   🔍 METHOD 2: Looking up by created_by_id (User ID)...")

        query = select(MeetingParticipant).where(
            MeetingParticipant.created_by_id.in_(participant_ids),
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True
        )
        result = await db.execute(query)
        participants = result.scalars().all()

        for p in participants:
            if p.id not in found_ids:
                participants_found.append(p)
                found_ids.add(p.id)
                logger.info(
                    f"      ✅ Found: {p.id} ({p.name}) created_by_id={p.created_by_id}"
                )

    # ============================================
    # METHOD 3: Try to find by email (if the ID is actually an email)
    # ============================================
    if len(participants_found) < len(participant_ids):
        logger.info("   🔍 METHOD 3: Looking up by email...")

        for pid in participant_ids:
            # Check if the ID looks like an email (contains @)
            if isinstance(pid, str) and '@' in pid:
                email_result = await db.execute(
                    select(MeetingParticipant).where(
                        MeetingParticipant.email == pid,
                        MeetingParticipant.meeting_id == meeting_id,
                        MeetingParticipant.is_active == True
                    )
                )
                participant = email_result.scalar_one_or_none()
                if participant and participant.id not in found_ids:
                    participants_found.append(participant)
                    found_ids.add(participant.id)
                    logger.info(f"      ✅ Found: {participant.id} ({participant.name}) email={pid}")

    # ============================================
    # METHOD 4: Try to find by User.id through email match
    # ============================================
    if len(participants_found) < len(participant_ids):
        logger.info("   🔍 METHOD 4: Looking up by User.id (via email match)...")

        # Get users with matching IDs
        user_result = await db.execute(
            select(User).where(User.id.in_(participant_ids))
        )
        users = user_result.scalars().all()

        if users:
            user_emails = [user.email for user in users if user.email]

            if user_emails:
                # Find participants with matching emails
                participant_result = await db.execute(
                    select(MeetingParticipant).where(
                        MeetingParticipant.meeting_id == meeting_id,
                        MeetingParticipant.email.in_(user_emails),
                        MeetingParticipant.is_active == True
                    )
                )
                participants = participant_result.scalars().all()

                for p in participants:
                    if p.id not in found_ids:
                        participants_found.append(p)
                        found_ids.add(p.id)
                        logger.info(
                            f"      ✅ Found: {p.id} ({p.name}) email={p.email}"
                        )

    # ============================================
    # Log results
    # ============================================
    logger.info(f"\n   📊 LOOKUP RESULTS")
    logger.info(f"      Requested: {len(participant_ids)}")
    logger.info(f"      Found: {len(participants_found)}")
    logger.info(f"      Missing: {len(participant_ids) - len(participants_found)}")

    if len(participants_found) < len(participant_ids):
        missing_ids = set(participant_ids) - found_ids
        logger.warning(f"   ⚠️ Not found: {missing_ids}")

    return participants_found


async def get_participant_email(
    db: AsyncSession,
    participant: MeetingParticipant
) -> tuple[Optional[str], Optional[str]]:
    """
    Get participant email and name from participant object.
    Tries multiple sources:
    1. Direct email field
    2. User table by created_by_id

    Returns: (email, name)
    """

    email = None
    name = getattr(participant, 'name', None) or "Participant"

    # Try 1: Direct email field
    if hasattr(participant, 'email') and participant.email and "@" in participant.email:
        email = participant.email
        logger.debug(f"      ✓ Email from participant.email: {email}")
        return email, name

    # Try 2: created_by_id (User who created this participant)
    created_by_id = getattr(participant, 'created_by_id', None)
    if created_by_id:
        user_result = await db.execute(
            select(User).where(User.id == created_by_id)
        )
        user = user_result.scalar_one_or_none()
        if user and user.email and "@" in user.email:
            email = user.email
            name = getattr(user, 'full_name', name) or getattr(user, 'username', name)
            logger.debug(f"      ✓ Email from User (created_by_id): {email}")
            return email, name

    logger.warning(f"      ✗ No email found for participant: {name}")
    return email, name


# ========== SEND NOTIFICATION ENDPOINT ==========

@router.post("/send-meeting-notification", operation_id="notifications_send_meeting")
async def send_meeting_notification(
    request: SendNotificationRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    ✅ Send notifications to meeting participants

    Frontend sends MeetingParticipant IDs
    Backend intelligently looks up the correct participants
    """

    logger.info("\n" + "=" * 70)
    logger.info(f"📧 NOTIFICATION REQUEST")
    logger.info("=" * 70)
    logger.info(f"From: {current_user.email}")
    logger.info(f"Meeting: {request.meeting_id}")
    logger.info(f"Participants: {len(request.participant_ids)}")
    logger.info(f"Channels: {request.notification_type}")
    logger.info("=" * 70 + "\n")

    # ========== VALIDATE INPUT ==========

    if not request.participant_ids or len(request.participant_ids) == 0:
        logger.error("❌ VALIDATION FAILED: No participant IDs provided")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No participant IDs provided"
        )

    allowed_channels = ['email', 'whatsapp', 'sms']
    for channel in request.notification_type:
        if channel not in allowed_channels:
            logger.error(f"❌ VALIDATION FAILED: Invalid channel: {channel}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid notification type: {channel}. Allowed: {allowed_channels}"
            )

    logger.info("✅ Input validation passed\n")

    # ========== FETCH MEETING ==========

    logger.info("🔍 Fetching meeting details...")
    meeting_result = await db.execute(
        select(Meeting).where(Meeting.id == request.meeting_id)
    )
    meeting = meeting_result.scalar_one_or_none()

    if not meeting:
        logger.error(f"❌ Meeting not found: {request.meeting_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )

    logger.info(f"✅ Meeting found: {meeting.title}\n")

    # ========== LOOK UP PARTICIPANTS ==========

    logger.info("🔍 Looking up participants...\n")

    # Convert IDs to UUID if they're strings
    participant_ids = []
    for pid in request.participant_ids:
        try:
            if isinstance(pid, str):
                participant_ids.append(uuid.UUID(pid))
            else:
                participant_ids.append(pid)
        except ValueError:
            logger.warning(f"⚠️ Invalid UUID format: {pid}")

    if not participant_ids:
        logger.error("❌ No valid participant IDs after conversion")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid participant ID format"
        )

    # ✅ Use the improved lookup function
    participants_from_db = await lookup_participants_by_ids(
        db, request.meeting_id, participant_ids
    )

    if not participants_from_db:
        # Log existing participants for debugging
        logger.info("   ℹ️ No participants found. Listing existing participants:\n")

        debug_result = await db.execute(
            select(
                MeetingParticipant.id,
                MeetingParticipant.name,
                MeetingParticipant.email,
                MeetingParticipant.created_by_id
            )
            .where(
                MeetingParticipant.meeting_id == request.meeting_id,
                MeetingParticipant.is_active == True
            )
            .limit(20)
        )
        existing_participants = debug_result.all()

        logger.error("❌ NO PARTICIPANTS FOUND in database\n")
        logger.info(f"Existing participants in meeting ({len(existing_participants)}):")
        for p in existing_participants:
            logger.info(
                f"   participant_id: {p[0]}"
                f"\n   name: {p[1]}"
                f"\n   email: {p[2]}"
                f"\n   created_by_id: {p[3]}\n"
            )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No participants found for the provided IDs in this meeting. Available participants: {len(existing_participants)}"
        )

    logger.info(
        f"\n✅ PARTICIPANT LOOKUP SUCCESSFUL\n"
        f"   Found: {len(participants_from_db)} participants\n"
    )

    # ============================================
    # SEND NOTIFICATIONS
    # ============================================

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

    base_frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    meeting_detail_url = f"{base_frontend_url}/meetings/{request.meeting_id}"

    # ========== SEND EMAILS ==========
    if "email" in request.notification_type:
        logger.info("📧 SENDING EMAILS...\n")

        for participant in participants_from_db:
            notification_id = uuid.uuid4()

            try:
                target_email, name = await get_participant_email(db, participant)

                if not target_email or "@" not in target_email:
                    logger.warning(
                        f"   ⚠️ SKIP: {name} - No valid email address"
                    )
                    results["total_failed"] += 1
                    results["by_channel"]["email"]["failed"] += 1
                    results["details"].append({
                        "participant_id": str(participant.id),
                        "name": name,
                        "channel": "email",
                        "status": "failed",
                        "error": "No valid email address on file"
                    })
                    continue

                logger.info(f"   → Sending to: {target_email} ({name})")

                meeting_title = getattr(meeting, 'title', 'Upcoming Meeting')
                email_subject = f"Meeting Reminder: {meeting_title}"

                try:
                    template = jinja_env.get_template("email/meeting_reminder.html")
                    email_body = template.render(
                        participant_name=name,
                        meeting_title=meeting_title,
                        meeting_datetime=getattr(meeting, 'start_time', datetime.now()).strftime(
                            "%B %d, %Y at %I:%M %p"
                        ) if meeting and getattr(meeting, 'start_time', None) else "TBD",
                        location=getattr(meeting, 'location_text', 'N/A') if meeting else 'N/A',
                        meeting_detail_link=meeting_detail_url,
                        primary_color="#1e40af",
                        project_name="Action Tracker",
                        custom_message=request.custom_message
                    )
                except Exception as t_err:
                    logger.warning(f"   ⚠️ Template load failed: {t_err}, using fallback")
                    email_body = f"""
                    <html>
                        <body style="font-family: Arial, sans-serif; color: #333;">
                            <div style="max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #1e40af;">Meeting Notification</h2>
                                <p>Dear {name},</p>
                                <p>You have been invited to: <strong>{meeting_title}</strong></p>
                                <p>Date: {getattr(meeting, 'start_time', 'TBD')}</p>
                                <p>Location: {getattr(meeting, 'location_text', 'N/A')}</p>
                                {f'<div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #1e40af; margin: 20px 0;"><strong>Message:</strong><p>{request.custom_message}</p></div>' if request.custom_message else ''}
                                <p style="margin-top: 20px;">
                                    <a href="{meeting_detail_url}" style="background-color: #1e40af; color: #ffffff; padding: 10px 15px; text-decoration: none; border-radius: 4px;">View Meeting Details</a>
                                </p>
                            </div>
                        </body>
                    </html>
                    """

                email_result = await email_service.send_email(
                    to_email=target_email,
                    subject=email_subject,
                    html_content=email_body
                )

                category_val = getattr(NotificationCategory, 'MEETING', 
                                     getattr(NotificationCategory, 'GENERAL', None))

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
                        "name": name,
                        "email": target_email,
                        "channel": "email",
                        "status": "success",
                        "notification_id": str(notification_id)
                    })
                    logger.info(f"      ✅ SUCCESS: {notification_id}")
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
                        "name": name,
                        "email": target_email,
                        "channel": "email",
                        "status": "failed",
                        "error": email_result.get("message"),
                        "notification_id": str(notification_id)
                    })
                    logger.error(f"      ❌ FAILED: {email_result.get('message')}")

            except Exception as e:
                logger.error(f"   ❌ EXCEPTION: {str(e)}")
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

        logger.info("")

    # ========== SEND WHATSAPP (stub) ==========
    if "whatsapp" in request.notification_type:
        logger.info("📱 WhatsApp support pending integration")
        for participant in participants_from_db:
            results["details"].append({
                "participant_id": str(participant.id),
                "name": getattr(participant, 'name', 'Unknown'),
                "phone": getattr(participant, 'telephone', None),
                "channel": "whatsapp",
                "status": "pending",
                "message": "WhatsApp integration not yet implemented"
            })

    # ========== SEND SMS (stub) ==========
    if "sms" in request.notification_type:
        logger.info("📲 SMS support pending integration")
        for participant in participants_from_db:
            results["details"].append({
                "participant_id": str(participant.id),
                "name": getattr(participant, 'name', 'Unknown'),
                "phone": getattr(participant, 'telephone', None),
                "channel": "sms",
                "status": "pending",
                "message": "SMS integration not yet implemented"
            })

    # ========== RETURN RESULTS ==========
    logger.info("=" * 70)
    logger.info(f"✅ NOTIFICATION SEND COMPLETE")
    logger.info(f"   Sent: {results['total_sent']}")
    logger.info(f"   Failed: {results['total_failed']}")
    logger.info(f"   Recipients: {len(participants_from_db)}")
    logger.info("=" * 70 + "\n")

    return {
        "success": results["total_failed"] == 0,
        "message": f"Sent {results['total_sent']} notifications to {len(participants_from_db)} recipients, {results['total_failed']} failed",
        "results": results
    }


# ========== DEBUG ENDPOINT ==========

@router.get("/debug/participant-mapping/{meeting_id}")
async def debug_participant_mapping(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    🔍 Debug endpoint: Get mapping of participant IDs to user IDs
    Only accessible to superusers
    """

    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superusers can access this endpoint"
        )

    result = await db.execute(
        select(
            MeetingParticipant.id,
            MeetingParticipant.name,
            MeetingParticipant.email,
            MeetingParticipant.created_by_id,
        ).where(
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True
        )
    )
    participants = result.all()

    return {
        "meeting_id": str(meeting_id),
        "participant_count": len(participants),
        "participants": [
            {
                "participant_id": str(p[0]),
                "name": p[1],
                "email": p[2],
                "created_by_id": str(p[3]) if p[3] else None,
                "user_id": str(p[3]) if p[3] else None,
            }
            for p in participants
        ]
    }


# ========== TRACKING PIXEL ==========

@router.get("/track/{tracking_id}.png", include_in_schema=False)
async def track_notification_open(
    tracking_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
):
    """Tracking pixel endpoint - records notification opens."""
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
    """List notifications with filters."""

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