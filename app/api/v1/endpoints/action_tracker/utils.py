# app/api/v1/endpoints/action_tracker/utils.py

import logging
import asyncio
from typing import Optional, List, Dict, Any, Set, Union
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models.meetings.action_tracker import (
    Meeting, MeetingParticipant, MeetingMinutes, MeetingDocument
)
from app.models.meetings.organization import OrganizationNode
from app.models.general.dynamic_attribute import Attribute
from app.models.user import User
from app.schemas.action_tracker import (
    MeetingResponse, MeetingParticipantResponse, MeetingMinutesResponse, 
    MeetingDocumentResponse, AttributeResponse
)

logger = logging.getLogger(__name__)


# ==================== HELPER FUNCTIONS ====================

def safe_isoformat(value: Optional[datetime]) -> Optional[str]:
    """Safely convert datetime to ISO format"""
    if not value:
        return None
    try:
        return value.isoformat()
    except Exception:
        return None


def validate_pagination(skip: int, limit: int) -> tuple[int, int]:
    """Validate pagination parameters"""
    return max(0, skip), min(500, max(1, limit))


def get_safe_attribute(obj, attr_name: str, default=None):
    """Safely get attribute from object with default"""
    return getattr(obj, attr_name, default)


def safe_uuid_to_str(value: Optional[UUID]) -> Optional[str]:
    """Convert UUID to string safely"""
    if not value:
        return None
    try:
        return str(value)
    except Exception:
        return None


# ==================== DEPARTMENT NAME FETCHING ====================

def build_department_name_from_relationship(meeting_obj: Meeting) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Extract department names from pre-loaded relationships.
    Returns (department_name, department_path, department_code, restricted_department_name)
    """
    department_name = None
    department_path = None
    department_code = None
    restricted_department_name = None
    
    # Regular department
    if meeting_obj.department_id and hasattr(meeting_obj, 'department') and meeting_obj.department:
        department_name = meeting_obj.department.name
        department_path = getattr(meeting_obj.department, 'path', None)
        department_code = getattr(meeting_obj.department, 'code', None)
    
    # Restricted department
    if meeting_obj.restricted_department_id and hasattr(meeting_obj, 'restricted_department') and meeting_obj.restricted_department:
        restricted_department_name = meeting_obj.restricted_department.name
        logger.debug(f"Found restricted department from relationship: {restricted_department_name}")
    
    return department_name, department_path, department_code, restricted_department_name


async def fetch_department_names_from_db(
    db: AsyncSession, 
    department_id: Optional[Union[UUID, str]] = None, 
    restricted_department_id: Optional[Union[UUID, str]] = None
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Fetch department names from database when relationships aren't loaded.
    Returns (department_name, department_path, department_code, restricted_department_name)
    """
    department_name = None
    department_path = None
    department_code = None
    restricted_department_name = None
    
    # Fetch regular department
    if department_id:
        try:
            # Convert string to UUID if needed
            if isinstance(department_id, str):
                try:
                    department_id = UUID(department_id)
                except ValueError:
                    logger.warning(f"Invalid department_id format: {department_id}")
                    department_id = None
            
            if department_id:
                result = await db.execute(
                    select(OrganizationNode.name, OrganizationNode.path, OrganizationNode.code)
                    .where(
                        OrganizationNode.id == department_id,
                        OrganizationNode.is_active == True
                    )
                )
                row = result.first()
                if row:
                    department_name, department_path, department_code = row
                    logger.debug(f"Found department: {department_name}")
        except Exception as e:
            logger.warning(f"Failed to fetch department name for {department_id}: {e}")
    
    # Fetch restricted department - THIS IS THE KEY FIX
    if restricted_department_id:
        try:
            # Convert string to UUID if needed
            if isinstance(restricted_department_id, str):
                try:
                    restricted_department_id = UUID(restricted_department_id)
                except ValueError:
                    logger.warning(f"Invalid restricted_department_id format: {restricted_department_id}")
                    restricted_department_id = None
            
            if restricted_department_id:
                result = await db.execute(
                    select(OrganizationNode.name)
                    .where(
                        OrganizationNode.id == restricted_department_id,
                        OrganizationNode.is_active == True
                    )
                )
                restricted_department_name = result.scalar_one_or_none()
                if restricted_department_name:
                    logger.info(f"✅ Found restricted department name: {restricted_department_name}")
                else:
                    logger.warning(f"⚠️ No restricted department found for ID: {restricted_department_id}")
        except Exception as e:
            logger.warning(f"Failed to fetch restricted department name for {restricted_department_id}: {e}")
    
    return department_name, department_path, department_code, restricted_department_name


async def fetch_single_department_name(
    db: AsyncSession, 
    department_id: Optional[Union[UUID, str]]
) -> Optional[str]:
    """Fetch a single department name by ID"""
    if not department_id:
        return None
    
    try:
        if isinstance(department_id, str):
            try:
                department_id = UUID(department_id)
            except ValueError:
                return None
        
        result = await db.execute(
            select(OrganizationNode.name)
            .where(
                OrganizationNode.id == department_id,
                OrganizationNode.is_active == True
            )
        )
        return result.scalar_one_or_none()
    except Exception as e:
        logger.warning(f"Failed to fetch department name: {e}")
        return None


# ==================== STATUS FETCHING ====================

async def fetch_status_from_db(db: AsyncSession, status_id: UUID) -> Optional[AttributeResponse]:
    """Fetch status from database by ID and return as AttributeResponse."""
    try:
        query = select(Attribute).where(
            Attribute.id == status_id,
            Attribute.is_active == True
        )
        result = await db.execute(query)
        status_obj = result.scalar_one_or_none()
        
        if not status_obj:
            return None
        
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
    except Exception as e:
        logger.error(f"Failed to fetch status for {status_id}: {e}")
        return None


async def build_status_response(meeting_obj: Meeting, db: AsyncSession = None) -> Optional[AttributeResponse]:
    """Build status response from meeting status relationship."""
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
    
    # If status relationship is not loaded but status_id exists and db is provided
    if meeting_obj.status_id and db:
        return await fetch_status_from_db(db, meeting_obj.status_id)
    
    # Fallback: create a basic response from the ID
    if meeting_obj.status_id:
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


# ==================== LIST BUILDERS ====================

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


def build_documents_list(meeting_obj: Meeting) -> List[Dict[str, Any]]:
    """Build documents list from meeting documents as dictionaries"""
    documents = []
    if not hasattr(meeting_obj, 'documents') or not meeting_obj.documents:
        return documents
    
    for d in meeting_obj.documents:
        if not d.is_active:
            continue
        
        documents.append({
            "id": str(d.id),
            "meeting_id": str(d.meeting_id),
            "file_name": d.file_name,
            "file_path": d.file_path,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "title": d.title or d.file_name,
            "description": d.description,
            "document_type_id": str(d.document_type_id) if d.document_type_id else None,
            "document_type_name": None,
            "version": d.version or 1,
            "uploaded_by_id": str(d.uploaded_by_id) if d.uploaded_by_id else None,
            "uploaded_by_name": None,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "created_by_id": str(d.created_by_id) if d.created_by_id else None,
            "created_by_name": None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_by_id": str(d.updated_by_id) if d.updated_by_id else None,
            "updated_by_name": None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            "is_active": d.is_active,
            "ocr_text": None,
            "ocr_processed_at": None,
            "ocr_language": None,
            "file_size_formatted": d.file_size_formatted if hasattr(d, 'file_size_formatted') else None,
            "file_extension": d.file_extension if hasattr(d, 'file_extension') else None,
            "is_previewable": d.is_previewable if hasattr(d, 'is_previewable') else False,
            "file_url": d.file_url if hasattr(d, 'file_url') else None,
            "display_title": d.display_title if hasattr(d, 'display_title') else d.title or d.file_name,
        })
    
    return documents


# ==================== UNIFIED MEETING RESPONSE BUILDER ====================

async def build_meeting_response(
    meeting_obj: Meeting,
    db: AsyncSession = None,
    statuses_map: Dict = None,
    include_permissions: bool = False,
    user_permissions: Set[str] = None,
    user_role: str = None,
    user_permission_level: str = None,
    include_relationships: bool = True,
    resolve_department_names: bool = True,
) -> Dict[str, Any]:
    """
    Unified meeting response builder that can return either dict or Pydantic model.
    
    Args:
        meeting_obj: The Meeting ORM object
        db: Database session (optional, for fetching related data)
        statuses_map: Pre-fetched status map for optimization
        include_permissions: Whether to include user permissions
        user_permissions: Set of user permissions (if include_permissions=True)
        user_role: User's role in the meeting
        user_permission_level: User's permission level (owner, organizer, etc.)
        include_relationships: Whether to include nested relationships
        resolve_department_names: Whether to resolve department names from DB
    
    Returns:
        Dict[str, Any]: Meeting response dictionary
    """
    
    try:
        # ========== Basic Fields ==========
        response = {
            "id": str(meeting_obj.id),
            "title": meeting_obj.title,
            "description": meeting_obj.description,
            
            # Department fields
            "department_id": safe_uuid_to_str(meeting_obj.department_id),
            "department_name": None,
            "department_path": None,
            "department_code": None,
            
            # Date/Time fields
            "meeting_date": safe_isoformat(meeting_obj.meeting_date),
            "start_time": safe_isoformat(meeting_obj.start_time),
            "end_time": safe_isoformat(meeting_obj.end_time),
            
            # Location fields
            "location_id": safe_uuid_to_str(meeting_obj.location_id),
            "location_text": meeting_obj.location_text,
            "gps_coordinates": getattr(meeting_obj, 'gps_coordinates', None),
            
            # Content fields
            "agenda": meeting_obj.agenda,
            "facilitator": meeting_obj.facilitator,
            "chairperson_name": meeting_obj.chairperson_name,
            
            # Visibility fields
            "visibility": getattr(meeting_obj, 'visibility', 'open'),
            "restricted_department_id": safe_uuid_to_str(getattr(meeting_obj, 'restricted_department_id', None)),
            "restricted_department_name": None,  # Will be filled below
            
            # Status fields
            "status_id": safe_uuid_to_str(meeting_obj.status_id),
            "status": None,
            
            # Recurring fields
            "is_recurring": getattr(meeting_obj, 'is_recurring', False),
            "recurring_meeting_id": safe_uuid_to_str(getattr(meeting_obj, 'recurring_meeting_id', None)),
            "occurrence_number": getattr(meeting_obj, 'occurrence_number', None),
            
            # Platform fields
            "platform": getattr(meeting_obj, 'platform', None),
            "meeting_link": getattr(meeting_obj, 'meeting_link', None),
            "meeting_id_online": getattr(meeting_obj, 'meeting_id_online', None),
            "passcode": getattr(meeting_obj, 'passcode', None),
            "dial_in_numbers": getattr(meeting_obj, 'dial_in_numbers', None),
            
            # Role fields
            "chairperson_id": safe_uuid_to_str(getattr(meeting_obj, 'chairperson_id', None)),
            "secretary_id": safe_uuid_to_str(getattr(meeting_obj, 'secretary_id', None)),
            
            # Reminder fields
            "reminder_sent_at": safe_isoformat(getattr(meeting_obj, 'reminder_sent_at', None)),
            "reminder_sent_count": getattr(meeting_obj, 'reminder_sent_count', 0),
            
            # Audit fields
            "created_by_id": safe_uuid_to_str(meeting_obj.created_by_id),
            "created_by_name": getattr(meeting_obj.created_by, 'username', None) if hasattr(meeting_obj, 'created_by') and meeting_obj.created_by else None,
            "created_at": safe_isoformat(meeting_obj.created_at),
            "updated_by_id": safe_uuid_to_str(meeting_obj.updated_by_id),
            "updated_by_name": getattr(meeting_obj.updated_by, 'username', None) if hasattr(meeting_obj, 'updated_by') and meeting_obj.updated_by else None,
            "updated_at": safe_isoformat(meeting_obj.updated_at),
            "is_active": meeting_obj.is_active,
            "is_deleted": getattr(meeting_obj, 'is_deleted', False),
            "deleted_at": safe_isoformat(getattr(meeting_obj, 'deleted_at', None)),
            
            # Counts
            "participants_count": len(meeting_obj.participants) if hasattr(meeting_obj, 'participants') and meeting_obj.participants else 0,
            "minutes_count": len(meeting_obj.minutes) if hasattr(meeting_obj, 'minutes') and meeting_obj.minutes else 0,
            "documents_count": len(meeting_obj.documents) if hasattr(meeting_obj, 'documents') and meeting_obj.documents else 0,
        }
        
        # ========== Resolve Department Names ==========
        if resolve_department_names:
            # Check if relationships are already loaded
            dept_name = None
            dept_path = None
            dept_code = None
            restricted_name = None
            
            if hasattr(meeting_obj, 'department') and meeting_obj.department:
                dept_name = meeting_obj.department.name
                dept_path = getattr(meeting_obj.department, 'path', None)
                dept_code = getattr(meeting_obj.department, 'code', None)
            
            if hasattr(meeting_obj, 'restricted_department') and meeting_obj.restricted_department:
                restricted_name = meeting_obj.restricted_department.name
                logger.debug(f"Found restricted department from relationship: {restricted_name}")
            
            # If not loaded but db is provided, fetch from DB
            if (not dept_name and meeting_obj.department_id and db):
                dept_name, dept_path, dept_code, _ = await fetch_department_names_from_db(
                    db, 
                    meeting_obj.department_id, 
                    None
                )
            
            if (not restricted_name and getattr(meeting_obj, 'restricted_department_id', None) and db):
                # Fetch restricted department name - THIS IS THE KEY FIX
                restricted_id = getattr(meeting_obj, 'restricted_department_id', None)
                restricted_name = await fetch_single_department_name(db, restricted_id)
                if restricted_name:
                    logger.info(f"✅ Resolved restricted department name: {restricted_name}")
                else:
                    logger.warning(f"⚠️ Could not resolve restricted department for ID: {restricted_id}")
            
            response["department_name"] = dept_name
            response["department_path"] = dept_path
            response["department_code"] = dept_code
            response["restricted_department_name"] = restricted_name
        
        # ========== Get Status ==========
        if statuses_map and meeting_obj.status_id and str(meeting_obj.status_id) in statuses_map:
            s = statuses_map[str(meeting_obj.status_id)]
            response["status"] = {
                "id": str(s.id),
                "name": s.name,
                "short_name": getattr(s, "short_name", None),
                "color": getattr(s, "color", None),
            }
        else:
            status_response = await build_status_response(meeting_obj, db)
            if status_response:
                response["status"] = {
                    "id": str(status_response.id),
                    "name": status_response.name,
                    "short_name": status_response.short_name,
                    "color": status_response.color,
                }
        
        # ========== Include Relationships ==========
        if include_relationships:
            response["participants"] = [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "email": p.email,
                    "telephone": getattr(p, 'telephone', None),
                    "title": getattr(p, 'title', None),
                    "organization": getattr(p, 'organization', None),
                    "is_chairperson": getattr(p, 'is_chairperson', False),
                    "is_secretary": getattr(p, 'is_secretary', False),
                    "attendance_status": getattr(p, 'attendance_status', 'pending'),
                    "apology_comment": getattr(p, 'apology_comment', None),
                    "is_active": p.is_active,
                    "created_at": safe_isoformat(getattr(p, 'created_at', None)),
                    "updated_at": safe_isoformat(getattr(p, 'updated_at', None)),
                }
                for p in (meeting_obj.participants or []) if p.is_active
            ]
            
            response["minutes"] = [
                {
                    "id": str(m.id),
                    "meeting_id": str(m.meeting_id),
                    "topic": m.topic,
                    "discussion": m.discussion,
                    "decisions": m.decisions,
                    "timestamp": safe_isoformat(m.timestamp),
                    "is_active": m.is_active,
                    "created_at": safe_isoformat(m.created_at),
                    "updated_at": safe_isoformat(m.updated_at),
                }
                for m in (meeting_obj.minutes or []) if m.is_active
            ]
            
            response["documents"] = [
                {
                    "id": str(d.id),
                    "meeting_id": str(d.meeting_id),
                    "file_name": d.file_name,
                    "file_path": d.file_path,
                    "file_size": d.file_size,
                    "mime_type": d.mime_type,
                    "title": d.title or d.file_name,
                    "description": d.description,
                    "document_type_id": safe_uuid_to_str(d.document_type_id),
                    "version": d.version or 1,
                    "uploaded_at": safe_isoformat(d.uploaded_at),
                    "created_at": safe_isoformat(d.created_at),
                    "updated_at": safe_isoformat(d.updated_at),
                    "is_active": d.is_active,
                }
                for d in (meeting_obj.documents or []) if d.is_active
            ]
        
        # ========== Include Permissions ==========
        if include_permissions:
            response["user_permission"] = user_permission_level
            response["user_role"] = user_role
            
            if user_permissions:
                response["user_actions"] = {
                    "can_edit": "meetings.edit" in user_permissions,
                    "can_delete": "meetings.delete" in user_permissions,
                    "can_manage_participants": "meetings.manage_participants" in user_permissions,
                    "can_view_stats": "meetings.view_stats" in user_permissions,
                    "can_create": "meetings.create" in user_permissions,
                }
        
        return response
        
    except Exception as e:
        logger.error(f"Error building meeting response: {e}", exc_info=True)
        return {}


# ==================== PYDANTIC RESPONSE BUILDER ====================

async def build_meeting_response_pydantic(
    meeting_obj: Meeting,
    db: AsyncSession
) -> MeetingResponse:
    """
    Build a Pydantic MeetingResponse from a Meeting ORM object.
    This version returns a full Pydantic model with all relationships.
    """
    
    department_name, department_path, department_code, restricted_department_name = build_department_name_from_relationship(meeting_obj)
    
    # If restricted department name not found from relationship, fetch from DB
    if not restricted_department_name and meeting_obj.restricted_department_id and db:
        restricted_department_name = await fetch_single_department_name(db, meeting_obj.restricted_department_id)
    
    status_response = await build_status_response(meeting_obj, db)
    participants = build_participants_list(meeting_obj)
    minutes = build_minutes_list(meeting_obj)
    documents = build_documents_list(meeting_obj)
    
    return MeetingResponse(
        id=meeting_obj.id,
        title=meeting_obj.title,
        description=meeting_obj.description,
        department_id=meeting_obj.department_id,
        department_name=department_name,
        department_path=department_path,
        department_code=department_code,
        visibility=meeting_obj.visibility,
        restricted_department_id=meeting_obj.restricted_department_id,
        restricted_department_name=restricted_department_name,
        location_id=meeting_obj.location_id,
        location_text=meeting_obj.location_text,
        gps_coordinates=meeting_obj.gps_coordinates,
        location_name=get_safe_attribute(meeting_obj, 'location_name'),
        meeting_date=meeting_obj.meeting_date,
        start_time=meeting_obj.start_time,
        end_time=meeting_obj.end_time,
        agenda=meeting_obj.agenda,
        facilitator=meeting_obj.facilitator,
        chairperson_name=meeting_obj.chairperson_name,
        status_id=meeting_obj.status_id,
        status=status_response,
        status_comment=get_safe_attribute(meeting_obj, 'status_comment'),
        status_date=get_safe_attribute(meeting_obj, 'status_date'),
        status_name=get_safe_attribute(meeting_obj, 'status_name'),
        platform=get_safe_attribute(meeting_obj, 'platform'),
        meeting_link=get_safe_attribute(meeting_obj, 'meeting_link'),
        meeting_id_online=get_safe_attribute(meeting_obj, 'meeting_id_online'),
        passcode=get_safe_attribute(meeting_obj, 'passcode'),
        has_online_meeting=get_safe_attribute(meeting_obj, 'has_online_meeting', False),
        has_physical_meeting=get_safe_attribute(meeting_obj, 'has_physical_meeting', False),
        venue=get_safe_attribute(meeting_obj, 'venue'),
        address=get_safe_attribute(meeting_obj, 'address'),
        location_instructions=get_safe_attribute(meeting_obj, 'location_instructions'),
        chairperson_id=meeting_obj.chairperson_id,
        secretary_id=meeting_obj.secretary_id,
        dial_in_numbers=get_safe_attribute(meeting_obj, 'dial_in_numbers'),
        send_reminders=get_safe_attribute(meeting_obj, 'send_reminders', True),
        reminder_minutes_before=get_safe_attribute(meeting_obj, 'reminder_minutes_before', 30),
        created_by_id=meeting_obj.created_by_id,
        created_by_name=get_safe_attribute(meeting_obj, 'created_by_name'),
        created_at=meeting_obj.created_at,
        updated_by_id=meeting_obj.updated_by_id,
        updated_by_name=get_safe_attribute(meeting_obj, 'updated_by_name'),
        updated_at=meeting_obj.updated_at,
        is_active=meeting_obj.is_active,
        participants=participants,
        minutes=minutes,
        documents=documents
    )


# ==================== LEGACY COMPATIBILITY WRAPPERS ====================

def _build_meeting_response_sync(
    meeting: Meeting, 
    statuses_map: Dict = None
) -> Dict[str, Any]:
    """
    Synchronous version of build_meeting_response for backward compatibility.
    This is used when we can't use async/await.
    """
    try:
        status_info = None
        if meeting.status_id and statuses_map and str(meeting.status_id) in statuses_map:
            s = statuses_map[str(meeting.status_id)]
            status_info = {
                "id": str(s.id),
                "name": s.name,
                "short_name": getattr(s, "short_name", None),
                "color": getattr(s, "color", None),
            }
        
        return {
            "id": str(meeting.id),
            "title": meeting.title,
            "description": meeting.description,
            "meeting_date": safe_isoformat(meeting.meeting_date),
            "start_time": safe_isoformat(meeting.start_time),
            "end_time": safe_isoformat(meeting.end_time),
            "location_text": meeting.location_text,
            "location_id": str(meeting.location_id) if meeting.location_id else None,
            "agenda": meeting.agenda,
            "facilitator": meeting.facilitator,
            "chairperson_name": meeting.chairperson_name,
            "status_id": str(meeting.status_id) if meeting.status_id else None,
            "status": status_info,
            "created_by_id": str(meeting.created_by_id) if meeting.created_by_id else None,
            "created_by_name": getattr(meeting.created_by, 'username', None) if hasattr(meeting, 'created_by') and meeting.created_by else None,
            "created_at": safe_isoformat(meeting.created_at),
            "participants_count": len(meeting.participants) if hasattr(meeting, 'participants') and meeting.participants else 0,
            "is_active": meeting.is_active,
            "visibility": getattr(meeting, 'visibility', 'open'),
            "restricted_department_id": str(meeting.restricted_department_id) if getattr(meeting, 'restricted_department_id', None) else None,
            "restricted_department_name": None,  # Can't resolve sync
            "is_recurring": getattr(meeting, 'is_recurring', False),
            "recurring_meeting_id": str(meeting.recurring_meeting_id) if getattr(meeting, 'recurring_meeting_id', None) else None,
            "occurrence_number": getattr(meeting, 'occurrence_number', None),
        }
    except Exception as e:
        logger.error(f"Error building meeting response: {e}", exc_info=True)
        return {}


def build_meeting_response_dict(meeting: Meeting, statuses_map: Dict = None) -> Dict[str, Any]:
    """
    Legacy wrapper for the simple dict version.
    Use this in the basic router where you don't need permissions or relationships.
    """
    try:
        # Try to detect if we're in an async context
        loop = asyncio.get_running_loop()
        # If we are, use the sync version (since we can't create a new event loop)
        logger.debug("In async context, using sync version")
        return _build_meeting_response_sync(meeting, statuses_map)
    except RuntimeError:
        # No running loop, we can run async
        try:
            return asyncio.run(build_meeting_response(
                meeting_obj=meeting,
                statuses_map=statuses_map,
                include_relationships=False,
                resolve_department_names=False  # Don't resolve async in sync wrapper
            ))
        except Exception as e:
            logger.error(f"Error in async build: {e}, falling back to sync")
            return _build_meeting_response_sync(meeting, statuses_map)