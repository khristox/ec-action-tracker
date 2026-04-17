# app/api/v1/endpoints/action_tracker/deps.py
from select import select

from sqlalchemy import select

from app.models.action_tracker import Meeting, MeetingParticipant
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession



async def has_access_to_meeting(
    db: AsyncSession,
    user: User,
    meeting: Meeting
) -> bool:
    """Check if user has access to a meeting"""
    # Admin has access to everything
    if user.is_superuser:
        return True
    
    # Check if user is participant or creator
    if user.id == meeting.created_by_id:
        return True
    
    # Check meeting participants
    result = await db.execute(
        select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == meeting.id,
            MeetingParticipant.user_id == user.id,
            MeetingParticipant.is_active == True
        )
    )
    return result.scalar_one_or_none() is not None