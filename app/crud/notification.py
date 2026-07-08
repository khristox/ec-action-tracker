# app/crud/notification.py

import uuid
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.notification import (
    Notification, 
    NotificationChannel, 
    NotificationStatus, 
    NotificationCategory
)

logger = logging.getLogger(__name__)


class NotificationCRUD:
    """CRUD operations for notifications."""

    @staticmethod
    async def create_pending(
        db: AsyncSession,
        *,
        channel: NotificationChannel,
        recipient: str,
        content: str,
        subject: Optional[str] = None,
        category: NotificationCategory = NotificationCategory.OTHER,
        template_name: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
        participant_id: Optional[uuid.UUID] = None,
        meeting_id: Optional[uuid.UUID] = None,
        recipient_name: Optional[str] = None,
    ) -> Notification:
        """Create a pending notification record."""
        
        # CRITICAL FIX: Convert channel to enum properly
        if isinstance(channel, str):
            # If it's a string, convert to lowercase first
            channel_lower = channel.lower()
            logger.info(f"Converting channel string '{channel}' to '{channel_lower}'")
            try:
                channel = NotificationChannel(channel_lower)
            except ValueError:
                # Try to match by name (EMAIL -> email)
                try:
                    channel = NotificationChannel[channel.upper()]
                except KeyError:
                    raise ValueError(f"Invalid notification channel: {channel}")
        elif not isinstance(channel, NotificationChannel):
            raise ValueError(f"channel must be NotificationChannel enum, got {type(channel)}")
        
        # Also ensure category is the enum
        if isinstance(category, str):
            try:
                category = NotificationCategory(category.lower())
            except ValueError:
                try:
                    category = NotificationCategory[category.upper()]
                except KeyError:
                    raise ValueError(f"Invalid notification category: {category}")
        elif not isinstance(category, NotificationCategory):
            raise ValueError(f"category must be NotificationCategory enum, got {type(category)}")
        
        # Debug: Log what we're about to insert
        logger.info(f"Creating notification with channel: {channel} (type: {type(channel)})")
        logger.info(f"Channel value: {channel.value if hasattr(channel, 'value') else channel}")
        
        # Create the notification - pass the enum directly
        notification = Notification(
            id=uuid.uuid4(),
            channel=channel,  # Pass the enum, NOT a string
            recipient=recipient,
            recipient_name=recipient_name,
            subject=subject,
            content=content,
            template_name=template_name,
            category=category,
            status=NotificationStatus.PENDING,
            user_id=user_id,
            participant_id=participant_id,
            meeting_id=meeting_id,
            tracking_id=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        
        db.add(notification)
        await db.flush()
        return notification

    @staticmethod
    async def mark_sent(
        db: AsyncSession,
        notification: Notification,
        success: bool,
        error: Optional[str] = None,
        provider_message_id: Optional[str] = None,
    ) -> Notification:
        """Mark notification as sent or failed."""
        
        if success:
            notification.status = NotificationStatus.SUCCESSFUL
            notification.sent_at = datetime.now(timezone.utc)
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = error
        
        if provider_message_id:
            notification.provider_message_id = provider_message_id
        
        notification.updated_at = datetime.now(timezone.utc)
        
        await db.flush()
        return notification

    @staticmethod
    async def track_open(
        db: AsyncSession,
        tracking_id: uuid.UUID,
        ip_address: Optional[str] = None,
    ) -> Optional[Notification]:
        """Track notification open."""
        
        result = await db.execute(
            select(Notification).where(Notification.tracking_id == tracking_id)
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            return None
        
        notification.is_opened = True
        notification.opened_at = datetime.now(timezone.utc)
        notification.open_count += 1
        
        if not notification.extra_data:
            notification.extra_data = {}
        if 'opens' not in notification.extra_data:
            notification.extra_data['opens'] = []
        
        notification.extra_data['opens'].append({
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'ip': ip_address,
        })
        
        notification.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return notification


notification_crud = NotificationCRUD()