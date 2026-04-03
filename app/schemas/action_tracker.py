from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime

# ==================== Participant Schemas ====================

class ParticipantBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    telephone: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=255)
    organization: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    notes: Optional[str] = None

class ParticipantResponse(ParticipantBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# ==================== Participant List Schemas ====================

class ParticipantListBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_global: bool = False

class ParticipantListCreate(ParticipantListBase):
    participant_ids: List[UUID] = Field(default_factory=list)

class ParticipantListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_global: Optional[bool] = None
    participant_ids: Optional[List[UUID]] = None

class ParticipantListResponse(ParticipantListBase):
    id: UUID
    created_by_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    participants: List[ParticipantResponse] = Field(default_factory=list)
    participant_count: int = 0
    
    class Config:
        from_attributes = True

# ==================== Meeting Participant Schemas ====================

class MeetingParticipantBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    is_chairperson: bool = False

class MeetingParticipantCreate(MeetingParticipantBase):
    pass

class MeetingParticipantResponse(MeetingParticipantBase):
    id: UUID
    meeting_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True

# ==================== Meeting Schemas ====================

class MeetingBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    location_id: Optional[UUID] = None
    location_text: Optional[str] = Field(None, max_length=500)
    gps_coordinates: Optional[str] = Field(None, max_length=100)
    meeting_date: datetime
    start_time: datetime
    end_time: Optional[datetime] = None
    agenda: Optional[str] = None
    facilitator: Optional[str] = Field(None, max_length=255)
    chairperson_name: Optional[str] = Field(None, max_length=255)
    status_id: Optional[UUID] = None
    
    @field_validator('end_time')
    @classmethod
    def validate_end_time(cls, v, info):
        if v and info.data.get('start_time') and v <= info.data['start_time']:
            raise ValueError('End time must be after start time')
        return v

class MeetingCreate(MeetingBase):
    participant_list_id: Optional[UUID] = None
    custom_participants: List[MeetingParticipantCreate] = Field(default_factory=list)

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location_id: Optional[UUID] = None
    location_text: Optional[str] = None
    gps_coordinates: Optional[str] = None
    meeting_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    agenda: Optional[str] = None
    facilitator: Optional[str] = None
    chairperson_name: Optional[str] = None
    status_id: Optional[UUID] = None
    is_active: Optional[bool] = None

# ==================== NEW: Simplified Meeting Response for Lists ====================

# In app/schemas/action_tracker.py - add this

class MeetingCreateResponse(BaseModel):
    """Simplified response for meeting creation - NO relationships"""
    id: UUID
    title: str
    description: Optional[str] = None
    meeting_date: datetime
    start_time: datetime
    end_time: Optional[datetime] = None
    location_text: Optional[str] = None
    agenda: Optional[str] = None
    facilitator: Optional[str] = None
    chairperson_name: Optional[str] = None
    status_id: Optional[UUID] = None
    created_by_id: UUID
    created_at: datetime
    is_active: bool
    message: str = "Meeting created successfully"
    
    class Config:
        from_attributes = True
        
# app/schemas/action_tracker.py

class MeetingListResponse(BaseModel):
    """Simplified meeting response for list views - NO relationships"""
    id: UUID
    title: str
    description: Optional[str] = None
    location_id: Optional[UUID] = None
    location_text: Optional[str] = None
    gps_coordinates: Optional[str] = None
    meeting_date: datetime
    start_time: datetime
    end_time: Optional[datetime] = None
    agenda: Optional[str] = None
    facilitator: Optional[str] = None
    chairperson_name: Optional[str] = None
    status_id: Optional[UUID] = None
    created_by_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool
    status_name: Optional[str] = None
    location_name: Optional[str] = None
    participants_count: int = 0
    minutes_count: int = 0
    actions_count: int = 0
    documents_count: int = 0
    
    class Config:
        from_attributes = True    
# ==================== Full Meeting Response for Detail View ====================

class MeetingResponse(MeetingBase):
    """Full meeting response for detail view (includes participants)"""
    id: UUID
    created_by_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool
    status_name: Optional[str] = None
    location_name: Optional[str] = None
    participants: List[MeetingParticipantResponse] = Field(default_factory=list)
    minutes: List['MeetingMinutesResponse'] = Field(default_factory=list)
    documents: List['MeetingDocumentResponse'] = Field(default_factory=list)
    
    # Computed fields
    participants_count: int = Field(default=0)
    minutes_count: int = Field(default=0)
    actions_count: int = Field(default=0)
    documents_count: int = Field(default=0)
    
    class Config:
        from_attributes = True
    
    @model_validator(mode='after')
    def compute_counts(self) -> 'MeetingResponse':
        """Compute counts from loaded relationships"""
        self.participants_count = len(self.participants) if self.participants else 0
        self.minutes_count = len(self.minutes) if self.minutes else 0
        self.documents_count = len(self.documents) if self.documents else 0
        
        # Count actions from minutes
        if self.minutes:
            self.actions_count = sum(len(m.actions) for m in self.minutes if hasattr(m, 'actions'))
        
        return self

# ==================== Meeting Minutes Schemas ====================

class MeetingMinutesBase(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    discussion: Optional[str] = None
    decisions: Optional[str] = None

class MeetingMinutesCreate(MeetingMinutesBase):
    pass

class MeetingMinutesUpdate(BaseModel):
    topic: Optional[str] = None
    discussion: Optional[str] = None
    decisions: Optional[str] = None

class MeetingMinutesResponse(MeetingMinutesBase):
    id: UUID
    meeting_id: UUID
    timestamp: datetime
    recorded_by_id: Optional[UUID] = None
    recorded_by_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    actions: List['MeetingActionResponse'] = Field(default_factory=list)
    
    class Config:
        from_attributes = True

# ==================== Meeting Action Schemas ====================

class MeetingActionBase(BaseModel):
    description: str = Field(..., min_length=1)
    assigned_to_id: Optional[UUID] = None
    assigned_to_name: Optional[str] = Field(None, max_length=255)
    due_date: Optional[datetime] = None
    priority: int = Field(2, ge=1, le=4)
    estimated_hours: Optional[float] = Field(None, ge=0)
    remarks: Optional[str] = None

class MeetingActionCreate(MeetingActionBase):
    pass

class MeetingActionUpdate(BaseModel):
    description: Optional[str] = None
    assigned_to_id: Optional[UUID] = None
    assigned_to_name: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[int] = Field(None, ge=1, le=4)
    estimated_hours: Optional[float] = None
    overall_status_id: Optional[UUID] = None
    overall_progress_percentage: Optional[int] = Field(None, ge=0, le=100)
    remarks: Optional[str] = None

class MeetingActionResponse(MeetingActionBase):
    id: UUID
    minute_id: UUID
    assigned_by_id: Optional[UUID] = None
    assigned_by_name: Optional[str] = None
    assigned_at: datetime
    start_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    overall_status_id: Optional[UUID] = None
    overall_status_name: Optional[str] = None
    overall_progress_percentage: int = 0
    actual_hours: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# ==================== Action Status History Schemas ====================

class ActionStatusHistoryBase(BaseModel):
    individual_status_id: UUID
    progress_percentage: int = Field(0, ge=0, le=100)
    remarks: Optional[str] = None

class ActionStatusHistoryCreate(ActionStatusHistoryBase):
    pass

class ActionStatusHistoryResponse(ActionStatusHistoryBase):
    id: UUID
    action_id: UUID
    updated_by_id: UUID
    updated_by_name: Optional[str] = None
    individual_status_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# ==================== Action Progress Update Schema ====================

class ActionProgressUpdate(BaseModel):
    """User submits their progress update"""
    progress_percentage: int = Field(..., ge=0, le=100, description="Self-assessed progress")
    individual_status_id: UUID = Field(..., description="User's status")
    remarks: str = Field(..., min_length=1, description="What was accomplished")
    
    @model_validator(mode='after')
    def validate_progress_and_status(self):
        if self.progress_percentage == 100:
            pass
        elif self.progress_percentage > 0 and self.progress_percentage < 100:
            pass
        return self

# ==================== Action Comment Schemas ====================

class ActionCommentBase(BaseModel):
    comment: str = Field(..., min_length=1)
    attachment_url: Optional[str] = None

class ActionCommentCreate(ActionCommentBase):
    pass

class ActionCommentResponse(ActionCommentBase):
    id: UUID
    action_id: UUID
    created_by_id: UUID
    created_by_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# ==================== Meeting Document Schemas ====================

class MeetingDocumentBase(BaseModel):
    file_name: str = Field(..., max_length=500)
    document_type_id: UUID = Field(..., description="Document type from attribute values")
    description: Optional[str] = None

class MeetingDocumentCreate(MeetingDocumentBase):
    pass

class MeetingDocumentUpdate(BaseModel):
    document_type_id: Optional[UUID] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class MeetingDocumentResponse(MeetingDocumentBase):
    id: UUID
    meeting_id: UUID
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    version: int = 1
    document_type_name: Optional[str] = None
    uploaded_by_id: UUID
    uploaded_by_name: Optional[str] = None
    uploaded_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

# ==================== Dashboard Summary Schemas ====================

class MeetingSummary(BaseModel):
    total_meetings: int
    meetings_by_status: dict = Field(default_factory=dict)
    upcoming_meetings: int
    completed_meetings: int
    pending_actions: int
    overdue_actions: int

class ActionSummary(BaseModel):
    total_actions: int
    completed_actions: int
    in_progress_actions: int
    pending_actions: int
    overdue_actions: int
    blocked_actions: int
    completion_rate: float = 0.0
    
    @model_validator(mode='after')
    def calculate_rate(self):
        if self.total_actions > 0:
            self.completion_rate = round((self.completed_actions / self.total_actions) * 100, 2)
        return self

class MyTaskResponse(BaseModel):
    """Tasks assigned to current user"""
    id: UUID
    description: str
    meeting_title: str
    meeting_date: datetime
    due_date: Optional[datetime] = None
    overall_progress_percentage: int
    overall_status_name: Optional[str] = None
    priority: int
    is_overdue: bool = False
    
    class Config:
        from_attributes = True

# Update forward references
MeetingMinutesResponse.model_rebuild()
MeetingResponse.model_rebuild()