# app/crud/recurring_meeting_service.py
from venv import logger

from sqlalchemy import desc, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
import uuid
import json


from app.models.action_tracker import Meeting
from app.models.address.location import Location
from app.models.general.dynamic_attribute import Attribute, AttributeGroup

from app.models.recurring_meeting import RecurringMeeting, RecurringMeetingOccurrence
from app.schemas.recurring_meeting_schema import RecurringMeetingCreate, RecurringMeetingUpdate, PreviewOccurrencesRequest


class RecurringMeetingService:
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def _validate_recurrence_attributes(self, meeting_data: RecurringMeetingCreate):
        """Validate that attribute IDs exist"""
        
        # First, get the group ID for RECURRING_MEETING
        group_result = await self.db.execute(
            select(AttributeGroup).where(AttributeGroup.code == "RECURRING_MEETING")
        )
        group = group_result.scalar_one_or_none()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="RECURRING_MEETING attribute group not found"
            )
        
        # Validate recurrence type
        if meeting_data.recurrence_type_id:
            result = await self.db.execute(
                select(Attribute).where(
                    Attribute.id == meeting_data.recurrence_type_id,
                    Attribute.group_id == group.id  # Use group_id directly
                )
            )
            recurrence_type = result.scalar_one_or_none()
            if not recurrence_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid recurrence_type_id: {meeting_data.recurrence_type_id}"
                )
        
        # Validate recurrence days
        if meeting_data.recurrence_days:
            for day_id in meeting_data.recurrence_days:
                result = await self.db.execute(
                    select(Attribute).where(
                        Attribute.id == day_id,
                        Attribute.group_id == group.id  # Use group_id directly
                    )
                )
                day_attr = result.scalar_one_or_none()
                if not day_attr:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid recurrence day ID: {day_id}"
                    )
        
        # Validate week of month
        if meeting_data.recurrence_week_of_month_id:
            result = await self.db.execute(
                select(Attribute).where(
                    Attribute.id == meeting_data.recurrence_week_of_month_id,
                    Attribute.group_id == group.id  # Use group_id directly
                )
            )
            week_attr = result.scalar_one_or_none()
            if not week_attr:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid recurrence_week_of_month_id"
                )
        
        # Validate day of week
        if meeting_data.recurrence_day_of_week_id:
            result = await self.db.execute(
                select(Attribute).where(
                    Attribute.id == meeting_data.recurrence_day_of_week_id,
                    Attribute.group_id == group.id  # Use group_id directly
                )
            )
            day_attr = result.scalar_one_or_none()
            if not day_attr:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid recurrence_day_of_week_id"
                )
        
        # Validate status
        if meeting_data.status_id:
            result = await self.db.execute(
                select(Attribute).where(
                    Attribute.id == meeting_data.status_id,
                    Attribute.group_id == group.id  # Use group_id directly
                )
            )
            status_attr = result.scalar_one_or_none()
            if not status_attr:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status_id: {meeting_data.status_id}"
                )
    

    async def create_recurring_meeting(self, meeting_data: RecurringMeetingCreate, user_id: uuid.UUID) -> RecurringMeeting:
        """Create a new recurring meeting"""
        
        # Validate attribute IDs
        await self._validate_recurrence_attributes(meeting_data)
        
        # Calculate duration if not provided
        duration_minutes = meeting_data.duration_minutes
        if not duration_minutes and meeting_data.start_time and meeting_data.end_time:
            delta = meeting_data.end_time - meeting_data.start_time
            duration_minutes = int(delta.total_seconds() / 60)
        
        # Convert UUIDs to strings for JSON fields
        recurrence_days_str = None
        if meeting_data.recurrence_days:
            recurrence_days_str = [str(day_id) for day_id in meeting_data.recurrence_days]
        
        default_participants_str = None
        if meeting_data.default_participant_ids:
            default_participants_str = [str(pid) for pid in meeting_data.default_participant_ids]
        
        # Create recurring meeting record
        db_meeting = RecurringMeeting(
            id=uuid.uuid4(),
            title=meeting_data.title,
            description=meeting_data.description,
            recurrence_type_id=meeting_data.recurrence_type_id,
            recurrence_interval=meeting_data.recurrence_interval,
            recurrence_days=recurrence_days_str,
            recurrence_day_of_month=meeting_data.recurrence_day_of_month,
            recurrence_week_of_month_id=meeting_data.recurrence_week_of_month_id,
            recurrence_day_of_week_id=meeting_data.recurrence_day_of_week_id,
            recurrence_end_date=meeting_data.recurrence_end_date,
            recurrence_max_occurrences=meeting_data.recurrence_max_occurrences,
            recurrence_end_after_occurrences=meeting_data.recurrence_end_after_occurrences,
            meeting_template_id=meeting_data.meeting_template_id,
            start_time=meeting_data.start_time,
            end_time=meeting_data.end_time,
            duration_minutes=duration_minutes,
            location_id=meeting_data.location_id,
            location_text=meeting_data.location_text,
            platform=meeting_data.platform,
            meeting_link=meeting_data.meeting_link,
            chairperson_id=meeting_data.chairperson_id,
            secretary_id=meeting_data.secretary_id,
            facilitator=meeting_data.facilitator,
            default_participant_ids=default_participants_str,
            agenda=meeting_data.agenda,
            additional_info=meeting_data.additional_info,
            status_id=meeting_data.status_id,
            created_by_id=user_id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        if meeting_data.location_id:
            loc_result = await self.db.execute(
                select(Location).where(Location.id == meeting_data.location_id)
            )
            if not loc_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=400,
                    detail=f"location_id {meeting_data.location_id} does not exist"
                )
                    
        
        self.db.add(db_meeting)
        await self.db.commit()
        await self.db.refresh(db_meeting)
        
        # Generate first occurrence
        await self._generate_first_occurrence(db_meeting)
        
        # IMPORTANT: Return the created meeting
        return db_meeting




    async def _generate_first_occurrence(self, recurring: RecurringMeeting):
        """Generate the first meeting from the recurring template"""
        try:
            # Get a valid meeting status from attributes table
            # First, try to get the 'scheduled' status
            result = await self.db.execute(
                select(Attribute).where(
                    Attribute.code == "MEETING_STATUS_SCHEDULED",
                    Attribute.is_active == True
                )
            )
            status_attr = result.scalar_one_or_none()
            
            # If not found, try to get any meeting status
            if not status_attr:
                result = await self.db.execute(
                    select(Attribute).where(
                        Attribute.group.has(code="MEETING_STATUS"),
                        Attribute.is_active == True
                    ).limit(1)
                )
                status_attr = result.scalar_one_or_none()
            
            # If still not found, get the RECURRING_STATUS_ACTIVE as fallback
            if not status_attr:
                result = await self.db.execute(
                    select(Attribute).where(Attribute.code == "RECURRING_STATUS_ACTIVE")
                )
                status_attr = result.scalar_one_or_none()
            
            status_id = status_attr.id if status_attr else None
            
            # If no status found, you may need to create one or set to NULL
            if not status_id:
                # Set to NULL if your schema allows, or create a default status
                status_id = None
            
            # Create the first meeting occurrence
            first_meeting = Meeting(
                id=uuid.uuid4(),
                title=recurring.title,
                description=recurring.description,
                meeting_date=recurring.start_time.date(),
                start_time=recurring.start_time,
                end_time=recurring.end_time,
                duration_minutes=recurring.duration_minutes,
                location_id=recurring.location_id,
                location_text=recurring.location_text,
                platform=recurring.platform,
                meeting_link=recurring.meeting_link,
                chairperson_id=recurring.chairperson_id,
                secretary_id=recurring.secretary_id,
                facilitator=recurring.facilitator,
                agenda=recurring.agenda,
                status_id=status_id,  # Use the fetched UUID or None
                is_recurring=True,
                
                recurring_meeting_id=recurring.id,
                occurrence_number=1,
                created_by_id=recurring.created_by_id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                is_active=True,
                is_deleted=False
            )
            self.db.add(first_meeting)
            await self.db.flush()
            
            # Create occurrence record
            occurrence = RecurringMeetingOccurrence(
                id=uuid.uuid4(),
                recurring_meeting_id=recurring.id,
                meeting_id=first_meeting.id,
                occurrence_number=1,
                scheduled_date=recurring.start_time,
                status="scheduled",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            self.db.add(occurrence)
            
            # Update recurring meeting
            recurring.occurrences_count = 1
            recurring.total_occurrences_generated = 1
            recurring.last_occurrence_date = recurring.start_time
            
            # Calculate next occurrence if needed
            if recurring.recurrence_interval:
                recurring.next_occurrence_date = recurring.start_time + timedelta(days=7 * recurring.recurrence_interval)
            
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            print(f"Error generating first occurrence: {e}")
            raise


    async def get_recurring_meetings(
        self, 
        skip: int = 0, 
        limit: int = 100,
        status_id: Optional[uuid.UUID] = None,
        recurrence_type_id: Optional[uuid.UUID] = None
    ) -> List[RecurringMeeting]:
        """Get all recurring meetings"""
        from sqlalchemy.orm import joinedload
        
        query = select(RecurringMeeting).where(RecurringMeeting.is_deleted == False)
        
        # Eager load location relationship if you want to include location details
        query = query.options(joinedload(RecurringMeeting.location))
        
        if status_id:
            query = query.where(RecurringMeeting.status_id == status_id)
        if recurrence_type_id:
            query = query.where(RecurringMeeting.recurrence_type_id == recurrence_type_id)
        
        query = query.offset(skip).limit(limit).order_by(RecurringMeeting.created_at.desc())
        
        result = await self.db.execute(query)
        return result.unique().scalars().all()

    
    async def get_recurring_meeting(self, meeting_id: uuid.UUID) -> Optional[RecurringMeeting]:
        """Get a single recurring meeting"""
        query = select(RecurringMeeting).where(
            RecurringMeeting.id == meeting_id,
            RecurringMeeting.is_deleted == False
        ).options(
            selectinload(RecurringMeeting.recurrence_type),
            selectinload(RecurringMeeting.status),
            selectinload(RecurringMeeting.occurrences)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def update_recurring_meeting(
        self, 
        meeting_id: uuid.UUID, 
        meeting_data: RecurringMeetingUpdate
    ) -> Optional[RecurringMeeting]:
        """Update a recurring meeting"""
        db_meeting = await self.get_recurring_meeting(meeting_id)
        if not db_meeting:
            return None
        
        update_data = meeting_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_meeting, field, value)
        
        db_meeting.updated_at = datetime.now()
        await self.db.commit()
        await self.db.refresh(db_meeting)
        
        return db_meeting
    
    async def delete_recurring_meeting(
        self, 
        meeting_id: uuid.UUID, 
        delete_occurrences: bool = False
    ) -> bool:
        """Soft delete a recurring meeting"""
        db_meeting = await self.get_recurring_meeting(meeting_id)
        if not db_meeting:
            return False
        
        db_meeting.is_deleted = True
        db_meeting.deleted_at = datetime.now()
        
        if delete_occurrences:
            for occurrence in db_meeting.occurrences:
                occurrence.status = "cancelled"
                if occurrence.meeting:
                    try:
                        occurrence.meeting.status_id = 4  # Cancelled status
                        occurrence.meeting.updated_at = datetime.now()
                    except:
                        pass
        
        await self.db.commit()
        return True
    
    async def generate_occurrences(
        self, 
        meeting_id: uuid.UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        max_occurrences: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Generate future occurrences"""
        return []
    
    async def preview_occurrences(self, request: PreviewOccurrencesRequest) -> List[datetime]:
        """Preview occurrence dates"""
        dates = []
        current = request.start_date
        
        # Get recurrence type value
        result = await self.db.execute(
            select(Attribute).where(Attribute.id == request.recurrence_type_id)
        )
        recurrence_attr = result.scalar_one_or_none()
        
        if recurrence_attr and recurrence_attr.extra_metadata:
            metadata = recurrence_attr.extra_metadata
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    metadata = {}
            recurrence_type = metadata.get('value', 'weekly')
        else:
            recurrence_type = 'weekly'
        
        for i in range(min(request.max_occurrences, 10)):
            dates.append(current)
            
            if recurrence_type == "daily":
                current = current + timedelta(days=request.recurrence_interval)
            elif recurrence_type == "weekly":
                current = current + timedelta(weeks=request.recurrence_interval)
            elif recurrence_type == "monthly":
                month = current.month + request.recurrence_interval
                year = current.year
                while month > 12:
                    month -= 12
                    year += 1
                try:
                    current = current.replace(year=year, month=month)
                except ValueError:
                    current = current.replace(year=year, month=month, day=28)
            elif recurrence_type == "yearly":
                current = current.replace(year=current.year + request.recurrence_interval)
        
        return dates[:request.max_occurrences]

    async def get_occurrences_by_meeting(
        self, 
        recurring_meeting_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50
    ) -> List[Meeting]:
        """
        Get all meeting occurrences for a recurring meeting.
        Returns the actual Meeting objects (not occurrence records).
        """
        try:
            # Query the Meeting table directly where recurring_meeting_id matches
            query = select(Meeting).where(
                Meeting.recurring_meeting_id == recurring_meeting_id,
                Meeting.is_active == True,
                Meeting.is_deleted == False
            ).options(
                selectinload(Meeting.status),
                selectinload(Meeting.participants),
                selectinload(Meeting.created_by)
            ).order_by(desc(Meeting.meeting_date)).offset(skip).limit(limit)
            
            result = await self.db.execute(query)
            meetings = result.scalars().all()
            """ print(json.dumps([
                {
                    **{
                        col.name: str(getattr(m, col.name))
                        for col in m.__table__.columns
                    },
                    "participants_count": len(m.participants or [])
                }
                for m in meetings
            ], indent=2)) """
            
            return meetings
        except Exception as e:
            logger.error(f"Error getting occurrences for recurring meeting {recurring_meeting_id}: {e}")
            return []


    async def get_occurrence_records_by_meeting(
        self, 
        recurring_meeting_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50
    ) -> List[RecurringMeetingOccurrence]:
        """
        Get all occurrence records for a recurring meeting.
        Returns the RecurringMeetingOccurrence records.
        """
        try:
            query = select(RecurringMeetingOccurrence).where(
                RecurringMeetingOccurrence.recurring_meeting_id == recurring_meeting_id
            ).options(
                selectinload(RecurringMeetingOccurrence.meeting)
            ).order_by(desc(RecurringMeetingOccurrence.scheduled_date)).offset(skip).limit(limit)
            
            result = await self.db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error getting occurrence records for recurring meeting {recurring_meeting_id}: {e}")
            return []

    async def generate_on_demand_occurrence(
        self, 
        recurring_meeting_id: uuid.UUID,
        target_date: Optional[datetime] = None
    ) -> Optional[Meeting]:
        """
        Generate a single occurrence on demand.
        """
        try:
            from datetime import timedelta
            import json
            
            # Get the recurring meeting
            recurring = await self.get_recurring_meeting(recurring_meeting_id)
            if not recurring:
                return None
            
            # Get default status for meetings
            status_result = await self.db.execute(
                select(Attribute).where(
                    Attribute.code == "MEETING_STATUS_SCHEDULED",
                    Attribute.is_active == True
                )
            )
            status_attr = status_result.scalar_one_or_none()
            
            if not status_attr:
                status_result = await self.db.execute(
                    select(Attribute).where(
                        Attribute.group.has(code="MEETING_STATUS"),
                        Attribute.is_active == True
                    ).limit(1)
                )
                status_attr = status_result.scalar_one_or_none()
            
            # Determine the meeting date and time
            if target_date:
                meeting_datetime = target_date
            elif recurring.next_occurrence_date:
                meeting_datetime = recurring.next_occurrence_date
            elif recurring.start_time:
                meeting_datetime = recurring.start_time
            else:
                # Default to today at the specified start time or 9 AM
                meeting_datetime = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
            
            # Extract date and time components
            meeting_date = meeting_datetime.date() if hasattr(meeting_datetime, 'date') else meeting_datetime
            start_time = meeting_datetime if isinstance(meeting_datetime, datetime) else recurring.start_time
            
            # Calculate end time
            end_time = recurring.end_time
            if not end_time:
                # If no end_time set, default to 1 hour after start
                end_time = start_time + timedelta(hours=1)
                logger.info(f"Auto-calculated end_time: {end_time}")
            
            # Ensure end_time is after start_time
            if end_time <= start_time:
                end_time = start_time + timedelta(hours=1)
                logger.warning(f"Fixed invalid end_time, set to: {end_time}")
            
            # Create the meeting occurrence with proper dates
            meeting = Meeting(
                id=uuid.uuid4(),
                title=recurring.title,
                description=recurring.description,
                meeting_date=meeting_date,
                start_time=start_time,
                end_time=end_time,
                duration_minutes=recurring.duration_minutes or 60,  # Default to 60 minutes
                location_id=recurring.location_id,
                location_text=recurring.location_text,
                platform=recurring.platform,
                meeting_link=recurring.meeting_link,
                chairperson_id=recurring.chairperson_id,
                secretary_id=recurring.secretary_id,
                facilitator=recurring.facilitator,
                agenda=recurring.agenda,
                status_id=status_attr.id if status_attr else None,
                is_recurring=True,
                recurring_meeting_id=recurring.id,
                occurrence_number=(recurring.total_occurrences_generated or 0) + 1,
                created_by_id=recurring.created_by_id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                is_active=True,
                is_deleted=False
            )
            
            self.db.add(meeting)
            await self.db.flush()
            
            # Update recurring meeting counts
            recurring.total_occurrences_generated = (recurring.total_occurrences_generated or 0) + 1
            recurring.occurrences_count = (recurring.occurrences_count or 0) + 1
            recurring.last_occurrence_date = meeting_datetime
            recurring.updated_at = datetime.now()
            
            await self.db.commit()
            await self.db.refresh(meeting)
            
            logger.info(f"Generated occurrence {meeting.id} with date {meeting_date} and time {start_time}")
            
            return meeting
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error generating on-demand occurrence: {e}", exc_info=True)
            raise

# Create singleton instance
recurring_meeting_service = None


async def get_recurring_meeting_service(db: AsyncSession):
    return RecurringMeetingService(db)