# app/schemas/meeting_recording.py

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from enum import Enum


class RecordingType(str, Enum):
    VIDEO = "video"
    AUDIO = "audio"


class RecordingStatus(str, Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DELETED = "deleted"


class RecordingCreate(BaseModel):
    """Schema for creating a new recording"""
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    category: str = Field("meeting")
    recording_type: RecordingType = RecordingType.VIDEO
    duration: int = Field(0, ge=0)
    quality: Optional[str] = None
    format: Optional[str] = None
    is_public: bool = False


class RecordingUpdate(BaseModel):
    """Schema for updating a recording"""
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None


class RecordingResponse(BaseModel):
    """Schema for recording response"""
    id: UUID
    meeting_id: UUID
    title: str
    description: Optional[str] = None
    category: str
    recording_type: RecordingType
    file_name: str
    file_size: int
    mime_type: str
    duration: int
    quality: Optional[str] = None
    format: Optional[str] = None
    status: RecordingStatus
    has_thumbnail: bool
    view_count: int
    download_count: int
    is_public: bool
    share_token: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    url: Optional[str] = None  # URL to access/download the recording
    
    model_config = ConfigDict(from_attributes=True)


class RecordingListResponse(BaseModel):
    """Response schema for list of recordings"""
    items: List[RecordingResponse]
    total: int
    page: int
    size: int
    pages: int