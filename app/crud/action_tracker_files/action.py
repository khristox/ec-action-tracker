# app/crud/action_tracker/action.py
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import List, Optional, Dict  # FIX: Dict was used below but never imported
from app.crud.base import AuditMixin
from app.models.meetings.action_tracker import MeetingAction, ActionImplementer
from app.schemas.action_tracker_files.action import ActionCreate, ActionUpdate, ActionImplementerIn


class CRUDAction(AuditMixin):
    """CRUD operations for Action entity"""

    async def _replace_implementers(
        self, db: AsyncSession, action_id: UUID, implementers: List[ActionImplementerIn]
    ) -> None:
        """
        Replace the full set of implementers for an action. The frontend
        always sends the complete current table on every save (not a diff),
        so wholesale delete-then-recreate is simpler and safer than trying
        to reconcile individual row updates/inserts/deletes.
        """
        await db.execute(
            delete(ActionImplementer).where(ActionImplementer.action_id == action_id)
        )
        for index, person in enumerate(implementers):
            db.add(ActionImplementer(
                action_id=action_id,
                user_id=person.id,
                name=person.name,
                email=person.email,
                phone=person.phone,
                sort_order=index,
            ))

    async def create(
        self, db: AsyncSession, obj_in: ActionCreate, created_by_id: UUID
    ) -> MeetingAction:
        """Create a new action"""
        db_obj = MeetingAction(
            description=obj_in.description,
            due_date=obj_in.due_date,
            priority=obj_in.priority,
            remarks=obj_in.remarks,
            minute_id=obj_in.minute_id,
            assigned_to_id=obj_in.assigned_to_id,
            assigned_to_name=obj_in.assigned_to_name,
            created_by_id=created_by_id,
            overall_progress_percentage=0,
            # ---- New fields ----
            title=obj_in.title,
            issue_challenge=obj_in.issue_challenge,
            is_key_action=obj_in.is_key_action,
            type_of_action=obj_in.type_of_action,
            date_initiated=obj_in.date_initiated,
            tags=obj_in.tags or [],
            assign_to_meeting_id=obj_in.assign_to_meeting_id,
        )
        db.add(db_obj)
        await db.flush()  # get db_obj.id before adding implementers

        if obj_in.persons_implementing:
            await self._replace_implementers(db, db_obj.id, obj_in.persons_implementing)

        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get(
        self, db: AsyncSession, id: UUID
    ) -> Optional[MeetingAction]:
        """Get action by ID"""
        result = await db.execute(
            select(MeetingAction)
            .where(MeetingAction.id == id, MeetingAction.is_active == True)
            .options(
                selectinload(MeetingAction.minute),
                selectinload(MeetingAction.implementers),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_minute(
        self, db: AsyncSession, minute_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MeetingAction]:
        """Get all actions for a minute"""
        result = await db.execute(
            select(MeetingAction)
            .where(
                MeetingAction.minute_id == minute_id,
                MeetingAction.is_active == True
            )
            .options(selectinload(MeetingAction.implementers))
            .offset(skip)
            .limit(limit)
            .order_by(MeetingAction.due_date.asc())
        )
        return result.scalars().all()

    async def update(
        self, db: AsyncSession, id: UUID, obj_in: ActionUpdate
    ) -> Optional[MeetingAction]:
        """Update an action"""
        action = await self.get(db, id)
        if not action:
            return None

        # persons_implementing needs its own handling (a related table, not
        # a plain column), so pull it out before the generic setattr loop.
        update_data = obj_in.model_dump(exclude_unset=True, exclude={"persons_implementing"})
        for field, value in update_data.items():
            setattr(action, field, value)

        # None (field simply not sent) = leave implementers untouched.
        # An explicit list (including []) = replace wholesale.
        if obj_in.persons_implementing is not None:
            await self._replace_implementers(db, action.id, obj_in.persons_implementing)

        await db.commit()
        await db.refresh(action)
        return action

    async def update_progress(
        self, db: AsyncSession, id: UUID, progress_percentage: int, status_id: UUID, remarks: str
    ) -> Optional[MeetingAction]:
        """Update action progress"""
        action = await self.get(db, id)
        if not action:
            return None

        action.overall_progress_percentage = progress_percentage
        action.overall_status_id = status_id

        if progress_percentage >= 100:
            action.completed_at = datetime.utcnow()

        # Add progress remark (you might want to store this in a separate table)
        if remarks:
            action.remarks = remarks

        await db.commit()
        await db.refresh(action)
        return action

    async def assign_user(
        self, db: AsyncSession, id: UUID, user_id: UUID, user_name: Optional[Dict] = None
    ) -> Optional[MeetingAction]:
        """Assign action to a user"""
        action = await self.get(db, id)
        if not action:
            return None

        action.assigned_to_id = user_id
        if user_name:
            action.assigned_to_name = user_name

        await db.commit()
        await db.refresh(action)
        return action

    async def delete(
        self, db: AsyncSession, id: UUID
    ) -> bool:
        """Soft delete an action"""
        action = await self.get(db, id)
        if not action:
            return False

        action.is_active = False
        await db.commit()
        return True


# Create instance
action_crud = CRUDAction()