# app/schemas/action_tracker_participants.py
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import re

# ==================== Constants ====================

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
PHONE_REGEX = re.compile(r'^[\+\d\s\-\(\)]{8,}$')
NAME_MIN_LENGTH = 2
NAME_MAX_LENGTH = 255
DESCRIPTION_MAX_LENGTH = 1000


# ==================== Shared Config ====================

class ORMBase(BaseModel):
    """Base class with common configuration"""
    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None
        }
    )


# ==================== Validation Helpers ====================

def validate_email(v: Optional[str]) -> Optional[str]:
    """Validate email format"""
    if v is not None and v.strip():
        if not EMAIL_REGEX.match(v):
            raise ValueError(f"Invalid email format: {v}")
        return v.lower().strip()
    return None


def validate_phone(v: Optional[str]) -> Optional[str]:
    """Validate phone number format"""
    if v is not None and v.strip():
        # Remove all non-digit characters for validation
        digits = re.sub(r'\D', '', v)
        if len(digits) < 8 or len(digits) > 15:
            raise ValueError(f"Phone number must have 8-15 digits: {v}")
        return v.strip()
    return None


def validate_name(v: str) -> str:
    """Validate name format"""
    if not v or not v.strip():
        raise ValueError("Name cannot be empty")
    if len(v.strip()) < NAME_MIN_LENGTH:
        raise ValueError(f"Name must be at least {NAME_MIN_LENGTH} characters")
    if len(v.strip()) > NAME_MAX_LENGTH:
        raise ValueError(f"Name cannot exceed {NAME_MAX_LENGTH} characters")
    return v.strip()


# ==================== Participant Schemas ====================

class ParticipantBase(ORMBase):
    """Base schema for Participant with validation"""
    name: str = Field(
        ..., 
        min_length=NAME_MIN_LENGTH, 
        max_length=NAME_MAX_LENGTH,
        description="Full name of the participant",
        examples=["John Doe", "Jane Smith"]
    )
    email: Optional[str] = Field(
        None, 
        max_length=255,
        description="Email address",
        examples=["john.doe@example.com"]
    )
    telephone: Optional[str] = Field(
        None, 
        max_length=50,
        description="Phone number",
        examples=["+256712345678", "0712345678"]
    )
    title: Optional[str] = Field(
        None, 
        max_length=255,
        description="Job title or role",
        examples=["Project Manager", "Director"]
    )
    organization: Optional[str] = Field(
        None, 
        max_length=255,
        description="Organization or company name",
        examples=["Electoral Commission", "Ministry of Interior"]
    )
    notes: Optional[str] = Field(
        None, 
        max_length=5000,
        description="Additional notes about the participant"
    )
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate name field"""
        return validate_name(v)
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Validate email field"""
        return validate_email(v)
    
    @field_validator('telephone')
    @classmethod
    def validate_telephone(cls, v: Optional[str]) -> Optional[str]:
        """Validate telephone field"""
        return validate_phone(v)
    
    @model_validator(mode='after')
    def validate_at_least_one_contact(self) -> 'ParticipantBase':
        """Ensure at least one contact method is provided"""
        if not self.email and not self.telephone:
            # This is a warning, not an error - participants can have no contact info
            pass
        return self


class ParticipantCreate(ParticipantBase):
    """Schema for creating a participant"""
    pass


class ParticipantUpdate(ORMBase):
    """Schema for updating a participant - all fields optional"""
    name: Optional[str] = Field(
        None, 
        min_length=NAME_MIN_LENGTH, 
        max_length=NAME_MAX_LENGTH
    )
    email: Optional[str] = Field(None, max_length=255)
    telephone: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=255)
    organization: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=5000)
    is_active: Optional[bool] = None
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate name field if provided"""
        if v is not None:
            return validate_name(v)
        return v
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Validate email field if provided"""
        return validate_email(v)
    
    @field_validator('telephone')
    @classmethod
    def validate_telephone(cls, v: Optional[str]) -> Optional[str]:
        """Validate telephone field if provided"""
        return validate_phone(v)


class ParticipantResponse(ParticipantBase):
    """Schema for participant response with audit fields"""
    id: UUID = Field(..., description="Unique participant identifier")
    created_by_id: Optional[UUID] = Field(None, description="ID of user who created")
    created_by_name: Optional[str] = Field(None, description="Name of user who created")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_by_id: Optional[UUID] = Field(None, description="ID of user who last updated")
    updated_by_name: Optional[str] = Field(None, description="Name of user who last updated")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    is_active: bool = Field(True, description="Whether participant is active")
    
    @property
    def display_name(self) -> str:
        """Get display name with organization if available"""
        if self.organization:
            return f"{self.name} ({self.organization})"
        return self.name
    
    @property
    def has_contact_info(self) -> bool:
        """Check if participant has any contact information"""
        return bool(self.email or self.telephone)


# ==================== Paginated Response ====================

class PaginatedParticipantResponse(BaseModel):
    """Paginated response for participants list with metadata"""
    items: List[ParticipantResponse] = Field(..., description="List of participants")
    total: int = Field(..., ge=0, description="Total number of items")
    page: int = Field(..., ge=1, description="Current page number")
    size: int = Field(..., ge=1, le=100, description="Items per page")
    pages: int = Field(..., ge=0, description="Total number of pages")
    
    model_config = ConfigDict(from_attributes=True)
    
    @model_validator(mode='after')
    def validate_pagination(self) -> 'PaginatedParticipantResponse':
        """Validate pagination consistency"""
        if self.page < 1:
            self.page = 1
        if self.size < 1:
            self.size = 20
        if self.pages < 0:
            self.pages = 0
        return self
    
    @property
    def has_next(self) -> bool:
        """Check if there's a next page"""
        return self.page < self.pages
    
    @property
    def has_previous(self) -> bool:
        """Check if there's a previous page"""
        return self.page > 1
    
    @property
    def next_page(self) -> Optional[int]:
        """Get next page number"""
        return self.page + 1 if self.has_next else None
    
    @property
    def previous_page(self) -> Optional[int]:
        """Get previous page number"""
        return self.page - 1 if self.has_previous else None


# ==================== Bulk Create ====================

class ParticipantBulkCreate(BaseModel):
    """Schema for bulk creating participants"""
    participants: List[ParticipantCreate] = Field(
        ..., 
        min_length=1, 
        max_length=1000,
        description="List of participants to create"
    )
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('participants')
    @classmethod
    def validate_batch_size(cls, v: List[ParticipantCreate]) -> List[ParticipantCreate]:
        """Validate batch size"""
        if len(v) > 1000:
            raise ValueError("Cannot create more than 1000 participants at once")
        return v
    
    @property
    def count(self) -> int:
        """Get number of participants in batch"""
        return len(self.participants)


class BulkCreateResult(BaseModel):
    """Result of bulk create operation"""
    created: int = Field(0, ge=0, description="Number of participants created")
    failed: int = Field(0, ge=0, description="Number of participants failed")
    errors: List[Dict[str, Any]] = Field(default_factory=list, description="Error details")
    created_ids: List[UUID] = Field(default_factory=list, description="IDs of created participants")
    
    @property
    def success(self) -> bool:
        """Check if operation was successful"""
        return self.failed == 0


# ==================== Participant List (Group) Schemas ====================

class ParticipantListBase(ORMBase):
    """Base schema for Participant List"""
    name: str = Field(
        ..., 
        min_length=1, 
        max_length=255,
        description="Name of the participant list",
        examples=["Meeting Attendees", "Stakeholders", "Committee Members"]
    )
    description: Optional[str] = Field(
        None, 
        max_length=DESCRIPTION_MAX_LENGTH,
        description="Description of the list"
    )
    is_global: bool = Field(
        False, 
        description="Whether this list is accessible by all users"
    )
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate list name"""
        if not v or not v.strip():
            raise ValueError("List name cannot be empty")
        return v.strip()


class ParticipantListCreate(ParticipantListBase):
    """Schema for creating a participant list"""
    participant_ids: List[UUID] = Field(
        default_factory=list,
        description="Initial participant IDs to add to the list"
    )


class ParticipantListUpdate(ORMBase):
    """Schema for updating a participant list - all fields optional"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=DESCRIPTION_MAX_LENGTH)
    is_global: Optional[bool] = None
    participant_ids: Optional[List[UUID]] = Field(
        None, 
        description="Full replacement list of participant IDs"
    )
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate name if provided"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("List name cannot be empty")
        return v.strip() if v else v


class ParticipantListResponse(ParticipantListBase):
    """Schema for participant list response"""
    id: UUID = Field(..., description="Unique list identifier")
    created_by_id: Optional[UUID] = Field(None, description="ID of user who created")
    created_by_name: Optional[str] = Field(None, description="Name of user who created")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_by_id: Optional[UUID] = Field(None, description="ID of user who last updated")
    updated_by_name: Optional[str] = Field(None, description="Name of user who last updated")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    is_active: bool = Field(True, description="Whether list is active")
    participants: List[ParticipantResponse] = Field(
        default_factory=list, 
        description="Participants in the list"
    )
    participant_count: int = Field(0, ge=0, description="Number of participants in the list")
    
    @model_validator(mode='after')
    def set_participant_count(self) -> 'ParticipantListResponse':
        """Auto-set participant count from participants list"""
        if self.participants:
            self.participant_count = len(self.participants)
        return self
    
    @property
    def is_editable(self) -> bool:
        """Check if list can be edited by current user"""
        # This will be overridden by permission logic in API
        return True
    
    @property
    def display_name(self) -> str:
        """Get display name with global indicator"""
        if self.is_global:
            return f"{self.name} (Global)"
        return self.name


class ParticipantListDetailResponse(ParticipantListResponse):
    """Detailed participant list response with additional info"""
    created_by_email: Optional[str] = Field(None, description="Email of creator")
    updated_by_email: Optional[str] = Field(None, description="Email of last updater")
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    can_edit: bool = Field(True, description="Whether current user can edit this list")
    can_delete: bool = Field(True, description="Whether current user can delete this list")
    
    @property
    def permissions(self) -> Dict[str, bool]:
        """Get permission summary"""
        return {
            "can_edit": self.can_edit,
            "can_delete": self.can_delete,
            "can_view": True,
            "can_share": self.is_global or self.can_edit
        }


# ==================== List Members Management Schemas ====================

class AddParticipantsToListRequest(BaseModel):
    """Request schema for adding participants to a list"""
    participant_ids: List[UUID] = Field(
        ..., 
    min_length=1,
        max_length=500,
        description="List of participant IDs to add"
    )
    
    @field_validator('participant_ids')
    @classmethod
    def validate_participant_ids(cls, v: List[UUID]) -> List[UUID]:
        """Validate participant IDs are unique"""
        if len(v) != len(set(v)):
            raise ValueError("Duplicate participant IDs found")
        return v


class RemoveParticipantFromListRequest(BaseModel):
    """Request schema for removing a participant from a list"""
    participant_id: UUID = Field(..., description="ID of participant to remove")


class BulkAddParticipantsResponse(BaseModel):
    """Response for bulk add participants operation"""
    added_count: int = Field(0, ge=0, description="Number of participants added")
    skipped_count: int = Field(0, ge=0, description="Number of participants skipped")
    skipped_ids: List[UUID] = Field(default_factory=list, description="IDs of skipped participants")
    errors: List[str] = Field(default_factory=list, description="Error messages")
    
    @property
    def total_processed(self) -> int:
        """Get total number of participants processed"""
        return self.added_count + self.skipped_count
    
    @property
    def success(self) -> bool:
        """Check if operation had no errors"""
        return len(self.errors) == 0


class ParticipantListMemberResponse(ORMBase):
    """Schema for participant list member relationship"""
    participant_list_id: UUID = Field(..., description="List ID")
    participant_id: UUID = Field(..., description="Participant ID")
    added_at: datetime = Field(..., description="When the participant was added")
    added_by_id: Optional[UUID] = Field(None, description="ID of user who added")
    added_by_name: Optional[str] = Field(None, description="Name of user who added")
    participant: Optional[ParticipantResponse] = Field(None, description="Participant details")
    
    class Config:
        from_attributes = True


# ==================== List Summary and Analytics ====================

class ParticipantListSummary(BaseModel):
    """Summary statistics for participant lists"""
    total_lists: int = Field(0, ge=0, description="Total number of lists")
    global_lists: int = Field(0, ge=0, description="Number of global lists")
    personal_lists: int = Field(0, ge=0, description="Number of personal lists")
    total_participants_across_lists: int = Field(0, ge=0, description="Total participants across all lists")
    average_list_size: float = Field(0.0, ge=0.0, description="Average number of participants per list")
    
    @model_validator(mode='after')
    def calculate_average(self) -> 'ParticipantListSummary':
        """Calculate average list size"""
        if self.total_lists > 0:
            self.average_list_size = round(
                self.total_participants_across_lists / self.total_lists, 2
            )
        return self


class ParticipantListWithStatsResponse(ParticipantListResponse):
    """Participant list response with additional statistics"""
    created_by_email: Optional[str] = None
    updated_by_email: Optional[str] = None
    recent_members: List[ParticipantResponse] = Field(
        default_factory=list, 
        max_length=5,
        description="Recently added members"
    )
    
    @property
    def is_full(self) -> bool:
        """Check if list is at capacity (optional, if you have limits)"""
        return False  # Implement if you have list size limits


# ==================== Export Schemas ====================

class ParticipantListExportData(BaseModel):
    """Schema for exporting participant list data"""
    list_info: ParticipantListResponse
    exported_at: datetime = Field(default_factory=datetime.now)
    exported_by: Optional[str] = None
    total_members: int
    members: List[Dict[str, Any]]
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ParticipantImportPreview(BaseModel):
    """Preview of participant import"""
    total_rows: int
    valid_rows: int
    invalid_rows: int
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    preview: List[ParticipantCreate] = Field(default_factory=list, max_items=10)
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage"""
        if self.total_rows == 0:
            return 0.0
        return round((self.valid_rows / self.total_rows) * 100, 2)


# ==================== Search and Filter Schemas ====================

class ParticipantFilterParams(BaseModel):
    """Parameters for filtering participants"""
    search: Optional[str] = Field(None, min_length=1, max_length=100)
    organization: Optional[str] = Field(None, max_length=255)
    has_email: Optional[bool] = None
    has_phone: Optional[bool] = None
    is_active: Optional[bool] = True
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    
    @model_validator(mode='after')
    def validate_date_range(self) -> 'ParticipantFilterParams':
        """Validate date range"""
        if self.created_after and self.created_before and self.created_after > self.created_before:
            raise ValueError("created_after cannot be after created_before")
        return self


class ParticipantListFilterParams(BaseModel):
    """Parameters for filtering participant lists"""
    search: Optional[str] = Field(None, min_length=1, max_length=100)
    is_global: Optional[bool] = None
    is_active: Optional[bool] = True
    created_by_id: Optional[UUID] = None
    has_participants: Optional[bool] = None
    min_participants: Optional[int] = Field(None, ge=0)
    max_participants: Optional[int] = Field(None, ge=0)
    
    @model_validator(mode='after')
    def validate_participant_range(self) -> 'ParticipantListFilterParams':
        """Validate participant count range"""
        if self.min_participants and self.max_participants and self.min_participants > self.max_participants:
            raise ValueError("min_participants cannot be greater than max_participants")
        return self