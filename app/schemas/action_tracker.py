from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


# ==================== Shared Config ====================

class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ==================== Participant Schemas ====================

class ParticipantBase(ORMBase):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    telephone: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=255)
    organization: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantUpdate(ORMBase):
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


# ==================== Participant List Schemas ====================

class ParticipantListBase(ORMBase):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_global: bool = False

class ParticipantListCreate(ParticipantListBase):
    participant_ids: List[UUID] = Field(default_factory=list)

class ParticipantListUpdate(ORMBase):
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


# ==================== Meeting Participant Schemas ====================

class MeetingParticipantBase(ORMBase):
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
    receive an ORM Attribute object there, not a string. Subclasses that are
    purely for input (Create/Update) add `status: Optional[str]` themselves.
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
        # Parse string to datetime if needed
        if isinstance(v, str):
            try:
                # Handle ISO format with or without Z
                v = datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                raise ValueError('Invalid datetime format for end_time')
        
        # Get start_time from the data (may be parsed or still string)
        start_time = info.data.get('start_time')
        if start_time and v:
            # Parse start_time if it's still a string
            if isinstance(start_time, str):
                try:
                    start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                except ValueError:
                    raise ValueError('Invalid datetime format for start_time')
            # Now compare datetime objects
            if v <= start_time:
                raise ValueError('End time must be after start time')
        return v


class MeetingCreate(MeetingBase):
    # status as a plain string makes sense only on input
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
    # Plain string shorthand accepted on input; resolve to status_id in the route
    status: Optional[str] = Field(
        None, description="Meeting status slug e.g. pending/started/ended/closed/cancelled"
    )
    is_active: Optional[bool] = None


# ==================== Meeting Responses ====================

class MeetingCreateResponse(ORMBase):
    """Flat response returned after POST /meetings — no nested relationships."""
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
    status: Optional[AttributeResponse] = None  # ← add this
    created_by_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool
    location_name: Optional[str] = None
    participants_count: int = 0
    minutes_count: int = 0
    actions_count: int = 0
    documents_count: int = 0


class MeetingResponse(MeetingBase):
    """
    Full detail response. `status` is the ORM Attribute relationship
    represented as an AttributeResponse object.
    """
    id: UUID
    created_by_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool

    # Flattened from the ORM relationship
    status_name: Optional[str] = None
    location_name: Optional[str] = None
    status: Optional[AttributeResponse] = None  # This is now Optional[AttributeResponse]

    participants: List[MeetingParticipantResponse] = Field(default_factory=list)
    minutes: List['MeetingMinutesResponse'] = Field(default_factory=list)
    documents: List['MeetingDocumentResponse'] = Field(default_factory=list)

    @field_validator('status', mode='before')
    @classmethod
    def coerce_status(cls, v: Any) -> Any:
        """
        Convert ORM Attribute object to AttributeResponse dict.
        If it's already a dict or None, pass through.
        """
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        # ORM object - extract the data we need
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
        """Keep status_name in sync with status for convenience."""
        if self.status and not self.status_name:
            self.status_name = self.status.name
        return self


class MeetingPaginationResponse(ORMBase):
    items: List[MeetingListResponse]
    total: int
    page: int
    size: int


# ==================== Meeting Minutes Schemas ====================

class MeetingMinutesBase(ORMBase):
    topic: str = Field(..., min_length=1, max_length=500)
    discussion: Optional[str] = None
    decisions: Optional[str] = None

class MeetingMinutesCreate(MeetingMinutesBase):
    pass

class MeetingMinutesUpdate(ORMBase):
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


# ==================== Meeting Action Schemas ====================

class MeetingActionBase(ORMBase):
    description: str = Field(..., min_length=1)
    assigned_to_id: Optional[UUID] = None
    assigned_to_name: Optional[str] = Field(None, max_length=255)
    due_date: Optional[datetime] = None
    priority: int = Field(2, ge=1, le=4)
    estimated_hours: Optional[float] = Field(None, ge=0)
    remarks: Optional[str] = None

class MeetingActionCreate(MeetingActionBase):
    pass

class MeetingActionUpdate(ORMBase):
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
    updated_by_id: UUID
    updated_by_name: Optional[str] = None
    individual_status_name: Optional[str] = None
    created_at: datetime


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

class ActionCommentResponse(ActionCommentBase):
    id: UUID
    action_id: UUID
    created_by_id: UUID
    created_by_name: Optional[str] = None
    created_at: datetime


# ==================== Meeting Document Schemas ====================

class MeetingDocumentBase(ORMBase):
    file_name: str = Field(..., max_length=500)
    document_type_id: UUID = Field(..., description="Document type attribute value UUID")
    description: Optional[str] = None

class MeetingDocumentCreate(MeetingDocumentBase):
    pass

class MeetingDocumentUpdate(ORMBase):
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
    meeting_date: datetime
    due_date: Optional[datetime] = None
    overall_progress_percentage: int
    overall_status_name: Optional[str] = None
    priority: int
    is_overdue: bool = False


# Resolve forward references
MeetingMinutesResponse.model_rebuild()
MeetingResponse.model_rebuild()