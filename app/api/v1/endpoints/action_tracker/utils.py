# app/api/v1/endpoints/action_tracker/utils.py

import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.meetings.action_tracker import Meeting, MeetingParticipant, MeetingMinutes, MeetingDocument
from app.models.meetings.organization import OrganizationNode
from app.models.general.dynamic_attribute import Attribute
from app.schemas.action_tracker import (
    MeetingResponse, MeetingParticipantResponse, MeetingMinutesResponse, 
    MeetingDocumentResponse, AttributeResponse
)

logger = logging.getLogger(__name__)


def validate_pagination(skip: int, limit: int) -> tuple[int, int]:
    """Validate pagination parameters"""
    return max(0, skip), min(500, max(1, limit))


def build_department_name_from_relationship(meeting_obj: Meeting) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Extract department names from pre-loaded relationships.
    Returns (department_name, department_path, department_code, restricted_department_name)
    """
    department_name = None
    department_path = None
    department_code = None
    restricted_department_name = None
    
    # Get from regular department relationship
    if meeting_obj.department_id and hasattr(meeting_obj, 'department') and meeting_obj.department:
        department_name = meeting_obj.department.name
        department_path = getattr(meeting_obj.department, 'path', None)
        department_code = getattr(meeting_obj.department, 'code', None)
    
    # Get from restricted department relationship
    if meeting_obj.restricted_department_id and hasattr(meeting_obj, 'restricted_department') and meeting_obj.restricted_department:
        restricted_department_name = meeting_obj.restricted_department.name
    
    return department_name, department_path, department_code, restricted_department_name


async def fetch_department_names_from_db(
    db: AsyncSession, 
    department_id: Optional[str] = None, 
    restricted_department_id: Optional[str] = None
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Fetch department names from database when relationships aren't loaded.
    Returns (department_name, department_path, department_code, restricted_department_name)
    """
    department_name = None
    department_path = None
    department_code = None
    restricted_department_name = None
    
    # Fetch regular department info
    if department_id:
        try:
            result = await db.execute(
                select(OrganizationNode.name, OrganizationNode.path, OrganizationNode.code)
                .where(OrganizationNode.id == department_id)
            )
            row = result.first()
            if row:
                department_name, department_path, department_code = row
        except Exception as e:
            logger.warning(f"Failed to fetch department name for {department_id}: {e}")
    
    # Fetch restricted department name
    if restricted_department_id:
        try:
            result = await db.execute(
                select(OrganizationNode.name).where(OrganizationNode.id == restricted_department_id)
            )
            restricted_department_name = result.scalar_one_or_none()
        except Exception as e:
            logger.warning(f"Failed to fetch restricted department name for {restricted_department_id}: {e}")
    
    return department_name, department_path, department_code, restricted_department_name


async def fetch_status_from_db(db: AsyncSession, status_id: UUID) -> Optional[AttributeResponse]:
    """
    Fetch status from database by ID and return as AttributeResponse.
    """
    try:
        query = select(Attribute).where(
            Attribute.id == status_id,
            Attribute.is_active == True
        )
        result = await db.execute(query)
        status_obj = result.scalar_one_or_none()
        
        if not status_obj:
            logger.warning(f"Status with id {status_id} not found")
            return None
        
        # Get short_name from the status object
        short_name = getattr(status_obj, 'short_name', None)
        if short_name:
            short_name = short_name.lower()
        else:
            # Try to extract from code
            code = getattr(status_obj, 'code', '')
            if code.startswith('MEETING_STATUS_'):
                short_name = code.replace('MEETING_STATUS_', '').lower()
            else:
                short_name = 'pending'
        
        # Get color from extra_metadata or use default
        color = '#6B7280'
        extra_metadata = getattr(status_obj, 'extra_metadata', None)
        if extra_metadata and isinstance(extra_metadata, dict):
            color = extra_metadata.get('color', '#6B7280')
        
        return AttributeResponse(
            id=status_obj.id,
            code=getattr(status_obj, 'code', None),
            name=getattr(status_obj, 'name', None),
            short_name=short_name,
            description=getattr(status_obj, 'description', None),
            extra_metadata=extra_metadata,
            color=color,
            sort_order=getattr(status_obj, 'sort_order', 0),
            group_id=getattr(status_obj, 'group_id', None),
            created_at=getattr(status_obj, 'created_at', None),
            updated_at=getattr(status_obj, 'updated_at', None),
            is_active=getattr(status_obj, 'is_active', True)
        )
    except Exception as e:
        logger.error(f"Failed to fetch status for {status_id}: {e}")
        return None


async def build_status_response(meeting_obj: Meeting, db: AsyncSession) -> Optional[AttributeResponse]:
    """
    Build status response from meeting status relationship.
    If status relationship is not loaded, query it from the database.
    
    Args:
        meeting_obj: The Meeting ORM object
        db: Database session for querying status if not loaded
    
    Returns:
        AttributeResponse or None
    """
    # If status relationship is loaded, use it
    if hasattr(meeting_obj, 'status') and meeting_obj.status:
        status_obj = meeting_obj.status
        short_name = getattr(status_obj, 'short_name', None)
        if short_name:
            short_name = short_name.lower()
        else:
            code = getattr(status_obj, 'code', '')
            if code.startswith('MEETING_STATUS_'):
                short_name = code.replace('MEETING_STATUS_', '').lower()
            else:
                short_name = 'pending'
        
        color = '#6B7280'
        extra_metadata = getattr(status_obj, 'extra_metadata', None)
        if extra_metadata and isinstance(extra_metadata, dict):
            color = extra_metadata.get('color', '#6B7280')
        
        return AttributeResponse(
            id=status_obj.id,
            code=getattr(status_obj, 'code', None),
            name=getattr(status_obj, 'name', None),
            short_name=short_name,
            description=getattr(status_obj, 'description', None),
            extra_metadata=extra_metadata,
            color=color,
            sort_order=getattr(status_obj, 'sort_order', 0),
            group_id=getattr(status_obj, 'group_id', None),
            created_at=getattr(status_obj, 'created_at', None),
            updated_at=getattr(status_obj, 'updated_at', None),
            is_active=getattr(status_obj, 'is_active', True)
        )
    
    # If status relationship is not loaded but status_id exists, query it
    if meeting_obj.status_id and db:
        return await fetch_status_from_db(db, meeting_obj.status_id)
    
    # If status_id exists but no db provided, create a basic response from the ID
    if meeting_obj.status_id:
        # Try to infer status from common IDs (fallback)
        # This is not ideal but better than null
        return AttributeResponse(
            id=meeting_obj.status_id,
            code="MEETING_STATUS_UNKNOWN",
            name="Unknown Status",
            short_name="unknown",
            description="Status not loaded",
            extra_metadata={"color": "#6B7280"},
            color="#6B7280",
            sort_order=0,
            group_id=None,
            created_at=None,
            updated_at=None,
            is_active=True
        )
    
    return None


def build_participants_list(meeting_obj: Meeting) -> List[MeetingParticipantResponse]:
    """Build participants list from meeting participants"""
    participants = []
    if not hasattr(meeting_obj, 'participants') or not meeting_obj.participants:
        return participants
    
    for p in meeting_obj.participants:
        if not p.is_active:
            continue
        
        participants.append(MeetingParticipantResponse(
            id=p.id,
            name=p.name,
            email=p.email,
            telephone=p.telephone,
            title=p.title,
            organization=p.organization,
            is_chairperson=p.is_chairperson,
            is_secretary=p.is_secretary,
            attendance_status=p.attendance_status,
            apology_comment=p.apology_comment,
            code=None,
            short_name=None,
            description=None,
            extra_metadata=None,
            color=None,
            sort_order=None,
            group_id=None,
            created_at=p.created_at,
            updated_at=p.updated_at,
            is_active=p.is_active
        ))
    
    return participants


def build_minutes_list(meeting_obj: Meeting) -> List[MeetingMinutesResponse]:
    """Build minutes list from meeting minutes"""
    minutes = []
    if not hasattr(meeting_obj, 'minutes') or not meeting_obj.minutes:
        return minutes
    
    for m in meeting_obj.minutes:
        if not m.is_active:
            continue
        
        minutes.append(MeetingMinutesResponse(
            id=m.id,
            meeting_id=m.meeting_id,
            topic=m.topic,
            discussion=m.discussion,
            decisions=m.decisions,
            timestamp=m.timestamp,
            recorded_by_id=m.recorded_by_id,
            recorded_by_name=None,
            recorded_by_username=None,
            created_by_id=m.created_by_id,
            created_by_name=None,
            created_at=m.created_at,
            updated_by_id=m.updated_by_id,
            updated_by_name=None,
            updated_at=m.updated_at,
            is_active=m.is_active,
            actions=[]
        ))
    
    return minutes


def build_documents_list(meeting_obj: Meeting) -> List[MeetingDocumentResponse]:
    """Build documents list from meeting documents"""
    documents = []
    if not hasattr(meeting_obj, 'documents') or not meeting_obj.documents:
        return documents
    
    for d in meeting_obj.documents:
        if not d.is_active:
            continue
        
        documents.append(MeetingDocumentResponse(
            id=d.id,
            meeting_id=d.meeting_id,
            file_name=d.file_name,
            file_path=d.file_path,
            file_size=d.file_size,
            mime_type=d.mime_type,
            title=d.title or d.file_name,
            description=d.description,
            document_type_id=d.document_type_id,
            document_type_name=None,
            version=d.version or 1,
            uploaded_by_id=d.uploaded_by_id,
            uploaded_by_name=None,
            uploaded_at=d.uploaded_at or d.created_at,
            created_by_id=d.created_by_id,
            created_by_name=None,
            created_at=d.created_at,
            updated_by_id=d.updated_by_id,
            updated_by_name=None,
            updated_at=d.updated_at,
            is_active=d.is_active,
            ocr_text=None,
            ocr_processed_at=None,
            ocr_language=None
        ))
    
    return documents


def get_safe_attribute(obj, attr_name: str, default=None):
    """Safely get attribute from object with default"""
    return getattr(obj, attr_name, default)


async def build_meeting_response(
    meeting_obj: Meeting, 
    db: AsyncSession
) -> MeetingResponse:
    """
    Build a MeetingResponse from a Meeting ORM object.
    
    Args:
        meeting_obj: The Meeting ORM object
        db: Database session for fetching related data
    
    Returns:
        MeetingResponse: The built response object
    """
    
    # ========== Get Department Names ==========
    department_name, department_path, department_code, restricted_department_name = build_department_name_from_relationship(meeting_obj)
    
    # ========== Build Response Components ==========
    # Await the async status response
    status_response = await build_status_response(meeting_obj, db)
    participants = build_participants_list(meeting_obj)
    minutes = build_minutes_list(meeting_obj)
    documents = build_documents_list(meeting_obj)
    
    # ========== Build Final Response ==========
    return MeetingResponse(
        # Basic fields
        id=meeting_obj.id,
        title=meeting_obj.title,
        description=meeting_obj.description,
        
        # Department fields
        department_id=meeting_obj.department_id,
        department_name=department_name,
        department_path=department_path,
        department_code=department_code,
        
        # Visibility fields
        visibility=meeting_obj.visibility,
        restricted_department_id=meeting_obj.restricted_department_id,
        restricted_department_name=restricted_department_name,
        
        # Location fields
        location_id=meeting_obj.location_id,
        location_text=meeting_obj.location_text,
        gps_coordinates=meeting_obj.gps_coordinates,
        location_name=get_safe_attribute(meeting_obj, 'location_name'),
        
        # Date/Time fields
        meeting_date=meeting_obj.meeting_date,
        start_time=meeting_obj.start_time,
        end_time=meeting_obj.end_time,
        
        # Content fields
        agenda=meeting_obj.agenda,
        facilitator=meeting_obj.facilitator,
        chairperson_name=meeting_obj.chairperson_name,
        
        # Status fields
        status_id=meeting_obj.status_id,
        status=status_response,
        status_comment=get_safe_attribute(meeting_obj, 'status_comment'),
        status_date=get_safe_attribute(meeting_obj, 'status_date'),
        status_name=get_safe_attribute(meeting_obj, 'status_name'),
        
        # Platform fields
        platform=get_safe_attribute(meeting_obj, 'platform'),
        meeting_link=get_safe_attribute(meeting_obj, 'meeting_link'),
        meeting_id_online=get_safe_attribute(meeting_obj, 'meeting_id_online'),
        passcode=get_safe_attribute(meeting_obj, 'passcode'),
        has_online_meeting=get_safe_attribute(meeting_obj, 'has_online_meeting', False),
        has_physical_meeting=get_safe_attribute(meeting_obj, 'has_physical_meeting', False),
        venue=get_safe_attribute(meeting_obj, 'venue'),
        address=get_safe_attribute(meeting_obj, 'address'),
        location_instructions=get_safe_attribute(meeting_obj, 'location_instructions'),
        
        # Role fields
        chairperson_id=meeting_obj.chairperson_id,
        secretary_id=meeting_obj.secretary_id,
        
        # Notification fields
        dial_in_numbers=get_safe_attribute(meeting_obj, 'dial_in_numbers'),
        send_reminders=get_safe_attribute(meeting_obj, 'send_reminders', True),
        reminder_minutes_before=get_safe_attribute(meeting_obj, 'reminder_minutes_before', 30),
        
        # Audit fields
        created_by_id=meeting_obj.created_by_id,
        created_by_name=get_safe_attribute(meeting_obj, 'created_by_name'),
        created_at=meeting_obj.created_at,
        updated_by_id=meeting_obj.updated_by_id,
        updated_by_name=get_safe_attribute(meeting_obj, 'updated_by_name'),
        updated_at=meeting_obj.updated_at,
        is_active=meeting_obj.is_active,
        
        # Relationships
        participants=participants,
        minutes=minutes,
        documents=documents
    )


def build_participant_response(participant_obj) -> dict:
    """Build a participant response dictionary"""
    return {
        "id": str(participant_obj.id),
        "name": participant_obj.name,
        "email": participant_obj.email,
        "telephone": participant_obj.telephone,
        "title": participant_obj.title,
        "organization": participant_obj.organization,
        "is_chairperson": participant_obj.is_chairperson,
        "is_secretary": participant_obj.is_secretary,
        "attendance_status": participant_obj.attendance_status,
        "apology_comment": participant_obj.apology_comment,
        "created_at": participant_obj.created_at.isoformat() if participant_obj.created_at else None,
        "updated_at": participant_obj.updated_at.isoformat() if participant_obj.updated_at else None,
        "is_active": participant_obj.is_active
    }


def build_minutes_response(minutes_obj) -> dict:
    """Build a minutes response dictionary"""
    return {
        "id": str(minutes_obj.id),
        "meeting_id": str(minutes_obj.meeting_id),
        "topic": minutes_obj.topic,
        "discussion": minutes_obj.discussion,
        "decisions": minutes_obj.decisions,
        "timestamp": minutes_obj.timestamp.isoformat() if minutes_obj.timestamp else None,
        "recorded_by_id": str(minutes_obj.recorded_by_id) if minutes_obj.recorded_by_id else None,
        "created_at": minutes_obj.created_at.isoformat() if minutes_obj.created_at else None,
        "updated_at": minutes_obj.updated_at.isoformat() if minutes_obj.updated_at else None,
        "is_active": minutes_obj.is_active
    }


def build_document_response(document_obj) -> dict:
    """Build a document response dictionary"""
    return {
        "id": str(document_obj.id),
        "meeting_id": str(document_obj.meeting_id),
        "file_name": document_obj.file_name,
        "file_path": document_obj.file_path,
        "file_size": document_obj.file_size,
        "mime_type": document_obj.mime_type,
        "title": document_obj.title or document_obj.file_name,
        "description": document_obj.description,
        "document_type_id": str(document_obj.document_type_id) if document_obj.document_type_id else None,
        "version": document_obj.version or 1,
        "uploaded_by_id": str(document_obj.uploaded_by_id) if document_obj.uploaded_by_id else None,
        "uploaded_at": document_obj.uploaded_at.isoformat() if document_obj.uploaded_at else None,
        "created_at": document_obj.created_at.isoformat() if document_obj.created_at else None,
        "updated_at": document_obj.updated_at.isoformat() if document_obj.updated_at else None,
        "is_active": document_obj.is_active
    }