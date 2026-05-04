from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from datetime import datetime
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api import deps
from app.db.base import get_db
from app.models.general.dynamic_attribute import Attribute
from app.models.recurring_meeting import RecurringMeetingOccurrence
from app.models.user import User
from app.schemas.recurring_meeting_schema import (
    RecurringMeetingCreate, 
    RecurringMeetingUpdate, 
    RecurringMeetingResponse,
    RecurringMeetingOccurrenceResponse, 
    GenerateOccurrencesRequest,
    PreviewOccurrencesRequest, 
    BulkActionRequest
)
from app.crud.recurring_meeting_service import RecurringMeetingService, get_recurring_meeting_service

router = APIRouter()


# ==================== CRUD Operations ====================

@router.post("/", response_model=RecurringMeetingResponse, status_code=201)
async def create_recurring_meeting(
    meeting_data: RecurringMeetingCreate,
    db: AsyncSession = Depends(deps.get_db),           # Use async db
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new recurring meeting."""
    service = RecurringMeetingService(db)
    result = await service.create_recurring_meeting(meeting_data, current_user.id)
    return result


@router.get("/", response_model=List[RecurringMeetingResponse])
async def get_recurring_meetings(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_id: Optional[uuid.UUID] = Query(None),
    recurrence_type_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all recurring meetings."""
    service = RecurringMeetingService(db)
    meetings = await service.get_recurring_meetings(
        skip=skip, 
        limit=limit, 
        status_id=status_id,
        recurrence_type_id=recurrence_type_id
    )
    return meetings


@router.get("/{meeting_id}", response_model=RecurringMeetingResponse)
async def get_recurring_meeting(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get a specific recurring meeting."""
    service = RecurringMeetingService(db)
    meeting = await service.get_recurring_meeting(meeting_id)
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Recurring meeting not found")
    
    if meeting.created_by_id != current_user.id and not getattr(current_user, 'is_superuser', False):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return meeting


@router.put("/{meeting_id}", response_model=RecurringMeetingResponse)
async def update_recurring_meeting(
    meeting_id: uuid.UUID,
    meeting_data: RecurringMeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update a recurring meeting."""
    service = RecurringMeetingService(db)
    
    # Permission check
    meeting = await service.get_recurring_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Recurring meeting not found")
    
    if meeting.created_by_id != current_user.id and not getattr(current_user, 'is_superuser', False):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    updated = await service.update_recurring_meeting(meeting_id, meeting_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Failed to update")
    
    return updated


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
    
    if meeting.created_by_id != current_user.id and not getattr(current_user, 'is_superuser', False):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    success = await service.delete_recurring_meeting(meeting_id, delete_occurrences)
    if not success:
        raise HTTPException(status_code=404, detail="Failed to delete")
    
    return {"message": "Recurring meeting deleted successfully"}


# ==================== Preview ====================

@router.post("/preview", response_model=List[datetime])
async def preview_occurrences(
    request: PreviewOccurrencesRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    """Preview recurrence dates without saving."""
    service = RecurringMeetingService(db)
    dates = await service.preview_occurrences(request)
    return dates


# ==================== Other Endpoints (Stub for now) ====================

@router.post("/{meeting_id}/generate")
async def generate_occurrences(
    meeting_id: uuid.UUID,
    request: GenerateOccurrencesRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Generate future occurrences."""
    # TODO: Implement in service
    raise HTTPException(status_code=501, detail="Not implemented yet")

@router.get("/{meeting_id}/occurrences", response_model=List[RecurringMeetingOccurrenceResponse])
def get_occurrences(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get all occurrences for a recurring meeting.
    """
    service = RecurringMeetingService(db)
    
    # Check ownership
    meeting = service.get_recurring_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Recurring meeting not found")
    
    if meeting.created_by_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    occurrences = service.get_occurrences_by_meeting(meeting_id)
    return occurrences


@router.post("/occurrences/{occurrence_id}/skip")
def skip_occurrence(
    occurrence_id: int,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Skip/cancel a specific occurrence.
    """
    service = RecurringMeetingService(db)
    
    # Get occurrence to check permissions
    occurrence = db.query(RecurringMeetingOccurrence).filter(
        RecurringMeetingOccurrence.id == occurrence_id
    ).first()
    
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")
    
    meeting = service.get_recurring_meeting(occurrence.recurring_meeting_id)
    if meeting.created_by_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    success = service.skip_occurrence(occurrence_id, reason)
    return {"message": "Occurrence skipped successfully"}


@router.put("/occurrences/{occurrence_id}/reschedule")
def reschedule_occurrence(
    occurrence_id: int,
    new_date: datetime,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Reschedule a specific occurrence to a new date.
    """
    service = RecurringMeetingService(db)
    
    # Get occurrence to check permissions
    occurrence = db.query(RecurringMeetingOccurrence).filter(
        RecurringMeetingOccurrence.id == occurrence_id
    ).first()
    
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")
    
    meeting = service.get_recurring_meeting(occurrence.recurring_meeting_id)
    if meeting.created_by_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    updated_occurrence = service.reschedule_occurrence(occurrence_id, new_date, reason)
    return {
        "message": "Occurrence rescheduled successfully",
        "occurrence": updated_occurrence
    }


# ==================== Preview and Utilities ====================

@router.post("/preview", response_model=List[datetime])
def preview_occurrences(
    request: PreviewOccurrencesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Preview occurrence dates without creating a recurring meeting.
    Useful for testing recurrence patterns.
    """
    service = RecurringMeetingService(db)
    dates = service.preview_occurrences(request)
    return dates


@router.get("/upcoming", response_model=List[RecurringMeetingOccurrenceResponse])
def get_upcoming_occurrences(
    days_ahead: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get all upcoming occurrences across all recurring meetings.
    """
    service = RecurringMeetingService(db)
    occurrences = service.get_upcoming_occurrences(days_ahead)
    return occurrences


@router.post("/bulk-action")
def bulk_action(
    request: BulkActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Perform bulk actions on multiple recurring meetings.
    Actions: pause, resume, cancel, delete
    """
    service = RecurringMeetingService(db)
    results = []
    
    for meeting_id in request.recurring_meeting_ids:
        meeting = service.get_recurring_meeting(meeting_id)
        if not meeting:
            results.append({"id": meeting_id, "status": "error", "message": "Not found"})
            continue
        
        if meeting.created_by_id != current_user.id and not current_user.is_superuser:
            results.append({"id": meeting_id, "status": "error", "message": "Permission denied"})
            continue
        
        try:
            if request.action == "pause":
                # Get paused status attribute ID
                paused_status = db.query(Attribute).filter(
                    Attribute.code == "RECURRING_STATUS_PAUSED"
                ).first()
                if paused_status:
                    meeting.status_id = paused_status.id
                    db.commit()
                    results.append({"id": meeting_id, "status": "success", "action": "paused"})
            
            elif request.action == "resume":
                # Get active status attribute ID
                active_status = db.query(Attribute).filter(
                    Attribute.code == "RECURRING_STATUS_ACTIVE"
                ).first()
                if active_status:
                    meeting.status_id = active_status.id
                    db.commit()
                    results.append({"id": meeting_id, "status": "success", "action": "resumed"})
            
            elif request.action == "cancel":
                # Get cancelled status attribute ID
                cancelled_status = db.query(Attribute).filter(
                    Attribute.code == "RECURRING_STATUS_CANCELLED"
                ).first()
                if cancelled_status:
                    meeting.status_id = cancelled_status.id
                    db.commit()
                    results.append({"id": meeting_id, "status": "success", "action": "cancelled"})
            
            elif request.action == "delete":
                service.delete_recurring_meeting(meeting_id, delete_occurrences=False, hard_delete=False)
                results.append({"id": meeting_id, "status": "success", "action": "deleted"})
            
            else:
                results.append({"id": meeting_id, "status": "error", "message": f"Invalid action: {request.action}"})
        
        except Exception as e:
            results.append({"id": meeting_id, "status": "error", "message": str(e)})
    
    return {
        "message": f"Processed {len(results)} meetings",
        "results": results
    }


# ==================== Attribute Helpers ====================

@router.get("/attributes/recurrence-types")
def get_recurrence_type_attributes(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get all recurrence type attributes from the RECURRING_MEETING group.
    """
    attributes = db.query(Attribute).filter(
        Attribute.attribute_group.has(code="RECURRING_MEETING"),
        Attribute.code.like("RECURRENCE_TYPE_%"),
        Attribute.is_active == True
    ).order_by(Attribute.sort_order).all()
    
    return [
        {
            "id": attr.id,
            "code": attr.code,
            "name": attr.name,
            "value": attr.extra_metadata.get("value") if attr.extra_metadata else None,
            "icon": attr.extra_metadata.get("icon") if attr.extra_metadata else None,
            "emoji": attr.extra_metadata.get("emoji") if attr.extra_metadata else None,
            "description": attr.extra_metadata.get("description") if attr.extra_metadata else None
        }
        for attr in attributes
    ]


@router.get("/attributes/recurrence-days")
def get_recurrence_day_attributes(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get all recurrence day attributes from the RECURRING_MEETING group.
    """
    attributes = db.query(Attribute).filter(
        Attribute.attribute_group.has(code="RECURRING_MEETING"),
        Attribute.code.like("RECURRENCE_DAY_%"),
        Attribute.is_active == True
    ).order_by(Attribute.sort_order).all()
    
    return [
        {
            "id": attr.id,
            "code": attr.code,
            "name": attr.name,
            "value": attr.extra_metadata.get("value") if attr.extra_metadata else None,
            "short_name": attr.extra_metadata.get("short_name") if attr.extra_metadata else None,
            "icon": attr.extra_metadata.get("icon") if attr.extra_metadata else None,
            "emoji": attr.extra_metadata.get("emoji") if attr.extra_metadata else None
        }
        for attr in attributes
    ]


@router.get("/attributes/recurrence-weeks")
def get_recurrence_week_attributes(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get all recurrence week attributes from the RECURRING_MEETING group.
    """
    attributes = db.query(Attribute).filter(
        Attribute.attribute_group.has(code="RECURRING_MEETING"),
        Attribute.code.like("RECURRENCE_WEEK_%"),
        Attribute.is_active == True
    ).order_by(Attribute.sort_order).all()
    
    return [
        {
            "id": attr.id,
            "code": attr.code,
            "name": attr.name,
            "value": int(attr.extra_metadata.get("value")) if attr.extra_metadata and attr.extra_metadata.get("value") else None,
            "icon": attr.extra_metadata.get("icon") if attr.extra_metadata else None,
            "emoji": attr.extra_metadata.get("emoji") if attr.extra_metadata else None
        }
        for attr in attributes
    ]


@router.get("/attributes/statuses")
def get_recurring_status_attributes(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get all recurring meeting status attributes from the RECURRING_MEETING group.
    """
    attributes = db.query(Attribute).filter(
        Attribute.attribute_group.has(code="RECURRING_MEETING"),
        Attribute.code.like("RECURRING_STATUS_%"),
        Attribute.is_active == True
    ).order_by(Attribute.sort_order).all()
    
    return [
        {
            "id": attr.id,
            "code": attr.code,
            "name": attr.name,
            "value": attr.extra_metadata.get("value") if attr.extra_metadata else None,
            "icon": attr.extra_metadata.get("icon") if attr.extra_metadata else None,
            "emoji": attr.extra_metadata.get("emoji") if attr.extra_metadata else None,
            "description": attr.extra_metadata.get("description") if attr.extra_metadata else None
        }
        for attr in attributes
    ]