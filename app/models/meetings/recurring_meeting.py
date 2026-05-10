# app/models/recurring_meeting.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, JSON, Index
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.db.base_class import Base
import uuid
from app.db.types import UUID as CustomUUID


class RecurringMeeting(Base):
    __tablename__ = "recurring_meetings"

    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # ==================== Basic Information ====================
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    # ==================== Department & Visibility Fields ====================
    department_id = Column(CustomUUID, ForeignKey("organization_nodes.id", ondelete="SET NULL"), nullable=True)
    visibility = Column(String(50), nullable=False, default="open")
    restricted_department_id = Column(CustomUUID, ForeignKey("organization_nodes.id", ondelete="SET NULL"), nullable=True)
    
    # ==================== Recurrence Settings ====================
    recurrence_type_id = Column(CustomUUID, ForeignKey("attributes.id", ondelete="RESTRICT"), nullable=False)
    recurrence_interval = Column(Integer, default=1)
    recurrence_days = Column(JSON, nullable=True)  # Array of attribute UUIDs
    recurrence_day_of_month = Column(Integer, nullable=True)
    recurrence_week_of_month_id = Column(CustomUUID, ForeignKey("attributes.id", ondelete="RESTRICT"), nullable=True)
    recurrence_day_of_week_id = Column(CustomUUID, ForeignKey("attributes.id", ondelete="RESTRICT"), nullable=True)
    recurrence_end_date = Column(DateTime, nullable=True)
    recurrence_max_occurrences = Column(Integer, nullable=True)
    recurrence_end_after_occurrences = Column(Integer, nullable=True)
    
    # ==================== Meeting Template ====================
    meeting_template_id = Column(CustomUUID, ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True)
    
    # ==================== Timing ====================
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    
    # ==================== Location ====================
    location_id = Column(CustomUUID, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    location_text = Column(String(500), nullable=True)
    platform = Column(String(50), default="physical")
    meeting_link = Column(String(500), nullable=True)
    
    # ==================== Leadership ====================
    chairperson_id = Column(CustomUUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    secretary_id = Column(CustomUUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    facilitator = Column(String(255), nullable=True)
    
    # ==================== Participants ====================
    default_participant_ids = Column(JSON, nullable=True)  # Array of user UUIDs
    
    # ==================== Content ====================
    agenda = Column(Text, nullable=True)
    additional_info = Column(JSON, nullable=True)
    
    # ==================== Status ====================
    status_id = Column(CustomUUID, ForeignKey("attributes.id", ondelete="RESTRICT"), nullable=False)
    
    # ==================== Tracking ====================
    last_occurrence_date = Column(DateTime, nullable=True)
    next_occurrence_date = Column(DateTime, nullable=True)
    occurrences_count = Column(Integer, default=0)
    total_occurrences_generated = Column(Integer, default=0)
    
    # ==================== Audit ====================
    created_by_id = Column(CustomUUID, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # ==================== Soft Delete ====================
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    
    # ==================== Relationships ====================
    
    # Department relationships
    department = relationship(
        "OrganizationNode",
        foreign_keys=[department_id],
        lazy="joined",
        backref="recurring_meetings_as_department"
    )
    restricted_department = relationship(
        "OrganizationNode",
        foreign_keys=[restricted_department_id],
        lazy="joined",
        backref="recurring_meetings_as_restricted"
    )
    
    # Attribute relationships
    recurrence_type = relationship(
        "Attribute", 
        foreign_keys=[recurrence_type_id], 
        lazy="joined",
        backref="recurring_meetings_as_type"
    )
    recurrence_week_of_month = relationship(
        "Attribute", 
        foreign_keys=[recurrence_week_of_month_id], 
        lazy="joined"
    )
    recurrence_day_of_week = relationship(
        "Attribute", 
        foreign_keys=[recurrence_day_of_week_id], 
        lazy="joined"
    )
    status = relationship(
        "Attribute", 
        foreign_keys=[status_id], 
        lazy="joined",
        backref="recurring_meetings_as_status"
    )
    
    # Meeting template
    meeting_template = relationship(
        "Meeting", 
        foreign_keys=[meeting_template_id], 
        lazy="joined",
        remote_side="Meeting.id"
    )
    
    # Location
    location = relationship(
        "Location", 
        foreign_keys=[location_id], 
        lazy="joined"
    )
    
    # User relationships
    chairperson = relationship(
        "User", 
        foreign_keys=[chairperson_id], 
        lazy="joined",
        backref="chaired_recurring_meetings"
    )
    secretary = relationship(
        "User", 
        foreign_keys=[secretary_id], 
        lazy="joined",
        backref="secretary_recurring_meetings"
    )
    created_by = relationship(
        "User", 
        foreign_keys=[created_by_id], 
        lazy="joined",
        backref="created_recurring_meetings"
    )
    
    # Occurrences
    occurrences = relationship(
        "RecurringMeetingOccurrence", 
        back_populates="recurring_meeting", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    # Meetings generated from this recurring meeting
    meetings = relationship(
        "Meeting",
        foreign_keys="Meeting.recurring_meeting_id",
        back_populates="recurring_meeting",
        lazy="selectin",
        cascade="all, delete-orphan",
        viewonly=False
    )
    
    # ==================== Indexes ====================
    __table_args__ = (
        Index("ix_recurring_meetings_status_next_date", "status_id", "next_occurrence_date"),
        Index("ix_recurring_meetings_created_by", "created_by_id"),
        Index("ix_recurring_meetings_recurrence_type", "recurrence_type_id"),
        Index("ix_recurring_meetings_is_deleted", "is_deleted"),
        Index("ix_recurring_meetings_created_at", "created_at"),
        Index("ix_recurring_meetings_next_occurrence", "next_occurrence_date"),
        Index("ix_recurring_meetings_department", "department_id"),
        Index("ix_recurring_meetings_visibility", "visibility"),
        Index("ix_recurring_meetings_restricted_department", "restricted_department_id"),
    )
    
    # ==================== Properties ====================
    
    @property
    def recurrence_type_value(self) -> Optional[str]:
        """Get recurrence type value from attribute"""
        if self.recurrence_type and self.recurrence_type.extra_metadata:
            import json
            metadata = self.recurrence_type.extra_metadata
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    pass
            return metadata.get('value')
        return None
    
    @property
    def status_value(self) -> Optional[str]:
        """Get status value from attribute"""
        if self.status and self.status.extra_metadata:
            import json
            metadata = self.status.extra_metadata
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    pass
            return metadata.get('value')
        return None
    
    @property
    def is_active(self) -> bool:
        """Check if recurring meeting is active"""
        return self.status_value == 'active' and not self.is_deleted
    
    @property
    def department_name(self) -> Optional[str]:
        """Get department name from relationship"""
        return self.department.name if self.department else None
    
    @property
    def restricted_department_name(self) -> Optional[str]:
        """Get restricted department name from relationship"""
        return self.restricted_department.name if self.restricted_department else None
    
    @property
    def visibility_display(self) -> str:
        """Get human-readable visibility"""
        visibility_map = {
            'open': 'Open to All',
            'department': 'Department Restricted',
            'private': 'Private'
        }
        return visibility_map.get(self.visibility, 'Open to All')
    
    @property
    def recurrence_description(self) -> str:
        """Get human-readable recurrence description"""
        type_value = self.recurrence_type_value
        interval = self.recurrence_interval
        
        if type_value == 'daily':
            return f"Every {interval} day(s)"
        elif type_value == 'weekly':
            days = self.get_recurrence_days_values()
            days_str = ', '.join(days) if days else 'selected days'
            return f"Every {interval} week(s) on {days_str}"
        elif type_value == 'monthly':
            if self.recurrence_day_of_month:
                day_suffix = 'th'
                if self.recurrence_day_of_month == 1:
                    day_suffix = 'st'
                elif self.recurrence_day_of_month == 2:
                    day_suffix = 'nd'
                elif self.recurrence_day_of_month == 3:
                    day_suffix = 'rd'
                return f"Every {interval} month(s) on the {self.recurrence_day_of_month}{day_suffix} day"
            elif self.recurrence_week_of_month_id and self.recurrence_day_of_week_id:
                week = self.get_week_of_month_value() or 'selected'
                day = self.get_day_of_week_value() or 'selected day'
                return f"Every {interval} month(s) on the {week} {day}"
            return f"Every {interval} month(s)"
        elif type_value == 'yearly':
            return f"Every {interval} year(s)"
        else:
            return f"Custom pattern"
    
    # ==================== Methods ====================
    
    def get_recurrence_days_values(self) -> List[str]:
        """Get recurrence day values as strings"""
        if not self.recurrence_days:
            return []
        # This would need to fetch attribute values from the database
        # For now, return the stored values
        return self.recurrence_days if isinstance(self.recurrence_days, list) else []
    
    def get_week_of_month_value(self) -> Optional[str]:
        """Get week of month value from attribute"""
        if self.recurrence_week_of_month and self.recurrence_week_of_month.extra_metadata:
            import json
            metadata = self.recurrence_week_of_month.extra_metadata
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    pass
            return metadata.get('value')
        return None
    
    def get_day_of_week_value(self) -> Optional[str]:
        """Get day of week value from attribute"""
        if self.recurrence_day_of_week and self.recurrence_day_of_week.extra_metadata:
            import json
            metadata = self.recurrence_day_of_week.extra_metadata
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    pass
            return metadata.get('value')
        return None
    
    def get_next_occurrence_date(self) -> Optional[datetime]:
        """Calculate next occurrence date based on pattern"""
        if not self.start_time:
            return None
        
        recurrence_type = self.recurrence_type_value
        interval = self.recurrence_interval or 1
        current = self.next_occurrence_date or self.start_time
        
        from datetime import timedelta
        
        if recurrence_type == 'daily':
            return current + timedelta(days=interval)
        elif recurrence_type == 'weekly':
            return current + timedelta(weeks=interval)
        elif recurrence_type == 'monthly':
            # Add month
            month = current.month + interval
            year = current.year
            while month > 12:
                month -= 12
                year += 1
            try:
                return current.replace(year=year, month=month)
            except ValueError:
                return current.replace(year=year, month=month, day=28)
        elif recurrence_type == 'yearly':
            return current.replace(year=current.year + interval)
        else:
            return None
    
    def increment_occurrence_count(self):
        """Increment occurrence count"""
        self.occurrences_count = len(self.occurrences) if self.occurrences else 0
        self.total_occurrences_generated = self.occurrences_count
    
    def update_next_occurrence(self):
        """Update next occurrence date"""
        self.next_occurrence_date = self.get_next_occurrence_date()
        if self.occurrences:
            self.last_occurrence_date = max(
                (occ.scheduled_date for occ in self.occurrences if occ.scheduled_date),
                default=None
            )
    
    def can_generate_more(self) -> bool:
        """Check if more occurrences can be generated"""
        if self.is_deleted or self.status_value != 'active':
            return False
        if self.recurrence_end_date and self.recurrence_end_date < datetime.now():
            return False
        if self.recurrence_max_occurrences and self.total_occurrences_generated >= self.recurrence_max_occurrences:
            return False
        return True
    
    def to_dict(self, include_occurrences: bool = False) -> Dict[str, Any]:
        """Convert to dictionary"""
        result = {
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            # Department fields
            "department_id": str(self.department_id) if self.department_id else None,
            "department_name": self.department_name,
            "visibility": self.visibility,
            "visibility_display": self.visibility_display,
            "restricted_department_id": str(self.restricted_department_id) if self.restricted_department_id else None,
            "restricted_department_name": self.restricted_department_name,
            # Recurrence
            "recurrence_type": {
                "id": str(self.recurrence_type_id),
                "value": self.recurrence_type_value
            },
            "recurrence_interval": self.recurrence_interval,
            "recurrence_days": self.recurrence_days,
            "recurrence_day_of_month": self.recurrence_day_of_month,
            "recurrence_end_date": self.recurrence_end_date.isoformat() if self.recurrence_end_date else None,
            "recurrence_max_occurrences": self.recurrence_max_occurrences,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_minutes": self.duration_minutes,
            "location_id": str(self.location_id) if self.location_id else None,
            "location_text": self.location_text,
            "platform": self.platform,
            "meeting_link": self.meeting_link,
            "status": {
                "id": str(self.status_id),
                "value": self.status_value
            },
            "is_active": self.is_active,
            "last_occurrence_date": self.last_occurrence_date.isoformat() if self.last_occurrence_date else None,
            "next_occurrence_date": self.next_occurrence_date.isoformat() if self.next_occurrence_date else None,
            "occurrences_count": self.occurrences_count,
            "total_occurrences_generated": self.total_occurrences_generated,
            "created_by_id": str(self.created_by_id) if self.created_by_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "recurrence_description": self.recurrence_description
        }
        
        if include_occurrences:
            result["occurrences"] = [occ.to_dict() for occ in self.occurrences]
        
        return result
    
    def __repr__(self):
        return f"<RecurringMeeting id={self.id} title='{self.title[:50]}' type={self.recurrence_type_value}>"


class RecurringMeetingOccurrence(Base):
    __tablename__ = "recurring_meeting_occurrences"
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4, index=True)
    recurring_meeting_id = Column(CustomUUID, ForeignKey("recurring_meetings.id", ondelete="CASCADE"), nullable=False)
    meeting_id = Column(CustomUUID, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    occurrence_number = Column(Integer, nullable=False)
    scheduled_date = Column(DateTime, nullable=False)
    status = Column(String(20), default="scheduled")
    rescheduled_to_date = Column(DateTime, nullable=True)
    cancellation_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    recurring_meeting = relationship("RecurringMeeting", back_populates="occurrences")
    meeting = relationship(
        "Meeting", 
        foreign_keys=[meeting_id], 
        lazy="joined",
        backref=backref("recurring_occurrence", uselist=False)
    )
    
    __table_args__ = (
        Index("ix_occurrences_recurring_meeting", "recurring_meeting_id"),
        Index("ix_occurrences_meeting", "meeting_id"),
        Index("ix_occurrences_scheduled_date", "scheduled_date"),
        Index("ix_occurrences_status", "status"),
        Index("ix_occurrences_recurring_status_date", "recurring_meeting_id", "status", "scheduled_date"),
    )
    
    # ==================== Properties ====================
    
    @property
    def is_upcoming(self) -> bool:
        """Check if occurrence is in the future"""
        return self.scheduled_date > datetime.now()
    
    @property
    def is_past(self) -> bool:
        """Check if occurrence is in the past"""
        return self.scheduled_date < datetime.now()
    
    @property
    def can_reschedule(self) -> bool:
        """Check if occurrence can be rescheduled"""
        return self.status in ['scheduled', 'rescheduled'] and self.is_upcoming
    
    @property
    def can_cancel(self) -> bool:
        """Check if occurrence can be cancelled"""
        return self.status in ['scheduled', 'rescheduled'] and self.is_upcoming
    
    @property
    def meeting_title(self) -> Optional[str]:
        """Get meeting title"""
        return self.meeting.title if self.meeting else None
    
    # ==================== Methods ====================
    
    def mark_as_completed(self):
        """Mark occurrence as completed"""
        self.status = "completed"
        if self.meeting:
            # Get completed status ID from attributes
            self.meeting.status_id = None  # Set appropriate status
            self.meeting.updated_at = datetime.now()
        self.updated_at = datetime.now()
    
    def cancel(self, reason: Optional[str] = None):
        """Cancel occurrence"""
        self.status = "cancelled"
        self.cancellation_reason = reason
        if self.meeting:
            self.meeting.is_active = False
            self.meeting.updated_at = datetime.now()
        self.updated_at = datetime.now()
    
    def reschedule(self, new_date: datetime, reason: Optional[str] = None):
        """Reschedule occurrence"""
        self.rescheduled_to_date = new_date
        self.status = "rescheduled"
        self.cancellation_reason = reason
        if self.meeting:
            self.meeting.meeting_date = new_date.date()
            self.meeting.start_time = new_date
            self.meeting.updated_at = datetime.now()
        self.updated_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "recurring_meeting_id": str(self.recurring_meeting_id),
            "meeting_id": str(self.meeting_id),
            "occurrence_number": self.occurrence_number,
            "scheduled_date": self.scheduled_date.isoformat() if self.scheduled_date else None,
            "status": self.status,
            "rescheduled_to_date": self.rescheduled_to_date.isoformat() if self.rescheduled_to_date else None,
            "cancellation_reason": self.cancellation_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "meeting_title": self.meeting_title,
            "is_upcoming": self.is_upcoming,
            "is_past": self.is_past
        }
    
    def __repr__(self):
        return f"<RecurringMeetingOccurrence id={self.id} number={self.occurrence_number} meeting={self.meeting_id}>"