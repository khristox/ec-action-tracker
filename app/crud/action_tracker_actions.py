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

# Make sure this comes AFTER the class definition
participant = CRUDParticipant(Participant)
participant_list = CRUDParticipantList(ParticipantList)
meeting = CRUDMeeting(Meeting)
meeting_minutes = CRUDMeetingMinutes(MeetingMinutes)
meeting_action = CRUDMeetingAction(MeetingAction)  # ✅ Now CRUDMeetingAction is defined
meeting_document = CRUDMeetingDocument(MeetingDocument)
meeting_participant = CRUDMeetingParticipant()
dashboard = CRUDDashboard()