"""
Action Tracker CRUD Operations
Complete implementation with all CRUD operations for all entities
"""

import json
import os
from pathlib import Path
from typing import List, Optional, Dict, Any, Union, Tuple
from uuid import UUID
from datetime import datetime
from venv import logger

from fastapi import HTTPException, UploadFile
from sqlalchemy import select, and_, or_, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.action_tracker import (
    Meeting, MeetingMinutes, MeetingAction, MeetingParticipant,
    Participant, ParticipantList, ActionStatusHistory, ActionComment, 
    MeetingDocument, MeetingStatusHistory
)
from app.schemas.action_tracker_participants import (
    ParticipantCreate, ParticipantListCreate, ParticipantListUpdate, ParticipantUpdate
)
from app.schemas.meeting_minutes.meeting_minutes import (
    MeetingMinutesCreate, MeetingMinutesUpdate,
    MeetingActionCreate, MeetingActionUpdate,
)
from app.models.user import User

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


# ============================================================================
# PARTICIPANT LIST CRUD
# ============================================================================

class CRUDParticipantList(CRUDBase[ParticipantList, ParticipantListCreate, ParticipantListUpdate], AuditMixin):
    
    async def create(
        self, db: AsyncSession, obj_in: ParticipantListCreate, created_by_id: UUID
    ) -> ParticipantList:
        """Create participant list with audit fields"""
        try:
            participant_ids = getattr(obj_in, 'participant_ids', [])
            list_data = obj_in.model_dump(exclude={'participant_ids'})
            
            db_obj = ParticipantList(**list_data)
            await self._set_audit_fields(db_obj, created_by_id=created_by_id, updated_by_id=created_by_id)
            
            if participant_ids:
                participants = await self._get_participants_by_ids(db, participant_ids)
                db_obj.participants = participants
            
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to create participant list: {str(e)}")

    async def get(self, db: AsyncSession, id: UUID) -> Optional[ParticipantList]:
        """Get a single participant list by ID"""
        result = await db.execute(
            select(ParticipantList)
            .options(selectinload(ParticipantList.participants))
            .where(ParticipantList.id == id, ParticipantList.is_active == True)
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT,
        include_inactive: bool = False
    ) -> List[ParticipantList]:
        """Get multiple participant lists"""
        query = select(ParticipantList).options(selectinload(ParticipantList.participants))
        
        if not include_inactive:
            query = query.where(ParticipantList.is_active == True)
        
        query = query.offset(skip).limit(min(limit, MAX_LIMIT)).order_by(ParticipantList.name)
        result = await db.execute(query)
        return result.scalars().all()

    async def update(
        self, db: AsyncSession, db_obj: ParticipantList, obj_in: ParticipantListUpdate, updated_by_id: UUID
    ) -> ParticipantList:
        """Update participant list with audit fields"""
        try:
            update_data = obj_in.model_dump(exclude_unset=True)
            participant_ids = update_data.pop('participant_ids', None)
            
            for field, value in update_data.items():
                setattr(db_obj, field, value)
            
            if participant_ids is not None:
                participants = await self._get_participants_by_ids(db, participant_ids)
                db_obj.participants = participants
            
            await self._update_audit_fields(db_obj, updated_by_id)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update participant list: {str(e)}")

    async def soft_delete(
        self, db: AsyncSession, id: UUID, deleted_by_id: UUID
    ) -> Optional[ParticipantList]:
        """Soft delete a participant list"""
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
            raise ValueError(f"Failed to delete participant list: {str(e)}")

    async def _get_participants_by_ids(self, db: AsyncSession, participant_ids: List[UUID]) -> List[Participant]:
        """Helper to fetch participants by IDs"""
        if not participant_ids:
            return []
        
        result = await db.execute(
            select(Participant).where(Participant.id.in_(participant_ids))
        )
        return result.scalars().all()


# ============================================================================
# MEETING CRUD
# ============================================================================

class CRUDMeeting(CRUDBase[Meeting, None, None], AuditMixin):
    """CRUD operations for Meeting entity"""
    
    async def create(
        self, db: AsyncSession, meeting_data: Dict[str, Any], created_by_id: UUID
    ) -> Meeting:
        """Create a new meeting"""
        try:
            db_obj = Meeting(**meeting_data)
            await self._set_audit_fields(db_obj, created_by_id=created_by_id, updated_by_id=created_by_id)
            
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to create meeting: {str(e)}")
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[Meeting]:
        """Get a meeting by ID"""
        result = await db.execute(
            select(Meeting)
            .options(selectinload(Meeting.participants))
            .where(Meeting.id == id, Meeting.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def get_multi(
        self, db: AsyncSession, skip: int = DEFAULT_SKIP, limit: int = DEFAULT_LIMIT, include_inactive: bool = False
    ) -> List[Meeting]:
        """Get multiple meetings"""
        query = select(Meeting).options(selectinload(Meeting.participants))
        if not include_inactive:
            query = query.where(Meeting.is_active == True)
        query = query.offset(skip).limit(min(limit, MAX_LIMIT)).order_by(Meeting.meeting_date.desc())
        result = await db.execute(query)
        return result.scalars().all()
    
    async def update(
        self, db: AsyncSession, id: UUID, update_data: Dict[str, Any], updated_by_id: UUID
    ) -> Optional[Meeting]:
        """Update a meeting"""
        try:
            db_obj = await self.get(db, id)
            if not db_obj:
                return None
            
            for field, value in update_data.items():
                if value is not None:
                    setattr(db_obj, field, value)
            
            await self._update_audit_fields(db_obj, updated_by_id)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update meeting: {str(e)}")
    
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
        """Upload a document to a meeting - saves file to disk"""
        try:
            # Create upload directory if it doesn't exist
            upload_dir = Path("uploads/meeting_documents")
            upload_dir.mkdir(parents=True, exist_ok=True)
            
            # Read file content
            file_content = await file.read()
            file_size = len(file_content)
            
            # Generate unique filename to avoid collisions
            file_extension = os.path.splitext(file.filename)[1]
            unique_filename = f"{uuid4()}{file_extension}"
            file_path = upload_dir / unique_filename
            
            # Save the file to disk
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
            
            # Prepare document data
            document_data = {
                "meeting_id": meeting_id,
                "file_name": file.filename,
                "file_path": str(file_path),
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
            
            # Remove None values
            document_data = {k: v for k, v in document_data.items() if v is not None}
            
            # Create database record
            db_obj = MeetingDocument(**document_data)
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            
            return db_obj
            
        except Exception as e:
            await db.rollback()
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
            documents = result.scalars().all()
            return documents
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
                # Hard delete - also remove file from disk
                if db_obj.file_path and os.path.exists(db_obj.file_path):
                    os.remove(db_obj.file_path)
                await db.delete(db_obj)
            
            await db.commit()
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete document: {str(e)}")


# ============================================================================
# MEETING ACTION CRUD
# ============================================================================

class CRUDMeetingAction(CRUDBase[MeetingAction, MeetingActionCreate, MeetingActionUpdate], AuditMixin):
    """CRUD operations for MeetingAction entity"""
    
    async def create_action(
        self, db: AsyncSession, minute_id: UUID, action_in: MeetingActionCreate, assigned_by_id: UUID
    ) -> MeetingAction:
        """Create a new action from meeting minutes"""
        try:
            action_data = action_in.model_dump()
            assigned_to_id = action_data.get('assigned_to_id')
            
            # Verify assigned_to user exists
            if assigned_to_id:
                user_exists = await db.execute(
                    select(User).where(User.id == assigned_to_id, User.is_active == True)
                )
                if not user_exists.scalar_one_or_none():
                    assigned_to_id = None
            
            action = MeetingAction(
                minute_id=minute_id,
                description=action_data.get('description'),
                assigned_to_id=assigned_to_id,
                assigned_by_id=assigned_by_id,
                assigned_at=datetime.now(),
                due_date=action_data.get('due_date'),
                priority=action_data.get('priority', 2),
                estimated_hours=action_data.get('estimated_hours'),
                remarks=action_data.get('remarks'),
                created_by_id=assigned_by_id,
                created_at=datetime.now(),
                is_active=True
            )
            
            db.add(action)
            await db.commit()
            await db.refresh(action)
            return action
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to create action: {str(e)}")
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[MeetingAction]:
        """Get a single action by ID"""
        result = await db.execute(
            select(MeetingAction)
            .options(
                selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
                selectinload(MeetingAction.assigned_to),
                selectinload(MeetingAction.assigned_by)
            )
            .where(MeetingAction.id == id, MeetingAction.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def get_actions_assigned_to_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[int] = None,
        is_overdue: Optional[bool] = None,
        include_completed: bool = False,
    ) -> List[MeetingAction]:
        """Get actions assigned to user with filtering"""
        query = select(MeetingAction).options(
            selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
            selectinload(MeetingAction.assigned_to),
            selectinload(MeetingAction.assigned_by)
        )

        query = query.where(
            MeetingAction.assigned_to_id == user_id,
            MeetingAction.is_active == True
        )

        if not include_completed:
            query = query.where(MeetingAction.completed_at.is_(None))

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.where(MeetingAction.description.ilike(term))

        if status:
            query = query.where(MeetingAction.overall_status_name == status)

        if priority is not None:
            query = query.where(MeetingAction.priority == priority)

        if is_overdue is True:
            query = query.where(
                and_(
                    MeetingAction.due_date.is_not(None),
                    MeetingAction.due_date < datetime.now(),
                    MeetingAction.completed_at.is_(None)
                )
            )

        # Sort with NULL due_dates at the end
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
    
    async def get_my_tasks(self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100):
        """Alias for get_actions_assigned_to_user"""
        return await self.get_actions_assigned_to_user(db, user_id, skip, limit)
    
    async def update_action(
        self, db: AsyncSession, action_id: UUID, update_data: Dict[str, Any], updated_by_id: UUID
    ) -> Optional[MeetingAction]:
        """Update an action"""
        try:
            action = await self.get(db, action_id)
            if not action:
                return None
            
            for field, value in update_data.items():
                if value is not None:
                    setattr(action, field, value)
            
            await self._update_audit_fields(action, updated_by_id)
            await db.commit()
            await db.refresh(action)
            return action
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update action: {str(e)}")


# ============================================================================
# MEETING MINUTES CRUD
# ============================================================================

class CRUDMeetingMinutes(CRUDBase[MeetingMinutes, MeetingMinutesCreate, MeetingMinutesUpdate], AuditMixin):
    """CRUD operations for MeetingMinutes entity"""
    
    async def create(
        self, db: AsyncSession, meeting_id: UUID, obj_in: MeetingMinutesCreate, created_by_id: UUID
    ) -> MeetingMinutes:
        """Create meeting minutes"""
        try:
            minutes_data = obj_in.model_dump()
            db_obj = MeetingMinutes(meeting_id=meeting_id, **minutes_data)
            await self._set_audit_fields(db_obj, created_by_id=created_by_id, updated_by_id=created_by_id)
            
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to create minutes: {str(e)}")
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[MeetingMinutes]:
        """Get minutes by ID"""
        result = await db.execute(
            select(MeetingMinutes)
            .options(selectinload(MeetingMinutes.actions))
            .where(MeetingMinutes.id == id, MeetingMinutes.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def get_by_meeting(
        self, db: AsyncSession, meeting_id: UUID, skip: int = DEFAULT_SKIP, limit: int = DEFAULT_LIMIT
    ) -> List[MeetingMinutes]:
        """Get all minutes for a meeting"""
        result = await db.execute(
            select(MeetingMinutes)
            .options(
                selectinload(MeetingMinutes.actions),
                selectinload(MeetingMinutes.recorded_by)
            )
            .where(MeetingMinutes.meeting_id == meeting_id, MeetingMinutes.is_active == True)
            .offset(skip)
            .limit(min(limit, MAX_LIMIT))
            .order_by(MeetingMinutes.timestamp.desc())
        )
        return result.scalars().all()
    
    async def update(
        self, db: AsyncSession, id: UUID, obj_in: MeetingMinutesUpdate, updated_by_id: UUID
    ) -> Optional[MeetingMinutes]:
        """Update minutes"""
        try:
            db_obj = await self.get(db, id)
            if not db_obj:
                return None
            
            update_data = obj_in.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if value is not None:
                    setattr(db_obj, field, value)
            
            await self._update_audit_fields(db_obj, updated_by_id)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update minutes: {str(e)}")
    
    async def soft_delete(self, db: AsyncSession, id: UUID, deleted_by_id: UUID) -> Optional[MeetingMinutes]:
        """Soft delete minutes"""
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
            raise ValueError(f"Failed to delete minutes: {str(e)}")


# ============================================================================
# MEETING PARTICIPANT CRUD
# ============================================================================

class CRUDMeetingParticipant(AuditMixin):
    """CRUD operations for MeetingParticipant entity"""
    
    async def get_by_meeting(
        self, db: AsyncSession, meeting_id: UUID, skip: int = DEFAULT_SKIP, limit: int = DEFAULT_LIMIT
    ) -> List[MeetingParticipant]:
        """Get all participants for a meeting"""
        result = await db.execute(
            select(MeetingParticipant)
            .where(
                MeetingParticipant.meeting_id == meeting_id,
                MeetingParticipant.is_active == True
            )
            .offset(skip)
            .limit(min(limit, MAX_LIMIT))
            .order_by(MeetingParticipant.is_chairperson.desc(), MeetingParticipant.name)
        )
        return result.scalars().all()


# ============================================================================
# DASHBOARD CRUD
# ============================================================================

class CRUDDashboard:
    """Dashboard summary statistics"""
    
    async def get_summary(self, db: AsyncSession) -> Dict[str, Any]:
        """Get dashboard summary statistics"""
        try:
            total_meetings = await self._count_active(db, Meeting)
            upcoming_meetings = await self._count_upcoming_meetings(db)
            
            total_actions = await self._count_active(db, MeetingAction)
            pending_actions = await self._count_pending_actions(db)
            overdue_actions = await self._count_overdue_actions(db)
            completed_actions = await self._count_completed_actions(db)
            
            total_participants = await self._count_active(db, Participant)
            
            return {
                "total_meetings": total_meetings,
                "upcoming_meetings": upcoming_meetings,
                "total_actions": total_actions,
                "pending_actions": pending_actions,
                "overdue_actions": overdue_actions,
                "completed_actions": completed_actions,
                "total_participants": total_participants,
                "completion_rate": round((completed_actions / total_actions * 100), 2) if total_actions > 0 else 0
            }
        except Exception as e:
            raise ValueError(f"Failed to get dashboard summary: {str(e)}")
    
    async def _count_active(self, db: AsyncSession, model) -> int:
        """Count active records for a model"""
        result = await db.execute(
            select(func.count()).select_from(model).where(model.is_active == True)
        )
        return result.scalar() or 0
    
    async def _count_upcoming_meetings(self, db: AsyncSession) -> int:
        """Count upcoming meetings"""
        result = await db.execute(
            select(func.count()).select_from(Meeting)
            .where(Meeting.meeting_date >= datetime.now(), Meeting.is_active == True)
        )
        return result.scalar() or 0
    
    async def _count_pending_actions(self, db: AsyncSession) -> int:
        """Count pending actions"""
        result = await db.execute(
            select(func.count()).select_from(MeetingAction)
            .where(
                MeetingAction.completed_at.is_(None),
                MeetingAction.is_active == True
            )
        )
        return result.scalar() or 0
    
    async def _count_overdue_actions(self, db: AsyncSession) -> int:
        """Count overdue actions"""
        result = await db.execute(
            select(func.count()).select_from(MeetingAction)
            .where(
                MeetingAction.due_date < datetime.now(),
                MeetingAction.completed_at.is_(None),
                MeetingAction.is_active == True
            )
        )
        return result.scalar() or 0
    
    async def _count_completed_actions(self, db: AsyncSession) -> int:
        """Count completed actions"""
        result = await db.execute(
            select(func.count()).select_from(MeetingAction)
            .where(
                MeetingAction.completed_at.isnot(None),
                MeetingAction.is_active == True
            )
        )
        return result.scalar() or 0


# ============================================================================
# INITIALIZE CRUD INSTANCES
# ============================================================================

from uuid import uuid4

participant = CRUDParticipant(Participant)
participant_list = CRUDParticipantList(ParticipantList)
meeting = CRUDMeeting(Meeting)
meeting_minutes = CRUDMeetingMinutes(MeetingMinutes)
meeting_action = CRUDMeetingAction(MeetingAction)
meeting_document = CRUDMeetingDocument(MeetingDocument)
meeting_participant = CRUDMeetingParticipant()
dashboard = CRUDDashboard()

# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "participant",
    "participant_list",
    "meeting",
    "meeting_minutes",
    "meeting_action",
    "meeting_document",
    "meeting_participant",
    "dashboard",
    "CRUDParticipant",
    "CRUDParticipantList",
    "CRUDMeeting",
    "CRUDMeetingMinutes",
    "CRUDMeetingAction",
    "CRUDMeetingDocument",
    "CRUDMeetingParticipant",
    "CRUDDashboard",
    "AuditMixin",
    "DEFAULT_LIMIT",
    "MAX_LIMIT",
    "DEFAULT_SKIP"
]