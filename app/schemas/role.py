# app/schemas/role.py

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import re


# ==================== PERMISSION SCHEMAS ====================

class PermissionBrief(BaseModel):
    """Brief permission schema for nested responses"""
    
    id: UUID = Field(..., description="Permission ID")
    name: str = Field(..., description="Permission name")
    code: str = Field(..., description="Permission code")
    resource: Optional[str] = Field(None, description="Resource this permission applies to")
    action: Optional[str] = Field(None, description="Action this permission allows")
    category: Optional[str] = Field(None, description="Permission category for grouping")
    
    model_config = ConfigDict(from_attributes=True)


# ==================== ROLE BASE SCHEMAS ====================

class RoleBase(BaseModel):
    """Base schema for Role with common attributes"""
    
    name: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Role name (e.g., 'Administrator', 'Project Manager')",
        examples=["Administrator", "Project Manager"]
    )
    
    code: str = Field(
        ...,
        min_length=2,
        max_length=50,
        pattern=r"^[a-z_]+$",
        description="Role code (lowercase letters and underscores only)",
        examples=["admin", "project_manager"]
    )
    
    description: Optional[str] = Field(
        None,
        max_length=255,
        description="Role description",
        examples=["Full system access", "Can manage projects"]
    )
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "name": "Content Manager",
                "code": "content_manager",
                "description": "Manages content and media"
            }
        }
    )
    
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate role name"""
        if not v.strip():
            raise ValueError("Role name cannot be empty or whitespace only")
        if not re.match(r"^[a-zA-Z0-9\s\-_]+$", v):
            raise ValueError("Role name can only contain letters, numbers, spaces, hyphens, and underscores")
        return v.strip()
    
    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate role code"""
        if not v.strip():
            raise ValueError("Role code cannot be empty or whitespace only")
        if not re.match(r"^[a-z_]+$", v):
            raise ValueError("Role code must contain only lowercase letters and underscores")
        if v.startswith("_") or v.endswith("_"):
            raise ValueError("Role code cannot start or end with underscore")
        if "__" in v:
            raise ValueError("Role code cannot contain consecutive underscores")
        return v.lower()


# ==================== ROLE CREATE/UPDATE SCHEMAS ====================

class RoleCreate(RoleBase):
    """Schema for creating a new role"""
    
    is_system_role: bool = Field(
        False,
        description="Whether this is a system role (system roles cannot be deleted/modified)"
    )
    
    priority: int = Field(
        0,
        ge=0,
        le=100,
        description="Role priority (higher priority roles override lower ones)",
        examples=[10, 50, 100]
    )
    
    is_active: bool = Field(
        True,
        description="Whether the role is active"
    )
    
    permission_ids: Optional[List[UUID]] = Field(
        None,
        description="List of permission IDs to assign to this role",
        examples=[["123e4567-e89b-12d3-a456-426614174000"]]
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Editor",
                "code": "editor",
                "description": "Can edit and publish content",
                "is_system_role": False,
                "priority": 50,
                "is_active": True,
                "permission_ids": ["123e4567-e89b-12d3-a456-426614174000"]
            }
        }
    )
    
    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: int) -> int:
        """Validate priority"""
        if v < 0 or v > 100:
            raise ValueError("Priority must be between 0 and 100")
        return v


class RoleUpdate(BaseModel):
    """Schema for updating an existing role"""
    
    name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=50,
        description="Updated role name"
    )
    
    description: Optional[str] = Field(
        None,
        max_length=255,
        description="Updated role description"
    )
    
    priority: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="Updated role priority"
    )
    
    is_active: Optional[bool] = Field(
        None,
        description="Whether the role is active"
    )
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "Senior Editor",
                "description": "Senior editor with additional permissions",
                "priority": 75,
                "is_active": True
            }
        }
    )
    
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate name if provided"""
        if v is not None:
            if not v.strip():
                raise ValueError("Role name cannot be empty or whitespace only")
            if not re.match(r"^[a-zA-Z0-9\s\-_]+$", v):
                raise ValueError("Role name can only contain letters, numbers, spaces, hyphens, and underscores")
            return v.strip()
        return v
    
    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: Optional[int]) -> Optional[int]:
        """Validate priority if provided"""
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Priority must be between 0 and 100")
        return v


# ==================== ROLE RESPONSE SCHEMAS ====================

class RoleResponse(BaseModel):
    """Role response schema with permissions"""
    
    id: UUID = Field(..., description="Unique role identifier")
    name: str = Field(..., description="Role name")
    code: str = Field(..., description="Role code")
    description: Optional[str] = Field(None, description="Role description")
    is_system_role: bool = Field(False, description="Whether this is a system role")
    priority: int = Field(0, description="Role priority")
    is_active: bool = Field(True, description="Whether the role is active")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    user_count: int = Field(0, description="Number of users with this role")
    permissions: List[PermissionBrief] = Field(
        default_factory=list,
        description="List of permissions assigned to this role"
    )
    
    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Administrator",
                "code": "admin",
                "description": "Full system access",
                "is_system_role": True,
                "priority": 100,
                "is_active": True,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
                "user_count": 5,
                "permissions": []
            }
        }
    )


class RoleBrief(BaseModel):
    """Brief role schema for nested responses"""
    
    id: UUID = Field(..., description="Role ID")
    name: str = Field(..., description="Role name")
    code: str = Field(..., description="Role code")
    
    model_config = ConfigDict(from_attributes=True)


# ==================== LIST & PAGINATION SCHEMAS ====================

class RoleListResponse(BaseModel):
    """Schema for paginated role list response"""
    
    items: List[RoleResponse] = Field(..., description="List of roles")
    total: int = Field(..., description="Total number of roles")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "items": [],
                "total": 10,
                "page": 1,
                "page_size": 20,
                "total_pages": 1
            }
        }
    )


# ==================== ASSIGNMENT SCHEMAS ====================

class RolePermissionAssignment(BaseModel):
    """Schema for assigning permissions to a role"""
    
    permission_ids: List[UUID] = Field(
        ...,
        min_length=1,
        description="List of permission IDs to assign"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "permission_ids": [
                    "123e4567-e89b-12d3-a456-426614174000",
                    "123e4567-e89b-12d3-a456-426614174001"
                ]
            }
        }
    )
    
    @field_validator("permission_ids")
    @classmethod
    def validate_permission_ids(cls, v: List[UUID]) -> List[UUID]:
        """Validate permission IDs list"""
        if not v:
            raise ValueError("At least one permission ID is required")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate permission IDs are not allowed")
        return v


class RoleUserAssignment(BaseModel):
    """Schema for assigning users to a role"""
    
    user_ids: List[UUID] = Field(
        ...,
        min_length=1,
        description="List of user IDs to assign"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_ids": [
                    "123e4567-e89b-12d3-a456-426614174000",
                    "123e4567-e89b-12d3-a456-426614174001"
                ]
            }
        }
    )


# ==================== VALIDATION SCHEMAS ====================

class RoleValidationResult(BaseModel):
    """Schema for role validation results"""
    
    valid: bool = Field(..., description="Whether validation passed")
    errors: List[str] = Field(default_factory=list, description="List of validation errors")
    warnings: List[str] = Field(default_factory=list, description="List of validation warnings")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "valid": True,
                "errors": [],
                "warnings": ["Role has no permissions assigned"]
            }
        }
    )