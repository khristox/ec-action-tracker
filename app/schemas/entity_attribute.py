from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
import uuid

# ==================== Meeting Status History Schemas ====================

class MeetingStatusHistoryBase(BaseModel):
    """Base schema for tracking meeting status transitions"""
    status_id: uuid.UUID = Field(..., description="ID of the status attribute")
    comment: Optional[str] = Field(None, description="Optional remarks for this status change")
    status_date: datetime = Field(default_factory=datetime.now)

class MeetingStatusHistoryCreate(MeetingStatusHistoryBase):
    meeting_id: uuid.UUID
    updated_by_id: Optional[uuid.UUID] = None

class MeetingStatusUpdate(BaseModel):
    """Schema used when the user explicitly triggers a status change"""
    status_id: uuid.UUID
    comment: Optional[str] = Field(None, description="Why is the status changing?")

class MeetingStatusHistoryResponse(MeetingStatusHistoryBase):
    id: uuid.UUID
    meeting_id: uuid.UUID
    updated_by_id: Optional[uuid.UUID] = None
    # If joined in CRUD, these provide human-readable info
    status_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# ==================== Participant Schemas ====================

class ParticipantBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    notes: Optional[str] = None

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    notes: Optional[str] = None

class ParticipantResponse(ParticipantBase):
    id: uuid.UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# ==================== Meeting Schemas ====================

class MeetingParticipantSchema(BaseModel):
    """Used for nested participant creation within a meeting"""
    name: str
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    is_chairperson: bool = False

class MeetingBase(BaseModel):
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    location_id: Optional[uuid.UUID] = None
    location_text: Optional[str] = None
    meeting_date: datetime
    start_time: datetime
    end_time: Optional[datetime] = None
    agenda: Optional[str] = None
    facilitator: Optional[str] = None
    chairperson_name: Optional[str] = None
    status_id: Optional[uuid.UUID] = None

class MeetingCreate(MeetingBase):
    participant_list_id: Optional[uuid.UUID] = None
    custom_participants: List[MeetingParticipantSchema] = []

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location_id: Optional[uuid.UUID] = None
    location_text: Optional[str] = None
    status_id: Optional[uuid.UUID] = None
    # Including comment here allows the history table to be populated during a standard update
    status_comment: Optional[str] = None 
    status_date: Optional[datetime] = Field(default_factory=datetime.now)

class MeetingResponse(MeetingBase):
    id: uuid.UUID
    created_by_id: Optional[uuid.UUID] = None
    is_active: bool
    created_at: datetime
    
    # Relationships
    participants: List[MeetingParticipantSchema] = []
    # 🟢 Added status history to the detailed response
    status_history: List[MeetingStatusHistoryResponse] = [] 

    model_config = ConfigDict(from_attributes=True)

# ==================== Action Schemas ====================

class ActionProgressUpdate(BaseModel):
    individual_status_id: uuid.UUID
    progress_percentage: int = Field(..., ge=0, le=100)
    remarks: Optional[str] = None

class MeetingActionBase(BaseModel):
    description: str
    assigned_to_id: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None
    priority: int = 2
    overall_status_id: Optional[uuid.UUID] = None

class MeetingActionCreate(MeetingActionBase):
    pass

class MeetingActionUpdate(BaseModel):
    description: Optional[str] = None
    assigned_to_id: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None
    overall_status_id: Optional[uuid.UUID] = None
    overall_progress_percentage: Optional[int] = None

class ActionCommentCreate(BaseModel):
    comment: str
    attachment_url: Optional[str] = None

# ==================== Document Schemas ====================

class MeetingDocumentBase(BaseModel):
    file_name: str
    document_type_id: Optional[uuid.UUID] = None
    description: Optional[str] = None

class MeetingDocumentCreate(MeetingDocumentBase):
    pass

class MeetingDocumentUpdate(BaseModel):
    description: Optional[str] = None
    is_active: bool = True

# ==================== Minutes Schemas ====================

class MeetingMinutesBase(BaseModel):
    topic: str
    discussion: Optional[str] = None
    decisions: Optional[str] = None

class MeetingMinutesCreate(MeetingMinutesBase):
    pass

class MeetingMinutesUpdate(MeetingMinutesBase):
    pass