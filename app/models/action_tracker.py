"""
Action Tracker Models - Import order matters for Foreign Keys
Make sure this file is imported AFTER users, locations, and attribute tables
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Column, String, Text, DateTime, ForeignKey, Boolean, Integer, Float, Index, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.db.types import UUID as CustomUUID
from uuid import uuid4

# ==================== Association Tables ====================

participant_list_members = Table(
    'participant_list_members',
    Base.metadata,
    Column('participant_list_id', CustomUUID, ForeignKey('participant_lists.id', ondelete='CASCADE'), primary_key=True),
    Column('participant_id', CustomUUID, ForeignKey('participants.id', ondelete='CASCADE'), primary_key=True),
    Column('added_at', DateTime(timezone=True), server_default=func.now()),
    Column('added_by_id', CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    Index('ix_plm_list_id', 'participant_list_id'),
    Index('ix_plm_participant_id', 'participant_id'),
    Index('ix_plm_added_by', 'added_by_id')
)

# ==================== Main Models ====================

class Participant(Base):
    """Independent - no foreign keys to other action tracker tables"""
    __tablename__ = "participants"
    __table_args__ = (
        Index('ix_participants_name', 'name'),
        Index('ix_participants_email', 'email'),
        Index('ix_participants_created_by', 'created_by_id'),
        Index('ix_participants_updated_by', 'updated_by_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    telephone = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    organization = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    participant_lists = relationship("ParticipantList", secondary=participant_list_members, back_populates="participants")

    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None
    
class ParticipantList(Base):
    """Depends on Participant and User"""
    __tablename__ = "participant_lists"
    __table_args__ = (
        Index('ix_participant_lists_name', 'name'),
        Index('ix_participant_lists_created_by', 'created_by_id'),
        Index('ix_participant_lists_updated_by', 'updated_by_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_global = Column(Boolean, default=False, nullable=False)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    participants = relationship("Participant", secondary=participant_list_members, back_populates="participant_lists", lazy="selectin")

    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None
    
class Meeting(Base):
    """Depends on Location, User, Attribute"""
    __tablename__ = "meetings"
    __table_args__ = (
        Index('ix_meetings_title', 'title'),
        Index('ix_meetings_meeting_date', 'meeting_date'),
        Index('ix_meetings_status_id', 'status_id'),
        Index('ix_meetings_created_by', 'created_by_id'),
        Index('ix_meetings_updated_by', 'updated_by_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    location_id = Column(CustomUUID, ForeignKey('locations.id', ondelete='SET NULL'), nullable=True)
    location_text = Column(String(500), nullable=True)
    gps_coordinates = Column(String(100), nullable=True)
    
    meeting_date = Column(DateTime(timezone=True), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    
    agenda = Column(Text, nullable=True)
    facilitator = Column(String(255), nullable=True)
    chairperson_name = Column(String(255), nullable=True)
    
    status_id = Column(CustomUUID, ForeignKey('attributes.id', ondelete='SET NULL'), nullable=True)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships with explicit join conditions and eager loading defaults
    location = relationship("Location", lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    status = relationship("Attribute", foreign_keys=[status_id], lazy="selectin")
    
    # One-to-many relationships with cascade delete
    participants = relationship(
        "MeetingParticipant", 
        back_populates="meeting", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    minutes = relationship(
        "MeetingMinutes", 
        back_populates="meeting", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    documents = relationship(
        "MeetingDocument", 
        back_populates="meeting", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    status_history = relationship(
        "MeetingStatusHistory", 
        back_populates="meeting", 
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="MeetingStatusHistory.status_date.desc()"
    )

    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None


# app/models/action_tracker.py

class MeetingStatus(Base):
    """Meeting status lookup table"""
    __tablename__ = "meeting_statuses"
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    code = Column(String(50), nullable=False, unique=True)  # 'scheduled', 'ongoing', 'completed', 'cancelled'
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)  # For UI display
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

class MeetingParticipant(Base):
    """Depends on Meeting"""
    __tablename__ = "meeting_participants"
    __table_args__ = (
        Index('ix_mp_meeting_id', 'meeting_id'),
        Index('ix_mp_name', 'name'),
        Index('ix_mp_attendance_status', 'attendance_status'),
        Index('ix_mp_created_by', 'created_by_id'),
        Index('ix_mp_updated_by', 'updated_by_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    meeting_id = Column(CustomUUID, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    telephone = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    organization = Column(String(255), nullable=True)
    is_chairperson = Column(Boolean, default=False, nullable=False)
    attendance_status = Column(String(50), nullable=True, default='pending')  # attended, missed, pending, excused
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    meeting = relationship("Meeting", back_populates="participants")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")

    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None


class MeetingStatusHistory(Base):
    """Tracks the lifecycle of a meeting"""
    __tablename__ = "meeting_status_history"
    __table_args__ = (
        Index('ix_msh_meeting_id', 'meeting_id'),
        Index('ix_msh_status_id', 'status_id'),
        Index('ix_msh_status_date', 'status_date'),
        Index('ix_msh_created_by', 'created_by_id'),
        Index('ix_msh_updated_by', 'updated_by_id'),
    )

    id = Column(CustomUUID, primary_key=True, default=uuid4)
    meeting_id = Column(CustomUUID, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    
    status_id = Column(CustomUUID, ForeignKey('attributes.id', ondelete='SET NULL'), nullable=True)
    comment = Column(Text, nullable=True)
    status_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    meeting = relationship("Meeting", back_populates="status_history")
    status = relationship("Attribute", foreign_keys=[status_id], lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")

    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None

class MeetingMinutes(Base):
    """Depends on Meeting and User"""
    __tablename__ = "meeting_minutes"
    __table_args__ = (
        Index('ix_mm_meeting_id', 'meeting_id'),
        Index('ix_mm_timestamp', 'timestamp'),
        Index('ix_mm_created_by', 'created_by_id'),
        Index('ix_mm_updated_by', 'updated_by_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    meeting_id = Column(CustomUUID, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    
    topic = Column(String(500), nullable=False)
    discussion = Column(Text, nullable=True)
    decisions = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Who recorded/took the minutes (this is the missing relationship!)
    recorded_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    meeting = relationship("Meeting", back_populates="minutes")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id], lazy="selectin")  # ADD THIS!
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    
    # One-to-many with cascade and eager loading
    actions = relationship(
        "MeetingAction", 
        back_populates="minutes", 
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="MeetingAction.due_date.asc(), MeetingAction.priority.asc()"
    )
    @property
    def recorded_by_name(self) -> Optional[str]:
        return self.recorded_by.username if self.recorded_by else None
    
    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None
class MeetingAction(Base):
    """Depends on MeetingMinutes, User, Attribute"""
    __tablename__ = "meeting_actions"
    __table_args__ = (
        Index('ix_ma_minute_id', 'minute_id'),
        Index('ix_ma_assigned_to', 'assigned_to_id'),
        Index('ix_ma_assigned_by', 'assigned_by_id'),
        Index('ix_ma_due_date', 'due_date'),
        Index('ix_ma_priority', 'priority'),
        Index('ix_ma_overall_status_id', 'overall_status_id'),
        Index('ix_ma_created_by', 'created_by_id'),
        Index('ix_ma_updated_by', 'updated_by_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    minute_id = Column(CustomUUID, ForeignKey('meeting_minutes.id', ondelete='CASCADE'), nullable=False)
    
    description = Column(Text, nullable=False)
    
    assigned_to_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    assigned_to_name = Column(JSON, nullable=True)  # This is a column for denormalized data
    assigned_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    due_date = Column(DateTime(timezone=True), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    overall_status_id = Column(CustomUUID, ForeignKey('attributes.id', ondelete='SET NULL'), nullable=True)
    overall_progress_percentage = Column(Integer, default=0, nullable=False)
    
    priority = Column(Integer, default=2, nullable=False)
    
    estimated_hours = Column(Float, nullable=True)
    actual_hours = Column(Float, nullable=True)
    
    remarks = Column(Text, nullable=True)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships with eager loading defaults
    minutes = relationship("MeetingMinutes", back_populates="actions")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], lazy="selectin")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id], lazy="selectin")
    overall_status = relationship("Attribute", foreign_keys=[overall_status_id], lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    
    # One-to-many with cascade and eager loading
    status_history = relationship(
        "ActionStatusHistory", 
        back_populates="action", 
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ActionStatusHistory.created_at.desc()"
    )
    comments = relationship(
        "ActionComment", 
        back_populates="action", 
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ActionComment.created_at.desc()"
    )

    # ==================== PROPERTIES FOR DISPLAY ====================
    
    @property
    def created_by_name(self) -> Optional[str]:
        """Get creator's username from relationship"""
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        """Get last updater's username from relationship"""
        return self.updated_by.username if self.updated_by else None
    
    @property
    def assigned_to_display_name(self) -> Optional[str]:
        """
        Get assigned-to user's display name.
        Prefers relationship, falls back to denormalized column.
        Use this for display purposes.
        """
        if self.assigned_to:
            return self.assigned_to.username
        return self.assigned_to_name  # Use the column value as fallback
    
    @property
    def assigned_by_name(self) -> Optional[str]:
        """Get assigned-by user's username from relationship"""
        return self.assigned_by.username if self.assigned_by else None
    
    @property
    def overall_status_name(self) -> Optional[str]:
        """Get overall status name from relationship"""
        return self.overall_status.name if self.overall_status else None
    
    @property
    def overall_status_code(self) -> Optional[str]:
        """Get overall status code from relationship"""
        return self.overall_status.code if self.overall_status else None
    
    @property
    def overall_status_color(self) -> Optional[str]:
        """Get overall status color from relationship metadata"""
        if self.overall_status and self.overall_status.extra_metadata:
            return self.overall_status.extra_metadata.get('color')
        return None
    
    @property
    def is_overdue(self) -> bool:
        """Check if action is overdue (not completed and due date passed)"""
        if self.completed_at:
            return False
        if not self.due_date:
            return False
        return self.due_date < datetime.now()
    
    @property
    def progress_status(self) -> str:
        """Get progress status based on percentage"""
        if self.completed_at:
            return "completed"
        if self.overall_progress_percentage >= 100:
            return "completed"
        if self.overall_progress_percentage > 0:
            return "in_progress"
        return "not_started"
    
    @property
    def priority_label(self) -> str:
        """Get human-readable priority label"""
        priority_map = {
            1: "High",
            2: "Medium", 
            3: "Low",
            4: "Very Low"
        }
        return priority_map.get(self.priority, "Medium")
    
    @property
    def priority_color(self) -> str:
        """Get color for priority badge"""
        color_map = {
            1: "error",
            2: "warning",
            3: "info",
            4: "default"
        }
        return color_map.get(self.priority, "default")
    
    @property
    def time_estimate_display(self) -> str:
        """Get formatted time estimate"""
        if self.estimated_hours:
            if self.estimated_hours < 1:
                return f"{int(self.estimated_hours * 60)} minutes"
            return f"{self.estimated_hours:.1f} hours"
        return "Not estimated"
    
    @property
    def actual_time_display(self) -> str:
        """Get formatted actual time"""
        if self.actual_hours:
            if self.actual_hours < 1:
                return f"{int(self.actual_hours * 60)} minutes"
            return f"{self.actual_hours:.1f} hours"
        return "Not logged"
    
    @property
    def time_variance(self) -> Optional[float]:
        """Calculate time variance (actual - estimated)"""
        if self.estimated_hours and self.actual_hours:
            return self.actual_hours - self.estimated_hours
        return None
    
    @property
    def time_variance_display(self) -> str:
        """Get formatted time variance"""
        variance = self.time_variance
        if variance is None:
            return "N/A"
        if variance > 0:
            return f"+{variance:.1f} hours"
        elif variance < 0:
            return f"{variance:.1f} hours"
        return "On track"
    
    # ==================== HELPER METHODS ====================
    
    def update_progress(self, new_percentage: int, status_id: Optional[CustomUUID] = None) -> None:
        """Update progress percentage and auto-set completion if applicable"""
        self.overall_progress_percentage = min(max(new_percentage, 0), 100)
        
        if self.overall_progress_percentage >= 100 and not self.completed_at:
            self.completed_at = datetime.now()
        elif self.overall_progress_percentage < 100 and self.completed_at:
            self.completed_at = None
        
        if self.overall_progress_percentage > 0 and not self.start_date:
            self.start_date = datetime.now()
        
        if status_id:
            self.overall_status_id = status_id
    
    def mark_completed(self) -> None:
        """Mark action as completed"""
        self.overall_progress_percentage = 100
        self.completed_at = datetime.now()
        if not self.start_date:
            self.start_date = datetime.now()
    
    def reopen(self) -> None:
        """Reopen a completed action"""
        self.completed_at = None
        self.overall_progress_percentage = 0
    
    def to_dict(self, include_relationships: bool = False) -> dict:
        """Convert to dictionary for serialization"""
        result = {
            "id": str(self.id),
            "minute_id": str(self.minute_id),
            "description": self.description,
            "assigned_to_id": str(self.assigned_to_id) if self.assigned_to_id else None,
            "assigned_to_name": self.assigned_to_name,
            "assigned_by_id": str(self.assigned_by_id) if self.assigned_by_id else None,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "overall_status_id": str(self.overall_status_id) if self.overall_status_id else None,
            "overall_progress_percentage": self.overall_progress_percentage,
            "priority": self.priority,
            "estimated_hours": self.estimated_hours,
            "actual_hours": self.actual_hours,
            "remarks": self.remarks,
            "created_by_id": str(self.created_by_id) if self.created_by_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_by_id": str(self.updated_by_id) if self.updated_by_id else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_active": self.is_active,
            
            # Computed properties
            "created_by_name": self.created_by_name,
            "updated_by_name": self.updated_by_name,
            "assigned_to_display_name": self.assigned_to_display_name,
            "assigned_by_name": self.assigned_by_name,
            "overall_status_name": self.overall_status_name,
            "is_overdue": self.is_overdue,
            "progress_status": self.progress_status,
            "priority_label": self.priority_label,
            "priority_color": self.priority_color,
        }
        
        if include_relationships:
            result["assigned_to"] = self.assigned_to.username if self.assigned_to else None
            result["assigned_by"] = self.assigned_by.username if self.assigned_by else None
            result["created_by"] = self.created_by.username if self.created_by else None
            result["updated_by"] = self.updated_by.username if self.updated_by else None
        
        return result
class ActionStatusHistory(Base):
    """Depends on MeetingAction, User, Attribute"""
    __tablename__ = "action_status_history"
    __table_args__ = (
        Index('ix_ash_action_id', 'action_id'),
        Index('ix_ash_created_at', 'created_at'),
        Index('ix_ash_created_by', 'created_by_id'),
        Index('ix_ash_updated_by', 'updated_by_id'),
        Index('ix_ash_individual_status_id', 'individual_status_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    action_id = Column(CustomUUID, ForeignKey('meeting_actions.id', ondelete='CASCADE'), nullable=False)
    
    individual_status_id = Column(CustomUUID, ForeignKey('attributes.id', ondelete='SET NULL'), nullable=True)
    progress_percentage = Column(Integer, default=0, nullable=False)
    remarks = Column(Text, nullable=True)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    action = relationship("MeetingAction", back_populates="status_history")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    individual_status = relationship("Attribute", foreign_keys=[individual_status_id], lazy="selectin")

    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None

class ActionComment(Base):
    """Depends on MeetingAction and User"""
    __tablename__ = "action_comments"
    __table_args__ = (
        Index('ix_ac_action_id', 'action_id'),
        Index('ix_ac_created_by', 'created_by_id'),
        Index('ix_ac_created_at', 'created_at'),
        Index('ix_ac_updated_by', 'updated_by_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    action_id = Column(CustomUUID, ForeignKey('meeting_actions.id', ondelete='CASCADE'), nullable=False)
    
    comment = Column(Text, nullable=False)
    attachment_url = Column(String(1000), nullable=True)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    action = relationship("MeetingAction", back_populates="comments")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")

    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None
class MeetingDocument(Base):
    """Depends on Meeting, User, Attribute"""
    __tablename__ = "meeting_documents"
    __table_args__ = (
        Index('ix_md_meeting_id', 'meeting_id'),
        Index('ix_md_document_type_id', 'document_type_id'),
        Index('ix_md_uploaded_by', 'uploaded_by_id'),
        Index('ix_md_uploaded_at', 'uploaded_at'),
        Index('ix_md_created_by', 'created_by_id'),
        Index('ix_md_updated_by', 'updated_by_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    meeting_id = Column(CustomUUID, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    
    document_type_id = Column(CustomUUID, ForeignKey('attributes.id', ondelete='SET NULL'), nullable=True)
    
    description = Column(Text, nullable=True)
    version = Column(Integer, default=1, nullable=False)
    
    uploaded_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    title = Column(String(500), nullable=True)  # Document title/name
    meeting = relationship("Meeting", back_populates="documents")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id], lazy="selectin")
    document_type = relationship("Attribute", foreign_keys=[document_type_id], lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")

    # ============ User Name Properties ============
    
    @property
    def created_by_name(self) -> Optional[str]:
        """Get the username of who created this document"""
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        """Get the username of who last updated this document"""
        return self.updated_by.username if self.updated_by else None
    
    @property
    def uploaded_by_name(self) -> Optional[str]:
        """Get the username of who uploaded this document"""
        return self.uploaded_by.username if self.uploaded_by else None

    # ============ Document Type Properties ============
    
    @property
    def document_type_name(self) -> str:
        """Get the document type name from the related Attribute"""
        if self.document_type:
            # Try to get name from attribute
            if hasattr(self.document_type, 'name') and self.document_type.name:
                return self.document_type.name
            # Try to get from extra_metadata
            if hasattr(self.document_type, 'extra_metadata') and self.document_type.extra_metadata:
                metadata = self.document_type.extra_metadata
                if isinstance(metadata, dict) and 'display_name' in metadata:
                    return metadata['display_name']
        return "General Document"
    
    @property
    def document_type_code(self) -> Optional[str]:
        """Get the document type code (e.g., 'AGENDA', 'MINUTES')"""
        if self.document_type:
            # Try direct code
            if hasattr(self.document_type, 'code') and self.document_type.code:
                # Remove 'DOC_TYPE_' prefix if present
                code = self.document_type.code
                if code.startswith('DOC_TYPE_'):
                    return code[9:]  # Remove 'DOC_TYPE_' prefix
                return code
            # Try to get from extra_metadata
            if hasattr(self.document_type, 'extra_metadata') and self.document_type.extra_metadata:
                metadata = self.document_type.extra_metadata
                if isinstance(metadata, dict) and 'code' in metadata:
                    return metadata['code']
        return None
    
    @property
    def document_type_short_name(self) -> Optional[str]:
        """Get the short name of the document type"""
        if self.document_type and hasattr(self.document_type, 'short_name'):
            return self.document_type.short_name
        return self.document_type_name[:20] if self.document_type_name else None
    
    @property
    def document_type_icon(self) -> Optional[str]:
        """Get the icon associated with this document type"""
        if self.document_type and hasattr(self.document_type, 'extra_metadata'):
            metadata = self.document_type.extra_metadata
            if isinstance(metadata, dict) and 'icon' in metadata:
                return metadata['icon']
        # Return default icon based on mime type
        if self.mime_type:
            if self.mime_type == 'application/pdf':
                return 'pdf'
            if self.mime_type.startswith('image/'):
                return 'image'
        return 'document'
    
    @property
    def document_type_color(self) -> Optional[str]:
        """Get the color associated with this document type for UI"""
        if self.document_type and hasattr(self.document_type, 'extra_metadata'):
            metadata = self.document_type.extra_metadata
            if isinstance(metadata, dict) and 'color' in metadata:
                return metadata['color']
        # Return default colors based on document type code
        if self.document_type_code:
            color_map = {
                'AGENDA': '#3b82f6',    # Blue
                'MINUTES': '#10b981',   # Green
                'PRESENTATION': '#f59e0b',  # Amber
                'REPORT': '#8b5cf6',    # Purple
                'ATTACHMENT': '#6b7280', # Gray
            }
            return color_map.get(self.document_type_code, '#6b7280')
        return '#6b7280'

    # ============ File Properties ============
    
    @property
    def file_url(self) -> Optional[str]:
        """Generate download URL for the file"""
        if self.id:
            return f"/api/v1/action-tracker/documents/document/{self.id}/download"
        return None
    
    @property
    def file_extension(self) -> str:
        """Get the file extension (e.g., '.pdf', '.docx')"""
        if self.file_name and '.' in self.file_name:
            return self.file_name.rsplit('.', 1)[-1].lower()
        return 'unknown'
    
    @property
    def file_size_formatted(self) -> str:
        """Get human-readable file size (e.g., '1.5 MB', '256 KB')"""
        if not self.file_size:
            return 'Unknown size'
        
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}" if unit != 'B' else f"{size:.0f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"
    
    @property
    def is_image(self) -> bool:
        """Check if the document is an image"""
        return self.mime_type and self.mime_type.startswith('image/')
    
    @property
    def is_pdf(self) -> bool:
        """Check if the document is a PDF"""
        return self.mime_type == 'application/pdf' or self.file_extension == 'pdf'
    
    @property
    def is_previewable(self) -> bool:
        """Check if the document can be previewed in the browser"""
        return self.is_pdf or self.is_image
    
    @property
    def thumbnail_url(self) -> Optional[str]:
        """Get thumbnail URL for images (if applicable)"""
        if self.is_image and self.id:
            # You could implement a thumbnail generation endpoint
            return f"/api/v1/action-tracker/documents/document/{self.id}/thumbnail"
        return None

    # ============ Document Information ============
    
    @property
    def display_title(self) -> str:
        """Get the display title (fallback to filename if title is empty)"""
        return self.title if self.title else self.file_name.replace(f'.{self.file_extension}', '') if self.file_name else 'Untitled Document'
    
    @property
    def version_display(self) -> str:
        """Get formatted version (e.g., 'v1', 'v2')"""
        return f"v{self.version}"
    
    @property
    def is_latest_version(self) -> bool:
        """Check if this is the latest version of the document"""
        # You would need to implement version checking logic
        # This could query for other documents with same title/meeting
        return True  # Placeholder
    
    @property
    def uploaded_at_formatted(self) -> str:
        """Get formatted upload date/time"""
        if self.uploaded_at:
            return self.uploaded_at.strftime("%Y-%m-%d %H:%M:%S")
        return "Unknown"
    
    @property
    def uploaded_at_relative(self) -> str:
        """Get relative time (e.g., '2 hours ago', '3 days ago')"""
        if not self.uploaded_at:
            return "Unknown"
        
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        diff = now - self.uploaded_at
        
        if diff.days > 365:
            years = diff.days // 365
            return f"{years} year{'s' if years > 1 else ''} ago"
        if diff.days > 30:
            months = diff.days // 30
            return f"{months} month{'s' if months > 1 else ''} ago"
        if diff.days > 0:
            return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
        if diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        if diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        return "Just now"

    # ============ Utility Methods ============
    
    def to_dict(self, include_relationships: bool = False) -> dict:
        """Convert document to dictionary"""
        data = {
            "id": str(self.id),
            "meeting_id": str(self.meeting_id),
            "file_name": self.file_name,
            "title": self.title,
            "description": self.description,
            "file_size": self.file_size,
            "file_size_formatted": self.file_size_formatted,
            "file_extension": self.file_extension,
            "mime_type": self.mime_type,
            "document_type_id": str(self.document_type_id) if self.document_type_id else None,
            "document_type_name": self.document_type_name,
            "document_type_code": self.document_type_code,
            "version": self.version,
            "version_display": self.version_display,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "uploaded_at_formatted": self.uploaded_at_formatted,
            "uploaded_at_relative": self.uploaded_at_relative,
            "is_active": self.is_active,
            "is_previewable": self.is_previewable,
            "file_url": self.file_url,
            "display_title": self.display_title,
        }
        
        if include_relationships:
            data.update({
                "uploaded_by_id": str(self.uploaded_by_id) if self.uploaded_by_id else None,
                "uploaded_by_name": self.uploaded_by_name,
                "created_by_name": self.created_by_name,
                "updated_by_name": self.updated_by_name,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            })
        
        return data
    
    def __repr__(self) -> str:
        """String representation of the document"""
        return f"<MeetingDocument {self.display_title} (meeting: {self.meeting_id})>"
    
# ==================== Helper Methods for Eager Loading ====================

from sqlalchemy import select
from sqlalchemy.orm import selectinload

class MeetingQuery:
    """Helper class for common meeting queries with eager loading"""
    
    @staticmethod
    def get_with_all_relations():
        """Returns a query with all relationships loaded"""
        return select(Meeting).options(
            selectinload(Meeting.participants),
            selectinload(Meeting.status),
            selectinload(Meeting.created_by),
            selectinload(Meeting.updated_by),
            selectinload(Meeting.location),
            selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions).selectinload(MeetingAction.comments),
            selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions).selectinload(MeetingAction.status_history),
            selectinload(Meeting.documents),
            selectinload(Meeting.status_history)
        )
    
    @staticmethod
    def get_with_minutes_and_actions():
        """Returns a query with minutes and actions loaded"""
        return select(Meeting).options(
            selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions)
        )
    
    @staticmethod
    def get_with_audit_info():
        """Returns a query with all audit relationships loaded"""
        return select(Meeting).options(
            selectinload(Meeting.created_by),
            selectinload(Meeting.updated_by),
            selectinload(Meeting.minutes).selectinload(MeetingMinutes.created_by),
            selectinload(Meeting.minutes).selectinload(MeetingMinutes.updated_by),
            selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions).selectinload(MeetingAction.created_by),
            selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions).selectinload(MeetingAction.updated_by),
            selectinload(Meeting.participants).selectinload(MeetingParticipant.created_by),
            selectinload(Meeting.participants).selectinload(MeetingParticipant.updated_by),
            selectinload(Meeting.documents).selectinload(MeetingDocument.created_by),
            selectinload(Meeting.documents).selectinload(MeetingDocument.updated_by),
        )


# ==================== Model Configuration for Pydantic ====================

# Add this to enable ORM mode for all models
for model in [Meeting, MeetingMinutes, MeetingAction, MeetingParticipant, 
              MeetingDocument, MeetingStatusHistory, ActionStatusHistory, 
              ActionComment, Participant, ParticipantList]:
    model.__allow_unmapped__ = True