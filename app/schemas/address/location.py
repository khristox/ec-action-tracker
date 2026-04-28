# app/schemas/address/location.py

"""
Location Schemas for API validation
Supports both Address (Levels 1-7) and Buildings (Levels 11-14) modes
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any, Literal, Union
from uuid import UUID
from datetime import datetime
import re

# ============================================================================
# Constants
# ============================================================================

VALID_LOCATION_MODES = ["address", "buildings", "mixed"]

# Address mode levels (1-7)
ADDRESS_LEVELS = list(range(1, 8))
ADDRESS_LEVEL_NAMES = {
    1: "Country",
    2: "Region",
    3: "District",
    4: "County",
    5: "Subcounty",
    6: "Parish",
    7: "Village"
}

# Buildings mode levels (11-14)
BUILDINGS_LEVELS = [11, 12, 13, 14]
BUILDINGS_LEVEL_NAMES = {
    11: "Office",
    12: "Building",
    13: "Room",
    14: "Conference"
}

# All valid levels combined
VALID_LEVELS = ADDRESS_LEVELS + BUILDINGS_LEVELS

# Address location types
ADDRESS_LOCATION_TYPES = ["country", "region", "district", "county", "subcounty", "parish", "village"]

# Buildings location types
BUILDINGS_LOCATION_TYPES = [
    "office", "building", "room", "conference", 
    "headquarters", "branch", "annex", "office_space", 
    "meeting_room", "training_room", "boardroom", "cafeteria", 
    "lobby", "storage", "workshop", "laboratory", "classroom"
]

# Combined location types
VALID_LOCATION_TYPES = ADDRESS_LOCATION_TYPES + BUILDINGS_LOCATION_TYPES

VALID_STATUSES = ["active", "inactive", "archived"]


# ============================================================================
# Helper Functions
# ============================================================================

def get_level_name(level: int, mode: str = "address") -> str:
    """Get human-readable level name based on mode"""
    if mode == "buildings":
        return BUILDINGS_LEVEL_NAMES.get(level, f"Level {level}")
    return ADDRESS_LEVEL_NAMES.get(level, f"Level {level}")


def get_level_icon(level: int, mode: str = "address") -> str:
    """Get icon for level based on mode"""
    if mode == "buildings":
        icons = {11: "💼", 12: "🏢", 13: "🚪", 14: "📊"}
        return icons.get(level, "📍")
    icons = {1: "🌍", 2: "🏛️", 3: "🏢", 4: "🏘️", 5: "🏠", 6: "⛪", 7: "🏡"}
    return icons.get(level, "📍")


def is_valid_level_for_mode(level: int, mode: str) -> bool:
    """Check if level is valid for the given mode"""
    if mode == "buildings":
        return level in BUILDINGS_LEVELS
    return level in ADDRESS_LEVELS


def get_next_level(level: int, mode: str = "address") -> Optional[int]:
    """Get the next level in hierarchy"""
    if mode == "buildings":
        levels = BUILDINGS_LEVELS
    else:
        levels = ADDRESS_LEVELS
    
    try:
        idx = levels.index(level)
        if idx + 1 < len(levels):
            return levels[idx + 1]
    except ValueError:
        pass
    return None


def get_previous_level(level: int, mode: str = "address") -> Optional[int]:
    """Get the previous level in hierarchy"""
    if mode == "buildings":
        levels = BUILDINGS_LEVELS
    else:
        levels = ADDRESS_LEVELS
    
    try:
        idx = levels.index(level)
        if idx > 0:
            return levels[idx - 1]
    except ValueError:
        pass
    return None


# ============================================================================
# GPS Data Schema
# ============================================================================

class GPSData(BaseModel):
    """GPS data schema"""
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Longitude coordinate")
    altitude: Optional[float] = Field(None, ge=-500, le=10000, description="Altitude in meters")
    accuracy: Optional[float] = Field(None, ge=0, description="GPS accuracy in meters")
    source: Optional[str] = Field(None, max_length=100, description="GPS data source")
    timestamp: Optional[datetime] = Field(None, description="GPS reading timestamp")
    bounding_box: Optional[Dict[str, float]] = Field(None, description="Bounding box coordinates")
    timezone: Optional[str] = Field(None, max_length=50, description="Timezone of location")
    utc_offset: Optional[str] = Field(None, max_length=10, description="UTC offset")
    
    @field_validator('bounding_box')
    @classmethod
    def validate_bounding_box(cls, v: Optional[Dict[str, float]]) -> Optional[Dict[str, float]]:
        """Validate bounding box coordinates"""
        if v:
            required = ['north', 'south', 'east', 'west']
            for key in required:
                if key not in v:
                    raise ValueError(f'Bounding box must contain {key}')
            if v['north'] <= v['south']:
                raise ValueError('North must be greater than south')
            if v['east'] <= v['west']:
                raise ValueError('East must be greater than west')
        return v
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Base Location Schema
# ============================================================================

class LocationBase(BaseModel):
    """Base Location schema - supports both address and buildings modes"""
    
    # Identifiers
    code: str = Field(..., min_length=1, max_length=50, description="Location code")
    alt_code: Optional[str] = Field(None, max_length=50, description="Alternative code")
    
    # Hierarchy
    parent_id: Optional[UUID] = Field(None, description="Parent location ID")
    level: int = Field(..., description="Hierarchy level (1-7 for address, 11-14 for buildings)")
    
    # Names
    name: str = Field(..., min_length=1, max_length=200, description="Location name")
    short_name: Optional[str] = Field(None, max_length=50, description="Short name")
    native_name: Optional[str] = Field(None, max_length=200, description="Name in native language")
    full_name: Optional[str] = Field(None, max_length=500, description="Full hierarchical name")

    floor_number: Optional[int] = Field(None, ge=-10, le=200, description="Floor number (negative for basement)")
    capacity: Optional[int] = Field(None, ge=0, description="Maximum occupancy")
    features: Optional[str] = Field(None, max_length=1000, description="Features and amenities")
    
    # Type and Mode
    location_type: Optional[str] = Field(None, max_length=50, description="Location type")
    location_mode: Literal["address", "buildings", "mixed"] = Field(
        default="address", 
        description="Location mode: address (geographical) or buildings (physical structures)"
    )
    
    # GPS Data
    gps_data: Optional[GPSData] = Field(None, description="GPS coordinates and metadata")
    gps_coordinates: Optional[str] = Field(None, description="GPS coordinates as string (lat,lon)")
    gps_geojson: Optional[Dict[str, Any]] = Field(None, description="GeoJSON format GPS data")
    
    # Demographic
    population: Optional[int] = Field(None, ge=0, description="Population count")
    area: Optional[float] = Field(None, ge=0, description="Area in square kilometers")
    density: Optional[float] = Field(None, ge=0, description="Population density per sq km")
    
    # Postal
    postal_code: Optional[str] = Field(None, max_length=20, description="Postal code")
    
    # Metadata
    extra_metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    
    # Status
    status: Literal["active", "inactive", "archived"] = Field(default="active", description="Location status")
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate and format location code"""
        if not v or not v.strip():
            raise ValueError('Code cannot be empty')
        cleaned = v.strip().upper()
        if not re.match(r'^[A-Z0-9_-]+$', cleaned):
            raise ValueError('Code can only contain letters, numbers, underscores, and hyphens')
        if len(cleaned) > 50:
            raise ValueError('Code cannot exceed 50 characters')
        return cleaned
    
    @field_validator('level')
    @classmethod
    def validate_level(cls, v: int) -> int:
        """Validate hierarchy level (1-7 for address, 11-14 for buildings)"""
        if v not in VALID_LEVELS:
            raise ValueError(f'Level must be one of: {VALID_LEVELS}, got {v}')
        return v
    
    # REMOVED: location_type validator - moved to LocationCreate

    @field_validator('location_mode')
    @classmethod
    def validate_location_mode(cls, v: str) -> str:
        """Validate location mode"""
        if v not in VALID_LOCATION_MODES:
            raise ValueError(f'Location mode must be one of: {", ".join(VALID_LOCATION_MODES)}')
        return v
    
    @field_validator('gps_coordinates')
    @classmethod
    def validate_gps_coordinates(cls, v: Optional[str]) -> Optional[str]:
        """Validate GPS coordinates string format"""
        if v:
            pattern = r'^[-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+$'
            if not re.match(pattern, v):
                raise ValueError('GPS coordinates must be in format: latitude,longitude')
            try:
                lat, lon = v.split(',')
                lat_val = float(lat.strip())
                lon_val = float(lon.strip())
                if not (-90 <= lat_val <= 90):
                    raise ValueError('Latitude must be between -90 and 90')
                if not (-180 <= lon_val <= 180):
                    raise ValueError('Longitude must be between -180 and 180')
            except ValueError as e:
                raise ValueError(f'Invalid GPS coordinates: {str(e)}')
        return v
    
    def validate_hierarchy_consistency(self) -> 'LocationBase':
        """Validate hierarchy consistency based on mode"""
        # Level validation based on mode
        print(f"Validating level {self.level} for mode {self.location_mode}"    )
        if not is_valid_level_for_mode(self.level, self.location_mode):
            if self.location_mode == 'buildings':
                raise ValueError(f'Buildings mode level must be one of: {BUILDINGS_LEVELS}, got {self.level}')
            else:
                raise ValueError(f'Address mode level must be between 1 and 7, got {self.level}')
        
        # Get the first level of the mode
        first_level = 11 if self.location_mode == 'buildings' else 1
        
        # Top-level locations should not have parent_id
        #if self.level == first_level and self.parent_id is not None: 
        #if self.level == first_level and self.parent_id is not None: 
        #    raise ValueError(f'Level {self.level} locations cannot have a parent')
        
        # Non-top-level locations should have parent_id
        if self.level > first_level and self.parent_id is None:
            raise ValueError(f'Level {self.level} locations must have a parent')
        
        return self
    
    @model_validator(mode='after')
    def validate_hierarchy_consistency(self) -> 'LocationBase':
        """Validate hierarchy consistency based on mode"""
        # Level validation based on mode
        if not is_valid_level_for_mode(self.level, self.location_mode):
            if self.location_mode == 'buildings':
                raise ValueError(f'Buildings mode level must be one of: {BUILDINGS_LEVELS}, got {self.level}')
            else:
                raise ValueError(f'Address mode level must be between 1 and 7, got {self.level}')
        
        # If no parent, check if this is a valid top-level location
        if self.parent_id is None:
            # For address mode, level 1 is top-level
            # For buildings mode, level 11 is top-level (can be under address, but parent_id is set separately)
            if self.location_mode == 'buildings':
                # Buildings can be top-level (no parent) OR under address
                # We don't validate here because parent might be added later
                pass
            else:
                # Address mode: only level 1 can have no parent
                if self.level != 1:
                    raise ValueError(f'Address mode level {self.level} locations must have a parent')
            return self
        
        # Parent exists - validate the relationship
        # We need to fetch the parent to check its level
        # Note: This validator runs before the parent is fetched from DB,
        # so we can only validate based on level numbers
        
        # For buildings under address: parent level 1-7, child level 11-14
        # For buildings under buildings: parent level 11-13, child level parent+1
        # For address under address: parent level 1-6, child level parent+1
        
        # We don't know the parent's mode here, so we'll do basic validation
        # The actual parent lookup happens in the endpoint
        
        return self

# ============================================================================
# Create/Update Schemas
# ============================================================================

class LocationCreate(LocationBase):
    """Schema for creating a location"""
    created_by: Optional[UUID] = Field(None, description="User ID who created the location")
    
    @model_validator(mode='after')
    def validate_create(self) -> 'LocationCreate':
        """Additional validation for creation"""
        # Auto-set location_mode based on level if not provided
        if not self.location_mode:
            if self.level in BUILDINGS_LEVELS:
                self.location_mode = "buildings"
            else:
                self.location_mode = "address"
        
        # Auto-set location_type based on level if not provided
        if not self.location_type:
            if self.location_mode == 'buildings':
                type_map = {11: 'office', 12: 'building', 13: 'room', 14: 'conference'}
                self.location_type = type_map.get(self.level)
            else:
                type_map = {1: 'country', 2: 'region', 3: 'district', 4: 'county', 
                           5: 'subcounty', 6: 'parish', 7: 'village'}
                self.location_type = type_map.get(self.level)
        
        # NOW validate location_type after it has been set
        if self.location_type:
            if self.location_mode == 'buildings':
                if self.location_type not in BUILDINGS_LOCATION_TYPES:
                    raise ValueError(f'Buildings mode location type must be one of: {", ".join(BUILDINGS_LOCATION_TYPES)}')
            else:
                if self.location_type not in ADDRESS_LOCATION_TYPES:
                    raise ValueError(f'Address mode location type must be one of: {", ".join(ADDRESS_LOCATION_TYPES)}')
        
        return self


class LocationUpdate(BaseModel):
    """Schema for updating a location - all fields optional"""
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    alt_code: Optional[str] = Field(None, max_length=50)
    parent_id: Optional[UUID] = None
    level: Optional[int] = None
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    short_name: Optional[str] = Field(None, max_length=50)
    native_name: Optional[str] = Field(None, max_length=200)
    full_name: Optional[str] = Field(None, max_length=500)
    location_type: Optional[str] = Field(None, max_length=50)
    location_mode: Optional[Literal["address", "buildings", "mixed"]] = None
    gps_data: Optional[GPSData] = None
    gps_coordinates: Optional[str] = None
    gps_geojson: Optional[Dict[str, Any]] = None
    population: Optional[int] = Field(None, ge=0)
    area: Optional[float] = Field(None, ge=0)
    density: Optional[float] = Field(None, ge=0)
    postal_code: Optional[str] = Field(None, max_length=20)
    extra_metadata: Optional[Dict[str, Any]] = None
    status: Optional[Literal["active", "inactive", "archived"]] = None
    updated_by: Optional[UUID] = None
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v: Optional[str]) -> Optional[str]:
        """Validate and format location code if provided"""
        if v:
            cleaned = v.strip().upper()
            if not re.match(r'^[A-Z0-9_-]+$', cleaned):
                raise ValueError('Code can only contain letters, numbers, underscores, and hyphens')
            return cleaned
        return v
    
    @field_validator('level')
    @classmethod
    def validate_level(cls, v: Optional[int]) -> Optional[int]:
        """Validate hierarchy level if provided"""
        if v is not None and v not in VALID_LEVELS:
            raise ValueError(f'Level must be one of: {VALID_LEVELS}, got {v}')
        return v
    
    @field_validator('location_mode')
    @classmethod
    def validate_location_mode(cls, v: Optional[str]) -> Optional[str]:
        """Validate location mode if provided"""
        if v and v not in VALID_LOCATION_MODES:
            raise ValueError(f'Location mode must be one of: {", ".join(VALID_LOCATION_MODES)}')
        return v
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """Validate status if provided"""
        if v and v not in VALID_STATUSES:
            raise ValueError(f'Status must be one of: {", ".join(VALID_STATUSES)}')
        return v
    
    @field_validator('gps_coordinates')
    @classmethod
    def validate_gps_coordinates(cls, v: Optional[str]) -> Optional[str]:
        """Validate GPS coordinates string format if provided"""
        if v:
            pattern = r'^[-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+$'
            if not re.match(pattern, v):
                raise ValueError('GPS coordinates must be in format: latitude,longitude')
            try:
                lat, lon = v.split(',')
                lat_val = float(lat.strip())
                lon_val = float(lon.strip())
                if not (-90 <= lat_val <= 90):
                    raise ValueError('Latitude must be between -90 and 90')
                if not (-180 <= lon_val <= 180):
                    raise ValueError('Longitude must be between -180 and 180')
            except ValueError as e:
                raise ValueError(f'Invalid GPS coordinates: {str(e)}')
        return v


# ============================================================================
# Response Schemas
# ============================================================================

class LocationInDB(LocationBase):
    """Location schema as stored in database"""
    id: UUID
    status: str = "active"
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    
    model_config = ConfigDict(from_attributes=True)


class LocationResponse(LocationInDB):
    """Location response schema with computed fields"""
    level_name: Optional[str] = Field(None, description="Human-readable level name")
    level_icon: Optional[str] = Field(None, description="Icon for the level")
    display_name: Optional[str] = Field(None, description="Formatted display name")
    display_name_with_mode: Optional[str] = Field(None, description="Display name with mode indicator")
    hierarchical_path: Optional[str] = Field(None, description="Full hierarchical path")
    has_children: bool = Field(default=False, description="Whether location has children")
    child_count: int = Field(default=0, description="Number of child locations")
    
    @field_validator('level_name', mode='before')
    @classmethod
    def compute_level_name(cls, v: Optional[str], info) -> str:
        """Compute level name from level and mode if not provided"""
        if v:
            return v
        level = info.data.get('level')
        mode = info.data.get('location_mode', 'address')
        return get_level_name(level, mode)
    
    @field_validator('level_icon', mode='before')
    @classmethod
    def compute_level_icon(cls, v: Optional[str], info) -> str:
        """Compute level icon from level and mode"""
        if v:
            return v
        level = info.data.get('level')
        mode = info.data.get('location_mode', 'address')
        return get_level_icon(level, mode)
    
    @field_validator('display_name', mode='before')
    @classmethod
    def compute_display_name(cls, v: Optional[str], info) -> str:
        """Compute display name from name and level_name if not provided"""
        if v:
            return v
        name = info.data.get('name', '')
        level_name = info.data.get('level_name', '')
        return f"{name} ({level_name})" if level_name else name
    
    @field_validator('display_name_with_mode', mode='before')
    @classmethod
    def compute_display_name_with_mode(cls, v: Optional[str], info) -> str:
        """Compute display name with mode indicator"""
        if v:
            return v
        name = info.data.get('name', '')
        level_name = info.data.get('level_name', '')
        mode = info.data.get('location_mode', 'address')
        mode_icon = "📍" if mode == 'address' else "🏢" if mode == 'buildings' else "🔄"
        return f"{mode_icon} {name} ({level_name})"
    
    model_config = ConfigDict(from_attributes=True, extra="allow")


class LocationTreeResponse(BaseModel):
    """Used exclusively by the /tree endpoint — children eagerly populated by CRUD"""
    id: UUID
    code: str
    alt_code: Optional[str] = None
    name: str
    short_name: Optional[str] = None
    native_name: Optional[str] = None
    full_name: Optional[str] = None
    level: int
    level_name: str
    level_icon: Optional[str] = None
    location_type: Optional[str] = None
    location_mode: str = "address"
    parent_id: Optional[UUID] = None
    status: str
    display_name: Optional[str] = None
    display_name_with_mode: Optional[str] = None
    has_children: bool = False
    child_count: int = 0
    children: List['LocationTreeResponse'] = []
    
    @field_validator('level_name', mode='before')
    @classmethod
    def compute_level_name(cls, v: Optional[str], info) -> str:
        if v:
            return v
        level = info.data.get('level')
        mode = info.data.get('location_mode', 'address')
        return get_level_name(level, mode)
    
    @field_validator('level_icon', mode='before')
    @classmethod
    def compute_level_icon(cls, v: Optional[str], info) -> str:
        if v:
            return v
        level = info.data.get('level')
        mode = info.data.get('location_mode', 'address')
        return get_level_icon(level, mode)
    
    @field_validator('display_name', mode='before')
    @classmethod
    def compute_display_name(cls, v: Optional[str], info) -> str:
        if v:
            return v
        name = info.data.get('name', '')
        level_name = info.data.get('level_name', '')
        return f"{name} ({level_name})" if level_name else name
    
    @field_validator('display_name_with_mode', mode='before')
    @classmethod
    def compute_display_name_with_mode(cls, v: Optional[str], info) -> str:
        if v:
            return v
        name = info.data.get('name', '')
        level_name = info.data.get('level_name', '')
        mode = info.data.get('location_mode', 'address')
        mode_icon = "📍" if mode == 'address' else "🏢" if mode == 'buildings' else "🔄"
        return f"{mode_icon} {name} ({level_name})"
    
    model_config = ConfigDict(from_attributes=True)


class LocationListResponse(BaseModel):
    """Paginated location list response"""
    items: List[LocationResponse]
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    size: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")
    
    @field_validator('pages', mode='before')
    @classmethod
    def compute_pages(cls, v: int, info) -> int:
        if v > 0:
            return v
        total = info.data.get('total', 0)
        size = info.data.get('size', 1)
        return (total + size - 1) // size if total > 0 else 0


class LocationBreadcrumb(BaseModel):
    """Breadcrumb item for location navigation"""
    id: UUID
    code: str
    name: str
    level: int
    level_name: str
    level_icon: Optional[str] = None
    location_mode: str = "address"
    
    @field_validator('level_name', mode='before')
    @classmethod
    def compute_level_name(cls, v: Optional[str], info) -> str:
        if v:
            return v
        level = info.data.get('level')
        mode = info.data.get('location_mode', 'address')
        return get_level_name(level, mode)
    
    @field_validator('level_icon', mode='before')
    @classmethod
    def compute_level_icon(cls, v: Optional[str], info) -> str:
        if v:
            return v
        level = info.data.get('level')
        mode = info.data.get('location_mode', 'address')
        return get_level_icon(level, mode)


class LocationStatisticsResponse(BaseModel):
    """Location statistics response"""
    total: int = Field(..., description="Total number of locations")
    top_level: int = Field(..., description="Number of top-level locations")
    by_level: Dict[str, int] = Field(..., description="Count by hierarchy level")
    by_mode: Dict[str, int] = Field(..., description="Count by location mode (address/buildings/mixed)")
    by_type: Dict[str, int] = Field(..., description="Count by location type")
    by_status: Dict[str, int] = Field(..., description="Count by status")
    with_gps: int = Field(..., description="Locations with GPS data")
    
    # Address mode specific
    countries: int = Field(default=0, description="Number of countries")
    regions: int = Field(default=0, description="Number of regions")
    districts: int = Field(default=0, description="Number of districts")
    
    # Buildings mode specific
    offices: int = Field(default=0, description="Number of office locations")
    buildings: int = Field(default=0, description="Number of building locations")
    rooms: int = Field(default=0, description="Number of room locations")
    conferences: int = Field(default=0, description="Number of conference locations")


class LocationSearchParams(BaseModel):
    """Location search parameters"""
    query: str = Field(..., min_length=1, description="Search query")
    level: Optional[int] = Field(None, description="Filter by level")
    location_mode: Optional[Literal["address", "buildings", "mixed"]] = Field(None, description="Filter by mode")
    location_type: Optional[str] = Field(None, description="Filter by type")
    include_inactive: bool = Field(False, description="Include inactive locations")
    limit: int = Field(50, ge=1, le=200, description="Results per page")
    offset: int = Field(0, ge=0, description="Number of results to skip")


class LocationHierarchySummary(BaseModel):
    """Location hierarchy summary"""
    current: LocationResponse
    ancestors: List[LocationResponse] = []
    ancestor_count: int = 0
    descendants: List[LocationResponse] = []
    descendant_count: int = 0
    path: str = ""
    breadcrumb: List[LocationBreadcrumb] = []


# ============================================================================
# Rebuild models to resolve forward references
# ============================================================================

LocationResponse.model_rebuild()
LocationTreeResponse.model_rebuild()