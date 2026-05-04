# app/schemas/recurring_meeting_schema.py
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from uuid import UUID

from app.models.general.dynamic_attribute import Attribute

# Base Schema
class RecurringMeetingBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    
    # Recurrence Settings (using attribute UUIDs)
    recurrence_type_id: UUID = Field(..., description="UUID from attributes table for recurrence type")
    recurrence_interval: int = Field(default=1, ge=1, le=365)
    recurrence_days: Optional[List[UUID]] = Field(None, description="Array of attribute UUIDs for days")
    recurrence_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    recurrence_week_of_month_id: Optional[UUID] = Field(None, description="Attribute UUID for week of month")
    recurrence_day_of_week_id: Optional[UUID] = Field(None, description="Attribute UUID for day of week")
    recurrence_end_date: Optional[datetime] = None
    recurrence_max_occurrences: Optional[int] = Field(None, ge=1, le=999)
    recurrence_end_after_occurrences: Optional[int] = Field(None, ge=1, le=999)
    
    # Meeting Template
    meeting_template_id: Optional[UUID] = None
    
    # Timing
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    
    # Location
    location_id: Optional[UUID] = None
    location_text: Optional[str] = None
    platform: str = "physical"
    meeting_link: Optional[str] = None
    
    # Leadership
    chairperson_id: Optional[UUID] = None
    secretary_id: Optional[UUID] = None
    facilitator: Optional[str] = None
    
    # Participants
    default_participant_ids: Optional[List[UUID]] = None
    
    # Agenda
    agenda: Optional[str] = None
    additional_info: Optional[Dict[str, Any]] = None
    
    # Status
    status_id: UUID = Field(..., description="UUID from attributes table for recurring meeting status")
    
    @validator('duration_minutes', always=True)
    def validate_duration(cls, v, values):
        if v is None and values.get('start_time') and values.get('end_time'):
            delta = values['end_time'] - values['start_time']
            return int(delta.total_seconds() / 60)
        return v
    
    @validator('recurrence_days')
    def validate_recurrence_days(cls, v, values):
        if v and values.get('recurrence_type_id'):
            # Weekly recurrence typically requires days
            # This will be validated against attribute values at service level
            pass
        return v

# Create Schema
class RecurringMeetingCreate(RecurringMeetingBase):
    pass

# Update Schema
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
    recurrence_end_after_occurrences: Optional[int] = Field(None, ge=1, le=999)
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

# Response Schema with Attribute Details
class AttributeBrief(BaseModel):
    id: UUID
    code: str
    name: str
    value: Optional[str] = None
    
    class Config:
        from_attributes = True

class RecurringMeetingResponse(RecurringMeetingBase):
    id: UUID
    recurrence_type: AttributeBrief
    recurrence_week_of_month: Optional[AttributeBrief] = None
    recurrence_day_of_week: Optional[AttributeBrief] = None
    status: AttributeBrief
    last_occurrence_date: Optional[datetime] = None
    next_occurrence_date: Optional[datetime] = None
    occurrences_count: int
    total_occurrences_generated: int
    created_by_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    occurrences: List['RecurringMeetingOccurrenceResponse'] = []
    
    class Config:
        from_attributes = True

class RecurringMeetingOccurrenceResponse(BaseModel):
    id: UUID
    recurring_meeting_id: UUID
    meeting_id: UUID
    occurrence_number: int
    scheduled_date: datetime
    status: str
    rescheduled_to_date: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    meeting_title: Optional[str] = None
    
    class Config:
        from_attributes = True

# Preview Occurrences Request (uses attribute UUIDs for calculation)
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

# Generate Occurrences Request
class GenerateOccurrencesRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    max_occurrences: Optional[int] = Field(None, ge=1, le=100)

# Bulk Action Request
class BulkActionRequest(BaseModel):
    recurring_meeting_ids: List[UUID]
    action: str  # pause, resume, cancel, delete

# Helper to map attribute UUIDs to values
class AttributeValueMapper:
    """Helper class to map attribute UUIDs to their values"""
    
    @staticmethod
    def get_attribute_value(attribute) -> str:
        """Extract value from attribute's extra_metadata"""
        if not attribute:
            return None
        return attribute.extra_metadata.get("value") if attribute.extra_metadata else None
    
    @staticmethod
    def get_recurrence_type(db, attribute_id: UUID) -> Optional[str]:
        """Get recurrence type value from attribute UUID"""
        attribute = db.query(Attribute).filter(Attribute.id == attribute_id).first()
        return AttributeValueMapper.get_attribute_value(attribute)
    
    @staticmethod
    def get_recurrence_day_values(db, attribute_ids: List[UUID]) -> List[str]:
        """Get recurrence day values from attribute UUIDs"""
        if not attribute_ids:
            return []
        attributes = db.query(Attribute).filter(Attribute.id.in_(attribute_ids)).all()
        return [AttributeValueMapper.get_attribute_value(attr) for attr in attributes if attr]
    
    @staticmethod
    def get_recurrence_week_value(db, attribute_id: UUID) -> Optional[int]:
        """Get recurrence week value from attribute UUID"""
        attribute = db.query(Attribute).filter(Attribute.id == attribute_id).first()
        value = AttributeValueMapper.get_attribute_value(attribute)
        return int(value) if value else None

# Update forward references
RecurringMeetingResponse.model_rebuild()