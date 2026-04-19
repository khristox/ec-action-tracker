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
from sqlalchemy import delete, select, and_, or_, func, case
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


from app.schemas.action_tracker import ActionCommentCreate, ActionCommentUpdate, ActionProgressUpdate
from sqlalchemy import or_
from app.schemas.action_tracker import MeetingCreate, MeetingUpdate


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

    async def get_accessible_lists(
        self,
        db: AsyncSession,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[ParticipantList]:
        """
        Get participant lists accessible to a user.
        """
        try:
            result = await db.execute(
                select(ParticipantList)
                .where(
                    or_(
                        ParticipantList.is_global == True,
                        ParticipantList.created_by_id == user_id
                    ),
                    ParticipantList.is_active == True
                )
                .offset(skip)
                .limit(limit)
                .order_by(ParticipantList.name.asc())
            )
            return result.scalars().all()
        except Exception as e:
            raise ValueError(f"Failed to fetch accessible lists: {str(e)}")
# ============================================================================
# MEETING CRUD
# ============================================================================

class CRUDMeeting(CRUDBase[Meeting, None, None], AuditMixin):
    """CRUD operations for Meeting entity"""

    async def create_with_participants(
        self,
        db: AsyncSession,
        obj_in: MeetingCreate,
        user_id: UUID,
    ) -> Meeting:
        """Create a meeting with participants"""
        try:
            # Create meeting
            meeting = Meeting(
                title=obj_in.title,
                description=obj_in.description,
                meeting_date=obj_in.meeting_date,
                start_time=obj_in.start_time,
                end_time=obj_in.end_time,
                location_text=obj_in.location_text,
                gps_coordinates=obj_in.gps_coordinates,
                agenda=obj_in.agenda,
                facilitator=obj_in.facilitator,
                chairperson_name=obj_in.chairperson_name,
                created_by_id=user_id,
                created_at=datetime.now(),
                is_active=True
            )
            db.add(meeting)
            await db.flush()
            
            # Add participants - Convert to dict if needed
            participants = getattr(obj_in, 'custom_participants', [])
            for participant_data in participants:
                # Check if it's a dict or Pydantic model
                if hasattr(participant_data, 'model_dump'):
                    # It's a Pydantic model - convert to dict
                    p = participant_data.model_dump()
                elif hasattr(participant_data, 'dict'):
                    # Older Pydantic version
                    p = participant_data.dict()
                else:
                    # Assume it's already a dict
                    p = participant_data
                
                participant = MeetingParticipant(
                    meeting_id=meeting.id,
                    name=p.get('name'),
                    email=p.get('email'),
                    telephone=p.get('telephone'),
                    title=p.get('title'),
                    organization=p.get('organization'),
                    is_chairperson=p.get('is_chairperson', False),
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
                selectinload(Meeting.location)
            )
        )
        return result.scalar_one_or_none()
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[Meeting]:
        """Get a meeting by ID"""
        result = await db.execute(
            select(Meeting)
            .where(Meeting.id == id, Meeting.is_active == True)
        )
        return result.scalar_one_or_none()

    async def get(self, db: AsyncSession, id: UUID) -> Optional[Meeting]:
        """Get a meeting by ID"""
        result = await db.execute(
            select(Meeting)
            .where(Meeting.id == id, Meeting.is_active == True)
        )
        return result.scalar_one_or_none()
        

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
                assigned_to_name = action_data.get('assigned_to_name')  # ADD THIS LINE
                
                # Verify assigned_to user exists
                if assigned_to_id:
                    user_result = await db.execute(
                        select(User).where(User.id == assigned_to_id, User.is_active == True)
                    )
                    user = user_result.scalar_one_or_none()
                    if not user:
                        assigned_to_id = None
                        # If user doesn't exist, treat as manual entry
                        if not assigned_to_name:
                            assigned_to_name = {
                                "name": "Unknown User",
                                "type": "manual"
                            }
                    else:
                        # If user exists and assigned_to_name not provided, create it from user data
                        if not assigned_to_name:
                            assigned_to_name = {
                                "id": str(user.id),
                                "name": user.full_name or user.username,
                                "email": user.email,
                                "phone": getattr(user, 'phone', None) or getattr(user, 'telephone', None),
                                "type": "user"
                            }
                
                action = MeetingAction(
                    minute_id=minute_id,
                    description=action_data.get('description'),
                    assigned_to_id=assigned_to_id,
                    assigned_to_name=assigned_to_name,  # ADD THIS LINE
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
        """Get a single action by ID with all relationships"""
        result = await db.execute(
            select(MeetingAction)
            .options(
                selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
                selectinload(MeetingAction.assigned_to),
                selectinload(MeetingAction.assigned_by),
                selectinload(MeetingAction.created_by),
                selectinload(MeetingAction.updated_by),
                selectinload(MeetingAction.overall_status)
            )
            .where(MeetingAction.id == id, MeetingAction.is_active == True)
        )
        action = result.scalar_one_or_none()
        
        # Debug logging to verify data
        if action:
            print(f"Action {action.id} - assigned_to_id: {action.assigned_to_id}")
            print(f"Action {action.id} - assigned_to_name: {action.assigned_to_name}")
        
        return action

    
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
        """Get actions assigned to user with filtering
        
        Checks both:
        1. assigned_to_id matches the user_id directly
        2. assigned_to_name JSON contains user's email or phone (for legacy/imported data)
        """
        from sqlalchemy import or_, and_
        from sqlalchemy.sql import case
        from sqlalchemy.dialects.postgresql import JSONB
        
        query = select(MeetingAction).options(
            selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
            selectinload(MeetingAction.assigned_to),
            selectinload(MeetingAction.assigned_by)
        )

        # Build conditions for matching assignments
        conditions = []
        
        # Condition 1: Direct user ID match
        conditions.append(MeetingAction.assigned_to_id == user_id)
        
        # Condition 2: Match by email or phone in assigned_to_name JSON (for legacy/imported data)
        if user_email or user_phone:
            name_conditions = []
            
            # For PostgreSQL with JSONB
            if user_email:
                # Check if assigned_to_name is JSON and contains the email
                name_conditions.append(
                    MeetingAction.assigned_to_name['email'].astext.ilike(f"%{user_email}%")
                )
            
            if user_phone:
                # Check if assigned_to_name is JSON and contains the phone
                name_conditions.append(
                    MeetingAction.assigned_to_name['phone'].astext.ilike(f"%{user_phone}%")
                )
            
            # Also check if assigned_to_name is a string (legacy) and contains the email/phone
            if user_email:
                name_conditions.append(
                    MeetingAction.assigned_to_name.cast(String).ilike(f"%{user_email}%")
                )
            if user_phone:
                name_conditions.append(
                    MeetingAction.assigned_to_name.cast(String).ilike(f"%{user_phone}%")
                )
            
            if name_conditions:
                conditions.append(or_(*name_conditions))
        
        # Apply the OR condition
        if conditions:
            query = query.where(or_(*conditions), MeetingAction.is_active == True)
        else:
            query = query.where(MeetingAction.is_active == True)

        # Filter by completion status
        if not include_completed:
            query = query.where(MeetingAction.completed_at.is_(None))

        # Search filter
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.where(MeetingAction.description.ilike(term))

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
    

# In app/crud/action_tracker/meeting_action.py

    async def get_overdue_actions_for_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[MeetingAction]:
        """
        Get overdue actions assigned to a user.
        """
        from sqlalchemy import and_
        from datetime import datetime
        
        now = datetime.now()
        
        query = select(MeetingAction).options(
            selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
            selectinload(MeetingAction.assigned_to),
            selectinload(MeetingAction.assigned_by)
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

    async def update_action(
        self, db: AsyncSession, action_id: UUID, action_in: MeetingActionUpdate, updated_by_id: UUID
    ) -> Optional[MeetingAction]:
        """Update an action"""
        try:
            action = await self.get(db, action_id)
            if not action:
                return None
            
            update_data = action_in.model_dump(exclude_unset=True)
            
            # Handle assigned_to fields
            if 'assigned_to_id' in update_data:
                assigned_to_id = update_data.get('assigned_to_id')
                assigned_to_name = update_data.get('assigned_to_name')
                
                # If assigned_to_id is provided but no name, fetch user data
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
                action.assigned_to_name = assigned_to_name
            
            # Update other fields
            for field, value in update_data.items():
                if value is not None and field not in ['assigned_to_id', 'assigned_to_name']:
                    setattr(action, field, value)
            
            action.updated_at = datetime.now()
            action.updated_by_id = updated_by_id
            
            await db.commit()
            await db.refresh(action)
            return action
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update action: {str(e)}")


    
    async def get_action_with_details(self, db: AsyncSession, action_id: UUID) -> Optional[MeetingAction]:
        """Get action with all relationships loaded"""
        result = await db.execute(
            select(MeetingAction)
            .options(
                selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
                selectinload(MeetingAction.assigned_to),
                selectinload(MeetingAction.assigned_by),
                selectinload(MeetingAction.created_by),
                selectinload(MeetingAction.updated_by),
                selectinload(MeetingAction.overall_status)
            )
            .where(MeetingAction.id == action_id, MeetingAction.is_active == True)
        )
        return result.scalar_one_or_none()



    async def add_comment(
        self, 
        db: AsyncSession, 
        action_id: UUID, 
        comment_in: ActionCommentCreate, 
        user_id: UUID
    ) -> ActionComment:
        """
        Add a comment to an action item.
        """
        try:
            # Check if action exists
            action = await self.get(db, action_id)
            if not action:
                raise ValueError(f"Action with id {action_id} not found")
            
            # Create comment
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
            
            # Load creator info
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
        """
        Get all comments for an action item with creator info.
        """
        try:
            result = await db.execute(
                select(ActionComment)
                .options(
                    selectinload(ActionComment.created_by)  # Load the creator
                )
                .where(
                    ActionComment.action_id == action_id,
                    ActionComment.is_active == True
                )
                .order_by(ActionComment.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            comments = result.scalars().all()
            
            # Optional: Log for debugging
            for comment in comments:
                if comment.created_by:
                    print(f"Comment {comment.id} by {comment.created_by.username}")
                else:
                    print(f"Comment {comment.id} has no creator")
                    
            return comments
        except Exception as e:
            raise ValueError(f"Failed to fetch comments: {str(e)}")
        
    async def update_comment(
        self,
        db: AsyncSession,
        action_id: UUID,
        comment_id: UUID,
        comment_in: ActionCommentUpdate,
        user_id: UUID
    ) -> Optional[ActionComment]:
        """
        Update a comment.
        """
        try:
            # Find the comment
            result = await db.execute(
                select(ActionComment)
                .where(
                    ActionComment.id == comment_id,
                    ActionComment.action_id == action_id,
                    ActionComment.is_active == True
                )
            )
            comment = result.scalar_one_or_none()
            
            if not comment:
                return None
            
            # Check if user is the creator
            if comment.created_by_id != user_id:
                # Check if user is admin
                user_result = await db.execute(
                    select(User).where(User.id == user_id)
                )
                user = user_result.scalar_one_or_none()
                is_admin = any(role.code in ["admin", "super_admin"] for role in user.roles)
                if not is_admin:
                    raise ValueError("Only the comment author or admin can update this comment")
            
            # Update comment
            if comment_in.comment is not None:
                comment.comment = comment_in.comment
            if comment_in.attachment_url is not None:
                comment.attachment_url = comment_in.attachment_url
            
            comment.updated_at = datetime.now()
            comment.updated_by_id = user_id
            
            await db.commit()
            await db.refresh(comment)
            return comment
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update comment: {str(e)}")
    
    async def delete_comment(
        self,
        db: AsyncSession,
        action_id: UUID,
        comment_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Soft delete a comment.
        """
        try:
            # Find the comment
            result = await db.execute(
                select(ActionComment)
                .where(
                    ActionComment.id == comment_id,
                    ActionComment.action_id == action_id,
                    ActionComment.is_active == True
                )
            )
            comment = result.scalar_one_or_none()
            
            if not comment:
                return False
            
            # Check if user is the creator
            if comment.created_by_id != user_id:
                # Check if user is admin
                user_result = await db.execute(
                    select(User).where(User.id == user_id)
                )
                user = user_result.scalar_one_or_none()
                is_admin = any(role.code in ["admin", "super_admin"] for role in user.roles)
                if not is_admin:
                    raise ValueError("Only the comment author or admin can delete this comment")
            
            # Soft delete
            comment.is_active = False
            comment.updated_at = datetime.now()
            comment.updated_by_id = user_id
            
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete comment: {str(e)}")
    
    # ==================== HISTORY METHODS ====================
    
    async def get_status_history(
        self,
        db: AsyncSession,
        action_id: UUID,
        skip: int = 0,
        limit: int = 50
    ) -> List[ActionStatusHistory]:
        """
        Get status change history for an action.
        """
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
    
    async def add_status_history(
        self,
        db: AsyncSession,
        action_id: UUID,
        status_id: UUID,
        progress_percentage: int,
        remarks: str,
        user_id: UUID
    ) -> ActionStatusHistory:
        """
        Add a status history entry.
        """
        try:
            history = ActionStatusHistory(
                action_id=action_id,
                individual_status_id=status_id,
                progress_percentage=progress_percentage,
                remarks=remarks,
                created_by_id=user_id,
                created_at=datetime.now(),
                is_active=True
            )
            
            db.add(history)
            await db.commit()
            await db.refresh(history)
            return history
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to add status history: {str(e)}")


    async def update_progress(
        self,
        db: AsyncSession,
        action_id: UUID,
        progress_update: ActionProgressUpdate,
        user_id: UUID
    ) -> Optional[MeetingAction]:
        """
        Update action progress percentage and status.
        """
        try:
            # Get the action
            action = await self.get(db, action_id)
            if not action:
                return None
            
            # Store old progress for history
            old_progress = action.overall_progress_percentage
            old_status_id = action.overall_status_id
            
            # Update progress
            action.overall_progress_percentage = progress_update.progress_percentage
            
            # Update status if provided
            if progress_update.individual_status_id:
                action.overall_status_id = progress_update.individual_status_id
            
            # Handle completion status
            if progress_update.progress_percentage >= 100:
                if not action.completed_at:
                    action.completed_at = datetime.now()
            elif action.completed_at:
                # Reopen if progress is less than 100 but was completed
                action.completed_at = None
            
            # Set start date if not set and progress > 0
            if progress_update.progress_percentage > 0 and not action.start_date:
                action.start_date = datetime.now()
            
            # Update audit fields
            action.updated_at = datetime.now()
            action.updated_by_id = user_id
            
            # Add status history entry
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

    async def update_progress_remove(
        self,
        db: AsyncSession,
        action_id: UUID,
        progress_update: ActionProgressUpdate,
        user_id: UUID
    ) -> Optional[MeetingAction]:
        """
        Update action progress percentage and status.
        """
        try:
            # Get the action
            action = await self.get(db, action_id)
            if not action:
                return None
            
            # Update progress
            action.overall_progress_percentage = progress_update.progress_percentage
            
            # Update status if provided
            if progress_update.individual_status_id:
                action.overall_status_id = progress_update.individual_status_id
            
            # Mark as completed if progress is 100%
            if progress_update.progress_percentage >= 100:
                action.completed_at = datetime.now()
            elif action.completed_at:
                # If progress is less than 100 but was completed, reopen
                action.completed_at = None
            
            # Set start date if not set and progress > 0
            if progress_update.progress_percentage > 0 and not action.start_date:
                action.start_date = datetime.now()
            
            # Update audit fields
            action.updated_at = datetime.now()
            action.updated_by_id = user_id
            
            # Add status history entry
            status_history = ActionStatusHistory(
                action_id=action_id,
                individual_status_id=progress_update.individual_status_id,
                progress_percentage=progress_update.progress_percentage,
                remarks=progress_update.remarks,
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

    async def soft_delete(
        self,
        db: AsyncSession,
        action_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Soft delete an action (set is_active to False).
        """
        try:
            # Get the action
            action = await self.get(db, action_id)
            if not action:
                return False
            
            # Check if user has permission (admin or creator)
            if action.created_by_id != user_id:
                # Check if user is admin
                user_result = await db.execute(
                    select(User).where(User.id == user_id)
                )
                user = user_result.scalar_one_or_none()
                is_admin = any(role.code in ["admin", "super_admin"] for role in user.roles)
                if not is_admin:
                    raise ValueError("Only the task creator or admin can delete this action")
            
            # Soft delete
            action.is_active = False
            action.updated_at = datetime.now()
            action.updated_by_id = user_id
            
            # Also soft delete all comments
            comments_result = await db.execute(
                select(ActionComment).where(ActionComment.action_id == action_id)
            )
            comments = comments_result.scalars().all()
            for comment in comments:
                comment.is_active = False
                comment.updated_at = datetime.now()
                comment.updated_by_id = user_id
            
            # Also soft delete all status history
            history_result = await db.execute(
                select(ActionStatusHistory).where(ActionStatusHistory.action_id == action_id)
            )
            history_entries = history_result.scalars().all()
            for entry in history_entries:
                entry.is_active = False
                entry.updated_at = datetime.now()
                entry.updated_by_id = user_id
            
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete action: {str(e)}")

    async def hard_delete(
        self,
        db: AsyncSession,
        action_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Hard delete an action and all related data.
        """
        try:
            # Get the action
            action = await self.get(db, action_id)
            if not action:
                return False
            
            # Check if user has permission (admin or creator)
            if action.created_by_id != user_id:
                # Check if user is admin
                user_result = await db.execute(
                    select(User).where(User.id == user_id)
                )
                user = user_result.scalar_one_or_none()
                is_admin = any(role.code in ["admin", "super_admin"] for role in user.roles)
                if not is_admin:
                    raise ValueError("Only the task creator or admin can delete this action")
            
            # Delete all comments first
            await db.execute(
                delete(ActionComment).where(ActionComment.action_id == action_id)
            )
            
            # Delete all status history
            await db.execute(
                delete(ActionStatusHistory).where(ActionStatusHistory.action_id == action_id)
            )
            
            # Delete the action
            await db.delete(action)
            
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete action: {str(e)}")

        

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