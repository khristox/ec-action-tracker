# app/crud/meetings/action_tracker.py
"""
Action Tracker CRUD Operations
Complete implementation with all CRUD operations for all entities
"""

import json
import os
from pathlib import Path
from typing import List, Optional, Dict, Any, Union, Tuple
from uuid import UUID, uuid4
from datetime import datetime
from venv import logger

from fastapi import HTTPException, UploadFile
from sqlalchemy import String, delete, select, and_, or_, func, case, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.endpoints.action_tracker.audit_logger import log_audit
from app.crud.base import CRUDBase
from app.core.minio_client import minio_service
from app.models.meetings.action_tracker import (
    Meeting, MeetingMinutes, MeetingAction, MeetingParticipant,
    Participant, ParticipantList, ActionStatusHistory, ActionComment, 
    MeetingDocument, MeetingStatusHistory, ActionImplementer
)
from app.schemas.action_tracker_participants import (
    ParticipantCreate, ParticipantListCreate, ParticipantListUpdate, ParticipantUpdate
)
from app.schemas.meeting_minutes.meeting_minutes import (
    MeetingMinutesCreate, MeetingMinutesUpdate,
    MeetingActionCreate, MeetingActionUpdate,
)
from app.models.user import User


from app.schemas.action_tracker import ActionCommentCreate, ActionCommentUpdate, ActionProgressUpdate
from sqlalchemy import or_
from app.schemas.action_tracker import MeetingCreate, MeetingUpdate

from app.models.meetings.action_tracker import participant_list_members

# ============================================================================
# CONSTANTS
# ============================================================================

DEFAULT_LIMIT = 100
MAX_LIMIT = 500
DEFAULT_SKIP = 0

# ============================================================================
# BASE CLASS WITH AUDIT MIXIN
# ============================================================================

class AuditMixin:
    """Mixin for audit trail functionality"""
    
    async def _set_audit_fields(self, obj, created_by_id: UUID = None, updated_by_id: UUID = None):
        """Set audit fields on an object"""
        now = datetime.now()
        if created_by_id:
            obj.created_by_id = created_by_id
            obj.created_at = now
        if updated_by_id:
            obj.updated_by_id = updated_by_id
        obj.updated_at = now
        if not hasattr(obj, 'is_active'):
            obj.is_active = True
        return obj
    
    async def _update_audit_fields(self, obj, updated_by_id: UUID):
        """Update audit fields on an existing object"""
        obj.updated_by_id = updated_by_id
        obj.updated_at = datetime.now()
        return obj


# ============================================================================
# PARTICIPANT CRUD
# ============================================================================
class CRUDParticipant(CRUDBase[Participant, ParticipantCreate, ParticipantUpdate], AuditMixin):
    
    async def create(
        self, 
        db: AsyncSession, 
        obj_in: Union[ParticipantCreate, Dict[str, Any]],
        created_by_id: UUID
    ) -> Participant:
        """Create a new participant with audit fields"""
        try:
            if isinstance(obj_in, ParticipantCreate):
                obj_data = obj_in.model_dump()
            else:
                obj_data = obj_in.copy()
            
            if not obj_data.get('name'):
                raise ValueError("Name is required for creating a participant")
            
            if obj_data.get('email'):
                existing = await self.get_by_email(db, obj_data['email'])
                if existing:
                    raise ValueError(f"Participant with email '{obj_data['email']}' already exists")
                

            obj_data.pop('attendance_status', None)
            obj_data.pop('is_chairperson', None)
            obj_data.pop('is_secretary', None)
           
            db_obj = Participant(**obj_data)
            await self._set_audit_fields(db_obj, created_by_id=created_by_id, updated_by_id=created_by_id)
            
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to create participant: {str(e)}")

    async def get(self, db: AsyncSession, id: UUID) -> Optional[Participant]:
        """Get a single participant by ID"""
        result = await db.execute(
            select(Participant).where(
                Participant.id == id,
                Participant.is_active == True
            )
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT,
        filters: Optional[Dict[str, Any]] = None,
        include_inactive: bool = False
    ) -> List[Participant]:
        """Get multiple participants with filtering"""
        query = select(Participant)
        
        if not include_inactive:
            query = query.where(Participant.is_active == True)

        if filters:
            search = filters.get("search")
            if search:
                term = f"%{search}%"
                query = query.where(
                    or_(
                        Participant.name.ilike(term),
                        Participant.email.ilike(term),
                        Participant.organization.ilike(term),
                    )
                )
            
            organization = filters.get("organization")
            if organization:
                query = query.where(Participant.organization == organization)

        query = query.order_by(Participant.name).offset(skip).limit(min(limit, MAX_LIMIT))
        result = await db.execute(query)
        return result.scalars().all()

    async def get_by_email(
        self, 
        db: AsyncSession, 
        email: str,
        include_inactive: bool = False
    ) -> Optional[Participant]:
        """Get a participant by email address"""
        if not email:
            return None
        
        query = select(Participant).where(Participant.email == email)
        if not include_inactive:
            query = query.where(Participant.is_active == True)
        
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def update(
        self, 
        db: AsyncSession, 
        id: UUID, 
        obj_in: Union[ParticipantUpdate, Dict[str, Any]],
        updated_by_id: UUID
    ) -> Optional[Participant]:
        """Update a participant with audit fields"""
        try:
            db_obj = await self.get(db, id)
            if not db_obj:
                return None
            
            if isinstance(obj_in, ParticipantUpdate):
                update_data = obj_in.model_dump(exclude_unset=True)
            else:
                update_data = obj_in
            
            if 'email' in update_data and update_data['email'] and update_data['email'] != db_obj.email:
                existing = await self.get_by_email(db, update_data['email'])
                if existing and existing.id != id:
                    raise ValueError(f"Participant with email '{update_data['email']}' already exists")
            
            for field, value in update_data.items():
                if value is not None and hasattr(db_obj, field):
                    setattr(db_obj, field, value)
            
            await self._update_audit_fields(db_obj, updated_by_id)
            
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update participant: {str(e)}")

    async def soft_delete(
        self, 
        db: AsyncSession, 
        id: UUID, 
        deleted_by_id: UUID
    ) -> Optional[Participant]:
        """Soft delete a participant with audit fields"""
        try:
            db_obj = await self.get(db, id)
            if db_obj:
                db_obj.is_active = False
                await self._update_audit_fields(db_obj, deleted_by_id)
                await db.commit()
                await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete participant: {str(e)}")

    async def search_participants(
        self, 
        db: AsyncSession, 
        query: str, 
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Search participants by email, name, or telephone."""
        try:
            stmt = (
                select(
                    Participant.id,
                    Participant.email,
                    Participant.name,
                    Participant.telephone,
                    Participant.title,
                    Participant.organization,
                    Participant.is_active,
                )
                .where(
                    or_(
                        Participant.email.ilike(f"%{query}%"),
                        Participant.name.ilike(f"%{query}%"),
                        Participant.telephone.ilike(f"%{query}%")
                    )
                )
                .order_by(Participant.name)
                .limit(limit)
            )
            
            result = await db.execute(stmt)
            rows = result.all()
            
            participants = []
            for row in rows:
                participant_dict = {
                    "id": str(row.id) if hasattr(row, 'id') else None,
                    "email": row.email,
                    "name": row.name,
                    "telephone": row.telephone,
                    "title": row.title,
                    "organization": row.organization,
                    "is_active": row.is_active if hasattr(row, 'is_active') else True,
                }
                participants.append(participant_dict)
            
            return participants
            
        except Exception as e:
            print(f"Error searching participants: {str(e)}")
            return []


# ============================================================================
# PARTICIPANT LIST CRUD
# ============================================================================

class CRUDParticipantList(CRUDBase[ParticipantList, ParticipantListCreate, ParticipantListUpdate], AuditMixin):
    
    def _participant_to_dict(self, participant: Participant) -> dict:
        """Convert participant ORM to dictionary for API responses"""
        return {
            "id": str(participant.id),
            "name": participant.name,
            "email": participant.email,
            "telephone": participant.telephone,
            "title": participant.title,
            "organization": participant.organization,
            "notes": participant.notes,
            "created_by_id": str(participant.created_by_id) if participant.created_by_id else None,
            "created_at": participant.created_at.isoformat() if participant.created_at else None,
            "updated_by_id": str(participant.updated_by_id) if participant.updated_by_id else None,
            "updated_at": participant.updated_at.isoformat() if participant.updated_at else None,
            "is_active": participant.is_active,
            "created_by_name": None,
            "updated_by_name": None,
        }

    def _list_to_dict(self, list_obj: ParticipantList, include_participants: bool = False) -> dict:
        """Convert participant list ORM to dictionary with user names"""
        created_by_name = None
        if list_obj.created_by:
            created_by_name = list_obj.created_by.full_name or list_obj.created_by.username or list_obj.created_by.email
        
        updated_by_name = None
        if list_obj.updated_by:
            updated_by_name = list_obj.updated_by.full_name or list_obj.updated_by.username or list_obj.updated_by.email
        
        result = {
            "id": str(list_obj.id),
            "name": list_obj.name,
            "description": list_obj.description,
            "is_global": list_obj.is_global,
            "created_by_id": str(list_obj.created_by_id) if list_obj.created_by_id else None,
            "created_by_name": created_by_name,
            "created_at": list_obj.created_at.isoformat() if list_obj.created_at else None,
            "updated_by_id": str(list_obj.updated_by_id) if list_obj.updated_by_id else None,
            "updated_by_name": updated_by_name,
            "updated_at": list_obj.updated_at.isoformat() if list_obj.updated_at else None,
            "is_active": list_obj.is_active,
            "member_count": len(list_obj.participants) if list_obj.participants else 0,
            "participants": [],
            "participant_count": len(list_obj.participants) if list_obj.participants else 0,
        }
        
        if include_participants and list_obj.participants:
            result["participants"] = [self._participant_to_dict(p) for p in list_obj.participants]
            result["participant_count"] = len(list_obj.participants)
        
        return result

    async def create(
        self, 
        db: AsyncSession, 
        obj_in: ParticipantListCreate, 
        created_by_id: UUID
    ) -> dict:
        """Create participant list with audit fields"""
        try:
            participant_ids = getattr(obj_in, 'participant_ids', [])
            list_data = obj_in.model_dump(exclude={'participant_ids'})
            
            db_obj = ParticipantList(**list_data)
            db_obj.created_by_id = created_by_id
            db_obj.updated_by_id = created_by_id
            
            if participant_ids:
                participants = await self._get_participants_by_ids(db, participant_ids)
                db_obj.participants = participants
            
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            await db.refresh(db_obj, attribute_names=['participants'])
            
            logger.info(f"Created participant list: {db_obj.name} (ID: {db_obj.id})")
            return self._list_to_dict(db_obj, include_participants=True)
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Database error creating participant list: {e}")
            raise ValueError(f"Failed to create participant list: {str(e)}")
    
    async def get(self, db: AsyncSession, id: UUID, include_participants: bool = True) -> Optional[dict]:
        """Get a single participant list by ID as dictionary"""
        try:
            query = select(ParticipantList).where(
                ParticipantList.id == id, 
                ParticipantList.is_active == True
            )
            
            if include_participants:
                query = query.options(selectinload(ParticipantList.participants))
            
            result = await db.execute(query)
            db_obj = result.scalar_one_or_none()
            
            if not db_obj:
                return None
            
            return self._list_to_dict(db_obj, include_participants=include_participants)
            
        except SQLAlchemyError as e:
            logger.error(f"Database error fetching list {id}: {e}")
            return None
    
    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT,
        include_inactive: bool = False,
        include_participants: bool = False
    ) -> Tuple[List[dict], int]:
        """Get multiple participant lists with pagination"""
        try:
            query = select(ParticipantList)
            
            if include_participants:
                query = query.options(selectinload(ParticipantList.participants))
            
            if not include_inactive:
                query = query.where(ParticipantList.is_active == True)
            
            count_query = select(func.count()).select_from(query.subquery())
            count_result = await db.execute(count_query)
            total = count_result.scalar() or 0
            
            query = query.offset(skip).limit(min(limit, MAX_LIMIT)).order_by(ParticipantList.name)
            result = await db.execute(query)
            lists = result.scalars().all()
            
            list_dicts = [self._list_to_dict(lst, include_participants=include_participants) for lst in lists]
            
            return list_dicts, total
            
        except SQLAlchemyError as e:
            logger.error(f"Database error fetching lists: {e}")
            return [], 0
    
    async def _get_participants_by_ids(self, db: AsyncSession, participant_ids: List[UUID]) -> List[Participant]:
        """Helper to fetch participants by IDs"""
        if not participant_ids:
            return []
        
        result = await db.execute(
            select(Participant)
            .where(Participant.id.in_(participant_ids), Participant.is_active == True)
        )
        return result.scalars().all()


# ============================================================================
# MEETING CRUD
# ============================================================================

class CRUDMeeting(CRUDBase[Meeting, None, None], AuditMixin):
    """CRUD operations for Meeting entity"""

    async def create_with_participants(
        self,
        db: AsyncSession,
        meeting_data: Dict[str, Any],
        user_id: UUID,
    ) -> Meeting:
        """Create a meeting with participants"""
        try:
            meeting = Meeting(
                title=meeting_data.get('title'),
                description=meeting_data.get('description'),
                meeting_date=meeting_data.get('meeting_date'),
                start_time=meeting_data.get('start_time'),
                end_time=meeting_data.get('end_time'),
                location_text=meeting_data.get('location_text'),
                location_id=meeting_data.get('location_id'),
                gps_coordinates=meeting_data.get('gps_coordinates'),
                agenda=meeting_data.get('agenda'),
                facilitator=meeting_data.get('facilitator'),
                chairperson_name=meeting_data.get('chairperson_name'),
                status_id=meeting_data.get('status_id'),
                visibility=meeting_data.get('visibility', 'open'),
                restricted_department_id=meeting_data.get('restricted_department_id'),
                created_by_id=user_id,
                created_at=datetime.now(),
                is_active=True
            )
            
            db.add(meeting)
            await db.flush()
            
            participants = meeting_data.get('custom_participants', [])
            for participant_data in participants:
                participant = MeetingParticipant(
                    meeting_id=meeting.id,
                    name=participant_data.get('name'),
                    email=participant_data.get('email'),
                    telephone=participant_data.get('telephone'),
                    title=participant_data.get('title'),
                    organization=participant_data.get('organization'),
                    is_chairperson=participant_data.get('is_chairperson', False),
                    is_secretary=participant_data.get('is_secretary', False),
                    created_by_id=user_id,
                    created_at=datetime.now(),
                    is_active=True
                )
                db.add(participant)
            
            await db.commit()
            await db.refresh(meeting)
            return meeting
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to create meeting: {str(e)}")
    
    async def get_meeting_with_details(self, db: AsyncSession, meeting_id: UUID) -> Optional[Meeting]:
        """Get meeting with all relationships loaded"""
        result = await db.execute(
            select(Meeting)
            .where(Meeting.id == meeting_id, Meeting.is_active == True)
            .options(
                selectinload(Meeting.participants),
                selectinload(Meeting.minutes),
                selectinload(Meeting.documents),
                selectinload(Meeting.status_history),
                selectinload(Meeting.created_by),
                selectinload(Meeting.updated_by),
                selectinload(Meeting.location),
                selectinload(Meeting.department),
                selectinload(Meeting.restricted_department)
            )
        )
        return result.scalar_one_or_none()
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[Meeting]:
        """Get a meeting by ID"""
        result = await db.execute(
            select(Meeting)
            .where(Meeting.id == id, Meeting.is_active == True)
            .options(
                selectinload(Meeting.participants),
                selectinload(Meeting.department),
                selectinload(Meeting.restricted_department)
            )
        )
        return result.scalar_one_or_none()
    
    async def get_multi(
        self, db: AsyncSession, skip: int = DEFAULT_SKIP, limit: int = DEFAULT_LIMIT, include_inactive: bool = False
    ) -> List[Meeting]:
        """Get multiple meetings"""
        query = select(Meeting).options(
            selectinload(Meeting.participants),
            selectinload(Meeting.department),
            selectinload(Meeting.restricted_department)
        )
        if not include_inactive:
            query = query.where(Meeting.is_active == True)
        query = query.offset(skip).limit(min(limit, MAX_LIMIT)).order_by(Meeting.meeting_date.desc())
        result = await db.execute(query)
        return result.scalars().all()
    
    async def soft_delete(self, db: AsyncSession, id: UUID, deleted_by_id: UUID) -> Optional[Meeting]:
        """Soft delete a meeting"""
        try:
            db_obj = await self.get(db, id)
            if db_obj:
                db_obj.is_active = False
                await self._update_audit_fields(db_obj, deleted_by_id)
                await db.commit()
                await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete meeting: {str(e)}")


# ============================================================================
# MEETING DOCUMENT CRUD
# ============================================================================

class CRUDMeetingDocument(CRUDBase[MeetingDocument, None, None], AuditMixin):
    """CRUD operations for MeetingDocument entity"""
    
    async def upload_document(
        self,
        db: AsyncSession,
        meeting_id: UUID,
        file: UploadFile,
        title: str,
        description: Optional[str],
        document_type_id: Optional[UUID],
        user_id: UUID
    ) -> MeetingDocument:
        """Upload a document to a meeting"""
        object_name = None
        try:
            file_content = await file.read()
            file_size = len(file_content)
            
            file_extension = os.path.splitext(file.filename)[1]
            object_name = f"meeting_documents/{meeting_id}/{uuid4()}{file_extension}"
            
            minio_service.upload_bytes(
                object_name=object_name,
                data=file_content,
                content_type=file.content_type,
            )
            
            document_data = {
                "meeting_id": meeting_id,
                "file_name": file.filename,
                "file_path": object_name,
                "file_size": file_size,
                "mime_type": file.content_type,
                "title": title,
                "description": description,
                "document_type_id": document_type_id,
                "uploaded_by_id": user_id,
                "created_by_id": user_id,
                "updated_by_id": user_id,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "is_active": True,
                "version": 1
            }
            
            document_data = {k: v for k, v in document_data.items() if v is not None}
            
            db_obj = MeetingDocument(**document_data)
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            
            return db_obj
            
        except Exception as e:
            await db.rollback()
            if object_name:
                minio_service.delete_object(object_name)
            logger.error(f"Failed to upload document: {str(e)}")
            raise ValueError(f"Failed to upload document: {str(e)}")
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[MeetingDocument]:
        """Get a document by ID"""
        result = await db.execute(
            select(MeetingDocument)
            .options(
                selectinload(MeetingDocument.document_type),
                selectinload(MeetingDocument.uploaded_by)
            )
            .where(MeetingDocument.id == id, MeetingDocument.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def get_meeting_documents(self, db: AsyncSession, meeting_id: UUID) -> List[MeetingDocument]:
        """Get all documents for a meeting"""
        try:
            result = await db.execute(
                select(MeetingDocument)
                .where(MeetingDocument.meeting_id == meeting_id)
                .where(MeetingDocument.is_active == True)
                .options(
                    selectinload(MeetingDocument.document_type),
                    selectinload(MeetingDocument.uploaded_by)
                )
                .order_by(MeetingDocument.uploaded_at.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching documents: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def delete(self, db: AsyncSession, id: UUID, user_id: UUID, soft_delete: bool = True) -> Optional[MeetingDocument]:
        """Delete a document"""
        try:
            db_obj = await self.get(db, id)
            if not db_obj:
                return None
            
            if soft_delete:
                db_obj.is_active = False
                await self._update_audit_fields(db_obj, user_id)
            else:
                if db_obj.file_path:
                    minio_service.delete_object(db_obj.file_path)
                await db.delete(db_obj)
            
            await db.commit()
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete document: {str(e)}")


# ============================================================================
# MEETING ACTION CRUD - COMPLETE REWRITE WITH persons_implementing SUPPORT
# ============================================================================

class CRUDMeetingAction(CRUDBase[MeetingAction, MeetingActionCreate, MeetingActionUpdate], AuditMixin):
    """CRUD operations for MeetingAction entity with persons_implementing support"""
    
    # ==================== HELPER METHODS ====================
    
    def _normalize_person_data(self, person_data: Any) -> Dict[str, Any]:
        """Normalize person data to a dictionary"""
        if hasattr(person_data, 'dict'):
            return person_data.dict()
        if isinstance(person_data, dict):
            return person_data.copy()
        return {}
    
    def _get_person_name(self, person_dict: Dict[str, Any]) -> str:
        """Extract name from person dictionary"""
        return person_dict.get('name') or person_dict.get('full_name') or 'Unassigned'
    
    def _get_person_email(self, person_dict: Dict[str, Any]) -> Optional[str]:
        """Extract email from person dictionary"""
        return person_dict.get('email')
    
    def _get_person_phone(self, person_dict: Dict[str, Any]) -> Optional[str]:
        """Extract phone from person dictionary"""
        return person_dict.get('phone') or person_dict.get('telephone')
    
    def _get_person_user_id(self, person_dict: Dict[str, Any]) -> Optional[UUID]:
        """Extract user_id from person dictionary and safely cast to UUID if present.

        The ActionImplementer table stores the FK as `user_id`.
        The frontend sends the value under `user_id` (preferred) and also
        mirrors it to `assigned_to_id` for backward compatibility.
        We accept all three possible field names so nothing is silently dropped.
        """
        raw_id = (
            person_dict.get('user_id') or
            person_dict.get('assigned_to_id') or
            person_dict.get('id')
        )
        if raw_id is not None and not isinstance(raw_id, UUID):
            try:
                return UUID(str(raw_id))
            except (ValueError, TypeError):
                return None
        return raw_id
    
    # ==================== CREATE ====================
    
    async def create_action(
        self, db: AsyncSession, minute_id: UUID, action_in: MeetingActionCreate, assigned_by_id: UUID
    ) -> MeetingAction:
        """Create a new action from meeting minutes with persons_implementing support"""
        try:
            action_data = action_in.model_dump()
            
            # ==================== LEGACY FIELDS ====================
            assigned_to_id = action_data.get('assigned_to_id')
            if assigned_to_id is not None and not isinstance(assigned_to_id, UUID):
                try:
                    assigned_to_id = UUID(str(assigned_to_id))
                except (ValueError, TypeError):
                    assigned_to_id = None

            assigned_to_name = action_data.get('assigned_to_name')
            
            if assigned_to_id:
                user_result = await db.execute(
                    select(User).where(User.id == assigned_to_id, User.is_active == True)
                )
                user = user_result.scalar_one_or_none()
                if not user:
                    assigned_to_id = None
                    if not assigned_to_name:
                        assigned_to_name = {"name": "Unknown User", "type": "manual"}
                else:
                    if not assigned_to_name:
                        assigned_to_name = {
                            "id": str(user.id),
                            "name": user.full_name or user.username,
                            "email": user.email,
                            "phone": getattr(user, 'phone', None) or getattr(user, 'telephone', None),
                            "type": "user"
                        }
            
            # ==================== CREATE ACTION ====================
            action = MeetingAction(
                minute_id=minute_id,
                description=action_data.get('description'),
                assigned_to_id=assigned_to_id,
                assigned_to_name=assigned_to_name,
                assigned_by_id=assigned_by_id,
                assigned_at=datetime.now(),
                due_date=action_data.get('due_date'),
                priority=action_data.get('priority', 2),
                remarks=action_data.get('remarks'),
                title=action_data.get('title'),
                issue_challenge=action_data.get('issue_challenge'),
                type_of_action=action_data.get('type_of_action'),
                date_initiated=action_data.get('date_initiated') or datetime.now(),
                is_key_action=action_data.get('is_key_action', False),
                tags=action_data.get('tags', []),
                assign_to_meeting_id=action_data.get('assign_to_meeting_id'),
                created_by_id=assigned_by_id,
                created_at=datetime.now(),
                is_active=True
            )
            
            db.add(action)
            await db.flush()  # Get action.id
            
            # ==================== CREATE IMPLEMENTERS ====================
            persons_implementing = action_data.get('persons_implementing', [])
            
            if persons_implementing:
                logger.info(f"Creating {len(persons_implementing)} implementers for action {action.id}")
                
                for idx, person_data in enumerate(persons_implementing):
                    person_dict = self._normalize_person_data(person_data)
                    
                    implementer = ActionImplementer(
                        id=uuid4(),
                        action_id=action.id,
                        user_id=self._get_person_user_id(person_dict),
                        name=self._get_person_name(person_dict),
                        email=self._get_person_email(person_dict),
                        phone=self._get_person_phone(person_dict),
                        sort_order=idx
                    )
                    db.add(implementer)
                    logger.info(f"Added implementer: {implementer.name} (sort_order: {idx})")
            
            await db.commit()
            await db.refresh(action)
            
            # ==================== LOAD IMPLEMENTERS ====================
            result = await db.execute(
                select(ActionImplementer)
                .where(ActionImplementer.action_id == action.id)
                .order_by(ActionImplementer.sort_order)
            )
            action.implementers = result.scalars().all()
            
            logger.info(f"Action {action.id} created with {len(action.implementers)} implementers")
            return action
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create action: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to create action: {str(e)}")
    
    # ==================== READ ====================
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[MeetingAction]:
        """Get a single action by ID with all relationships including implementers"""
        result = await db.execute(
            select(MeetingAction)
            .options(
                selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
                selectinload(MeetingAction.assigned_to),
                selectinload(MeetingAction.assigned_by),
                selectinload(MeetingAction.created_by),
                selectinload(MeetingAction.updated_by),
                selectinload(MeetingAction.overall_status),
                selectinload(MeetingAction.implementers),  # ✅ Load implementers
                selectinload(MeetingAction.comments),
                selectinload(MeetingAction.status_history)
            )
            .where(MeetingAction.id == id, MeetingAction.is_active == True)
        )
        action = result.scalar_one_or_none()
        
        if action:
            logger.debug(f"Action {action.id} - implementers: {len(action.implementers) if action.implementers else 0}")
        
        return action
    
    async def get_action_with_details(self, db: AsyncSession, action_id: UUID) -> Optional[MeetingAction]:
        """Get action with all relationships loaded (alias for get)"""
        return await self.get(db, action_id)
    
    async def get_multi(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        minute_id: Optional[UUID] = None,
        assigned_to_id: Optional[UUID] = None,
        status_id: Optional[UUID] = None,
        include_completed: bool = False
    ) -> List[MeetingAction]:
        """Get multiple actions with filters"""
        query = select(MeetingAction).where(MeetingAction.is_active == True)
        
        if minute_id:
            query = query.where(MeetingAction.minute_id == minute_id)
        if assigned_to_id:
            query = query.where(MeetingAction.assigned_to_id == assigned_to_id)
        if status_id:
            query = query.where(MeetingAction.overall_status_id == status_id)
        if not include_completed:
            query = query.where(MeetingAction.completed_at.is_(None))
        
        query = query.offset(skip).limit(min(limit, MAX_LIMIT))
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_actions_assigned_to_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        user_email: Optional[str] = None,
        user_phone: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[int] = None,
        is_overdue: Optional[bool] = None,
        include_completed: bool = False,
    ) -> List[MeetingAction]:
        """Get actions assigned to user - checks both legacy fields and implementers"""
        from sqlalchemy import or_, and_, func
        from sqlalchemy.sql import case
        
        query = select(MeetingAction).options(
            selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
            selectinload(MeetingAction.assigned_to),
            selectinload(MeetingAction.assigned_by),
            selectinload(MeetingAction.implementers)  # ✅ Load implementers
        )
        
        # Build conditions for matching assignments
        conditions = []
        
        # 1. Direct assignment (legacy)
        if user_id:
            conditions.append(MeetingAction.assigned_to_id == user_id)
        
        # 2. Check legacy assigned_to_name JSON for email/phone match
        if user_email:
            conditions.append(
                MeetingAction.assigned_to_name.op('->>')('email').like(f"%{user_email}%")
            )
        if user_phone:
            conditions.append(
                MeetingAction.assigned_to_name.op('->>')('phone').like(f"%{user_phone}%")
            )
        
        # 3. Check implementers table
        implementer_conditions = []
        if user_id:
            implementer_conditions.append(ActionImplementer.user_id == user_id)
        if user_email:
            implementer_conditions.append(ActionImplementer.email.like(f"%{user_email}%"))
        if user_phone:
            implementer_conditions.append(ActionImplementer.phone.like(f"%{user_phone}%"))
        
        if implementer_conditions:
            implementer_subquery = select(ActionImplementer.action_id).where(or_(*implementer_conditions))
            conditions.append(MeetingAction.id.in_(implementer_subquery))
        
        # Apply OR condition
        if conditions:
            query = query.where(or_(*conditions))
        else:
            # If no conditions, return empty (shouldn't happen)
            return []
        
        # Only active actions
        query = query.where(MeetingAction.is_active == True)
        
        # Filter by completion status
        if not include_completed:
            query = query.where(MeetingAction.completed_at.is_(None))
        
        # Search filter
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    MeetingAction.description.like(term),
                    MeetingAction.title.like(term),
                    MeetingAction.issue_challenge.like(term)
                )
            )
        
        # Status filter
        if status:
            query = query.where(MeetingAction.overall_status_name == status)
        
        # Priority filter
        if priority is not None:
            query = query.where(MeetingAction.priority == priority)
        
        # Overdue filter
        if is_overdue is True:
            query = query.where(
                and_(
                    MeetingAction.due_date.is_not(None),
                    MeetingAction.due_date < datetime.now(),
                    MeetingAction.completed_at.is_(None)
                )
            )
        
        # Sort safely: use string comparison or separate out NULLs without type clashes
        query = query.order_by(
            case(
                (MeetingAction.due_date.is_(None), 1),
                else_=0
            ),
            MeetingAction.due_date.asc(),
            MeetingAction.created_at.desc()
        ).offset(skip).limit(min(limit, MAX_LIMIT))
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_overdue_actions_for_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[MeetingAction]:
        """Get overdue actions assigned to a user"""
        from sqlalchemy import and_
        
        now = datetime.now()
        
        query = select(MeetingAction).options(
            selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
            selectinload(MeetingAction.assigned_to),
            selectinload(MeetingAction.assigned_by),
            selectinload(MeetingAction.implementers)
        ).where(
            MeetingAction.assigned_to_id == user_id,
            MeetingAction.is_active == True,
            MeetingAction.completed_at.is_(None),
            MeetingAction.due_date.is_not(None),
            MeetingAction.due_date < now
        ).order_by(
            MeetingAction.due_date.asc(),
            MeetingAction.priority.asc()
        ).offset(skip).limit(min(limit, 100))
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_my_tasks(self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100):
        """Alias for get_actions_assigned_to_user"""
        return await self.get_actions_assigned_to_user(db, user_id, skip, limit)
    
    # ==================== UPDATE ====================
    
    async def update_action(
        self, db: AsyncSession, action_id: UUID, action_in: MeetingActionUpdate, updated_by_id: UUID
    ) -> Optional[MeetingAction]:
        """Update an action including implementers"""
        try:
            action = await self.get(db, action_id)
            if not action:
                return None
            
            update_data = action_in.model_dump(exclude_unset=True)
            
            # ==================== HANDLE IMPLEMENTERS ====================
            if 'persons_implementing' in update_data:
                # Delete all existing implementers
                await db.execute(
                    delete(ActionImplementer).where(ActionImplementer.action_id == action_id)
                )
                
                # Create new implementers
                persons_implementing = update_data.get('persons_implementing', [])
                for idx, person_data in enumerate(persons_implementing):
                    person_dict = self._normalize_person_data(person_data)
                    
                    implementer = ActionImplementer(
                        id=uuid4(),
                        action_id=action_id,
                        user_id=self._get_person_user_id(person_dict),
                        name=self._get_person_name(person_dict),
                        email=self._get_person_email(person_dict),
                        phone=self._get_person_phone(person_dict),
                        sort_order=idx
                    )
                    db.add(implementer)
                    logger.info(f"Updated implementer: {implementer.name} (sort_order: {idx})")
            
            # ==================== UPDATE LEGACY FIELDS ====================
            if 'assigned_to_id' in update_data:
                assigned_to_id = update_data.get('assigned_to_id')
                if assigned_to_id is not None and not isinstance(assigned_to_id, UUID):
                    try:
                        assigned_to_id = UUID(str(assigned_to_id))
                    except (ValueError, TypeError):
                        assigned_to_id = None

                assigned_to_name = update_data.get('assigned_to_name')
                
                if assigned_to_id and not assigned_to_name:
                    user_result = await db.execute(
                        select(User).where(User.id == assigned_to_id, User.is_active == True)
                    )
                    user = user_result.scalar_one_or_none()
                    if user:
                        assigned_to_name = {
                            "id": str(user.id),
                            "name": user.full_name or user.username,
                            "email": user.email,
                            "phone": getattr(user, 'phone', None) or getattr(user, 'telephone', None),
                            "type": "user"
                        }
                
                action.assigned_to_id = assigned_to_id
                if assigned_to_name:
                    action.assigned_to_name = assigned_to_name
            
            # ==================== UPDATE OTHER FIELDS ====================
            fields_to_update = [
                'description', 'due_date', 'priority', 'remarks',
                'title', 'issue_challenge', 'type_of_action',
                'is_key_action', 'tags', 'assign_to_meeting_id',
                'overall_status_id', 'overall_progress_percentage'
            ]
            for field in fields_to_update:
                if field in update_data and update_data[field] is not None:
                    setattr(action, field, update_data[field])
            
            # Update audit fields
            action.updated_at = datetime.now()
            action.updated_by_id = updated_by_id
            
            await db.commit()
            await db.refresh(action)
            
            # ==================== LOAD IMPLEMENTERS ====================
            result = await db.execute(
                select(ActionImplementer)
                .where(ActionImplementer.action_id == action_id)
                .order_by(ActionImplementer.sort_order)
            )
            action.implementers = result.scalars().all()
            
            logger.info(f"Action {action_id} updated with {len(action.implementers)} implementers")
            return action
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update action: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to update action: {str(e)}")
    
    async def update_progress(
        self,
        db: AsyncSession,
        action_id: UUID,
        progress_update: ActionProgressUpdate,
        user_id: UUID
    ) -> Optional[MeetingAction]:
        """Update action progress percentage and status"""
        try:
            action = await self.get(db, action_id)
            if not action:
                return None
            
            old_progress = action.overall_progress_percentage
            old_status_id = action.overall_status_id
            
            action.overall_progress_percentage = progress_update.progress_percentage
            
            if progress_update.individual_status_id:
                action.overall_status_id = progress_update.individual_status_id
            
            if progress_update.progress_percentage >= 100:
                if not action.completed_at:
                    action.completed_at = datetime.now()
            elif action.completed_at:
                action.completed_at = None
            
            action.updated_at = datetime.now()
            action.updated_by_id = user_id
            
            status_history = ActionStatusHistory(
                action_id=action_id,
                individual_status_id=progress_update.individual_status_id,
                progress_percentage=progress_update.progress_percentage,
                remarks=progress_update.remarks or f"Progress updated from {old_progress}% to {progress_update.progress_percentage}%",
                created_by_id=user_id,
                created_at=datetime.now(),
                is_active=True
            )
            
            db.add(status_history)
            await db.commit()
            await db.refresh(action)
            
            return action
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update progress: {str(e)}")
    
    async def assign_action(
        self,
        db: AsyncSession,
        action_id: UUID,
        assigned_to_id: UUID,
        assigned_by_id: UUID,
        assigned_to_name: Optional[Dict[str, Any]] = None
    ) -> Optional[MeetingAction]:
        """Assign an action to a user - updates both legacy fields and implementers"""
        try:
            if assigned_to_id is not None and not isinstance(assigned_to_id, UUID):
                try:
                    assigned_to_id = UUID(str(assigned_to_id))
                except (ValueError, TypeError):
                    raise ValueError(f"Invalid UUID format for assigned_to_id: {assigned_to_id}")

            action = await self.get(db, action_id)
            if not action:
                return None
            
            # Get user details
            user_result = await db.execute(
                select(User).where(User.id == assigned_to_id, User.is_active == True)
            )
            user = user_result.scalar_one_or_none()
            if not user:
                raise ValueError(f"User with id {assigned_to_id} not found")
            
            # Update legacy fields
            action.assigned_to_id = assigned_to_id
            if assigned_to_name:
                action.assigned_to_name = assigned_to_name
            else:
                action.assigned_to_name = {
                    "id": str(user.id),
                    "name": user.full_name or user.username,
                    "email": user.email,
                    "phone": getattr(user, 'phone', None) or getattr(user, 'telephone', None),
                    "type": "user"
                }
            
            # Update assignment metadata
            action.assigned_at = datetime.now()
            action.assigned_by_id = assigned_by_id
            action.updated_at = datetime.now()
            action.updated_by_id = assigned_by_id
            
            # ==================== UPDATE IMPLEMENTERS ====================
            # Delete existing implementers
            await db.execute(
                delete(ActionImplementer).where(ActionImplementer.action_id == action_id)
            )
            
            # Create a single implementer for the assigned user
            implementer = ActionImplementer(
                id=uuid4(),
                action_id=action_id,
                user_id=assigned_to_id,
                name=user.full_name or user.username,
                email=user.email,
                phone=getattr(user, 'phone', None) or getattr(user, 'telephone', None),
                sort_order=0
            )
            db.add(implementer)
            
            await db.commit()
            await db.refresh(action)
            
            # Load implementers
            result = await db.execute(
                select(ActionImplementer)
                .where(ActionImplementer.action_id == action_id)
                .order_by(ActionImplementer.sort_order)
            )
            action.implementers = result.scalars().all()
            
            logger.info(f"Action {action_id} assigned to user {assigned_to_id}")
            return action
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to assign action: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to assign action: {str(e)}")
    
    # ==================== COMMENTS ====================
    
    async def add_comment(
        self, 
        db: AsyncSession, 
        action_id: UUID, 
        comment_in: ActionCommentCreate, 
        user_id: UUID
    ) -> ActionComment:
        """Add a comment to an action item"""
        try:
            action = await self.get(db, action_id)
            if not action:
                raise ValueError(f"Action with id {action_id} not found")
            
            comment = ActionComment(
                action_id=action_id,
                comment=comment_in.comment,
                attachment_url=comment_in.attachment_url,
                created_by_id=user_id,
                created_at=datetime.now(),
                is_active=True
            )
            
            db.add(comment)
            await db.commit()
            await db.refresh(comment)
            await db.refresh(comment, attribute_names=["created_by"])
            
            return comment
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to add comment: {str(e)}")
    
    async def get_comments(
        self, 
        db: AsyncSession, 
        action_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[ActionComment]:
        """Get all comments for an action item"""
        try:
            result = await db.execute(
                select(ActionComment)
                .options(selectinload(ActionComment.created_by))
                .where(
                    ActionComment.action_id == action_id,
                    ActionComment.is_active == True
                )
                .order_by(ActionComment.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            return result.scalars().all()
        except Exception as e:
            raise ValueError(f"Failed to fetch comments: {str(e)}")
    
    # ==================== HISTORY ====================
    
    async def get_status_history(
        self,
        db: AsyncSession,
        action_id: UUID,
        skip: int = 0,
        limit: int = 50
    ) -> List[ActionStatusHistory]:
        """Get status change history for an action"""
        try:
            result = await db.execute(
                select(ActionStatusHistory)
                .where(
                    ActionStatusHistory.action_id == action_id,
                    ActionStatusHistory.is_active == True
                )
                .order_by(ActionStatusHistory.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            return result.scalars().all()
        except Exception as e:
            raise ValueError(f"Failed to fetch status history: {str(e)}")
    
    # ==================== DELETE ====================
    
    async def soft_delete(self, db: AsyncSession, action_id: UUID, user_id: UUID) -> bool:
        """Soft delete an action"""
        try:
            action = await self.get(db, action_id)
            if not action:
                return False
            
            # Check permission
            if action.created_by_id != user_id:
                user_result = await db.execute(
                    select(User).where(User.id == user_id)
                )
                user = user_result.scalar_one_or_none()
                is_admin = any(role.code in ["admin", "super_admin"] for role in user.roles)
                if not is_admin:
                    raise ValueError("Only the task creator or admin can delete this action")
            
            action.is_active = False
            action.updated_at = datetime.now()
            action.updated_by_id = user_id
            
            # Soft delete comments
            comments_result = await db.execute(
                select(ActionComment).where(ActionComment.action_id == action_id)
            )
            for comment in comments_result.scalars().all():
                comment.is_active = False
                comment.updated_at = datetime.now()
                comment.updated_by_id = user_id
            
            # Soft delete implementers
            await db.execute(
                update(ActionImplementer).where(
                    ActionImplementer.action_id == action_id
                ).values(
                    is_active=False,
                    updated_at=datetime.now(),
                    updated_by_id=user_id
                )
            )
            
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete action: {str(e)}")


# ============================================================================
# MEETING MINUTES CRUD
# ============================================================================

class CRUDMeetingMinutes(CRUDBase[MeetingMinutes, MeetingMinutesCreate, MeetingMinutesUpdate]):
    """CRUD operations for meeting minutes"""
    
    async def create_default_minute(
        self,
        db: AsyncSession,
        meeting_id: UUID,
        action_description: str,
        user_id: UUID
    ) -> MeetingMinutes:
        """Create a default minute for a meeting"""
        now = datetime.now()
        default_minute = MeetingMinutes(
            meeting_id=meeting_id,
            topic=f"Action Item - {now.strftime('%Y-%m-%d %H:%M')}",
            discussion=f"Auto-created from action: {action_description[:100]}...",
            timestamp=now,
            recorded_by_id=user_id,
            created_by_id=user_id,
            created_at=now,
            is_active=True
        )
        
        db.add(default_minute)
        await db.commit()
        await db.refresh(default_minute)
        return default_minute
    
    async def get_minutes_by_meeting(
        self,
        db: AsyncSession,
        meeting_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[MeetingMinutes]:
        """Get all minutes for a meeting"""
        query = select(MeetingMinutes).where(
            and_(
                MeetingMinutes.meeting_id == meeting_id,
                MeetingMinutes.is_active == True
            )
        ).offset(skip).limit(limit).order_by(MeetingMinutes.created_at.desc())
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_meeting_minutes(
        self,
        db: AsyncSession,
        meeting_id: UUID,
        skip: int = 0,
        limit: int = 100,
        include_actions: bool = True
    ) -> List[MeetingMinutes]:
        """Get all minutes for a meeting with pagination"""
        query = select(MeetingMinutes).where(
            MeetingMinutes.meeting_id == meeting_id,
            MeetingMinutes.is_active == True
        )
        
        if include_actions:
            query = query.options(
                # ── FIX: also eager-load implementers on every action ──────────
                # Without this, action.implementers is always [] when accessed
                # through the minutes list endpoint, even when rows exist in the
                # action_implementers table. The detail endpoint was fine because
                # CRUDMeetingAction.get() already had selectinload(implementers).
                selectinload(MeetingMinutes.actions).selectinload(MeetingAction.implementers),
                selectinload(MeetingMinutes.created_by),
                selectinload(MeetingMinutes.recorded_by)
            )
        
        query = query.order_by(MeetingMinutes.created_at.desc()).offset(skip).limit(min(limit, 100))
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_minute_by_id(
        self,
        db: AsyncSession,
        minute_id: UUID
    ) -> Optional[MeetingMinutes]:
        """Get a single minute by ID with relationships loaded"""
        query = select(MeetingMinutes).where(
            MeetingMinutes.id == minute_id,
            MeetingMinutes.is_active == True
        ).options(
            selectinload(MeetingMinutes.actions).selectinload(MeetingAction.implementers),
            selectinload(MeetingMinutes.created_by),
            selectinload(MeetingMinutes.recorded_by)
        )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()


# ============================================================================
# MEETING PARTICIPANT CRUD
# ============================================================================

class CRUDMeetingParticipant(AuditMixin):
    """CRUD operations for MeetingParticipant entity"""
    
    async def get_by_meeting(
        self, 
        db: AsyncSession, 
        meeting_id: UUID, 
        search: Optional[str] = None,
        skip: int = DEFAULT_SKIP, 
        limit: int = DEFAULT_LIMIT,
        include_inactive: bool = False
    ) -> List[MeetingParticipant]:
        """Get all participants for a meeting with optional search and pagination"""
        try:
            query = select(MeetingParticipant).where(
                MeetingParticipant.meeting_id == meeting_id
            )
            
            if not include_inactive:
                query = query.where(MeetingParticipant.is_active == True)
            
            if search and search.strip():
                search_term = f"%{search.strip()}%"
                query = query.where(
                    or_(
                        MeetingParticipant.name.ilike(search_term),
                        MeetingParticipant.email.ilike(search_term),
                        MeetingParticipant.organization.ilike(search_term)
                    )
                )
            
            query = query.offset(skip).limit(min(limit, MAX_LIMIT)).order_by(
                MeetingParticipant.is_chairperson.desc(), 
                MeetingParticipant.name
            )
            
            result = await db.execute(query)
            return result.scalars().all()
            
        except Exception as e:
            logger.error(f"Error fetching participants for meeting {meeting_id}: {str(e)}")
            return []
    
    async def update_attendance(
        self, 
        db: AsyncSession, 
        participant_id: UUID, 
        attendance_status: str, 
        user_id: UUID,
        apology_comment: str = None
    ) -> Optional[MeetingParticipant]:
        """Update participant attendance status"""
        try:
            result = await db.execute(
                select(MeetingParticipant).where(
                    MeetingParticipant.id == participant_id,
                    MeetingParticipant.is_active == True
                )
            )
            participant = result.scalar_one_or_none()
            
            if not participant:
                raise ValueError(f"Participant with id {participant_id} not found")
            
            participant.attendance_status = attendance_status
            if apology_comment is not None:
                participant.apology_comment = apology_comment
            participant.updated_at = datetime.now()
            participant.updated_by_id = user_id
            
            await db.commit()
            await db.refresh(participant)
            return participant
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update attendance: {str(e)}")


# ============================================================================
# INITIALIZE CRUD INSTANCES
# ============================================================================

participant = CRUDParticipant(Participant)
participant_list = CRUDParticipantList(ParticipantList)
meeting_crud = CRUDMeeting(Meeting)
meeting_minutes = CRUDMeetingMinutes(MeetingMinutes)
meeting_action = CRUDMeetingAction(MeetingAction)
meeting_document = CRUDMeetingDocument(MeetingDocument)
meeting_participant = CRUDMeetingParticipant()

# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "participant",
    "participant_list",
    "meeting_crud",
    "meeting_minutes",
    "meeting_action",
    "meeting_document",
    "meeting_participant",
    "CRUDParticipant",
    "CRUDParticipantList",
    "CRUDMeeting",
    "CRUDMeetingMinutes",
    "CRUDMeetingAction",
    "CRUDMeetingDocument",
    "CRUDMeetingParticipant",
    "AuditMixin",
    "DEFAULT_LIMIT",
    "MAX_LIMIT",
    "DEFAULT_SKIP"
]