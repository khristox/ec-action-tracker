from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, List, Optional
from uuid import UUID
from datetime import datetime
import logging

from app.api import deps
from app.crud.action_tracker import meeting_action, meeting_minutes
from app.models.action_tracker import MeetingAction
from app.models.user import User

from app.schemas.action_tracker import ActionCommentCreate, ActionCommentResponse, ActionProgressUpdate, ActionStatusHistoryResponse, MyTaskResponse
from app.schemas.meeting_minutes.meeting_minutes import MeetingActionCreate, MeetingActionResponse, MeetingActionUpdate

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== HELPER FUNCTIONS ====================

def calculate_is_overdue(due_date: Optional[datetime], completed_at: Optional[datetime]) -> bool:
    """Safely calculate if an action is overdue"""
    if not due_date or completed_at:
        return False
    
    # Handle timezone-naive comparison
    now = datetime.now()
    if due_date.tzinfo:
        due_date = due_date.replace(tzinfo=None)
    
    return due_date < now


def format_datetime(dt: Optional[datetime]) -> Optional[str]:
    """Format datetime for consistent display"""
    if not dt:
        return None
    return dt.isoformat()


async def get_action_or_404(db: AsyncSession, action_id: UUID) -> MeetingAction:
    """Helper to get action or raise 404"""
    action = await meeting_action.get(db, action_id)
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action with id {action_id} not found"
        )
    return action


async def check_action_permission(action: MeetingAction, current_user: User, require_ownership: bool = False) -> bool:
    """Check if user has permission to access/modify action"""
    if require_ownership:
        if action.assigned_to_id and action.assigned_to_id != current_user.id:
            is_admin = any(role.code in ["admin", "super_admin"] for role in current_user.roles)
            if not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the assigned user or admin can perform this action"
                )
    return True


# ==================== STATIC ROUTES (no path parameters) ====================

@router.get("/my-tasks", response_model=List[MyTaskResponse])
async def get_my_tasks(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None, description="Search in description"),
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[int] = Query(None, ge=1, le=4),
    is_overdue: Optional[bool] = Query(None),
    include_completed: bool = Query(False, description="Include completed tasks"),
):
    """Get my tasks with filtering support"""

    try:
        actions = await meeting_action.get_actions_assigned_to_user(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=limit,
            search=search,
            status=status,
            priority=priority,
            is_overdue=is_overdue,
            include_completed=include_completed,
        )

        result = []
        for action in actions:
            meeting_title = ""
            meeting_date = None
            
            if action.minutes and action.minutes.meeting:
                meeting_title = action.minutes.meeting.title or ""
                meeting_date = action.minutes.meeting.meeting_date
            
            is_overdue_flag = False
            if action.due_date and not action.completed_at:
                now = datetime.now()
                if action.due_date.tzinfo:
                    due_date = action.due_date.replace(tzinfo=None)
                else:
                    due_date = action.due_date
                is_overdue_flag = due_date < now

            result.append(MyTaskResponse(
                id=action.id,
                description=action.description,
                meeting_title=meeting_title,
                meeting_date=meeting_date,
                due_date=action.due_date,
                overall_progress_percentage=action.overall_progress_percentage or 0,
                overall_status_name=action.overall_status_name,
                priority=action.priority,
                is_overdue=is_overdue_flag,
                completed_at=action.completed_at,
                created_at=action.created_at,
            ))

        return result

    except Exception as e:
        logger.error(f"Error fetching my tasks for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch my tasks: {str(e)}"
        )


@router.get("/overdue", response_model=List[MyTaskResponse])
async def get_overdue_tasks(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """
    Get all overdue actions assigned to the current user.
    """
    try:
        actions = await meeting_action.get_overdue_actions_for_user(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=limit
        )
        
        result = []
        for action in actions:
            meeting_title = ""
            meeting_date = None
            
            if action.minutes and action.minutes.meeting:
                meeting_title = action.minutes.meeting.title or ""
                meeting_date = action.minutes.meeting.meeting_date
            
            result.append(MyTaskResponse(
                id=action.id,
                description=action.description,
                meeting_title=meeting_title,
                meeting_date=meeting_date,
                due_date=action.due_date,
                overall_progress_percentage=action.overall_progress_percentage or 0,
                overall_status_name=action.overall_status_name,
                priority=action.priority,
                is_overdue=True,
                completed_at=action.completed_at,
                created_at=action.created_at,
            ))
        
        logger.info(f"Found {len(result)} overdue tasks for user {current_user.id}")
        return result
        
    except Exception as e:
        logger.error(f"Error fetching overdue tasks: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch overdue tasks: {str(e)}"
        )

# ==================== COLLECTION ROUTES ====================

@router.get("/", response_model=List[MeetingActionResponse])
async def get_actions(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_id: Optional[UUID] = Query(None, description="Filter by status ID"),
    priority: Optional[int] = Query(None, ge=1, le=4, description="Filter by priority (1-4)"),
    assigned_to_id: Optional[UUID] = Query(None, description="Filter by assigned user"),
):
    """Get all actions with optional filtering and pagination."""
    try:
        actions = await meeting_action.get_multi(db, skip=skip, limit=limit)
        
        # Apply filters
        if status_id:
            actions = [a for a in actions if a.overall_status_id == status_id]
        if priority:
            actions = [a for a in actions if a.priority == priority]
        if assigned_to_id:
            actions = [a for a in actions if a.assigned_to_id == assigned_to_id]
        
        logger.info(f"Retrieved {len(actions)} actions")
        return actions
        
    except Exception as e:
        logger.error(f"Error fetching actions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch actions"
        )


# ==================== CREATE ACTION ====================

@router.post("/", response_model=MeetingActionResponse, status_code=status.HTTP_201_CREATED)
async def create_action(
    *,
    db: AsyncSession = Depends(deps.get_db),
    action_in: MeetingActionCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create a new action item.
    """
    try:
        # Verify minutes exist if minute_id is provided
        if action_in.minute_id:
            minutes_obj = await meeting_minutes.get(db, action_in.minute_id)
            if not minutes_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Minutes with id {action_in.minute_id} not found"
                )
        
        # Create the action using existing meeting_action CRUD
        action = await meeting_action.create_action(
            db=db,
            minute_id=action_in.minute_id,
            action_in=action_in,
            user_id=current_user.id
        )
        
        logger.info(f"Action created by user {current_user.id}")
        return action
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating action: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create action: {str(e)}"
        )


# Add this endpoint to your actions.py router

@router.get("/{action_id}/history", response_model=List[ActionStatusHistoryResponse])
async def get_action_history(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of records to return"),
):
    """
    Get status change history for an action with pagination.
    """
    try:
        # Check if action exists
        action = await get_action_or_404(db, action_id)
        
        # Check permission (view history)
        await check_action_permission(action, current_user, require_ownership=False)
        
        # Get history
        history = await meeting_action.get_status_history(db, action_id, skip, limit)
        
        logger.info(f"Retrieved {len(history)} history entries for action {action_id}")
        return history
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching history for action {action_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch history"
        )
    
# ==================== DYNAMIC ROUTES (with path parameters) ====================

@router.get("/{action_id}", response_model=MeetingActionResponse)
async def get_action(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get action by ID with permission check."""
    try:
        action = await get_action_or_404(db, action_id)
        await check_action_permission(action, current_user, require_ownership=False)
        
        logger.info(f"Action {action_id} retrieved by user {current_user.id}")
        return action
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching action {action_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch action"
        )


@router.put("/{action_id}", response_model=MeetingActionResponse)
async def update_action(
    action_id: UUID,
    action_in: MeetingActionUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update action item with permission check."""
    try:
        # Check if action exists
        action_obj = await get_action_or_404(db, action_id)
        
        # Check permission
        await check_action_permission(action_obj, current_user, require_ownership=True)
        
        # Update action
        updated_action = await meeting_action.update_action(db, action_id, action_in, current_user.id)
        
        logger.info(f"Action {action_id} updated by user {current_user.id}")
        return updated_action
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating action {action_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update action: {str(e)}"
        )


@router.patch("/{action_id}/progress", response_model=MeetingActionResponse)
async def update_action_progress(
    action_id: UUID,
    progress_update: ActionProgressUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update action progress percentage with validation."""
    try:
        # Check if action exists
        action_obj = await get_action_or_404(db, action_id)
        
        # Validate progress percentage
        if progress_update.progress_percentage < 0 or progress_update.progress_percentage > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Progress percentage must be between 0 and 100"
            )
        
        # Check permission
        await check_action_permission(action_obj, current_user, require_ownership=True)
        
        # Update progress
        updated_action = await meeting_action.update_progress(db, action_id, progress_update, current_user.id)
        
        logger.info(f"Action {action_id} progress updated to {progress_update.progress_percentage}% by user {current_user.id}")
        return updated_action
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating action progress {action_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update progress: {str(e)}"
        )


@router.post("/{action_id}/assign", response_model=MeetingActionResponse)
async def assign_action(
    action_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Assign action to a user."""
    try:
        # Check if action exists
        action_obj = await get_action_or_404(db, action_id)
        
        # Assign the action
        updated_action = await meeting_action.assign_action(
            db=db,
            action_id=action_id,
            assigned_to_id=user_id,
            assigned_by_id=current_user.id
        )
        
        logger.info(f"Action {action_id} assigned to user {user_id} by {current_user.id}")
        return updated_action
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning action {action_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign action: {str(e)}"
        )


@router.post("/{action_id}/comments", response_model=ActionCommentResponse, status_code=status.HTTP_201_CREATED)
async def add_action_comment(
    action_id: UUID,
    comment_in: ActionCommentCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Add a comment to an action item."""
    try:
        # Check if action exists
        await get_action_or_404(db, action_id)
        
        # Add comment
        comment = await meeting_action.add_comment(db, action_id, comment_in, current_user.id)
        
        logger.info(f"Comment added to action {action_id} by user {current_user.id}")
        return comment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding comment to action {action_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add comment: {str(e)}"
        )


@router.delete("/actions/{action_id}/comments/{comment_id}")
async def delete_action_comment(
    action_id: str, 
    comment_id: str,
    current_user: User = Depends(deps.get_current_user),
):
    # Your delete logic here
    # Verify comment belongs to action
    # Delete from database
    
    return {"message": f"Comment {comment_id} deleted from action {action_id}"}

@router.get("/{action_id}/comments", response_model=List[ActionCommentResponse])
async def get_action_comments(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get all comments for an action with pagination."""
    try:
        # Check if action exists
        await get_action_or_404(db, action_id)
        
        # Get comments
        comments = await meeting_action.get_comments(db, action_id, skip, limit)
        
        logger.info(f"Retrieved {len(comments)} comments for action {action_id}")
        return comments
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching comments for action {action_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch comments"
        )


@router.delete("/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete (soft delete) an action item."""
    try:
        # Check if action exists
        action_obj = await get_action_or_404(db, action_id)
        
        # Check permission
        await check_action_permission(action_obj, current_user, require_ownership=True)
        
        # Soft delete
        await meeting_action.soft_delete(db, action_id, current_user.id)
        
        logger.info(f"Action {action_id} deleted by user {current_user.id}")
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting action {action_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete action: {str(e)}"
        )
    
