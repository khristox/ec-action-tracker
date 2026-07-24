# app/schemas/recurring_meeting_schema.py - FIXED VERSION
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID


# ==================== Base Schemas ====================

class RecurringMeetingBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    recurrence_type_id: UUID
    recurrence_interval: int = Field(default=1, ge=1, le=365)
    recurrence_days: Optional[List[UUID]] = None
    recurrence_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    recurrence_week_of_month_id: Optional[UUID] = None
    recurrence_day_of_week_id: Optional[UUID] = None
    recurrence_end_date: Optional[datetime] = None
    recurrence_max_occurrences: Optional[int] = Field(None, ge=1, le=999)
    recurrence_end_after_occurrences: Optional[int] = None
    meeting_template_id: Optional[UUID] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    location_id: Optional[UUID] = None
    location_text: Optional[str] = None
    platform: str = "physical"
    meeting_link: Optional[str] = None
    chairperson_id: Optional[UUID] = None
    secretary_id: Optional[UUID] = None
    facilitator: Optional[str] = None
    default_participant_ids: Optional[List[UUID]] = None
    agenda: Optional[str] = None
    additional_info: Optional[Dict[str, Any]] = None
    status_id: UUID
    visibility: Optional[str] = Field(default="open", description="'open' or 'department'")
    restricted_department_id: Optional[UUID] = Field(None, description="Department ID if visibility is 'department'")



class RecurringMeetingCreate(RecurringMeetingBase):
    pass


class RecurringMeetingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    recurrence_type_id: Optional[UUID] = None
    recurrence_interval: Optional[int] = Field(None, ge=1, le=365)
    recurrence_days: Optional[List[UUID]] = None
    recurrence_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    recurrence_week_of_month_id: Optional[UUID] = None
    recurrence_day_of_week_id: Optional[UUID] = None
    recurrence_end_date: Optional[datetime] = None
    recurrence_max_occurrences: Optional[int] = Field(None, ge=1, le=999)
    recurrence_end_after_occurrences: Optional[int] = None
    meeting_template_id: Optional[UUID] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    location_id: Optional[UUID] = None
    location_text: Optional[str] = None
    platform: Optional[str] = None
    meeting_link: Optional[str] = None
    chairperson_id: Optional[UUID] = None
    secretary_id: Optional[UUID] = None
    facilitator: Optional[str] = None
    default_participant_ids: Optional[List[UUID]] = None
    agenda: Optional[str] = None
    additional_info: Optional[Dict[str, Any]] = None
    status_id: Optional[UUID] = None
    visibility: Optional[str] = None
    restricted_department_id: Optional[UUID] = None

# ==================== Response Schemas ====================

class AttributeBrief(BaseModel):
    id: UUID
    code: str
    name: str
    value: Optional[str] = None
    
    class Config:
        from_attributes = True


class RecurringMeetingOccurrenceResponse(BaseModel):
    id: UUID
    recurring_meeting_id: UUID
    meeting_id: UUID
    occurrence_number: int
    scheduled_date: datetime
    start_time:datetime
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class RecurringMeetingResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    recurrence_type_id: UUID
    recurrence_interval: int
    recurrence_days: Optional[List[UUID]] = None
    recurrence_day_of_month: Optional[int] = None
    recurrence_week_of_month_id: Optional[UUID] = None
    recurrence_day_of_week_id: Optional[UUID] = None
    recurrence_end_date: Optional[datetime] = None
    recurrence_max_occurrences: Optional[int] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location_id: Optional[UUID] = None
    location_text: Optional[str] = None
    platform: str
    meeting_link: Optional[str] = None
    chairperson_id: Optional[UUID] = None
    secretary_id: Optional[UUID] = None
    facilitator: Optional[str] = None
    default_participant_ids: Optional[List[UUID]] = None
    agenda: Optional[str] = None
    additional_info: Optional[Dict[str, Any]] = None
    status_id: UUID
    last_occurrence_date: Optional[datetime] = None
    next_occurrence_date: Optional[datetime] = None
    occurrences_count: int
    total_occurrences_generated: int
    created_by_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Make nested relationships optional
    recurrence_type: Optional[AttributeBrief] = None
    status: Optional[AttributeBrief] = None
    occurrences: List[RecurringMeetingOccurrenceResponse] = []
    visibility: Optional[str] = None
    restricted_department_id: Optional[UUID] = None
    
    last_occurrence_date: Optional[datetime] = None
        
    class Config:
        from_attributes = True


# ==================== Request Schemas ====================

class PreviewOccurrencesRequest(BaseModel):
    recurrence_type_id: UUID
    recurrence_interval: int = 1
    recurrence_days: Optional[List[UUID]] = None
    recurrence_day_of_month: Optional[int] = None
    recurrence_week_of_month_id: Optional[UUID] = None
    recurrence_day_of_week_id: Optional[UUID] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    max_occurrences: int = Field(default=10, ge=1, le=50)


class GenerateOccurrencesRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    max_occurrences: Optional[int] = Field(None, ge=1, le=100)


class BulkActionRequest(BaseModel):
    recurring_meeting_ids: List[UUID]
    action: str


# Update forward references
RecurringMeetingResponse.model_rebuild()