"""
Action Tracker CRUD Operations
Complete implementation with all CRUD operations for all entities
"""

import json
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime
from contextlib import asynccontextmanager

from sqlalchemy import select, and_, or_, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.action_tracker import (
    Meeting, MeetingMinutes, MeetingAction, MeetingParticipant,
    Participant, ParticipantList, ActionStatusHistory, ActionComment, 
    MeetingDocument, MeetingStatusHistory
)
from app.schemas.action_tracker import (
    MeetingCreate, MeetingUpdate, MeetingMinutesCreate, MeetingMinutesUpdate,
    MeetingActionCreate, MeetingActionUpdate, 
    MeetingDocumentCreate, 
    MeetingDocumentUpdate, ActionProgressUpdate, ActionCommentCreate,
    ActionCommentUpdate
)
from app.schemas.action_tracker_participants import (
    ParticipantCreate, 
    ParticipantListCreate, 
    ParticipantListUpdate, 
    ParticipantUpdate
)


# ============================================================================
# BASE CLASS WITH AUDIT MIXIN
# ============================================================================

class AuditMixin:
    """Mixin for audit trail functionality"""
    
    async def _set_audit_fields(self, obj, created_by_id: UUID = None, updated_by_id: UUID = None):
        """Set audit fields on an object"""
        if created_by_id:
            obj.created_by_id = created_by_id
            obj.created_at = datetime.now()
        if updated_by_id:
            obj.updated_by_id = updated_by_id
        obj.updated_at = datetime.now()
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
    
    # CREATE
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

    # READ (Single)
    async def get(self, db: AsyncSession, id: UUID) -> Optional[Participant]:
        """Get a single participant by ID"""
        result = await db.execute(
            select(Participant).where(
                Participant.id == id,
                Participant.is_active == True
            )
        )
        return result.scalar_one_or_none()

    # READ (Multiple with filters)
    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
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

        query = query.order_by(Participant.name).offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    # READ (Count)
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

    # READ (By email)
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

    # READ (Search)
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

    # READ (By organization)
    async def get_by_organization(
        self,
        db: AsyncSession,
        organization: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Participant]:
        """Get participants by organization"""
        result = await db.execute(
            select(Participant)
            .where(
                Participant.organization == organization,
                Participant.is_active == True
            )
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    # UPDATE
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

    # DELETE (Soft)
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

    # DELETE (Hard)
    async def hard_delete(
        self, 
        db: AsyncSession, 
        id: UUID
    ) -> bool:
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

    # BULK OPERATIONS
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
    
    # CREATE
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

    # READ (Single)
    async def get(self, db: AsyncSession, id: UUID) -> Optional[ParticipantList]:
        """Get a single participant list by ID"""
        result = await db.execute(
            select(ParticipantList)
            .options(selectinload(ParticipantList.participants))
            .where(ParticipantList.id == id, ParticipantList.is_active == True)
        )
        return result.scalar_one_or_none()

    # READ (Multiple)
    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False
    ) -> List[ParticipantList]:
        """Get multiple participant lists"""
        query = select(ParticipantList).options(selectinload(ParticipantList.participants))
        
        if not include_inactive:
            query = query.where(ParticipantList.is_active == True)
        
        query = query.offset(skip).limit(limit).order_by(ParticipantList.name)
        result = await db.execute(query)
        return result.scalars().all()

    # READ (Accessible lists)
    async def get_accessible_lists(
        self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100
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
            .limit(limit)
            .order_by(ParticipantList.name)
        )
        return result.scalars().all()

    # READ (By owner)
    async def get_by_owner(
        self,
        db: AsyncSession,
        owner_id: UUID,
        skip: int = 0,
        limit: int = 100
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
            .limit(limit)
            .order_by(ParticipantList.name)
        )
        return result.scalars().all()

    # UPDATE
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

    # DELETE (Soft)
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

    # DELETE (Hard)
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

    # LIST MANAGEMENT
    async def add_participants(
        self, db: AsyncSession, list_id: UUID, participant_ids: List[UUID], added_by_id: UUID
    ) -> Optional[ParticipantList]:
        """Add participants to a list"""
        try:
            list_obj = await self.get(db, list_id)
            if not list_obj:
                return None
            
            participants = await self._get_participants_by_ids(db, participant_ids)
            existing_ids = {p.id for p in list_obj.participants}
            new_participants = [p for p in participants if p.id not in existing_ids]
            
            list_obj.participants.extend(new_participants)
            await self._update_audit_fields(list_obj, added_by_id)
            
            await db.commit()
            await db.refresh(list_obj)
            return list_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to add participants: {str(e)}")

    async def remove_participant(
        self, db: AsyncSession, list_id: UUID, participant_id: UUID, removed_by_id: UUID
    ) -> bool:
        """Remove a participant from a list"""
        try:
            list_obj = await self.get(db, list_id)
            if not list_obj:
                return False
            
            original_count = len(list_obj.participants)
            list_obj.participants = [p for p in list_obj.participants if p.id != participant_id]
            
            if len(list_obj.participants) < original_count:
                await self._update_audit_fields(list_obj, removed_by_id)
                await db.commit()
                return True
            
            return False
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to remove participant: {str(e)}")

    async def duplicate_list(
        self,
        db: AsyncSession,
        list_id: UUID,
        new_name: str,
        created_by_id: UUID
    ) -> Optional[ParticipantList]:
        """Duplicate an existing participant list"""
        try:
            original = await self.get(db, list_id)
            if not original:
                return None
            
            new_list = ParticipantList(
                name=new_name,
                description=f"Copy of {original.name}",
                is_global=original.is_global,
                participants=original.participants.copy()
            )
            await self._set_audit_fields(new_list, created_by_id=created_by_id, updated_by_id=created_by_id)
            
            db.add(new_list)
            await db.commit()
            await db.refresh(new_list)
            return new_list
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to duplicate list: {str(e)}")

    # HELPERS
    async def _get_participants_by_ids(self, db: AsyncSession, participant_ids: List[UUID]) -> List[Participant]:
        """Helper to fetch participants by IDs"""
        if not participant_ids:
            return []
        
        result = await db.execute(
            select(Participant).where(Participant.id.in_(participant_ids))
        )
        return result.scalars().all()


# ============================================================================
# MEETING ACTION CRUD - COMPLETE
# ============================================================================

class CRUDMeetingAction(CRUDBase[MeetingAction, MeetingActionCreate, MeetingActionUpdate], AuditMixin):
    
    # CREATE
    async def create_action(
        self, db: AsyncSession, minute_id: UUID, action_in: MeetingActionCreate, assigned_by_id: UUID
    ) -> MeetingAction:
        """Create a new action item"""
        try:
            action_data = action_in.model_dump()
            
            assigned_to_id = action_data.get('assigned_to_id')
            if assigned_to_id:
                from app.models.user import User
                user_exists = await db.execute(
                    select(User).where(User.id == assigned_to_id, User.is_active == True)
                )
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

    # READ (Single)
    async def get(self, db: AsyncSession, id: UUID) -> Optional[MeetingAction]:
        """Get a single action by ID"""
        result = await db.execute(
            select(MeetingAction)
            .options(
                selectinload(MeetingAction.minutes),
                selectinload(MeetingAction.assigned_to),
                selectinload(MeetingAction.assigned_by)
            )
            .where(MeetingAction.id == id, MeetingAction.is_active == True)
        )
        return result.scalar_one_or_none()

    # READ (Multiple)
    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False
    ) -> List[MeetingAction]:
        """Get multiple actions"""
        query = select(MeetingAction).options(
            selectinload(MeetingAction.minutes),
            selectinload(MeetingAction.assigned_to)
        )
        
        if not include_inactive:
            query = query.where(MeetingAction.is_active == True)
        
        query = query.offset(skip).limit(limit).order_by(MeetingAction.due_date)
        result = await db.execute(query)
        return result.scalars().all()

    # READ (By user)
    async def get_actions_assigned_to_user(
        self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingAction]:
        """Get actions assigned to a specific user"""
        result = await db.execute(
            select(MeetingAction)
            .options(
                selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
                selectinload(MeetingAction.created_by),
                selectinload(MeetingAction.updated_by),
                selectinload(MeetingAction.assigned_to),
                selectinload(MeetingAction.assigned_by)
            )
            .where(
                MeetingAction.assigned_to_id == user_id,
                MeetingAction.is_active == True
            )
            .offset(skip)
            .limit(limit)
            .order_by(MeetingAction.due_date)
        )
        return result.scalars().all()

    # READ (My tasks)
    async def get_my_tasks(
        self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingAction]:
        """Get tasks for current user"""
        return await self.get_actions_assigned_to_user(db, user_id, skip, limit)

    # READ (Overdue)
    async def get_overdue_actions(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[MeetingAction]:
        """Get overdue actions"""
        result = await db.execute(
            select(MeetingAction)
            .options(selectinload(MeetingAction.minutes))
            .where(
                MeetingAction.due_date < datetime.now(),
                MeetingAction.completed_at.is_(None),
                MeetingAction.is_active == True
            )
            .offset(skip)
            .limit(limit)
            .order_by(MeetingAction.due_date)
        )
        return result.scalars().all()

    # READ (By status)
    async def get_actions_by_status(
        self, db: AsyncSession, status_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingAction]:
        """Get actions by status"""
        result = await db.execute(
            select(MeetingAction)
            .where(
                MeetingAction.overall_status_id == status_id,
                MeetingAction.is_active == True
            )
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    # UPDATE
    async def update_action(
        self, db: AsyncSession, action_id: UUID, obj_in: MeetingActionUpdate, updated_by_id: UUID
    ) -> Optional[MeetingAction]:
        """Update an action item"""
        try:
            action = await self.get(db, action_id)
            if not action:
                return None
            
            update_data = obj_in.model_dump(exclude_unset=True)
            
            if 'assigned_to_name' in update_data:
                assigned_to_name = self._normalize_assigned_to_name(update_data['assigned_to_name'])
                if assigned_to_name is not None:
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

    # UPDATE (Progress)
    async def update_progress(
        self, db: AsyncSession, action_id: UUID, progress_update: ActionProgressUpdate, updated_by_id: UUID
    ) -> MeetingAction:
        """Update action progress and log to history"""
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

    # DELETE (Soft)
    async def soft_delete(self, db: AsyncSession, action_id: UUID, deleted_by_id: UUID) -> Optional[MeetingAction]:
        """Soft delete an action"""
        try:
            action = await self.get(db, action_id)
            if action:
                action.is_active = False
                await self._update_audit_fields(action, deleted_by_id)
                await db.commit()
                await db.refresh(action)
            return action
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete action: {str(e)}")

    # COMMENTS
    async def add_comment(
        self, db: AsyncSession, action_id: UUID, comment_in: ActionCommentCreate, created_by_id: UUID
    ) -> ActionComment:
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

    async def get_comments(
        self, db: AsyncSession, action_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[ActionComment]:
        """Get all comments for an action"""
        result = await db.execute(
            select(ActionComment)
            .where(ActionComment.action_id == action_id, ActionComment.is_active == True)
            .offset(skip)
            .limit(limit)
            .order_by(ActionComment.created_at.desc())
        )
        return result.scalars().all()

    async def update_comment(
        self, db: AsyncSession, comment_id: UUID, comment: str, updated_by_id: UUID
    ) -> Optional[ActionComment]:
        """Update a comment"""
        try:
            result = await db.execute(
                select(ActionComment).where(ActionComment.id == comment_id)
            )
            comment_obj = result.scalar_one_or_none()
            
            if comment_obj:
                comment_obj.comment = comment
                await self._update_audit_fields(comment_obj, updated_by_id)
                await db.commit()
                await db.refresh(comment_obj)
            return comment_obj
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to update comment: {str(e)}")

    async def delete_comment(
        self, db: AsyncSession, comment_id: UUID, deleted_by_id: UUID
    ) -> bool:
        """Soft delete a comment"""
        try:
            result = await db.execute(
                select(ActionComment).where(ActionComment.id == comment_id)
            )
            comment_obj = result.scalar_one_or_none()
            
            if comment_obj:
                comment_obj.is_active = False
                await self._update_audit_fields(comment_obj, deleted_by_id)
                await db.commit()
                return True
            return False
        except Exception as e:
            await db.rollback()
            raise ValueError(f"Failed to delete comment: {str(e)}")

    # STATUS HISTORY
    async def get_status_history(
        self, db: AsyncSession, action_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[ActionStatusHistory]:
        """Get status change history for an action"""
        result = await db.execute(
            select(ActionStatusHistory)
            .options(
                selectinload(ActionStatusHistory.created_by),
                selectinload(ActionStatusHistory.updated_by),
                selectinload(ActionStatusHistory.individual_status)
            )
            .where(
                ActionStatusHistory.action_id == action_id,
                ActionStatusHistory.is_active == True
            )
            .order_by(ActionStatusHistory.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    # HELPERS
    def _normalize_assigned_to_name(self, value: Optional[Union[str, Dict, Any]]) -> Optional[Dict]:
        """Convert assigned_to_name to consistent JSON format"""
        if value is None:
            return None
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict) and "name" in parsed:
                    return parsed
            except (json.JSONDecodeError, TypeError):
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

participant = CRUDParticipant(Participant)
participant_list = CRUDParticipantList(ParticipantList)
meeting_action = CRUDMeetingAction(MeetingAction)

# Note: Add similar complete implementations for:
# - CRUDMeeting
# - CRUDMeetingMinutes  
# - CRUDMeetingDocument
# - CRUDMeetingParticipant
# - CRUDDashboard


# ============================================================================
# EXPORTS
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
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[Meeting]:
        """Get a meeting by ID"""
        result = await db.execute(
            select(Meeting)
            .options(selectinload(Meeting.participants))
            .where(Meeting.id == id, Meeting.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def get_multi(
        self, db: AsyncSession, skip: int = 0, limit: int = 100, include_inactive: bool = False
    ) -> List[Meeting]:
        """Get multiple meetings"""
        query = select(Meeting).options(selectinload(Meeting.participants))
        if not include_inactive:
            query = query.where(Meeting.is_active == True)
        query = query.offset(skip).limit(limit).order_by(Meeting.meeting_date.desc())
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
        self, db: AsyncSession, meeting_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingMinutes]:
        """Get all minutes for a meeting"""
        result = await db.execute(
            select(MeetingMinutes)
            .options(selectinload(MeetingMinutes.actions))
            .where(MeetingMinutes.meeting_id == meeting_id, MeetingMinutes.is_active == True)
            .offset(skip)
            .limit(limit)
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
        self, db: AsyncSession, meeting_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingParticipant]:
        """Get all participants for a meeting"""
        result = await db.execute(
            select(MeetingParticipant)
            .where(
                MeetingParticipant.meeting_id == meeting_id,
                MeetingParticipant.is_active == True
            )
            .offset(skip)
            .limit(limit)
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
        self, db: AsyncSession, meeting_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingDocument]:
        """Get all documents for a meeting"""
        result = await db.execute(
            select(MeetingDocument)
            .where(
                MeetingDocument.meeting_id == meeting_id,
                MeetingDocument.is_active == True
            )
            .offset(skip)
            .limit(limit)
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
# DASHBOARD CRUD - COMPLETE
# ============================================================================

class CRUDDashboard:
    """Dashboard summary statistics"""
    
    async def get_summary(self, db: AsyncSession) -> Dict[str, Any]:
        """Get dashboard summary statistics"""
        try:
            # Meetings
            total_meetings = await self._count_active(db, Meeting)
            upcoming_meetings = await self._count_upcoming_meetings(db)
            
            # Actions
            total_actions = await self._count_active(db, MeetingAction)
            pending_actions = await self._count_pending_actions(db)
            overdue_actions = await self._count_overdue_actions(db)
            completed_actions = await self._count_completed_actions(db)
            
            # Participants
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
    "AuditMixin"
]
