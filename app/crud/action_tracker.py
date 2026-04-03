from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.crud.base import CRUDBase
from app.models.action_tracker import (
    Meeting, MeetingMinutes, MeetingAction, MeetingParticipant,
    Participant, ParticipantList, ActionStatusHistory, ActionComment, MeetingDocument
)
from app.schemas.action_tracker import (
    MeetingCreate, MeetingUpdate, MeetingMinutesCreate, MeetingMinutesUpdate,
    MeetingActionCreate, MeetingActionUpdate, ParticipantCreate, ParticipantUpdate,
    ParticipantListCreate, ParticipantListUpdate, MeetingDocumentCreate, 
    MeetingDocumentUpdate, ActionProgressUpdate, ActionCommentCreate
)


# ==================== Participant CRUD ====================

class CRUDParticipant(CRUDBase[Participant, ParticipantCreate, ParticipantUpdate]):
    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[Participant]:
        result = await db.execute(
            select(Participant).where(Participant.email == email)
        )
        return result.scalar_one_or_none()
    
    async def search(self, db: AsyncSession, query: str, skip: int = 0, limit: int = 100) -> List[Participant]:
        search_term = f"%{query}%"
        result = await db.execute(
            select(Participant)
            .where(
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
        result = await db.execute(
            select(Participant)
            .where(Participant.created_by_id == created_by_id)
            .order_by(Participant.name)
        )
        return result.scalars().all()


# ==================== Participant List CRUD ====================

class CRUDParticipantList(CRUDBase[ParticipantList, ParticipantListCreate, ParticipantListUpdate]):
    async def get_accessible_lists(
        self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[ParticipantList]:
        result = await db.execute(
            select(ParticipantList)
            .options(selectinload(ParticipantList.participants))
            .where(
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
        self, db: AsyncSession, list_id: UUID, participant_ids: List[UUID]
    ) -> Optional[ParticipantList]:
        list_obj = await self.get(db, list_id)
        if list_obj:
            result = await db.execute(
                select(Participant).where(Participant.id.in_(participant_ids))
            )
            participants = result.scalars().all()
            list_obj.participants.extend(participants)
            await db.commit()
            await db.refresh(list_obj)
        return list_obj
    
    async def remove_participant(
        self, db: AsyncSession, list_id: UUID, participant_id: UUID
    ) -> bool:
        list_obj = await self.get(db, list_id)
        if list_obj:
            list_obj.participants = [p for p in list_obj.participants if p.id != participant_id]
            await db.commit()
            return True
        return False


# ==================== Meeting CRUD ====================

class CRUDMeeting(CRUDBase[Meeting, MeetingCreate, MeetingUpdate]):
    
    async def create_with_participants(
        self, db: AsyncSession, obj_in: MeetingCreate, created_by_id: UUID
    ) -> Meeting:
        meeting_data = obj_in.model_dump(exclude={'participant_list_id', 'custom_participants'})
        meeting = Meeting(**meeting_data, created_by_id=created_by_id)
        db.add(meeting)
        await db.flush()
        
        # Add participants from template list
        if obj_in.participant_list_id:
            result = await db.execute(
                select(ParticipantList)
                .options(selectinload(ParticipantList.participants))
                .where(ParticipantList.id == obj_in.participant_list_id)
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
                        is_chairperson=(template_participant.name == meeting.chairperson_name)
                    )
                    db.add(meeting_participant)
        
        # Add custom participants
        for custom_participant in obj_in.custom_participants:
            meeting_participant = MeetingParticipant(
                meeting_id=meeting.id,
                **custom_participant.model_dump()
            )
            db.add(meeting_participant)
        
        await db.commit()
        await db.refresh(meeting)
        return meeting
    
    async def get_upcoming_meetings(
        self, db: AsyncSession, limit: int = 10
    ) -> List[Meeting]:
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
        result = await db.execute(
            select(Meeting)
            .options(selectinload(Meeting.participants))
            .where(Meeting.status_id == status_id, Meeting.is_active == True)
            .offset(skip)
            .limit(limit)
            .order_by(Meeting.meeting_date.desc())
        )
        return result.scalars().all()
    
    async def add_minutes(
        self, db: AsyncSession, meeting_id: UUID, minutes_in: MeetingMinutesCreate, recorded_by_id: UUID
    ) -> MeetingMinutes:
        minutes = MeetingMinutes(
            meeting_id=meeting_id,
            **minutes_in.model_dump(),
            recorded_by_id=recorded_by_id
        )
        db.add(minutes)
        await db.commit()
        await db.refresh(minutes)
        return minutes

# app/crud/action_tracker.py

    # app/crud/action_tracker.py - Update get_meeting_with_details

    async def get_meeting_with_details(
        self, db: AsyncSession, meeting_id: UUID
    ) -> Optional[Meeting]:
        result = await db.execute(
            select(Meeting)
            .options(
                selectinload(Meeting.participants),
                selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions),
                selectinload(Meeting.documents)
            )
            .where(Meeting.id == meeting_id)
        )
        return result.scalar_one_or_none()

    


# ==================== Meeting Minutes CRUD ====================

class CRUDMeetingMinutes(CRUDBase[MeetingMinutes, MeetingMinutesCreate, MeetingMinutesUpdate]):
    async def get_minutes_with_actions(
        self, db: AsyncSession, minutes_id: UUID
    ) -> Optional[MeetingMinutes]:
        result = await db.execute(
            select(MeetingMinutes)
            .options(selectinload(MeetingMinutes.actions))
            .where(MeetingMinutes.id == minutes_id)
        )
        return result.scalar_one_or_none()
    
    async def get_meeting_minutes(
        self, db: AsyncSession, meeting_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingMinutes]:
        result = await db.execute(
            select(MeetingMinutes)
            .options(selectinload(MeetingMinutes.actions))
            .where(MeetingMinutes.meeting_id == meeting_id)
            .offset(skip)
            .limit(limit)
            .order_by(MeetingMinutes.timestamp.desc())
        )
        return result.scalars().all()


# ==================== Meeting Action CRUD ====================

class CRUDMeetingAction(CRUDBase[MeetingAction, MeetingActionCreate, MeetingActionUpdate]):
    
    async def create_action(
        self, db: AsyncSession, minute_id: UUID, action_in: MeetingActionCreate, assigned_by_id: UUID
    ) -> MeetingAction:
        action = MeetingAction(
            minute_id=minute_id,
            **action_in.model_dump(),
            assigned_by_id=assigned_by_id,
            assigned_at=datetime.now()
        )
        db.add(action)
        await db.commit()
        await db.refresh(action)
        return action
    
    async def update_progress(
        self, db: AsyncSession, action_id: UUID, progress_update: ActionProgressUpdate, updated_by_id: UUID
    ) -> MeetingAction:
        action = await self.get(db, action_id)
        if not action:
            raise ValueError("Action not found")
        
        # Add to status history
        history = ActionStatusHistory(
            action_id=action_id,
            individual_status_id=progress_update.individual_status_id,
            remarks=progress_update.remarks,
            progress_percentage=progress_update.progress_percentage,
            updated_by_id=updated_by_id
        )
        db.add(history)
        
        # Update action progress
        action.overall_progress_percentage = progress_update.progress_percentage
        
        # Auto-update overall status based on progress
        if progress_update.progress_percentage == 100:
            # Find completed status ID (you may need to fetch this)
            action.completed_at = datetime.now()
        elif progress_update.progress_percentage > 0 and action.overall_progress_percentage == 0:
            action.start_date = datetime.now()
        
        await db.commit()
        await db.refresh(action)
        return action
    
    async def add_comment(
        self, db: AsyncSession, action_id: UUID, comment_in: ActionCommentCreate, created_by_id: UUID
    ) -> ActionComment:
        comment = ActionComment(
            action_id=action_id,
            **comment_in.model_dump(),
            created_by_id=created_by_id
        )
        db.add(comment)
        await db.commit()
        await db.refresh(comment)
        return comment
    
    async def get_actions_assigned_to_user(
        self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingAction]:
        result = await db.execute(
            select(MeetingAction)
            .options(selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting))
            .where(MeetingAction.assigned_to_id == user_id)
            .offset(skip)
            .limit(limit)
            .order_by(MeetingAction.due_date)
        )
        return result.scalars().all()
    
    async def get_overdue_actions(
        self, db: AsyncSession, skip: int = 0, limit: int = 100
    ) -> List[MeetingAction]:
        result = await db.execute(
            select(MeetingAction)
            .options(selectinload(MeetingAction.minutes))
            .where(
                MeetingAction.due_date < datetime.now(),
                MeetingAction.completed_at.is_(None)
            )
            .offset(skip)
            .limit(limit)
            .order_by(MeetingAction.due_date)
        )
        return result.scalars().all()


# ==================== Meeting Document CRUD ====================

class CRUDMeetingDocument(CRUDBase[MeetingDocument, MeetingDocumentCreate, MeetingDocumentUpdate]):
    async def get_meeting_documents(
        self, db: AsyncSession, meeting_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingDocument]:
        result = await db.execute(
            select(MeetingDocument)
            .where(MeetingDocument.meeting_id == meeting_id, MeetingDocument.is_active == True)
            .offset(skip)
            .limit(limit)
            .order_by(MeetingDocument.uploaded_at.desc())
        )
        return result.scalars().all()
    
    async def upload_document(
        self, db: AsyncSession, meeting_id: UUID, document_in: MeetingDocumentCreate, 
        file_path: str, file_size: int, mime_type: str, uploaded_by_id: UUID
    ) -> MeetingDocument:
        document = MeetingDocument(
            meeting_id=meeting_id,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            uploaded_by_id=uploaded_by_id,
            **document_in.model_dump()
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)
        return document


# ==================== Dashboard Summary CRUD ====================

class CRUDDashboard:
    async def get_summary(self, db: AsyncSession) -> Dict[str, Any]:
        # Total meetings
        total_meetings_result = await db.execute(
            select(func.count()).select_from(Meeting).where(Meeting.is_active == True)
        )
        total_meetings = total_meetings_result.scalar() or 0
        
        # Upcoming meetings
        upcoming_result = await db.execute(
            select(func.count()).select_from(Meeting)
            .where(Meeting.meeting_date >= datetime.now(), Meeting.is_active == True)
        )
        upcoming_meetings = upcoming_result.scalar() or 0
        
        # Total actions
        total_actions_result = await db.execute(select(func.count()).select_from(MeetingAction))
        total_actions = total_actions_result.scalar() or 0
        
        # Pending actions (not completed and not cancelled)
        pending_result = await db.execute(
            select(func.count()).select_from(MeetingAction)
            .where(MeetingAction.completed_at.is_(None))
        )
        pending_actions = pending_result.scalar() or 0
        
        # Overdue actions
        overdue_result = await db.execute(
            select(func.count()).select_from(MeetingAction)
            .where(
                MeetingAction.due_date < datetime.now(),
                MeetingAction.completed_at.is_(None)
            )
        )
        overdue_actions = overdue_result.scalar() or 0
        
        # Completed actions
        completed_result = await db.execute(
            select(func.count()).select_from(MeetingAction)
            .where(MeetingAction.completed_at.isnot(None))
        )
        completed_actions = completed_result.scalar() or 0
        
        # Total participants
        total_participants_result = await db.execute(select(func.count()).select_from(Participant))
        total_participants = total_participants_result.scalar() or 0
        
        # Meetings by status (using status_id - you may need to join with attribute_values)
        # For now, just return counts
        
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


# ==================== Initialize CRUD instances ====================

participant = CRUDParticipant(Participant)
participant_list = CRUDParticipantList(ParticipantList)
meeting = CRUDMeeting(Meeting)
meeting_minutes = CRUDMeetingMinutes(MeetingMinutes)
meeting_action = CRUDMeetingAction(MeetingAction)
meeting_document = CRUDMeetingDocument(MeetingDocument)
dashboard = CRUDDashboard()


# ==================== EXPORTS ====================
# Explicitly define what gets exported when importing from this module
__all__ = [
    "participant",
    "participant_list", 
    "meeting",
    "meeting_minutes",
    "meeting_action",
    "meeting_document",
    "dashboard",
    # Also export the classes if needed elsewhere
    "CRUDParticipant",
    "CRUDParticipantList",
    "CRUDMeeting",
    "CRUDMeetingMinutes",
    "CRUDMeetingAction",
    "CRUDMeetingDocument",
    "CRUDDashboard"
]