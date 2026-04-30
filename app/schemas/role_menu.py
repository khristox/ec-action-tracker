# app/schemas/role_menu.py
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class RoleMenuPermissionBase(BaseModel):
    """Base schema for role-menu permissions"""
    role_id: UUID
    menu_id: UUID
    can_view: bool = True
    can_access: bool = True
    can_show_mb_bottom: bool = False
    
    model_config = ConfigDict(from_attributes=True)

class RoleMenuPermissionCreate(RoleMenuPermissionBase):
    """Schema for creating role-menu permission"""
    pass

class RoleMenuPermissionUpdate(BaseModel):
    """Schema for updating role-menu permission"""
    can_view: Optional[bool] = None
    can_access: Optional[bool] = None
    can_show_mb_bottom: Optional[bool] = None
    
    model_config = ConfigDict(from_attributes=True)

class RoleMenuPermissionResponse(RoleMenuPermissionBase):
    """Schema for role-menu permission response"""
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class MenuAssignment(BaseModel):
    """Schema for assigning a single menu to role"""
    menu_id: UUID
    can_view: bool = True
    can_access: bool = True
    can_show_mb_bottom: bool = False

class BulkMenuAssignment(BaseModel):
    """Schema for bulk menu assignment to role"""
    role_id: UUID
    menus: List[MenuAssignment] = []
    
    @field_validator('menus')
    @classmethod
    def validate_menus(cls, v):
        if not v:
            raise ValueError('At least one menu must be assigned')
        return v

class RoleMenuTree(BaseModel):
    """Schema for role menu tree structure"""
    menu_id: UUID
    menu_code: str
    menu_title: str
    menu_path: Optional[str] = None
    menu_icon: Optional[str] = None
    parent_id: Optional[UUID] = None
    can_view: bool = False
    can_access: bool = False
    can_show_mb_bottom: bool = False
    children: List['RoleMenuTree'] = []
    
    model_config = ConfigDict(from_attributes=True)

class RolePermissionsResponse(BaseModel):
    """Schema for role permissions response"""
    role_id: UUID
    role_name: str
    role_code: str
    permissions: List[RoleMenuTree]
    total_menus: int
    assigned_menus: int

# Update forward reference
RoleMenuTree.model_rebuild()