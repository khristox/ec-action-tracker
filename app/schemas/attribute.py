# app/schemas/attribute.py
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import re


class AttributeBase(BaseModel):
    """Base schema for attribute"""
    code: str = Field(..., min_length=1, max_length=50, description="Unique identifier within group")
    name: str = Field(..., min_length=3, max_length=100, description="Display name")
    short_name: Optional[str] = Field(None, max_length=50, description="Short display name")
    alt_code: Optional[str] = Field(None, max_length=50, description="Alternative code for compatibility")
    description: Optional[str] = Field(None, max_length=500, description="Attribute description")
    sort_order: int = Field(0, description="Order within group")
    is_active: bool = Field(True, description="Is this attribute active")
    extra_metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata (e.g., credits, duration, icon)")
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate code format"""
        if not re.match(r'^[A-Z][A-Z0-9_]*$', v):
            raise ValueError('Code must start with uppercase letter and contain only uppercase letters, numbers, and underscores')
        return v.upper()


class AttributeCreate(AttributeBase):
    """Schema for creating an attribute - can use either group_id or group_code"""
    group_id: Optional[uuid.UUID] = Field(None, description="ID of the parent group")
    group_code: Optional[str] = Field(None, min_length=2, max_length=20, description="Code of the parent group (alternative to group_id)")
    
    @field_validator('group_code')
    @classmethod
    def validate_group_code(cls, v: Optional[str]) -> Optional[str]:
        """Validate group code format"""
        if v:
            if not re.match(r'^[A-Z][A-Z0-9_]*$', v):
                raise ValueError('Group code must start with uppercase letter and contain only uppercase letters, numbers, and underscores')
            return v.upper()
        return v
    
    @model_validator(mode='after')
    def validate_group_identifier(self) -> 'AttributeCreate':
        """Ensure either group_id or group_code is provided"""
        if not self.group_id and not self.group_code:
            raise ValueError('Either group_id or group_code must be provided')
        return self


class AttributeUpdate(BaseModel):
    """Schema for updating an attribute"""
    code: Optional[str] = Field(None, min_length=2, max_length=50)
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    short_name: Optional[str] = Field(None, max_length=50)
    alt_code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    extra_metadata: Optional[Dict[str, Any]] = None


class AttributeResponse(AttributeBase):
    """Schema for attribute response"""
    id: uuid.UUID
    group_id: uuid.UUID
    group_code: Optional[str] = None
    group_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_id: Optional[uuid.UUID] = None
    updated_by_id: Optional[uuid.UUID] = None
    
    model_config = ConfigDict(from_attributes=True)


class AttributeListResponse(BaseModel):
    """Paginated attribute list response"""
    items: List[AttributeResponse]
    total: int
    page: int
    size: int
    pages: int