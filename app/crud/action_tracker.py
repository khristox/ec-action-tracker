"""
Action Tracker CRUD Operations
Organized by entity with consistent patterns for audit fields
"""

import json
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime

from sqlalchemy import select, and_, or_, func
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
    MeetingActionCreate, MeetingActionUpdate, ParticipantCreate, ParticipantUpdate,
    ParticipantListCreate, ParticipantListUpdate, MeetingDocumentCreate, 
    MeetingDocumentUpdate, ActionProgressUpdate, ActionCommentCreate,
    ActionCommentUpdate
)


# ============================================================================
# PARTICIPANT CRUD
# ============================================================================

class CRUDParticipant(CRUDBase[Participant, ParticipantCreate, ParticipantUpdate]):
    """CRUD operations for Participant entity"""
    
    async def create(
        self, db: AsyncSession, obj_in: ParticipantCreate, created_by_id: UUID
    ) -> Participant:
        """Create participant with audit fields"""
        db_obj = Participant(
            **obj_in.model_dump(),
            created_by_id=created_by_id,
            created_at=datetime.now(),
            is_active=True
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def update(
        self, db: AsyncSession, db_obj: Participant, obj_in: ParticipantUpdate, updated_by_id: UUID
    ) -> Participant:
        """Update participant with audit fields"""
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        db_obj.updated_by_id = updated_by_id
        db_obj.updated_at = datetime.now()
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def soft_delete(self, db: AsyncSession, participant_id: UUID, deleted_by_id: UUID) -> Optional[Participant]:
        """Soft delete participant"""
        participant = await self.get(db, participant_id)
        if participant:
            participant.is_active = False
            participant.updated_by_id = deleted_by_id
            participant.updated_at = datetime.now()
            await db.commit()
            await db.refresh(participant)
        return participant
    
    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[Participant]:
        result = await db.execute(
            select(Participant).where(
                Participant.email == email,
                Participant.is_active == True
            )
        )
        return result.scalar_one_or_none()
    
    async def search(
        self, db: AsyncSession, query: str, skip: int = 0, limit: int = 100
    ) -> List[Participant]:
        """Search participants by name, email, or organization"""
        search_term = f"%{query}%"
        result = await db.execute(
            select(Participant)
            .where(
                Participant.is_active == True,
                or_(
                    Participant.name.ilike(search_term),
                    Participant.email.ilike(search_term),
                    Participant.organization.ilike(search_term)
                )
            )
            .offset(skip)
            .limit(limit)
            .order_by(Participant.name)
        )
        return result.scalars().all()
    
    async def get_my_participants(self, db: AsyncSession, created_by_id: UUID) -> List[Participant]:
        """Get participants created by a specific user"""
        result = await db.execute(
            select(Participant)
            .where(
                Participant.created_by_id == created_by_id,
                Participant.is_active == True
            )
            .order_by(Participant.name)
        )
        return result.scalars().all()


# ============================================================================
# PARTICIPANT LIST CRUD
# ============================================================================

class CRUDParticipantList(CRUDBase[ParticipantList, ParticipantListCreate, ParticipantListUpdate]):
    """CRUD operations for ParticipantList entity"""
    
    async def create(
        self, db: AsyncSession, obj_in: ParticipantListCreate, created_by_id: UUID
    ) -> ParticipantList:
        """Create participant list with audit fields"""
        participant_ids = getattr(obj_in, 'participant_ids', [])
        list_data = obj_in.model_dump(exclude={'participant_ids'})
        
        db_obj = ParticipantList(
            **list_data,
            created_by_id=created_by_id,
            created_at=datetime.now(),
            is_active=True
        )
        
        if participant_ids:
            participants = await self._get_participants_by_ids(db, participant_ids)
            db_obj.participants = participants
        
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def update(
        self, db: AsyncSession, db_obj: ParticipantList, obj_in: ParticipantListUpdate, updated_by_id: UUID
    ) -> ParticipantList:
        """Update participant list with audit fields"""
        update_data = obj_in.model_dump(exclude_unset=True)
        participant_ids = update_data.pop('participant_ids', None)
        
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        if participant_ids is not None:
            participants = await self._get_participants_by_ids(db, participant_ids)
            db_obj.participants = participants
        
        db_obj.updated_by_id = updated_by_id
        db_obj.updated_at = datetime.now()
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
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
    
    async def add_participants(
        self, db: AsyncSession, list_id: UUID, participant_ids: List[UUID], added_by_id: UUID
    ) -> Optional[ParticipantList]:
        """Add participants to a list"""
        list_obj = await self.get(db, list_id)
        if not list_obj:
            return None
        
        participants = await self._get_participants_by_ids(db, participant_ids)
        list_obj.participants.extend(participants)
        list_obj.updated_by_id = added_by_id
        list_obj.updated_at = datetime.now()
        
        await db.commit()
        await db.refresh(list_obj)
        return list_obj
    
    async def remove_participant(
        self, db: AsyncSession, list_id: UUID, participant_id: UUID, removed_by_id: UUID
    ) -> bool:
        """Remove a participant from a list"""
        list_obj = await self.get(db, list_id)
        if not list_obj:
            return False
        
        list_obj.participants = [p for p in list_obj.participants if p.id != participant_id]
        list_obj.updated_by_id = removed_by_id
        list_obj.updated_at = datetime.now()
        
        await db.commit()
        return True
    
    async def _get_participants_by_ids(self, db: AsyncSession, participant_ids: List[UUID]) -> List[Participant]:
        """Helper to fetch participants by IDs"""
        result = await db.execute(
            select(Participant).where(Participant.id.in_(participant_ids))
        )
        return result.scalars().all()


# ============================================================================
# MEETING CRUD
# ============================================================================

class CRUDMeeting(CRUDBase[Meeting, MeetingCreate, MeetingUpdate]):
    """CRUD operations for Meeting entity"""
    
    async def create_with_participants(
        self, db: AsyncSession, obj_in: MeetingCreate, created_by_id: UUID
    ) -> Meeting:
        """Create meeting with participants from template or custom list"""
        meeting_data = obj_in.model_dump(exclude={'participant_list_id', 'custom_participants', 'status'})
        meeting = Meeting(
            **meeting_data,
            created_by_id=created_by_id,
            created_at=datetime.now(),
            is_active=True
        )
        db.add(meeting)
        await db.flush()
        
        # Log initial status
        await self._log_status_change(db, meeting.id, meeting.status_id, "Meeting created", created_by_id)
        
        # Add participants from template list
        if obj_in.participant_list_id:
            await self._add_participants_from_template(db, meeting, obj_in.participant_list_id, created_by_id)
        
        # Add custom participants
        await self._add_custom_participants(db, meeting, obj_in.custom_participants, created_by_id)
        
        await db.commit()
        await db.refresh(meeting)
        return meeting
    
    async def update(
        self, db: AsyncSession, db_obj: Meeting, obj_in: MeetingUpdate, updated_by_id: UUID
    ) -> Meeting:
        """Update meeting with audit fields and status change logging"""
        update_data = obj_in.model_dump(exclude_unset=True)
        
        # Extract status-related fields
        new_status_id = update_data.pop('status_id', None)
        status_comment = update_data.pop('status_comment', None)
        status_date = update_data.pop('status_date', None)
        
        # Update basic fields
        for field, value in update_data.items():
            if value is not None:
                setattr(db_obj, field, value)
        
        # Handle status change
        if new_status_id and db_obj.status_id != new_status_id:
            await self._log_status_change(
                db, db_obj.id, new_status_id, 
                status_comment or "Status changed", 
                updated_by_id, status_date
            )
            db_obj.status_id = new_status_id
        
        # Update audit fields
        db_obj.updated_by_id = updated_by_id
        db_obj.updated_at = datetime.now()
        
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def update_status(
        self, db: AsyncSession, meeting_id: UUID, status_id: UUID, 
        updated_by_id: UUID, comment: str = None
    ) -> Meeting:
        """Explicitly update meeting status and log to history"""
        meeting = await self.get(db, meeting_id)
        if not meeting:
            raise ValueError("Meeting not found")
        
        if meeting.status_id != status_id:
            await self._log_status_change(
                db, meeting_id, status_id, 
                comment or f"Status changed from {meeting.status_id} to {status_id}", 
                updated_by_id
            )
            meeting.status_id = status_id
            meeting.updated_by_id = updated_by_id
            meeting.updated_at = datetime.now()
            
            await db.commit()
            await db.refresh(meeting)
        
        return meeting
    
    async def get_upcoming_meetings(self, db: AsyncSession, limit: int = 10) -> List[Meeting]:
        """Get upcoming meetings"""
        result = await db.execute(
            select(Meeting)
            .options(selectinload(Meeting.participants))
            .where(
                Meeting.meeting_date >= datetime.now(),
                Meeting.is_active == True
            )
            .order_by(Meeting.meeting_date)
            .limit(limit)
        )
        return result.scalars().all()
    
    async def get_meetings_by_status(
        self, db: AsyncSession, status_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Meeting]:
        """Get meetings filtered by status"""
        result = await db.execute(
            select(Meeting)
            .options(selectinload(Meeting.participants))
            .where(Meeting.status_id == status_id, Meeting.is_active == True)
            .offset(skip)
            .limit(limit)
            .order_by(Meeting.meeting_date.desc())
        )
        return result.scalars().all()

    async def get_meeting_with_details(self, db: AsyncSession, meeting_id: UUID) -> Optional[Meeting]:
        """Get meeting with all related data loaded"""
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

    async def add_minutes(
        self, db: AsyncSession, meeting_id: UUID, minutes_in: MeetingMinutesCreate, recorded_by_id: UUID
    ) -> MeetingMinutes:
        """Add minutes to a meeting"""
        minutes = MeetingMinutes(
            meeting_id=meeting_id,
            **minutes_in.model_dump(),
            recorded_by_id=recorded_by_id,
            created_by_id=recorded_by_id,
            created_at=datetime.now(),
            is_active=True
        )
        db.add(minutes)
        await db.commit()
        await db.refresh(minutes)
        return minutes
    
    async def soft_delete(self, db: AsyncSession, meeting_id: UUID, deleted_by_id: UUID) -> Optional[Meeting]:
        """Soft delete a meeting"""
        meeting = await self.get(db, meeting_id)
        if meeting:
            meeting.is_active = False
            meeting.updated_by_id = deleted_by_id
            meeting.updated_at = datetime.now()
            await db.commit()
            await db.refresh(meeting)
        return meeting
    
    # ========== PRIVATE HELPERS ==========
    
    async def _log_status_change(
        self, db: AsyncSession, meeting_id: UUID, status_id: UUID, 
        comment: str, updated_by_id: UUID, status_date: datetime = None
    ) -> None:
        """Log meeting status change to history"""
        history = MeetingStatusHistory(
            meeting_id=meeting_id,
            status_id=status_id,
            comment=comment,
            status_date=status_date or datetime.now(),
            created_by_id=updated_by_id,
            created_at=datetime.now(),
            is_active=True
        )
        db.add(history)
    
    async def _add_participants_from_template(
        self, db: AsyncSession, meeting: Meeting, template_id: UUID, created_by_id: UUID
    ) -> None:
        """Add participants from a template list"""
        result = await db.execute(
            select(ParticipantList)
            .options(selectinload(ParticipantList.participants))
            .where(ParticipantList.id == template_id)
        )
        participant_list = result.scalar_one_or_none()
        
        if participant_list:
            for template_participant in participant_list.participants:
                meeting_participant = MeetingParticipant(
                    meeting_id=meeting.id,
                    name=template_participant.name,
                    email=template_participant.email,
                    telephone=template_participant.telephone,
                    title=template_participant.title,
                    organization=template_participant.organization,
                    is_chairperson=(template_participant.name == meeting.chairperson_name),
                    created_by_id=created_by_id,
                    created_at=datetime.now(),
                    is_active=True
                )
                db.add(meeting_participant)
    
    async def _add_custom_participants(
        self, db: AsyncSession, meeting: Meeting, custom_participants: List, created_by_id: UUID
    ) -> None:
        """Add custom participants to meeting"""
        for custom_participant in custom_participants:
            meeting_participant = MeetingParticipant(
                meeting_id=meeting.id,
                **custom_participant.model_dump(),
                created_by_id=created_by_id,
                created_at=datetime.now(),
                is_active=True
            )
            db.add(meeting_participant)


# ============================================================================
# MEETING MINUTES CRUD
# ============================================================================

class CRUDMeetingMinutes(CRUDBase[MeetingMinutes, MeetingMinutesCreate, MeetingMinutesUpdate]):
    """CRUD operations for MeetingMinutes entity"""
    
    async def update(
        self, db: AsyncSession, db_obj: MeetingMinutes, obj_in: MeetingMinutesUpdate, updated_by_id: UUID
    ) -> MeetingMinutes:
        """Update minutes with audit fields"""
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        db_obj.updated_by_id = updated_by_id
        db_obj.updated_at = datetime.now()
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def get_minutes_with_actions(self, db: AsyncSession, minutes_id: UUID) -> Optional[MeetingMinutes]:
        """Get minutes with their actions loaded"""
        result = await db.execute(
            select(MeetingMinutes)
            .options(selectinload(MeetingMinutes.actions))
            .where(MeetingMinutes.id == minutes_id, MeetingMinutes.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def get_meeting_minutes(
        self, db: AsyncSession, meeting_id: UUID, skip: int = 0, limit: int = 100,
        include_inactive: bool = False
    ) -> List[MeetingMinutes]:
        """Get all minutes for a meeting with their actions"""
        query = (
            select(MeetingMinutes)
            .options(selectinload(MeetingMinutes.actions))
            .where(MeetingMinutes.meeting_id == meeting_id)
            .offset(skip)
            .limit(limit)
            .order_by(MeetingMinutes.timestamp.desc())
        )
        
        if not include_inactive:
            query = query.where(MeetingMinutes.is_active == True)
        
        result = await db.execute(query)
        return result.scalars().all()


# ============================================================================
# MEETING ACTION CRUD
# ============================================================================
class CRUDMeetingAction(CRUDBase[MeetingAction, MeetingActionCreate, MeetingActionUpdate]):
    """CRUD operations for MeetingAction entity"""
    
    def _normalize_assigned_to_name(self, value: Optional[Union[str, Dict, Any]]) -> Optional[Dict]:
        """
        Convert assigned_to_name to consistent JSON format.
        Expected format: {"name": "John Doe", "email": "john@example.com", "type": "user|participant|manual", "id": "uuid"}
        """
        if value is None:
            return None
        if isinstance(value, str):
            # Try to parse as JSON first
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict) and "name" in parsed:
                    return parsed
            except (json.JSONDecodeError, TypeError):
                pass
            # If not JSON or invalid, treat as plain name
            return {"name": value, "type": "manual"}
        if isinstance(value, dict):
            if "name" not in value:
                return None
            # Ensure type is set
            if "type" not in value:
                value["type"] = "manual"
            return value
        return None
    
    async def create_action(
        self, db: AsyncSession, minute_id: UUID, action_in: MeetingActionCreate, assigned_by_id: UUID
    ) -> MeetingAction:
        """Create a new action item with JSON assigned_to_name support"""
        action_data = action_in.model_dump()
        
        # Get assigned_to_id - validate it exists if provided
        assigned_to_id = action_data.get('assigned_to_id')
        if assigned_to_id:
            # Verify the user exists
            from app.models.user import User
            user_exists = await db.execute(
                select(User).where(User.id == assigned_to_id, User.is_active == True)
            )
            if not user_exists.scalar_one_or_none():
                assigned_to_id = None
        
        # Normalize assigned_to_name to JSON
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
    
    async def update_action(
        self, db: AsyncSession, action_id: UUID, action_in: MeetingActionUpdate, updated_by_id: UUID
    ) -> Optional[MeetingAction]:
        """Update an action item with JSON assigned_to_name support"""
        action = await self.get(db, action_id)
        if not action:
            return None
        
        update_data = action_in.model_dump(exclude_unset=True)
        
        # Handle assigned_to_id - validate if provided
        if 'assigned_to_id' in update_data:
            assigned_to_id = update_data['assigned_to_id']
            if assigned_to_id:
                from app.models.user import User
                user_exists = await db.execute(
                    select(User).where(User.id == assigned_to_id, User.is_active == True)
                )
                if not user_exists.scalar_one_or_none():
                    assigned_to_id = None
            action.assigned_to_id = assigned_to_id
            del update_data['assigned_to_id']
        
        # Handle assigned_to_name specially
        if 'assigned_to_name' in update_data:
            assigned_to_name = self._normalize_assigned_to_name(update_data['assigned_to_name'])
            action.assigned_to_name = assigned_to_name
            del update_data['assigned_to_name']
        
        # Update other fields
        for field, value in update_data.items():
            if value is not None:
                setattr(action, field, value)
        
        action.updated_by_id = updated_by_id
        action.updated_at = datetime.now()
        await db.commit()
        await db.refresh(action)
        return action
    
    async def update_progress(
        self, db: AsyncSession, action_id: UUID, progress_update: ActionProgressUpdate, updated_by_id: UUID
    ) -> MeetingAction:
        """Update action progress and log to history"""
        action = await self.get(db, action_id)
        if not action:
            raise ValueError("Action not found")
        
        # Log to status history
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
        
        # Update action
        old_progress = action.overall_progress_percentage or 0
        action.overall_progress_percentage = progress_update.progress_percentage
        action.updated_by_id = updated_by_id
        action.updated_at = datetime.now()
        
        # Auto-update dates based on progress
        if progress_update.progress_percentage == 100 and old_progress < 100:
            action.completed_at = datetime.now()
        elif progress_update.progress_percentage > 0 and old_progress == 0:
            action.start_date = datetime.now()
        
        await db.commit()
        await db.refresh(action)
        return action
    
    async def add_comment(
        self, db: AsyncSession, action_id: UUID, comment_in: ActionCommentCreate, created_by_id: UUID
    ) -> ActionComment:
        """Add a comment to an action"""
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
    
    async def get_actions_assigned_to_user(
        self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingAction]:
        """Get actions assigned to a specific user by assigned_to_id"""
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
    
    async def get_actions_by_assigned_name(
        self, db: AsyncSession, name: str, skip: int = 0, limit: int = 100
    ) -> List[MeetingAction]:
        """Search actions by assigned_to_name JSON field"""
        # For MySQL JSON search
        result = await db.execute(
            select(MeetingAction)
            .options(
                selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting)
            )
            .where(
                MeetingAction.is_active == True,
                MeetingAction.assigned_to_name.isnot(None),
                func.json_extract(MeetingAction.assigned_to_name, '$.name').cast(String).ilike(f"%{name}%")
            )
            .offset(skip)
            .limit(limit)
            .order_by(MeetingAction.due_date)
        )
        return result.scalars().all()
    
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
    
    async def get_my_tasks(
        self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingAction]:
        """Get tasks for current user (checks assigned_to_id)"""
        return await self.get_actions_assigned_to_user(db, user_id, skip, limit)
    
    async def soft_delete(self, db: AsyncSession, action_id: UUID, deleted_by_id: UUID) -> Optional[MeetingAction]:
        """Soft delete an action"""
        action = await self.get(db, action_id)
        if action:
            action.is_active = False
            action.updated_by_id = deleted_by_id
            action.updated_at = datetime.now()
            await db.commit()
            await db.refresh(action)
        return action
    
# ============================================================================
# MEETING DOCUMENT CRUD
# ============================================================================

class CRUDMeetingDocument(CRUDBase[MeetingDocument, MeetingDocumentCreate, MeetingDocumentUpdate]):
    """CRUD operations for MeetingDocument entity"""
    
    async def create_document(
        self, db: AsyncSession, meeting_id: UUID, document_in: MeetingDocumentCreate, 
        file_path: str, file_size: int, mime_type: str, uploaded_by_id: UUID
    ) -> MeetingDocument:
        """Create and upload a document"""
        document = MeetingDocument(
            meeting_id=meeting_id,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            uploaded_by_id=uploaded_by_id,
            created_by_id=uploaded_by_id,
            created_at=datetime.now(),
            is_active=True,
            **document_in.model_dump()
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)
        return document
    
    async def update_document(
        self, db: AsyncSession, document_id: UUID, obj_in: MeetingDocumentUpdate, updated_by_id: UUID
    ) -> Optional[MeetingDocument]:
        """Update document metadata"""
        document = await self.get(db, document_id)
        if not document:
            return None
        
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(document, field, value)
        
        document.updated_by_id = updated_by_id
        document.updated_at = datetime.now()
        await db.commit()
        await db.refresh(document)
        return document
    
    async def get_meeting_documents(
        self, db: AsyncSession, meeting_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingDocument]:
        """Get all documents for a meeting"""
        result = await db.execute(
            select(MeetingDocument)
            .where(MeetingDocument.meeting_id == meeting_id, MeetingDocument.is_active == True)
            .offset(skip)
            .limit(limit)
            .order_by(MeetingDocument.uploaded_at.desc())
        )
        return result.scalars().all()
    
    async def soft_delete(self, db: AsyncSession, document_id: UUID, deleted_by_id: UUID) -> Optional[MeetingDocument]:
        """Soft delete a document"""
        document = await self.get(db, document_id)
        if document:
            document.is_active = False
            document.updated_by_id = deleted_by_id
            document.updated_at = datetime.now()
            await db.commit()
            await db.refresh(document)
        return document


# ============================================================================
# MEETING PARTICIPANT CRUD
# ============================================================================

class CRUDMeetingParticipant:
    """CRUD operations for MeetingParticipant entity"""
    
    async def update_attendance(
        self, db: AsyncSession, participant_id: UUID, attendance_status: str, updated_by_id: UUID
    ) -> Optional[MeetingParticipant]:
        """Update participant attendance status"""
        result = await db.execute(
            select(MeetingParticipant).where(MeetingParticipant.id == participant_id)
        )
        participant = result.scalar_one_or_none()
        
        if participant:
            participant.attendance_status = attendance_status
            participant.updated_by_id = updated_by_id
            participant.updated_at = datetime.now()
            await db.commit()
            await db.refresh(participant)
        
        return participant
    
    async def get_meeting_participants(self, db: AsyncSession, meeting_id: UUID) -> List[MeetingParticipant]:
        """Get all participants for a meeting"""
        result = await db.execute(
            select(MeetingParticipant)
            .where(
                MeetingParticipant.meeting_id == meeting_id,
                MeetingParticipant.is_active == True
            )
            .order_by(MeetingParticipant.is_chairperson.desc(), MeetingParticipant.name)
        )
        return result.scalars().all()


# ============================================================================
# DASHBOARD SUMMARY CRUD
# ============================================================================

class CRUDDashboard:
    """Dashboard summary statistics"""
    
    async def get_summary(self, db: AsyncSession) -> Dict[str, Any]:
        """Get dashboard summary statistics"""
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
    
    # ========== PRIVATE HELPERS ==========
    
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
    "CRUDDashboard"
]