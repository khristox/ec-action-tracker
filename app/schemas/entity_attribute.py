# app/schemas/entity_attribute.py
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
import uuid
import json


class EntityAttributeBase(BaseModel):
    """Base schema for entity attribute association"""
    entity_type: str = Field(..., min_length=2, max_length=50, description="Type of entity (course, user, product)")
    entity_id: uuid.UUID = Field(..., description="ID of the entity")
    attribute_id: uuid.UUID = Field(..., description="ID of the attribute")
    value: Optional[Union[str, int, float, bool, dict, list]] = Field(None, description="Value of the attribute")
    value_type: str = Field("text", description="Type of value (text, number, date, json)")
    extra_data: Optional[Dict[str, Any]] = Field(None, description="Additional metadata for this association")
    
    @field_validator('entity_type')
    @classmethod
    def validate_entity_type(cls, v: str) -> str:
        """Validate entity type"""
        allowed = ['course', 'user', 'product', 'lesson', 'module']
        if v not in allowed:
            raise ValueError(f'entity_type must be one of: {", ".join(allowed)}')
        return v.lower()
    
    @field_validator('value_type')
    @classmethod
    def validate_value_type(cls, v: str) -> str:
        """Validate value type"""
        allowed = ['text', 'number', 'date', 'json']
        if v not in allowed:
            raise ValueError(f'value_type must be one of: {", ".join(allowed)}')
        return v


class EntityAttributeCreate(EntityAttributeBase):
    """Schema for creating an entity attribute"""
    pass


class EntityAttributeUpdate(BaseModel):
    """Schema for updating an entity attribute"""
    value: Optional[Union[str, int, float, bool, dict, list]] = None
    value_type: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class EntityAttributeResponse(EntityAttributeBase):
    """Schema for entity attribute response"""
    id: uuid.UUID
    attribute_code: Optional[str] = None
    attribute_name: Optional[str] = None
    group_code: Optional[str] = None
    group_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_id: Optional[uuid.UUID] = None
    
    model_config = ConfigDict(from_attributes=True)


class EntityWithAttributesResponse(BaseModel):
    """Schema for entity with all its attributes"""
    entity_id: uuid.UUID
    entity_type: str
    attributes: Dict[str, Any] = Field(description="Dictionary of attributes grouped by group code")
    
    model_config = ConfigDict(from_attributes=True)


class BulkEntityAttributeCreate(BaseModel):
    """Schema for bulk creating entity attributes"""
    attributes: List[EntityAttributeCreate] = Field(..., min_length=1)