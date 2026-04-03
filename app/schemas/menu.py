# app/schemas/menu.py
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any, ForwardRef
from uuid import UUID
from datetime import datetime
from enum import Enum


# ==================== Enums ====================

class MenuTarget(str, Enum):
    """Target for menu link opening"""
    SELF = "_self"
    BLANK = "_blank"
    PARENT = "_parent"
    TOP = "_top"


class MenuIcon(str, Enum):
    """Common menu icon names for consistency"""
    DASHBOARD = "Dashboard"
    BUSINESS = "Business"
    PEOPLE = "People"
    DESCRIPTION = "Description"
    PAYMENTS = "Payments"
    SETTINGS = "Settings"
    PERSON = "Person"
    SECURITY = "Security"
    NOTIFICATIONS = "Notifications"
    APARTMENT = "Apartment"
    HOME = "Home"
    BUILD = "Build"
    FOLDER = "Folder"
    ASSESSMENT = "Assessment"
    ANALYTICS = "Analytics"
    EVENT = "Event"
    TUNE = "Tune"
    BADGE = "Badge"
    HISTORY = "History"
    BACKUP = "Backup"
    KEY = "Key"
    STAR = "Star"
    DELETE = "Delete"
    EDIT = "Edit"
    ADD = "Add"


# ==================== Menu Schemas ====================

class MenuBase(BaseModel):
    """Base schema for Menu with common fields"""
    code: str = Field(
        ..., 
        min_length=2, 
        max_length=50,
        pattern=r'^[a-z_][a-z0-9_]*$',
        description="Unique menu code (lowercase with underscores)"
    )
    title: str = Field(..., min_length=1, max_length=100, description="Display title")
    icon: Optional[str] = Field(None, max_length=50, description="Material-UI icon name")
    path: Optional[str] = Field(None, max_length=255, description="Route path")
    parent_id: Optional[UUID] = Field(None, description="Parent menu ID for hierarchy")
    sort_order: int = Field(0, ge=0, description="Display order")
    is_active: bool = Field(True, description="Whether menu is active")
    requires_auth: bool = Field(True, description="Whether authentication is required")
    target: MenuTarget = Field(MenuTarget.SELF, description="Link target")
    badge: Optional[str] = Field(None, max_length=50, description="Badge text/notification count")
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate menu code format"""
        if not v.islower() and '_' not in v:
            raise ValueError('Code must be lowercase with underscores')
        return v
    
    class Config:
        use_enum_values = True


class MenuCreate(MenuBase):
    """Schema for creating a new menu"""
    pass


class MenuUpdate(BaseModel):
    """Schema for updating an existing menu"""
    code: Optional[str] = Field(None, min_length=2, max_length=50)
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    path: Optional[str] = Field(None, max_length=255)
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    requires_auth: Optional[bool] = None
    target: Optional[MenuTarget] = None
    badge: Optional[str] = Field(None, max_length=50)
    
    class Config:
        use_enum_values = True


class MenuResponse(MenuBase):
    """Schema for menu response with permission data"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    children: List['MenuResponse'] = Field(default_factory=list, description="Child menus")
    
    # Permission fields (populated when user-specific)
    can_view: bool = Field(True, description="User can view this menu")
    can_access: bool = Field(True, description="User can access this menu")
    can_show_mb_bottom: bool = Field(False, description="Show on mobile bottom navigation")
    
    # UI helpers
    level: int = Field(0, description="Hierarchy level (0 = root)")
    has_children: bool = Field(False, description="Has child menus")
    
    class Config:
        from_attributes = True
    
    @model_validator(mode='after')
    def set_has_children(self) -> 'MenuResponse':
        """Auto-set has_children based on children list"""
        self.has_children = len(self.children) > 0
        return self


class MenuFlatResponse(MenuBase):
    """Flat menu response without children (for dropdowns)"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    # Permission fields
    can_view: bool = Field(True)
    can_access: bool = Field(True)
    can_show_mb_bottom: bool = Field(False, description="Can show on mobile bottom navigation")
    
    full_path: Optional[str] = Field(None, description="Full hierarchical path")
    level: int = Field(0, description="Hierarchy level")
    
    class Config:
        from_attributes = True


class MenuTreeResponse(MenuResponse):
    """Alias for MenuResponse for hierarchical responses"""
    pass


class MenuWithPermissionsResponse(MenuResponse):
    """Menu response with explicit permission details"""
    permissions: Dict[str, Any] = Field(default_factory=dict, description="Role-specific permissions")
    
    class Config:
        from_attributes = True


class MenuBreadcrumbResponse(BaseModel):
    """Breadcrumb navigation item"""
    id: UUID
    title: str
    path: Optional[str] = None
    icon: Optional[str] = None
    can_show_mb_bottom: bool = Field(False)
    
    class Config:
        from_attributes = True


# ==================== Role Menu Permission Schemas ====================

class RoleMenuPermissionBase(BaseModel):
    """Base schema for role-menu permissions"""
    role_id: UUID = Field(..., description="Role ID")
    menu_id: UUID = Field(..., description="Menu ID")
    can_view: bool = Field(True, description="Can view the menu")
    can_access: bool = Field(True, description="Can access the menu")
    can_show_mb_bottom: bool = Field(False, description="Show on mobile bottom navigation")


class RoleMenuPermissionCreate(RoleMenuPermissionBase):
    """Schema for creating a role-menu permission"""
    can_show_mb_bottom: Optional[bool] = Field(None, description="Auto-determine if None")
    
    @model_validator(mode='after')
    def validate_permissions(self) -> 'RoleMenuPermissionCreate':
        """Ensure if can_access is True, can_view must also be True"""
        if self.can_access and not self.can_view:
            self.can_view = True
        return self


class RoleMenuPermissionUpdate(BaseModel):
    """Schema for updating a role-menu permission"""
    can_view: Optional[bool] = Field(None, description="Can view the menu")
    can_access: Optional[bool] = Field(None, description="Can access the menu")
    can_show_mb_bottom: Optional[bool] = Field(None, description="Show on mobile bottom navigation")
    
    @model_validator(mode='after')
    def validate_update(self) -> 'RoleMenuPermissionUpdate':
        """Validate permission updates"""
        if self.can_access is False and self.can_view is True:
            raise ValueError("Cannot have can_view=True when can_access=False")
        return self


# app/schemas/menu.py - Replace RoleMenuPermissionResponse with this

class RoleMenuPermissionResponse(RoleMenuPermissionBase):
    """Schema for role-menu permission response"""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    menu: Optional[MenuFlatResponse] = Field(None, description="Associated menu details")
    
    class Config:
        from_attributes = True
        # This allows Pydantic to handle SQLAlchemy objects
        arbitrary_types_allowed = True


class BatchRoleMenuPermissionUpdate(BaseModel):
    """Schema for batch assigning menus to a role"""
    role_id: UUID = Field(..., description="Role ID")
    menu_ids: List[UUID] = Field(..., description="List of menu IDs to assign")
    can_show_mb_bottom: Optional[bool] = Field(None, description="Default value (None = auto-determine)")
    replace_existing: bool = Field(True, description="Replace existing permissions")
    
    @field_validator('menu_ids')
    @classmethod
    def validate_menu_ids(cls, v: List[UUID]) -> List[UUID]:
        """Ensure menu_ids are unique"""
        if len(v) != len(set(v)):
            raise ValueError("Duplicate menu IDs found")
        return v


class SyncRolePermissionsRequest(BaseModel):
    """Schema for syncing role permissions"""
    menu_ids: List[UUID] = Field(..., description="List of menu IDs to sync")
    can_show_mb_bottom: Optional[bool] = Field(None, description="Value for can_show_mb_bottom (None = auto)")
    force_update: bool = Field(False, description="Force update even if unchanged")


class RolePermissionsSummary(BaseModel):
    """Summary of role permissions"""
    role_id: UUID
    role_code: str
    role_name: str
    total_menus: int
    menus_can_view: int
    menus_can_access: int
    menus_on_mobile_bottom: int
    menus_by_category: Dict[str, int] = Field(default_factory=dict)
    mobile_bottom_percentage: float = Field(0.0, description="Percentage of menus on mobile bottom")
    
    @model_validator(mode='after')
    def calculate_percentage(self) -> 'RolePermissionsSummary':
        """Calculate mobile bottom percentage"""
        if self.total_menus > 0:
            self.mobile_bottom_percentage = round(
                (self.menus_on_mobile_bottom / self.total_menus) * 100, 2
            )
        return self


# ==================== Menu Analytics Schemas ====================

class MenuAnalytics(BaseModel):
    """Menu usage analytics"""
    total_menus: int
    active_menus: int
    inactive_menus: int
    root_menus: int
    max_depth: int
    menus_with_children: int
    orphaned_menus: int
    menus_with_mobile_bottom: int = Field(0, description="Menus with mobile bottom enabled")
    
    @property
    def active_percentage(self) -> float:
        """Percentage of active menus"""
        if self.total_menus == 0:
            return 0.0
        return round((self.active_menus / self.total_menus) * 100, 2)


class MenuReorderRequest(BaseModel):
    """Schema for reordering menus"""
    menu_ids: List[UUID] = Field(..., description="Menu IDs in desired order")
    parent_id: Optional[UUID] = Field(None, description="Parent menu ID for grouping")
    
    @field_validator('menu_ids')
    @classmethod
    def validate_menu_ids(cls, v: List[UUID]) -> List[UUID]:
        """Ensure menu_ids are not empty"""
        if not v:
            raise ValueError("menu_ids cannot be empty")
        return v


class MenuSearchParams(BaseModel):
    """Schema for menu search parameters"""
    query: Optional[str] = Field(None, description="Search query (searches code, title)")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    parent_id: Optional[UUID] = Field(None, description="Filter by parent")
    has_children: Optional[bool] = Field(None, description="Filter menus with/without children")
    show_on_mobile_bottom: Optional[bool] = Field(None, description="Filter by mobile bottom visibility")
    limit: int = Field(20, ge=1, le=100, description="Results limit")
    offset: int = Field(0, ge=0, description="Results offset")


# ==================== Export/Import Schemas ====================

class MenuExportData(BaseModel):
    """Schema for menu export data"""
    version: str = Field("1.0", description="Export format version")
    exported_at: datetime = Field(default_factory=datetime.utcnow)
    exported_by: Optional[str] = Field(None, description="User who exported")
    menus: List[MenuResponse]
    total_count: int
    role_permissions: Optional[List[RoleMenuPermissionResponse]] = None
    
    @model_validator(mode='after')
    def validate_export(self) -> 'MenuExportData':
        """Ensure total_count matches menus length"""
        self.total_count = len(self.menus)
        return self


class MenuImportResult(BaseModel):
    """Schema for menu import result"""
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)
    success: bool = Field(False)
    
    @model_validator(mode='after')
    def set_success(self) -> 'MenuImportResult':
        """Set success flag if no errors"""
        self.success = len(self.errors) == 0
        return self


# ==================== Mobile Navigation Schemas ====================

class MobileBottomNavItem(BaseModel):
    """Schema for mobile bottom navigation item"""
    id: UUID
    code: str
    title: str
    icon: Optional[str] = None
    path: Optional[str] = None
    badge: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    
    class Config:
        from_attributes = True


class MobileBottomNavResponse(BaseModel):
    """Schema for mobile bottom navigation response"""
    items: List[MobileBottomNavItem] = Field(default_factory=list)
    active_menu_id: Optional[UUID] = None
    active_path: Optional[str] = None
    total_items: int = Field(0)
    
    @model_validator(mode='after')
    def set_total_items(self) -> 'MobileBottomNavResponse':
        """Auto-set total_items"""
        self.total_items = len(self.items)
        return self


class MobileBottomNavConfig(BaseModel):
    """Schema for mobile bottom navigation configuration"""
    role_code: str
    menu_codes: List[str]
    max_items: int = Field(5, description="Maximum recommended items")
    is_valid: bool = Field(False, description="Whether config meets recommendations")
    
    @model_validator(mode='after')
    def validate_config(self) -> 'MobileBottomNavConfig':
        """Validate mobile bottom nav config"""
        self.is_valid = len(self.menu_codes) <= self.max_items
        return self


# ==================== Helper Functions ====================

def build_menu_breadcrumbs(
    menu: MenuResponse, 
    ancestors: Optional[List[MenuResponse]] = None
) -> List[MenuBreadcrumbResponse]:
    """Helper function to build breadcrumb trail for a menu"""
    if ancestors is None:
        ancestors = []
    
    breadcrumbs = []
    current = menu
    
    # Build path from root to current
    while current:
        breadcrumbs.insert(0, MenuBreadcrumbResponse(
            id=current.id,
            title=current.title,
            path=current.path,
            icon=current.icon,
            can_show_mb_bottom=current.can_show_mb_bottom
        ))
        # This assumes you have a way to get parent
        # You might need to pass parent reference separately
        break  # Remove this break when you have parent reference
    
    return breadcrumbs


def get_menu_path(menu: MenuResponse, ancestors: List[MenuResponse]) -> str:
    """Get full path for a menu"""
    path_parts = [a.title for a in ancestors] + [menu.title]
    return " / ".join(path_parts)


def filter_mobile_bottom_menus(
    menus: List[MenuResponse], 
    max_items: int = 5
) -> List[MenuResponse]:
    """Filter and limit menus for mobile bottom navigation"""
    mobile_menus = [m for m in menus if m.can_show_mb_bottom]
    return sorted(mobile_menus, key=lambda x: x.sort_order)[:max_items]


# Update forward references
MenuResponse.model_rebuild()
MenuTreeResponse.model_rebuild()
MenuFlatResponse.model_rebuild()
MenuWithPermissionsResponse.model_rebuild()