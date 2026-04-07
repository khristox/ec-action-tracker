from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, and_, or_, extract, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.api import deps
from app.models.user import User
from app.models.action_tracker import Meeting, MeetingAction

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Response Models
class DashboardResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    message: Optional[str] = None

@router.get("/stats", response_model=DashboardResponse)
async def get_dashboard_stats(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None)
):
    """
    Get all dashboard statistics using AsyncSession logic.
    """
    try:
        user_id = current_user.id
        now = datetime.now()
        target_year = year or now.year
        target_month = month or now.month
        
        # 1. MEETING STATISTICS
        # Total Meetings
        total_meetings_stmt = select(func.count(Meeting.id))
        total_meetings = (await db.execute(total_meetings_stmt)).scalar() or 0
        
        # This Month's Meetings
        month_stmt = select(func.count(Meeting.id)).where(
            and_(
                extract('year', Meeting.meeting_date) == target_year,
                extract('month', Meeting.meeting_date) == target_month
            )
        )
        meetings_this_month = (await db.execute(month_stmt)).scalar() or 0
        
        # Upcoming meetings (Next 5)
        upcoming_stmt = (
            select(Meeting)
            .where(Meeting.meeting_date >= now)
            .order_by(Meeting.meeting_date.asc())
            .limit(5)
        )
        upcoming_res = await db.execute(upcoming_stmt)
        upcoming_meetings = upcoming_res.scalars().all()

        # 2. TASK STATISTICS (Based on Progress Percentage)
        # Using 100% as 'completed' logic since 'status' column is not available
        
        # Total tasks for user
        total_tasks_stmt = select(func.count(MeetingAction.id)).where(
            MeetingAction.assigned_to_id == user_id
        )
        my_total_tasks = (await db.execute(total_tasks_stmt)).scalar() or 0

        # Pending tasks (< 100%)
        pending_stmt = select(func.count(MeetingAction.id)).where(
            and_(
                MeetingAction.assigned_to_id == user_id,
                MeetingAction.overall_progress_percentage < 100
            )
        )
        my_pending_tasks = (await db.execute(pending_stmt)).scalar() or 0

        # Completed tasks (>= 100%)
        completed_stmt = select(func.count(MeetingAction.id)).where(
            and_(
                MeetingAction.assigned_to_id == user_id,
                MeetingAction.overall_progress_percentage >= 100
            )
        )
        my_completed_tasks = (await db.execute(completed_stmt)).scalar() or 0

        # Recent Tasks (with Meeting Info)
        recent_tasks_stmt = (
            select(MeetingAction)
            .options(joinedload(MeetingAction.minutes))
            .where(MeetingAction.assigned_to_id == user_id)
            .order_by(desc(MeetingAction.created_at))
            .limit(5)
        )
        recent_tasks_res = await db.execute(recent_tasks_stmt)
        # .unique() is required when using joinedload in Async mode
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
                            "date": m.meeting_date.isoformat()
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