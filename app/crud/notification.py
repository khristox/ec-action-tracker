# app/api/v1/endpoints/notifications.py

import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import ProgrammingError, SQLAlchemyError

from app.api import deps
from app.models.notification import Notification, NotificationChannel, NotificationStatus
from app.models.user import User
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("")
async def list_notifications(
    meeting_id: Optional[UUID] = Query(None, description="Filter by meeting ID"),
    channel: Optional[str] = Query(None, description="Filter by channel (email, sms, whatsapp, in_app)"),
    user_id: Optional[UUID] = Query(None, description="Filter by user ID"),
    status: Optional[str] = Query(None, description="Filter by status (pending, successful, failed)"),
    search: Optional[str] = Query(None, description="Search in recipient, subject, or content"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    limit: int = Query(50, ge=1, le=200, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    List notifications with optional filters.
    Returns paginated list of notifications.
    """
    try:
        # ✅ FIX: Convert channel to enum value once, before building queries
        channel_enum = None
        if channel:
            try:
                channel_enum = NotificationChannel(channel.lower())
            except ValueError:
                logger.warning(f"Invalid channel value: {channel}")
                return {
                    "items": [],
                    "total": 0,
                    "page": 1,
                    "size": limit,
                    "pages": 0,
                    "message": f"Invalid channel: {channel}"
                }
        
        # ✅ FIX: Convert status to enum value once
        status_enum = None
        if status:
            try:
                status_enum = NotificationStatus(status.lower())
            except ValueError:
                logger.warning(f"Invalid status value: {status}")
                # Continue without status filter
        
        # Build base query
        query = select(Notification).where(Notification.is_active == True)
        count_query = select(func.count(Notification.id)).where(Notification.is_active == True)
        
        # Apply filters
        if meeting_id:
            query = query.where(Notification.meeting_id == meeting_id)
            count_query = count_query.where(Notification.meeting_id == meeting_id)
        
        # ✅ FIX: Use the enum value directly, not the string
        if channel_enum:
            query = query.where(Notification.channel == channel_enum)
            count_query = count_query.where(Notification.channel == channel_enum)
        
        if user_id:
            query = query.where(Notification.user_id == user_id)
            count_query = count_query.where(Notification.user_id == user_id)
        
        if status_enum:
            query = query.where(Notification.status == status_enum)
            count_query = count_query.where(Notification.status == status_enum)
        
        if search:
            search_term = f"%{search}%"
            search_filter = or_(
                Notification.recipient.ilike(search_term),
                Notification.recipient_name.ilike(search_term),
                Notification.subject.ilike(search_term),
                Notification.content.ilike(search_term),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)
        
        if start_date:
            query = query.where(Notification.created_at >= start_date)
            count_query = count_query.where(Notification.created_at >= start_date)
        
        if end_date:
            query = query.where(Notification.created_at <= end_date)
            count_query = count_query.where(Notification.created_at <= end_date)
        
        # Get total count
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Apply sorting
        sort_column = getattr(Notification, sort_by, Notification.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
        
        # Apply pagination
        query = query.offset(offset).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        items = result.scalars().all()
        
        # Build response
        return {
            "items": [
                {
                    "id": str(item.id),
                    "channel": item.channel.value if item.channel else None,
                    "recipient": item.recipient,
                    "recipient_name": item.recipient_name,
                    "subject": item.subject,
                    "content": item.content,
                    "template_name": item.template_name,
                    "category": item.category,
                    "status": item.status.value if item.status else None,
                    "error_message": item.error_message,
                    "sent_at": item.sent_at.isoformat() if item.sent_at else None,
                    "is_opened": item.is_opened,
                    "opened_at": item.opened_at.isoformat() if item.opened_at else None,
                    "open_count": item.open_count,
                    "tracking_id": str(item.tracking_id) if item.tracking_id else None,
                    "provider_message_id": item.provider_message_id,
                    "extra_data": item.extra_data,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                    "updated_at": item.updated_at.isoformat() if item.updated_at else None,
                    "meeting_id": str(item.meeting_id) if item.meeting_id else None,
                    "user_id": str(item.user_id) if item.user_id else None,
                    "participant_id": str(item.participant_id) if item.participant_id else None,
                }
                for item in items
            ],
            "total": total,
            "page": (offset // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": (total + limit - 1) // limit if limit > 0 else 0,
            "filters_applied": {
                "meeting_id": str(meeting_id) if meeting_id else None,
                "channel": channel,
                "user_id": str(user_id) if user_id else None,
                "status": status,
                "has_search": bool(search),
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            }
        }
        
    except ProgrammingError as e:
        # Table doesn't exist yet - return empty result gracefully
        if "does not exist" in str(e):
            logger.warning(f"Notifications table does not exist: {e}")
            return {
                "items": [],
                "total": 0,
                "page": 1,
                "size": limit,
                "pages": 0,
                "message": "Notifications system is being set up"
            }
        logger.error(f"Database error fetching notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    
    except SQLAlchemyError as e:
        logger.error(f"SQLAlchemy error fetching notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    
    except Exception as e:
        logger.error(f"Unexpected error fetching notifications: {e}", exc_info=True)
        # Return empty result instead of failing
        return {
            "items": [],
            "total": 0,
            "page": 1,
            "size": limit,
            "pages": 0,
            "error": str(e)
        }