# app/api/v1/endpoints/action_tracker/actions.py

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import Any, List, Optional, Dict
from uuid import UUID
from datetime import datetime, timezone
import logging

from app.api import deps
from app.crud.meetings.action_tracker import meeting_action, meeting_minutes
from app.models.meetings.action_tracker import ActionImplementer, MeetingAction, ActionComment
from app.models.user import User
from app.services.implementer_linking import (
    build_implementers,
    normalize_email,
    normalize_phone,
    resolve_implementer_user_id,
)

from app.schemas.action_tracker import (
    ActionCommentCreate,
    ActionCommentResponse,
    ActionProgressUpdate,
    ActionStatusHistoryResponse,
    MyTaskImplementer,
    MyTaskResponse,
)
from app.schemas.meeting_minutes.meeting_minutes import (
    MeetingActionCreate,
    MeetingActionResponse,
    MeetingActionUpdate,
)

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


async def check_action_permission(
    action: MeetingAction,
    current_user: User,
    require_ownership: bool = False
) -> bool:
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


def parse_due_date(due_date: Optional[str]) -> Optional[datetime]:
    """Parse due date string to datetime"""
    if not due_date:
        return None
    if isinstance(due_date, datetime):
        return due_date
    try:
        return datetime.fromisoformat(due_date.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return None


def serialize_implementer(imp: ActionImplementer) -> Dict[str, Any]:
    """
    Serialize one implementer for the REST endpoints.

    user_id is NULL for people who have no system account yet. That is a
    valid, expected state -- they are linked later, by email, once they
    register and verify.
    """
    return {
        "id": str(imp.id),
        "action_id": str(imp.action_id),
        "user_id": str(imp.user_id) if imp.user_id else None,
        "is_system_user": imp.user_id is not None,
        "linked_at": imp.linked_at.isoformat() if imp.linked_at else None,
        "name": imp.name,
        "email": imp.email,
        "phone": imp.phone,
        "sort_order": imp.sort_order,
    }


def build_my_task_response(action: MeetingAction, is_overdue_flag: bool) -> MyTaskResponse:
    """
    Build a MyTaskResponse from a MeetingAction.

    Shared by /my-tasks and /overdue so the two endpoints can't drift apart.
    """
    meeting_title = ""
    meeting_date = None
    if action.minutes and action.minutes.meeting:
        meeting_title = action.minutes.meeting.title or ""
        meeting_date = action.minutes.meeting.meeting_date

    # getattr guard: /overdue may not eager-load implementers.
    implementers = getattr(action, "implementers", None) or []

    return MyTaskResponse(
        # ---- identity ----
        id=action.id,
        description=action.description,
        title=action.title,

        # ---- meeting context ----
        meeting_title=meeting_title,
        meeting_date=meeting_date,

        # ---- scheduling ----
        due_date=action.due_date,
        date_initiated=action.date_initiated,
        completed_at=action.completed_at,
        created_at=action.created_at,

        # ---- classification ----
        priority=action.priority,
        type_of_action=action.type_of_action,
        category=getattr(action, "category", None),
        is_key_action=action.is_key_action or False,
        issue_challenge=action.issue_challenge,
        tags=action.tags or [],

        # ---- progress ----
        overall_progress_percentage=action.overall_progress_percentage or 0,
        overall_status_name=action.overall_status_name,
        overall_status_id=action.overall_status_id,
        is_overdue=is_overdue_flag,

        # ---- assignment ----
        assigned_at=action.assigned_at,
        assigned_by_name=(
            action.assigned_by.username if action.assigned_by else None
        ),
        assigned_to_display_name=action.assigned_to_display,
        implementers=[
            MyTaskImplementer(
                id=imp.id,
                user_id=imp.user_id,
                is_system_user=imp.user_id is not None,
                name=imp.name,
                email=imp.email,
                phone=imp.phone,
                sort_order=imp.sort_order or 0,
            )
            for imp in sorted(implementers, key=lambda i: i.sort_order or 0)
        ],
    )


def extract_assignment_data(action_data: Dict[str, Any]) -> tuple:
    """Extract and normalize assignment data from payload"""
    assigned_to_id = action_data.get('assigned_to_id')
    assigned_to_name = action_data.get('assigned_to_name')

    # Handle different formats of assigned_to_name
    if assigned_to_name is None and action_data.get('assigned_to'):
        assigned_to = action_data.get('assigned_to')
        if isinstance(assigned_to, dict):
            assigned_to_id = assigned_to.get('assigned_to_id') or assigned_to.get('id')
            assigned_to_name = assigned_to.get('assigned_to_name') or assigned_to.get('name')
            if isinstance(assigned_to_name, dict):
                assigned_to_name = assigned_to_name.get('name')

    # If assigned_to_name is a dict with id but no name, add name
    if isinstance(assigned_to_name, dict):
        if 'id' in assigned_to_name and 'name' not in assigned_to_name:
            assigned_to_name['name'] = assigned_to_name.get('id')
    elif assigned_to_name is None and assigned_to_id:
        assigned_to_name = {"id": assigned_to_id, "type": "user"}

    return assigned_to_id, assigned_to_name


async def ensure_minute_exists(
    db: AsyncSession,
    minute_id: Optional[UUID],
    meeting_id: Optional[UUID],
    description: str,
    user_id: UUID
) -> UUID:
    """
    Ensure a minute exists for the action.
    If minute_id is provided, validates it exists.
    If not, creates or finds a default minute.
    """
    if minute_id:
        minute = await meeting_minutes.get(db, minute_id)
        if not minute:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Minutes with id {minute_id} not found"
            )
        return minute_id

    # No minute_id provided, get or create a default one
    if not meeting_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="meeting_id is required when minute_id is not provided"
        )

    # Check if meeting exists
    from app.crud.meetings.action_tracker import meeting_crud
    meeting = await meeting_crud.get(db, meeting_id)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with id {meeting_id} not found"
        )

    # Check for existing minutes
    existing_minutes = await meeting_minutes.get_minutes_by_meeting(
        db=db,
        meeting_id=meeting_id,
        limit=1
    )

    if existing_minutes:
        return existing_minutes[0].id

    # Create default minute
    default_minute = await meeting_minutes.create_default_minute(
        db=db,
        meeting_id=meeting_id,
        action_description=description,
        user_id=user_id
    )
    return default_minute.id


# ==================== TEST ROUTES (Development Only) ====================
# NOTE: must be registered BEFORE /{action_id} or it can never be reached.

@router.get("/test", include_in_schema=False)
async def test_router():
    """Test endpoint to verify router is mounted (development only)."""
    return {
        "status": "ok",
        "message": "Actions router is mounted and working!",
        "routes": [
            "/test",
            "/",
            "/my-tasks",
            "/overdue",
            "/actions/for-minute/{minute_id}",
            "/{action_id}",
            "/{action_id}/history",
            "/{action_id}/comments",
            "/{action_id}/progress",
            "/{action_id}/assign",
            "/{action_id}/implementers",
        ]
    }


# ==================== USER TASK ROUTES ====================

@router.get("/my-tasks", response_model=List[MyTaskResponse])
async def get_my_tasks(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None, description="Search in description"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[int] = Query(None, ge=1, le=4),
    is_overdue: Optional[bool] = Query(None),
    include_completed: bool = Query(False, description="Include completed tasks"),
):
    """
    Get tasks assigned to the current user.

    Matches on BOTH the linked account (action_implementers.user_id) and,
    for rows not yet linked, the user's email address -- so a participant
    who was assigned work before they had an account still sees it here
    once they register.
    """
    try:
        actions = await meeting_action.get_actions_assigned_to_user(
            db=db,
            user_id=current_user.id,
            user_email=current_user.email,
            user_phone=current_user.phone,
            skip=skip,
            limit=limit,
            search=search,
            status=status_filter,
            priority=priority,
            is_overdue=is_overdue,
            include_completed=include_completed,
        )

        result = []
        for action in actions:
            result.append(build_my_task_response(
                action, calculate_is_overdue(action.due_date, action.completed_at)
            ))

        logger.info(f"Found {len(result)} tasks for user {current_user.id}")
        return result

    except Exception as e:
        logger.error(f"Error fetching my tasks for user {current_user.id}: {str(e)}", exc_info=True)
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
    """Get all overdue actions assigned to the current user."""
    try:
        actions = await meeting_action.get_overdue_actions_for_user(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=limit
        )

        result = []
        for action in actions:
            result.append(build_my_task_response(action, True))

        logger.info(f"Found {len(result)} overdue tasks for user {current_user.id}")
        return result

    except Exception as e:
        logger.error(f"Error fetching overdue tasks: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch overdue tasks: {str(e)}"
        )


# ==================== ACTION COLLECTION ROUTES ====================

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


# ==================== CREATE ACTION (ROOT ENDPOINT) ====================

@router.post("/", response_model=MeetingActionResponse, status_code=status.HTTP_201_CREATED)
async def create_action(
    *,
    db: AsyncSession = Depends(deps.get_db),
    action_in: MeetingActionCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create a new action item.
    If no minute_id is provided, automatically create a default minute.
    """
    try:
        # Ensure minute exists
        minute_id = await ensure_minute_exists(
            db=db,
            minute_id=action_in.minute_id,
            meeting_id=action_in.meeting_id,
            description=action_in.description,
            user_id=current_user.id
        )
        action_in.minute_id = minute_id

        # Validate assigned_to_id against the users table so stale ids
        # degrade to name-only assignment instead of an FK violation.
        if getattr(action_in, "assigned_to_id", None):
            action_in.assigned_to_id = await resolve_implementer_user_id(
                db, user_id=action_in.assigned_to_id
            )

        # Create the action
        action = await meeting_action.create_action(
            db=db,
            minute_id=action_in.minute_id,
            action_in=action_in,
            assigned_by_id=current_user.id
        )

        logger.info(f"Action created by user {current_user.id}: {action.id}")
        return action

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating action: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create action: {str(e)}"
        )


# ==================== CREATE ACTION FOR MINUTE ====================

@router.post("/actions/for-minute/{minute_id}", response_model=MeetingActionResponse, status_code=status.HTTP_201_CREATED)
async def create_action_for_minute(
    minute_id: UUID,
    action_data: Dict[str, Any],
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Create a new action item for a specific minute.
    This endpoint is used by the frontend when creating actions from the meeting minutes view.
    """
    try:
        logger.info(f"Creating action for minute {minute_id}")
        logger.debug(f"Received payload: {action_data}")

        # Check if minute exists
        minute = await meeting_minutes.get(db, minute_id)
        if not minute:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Minute with id {minute_id} not found"
            )

        # Extract and validate description
        description = action_data.get('description', '').strip()
        if not description:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Description is required"
            )

        # Extract assignment data
        assigned_to_id, assigned_to_name = extract_assignment_data(action_data)

        # Validate the assigned user actually exists (stale/foreign ids
        # become external participants instead of FK violations)
        assigned_to_id = await resolve_implementer_user_id(
            db,
            user_id=assigned_to_id,
            email=action_data.get('email'),
        )

        # Parse due_date
        due_date = parse_due_date(action_data.get('due_date'))

        # Create the action_in object
        action_in = MeetingActionCreate(
            description=description,
            assigned_to_id=assigned_to_id,
            assigned_to_name=assigned_to_name,
            due_date=due_date,
            priority=action_data.get('priority', 2),
            remarks=action_data.get('remarks', ''),
            minute_id=minute_id
        )

        # Create the action
        action = await meeting_action.create_action(
            db=db,
            minute_id=minute_id,
            action_in=action_in,
            assigned_by_id=current_user.id
        )

        logger.info(f"Action created successfully: {action.id}")
        return action

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating action: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create action: {str(e)}"
        )


# ==================== ACTION HISTORY ROUTES ====================

@router.get("/{action_id}/history", response_model=List[ActionStatusHistoryResponse])
async def get_action_history(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of records to return"),
):
    """Get status change history for an action with pagination."""
    try:
        # Check if action exists
        action = await get_action_or_404(db, action_id)

        # Check permission (view history)
        await check_action_permission(action, current_user, require_ownership=False)

        print('Ch..')
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


# ==================== SINGLE ACTION ROUTES ====================

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

        # Validate assigned_to_id if it is being changed
        if getattr(action_in, "assigned_to_id", None):
            action_in.assigned_to_id = await resolve_implementer_user_id(
                db, user_id=action_in.assigned_to_id
            )

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
    """
    Update action progress percentage with validation.
    Only the assigned user or admin can update progress.
    """
    try:
        # Check if action exists
        action_obj = await get_action_or_404(db, action_id)

        # Validate progress percentage
        if progress_update.progress_percentage < 0 or progress_update.progress_percentage > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Progress percentage must be between 0 and 100"
            )

        # Check permission - only assigned user or admin can update progress
        is_admin = any(role.code in ["admin", "super_admin"] for role in current_user.roles)
        if action_obj.assigned_to_id and action_obj.assigned_to_id != current_user.id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the assigned user or admin can update progress"
            )

        # Update the progress directly
        now = datetime.now(timezone.utc)
        action_obj.overall_progress_percentage = progress_update.progress_percentage

        # Update status if provided
        if progress_update.individual_status_id:
            action_obj.overall_status_id = progress_update.individual_status_id

        # Update remarks if provided
        if progress_update.remarks:
            action_obj.remarks = progress_update.remarks

        # If progress is 100%, mark as completed
        if progress_update.progress_percentage >= 100:
            action_obj.completed_at = now

        action_obj.updated_by_id = current_user.id
        action_obj.updated_at = now

        await db.commit()
        await db.refresh(action_obj)

        logger.info(f"Action {action_id} progress updated to {progress_update.progress_percentage}% by user {current_user.id}")
        return action_obj

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating action progress {action_id}: {str(e)}", exc_info=True)
        await db.rollback()
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

        # Verify the target user exists (avoid FK violation)
        resolved_id = await resolve_implementer_user_id(db, user_id=user_id)
        if not resolved_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {user_id} not found"
            )

        # Assign the action
        updated_action = await meeting_action.assign_action(
            db=db,
            action_id=action_id,
            assigned_to_id=resolved_id,
            assigned_by_id=current_user.id
        )

        logger.info(f"Action {action_id} assigned to user {resolved_id} by {current_user.id}")
        return updated_action

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning action {action_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign action: {str(e)}"
        )


# ==================== ACTION COMMENT ROUTES ====================

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
        logger.error(f"Error adding comment to action {action_id}: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add comment: {str(e)}"
        )


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

        # Get comments directly with SQLAlchemy
        query = select(ActionComment).where(
            ActionComment.action_id == action_id,
            ActionComment.is_active == True
        ).options(
            selectinload(ActionComment.created_by)
        ).order_by(
            ActionComment.created_at.desc()
        ).offset(skip).limit(limit)

        result = await db.execute(query)
        comments = result.scalars().all()

        logger.info(f"Retrieved {len(comments)} comments for action {action_id}")
        return comments

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching comments for action {action_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch comments"
        )


@router.delete("/{action_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action_comment(
    action_id: UUID,
    comment_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Delete a comment from an action.
    Only the comment creator or admin can delete comments.
    """
    try:
        # Check if action exists
        await get_action_or_404(db, action_id)

        # Get the comment directly from database
        query = select(ActionComment).where(
            ActionComment.id == comment_id,
            ActionComment.is_active == True
        )
        result = await db.execute(query)
        comment = result.scalar_one_or_none()

        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comment with id {comment_id} not found"
            )

        # Verify comment belongs to the action
        if str(comment.action_id) != str(action_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment does not belong to this action"
            )

        # Check permission - only comment creator or admin can delete
        is_admin = any(role.code in ["admin", "super_admin"] for role in current_user.roles)
        if comment.created_by_id != current_user.id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the comment creator or admin can delete this comment"
            )

        # Soft delete the comment
        comment.is_active = False
        comment.updated_by_id = current_user.id
        comment.updated_at = datetime.now(timezone.utc)

        await db.commit()

        logger.info(f"Comment {comment_id} deleted from action {action_id} by user {current_user.id}")
        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting comment {comment_id} from action {action_id}: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete comment: {str(e)}"
        )


# ==================== DELETE ACTION ====================

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


# ==================== IMPLEMENTERS ENDPOINTS ====================

@router.get("/{action_id}/implementers", response_model=List[dict])
async def get_action_implementers(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get all implementers for an action.

    Implementers with user_id are system users; those without are external
    people (name/email/phone only) who will be linked automatically once
    they register and verify the same email address.
    """
    try:
        # Check if action exists
        await get_action_or_404(db, action_id)

        # Get implementers
        result = await db.execute(
            select(ActionImplementer)
            .where(ActionImplementer.action_id == action_id)
            .order_by(ActionImplementer.sort_order)
        )
        implementers = result.scalars().all()

        return [serialize_implementer(imp) for imp in implementers]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching implementers for action {action_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch implementers"
        )


@router.post("/{action_id}/implementers", response_model=List[dict])
async def add_action_implementers(
    action_id: UUID,
    implementers_data: List[Dict[str, Any]],
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Add or update implementers for an action.
    This will replace all existing implementers with the new list.

    Each entry may be:
      - a system user: {"user_id": "...", "name": "...", "email": "..."}
      - an external person: {"name": "...", "email": "...", "phone": "..."}

    Any id supplied by the client is validated against the users table
    first. Unknown ids (for example participant ids from the picker) are
    stored as external people with user_id = NULL rather than failing.
    """
    try:
        # Check if action exists
        await get_action_or_404(db, action_id)

        # Delete existing implementers
        await db.execute(
            delete(ActionImplementer).where(ActionImplementer.action_id == action_id)
        )

        # Build new implementers (validates ids, auto-links by email,
        # de-duplicates, and never writes a non-user id into user_id)
        new_implementers = await build_implementers(db, action_id, implementers_data)
        for implementer in new_implementers:
            db.add(implementer)

        await db.commit()

        return [serialize_implementer(imp) for imp in new_implementers]

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error adding implementers for action {action_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add implementers"
        )


@router.put("/{action_id}/implementers", response_model=List[dict])
async def update_action_implementers(
    action_id: UUID,
    implementers_data: List[Dict[str, Any]],
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update implementers for an action (alias for POST).
    """
    return await add_action_implementers(action_id, implementers_data, db, current_user)


@router.delete("/{action_id}/implementers/{implementer_id}")
async def delete_action_implementer(
    action_id: UUID,
    implementer_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Delete a specific implementer from an action.
    """
    try:
        # Check if action exists
        await get_action_or_404(db, action_id)

        # Find and delete the implementer
        result = await db.execute(
            delete(ActionImplementer).where(
                ActionImplementer.id == implementer_id,
                ActionImplementer.action_id == action_id
            )
        )

        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Implementer not found"
            )

        await db.commit()

        return {
            "message": "Implementer deleted successfully",
            "implementer_id": str(implementer_id),
            "action_id": str(action_id)
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting implementer {implementer_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete implementer"
        )