# app/schemas/permission.py

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


class PermissionBase(BaseModel):
    """Base schema for Permission"""
    name: str = Field(..., min_length=3, max_length=100)
    code: str = Field(..., min_length=3, max_length=50, pattern="^[a-z:_]+$")  # Changed from regex to pattern
    resource: str = Field(..., min_length=2, max_length=50)
    action: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=255)


class PermissionCreate(PermissionBase):
    """Schema for creating a permission"""
    conditions: Optional[Dict[str, Any]] = None
    is_system: bool = False


class PermissionUpdate(BaseModel):
    """Schema for updating a permission"""
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    conditions: Optional[Dict[str, Any]] = None


class PermissionResponse(PermissionBase):
    """Schema for permission response"""
    id: UUID
    is_system: bool
    conditions: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True