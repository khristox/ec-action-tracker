# app/api/v1/endpoints/action_tracker.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, inspect, select, or_, desc
from sqlalchemy.orm import selectinload
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime, date
import logging
from app.api import deps
from app.models.user import User
from app.models.action_tracker import Meeting, MeetingDocument, MeetingParticipant, MeetingMinutes, MeetingAction
from app.crud.action_tracker import (
    participant, participant_list, meeting, meeting_minutes, 
    meeting_action, meeting_document, dashboard
)
from app.schemas.action_tracker import (
    MeetingCreateResponse, MeetingPaginationResponse, 
    ParticipantCreate, ParticipantUpdate, ParticipantResponse,
    ParticipantListCreate, ParticipantListUpdate, ParticipantListResponse,
    MeetingCreate, MeetingUpdate, MeetingResponse,
    MeetingListResponse,
    MeetingMinutesCreate, MeetingMinutesUpdate, MeetingMinutesResponse,
    MeetingActionCreate, MeetingActionUpdate, MeetingActionResponse,
    ActionProgressUpdate, ActionCommentCreate, ActionCommentResponse,
    MeetingDocumentCreate, MeetingDocumentUpdate, MeetingDocumentResponse,
    ActionStatusHistoryResponse, MeetingSummary, ActionSummary, MyTaskResponse
)
from app.models.general.dynamic_attribute import Attribute, AttributeValue
from app.schemas.entity_attribute import MeetingStatusUpdate

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== CONSTANTS ====================

# app/api/v1/endpoints/action_tracker.py

# ==================== DYNAMIC STATUS FUNCTIONS ====================

async def get_valid_meeting_statuses(db: AsyncSession) -> List[Dict[str, Any]]:
    """Fetch valid meeting statuses from the database with full details."""
    try:
        stmt = select(
            Attribute.id,
            Attribute.code,
            Attribute.name,
            Attribute.short_name,
            Attribute.description,
            Attribute.extra_metadata,
            Attribute.sort_order
        ).where(
            Attribute.code.like("MEETING_STATUS_%"),
            Attribute.is_active == True
        ).order_by(Attribute.sort_order)
        
        result = await db.execute(stmt)
        rows = result.all()
        
        statuses = []
        for row in rows:
            status_info = {
                "id": str(row[0]),
                "code": row[1],
                "name": row[2],
                "short_name": row[3].lower() if row[3] else None,  # Store as lowercase
                "description": row[4],
                "extra_metadata": row[5],
                "sort_order": row[6]
            }
            statuses.append(status_info)
        
        return statuses
        
    except Exception as e:
        logger.error(f"Error fetching meeting statuses: {e}")
        return []


async def get_valid_status_short_names(db: AsyncSession) -> List[str]:
    """Get just the short_names of valid statuses (lowercase)."""
    statuses = await get_valid_meeting_statuses(db)
    return [s["short_name"] for s in statuses if s.get("short_name")]


async def get_status_by_short_name(db: AsyncSession, short_name: str) -> Optional[Dict[str, Any]]:
    """Get a status by its short_name (case insensitive)."""
    statuses = await get_valid_meeting_statuses(db)
    target = short_name.lower()
    for status in statuses:
        if status.get("short_name") and status["short_name"].lower() == target:
            return status
    return None


async def get_status_id_by_short_name(db: AsyncSession, short_name: str) -> Optional[UUID]:
    """Get status ID by short_name."""
    status = await get_status_by_short_name(db, short_name)
    return UUID(status["id"]) if status else None






# Cache for statuses (optional, for performance)
_status_cache = None
_cache_timestamp = None
_CACHE_TTL = 300  # 5 minutes

async def get_cached_statuses(db: AsyncSession, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """Get cached statuses with TTL"""
    global _status_cache, _cache_timestamp
    from datetime import datetime, timedelta
    
    now = datetime.now()
    if force_refresh or _status_cache is None or _cache_timestamp is None or now - _cache_timestamp > timedelta(seconds=_CACHE_TTL):
        _status_cache = await get_valid_meeting_statuses(db)
        _cache_timestamp = now
        logger.debug(f"Refreshed status cache with {len(_status_cache)} statuses")
    
    return _status_cache

# ==================== TEST ENDPOINTS ====================

@router.get("/ping")
async def ping():
    return {"message": "pong", "status": "ok", "timestamp": datetime.now().isoformat()}

@router.get("/health")
async def action_tracker_health():
    return {"status": "healthy", "module": "action-tracker"}

@router.get("/debug/statuses")
async def debug_statuses(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Debug endpoint to see all valid statuses"""
    statuses = await get_valid_meeting_statuses(db)
    return {
        "statuses": statuses,
        "count": len(statuses),
        "short_names": [s["short_name"] for s in statuses if s.get("short_name")]
    }


# Optional: Create a function to cache and log statuses
async def get_and_log_statuses(db: AsyncSession) -> List[str]:
    """Get statuses with additional logging for debugging"""
    statuses = await get_valid_meeting_statuses(db)
    
    print("\n" + "="*80)
    print("📌 VALID MEETING STATUSES SUMMARY")
    print("="*80)
    print(f"Total statuses loaded: {len(statuses)}")
    print(f"Status list: {statuses}")
    print("="*80 + "\n")
    
    return statuses


# ==================== HELPER FUNCTIONS ====================

def validate_pagination(skip: int, limit: int) -> tuple:
    """Validate and return safe pagination parameters"""
    return max(0, skip), min(500, max(1, limit))

# ==================== TEST ENDPOINTS ====================

@router.get("/ping")
async def ping():
    """Simple ping endpoint to test if router is working"""
    return {"message": "pong", "status": "ok", "timestamp": datetime.now().isoformat()}

@router.get("/health")
async def action_tracker_health():
    """Health check for action tracker module"""
    return {"status": "healthy", "module": "action-tracker"}

# ==================== PARTICIPANT ENDPOINTS ====================

@router.post("/participants", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_participant(
    participant_in: ParticipantCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new participant"""
    if participant_in.email:
        existing = await participant.get_by_email(db, participant_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Participant with email {participant_in.email} already exists"
            )
    return await participant.create(db, participant_in, created_by_id=current_user.id)

@router.get("/participants", response_model=List[ParticipantResponse])
async def get_participants(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None, description="Search by name, email, or organization"),
):
    """Get all participants"""
    if search:
        return await participant.search(db, search, skip, limit)
    return await participant.get_multi(db, skip=skip, limit=limit)

@router.get("/participants/my", response_model=List[ParticipantResponse])
async def get_my_participants(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get participants created by current user"""
    return await participant.get_my_participants(db, current_user.id)

@router.get("/participants/{participant_id}", response_model=ParticipantResponse)
async def get_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get participant by ID"""
    result = await participant.get(db, participant_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    return result

@router.put("/participants/{participant_id}", response_model=ParticipantResponse)
async def update_participant(
    participant_id: UUID,
    participant_in: ParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update participant"""
    result = await participant.get(db, participant_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    return await participant.update(db, participant_id, participant_in)

@router.delete("/participants/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete participant"""
    result = await participant.get(db, participant_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    await participant.remove(db, participant_id)

# ==================== PARTICIPANT LIST ENDPOINTS ====================

@router.post("/participant-lists", response_model=ParticipantListResponse, status_code=status.HTTP_201_CREATED)
async def create_participant_list(
    list_in: ParticipantListCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new participant list"""
    return await participant_list.create(db, list_in, created_by_id=current_user.id)

@router.get("/participant-lists", response_model=List[ParticipantListResponse])
async def get_participant_lists(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get participant lists accessible to current user"""
    return await participant_list.get_accessible_lists(db, current_user.id, skip, limit)

@router.get("/participant-lists/{list_id}", response_model=ParticipantListResponse)
async def get_participant_list(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get participant list by ID"""
    result = await participant_list.get(db, list_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant list not found")
    return result

@router.put("/participant-lists/{list_id}", response_model=ParticipantListResponse)
async def update_participant_list(
    list_id: UUID,
    list_in: ParticipantListUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update participant list"""
    result = await participant_list.get(db, list_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant list not found")
    return await participant_list.update(db, list_id, list_in)

@router.delete("/participant-lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_participant_list(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete participant list"""
    result = await participant_list.get(db, list_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant list not found")
    await participant_list.remove(db, list_id)

# ==================== MEETING ENDPOINTS ====================

@router.post("/meetings", response_model=MeetingCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await meeting.create_with_participants(db, meeting_in, current_user.id)
    
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
        created_at=result.created_at,
        is_active=result.is_active,
        message="Meeting created successfully"
    )


@router.get("/meetings", response_model=MeetingPaginationResponse)
async def get_meetings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    upcoming: bool = Query(False),
    status: Optional[str] = Query(None, description="Filter by status short_name (e.g., PENDING, STARTED, AWAITING)"),
    search: Optional[str] = Query(None, description="Search by title or location"),
):
    skip = (page - 1) * limit
    
    # Build filters
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
    
    # Start building the query with eager loading
    query = (
        select(Meeting)
        .where(and_(*filters))
        .options(
            selectinload(Meeting.status),
            selectinload(Meeting.participants)
        )
        .order_by(desc(Meeting.meeting_date), desc(Meeting.start_time))
        .offset(skip)
        .limit(limit)
    )
    
    # If filtering by status, add a join condition using the short_name
    if status:
        # Get the status ID from the short_name
        status_id = await get_status_id_by_short_name(db, status)
        if status_id:
            query = query.where(Meeting.status_id == status_id)
        else:
            # If status not found, return empty results
            return {
                "items": [],
                "total": 0,
                "page": page,
                "size": limit,
                "pages": 0
            }
    
    # Execute query
    result = await db.execute(query)
    meetings_list = result.scalars().all()
    
    # Get total count
    count_query = select(func.count(Meeting.id)).where(and_(*filters))
    if status:
        status_id = await get_status_id_by_short_name(db, status)
        if status_id:
            count_query = count_query.where(Meeting.status_id == status_id)
    
    count_res = await db.execute(count_query)
    total_count = count_res.scalar() or 0
    
    # Convert to response objects
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
            created_at=meeting_obj.created_at,
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


@router.get("/meetings/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    query = (
        select(Meeting)
        .where(
            Meeting.id == meeting_id, 
            Meeting.is_active == True
        )
        .options(
            selectinload(Meeting.status),
            selectinload(Meeting.participants),
            selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions),
            selectinload(Meeting.documents)
        )
    )
    
    result = await db.execute(query)
    meeting_obj = result.scalar_one_or_none()
    
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Build status data
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
    
    # Build participants list
    participants_data = []
    for p in (meeting_obj.participants or []):
        participants_data.append({
            "id": p.id,
            "meeting_id": p.meeting_id,
            "name": p.name,
            "email": p.email,
            "telephone": p.telephone,
            "title": p.title,
            "organization": p.organization,
            "is_chairperson": p.is_chairperson,
            "created_at": p.created_at,
        })
    
    # Build minutes and actions
    minutes_data = []
    for m in (meeting_obj.minutes or []):
        actions_data = []
        for a in (m.actions or []):
            actions_data.append({
                "id": a.id,
                "minute_id": a.minute_id,
                "description": a.description,
                "assigned_to_id": a.assigned_to_id,
                "assigned_to_name": a.assigned_to_name,
                "assigned_by_id": a.assigned_by_id,
                "assigned_at": a.assigned_at,
                "due_date": a.due_date,
                "start_date": a.start_date,
                "completed_at": a.completed_at,
                "priority": a.priority,
                "estimated_hours": a.estimated_hours,
                "actual_hours": a.actual_hours,
                "remarks": a.remarks,
                "overall_status_id": a.overall_status_id,
                "overall_progress_percentage": a.overall_progress_percentage,
                "created_at": a.created_at,
                "updated_at": a.updated_at,
            })
        
        minutes_data.append({
            "id": m.id,
            "meeting_id": m.meeting_id,
            "topic": m.topic,
            "discussion": m.discussion,
            "decisions": m.decisions,
            "timestamp": m.timestamp,
            "recorded_by_id": m.recorded_by_id,
            "created_at": m.created_at,
            "updated_at": m.updated_at,
            "actions": actions_data,
        })
    
    response_data = {
        "id": meeting_obj.id,
        "title": meeting_obj.title,
        "description": meeting_obj.description,
        "location_id": meeting_obj.location_id,
        "location_text": meeting_obj.location_text,
        "gps_coordinates": meeting_obj.gps_coordinates,
        "meeting_date": meeting_obj.meeting_date,
        "start_time": meeting_obj.start_time,
        "end_time": meeting_obj.end_time,
        "agenda": meeting_obj.agenda,
        "facilitator": meeting_obj.facilitator,
        "chairperson_name": meeting_obj.chairperson_name,
        "status_id": meeting_obj.status_id,
        "created_by_id": meeting_obj.created_by_id,
        "created_at": meeting_obj.created_at,
        "updated_at": meeting_obj.updated_at,
        "is_active": meeting_obj.is_active,
        "status": status_data,
        "participants": participants_data,
        "minutes": minutes_data,
        "documents": []
    }
    
    return MeetingResponse(**response_data)




@router.delete("/meetings/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete a meeting"""
    result = await meeting.get(db, meeting_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    await meeting.remove(db, meeting_id)
    logger.info(f"Meeting deleted: {meeting_id} by user {current_user.id}")


from fastapi import status as http_status  # add this at the top of the file
def _build_meeting_response(meeting_obj: Meeting) -> MeetingResponse:
    """Convert a fully-loaded Meeting ORM object to MeetingResponse, safely."""
    status_data = None
    if meeting_obj.status:
        s = meeting_obj.status
        status_data = {
            "id": str(s.id),
            "code": s.code,
            "name": s.name,
            "short_name": s.short_name,
            "description": s.description,
            "extra_metadata": s.extra_metadata,
        }

    participants_data = [
        {
            "id": p.id, "meeting_id": p.meeting_id, "name": p.name,
            "email": p.email, "telephone": p.telephone, "title": p.title,
            "organization": p.organization, "is_chairperson": p.is_chairperson,
            "created_at": p.created_at,
        }
        for p in (meeting_obj.participants or [])
    ]

    minutes_data = [
        {
            "id": m.id, "meeting_id": m.meeting_id, "topic": m.topic,
            "discussion": m.discussion, "decisions": m.decisions,
            "timestamp": m.timestamp, "recorded_by_id": m.recorded_by_id,
            "created_at": m.created_at, "updated_at": m.updated_at,
            "actions": [
                {
                    "id": a.id, "minute_id": a.minute_id,
                    "description": a.description,
                    "assigned_to_id": a.assigned_to_id,
                    "assigned_to_name": a.assigned_to_name,
                    "assigned_by_id": a.assigned_by_id,
                    "assigned_at": a.assigned_at,
                    "due_date": a.due_date, "start_date": a.start_date,
                    "completed_at": a.completed_at, "priority": a.priority,
                    "estimated_hours": a.estimated_hours,
                    "actual_hours": a.actual_hours, "remarks": a.remarks,
                    "overall_status_id": a.overall_status_id,
                    "overall_progress_percentage": a.overall_progress_percentage,
                    "created_at": a.created_at, "updated_at": a.updated_at,
                }
                for a in (m.actions or [])
            ],
        }
        for m in (meeting_obj.minutes or [])
    ]

    return MeetingResponse(
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
        created_by_id=meeting_obj.created_by_id,
        created_at=meeting_obj.created_at,
        updated_at=meeting_obj.updated_at,
        is_active=meeting_obj.is_active,
        status=status_data,
        participants=participants_data,
        minutes=minutes_data,
        documents=[],
    )


# ==================== MEETING UPDATE ENDPOINT (WAS MISSING) ====================


# Setup a basic logger
logger = logging.getLogger("uvicorn.error")

@router.put("/meetings/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: UUID,
    meeting_in: MeetingUpdate, 
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    # 1. Fetch existing meeting
    db_obj = await meeting.get(db, meeting_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Meeting not found")

    old_status_id = db_obj.status_id
    update_data = meeting_in.model_dump(exclude_unset=True)

    # ---------------------------------------------------------
    # DEBUG BLOCK: Confirming values from React
    # ---------------------------------------------------------
    print("\n" + "="*50)
    print("DEBUG: RECEIVED UPDATE REQUEST")
    print(f"Meeting ID: {meeting_id}")
    print(f"Full Payload: {update_data}")
    print(f"Status Comment: {update_data.get('status_comment')}")
    print(f"Status Date: {update_data.get('status_date')}")
    print("="*50 + "\n")
    # ---------------------------------------------------------

    # 2. Extract History Metadata
    new_status_id = update_data.get("status_id")
    
    # Capture comment and date, then remove from dict
    status_comment = update_data.pop("status_comment", "Updated via meeting edit")
    raw_status_date = update_data.pop("status_date", None)

    # Convert raw date
    if isinstance(raw_status_date, str):
        try:
            status_date = datetime.fromisoformat(raw_status_date.replace('Z', ''))
        except ValueError:
            logger.warning(f"Invalid date format received: {raw_status_date}")
            status_date = datetime.now()
    else:
        status_date = raw_status_date or datetime.now()

    # 3. Update Meeting Object (Direct Columns Only)
    mapper = inspect(db_obj.__class__)
    valid_columns = {c.key for c in mapper.attrs if not hasattr(c, 'direction')}

    for field, value in update_data.items():
        if field in valid_columns:
            setattr(db_obj, field, value)

    # 4. Save to History Table
    if new_status_id and str(new_status_id) != str(old_status_id):
        from app.models.action_tracker import MeetingStatusHistory
        
        print(f"LOG: Creating history entry with comment: '{status_comment}' and date: {status_date}")
        
        history_entry = MeetingStatusHistory(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            status_id=new_status_id,
            comment=status_comment,
            status_date=status_date,
            updated_by_id=current_user.id
        )
        db.add(history_entry)

    db_obj.updated_at = datetime.now()
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Database error during update: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # 5. Return full details
    updated = await meeting.get_meeting_with_details(db, meeting_id)
    return build_meeting_response(updated)





@router.patch("/meetings/{meeting_id}/status", response_model=MeetingResponse)
async def update_meeting_status(
    meeting_id: UUID,
    status_value: str = Query(..., alias="status"),
    comment: Optional[str] = Query(None, description="Reason for status change"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Specific endpoint for status toggles (e.g. 'Start Meeting', 'Cancel')"""
    status_info = await get_status_by_short_name(db, status_value)
    if not status_info:
        valid_statuses = await get_valid_status_short_names(db)
        raise HTTPException(status_code=400, detail=f"Invalid status. Use: {', '.join(valid_statuses)}")
    
    new_status_id = UUID(status_info["id"])

    # 🟢 IMPROVEMENT: Use the improved CRUD method that saves to the table automatically
    try:
        updated_meeting = await meeting.update_status(
            db, 
            meeting_id=meeting_id, 
            status_id=new_status_id, 
            comment=comment or f"Status changed to {status_value}",
            updated_by_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # Re-fetch with details
    result = await meeting.get_meeting_with_details(db, meeting_id)
    return build_meeting_response(result)

# Remove the duplicate update_meeting_status_put or keep it but make sure it works
@router.put("/meetings/{meeting_id}/status", response_model=MeetingResponse)
async def update_meeting_status_put(
    meeting_id: UUID,
    status_value: str = Query(..., alias="status"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    # Just call the PATCH handler logic
    return await update_meeting_status(meeting_id, status_value, db, current_user)


def build_meeting_response(meeting_obj: Meeting) -> MeetingResponse:
    """Convert a fully-loaded Meeting ORM object to MeetingResponse, safely."""
    status_data = None
    if meeting_obj.status:
        s = meeting_obj.status
        status_data = {
            "id": str(s.id),
            "code": s.code,
            "name": s.name,
            "short_name": s.short_name,
            "description": s.description,
            "extra_metadata": s.extra_metadata,
        }
    
    participants_data = [
        {
            "id": p.id, "meeting_id": p.meeting_id, "name": p.name,
            "email": p.email, "telephone": p.telephone, "title": p.title,
            "organization": p.organization, "is_chairperson": p.is_chairperson,
            "created_at": p.created_at,
        }
        for p in (meeting_obj.participants or [])
    ]
    
    minutes_data = [
        {
            "id": m.id, "meeting_id": m.meeting_id, "topic": m.topic,
            "discussion": m.discussion, "decisions": m.decisions,
            "timestamp": m.timestamp, "recorded_by_id": m.recorded_by_id,
            "created_at": m.created_at, "updated_at": m.updated_at,
            "actions": [
                {
                    "id": a.id, "minute_id": a.minute_id,
                    "description": a.description,
                    "assigned_to_id": a.assigned_to_id,
                    "assigned_to_name": a.assigned_to_name,
                    "assigned_by_id": a.assigned_by_id,
                    "assigned_at": a.assigned_at,
                    "due_date": a.due_date, "start_date": a.start_date,
                    "completed_at": a.completed_at, "priority": a.priority,
                    "estimated_hours": a.estimated_hours,
                    "actual_hours": a.actual_hours, "remarks": a.remarks,
                    "overall_status_id": a.overall_status_id,
                    "overall_progress_percentage": a.overall_progress_percentage,
                    "created_at": a.created_at, "updated_at": a.updated_at,
                }
                for a in (m.actions or [])
            ],
        }
        for m in (meeting_obj.minutes or [])
    ]
    
    return MeetingResponse(
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
        created_by_id=meeting_obj.created_by_id,
        created_at=meeting_obj.created_at,
        updated_at=meeting_obj.updated_at,
        is_active=meeting_obj.is_active,
        status=status_data,
        participants=participants_data,
        minutes=minutes_data,
        documents=[],
    )


def build_meeting_response(meeting_obj: Meeting) -> MeetingResponse:
    """Convert a fully-loaded Meeting ORM object to MeetingResponse, safely."""
    status_data = None
    if meeting_obj.status:
        s = meeting_obj.status
        status_data = {
            "id": str(s.id),
            "code": s.code,
            "name": s.name,
            "short_name": s.short_name,
            "description": s.description,
            "extra_metadata": s.extra_metadata,
        }
    
    participants_data = [
        {
            "id": p.id, "meeting_id": p.meeting_id, "name": p.name,
            "email": p.email, "telephone": p.telephone, "title": p.title,
            "organization": p.organization, "is_chairperson": p.is_chairperson,
            "created_at": p.created_at,
        }
        for p in (meeting_obj.participants or [])
    ]
    
    minutes_data = [
        {
            "id": m.id, "meeting_id": m.meeting_id, "topic": m.topic,
            "discussion": m.discussion, "decisions": m.decisions,
            "timestamp": m.timestamp, "recorded_by_id": m.recorded_by_id,
            "created_at": m.created_at, "updated_at": m.updated_at,
            "actions": [
                {
                    "id": a.id, "minute_id": a.minute_id,
                    "description": a.description,
                    "assigned_to_id": a.assigned_to_id,
                    "assigned_to_name": a.assigned_to_name,
                    "assigned_by_id": a.assigned_by_id,
                    "assigned_at": a.assigned_at,
                    "due_date": a.due_date, "start_date": a.start_date,
                    "completed_at": a.completed_at, "priority": a.priority,
                    "estimated_hours": a.estimated_hours,
                    "actual_hours": a.actual_hours, "remarks": a.remarks,
                    "overall_status_id": a.overall_status_id,
                    "overall_progress_percentage": a.overall_progress_percentage,
                    "created_at": a.created_at, "updated_at": a.updated_at,
                }
                for a in (m.actions or [])
            ],
        }
        for m in (meeting_obj.minutes or [])
    ]
    
    return MeetingResponse(
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
        created_by_id=meeting_obj.created_by_id,
        created_at=meeting_obj.created_at,
        updated_at=meeting_obj.updated_at,
        is_active=meeting_obj.is_active,
        status=status_data,
        participants=participants_data,
        minutes=minutes_data,
        documents=[],
    )



# ==================== MEETING MINUTES ENDPOINTS ====================

@router.post("/meetings/{meeting_id}/minutes", response_model=MeetingMinutesResponse, status_code=status.HTTP_201_CREATED)
async def add_meeting_minutes(
    meeting_id: UUID,
    minutes_in: MeetingMinutesCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Add minutes to a meeting"""
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return await meeting.add_minutes(db, meeting_id, minutes_in, current_user.id)




@router.get("/minutes/{minute_id}", response_model=MeetingMinutesResponse)
async def get_minutes(
    minute_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get minutes by ID"""
    result = await meeting_minutes.get(db, minute_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Minutes not found")
    return result

@router.put("/minutes/{minute_id}", response_model=MeetingMinutesResponse)
async def update_minutes(
    minute_id: UUID,
    minutes_in: MeetingMinutesUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update meeting minutes"""
    result = await meeting_minutes.get(db, minute_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Minutes not found")
    return await meeting_minutes.update(db, minute_id, minutes_in)

@router.delete("/minutes/{minute_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_minutes(
    minute_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete meeting minutes"""
    result = await meeting_minutes.get(db, minute_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Minutes not found")
    await meeting_minutes.remove(db, minute_id)

# ==================== ACTION ITEMS ENDPOINTS ====================

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

@router.get("/actions", response_model=List[MeetingActionResponse])
async def get_actions(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = Query(None, description="Filter by status"),
):
    """Get all actions"""
    return await meeting_action.get_multi(db, skip=skip, limit=limit)

@router.get("/actions/{action_id}", response_model=MeetingActionResponse)
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

@router.put("/actions/{action_id}", response_model=MeetingActionResponse)
async def update_action(
    action_id: UUID,
    action_in: MeetingActionUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update action"""
    result = await meeting_action.get(db, action_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.update(db, action_id, action_in)

@router.post("/actions/{action_id}/progress", response_model=MeetingActionResponse)
async def update_action_progress(
    action_id: UUID,
    progress_update: ActionProgressUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update action progress (for assigned users)"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    
    # Check if user is assigned to this action
    if action_obj.assigned_to_id and action_obj.assigned_to_id != current_user.id:
        is_admin = any(role.code in ["admin", "super_admin"] for role in current_user.roles)
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the assigned user or admin can update progress"
            )
    
    return await meeting_action.update_progress(db, action_id, progress_update, current_user.id)

@router.post("/actions/{action_id}/comments", response_model=ActionCommentResponse, status_code=status.HTTP_201_CREATED)
async def add_action_comment(
    action_id: UUID,
    comment_in: ActionCommentCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Add a comment to an action"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.add_comment(db, action_id, comment_in, current_user.id)

@router.get("/actions/{action_id}/comments", response_model=List[ActionCommentResponse])
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

@router.get("/actions/{action_id}/history", response_model=List[ActionStatusHistoryResponse])
async def get_action_history(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get status history for an action"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.get_status_history(db, action_id)

@router.get("/actions/my-tasks", response_model=List[MyTaskResponse])
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

@router.delete("/actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete an action"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    await meeting_action.remove(db, action_id)

# ==================== DOCUMENT ENDPOINTS ====================

@router.post("/meetings/{meeting_id}/documents", response_model=MeetingDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    meeting_id: UUID,
    document_in: MeetingDocumentCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Upload a document to a meeting"""
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    file_path = f"uploads/meetings/{meeting_id}/{document_in.file_name}"
    
    return await meeting_document.upload_document(
        db, meeting_id, document_in, file_path, 0, "application/octet-stream", current_user.id
    )

@router.get("/meetings/{meeting_id}/documents", response_model=List[MeetingDocumentResponse])
async def get_meeting_documents(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all documents for a meeting"""
    return await meeting_document.get_meeting_documents(db, meeting_id)

@router.get("/documents/{document_id}", response_model=MeetingDocumentResponse)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get document by ID"""
    result = await meeting_document.get(db, document_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return result

@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete a document"""
    result = await meeting_document.get(db, document_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await meeting_document.remove(db, document_id)

# ==================== DASHBOARD & STATISTICS ENDPOINTS ====================

@router.get("/dashboard/summary", response_model=MeetingSummary)
async def get_dashboard_summary(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get dashboard summary statistics"""
    return await dashboard.get_summary(db)

@router.get("/dashboard/actions-summary", response_model=ActionSummary)
async def get_actions_summary(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get actions summary for dashboard"""
    return await dashboard.get_actions_summary(db)

@router.get("/statistics/meetings-by-month")
async def get_meetings_by_month(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    year: int = Query(datetime.now().year, description="Year to filter"),
):
    """Get meetings grouped by month"""
    return await dashboard.get_meetings_by_month(db, year)

@router.get("/statistics/actions-by-status")
async def get_actions_by_status(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get actions grouped by status"""
    return await dashboard.get_actions_by_status(db)

# ==================== RAW SQL FALLBACK ENDPOINT ====================

@router.get("/meetings-raw")
async def get_meetings_raw(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get meetings using raw SQL - fallback if ORM has issues"""
    from sqlalchemy import text
    
    result = await db.execute(
        text("""
            SELECT 
                id, title, description, meeting_date, start_time, 
                end_time, location_text, agenda, facilitator, 
                chairperson_name, status, created_by_id, created_at, is_active
            FROM meetings 
            WHERE is_active = 1 
            ORDER BY meeting_date DESC 
            LIMIT 100
        """)
    )
    
    meetings = []
    for row in result:
        meetings.append({
            "id": str(row[0]),
            "title": row[1],
            "description": row[2],
            "meeting_date": row[3].isoformat() if row[3] else None,
            "start_time": row[4].isoformat() if row[4] else None,
            "end_time": row[5].isoformat() if row[5] else None,
            "location_text": row[6],
            "agenda": row[7],
            "facilitator": row[8],
            "chairperson_name": row[9],
            "status": row[10],
            "created_by_id": str(row[11]),
            "created_at": row[12].isoformat() if row[12] else None,
            "is_active": bool(row[13]),
        })
    
    return meetings