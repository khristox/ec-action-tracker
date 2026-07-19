"""
Action Tracker Models - Import order matters for Foreign Keys
Make sure this file is imported AFTER users, locations, and attribute tables
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import uuid
from sqlalchemy import JSON, Column, String, Text, DateTime, ForeignKey, Boolean, Integer, Float, Index, Table
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from app.db.base import Base
from app.db.types import UUID as CustomUUID
from uuid import UUID, uuid4
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
    
    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "telephone": self.telephone,
            "title": self.title,
            "organization": self.organization,
            "notes": self.notes,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self) -> str:
        return f"<Participant id={self.id} name='{self.name}'>"
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
    
    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "is_global": self.is_global,
            "participant_count": len(self.participants) if self.participants else 0,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self) -> str:
        return f"<ParticipantList id={self.id} name='{self.name}'>"
class ActionStatus(Base):
    """Action status lookup table"""
    __tablename__ = "action_statuses"
    __table_args__ = (
        Index('ix_action_statuses_code', 'code'),
        Index('ix_action_statuses_is_active', 'is_active'),
        Index('ix_action_statuses_sort_order', 'sort_order'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    code = Column(String(50), nullable=False, unique=True)  # 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'BLOCKED'
    name = Column(String(100), nullable=False)  # 'Pending', 'In Progress', 'Completed', 'Overdue', 'Blocked'
    short_name = Column(String(20), nullable=True)  # 'PENDING', 'IN_PROGRESS', etc.
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)  # For UI display
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    actions = relationship("MeetingAction", back_populates="overall_status", foreign_keys="MeetingAction.overall_status_id", lazy="selectin")
    
    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None
    
    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "code": self.code,
            "name": self.name,
            "short_name": self.short_name,
            "description": self.description,
            "color": self.color,
            "sort_order": self.sort_order,
            "is_active": self.is_active,
        }
    
    def __repr__(self) -> str:
        return f"<ActionStatus id={self.id} code='{self.code}' name='{self.name}'>"
class Meeting(Base):
    """Meeting model with relationships to Location, User, and Attribute"""
    __tablename__ = "meetings"
    __table_args__ = (
        Index('ix_meetings_title', 'title'),
        Index('ix_meetings_meeting_date', 'meeting_date'),
        Index('ix_meetings_status_id', 'status_id'),
        Index('ix_meetings_created_by', 'created_by_id'),
        Index('ix_meetings_updated_by', 'updated_by_id'),
        Index('ix_meetings_is_recurring', 'is_recurring'),
        Index('ix_meetings_recurring_meeting_id', 'recurring_meeting_id'),
        Index('ix_meetings_department_id', 'department_id'),
        Index('ix_meetings_restricted_department', 'restricted_department_id'),
    )
    
    # Primary Key
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    
    # Basic Information
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    # Department Information
    department_id = Column(CustomUUID, ForeignKey("organization_nodes.id"), nullable=True)
    
    # Location Information
    location_id = Column(CustomUUID, ForeignKey('locations.id', ondelete='SET NULL'), nullable=True)
    location_text = Column(String(500), nullable=True)
    gps_coordinates = Column(String(100), nullable=True)
    
    # Date and Time
    meeting_date = Column(DateTime(timezone=True), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, nullable=True)  # Calculated field
    # Meeting platform fields
    platform = Column(String(100), nullable=True)
    meeting_link = Column(String(500), nullable=True)
    meeting_id_online = Column(String(255), nullable=True)
    passcode = Column(String(100), nullable=True)
    dial_in_numbers = Column(JSON, nullable=True)
    
    # Meeting Content
    agenda = Column(Text, nullable=True)
    facilitator = Column(String(255), nullable=True)
    chairperson_name = Column(String(255), nullable=True)
    
    # Leadership (FK to MeetingParticipant)
    chairperson_id = Column(CustomUUID, ForeignKey("meeting_participants.id", ondelete="SET NULL"), nullable=True)
    secretary_id = Column(CustomUUID, ForeignKey("meeting_participants.id", ondelete="SET NULL"), nullable=True)
    
    # Status (FK to MeetingStatus)
    status_id = Column(CustomUUID, ForeignKey('attributes.id', ondelete='SET NULL'), nullable=True)
    
    # Recurring Meeting Support
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurring_meeting_id = Column(CustomUUID, ForeignKey('recurring_meetings.id', ondelete='SET NULL'), nullable=True)
    occurrence_number = Column(Integer, nullable=True)  # Which occurrence number this is
    
    # Visibility fields
    visibility = Column(String(50), default="open", nullable=False)
    restricted_department_id = Column(CustomUUID, ForeignKey("organization_nodes.id"), nullable=True)
    
    # Reminder tracking
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    reminder_sent_count = Column(Integer, nullable=False, default=0)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Soft Delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # ==================== Relationships ====================
    
    # Location
    location = relationship("Location", lazy="selectin")
    
    # Users
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    
    # Status - using MeetingStatus model
    status = relationship("Attribute", foreign_keys=[status_id], lazy="selectin")
    
    # Participants
    participants = relationship(
        "MeetingParticipant",
        foreign_keys="MeetingParticipant.meeting_id",
        back_populates="meeting",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    # Department relationships
    department = relationship(
        "OrganizationNode",
        foreign_keys=[department_id],
        backref="meetings_as_department",
        lazy="selectin"
    )
    
    restricted_department = relationship(
        "OrganizationNode",
        foreign_keys=[restricted_department_id],
        backref="meetings_as_restricted",
        lazy="selectin"
    )
    
    # Leadership (to MeetingParticipant)
    chairperson = relationship(
        "MeetingParticipant",
        foreign_keys=[chairperson_id],
        remote_side="MeetingParticipant.id",
        back_populates="chairperson_of",
        lazy="selectin"
    )
    
    secretary = relationship(
        "MeetingParticipant",
        foreign_keys=[secretary_id],
        remote_side="MeetingParticipant.id",
        back_populates="secretary_of",
        lazy="selectin"
    )
    
    # Minutes
    minutes = relationship(
        "MeetingMinutes", 
        back_populates="meeting", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    # Documents
    documents = relationship(
        "MeetingDocument", 
        back_populates="meeting", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    # Status History
    status_history = relationship(
        "MeetingStatusHistory", 
        back_populates="meeting", 
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="MeetingStatusHistory.status_date.desc()"
    )
    
    # Recurring Meeting (parent)
    recurring_meeting = relationship(
        "RecurringMeeting",
        foreign_keys=[recurring_meeting_id],
        back_populates="meetings",
        lazy="selectin"
    )
    
    # ==================== Properties ====================
    
    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None
    
    @property
    def chairperson_name_from_participant(self) -> Optional[str]:
        return self.chairperson.name if self.chairperson else self.chairperson_name
    
    @property
    def secretary_name_from_participant(self) -> Optional[str]:
        return self.secretary.name if self.secretary else None
    
    @property
    def participant_count(self) -> int:
        return len(self.participants) if self.participants else 0
    
    @property
    def duration(self) -> Optional[str]:
        if self.duration_minutes:
            hours = self.duration_minutes // 60
            minutes = self.duration_minutes % 60
            if hours > 0:
                return f"{hours}h {minutes}m" if minutes > 0 else f"{hours}h"
            return f"{minutes}m"
        return None
    
    @property
    def is_online(self) -> bool:
        return self.platform and self.platform != 'physical'
    
    @property
    def has_meeting_link(self) -> bool:
        return bool(self.meeting_link)
    
    @property
    def status_display(self) -> str:
        """Get status display name"""
        if self.status:
            return self.status.name
        return 'Scheduled'
    
    @property
    def status_color(self) -> Optional[str]:
        """Get status color for UI"""
        if self.status:
            return self.status.color
        return None
    
    # ==================== Methods ====================
    
    def calculate_duration(self) -> Optional[int]:
        if self.start_time and self.end_time:
            delta = self.end_time - self.start_time
            self.duration_minutes = int(delta.total_seconds() / 60)
            return self.duration_minutes
        return None
    
    def to_dict(self, include_relationships: bool = False) -> dict:
        data = {
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            "department_id": str(self.department_id) if self.department_id else None,
            "location_id": str(self.location_id) if self.location_id else None,
            "location_text": self.location_text,
            "gps_coordinates": self.gps_coordinates,
            "platform": self.platform,
            "meeting_link": self.meeting_link,
            "meeting_date": self.meeting_date.isoformat() if self.meeting_date else None,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_minutes": self.duration_minutes,
            "agenda": self.agenda,
            "facilitator": self.facilitator,
            "chairperson_name": self.chairperson_name,
            "chairperson_id": str(self.chairperson_id) if self.chairperson_id else None,
            "secretary_id": str(self.secretary_id) if self.secretary_id else None,
            "status_id": str(self.status_id) if self.status_id else None,
            "status_display": self.status_display,
            "status_color": self.status_color,
            "is_recurring": self.is_recurring,
            "recurring_meeting_id": str(self.recurring_meeting_id) if self.recurring_meeting_id else None,
            "occurrence_number": self.occurrence_number,
            "visibility": self.visibility,
            "restricted_department_id": str(self.restricted_department_id) if self.restricted_department_id else None,
            "created_by_id": str(self.created_by_id) if self.created_by_id else None,
            "created_by_name": self.created_by_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_active": self.is_active,
            "participant_count": self.participant_count,
            "duration": self.duration,
            "is_online": self.is_online,
            "has_meeting_link": self.has_meeting_link,
        }
        
        if include_relationships:
            data["participants"] = [p.to_dict() for p in self.participants] if self.participants else []
            data["minutes"] = [m.to_dict() for m in self.minutes] if self.minutes else []
            data["documents"] = [d.to_dict() for d in self.documents] if self.documents else []
        
        return data
    
    def __repr__(self) -> str:
        return f"<Meeting id={self.id} title='{self.title[:50]}' date={self.meeting_date}>"
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
    is_secretary = Column(Boolean, default=False, nullable=False) 
    attendance_status = Column(String(50), nullable=True, default='pending')
    apology_comment = Column(Text, nullable=True)  
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # ==================== Relationships ====================
    
    # Primary relationship to Meeting - specify foreign_keys
    meeting = relationship(
        "Meeting", 
        foreign_keys=[meeting_id],
        back_populates="participants",
        lazy="selectin"
    )
    
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    
    # These are back-references from Meeting - they don't need foreign_keys
    chairperson_of = relationship(
        "Meeting",
        foreign_keys="Meeting.chairperson_id",
        back_populates="chairperson",
        lazy="noload",
        uselist=False
    )
    
    secretary_of = relationship(
        "Meeting",
        foreign_keys="Meeting.secretary_id",
        back_populates="secretary",
        lazy="noload",
        uselist=False
    )
    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None
    
    @property
    def attendance_status_display(self) -> str:
        """Get display name for attendance status"""
        status_map = {
            'attended': 'Attended',
            'missed': 'Missed',
            'pending': 'Pending',
            'excused': 'Excused'
        }
        return status_map.get(self.attendance_status, 'Unknown')
    
    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "meeting_id": str(self.meeting_id),
            "name": self.name,
            "email": self.email,
            "telephone": self.telephone,
            "title": self.title,
            "organization": self.organization,
            "is_chairperson": self.is_chairperson,
            "is_secretary": self.is_secretary,
            "attendance_status": self.attendance_status,
            "attendance_status_display": self.attendance_status_display,
            "apology_comment": self.apology_comment,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def __repr__(self) -> str:
        return f"<MeetingParticipant id={self.id} name='{self.name}'>"
class MeetingStatusHistory(Base):
    __tablename__ = "meeting_status_history"
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4)
    meeting_id = Column(CustomUUID, ForeignKey("meetings.id"), nullable=False)
    # ✅ Change this to reference attributes table
    status_id = Column(CustomUUID, ForeignKey("attributes.id"), nullable=False)  # Was: ForeignKey("meeting_statuses.id")
    comment = Column(Text, nullable=True)
    status_date = Column(DateTime, nullable=False, default=datetime.now)
    created_by_id = Column(CustomUUID, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_by_id = Column(CustomUUID, ForeignKey("users.id"))
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    meeting = relationship("Meeting", foreign_keys=[meeting_id])
    # ✅ Change this to reference Attribute
    status = relationship("Attribute", foreign_keys=[status_id])  # Was: relationship("MeetingStatus")
    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])
class MeetingMinutes(Base):
    """Depends on Meeting and User"""
    __tablename__ = "meeting_minutes"
    __table_args__ = (
        Index('ix_mm_meeting_id', 'meeting_id'),
        Index('ix_mm_timestamp', 'timestamp'),
        Index('ix_mm_created_by', 'created_by_id'),
        Index('ix_mm_updated_by', 'updated_by_id'),
        Index('ix_mm_is_default', 'is_default'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    meeting_id = Column(CustomUUID, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    
    topic = Column(String(500), nullable=False)
    discussion = Column(Text, nullable=True)
    decisions = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Who recorded/took the minutes
    recorded_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False) 
    
    # Relationships
    meeting = relationship("Meeting", back_populates="minutes")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id], lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    
    # All actions (read-write) - primary relationship
    actions = relationship(
        "MeetingAction", 
        back_populates="minutes", 
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="MeetingAction.due_date.asc(), MeetingAction.priority.asc()"
    )
    # Active actions only (read-only) - filtered view
    active_actions = relationship(
        "MeetingAction", 
        primaryjoin="and_(MeetingMinutes.id == MeetingAction.minute_id, MeetingAction.is_active == True)",
        viewonly=True,
        overlaps="actions",
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
    
    @property
    def action_count(self) -> int:
        """Get total number of actions"""
        return len(self.actions) if self.actions else 0
    
    @property
    def completed_action_count(self) -> int:
        """Get number of completed actions"""
        if not self.actions:
            return 0
        return sum(1 for a in self.actions if a.is_completed)
    
    @property
    def overdue_action_count(self) -> int:
        """Get number of overdue actions"""
        if not self.actions:
            return 0
        return sum(1 for a in self.actions if a.is_overdue)
    
    @property
    def completion_percentage(self) -> float:
        """Get completion percentage of actions"""
        if not self.actions:
            return 0.0
        completed = self.completed_action_count
        total = len(self.actions)
        return round((completed / total) * 100, 2)
    
    def to_dict(self, include_actions: bool = True) -> dict:
        data = {
            "id": str(self.id),
            "meeting_id": str(self.meeting_id),
            "topic": self.topic,
            "discussion": self.discussion,
            "decisions": self.decisions,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "recorded_by_id": str(self.recorded_by_id) if self.recorded_by_id else None,
            "recorded_by_name": self.recorded_by_name,
            "created_by_id": str(self.created_by_id) if self.created_by_id else None,
            "created_by_name": self.created_by_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_active": self.is_active,
            "is_default": self.is_default,
            "action_count": self.action_count,
            "completed_action_count": self.completed_action_count,
            "overdue_action_count": self.overdue_action_count,
            "completion_percentage": self.completion_percentage,
        }
        
        if include_actions:
            data["actions"] = [a.to_dict() for a in (self.actions or [])]
        
        return data
    
    def __repr__(self) -> str:
        return f"<MeetingMinutes id={self.id} topic='{self.topic[:50]}'>"
class MeetingAction(Base):
    """Meeting Action model - tracks action items from meeting minutes"""
    __tablename__ = "meeting_actions"
    __table_args__ = (
        Index('ix_meeting_actions_minute_id', 'minute_id'),
        Index('ix_meeting_actions_assigned_to', 'assigned_to_id'),
        Index('ix_meeting_actions_due_date', 'due_date'),
        Index('ix_meeting_actions_priority', 'priority'),
        Index('ix_meeting_actions_status', 'overall_status_id'),
        Index('ix_meeting_actions_overall_status_name', 'overall_status_name'),
        Index('ix_meeting_actions_created_by', 'created_by_id'),
        Index('ix_meeting_actions_updated_by', 'updated_by_id'),
        Index('ix_meeting_actions_is_active', 'is_active'),
        Index('ix_meeting_actions_assign_to_meeting', 'assign_to_meeting_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    minute_id = Column(CustomUUID, ForeignKey("meeting_minutes.id", ondelete='CASCADE'), nullable=False)
    description = Column(Text, nullable=False)
    assigned_to_id = Column(CustomUUID, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    assigned_to_name = Column(JSON, nullable=True)  # Store assigned to details as JSON
    assigned_by_id = Column(CustomUUID, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    assigned_at = Column(DateTime(timezone=True), default=datetime.now, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    priority = Column(Integer, default=2, nullable=False)  # 1=High, 2=Medium, 3=Low, 4=Very Low
    remarks = Column(Text, nullable=True)

    # ---- New fields to match the updated Actions Tracker Form ----
    title = Column(String(500), nullable=True)
    issue_challenge = Column(Text, nullable=True)
    is_key_action = Column(Boolean, default=False, nullable=False)
    type_of_action = Column(String(100), nullable=True)
    date_initiated = Column(DateTime(timezone=True), nullable=True)
    tags = Column(JSON, nullable=True)  # list[str], e.g. ["urgent", "budget"]
    assign_to_meeting_id = Column(
        CustomUUID, ForeignKey("meetings.id", ondelete='SET NULL'), nullable=True
    )

    completed_at = Column(DateTime(timezone=True), nullable=True)
    overall_status_id = Column(CustomUUID, ForeignKey("action_statuses.id", ondelete='SET NULL'), nullable=True)
    overall_status_name = Column(String(100), nullable=True)
    overall_progress_percentage = Column(Integer, default=0, nullable=False)
    
    # Audit fields
    created_by_id = Column(CustomUUID, ForeignKey("users.id", ondelete='SET NULL'), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now, nullable=False)
    updated_by_id = Column(CustomUUID, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.now, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    minutes = relationship("MeetingMinutes", back_populates="actions")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], lazy="selectin")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id], lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    overall_status = relationship("ActionStatus", foreign_keys=[overall_status_id], lazy="selectin")
    comments = relationship("ActionComment", back_populates="action", cascade="all, delete-orphan", lazy="selectin")
    status_history = relationship("ActionStatusHistory", back_populates="action", cascade="all, delete-orphan", lazy="selectin")
    assign_to_meeting = relationship(
        "Meeting", foreign_keys=[assign_to_meeting_id], lazy="selectin"
    )
    implementers = relationship(
        "ActionImplementer",
        back_populates="action",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ActionImplementer.sort_order",
    )
    
    # ==================== Validators ====================
    
    @validates('priority')
    def validate_priority(self, key: str, value: int) -> int:
        """Ensure priority is between 1 and 4"""
        if value is not None and not (1 <= value <= 4):
            raise ValueError(f"Priority must be between 1 and 4, got {value}")
        return value
    
    @validates('overall_progress_percentage')
    def validate_progress(self, key: str, value: int) -> int:
        """Ensure progress is between 0 and 100"""
        if value is not None and not (0 <= value <= 100):
            raise ValueError(f"Progress must be between 0 and 100, got {value}")
        return value
    
    # ==================== Properties ====================
    
    @property
    def assigned_to_display(self) -> str:
        """Get display name for assigned to"""
        if self.assigned_to:
            return self.assigned_to.full_name or self.assigned_to.username or 'Unassigned'
        if self.assigned_to_name:
            if isinstance(self.assigned_to_name, dict):
                return self.assigned_to_name.get('name', 'Unassigned')
            return str(self.assigned_to_name)
        return 'Unassigned'
    
    @property
    def is_overdue(self) -> bool:
        """Check if the action is overdue"""
        if not self.due_date or self.is_completed:
            return False
        now = datetime.now(timezone.utc)
        if self.due_date.tzinfo is None:
            due_date = self.due_date.replace(tzinfo=timezone.utc)
        else:
            due_date = self.due_date
        return due_date < now
    
    @property
    def is_completed(self) -> bool:
        """Check if the action is completed"""
        return self.completed_at is not None or self.overall_progress_percentage >= 100
    
    @property
    def priority_label(self) -> str:
        """Get priority label"""
        priority_map = {
            1: 'High',
            2: 'Medium',
            3: 'Low',
            4: 'Very Low'
        }
        return priority_map.get(self.priority, 'Medium')
    
    @property
    def priority_color(self) -> str:
        """Get priority color for UI"""
        color_map = {
            1: 'error',
            2: 'warning',
            3: 'info',
            4: 'default'
        }
        return color_map.get(self.priority, 'default')
    
    @property
    def status_display(self) -> str:
        """Get the display name for the status"""
        if self.overall_status:
            return self.overall_status.name
        if self.overall_status_name:
            return self.overall_status_name
        return 'Pending'
    
    @property
    def status_color(self) -> Optional[str]:
        """Get status color for UI"""
        if self.overall_status:
            return self.overall_status.color
        return None
    
    @property
    def progress_status(self) -> str:
        """Get progress status label"""
        if self.is_completed:
            return 'Completed'
        if self.is_overdue:
            return 'Overdue'
        if self.overall_progress_percentage > 0:
            return 'In Progress'
        return 'Not Started'
    
    # ==================== Methods ====================
    
    def update_progress(self, percentage: int, status_id: Optional[UUID] = None, remarks: Optional[str] = None) -> None:
        """
        Update progress and optionally status
        
        Args:
            percentage: Progress percentage (0-100)
            status_id: Optional status ID to set
            remarks: Optional remarks to add
        """
        self.overall_progress_percentage = min(max(percentage, 0), 100)
        if status_id:
            self.overall_status_id = status_id
        if remarks:
            self.remarks = remarks
        self.updated_at = datetime.now(timezone.utc)
    
    def complete(self) -> None:
        """Mark the action as completed"""
        self.completed_at = datetime.now(timezone.utc)
        self.overall_progress_percentage = 100
        self.updated_at = datetime.now(timezone.utc)
    
    def assign_to(self, user_id: UUID, assigned_by_id: UUID) -> None:
        """
        Assign the action to a user
        
        Args:
            user_id: ID of the user to assign to
            assigned_by_id: ID of the user performing the assignment
        """
        self.assigned_to_id = user_id
        self.assigned_by_id = assigned_by_id
        self.assigned_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
    
    def to_dict(self, include_relationships: bool = False) -> dict:
        """Convert action to dictionary"""
        data = {
            "id": str(self.id),
            "minute_id": str(self.minute_id) if self.minute_id else None,
            "description": self.description,
            "assigned_to_id": str(self.assigned_to_id) if self.assigned_to_id else None,
            "assigned_to_name": self.assigned_to_name,
            "assigned_to_display": self.assigned_to_display,
            "assigned_by_id": str(self.assigned_by_id) if self.assigned_by_id else None,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "priority": self.priority,
            "priority_label": self.priority_label,
            "priority_color": self.priority_color,
            "remarks": self.remarks,
            "title": self.title,
            "issue_challenge": self.issue_challenge,
            "is_key_action": self.is_key_action,
            "type_of_action": self.type_of_action,
            "date_initiated": self.date_initiated.isoformat() if self.date_initiated else None,
            "tags": self.tags or [],
            "assign_to_meeting_id": str(self.assign_to_meeting_id) if self.assign_to_meeting_id else None,
            "persons_implementing": [i.to_dict() for i in (self.implementers or [])],
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "overall_status_id": str(self.overall_status_id) if self.overall_status_id else None,
            "overall_status_name": self.overall_status_name,
            "overall_progress_percentage": self.overall_progress_percentage,
            "is_overdue": self.is_overdue,
            "is_completed": self.is_completed,
            "progress_status": self.progress_status,
            "status_display": self.status_display,
            "status_color": self.status_color,
            "is_active": self.is_active,
            "created_by_id": str(self.created_by_id) if self.created_by_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_relationships:
            data.update({
                "assigned_to": {
                    "id": str(self.assigned_to.id) if self.assigned_to else None,
                    "full_name": self.assigned_to.full_name if self.assigned_to else None,
                    "username": self.assigned_to.username if self.assigned_to else None,
                    "email": self.assigned_to.email if self.assigned_to else None,
                } if self.assigned_to else None,
                "overall_status": {
                    "id": str(self.overall_status.id) if self.overall_status else None,
                    "code": self.overall_status.code if self.overall_status else None,
                    "name": self.overall_status.name if self.overall_status else None,
                    "short_name": self.overall_status.short_name if self.overall_status else None,
                    "color": self.overall_status.color if self.overall_status else None,
                } if self.overall_status else None,
            })
        
        return data
    
    def __repr__(self) -> str:
        return f"<MeetingAction id={self.id} description='{self.description[:50]}' priority={self.priority}>"
class ActionStatusHistory(Base):
    """Depends on MeetingAction, User, ActionStatus"""
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
    
    individual_status_id = Column(CustomUUID, ForeignKey('action_statuses.id', ondelete='SET NULL'), nullable=True)
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
    individual_status = relationship("ActionStatus", foreign_keys=[individual_status_id], lazy="selectin")
    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None
    
    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "action_id": str(self.action_id),
            "individual_status_id": str(self.individual_status_id) if self.individual_status_id else None,
            "status_name": self.individual_status.name if self.individual_status else None,
            "status_code": self.individual_status.code if self.individual_status else None,
            "progress_percentage": self.progress_percentage,
            "remarks": self.remarks,
            "created_by_name": self.created_by_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def __repr__(self) -> str:
        return f"<ActionStatusHistory id={self.id} action_id={self.action_id}>"
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
    
    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "action_id": str(self.action_id),
            "comment": self.comment,
            "attachment_url": self.attachment_url,
            "created_by_name": self.created_by_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self) -> str:
        return f"<ActionComment id={self.id} comment='{self.comment[:50]}'>"
class ActionImplementer(Base):
    """
    A person implementing a MeetingAction. Mirrors MeetingParticipant's
    shape (name/email/telephone as free-text, with an optional link to a
    real User) since an implementer may or may not be a system user —
    the frontend's "Person(s) Implementing" table allows picking a known
    user OR typing a name/phone/email manually.

    The full list is replaced wholesale on every action update (see CRUD),
    so this table intentionally stays lightweight — no soft-delete flag,
    no full audit trail, just enough to render the table and re-derive it
    on save.
    """
    __tablename__ = "action_implementers"
    __table_args__ = (
        Index('ix_action_implementers_action_id', 'action_id'),
        Index('ix_action_implementers_user_id', 'user_id'),
    )

    id = Column(CustomUUID, primary_key=True, default=uuid4)
    action_id = Column(
        CustomUUID, ForeignKey('meeting_actions.id', ondelete='CASCADE'), nullable=False
    )

    # Optional link to a real user (populated when picked via AssignToSelector)
    user_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    action = relationship("MeetingAction", back_populates="implementers")
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
        }

    def __repr__(self) -> str:
        return f"<ActionImplementer id={self.id} name='{self.name}' action_id={self.action_id}>"
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
    
    title = Column(String(500), nullable=True)  # Document title/name
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
    
    # OCR fields
    ocr_text = Column(Text, nullable=True)
    ocr_processed_at = Column(DateTime(timezone=True), nullable=True)
    ocr_language = Column(String(10), nullable=True)
    
    # Relationships
    meeting = relationship("Meeting", back_populates="documents")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id], lazy="selectin")
    document_type = relationship("Attribute", foreign_keys=[document_type_id], lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="selectin")
    
    # ============ User Name Properties ============
    
    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.username if self.created_by else None
    
    @property
    def updated_by_name(self) -> Optional[str]:
        return self.updated_by.username if self.updated_by else None
    
    @property
    def uploaded_by_name(self) -> Optional[str]:
        return self.uploaded_by.username if self.uploaded_by else None
    # ============ Document Type Properties ============
    
    @property
    def document_type_name(self) -> str:
        if self.document_type:
            if hasattr(self.document_type, 'name') and self.document_type.name:
                return self.document_type.name
            if hasattr(self.document_type, 'extra_metadata') and self.document_type.extra_metadata:
                metadata = self.document_type.extra_metadata
                if isinstance(metadata, dict) and 'display_name' in metadata:
                    return metadata['display_name']
        return "General Document"
    
    @property
    def document_type_code(self) -> Optional[str]:
        if self.document_type:
            if hasattr(self.document_type, 'code') and self.document_type.code:
                code = self.document_type.code
                if code.startswith('DOC_TYPE_'):
                    return code[9:]
                return code
            if hasattr(self.document_type, 'extra_metadata') and self.document_type.extra_metadata:
                metadata = self.document_type.extra_metadata
                if isinstance(metadata, dict) and 'code' in metadata:
                    return metadata['code']
        return None
    
    @property
    def document_type_short_name(self) -> Optional[str]:
        if self.document_type and hasattr(self.document_type, 'short_name'):
            return self.document_type.short_name
        return self.document_type_name[:20] if self.document_type_name else None
    
    @property
    def document_type_icon(self) -> Optional[str]:
        if self.document_type and hasattr(self.document_type, 'extra_metadata'):
            metadata = self.document_type.extra_metadata
            if isinstance(metadata, dict) and 'icon' in metadata:
                return metadata['icon']
        if self.mime_type:
            if self.mime_type == 'application/pdf':
                return 'pdf'
            if self.mime_type.startswith('image/'):
                return 'image'
        return 'document'
    
    @property
    def document_type_color(self) -> Optional[str]:
        if self.document_type and hasattr(self.document_type, 'extra_metadata'):
            metadata = self.document_type.extra_metadata
            if isinstance(metadata, dict) and 'color' in metadata:
                return metadata['color']
        if self.document_type_code:
            color_map = {
                'AGENDA': '#3b82f6',
                'MINUTES': '#10b981',
                'PRESENTATION': '#f59e0b',
                'REPORT': '#8b5cf6',
                'ATTACHMENT': '#6b7280',
            }
            return color_map.get(self.document_type_code, '#6b7280')
        return '#6b7280'
    # ============ File Properties ============
    
    @property
    def file_url(self) -> Optional[str]:
        if self.id:
            return f"/api/v1/action-tracker/documents/document/{self.id}/download"
        return None
    
    @property
    def file_extension(self) -> str:
        if self.file_name and '.' in self.file_name:
            return self.file_name.rsplit('.', 1)[-1].lower()
        return 'unknown'
    
    @property
    def file_size_formatted(self) -> str:
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
        return self.mime_type and self.mime_type.startswith('image/')
    
    @property
    def is_pdf(self) -> bool:
        return self.mime_type == 'application/pdf' or self.file_extension == 'pdf'
    
    @property
    def is_previewable(self) -> bool:
        return self.is_pdf or self.is_image
    
    @property
    def thumbnail_url(self) -> Optional[str]:
        if self.is_image and self.id:
            return f"/api/v1/action-tracker/documents/document/{self.id}/thumbnail"
        return None
    # ============ Document Information ============
    
    @property
    def display_title(self) -> str:
        if self.title:
            return self.title
        if self.file_name:
            return self.file_name.replace(f'.{self.file_extension}', '')
        return 'Untitled Document'
    
    @property
    def version_display(self) -> str:
        return f"v{self.version}"
    
    @property
    def uploaded_at_formatted(self) -> str:
        if self.uploaded_at:
            return self.uploaded_at.strftime("%Y-%m-%d %H:%M:%S")
        return "Unknown"
    
    @property
    def uploaded_at_relative(self) -> str:
        if not self.uploaded_at:
            return "Unknown"
        
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
        return f"<MeetingDocument {self.display_title} (meeting: {self.meeting_id})>"
# ==================== Helper Methods for Eager Loading ====================
from sqlalchemy import select
from sqlalchemy.orm import selectinload
class MeetingQuery:
    """Helper class for common meeting queries with eager loading"""
    
    @staticmethod
    def get_with_all_relations() -> select:
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
    def get_with_minutes_and_actions() -> select:
        """Returns a query with minutes and actions loaded"""
        return select(Meeting).options(
            selectinload(Meeting.minutes).selectinload(MeetingMinutes.actions)
        )
    
    @staticmethod
    def get_with_audit_info() -> select:
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
              ActionComment, Participant, ParticipantList, ActionStatus,
              ActionImplementer]:
    model.__allow_unmapped__ = True