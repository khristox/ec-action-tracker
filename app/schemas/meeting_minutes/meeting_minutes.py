# app/schemas/action_tracker/meeting_minutes.py

"""
Meeting Minutes and Actions Schemas

This module defines Pydantic schemas for meeting minutes and their associated actions,
including support for multiple implementers (persons_implementing) with backward
compatibility for assigned_to_id and assigned_to_name.
"""

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from uuid import UUID
from datetime import datetime, timezone
from typing import Dict, Optional, List, Any, Union, TYPE_CHECKING
from app.schemas.action_tracker_participants import ORMBase

# ==================== TYPE HELPERS ====================

def safe_datetime(dt: Optional[Any]) -> Optional[datetime]:
    """Safely convert any value to datetime or return None"""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt
    if isinstance(dt, str):
        try:
            return datetime.fromisoformat(dt.replace('Z', '+00:00'))
        except ValueError:
            return None
    return None


def safe_str(value: Optional[Any]) -> Optional[str]:
    """Safely convert any value to string or return None"""
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip() if value.strip() else None
    return str(value) if value else None


# ==================== PERSON IMPLEMENTING SCHEMA ====================

class PersonImplementing(BaseModel):
    """
    Schema for a person implementing an action.
    This represents a single person who is responsible for implementing the action.
    """
    model_config = ConfigDict(extra="ignore")
    
    name: Optional[str] = Field(None, description="Full name of the person")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    assigned_to_id: Optional[UUID] = Field(None, description="User ID if this is a system user")
    assigned_to_name: Optional[Dict[str, Any]] = Field(None, description="Detailed name info")
    source_type: Optional[str] = Field("external", description="Source: 'system' or 'external'")
    is_private: bool = Field(False, description="Whether this person's contact info is private")
    
    @field_validator('source_type', mode='before')
    @classmethod
    def validate_source_type(cls, v: Any) -> str:
        """Validate and normalize source type"""
        if v is None:
            return "external"
        v_str = str(v).lower()
        if v_str in ['system', 'system_user', 'user', 'internal']:
            return "system"
        return "external"
    
    @field_validator('name', mode='before')
    @classmethod
    def validate_name(cls, v: Any) -> Optional[str]:
        """Normalize name field"""
        return safe_str(v)
    
    @field_validator('email', mode='before')
    @classmethod
    def validate_email(cls, v: Any) -> Optional[str]:
        """Normalize email field"""
        if v is None:
            return None
        email_str = safe_str(v)
        if email_str and '@' not in email_str:
            return None
        return email_str
    
    def dict(self, *args, **kwargs) -> Dict[str, Any]:
        """Override dict method to ensure proper serialization"""
        data = super().dict(*args, **kwargs)
        # Ensure source_type is properly set
        if data.get('assigned_to_id') and data.get('source_type') != 'system':
            data['source_type'] = 'system'
            data['is_private'] = True
        return data


class PersonsImplementingList(BaseModel):
    """Wrapper for list of persons implementing"""
    persons: List[PersonImplementing] = Field(default_factory=list)
    
    def get_first_person(self) -> Optional[PersonImplementing]:
        """Get the first person in the list (primary implementer)"""
        return self.persons[0] if self.persons else None
    
    def get_primary_assignee_id(self) -> Optional[UUID]:
        """Get the assigned_to_id of the first person"""
        first = self.get_first_person()
        return first.assigned_to_id if first else None
    
    def get_primary_assignee_name(self) -> Optional[Dict[str, Any]]:
        """Get the assigned_to_name of the first person"""
        first = self.get_first_person()
        return first.assigned_to_name if first else None
    
    def to_list(self) -> List[Dict[str, Any]]:
        """Convert to list of dictionaries for JSON storage"""
        return [p.dict() for p in self.persons]
    
    @classmethod
    def from_list(cls, data: List[Union[Dict[str, Any], PersonImplementing]]) -> "PersonsImplementingList":
        """Create from list of dictionaries or PersonImplementing objects"""
        persons = []
        for item in data:
            if isinstance(item, PersonImplementing):
                persons.append(item)
            elif isinstance(item, dict):
                persons.append(PersonImplementing(**item))
        return cls(persons=persons)


# ==================== MEETING ACTION SCHEMAS ====================

class MeetingActionBase(ORMBase):
    """Base schema for meeting actions with support for multiple implementers"""
    model_config = ConfigDict(extra="ignore")
    
    # Core fields
    description: str = Field(..., min_length=1, description="Action description")
    due_date: Optional[datetime] = Field(None, description="Due date for the action")
    priority: int = Field(2, ge=1, le=4, description="Priority level (1=High, 2=Medium, 3=Low, 4=Very Low)")
    remarks: Optional[str] = Field(None, description="Additional remarks or notes")
    
    # Backward compatibility fields
    assigned_to_id: Optional[UUID] = Field(None, description="User ID assigned to this action (legacy)")
    assigned_to_name: Optional[Union[str, Dict[str, Any]]] = Field(None, description="Assigned name details (legacy)")
    
    # New field for multiple implementers
    persons_implementing: Optional[List[Union[Dict[str, Any], PersonImplementing]]] = Field(
        default_factory=list,
        description="List of persons implementing this action"
    )
    
    # Additional fields
    title: Optional[str] = Field(None, max_length=255, description="Title/category of the action")
    issue_challenge: Optional[str] = Field(None, description="Issue or challenge being addressed")
    type_of_action: Optional[str] = Field(None, max_length=100, description="Type of action")
    date_initiated: Optional[datetime] = Field(None, description="Date the action was initiated")
    is_key_action: bool = Field(False, description="Whether this is a key critical action")
    tags: Optional[List[str]] = Field(default_factory=list, description="Tags for categorization")
    assign_to_meeting_id: Optional[UUID] = Field(None, description="Cross-meeting assignment")
    
    # Progress fields
    overall_status_id: Optional[UUID] = Field(None, description="Overall status ID")
    overall_progress_percentage: int = Field(0, ge=0, le=100, description="Progress percentage")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    
    @field_validator('assigned_to_name', mode='before')
    @classmethod
    def validate_assigned_to_name(cls, v: Any) -> Optional[Dict[str, Any]]:
        """Normalize assigned_to_name to a dictionary"""
        if v is None:
            return None
        if isinstance(v, str):
            return {"name": v, "type": "manual"}
        if isinstance(v, dict):
            return v
        return {"name": str(v), "type": "manual"} if v else None
    
    @field_validator('description', mode='after')
    @classmethod
    def validate_description(cls, v: str) -> str:
        """Strip whitespace from description"""
        return v.strip() if v else v
    
    @field_validator('title', mode='before')
    @classmethod
    def validate_title(cls, v: Any) -> Optional[str]:
        """Normalize title field"""
        return safe_str(v)
    
    @field_validator('type_of_action', mode='before')
    @classmethod
    def validate_type_of_action(cls, v: Any) -> Optional[str]:
        """Normalize type of action field"""
        return safe_str(v)
    
    @field_validator('tags', mode='before')
    @classmethod
    def validate_tags(cls, v: Any) -> List[str]:
        """Normalize tags to list of strings"""
        if v is None:
            return []
        if isinstance(v, list):
            return [str(tag).strip() for tag in v if tag and str(tag).strip()]
        if isinstance(v, str):
            return [tag.strip() for tag in v.split(',') if tag.strip()]
        return []
    
    def get_persons_implementing_list(self) -> PersonsImplementingList:
        """
        Get persons_implementing as a PersonsImplementingList object.
        Handles backward compatibility by building from assigned_to fields if needed.
        """
        if self.persons_implementing:
            return PersonsImplementingList.from_list(self.persons_implementing)
        
        # Build from legacy fields for backward compatibility
        persons = []
        person_data = {}
        
        # Add assigned_to_id if present
        if self.assigned_to_id:
            person_data["assigned_to_id"] = self.assigned_to_id
            person_data["source_type"] = "system"
            person_data["is_private"] = True
        
        # Add assigned_to_name if present
        if self.assigned_to_name:
            if isinstance(self.assigned_to_name, dict):
                person_data.update(self.assigned_to_name)
            else:
                person_data["name"] = self.assigned_to_name
            person_data["source_type"] = "system" if self.assigned_to_id else "external"
            person_data["is_private"] = bool(self.assigned_to_id)
        
        # Ensure name is present
        if "name" not in person_data or not person_data.get("name"):
            person_data["name"] = "Unassigned"
        
        if person_data:
            persons.append(person_data)
        
        return PersonsImplementingList(persons=persons)
    
    def to_legacy_fields(self) -> Dict[str, Any]:
        """
        Extract legacy assigned_to_id and assigned_to_name from persons_implementing.
        This ensures backward compatibility for existing code.
        """
        persons_list = self.get_persons_implementing_list()
        first_person = persons_list.get_first_person()
        
        if first_person:
            return {
                "assigned_to_id": first_person.assigned_to_id,
                "assigned_to_name": first_person.assigned_to_name or {"name": first_person.name}
            }
        
        return {
            "assigned_to_id": self.assigned_to_id,
            "assigned_to_name": self.assigned_to_name
        }


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
    
    @model_validator(mode="after")
    def sync_legacy_fields(self) -> "MeetingActionCreate":
        """
        Sync persons_implementing with legacy fields for backward compatibility.
        If persons_implementing is provided, extract the first person's data
        to populate assigned_to_id and assigned_to_name.
        """
        if self.persons_implementing:
            persons_list = PersonsImplementingList.from_list(self.persons_implementing)
            first_person = persons_list.get_first_person()
            if first_person:
                self.assigned_to_id = first_person.assigned_to_id
                self.assigned_to_name = first_person.assigned_to_name or {"name": first_person.name}
        return self


class MeetingActionUpdate(ORMBase):
    """Schema for updating an action item"""
    model_config = ConfigDict(extra="ignore")
    
    # Core fields
    description: Optional[str] = Field(None, min_length=1, description="Updated description")
    due_date: Optional[datetime] = Field(None, description="Updated due date")
    priority: Optional[int] = Field(None, ge=1, le=4, description="Updated priority")
    remarks: Optional[str] = Field(None, description="Updated remarks")
    
    # Backward compatibility fields
    assigned_to_id: Optional[UUID] = Field(None, description="Updated assigned user")
    assigned_to_name: Optional[Union[str, Dict[str, Any]]] = Field(None, description="Updated assigned name details")
    
    # New field for multiple implementers
    persons_implementing: Optional[List[Union[Dict[str, Any], PersonImplementing]]] = Field(
        None,
        description="Updated list of persons implementing this action"
    )
    
    # Additional fields
    title: Optional[str] = Field(None, max_length=255, description="Updated title")
    issue_challenge: Optional[str] = Field(None, description="Updated issue/challenge")
    type_of_action: Optional[str] = Field(None, max_length=100, description="Updated type of action")
    date_initiated: Optional[datetime] = Field(None, description="Updated initiation date")
    is_key_action: Optional[bool] = Field(None, description="Updated key action flag")
    tags: Optional[List[str]] = Field(None, description="Updated tags")
    assign_to_meeting_id: Optional[UUID] = Field(None, description="Updated cross-meeting assignment")
    
    # Progress fields
    overall_status_id: Optional[UUID] = Field(None, description="Updated status ID")
    overall_progress_percentage: Optional[int] = Field(None, ge=0, le=100, description="Updated progress percentage")
    completed_at: Optional[datetime] = Field(None, description="Updated completion timestamp")
    
    # Association fields
    minute_id: Optional[UUID] = Field(None, description="Update the associated minute")
    meeting_id: Optional[UUID] = Field(None, description="Update the meeting association")
    
    @field_validator('assigned_to_name', mode='before')
    @classmethod
    def validate_assigned_to_name(cls, v: Any) -> Optional[Dict[str, Any]]:
        """Normalize assigned_to_name to a dictionary"""
        if v is None:
            return None
        if isinstance(v, str):
            return {"name": v, "type": "manual"}
        if isinstance(v, dict):
            return v
        return {"name": str(v), "type": "manual"} if v else None
    
    @model_validator(mode="after")
    def validate_update(self) -> "MeetingActionUpdate":
        """Ensure at least one field is being updated"""
        fields = [f for f in self.model_fields.keys() if getattr(self, f) is not None]
        if not fields:
            raise ValueError("At least one field must be provided for update")
        return self
    
    @model_validator(mode="after")
    def sync_legacy_fields(self) -> "MeetingActionUpdate":
        """
        Sync persons_implementing with legacy fields for backward compatibility.
        If persons_implementing is provided, extract the first person's data
        to populate assigned_to_id and assigned_to_name.
        """
        if self.persons_implementing is not None and self.persons_implementing:
            persons_list = PersonsImplementingList.from_list(self.persons_implementing)
            first_person = persons_list.get_first_person()
            if first_person:
                self.assigned_to_id = first_person.assigned_to_id
                self.assigned_to_name = first_person.assigned_to_name or {"name": first_person.name}
        return self


class MeetingActionResponse(MeetingActionBase):
    """Schema for action item response"""
    id: UUID = Field(..., description="Unique identifier")
    minute_id: Optional[UUID] = None
    assigned_by_id: Optional[UUID] = None
    assigned_by_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    start_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    overall_status_id: Optional[UUID] = None
    overall_status_name: Optional[str] = None
    overall_progress_percentage: int = 0
    actual_hours: Optional[float] = None
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    
    # Display fields
    assigned_to_name_display: Optional[str] = "Unassigned"
    persons_implementing_display: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list,
        description="Persons implementing with masked contact info for privacy"
    )
    
    # Meeting context
    meeting_title: Optional[str] = None
    meeting_date: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def map_orm_implementers(cls, data: Any) -> Any:
        """Map SQLAlchemy model implementers relationship to schema persons_implementing field automatically"""
        if hasattr(data, "implementers") and not getattr(data, "persons_implementing", None):
            orm_implementers = getattr(data, "implementers", None)
            if orm_implementers:
                mapped_persons = [
                    {
                        "user_id": str(p.user_id) if p.user_id else None,
                        "assigned_to_id": str(p.user_id) if p.user_id else None,
                        "name": p.name or "",
                        "email": p.email or "",
                        "phone": p.phone or "",
                        "source_type": "system" if p.user_id else "external",
                        "is_private": bool(p.user_id),
                    }
                    for p in orm_implementers
                ]
                if isinstance(data, dict):
                    data["persons_implementing"] = mapped_persons
                else:
                    setattr(data, "persons_implementing", mapped_persons)
        return data

    @model_validator(mode="after")
    def set_display_names(self) -> "MeetingActionResponse":
        """Extract clean display names from structured data"""

        if not self.persons_implementing:
            orm_implementers = getattr(self, 'implementers', None)
            if orm_implementers:
                self.persons_implementing = [
                    {
                        "user_id":        str(p.user_id) if p.user_id else None,
                        "assigned_to_id": str(p.user_id) if p.user_id else None,
                        "name":           p.name  or "",
                        "email":          p.email or "",
                        "phone":          p.phone or "",
                        "source_type":    "system" if p.user_id else "external",
                        "is_private":     bool(p.user_id),
                    }
                    for p in orm_implementers
                ]

        # Set primary assignee display name
        assigned = self.assigned_to_name
        if isinstance(assigned, dict):
            self.assigned_to_name_display = assigned.get('name', 'Unassigned')
        elif isinstance(assigned, str):
            self.assigned_to_name_display = assigned
        else:
            self.assigned_to_name_display = 'Unassigned'
        
        # Build persons_implementing_display with privacy masking
        if self.persons_implementing:
            display_list = []
            for person in self.persons_implementing:
                if isinstance(person, dict):
                    display_person = person.copy()
                    if display_person.get('is_private') and display_person.get('email'):
                        email = display_person['email']
                        if '@' in email:
                            local, domain = email.split('@', 1)
                           
                    display_list.append(display_person)
                else:
                    display_list.append(person)
            self.persons_implementing_display = display_list
        
        return self
    
    class Config:
        from_attributes = True
        extra = "ignore"


# ==================== MEETING MINUTES SCHEMAS ====================

class MeetingMinutesBase(BaseModel):
    """Base schema for meeting minutes"""
    model_config = ConfigDict(extra="ignore")
    
    topic: Optional[str] = Field(None, max_length=500, description="Topic of the minute")
    discussion: Optional[str] = Field(None, description="Discussion content in HTML/plain text")
    decisions: Optional[str] = Field(None, description="Decisions made in HTML/plain text")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now, description="When the minute was recorded")

    @field_validator('topic', mode='before')
    @classmethod
    def validate_topic(cls, v: Any) -> Optional[str]:
        """Ensure topic is properly formatted"""
        return safe_str(v)

    @field_validator('discussion', 'decisions', mode='before')
    @classmethod
    def validate_content(cls, v: Any) -> Optional[str]:
        """Ensure content is properly formatted"""
        if v is None:
            return None
        if isinstance(v, str):
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
    
    @model_validator(mode="after")
    def validate_minimum_data(self) -> "MeetingMinutesCreate":
        """Ensure at least one content field is provided"""
        return self


class MeetingMinutesUpdate(ORMBase):
    """Schema for updating meeting minutes"""
    model_config = ConfigDict(extra="ignore")
    
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
    
    # Statistics
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
    def set_action_stats(self) -> "MeetingMinutesResponse":
        """Calculate action statistics"""
        if self.actions:
            total = len(self.actions)
            now = datetime.now(timezone.utc)
            
            completed = sum(
                1 for a in self.actions 
                if a.completed_at is not None or a.overall_progress_percentage >= 100
            )
            
            overdue = sum(
                1 for a in self.actions 
                if a.completed_at is None 
                and a.due_date is not None 
                and a.due_date.replace(tzinfo=timezone.utc) < now
            )
            
            self.action_count = total
            self.completed_action_count = completed
            self.overdue_action_count = overdue
            self.completion_percentage = round((completed / total) * 100, 2) if total > 0 else 0.0
        else:
            self.action_count = 0
            self.completed_action_count = 0
            self.overdue_action_count = 0
            self.completion_percentage = 0.0
        
        return self


class PaginatedMinutesResponse(BaseModel):
    """Paginated response wrapper for meeting minutes"""
    items: List[MeetingMinutesResponse]
    total: int = Field(..., ge=0, description="Total number of items")
    page: int = Field(..., ge=1, description="Current page number")
    size: int = Field(..., ge=1, le=500, description="Items per page")
    pages: int = Field(0, ge=0, description="Total number of pages")
    has_next: bool = Field(False, description="Whether there is a next page")
    has_prev: bool = Field(False, description="Whether there is a previous page")
    
    @model_validator(mode="after")
    def calculate_pagination(self) -> "PaginatedMinutesResponse":
        """Calculate pagination metadata"""
        self.pages = (self.total + self.size - 1) // self.size if self.size > 0 else 0
        self.has_next = self.page < self.pages
        self.has_prev = self.page > 1
        return self


# ==================== ADDITIONAL SCHEMAS ====================

class MinuteActionSummary(BaseModel):
    """Summary of actions for a minute"""
    minute_id: UUID = Field(..., description="Minute ID")
    minute_topic: Optional[str] = Field(None, description="Minute topic")
    total_actions: int = Field(0, ge=0, description="Total actions")
    completed_actions: int = Field(0, ge=0, description="Completed actions")
    pending_actions: int = Field(0, ge=0, description="Pending actions")
    overdue_actions: int = Field(0, ge=0, description="Overdue actions")
    completion_percentage: float = Field(0.0, ge=0, le=100, description="Completion percentage")
    
    @model_validator(mode="after")
    def calculate_stats(self) -> "MinuteActionSummary":
        """Calculate derived statistics"""
        self.pending_actions = self.total_actions - self.completed_actions
        if self.total_actions > 0:
            self.completion_percentage = round(
                (self.completed_actions / self.total_actions) * 100, 2
            )
        return self


class MinuteBulkCreate(BaseModel):
    """Schema for creating multiple minutes at once"""
    model_config = ConfigDict(extra="ignore")
    
    meeting_id: UUID = Field(..., description="ID of the meeting")
    minutes: List[MeetingMinutesCreate] = Field(..., min_length=1, description="List of minutes to create")
    
    @model_validator(mode="after")
    def validate_minutes(self) -> "MinuteBulkCreate":
        """Ensure minutes list is not empty"""
        if not self.minutes:
            raise ValueError("At least one minute must be provided")
        return self


class MinuteSearchParams(BaseModel):
    """Parameters for searching minutes"""
    model_config = ConfigDict(extra="ignore")
    
    meeting_id: Optional[UUID] = None
    search_temp: Optional[str] = Field(None, max_length=200, description="Search in topic, discussion, decisions")
    start_date: Optional[datetime] = Field(None, description="Filter by start date")
    end_date: Optional[datetime] = Field(None, description="Filter by end date")
    include_default: bool = Field(True, description="Include default minutes")
    include_inactive: bool = Field(False, description="Include inactive minutes")
    has_actions: Optional[bool] = Field(None, description="Filter by whether it has actions")
    min_actions: Optional[int] = Field(None, ge=0, description="Minimum number of actions")
    max_actions: Optional[int] = Field(None, ge=0, description="Maximum number of actions")


# ==================== REBUILD MODELS ====================

MeetingMinutesResponse.model_rebuild()
MeetingActionResponse.model_rebuild()
MinuteActionSummary.model_rebuild()
PaginatedMinutesResponse.model_rebuild()