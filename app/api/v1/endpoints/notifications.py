# app/api/v1/endpoints/notifications.py

import uuid
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func

from app.api import deps
from app.db.session import get_db
from app.models.notification import (
    Notification, 
    NotificationChannel, 
    NotificationStatus, 
    NotificationCategory
)
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

# 1x1 transparent PNG pixel
_TRANSPARENT_PIXEL = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a4944415478da6360000002000155273de50000000049454e44ae426082"
)


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
        # Find notification by tracking_id
        result = await db.execute(
            select(Notification).where(Notification.tracking_id == tracking_id)
        )
        notification = result.scalar_one_or_none()
        
        if notification:
            notification.is_opened = True
            notification.opened_at = datetime.now()
            notification.open_count = (notification.open_count or 0) + 1
            
            # Track IP if available
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
    
    # Return transparent pixel
    return Response(content=_TRANSPARENT_PIXEL, media_type="image/png")


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
    
    # Remove is_active filter since it doesn't exist
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
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated results
    query = query.order_by(desc(Notification.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return {
        "items": [_serialize(n) for n in notifications],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("", operation_id="notifications_list_all")
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
    
    # Remove is_active filter since it doesn't exist
    query = select(Notification)
    
    # If not superuser, filter by user_id
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
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated results
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
    """
    Get notification statistics.
    """
    # Remove is_active filter since it doesn't exist
    query = select(Notification)
    
    # If not superuser, filter by user_id
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
    
    # Get channel counts
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
    
    # Check permissions
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
    """
    Resend a failed notification.
    """
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Notification not found"
        )
    
    # Check permissions
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
    
    # Reset status for resend
    notification.status = NotificationStatus.PENDING
    notification.error_message = None
    notification.retry_count = (getattr(notification, 'retry_count', 0) or 0) + 1
    notification.last_retry_at = datetime.now()
    notification.updated_at = datetime.now()
    
    await db.commit()
    await db.refresh(notification)
    
    # TODO: Trigger actual resend via notification service
    
    return {
        "success": True,
        "message": "Notification queued for resend",
        "notification_id": str(notification.id),
    }