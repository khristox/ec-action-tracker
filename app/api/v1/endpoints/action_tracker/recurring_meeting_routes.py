# app/api/v1/endpoints/action_tracker/recurring_meeting_routes.py

import uuid
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import UUID, or_, select, desc

from app.api import deps
from app.db.base import get_db
from app.models.meetings.action_tracker import Meeting, MeetingParticipant
from app.models.general.dynamic_attribute import Attribute
from app.models.meetings.recurring_meeting import RecurringMeeting, RecurringMeetingOccurrence
from app.models.user import User
from app.schemas.recurring_meeting_schema import (
    RecurringMeetingCreate, 
    RecurringMeetingUpdate, 
    GenerateOccurrencesRequest,
    PreviewOccurrencesRequest, 
    BulkActionRequest
)
from app.crud.meetings.recurring_meeting_service import RecurringMeetingService

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== Helper Functions ====================

def safe_str(value):
    """Safely convert to string."""
    if value is None:
        return None
    if hasattr(value, 'id'):
        return str(value.id)
    return str(value)


def safe_iso_format(dt):
    """Safely convert datetime to ISO format."""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


# ==================== CRUD Operations ====================

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_recurring_meeting(
    meeting_data: RecurringMeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new recurring meeting."""
    service = RecurringMeetingService(db)
    result = await service.create_recurring_meeting(meeting_data, current_user.id)

    
    return {
        "success": True,
        "message": "Recurring meeting created successfully",
        "data": {
            "id": safe_str(result.id),
            "title": result.title,
            "recurrence_type_id": safe_str(result.recurrence_type_id),
            "status_id": safe_str(result.status_id),
            "created_at": safe_iso_format(result.created_at),
        }
    }


@router.get("/")
async def get_recurring_meetings(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_id: Optional[uuid.UUID] = Query(None),
    recurrence_type_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(deps.get_current_user),
):
    """Get recurring meetings accessible to current user."""
    try:
        service = RecurringMeetingService(db)
        
        # Get all meetings
        all_meetings = await service.get_recurring_meetings(
            skip=skip, 
            limit=limit, 
            status_id=status_id,
            recurrence_type_id=recurrence_type_id
        )
        
        # Filter by access
        accessible_meetings = []
        for meeting in all_meetings:
            # Check if user is creator or superuser
            if str(meeting.created_by_id) == str(current_user.id) or getattr(current_user, 'is_superuser', False):
                accessible_meetings.append(meeting)
            else:
                # Check if user is a participant in any occurrence
                result = await db.execute(
                    select(Meeting).where(
                        Meeting.recurring_meeting_id == meeting.id,
                        Meeting.participants.any(MeetingParticipant.email == current_user.email)
                    )
                )
                if result.scalar_one_or_none():
                    accessible_meetings.append(meeting)
        
        # Return as list of dicts
        items = []
        for meeting in accessible_meetings:
            item = {
                "id": safe_str(meeting.id),
                "title": meeting.title,
                "description": meeting.description,
                "location_text": meeting.location_text,
                "location_id": safe_str(meeting.location_id) if meeting.location_id else None,
                "recurrence_interval": meeting.recurrence_interval,
                "next_occurrence_date": safe_iso_format(meeting.next_occurrence_date),
                "total_occurrences_generated": meeting.total_occurrences_generated or 0,
                "status": "active" if not getattr(meeting, 'is_deleted', False) else "inactive",
                "created_at": safe_iso_format(meeting.created_at),
                "start_time": safe_iso_format(meeting.start_time),
                "end_time": safe_iso_format(meeting.end_time),
                "created_by_id": safe_str(meeting.created_by_id),  # ✅ ADD THIS
            }
            items.append(item)
        
        return {
            "success": True,
            "data": items,
            "total": len(items),
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Error getting recurring meetings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recurring meetings: {str(e)}"
        )
    

@router.get("/{meeting_id}")
async def get_recurring_meeting(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get recurring meeting by ID (if user has access)."""
    try:
        service = RecurringMeetingService(db)
        recurring_meeting = await service.get_recurring_meeting(meeting_id)
        
        if not recurring_meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recurring meeting not found"
            )
        
        # ✅ CHECK ACCESS
        is_creator = str(recurring_meeting.created_by_id) == str(current_user.id)
        is_superuser = getattr(current_user, 'is_superuser', False)
        
        if not (is_creator or is_superuser):
            # Check if user is a participant
            result = await db.execute(
                select(Meeting).where(
                    Meeting.recurring_meeting_id == meeting_id,
                    Meeting.participants.any(MeetingParticipant.email == current_user.email)
                )
            )
            is_participant = result.scalar_one_or_none() is not None
            
            if not is_participant:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this recurring meeting"
                )
        
        return {
            "success": True,
            "data": {
                "id": safe_str(recurring_meeting.id),
                "title": recurring_meeting.title,
                "description": recurring_meeting.description,
                "location_text": recurring_meeting.location_text,
                "recurrence_interval": recurring_meeting.recurrence_interval,
                "start_time": safe_iso_format(recurring_meeting.start_time),
                "end_time": safe_iso_format(recurring_meeting.end_time),
                "next_occurrence_date": safe_iso_format(recurring_meeting.next_occurrence_date),
                "end_date": safe_iso_format(recurring_meeting.recurrence_end_date),
                "max_occurrences": recurring_meeting.recurrence_max_occurrences,
                "total_occurrences_generated": recurring_meeting.total_occurrences_generated or 0,
                "status": "active" if not getattr(recurring_meeting, 'is_deleted', False) else "inactive",
                "created_at": safe_iso_format(recurring_meeting.created_at),
                "updated_at": safe_iso_format(recurring_meeting.updated_at),
                "created_by_id": safe_str(recurring_meeting.created_by_id),  # ✅ ADD THIS
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting recurring meeting {meeting_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recurring meeting: {str(e)}"
        )

@router.put("/{meeting_id}")
async def update_recurring_meeting(
    meeting_id: uuid.UUID,
    meeting_data: RecurringMeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update a recurring meeting."""
    service = RecurringMeetingService(db)
    
    meeting = await service.get_recurring_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Recurring meeting not found")
    
    if str(meeting.created_by_id) != str(current_user.id) and not getattr(current_user, 'is_superuser', False):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    updated = await service.update_recurring_meeting(meeting_id, meeting_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Failed to update")
    
    return {
        "success": True,
        "message": "Recurring meeting updated successfully",
        "data": {
            "id": safe_str(updated.id),
            "title": updated.title,
            "updated_at": safe_iso_format(updated.updated_at),
        }
    }


@router.delete("/{meeting_id}")
async def delete_recurring_meeting(
    meeting_id: uuid.UUID,
    delete_occurrences: bool = Query(False),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete a recurring meeting."""
    service = RecurringMeetingService(db)
    
    meeting = await service.get_recurring_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Recurring meeting not found")
    
    if str(meeting.created_by_id) != str(current_user.id) and not getattr(current_user, 'is_superuser', False):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    success = await service.delete_recurring_meeting(meeting_id, delete_occurrences)
    if not success:
        raise HTTPException(status_code=404, detail="Failed to delete")
    
    return {
        "success": True,
        "message": "Recurring meeting deleted successfully",
        "deleted_occurrences": delete_occurrences
    }


# ==================== Occurrence Endpoints ====================

@router.get("/{meeting_id}/occurrences")
async def get_occurrences(
    meeting_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all occurrences for a recurring meeting."""
    try:
        service = RecurringMeetingService(db)
        meeting = await service.get_recurring_meeting(meeting_id)

        if not meeting:
            raise HTTPException(status_code=404, detail="Recurring meeting not found")

        # Check access: creator, superuser, or participant
        is_creator = str(meeting.created_by_id) == str(current_user.id)
        is_superuser = getattr(current_user, 'is_superuser', False)
        
        if not (is_creator or is_superuser):
            # Check if user is a participant by email
            result = await db.execute(
                select(Meeting).where(
                    Meeting.recurring_meeting_id == meeting_id,
                    Meeting.participants.any(MeetingParticipant.email == current_user.email)
                )
            )
            is_participant = result.scalar_one_or_none() is not None
            
            if not is_participant:
                raise HTTPException(status_code=403, detail="Not enough permissions")
        
        occurrences = await service.get_occurrences_by_meeting(meeting_id)
        
        # Transform Meeting objects to response dicts
        response_items = []
        for idx, occ in enumerate(occurrences, 1):
            status_name = "scheduled"
            if occ.status:
                status_name = occ.status.short_name or occ.status.name or "scheduled"
            
            response_items.append({
                "id": safe_str(occ.id),
                "recurring_meeting_id": safe_str(meeting_id),
                "meeting_id": safe_str(occ.id),
                "occurrence_number": idx,
                "scheduled_date": safe_iso_format(occ.meeting_date or occ.start_time),
                "start_time": safe_iso_format(occ.start_time),
                "end_time": safe_iso_format(occ.end_time),
                "title": occ.title,
                "status": status_name,
                "created_at": safe_iso_format(occ.created_at),
            })
        
        return {
            "success": True,
            "data": response_items,
            "total": len(response_items),
            "recurring_meeting": {
                "id": safe_str(meeting.id),
                "title": meeting.title
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting occurrences: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get occurrences: {str(e)}"
        )
    
@router.post("/{meeting_id}/generate-on-demand")
async def generate_on_demand_occurrence(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Generate the next occurrence for a recurring meeting."""
    try:
        from datetime import timedelta
        
        service = RecurringMeetingService(db)
        meeting = await service.get_recurring_meeting(meeting_id)

        if not meeting:
            raise HTTPException(status_code=404, detail="Recurring meeting not found")
        
        if str(meeting.created_by_id) != str(current_user.id) and not getattr(current_user, 'is_superuser', False):
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        # Calculate next date
        next_date = meeting.next_occurrence_date or meeting.start_time
        if not next_date:
            next_date = datetime.now()
        
        # Create meeting occurrence
        new_meeting = Meeting(
            id=uuid.uuid4(),
            title=meeting.title,
            description=meeting.description,
            department_id=meeting.department_id,
            meeting_date=next_date.date() if hasattr(next_date, 'date') else next_date,
            start_time=next_date if isinstance(next_date, datetime) else meeting.start_time,
            end_time=meeting.end_time,
            location_text=meeting.location_text,
            is_recurring=True,
            recurring_meeting_id=meeting.id,
            created_by_id=current_user.id,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            is_active=True,
        )
        
        db.add(new_meeting)
        
        # Update recurring meeting
        meeting.total_occurrences_generated = (meeting.total_occurrences_generated or 0) + 1
        meeting.last_occurrence_date = next_date
        meeting.updated_at = datetime.now()
        
        # Calculate next occurrence (weekly by default)
        if meeting.recurrence_interval:
            meeting.next_occurrence_date = next_date + timedelta(weeks=meeting.recurrence_interval)
        
        await db.commit()
        await db.refresh(new_meeting)
        
        return {
            "success": True,
            "message": "Occurrence generated successfully",
            "data": {
                "meeting_id": safe_str(new_meeting.id),
                "meeting_title": new_meeting.title,
                "meeting_date": safe_iso_format(new_meeting.meeting_date),
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating occurrence: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate occurrence: {str(e)}"
        )


@router.post("/{meeting_id}/generate")
async def generate_occurrences(
    meeting_id: uuid.UUID,
    request: GenerateOccurrencesRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Generate future occurrences."""
    raise HTTPException(status_code=501, detail="Not implemented yet")


# ==================== Preview and Utilities ====================

@router.post("/preview")
async def preview_occurrences(
    request: PreviewOccurrencesRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Preview recurrence dates without saving."""
    try:
        from datetime import timedelta
        
        dates = []
        current = request.start_date
        
        for i in range(min(request.max_occurrences, 10)):
            dates.append(current)
            current = current + timedelta(weeks=request.recurrence_interval)
        
        return {
            "success": True,
            "dates": [safe_iso_format(d) for d in dates],
            "count": len(dates)
        }
    except Exception as e:
        logger.error(f"Error previewing occurrences: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview occurrences: {str(e)}"
        )


@router.get("/upcoming")
async def get_upcoming_occurrences(
    days_ahead: int = Query(30, ge=1, le=365, description="Number of days to look ahead"),
    include_past: bool = Query(False, description="Include past occurrences"),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all upcoming occurrences across all recurring meetings where the user is a participant.
    """
    user_email = current_user.email
    user_telephone = getattr(current_user, 'telephone', None) or getattr(current_user, 'phone', None)
    
    # Find all meetings where the user is a participant
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
                "upcoming_occurrences": [],
                "total": 0,
                "recurring_meetings": []
            }
        }
    
    # Get all recurring meetings (meetings with recurrence rules)
    now = datetime.utcnow()
    future_date = now + timedelta(days=days_ahead)
    
    # Build query for recurring meetings only
    query = (
        select(Meeting)
        .options(
            selectinload(Meeting.status),
            selectinload(Meeting.participants)
        )
        .where(
            Meeting.id.in_(meeting_ids),
            Meeting.is_recurring == True,
            Meeting.is_active == True
        )
    )
    
    result = await db.execute(query)
    recurring_meetings = result.scalars().all()
    
    # Generate occurrences for each recurring meeting
    all_occurrences = []
    
    for meeting in recurring_meetings:
        # Find user's participant record
        user_participant = None
        for p in meeting.participants:
            if (p.email == user_email or 
                (user_telephone and p.telephone == user_telephone)):
                user_participant = p
                break
        
        # Generate occurrence dates based on recurrence interval
        start_date = now if not include_past else now - timedelta(days=7)
        occurrences = await _generate_occurrence_dates_simple(
            meeting=meeting,
            start_date=start_date,
            end_date=future_date
        )
        
        # Build status info
        status_info = None
        if meeting.status:
            status_info = {
                "id": str(meeting.status.id),
                "code": meeting.status.code,
                "name": meeting.status.name,
                "short_name": meeting.status.short_name,
                "color": getattr(meeting.status, 'color', None),
                "description": getattr(meeting.status, 'description', None)
            }
        
        # Create occurrence objects
        for occurrence_date in occurrences:
            all_occurrences.append({
                "meeting_id": str(meeting.id),
                "occurrence_id": f"{meeting.id}_{occurrence_date.isoformat()}",
                "title": meeting.title,
                "description": meeting.description,
                "meeting_date": occurrence_date.isoformat(),
                "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
                "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
                "location": meeting.location_text,
                "attendance_status": user_participant.attendance_status if user_participant else "pending",
                "is_chairperson": user_participant.is_chairperson if user_participant else False,
                "is_secretary": user_participant.is_secretary if user_participant else False,
                "status": status_info,
                "status_code": meeting.status.code if meeting.status else None,
                "status_name": meeting.status.name if meeting.status else None,
                "is_recurring": True,
                "recurrence_interval": meeting.recurrence_interval,
                "is_cancelled": False,
                "is_exception": False
            })
    
    # Sort by date
    all_occurrences.sort(key=lambda x: x["meeting_date"])
    
    # Limit to days_ahead
    filtered_occurrences = [
        occ for occ in all_occurrences 
        if datetime.fromisoformat(occ["meeting_date"]) <= future_date
    ]
    
    return {
        "success": True,
        "data": {
            "upcoming_occurrences": filtered_occurrences[:50],
            "total": len(filtered_occurrences),
            "recurring_meetings": [
                {
                    "id": str(m.id),
                    "title": m.title,
                    "recurrence_interval": m.recurrence_interval,
                    "next_occurrence": filtered_occurrences[0]["meeting_date"] if filtered_occurrences else None
                }
                for m in recurring_meetings
            ]
        }
    }


async def _generate_occurrence_dates_simple(
    meeting: Meeting,
    start_date: datetime,
    end_date: datetime
) -> List[datetime]:
    """
    Simple occurrence date generator using recurrence_interval (weeks).
    """
    occurrences = []
    
    # Start from the meeting's next occurrence date or meeting date
    current_date = meeting.next_occurrence_date or meeting.meeting_date or start_date
    
    if not current_date:
        return occurrences
    
    # Ensure current_date is datetime
    if isinstance(current_date, date) and not isinstance(current_date, datetime):
        current_date = datetime.combine(current_date, datetime.min.time())
    
    # Use recurrence_interval (in weeks)
    interval_weeks = meeting.recurrence_interval or 1
    interval_days = interval_weeks * 7
    
    while current_date <= end_date:
        if current_date >= start_date:
            occurrences.append(current_date)
        current_date += timedelta(days=interval_days)
    
    return occurrences


# ==================== Alternative: Simplified Version ====================

@router.get("/upcoming/simple")
async def get_upcoming_occurrences_simple(
    days_ahead: int = Query(30, ge=1, le=365),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Simplified version that returns recurring meetings with their next occurrence dates
    without generating all individual occurrences.
    """
    user_email = current_user.email
    user_telephone = getattr(current_user, 'telephone', None) or getattr(current_user, 'phone', None)
    
    # Find participant meetings
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
                "recurring_meetings": [],
                "total": 0
            }
        }
    
    # Get recurring meetings
    query = (
        select(Meeting)
        .options(selectinload(Meeting.status), selectinload(Meeting.participants))
        .where(
            Meeting.id.in_(meeting_ids),
            Meeting.is_recurring == True,
            Meeting.is_active == True
        )
    )
    
    result = await db.execute(query)
    recurring_meetings = result.scalars().all()
    
    # Calculate next occurrence for each recurring meeting
    now = datetime.utcnow()
    future_date = now + timedelta(days=days_ahead)
    
    meeting_list = []
    for meeting in recurring_meetings:
        # Find user's participant record
        user_participant = None
        for p in meeting.participants:
            if (p.email == user_email or 
                (user_telephone and p.telephone == user_telephone)):
                user_participant = p
                break
        
        # Calculate next occurrence date (simplified)
        next_occurrence = meeting.meeting_date
        while next_occurrence and next_occurrence < now:
            if meeting.recurrence_rule:
                interval = meeting.recurrence_rule.interval or 1
                if meeting.recurrence_rule.pattern == "weekly":
                    next_occurrence += timedelta(days=7 * interval)
                elif meeting.recurrence_rule.pattern == "daily":
                    next_occurrence += timedelta(days=interval)
                elif meeting.recurrence_rule.pattern == "monthly":
                    # Simplified: add month
                    if next_occurrence.month == 12:
                        next_occurrence = next_occurrence.replace(year=next_occurrence.year + 1, month=1)
                    else:
                        next_occurrence = next_occurrence.replace(month=next_occurrence.month + interval)
            else:
                break
        
        if next_occurrence and next_occurrence <= future_date:
            meeting_list.append({
                "id": str(meeting.id),
                "title": meeting.title,
                "description": meeting.description,
                "next_occurrence_date": next_occurrence.isoformat() if next_occurrence else None,
                "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
                "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
                "location": meeting.location_text,
                "attendance_status": user_participant.attendance_status if user_participant else "pending",
                "is_chairperson": user_participant.is_chairperson if user_participant else False,
                "is_secretary": user_participant.is_secretary if user_participant else False,
                "recurrence_pattern": meeting.recurrence_rule.pattern if meeting.recurrence_rule else None,
                "recurrence_interval": meeting.recurrence_rule.interval if meeting.recurrence_rule else None,
                "status_code": meeting.status.code if meeting.status else None,
                "status_name": meeting.status.name if meeting.status else None
            })
    
    meeting_list.sort(key=lambda x: x["next_occurrence_date"])
    
    return {
        "success": True,
        "data": {
            "recurring_meetings": meeting_list,
            "total": len(meeting_list)
        }
    }


@router.post("/bulk-action")
async def bulk_action(
    request: BulkActionRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Perform bulk actions on multiple recurring meetings."""
    service = RecurringMeetingService(db)
    results = []
    
    for meeting_id in request.recurring_meeting_ids:
        meeting = await service.get_recurring_meeting(meeting_id)
        if not meeting:
            results.append({"id": safe_str(meeting_id), "status": "error", "message": "Not found"})
            continue
        
        if str(meeting.created_by_id) != str(current_user.id) and not getattr(current_user, 'is_superuser', False):
            results.append({"id": safe_str(meeting_id), "status": "error", "message": "Permission denied"})
            continue
        
        try:
            if request.action == "pause":
                # Get paused status
                result = await db.execute(
                    select(Attribute).where(Attribute.code == "RECURRING_STATUS_PAUSED")
                )
                paused_status = result.scalar_one_or_none()
                if paused_status:
                    meeting.status_id = paused_status.id
                    await db.commit()
                    results.append({"id": safe_str(meeting_id), "status": "success", "action": "paused"})
            
            elif request.action == "resume":
                result = await db.execute(
                    select(Attribute).where(Attribute.code == "RECURRING_STATUS_ACTIVE")
                )
                active_status = result.scalar_one_or_none()
                if active_status:
                    meeting.status_id = active_status.id
                    await db.commit()
                    results.append({"id": safe_str(meeting_id), "status": "success", "action": "resumed"})
            
            elif request.action == "cancel":
                result = await db.execute(
                    select(Attribute).where(Attribute.code == "RECURRING_STATUS_CANCELLED")
                )
                cancelled_status = result.scalar_one_or_none()
                if cancelled_status:
                    meeting.status_id = cancelled_status.id
                    await db.commit()
                    results.append({"id": safe_str(meeting_id), "status": "success", "action": "cancelled"})
            
            elif request.action == "delete":
                await service.delete_recurring_meeting(meeting_id, delete_occurrences=False)
                results.append({"id": safe_str(meeting_id), "status": "success", "action": "deleted"})
            
            else:
                results.append({"id": safe_str(meeting_id), "status": "error", "message": f"Invalid action: {request.action}"})
        
        except Exception as e:
            results.append({"id": safe_str(meeting_id), "status": "error", "message": str(e)})
    
    return {
        "success": True,
        "message": f"Processed {len(results)} meetings",
        "results": results
    }


# ==================== Attribute Helpers ====================
@router.get("/attributes/recurrence-types")
async def get_recurrence_type_attributes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all recurrence type attributes."""
    try:
        from sqlalchemy.orm import joinedload
        
        # Use the relationship to filter by attribute group code
        result = await db.execute(
            select(Attribute)
            .options(joinedload(Attribute.attribute_group))
            .where(
                Attribute.attribute_group.has(code="RECURRING_MEETING"),
                Attribute.code.like("RECURRENCE_TYPE_%"),
                Attribute.is_active == True
            )
            .order_by(Attribute.sort_order)
        )
        attributes = result.unique().scalars().all()
        
        return {
            "success": True,
            "data": [
                {
                    "id": safe_str(attr.id),
                    "code": attr.code,
                    "name": attr.name,
                    "value": attr.extra_metadata.get("value") if attr.extra_metadata else None,
                    "icon": attr.extra_metadata.get("icon") if attr.extra_metadata else None,
                    "emoji": attr.extra_metadata.get("emoji") if attr.extra_metadata else None,
                    "description": attr.extra_metadata.get("description") if attr.extra_metadata else None
                }
                for attr in attributes
            ]
        }
    except Exception as e:
        logger.error(f"Error getting recurrence types: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))




@router.get("/attributes/recurrence-days")
async def get_recurrence_day_attributes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all recurrence day attributes."""
    try:
        result = await db.execute(
            select(Attribute).where(
                Attribute.group_code == "RECURRING_MEETING",  # Use group_code instead of attribute_group
                Attribute.code.like("RECURRENCE_DAY_%"),
                Attribute.is_active == True
            ).order_by(Attribute.sort_order)
        )
        attributes = result.scalars().all()
        
        return {
            "success": True,
            "data": [
                {
                    "id": safe_str(attr.id),
                    "code": attr.code,
                    "name": attr.name,
                    "value": attr.extra_metadata.get("value") if attr.extra_metadata else None,
                    "short_name": attr.extra_metadata.get("short_name") if attr.extra_metadata else None,
                    "icon": attr.extra_metadata.get("icon") if attr.extra_metadata else None,
                    "emoji": attr.extra_metadata.get("emoji") if attr.extra_metadata else None
                }
                for attr in attributes
            ]
        }
    except Exception as e:
        logger.error(f"Error getting recurrence days: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/attributes/recurrence-weeks")
async def get_recurrence_week_attributes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all recurrence week attributes."""
    try:
        from sqlalchemy.orm import joinedload
        
        result = await db.execute(
            select(Attribute)
            .options(joinedload(Attribute.attribute_group))
            .where(
                Attribute.attribute_group.has(code="RECURRING_MEETING"),
                Attribute.code.like("RECURRENCE_WEEK_%"),
                Attribute.is_active == True
            )
            .order_by(Attribute.sort_order)
        )
        attributes = result.unique().scalars().all()
        
        return {
            "success": True,
            "data": [
                {
                    "id": safe_str(attr.id),
                    "code": attr.code,
                    "name": attr.name,
                    "value": int(attr.extra_metadata.get("value")) if attr.extra_metadata and attr.extra_metadata.get("value") else None,
                    "icon": attr.extra_metadata.get("icon") if attr.extra_metadata else None,
                    "emoji": attr.extra_metadata.get("emoji") if attr.extra_metadata else None
                }
                for attr in attributes
            ]
        }
    except Exception as e:
        logger.error(f"Error getting recurrence weeks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/attributes/statuses")
async def get_recurring_status_attributes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all recurring meeting status attributes."""
    try:
        from sqlalchemy.orm import joinedload
        
        result = await db.execute(
            select(Attribute)
            .options(joinedload(Attribute.attribute_group))
            .where(
                Attribute.attribute_group.has(code="RECURRING_MEETING"),
                Attribute.code.like("RECURRING_STATUS_%"),
                Attribute.is_active == True
            )
            .order_by(Attribute.sort_order)
        )
        attributes = result.unique().scalars().all()
        
        return {
            "success": True,
            "data": [
                {
                    "id": safe_str(attr.id),
                    "code": attr.code,
                    "name": attr.name,
                    "value": attr.extra_metadata.get("value") if attr.extra_metadata else None,
                    "icon": attr.extra_metadata.get("icon") if attr.extra_metadata else None,
                    "emoji": attr.extra_metadata.get("emoji") if attr.extra_metadata else None,
                    "description": attr.extra_metadata.get("description") if attr.extra_metadata else None
                }
                for attr in attributes
            ]
        }
    except Exception as e:
        logger.error(f"Error getting recurring statuses: {str(e)}")
        # Return empty array instead of failing
        return {
            "success": True,
            "data": [],
            "message": "No status options available"
        }
    

async def check_recurring_meeting_access(
    meeting_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
    is_superuser: bool = False
) -> bool:
    """
    Check if user has access to a recurring meeting.
    Access granted if:
    1. User is superuser, OR
    2. User created the meeting, OR
    3. User is a participant
    """
    if is_superuser:
        return True
    
    # Get the recurring meeting
    result = await db.execute(
        select(RecurringMeeting).where(RecurringMeeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    
    if not meeting:
        return False
    
    # Check if user is creator
    if str(meeting.created_by_id) == str(user_id):
        return True
    
    # Check if user is a participant in any occurrence
    # We need to check the Meeting table for participants
    result = await db.execute(
        select(Meeting).where(
            Meeting.recurring_meeting_id == meeting_id,
            Meeting.participants.any(
                or_(
                    MeetingParticipant.email == (await db.execute(select(User.email).where(User.id == user_id))).scalar()
                    
                )
            )
        )
    )
    participant_meeting = result.scalar_one_or_none()
    
    return participant_meeting is not None