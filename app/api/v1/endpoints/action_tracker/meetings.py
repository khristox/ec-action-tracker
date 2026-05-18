# app/api/v1/endpoints/action_tracker/meetings.py
"""
Meeting Management API Endpoints

This module handles all meeting-related operations including:
- CRUD operations for meetings
- Participant management
- Meeting minutes and actions
- Document management
- Notifications
- Audit logging
"""

import csv
import logging
import shutil
import uuid
from datetime import datetime, timedelta, date
from io import StringIO
from math import radians, sin, cos, sqrt, atan2
from pathlib import Path
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import and_, distinct, func, select, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import SQLAlchemyError

from app.api import deps
from app.core.security import get_current_user
from app.crud.meetings.action_tracker import meeting_crud, meeting_action, meeting_minutes, meeting_participant
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.general.dynamic_attribute import Attribute
from app.models.role import Role
from app.models.user import User
from app.models.meetings.action_tracker import (
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
from app.schemas.meetings import ParticipantMeetingSummarySchema
from app.services.email_service import email_service

from .status_utils import get_status_id_by_short_name, get_status_by_short_name, get_valid_status_short_names
from .utils import build_meeting_response as utils_build_meeting_response

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== CONSTANTS ====================

EARTH_RADIUS_KM = 6371
DEFAULT_PAGINATION_LIMIT = 12
MAX_PAGINATION_LIMIT = 100
DEFAULT_DOCUMENT_LIMIT = 100
MAX_DOCUMENT_LIMIT = 500
RADIUS_MIN_KM = 1
RADIUS_MAX_KM = 100

# Priority mapping for sorting
PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
STATUS_ORDER = {"pending": 0, "in_progress": 1, "completed": 2, "blocked": 3}

# ==================== HELPER FUNCTIONS ====================

async def get_meeting_or_404(db: AsyncSession, meeting_id: UUID) -> Meeting:
    """Get meeting by ID or raise 404"""
    meeting = await meeting_crud.get(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return meeting


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth.
    Returns distance in kilometers.
    """
    lat1, lon1 = radians(lat1), radians(lng1)
    lat2, lon2 = radians(lat2), radians(lng2)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return round(EARTH_RADIUS_KM * c, 2)


def build_meeting_list_response(meeting: Meeting) -> Optional[Dict[str, Any]]:
    """
    Build meeting response dictionary from ORM object.
    """
    if not meeting:
        return None
    
    return {
        "id": meeting.id,
        "title": meeting.title,
        "description": meeting.description,
        "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
        "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
        "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
        "location_text": meeting.location_text,
        "status": {
            "id": meeting.status.id,
            "short_name": meeting.status.short_name,
            "name": meeting.status.name,
            "description": meeting.status.description,
            "color": getattr(meeting.status, 'color', None)
        } if meeting.status else None,
        "status_id": meeting.status_id,
        "participants_count": len(meeting.participants) if meeting.participants else 0,
        "participants": [
            {
                "id": p.id,
                "full_name": getattr(p, 'full_name', None),
                "name": getattr(p, 'name', None),
                "email": getattr(p, 'email', None),
                "phone": getattr(p, 'phone', None)
            } for p in (meeting.participants or [])
        ],
        "created_by_id": meeting.created_by_id,
        "created_by": {
            "id": meeting.created_by.id,
            "full_name": getattr(meeting.created_by, 'full_name', None),
            "name": getattr(meeting.created_by, 'name', None),
            "email": getattr(meeting.created_by, 'email', None)
        } if meeting.created_by else None,
        "updated_by_id": meeting.updated_by_id,
        "updated_by": {
            "id": meeting.updated_by.id,
            "full_name": getattr(meeting.updated_by, 'full_name', None),
            "name": getattr(meeting.updated_by, 'name', None),
            "email": getattr(meeting.updated_by, 'email', None)
        } if meeting.updated_by else None,
        "created_at": meeting.created_at.isoformat() if meeting.created_at else None,
        "updated_at": meeting.updated_at.isoformat() if meeting.updated_at else None,
        "is_active": meeting.is_active,
        "is_recurring": getattr(meeting, 'is_recurring', False),
        "recurring_meeting_id": getattr(meeting, 'recurring_meeting_id', None),
        "total_occurrences_generated": getattr(meeting, 'total_occurrences_generated', 0),
        "latitude": getattr(meeting, 'latitude', None),
        "longitude": getattr(meeting, 'longitude', None),
        "venue": getattr(meeting, 'venue', None),
        "district_office": getattr(meeting, 'district_office', None),
        "district": getattr(meeting, 'district', None),
        "region": getattr(meeting, 'region', None),
        "is_virtual": getattr(meeting, 'is_virtual', False),
        "virtual_link": getattr(meeting, 'virtual_link', None),
        "is_mixed_mode": getattr(meeting, 'is_mixed_mode', False),
    }


async def build_meeting_items(
    meetings_list: List[Meeting],
    is_geo_search: bool = False,
    lat: Optional[float] = None,
    lng: Optional[float] = None
) -> List[Dict[str, Any]]:
    """Build meeting response items with location details and distance calculation."""
    items = []
    
    for meeting in meetings_list:
        try:
            meeting_dict = build_meeting_list_response(meeting)
            if not meeting_dict:
                continue
            
            meeting_dict["location_details"] = {
                "venue": meeting_dict.get("venue"),
                "district_office": meeting_dict.get("district_office"),
                "district": meeting_dict.get("district"),
                "region": meeting_dict.get("region"),
                "address": meeting_dict.get("location_text"),
                "latitude": meeting_dict.get("latitude"),
                "longitude": meeting_dict.get("longitude"),
                "is_virtual": meeting_dict.get("is_virtual", False),
                "virtual_link": meeting_dict.get("virtual_link", None),
                "is_mixed_mode": meeting_dict.get("is_mixed_mode", False)
            }
            
            if is_geo_search and lat and lng and meeting_dict.get("latitude") and meeting_dict.get("longitude"):
                distance = calculate_distance(lat, lng, meeting_dict["latitude"], meeting_dict["longitude"])
                meeting_dict["location_details"]["distance_km"] = distance
            
            items.append(meeting_dict)
            
        except Exception as e:
            logger.error(f"Error processing meeting {meeting.id}: {str(e)}")
            continue
    
    return items


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


    
async def sync_meeting_participants(
    db: AsyncSession,
    meeting_id: UUID,
    custom_participants: List[Dict[str, Any]],
    current_user: User
) -> List[MeetingParticipant]:
    """
    Sync meeting participants - add new, update existing, remove missing ones.
    """
    result = await db.execute(
        select(MeetingParticipant)
        .where(
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True
        )
    )
    existing_participants = result.scalars().all()
    
    existing_by_id = {str(p.id): p for p in existing_participants}
    existing_by_email = {p.email: p for p in existing_participants if p.email}
    existing_by_name = {p.name: p for p in existing_participants}
    
    kept_participant_ids = set()
    updated_participants = []
    
    for p_data in custom_participants:
        participant_id = str(p_data.get('id')) if p_data.get('id') else None
        email = p_data.get('email')
        name = p_data.get('name')
        
        existing = None
        if participant_id and participant_id in existing_by_id:
            existing = existing_by_id[participant_id]
        elif email and email in existing_by_email:
            existing = existing_by_email[email]
        elif name and name in existing_by_name:
            existing = existing_by_name[name]
        
        if existing:
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
    
    for participant in existing_participants:
        if str(participant.id) not in kept_participant_ids:
            participant.is_active = False
            participant.updated_by_id = current_user.id
            participant.updated_at = datetime.now()
    
    await db.flush()
    return updated_participants


async def update_meeting_common(
    db: AsyncSession,
    meeting_id: UUID,
    update_data: Dict[str, Any],
    current_user: User,
    source: str = "PUT"
) -> Optional[Meeting]:
    """Common function for updating meeting"""
    db_obj = await get_meeting_or_404(db, meeting_id)
    
    custom_participants = update_data.pop("custom_participants", None)
    
    new_start_time = update_data.get("start_time")
    new_end_time = update_data.get("end_time")
    
    effective_start_time = new_start_time if new_start_time else db_obj.start_time
    
    if new_end_time is not None:
        if new_end_time <= effective_start_time:
            new_end_time = effective_start_time + timedelta(hours=1)
            update_data["end_time"] = new_end_time
            logger.warning(f"Fixed invalid end_time: set to {new_end_time}")
    
    status_comment = update_data.pop("status_comment", None)
    status_date_raw = update_data.pop("status_date", None)
    old_status_id = db_obj.status_id
    new_status_id = update_data.get("status_id")
    
    for field, value in update_data.items():
        if hasattr(db_obj, field) and value is not None:
            setattr(db_obj, field, value)
    
    db_obj.updated_by_id = current_user.id
    db_obj.updated_at = datetime.now()
    
    if new_status_id and str(new_status_id) != str(old_status_id):
        try:
            status_date = datetime.fromisoformat(status_date_raw.replace('Z', '+00:00')) if isinstance(status_date_raw, str) else (status_date_raw or datetime.now())
        except ValueError:
            status_date = datetime.now()
        
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
    
    if custom_participants is not None:
        await sync_meeting_participants(db, meeting_id, custom_participants, current_user)
    
    await db.commit()
    await db.refresh(db_obj)
    
    return await meeting_crud.get_meeting_with_details(db, meeting_id)


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


# ==================== STATIC ROUTES (MUST COME FIRST) ====================
# These routes have specific paths and should NOT be interpreted as UUID parameters

@router.get("/status-options")
async def get_meeting_status_options(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all available meeting statuses for filtering"""
    
    result = await db.execute(
        select(MeetingStatus).where(MeetingStatus.is_active == True)
        .order_by(MeetingStatus.sort_order, MeetingStatus.name)
    )
    statuses = result.scalars().all()
    
    return {
        "options": [
            {
                "value": str(status.id),
                "label": status.name,
                "short_name": status.short_name,
                "code": status.code,
                "color": getattr(status, 'color', '#808080'),
                "description": status.description
            }
            for status in statuses
        ],
        "default": "all"
    }


@router.get("/statuses")
async def get_all_statuses(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all meeting statuses with counts"""
    
    # Get all statuses
    result = await db.execute(
        select(MeetingStatus).where(MeetingStatus.is_active == True)
        .order_by(MeetingStatus.sort_order, MeetingStatus.name)
    )
    statuses = result.scalars().all()
    
    today = date.today()
    
    # Get counts for each status
    status_data = []
    for status in statuses:
        # Count all meetings with this status
        total_count_result = await db.execute(
            select(func.count(Meeting.id)).where(
                Meeting.status_id == status.id,
                Meeting.is_active == True
            )
        )
        total_count = total_count_result.scalar() or 0
        
        # Count upcoming meetings with this status
        upcoming_count_result = await db.execute(
            select(func.count(Meeting.id)).where(
                Meeting.status_id == status.id,
                Meeting.is_active == True,
                Meeting.meeting_date >= today
            )
        )
        upcoming_count = upcoming_count_result.scalar() or 0
        
        # Count past meetings with this status
        past_count_result = await db.execute(
            select(func.count(Meeting.id)).where(
                Meeting.status_id == status.id,
                Meeting.is_active == True,
                Meeting.meeting_date < today
            )
        )
        past_count = past_count_result.scalar() or 0
        
        status_data.append({
            "id": str(status.id),
            "name": status.name,
            "short_name": status.short_name,
            "code": status.code,
            "color": getattr(status, 'color', '#808080'),
            "description": status.description,
            "counts": {
                "total": total_count,
                "upcoming": upcoming_count,
                "past": past_count
            }
        })
    
    return {
        "statuses": status_data,
        "total_meetings": sum(s["counts"]["total"] for s in status_data)
    }


@router.get("/filter-options")
async def get_filter_options(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all available filter options for the meetings dropdown"""
    
    today = date.today()
    
    # Get all active statuses
    status_result = await db.execute(
        select(MeetingStatus).where(MeetingStatus.is_active == True)
        .order_by(MeetingStatus.name)
    )
    statuses = status_result.scalars().all()
    
    # Get unique locations
    location_result = await db.execute(
        select(distinct(Meeting.location_text))
        .where(Meeting.is_active == True, Meeting.location_text.isnot(None))
        .order_by(Meeting.location_text)
    )
    locations = [loc for loc in location_result.scalars().all() if loc]
    
    # Get unique districts
    district_result = await db.execute(
        select(distinct(Meeting.district_office))
        .where(Meeting.is_active == True, Meeting.district_office.isnot(None))
        .order_by(Meeting.district_office)
    )
    districts = [dist for dist in district_result.scalars().all() if dist]
    
    # Get unique regions
    region_result = await db.execute(
        select(distinct(Meeting.region))
        .where(Meeting.is_active == True, Meeting.region.isnot(None))
        .order_by(Meeting.region)
    )
    regions = [reg for reg in region_result.scalars().all() if reg]
    
    # Get date range
    date_range_result = await db.execute(
        select(
            func.min(Meeting.meeting_date).label("min_date"),
            func.max(Meeting.meeting_date).label("max_date")
        ).where(Meeting.is_active == True)
    )
    date_range = date_range_result.one()
    
    return {
        "statuses": [
            {
                "value": str(s.id),
                "label": s.name,
                "short_name": s.short_name,
                "color": getattr(s, 'color', '#808080')
            }
            for s in statuses
        ],
        "locations": locations,
        "districts": districts,
        "regions": regions,
        "date_range": {
            "min": date_range.min_date.isoformat() if date_range.min_date else None,
            "max": date_range.max_date.isoformat() if date_range.max_date else None
        },
        "defaults": {
            "show_upcoming": True,
            "show_past": False,
            "limit": DEFAULT_PAGINATION_LIMIT
        }
    }


@router.get("/participant/check")
async def check_if_participant(
    meeting_id: int = Query(..., description="Meeting ID to check"),
    user_id: Optional[int] = Query(None, description="User ID to check"),
    email: Optional[str] = Query(None, description="User email to check"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if a user is a participant in a specific meeting."""
    target_email = None
    
    if user_id is not None:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
        target_email = user.email
    elif email is not None:
        target_email = email
    else:
        target_email = current_user.email
    
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail=f"Meeting with ID {meeting_id} not found")
    
    is_participant = any(p.email == target_email for p in meeting.participants)
    
    return {
        "meeting_id": meeting_id,
        "user_email": target_email,
        "is_participant": is_participant,
        "meeting_title": meeting.title,
        "meeting_status": meeting.status.value if meeting.status else "scheduled"
    }


@router.get("/participant/detailed", response_model=List[ParticipantMeetingSummarySchema])
async def get_meetings_as_participant_detailed(
    user_id: Optional[int] = Query(None, description="User ID to filter meetings where user is a participant"),
    email: Optional[str] = Query(None, description="Email address to filter meetings where user is a participant"),
    status: Optional[str] = Query(None, description="Filter by meeting status: scheduled, in_progress, completed, cancelled"),
    upcoming_only: bool = Query(False, description="Only show upcoming meetings"),
    past_only: bool = Query(False, description="Only show past meetings"),
    include_actions: bool = Query(True, description="Include action items assigned to user"),
    include_minutes: bool = Query(True, description="Include meeting minutes"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all meetings where the specified user is a participant with detailed information."""
    
    # Resolve target user
    target_user = await _resolve_target_user_simple(user_id, email, current_user, db)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_email = target_user.email
    
    # Build query
    query = select(Meeting).join(
        Meeting.participants
    ).where(
        Meeting.participants.any(email=target_email)
    ).options(
        selectinload(Meeting.participants),
        selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions).selectinload(MeetingAction.overall_status),
        selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions).selectinload(MeetingAction.assigned_to)
    )
    
    if status:
        valid_statuses = [s.value for s in MeetingStatus] if hasattr(MeetingStatus, 'value') else []
        if status.lower() not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        query = query.where(Meeting.status == status.lower())
    
    now = datetime.utcnow()
    if upcoming_only:
        query = query.where(Meeting.meeting_date >= now)
    if past_only:
        query = query.where(Meeting.meeting_date < now)
    
    query = query.order_by(Meeting.meeting_date.asc()).offset(offset).limit(limit)
    result = await db.execute(query)
    meetings = result.scalars().all()
    
    # Build response
    response = []
    for meeting in meetings:
        minutes = meeting.minutes if include_minutes else []
        
        user_action_items = []
        if include_actions:
            for minute in minutes:
                for action in minute.actions:
                    if action.assigned_to_id == target_user.id:
                        status_name = "pending"
                        if action.overall_status:
                            if hasattr(action.overall_status, 'shortname'):
                                status_name = action.overall_status.shortname
                            elif hasattr(action.overall_status, 'name'):
                                status_name = action.overall_status.name
                        
                        user_action_items.append({
                            "id": action.id,
                            "description": action.description,
                            "assigned_to_id": action.assigned_to_id,
                            "assigned_to_name": action.assigned_to.full_name or action.assigned_to.name if action.assigned_to else None,
                            "due_date": action.due_date,
                            "status": status_name,
                            "priority": action.priority,
                            "remarks": action.remarks,
                            "completed_at": action.completed_at,
                            "overall_progress_percentage": action.overall_progress_percentage,
                            "assigned_to": {
                                "id": action.assigned_to.id,
                                "full_name": action.assigned_to.full_name,
                                "name": action.assigned_to.name,
                                "email": action.assigned_to.email
                            } if action.assigned_to else None
                        })
        
        formatted_minutes = []
        for minute in minutes:
            minute_actions = []
            for action in minute.actions:
                action_status = "pending"
                if action.overall_status:
                    if hasattr(action.overall_status, 'shortname'):
                        action_status = action.overall_status.shortname
                    elif hasattr(action.overall_status, 'name'):
                        action_status = action.overall_status.name
                
                minute_actions.append({
                    "id": action.id,
                    "description": action.description,
                    "assigned_to_id": action.assigned_to_id,
                    "assigned_to_name": action.assigned_to.full_name or action.assigned_to.name if action.assigned_to else None,
                    "due_date": action.due_date,
                    "status": action_status,
                    "priority": action.priority,
                    "remarks": action.remarks,
                    "completed_at": action.completed_at,
                    "overall_progress_percentage": action.overall_progress_percentage
                })
            
            formatted_minutes.append({
                "id": minute.id,
                "topic": minute.topic,
                "discussion": minute.discussion,
                "decisions": minute.decisions,
                "created_at": minute.created_at,
                "actions": minute_actions
            })
        
        participants = []
        for participant in meeting.participants:
            participants.append({
                "id": participant.id,
                "name": participant.name,
                "email": participant.email,
                "is_current_user": participant.email == target_email
            })
        
        action_items_count = len(user_action_items)
        pending_actions_count = len([a for a in user_action_items if a.get("status") == "pending"])
        in_progress_actions_count = len([a for a in user_action_items if a.get("status") == "in_progress"])
        completed_actions_count = len([a for a in user_action_items if a.get("status") == "completed"])
        overdue_actions_count = len([
            a for a in user_action_items 
            if a.get("due_date") and a.get("due_date") < now and a.get("status") != "completed"
        ])
        
        response.append({
            "meeting": {
                "id": meeting.id,
                "title": meeting.title,
                "description": meeting.description,
                "start_date": meeting.meeting_date,
                "end_date": meeting.meeting_date,
                "location": meeting.location,
                "meeting_link": meeting.meeting_link,
                "status": meeting.status.value if meeting.status else "scheduled",
                "is_virtual": getattr(meeting, 'is_virtual', False),
                "created_by": meeting.created_by,
                "created_at": meeting.created_at,
                "updated_at": meeting.updated_at,
                "participants": participants,
                "minutes": formatted_minutes if include_minutes else []
            },
            "user_info": {
                "id": target_user.id,
                "email": target_email,
                "name": target_user.full_name or target_user.name if target_user else None
            },
            "user_action_items": user_action_items,
            "minutes_count": len(minutes),
            "action_items_count": action_items_count,
            "pending_actions_count": pending_actions_count,
            "in_progress_actions_count": in_progress_actions_count,
            "completed_actions_count": completed_actions_count,
            "overdue_actions_count": overdue_actions_count
        })

    return response


@router.post("/create-zoom-meeting")
async def create_zoom_meeting(
    meeting_data: ZoomMeetingCreate,
    db: AsyncSession = Depends(deps.get_db)
):
    """Create a Zoom meeting using Zoom API"""
    # TODO: Implement actual Zoom API integration
    return {
        "join_url": "https://zoom.us/j/123456789",
        "id": "123456789",
        "password": "123456"
    }


@router.get("/documents/document/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Download a document by its ID"""
    query = select(MeetingDocument).where(
        MeetingDocument.id == document_id,
        MeetingDocument.is_active == True
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
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
    query = select(MeetingDocument).where(
        MeetingDocument.id == document_id,
        MeetingDocument.is_active == True
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    document.is_active = False
    document.updated_by_id = current_user.id
    document.updated_at = datetime.now()
    
    await db.commit()


# ==================== MAIN MEETINGS CRUD ROUTES ====================

@router.get("/", response_model=MeetingPaginationResponse)
async def get_meetings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(DEFAULT_PAGINATION_LIMIT, ge=1, le=MAX_PAGINATION_LIMIT, description="Items per page"),
    show_past: bool = Query(False, description="Include past meetings"),
    show_upcoming: bool = Query(True, description="Include upcoming meetings"),
    status: Optional[str] = Query(None, description="Filter by status (Active, Completed, Cancelled, etc.)"),
    status_id: Optional[UUID] = Query(None, description="Filter by status UUID"),
    search: Optional[str] = Query(None, description="Search by title or description"),
    location: Optional[str] = Query(None, description="Filter by location name"),
    district: Optional[str] = Query(None, description="Filter by district office"),
    region: Optional[str] = Query(None, description="Filter by region"),
    lat: Optional[float] = Query(None, description="Latitude for proximity search"),
    lng: Optional[float] = Query(None, description="Longitude for proximity search"),
    radius_km: Optional[float] = Query(RADIUS_MIN_KM, ge=RADIUS_MIN_KM, le=RADIUS_MAX_KM, description="Search radius in kilometers"),
    sort_by: str = Query("meeting_date", description="Sort field: meeting_date, title, created_at"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
):
    """
    Get paginated list of meetings with comprehensive filtering.
    
    - show_past: Include meetings with dates before today
    - show_upcoming: Include meetings with dates today or in the future
    - status: Filter by status name (case-insensitive partial match)
    - status_id: Filter by exact status UUID
    """
    skip = (page - 1) * limit
    today = date.today()
    
    try:
        # Build base query
        query = select(Meeting).options(
            selectinload(Meeting.status),
            selectinload(Meeting.participants),
            selectinload(Meeting.created_by),
            selectinload(Meeting.updated_by),
        ).where(Meeting.is_active == True)
        
        # Apply date filtering based on flags
        date_conditions = []
        if show_upcoming:
            date_conditions.append(Meeting.meeting_date >= today)
        if show_past:
            date_conditions.append(Meeting.meeting_date < today)
        
        if date_conditions:
            query = query.where(or_(*date_conditions))
        elif not show_upcoming and not show_past:
            # If both false, default to show upcoming only
            query = query.where(Meeting.meeting_date >= today)
        
        # Apply status filtering
        if status_id:
            # Filter by exact status UUID
            query = query.where(Meeting.status_id == status_id)
        elif status:
            # Filter by status name (case-insensitive partial match)
            status_filter = f"%{status}%"
            query = query.where(
                or_(
                    Meeting.status.has(MeetingStatus.name.ilike(status_filter)),
                    Meeting.status.has(MeetingStatus.short_name.ilike(status_filter)),
                    Meeting.status.has(MeetingStatus.code.ilike(status_filter))
                )
            )
        
        # Apply search filter
        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Meeting.title.ilike(search_term),
                    Meeting.description.ilike(search_term),
                    Meeting.location_text.ilike(search_term)
                )
            )
        
        # Apply location-based filters
        location_conditions = []
        if location:
            location_conditions.append(Meeting.location_text.ilike(f"%{location}%"))
        if district:
            location_conditions.append(Meeting.district_office.ilike(f"%{district}%"))
        if region:
            location_conditions.append(Meeting.region.ilike(f"%{region}%"))
        
        if location_conditions:
            query = query.where(and_(*location_conditions))
        
        # Apply geo-location proximity search
        is_geo_search = lat is not None and lng is not None
        if is_geo_search:
            query = query.where(
                Meeting.latitude.isnot(None),
                Meeting.longitude.isnot(None)
            )
        
        # Apply sorting
        sort_column = getattr(Meeting, sort_by, Meeting.meeting_date)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))
        
        # Execute paginated query
        paginated_query = query.offset(skip).limit(limit)
        result = await db.execute(paginated_query)
        meetings_list = result.scalars().all()
        
        # Build count query with same filters (without pagination)
        count_query = select(func.count(Meeting.id)).where(Meeting.is_active == True)
        
        if date_conditions:
            count_query = count_query.where(or_(*date_conditions))
        elif not show_upcoming and not show_past:
            count_query = count_query.where(Meeting.meeting_date >= today)
        
        if status_id:
            count_query = count_query.where(Meeting.status_id == status_id)
        elif status:
            count_query = count_query.where(
                or_(
                    Meeting.status.has(MeetingStatus.name.ilike(status_filter)),
                    Meeting.status.has(MeetingStatus.short_name.ilike(status_filter)),
                    Meeting.status.has(MeetingStatus.code.ilike(status_filter))
                )
            )
        
        if search:
            count_query = count_query.where(
                or_(
                    Meeting.title.ilike(search_term),
                    Meeting.description.ilike(search_term),
                    Meeting.location_text.ilike(search_term)
                )
            )
        
        if location_conditions:
            count_query = count_query.where(and_(*location_conditions))
        
        if is_geo_search:
            count_query = count_query.where(
                Meeting.latitude.isnot(None),
                Meeting.longitude.isnot(None)
            )
        
        count_res = await db.execute(count_query)
        total_count = count_res.scalar() or 0
        
        # Build response items
        items = await build_meeting_items(meetings_list, is_geo_search, lat, lng)
        
        return MeetingPaginationResponse(
            items=items,
            total=total_count,
            page=page,
            size=limit,
            pages=(total_count + limit - 1) // limit if limit > 0 else 1
        )
        
    except SQLAlchemyError as e:
        logger.error(f"Database error in get_meetings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in get_meetings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@router.post("/", response_model=MeetingCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new meeting with audit fields"""
    try:
        logger.debug(f"Creating meeting for user: {current_user.id}")
        
        # Convert to dict and remove problematic fields
        meeting_dict = meeting_in.model_dump(exclude_unset=True)
        
        # List of fields that don't exist in your Meeting model
        fields_to_remove = [
            'has_online_meeting', 'has_physical_meeting', 'platform',
            'meeting_link', 'passcode', 'dial_in_numbers', 'venue',
            'address', 'location_instructions', 'send_reminders',
            'reminder_minutes_before', 'meeting_id_online', 'meeting_id',
            'status', 'participant_list_id'
        ]
        
        for field in fields_to_remove:
            meeting_dict.pop(field, None)
        
        # Log what we're actually sending to CRUD
        logger.info(f"Creating meeting with data: {meeting_dict}")
        
        result = await meeting_crud.create_with_participants(db, meeting_dict, current_user.id)
        
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

# ==================== DYNAMIC ROUTES (WITH PATH PARAMETERS - GO LAST) ====================


# In your meetings.py - CORRECT version

@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    meeting = await meeting_crud.get_meeting_with_details(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # MUST have await here
    response =  utils_build_meeting_response(meeting, db)
    return response

@router.put("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: UUID,
    meeting_in: MeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Full update meeting with audit fields and participant management"""
    update_data = meeting_in.model_dump(exclude_unset=True)
    updated_meeting = await update_meeting_common(db, meeting_id, update_data, current_user, "PUT")
    return utils_build_meeting_response(updated_meeting)


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def partial_update_meeting(
    meeting_id: UUID,
    meeting_in: MeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Partial update meeting - only update provided fields"""
    update_data = meeting_in.model_dump(exclude_unset=True)
    updated_meeting = await update_meeting_common(db, meeting_id, update_data, current_user, "PATCH")
    return utils_build_meeting_response(updated_meeting)


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
    return utils_build_meeting_response(updated_meeting)


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
    """Add a participant to a meeting"""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    name = None
    email = None
    telephone = None
    title = None
    organization = None
    
    if participant_data.user_id:
        user_result = await db.execute(
            select(User).where(User.id == participant_data.user_id, User.is_active == True)
        )
        user_details = user_result.scalar_one_or_none()
        
        if not user_details:
            raise HTTPException(status_code=404, detail=f"User with ID {participant_data.user_id} not found")
        
        name = user_details.full_name or f"{user_details.first_name or ''} {user_details.last_name or ''}".strip() or user_details.username
        email = user_details.email
        telephone = getattr(user_details, 'telephone', None) or getattr(user_details, 'phone', None)
        title = getattr(user_details, 'title', None)
        organization = getattr(user_details, 'organization', None)
    else:
        if not participant_data.name:
            raise HTTPException(status_code=400, detail="Participant name is required")
        name = participant_data.name
        email = participant_data.email
        telephone = participant_data.telephone
        title = participant_data.title
        organization = participant_data.organization
    
    # Check if participant already exists
    existing_conditions = []
    if email:
        existing_conditions.append(MeetingParticipant.email == email)
    existing_conditions.append(MeetingParticipant.name == name)
    
    existing_result = await db.execute(
        select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True,
            or_(*existing_conditions)
        )
    )
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=409, 
            detail=f"Participant '{name}' already exists in this meeting"
        )
    
    participant = MeetingParticipant(
        meeting_id=meeting_id,
        name=name,
        email=email,
        telephone=telephone,
        title=title,
        organization=organization,
        is_chairperson=participant_data.is_chairperson,
        is_secretary=participant_data.is_secretary,
        attendance_status=participant_data.attendance_status or "pending",
        apology_comment=participant_data.apology_comment,
        created_by_id=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        is_active=True
    )
    
    db.add(participant)
    await db.commit()
    await db.refresh(participant)
    
    return {
        "id": participant.id,
        "meeting_id": participant.meeting_id,
        "name": participant.name,
        "email": participant.email,
        "telephone": participant.telephone,
        "title": participant.title,
        "organization": participant.organization,
        "is_chairperson": participant.is_chairperson,
        "is_secretary": participant.is_secretary,
        "attendance_status": participant.attendance_status,
        "apology_comment": participant.apology_comment,
        "created_at": participant.created_at,
        "message": "Participant added successfully"
    }

# Replace the existing get_meeting_participants function in meetings.py with this:



@router.get("/{meeting_id}/participants", response_model=List[MeetingParticipantResponse])
@router.get("/{meeting_id}/participants/", response_model=List[MeetingParticipantResponse], include_in_schema=False)
async def get_meeting_participants(
    meeting_id: UUID,
    search: Optional[str] = Query(None, description="Search participants by name or email"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    include_inactive: bool = Query(False, description="Include inactive participants"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get all participants for a specific meeting.
    """
    try:
        # First verify meeting exists
        meeting = await meeting_crud.get(db, meeting_id)
        if not meeting:
            logger.warning(f"Meeting not found: {meeting_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Meeting with ID '{meeting_id}' not found"
            )
        
        # Get participants using the updated method
        participants = await meeting_participant.get_by_meeting(
            db=db,
            meeting_id=meeting_id,
            search=search,
            skip=skip,
            limit=limit,
            include_inactive=include_inactive
        )
        
        logger.info(f"Retrieved {len(participants)} participants for meeting {meeting_id}")
        
        # Convert to response models
        return [
            MeetingParticipantResponse(
                id=p.id,
                meeting_id=p.meeting_id,
                name=p.name,
                email=p.email,
                telephone=getattr(p, 'telephone', None),
                title=getattr(p, 'title', None),
                organization=getattr(p, 'organization', None),
                is_chairperson=getattr(p, 'is_chairperson', False),
                is_secretary=getattr(p, 'is_secretary', False),
                attendance_status=getattr(p, 'attendance_status', 'pending'),
                apology_comment=getattr(p, 'apology_comment', None),
                created_by_id=p.created_by_id,
                created_at=p.created_at,
                updated_by_id=getattr(p, 'updated_by_id', None),
                updated_at=getattr(p, 'updated_at', None),
                is_active=p.is_active,
            )
            for p in participants
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching participants for meeting {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch participants: {str(e)}"
        )


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


@router.get("/{meeting_id}/history", response_model=List[MeetingStatusHistoryResponse])
async def get_meeting_status_history(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get status change history for a meeting"""
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


@router.post("/{meeting_id}/notify-participants")
async def notify_meeting_participants(
    meeting_id: str,
    notification_data: NotificationRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Send notifications to meeting participants"""
    meeting = await get_meeting_or_404(db, UUID(meeting_id))
    
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


@router.get("/{meeting_id}/documents")
async def get_meeting_documents(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_DOCUMENT_LIMIT, ge=1, le=MAX_DOCUMENT_LIMIT),
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
    
    upload_dir = Path("uploads/meeting_documents")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = upload_dir / unique_filename
    
    content = await file.read()
    file_size = len(content)
    
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    
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
    """Get audit logs for a specific meeting"""
    await get_meeting_or_404(db, meeting_id)
    
    meeting_id_str = str(meeting_id)
    
    # Get all related IDs
    participants_result = await db.execute(
        select(MeetingParticipant.id).where(
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True
        )
    )
    participant_ids = [str(row) for row in participants_result.scalars().all()]
    
    minutes_result = await db.execute(
        select(MeetingMinutes.id).where(
            MeetingMinutes.meeting_id == meeting_id,
            MeetingMinutes.is_active == True
        )
    )
    minutes_ids = [str(row) for row in minutes_result.scalars().all()]
    
    action_ids = []
    if minutes_ids:
        actions_result = await db.execute(
            select(MeetingAction.id).where(
                MeetingAction.minute_id.in_(minutes_ids),
                MeetingAction.is_active == True
            )
        )
        action_ids = [str(row) for row in actions_result.scalars().all()]
    
    documents_result = await db.execute(
        select(MeetingDocument.id).where(
            MeetingDocument.meeting_id == meeting_id,
            MeetingDocument.is_active == True
        )
    )
    document_ids = [str(row) for row in documents_result.scalars().all()]
    
    history_result = await db.execute(
        select(MeetingStatusHistory.id).where(
            MeetingStatusHistory.meeting_id == meeting_id,
            MeetingStatusHistory.is_active == True
        )
    )
    history_ids = [str(row) for row in history_result.scalars().all()]
    
    # Build conditions
    conditions = [
        and_(AuditLog.table_name == 'meetings', AuditLog.record_id == meeting_id_str)
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
    
    query = select(AuditLog).where(or_(*conditions))
    
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
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    query = query.order_by(desc(AuditLog.timestamp)).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
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
    
    participants_result = await db.execute(
        select(MeetingParticipant.id).where(
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True
        )
    )
    participant_ids = [str(row) for row in participants_result.scalars().all()]
    
    minutes_result = await db.execute(
        select(MeetingMinutes.id).where(
            MeetingMinutes.meeting_id == meeting_id,
            MeetingMinutes.is_active == True
        )
    )
    minutes_ids = [str(row) for row in minutes_result.scalars().all()]
    
    action_ids = []
    if minutes_ids:
        actions_result = await db.execute(
            select(MeetingAction.id).where(
                MeetingAction.minute_id.in_(minutes_ids),
                MeetingAction.is_active == True
            )
        )
        action_ids = [str(row) for row in actions_result.scalars().all()]
    
    documents_result = await db.execute(
        select(MeetingDocument.id).where(
            MeetingDocument.meeting_id == meeting_id,
            MeetingDocument.is_active == True
        )
    )
    document_ids = [str(row) for row in documents_result.scalars().all()]
    
    history_result = await db.execute(
        select(MeetingStatusHistory.id).where(
            MeetingStatusHistory.meeting_id == meeting_id,
            MeetingStatusHistory.is_active == True
        )
    )
    history_ids = [str(row) for row in history_result.scalars().all()]
    
    conditions = [
        and_(AuditLog.table_name == 'meetings', AuditLog.record_id == meeting_id_str)
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
    
    action_query = select(distinct(AuditLog.action)).where(or_(*conditions))
    action_result = await db.execute(action_query)
    actions = [a for a in action_result.scalars().all() if a]
    
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


async def _resolve_target_user_simple(user_id, email, current_user, db):
    """Simple user resolution"""
    if user_id:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    elif email:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    return current_user


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
        return True
    return False


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