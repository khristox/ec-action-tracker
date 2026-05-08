# app/models/meeting_recording.py

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, Enum, ForeignKey
from sqlalchemy.dialects.mysql import LONGBLOB
from datetime import datetime
import uuid
import enum

from app.db.base_class import Base

class RecordingType(str, enum.Enum):
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"

class RecordingStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    DELETED = "DELETED"

class MeetingRecording(Base):
    __tablename__ = "meeting_recordings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Basic info
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), default="meeting")
    recording_type = Column(Enum(RecordingType), default=RecordingType.VIDEO)
    
    # File storage - using file_data for simplicity
    file_data = Column(LONGBLOB, nullable=True)
    file_name = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=True)
    
    # Recording metadata
    duration = Column(Integer, default=0)
    quality = Column(String(50), nullable=True)
    format = Column(String(20), default="webm")
    
    # Status and tracking
    status = Column(Enum(RecordingStatus), default=RecordingStatus.PROCESSING)
    view_count = Column(Integer, default=0)
    download_count = Column(Integer, default=0)
    
    # Sharing and permissions
    is_public = Column(Boolean, default=False)
    share_token = Column(String(100), nullable=True, unique=True)
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    updated_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)
    deleted_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<MeetingRecording {self.title}>"