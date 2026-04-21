# app/api/v1/endpoints/action_tracker/meetings.py
import csv
from io import StringIO
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID
from venv import logger

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, distinct, func, select, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.util import defaultdict

from app.api import deps
from app.core.security import get_current_user
from app.crud.action_tracker import meeting_crud, meeting_action, meeting_minutes, meeting_participant

from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.general.dynamic_attribute import Attribute
from app.models.user import User
from app.models.action_tracker import Meeting, MeetingAction, MeetingDocument, MeetingParticipant, MeetingQuery, MeetingStatus, MeetingStatusHistory, MeetingMinutes
from app.schemas.action_tracker import (
    MeetingCreateResponse,  MeetingMinutesResponse, MeetingPaginationResponse, MeetingCreate, MeetingParticipantResponse, MeetingParticipantUpdate, 
    MeetingStatusHistoryResponse, MeetingUpdate, MeetingResponse, MeetingListResponse, NotificationRequest, ZoomMeetingCreate
)
from app.schemas.meeting_minutes.meeting_minutes import (
    MeetingActionCreate,
    MeetingActionResponse,
    MeetingMinutesCreate,
    MeetingMinutesResponse,
    MeetingMinutesUpdate
)

from .status_utils import get_status_id_by_short_name, get_status_by_short_name, get_valid_status_short_names
from .utils import build_meeting_response
from app.services.email_service import EmailService, email_service


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
        
        result = await meeting_crud.create_with_participants(db, meeting_in, current_user.id)
        
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
    
    db_obj = await meeting_crud.get(db, meeting_id)
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
    updated = await meeting_crud.get_meeting_with_details(db, meeting_id)
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
    db_obj = await meeting_crud.get(db, meeting_id)
    
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
    result = await meeting_crud.get_meeting_with_details(db, meeting_id)
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
    meeting_obj = await meeting_crud.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Create minutes with audit fields
    minutes = await meeting_crud.add_minutes(db, meeting_id, minutes_in, current_user.id)
    
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
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all minutes for a meeting"""
    
    # Check if meeting exists
    meeting = await meeting_crud.get(db, id=meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Get minutes using the CRUD method
    minutes_list = await meeting_minutes.get_meeting_minutes(
        db=db,
        meeting_id=meeting_id,
        skip=skip,
        limit=limit
    )
    
    # Create response objects - don't modify the original models
    response_data = []
    for minute in minutes_list:
        response_data.append({
            "id": minute.id,
            "meeting_id": minute.meeting_id,
            "topic": minute.topic,
            "discussion": minute.discussion,
            "decisions": minute.decisions,
            "timestamp": minute.timestamp,
            "recorded_by_id": minute.recorded_by_id,
            "recorded_by_name": minute.recorded_by.username if minute.recorded_by else None,
            "created_by_id": minute.created_by_id,
            "created_by_name": minute.created_by.username if minute.created_by else None,
            "created_at": minute.created_at,
            "updated_by_id": minute.updated_by_id,
            "updated_by_name": minute.updated_by.username if minute.updated_by else None,
            "updated_at": minute.updated_at,
            "is_active": minute.is_active,
            "actions": minute.actions if hasattr(minute, 'actions') else []
        })
    
    return response_data
# ==================== DELETE MEETING ====================
@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete meeting (set is_active=False) with audit"""
    meeting_obj = await meeting_crud.get(db, meeting_id)
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
    meeting_obj = await meeting_crud.get(db, meeting_id)
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
    meeting_obj = await meeting_crud.get(db, meeting_id)
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
    meeting_obj = await meeting_crud.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    return await meeting_participant.get_by_meeting(db, meeting_id)


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
    meeting_obj = await meeting_crud.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Update attendance
    participant = await meeting_participant.update_attendance(
        db, participant_id, attendance_update.attendance_status, current_user.id
    )
    
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    
    return participant

@router.post("/{meeting_id}/notify-participants")
async def notify_meeting_participants(
    meeting_id: str,
    notification_data: NotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send notifications to meeting participants from meeting_participants table
    """
    logger.debug("=" * 80)
    logger.debug("NOTIFY PARTICIPANTS ENDPOINT CALLED")
    logger.debug(f"Time: {datetime.now()}")
    logger.debug(f"Meeting ID: {meeting_id}")
    logger.debug(f"Current User: {current_user.email if current_user else 'None'}")
    logger.debug(f"Notification Data: {notification_data}")
    logger.debug(f"Participant IDs: {notification_data.participant_ids}")
    logger.debug(f"Notification Types: {notification_data.notification_type}")
    logger.debug(f"Custom Message: {notification_data.custom_message}")
    logger.debug("=" * 80)

    try:
        # Get meeting details
        meeting = await db.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = meeting.scalar_one_or_none()
        
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        # Get participants from meeting_participants table (NOT users table)
        participants = await db.execute(
            select(MeetingParticipant)
            .where(
                MeetingParticipant.id.in_(notification_data.participant_ids),
                MeetingParticipant.meeting_id == meeting_id,
                MeetingParticipant.is_active == True
            )
        )
        participants = participants.scalars().all()
        
        if not participants:
            raise HTTPException(status_code=404, detail="No participants found")
        
        sent_count = 0
        failed_count = 0
        results = []
        
        # Send notifications based on type
        for participant in participants:
            for notif_type in notification_data.notification_type:
                try:
                    if notif_type == 'email':
                        if participant.email:
                            await send_email_notification(
                                to_email=participant.email,
                                meeting=meeting,
                                custom_message=notification_data.custom_message,
                                participant_name=participant.name,
                            )
                            sent_count += 1
                            results.append({
                                "participant": participant.name,
                                "type": "email",
                                "status": "sent",
                                "contact": participant.email
                            })
                        else:
                            failed_count += 1
                            results.append({
                                "participant": participant.name,
                                "type": "email",
                                "status": "failed",
                                "reason": "No email address"
                            })
                            
                    elif notif_type == 'whatsapp':
                        if participant.telephone:
                            await send_whatsapp_notification(
                                phone=participant.telephone,
                                meeting=meeting,
                                participant_name=participant.name,
                                custom_message=notification_data.custom_message
                            )
                            sent_count += 1
                            results.append({
                                "participant": participant.name,
                                "type": "whatsapp",
                                "status": "sent",
                                "contact": participant.telephone
                            })
                        else:
                            failed_count += 1
                            results.append({
                                "participant": participant.name,
                                "type": "whatsapp",
                                "status": "failed",
                                "reason": "No phone number"
                            })
                            
                    elif notif_type == 'sms':
                        if participant.telephone:
                            await send_sms_notification(
                                phone=participant.telephone,
                                meeting=meeting,
                                participant_name=participant.name,
                                custom_message=notification_data.custom_message
                            )
                            sent_count += 1
                            results.append({
                                "participant": participant.name,
                                "type": "sms",
                                "status": "sent",
                                "contact": participant.telephone
                            })
                        else:
                            failed_count += 1
                            results.append({
                                "participant": participant.name,
                                "type": "sms",
                                "status": "failed",
                                "reason": "No phone number"
                            })
                            
                except Exception as e:
                    failed_count += 1
                    results.append({
                        "participant": participant.name,
                        "type": notif_type,
                        "status": "failed",
                        "reason": str(e)
                    })
                    logger.error(f"Failed to send {notif_type} to {participant.name}: {e}")
        
        return {
            "success": True,
            "sent": sent_count,
            "failed": failed_count,
            "total": len(participants) * len(notification_data.notification_type),
            "results": results,
            "meeting_title": meeting.title,
            "notification_types": notification_data.notification_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in notify_meeting_participants: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{meeting_id}/participants/{participant_id}/apology")
async def send_apology(
    meeting_id: UUID,
    participant_id: UUID,
    apology_data: dict,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Send apology email to a participant marked as absent
    """
    try:
        # Get meeting details
        meeting = await db.execute(
            select(Meeting).where(Meeting.id == meeting_id, Meeting.is_active == True)
        )
        meeting = meeting.scalar_one_or_none()
        
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        # Get participant details
        participant = await db.execute(
            select(MeetingParticipant).where(
                MeetingParticipant.id == participant_id,
                MeetingParticipant.meeting_id == meeting_id,
                MeetingParticipant.is_active == True
            )
        )
        participant = participant.scalar_one_or_none()
        
        if not participant:
            raise HTTPException(status_code=404, detail="Participant not found")
        
        message = apology_data.get("message", "")
        
        # Send apology email
        from app.services.email_service import email_service
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Apology for Missed Meeting</title>
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ padding: 20px; background: #f9fafb; }}
                .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Apology for Missed Meeting</h2>
            </div>
            <div class="content">
                <p>Dear <strong>{participant.name}</strong>,</p>
                <p>We apologize that you were marked as absent for the meeting:</p>
                <h3>{meeting.title}</h3>
                <p><strong>Date:</strong> {meeting.meeting_date}</p>
                <p><strong>Time:</strong> {meeting.start_time}</p>
                
                {f"<p><strong>Message from organizer:</strong></p><p>{message}</p>" if message else ""}
                
                <p>If you have any concerns, please contact the meeting organizer.</p>
                <p>We hope to see you at future meetings.</p>
            </div>
            <div class="footer">
                <p>&copy; {datetime.now().year} Action Tracker. All rights reserved.</p>
            </div>
        </body>
        </html>
        """
        
        success = email_service.send_email(
            to_email=participant.email,
            subject=f"Apology for Missed Meeting: {meeting.title}",
            html_content=html_content
        )
        
        return {
            "success": success,
            "message": "Apology sent successfully" if success else "Failed to send apology",
            "participant_id": str(participant_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send apology: {str(e)}"
        )

async def send_email_notification(to_email: str, meeting, custom_message: str = "", participant_name: str = ""):
    """Send email notification using existing email service"""
    
    try:
        # Format meeting time
        meeting_time = f"{meeting.start_time} - {meeting.end_time}" if meeting.start_time else "Time TBD"
        
        # Format meeting date
        meeting_date = ""
        if hasattr(meeting, 'meeting_date') and meeting.meeting_date:
            if hasattr(meeting.meeting_date, 'strftime'):
                meeting_date = meeting.meeting_date.strftime("%A, %B %d, %Y")
            else:
                meeting_date = str(meeting.meeting_date)
        else:
            meeting_date = "Date TBD"
        
        # Get location information
        location_text = ""
        location_icon = "📍"
        is_online = False
        meeting_link = ""
        platform_name = ""
        
        # Check for online meeting platform
        if hasattr(meeting, 'platform') and meeting.platform and meeting.platform != 'physical':
            is_online = True
            if meeting.platform == 'zoom':
                platform_name = 'Zoom'
                location_icon = "🎥"
            elif meeting.platform == 'google_meet':
                platform_name = 'Google Meet'
                location_icon = "🎥"
            elif meeting.platform == 'microsoft_teams':
                platform_name = 'Microsoft Teams'
                location_icon = "🎥"
            else:
                platform_name = meeting.platform.capitalize()
                location_icon = "💻"
            
            # Get meeting link
            if hasattr(meeting, 'meeting_link') and meeting.meeting_link:
                meeting_link = meeting.meeting_link
                location_text = f"{platform_name} Meeting"
        else:
            # Physical meeting location
            if hasattr(meeting, 'location') and meeting.location:
                location_text = meeting.location
            elif hasattr(meeting, 'location_text') and meeting.location_text:
                location_text = meeting.location_text
            else:
                location_text = "Location TBD"
        
        # Get facilitator if available
        facilitator = ""
        if hasattr(meeting, 'facilitator') and meeting.facilitator:
            facilitator = meeting.facilitator
        
        # Get chairperson if available
        chairperson = ""
        if hasattr(meeting, 'chairperson_name') and meeting.chairperson_name:
            chairperson = meeting.chairperson_name
        
        # Create HTML email content (only HTML, no text_content needed)
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Meeting Notification</title>
            <style>
                body {{
                    font-family: 'Segoe UI', Arial, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                }}
                .container {{
                    background-color: #ffffff;
                    border-radius: 10px;
                    padding: 30px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 10px 10px 0 0;
                    margin: -30px -30px 20px -30px;
                    text-align: center;
                }}
                .header h2 {{
                    margin: 0;
                    color: white;
                }}
                .info-box {{
                    background-color: #f4f4f4;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #667eea;
                }}
                .info-item {{
                    margin: 12px 0;
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                }}
                .info-icon {{
                    font-size: 20px;
                    min-width: 30px;
                }}
                .info-content {{
                    flex: 1;
                }}
                .info-label {{
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 4px;
                }}
                .info-value {{
                    color: #666;
                }}
                .meeting-link {{
                    display: inline-block;
                    background-color: #667eea;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 15px 0;
                    font-weight: bold;
                }}
                .meeting-link:hover {{
                    background-color: #5a67d8;
                }}
                .custom-message {{
                    background-color: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                }}
                .footer {{
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #999;
                    text-align: center;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>📋 Meeting Invitation</h2>
                </div>
                
                <p>Dear <strong>{participant_name or 'Participant'}</strong>,</p>
                
                <p>You have been invited to the following meeting:</p>
                
                <div class="info-box">
                    <div class="info-item">
                        <div class="info-icon">📅</div>
                        <div class="info-content">
                            <div class="info-label">Meeting Title</div>
                            <div class="info-value"><strong>{meeting.title}</strong></div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-icon">⏰</div>
                        <div class="info-content">
                            <div class="info-label">Date & Time</div>
                            <div class="info-value">{meeting_date} at {meeting_time}</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-icon">{location_icon}</div>
                        <div class="info-content">
                            <div class="info-label">{'Online Meeting' if is_online else 'Location'}</div>
                            <div class="info-value">{location_text}</div>
                            {f'<div style="margin-top: 8px;"><a href="{meeting_link}" class="meeting-link" target="_blank">🔗 Join Meeting</a></div>' if meeting_link else ''}
                        </div>
                    </div>
                    
                    {f'''
                    <div class="info-item">
                        <div class="info-icon">👤</div>
                        <div class="info-content">
                            <div class="info-label">Facilitator</div>
                            <div class="info-value">{facilitator}</div>
                        </div>
                    </div>
                    ''' if facilitator else ''}
                    
                    {f'''
                    <div class="info-item">
                        <div class="info-icon">👥</div>
                        <div class="info-content">
                            <div class="info-label">Chairperson</div>
                            <div class="info-value">{chairperson}</div>
                        </div>
                    </div>
                    ''' if chairperson else ''}
                </div>
                
                {f'''
                <div class="custom-message">
                    <strong>📝 Additional Information:</strong>
                    <p style="margin: 10px 0 0 0;">{custom_message}</p>
                </div>
                ''' if custom_message else ''}
                
                <p>Please join on time and come prepared.</p>
                
                <div class="footer">
                    <p>This is an automated notification from the Meeting Management System.</p>
                    <p>If you have any questions, please contact the meeting organizer.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Use the email service to send
        if email_service._is_configured():
            # Call the correct method: send_email (synchronous wrapper)
            # Note: send_email is synchronous, so we don't need to await it
            success = email_service.send_email(
                to_email=to_email,
                subject=f"📅 Meeting Invitation: {meeting.title}",
                html_content=html_content
            )
            
            if success:
                logger.info(f"✅ Email sent to {to_email}")
            else:
                logger.warning(f"⚠️ Failed to send email to {to_email}")
            
            return success
        else:
            # Fallback to print if email not configured
            print(f"📧 [EMAIL NOT CONFIGURED] Would send to {to_email}: Meeting {meeting.title}")
            print(f"   Location: {location_text}")
            if meeting_link:
                print(f"   Meeting Link: {meeting_link}")
            logger.warning(f"Email service not configured, skipping email to {to_email}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error sending email to {to_email}: {e}")
        import traceback
        traceback.print_exc()
        return False

async def send_whatsapp_notification(phone: str, meeting, custom_message: str = "", participant_name: str = ""):
    """Send WhatsApp notification"""
    print(f"Sending WhatsApp to {phone} for meeting {meeting.title}")
    # Implement WhatsApp API integration
    pass

async def send_sms_notification(phone: str, meeting, custom_message: str = "", participant_name: str = ""):
    """Send SMS notification"""
    print(f"Sending SMS to {phone} for meeting {meeting.title}")
    # Implement SMS service integration (Twilio, etc.)
    pass

@router.post("/create-zoom-meeting")
async def create_zoom_meeting(
    meeting_data: ZoomMeetingCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a Zoom meeting using Zoom API"""
    
    # Implement Zoom API integration
    # You'll need Zoom API credentials
    zoom_client = ZoomClient()
    meeting = await zoom_client.create_meeting(
        topic=meeting_data.topic,
        start_time=meeting_data.start_time,
        duration=meeting_data.duration
    )
    
    return {
        "join_url": meeting.join_url,
        "id": meeting.id,
        "password": meeting.password
    }



# Helper function to create audit log entries
async def create_audit_log(
    db: AsyncSession,
    meeting_id: str,
    user_id: Optional[str],
    user_name: Optional[str],
    user_email: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    description: Optional[str] = None,
    changes: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Helper function to create an audit log entry"""
    
    audit_log = AuditLog(
        meeting_id=meeting_id,
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        changes=changes,
        ip_address=ip_address,
        user_agent=user_agent,
        timestamp=datetime.utcnow()
    )
    
    db.add(audit_log)
    await db.commit()
    
    return audit_log


async def extract_meeting_id_from_related_table(
    db: AsyncSession,
    table_name: str,
    record_id: str
) -> Optional[str]:
    """
    Extract meeting_id from related table records
    """
    try:
        if table_name == "meeting_minutes":
            result = await db.execute(
                select(MeetingMinutes.meeting_id).where(MeetingMinutes.id == record_id)
            )
            meeting_id = result.scalar_one_or_none()
            return str(meeting_id) if meeting_id else None
            
        elif table_name == "meeting_actions":
            # Get minute_id first, then meeting_id
            result = await db.execute(
                select(MeetingAction.minute_id).where(MeetingAction.id == record_id)
            )
            minute_id = result.scalar_one_or_none()
            if minute_id:
                result = await db.execute(
                    select(MeetingMinutes.meeting_id).where(MeetingMinutes.id == minute_id)
                )
                meeting_id = result.scalar_one_or_none()
                return str(meeting_id) if meeting_id else None
                
        elif table_name == "meeting_documents":
            result = await db.execute(
                select(MeetingDocument.meeting_id).where(MeetingDocument.id == record_id)
            )
            meeting_id = result.scalar_one_or_none()
            return str(meeting_id) if meeting_id else None
            
        elif table_name == "meeting_participants":
            result = await db.execute(
                select(MeetingParticipant.meeting_id).where(MeetingParticipant.id == record_id)
            )
            meeting_id = result.scalar_one_or_none()
            return str(meeting_id) if meeting_id else None
            
        elif table_name == "meetings":
            return str(record_id)
            
    except Exception as e:
        print(f"Error extracting meeting_id from {table_name}: {e}")
    
    return None


# Helper function to get all audit logs for a meeting across related tables
async def get_all_audit_logs_for_meeting(
    db: AsyncSession,
    meeting_id: str,
    skip: int = 0,
    limit: int = 100,
    action_filter: Optional[str] = None,
    user_filter: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[AuditLog]:
    """
    Get all audit logs related to a meeting, including logs from related tables
    """
    # First, get logs directly from meetings table
    conditions = [AuditLog.record_id == meeting_id, AuditLog.table_name == "meetings"]
    
    # Get logs from related tables
    related_tables = ["meeting_minutes", "meeting_actions", "meeting_documents", "meeting_participants"]
    
    # For each related table, we need to find logs where the record belongs to this meeting
    # We'll do this by getting all record IDs from related tables that belong to this meeting
    for table_name in related_tables:
        # Get all record IDs from the related table that belong to this meeting
        if table_name == "meeting_minutes":
            result = await db.execute(
                select(MeetingMinutes.id).where(MeetingMinutes.meeting_id == meeting_id)
            )
            record_ids = [str(r) for r in result.scalars().all()]
        elif table_name == "meeting_actions":
            # Get actions through minutes
            result = await db.execute(
                select(MeetingAction.id)
                .join(MeetingMinutes, MeetingAction.minute_id == MeetingMinutes.id)
                .where(MeetingMinutes.meeting_id == meeting_id)
            )
            record_ids = [str(r) for r in result.scalars().all()]
        elif table_name == "meeting_documents":
            result = await db.execute(
                select(MeetingDocument.id).where(MeetingDocument.meeting_id == meeting_id)
            )
            record_ids = [str(r) for r in result.scalars().all()]
        elif table_name == "meeting_participants":
            result = await db.execute(
                select(MeetingParticipant.id).where(MeetingParticipant.meeting_id == meeting_id)
            )
            record_ids = [str(r) for r in result.scalars().all()]
        else:
            record_ids = []
        
        if record_ids:
            conditions.append(
                and_(
                    AuditLog.record_id.in_(record_ids),
                    AuditLog.table_name == table_name
                )
            )
    
    # Build the query with OR conditions
    query = select(AuditLog).where(or_(*conditions))
    
    # Apply filters
    if action_filter and action_filter != "all":
        query = query.where(AuditLog.action == action_filter)
    
    if user_filter and user_filter != "all":
        query = query.where(AuditLog.user_id == user_filter)
    
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
    
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)
    
    # Order by timestamp descending
    query = query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_audit_logs_count_for_meeting(
    db: AsyncSession,
    meeting_id: str,
    action_filter: Optional[str] = None,
    user_filter: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> int:
    """
    Get count of audit logs for a meeting
    """
    conditions = [AuditLog.record_id == meeting_id, AuditLog.table_name == "meetings"]
    
    related_tables = ["meeting_minutes", "meeting_actions", "meeting_documents", "meeting_participants"]
    
    for table_name in related_tables:
        if table_name == "meeting_minutes":
            result = await db.execute(
                select(MeetingMinutes.id).where(MeetingMinutes.meeting_id == meeting_id)
            )
            record_ids = [str(r) for r in result.scalars().all()]
        elif table_name == "meeting_actions":
            result = await db.execute(
                select(MeetingAction.id)
                .join(MeetingMinutes, MeetingAction.minute_id == MeetingMinutes.id)
                .where(MeetingMinutes.meeting_id == meeting_id)
            )
            record_ids = [str(r) for r in result.scalars().all()]
        elif table_name == "meeting_documents":
            result = await db.execute(
                select(MeetingDocument.id).where(MeetingDocument.meeting_id == meeting_id)
            )
            record_ids = [str(r) for r in result.scalars().all()]
        elif table_name == "meeting_participants":
            result = await db.execute(
                select(MeetingParticipant.id).where(MeetingParticipant.meeting_id == meeting_id)
            )
            record_ids = [str(r) for r in result.scalars().all()]
        else:
            record_ids = []
        
        if record_ids:
            conditions.append(
                and_(
                    AuditLog.record_id.in_(record_ids),
                    AuditLog.table_name == table_name
                )
            )
    
    query = select(func.count()).select_from(AuditLog).where(or_(*conditions))
    
    if action_filter and action_filter != "all":
        query = query.where(AuditLog.action == action_filter)
    
    if user_filter and user_filter != "all":
        query = query.where(AuditLog.user_id == user_filter)
    
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
    
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)
    
    result = await db.execute(query)
    return result.scalar() or 0


@router.get("/{meeting_id}/audit-logs")
async def get_meeting_audit_logs(
    meeting_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    action: Optional[str] = Query(None, description="Filter by action type"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Get audit logs for a specific meeting, including logs from related tables
    (meeting_minutes, meeting_actions, meeting_documents, meeting_participants)
    """
    # Verify meeting exists and user has access
    meeting = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id)
    )
    meeting = meeting.scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Get audit logs
    logs = await get_all_audit_logs_for_meeting(
        db=db,
        meeting_id=meeting_id,
        skip=skip,
        limit=limit,
        action_filter=action,
        user_filter=user_id,
        start_date=start_date,
        end_date=end_date
    )
    
    total = await get_audit_logs_count_for_meeting(
        db=db,
        meeting_id=meeting_id,
        action_filter=action,
        user_filter=user_id,
        start_date=start_date,
        end_date=end_date
    )
    
    # Enhance logs with additional information
    enhanced_logs = []
    for log in logs:
        log_dict = {
            "id": str(log.id),
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "action": log.action,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "user_id": str(log.user_id) if log.user_id else None,
            "username": log.username,
            "user_email": log.user_email,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "changes_summary": log.changes_summary,
            "ip_address": log.ip_address,
            "endpoint": log.endpoint,
            "status": log.status,
            "error_message": log.error_message,
            "extra_data": log.extra_data,
        }
        
        # Add context about the related record
        if log.table_name != "meetings":
            if log.table_name == "meeting_minutes":
                # Get minute topic
                result = await db.execute(
                    select(MeetingMinutes.topic).where(MeetingMinutes.id == log.record_id)
                )
                topic = result.scalar_one_or_none()
                log_dict["context"] = f"Minutes: {topic}" if topic else "Meeting Minutes"
                
            elif log.table_name == "meeting_actions":
                # Get action description
                result = await db.execute(
                    select(MeetingAction.description).where(MeetingAction.id == log.record_id)
                )
                description = result.scalar_one_or_none()
                log_dict["context"] = f"Action: {description[:100]}" if description else "Meeting Action"
                
            elif log.table_name == "meeting_documents":
                # Get document name
                result = await db.execute(
                    select(MeetingDocument.file_name).where(MeetingDocument.id == log.record_id)
                )
                file_name = result.scalar_one_or_none()
                log_dict["context"] = f"Document: {file_name}" if file_name else "Meeting Document"
                
            elif log.table_name == "meeting_participants":
                # Get participant name
                result = await db.execute(
                    select(MeetingParticipant.name).where(MeetingParticipant.id == log.record_id)
                )
                participant_name = result.scalar_one_or_none()
                log_dict["context"] = f"Participant: {participant_name}" if participant_name else "Meeting Participant"
        
        enhanced_logs.append(log_dict)
    
    return {
        "items": enhanced_logs,
        "total": total,
        "skip": skip,
        "limit": limit,
        "meeting_id": meeting_id,
        "meeting_title": meeting.title
    }


@router.get("/{meeting_id}/audit-logs/filters")
async def get_audit_log_filters(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Get available filter options for audit logs"""
    
    # Get all audit logs for this meeting
    logs = await get_all_audit_logs_for_meeting(
        db=db,
        meeting_id=meeting_id,
        skip=0,
        limit=1000  # Get enough logs to build filters
    )
    
    # Extract unique actions
    actions = set()
    for log in logs:
        if log.action:
            actions.add(log.action)
    
    # Extract unique users
    users_dict = {}
    for log in logs:
        if log.user_id and log.user_id not in users_dict:
            users_dict[str(log.user_id)] = {
                "id": str(log.user_id),
                "name": log.username or "",
                "email": log.user_email or ""
            }
    
    # Get table types
    table_types = set()
    for log in logs:
        if log.table_name:
            table_types.add(log.table_name)
    
    # Get date range
    timestamps = [log.timestamp for log in logs if log.timestamp]
    min_date = min(timestamps) if timestamps else None
    max_date = max(timestamps) if timestamps else None
    
    return {
        "actions": sorted(list(actions)),
        "users": list(users_dict.values()),
        "table_types": sorted(list(table_types)),
        "date_range": {
            "min": min_date.isoformat() if min_date else None,
            "max": max_date.isoformat() if max_date else None
        }
    }


@router.get("/{meeting_id}/audit-logs/export")
async def export_audit_logs(
    meeting_id: str,
    format: str = Query("csv", regex="^(csv|json)$"),
    action: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Export audit logs to CSV or JSON format
    """
    # Get all logs without pagination for export
    logs = await get_all_audit_logs_for_meeting(
        db=db,
        meeting_id=meeting_id,
        skip=0,
        limit=10000,  # Large limit for export
        action_filter=action,
        user_filter=user_id,
        start_date=start_date,
        end_date=end_date
    )
    
    if format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow([
            'Timestamp', 'Action', 'Table Name', 'Record ID', 
            'User Name', 'User Email', 'Changes Summary', 
            'IP Address', 'Endpoint', 'Status', 'Error Message'
        ])
        
        # Write data rows
        for log in logs:
            writer.writerow([
                log.timestamp.isoformat() if log.timestamp else '',
                log.action or '',
                log.table_name or '',
                log.record_id or '',
                log.username or '',
                log.user_email or '',
                log.changes_summary or '',
                log.ip_address or '',
                log.endpoint or '',
                log.status or '',
                log.error_message or ''
            ])
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=meeting_{meeting_id}_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    
    else:  # JSON format
        export_data = []
        for log in logs:
            export_data.append({
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "action": log.action,
                "table_name": log.table_name,
                "record_id": log.record_id,
                "user_name": log.username,
                "user_email": log.user_email,
                "changes_summary": log.changes_summary,
                "old_values": log.old_values,
                "new_values": log.new_values,
                "ip_address": log.ip_address,
                "endpoint": log.endpoint,
                "status": log.status,
                "error_message": log.error_message,
                "extra_data": log.extra_data
            })
        
        return {
            "meeting_id": meeting_id,
            "export_date": datetime.now().isoformat(),
            "total_records": len(export_data),
            "data": export_data
        }


@router.get("/{meeting_id}/audit-logs/statistics")
async def get_audit_log_statistics(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Get statistics about audit logs for a meeting
    """
    logs = await get_all_audit_logs_for_meeting(
        db=db,
        meeting_id=meeting_id,
        skip=0,
        limit=10000
    )
    
    # Calculate statistics
    stats = {
        "total_events": len(logs),
        "by_action": defaultdict(int),
        "by_table": defaultdict(int),
        "by_user": defaultdict(int),
        "by_date": defaultdict(int),
        "success_rate": 0,
        "top_users": [],
        "recent_activity": []
    }
    
    success_count = 0
    
    for log in logs:
        # Count by action
        if log.action:
            stats["by_action"][log.action] += 1
        
        # Count by table
        if log.table_name:
            stats["by_table"][log.table_name] += 1
        
        # Count by user
        if log.username:
            stats["by_user"][log.username] += 1
        
        # Count by date
        if log.timestamp:
            date_key = log.timestamp.strftime("%Y-%m-%d")
            stats["by_date"][date_key] += 1
        
        # Count successes
        if log.status and log.status.upper() == "SUCCESS":
            success_count += 1
    
    # Calculate success rate
    if stats["total_events"] > 0:
        stats["success_rate"] = round((success_count / stats["total_events"]) * 100, 2)
    
    # Get top users
    stats["top_users"] = sorted(
        [{"user": user, "count": count} for user, count in stats["by_user"].items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]
    
    # Get recent activity (last 7 days)
    seven_days_ago = datetime.now() - timedelta(days=7)
    stats["recent_activity"] = [
        {"date": date, "count": count}
        for date, count in sorted(stats["by_date"].items())[-7:]
    ]
    
    # Convert defaultdicts to regular dicts for JSON serialization
    stats["by_action"] = dict(stats["by_action"])
    stats["by_table"] = dict(stats["by_table"])
    stats["by_user"] = dict(stats["by_user"])
    stats["by_date"] = dict(stats["by_date"])
    
    return stats