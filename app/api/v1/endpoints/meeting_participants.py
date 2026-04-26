# app/api/v1/endpoints/meeting_participants.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, and_, or_, func
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from collections import defaultdict

from app.api import deps
from app.models.user import User
from app.models.action_tracker import Meeting, MeetingParticipant
from app.db.session import get_db

router = APIRouter()


class WeeklyMeetingService:
    def __init__(self, db):
        self.db = db
    
    async def get_user_meetings_as_participant(self, user: User, weeks: int = 4) -> Dict[str, Any]:
        """
        Get meetings where the user is a participant (by email or telephone)
        Grouped by week
        """
        # Get user's email and telephone
        user_email = user.email
        user_telephone = getattr(user, 'telephone', None) or getattr(user, 'phone', None)
        
        # Build query for participants where user is matched by email or telephone
        conditions = [
            MeetingParticipant.email == user_email
        ]
        
        # Add telephone condition if available
        if user_telephone:
            conditions.append(MeetingParticipant.telephone == user_telephone)
        
        # Query participants - AWAIT here
        participant_query = select(MeetingParticipant).where(or_(*conditions))
        result = await self.db.execute(participant_query)
        participants = result.scalars().all()
        
        # Get unique meeting IDs
        meeting_ids = list(set([p.meeting_id for p in participants]))
        
        if not meeting_ids:
            return self._get_empty_weekly_data(weeks, user_email, user_telephone)
        
        # Get meetings with their participants loaded - AWAIT here
        meetings_query = select(Meeting).where(
            Meeting.id.in_(meeting_ids)
        ).options(
            joinedload(Meeting.participants)
        )
        
        result = await self.db.execute(meetings_query)
        meetings = result.unique().scalars().all()
        
        # Prepare weekly data
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(weeks=weeks)
        
        # Create week ranges
        weeks_data = []
        for i in range(weeks):
            week_end = end_date - timedelta(days=7*i)
            week_start = week_end - timedelta(days=6)
            
            # If we're going back past start_date, adjust
            if week_start < start_date and i == weeks - 1:
                week_start = start_date
            
            weeks_data.append({
                "week_number": weeks - i,
                "start_date": week_start.isoformat(),
                "end_date": week_end.isoformat(),
                "label": f"Week {weeks - i} ({week_start.strftime('%b %d')} - {week_end.strftime('%b %d')})"
            })
        
        # Group meetings by week
        weekly_meetings = defaultdict(list)
        
        for meeting in meetings:
            meeting_date = meeting.meeting_date
            if not meeting_date:
                continue
            
            meeting_date = meeting_date.date() if hasattr(meeting_date, 'date') else meeting_date
            
            # Find which week this meeting belongs to
            for week in weeks_data:
                week_start = datetime.fromisoformat(week["start_date"]).date()
                week_end = datetime.fromisoformat(week["end_date"]).date()
                
                if week_start <= meeting_date <= week_end:
                    # Get user's participation status for this meeting
                    user_participant = None
                    for p in meeting.participants:
                        if (p.email == user_email or 
                            (user_telephone and p.telephone == user_telephone)):
                            user_participant = p
                            break
                    
                    weekly_meetings[week["label"]].append({
                        "id": str(meeting.id),
                        "title": meeting.title,
                        "description": meeting.description,
                        "meeting_date": meeting_date.isoformat(),
                        "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
                        "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
                        "location": meeting.location_text or (meeting.location.name if meeting.location else None),
                        "status": meeting.status.name if meeting.status else "scheduled",
                        "participant_status": user_participant.attendance_status if user_participant else "pending",
                        "is_chairperson": user_participant.is_chairperson if user_participant else False,
                        "is_secretary": user_participant.is_secretary if user_participant else False,
                        "participants_count": len(meeting.participants) if meeting.participants else 0,
                        "participant_name": user_participant.name if user_participant else None,
                        "participant_email": user_participant.email if user_participant else None,
                    })
                    break
        
        # Sort meetings by date within each week
        for week_label in weekly_meetings:
            weekly_meetings[week_label].sort(key=lambda x: x["meeting_date"])
        
        # Prepare response data
        weekly_labels = [week["label"] for week in weeks_data]
        meeting_counts = [len(weekly_meetings.get(label, [])) for label in weekly_labels]
        
        return {
            "weeks": weeks_data,
            "weekly_meetings": dict(weekly_meetings),
            "summary": {
                "total_meetings": len(meetings),
                "total_weeks": weeks,
                "weekly_counts": dict(zip(weekly_labels, meeting_counts))
            },
            "user_info": {
                "id": str(user.id),
                "email": user.email,
                "telephone": user_telephone,
                "username": user.username
            }
        }
    
    async def get_weekly_meeting_activity(self, user: User, weeks: int = 4) -> Dict[str, Any]:
        """Get weekly meeting activity for charts"""
        weekly_data = await self.get_user_meetings_as_participant(user, weeks)
        
        # Prepare chart data
        weeks_list = [week["label"] for week in weekly_data["weeks"]]
        meeting_counts = [weekly_data["summary"]["weekly_counts"].get(week, 0) for week in weeks_list]
        
        # Get status distribution for user's meetings
        status_counts = defaultdict(int)
        for meetings in weekly_data["weekly_meetings"].values():
            for meeting in meetings:
                status_counts[meeting["participant_status"]] += 1
        
        # Get monthly distribution for the last 6 months
        monthly_data = await self._get_monthly_meeting_distribution(user)
        
        return {
            "weekly_meetings_chart": {
                "labels": weeks_list,
                "datasets": [
                    {
                        "label": "Meetings",
                        "data": meeting_counts,
                        "backgroundColor": "#9c27b0",
                        "borderColor": "#9c27b0",
                        "borderRadius": 6,
                        "fill": True,
                        "tension": 0.4
                    }
                ]
            },
            "status_distribution": {
                "labels": list(status_counts.keys()),
                "datasets": [{
                    "data": list(status_counts.values()),
                    "backgroundColor": ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6"],
                    "borderWidth": 0
                }]
            },
            "monthly_distribution": monthly_data,
            "detailed_meetings": weekly_data["weekly_meetings"],
            "summary": weekly_data["summary"],
            "user_info": weekly_data["user_info"]
        }
    
    async def _get_monthly_meeting_distribution(self, user: User, months: int = 6) -> Dict[str, Any]:
        """Get monthly meeting distribution for the last N months"""
        user_email = user.email
        user_telephone = getattr(user, 'telephone', None) or getattr(user, 'phone', None)
        
        # Build query for participants
        conditions = [MeetingParticipant.email == user_email]
        if user_telephone:
            conditions.append(MeetingParticipant.telephone == user_telephone)
        
        result = await self.db.execute(
            select(MeetingParticipant).where(or_(*conditions))
        )
        participants = result.scalars().all()
        
        meeting_ids = list(set([p.meeting_id for p in participants]))
        
        if not meeting_ids:
            return self._get_empty_monthly_data(months)
        
        # Get meetings
        result = await self.db.execute(
            select(Meeting).where(Meeting.id.in_(meeting_ids))
        )
        meetings = result.scalars().all()
        
        # Get last N months
        end_date = datetime.utcnow()
        month_labels = []
        monthly_counts = defaultdict(int)
        
        for i in range(months - 1, -1, -1):
            month_date = end_date - timedelta(days=30 * i)
            month_label = month_date.strftime("%b %Y")
            month_labels.append(month_label)
        
        # Count meetings per month
        for meeting in meetings:
            if meeting.meeting_date:
                month_label = meeting.meeting_date.strftime("%b %Y")
                if month_label in month_labels:
                    monthly_counts[month_label] += 1
        
        counts = [monthly_counts.get(label, 0) for label in month_labels]
        
        return {
            "labels": month_labels,
            "datasets": [{
                "label": "Meetings",
                "data": counts,
                "backgroundColor": "#9c27b0",
                "borderColor": "#9c27b0",
                "borderRadius": 6
            }]
        }
    
    def _get_empty_weekly_data(self, weeks: int, email: str = None, telephone: str = None) -> Dict[str, Any]:
        """Return empty weekly data structure"""
        end_date = datetime.utcnow().date()
        weeks_data = []
        for i in range(weeks):
            week_end = end_date - timedelta(days=7*i)
            week_start = week_end - timedelta(days=6)
            weeks_data.append({
                "week_number": weeks - i,
                "start_date": week_start.isoformat(),
                "end_date": week_end.isoformat(),
                "label": f"Week {weeks - i} ({week_start.strftime('%b %d')} - {week_end.strftime('%b %d')})"
            })
        
        weekly_labels = [week["label"] for week in weeks_data]
        
        return {
            "weeks": weeks_data,
            "weekly_meetings": {},
            "summary": {
                "total_meetings": 0,
                "total_weeks": weeks,
                "weekly_counts": {label: 0 for label in weekly_labels}
            },
            "user_info": {
                "email": email,
                "telephone": telephone
            }
        }
    
    def _get_empty_monthly_data(self, months: int) -> Dict[str, Any]:
        """Return empty monthly data structure"""
        end_date = datetime.utcnow()
        month_labels = []
        for i in range(months - 1, -1, -1):
            month_date = end_date - timedelta(days=30 * i)
            month_labels.append(month_date.strftime("%b %Y"))
        
        return {
            "labels": month_labels,
            "datasets": [{
                "label": "Meetings",
                "data": [0] * months,
                "backgroundColor": "#9c27b0",
                "borderColor": "#9c27b0"
            }]
        }


# ==================== API Endpoints ====================

@router.get("/my-weekly-meetings")
async def get_my_weekly_meetings(
    weeks: int = Query(4, ge=1, le=12, description="Number of weeks to look back"),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get meetings where the logged-in user is a participant (by email or telephone)
    Returns meetings grouped by week
    """
    service = WeeklyMeetingService(db)
    result = await service.get_user_meetings_as_participant(current_user, weeks)
    
    return {
        "success": True,
        "data": result
    }


@router.get("/my-weekly-meetings-chart")
async def get_my_weekly_meetings_chart(
    weeks: int = Query(4, ge=1, le=12, description="Number of weeks to look back"),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get weekly meeting activity chart data for the logged-in user
    Returns:
    - Weekly meetings chart data
    - Status distribution
    - Monthly distribution
    - Detailed meeting list grouped by week
    """
    service = WeeklyMeetingService(db)
    result = await service.get_weekly_meeting_activity(current_user, weeks)
    
    return {
        "success": True,
        "data": result
    }


@router.get("/my-meetings/upcoming")
async def get_my_upcoming_meetings(
    days: int = Query(30, ge=1, le=90, description="Number of days to look ahead"),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get upcoming meetings where the user is a participant
    """
    user_email = current_user.email
    user_telephone = getattr(current_user, 'telephone', None) or getattr(current_user, 'phone', None)
    
    # Find participants
    conditions = [MeetingParticipant.email == user_email]
    if user_telephone:
        conditions.append(MeetingParticipant.telephone == user_telephone)
    
    result = await db.execute(
        select(MeetingParticipant).where(or_(*conditions))
    )
    participants = result.scalars().all()
    
    meeting_ids = list(set([p.meeting_id for p in participants]))
    
    if not meeting_ids:
        return {
            "success": True,
            "data": {
                "upcoming_meetings": [],
                "total": 0
            }
        }
    
    # Get upcoming meetings
    now = datetime.utcnow()
    future_date = now + timedelta(days=days)
    
    result = await db.execute(
        select(Meeting)
        .where(
            Meeting.id.in_(meeting_ids),
            Meeting.meeting_date >= now
        )
        .order_by(Meeting.meeting_date.asc())
        .limit(50)
    )
    meetings = result.scalars().all()
    
    # Format response
    upcoming_meetings = []
    for meeting in meetings:
        # Find user's participant record (need to load participants)
        # Eager load participants or query separately
        result_parts = await db.execute(
            select(MeetingParticipant).where(MeetingParticipant.meeting_id == meeting.id)
        )
        meeting_participants = result_parts.scalars().all()
        
        user_participant = None
        for p in meeting_participants:
            if (p.email == user_email or 
                (user_telephone and p.telephone == user_telephone)):
                user_participant = p
                break
        
        upcoming_meetings.append({
            "id": str(meeting.id),
            "title": meeting.title,
            "description": meeting.description,
            "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
            "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
            "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
            "location": meeting.location_text,
            "attendance_status": user_participant.attendance_status if user_participant else "pending",
            "is_chairperson": user_participant.is_chairperson if user_participant else False,
            "is_secretary": user_participant.is_secretary if user_participant else False
        })
    
    return {
        "success": True,
        "data": {
            "upcoming_meetings": upcoming_meetings,
            "total": len(upcoming_meetings)
        }
    }


@router.put("/meetings/{meeting_id}/my-status")
async def update_my_meeting_status(
    meeting_id: str,
    attendance_status: str = Query(..., description="Attendance status: attended, missed, pending, excused"),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's attendance status for a meeting
    """
    valid_statuses = ["attended", "missed", "pending", "excused"]
    if attendance_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    user_email = current_user.email
    user_telephone = getattr(current_user, 'telephone', None) or getattr(current_user, 'phone', None)
    
    # Find participant record
    conditions = [
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.email == user_email
    ]
    if user_telephone:
        conditions.append(MeetingParticipant.telephone == user_telephone)
    
    result = await db.execute(
        select(MeetingParticipant).where(or_(*conditions))
    )
    participant = result.scalar_one_or_none()
    
    if not participant:
        raise HTTPException(status_code=404, detail="You are not a participant in this meeting")
    
    participant.attendance_status = attendance_status
    await db.commit()
    
    return {
        "success": True,
        "message": f"Attendance status updated to '{attendance_status}'",
        "data": {
            "meeting_id": meeting_id,
            "attendance_status": attendance_status
        }
    }