"""
Minutes endpoints for Action Tracker
Handles CRUD operations for meeting minutes and their associated actions
"""

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.crud.action_tracker import meeting, meeting_action, meeting_minutes
from app.models.user import User
from app.schemas.action_tracker import (
    MeetingActionCreate,
    MeetingActionResponse,
    MeetingMinutesCreate,
    MeetingMinutesResponse,
    MeetingMinutesUpdate,
)

router = APIRouter()


# ============================================================================
# MEETING MINUTES ENDPOINTS (Meeting context)
# ============================================================================

@router.post(
    "/meetings/{meeting_id}/minutes",
    response_model=MeetingMinutesResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add minutes to a meeting",
    description="Create new minutes entry for a specific meeting"
)
async def add_meeting_minutes(
    meeting_id: UUID,
    minutes_in: MeetingMinutesCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> MeetingMinutesResponse:
    """
    Add minutes to a meeting.
    
    Args:
        meeting_id: UUID of the meeting
        minutes_in: Minutes data (topic, discussion, decisions)
        db: Database session
        current_user: Authenticated user
    
    Returns:
        Created minutes object
    """
    # Verify meeting exists
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting {meeting_id} not found"
        )
    
    # Create minutes
    minutes = await meeting.add_minutes(db, meeting_id, minutes_in, current_user.id)
    return minutes


@router.get(
    "/meetings/{meeting_id}/minutes",
    response_model=List[MeetingMinutesResponse],
    summary="Get all minutes for a meeting",
    description="Retrieve all minutes entries for a specific meeting"
)
async def get_meeting_minutes(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum records to return"),
) -> List[MeetingMinutesResponse]:
    """
    Get all minutes for a meeting with pagination.
    
    Args:
        meeting_id: UUID of the meeting
        db: Database session
        current_user: Authenticated user
        skip: Number of records to skip (pagination)
        limit: Maximum records to return (pagination)
    
    Returns:
        List of minutes objects
    """
    # Verify meeting exists
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting {meeting_id} not found"
        )
    
    return await meeting_minutes.get_meeting_minutes(db, meeting_id, skip, limit)


# ============================================================================
# SINGLE MINUTE ENDPOINTS
# ============================================================================

@router.get(
    "/{minute_id}",
    response_model=MeetingMinutesResponse,
    summary="Get minutes by ID",
    description="Retrieve a specific minutes entry by its ID only if active"
)
async def get_minutes(
    minute_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> MeetingMinutesResponse:
    """
    Get minutes by ID, filtering for active records.
    """
    minutes = await meeting_minutes.get(db, id=minute_id)
    
    # Check if minutes exist AND if is_active is True
    # Using getattr handles cases where the column might be missing or nullable
    if not minutes or not getattr(minutes, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Minutes {minute_id} not found or has been deactivated"
        )
        
    return minutes


@router.put(
    "/{minute_id}",
    response_model=MeetingMinutesResponse,
    summary="Update minutes",
    description="Update an existing minutes entry"
)
async def update_minutes(
    minute_id: UUID,
    minutes_in: MeetingMinutesUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> MeetingMinutesResponse:
    """
    Update minutes by ID.
    
    Args:
        minute_id: UUID of the minutes to update
        minutes_in: Updated minutes data
        db: Database session
        current_user: Authenticated user
    
    Returns:
        Updated minutes object
    """
    # Verify minutes exists
    minutes = await meeting_minutes.get(db, minute_id)
    if not minutes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Minutes {minute_id} not found"
        )
    
    # Update minutes with audit fields
    updated_minutes = await meeting_minutes.update(
        db, minutes, minutes_in, current_user.id
    )
    return updated_minutes


@router.delete(
    "/{minute_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete minutes",
    description="Soft delete minutes (sets is_active=False)"
)
async def delete_minutes(
    minute_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """
    Soft delete minutes by ID.
    
    Args:
        minute_id: UUID of the minutes to delete
        db: Database session
        current_user: Authenticated user
    """
    # Verify minutes exists
    minutes = await meeting_minutes.get(db, minute_id)
    if not minutes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Minutes {minute_id} not found"
        )
    
    # Soft delete - set is_active to False and update audit fields
    minutes.is_active = False
    minutes.updated_by_id = current_user.id
    minutes.updated_at = datetime.now()
    await db.commit()


# ============================================================================
# ACTION ENDPOINTS FOR MINUTES
# ============================================================================

@router.post(
    "/{minute_id}/actions",
    response_model=MeetingActionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create action from minutes",
    description="Create a new action item associated with specific minutes"
)
async def create_action_for_minutes(
    minute_id: UUID,
    action_in: MeetingActionCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> MeetingActionResponse:
    """
    Create an action item from meeting minutes.
    
    Args:
        minute_id: UUID of the minutes
        action_in: Action data (description, assigned_to, due_date, priority, etc.)
        db: Database session
        current_user: Authenticated user
    
    Returns:
        Created action object
    """
    # Verify minutes exists
    minutes_obj = await meeting_minutes.get(db, minute_id)
    if not minutes_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Minutes {minute_id} not found"
        )
    
    # Create action
    action = await meeting_action.create_action(
        db, minute_id, action_in, current_user.id
    )
    return action


@router.get(
    "/{minute_id}/actions",
    response_model=List[MeetingActionResponse],
    summary="Get actions for minutes",
    description="Retrieve all action items associated with specific minutes"
)
async def get_actions_for_minutes(
    minute_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum records to return"),
) -> List[MeetingActionResponse]:
    """
    Get all action items for specific minutes.
    
    Args:
        minute_id: UUID of the minutes
        db: Database session
        current_user: Authenticated user
        skip: Number of records to skip (pagination)
        limit: Maximum records to return (pagination)
    
    Returns:
        List of action objects
    """
    # Verify minutes exists
    minutes_obj = await meeting_minutes.get(db, minute_id)
    if not minutes_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Minutes {minute_id} not found"
        )
    
    # Get minutes with actions loaded
    minutes_with_actions = await meeting_minutes.get_minutes_with_actions(db, minute_id)
    if not minutes_with_actions:
        return []
    
    return minutes_with_actions.actions[skip:skip + limit]