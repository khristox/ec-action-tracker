"""
Action Tracker CRUD Operations
Complete implementation with all CRUD operations for all entities
"""

import json
from typing import List, Optional, Dict, Any, Union, Tuple
from uuid import UUID
from datetime import datetime
from contextlib import asynccontextmanager
from sqlalchemy import select, and_, or_, func, update, delete, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.action_tracker import (
    Meeting, MeetingMinutes, MeetingAction, MeetingParticipant,
    Participant, ParticipantList, ActionStatusHistory, ActionComment, 
    MeetingDocument, MeetingStatusHistory
)

# FIXED: Import from the correct location
from app.schemas.action_tracker_participants import (
    ParticipantCreate, 
    ParticipantListCreate, 
    ParticipantListUpdate, 
    ParticipantUpdate
)

# Add missing schema imports
from app.schemas.meeting_minutes.meeting_minutes import (
    MeetingMinutesCreate, 
    MeetingMinutesUpdate,
    MeetingActionCreate, 
    MeetingActionUpdate,
)

# Add missing schema imports for meeting and documents
from pydantic import BaseModel
from typing import Optional as Opt

# Define missing schemas if they don't exist
class MeetingCreate(BaseModel):
    title: str
    meeting_date: datetime
    location: Optional[str] = None
    chairperson_name: Optional[str] = None
    participant_list_id: Optional[UUID] = None
    custom_participants: Optional[List] = None
    
    class Config:
        from_attributes = True

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    meeting_date: Optional[datetime] = None
    location: Optional[str] = None
    chairperson_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class MeetingDocumentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    document_type: Optional[str] = None
    
    class Config:
        from_attributes = True

class MeetingDocumentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    document_type: Optional[str] = None
    
    class Config:
        from_attributes = True

class ActionProgressUpdate(BaseModel):
    progress_percentage: int
    individual_status_id: Optional[UUID] = None
    remarks: Optional[str] = None
    
    class Config:
        from_attributes = True

class ActionCommentCreate(BaseModel):
    comment: str
    attachment_url: Optional[str] = None
    
    class Config:
        from_attributes = True

from app.models.action_tracker import participant_list_members

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
# PARTICIPANT CRUD - COMPLETE
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

    async def count(
        self,
        db: AsyncSession,
        filters: Optional[Dict[str, Any]] = None,
        include_inactive: bool = False
    ) -> int:
        """Count participants with optional filtering"""
        query = select(func.count(Participant.id))
        
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

        result = await db.execute(query)
        return result.scalar() or 0

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

    async def search(
        self,
        db: AsyncSession,
        query: str,
        limit: int = 10,
        include_inactive: bool = False
    ) -> List[Participant]:
        """Search participants by name, email, or organization"""
        term = f"%{query}%"
        search_query = select(Participant).where(
            or_(
                Participant.name.ilike(term),
                Participant.email.ilike(term),
                Participant.organization.ilike(term),
            )
        )
        
        if not include_inactive:
            search_query = search_query.where(Participant.is_active == True)
        
        search_query = search_query.limit(limit)
        result = await db.execute(search_query)
        return result.scalars().all()

    async def get_by_organization(
        self,
        db: AsyncSession,
        organization: str,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT
    ) -> List[Participant]:
        """Get participants by organization"""
        result = await db.execute(
            select(Participant)
            .where(
                Participant.organization == organization,
                Participant.is_active == True
            )
            .offset(skip)
            .limit(min(limit, MAX_LIMIT))
        )
        return result.scalars().all()

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

    async def hard_delete(self, db: AsyncSession, id: UUID) -> bool:
        """Hard delete a participant permanently"""
        try:
            db_obj = await self.get(db, id)
            if db_obj:
                await db.delete(db_obj)
                await db.commit()
                return True
            return False
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to hard delete participant: {str(e)}")

    async def bulk_create(
        self,
        db: AsyncSession,
        participants: List[Union[ParticipantCreate, Dict[str, Any]]],
        created_by_id: UUID
    ) -> List[Participant]:
        """Bulk create participants"""
        created = []
        for participant_data in participants:
            try:
                new_participant = await self.create(db, participant_data, created_by_id)
                created.append(new_participant)
            except Exception as e:
                print(f"Failed to create participant: {e}")
                continue
        return created

    async def bulk_update(
        self,
        db: AsyncSession,
        updates: List[Dict[str, Any]],
        updated_by_id: UUID
    ) -> List[Participant]:
        """Bulk update participants"""
        updated = []
        for update_data in updates:
            try:
                participant_id = update_data.pop('id')
                participant = await self.update(db, participant_id, update_data, updated_by_id)
                if participant:
                    updated.append(participant)
            except Exception as e:
                print(f"Failed to update participant: {e}")
                continue
        return updated

    async def bulk_delete(
        self,
        db: AsyncSession,
        ids: List[UUID],
        deleted_by_id: UUID
    ) -> int:
        """Bulk soft delete participants"""
        deleted_count = 0
        for participant_id in ids:
            try:
                result = await self.soft_delete(db, participant_id, deleted_by_id)
                if result:
                    deleted_count += 1
            except Exception as e:
                print(f"Failed to delete participant {participant_id}: {e}")
                continue
        return deleted_count


# ============================================================================
# PARTICIPANT LIST CRUD - COMPLETE
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

    async def get_accessible_lists(
        self, db: AsyncSession, user_id: UUID, skip: int = DEFAULT_SKIP, limit: int = DEFAULT_LIMIT
    ) -> List[ParticipantList]:
        """Get lists accessible to user (owned or global)"""
        result = await db.execute(
            select(ParticipantList)
            .options(selectinload(ParticipantList.participants))
            .where(
                ParticipantList.is_active == True,
                or_(
                    ParticipantList.created_by_id == user_id,
                    ParticipantList.is_global == True
                )
            )
            .offset(skip)
            .limit(min(limit, MAX_LIMIT))
            .order_by(ParticipantList.name)
        )
        return result.scalars().all()

    async def get_by_owner(
        self,
        db: AsyncSession,
        owner_id: UUID,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT
    ) -> List[ParticipantList]:
        """Get lists created by a specific user"""
        result = await db.execute(
            select(ParticipantList)
            .options(selectinload(ParticipantList.participants))
            .where(
                ParticipantList.created_by_id == owner_id,
                ParticipantList.is_active == True
            )
            .offset(skip)
            .limit(min(limit, MAX_LIMIT))
            .order_by(ParticipantList.name)
        )
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

    async def hard_delete(self, db: AsyncSession, id: UUID) -> bool:
        """Hard delete a participant list"""
        try:
            db_obj = await self.get(db, id)
            if db_obj:
                await db.delete(db_obj)
                await db.commit()
                return True
            return False
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to hard delete participant list: {str(e)}")

    # ==================== FIXED: MariaDB/MySQL Compatible Sorting ====================
    async def get_actions_assigned_to_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT,
        search: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[int] = None,
        is_overdue: Optional[bool] = None,
        include_completed: bool = False,
    ) -> List[MeetingAction]:
        """Get actions assigned to user with MariaDB/MySQL compatible sorting"""
        
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
            query = query.where(MeetingAction.overall_status_name.ilike(status))

        if priority is not None:
            query = query.where(MeetingAction.priority == priority)

        if is_overdue is True:
            query = query.where(
                and_(
                    MeetingAction.due_date.isnot(None),
                    MeetingAction.due_date < datetime.utcnow(),
                    MeetingAction.completed_at.is_(None)
                )
            )

        # MariaDB/MySQL compatible sorting using CASE statement
        # This puts NULL due_dates at the end
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

    async def _get_participants_by_ids(self, db: AsyncSession, participant_ids: List[UUID]) -> List[Participant]:
        """Helper to fetch participants by IDs"""
        if not participant_ids:
            return []
        
        result = await db.execute(
            select(Participant).where(Participant.id.in_(participant_ids))
        )
        return result.scalars().all()

    async def create_with_participants(
        self, 
        db: AsyncSession, 
        obj_in: ParticipantListCreate, 
        participant_ids: List[UUID],
        created_by_id: UUID
    ) -> ParticipantList:
        """Create a participant list with members"""
        try:
            list_data = obj_in.model_dump(exclude={'participant_ids'})
            db_obj = ParticipantList(**list_data)
            await self._set_audit_fields(db_obj, created_by_id=created_by_id, updated_by_id=created_by_id)
            
            db.add(db_obj)
            await db.flush()
            
            if participant_ids:
                await self._add_participants_to_list(db, db_obj.id, participant_ids, created_by_id)
            
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to create participant list: {str(e)}")
    
    async def add_participants_to_list(
        self, 
        db: AsyncSession, 
        list_id: UUID, 
        participant_ids: List[UUID], 
        added_by_id: UUID
    ) -> bool:
        """Add participants to an existing list"""
        try:
            from app.models.action_tracker import participant_list_members
            
            for participant_id in participant_ids:
                result = await db.execute(
                    select(participant_list_members).where(
                        participant_list_members.c.participant_list_id == list_id,
                        participant_list_members.c.participant_id == participant_id
                    )
                )
                if not result.first():
                    stmt = participant_list_members.insert().values(
                        participant_list_id=list_id,
                        participant_id=participant_id,
                        added_at=datetime.now(),
                        added_by_id=added_by_id
                    )
                    await db.execute(stmt)
            
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to add participants to list: {str(e)}")
    
    async def remove_participant_from_list(
        self, 
        db: AsyncSession, 
        list_id: UUID, 
        participant_id: UUID
    ) -> bool:
        """Remove a participant from a list"""
        try:
            from app.models.action_tracker import participant_list_members
            
            stmt = participant_list_members.delete().where(
                participant_list_members.c.participant_list_id == list_id,
                participant_list_members.c.participant_id == participant_id
            )
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount > 0
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to remove participant from list: {str(e)}")
    
    async def get_list_participants(
        self,
        db: AsyncSession,
        list_id: UUID,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT
    ) -> List[Participant]:
        """Get all participants in a list with pagination"""
        from app.models.action_tracker import participant_list_members
        
        result = await db.execute(
            select(Participant)
            .join(participant_list_members, Participant.id == participant_list_members.c.participant_id)
            .where(
                participant_list_members.c.participant_list_id == list_id,
                Participant.is_active == True
            )
            .offset(skip)
            .limit(min(limit, MAX_LIMIT))
            .order_by(Participant.name)
        )
        return result.scalars().all()
    
    async def get_list_participants_count(
        self,
        db: AsyncSession,
        list_id: UUID
    ) -> int:
        """Get total count of participants in a list"""
        from app.models.action_tracker import participant_list_members
        
        result = await db.execute(
            select(func.count())
            .select_from(participant_list_members)
            .where(participant_list_members.c.participant_list_id == list_id)
        )
        return result.scalar() or 0
    
    async def get_participant_lists(
        self, 
        db: AsyncSession, 
        participant_id: UUID,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT
    ) -> List[ParticipantList]:
        """Get all lists a participant belongs to"""
        result = await db.execute(
            select(ParticipantList)
            .join(participant_list_members, ParticipantList.id == participant_list_members.c.participant_list_id)
            .where(
                participant_list_members.c.participant_id == participant_id,
                ParticipantList.is_active == True
            )
            .offset(skip)
            .limit(min(limit, MAX_LIMIT))
        )
        return result.scalars().all()
    
    async def _add_participants_to_list(
        self, 
        db: AsyncSession, 
        list_id: UUID, 
        participant_ids: List[UUID], 
        added_by_id: UUID
    ):
        """Internal method to add participants to list"""
        from app.models.action_tracker import participant_list_members
        
        for participant_id in participant_ids:
            stmt = participant_list_members.insert().values(
                participant_list_id=list_id,
                participant_id=participant_id,
                added_at=datetime.now(),
                added_by_id=added_by_id
            )
            await db.execute(stmt)
    
    async def get_participants_not_in_list(
        self,
        db: AsyncSession,
        list_id: UUID,
        search: Optional[str] = None,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT
    ) -> List[Participant]:
        """Get participants that are not in a specific list"""
        from app.models.action_tracker import participant_list_members
        
        query = select(Participant).where(
            Participant.is_active == True,
            ~Participant.id.in_(
                select(participant_list_members.c.participant_id).where(
                    participant_list_members.c.participant_list_id == list_id
                )
            )
        )
        
        if search:
            term = f"%{search}%"
            query = query.where(
                or_(
                    Participant.name.ilike(term),
                    Participant.email.ilike(term)
                )
            )
        
        query = query.offset(skip).limit(min(limit, MAX_LIMIT))
        result = await db.execute(query)
        return result.scalars().all()

    async def add_participants_to_list_batch(
        self,
        db: AsyncSession,
        list_id: UUID,
        participant_ids: List[UUID],
        added_by_id: UUID
    ) -> Dict[str, Any]:
        """Add multiple participants to a list in batch"""
        from app.models.action_tracker import participant_list_members
        
        added_count = 0
        skipped_ids = []
        errors = []
        
        existing_result = await db.execute(
            select(participant_list_members.c.participant_id).where(
                participant_list_members.c.participant_list_id == list_id
            )
        )
        existing_ids = {row[0] for row in existing_result.all()}
        
        for participant_id in participant_ids:
            if participant_id in existing_ids:
                skipped_ids.append(participant_id)
                continue
            
            try:
                stmt = participant_list_members.insert().values(
                    participant_list_id=list_id,
                    participant_id=participant_id,
                    added_at=datetime.now(),
                    added_by_id=added_by_id
                )
                await db.execute(stmt)
                added_count += 1
            except Exception as e:
                errors.append(f"Failed to add {participant_id}: {str(e)}")
        
        await db.commit()
        
        return {
            "added_count": added_count,
            "skipped_count": len(skipped_ids),
            "skipped_ids": skipped_ids,
            "errors": errors
        }

    async def get_participants_not_in_list_paginated(
        self,
        db: AsyncSession,
        list_id: UUID,
        search: Optional[str] = None,
        skip: int = DEFAULT_SKIP,
        limit: int = 20
    ) -> Tuple[List[Participant], int]:
        """Get participants not in a specific list with pagination"""
        from app.models.action_tracker import participant_list_members
        
        subquery = select(participant_list_members.c.participant_id).where(
            participant_list_members.c.participant_list_id == list_id
        )
        
        query = select(Participant).where(
            Participant.is_active == True,
            Participant.id.not_in(subquery)
        )
        
        if search:
            term = f"%{search}%"
            query = query.where(
                or_(
                    Participant.name.ilike(term),
                    Participant.email.ilike(term),
                    Participant.organization.ilike(term)
                )
            )
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.offset(skip).limit(min(limit, MAX_LIMIT)).order_by(Participant.name)
        result = await db.execute(query)
        
        return result.scalars().all(), total

    async def get_list_with_participants(
        self,
        db: AsyncSession,
        list_id: UUID
    ) -> Optional[ParticipantList]:
        """Get a participant list with its members eagerly loaded"""
        result = await db.execute(
            select(ParticipantList)
            .options(selectinload(ParticipantList.participants))
            .where(ParticipantList.id == list_id, ParticipantList.is_active == True)
        )
        return result.scalar_one_or_none()

    async def get_all_lists_with_counts(
        self,
        db: AsyncSession,
        user_id: UUID,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT
    ) -> Tuple[List[ParticipantList], int]:
        """Get all accessible lists with participant counts"""
        from app.models.action_tracker import participant_list_members
        
        query = select(ParticipantList).where(
            ParticipantList.is_active == True,
            or_(
                ParticipantList.created_by_id == user_id,
                ParticipantList.is_global == True
            )
        )
        
        count_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar() or 0
        
        query = query.offset(skip).limit(min(limit, MAX_LIMIT)).order_by(ParticipantList.name)
        result = await db.execute(query)
        lists = result.scalars().all()
        
        for lst in lists:
            count_result = await db.execute(
                select(func.count()).select_from(participant_list_members).where(
                    participant_list_members.c.participant_list_id == lst.id
                )
            )
            lst.participant_count = count_result.scalar() or 0
        
        return lists, total


# ============================================================================
# MEETING ACTION CRUD - COMPLETE
# ============================================================================


# ============================================================================
# MEETING CRUD - COMPLETE
# ============================================================================

class CRUDMeeting(CRUDBase[Meeting, MeetingCreate, MeetingUpdate], AuditMixin):
    """CRUD operations for Meeting entity"""
    
    async def create(
        self, db: AsyncSession, obj_in: MeetingCreate, created_by_id: UUID
    ) -> Meeting:
        """Create a new meeting"""
        try:
            meeting_data = obj_in.model_dump(exclude={'participant_list_id', 'custom_participants'})
            db_obj = Meeting(**meeting_data)
            await self._set_audit_fields(db_obj, created_by_id=created_by_id, updated_by_id=created_by_id)
            
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to create meeting: {str(e)}")
    
    async def create_with_participants(
        self,
        db: AsyncSession,
        obj_in: MeetingCreate,
        created_by_id: UUID
    ) -> Meeting:
        """Create a meeting with participants from template or custom list"""
        try:
            meeting_data = obj_in.model_dump(exclude={'participant_list_id', 'custom_participants'})
            
            meeting = Meeting(
                **meeting_data,
                created_by_id=created_by_id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                is_active=True
            )
            db.add(meeting)
            await db.flush()
            
            if obj_in.participant_list_id:
                await self._add_participants_from_template(db, meeting, obj_in.participant_list_id, created_by_id)
            
            if obj_in.custom_participants:
                await self._add_custom_participants(db, meeting, obj_in.custom_participants, created_by_id)
            
            await db.commit()
            await db.refresh(meeting)
            return meeting
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to create meeting with participants: {str(e)}")
    
    async def _add_participants_from_template(
        self,
        db: AsyncSession,
        meeting: Meeting,
        template_id: UUID,
        created_by_id: UUID
    ) -> None:
        """Add participants from a template list to the meeting"""
        template = await participant_list.get(db, template_id)
        if template and template.participants:
            for participant in template.participants:
                meeting_participant = MeetingParticipant(
                    meeting_id=meeting.id,
                    name=participant.name,
                    email=participant.email,
                    telephone=participant.telephone,
                    title=participant.title,
                    organization=participant.organization,
                    is_chairperson=(participant.name == meeting.chairperson_name),
                    created_by_id=created_by_id,
                    created_at=datetime.now(),
                    is_active=True
                )
                db.add(meeting_participant)
    
    async def _add_custom_participants(
        self,
        db: AsyncSession,
        meeting: Meeting,
        custom_participants: List,
        created_by_id: UUID
    ) -> None:
        """Add custom participants to the meeting"""
        for custom_participant in custom_participants:
            if hasattr(custom_participant, 'model_dump'):
                participant_data = custom_participant.model_dump()
            else:
                participant_data = custom_participant
            
            meeting_participant = MeetingParticipant(
                meeting_id=meeting.id,
                name=participant_data.get('name'),
                email=participant_data.get('email'),
                telephone=participant_data.get('telephone'),
                title=participant_data.get('title'),
                organization=participant_data.get('organization'),
                is_chairperson=(participant_data.get('name') == meeting.chairperson_name),
                created_by_id=created_by_id,
                created_at=datetime.now(),
                is_active=True
            )
            db.add(meeting_participant)
    
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
        self, db: AsyncSession, id: UUID, obj_in: MeetingUpdate, updated_by_id: UUID
    ) -> Optional[Meeting]:
        """Update a meeting"""
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
        
    async def get_meeting_with_details(self, db: AsyncSession, meeting_id: UUID) -> Optional[Meeting]:
        """Get a meeting with all related data loaded"""
        try:
            result = await db.execute(
                select(Meeting)
                .options(
                    selectinload(Meeting.participants),
                    selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions),
                    selectinload(Meeting.documents),
                    selectinload(Meeting.status_history).selectinload(MeetingStatusHistory.status)
                )
                .where(Meeting.id == meeting_id, Meeting.is_active == True)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            raise ValueError(f"Failed to get meeting with details: {str(e)}")
    
    async def add_minutes(
        self,
        db: AsyncSession,
        meeting_id: UUID,
        minutes_in: MeetingMinutesCreate,
        recorded_by_id: UUID
    ) -> MeetingMinutes:
        """Add minutes to a meeting"""
        try:
            meeting_obj = await self.get(db, meeting_id)
            if not meeting_obj:
                raise ValueError(f"Meeting with id {meeting_id} not found")
            
            minutes = MeetingMinutes(
                meeting_id=meeting_id,
                **minutes_in.model_dump(),
                recorded_by_id=recorded_by_id,
                created_by_id=recorded_by_id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                is_active=True
            )
            db.add(minutes)
            await db.commit()
            await db.refresh(minutes)
            return minutes
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to add meeting minutes: {str(e)}")
    
    async def get_minutes(
        self,
        db: AsyncSession,
        meeting_id: UUID,
        skip: int = DEFAULT_SKIP,
        limit: int = DEFAULT_LIMIT
    ) -> List[MeetingMinutes]:
        """Get all minutes for a meeting"""
        try:
            result = await db.execute(
                select(MeetingMinutes)
                .options(selectinload(MeetingMinutes.actions))
                .where(
                    MeetingMinutes.meeting_id == meeting_id,
                    MeetingMinutes.is_active == True
                )
                .offset(skip)
                .limit(min(limit, MAX_LIMIT))
                .order_by(MeetingMinutes.timestamp.desc())
            )
            return result.scalars().all()
        except Exception as e:
            raise ValueError(f"Failed to get meeting minutes: {str(e)}")
    
    async def update_minutes(
        self,
        db: AsyncSession,
        minutes_id: UUID,
        minutes_in: MeetingMinutesUpdate,
        updated_by_id: UUID
    ) -> Optional[MeetingMinutes]:
        """Update meeting minutes"""
        try:
            result = await db.execute(
                select(MeetingMinutes).where(MeetingMinutes.id == minutes_id)
            )
            minutes = result.scalar_one_or_none()
            
            if not minutes:
                return None
            
            update_data = minutes_in.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if value is not None:
                    setattr(minutes, field, value)
            
            await self._update_audit_fields(minutes, updated_by_id)
            await db.commit()
            await db.refresh(minutes)
            return minutes
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update meeting minutes: {str(e)}")
    
    async def delete_minutes(
        self,
        db: AsyncSession,
        minutes_id: UUID,
        deleted_by_id: UUID
    ) -> bool:
        """Soft delete meeting minutes"""
        try:
            result = await db.execute(
                select(MeetingMinutes).where(MeetingMinutes.id == minutes_id)
            )
            minutes = result.scalar_one_or_none()
            
            if not minutes:
                return False
            
            minutes.is_active = False
            await self._update_audit_fields(minutes, deleted_by_id)
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete meeting minutes: {str(e)}")


# ============================================================================
# MEETING MINUTES CRUD - COMPLETE
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
                selectinload(MeetingMinutes.created_by)  # Add this line
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

    async def get_minutes_with_actions(self, db: AsyncSession, minutes_id: UUID) -> Optional[MeetingMinutes]:
        """Get minutes with their actions loaded"""
        try:
            result = await db.execute(
                select(MeetingMinutes)
                .options(selectinload(MeetingMinutes.actions))
                .where(MeetingMinutes.id == minutes_id, MeetingMinutes.is_active == True)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            raise ValueError(f"Failed to get minutes with actions: {str(e)}")


# ============================================================================
# MEETING PARTICIPANT CRUD - COMPLETE
# ============================================================================

class CRUDMeetingParticipant(AuditMixin):
    """CRUD operations for MeetingParticipant entity"""
    
    async def create(
        self, db: AsyncSession, meeting_id: UUID, participant_data: Dict[str, Any], created_by_id: UUID
    ) -> MeetingParticipant:
        """Add a participant to a meeting"""
        try:
            db_obj = MeetingParticipant(meeting_id=meeting_id, **participant_data)
            await self._set_audit_fields(db_obj, created_by_id=created_by_id, updated_by_id=created_by_id)
            
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to add meeting participant: {str(e)}")
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[MeetingParticipant]:
        """Get a meeting participant by ID"""
        result = await db.execute(
            select(MeetingParticipant).where(
                MeetingParticipant.id == id,
                MeetingParticipant.is_active == True
            )
        )
        return result.scalar_one_or_none()
    
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
    
    async def update_attendance(
        self, db: AsyncSession, participant_id: UUID, attendance_status: str, updated_by_id: UUID
    ) -> Optional[MeetingParticipant]:
        """Update participant attendance status"""
        try:
            db_obj = await self.get(db, participant_id)
            if db_obj:
                db_obj.attendance_status = attendance_status
                await self._update_audit_fields(db_obj, updated_by_id)
                await db.commit()
                await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update attendance: {str(e)}")
    
    async def remove(self, db: AsyncSession, participant_id: UUID, removed_by_id: UUID) -> bool:
        """Remove a participant from a meeting (soft delete)"""
        try:
            db_obj = await self.get(db, participant_id)
            if db_obj:
                db_obj.is_active = False
                await self._update_audit_fields(db_obj, removed_by_id)
                await db.commit()
                return True
            return False
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to remove meeting participant: {str(e)}")
    
    async def bulk_add(
        self, db: AsyncSession, meeting_id: UUID, participants_data: List[Dict[str, Any]], created_by_id: UUID
    ) -> List[MeetingParticipant]:
        """Bulk add participants to a meeting"""
        created = []
        for participant_data in participants_data:
            try:
                new_participant = await self.create(db, meeting_id, participant_data, created_by_id)
                created.append(new_participant)
            except Exception as e:
                print(f"Failed to add participant: {e}")
                continue
        return created


# ============================================================================
# MEETING DOCUMENT CRUD - COMPLETE
# ============================================================================

class CRUDMeetingDocument(CRUDBase[MeetingDocument, MeetingDocumentCreate, MeetingDocumentUpdate], AuditMixin):
    """CRUD operations for MeetingDocument entity"""
    
    async def create(
        self, db: AsyncSession, meeting_id: UUID, obj_in: MeetingDocumentCreate, 
        file_path: str, file_size: int, mime_type: str, created_by_id: UUID
    ) -> MeetingDocument:
        """Create a meeting document"""
        try:
            document_data = obj_in.model_dump()
            db_obj = MeetingDocument(
                meeting_id=meeting_id,
                file_path=file_path,
                file_size=file_size,
                mime_type=mime_type,
                **document_data
            )
            await self._set_audit_fields(db_obj, created_by_id=created_by_id, updated_by_id=created_by_id)
            
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to create document: {str(e)}")
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[MeetingDocument]:
        """Get a document by ID"""
        result = await db.execute(
            select(MeetingDocument).where(
                MeetingDocument.id == id,
                MeetingDocument.is_active == True
            )
        )
        return result.scalar_one_or_none()
    
    async def get_by_meeting(
        self, db: AsyncSession, meeting_id: UUID, skip: int = DEFAULT_SKIP, limit: int = DEFAULT_LIMIT
    ) -> List[MeetingDocument]:
        """Get all documents for a meeting"""
        result = await db.execute(
            select(MeetingDocument)
            .where(
                MeetingDocument.meeting_id == meeting_id,
                MeetingDocument.is_active == True
            )
            .offset(skip)
            .limit(min(limit, MAX_LIMIT))
            .order_by(MeetingDocument.uploaded_at.desc())
        )
        return result.scalars().all()
    
    async def update(
        self, db: AsyncSession, id: UUID, obj_in: MeetingDocumentUpdate, updated_by_id: UUID
    ) -> Optional[MeetingDocument]:
        """Update document metadata"""
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
            raise ValueError(f"Failed to update document: {str(e)}")
    
    async def soft_delete(self, db: AsyncSession, id: UUID, deleted_by_id: UUID) -> Optional[MeetingDocument]:
        """Soft delete a document"""
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
            raise ValueError(f"Failed to delete document: {str(e)}")


# ============================================================================
# MEETING ACTION CRUD - COMPLETE
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
            if assigned_to_id:
                from app.models.user import User
                user_exists = await db.execute(select(User).where(User.id == assigned_to_id, User.is_active == True))
                if not user_exists.scalar_one_or_none():
                    assigned_to_id = None
            
            assigned_to_name = self._normalize_assigned_to_name(action_data.get('assigned_to_name'))
            
            action = MeetingAction(
                minute_id=minute_id,
                description=action_data.get('description'),
                assigned_to_id=assigned_to_id,
                assigned_to_name=assigned_to_name,
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
        """Get a single action by ID with relationships loaded"""
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
            from sqlalchemy import func
            query = query.where(
                and_(
                    MeetingAction.due_date.is_not(None),
                    MeetingAction.due_date < func.now(),
                    MeetingAction.completed_at.is_(None)
                )
            )

        # MariaDB/MySQL compatible sorting
        from sqlalchemy import case
        query = query.order_by(
            case(
                (MeetingAction.due_date.is_(None), 1),
                else_=0
            ),
            MeetingAction.due_date.asc(),
            MeetingAction.created_at.desc()
        ).offset(skip).limit(min(limit, 500))

        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_my_tasks(self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100):
        """Alias for get_actions_assigned_to_user"""
        return await self.get_actions_assigned_to_user(db, user_id, skip, limit)
    
    async def get_multi(self, db: AsyncSession, skip: int = 0, limit: int = 100, include_inactive: bool = False):
        """Get multiple actions"""
        query = select(MeetingAction).options(
            selectinload(MeetingAction.minutes),
            selectinload(MeetingAction.assigned_to)
        )
        if not include_inactive:
            query = query.where(MeetingAction.is_active == True)
        query = query.offset(skip).limit(min(limit, 500)).order_by(MeetingAction.due_date)
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_overdue_actions(self, db: AsyncSession, skip: int = 0, limit: int = 100):
        """Get overdue actions"""
        result = await db.execute(
            select(MeetingAction)
            .options(selectinload(MeetingAction.minutes))
            .where(
                MeetingAction.due_date < datetime.now(),
                MeetingAction.completed_at.is_(None),
                MeetingAction.is_active == True
            )
            .offset(skip).limit(min(limit, 500))
            .order_by(MeetingAction.due_date)
        )
        return result.scalars().all()
    
    async def update_action(self, db: AsyncSession, action_id: UUID, obj_in: MeetingActionUpdate, updated_by_id: UUID):
        """Update an action"""
        try:
            action = await self.get(db, action_id)
            if not action:
                return None
            update_data = obj_in.model_dump(exclude_unset=True)
            if 'assigned_to_name' in update_data:
                assigned_to_name = self._normalize_assigned_to_name(update_data['assigned_to_name'])
                if assigned_to_name:
                    action.assigned_to_name = assigned_to_name
                del update_data['assigned_to_name']
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
    
    async def update_progress(self, db: AsyncSession, action_id: UUID, progress_update: ActionProgressUpdate, updated_by_id: UUID):
        """Update action progress"""
        try:
            action = await self.get(db, action_id)
            if not action:
                raise ValueError("Action not found")
            
            history = ActionStatusHistory(
                action_id=action_id,
                individual_status_id=progress_update.individual_status_id,
                remarks=progress_update.remarks,
                progress_percentage=progress_update.progress_percentage,
                created_by_id=updated_by_id,
                created_at=datetime.now(),
                is_active=True
            )
            db.add(history)
            
            action.overall_progress_percentage = progress_update.progress_percentage
            if progress_update.individual_status_id:
                action.overall_status_id = progress_update.individual_status_id
            
            await self._update_audit_fields(action, updated_by_id)
            
            if progress_update.progress_percentage == 100:
                action.completed_at = datetime.now()
            elif progress_update.progress_percentage > 0 and (action.overall_progress_percentage or 0) == 0:
                action.start_date = datetime.now()
            
            await db.commit()
            await db.refresh(action)
            return action
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update progress: {str(e)}")
    
    async def add_comment(self, db: AsyncSession, action_id: UUID, comment_in: ActionCommentCreate, created_by_id: UUID):
        """Add a comment to an action"""
        try:
            comment = ActionComment(
                action_id=action_id,
                comment=comment_in.comment,
                attachment_url=comment_in.attachment_url,
                created_by_id=created_by_id,
                created_at=datetime.now(),
                is_active=True
            )
            db.add(comment)
            await db.commit()
            await db.refresh(comment)
            return comment
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to add comment: {str(e)}")
    
    async def get_comments(self, db: AsyncSession, action_id: UUID, skip: int = 0, limit: int = 100):
        """Get comments for an action"""
        result = await db.execute(
            select(ActionComment)
            .where(ActionComment.action_id == action_id, ActionComment.is_active == True)
            .offset(skip).limit(min(limit, 500)).order_by(ActionComment.created_at.desc())
        )
        return result.scalars().all()
    
    async def get_status_history(self, db: AsyncSession, action_id: UUID, skip: int = 0, limit: int = 100):
        """Get status history for an action"""
        result = await db.execute(
            select(ActionStatusHistory)
            .where(ActionStatusHistory.action_id == action_id, ActionStatusHistory.is_active == True)
            .order_by(ActionStatusHistory.created_at.desc())
            .offset(skip)
            .limit(min(limit, 500))
        )
        return result.scalars().all()
    
    def _normalize_assigned_to_name(self, value):
        """Normalize assigned_to_name field"""
        if value is None:
            return None
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict) and "name" in parsed:
                    return parsed
            except:
                pass
            return {"name": value, "type": "manual"}
        if isinstance(value, dict):
            if "name" not in value:
                return None
            if "type" not in value:
                value["type"] = "manual"
            return value
        return None


# ============================================================================
# INITIALIZE CRUD INSTANCES
# ============================================================================



# ============================================================================
# DASHBOARD CRUD - COMPLETE
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




# Make sure this comes AFTER the class definition
participant = CRUDParticipant(Participant)
participant_list = CRUDParticipantList(ParticipantList)
meeting = CRUDMeeting(Meeting)
meeting_minutes = CRUDMeetingMinutes(MeetingMinutes)
meeting_action = CRUDMeetingAction(MeetingAction)  # ✅ Now CRUDMeetingAction is defined
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