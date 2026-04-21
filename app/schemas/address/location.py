# app/schemas/address/location.py

"""
Location Schemas for API validation
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any, Literal
from uuid import UUID
from datetime import datetime
import re

# Constants
VALID_LOCATION_MODES = ["address", "buildings"]
VALID_LOCATION_TYPES = ["country", "region", "district", "county", "subcounty", "parish", "village", "building"]
VALID_LEVELS = range(1, 8)
VALID_STATUSES = ["active", "inactive", "archived"]


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
    
    class Config:
        from_attributes = True


class LocationBase(BaseModel):
    """Base Location schema"""
    # Identifiers
    code: str = Field(..., min_length=1, max_length=50, description="Location code")
    alt_code: Optional[str] = Field(None, max_length=50, description="Alternative code")
    
    # Hierarchy
    parent_id: Optional[UUID] = Field(None, description="Parent location ID")
    level: int = Field(..., ge=1, le=7, description="Hierarchy level (1-7)")
    
    # Names
    name: str = Field(..., min_length=1, max_length=200, description="Location name")
    short_name: Optional[str] = Field(None, max_length=50, description="Short name")
    native_name: Optional[str] = Field(None, max_length=200, description="Name in native language")
    full_name: Optional[str] = Field(None, max_length=500, description="Full hierarchical name")
    
    # Type and Mode
    location_type: Optional[str] = Field(None, max_length=50, description="Location type (country, district, etc.)")
    location_mode: Literal["address", "buildings"] = Field(
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
        """Validate hierarchy level"""
        if v not in VALID_LEVELS:
            raise ValueError(f'Level must be between 1 and 7, got {v}')
        return v
    
    @field_validator('location_type')
    @classmethod
    def validate_location_type(cls, v: Optional[str]) -> Optional[str]:
        """Validate location type"""
        if v:
            v_lower = v.lower()
            if v_lower not in VALID_LOCATION_TYPES:
                raise ValueError(f'Location type must be one of: {", ".join(VALID_LOCATION_TYPES)}')
            return v_lower
        return v
    
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
    
    @model_validator(mode='after')
    def validate_hierarchy_consistency(self) -> 'LocationBase':
        """Validate hierarchy consistency"""
        # Level 1 locations should not have parent_id
        if self.level == 1 and self.parent_id is not None:
            raise ValueError('Level 1 locations cannot have a parent')
        
        # Level > 1 should have parent_id
        if self.level > 1 and self.parent_id is None:
            raise ValueError(f'Level {self.level} locations must have a parent')
        
        return self
    
    @model_validator(mode='after')
    def validate_gps_data_consistency(self) -> 'LocationBase':
        """Validate GPS data consistency across fields"""
        # If gps_coordinates is provided, ensure it matches gps_data
        if self.gps_coordinates and self.gps_data:
            try:
                lat, lon = self.gps_coordinates.split(',')
                expected_lat = float(lat.strip())
                expected_lon = float(lon.strip())
                
                if abs(self.gps_data.latitude - expected_lat) > 0.0001:
                    raise ValueError('GPS coordinates mismatch between gps_coordinates and gps_data.latitude')
                if abs(self.gps_data.longitude - expected_lon) > 0.0001:
                    raise ValueError('GPS coordinates mismatch between gps_coordinates and gps_data.longitude')
            except (AttributeError, ValueError, TypeError):
                pass  # Skip if gps_data doesn't have latitude/longitude
        
        return self


class LocationCreate(LocationBase):
    """Schema for creating a location"""
    created_by: Optional[UUID] = Field(None, description="User ID who created the location")
    
    @model_validator(mode='after')
    def validate_create(self) -> 'LocationCreate':
        """Additional validation for creation"""
        # Ensure location_mode is set (default is 'address' from base)
        if not self.location_mode:
            self.location_mode = "address"
        return self


class LocationUpdate(BaseModel):
    """Schema for updating a location - all fields optional"""
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    alt_code: Optional[str] = Field(None, max_length=50)
    parent_id: Optional[UUID] = None
    level: Optional[int] = Field(None, ge=1, le=7)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    short_name: Optional[str] = Field(None, max_length=50)
    native_name: Optional[str] = Field(None, max_length=200)
    full_name: Optional[str] = Field(None, max_length=500)
    location_type: Optional[str] = Field(None, max_length=50)
    location_mode: Optional[Literal["address", "buildings"]] = None
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


class LocationInDB(LocationBase):
    """Location schema as stored in database"""
    id: UUID
    status: str = "active"
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    
    class Config:
        from_attributes = True


class LocationResponse(LocationInDB):
    """Location response schema"""
    level_name: Optional[str] = Field(None, description="Human-readable level name")
    display_name: Optional[str] = Field(None, description="Formatted display name")
    hierarchical_path: Optional[str] = Field(None, description="Full hierarchical path")
    has_children: bool = Field(default=False, description="Whether location has children")
    child_count: int = Field(default=0, description="Number of child locations")
    
    # Add computed fields
    @field_validator('level_name', mode='before')
    @classmethod
    def compute_level_name(cls, v: Optional[str], info) -> str:
        """Compute level name from level if not provided"""
        if v:
            return v
        level = info.data.get('level')
        level_names = {
            1: 'Country',
            2: 'Region',
            3: 'District',
            4: 'County',
            5: 'Subcounty',
            6: 'Parish',
            7: 'Village/Building'
        }
        return level_names.get(level, f'Level {level}')
    
    @field_validator('display_name', mode='before')
    @classmethod
    def compute_display_name(cls, v: Optional[str], info) -> str:
        """Compute display name from name and level_name if not provided"""
        if v:
            return v
        name = info.data.get('name', '')
        level_name = info.data.get('level_name', '')
        return f"{name} ({level_name})" if level_name else name
    
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
    location_type: Optional[str] = None
    location_mode: str = "address"
    parent_id: Optional[UUID] = None
    status: str
    display_name: Optional[str] = None
    has_children: bool = False
    child_count: int = 0
    children: List['LocationTreeResponse'] = []
    
    @field_validator('level_name', mode='before')
    @classmethod
    def compute_level_name(cls, v: Optional[str], info) -> str:
        """Compute level name from level if not provided"""
        if v:
            return v
        level = info.data.get('level')
        level_names = {
            1: 'Country',
            2: 'Region',
            3: 'District',
            4: 'County',
            5: 'Subcounty',
            6: 'Parish',
            7: 'Village/Building'
        }
        return level_names.get(level, f'Level {level}')
    
    @field_validator('display_name', mode='before')
    @classmethod
    def compute_display_name(cls, v: Optional[str], info) -> str:
        """Compute display name from name and level_name if not provided"""
        if v:
            return v
        name = info.data.get('name', '')
        level_name = info.data.get('level_name', '')
        return f"{name} ({level_name})" if level_name else name
    
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
        """Compute total pages if not provided"""
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
    location_mode: str = "address"
    
    @field_validator('level_name', mode='before')
    @classmethod
    def compute_level_name(cls, v: Optional[str], info) -> str:
        """Compute level name from level if not provided"""
        if v:
            return v
        level = info.data.get('level')
        level_names = {
            1: 'Country',
            2: 'Region',
            3: 'District',
            4: 'County',
            5: 'Subcounty',
            6: 'Parish',
            7: 'Village/Building'
        }
        return level_names.get(level, f'Level {level}')


class LocationStatisticsResponse(BaseModel):
    """Location statistics response"""
    total: int = Field(..., description="Total number of locations")
    top_level: int = Field(..., description="Number of top-level locations")
    countries: int = Field(..., description="Number of countries")
    buildings: int = Field(..., description="Number of buildings")
    by_level: Dict[str, int] = Field(..., description="Count by hierarchy level")
    by_mode: Dict[str, int] = Field(..., description="Count by location mode (address/buildings)")
    by_type: Dict[str, int] = Field(..., description="Count by location type")


class LocationSearchParams(BaseModel):
    """Location search parameters"""
    query: str = Field(..., min_length=1, description="Search query")
    level: Optional[int] = Field(None, ge=1, le=7, description="Filter by level")
    location_mode: Optional[Literal["address", "buildings"]] = Field(None, description="Filter by mode")
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


# Rebuild models to resolve forward references
LocationResponse.model_rebuild()
LocationTreeResponse.model_rebuild()