# app/crud/recurring_meeting_service.py
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
import uuid
import json

from sqlalchemy import desc, select, update, delete, func
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.meetings.action_tracker import Meeting, MeetingParticipant
from app.models.address.location import Location
from app.models.user import User
from app.models.general.dynamic_attribute import Attribute, AttributeGroup
from app.models.meetings.recurring_meeting import RecurringMeeting, RecurringMeetingOccurrence
from app.schemas.recurring_meeting_schema import RecurringMeetingCreate, RecurringMeetingUpdate, PreviewOccurrencesRequest

logger = logging.getLogger(__name__)

# ==================== DATETIME UTILITY FUNCTIONS ====================

def ensure_naive_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Ensure datetime is timezone-naive (UTC).
    This fixes the "can't subtract offset-naive and offset-aware datetimes" error.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        # Convert to UTC and remove timezone info
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

def get_utc_now() -> datetime:
    """Get current UTC datetime as naive"""
    return datetime.utcnow()

def ensure_naive_datetimes_in_dict(data: dict) -> dict:
    """Recursively convert all datetime objects in a dict to naive"""
    if not data:
        return data
    
    result = {}
    for key, value in data.items():
        if isinstance(value, datetime):
            result[key] = ensure_naive_datetime(value)
        elif isinstance(value, dict):
            result[key] = ensure_naive_datetimes_in_dict(value)
        elif isinstance(value, list):
            result[key] = [
                ensure_naive_datetimes_in_dict(item) if isinstance(item, dict)
                else ensure_naive_datetime(item) if isinstance(item, datetime)
                else item
                for item in value
            ]
        else:
            result[key] = value
    return result

# ==================== JSON UTILITY FUNCTIONS ====================

def convert_uuids_to_strings(obj: dict) -> dict:
    """Convert UUID objects to strings in a dictionary for JSON serialization"""
    converted = {}
    for key, value in obj.items():
        if isinstance(value, uuid.UUID):
            converted[key] = str(value)
        elif isinstance(value, list):
            converted[key] = []
            for item in value:
                if isinstance(item, uuid.UUID):
                    converted[key].append(str(item))
                elif isinstance(item, dict):
                    converted[key].append(convert_uuids_to_strings(item))
                else:
                    converted[key].append(item)
        elif isinstance(value, dict):
            converted[key] = convert_uuids_to_strings(value)
        else:
            converted[key] = value
    return converted

def ensure_json_serializable(data: Any) -> Any:
    """Ensure data is JSON serializable"""
    if isinstance(data, uuid.UUID):
        return str(data)
    elif isinstance(data, list):
        return [ensure_json_serializable(item) for item in data]
    elif isinstance(data, dict):
        return {key: ensure_json_serializable(value) for key, value in data.items()}
    elif isinstance(data, datetime):
        return data.isoformat()
    return data

# ==================== SERVICE CLASS ====================

class RecurringMeetingService:
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def _validate_recurrence_attributes(self, meeting_data: RecurringMeetingCreate):
        """Validate that attribute IDs exist"""
        
        # Get the group ID for RECURRING_MEETING
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
                    Attribute.group_id == group.id
                )
            )
            recurrence_type = result.scalar_one_or_none()
            if not recurrence_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid recurrence_type_id: {meeting_data.recurrence_type_id}"
                )
        
        # Validate recurrence days (convert to strings for comparison)
        if meeting_data.recurrence_days:
            for day_id in meeting_data.recurrence_days:
                # Convert to UUID if it's a string
                try:
                    day_uuid = uuid.UUID(str(day_id)) if isinstance(day_id, str) else day_id
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid UUID format for recurrence day: {day_id}"
                    )
                
                result = await self.db.execute(
                    select(Attribute).where(
                        Attribute.id == day_uuid,
                        Attribute.group_id == group.id
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
                    Attribute.group_id == group.id
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
                    Attribute.group_id == group.id
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
                    Attribute.group_id == group.id
                )
            )
            status_attr = result.scalar_one_or_none()
            if not status_attr:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status_id: {meeting_data.status_id}"
                )
    
    async def _validate_location(self, location_id: Optional[uuid.UUID]) -> bool:
        """Validate that location exists"""
        if not location_id:
            return True
        
        result = await self.db.execute(
            select(Location).where(Location.id == location_id)
        )
        location = result.scalar_one_or_none()
        if not location:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Location ID {location_id} does not exist"
            )
        return True
    
    async def create_recurring_meeting(self, meeting_data: RecurringMeetingCreate, user_id: uuid.UUID) -> RecurringMeeting:
        """Create a new recurring meeting"""
        
        try:
            # Validate attribute IDs
            await self._validate_recurrence_attributes(meeting_data)
            
            # Validate location if provided
            if meeting_data.location_id:
                await self._validate_location(meeting_data.location_id)
            
            # Calculate duration if not provided
            duration_minutes = meeting_data.duration_minutes
            if not duration_minutes and meeting_data.start_time and meeting_data.end_time:
                # Ensure both datetimes are naive for calculation
                start_time = ensure_naive_datetime(meeting_data.start_time)
                end_time = ensure_naive_datetime(meeting_data.end_time)
                if start_time and end_time:
                    delta = end_time - start_time
                    duration_minutes = int(delta.total_seconds() / 60)
            
            # Convert UUIDs to strings for JSON fields (ensure JSON serializable)
            recurrence_days_str = None
            if meeting_data.recurrence_days:
                recurrence_days_str = [str(day_id) for day_id in meeting_data.recurrence_days]
            
            default_participants_str = None
            if meeting_data.default_participant_ids:
                default_participants_str = [str(pid) for pid in meeting_data.default_participant_ids]
            
            # === FIX: Ensure all datetimes are naive ===
            now = get_utc_now()
            start_time = ensure_naive_datetime(meeting_data.start_time)
            end_time = ensure_naive_datetime(meeting_data.end_time)
            recurrence_end_date = ensure_naive_datetime(meeting_data.recurrence_end_date)
            
            # Create recurring meeting record with naive datetimes
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
                recurrence_end_date=recurrence_end_date,
                recurrence_max_occurrences=meeting_data.recurrence_max_occurrences,
                recurrence_end_after_occurrences=meeting_data.recurrence_end_after_occurrences,
                meeting_template_id=meeting_data.meeting_template_id,
                start_time=start_time,
                end_time=end_time,
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
                visibility=meeting_data.visibility,
                restricted_department_id=meeting_data.restricted_department_id,
                created_by_id=user_id,
                created_at=now,
                updated_at=now
            )
            
            self.db.add(db_meeting)
            await self.db.commit()
            await self.db.refresh(db_meeting)
            
            # Generate first occurrence with naive datetimes
            await self._generate_first_occurrence(db_meeting)
            
            # Refresh again after generating first occurrence
            await self.db.refresh(db_meeting)
            
            logger.info(f"Created recurring meeting {db_meeting.id} with title '{db_meeting.title}'")
            return db_meeting
            
        except HTTPException:
            raise
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating recurring meeting: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create recurring meeting: {str(e)}"
            )
    
    async def _generate_first_occurrence(self, recurring: RecurringMeeting):
        """Generate the first meeting from the recurring template"""
        try:
            # Get a valid meeting status from attributes table
            status_id = await self._get_default_meeting_status()
            
            # === FIX: Ensure we have naive datetime objects ===
            now = get_utc_now()
            
            if not recurring.start_time:
                logger.warning(f"Recurring meeting {recurring.id} has no start_time, using current time")
                start_time = now
            else:
                start_time = ensure_naive_datetime(recurring.start_time) or now
            
            # Calculate end time if not provided
            end_time = ensure_naive_datetime(recurring.end_time)
            if not end_time:
                end_time = start_time + timedelta(hours=1)
                logger.info(f"Auto-calculated end_time for first occurrence: {end_time}")
            
            # Ensure end_time is after start_time
            if end_time <= start_time:
                end_time = start_time + timedelta(hours=1)
                logger.warning(f"Fixed invalid end_time, set to: {end_time}")
            
            # Create the first meeting occurrence with naive datetimes
            first_meeting = Meeting(
                id=uuid.uuid4(),
                title=recurring.title,
                description=recurring.description,
                meeting_date=start_time.date(),
                start_time=start_time,
                end_time=end_time,
                duration_minutes=recurring.duration_minutes or 60,
                location_id=recurring.location_id,
                location_text=recurring.location_text,
                platform=recurring.platform,
                meeting_link=recurring.meeting_link,
                chairperson_id=recurring.chairperson_id,
                secretary_id=recurring.secretary_id,
                facilitator=recurring.facilitator,
                visibility=getattr(recurring, "visibility", "open"),
                restricted_department_id=getattr(recurring, "restricted_department_id", None),
                department_id=getattr(recurring, "department_id", None),
                agenda=recurring.agenda,
                status_id=status_id,
                is_recurring=True,
                recurring_meeting_id=recurring.id,
                occurrence_number=1,
                created_by_id=recurring.created_by_id,
                created_at=now,
                updated_at=now,
                is_active=True,
                is_deleted=False
            )
            self.db.add(first_meeting)
            await self.db.flush()
            
            # Create occurrence record with naive datetime
            occurrence = RecurringMeetingOccurrence(
                id=uuid.uuid4(),
                recurring_meeting_id=recurring.id,
                meeting_id=first_meeting.id,
                occurrence_number=1,
                scheduled_date=start_time,
                status="scheduled",
                created_at=now,
                updated_at=now
            )
            self.db.add(occurrence)
            await self.db.flush()
            await self._seed_participants(recurring, first_meeting)
            
            # Update recurring meeting with naive datetimes
            recurring.occurrences_count = 1
            recurring.total_occurrences_generated = 1
            recurring.last_occurrence_date = ensure_naive_datetime(start_time)
            
            # Calculate next occurrence if possible
            try:
                next_date = await self._calculate_next_occurrence_date(recurring, start_time)
                if next_date:
                    recurring.next_occurrence_date = ensure_naive_datetime(next_date)
            except Exception as e:
                logger.warning(f"Could not calculate next occurrence date: {e}")
            
            recurring.updated_at = now
            
            await self.db.commit()
            logger.info(f"Generated first occurrence {first_meeting.id} for recurring meeting {recurring.id}")
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error generating first occurrence: {e}", exc_info=True)
            raise
    
    async def _get_default_meeting_status(self) -> Optional[uuid.UUID]:
        """Get default meeting status UUID"""
        # Try to get 'scheduled' status first
        result = await self.db.execute(
            select(Attribute).where(
                Attribute.code == "MEETING_STATUS_SCHEDULED",
                Attribute.is_active == True
            )
        )
        status_attr = result.scalar_one_or_none()
        
        # If not found, try any meeting status
        if not status_attr:
            result = await self.db.execute(
                select(Attribute).where(
                    Attribute.group.has(code="MEETING_STATUS"),
                    Attribute.is_active == True
                ).limit(1)
            )
            status_attr = result.scalar_one_or_none()
        
        # If still not found, try RECURRING_STATUS_ACTIVE
        if not status_attr:
            result = await self.db.execute(
                select(Attribute).where(Attribute.code == "RECURRING_STATUS_ACTIVE")
            )
            status_attr = result.scalar_one_or_none()
        
        return status_attr.id if status_attr else None
    
    async def _calculate_next_occurrence_date(self, recurring: RecurringMeeting, last_date: datetime) -> Optional[datetime]:
        """Calculate the next occurrence date based on recurrence pattern"""
        if not recurring.recurrence_type_id:
            return None
        
        # Ensure last_date is naive
        last_date = ensure_naive_datetime(last_date)
        if not last_date:
            return None
        
        # Get recurrence type
        result = await self.db.execute(
            select(Attribute).where(Attribute.id == recurring.recurrence_type_id)
        )
        recurrence_attr = result.scalar_one_or_none()
        
        if not recurrence_attr or not recurrence_attr.extra_metadata:
            return None
        
        # Parse metadata
        metadata = recurrence_attr.extra_metadata
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except:
                metadata = {}
        
        recurrence_type = metadata.get('value', 'weekly')
        interval = recurring.recurrence_interval or 1
        
        # Calculate next date based on type
        if recurrence_type == "daily":
            return ensure_naive_datetime(last_date + timedelta(days=interval))
        elif recurrence_type == "weekly":
            return ensure_naive_datetime(last_date + timedelta(weeks=interval))
        elif recurrence_type == "biweekly":
            return ensure_naive_datetime(last_date + timedelta(weeks=interval * 2))
        elif recurrence_type == "monthly":
            # Add month(s)
            month = last_date.month + interval
            year = last_date.year
            while month > 12:
                month -= 12
                year += 1
            try:
                result = last_date.replace(year=year, month=month)
                return ensure_naive_datetime(result)
            except ValueError:
                # Handle invalid day (e.g., Jan 31 -> Feb 28)
                result = last_date.replace(year=year, month=month, day=28)
                return ensure_naive_datetime(result)
        elif recurrence_type == "quarterly":
            return ensure_naive_datetime(last_date + timedelta(days=90 * interval))
        elif recurrence_type == "yearly":
            try:
                result = last_date.replace(year=last_date.year + interval)
                return ensure_naive_datetime(result)
            except ValueError:
                # Handle Feb 29 on non-leap year
                result = last_date.replace(year=last_date.year + interval, day=28)
                return ensure_naive_datetime(result)
        
        return None
    
    async def get_recurring_meetings(
        self, 
        skip: int = 0, 
        limit: int = 100,
        status_id: Optional[uuid.UUID] = None,
        recurrence_type_id: Optional[uuid.UUID] = None,
        include_deleted: bool = False
    ) -> List[RecurringMeeting]:
        """Get all recurring meetings"""
        
        query = select(RecurringMeeting)
        
        if not include_deleted:
            query = query.where(RecurringMeeting.is_deleted == False)
        
        # Eager load relationships
        query = query.options(
            selectinload(RecurringMeeting.recurrence_type),
            selectinload(RecurringMeeting.status),
            selectinload(RecurringMeeting.location),
            selectinload(RecurringMeeting.created_by)
        )
        
        if status_id:
            query = query.where(RecurringMeeting.status_id == status_id)
        if recurrence_type_id:
            query = query.where(RecurringMeeting.recurrence_type_id == recurrence_type_id)
        
        query = query.offset(skip).limit(limit).order_by(desc(RecurringMeeting.created_at))
        
        result = await self.db.execute(query)
        meetings = result.unique().scalars().all()
        
        logger.info(f"Retrieved {len(meetings)} recurring meetings")
        return meetings
    
    async def get_recurring_meeting(self, meeting_id: uuid.UUID) -> Optional[RecurringMeeting]:
        """Get a single recurring meeting with all relationships"""
        try:
            query = select(RecurringMeeting).where(
                RecurringMeeting.id == meeting_id,
                RecurringMeeting.is_deleted == False
            ).options(
                selectinload(RecurringMeeting.recurrence_type),
                selectinload(RecurringMeeting.status),
                selectinload(RecurringMeeting.location),
                selectinload(RecurringMeeting.created_by),
                selectinload(RecurringMeeting.occurrences).selectinload(RecurringMeetingOccurrence.meeting)
            )
            result = await self.db.execute(query)
            meeting = result.unique().scalar_one_or_none()
            
            if not meeting:
                logger.warning(f"Recurring meeting {meeting_id} not found")
            else:
                logger.info(f"Retrieved recurring meeting {meeting_id}")
            
            return meeting
        except Exception as e:
            logger.error(f"Error getting recurring meeting {meeting_id}: {e}", exc_info=True)
            return None
    
    async def update_recurring_meeting(
        self, 
        meeting_id: uuid.UUID, 
        meeting_data: RecurringMeetingUpdate
    ) -> Optional[RecurringMeeting]:
        """Update a recurring meeting"""
        try:
            db_meeting = await self.get_recurring_meeting(meeting_id)
            if not db_meeting:
                logger.warning(f"Recurring meeting {meeting_id} not found for update")
                return None
            
            # Get update data (exclude unset fields)
            update_dict = meeting_data.dict(exclude_unset=True)
            
            # Convert UUIDs to strings for JSON fields
            if 'recurrence_days' in update_dict and update_dict['recurrence_days']:
                update_dict['recurrence_days'] = [str(day) for day in update_dict['recurrence_days']]
            
            if 'default_participant_ids' in update_dict and update_dict['default_participant_ids']:
                update_dict['default_participant_ids'] = [str(pid) for pid in update_dict['default_participant_ids']]
            
            # === FIX: Ensure datetime fields are naive ===
            datetime_fields = ['start_time', 'end_time', 'recurrence_end_date']
            for field in datetime_fields:
                if field in update_dict and update_dict[field]:
                    update_dict[field] = ensure_naive_datetime(update_dict[field])
            
            # Validate location if being updated
            if 'location_id' in update_dict and update_dict['location_id']:
                await self._validate_location(update_dict['location_id'])
            
            # Update fields
            for field, value in update_dict.items():
                setattr(db_meeting, field, value)
            
            db_meeting.updated_at = get_utc_now()
            
            await self.db.commit()
            await self.db.refresh(db_meeting)
            
            logger.info(f"Updated recurring meeting {meeting_id}")
            return db_meeting
            
        except HTTPException:
            raise
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating recurring meeting {meeting_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update recurring meeting: {str(e)}"
            )
    
    async def delete_recurring_meeting(
        self, 
        meeting_id: uuid.UUID, 
        delete_occurrences: bool = False
    ) -> bool:
        """Soft delete a recurring meeting"""
        try:
            db_meeting = await self.get_recurring_meeting(meeting_id)
            if not db_meeting:
                logger.warning(f"Recurring meeting {meeting_id} not found for deletion")
                return False
            
            now = get_utc_now()
            db_meeting.is_deleted = True
            db_meeting.deleted_at = now
            db_meeting.updated_at = now
            
            if delete_occurrences:
                # Cancel all occurrences
                for occurrence in db_meeting.occurrences:
                    occurrence.status = "cancelled"
                    occurrence.updated_at = now
                    
                    if occurrence.meeting:
                        occurrence.meeting.is_deleted = True
                        occurrence.meeting.deleted_at = now
                        occurrence.meeting.updated_at = now
            
            await self.db.commit()
            logger.info(f"Deleted recurring meeting {meeting_id} (delete_occurrences={delete_occurrences})")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting recurring meeting {meeting_id}: {e}", exc_info=True)
            return False
    
    async def generate_occurrences(
        self, 
        meeting_id: uuid.UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        max_occurrences: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Generate future occurrences"""
        # Implementation would go here
        return []
    
    async def preview_occurrences(self, request: PreviewOccurrencesRequest) -> List[datetime]:
        """Preview occurrence dates"""
        dates = []
        
        # === FIX: Ensure start_date is naive ===
        current = ensure_naive_datetime(request.start_date)
        if not current:
            current = get_utc_now()
        
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
        
        max_preview = min(request.max_occurrences, 20)  # Limit preview to 20 dates
        
        for i in range(max_preview):
            if i > 0:  # Don't add the start date as an occurrence
                if recurrence_type == "daily":
                    current = ensure_naive_datetime(current + timedelta(days=request.recurrence_interval))
                elif recurrence_type == "weekly":
                    current = ensure_naive_datetime(current + timedelta(weeks=request.recurrence_interval))
                elif recurrence_type == "biweekly":
                    current = ensure_naive_datetime(current + timedelta(weeks=request.recurrence_interval * 2))
                elif recurrence_type == "monthly":
                    month = current.month + request.recurrence_interval
                    year = current.year
                    while month > 12:
                        month -= 12
                        year += 1
                    try:
                        current = ensure_naive_datetime(current.replace(year=year, month=month))
                    except ValueError:
                        current = ensure_naive_datetime(current.replace(year=year, month=month, day=28))
                elif recurrence_type == "quarterly":
                    current = ensure_naive_datetime(current + timedelta(days=90 * request.recurrence_interval))
                elif recurrence_type == "yearly":
                    try:
                        current = ensure_naive_datetime(current.replace(year=current.year + request.recurrence_interval))
                    except ValueError:
                        current = ensure_naive_datetime(current.replace(year=current.year + request.recurrence_interval, day=28))
            
            if current:
                dates.append(current)
        
        return dates[:request.max_occurrences]
    
    async def get_occurrences_by_meeting(
        self, 
        recurring_meeting_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50
    ) -> List[Meeting]:
        """Get all meeting occurrences for a recurring meeting"""
        try:
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
            meetings = result.unique().scalars().all()
            
            logger.info(f"Retrieved {len(meetings)} occurrences for recurring meeting {recurring_meeting_id}")
            return meetings
            
        except Exception as e:
            logger.error(f"Error getting occurrences for recurring meeting {recurring_meeting_id}: {e}", exc_info=True)
            return []
    
    async def get_occurrence_records_by_meeting(
        self, 
        recurring_meeting_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50
    ) -> List[RecurringMeetingOccurrence]:
        """Get all occurrence records for a recurring meeting"""
        try:
            query = select(RecurringMeetingOccurrence).where(
                RecurringMeetingOccurrence.recurring_meeting_id == recurring_meeting_id
            ).options(
                selectinload(RecurringMeetingOccurrence.meeting)
            ).order_by(desc(RecurringMeetingOccurrence.scheduled_date)).offset(skip).limit(limit)
            
            result = await self.db.execute(query)
            occurrences = result.unique().scalars().all()
            
            logger.info(f"Retrieved {len(occurrences)} occurrence records for recurring meeting {recurring_meeting_id}")
            return occurrences
            
        except Exception as e:
            logger.error(f"Error getting occurrence records for recurring meeting {recurring_meeting_id}: {e}", exc_info=True)
            return []
    
    # ---- ONE code path for the Generate buttons and the scheduler ----------

    _PARTICIPANT_COPY_FIELDS = (
        "user_id", "name", "email", "telephone", "title",
        "organization", "is_chairperson", "is_secretary",
    )

    @staticmethod
    def _limit_reached(recurring: RecurringMeeting, when: datetime) -> bool:
        end = ensure_naive_datetime(recurring.recurrence_end_date)
        if end and when.date() > end.date():
            return True
        caps = [c for c in (recurring.recurrence_max_occurrences,
                            recurring.recurrence_end_after_occurrences) if c]
        return bool(caps) and (recurring.total_occurrences_generated or 0) >= min(caps)

    async def _date_taken(self, recurring_id: uuid.UUID, when: datetime) -> bool:
        result = await self.db.execute(
            select(RecurringMeetingOccurrence.id).where(
                RecurringMeetingOccurrence.recurring_meeting_id == recurring_id,
                RecurringMeetingOccurrence.scheduled_date == when,
                RecurringMeetingOccurrence.status != "cancelled",
            ).limit(1)
        )
        return result.first() is not None

    async def create_next_occurrence(
        self,
        recurring_meeting_id: uuid.UUID,
        *,
        automatic: bool = False,
        target_date: Optional[datetime] = None,
    ) -> Optional[Meeting]:
        """
        Create the next occurrence of a series. Returns the new Meeting, or None
        when nothing was created.

        automatic=True (scheduler): does nothing until the latest generated
        occurrence has started, skips a series another worker is already
        processing, and skips dates that passed while nothing was running.
        automatic=False (Generate buttons): always creates the next one.
        """
        now = get_utc_now()

        stmt = (
            select(RecurringMeeting)
            .where(RecurringMeeting.id == recurring_meeting_id,
                   RecurringMeeting.is_deleted == False)  # noqa: E712
            .with_for_update(of=RecurringMeeting, skip_locked=automatic)
            .execution_options(populate_existing=True)
        )
        recurring = (await self.db.execute(stmt)).unique().scalar_one_or_none()
        if recurring is None:
            await self.db.rollback()
            return None

        last = ensure_naive_datetime(recurring.last_occurrence_date)
        if automatic and last and last > now:
            await self.db.rollback()
            return None

        # ---- which date? ----
        if target_date:
            when = ensure_naive_datetime(target_date)
        else:
            when = ensure_naive_datetime(recurring.next_occurrence_date)
            if when is None:
                base = last or ensure_naive_datetime(recurring.start_time)
                when = await self._calculate_next_occurrence_date(recurring, base) if base else None

            # Never create the same date twice (this also repairs series hit by
            # the old bug), and in automatic mode skip dates already in the past.
            for _ in range(1000):
                if when is None:
                    break
                if (automatic and when <= now) or await self._date_taken(recurring.id, when):
                    when = await self._calculate_next_occurrence_date(recurring, when)
                else:
                    break

        if when is None or (not target_date and self._limit_reached(recurring, when)):
            recurring.next_occurrence_date = None   # series finished: scheduler stops looking at it
            recurring.updated_at = now
            await self.db.commit()
            return None

        # ---- build the meeting ----
        template_start = ensure_naive_datetime(recurring.start_time)
        template_end = ensure_naive_datetime(recurring.end_time)
        if recurring.duration_minutes:
            duration = timedelta(minutes=recurring.duration_minutes)
        elif template_start and template_end and template_end > template_start:
            duration = template_end - template_start
        else:
            duration = timedelta(hours=1)

        highest = (await self.db.execute(
            select(func.max(Meeting.occurrence_number)).where(
                Meeting.recurring_meeting_id == recurring.id)
        )).scalar() or 0
        number = max(highest, recurring.total_occurrences_generated or 0) + 1

        meeting = Meeting(
            id=uuid.uuid4(),
            title=recurring.title,
            description=recurring.description,
            department_id=getattr(recurring, "department_id", None),
            meeting_date=when.date(),
            start_time=when,
            end_time=when + duration,
            duration_minutes=int(duration.total_seconds() // 60),
            location_id=recurring.location_id,
            location_text=recurring.location_text,
            platform=recurring.platform,
            meeting_link=recurring.meeting_link,
            chairperson_id=recurring.chairperson_id,
            secretary_id=recurring.secretary_id,
            facilitator=recurring.facilitator,
            agenda=recurring.agenda,
            visibility=getattr(recurring, "visibility", "open"),
            restricted_department_id=getattr(recurring, "restricted_department_id", None),
            status_id=await self._get_default_meeting_status(),
            is_recurring=True,
            recurring_meeting_id=recurring.id,
            occurrence_number=number,
            created_by_id=recurring.created_by_id,
            created_at=now,
            updated_at=now,
            is_active=True,
            is_deleted=False,
        )
        self.db.add(meeting)
        await self.db.flush()
        self.db.add(RecurringMeetingOccurrence(
            id=uuid.uuid4(),
            recurring_meeting_id=recurring.id,
            meeting_id=meeting.id,
            occurrence_number=number,
            scheduled_date=when,
            status="scheduled",
            created_at=now,
            updated_at=now,
        ))
        copied = await self._seed_participants(recurring, meeting)

        # ---- move the pointers forward ----
        newest = max(d for d in (last, when) if d)
        recurring.last_occurrence_date = newest
        recurring.total_occurrences_generated = (recurring.total_occurrences_generated or 0) + 1
        recurring.occurrences_count = (recurring.occurrences_count or 0) + 1
        upcoming = await self._calculate_next_occurrence_date(recurring, newest)
        if upcoming is not None and self._limit_reached(recurring, upcoming):
            upcoming = None
        recurring.next_occurrence_date = upcoming
        recurring.updated_at = now

        await self.db.commit()
        await self.db.refresh(meeting)
        logger.info("Generated occurrence #%s (%s) for recurring meeting %s with %s participant(s)",
                    number, when, recurring.id, copied)
        return meeting

    async def _seed_participants(self, recurring: RecurringMeeting, meeting: Meeting) -> int:
        """
        Give a new occurrence its participants: the previous occurrence's list,
        or, if that has none (the first one), the series' default participants
        plus its chairperson and secretary. Everyone starts as 'pending'.
        Runs in a savepoint and never raises, so a problem here can never stop
        the meeting from being created.
        """
        try:
            async with self.db.begin_nested():
                known = {a.key for a in sa_inspect(MeetingParticipant).column_attrs}

                previous = (await self.db.execute(
                    select(Meeting)
                    .where(Meeting.recurring_meeting_id == recurring.id,
                           Meeting.id != meeting.id,
                           Meeting.is_deleted == False)  # noqa: E712
                    .options(selectinload(Meeting.participants))
                    .order_by(desc(Meeting.start_time))
                    .limit(1)
                )).unique().scalar_one_or_none()

                if previous is not None and previous.participants:
                    rows = [{f: getattr(p, f, None) for f in self._PARTICIPANT_COPY_FIELDS}
                            for p in previous.participants]
                else:
                    rows = await self._default_participant_rows(recurring)

                for row in rows:
                    values = {k: v for k, v in row.items() if k in known}
                    if "id" in known:
                        values["id"] = uuid.uuid4()
                    if "attendance_status" in known:
                        values["attendance_status"] = "pending"
                    self.db.add(MeetingParticipant(meeting_id=meeting.id, **values))
                await self.db.flush()
                return len(rows)
        except Exception:
            logger.warning("Participants were not copied to occurrence %s", meeting.id, exc_info=True)
            return 0

    async def _default_participant_rows(self, recurring: RecurringMeeting) -> list:
        ids = []
        for raw in (recurring.default_participant_ids or []):
            try:
                ids.append(uuid.UUID(str(raw)))
            except ValueError:
                continue
        for extra in (recurring.chairperson_id, recurring.secretary_id):
            if extra and extra not in ids:
                ids.append(extra)
        if not ids:
            return []

        users = (await self.db.execute(select(User).where(User.id.in_(ids)))).scalars().all()
        by_id = {u.id: u for u in users}
        rows = []
        for uid in ids:
            u = by_id.get(uid)
            if not u:
                continue
            name = (getattr(u, "full_name", None)
                    or " ".join(filter(None, [getattr(u, "first_name", None), getattr(u, "last_name", None)]))
                    or getattr(u, "username", None))
            rows.append({
                "user_id": u.id, "name": name, "email": getattr(u, "email", None),
                "telephone": getattr(u, "phone", None), "title": None, "organization": None,
                "is_chairperson": uid == recurring.chairperson_id,
                "is_secretary": uid == recurring.secretary_id,
            })
        return rows

    async def generate_on_demand_occurrence(
        self,
        recurring_meeting_id: uuid.UUID,
        target_date: Optional[datetime] = None
    ) -> Optional[Meeting]:
        """Generate one occurrence now. Same code path as the scheduler."""
        try:
            return await self.create_next_occurrence(recurring_meeting_id, target_date=target_date)
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error generating on-demand occurrence: {e}", exc_info=True)
            return None

# ==================== DEPENDENCY ====================

# Singleton instance
recurring_meeting_service = None

async def get_recurring_meeting_service(db: AsyncSession) -> RecurringMeetingService:
    """Dependency to get recurring meeting service instance"""
    return RecurringMeetingService(db)