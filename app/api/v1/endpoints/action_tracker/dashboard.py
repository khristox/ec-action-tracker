from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, and_, or_, extract, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.api import deps
from app.models.user import User
from app.models.meetings.action_tracker import Meeting, MeetingAction, MeetingParticipant

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Response Models
class DashboardResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    message: Optional[str] = None

# DEBUG ENDPOINT
@router.get("/debug/meetings")
async def debug_meetings(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
):
    """
    Debug endpoint to see actual meeting data and user info
    """
    try:
        user_id = current_user.id
        user_email = current_user.email
        user_dept = current_user.department_id
        
        # Get all meetings
        all_meetings_stmt = select(Meeting)
        all_meetings_res = await db.execute(all_meetings_stmt)
        all_meetings = all_meetings_res.scalars().all()
        
        # Get current user's meetings (created_by)
        my_created_stmt = select(Meeting).where(Meeting.created_by_id == user_id)
        my_created_res = await db.execute(my_created_stmt)
        my_created = my_created_res.scalars().all()
        
        # Get meetings I'm a participant in
        participant_stmt = (
            select(Meeting)
            .join(MeetingParticipant)
            .where(MeetingParticipant.email == user_email)
        )
        participant_res = await db.execute(participant_stmt)
        my_participant = participant_res.scalars().all()
        
        return {
            "success": True,
            "user": {
                "id": str(user_id),
                "email": user_email,
                "department_id": str(user_dept) if user_dept else None,
            },
            "counts": {
                "total_meetings": len(all_meetings),
                "meetings_i_created": len(my_created),
                "meetings_i_participate": len(my_participant),
            },
            "all_meetings": [
                {
                    "id": str(m.id),
                    "title": m.title,
                    "created_by_id": str(m.created_by_id) if m.created_by_id else None,
                    "visibility": m.visibility,
                    "restricted_department_id": str(m.restricted_department_id) if m.restricted_department_id else None,
                    "meeting_date": m.meeting_date.isoformat() if m.meeting_date else None,
                } for m in all_meetings
            ],
            "my_created_meetings": [
                {
                    "id": str(m.id),
                    "title": m.title,
                    "visibility": m.visibility,
                } for m in my_created
            ],
            "my_participant_meetings": [
                {
                    "id": str(m.id),
                    "title": m.title,
                } for m in my_participant
            ],
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Debug Error: {str(e)}"
        )

@router.get("/stats", response_model=DashboardResponse)
async def get_dashboard_stats(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None)
):
    """
    Get all dashboard statistics using AsyncSession logic.
    Filters:
    1. Open meetings
    2. Restricted meetings where user is the creator AND belongs to the restricted department via their roles
    3. Meetings where user is listed as a participant
    """
    try:
        user_id = current_user.id
        user_email = current_user.email
        now = datetime.now()
        target_year = year or now.year
        target_month = month or now.month

        # Extract department IDs from current user's roles
        # Adjust 'department_id' attribute name on Role if named differently in your schema
        user_role_dept_ids = [
            role.department_id for role in current_user.roles if getattr(role, "department_id", None) is not None
        ]

        # -------------------------------------------------------------
        # BASE ACCESS RULE (1, 2, or 3)
        # -------------------------------------------------------------
        access_conditions = [
            # 1. Meetings which are open
            Meeting.visibility == "open",
            
            # 3. All meetings where the user is a participant
            MeetingParticipant.email == user_email
        ]

        # 2. Meetings restricted AND user belongs to that department under roles AND is creator
        if user_role_dept_ids:
            access_conditions.append(
                and_(
                    Meeting.restricted_department_id.isnot(None),
                    Meeting.restricted_department_id.in_(user_role_dept_ids),
                    Meeting.created_by_id == user_id
                )
            )

        # Base filter applied across all meeting queries
        base_access_filter = or_(*access_conditions)

        # 1. TOTAL ACCESSIBLE MEETINGS
        total_stmt = (
            select(func.count(Meeting.id.distinct()))
            .outerjoin(MeetingParticipant, Meeting.id == MeetingParticipant.meeting_id)
            .where(base_access_filter)
        )
        total_meetings = (await db.execute(total_stmt)).scalar() or 0

        # 2. THIS MONTH'S MEETINGS
        month_stmt = (
            select(func.count(Meeting.id.distinct()))
            .outerjoin(MeetingParticipant, Meeting.id == MeetingParticipant.meeting_id)
            .where(
                and_(
                    base_access_filter,
                    extract('year', Meeting.meeting_date) == target_year,
                    extract('month', Meeting.meeting_date) == target_month
                )
            )
        )
        meetings_this_month = (await db.execute(month_stmt)).scalar() or 0

        # 3. UPCOMING MEETINGS (Next 5)
        upcoming_stmt = (
            select(Meeting)
            .outerjoin(MeetingParticipant, Meeting.id == MeetingParticipant.meeting_id)
            .where(
                and_(
                    base_access_filter,
                    Meeting.meeting_date >= now
                )
            )
            .group_by(Meeting.id)
            .order_by(Meeting.meeting_date.asc())
            .limit(5)
        )
        upcoming_res = await db.execute(upcoming_stmt)
        upcoming_meetings = upcoming_res.scalars().all()

        # -------------------------------------------------------------
        # TASK STATISTICS
        # -------------------------------------------------------------
        total_tasks_stmt = select(func.count(MeetingAction.id)).where(
            MeetingAction.assigned_to_id == user_id
        )
        my_total_tasks = (await db.execute(total_tasks_stmt)).scalar() or 0

        pending_stmt = select(func.count(MeetingAction.id)).where(
            and_(
                MeetingAction.assigned_to_id == user_id,
                MeetingAction.overall_progress_percentage < 100
            )
        )
        my_pending_tasks = (await db.execute(pending_stmt)).scalar() or 0

        completed_stmt = select(func.count(MeetingAction.id)).where(
            and_(
                MeetingAction.assigned_to_id == user_id,
                MeetingAction.overall_progress_percentage >= 100
            )
        )
        my_completed_tasks = (await db.execute(completed_stmt)).scalar() or 0

        recent_tasks_stmt = (
            select(MeetingAction)
            .options(joinedload(MeetingAction.minutes))
            .where(MeetingAction.assigned_to_id == user_id)
            .order_by(desc(MeetingAction.created_at))
            .limit(5)
        )
        recent_tasks_res = await db.execute(recent_tasks_stmt)
        recent_tasks = recent_tasks_res.unique().scalars().all()

        return DashboardResponse(
            success=True,
            data={
                "meetings": {
                    "total": total_meetings,
                    "this_month": meetings_this_month,
                    "upcoming": [
                        {
                            "id": str(m.id),
                            "title": m.title,
                            "date": m.meeting_date.isoformat() if m.meeting_date else None
                        } for m in upcoming_meetings
                    ]
                },
                "tasks": {
                    "total": my_total_tasks,
                    "pending": my_pending_tasks,
                    "completed": my_completed_tasks,
                    "completion_rate": round((my_completed_tasks / my_total_tasks * 100), 1) if my_total_tasks > 0 else 0,
                    "recent": [
                        {
                            "id": str(t.id),
                            "description": t.description,
                            "progress": t.overall_progress_percentage,
                            "is_completed": t.overall_progress_percentage >= 100,
                            "due_date": t.due_date.isoformat() if t.due_date else None
                        } for t in recent_tasks
                    ]
                }
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Dashboard Error: {str(e)}"
        )

    
@router.get("/tasks/my-tasks")
async def get_my_tasks(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Get a list of tasks for the current user using AsyncSession.
    """
    try:
        stmt = (
            select(MeetingAction)
            .where(MeetingAction.assigned_to_id == current_user.id)
            .order_by(MeetingAction.due_date.asc().nulls_last())
            .limit(limit)
        )
        result = await db.execute(stmt)
        tasks = result.scalars().all()
        
        return {
            "success": True,
            "data": [
                {
                    "id": str(t.id),
                    "description": t.description,
                    "progress": t.overall_progress_percentage,
                    "due_date": t.due_date.isoformat() if t.due_date else None
                } for t in tasks
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))