# app/schemas/action_tracker/meeting_minutes.py

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from uuid import UUID
from datetime import datetime, timezone
from typing import Dict, Optional, List, Any, Union, TYPE_CHECKING
from app.schemas.action_tracker_participants import ORMBase

# Lazy import to avoid circular dependency
if TYPE_CHECKING:
    from app.schemas.action_tracker import AssignedToInfo

# Helper function for runtime use
def get_assigned_to_info_class():
    """Lazy import to avoid circular imports"""
    from app.schemas.action_tracker import AssignedToInfo
    return AssignedToInfo


# ==================== Meeting Action Schemas ====================

class MeetingActionBase(ORMBase):
    description: str = Field(..., min_length=1, description="Action description")
    assigned_to_id: Optional[UUID] = Field(None, description="ID of the user assigned to this action")
    # This stores the Dict/JSON from the DB
    assigned_to_name: Optional[Union[str, Dict[str, Any], Any]] = Field(None, description="Assigned to name details")
    due_date: Optional[datetime] = Field(None, description="Due date for the action")
    priority: int = Field(2, ge=1, le=4, description="Priority level (1=High, 2=Medium, 3=Low, 4=Very Low)")
    remarks: Optional[str] = Field(None, description="Additional remarks or notes")

    @field_validator('assigned_to_name', mode='before')
    @classmethod
    def validate_assigned_to_name(cls, v: Any) -> Any:
        if v is None:
            return None
        # Ensure it's handled as a dict internally if it's a string
        if isinstance(v, str):
            return {"name": v, "type": "manual"}
        return v
    
    @field_validator('description', mode='after')
    @classmethod
    def validate_description(cls, v: str) -> str:
        """Strip whitespace from description"""
        return v.strip() if v else v


class MeetingActionCreate(MeetingActionBase):
    """Schema for creating a new action item"""
    minute_id: Optional[UUID] = Field(None, description="ID of the associated minute")
    meeting_id: Optional[UUID] = Field(None, description="ID of the meeting (used when minute_id is not provided)")
    
    @model_validator(mode="after")
    def validate_minute_or_meeting(self) -> "MeetingActionCreate":
        """Ensure either minute_id or meeting_id is provided"""
        if not self.minute_id and not self.meeting_id:
            raise ValueError("Either minute_id or meeting_id must be provided")
        return self


class MeetingActionUpdate(ORMBase):
    """Schema for updating an action item"""
    description: Optional[str] = Field(None, min_length=1, description="Updated description")
    assigned_to_id: Optional[UUID] = Field(None, description="Updated assigned user")
    assigned_to_name: Optional[Union[str, Dict[str, Any]]] = Field(None, description="Updated assigned name details")
    due_date: Optional[datetime] = Field(None, description="Updated due date")
    priority: Optional[int] = Field(None, ge=1, le=4, description="Updated priority")
    estimated_hours: Optional[float] = Field(None, ge=0, description="Estimated hours to complete")
    overall_status_id: Optional[UUID] = Field(None, description="Updated status ID")
    overall_progress_percentage: Optional[int] = Field(None, ge=0, le=100, description="Progress percentage")
    remarks: Optional[str] = Field(None, description="Updated remarks")
    minute_id: Optional[UUID] = Field(None, description="Update the associated minute")
    meeting_id: Optional[UUID] = Field(None, description="Update the meeting association")
    
    @model_validator(mode="after")
    def validate_update(self) -> "MeetingActionUpdate":
        """Ensure at least one field is being updated"""
        # Check if any field is set
        fields = [f for f in self.__fields__ if getattr(self, f) is not None]
        if not fields:
            raise ValueError("At least one field must be provided for update")
        return self


class MeetingActionResponse(MeetingActionBase):
    """Schema for action item response"""
    id: UUID
    minute_id: Optional[UUID] = None  # Make optional
    assigned_by_id: Optional[UUID] = None
    assigned_by_name: Optional[str] = None
    assigned_at: Optional[datetime] = None  # Make optional
    start_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    overall_status_id: Optional[UUID] = None
    overall_status_name: Optional[str] = None
    overall_progress_percentage: int = 0
    actual_hours: Optional[float] = None
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None  # Make optional
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    
    # This is the dedicated string field for the Frontend
    assigned_to_name_display: Optional[str] = "Unassigned"
    
    # Optional: Include meeting details for context
    meeting_title: Optional[str] = None
    meeting_date: Optional[datetime] = None

    @model_validator(mode="after")
    def set_display_name(self) -> "MeetingActionResponse":
        """Extracts a clean string from the assigned_to_name dictionary"""
        assigned = self.assigned_to_name
        
        if isinstance(assigned, dict):
            self.assigned_to_name_display = assigned.get('name', 'Unassigned')
        elif isinstance(assigned, str):
            self.assigned_to_name_display = assigned
        else:
            self.assigned_to_name_display = 'Unassigned'
        
        return self
    
    class Config:
        from_attributes = True
        extra = "ignore"
        

# ==================== Meeting Minutes Schemas ====================

class MeetingMinutesBase(BaseModel):
    """Base schema for meeting minutes"""
    topic: Optional[str] = Field(None, max_length=500, description="Topic of the minute")
    discussion: Optional[str] = Field(None, description="Discussion content in HTML/plain text")
    decisions: Optional[str] = Field(None, description="Decisions made in HTML/plain text")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now, description="When the minute was recorded")

    @field_validator('topic', mode='before')
    @classmethod
    def validate_topic(cls, v: Any) -> Optional[str]:
        """Ensure topic is properly formatted"""
        if v is None:
            return None
        if isinstance(v, str):
            trimmed = v.strip()
            return trimmed if trimmed else None
        return str(v) if v else None

    @field_validator('discussion', 'decisions', mode='before')
    @classmethod
    def validate_content(cls, v: Any) -> Optional[str]:
        """Ensure content is properly formatted"""
        if v is None:
            return None
        if isinstance(v, str):
            # Remove excessive whitespace
            return ' '.join(v.split())
        return str(v) if v else None
    
    @field_validator('timestamp', mode='before')
    @classmethod
    def validate_timestamp(cls, v: Any) -> Optional[datetime]:
        """Ensure timestamp is a valid datetime"""
        if v is None:
            return datetime.now()
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                return datetime.now()
        return datetime.now()


class MeetingMinutesCreate(MeetingMinutesBase):
    """Schema for creating meeting minutes"""
    meeting_id: Optional[UUID] = Field(None, description="ID of the meeting")
    recorded_by_id: Optional[UUID] = Field(None, description="ID of the person who recorded the minute")
    # created_by_id will be set by the service
    # is_default will be set by the service
    
    @model_validator(mode="after")
    def validate_minimum_data(self) -> "MeetingMinutesCreate":
        """Ensure at least one content field is provided"""
        if not self.topic and not self.discussion and not self.decisions:
            # Allow empty minutes - they can be updated later
            pass
        return self
    
    class Config:
        # Allow extra fields to be ignored for flexibility
        extra = "ignore"
        from_attributes = True


class MeetingMinutesUpdate(ORMBase):
    """Schema for updating meeting minutes"""
    topic: Optional[str] = Field(None, max_length=500, description="Updated topic")
    discussion: Optional[str] = Field(None, description="Updated discussion")
    decisions: Optional[str] = Field(None, description="Updated decisions")
    timestamp: Optional[datetime] = Field(None, description="Updated timestamp")
    is_default: Optional[bool] = Field(None, description="Whether this is a default minute")
    
    @model_validator(mode="after")
    def validate_update(self) -> "MeetingMinutesUpdate":
        """Ensure at least one field is being updated"""
        fields = [f for f in ['topic', 'discussion', 'decisions', 'timestamp', 'is_default'] 
                  if getattr(self, f) is not None]
        if not fields:
            raise ValueError("At least one field must be provided for update")
        return self
    
    class Config:
        from_attributes = True


class MeetingMinutesResponse(MeetingMinutesBase):
    """Response schema for meeting minutes"""
    id: UUID = Field(..., description="Unique identifier")
    meeting_id: UUID = Field(..., description="ID of the meeting")
    topic: Optional[str] = None
    discussion: Optional[str] = None
    decisions: Optional[str] = None
    timestamp: datetime
    is_default: bool = Field(False, description="Whether this is an auto-created default minute")
    recorded_by_id: Optional[UUID] = None
    recorded_by_name: Optional[str] = None
    recorded_by_username: Optional[str] = None
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_by_username: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_by_username: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    
    # Relationships
    actions: List[MeetingActionResponse] = Field(default_factory=list, description="Associated actions")
    
    # Additional metadata
    action_count: Optional[int] = Field(None, description="Number of associated actions")
    completed_action_count: Optional[int] = Field(None, description="Number of completed actions")
    overdue_action_count: Optional[int] = Field(None, description="Number of overdue actions")
    completion_percentage: Optional[float] = Field(None, description="Percentage of completed actions")
    
    @model_validator(mode="after")
    def set_recorded_by(self) -> "MeetingMinutesResponse":
        """Set recorded_by_name from created_by if not set"""
        if not self.recorded_by_name and self.created_by_name:
            self.recorded_by_name = self.created_by_name
        if not self.recorded_by_username and self.created_by_username:
            self.recorded_by_username = self.created_by_username
        return self
    
    @model_validator(mode="after")
    def set_action_counts(self) -> "MeetingMinutesResponse":
        """Calculate action statistics"""
        if self.actions:
            total = len(self.actions)
            completed = sum(
                1 for a in self.actions 
                if a.completed_at is not None or a.overall_progress_percentage >= 100
            )
            
            self.action_count = total
            self.completed_action_count = completed
            
            # Calculate completion percentage
            if total > 0:
                self.completion_percentage = round((completed / total) * 100, 2)
            
            # Calculate overdue actions
            now = datetime.now(timezone.utc)
            self.overdue_action_count = sum(
                1 for a in self.actions 
                if a.completed_at is None 
                and a.due_date is not None 
                and a.due_date.replace(tzinfo=timezone.utc) < now
            )
        else:
            self.action_count = 0
            self.completed_action_count = 0
            self.overdue_action_count = 0
            self.completion_percentage = 0.0
        
        return self
    
    class Config:
        from_attributes = True


class PaginatedMinutesResponse(BaseModel):
    """Paginated response wrapper for meeting minutes"""
    items: List[MeetingMinutesResponse]
    total: int = Field(..., ge=0, description="Total number of items")
    page: int = Field(..., ge=1, description="Current page number")
    size: int = Field(..., ge=1, le=500, description="Items per page")
    pages: int = Field(..., ge=0, description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_prev: bool = Field(..., description="Whether there is a previous page")
    
    @model_validator(mode="after")
    def calculate_pagination(self) -> "PaginatedMinutesResponse":
        """Calculate pagination metadata"""
        self.pages = (self.total + self.size - 1) // self.size if self.size > 0 else 0
        self.has_next = self.page < self.pages
        self.has_prev = self.page > 1
        return self
    
    class Config:
        from_attributes = True


# ==================== Additional Schemas ====================

class MinuteActionSummary(BaseModel):
    """Summary of actions for a minute"""
    minute_id: UUID
    minute_topic: Optional[str] = None
    total_actions: int = Field(0, ge=0)
    completed_actions: int = Field(0, ge=0)
    pending_actions: int = Field(0, ge=0)
    overdue_actions: int = Field(0, ge=0)
    completion_percentage: float = Field(0.0, ge=0, le=100)
    
    @model_validator(mode="after")
    def calculate_percentage(self) -> "MinuteActionSummary":
        """Calculate completion percentage"""
        if self.total_actions > 0:
            self.completion_percentage = round(
                (self.completed_actions / self.total_actions) * 100, 2
            )
        return self
    
    @model_validator(mode="after")
    def calculate_pending(self) -> "MinuteActionSummary":
        """Calculate pending actions"""
        self.pending_actions = self.total_actions - self.completed_actions
        return self


class MinuteBulkCreate(BaseModel):
    """Schema for creating multiple minutes at once"""
    meeting_id: UUID = Field(..., description="ID of the meeting")
    minutes: List[MeetingMinutesCreate] = Field(..., min_length=1, description="List of minutes to create")
    
    @model_validator(mode="after")
    def validate_minutes(self) -> "MinuteBulkCreate":
        """Ensure minutes list is not empty"""
        if not self.minutes:
            raise ValueError("At least one minute must be provided")
        return self
    
    class Config:
        from_attributes = True


class MinuteSearchParams(BaseModel):
    """Parameters for searching minutes"""
    meeting_id: Optional[UUID] = None
    search_term: Optional[str] = Field(None, max_length=200, description="Search in topic, discussion, decisions")
    start_date: Optional[datetime] = Field(None, description="Filter by start date")
    end_date: Optional[datetime] = Field(None, description="Filter by end date")
    include_default: bool = Field(True, description="Include default minutes")
    include_inactive: bool = Field(False, description="Include inactive minutes")
    has_actions: Optional[bool] = Field(None, description="Filter by whether it has actions")
    min_actions: Optional[int] = Field(None, ge=0, description="Minimum number of actions")
    max_actions: Optional[int] = Field(None, ge=0, description="Maximum number of actions")
    
    @model_validator(mode="after")
    def validate_date_range(self) -> "MinuteSearchParams":
        """Validate date range"""
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("Start date must be before end date")
        return self
    
    @model_validator(mode="after")
    def validate_actions_range(self) -> "MinuteSearchParams":
        """Validate actions range"""
        if self.min_actions is not None and self.max_actions is not None:
            if self.min_actions > self.max_actions:
                raise ValueError("Min actions must be less than or equal to max actions")
        return self
    
    class Config:
        from_attributes = True


# ==================== Update Forward References ====================

# Rebuild models to resolve forward references
MeetingMinutesResponse.model_rebuild()
MeetingActionResponse.model_rebuild()
MinuteActionSummary.model_rebuild()
PaginatedMinutesResponse.model_rebuild()