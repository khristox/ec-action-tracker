# app/schemas/menu.py
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any, ForwardRef, Set
from uuid import UUID
from datetime import datetime
from enum import Enum
import re


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
    LIST = "List"
    GROUP = "Group"
    PERSON_ADD = "PersonAdd"
    UPLOAD = "Upload"
    CALENDAR = "Calendar"
    ASSIGNMENT = "Assignment"
    TASK = "Task"
    WARNING = "Warning"
    TRENDING_UP = "TrendingUp"
    ARTICLE = "Article"
    DOWNLOAD = "Download"


# ==================== Constants ====================

# Reserved menu codes that cannot be used
RESERVED_MENU_CODES: Set[str] = {
    "root", "null", "undefined", "none", "all", "api", "admin"
}

# Maximum depth for menu hierarchy
MAX_MENU_DEPTH = 10

# Maximum number of mobile bottom navigation items
MAX_MOBILE_BOTTOM_ITEMS = 5

# Pattern for menu code validation
MENU_CODE_PATTERN = re.compile(r'^[a-z_][a-z0-9_]*$')


# ==================== Menu Schemas ====================

class MenuBase(BaseModel):
    """Base schema for Menu with common fields"""
    code: str = Field(
        ..., 
        min_length=2, 
        max_length=50,
        pattern=r'^[a-z_][a-z0-9_]*$',
        description="Unique menu code (lowercase with underscores)",
        examples=["dashboard", "user_profile", "system_settings"]
    )
    title: str = Field(
        ..., 
        min_length=1, 
        max_length=100, 
        description="Display title",
        examples=["Dashboard", "User Profile", "System Settings"]
    )
    icon: Optional[str] = Field(
        None, 
        max_length=50, 
        description="Material-UI icon name",
        examples=["Dashboard", "Person", "Settings"]
    )
    path: Optional[str] = Field(
        None, 
        max_length=255, 
        description="Route path",
        examples=["/dashboard", "/users/profile", "/settings"]
    )
    parent_id: Optional[UUID] = Field(
        None, 
        description="Parent menu ID for hierarchy"
    )
    sort_order: int = Field(
        0, 
        ge=0, 
        le=9999, 
        description="Display order (0-9999)"
    )
    is_active: bool = Field(
        True, 
        description="Whether menu is active"
    )
    requires_auth: bool = Field(
        True, 
        description="Whether authentication is required"
    )
    target: MenuTarget = Field(
        MenuTarget.SELF, 
        description="Link target"
    )
    badge: Optional[str] = Field(
        None, 
        max_length=50, 
        description="Badge text/notification count"
    )
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate menu code format and reserved words"""
        if not MENU_CODE_PATTERN.match(v):
            raise ValueError(
                f"Code '{v}' must be lowercase with underscores only (a-z, 0-9, _)"
            )
        if v in RESERVED_MENU_CODES:
            raise ValueError(f"Code '{v}' is a reserved word")
        return v
    
    @field_validator('path')
    @classmethod
    def validate_path(cls, v: Optional[str]) -> Optional[str]:
        """Validate path format"""
        if v is not None:
            # Ensure path doesn't start with http:// or https://
            if v.startswith(('http://', 'https://')):
                raise ValueError("Path should be relative, not absolute URL")
            # Ensure path doesn't have trailing slash
            v = v.rstrip('/')
        return v
    
    @field_validator('icon')
    @classmethod
    def validate_icon(cls, v: Optional[str]) -> Optional[str]:
        """Validate icon name format"""
        if v is not None and not v[0].isupper():
            raise ValueError("Icon name should start with uppercase letter")
        return v
    
    class Config:
        use_enum_values = True
        json_schema_extra = {
            "example": {
                "code": "dashboard",
                "title": "Dashboard",
                "icon": "Dashboard",
                "path": "/dashboard",
                "sort_order": 1,
                "is_active": True,
                "requires_auth": True
            }
        }


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
    sort_order: Optional[int] = Field(None, ge=0, le=9999)
    is_active: Optional[bool] = None
    requires_auth: Optional[bool] = None
    target: Optional[MenuTarget] = None
    badge: Optional[str] = Field(None, max_length=50)
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v: Optional[str]) -> Optional[str]:
        """Validate menu code format if provided"""
        if v is not None:
            if not MENU_CODE_PATTERN.match(v):
                raise ValueError(
                    f"Code '{v}' must be lowercase with underscores only"
                )
            if v in RESERVED_MENU_CODES:
                raise ValueError(f"Code '{v}' is a reserved word")
        return v
    
    @field_validator('path')
    @classmethod
    def validate_path(cls, v: Optional[str]) -> Optional[str]:
        """Validate path format if provided"""
        if v is not None and v.startswith(('http://', 'https://')):
            raise ValueError("Path should be relative, not absolute URL")
        return v.rstrip('/') if v else v
    
    class Config:
        use_enum_values = True


class MenuResponse(MenuBase):
    """Schema for menu response with permission data"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    children: List['MenuResponse'] = Field(
        default_factory=list, 
        description="Child menus"
    )
    
    # Permission fields (populated when user-specific)
    can_view: bool = Field(True, description="User can view this menu")
    can_access: bool = Field(True, description="User can access this menu")
    can_show_mb_bottom: bool = Field(False, description="Show on mobile bottom navigation")
    
    # UI helpers
    level: int = Field(0, ge=0, le=MAX_MENU_DEPTH, description="Hierarchy level (0 = root)")
    has_children: bool = Field(False, description="Has child menus")
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "code": "dashboard",
                "title": "Dashboard",
                "icon": "Dashboard",
                "path": "/dashboard",
                "parent_id": None,
                "sort_order": 1,
                "is_active": True,
                "requires_auth": True,
                "target": "_self",
                "badge": None,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
                "children": [],
                "can_view": True,
                "can_access": True,
                "can_show_mb_bottom": True,
                "level": 0,
                "has_children": False
            }
        }
    
    @model_validator(mode='after')
    def set_has_children(self) -> 'MenuResponse':
        """Auto-set has_children based on children list"""
        self.has_children = len(self.children) > 0
        return self
    
    @model_validator(mode='after')
    def validate_depth(self) -> 'MenuResponse':
        """Validate menu depth doesn't exceed maximum"""
        if self.level > MAX_MENU_DEPTH:
            raise ValueError(f"Menu depth exceeds maximum of {MAX_MENU_DEPTH}")
        return self


class MenuFlatResponse(MenuBase):
    """Flat menu response without children (for dropdowns)"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    # Permission fields
    can_view: bool = Field(True)
    can_access: bool = Field(True)
    can_show_mb_bottom: bool = Field(False)
    
    full_path: Optional[str] = Field(None, description="Full hierarchical path")
    level: int = Field(0, ge=0, description="Hierarchy level")
    
    class Config:
        from_attributes = True
    
    @model_validator(mode='after')
    def build_full_path(self) -> 'MenuFlatResponse':
        """Build full path from title (can be enhanced with parent data)"""
        if not self.full_path:
            self.full_path = self.title
        return self


class MenuTreeResponse(MenuResponse):
    """Alias for MenuResponse for hierarchical responses"""
    pass


class MenuWithPermissionsResponse(MenuResponse):
    """Menu response with explicit permission details"""
    permissions: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Role-specific permissions"
    )
    
    class Config:
        from_attributes = True


class MenuBreadcrumbResponse(BaseModel):
    """Breadcrumb navigation item"""
    id: UUID
    title: str
    path: Optional[str] = None
    icon: Optional[str] = None
    can_show_mb_bottom: bool = False
    is_current: bool = False
    
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
    can_show_mb_bottom: Optional[bool] = Field(
        None, 
        description="Auto-determine if None"
    )
    
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


class RoleMenuPermissionResponse(RoleMenuPermissionBase):
    """Schema for role-menu permission response - WITHOUT relationship to avoid greenlet errors"""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Don't include menu relationship here to avoid greenlet issues
    # Use separate endpoint to fetch menu details
    
    class Config:
        from_attributes = True


class RoleMenuPermissionWithMenuResponse(RoleMenuPermissionResponse):
    """Schema for role-menu permission response WITH menu details (use with eager loading)"""
    menu: Optional[MenuFlatResponse] = Field(None, description="Associated menu details")
    
    class Config:
        from_attributes = True


class BatchRoleMenuPermissionUpdate(BaseModel):
    """Schema for batch assigning menus to a role"""
    role_id: UUID = Field(..., description="Role ID")
    menu_ids: List[UUID] = Field(..., description="List of menu IDs to assign")
    can_show_mb_bottom: Optional[bool] = Field(
        None, 
        description="Default value (None = auto-determine)"
    )
    replace_existing: bool = Field(True, description="Replace existing permissions")
    
    @field_validator('menu_ids')
    @classmethod
    def validate_menu_ids(cls, v: List[UUID]) -> List[UUID]:
        """Ensure menu_ids are unique and not empty"""
        if not v:
            raise ValueError("menu_ids cannot be empty")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate menu IDs found")
        return v


class SyncRolePermissionsRequest(BaseModel):
    """Schema for syncing role permissions"""
    role_id: UUID = Field(..., description="Role ID to sync")
    menu_ids: List[UUID] = Field(..., description="List of menu IDs to sync")
    can_show_mb_bottom: Optional[bool] = Field(
        None, 
        description="Value for can_show_mb_bottom (None = auto)"
    )
    force_update: bool = Field(False, description="Force update even if unchanged")
    
    @field_validator('menu_ids')
    @classmethod
    def validate_menu_ids(cls, v: List[UUID]) -> List[UUID]:
        """Ensure menu_ids are unique"""
        if not v:
            raise ValueError("menu_ids cannot be empty")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate menu IDs found")
        return v


class RolePermissionsSummary(BaseModel):
    """Summary of role permissions"""
    role_id: UUID
    role_code: str
    role_name: str
    total_menus: int = Field(0, ge=0)
    menus_can_view: int = Field(0, ge=0)
    menus_can_access: int = Field(0, ge=0)
    menus_on_mobile_bottom: int = Field(0, ge=0)
    menus_by_category: Dict[str, int] = Field(default_factory=dict)
    mobile_bottom_percentage: float = Field(0.0, ge=0.0, le=100.0)
    
    @model_validator(mode='after')
    def calculate_percentage(self) -> 'RolePermissionsSummary':
        """Calculate mobile bottom percentage"""
        if self.total_menus > 0:
            self.mobile_bottom_percentage = round(
                (self.menus_on_mobile_bottom / self.total_menus) * 100, 2
            )
        return self
    
    @model_validator(mode='after')
    def validate_counts(self) -> 'RolePermissionsSummary':
        """Validate that counts don't exceed total"""
        if self.menus_can_view > self.total_menus:
            self.menus_can_view = self.total_menus
        if self.menus_can_access > self.total_menus:
            self.menus_can_access = self.total_menus
        if self.menus_on_mobile_bottom > self.total_menus:
            self.menus_on_mobile_bottom = self.total_menus
        return self


# ==================== Menu Analytics Schemas ====================

class MenuAnalytics(BaseModel):
    """Menu usage analytics"""
    total_menus: int = Field(0, ge=0)
    active_menus: int = Field(0, ge=0)
    inactive_menus: int = Field(0, ge=0)
    root_menus: int = Field(0, ge=0)
    max_depth: int = Field(0, ge=0)
    menus_with_children: int = Field(0, ge=0)
    orphaned_menus: int = Field(0, ge=0)
    menus_with_mobile_bottom: int = Field(0, ge=0)
    avg_children_per_menu: float = Field(0.0, ge=0.0)
    
    @property
    def active_percentage(self) -> float:
        """Percentage of active menus"""
        if self.total_menus == 0:
            return 0.0
        return round((self.active_menus / self.total_menus) * 100, 2)
    
    @property
    def mobile_bottom_percentage(self) -> float:
        """Percentage of menus on mobile bottom"""
        if self.total_menus == 0:
            return 0.0
        return round((self.menus_with_mobile_bottom / self.total_menus) * 100, 2)
    
    @model_validator(mode='after')
    def validate_consistency(self) -> 'MenuAnalytics':
        """Validate analytics consistency"""
        if self.active_menus + self.inactive_menus != self.total_menus:
            self.inactive_menus = self.total_menus - self.active_menus
        return self


class MenuReorderRequest(BaseModel):
    """Schema for reordering menus"""
    menu_ids: List[UUID] = Field(..., description="Menu IDs in desired order")
    parent_id: Optional[UUID] = Field(None, description="Parent menu ID for grouping")
    
    @field_validator('menu_ids')
    @classmethod
    def validate_menu_ids(cls, v: List[UUID]) -> List[UUID]:
        """Ensure menu_ids are not empty and unique"""
        if not v:
            raise ValueError("menu_ids cannot be empty")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate menu IDs found")
        return v


class MenuSearchParams(BaseModel):
    """Schema for menu search parameters"""
    query: Optional[str] = Field(
        None, 
        min_length=1, 
        max_length=100,
        description="Search query (searches code, title)"
    )
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    parent_id: Optional[UUID] = Field(None, description="Filter by parent")
    has_children: Optional[bool] = Field(None, description="Filter menus with/without children")
    show_on_mobile_bottom: Optional[bool] = Field(None, description="Filter by mobile bottom visibility")
    limit: int = Field(20, ge=1, le=100, description="Results limit")
    offset: int = Field(0, ge=0, description="Results offset")
    
    @model_validator(mode='after')
    def validate_search(self) -> 'MenuSearchParams':
        """Validate search parameters"""
        if self.limit < 1:
            self.limit = 20
        if self.offset < 0:
            self.offset = 0
        return self


# ==================== Export/Import Schemas ====================

class MenuExportData(BaseModel):
    """Schema for menu export data"""
    version: str = Field("1.0", description="Export format version")
    exported_at: datetime = Field(default_factory=datetime.utcnow)
    exported_by: Optional[str] = Field(None, description="User who exported")
    menus: List[MenuResponse]
    total_count: int = Field(0, ge=0)
    role_permissions: Optional[List[RoleMenuPermissionResponse]] = None
    
    @model_validator(mode='after')
    def validate_export(self) -> 'MenuExportData':
        """Ensure total_count matches menus length"""
        self.total_count = len(self.menus)
        return self


class MenuImportResult(BaseModel):
    """Schema for menu import result"""
    created: int = Field(0, ge=0)
    updated: int = Field(0, ge=0)
    skipped: int = Field(0, ge=0)
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)
    success: bool = False
    
    @model_validator(mode='after')
    def set_success(self) -> 'MenuImportResult':
        """Set success flag if no errors"""
        self.success = len(self.errors) == 0
        return self
    
    @property
    def total_processed(self) -> int:
        """Total number of items processed"""
        return self.created + self.updated + self.skipped


# ==================== Mobile Navigation Schemas ====================

class MobileBottomNavItem(BaseModel):
    """Schema for mobile bottom navigation item"""
    id: UUID
    code: str
    title: str
    icon: Optional[str] = None
    path: Optional[str] = None
    badge: Optional[str] = None
    sort_order: int = Field(0, ge=0)
    is_active: bool = True
    
    class Config:
        from_attributes = True


class MobileBottomNavResponse(BaseModel):
    """Schema for mobile bottom navigation response"""
    items: List[MobileBottomNavItem] = Field(default_factory=list)
    active_menu_id: Optional[UUID] = None
    active_path: Optional[str] = None
    total_items: int = Field(0, ge=0)
    
    @model_validator(mode='after')
    def set_total_items(self) -> 'MobileBottomNavResponse':
        """Auto-set total_items"""
        self.total_items = len(self.items)
        return self
    
    def get_active_index(self) -> Optional[int]:
        """Get index of active menu item"""
        for i, item in enumerate(self.items):
            if item.id == self.active_menu_id:
                return i
        return None


class MobileBottomNavConfig(BaseModel):
    """Schema for mobile bottom navigation configuration"""
    role_code: str
    menu_codes: List[str]
    max_items: int = Field(MAX_MOBILE_BOTTOM_ITEMS, description="Maximum recommended items")
    is_valid: bool = Field(False, description="Whether config meets recommendations")
    warning_message: Optional[str] = None
    
    @model_validator(mode='after')
    def validate_config(self) -> 'MobileBottomNavConfig':
        """Validate mobile bottom nav config"""
        if len(self.menu_codes) > self.max_items:
            self.is_valid = False
            self.warning_message = f"Mobile bottom nav has {len(self.menu_codes)} items (max recommended: {self.max_items})"
        else:
            self.is_valid = True
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
    
    # Add ancestors
    for ancestor in ancestors:
        breadcrumbs.append(MenuBreadcrumbResponse(
            id=ancestor.id,
            title=ancestor.title,
            path=ancestor.path,
            icon=ancestor.icon,
            can_show_mb_bottom=ancestor.can_show_mb_bottom,
            is_current=False
        ))
    
    # Add current menu
    breadcrumbs.append(MenuBreadcrumbResponse(
        id=menu.id,
        title=menu.title,
        path=menu.path,
        icon=menu.icon,
        can_show_mb_bottom=menu.can_show_mb_bottom,
        is_current=True
    ))
    
    return breadcrumbs


def get_menu_path(menu: MenuResponse, ancestors: List[MenuResponse]) -> str:
    """Get full path for a menu"""
    path_parts = [a.title for a in ancestors] + [menu.title]
    return " / ".join(path_parts)


def filter_mobile_bottom_menus(
    menus: List[MenuResponse], 
    max_items: int = MAX_MOBILE_BOTTOM_ITEMS
) -> List[MenuResponse]:
    """Filter and limit menus for mobile bottom navigation"""
    mobile_menus = [m for m in menus if m.can_show_mb_bottom]
    return sorted(mobile_menus, key=lambda x: x.sort_order)[:max_items]


def validate_menu_code(code: str) -> bool:
    """Validate menu code format"""
    return bool(MENU_CODE_PATTERN.match(code)) and code not in RESERVED_MENU_CODES


def get_menu_level_from_path(path: str) -> int:
    """Get menu level from path (number of slashes)"""
    if not path:
        return 0
    return path.count('/')


# Update forward references
MenuResponse.model_rebuild()
MenuTreeResponse.model_rebuild()
MenuFlatResponse.model_rebuild()
MenuWithPermissionsResponse.model_rebuild()