# app/schemas/action_tracker/meeting_minutes.py
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from uuid import UUID
from datetime import datetime
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
    description: str = Field(..., min_length=1)
    assigned_to_id: Optional[UUID] = None
    # This stores the Dict/JSON from the DB
    assigned_to_name: Optional[Union[str, Dict[str, Any], Any]] = Field(None)
    due_date: Optional[datetime] = None
    priority: int = Field(2, ge=1, le=4)
    remarks: Optional[str] = None

    @field_validator('assigned_to_name', mode='before')
    @classmethod
    def validate_assigned_to_name(cls, v: Any) -> Any:
        if v is None:
            return None
        # Ensure it's handled as a dict internally if it's a string
        if isinstance(v, str):
            return {"name": v, "type": "manual"}
        return v


class MeetingActionCreate(MeetingActionBase):
    pass


class MeetingActionUpdate(ORMBase):
    description: Optional[str] = None
    assigned_to_id: Optional[UUID] = None
    assigned_to_name: Optional[Union[str, Dict[str, Any]]] = None
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
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    
    # This is the dedicated string field for the Frontend
    assigned_to_name_display: Optional[str] = "Unassigned"

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


# ==================== Meeting Minutes Schemas ====================

class MeetingMinutesBase(BaseModel):
    """Base schema for meeting minutes"""
    topic: Optional[str] = None
    discussion: Optional[str] = None   # ← ADD THIS
    decisions: Optional[str] = None    # ← ADD THIS
    timestamp: Optional[datetime] = None


class MeetingMinutesCreate(MeetingMinutesBase):
    pass


class MeetingMinutesUpdate(ORMBase):
    topic: Optional[str] = None
    discussion: Optional[str] = None
    decisions: Optional[str] = None


# In your schemas/action_tracker.py or meeting.py

class MeetingMinutesResponse(MeetingMinutesBase):
    """Response schema for meeting minutes"""
    id: UUID
    meeting_id: UUID
    timestamp: datetime
    topic: Optional[str] = None
    discussion: Optional[str] = None  # ← ADD THIS
    decisions: Optional[str] = None    # ← ADD THIS
    recorded_by_id: Optional[UUID] = None
    recorded_by_name: Optional[str] = None
    recorded_by_username: Optional[str] = None
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    actions: List[MeetingActionResponse] = Field(default_factory=list)
    
    class Config:
        from_attributes = True


class PaginatedMinutesResponse(BaseModel):
    """Paginated response wrapper for meeting minutes"""
    items: List[MeetingMinutesResponse]
    total: int
    page: int
    size: int
    pages: int
    has_next: bool
    has_prev: bool
    
    class Config:
        from_attributes = True


# Update forward references
MeetingMinutesResponse.model_rebuild()
MeetingActionResponse.model_rebuild()