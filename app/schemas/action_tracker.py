from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from typing import Optional, List, Any, Dict, Union
from uuid import UUID
from datetime import datetime

from app.schemas.meeting_minutes.meeting_minutes import MeetingMinutesResponse



# ==================== Shared Config ====================

class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ==================== Assigned To JSON Schema ====================

class AssignedToInfo(BaseModel):
    """Schema for assigned_to JSON data stored in meeting_actions"""
    name: str = Field(..., description="Name of the assigned person")
    email: Optional[str] = Field(None, description="Email of the assigned person")
    type: str = Field("manual", description="Type: user, participant, manual")
    id: Optional[UUID] = Field(None, description="User ID if exists in system")
    
    model_config = ConfigDict(from_attributes=True)




# ==================== Meeting Participant Schemas ====================

class MeetingParticipantBase(ORMBase):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    is_chairperson: bool = False
    attendance_status: Optional[str] = Field("pending", description="attended, missed, pending, excused")


class MeetingParticipantCreate(MeetingParticipantBase):
    pass


class MeetingParticipantUpdate(ORMBase):
    name: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    is_chairperson: Optional[bool] = None
    attendance_status: Optional[str] = None


class MeetingParticipantResponse(MeetingParticipantBase):
    id: UUID
    meeting_id: UUID
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True


# ==================== Attribute Response Schema ====================

class AttributeResponse(ORMBase):
    """Schema for Attribute objects returned in responses"""
    id: UUID
    code: Optional[str] = None
    name: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    extra_metadata: Optional[dict] = None
    
    # Optional fields for UI
    color: Optional[str] = None
    sort_order: Optional[int] = None


# ==================== Meeting Schemas ====================

class MeetingBase(ORMBase):
    """
    Input-only base. Does NOT include `status` as a field because responses
    receive an ORM Attribute object there, not a string.
    """
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

    @field_validator('end_time', mode='before')
    @classmethod
    def validate_end_time(cls, v: Any, info: Any) -> Any:
        if isinstance(v, str):
            try:
                v = datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                raise ValueError('Invalid datetime format for end_time')
        
        start_time = info.data.get('start_time')
        if start_time and v:
            if isinstance(start_time, str):
                try:
                    start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                except ValueError:
                    raise ValueError('Invalid datetime format for start_time')
            if v <= start_time:
                raise ValueError('End time must be after start time')
        return v


class MeetingCreate(MeetingBase):
    status: Optional[str] = None
    participant_list_id: Optional[UUID] = None
    custom_participants: List[MeetingParticipantCreate] = Field(default_factory=list)


class MeetingUpdate(ORMBase):
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
    status: Optional[str] = Field(
        None, description="Meeting status slug e.g. pending/started/ended/closed/cancelled"
    )
    is_active: Optional[bool] = None
    status_comment: Optional[str] = Field(None, description="Comment explaining the status change")
    status_date: Optional[datetime] = Field(None, description="Effective date of the status change")


# ==================== Meeting Responses ====================

class MeetingCreateResponse(ORMBase):
    """Flat response returned after POST /meetings"""
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
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    message: str = "Meeting created successfully"

    model_config = ConfigDict(from_attributes=True)



class MeetingListResponse(ORMBase):
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
    status: Optional[AttributeResponse] = None
    created_by_id: UUID
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    location_name: Optional[str] = None
    participants_count: int = 0
    minutes_count: int = 0
    actions_count: int = 0
    documents_count: int = 0


class MeetingResponse(MeetingBase):
    """Full detail response with nested relationships"""
    id: UUID
    created_by_id: UUID
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    status_comment: Optional[str] = None
    status_date: Optional[datetime] = None
    status_name: Optional[str] = None
    location_name: Optional[str] = None
    status: Optional[AttributeResponse] = None
    participants: List[MeetingParticipantResponse] = Field(default_factory=list)
    minutes: List['MeetingMinutesResponse'] = Field(default_factory=list)
    documents: List['MeetingDocumentResponse'] = Field(default_factory=list)

    @field_validator('status', mode='before')
    @classmethod
    def coerce_status(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        try:
            return {
                'id': getattr(v, 'id', None),
                'code': getattr(v, 'code', None),
                'name': getattr(v, 'name', None),
                'short_name': getattr(v, 'short_name', None),
                'description': getattr(v, 'description', None),
                'extra_metadata': getattr(v, 'extra_metadata', None),
            }
        except Exception:
            return None

    @model_validator(mode='after')
    def sync_status_name(self) -> 'MeetingResponse':
        if self.status and not self.status_name:
            self.status_name = self.status.name
        return self


class MeetingPaginationResponse(ORMBase):
    items: List[MeetingListResponse]
    total: int
    page: int
    size: int
    pages: int = 0




# ==================== Action Status History Schemas ====================

class ActionStatusHistoryBase(ORMBase):
    individual_status_id: UUID
    progress_percentage: int = Field(0, ge=0, le=100)
    remarks: Optional[str] = None


class ActionStatusHistoryCreate(ActionStatusHistoryBase):
    pass


class ActionStatusHistoryResponse(ActionStatusHistoryBase):
    id: UUID
    action_id: UUID
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    individual_status_name: Optional[str] = None
    is_active: bool = True


# ==================== Action Progress Update Schema ====================

class ActionProgressUpdate(ORMBase):
    progress_percentage: int = Field(..., ge=0, le=100)
    individual_status_id: UUID
    remarks: str = Field(..., min_length=1)


# ==================== Action Comment Schemas ====================

class ActionCommentBase(ORMBase):
    comment: str = Field(..., min_length=1)
    attachment_url: Optional[str] = None


class ActionCommentCreate(ActionCommentBase):
    pass


class ActionCommentUpdate(ORMBase):
    comment: Optional[str] = None
    attachment_url: Optional[str] = None
    is_active: Optional[bool] = None


class ActionCommentResponse(ActionCommentBase):
    id: UUID
    action_id: UUID
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True


# ==================== Meeting Document Schemas ====================

class MeetingDocumentBase(ORMBase):
    file_name: str = Field(..., max_length=500)
    document_type_id: UUID = Field(..., description="Document type attribute value UUID")
    description: Optional[str] = None


class MeetingDocumentCreate(BaseModel):
    """Schema for creating a meeting document"""
    file_name: str
    title: str
    description: Optional[str] = None
    document_type: Optional[str] = "attachment" 
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    
    class Config:
        from_attributes = True


class MeetingDocumentUpdate(ORMBase):
    document_type_id: Optional[UUID] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class MeetingDocumentResponse(MeetingDocumentBase):
    id: UUID
    meeting_id: UUID
    file_path: str
    file_name: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    description: Optional[str] = None
    document_type_id: Optional[UUID] = None 
    document_type_name: Optional[str] = None  # ← Add this field

    version: int = 1
    document_type_name: Optional[str] = None
    uploaded_by_id: Optional[UUID] = None
    uploaded_by_name: Optional[str] = None
    uploaded_at: datetime
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True


# ==================== Meeting Status History Schemas ====================

class MeetingStatusHistoryResponse(ORMBase):
    """Response schema for meeting status history"""
    id: UUID
    meeting_id: UUID
    status_id: Optional[UUID] = None
    status_name: Optional[str] = None
    status_code: Optional[str] = None
    status_shortname: Optional[str] = None
    comment: Optional[str] = None
    status_date: datetime
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True


# ==================== Dashboard Summary Schemas ====================

class MeetingSummary(ORMBase):
    total_meetings: int
    meetings_by_status: dict = Field(default_factory=dict)
    upcoming_meetings: int
    completed_meetings: int
    pending_actions: int
    overdue_actions: int


class ActionSummary(ORMBase):
    total_actions: int
    completed_actions: int
    in_progress_actions: int
    pending_actions: int
    overdue_actions: int
    blocked_actions: int
    completion_rate: float = 0.0

    @model_validator(mode='after')
    def calculate_rate(self) -> 'ActionSummary':
        if self.total_actions > 0:
            self.completion_rate = round(
                (self.completed_actions / self.total_actions) * 100, 2
            )
        return self


class MyTaskResponse(ORMBase):
    id: UUID
    description: str
    meeting_title: str
    meeting_date: Optional[datetime] = None  # ✅ Make it optional
    due_date: Optional[datetime] = None
    overall_progress_percentage: int = 0
    overall_status_name: Optional[str] = None
    priority: int = 2
    is_overdue: bool = False  # Default to False
    assigned_by_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='after')
    def set_task_display_name(self) -> 'MyTaskResponse':
        # If your CRUD passes the object, extract the name string here
        if hasattr(self, 'assigned_to_name') and isinstance(self.assigned_to_name, dict):
            self.assigned_to_display_name = self.assigned_to_name.get('name')
        return self


# Add to app/schemas/action_tracker.py

# ==================== Resolve Forward References ====================

MeetingMinutesResponse.model_rebuild()
MeetingResponse.model_rebuild()
MeetingStatusHistoryResponse.model_rebuild()