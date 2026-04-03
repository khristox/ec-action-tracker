"""
Action Tracker Models - Import order matters for Foreign Keys
Make sure this file is imported AFTER users, locations, and attribute tables
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Integer, Float, Index, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.db.types import UUID as CustomUUID
from uuid import uuid4

# ==================== Association Tables (No Foreign Key issues) ====================

participant_list_members = Table(
    'participant_list_members',
    Base.metadata,
    Column('participant_list_id', CustomUUID, ForeignKey('participant_lists.id', ondelete='CASCADE'), primary_key=True),
    Column('participant_id', CustomUUID, ForeignKey('participants.id', ondelete='CASCADE'), primary_key=True),
    Column('added_at', DateTime(timezone=True), server_default=func.now()),
    Index('ix_plm_list_id', 'participant_list_id'),
    Index('ix_plm_participant_id', 'participant_id')
)

# ==================== Main Models (Ordered by dependencies) ====================

class Participant(Base):
    """Independent - no foreign keys to other action tracker tables"""
    __tablename__ = "participants"
    __table_args__ = (
        Index('ix_participants_name', 'name'),
        Index('ix_participants_email', 'email'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    telephone = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    organization = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    created_by = relationship("User", foreign_keys=[created_by_id])
    participant_lists = relationship("ParticipantList", secondary=participant_list_members, back_populates="participants")


class ParticipantList(Base):
    """Depends on Participant and User"""
    __tablename__ = "participant_lists"
    __table_args__ = (
        Index('ix_participant_lists_name', 'name'),
        Index('ix_participant_lists_created_by', 'created_by_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_global = Column(Boolean, default=False)
    
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    created_by = relationship("User", foreign_keys=[created_by_id])
    participants = relationship("Participant", secondary=participant_list_members, back_populates="participant_lists")


class Meeting(Base):
    """Depends on Location, User, AttributeValue"""
    __tablename__ = "meetings"
    __table_args__ = (
        Index('ix_meetings_title', 'title'),
        Index('ix_meetings_meeting_date', 'meeting_date'),
        Index('ix_meetings_status_id', 'status_id'),
        Index('ix_meetings_created_by', 'created_by_id'),
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
    
    # Foreign key to attribute_values table
    status_id = Column(CustomUUID, ForeignKey('attribute_values.id', ondelete='SET NULL'), nullable=True)
    
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    location = relationship("Location")
    created_by = relationship("User", foreign_keys=[created_by_id])
    status = relationship("AttributeValue", foreign_keys=[status_id])


class MeetingParticipant(Base):
    """Depends on Meeting"""
    __tablename__ = "meeting_participants"
    __table_args__ = (
        Index('ix_mp_meeting_id', 'meeting_id'),
        Index('ix_mp_name', 'name'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    meeting_id = Column(CustomUUID, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    telephone = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    organization = Column(String(255), nullable=True)
    is_chairperson = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    meeting = relationship("Meeting", back_populates="participants")


class MeetingMinutes(Base):
    """Depends on Meeting and User"""
    __tablename__ = "meeting_minutes"
    __table_args__ = (
        Index('ix_mm_meeting_id', 'meeting_id'),
        Index('ix_mm_timestamp', 'timestamp'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    meeting_id = Column(CustomUUID, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    
    topic = Column(String(500), nullable=False)
    discussion = Column(Text, nullable=True)
    decisions = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    recorded_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    meeting = relationship("Meeting", back_populates="minutes")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])


class MeetingAction(Base):
    """Depends on MeetingMinutes, User, AttributeValue"""
    __tablename__ = "meeting_actions"
    __table_args__ = (
        Index('ix_ma_minute_id', 'minute_id'),
        Index('ix_ma_assigned_to', 'assigned_to_id'),
        Index('ix_ma_due_date', 'due_date'),
        Index('ix_ma_priority', 'priority'),
        Index('ix_ma_overall_status_id', 'overall_status_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    minute_id = Column(CustomUUID, ForeignKey('meeting_minutes.id', ondelete='CASCADE'), nullable=False)
    
    description = Column(Text, nullable=False)
    
    assigned_to_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    assigned_to_name = Column(String(255), nullable=True)
    assigned_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    
    due_date = Column(DateTime(timezone=True), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Foreign key to attribute_values table
    overall_status_id = Column(CustomUUID, ForeignKey('attribute_values.id', ondelete='SET NULL'), nullable=True)
    overall_progress_percentage = Column(Integer, default=0)
    
    priority = Column(Integer, default=2)
    
    estimated_hours = Column(Float, nullable=True)
    actual_hours = Column(Float, nullable=True)
    
    remarks = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    minutes = relationship("MeetingMinutes", back_populates="actions")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    overall_status = relationship("AttributeValue", foreign_keys=[overall_status_id])


class ActionStatusHistory(Base):
    """Depends on MeetingAction, User, AttributeValue"""
    __tablename__ = "action_status_history"
    __table_args__ = (
        Index('ix_ash_action_id', 'action_id'),
        Index('ix_ash_created_at', 'created_at'),
        Index('ix_ash_updated_by', 'updated_by_id'),
        Index('ix_ash_individual_status_id', 'individual_status_id'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    action_id = Column(CustomUUID, ForeignKey('meeting_actions.id', ondelete='CASCADE'), nullable=False)
    
    # FIXED: Foreign key to attribute_values, not attributes
    individual_status_id = Column(CustomUUID, ForeignKey('attribute_values.id', ondelete='SET NULL'), nullable=True)
    progress_percentage = Column(Integer, default=0)
    remarks = Column(Text, nullable=True)
    
    # FIXED: nullable=True to match SET NULL constraint
    updated_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    action = relationship("MeetingAction", back_populates="status_history")
    updated_by = relationship("User", foreign_keys=[updated_by_id])
    individual_status = relationship("AttributeValue", foreign_keys=[individual_status_id])


class ActionComment(Base):
    """Depends on MeetingAction and User"""
    __tablename__ = "action_comments"
    __table_args__ = (
        Index('ix_ac_action_id', 'action_id'),
        Index('ix_ac_created_by', 'created_by_id'),
        Index('ix_ac_created_at', 'created_at'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    action_id = Column(CustomUUID, ForeignKey('meeting_actions.id', ondelete='CASCADE'), nullable=False)
    
    comment = Column(Text, nullable=False)
    attachment_url = Column(String(1000), nullable=True)
    
    # FIXED: nullable=True to match SET NULL constraint
    created_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    action = relationship("MeetingAction", back_populates="comments")
    created_by = relationship("User", foreign_keys=[created_by_id])


class MeetingDocument(Base):
    """Depends on Meeting, User, AttributeValue"""
    __tablename__ = "meeting_documents"
    __table_args__ = (
        Index('ix_md_meeting_id', 'meeting_id'),
        Index('ix_md_document_type_id', 'document_type_id'),
        Index('ix_md_uploaded_by', 'uploaded_by_id'),
        Index('ix_md_uploaded_at', 'uploaded_at'),
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid4)
    meeting_id = Column(CustomUUID, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    
    # Foreign key to attribute_values table
    document_type_id = Column(CustomUUID, ForeignKey('attribute_values.id', ondelete='SET NULL'), nullable=True)
    
    description = Column(Text, nullable=True)
    version = Column(Integer, default=1)
    
    # nullable=True to match SET NULL constraint
    uploaded_by_id = Column(CustomUUID, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    meeting = relationship("Meeting", back_populates="documents")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
    document_type = relationship("AttributeValue", foreign_keys=[document_type_id])


# Add back_populates relationships that couldn't be defined earlier
Meeting.participants = relationship("MeetingParticipant", back_populates="meeting", cascade="all, delete-orphan")
Meeting.minutes = relationship("MeetingMinutes", back_populates="meeting", cascade="all, delete-orphan")
Meeting.documents = relationship("MeetingDocument", back_populates="meeting", cascade="all, delete-orphan")
MeetingMinutes.actions = relationship("MeetingAction", back_populates="minutes", cascade="all, delete-orphan")
MeetingAction.status_history = relationship("ActionStatusHistory", back_populates="action", cascade="all, delete-orphan")
MeetingAction.comments = relationship("ActionComment", back_populates="action", cascade="all, delete-orphan")