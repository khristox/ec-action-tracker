# app/schemas/address/location.py

"""
Location Schemas for API validation
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any, Literal
from uuid import UUID
from datetime import datetime
import re


class GPSData(BaseModel):
    """GPS data schema"""
    latitude: Optional[str] = Field(None, description="Latitude coordinate")
    longitude: Optional[str] = Field(None, description="Longitude coordinate")
    altitude: Optional[int] = Field(None, description="Altitude in meters")
    accuracy: Optional[str] = Field(None, description="GPS accuracy level")
    source: Optional[str] = Field(None, description="GPS data source")
    timestamp: Optional[str] = Field(None, description="GPS reading timestamp")
    bounding_box: Optional[Dict[str, str]] = Field(None, description="Bounding box coordinates")
    timezone: Optional[str] = Field(None, description="Timezone of location")
    utc_offset: Optional[str] = Field(None, description="UTC offset")
    
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
    
    # Type
    location_type: Optional[str] = Field(None, max_length=50, description="Location type")
    
    # GPS Data
    gps_data: Optional[Dict[str, Any]] = Field(None, description="GPS coordinates and metadata")
    
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
        return cleaned
    
    @field_validator('level')
    @classmethod
    def validate_level(cls, v: int) -> int:
        """Validate hierarchy level"""
        if v < 1 or v > 7:
            raise ValueError('Level must be between 1 and 7')
        return v
    
    @field_validator('location_type')
    @classmethod
    def validate_location_type(cls, v: Optional[str]) -> Optional[str]:
        """Validate location type"""
        if v:
            valid_types = ['country', 'region', 'district', 'county', 'subcounty', 'parish', 'village']
            if v.lower() not in valid_types:
                raise ValueError(f'Location type must be one of: {", ".join(valid_types)}')
        return v
    
    @model_validator(mode='after')
    def validate_gps_data(self) -> 'LocationBase':
        """Validate GPS data structure"""
        if self.gps_data:
            if 'latitude' in self.gps_data and 'longitude' in self.gps_data:
                try:
                    lat = float(self.gps_data['latitude'])
                    lon = float(self.gps_data['longitude'])
                    if not (-90 <= lat <= 90):
                        raise ValueError('Latitude must be between -90 and 90')
                    if not (-180 <= lon <= 180):
                        raise ValueError('Longitude must be between -180 and 180')
                except (ValueError, TypeError):
                    raise ValueError('Invalid latitude/longitude format')
        return self


class LocationCreate(LocationBase):
    """Schema for creating a location"""
    pass


class LocationUpdate(BaseModel):
    """Schema for updating a location - all fields optional"""
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    alt_code: Optional[str] = Field(None, max_length=20)
    parent_id: Optional[UUID] = None
    level: Optional[int] = Field(None, ge=1, le=7)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    short_name: Optional[str] = Field(None, max_length=50)
    native_name: Optional[str] = Field(None, max_length=200)
    full_name: Optional[str] = Field(None, max_length=500)
    location_type: Optional[str] = Field(None, max_length=50)
    gps_data: Optional[Dict[str, Any]] = None
    population: Optional[int] = Field(None, ge=0)
    area: Optional[float] = Field(None, ge=0)
    density: Optional[float] = Field(None, ge=0)
    postal_code: Optional[str] = Field(None, max_length=20)
    extra_metadata: Optional[Dict[str, Any]] = None
    status: Optional[Literal["active", "inactive", "archived"]] = None


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

# app/schemas/address/location.py
# app/schemas/address/location.py
class LocationResponse(LocationInDB):
    """Location response schema"""
    level_name: Optional[str] = None
    display_name: Optional[str] = None
    hierarchical_path: Optional[str] = None
    gps_coordinates: Optional[Dict[str, Any]] = None
    gps_geojson: Optional[Dict[str, Any]] = None
    has_children: bool = False
    child_count: int = 0
    # No children field here — LocationResponse is for single/list responses.
    # Children are only in LocationTreeResponse, which is only used by /tree endpoint.

    model_config = ConfigDict(from_attributes=True, extra="allow")


class LocationTreeResponse(BaseModel):
    """Used exclusively by the /tree endpoint — children eagerly populated by CRUD"""
    id: UUID
    code: str
    name: str
    level: int
    level_name: str
    location_type: Optional[str] = None
    parent_id: Optional[UUID] = None
    status: str
    display_name: Optional[str] = None
    has_children: bool = False
    child_count: int = 0
    children: List['LocationTreeResponse'] = []

    model_config = ConfigDict(from_attributes=True)


class LocationListResponse(BaseModel):
    items: List[LocationResponse]
    total: int
    page: int
    size: int
    pages: int


class LocationBreadcrumb(BaseModel):
    id: UUID
    code: str
    name: str
    level: int
    level_name: str


LocationResponse.model_rebuild()
LocationTreeResponse.model_rebuild()
