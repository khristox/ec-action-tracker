# app/schemas/attribute_group.py
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from typing import Optional, List, Dict, Any, Union, Literal
from datetime import datetime
import uuid
import re


# ==================== BASE SCHEMAS ====================

class AttributeGroupBase(BaseModel):
    """Base schema for attribute group with common fields"""
    code: str = Field(
        ..., 
        min_length=2, 
        max_length=20, 
        description="Unique identifier code (e.g., 'GENDER', 'COUNTRY')",
        pattern=r'^[A-Z][A-Z0-9_]*$'
    )
    name: str = Field(
        ..., 
        min_length=2, 
        max_length=100, 
        description="Display name for the group"
    )
    description: Optional[str] = Field(
        None, 
        max_length=500, 
        description="Detailed description of what this attribute group represents"
    )
    allow_multiple: bool = Field(
        False, 
        description="Allow multiple values to be selected from this group"
    )
    is_required: bool = Field(
        False, 
        description="Whether this attribute is required for the entity"
    )
    validation_rules: Optional[Dict[str, Any]] = Field(
        None, 
        description="JSON validation rules (e.g., {'min': 1, 'max': 3, 'pattern': '^[A-Z]+$'})"
    )
    display_order: int = Field(
        0, 
        ge=0, 
        description="Order for UI display (lower numbers appear first)"
    )
    extra_metadata: Optional[Dict[str, Any]] = Field(
        None, 
        description="Additional metadata (icon, color, public flag, etc.)"
    )
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate code format - uppercase, starts with letter, only letters/numbers/underscores"""
        if not v:
            raise ValueError('Code cannot be empty')
        if not v[0].isalpha():
            raise ValueError('Code must start with a letter')
        if not re.match(r'^[A-Z][A-Z0-9_]*$', v):
            raise ValueError('Code must contain only uppercase letters, numbers, and underscores')
        return v.upper()
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate name is not empty and trimmed"""
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "code": "GENDER",
                "name": "Gender",
                "description": "Gender identity of the user",
                "allow_multiple": False,
                "is_required": True,
                "display_order": 5,
                "extra_metadata": {"icon": "user", "color": "#9C27B0", "public": True}
            }
        }
    )


class AttributeGroupCreate(AttributeGroupBase):
    """Schema for creating a new attribute group"""
    pass


class AttributeGroupUpdate(BaseModel):
    """Schema for updating an existing attribute group (all fields optional)"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    allow_multiple: Optional[bool] = None
    is_required: Optional[bool] = None
    validation_rules: Optional[Dict[str, Any]] = None
    display_order: Optional[int] = Field(None, ge=0)
    extra_metadata: Optional[Dict[str, Any]] = None
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v.strip()
        return v
    
    model_config = ConfigDict(from_attributes=True)


# ==================== LIMITED RESPONSE SCHEMAS (Public API) ====================

class AttributeLimitedResponse(BaseModel):
    """Limited attribute response for public API (excludes sensitive metadata)"""
    id: uuid.UUID
    code: str
    name: str
    short_name: Optional[str] = None
    sort_order: int = 0
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "code": "M",
                "name": "Male",
                "short_name": "M",
                "sort_order": 1
            }
        }
    )


class AttributeGroupLimitedResponse(BaseModel):
    """Limited attribute group response for public API (excludes audit fields)"""
    id: uuid.UUID
    code: str
    name: str
    description: Optional[str] = None
    allow_multiple: bool = False
    is_required: bool = False
    validation_rules: Optional[Dict[str, Any]] = None
    display_order: int = 0
    attributes: List[AttributeLimitedResponse] = Field(default_factory=list)
    
    @model_validator(mode='after')
    def set_default_attributes(self) -> 'AttributeGroupLimitedResponse':
        """Ensure attributes is always a list"""
        if self.attributes is None:
            self.attributes = []
        return self
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "code": "GENDER",
                "name": "Gender",
                "description": "Gender identity of the user",
                "allow_multiple": False,
                "is_required": True,
                "display_order": 5,
                "attributes": []
            }
        }
    )


# ==================== FULL RESPONSE SCHEMAS (Admin/Internal API) ====================

class AttributeResponse(BaseModel):
    """Full attribute response with all metadata (admin/internal use)"""
    id: uuid.UUID
    group_id: uuid.UUID
    code: str
    name: str
    short_name: Optional[str] = None
    alt_code: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    extra_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_id: Optional[uuid.UUID] = None
    updated_by_id: Optional[uuid.UUID] = None
    group_code: Optional[str] = None
    group_name: Optional[str] = None
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "group_id": "550e8400-e29b-41d4-a716-446655440001",
                "code": "M",
                "name": "Male",
                "short_name": "M",
                "sort_order": 1,
                "is_active": True,
                "created_at": "2024-01-01T00:00:00Z"
            }
        }
    )


class AttributeGroupResponse(AttributeGroupBase):
    """Full attribute group response with all metadata (admin/internal use)"""
    id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_id: Optional[uuid.UUID] = None
    updated_by_id: Optional[uuid.UUID] = None
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "code": "GENDER",
                "name": "Gender",
                "description": "Gender identity of the user",
                "allow_multiple": False,
                "is_required": True,
                "display_order": 5,
                "created_at": "2024-01-01T00:00:00Z"
            }
        }
    )


class AttributeGroupWithAttributes(AttributeGroupResponse):
    """Full attribute group response with its attributes (admin/internal use)"""
    attributes: List[AttributeResponse] = Field(default_factory=list)
    
    @model_validator(mode='after')
    def set_default_attributes(self) -> 'AttributeGroupWithAttributes':
        """Ensure attributes is always a list"""
        if self.attributes is None:
            self.attributes = []
        return self
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "code": "GENDER",
                "name": "Gender",
                "description": "Gender identity of the user",
                "allow_multiple": False,
                "is_required": True,
                "display_order": 5,
                "created_at": "2024-01-01T00:00:00Z",
                "attributes": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440001",
                        "code": "M",
                        "name": "Male",
                        "short_name": "M",
                        "sort_order": 1
                    }
                ]
            }
        }
    )


# ==================== PAGINATION SCHEMAS ====================

class AttributeGroupListResponse(BaseModel):
    """Paginated response for attribute groups"""
    items: List[Union[AttributeGroupLimitedResponse, AttributeGroupWithAttributes]]
    total: int
    page: int
    size: int
    pages: int
    
    @model_validator(mode='after')
    def calculate_pages(self) -> 'AttributeGroupListResponse':
        """Calculate total pages based on total and size"""
        self.pages = (self.total + self.size - 1) // self.size if self.total > 0 else 0
        return self
    
    model_config = ConfigDict(from_attributes=True)


# ==================== UTILITY TYPES ====================

# Type alias for response based on detail level
AttributeGroupResponseType = Union[AttributeGroupLimitedResponse, AttributeGroupWithAttributes]
AttributeResponseType = Union[AttributeLimitedResponse, AttributeResponse]


# ==================== EXPORTS ====================

__all__ = [
    # Base
    "AttributeGroupBase",
    "AttributeGroupCreate",
    "AttributeGroupUpdate",
    
    # Limited responses (public)
    "AttributeLimitedResponse",
    "AttributeGroupLimitedResponse",
    
    # Full responses (admin)
    "AttributeResponse",
    "AttributeGroupResponse",
    "AttributeGroupWithAttributes",
    
    # Pagination
    "AttributeGroupListResponse",
    
    # Type aliases
    "AttributeGroupResponseType",
    "AttributeResponseType",
]