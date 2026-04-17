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


class IconType(str, Enum):
    """Type of icon library to use"""
    MUI = "mui"
    FONTAWESOME = "fontawesome"
    MATERIAL_SYMBOLS = "material_symbols"
    CUSTOM = "custom"
    IMAGE = "image"


class IconLibrary(str, Enum):
    """Icon library identifiers"""
    MUI = "mui"
    FAS = "fas"  # Font Awesome Solid
    FAR = "far"  # Font Awesome Regular
    FAL = "fal"  # Font Awesome Light
    FAT = "fat"  # Font Awesome Thin
    FAB = "fab"  # Font Awesome Brands
    MATERIAL_SYMBOLS = "material-symbols"
    MATERIAL_SYMBOLS_OUTLINED = "material-symbols-outlined"
    MATERIAL_SYMBOLS_ROUNDED = "material-symbols-rounded"
    MATERIAL_SYMBOLS_SHARP = "material-symbols-sharp"


class IconSize(str, Enum):
    """Icon size options"""
    EXTRA_SMALL = "xs"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    EXTRA_LARGE = "xl"


class IconAnimation(str, Enum):
    """Icon animation effects"""
    NONE = "none"
    SPIN = "spin"
    PULSE = "pulse"
    BOUNCE = "bounce"
    SHAKE = "shake"
    BEAT = "beat"
    FLIP = "flip"
    WIGGLE = "wiggle"


class BadgeType(str, Enum):
    """Type of badge to display"""
    COUNT = "count"
    TEXT = "text"
    DOT = "dot"
    STATUS = "status"


class BadgeColor(str, Enum):
    """Badge color options"""
    DEFAULT = "default"
    PRIMARY = "primary"
    SECONDARY = "secondary"
    ERROR = "error"
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"


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
    SEARCH = "Search"
    FILTER = "Filter"
    SORT = "Sort"
    EXPORT = "Export"
    IMPORT = "Import"
    PRINT = "Print"
    SHARE = "Share"
    BOOKMARK = "Bookmark"
    FAVORITE = "Favorite"
    HELP = "Help"
    INFO = "Info"
    SUPPORT = "Support"
    FEEDBACK = "Feedback"


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

# Predefined color palette for icons
ICON_COLORS = {
    "primary": "#1976d2",
    "secondary": "#dc004e",
    "success": "#4caf50",
    "warning": "#ff9800",
    "error": "#f44336",
    "info": "#2196f3",
    "purple": "#9c27b0",
    "indigo": "#3f51b5",
    "teal": "#009688",
    "orange": "#ff5722",
    "pink": "#e91e63",
    "cyan": "#00bcd4",
    "brown": "#795548",
    "gray": "#757575",
    "black": "#000000",
    "white": "#ffffff"
}

# Font Awesome icon mapping to MUI icons
FA_TO_MUI_MAP = {
    "fa-tachometer-alt": "Dashboard",
    "fa-tasks": "Assignment",
    "fa-exclamation-triangle": "Warning",
    "fa-check-circle": "CheckCircle",
    "fa-calendar-alt": "Event",
    "fa-users": "People",
    "fa-chart-bar": "Assessment",
    "fa-cog": "Settings",
    "fa-shield-alt": "Security",
    "fa-bell": "Notifications",
    "fa-search": "Search",
    "fa-plus-circle": "Add",
    "fa-edit": "Edit",
    "fa-trash-alt": "Delete",
    "fa-folder": "Folder",
    "fa-download": "Download",
    "fa-upload": "Upload",
    "fa-print": "Print",
    "fa-share": "Share",
    "fa-star": "Star",
    "fa-heart": "Favorite",
    "fa-question-circle": "Help",
    "fa-info-circle": "Info",
    "fa-life-ring": "Support",
    "fa-comment": "Feedback"
}


# ==================== Icon Schemas ====================

class IconConfig(BaseModel):
    """Icon configuration for a menu"""
    name: str = Field(..., description="Icon name")
    type: IconType = Field(IconType.MUI, description="Icon library type")
    library: IconLibrary = Field(IconLibrary.MUI, description="Icon library")
    color: str = Field("inherit", description="Icon color (hex or theme color)")
    size: IconSize = Field(IconSize.MEDIUM, description="Icon size")
    animation: IconAnimation = Field(IconAnimation.NONE, description="Icon animation")
    rotate: Optional[int] = Field(None, ge=0, le=360, description="Rotation in degrees")
    flip: Optional[str] = Field(None, description="Flip direction (horizontal/vertical)")
    
    @field_validator('color')
    @classmethod
    def validate_color(cls, v: str) -> str:
        """Validate color format"""
        # Check if it's a theme color
        if v in ICON_COLORS or v == "inherit":
            return v
        # Check if it's a valid hex color
        if re.match(r'^#[0-9a-fA-F]{3,6}$', v):
            return v
        # Check if it's rgb/rgba
        if re.match(r'^rgba?\(', v):
            return v
        raise ValueError(f"Invalid color format: {v}")
    
    @model_validator(mode='after')
    def validate_icon_combination(self) -> 'IconConfig':
        """Validate icon type and library combination"""
        if self.type == IconType.FONTAWESOME and self.library == IconLibrary.MUI:
            self.library = IconLibrary.FAS
        if self.type == IconType.MATERIAL_SYMBOLS and self.library not in [
            IconLibrary.MATERIAL_SYMBOLS,
            IconLibrary.MATERIAL_SYMBOLS_OUTLINED,
            IconLibrary.MATERIAL_SYMBOLS_ROUNDED,
            IconLibrary.MATERIAL_SYMBOLS_SHARP
        ]:
            self.library = IconLibrary.MATERIAL_SYMBOLS
        return self
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Dashboard",
                "type": "mui",
                "library": "mui",
                "color": "#1976d2",
                "size": "medium",
                "animation": "none"
            }
        }


class BadgeConfig(BaseModel):
    """Badge configuration for a menu"""
    text: Optional[str] = Field(None, description="Badge text (for TEXT type)")
    count: Optional[int] = Field(None, ge=0, description="Badge count (for COUNT type)")
    type: BadgeType = Field(BadgeType.TEXT, description="Badge type")
    color: BadgeColor = Field(BadgeColor.ERROR, description="Badge color")
    max_count: int = Field(99, ge=1, le=999, description="Maximum count before showing 99+")
    show_zero: bool = Field(False, description="Show badge when count is 0")
    animated: bool = Field(False, description="Animate badge")
    
    @property
    def display_text(self) -> Optional[str]:
        """Get display text for badge"""
        if self.type == BadgeType.COUNT and self.count is not None:
            if self.count > self.max_count:
                return f"{self.max_count}+"
            if self.count == 0 and not self.show_zero:
                return None
            return str(self.count)
        if self.type == BadgeType.DOT:
            return None
        if self.type == BadgeType.STATUS:
            return None
        return self.text
    
    @property
    def show_badge(self) -> bool:
        """Determine if badge should be shown"""
        if self.type == BadgeType.COUNT:
            if self.count is None:
                return False
            if self.count == 0 and not self.show_zero:
                return False
            return True
        if self.type == BadgeType.DOT:
            return True
        if self.type == BadgeType.STATUS:
            return True
        return bool(self.text)
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "New",
                "type": "text",
                "color": "error"
            }
        }


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
    
    # Icon fields - extended
    icon: Optional[str] = Field(
        None, 
        max_length=50, 
        description="Icon name",
        examples=["Dashboard", "Person", "Settings", "fa-tachometer-alt"]
    )
    icon_type: IconType = Field(
        IconType.MUI, 
        description="Type of icon library"
    )
    icon_library: IconLibrary = Field(
        IconLibrary.MUI, 
        description="Icon library identifier"
    )
    icon_color: str = Field(
        "inherit", 
        description="Icon color (hex, theme color, or inherit)"
    )
    icon_size: IconSize = Field(
        IconSize.MEDIUM, 
        description="Icon size"
    )
    icon_animation: IconAnimation = Field(
        IconAnimation.NONE, 
        description="Icon animation effect"
    )
    icon_rotation: Optional[int] = Field(
        None, 
        ge=0, 
        le=360, 
        description="Icon rotation in degrees"
    )
    
    # Badge fields
    badge: Optional[str] = Field(
        None, 
        max_length=50, 
        description="Badge text (legacy, use badge_config instead)"
    )
    badge_config: Optional[BadgeConfig] = Field(
        None, 
        description="Badge configuration"
    )
    
    # Menu fields
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
    
    # Additional metadata
    description: Optional[str] = Field(
        None, 
        max_length=500, 
        description="Menu description"
    )
    keywords: Optional[List[str]] = Field(
        None, 
        description="Search keywords"
    )
    is_external: bool = Field(
        False, 
        description="Whether this is an external link"
    )
    external_url: Optional[str] = Field(
        None, 
        max_length=500, 
        description="External URL if is_external is true"
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
            # Ensure path doesn't start with http:// or https:// if not external
            if v.startswith(('http://', 'https://')):
                raise ValueError("Path should be relative, not absolute URL. Use external_url for external links.")
            # Ensure path doesn't have trailing slash
            v = v.rstrip('/')
            # Ensure path starts with /
            if not v.startswith('/'):
                v = '/' + v
        return v
    
    @field_validator('external_url')
    @classmethod
    def validate_external_url(cls, v: Optional[str]) -> Optional[str]:
        """Validate external URL format"""
        if v is not None:
            if not v.startswith(('http://', 'https://')):
                raise ValueError("External URL must start with http:// or https://")
        return v
    
    @field_validator('icon')
    @classmethod
    def validate_icon(cls, v: Optional[str]) -> Optional[str]:
        """Validate icon name format"""
        if v is not None:
            # For Font Awesome icons
            if v.startswith('fa-'):
                return v
            # For MUI icons - should start with uppercase
            if not v[0].isupper():
                # Try to convert to proper format or just warn
                v = v[0].upper() + v[1:] if v else v
        return v
    
    @model_validator(mode='after')
    def validate_external_consistency(self) -> 'MenuBase':
        """Validate external link consistency"""
        if self.is_external and not self.external_url:
            raise ValueError("external_url is required when is_external is true")
        if not self.is_external and self.external_url:
            self.is_external = True
        return self
    
    @model_validator(mode='after')
    def validate_badge_consistency(self) -> 'MenuBase':
        """Ensure badge config is consistent with legacy badge"""
        if self.badge and not self.badge_config:
            # Create badge config from legacy badge
            self.badge_config = BadgeConfig(text=self.badge)
        return self
    
    class Config:
        use_enum_values = True
        json_schema_extra = {
            "example": {
                "code": "dashboard",
                "title": "Dashboard",
                "icon": "Dashboard",
                "icon_type": "mui",
                "icon_library": "mui",
                "icon_color": "#1976d2",
                "icon_size": "medium",
                "icon_animation": "none",
                "path": "/dashboard",
                "sort_order": 1,
                "is_active": True,
                "requires_auth": True,
                "badge_config": {
                    "type": "count",
                    "color": "error"
                }
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
    icon_type: Optional[IconType] = None
    icon_library: Optional[IconLibrary] = None
    icon_color: Optional[str] = Field(None, max_length=20)
    icon_size: Optional[IconSize] = None
    icon_animation: Optional[IconAnimation] = None
    icon_rotation: Optional[int] = Field(None, ge=0, le=360)
    badge: Optional[str] = Field(None, max_length=50)
    badge_config: Optional[BadgeConfig] = None
    path: Optional[str] = Field(None, max_length=255)
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = Field(None, ge=0, le=9999)
    is_active: Optional[bool] = None
    requires_auth: Optional[bool] = None
    target: Optional[MenuTarget] = None
    description: Optional[str] = Field(None, max_length=500)
    keywords: Optional[List[str]] = None
    is_external: Optional[bool] = None
    external_url: Optional[str] = Field(None, max_length=500)
    
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
    
    @model_validator(mode='after')
    def validate_external_consistency(self) -> 'MenuUpdate':
        """Validate external link consistency"""
        if self.is_external is True and not self.external_url:
            raise ValueError("external_url is required when is_external is true")
        return self
    
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
    
    # Computed properties
    icon_config: Optional[IconConfig] = Field(None, description="Computed icon configuration")
    badge_display: Optional[str] = Field(None, description="Computed badge display text")
    show_badge: bool = Field(False, description="Whether to show badge")
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "code": "dashboard",
                "title": "Dashboard",
                "icon": "Dashboard",
                "icon_type": "mui",
                "icon_library": "mui",
                "icon_color": "#1976d2",
                "icon_size": "medium",
                "icon_animation": "none",
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
                "has_children": False,
                "show_badge": False
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
    
    @model_validator(mode='after')
    def compute_icon_config(self) -> 'MenuResponse':
        """Compute icon configuration"""
        self.icon_config = IconConfig(
            name=self.icon or "Circle",
            type=self.icon_type,
            library=self.icon_library,
            color=self.icon_color,
            size=self.icon_size,
            animation=self.icon_animation,
            rotate=self.icon_rotation if hasattr(self, 'icon_rotation') else None
        )
        return self
    
    @model_validator(mode='after')
    def compute_badge(self) -> 'MenuResponse':
        """Compute badge display"""
        if self.badge_config and self.badge_config.show_badge:
            self.badge_display = self.badge_config.display_text
            self.show_badge = True
        elif self.badge:
            self.badge_display = self.badge
            self.show_badge = True
        else:
            self.show_badge = False
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
    show_badge: bool = Field(False)
    badge_display: Optional[str] = Field(None)
    
    class Config:
        from_attributes = True
    
    @model_validator(mode='after')
    def build_full_path(self) -> 'MenuFlatResponse':
        """Build full path from title (can be enhanced with parent data)"""
        if not self.full_path:
            self.full_path = self.title
        return self
    
    @model_validator(mode='after')
    def compute_badge(self) -> 'MenuFlatResponse':
        """Compute badge display"""
        if self.badge_config and self.badge_config.show_badge:
            self.badge_display = self.badge_config.display_text
            self.show_badge = True
        elif self.badge:
            self.badge_display = self.badge
            self.show_badge = True
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


# ==================== Icon Helper Functions ====================

def get_icon_config(
    icon_name: Optional[str], 
    icon_type: IconType = IconType.MUI,
    icon_library: IconLibrary = IconLibrary.MUI,
    icon_color: str = "inherit",
    icon_size: IconSize = IconSize.MEDIUM
) -> IconConfig:
    """Helper to create icon configuration"""
    return IconConfig(
        name=icon_name or "Circle",
        type=icon_type,
        library=icon_library,
        color=icon_color,
        size=icon_size,
        animation=IconAnimation.NONE
    )


def convert_fa_to_mui(fa_icon: str) -> Optional[str]:
    """Convert Font Awesome icon name to MUI icon name"""
    return FA_TO_MUI_MAP.get(fa_icon)


def get_icon_color_by_menu_code(menu_code: str) -> str:
    """Get default icon color based on menu code"""
    color_map = {
        "dashboard": "#1976d2",
        "meetings": "#4caf50",
        "actions": "#ff9800",
        "participants": "#9c27b0",
        "documents": "#2196f3",
        "reports": "#f44336",
        "calendar": "#00bcd4",
        "settings": "#757575",
        "profile": "#795548",
        "security": "#dc004e",
        "notifications": "#ff9800",
        "users": "#3f51b5",
        "roles": "#9c27b0",
        "audit": "#607d8b"
    }
    return color_map.get(menu_code, "inherit")


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
    """Schema for role-menu permission response"""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class RoleMenuPermissionWithMenuResponse(RoleMenuPermissionResponse):
    """Schema for role-menu permission response WITH menu details"""
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
    version: str = Field("2.0", description="Export format version")
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
    icon_type: IconType = IconType.MUI
    icon_library: IconLibrary = IconLibrary.MUI
    icon_color: str = "inherit"
    path: Optional[str] = None
    badge: Optional[str] = None
    badge_config: Optional[BadgeConfig] = None
    sort_order: int = Field(0, ge=0)
    is_active: bool = True
    show_badge: bool = False
    badge_display: Optional[str] = None
    
    class Config:
        from_attributes = True
    
    @model_validator(mode='after')
    def compute_badge(self) -> 'MobileBottomNavItem':
        """Compute badge display"""
        if self.badge_config and self.badge_config.show_badge:
            self.badge_display = self.badge_config.display_text
            self.show_badge = True
        elif self.badge:
            self.badge_display = self.badge
            self.show_badge = True
        return self


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