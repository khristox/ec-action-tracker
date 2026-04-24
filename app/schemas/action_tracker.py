# app/schemas/action_tracker.py

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from typing import Optional, List, Any, Dict, Union
from uuid import UUID
from datetime import datetime
from enum import Enum

from app.schemas.meeting_minutes.meeting_minutes import MeetingMinutesResponse


# ==================== Shared Config ====================

class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


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
    is_secretary: bool = False
    attendance_status: Optional[str] = Field("pending", description="attended, missed, pending, excused")
    apology_comment: Optional[str] = None


class MeetingParticipantCreate(MeetingParticipantBase):
    pass


class MeetingParticipantUpdate(ORMBase):
    name: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    is_chairperson: Optional[bool] = None
    is_secretary: Optional[bool] = None
    attendance_status: Optional[str] = None
    apology_comment: Optional[str] = None


class MeetingParticipantResponse(MeetingParticipantBase):
    id: UUID
    code: Optional[str] = None
    name: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    extra_metadata: Optional[dict] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    group_id: Optional[UUID] = None  # Add this field
    created_at: Optional[datetime] = None  # Add this field
    updated_at: Optional[datetime] = None
    is_active: Optional[bool] = True


# ==================== Attribute Response Schema ====================

class AttributeResponse(ORMBase):
    """Schema for Attribute objects returned in responses"""
    id: UUID
    code: Optional[str] = None
    name: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    extra_metadata: Optional[dict] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    group_id: Optional[UUID] = None  # ADD THIS FIELD
    created_at: Optional[datetime] = None  # ADD THIS FIELD
    updated_at: Optional[datetime] = None  # ADD THIS FIELD
    is_active: Optional[bool] = True  # ADD THIS FIELD
    
    model_config = ConfigDict(from_attributes=True)


# ==================== Meeting Schemas ====================

class MeetingBase(ORMBase):
    """Input-only base"""
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    location_id: Optional[UUID] = None
    location_text: Optional[str] = Field(None, max_length=500)
    gps_coordinates: Optional[str] = Field(None, max_length=100)
    meeting_date: datetime
    start_time: datetime
    end_time: Optional[datetime] = None  # Keep as Optional
    agenda: Optional[str] = None
    facilitator: Optional[str] = Field(None, max_length=255)
    chairperson_name: Optional[str] = Field(None, max_length=255)
    status_id: Optional[UUID] = None

    


class MeetingCreate(MeetingBase):
    status: Optional[str] = None
    participant_list_id: Optional[UUID] = None
    custom_participants: List[MeetingParticipantCreate] = Field(default_factory=list)
    
    # Hybrid meeting fields
    platform: Optional[str] = Field(None, description="Meeting platform (zoom, google_meet, etc.)")
    meeting_link: Optional[str] = None
    meeting_id_online: Optional[str] = Field(None, alias="meeting_id")
    passcode: Optional[str] = None
    dial_in_numbers: Optional[List[Dict[str, str]]] = None
    has_online_meeting: bool = Field(False, description="Whether online meeting is available")
    has_physical_meeting: bool = Field(False, description="Whether physical meeting is available")
    venue: Optional[str] = Field(None, description="Venue name for physical meetings")
    address: Optional[str] = Field(None, description="Full address for physical meetings")
    location_instructions: Optional[str] = Field(None, description="Special instructions for location")
    send_reminders: bool = Field(True, description="Whether to send email reminders")
    reminder_minutes_before: int = Field(30, description="Minutes before meeting to send reminders")


class MeetingUpdate(ORMBase):
    title: Optional[str] = None
    description: Optional[str] = None
    location_id: Optional[UUID] = None
    location_text: Optional[str] = None
    
    # Online meeting fields
    platform: Optional[str] = None
    meeting_link: Optional[str] = None
    meeting_id_online: Optional[str] = Field(None, alias="meeting_id")
    passcode: Optional[str] = None
    dial_in_numbers: Optional[List[Dict[str, str]]] = None
    
    # Physical meeting fields
    has_online_meeting: Optional[bool] = None
    has_physical_meeting: Optional[bool] = None
    venue: Optional[str] = None
    address: Optional[str] = None
    location_instructions: Optional[str] = None
    
    # Role fields
    chairperson_id: Optional[UUID] = None
    secretary_id: Optional[UUID] = None
    facilitator: Optional[str] = None
    chairperson_name: Optional[str] = None
    
    # Notification settings
    send_reminders: Optional[bool] = None
    reminder_minutes_before: Optional[int] = None
    
    # Other fields
    gps_coordinates: Optional[str] = None
    meeting_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    agenda: Optional[str] = None
    status_id: Optional[UUID] = None
    status: Optional[str] = Field(None, description="Meeting status slug")
    is_active: Optional[bool] = None
    status_comment: Optional[str] = Field(None, description="Comment explaining the status change")
    status_date: Optional[datetime] = Field(None, description="Effective date of the status change")

    @field_validator('platform', 'meeting_link', 'meeting_id_online', 'passcode', mode='before')
    @classmethod
    def convert_tuple_to_string(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, tuple):
            return v[0] if v and len(v) > 0 else None
        if isinstance(v, list):
            return v[0] if v else None
        return v
    
    @field_validator('dial_in_numbers', mode='before')
    @classmethod
    def convert_tuple_to_list(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, tuple):
            return list(v) if v else None
        return v


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
    
    # Platform fields
    platform: Optional[str] = None
    meeting_link: Optional[str] = None
    meeting_id_online: Optional[str] = Field(None, alias="meeting_id")
    passcode: Optional[str] = None
    
    # Hybrid meeting fields
    has_online_meeting: bool = False
    has_physical_meeting: bool = False
    venue: Optional[str] = None
    address: Optional[str] = None
    location_instructions: Optional[str] = None
    
    # Role fields
    chairperson_id: Optional[UUID] = None
    secretary_id: Optional[UUID] = None
    
    # Notification settings
    dial_in_numbers: Optional[List[Dict[str, str]]] = None
    send_reminders: bool = True
    reminder_minutes_before: int = 30
    
    # Audit fields
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    
    # Status fields
    status_comment: Optional[str] = None
    status_date: Optional[datetime] = None
    status_name: Optional[str] = None
    location_name: Optional[str] = None
    status: Optional[AttributeResponse] = None
    
    # Relationships
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
    
    model_config = ConfigDict(from_attributes=True)


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
    document_type_name: Optional[str] = None
    version: int = 1
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
    ocr_text: Optional[str] = None
    ocr_processed_at: Optional[datetime] = None
    ocr_language: Optional[str] = None


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
    meeting_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    overall_progress_percentage: int = 0
    overall_status_name: Optional[str] = None
    priority: int = 2
    is_overdue: bool = False
    assigned_by_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    assigned_to_display_name: Optional[str] = None


# ==================== Notification Schemas ====================

class NotificationType(str, Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    SMS = "sms"


class NotificationRequest(BaseModel):
    """Request schema for sending meeting notifications"""
    participant_ids: List[UUID] = Field(..., description="List of participant user IDs")
    notification_type: List[str] = Field(default=["email"], description="Types of notifications to send")
    custom_message: Optional[str] = Field(None, description="Optional custom message to include")
    meeting_details: Optional[Dict[str, Any]] = Field(None, description="Meeting details to include in notification")
    
    model_config = ConfigDict(from_attributes=True)


class NotificationResponse(BaseModel):
    """Response schema for notification sending"""
    success: bool
    total_participants: int
    sent: int
    results: List[Dict[str, Any]] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    
    model_config = ConfigDict(from_attributes=True)


# ==================== Zoom Meeting Schemas ====================

class ZoomMeetingCreate(BaseModel):
    """Request schema for creating Zoom meeting"""
    topic: str = Field(..., description="Meeting topic")
    start_time: datetime = Field(..., description="Meeting start time")
    duration: int = Field(60, description="Meeting duration in minutes")
    timezone: str = Field("UTC", description="Meeting timezone")
    
    model_config = ConfigDict(from_attributes=True)


class ZoomMeetingResponse(BaseModel):
    """Response schema for Zoom meeting creation"""
    join_url: str
    id: str
    password: Optional[str] = None
    start_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# ==================== Meeting Platform Schemas ====================

class MeetingPlatform(str, Enum):
    ZOOM = "zoom"
    GOOGLE_MEET = "google_meet"
    MICROSOFT_TEAMS = "microsoft_teams"
    PHYSICAL = "physical"
    OTHER = "other"


class MeetingPlatformInfo(BaseModel):
    """Schema for meeting platform information"""
    platform: str = Field(..., description="Meeting platform type")
    meeting_link: Optional[str] = None
    meeting_id: Optional[str] = None
    passcode: Optional[str] = None
    dial_in_numbers: Optional[List[Dict[str, str]]] = None
    
    model_config = ConfigDict(from_attributes=True)


# ==================== Resolve Forward References ====================

MeetingMinutesResponse.model_rebuild()
MeetingResponse.model_rebuild()
MeetingDocumentResponse.model_rebuild()
MeetingStatusHistoryResponse.model_rebuild()