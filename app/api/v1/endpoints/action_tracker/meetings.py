# app/api/v1/endpoints/action_tracker/meetings.py

import csv
from io import StringIO
import uuid
from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any
from uuid import UUID
import logging
from math import radians, sin, cos, sqrt, atan2

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, distinct, func, select, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from collections import defaultdict

from app.api import deps
from app.core.security import get_current_user
from app.crud.action_tracker import meeting_crud, meeting_action, meeting_minutes, meeting_participant
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.general.dynamic_attribute import Attribute
from app.models.user import User
from app.models.action_tracker import (
    Meeting, MeetingAction, MeetingDocument, MeetingParticipant, 
    MeetingQuery, MeetingStatus, MeetingStatusHistory, MeetingMinutes, Participant
)
from app.schemas.action_tracker import (
    MeetingCreateResponse, MeetingMinutesResponse, MeetingPaginationResponse, 
    MeetingCreate, MeetingParticipantResponse, MeetingParticipantUpdate, 
    MeetingStatusHistoryResponse, MeetingUpdate, MeetingResponse, 
    MeetingListResponse, NotificationRequest, ZoomMeetingCreate
)
from app.schemas.action_tracker_participants import ParticipantCreate
from app.schemas.meeting_minutes.meeting_minutes import (
    MeetingActionCreate, MeetingActionResponse, MeetingMinutesCreate,
    MeetingMinutesResponse, MeetingMinutesUpdate
)

from .status_utils import get_status_id_by_short_name, get_status_by_short_name, get_valid_status_short_names
from .utils import build_meeting_response as utils_build_meeting_response
from app.services.email_service import email_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== HELPER FUNCTIONS ====================

async def get_meeting_or_404(db: AsyncSession, meeting_id: UUID) -> Meeting:
    """Get meeting by ID or raise 404"""
    meeting = await meeting_crud.get(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return meeting


def apply_meeting_filters(query, filters):
    """Apply filters to meeting query including location-based filters"""
    
    # Upcoming meetings filter
    if filters.get("upcoming"):
        query = query.where(Meeting.meeting_date >= date.today())
    
    # Status filter
    if filters.get("status"):
        query = query.where(Meeting.status.has(code=filters["status"]))
    
    # Search filter (title, description, purpose)
    if filters.get("search"):
        search_term = f"%{filters['search']}%"
        query = query.where(
            or_(
                Meeting.title.ilike(search_term),
                Meeting.description.ilike(search_term),
                Meeting.purpose.ilike(search_term),
                Meeting.location_text.ilike(search_term),
                Meeting.venue.ilike(search_term),
                Meeting.district_office.ilike(search_term)
            )
        )
    
    # Location filter (venue, district, or office)
    if filters.get("location"):
        location_term = f"%{filters['location']}%"
        query = query.where(
            or_(
                Meeting.location_text.ilike(location_term),
                Meeting.venue.ilike(location_term),
                Meeting.district_office.ilike(location_term),
                Meeting.district.ilike(location_term)
            )
        )
    
    # District-specific filter
    if filters.get("district"):
        district_term = f"%{filters['district']}%"
        query = query.where(
            or_(
                Meeting.district_office.ilike(district_term),
                Meeting.district.ilike(district_term)
            )
        )
    
    # Region filter
    if filters.get("region"):
        region_term = f"%{filters['region']}%"
        query = query.where(Meeting.region.ilike(region_term))
    
    return query


def build_meeting_list_response(meeting_obj: Meeting) -> Optional[MeetingListResponse]:
    """Build list response for a meeting - end_time is optional"""
    if not meeting_obj:
        return None
    
    # Keep original values - don't modify
    start_time = meeting_obj.start_time
    end_time = meeting_obj.end_time  # Can be None
    
    status_data = None
    if meeting_obj.status:
        status_data = {
            "id": meeting_obj.status.id,
            "code": meeting_obj.status.code,
            "name": meeting_obj.status.name,
            "short_name": meeting_obj.status.short_name,
            "description": meeting_obj.status.description,
            "extra_metadata": meeting_obj.status.extra_metadata,
            "color": getattr(meeting_obj.status, 'color', None),
            "sort_order": getattr(meeting_obj.status, 'sort_order', None),
            "group_id": getattr(meeting_obj.status, 'group_id', None),
            "created_at": getattr(meeting_obj.status, 'created_at', None),
            "updated_at": getattr(meeting_obj.status, 'updated_at', None),
            "is_active": getattr(meeting_obj.status, 'is_active', True)
        }
    
    return MeetingListResponse(
        id=meeting_obj.id,
        title=meeting_obj.title,
        description=meeting_obj.description,
        location_id=meeting_obj.location_id,
        location_text=meeting_obj.location_text,
        gps_coordinates=meeting_obj.gps_coordinates,
        meeting_date=meeting_obj.meeting_date,
        start_time=start_time,
        end_time=end_time,  # Keep original, can be None
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
    )

# app/api/v1/endpoints/action_tracker/meetings.py

def build_meeting_response(meeting_obj: Meeting) -> Optional[MeetingResponse]:
    """Build detailed meeting response - end_time is optional"""
    if not meeting_obj:
        return None
    
    # Don't modify end_time - keep it as is (can be None)
    start_time = meeting_obj.start_time
    end_time = meeting_obj.end_time  # Keep original value, even if None or same as start_time
    
    status_data = None
    if meeting_obj.status:
        status_data = {
            "id": meeting_obj.status.id,
            "code": meeting_obj.status.code,
            "name": meeting_obj.status.name,
            "short_name": meeting_obj.status.short_name,
            "description": meeting_obj.status.description,
            "extra_metadata": meeting_obj.status.extra_metadata,
            "color": getattr(meeting_obj.status, 'color', None),
            "sort_order": getattr(meeting_obj.status, 'sort_order', None),
            "group_id": getattr(meeting_obj.status, 'group_id', None),
            "created_at": getattr(meeting_obj.status, 'created_at', None),
            "updated_at": getattr(meeting_obj.status, 'updated_at', None),
            "is_active": getattr(meeting_obj.status, 'is_active', True)
        }
    
    # Build participants list
    participants = []
    for p in meeting_obj.participants:
        participants.append(MeetingParticipantResponse(
            id=p.id,
            meeting_id=p.meeting_id,
            name=p.name,
            email=p.email,
            telephone=p.telephone,
            title=p.title,
            organization=p.organization,
            is_chairperson=p.is_chairperson,
            is_secretary=getattr(p, 'is_secretary', False),
            attendance_status=p.attendance_status,
            apology_comment=p.apology_comment,
            created_by_id=p.created_by_id,
            created_by_name=p.created_by.username if p.created_by else None,
            created_at=p.created_at,
            updated_by_id=p.updated_by_id,
            updated_by_name=p.updated_by.username if p.updated_by else None,
            updated_at=p.updated_at,
            is_active=p.is_active
        ))
    
    # Build response - keep end_time as is (don't modify)
    return MeetingResponse(
        id=meeting_obj.id,
        title=meeting_obj.title,
        description=meeting_obj.description,
        location_id=meeting_obj.location_id,
        location_text=meeting_obj.location_text,
        gps_coordinates=meeting_obj.gps_coordinates,
        meeting_date=meeting_obj.meeting_date,
        start_time=start_time,
        end_time=end_time,  # Keep original, can be None
        agenda=meeting_obj.agenda,
        facilitator=meeting_obj.facilitator,
        chairperson_name=meeting_obj.chairperson_name,
        status_id=meeting_obj.status_id,
        created_by_id=meeting_obj.created_by_id,
        created_by_name=meeting_obj.created_by.username if meeting_obj.created_by else None,
        created_at=meeting_obj.created_at,
        platform=getattr(meeting_obj, 'platform', None),
        meeting_link=getattr(meeting_obj, 'meeting_link', None),
        meeting_id_online=getattr(meeting_obj, 'meeting_id_online', None),
        passcode=getattr(meeting_obj, 'passcode', None),
        has_online_meeting=getattr(meeting_obj, 'has_online_meeting', False),
        has_physical_meeting=getattr(meeting_obj, 'has_physical_meeting', True),
        venue=getattr(meeting_obj, 'venue', None),
        address=getattr(meeting_obj, 'address', None),
        location_instructions=getattr(meeting_obj, 'location_instructions', None),
        chairperson_id=getattr(meeting_obj, 'chairperson_id', None),
        secretary_id=getattr(meeting_obj, 'secretary_id', None),
        dial_in_numbers=getattr(meeting_obj, 'dial_in_numbers', None),
        send_reminders=getattr(meeting_obj, 'send_reminders', True),
        reminder_minutes_before=getattr(meeting_obj, 'reminder_minutes_before', 30),
        updated_by_id=meeting_obj.updated_by_id,
        updated_by_name=meeting_obj.updated_by.username if meeting_obj.updated_by else None,
        updated_at=meeting_obj.updated_at,
        is_active=meeting_obj.is_active,
        status_comment=getattr(meeting_obj, 'status_comment', None),
        status_date=getattr(meeting_obj, 'status_date', None),
        status_name=None,
        location_name=getattr(meeting_obj, 'location_name', None),
        status=status_data,
        participants=participants,
        minutes=[],
        documents=[]
    )

async def update_meeting_common(
    db: AsyncSession,
    meeting_id: UUID,
    update_data: Dict[str, Any],
    current_user: User,
    source: str = "PUT"
) -> Optional[Meeting]:
    """Common function for updating meeting (used by PUT and PATCH)"""
    db_obj = await get_meeting_or_404(db, meeting_id)
    
    # Extract custom_participants before processing other fields
    custom_participants = update_data.pop("custom_participants", None)
    
    # FIX: Validate and fix start_time and end_time if both are being updated
    new_start_time = update_data.get("start_time")
    new_end_time = update_data.get("end_time")
    
    # Get effective start_time (new or existing)
    effective_start_time = new_start_time if new_start_time else db_obj.start_time
    
    # If end_time is being updated or needs fixing
    if new_end_time is not None:
        if new_end_time <= effective_start_time:
            # Fix end_time to be 1 hour after start_time
            new_end_time = effective_start_time + timedelta(hours=1)
            update_data["end_time"] = new_end_time
            logger.warning(f"Fixed invalid end_time in update: was {new_end_time}, set to {new_end_time}")
    
    # Handle status_comment and status_date separately
    status_comment = update_data.pop("status_comment", None)
    status_date_raw = update_data.pop("status_date", None)
    
    # Check if status_id is being updated
    old_status_id = db_obj.status_id
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
            comment=status_comment or f"Status updated via {source}",
            status_date=status_date,
            created_by_id=current_user.id,
            created_at=datetime.now(),
            is_active=True
        )
        db.add(history_entry)
    
    # Handle participant sync if custom_participants were provided
    if custom_participants is not None:
        logger.info(f"Processing {len(custom_participants)} participants for meeting {meeting_id}")
        await sync_meeting_participants(db, meeting_id, custom_participants, current_user)
    
    await db.commit()
    await db.refresh(db_obj)
    
    # Reload with all relationships including participants
    return await meeting_crud.get_meeting_with_details(db, meeting_id)



# Add this function after the existing helper functions, before @router.put

async def sync_meeting_participants(
    db: AsyncSession,
    meeting_id: UUID,
    custom_participants: List[Dict[str, Any]],
    current_user: User
) -> List[MeetingParticipant]:
    """
    Sync meeting participants - add new, update existing, remove missing ones.
    This preserves chairperson and secretary assignments.
    """
    # Get existing participants
    result = await db.execute(
        select(MeetingParticipant)
        .where(
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True
        )
    )
    existing_participants = result.scalars().all()
    
    # Create maps for quick lookup
    existing_by_id = {str(p.id): p for p in existing_participants}
    existing_by_email = {p.email: p for p in existing_participants if p.email}
    existing_by_name = {p.name: p for p in existing_participants}
    
    kept_participant_ids = set()
    updated_participants = []
    
    for p_data in custom_participants:
        participant_id = str(p_data.get('id')) if p_data.get('id') else None
        email = p_data.get('email')
        name = p_data.get('name')
        
        # Find existing participant
        existing = None
        if participant_id and participant_id in existing_by_id:
            existing = existing_by_id[participant_id]
            logger.debug(f"Updating participant by ID: {name}")
        elif email and email in existing_by_email:
            existing = existing_by_email[email]
            logger.debug(f"Updating participant by email: {name}")
        elif name and name in existing_by_name:
            existing = existing_by_name[name]
            logger.debug(f"Updating participant by name: {name}")
        
        if existing:
            # Update existing participant
            existing.name = p_data.get('name', existing.name)
            existing.email = p_data.get('email', existing.email)
            existing.telephone = p_data.get('telephone', existing.telephone)
            existing.title = p_data.get('title', existing.title)
            existing.organization = p_data.get('organization', existing.organization)
            existing.is_chairperson = p_data.get('is_chairperson', existing.is_chairperson)
            existing.is_secretary = p_data.get('is_secretary', False)
            existing.updated_by_id = current_user.id
            existing.updated_at = datetime.now()
            kept_participant_ids.add(str(existing.id))
            updated_participants.append(existing)
        else:
            # Create new participant
            logger.info(f"Creating new participant: {name}")
            new_participant = MeetingParticipant(
                id=uuid.uuid4(),
                meeting_id=meeting_id,
                name=name,
                email=email,
                telephone=p_data.get('telephone'),
                title=p_data.get('title'),
                organization=p_data.get('organization'),
                is_chairperson=p_data.get('is_chairperson', False),
                is_secretary=p_data.get('is_secretary', False),
                created_by_id=current_user.id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                is_active=True
            )
            db.add(new_participant)
            await db.flush()
            kept_participant_ids.add(str(new_participant.id))
            updated_participants.append(new_participant)
    
    # Remove participants not in the kept list
    for participant in existing_participants:
        if str(participant.id) not in kept_participant_ids:
            logger.info(f"Removing participant: {participant.name}")
            participant.is_active = False
            participant.updated_by_id = current_user.id
            participant.updated_at = datetime.now()
    
    await db.flush()
    return updated_participants

def build_minutes_response(minute: MeetingMinutes) -> Dict[str, Any]:
    """Build response for meeting minutes"""
    return {
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
    }


def build_status_history_response(history: MeetingStatusHistory) -> MeetingStatusHistoryResponse:
    """Build response for status history entry"""
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


# ==================== MEETING CRUD OPERATIONS ====================

@router.post("/", response_model=MeetingCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new meeting with audit fields"""
    try:
        logger.debug(f"Creating meeting for user: {current_user.id}")
        logger.debug(f"Meeting data: {meeting_in.model_dump()}")
        
        result = await meeting_crud.create_with_participants(db, meeting_in, current_user.id)
        logger.debug(f"Meeting created successfully: {result.id}")
        
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
        logger.error(f"Error creating meeting: {type(e).__name__}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create meeting: {str(e)}"
        )


@router.get("/", response_model=MeetingPaginationResponse)
async def get_meetings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    upcoming: bool = Query(False),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    location: Optional[str] = Query(None, description="Filter by location name"),
    district: Optional[str] = Query(None, description="Filter by district office"),
    region: Optional[str] = Query(None, description="Filter by region"),
    lat: Optional[float] = Query(None, description="Latitude for proximity search"),
    lng: Optional[float] = Query(None, description="Longitude for proximity search"),
    radius_km: Optional[float] = Query(10, ge=1, le=100, description="Search radius in kilometers"),
):
    """Get paginated list of meetings with location filtering and geo-search"""
    
    skip = (page - 1) * limit
    
    # Build base query with relationships - ADD is_active filter
    query = select(Meeting).options(
        selectinload(Meeting.status),
        selectinload(Meeting.participants),
        selectinload(Meeting.created_by),
        selectinload(Meeting.updated_by),
    ).where(
        Meeting.is_active == True  # ADD THIS LINE - Only show active meetings
    ).order_by(desc(Meeting.meeting_date), desc(Meeting.start_time))
    
    # Create filters dictionary
    filters = {
        "upcoming": upcoming,
        "search": search,
        "status": status,
        "location": location,
        "district": district,
        "region": region
    }
    
    # Apply location-based filters
    query = apply_meeting_filters(query, filters)
    
    # Geo-location proximity search
    if lat is not None and lng is not None:
        query = query.where(
            Meeting.latitude.isnot(None),
            Meeting.longitude.isnot(None)
        )
    
    # Execute paginated query
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    meetings_list = result.scalars().all()
    
    # Count total with all filters - ADD is_active filter to count query
    count_query = select(func.count(Meeting.id)).where(Meeting.is_active == True)
    count_query = apply_meeting_filters(count_query, filters)
    
    if lat is not None and lng is not None:
        count_query = count_query.where(
            Meeting.latitude.isnot(None),
            Meeting.longitude.isnot(None)
        )
    
    count_res = await db.execute(count_query)
    total_count = count_res.scalar() or 0
    
    # Build response items with location info
    items = []
    for meeting in meetings_list:
        meeting_response = build_meeting_list_response(meeting)
        if meeting_response:
            # Convert to dict to add location details
            meeting_dict = meeting_response.model_dump()
            
            # Add location details
            meeting_dict["location_details"] = {
                "venue": getattr(meeting, 'venue', None),
                "district_office": getattr(meeting, 'district_office', None),
                "district": getattr(meeting, 'district', None),
                "region": getattr(meeting, 'region', None),
                "address": meeting.location_text,
                "latitude": getattr(meeting, 'latitude', None),
                "longitude": getattr(meeting, 'longitude', None),
                "is_virtual": getattr(meeting, 'is_virtual', False),
                "virtual_link": getattr(meeting, 'virtual_link', None)
            }
            
            # Calculate distance if geo-search was used
            if lat is not None and lng is not None and meeting.latitude and meeting.longitude:
                from math import radians, sin, cos, sqrt, atan2
                R = 6371
                lat1, lon1 = radians(lat), radians(lng)
                lat2, lon2 = radians(meeting.latitude), radians(meeting.longitude)
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                c = 2 * atan2(sqrt(a), sqrt(1-a))
                distance = R * c
                meeting_dict["location_details"]["distance_km"] = round(distance, 2)
            
            items.append(meeting_dict)
    
    return MeetingPaginationResponse(
        items=items,
        total=total_count,
        page=page,
        size=limit,
        pages=(total_count + limit - 1) // limit
    )

@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get meeting by ID with minutes and actions loaded"""
    # Use the CRUD method that loads all relationships
    meeting = await meeting_crud.get_meeting_with_details(db, meeting_id)
    
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    response = build_meeting_response(meeting)
    if not response:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to build meeting response")
    
    return response


@router.put("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: UUID,
    meeting_in: MeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Full update meeting with audit fields and participant management"""
    logger.info(f"=== UPDATE MEETING CALLED ===")
    logger.info(f"Meeting ID: {meeting_id}")
    logger.info(f"User: {current_user.username} (ID: {current_user.id})")
    
    update_data = meeting_in.model_dump(exclude_unset=True)
    logger.debug(f"Full incoming payload: {update_data}")
    
    # Log participants specifically for debugging
    if 'custom_participants' in update_data:
        logger.info(f"Participants in update: {len(update_data['custom_participants'])}")
        for i, p in enumerate(update_data['custom_participants']):
            logger.info(f"  Participant {i+1}: {p.get('name')} - Chair: {p.get('is_chairperson')}, Sec: {p.get('is_secretary')}")
    else:
        logger.info("No custom_participants in update data")
    
    updated_meeting = await update_meeting_common(db, meeting_id, update_data, current_user, "PUT")
    
    # Log result
    logger.info(f"Meeting updated successfully. Participants count: {len(updated_meeting.participants) if updated_meeting.participants else 0}")
    
    response = build_meeting_response(updated_meeting)
    logger.info(f"Response built with {len(response.participants) if response.participants else 0} participants")
    
    return response


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def partial_update_meeting(
    meeting_id: UUID,
    meeting_in: MeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Partial update meeting - only update provided fields"""
    logger.debug(f"Partial update payload: {meeting_in.model_dump(exclude_unset=True)}")
    update_data = meeting_in.model_dump(exclude_unset=True)
    updated_meeting = await update_meeting_common(db, meeting_id, update_data, current_user, "PATCH")
    return build_meeting_response(updated_meeting)


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
    
    update_data = {"status_id": UUID(status_info["id"]), "status_comment": comment}
    updated_meeting = await update_meeting_common(db, meeting_id, update_data, current_user, "PATCH")
    return build_meeting_response(updated_meeting)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete meeting (set is_active=False) with audit"""
    meeting_obj = await get_meeting_or_404(db, meeting_id)
    
    meeting_obj.is_active = False
    meeting_obj.updated_by_id = current_user.id
    meeting_obj.updated_at = datetime.now()
    
    await db.commit()



@router.post("/{meeting_id}/members")
async def add_participant(
    meeting_id: UUID,
    participant_data: ParticipantCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db),
):
    # Get the meeting object
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    participant = MeetingParticipant(
        meeting_id=meeting_id,  # Use meeting_id directly
        name=participant_data.name,
        email=participant_data.email,
        telephone=getattr(participant_data, 'telephone', None),
        title=getattr(participant_data, 'title', None),
        organization=getattr(participant_data, 'organization', None),
        is_chairperson=getattr(participant_data, 'is_chairperson', False),
        is_secretary=getattr(participant_data, 'is_secretary', False),
        attendance_status=getattr(participant_data, 'attendance_status', 'pending'),
        apology_comment=getattr(participant_data, 'apology_comment', None),
        created_by_id=current_user.id  # Use created_by_id instead of user_id
    )
    
    db.add(participant)
    db.commit()
    db.refresh(participant)
    
    return participant

# ==================== MEETING MINUTES ====================

@router.post("/{meeting_id}/minutes", response_model=MeetingMinutesResponse, status_code=status.HTTP_201_CREATED)
async def add_meeting_minutes(
    meeting_id: UUID,
    minutes_in: MeetingMinutesCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Add minutes to meeting with audit fields"""
    await get_meeting_or_404(db, meeting_id)
    
    minutes = await meeting_crud.add_minutes(db, meeting_id, minutes_in, current_user.id)
    
    # Reload with actions to ensure complete response
    query = select(MeetingMinutes).options(
        selectinload(MeetingMinutes.actions),
        selectinload(MeetingMinutes.created_by),
        selectinload(MeetingMinutes.updated_by)
    ).where(MeetingMinutes.id == minutes.id)
    
    result = await db.execute(query)
    return result.scalar_one()


@router.get("/{meeting_id}/minutes", response_model=List[MeetingMinutesResponse])
async def get_meeting_minutes(
    meeting_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Get all minutes for a meeting"""
    await get_meeting_or_404(db, meeting_id)
    
    minutes_list = await meeting_minutes.get_meeting_minutes(
        db=db, meeting_id=meeting_id, skip=skip, limit=limit
    )
    
    return [build_minutes_response(minute) for minute in minutes_list]


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
    await get_meeting_or_404(db, meeting_id)
    
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
    
    return [build_status_history_response(history) for history in history_list]


@router.get("/{meeting_id}/history/latest", response_model=Optional[MeetingStatusHistoryResponse])
async def get_latest_meeting_status_history(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get the latest status change for a meeting"""
    await get_meeting_or_404(db, meeting_id)
    
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
    
    return build_status_history_response(history) if history else None


# ==================== MEETING PARTICIPANTS ====================

@router.get("/{meeting_id}/participants", response_model=List[MeetingParticipantResponse])
async def get_meeting_participants(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all participants for a meeting"""
    # Verify meeting exists
    meeting = await meeting_crud.get(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Get participants - note: remove trailing slash in URL pattern
    participants = await meeting_participant.get_by_meeting(db, meeting_id)
    
    # Ensure we always return a list, even if empty
    return participants or []



@router.patch("/{meeting_id}/participants/{participant_id}", response_model=MeetingParticipantResponse)
async def update_participant_attendance(
    meeting_id: UUID,
    participant_id: UUID,
    attendance_update: MeetingParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update participant attendance status"""
    await get_meeting_or_404(db, meeting_id)
    
    participant = await meeting_participant.update_attendance(
        db, participant_id, attendance_update.attendance_status, current_user.id
    )
    
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    
    return participant


# ==================== MEETING NOTIFICATIONS ====================

@router.post("/{meeting_id}/notify-participants")
async def notify_meeting_participants(
    meeting_id: str,
    notification_data: NotificationRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Send notifications to meeting participants"""
    logger.debug("=" * 80)
    logger.debug("NOTIFY PARTICIPANTS ENDPOINT CALLED")
    logger.debug(f"Meeting ID: {meeting_id}")
    logger.debug(f"Participant IDs: {notification_data.participant_ids}")
    logger.debug("=" * 80)

    meeting = await get_meeting_or_404(db, UUID(meeting_id))
    
    # Get participants from meeting_participants table
    result = await db.execute(
        select(MeetingParticipant)
        .where(
            MeetingParticipant.id.in_(notification_data.participant_ids),
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True
        )
    )
    participants = result.scalars().all()
    
    if not participants:
        raise HTTPException(status_code=404, detail="No participants found")
    
    sent_count = 0
    results = []
    
    for participant in participants:
        for notif_type in notification_data.notification_type:
            try:
                success = await _send_notification_by_type(
                    notif_type, participant, meeting, notification_data.custom_message
                )
                if success:
                    sent_count += 1
                results.append(_build_notification_result(participant, notif_type, success))
            except Exception as e:
                results.append(_build_notification_result(participant, notif_type, False, str(e)))
                logger.error(f"Failed to send {notif_type} to {participant.name}: {e}")
    
    return {
        "success": True,
        "sent": sent_count,
        "total": len(participants) * len(notification_data.notification_type),
        "results": results,
        "meeting_title": meeting.title
    }


async def _send_notification_by_type(notif_type: str, participant, meeting, custom_message: str) -> bool:
    """Helper to send notification based on type"""
    if notif_type == 'email' and participant.email:
        return await send_email_notification(
            to_email=participant.email,
            meeting=meeting,
            custom_message=custom_message,
            participant_name=participant.name
        )
    elif notif_type in ['whatsapp', 'sms'] and participant.telephone:
        logger.info(f"Sending {notif_type.upper()} to {participant.telephone} for meeting {meeting.title}")
        # Implement actual API calls here
        return True
    return False


def _build_notification_result(participant, notif_type: str, success: bool, error: str = None) -> dict:
    """Build notification result dictionary"""
    result = {
        "participant": participant.name,
        "type": notif_type,
        "status": "sent" if success else "failed",
        "contact": participant.email if notif_type == 'email' else participant.telephone
    }
    if error:
        result["reason"] = error
    elif not success:
        result["reason"] = f"No {notif_type} contact available"
    return result


# ==================== EMAIL NOTIFICATION HELPER ====================

async def send_email_notification(to_email: str, meeting, custom_message: str = "", participant_name: str = "") -> bool:
    """Send email notification using existing email service"""
    try:
        meeting_time = f"{meeting.start_time} - {meeting.end_time}" if meeting.start_time else "Time TBD"
        meeting_date = meeting.meeting_date.strftime("%A, %B %d, %Y") if meeting.meeting_date else "Date TBD"
        
        is_online = getattr(meeting, 'platform', None) and meeting.platform != 'physical'
        location_text = meeting.location_text or "Location TBD"
        meeting_link = getattr(meeting, 'meeting_link', '')
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Meeting Notification</title></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                <h2>📋 Meeting Invitation</h2>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <p>Dear <strong>{participant_name or 'Participant'}</strong>,</p>
                <p>You have been invited to:</p>
                <h3>{meeting.title}</h3>
                <p><strong>Date:</strong> {meeting_date}</p>
                <p><strong>Time:</strong> {meeting_time}</p>
                <p><strong>{'Online Meeting' if is_online else 'Location'}:</strong> {location_text}</p>
                {f'<p><strong>Join Link:</strong> <a href="{meeting_link}">{meeting_link}</a></p>' if meeting_link else ''}
                {f'<p><strong>Additional Information:</strong></p><p>{custom_message}</p>' if custom_message else ''}
                <hr>
                <p style="font-size: 12px; color: #999;">This is an automated notification from the Meeting Management System.</p>
            </div>
        </body>
        </html>
        """
        
        # Check if email service is configured
        if hasattr(email_service, 'is_configured') and email_service.is_configured():
            return await email_service.send_email(
                to_email=to_email,
                subject=f"📅 Meeting Invitation: {meeting.title}",
                html_content=html_content
            )
        else:
            logger.warning(f"Email service not configured, would send to {to_email}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {e}")
        return False


async def get_default_meeting_status(db: AsyncSession) -> Optional[MeetingStatus]:
    """Get the default meeting status (usually 'scheduled')"""
    result = await db.execute(
        select(MeetingStatus).where(
            MeetingStatus.code == 'scheduled',
            MeetingStatus.is_active == True
        )
    )
    status = result.scalar_one_or_none()
    
    if not status:
        result = await db.execute(
            select(MeetingStatus).where(MeetingStatus.is_active == True).limit(1)
        )
        status = result.scalar_one_or_none()
    
    return status


# ==================== ZOOM INTEGRATION (PLACEHOLDER) ====================

@router.post("/create-zoom-meeting")
async def create_zoom_meeting(
    meeting_data: ZoomMeetingCreate,
    db: AsyncSession = Depends(deps.get_db)
):
    """Create a Zoom meeting using Zoom API"""
    # Implement Zoom API integration
    return {
        "join_url": "https://zoom.us/j/123456789",
        "id": "123456789",
        "password": "123456"
    }




# ==================== MEETING AUDIT LOGS ====================


from sqlalchemy import cast, String
@router.get("/{meeting_id}/audit-logs")
async def get_meeting_audit_logs(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    user_id: Optional[UUID] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
):
    """Get audit logs for a specific meeting by collecting all related record IDs"""
    await get_meeting_or_404(db, meeting_id)
    
    meeting_id_str = str(meeting_id)
    
    # Collect all related record IDs from different tables
    
    # 1. Get all participant IDs for this meeting
    participants_query = select(MeetingParticipant.id).where(
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.is_active == True
    )
    participants_result = await db.execute(participants_query)
    participant_ids = [str(row) for row in participants_result.scalars().all()]
    
    # 2. Get all minutes IDs for this meeting
    minutes_query = select(MeetingMinutes.id).where(
        MeetingMinutes.meeting_id == meeting_id,
        MeetingMinutes.is_active == True
    )
    minutes_result = await db.execute(minutes_query)
    minutes_ids = [str(row) for row in minutes_result.scalars().all()]
    
    # 3. Get all action IDs for this meeting (via minutes)
    # MeetingAction has minute_id that references MeetingMinutes.id
    action_ids = []
    if minutes_ids:
        actions_query = select(MeetingAction.id).where(
            MeetingAction.minute_id.in_(minutes_ids),
            MeetingAction.is_active == True
        )
        actions_result = await db.execute(actions_query)
        action_ids = [str(row) for row in actions_result.scalars().all()]
    
    # 4. Get all document IDs for this meeting
    documents_query = select(MeetingDocument.id).where(
        MeetingDocument.meeting_id == meeting_id,
        MeetingDocument.is_active == True
    )
    documents_result = await db.execute(documents_query)
    document_ids = [str(row) for row in documents_result.scalars().all()]
    
    # 5. Get all status history IDs for this meeting
    history_query = select(MeetingStatusHistory.id).where(
        MeetingStatusHistory.meeting_id == meeting_id,
        MeetingStatusHistory.is_active == True
    )
    history_result = await db.execute(history_query)
    history_ids = [str(row) for row in history_result.scalars().all()]
    
    # 6. Get meeting series IDs if they exist (meeting_series table)
    # This depends on your schema - you might have meeting_series table
    series_ids = []
    # If you have meeting_series table with meeting_id reference
    # series_query = select(MeetingSeries.id).where(MeetingSeries.meeting_id == meeting_id)
    # series_result = await db.execute(series_query)
    # series_ids = [str(row) for row in series_result.scalars().all()]
    
    # Build OR conditions for audit log query
    conditions = [
        # Direct meeting record
        and_(
            AuditLog.table_name == 'meetings',
            AuditLog.record_id == meeting_id_str
        )
    ]
    
    # Add conditions for each related table
    if participant_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_participants',
                AuditLog.record_id.in_(participant_ids)
            )
        )
    
    if minutes_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_minutes',
                AuditLog.record_id.in_(minutes_ids)
            )
        )
    
    if action_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_actions',
                AuditLog.record_id.in_(action_ids)
            )
        )
    
    if document_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_documents',
                AuditLog.record_id.in_(document_ids)
            )
        )
    
    if history_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_status_history',
                AuditLog.record_id.in_(history_ids)
            )
        )
    
    if series_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_series',
                AuditLog.record_id.in_(series_ids)
            )
        )
    
    # Build main query
    query = select(AuditLog).where(or_(*conditions))
    
    # Apply additional filters
    if search:
        query = query.where(
            or_(
                AuditLog.action.ilike(f"%{search}%"),
                AuditLog.changes_summary.ilike(f"%{search}%"),
                AuditLog.username.ilike(f"%{search}%")
            )
        )
    
    if action:
        query = query.where(AuditLog.action == action)
    
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
    
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination and ordering
    query = query.order_by(desc(AuditLog.timestamp)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    # Build response
    items = []
    for log in logs:
        items.append({
            "id": str(log.id),
            "timestamp": log.timestamp,
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
            "user_agent": log.user_agent,
            "status": log.status,
           
            "extra_data": log.extra_data,
            "created_at": log.timestamp
        })
    
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 1
    }


@router.get("/{meeting_id}/audit-logs/filters")
async def get_audit_log_filters(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get available filter options for audit logs"""
    await get_meeting_or_404(db, meeting_id)
    
    meeting_id_str = str(meeting_id)
    
    # Collect all related record IDs
    participants_query = select(MeetingParticipant.id).where(
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.is_active == True
    )
    participants_result = await db.execute(participants_query)
    participant_ids = [str(row) for row in participants_result.scalars().all()]
    
    minutes_query = select(MeetingMinutes.id).where(
        MeetingMinutes.meeting_id == meeting_id,
        MeetingMinutes.is_active == True
    )
    minutes_result = await db.execute(minutes_query)
    minutes_ids = [str(row) for row in minutes_result.scalars().all()]
    
    # Get action IDs via minutes (NOT directly by meeting_id)
    action_ids = []
    if minutes_ids:
        actions_query = select(MeetingAction.id).where(
            MeetingAction.minute_id.in_(minutes_ids),
            MeetingAction.is_active == True
        )
        actions_result = await db.execute(actions_query)
        action_ids = [str(row) for row in actions_result.scalars().all()]
    
    documents_query = select(MeetingDocument.id).where(
        MeetingDocument.meeting_id == meeting_id,
        MeetingDocument.is_active == True
    )
    documents_result = await db.execute(documents_query)
    document_ids = [str(row) for row in documents_result.scalars().all()]
    
    history_query = select(MeetingStatusHistory.id).where(
        MeetingStatusHistory.meeting_id == meeting_id,
        MeetingStatusHistory.is_active == True
    )
    history_result = await db.execute(history_query)
    history_ids = [str(row) for row in history_result.scalars().all()]
    
    # Build conditions for filters
    conditions = [
        # Direct meeting record
        and_(
            AuditLog.table_name == 'meetings',
            AuditLog.record_id == meeting_id_str
        )
    ]
    
    if participant_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_participants',
                AuditLog.record_id.in_(participant_ids)
            )
        )
    
    if minutes_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_minutes',
                AuditLog.record_id.in_(minutes_ids)
            )
        )
    
    if action_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_actions',
                AuditLog.record_id.in_(action_ids)
            )
        )
    
    if document_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_documents',
                AuditLog.record_id.in_(document_ids)
            )
        )
    
    if history_ids:
        conditions.append(
            and_(
                AuditLog.table_name == 'meeting_status_history',
                AuditLog.record_id.in_(history_ids)
            )
        )
    
    # Get unique actions
    action_query = select(distinct(AuditLog.action)).where(or_(*conditions))
    action_result = await db.execute(action_query)
    actions = [a for a in action_result.scalars().all() if a]
    
    # Get unique users
    user_query = select(
        AuditLog.user_id,
        AuditLog.username,
        AuditLog.user_email
    ).where(or_(*conditions)).distinct()
    
    user_result = await db.execute(user_query)
    users = []
    for row in user_result:
        if row.user_id:
            users.append({
                "id": str(row.user_id),
                "name": row.username or row.user_email or str(row.user_id),
                "email": row.user_email
            })
    
    return {
        "actions": sorted(actions),
        "users": users
    }




from fastapi import UploadFile, File, Form
from pathlib import Path
import shutil


# ==================== MEETING DOCUMENTS ====================

@router.get("/{meeting_id}/documents")
async def get_meeting_documents(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get all documents for a meeting"""
    await get_meeting_or_404(db, meeting_id)
    
    query = select(MeetingDocument).where(
        MeetingDocument.meeting_id == meeting_id,
        MeetingDocument.is_active == True
    ).offset(skip).limit(limit).order_by(desc(MeetingDocument.created_at))
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    items = []
    for doc in documents:
        items.append({
            "id": str(doc.id),
            "title": doc.title or doc.file_name,
            "file_name": doc.file_name,
            "file_size": doc.file_size,
            "mime_type": doc.mime_type or doc.content_type,
            "description": doc.description,
            "uploaded_by_name": doc.uploaded_by.username if doc.uploaded_by else None,
            "uploaded_at": doc.created_at,
            "created_at": doc.created_at,
        })
    
    return {
        "items": items,
        "total": len(items),
        "skip": skip,
        "limit": limit
    }


@router.post("/{meeting_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_meeting_document(
    meeting_id: UUID,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    document_type_id: Optional[UUID] = Form(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Upload a document for a meeting"""
    await get_meeting_or_404(db, meeting_id)
    
    # Create upload directory if it doesn't exist
    upload_dir = Path("uploads/meeting_documents")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = upload_dir / unique_filename
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Save file
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    
    # Create document record
    document = MeetingDocument(
        id=uuid.uuid4(),
        meeting_id=meeting_id,
        title=title or file.filename,
        file_name=file.filename,
        file_path=str(file_path),
        file_size=file_size,
        mime_type=file.content_type,
        content_type=file.content_type,
        description=description,
        document_type_id=document_type_id,
        uploaded_by_id=current_user.id,
        created_by_id=current_user.id,
        created_at=datetime.now(),
        is_active=True
    )
    
    db.add(document)
    await db.commit()
    await db.refresh(document)
    
    return {
        "id": str(document.id),
        "title": document.title,
        "file_name": document.file_name,
        "message": "Document uploaded successfully"
    }


@router.get("/documents/document/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Download a document by its ID"""
    # Find document
    query = select(MeetingDocument).where(
        MeetingDocument.id == document_id,
        MeetingDocument.is_active == True
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    # Check if file exists
    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    # Return file for download
    return FileResponse(
        path=file_path,
        filename=document.file_name,
        media_type=document.mime_type or "application/octet-stream"
    )


@router.delete("/documents/document/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete a document (soft delete)"""
    # Find document
    query = select(MeetingDocument).where(
        MeetingDocument.id == document_id,
        MeetingDocument.is_active == True
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    # Soft delete
    document.is_active = False
    document.updated_by_id = current_user.id
    document.updated_at = datetime.now()
    
    await db.commit()
    
    return None