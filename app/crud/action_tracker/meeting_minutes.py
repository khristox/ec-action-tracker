# app/crud/action_tracker/meeting_minutes.py
from datetime import datetime
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.crud.action_tracker import MAX_LIMIT
from app.models.action_tracker import MeetingMinutes
from sqlalchemy.ext.asyncio import AsyncSession


async def get_by_meeting_with_filters(
    self,
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
    
    # Add user-friendly names
    for minute in minutes:
        if minute.created_by:
            minute.created_by_name = minute.created_by.username
        if minute.recorded_by:
            minute.recorded_by_name = minute.recorded_by.username
    
    return minutes, total