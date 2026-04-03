# app/schemas/role.py

from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class RoleBase(BaseModel):
    """Base schema for Role"""
    name: str = Field(..., min_length=2, max_length=50)
    code: str = Field(..., min_length=2, max_length=50, pattern="^[a-z_]+$")  # Changed from regex to pattern
    description: Optional[str] = Field(None, max_length=255)


class RoleCreate(RoleBase):
    """Schema for creating a role"""
    is_system_role: bool = False
    priority: int = Field(0, ge=0, le=100)


class RoleUpdate(BaseModel):
    """Schema for updating a role"""
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    priority: Optional[int] = Field(None, ge=0, le=100)


class RoleResponse(RoleBase):
    """Schema for role response"""
    id: UUID
    is_system_role: bool
    priority: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class RoleWithPermissions(RoleResponse):
    """Schema for role with permissions"""
    permissions: List['PermissionResponse'] = []


# Import here to avoid circular imports
from app.schemas.permission import PermissionResponse
RoleWithPermissions.model_rebuild()