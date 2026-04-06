from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.api import deps
from app.models.user import User
from app.crud.action_tracker import meeting_action, meeting_minutes
from app.schemas.action_tracker import (
    MeetingActionCreate, MeetingActionUpdate, MeetingActionResponse,
    ActionProgressUpdate, ActionCommentCreate, ActionCommentResponse,
    ActionStatusHistoryResponse, MyTaskResponse
)

# This is CRITICAL - you need to define the router
router = APIRouter()

# ==================== STATIC ROUTES ====================
@router.get("/my-tasks", response_model=List[MyTaskResponse])
async def get_my_tasks(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get actions assigned to current user"""
    actions = await meeting_action.get_actions_assigned_to_user(db, current_user.id)
    result = []
    for action in actions:
        result.append(MyTaskResponse(
            id=action.id,
            description=action.description,
            meeting_title=action.minutes.meeting.title if action.minutes and action.minutes.meeting else "",
            meeting_date=action.minutes.meeting.meeting_date if action.minutes and action.minutes.meeting else datetime.now(),
            due_date=action.due_date,
            overall_progress_percentage=action.overall_progress_percentage,
            overall_status_name=action.overall_status_name,
            priority=action.priority,
            is_overdue=action.due_date and action.due_date < datetime.now() and not action.completed_at
        ))
    return result

# ==================== COLLECTION ROUTES ====================
@router.get("/", response_model=List[MeetingActionResponse])
async def get_actions(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get all actions with pagination"""
    return await meeting_action.get_multi(db, skip=skip, limit=limit)

# ==================== CREATE ACTION FROM MINUTES ====================
# Note: This endpoint will be available at /actions/minutes/{minute_id}/actions
@router.post("/minutes/{minute_id}/actions", response_model=MeetingActionResponse, status_code=status.HTTP_201_CREATED)
async def create_action(
    minute_id: UUID,
    action_in: MeetingActionCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create an action item from meeting minutes"""
    minutes_obj = await meeting_minutes.get(db, minute_id)
    if not minutes_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Minutes not found")
    return await meeting_action.create_action(db, minute_id, action_in, current_user.id)

# ==================== DYNAMIC ROUTES ====================
@router.get("/{action_id}", response_model=MeetingActionResponse)
async def get_action(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get action by ID"""
    result = await meeting_action.get(db, action_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return result

@router.put("/{action_id}", response_model=MeetingActionResponse)
async def update_action(
    action_id: UUID,
    action_in: MeetingActionUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update action item"""
    result = await meeting_action.get(db, action_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.update(db, action_id, action_in)

@router.post("/{action_id}/progress", response_model=MeetingActionResponse)
async def update_action_progress(
    action_id: UUID,
    progress_update: ActionProgressUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update action progress percentage"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    if action_obj.assigned_to_id and action_obj.assigned_to_id != current_user.id:
        is_admin = any(role.code in ["admin", "super_admin"] for role in current_user.roles)
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the assigned user or admin can update progress"
            )
    return await meeting_action.update_progress(db, action_id, progress_update, current_user.id)

@router.post("/{action_id}/comments", response_model=ActionCommentResponse, status_code=status.HTTP_201_CREATED)
async def add_action_comment(
    action_id: UUID,
    comment_in: ActionCommentCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Add a comment to an action item"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.add_comment(db, action_id, comment_in, current_user.id)

@router.get("/{action_id}/comments", response_model=List[ActionCommentResponse])
async def get_action_comments(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get all comments for an action"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.get_comments(db, action_id, skip, limit)

@router.get("/{action_id}/history", response_model=List[ActionStatusHistoryResponse])
async def get_action_history(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get status change history for an action"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.get_status_history(db, action_id)

@router.delete("/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete an action item"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    await meeting_action.remove(db, action_id)