# app/crud/action_tracker/meeting_minutes.py

from datetime import datetime
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.meetings.action_tracker import MAX_LIMIT
from app.models.meetings.action_tracker import MeetingMinutes


async def get_by_meeting_with_filters(
    db: AsyncSession,
    meeting_id: UUID,
    skip: int = 0,
    limit: int = 100,
    include_actions: bool = True,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    sort_by: str = "timestamp",
    sort_desc: bool = True
) -> Tuple[List[MeetingMinutes], int]:
    """Get minutes for a meeting with advanced filtering"""
    
    # Build base query
    query = select(MeetingMinutes).where(
        MeetingMinutes.meeting_id == meeting_id,
        MeetingMinutes.is_active == True
    )
    
    # Apply filters
    if from_date:
        query = query.where(MeetingMinutes.timestamp >= from_date)
    if to_date:
        query = query.where(MeetingMinutes.timestamp <= to_date)
    
    # Get total count (before pagination)
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    
    # Apply eager loading
    if include_actions:
        query = query.options(
            selectinload(MeetingMinutes.actions),
            selectinload(MeetingMinutes.created_by),
            selectinload(MeetingMinutes.recorded_by)
        )
    
    # Apply sorting
    sort_column = getattr(MeetingMinutes, sort_by, MeetingMinutes.timestamp)
    if sort_desc:
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    # Apply pagination
    query = query.offset(skip).limit(min(limit, MAX_LIMIT))
    
    # Execute query
    result = await db.execute(query)
    minutes = result.scalars().all()
    
    # Note: Removed manual property mapping loops to prevent AttributeError.
    # The read-only properties on your model will resolve automatically during serialization.
    
    return list(minutes), total


async def get_meeting_minutes(
    db: AsyncSession,
    meeting_id: UUID,
    skip: int = 0,
    limit: int = 100,
    include_actions: bool = True
) -> List[MeetingMinutes]:
    """
    Get all minutes for a meeting with pagination.
    This is the function called by the meetings.py endpoint.
    """
    query = select(MeetingMinutes).where(
        MeetingMinutes.meeting_id == meeting_id,
        MeetingMinutes.is_active == True
    )
    
    if include_actions:
        query = query.options(
            selectinload(MeetingMinutes.actions),
            selectinload(MeetingMinutes.created_by),
            selectinload(MeetingMinutes.recorded_by)
        )
    
    query = (
        query.order_by(MeetingMinutes.created_at.desc())
        .offset(skip)
        .limit(min(limit, MAX_LIMIT))
    )
    
    result = await db.execute(query)
    minutes = result.scalars().all()
    
    return list(minutes)


async def get_minute_by_id(
    db: AsyncSession,
    minute_id: UUID
) -> Optional[MeetingMinutes]:
    """Get a single minute by ID with relationships loaded"""
    query = select(MeetingMinutes).where(
        MeetingMinutes.id == minute_id,
        MeetingMinutes.is_active == True
    ).options(
        selectinload(MeetingMinutes.actions),
        selectinload(MeetingMinutes.created_by),
        selectinload(MeetingMinutes.recorded_by)
    )
    
    result = await db.execute(query)
    return result.scalar_one_or_none()