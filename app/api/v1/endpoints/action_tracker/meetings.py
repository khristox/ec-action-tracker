# app/api/v1/endpoints/action_tracker/meetings.py
import uuid
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from venv import logger

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.crud.action_tracker import meeting, meeting_action, meeting_minutes, meeting_participant

from app.models.general.dynamic_attribute import Attribute
from app.models.user import User
from app.models.action_tracker import Meeting, MeetingAction, MeetingDocument, MeetingParticipant, MeetingQuery, MeetingStatus, MeetingStatusHistory, MeetingMinutes
from app.schemas.action_tracker import (
    MeetingActionCreate, MeetingActionResponse, MeetingCreateResponse, MeetingMinutesCreate, MeetingMinutesResponse, MeetingPaginationResponse, MeetingCreate, MeetingParticipantResponse, MeetingParticipantUpdate, 
    MeetingStatusHistoryResponse, MeetingUpdate, MeetingResponse, MeetingListResponse
)
from .status_utils import get_status_id_by_short_name, get_status_by_short_name, get_valid_status_short_names
from .utils import build_meeting_response

router = APIRouter()

# ==================== CREATE MEETING ====================
@router.post("/", response_model=MeetingCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new meeting with audit fields"""
    try:
        # Log the incoming data
        print(f"Creating meeting for user: {current_user.id}")
        print(f"Meeting data: {meeting_in.model_dump()}")
        
        # Ensure created_by_id is set
        meeting_data = meeting_in.model_dump()
        
        result = await meeting.create_with_participants(db, meeting_in, current_user.id)
        
        print(f"Meeting created successfully: {result.id}")
        
        return MeetingCreateResponse(
            id=result.id,
            title=result.title,
            description=result.description,
            meeting_date=result.meeting_date,
            start_time=result.start_time,
            end_time=result.end_time,
            location_text=result.location_text,
            agenda=result.agenda,
            facilitator=result.facilitator,
            chairperson_name=result.chairperson_name,
            status_id=result.status_id,
            created_by_id=result.created_by_id,
            created_by_name=current_user.username,
            created_at=result.created_at,
            updated_by_id=None,
            updated_by_name=None,
            updated_at=None,
            is_active=result.is_active,
            message="Meeting created successfully"
        )
        
    except Exception as e:
        # Log the full error
        print(f"Error creating meeting: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create meeting: {str(e)}"
        )
    
# In your meetings.py or status_utils.py

async def get_default_meeting_status(db: AsyncSession) -> Optional[MeetingStatus]:
    """Get the default meeting status (usually 'scheduled')"""
    from app.models.action_tracker import MeetingStatus
    
    result = await db.execute(
        select(MeetingStatus).where(
            MeetingStatus.code == 'scheduled',
            MeetingStatus.is_active == True
        )
    )
    status = result.scalar_one_or_none()
    
    if not status:
        # Fallback: get any active status
        result = await db.execute(
            select(MeetingStatus).where(MeetingStatus.is_active == True).limit(1)
        )
        status = result.scalar_one_or_none()
    
    return status

# ==================== LIST MEETINGS ====================
@router.get("/", response_model=MeetingPaginationResponse)
async def get_meetings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    upcoming: bool = Query(False),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """Get paginated list of meetings with audit info"""
    skip = (page - 1) * limit
    filters = [Meeting.is_active == True]
    
    if upcoming:
        filters.append(Meeting.meeting_date >= datetime.now().date())
    
    if search:
        search_term = f"%{search}%"
        filters.append(
            or_(
                Meeting.title.ilike(search_term),
                Meeting.location_text.ilike(search_term),
                Meeting.facilitator.ilike(search_term)
            )
        )
    
    # FIX: Handle status filter correctly for relationship
    if status:
        # Use .has() for relationship comparison
        filters.append(Meeting.status.has(Attribute.short_name == status))
    
    # Build the main query
    query = (
        select(Meeting)
        .where(and_(*filters))
        .options(
            selectinload(Meeting.status),
            selectinload(Meeting.participants),
            selectinload(Meeting.created_by),
            selectinload(Meeting.updated_by)
        )
        .order_by(desc(Meeting.meeting_date), desc(Meeting.start_time))
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    meetings_list = result.scalars().all()

    # Count query with same filters
    count_query = select(func.count(Meeting.id)).where(and_(*filters))
    count_res = await db.execute(count_query)
    total_count = count_res.scalar() or 0

    items = []
    for meeting_obj in meetings_list:
        status_data = None
        if meeting_obj.status:
            status_data = {
                "id": str(meeting_obj.status.id),
                "code": meeting_obj.status.code,
                "name": meeting_obj.status.name,
                "short_name": meeting_obj.status.short_name,
                "description": meeting_obj.status.description,
                "extra_metadata": meeting_obj.status.extra_metadata,
            }
        items.append(MeetingListResponse(
            id=meeting_obj.id,
            title=meeting_obj.title,
            description=meeting_obj.description,
            location_id=meeting_obj.location_id,
            location_text=meeting_obj.location_text,
            gps_coordinates=meeting_obj.gps_coordinates,
            meeting_date=meeting_obj.meeting_date,
            start_time=meeting_obj.start_time,
            end_time=meeting_obj.end_time,
            agenda=meeting_obj.agenda,
            facilitator=meeting_obj.facilitator,
            chairperson_name=meeting_obj.chairperson_name,
            status_id=meeting_obj.status_id,
            status=status_data,
            created_by_id=meeting_obj.created_by_id,
            created_by_name=meeting_obj.created_by.username if meeting_obj.created_by else None,
            created_at=meeting_obj.created_at,
            updated_by_id=meeting_obj.updated_by_id,
            updated_by_name=meeting_obj.updated_by.username if meeting_obj.updated_by else None,
            updated_at=meeting_obj.updated_at,
            is_active=meeting_obj.is_active,
            location_name=None,
            participants_count=len(meeting_obj.participants) if meeting_obj.participants else 0,
            minutes_count=0,
            actions_count=0,
            documents_count=0
        ))
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "size": limit,
        "pages": (total_count + limit - 1) // limit
    }

@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get meeting by ID with minutes and actions loaded"""
    query = MeetingQuery.get_with_audit_info().where(
        Meeting.id == meeting_id, 
        Meeting.is_active == True
    )
    
    result = await db.execute(query)
    meeting_obj = result.scalar_one_or_none()
    
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    return meeting_obj

# ==================== UPDATE MEETING ====================
@router.put("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: UUID,
    meeting_in: MeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update meeting with audit fields (updated_by_id, updated_at)"""
    print("Full incoming payload:", meeting_in.model_dump(exclude_unset=True))
    
    db_obj = await meeting.get(db, meeting_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Meeting not found")

    old_status_id = db_obj.status_id
    update_data = meeting_in.model_dump(exclude_unset=True)

    status_comment = update_data.pop("status_comment", None)
    status_date_raw = update_data.pop("status_date", None)
    new_status_id = update_data.get("status_id")

    # Update regular fields
    for field, value in update_data.items():
        if hasattr(db_obj, field) and value is not None:
            setattr(db_obj, field, value)

    # Update audit fields
    db_obj.updated_by_id = current_user.id
    db_obj.updated_at = datetime.now()

    # Handle status change with history
    if new_status_id and str(new_status_id) != str(old_status_id):
        if isinstance(status_date_raw, str):
            try:
                status_date = datetime.fromisoformat(status_date_raw.replace('Z', '+00:00'))
            except ValueError:
                status_date = datetime.now()
        else:
            status_date = status_date_raw or datetime.now()

        history_entry = MeetingStatusHistory(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            status_id=new_status_id,
            comment=status_comment or "Status updated via PUT",
            status_date=status_date,
            created_by_id=current_user.id,  # Use created_by for history
            created_at=datetime.now(),
            is_active=True
        )
        db.add(history_entry)

    await db.commit()
    await db.refresh(db_obj)
    
    # Reload with all relationships
    updated = await meeting.get_meeting_with_details(db, meeting_id)
    return build_meeting_response(updated)


# ==================== UPDATE MEETING STATUS ====================
@router.patch("/{meeting_id}/status", response_model=MeetingResponse)
async def update_meeting_status(
    meeting_id: UUID,
    status_value: str = Query(..., alias="status"),
    comment: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update meeting status with audit trail"""
    status_info = await get_status_by_short_name(db, status_value)
    if not status_info:
        valid = await get_valid_status_short_names(db)
        raise HTTPException(400, f"Invalid status. Use: {', '.join(valid)}")
    
    new_status_id = UUID(status_info["id"])
    db_obj = await meeting.get(db, meeting_id)
    
    if not db_obj:
        raise HTTPException(404, f"Meeting {meeting_id} not found")
    
    old_status_id = db_obj.status_id
    
    if str(new_status_id) != str(old_status_id):
        # Update meeting audit fields
        db_obj.status_id = new_status_id
        db_obj.updated_by_id = current_user.id
        db_obj.updated_at = datetime.now()
        
        # Create history entry
        history = MeetingStatusHistory(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            status_id=new_status_id,
            comment=comment or f"Status changed to {status_value}",
            status_date=datetime.now(),
            created_by_id=current_user.id,  # Track who made the change
            created_at=datetime.now(),
            is_active=True
        )
        db.add(history)
        await db.commit()
        await db.refresh(db_obj)
    else:
        await db.commit()
    
    # Reload with all relationships
    result = await meeting.get_meeting_with_details(db, meeting_id)
    return build_meeting_response(result)


@router.put("/{meeting_id}/status", response_model=MeetingResponse)
async def update_meeting_status_put(
    meeting_id: UUID,
    status_value: str = Query(..., alias="status"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update meeting status via PUT with audit trail"""
    return await update_meeting_status(meeting_id, status_value, None, db, current_user)


# ==================== ADD MINUTES TO MEETING ====================
@router.post("/{meeting_id}/minutes", response_model=MeetingMinutesResponse, status_code=status.HTTP_201_CREATED)
async def add_meeting_minutes(
    meeting_id: UUID,
    minutes_in: MeetingMinutesCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Add minutes to meeting with audit fields"""
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Create minutes with audit fields
    minutes = await meeting.add_minutes(db, meeting_id, minutes_in, current_user.id)
    
    # Reload with actions to ensure complete response
    query = select(MeetingMinutes).options(
        selectinload(MeetingMinutes.actions),
        selectinload(MeetingMinutes.created_by),
        selectinload(MeetingMinutes.updated_by)
    ).where(MeetingMinutes.id == minutes.id)
    
    result = await db.execute(query)
    return result.scalar_one()


# ==================== GET MEETING MINUTES ====================
@router.get("/{meeting_id}/minutes", response_model=List[MeetingMinutesResponse])
async def get_meeting_minutes(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get all minutes for a meeting with audit info"""
    minutes_list = await meeting_minutes.get_meeting_minutes(db, meeting_id, skip, limit)
    
    # Enhance with creator names
    for minute in minutes_list:
        if minute.created_by:
            minute.created_by_name = minute.created_by.username
        if minute.updated_by:
            minute.updated_by_name = minute.updated_by.username
        if minute.recorded_by:
            minute.recorded_by_name = minute.recorded_by.username
    
    return minutes_list


# ==================== DELETE MEETING ====================
@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete meeting (set is_active=False) with audit"""
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Soft delete instead of hard delete
    meeting_obj.is_active = False
    meeting_obj.updated_by_id = current_user.id
    meeting_obj.updated_at = datetime.now()
    
    await db.commit()


# ==================== MEETING STATUS HISTORY ====================
@router.get("/{meeting_id}/history", response_model=List[MeetingStatusHistoryResponse])
async def get_meeting_status_history(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get status change history for a meeting with audit info"""
    # Check if meeting exists
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Query status history with eager loading
    query = (
        select(MeetingStatusHistory)
        .where(MeetingStatusHistory.meeting_id == meeting_id, MeetingStatusHistory.is_active == True)
        .options(
            selectinload(MeetingStatusHistory.status),
            selectinload(MeetingStatusHistory.created_by),
            selectinload(MeetingStatusHistory.updated_by)
        )
        .order_by(desc(MeetingStatusHistory.status_date))
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    history_list = result.scalars().all()
    
    # Transform to response with audit info
    response = []
    for history in history_list:
        response.append(MeetingStatusHistoryResponse(
            id=history.id,
            meeting_id=history.meeting_id,
            status_id=history.status_id,
            status_name=history.status.name if history.status else None,
            status_code=history.status.code if history.status else None,
            status_shortname=history.status.short_name if history.status else None,
            comment=history.comment,
            status_date=history.status_date,
            created_by_id=history.created_by_id,
            created_by_name=history.created_by.username if history.created_by else None,
            created_at=history.created_at,
            updated_by_id=history.updated_by_id,
            updated_by_name=history.updated_by.username if history.updated_by else None,
            updated_at=history.updated_at,
            is_active=history.is_active
        ))
    
    return response


@router.get("/{meeting_id}/history/latest", response_model=Optional[MeetingStatusHistoryResponse])
async def get_latest_meeting_status_history(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get the latest status change for a meeting"""
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    query = (
        select(MeetingStatusHistory)
        .where(MeetingStatusHistory.meeting_id == meeting_id, MeetingStatusHistory.is_active == True)
        .options(
            selectinload(MeetingStatusHistory.status),
            selectinload(MeetingStatusHistory.created_by),
            selectinload(MeetingStatusHistory.updated_by)
        )
        .order_by(desc(MeetingStatusHistory.status_date))
        .limit(1)
    )
    
    result = await db.execute(query)
    history = result.scalar_one_or_none()
    
    if not history:
        return None
    
    return MeetingStatusHistoryResponse(
        id=history.id,
        meeting_id=history.meeting_id,
        status_id=history.status_id,
        status_name=history.status.name if history.status else None,
        status_code=history.status.code if history.status else None,
        status_shortname=history.status.short_name if history.status else None,
        comment=history.comment,
        status_date=history.status_date,
        created_by_id=history.created_by_id,
        created_by_name=history.created_by.username if history.created_by else None,
        created_at=history.created_at,
        updated_by_id=history.updated_by_id,
        updated_by_name=history.updated_by.username if history.updated_by else None,
        updated_at=history.updated_at,
        is_active=history.is_active
    )



@router.get("/{meeting_id}/participants", response_model=List[MeetingParticipantResponse])
async def get_meeting_participants(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all participants for a meeting"""
    # Check if meeting exists
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    return await meeting_participant.get_meeting_participants(db, meeting_id)


@router.patch("/{meeting_id}/participants/{participant_id}", response_model=MeetingParticipantResponse)
async def update_participant_attendance(
    meeting_id: UUID,
    participant_id: UUID,
    attendance_update: MeetingParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update participant attendance status"""
    # Check if meeting exists
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Update attendance
    participant = await meeting_participant.update_attendance(
        db, participant_id, attendance_update.attendance_status, current_user.id
    )
    
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    
    return participant