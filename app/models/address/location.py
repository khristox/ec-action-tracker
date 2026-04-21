# app/models/address/location.py

"""
Single table for hierarchical address structure using parent-child relationships
"""

from typing import Optional, List, Dict, Any, Union
from uuid import UUID
import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, String, Text, Boolean, JSON, ForeignKey, Index, Integer, Float
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.sql import func
from app.models.base import BaseModel
from app.db.base import Base
from app.db.types import UUID as CustomUUID


class Location(BaseModel):
    """
    Hierarchical location table that handles all address levels.
    Uses a self-referential parent-child relationship.
    """
    __tablename__ = "locations"
    __table_args__ = (
        Index('idx_location_code', 'code'),
        Index('idx_location_level', 'level'),
        Index('idx_location_parent', 'parent_id'),
        Index('idx_location_name', 'name'),
        Index('idx_location_status', 'status'),
        Index('idx_location_type', 'location_type'),
        Index('idx_location_hierarchy', 'level', 'parent_id'),
        Index('idx_location_code_level', 'code', 'level', unique=True),
        Index('idx_location_search', 'name', 'code', 'level'),
        Index('idx_location_mode', 'location_mode'),
        {'extend_existing': True}
    )

    # ==================== PRIMARY IDENTIFIERS ====================
    code = Column(String(50), nullable=False, index=True)
    alt_code = Column(String(50), unique=True, nullable=True, index=True)

    # ==================== HIERARCHY ====================
    parent_id = Column(CustomUUID, ForeignKey("locations.id", ondelete="CASCADE"), nullable=True, index=True)
    level = Column(Integer, nullable=False, index=True)

    # ==================== NAMES ====================
    name = Column(String(200), nullable=False)
    short_name = Column(String(50), nullable=True)
    native_name = Column(String(200), nullable=True)
    full_name = Column(String(500), nullable=True)

    # ==================== TYPE ====================
    location_type = Column(String(50), nullable=True)

    # ==================== MODE ====================
    location_mode = Column(String(50), nullable=False, default="address", server_default="address", index=True)

    # ==================== STATUS ====================
    status = Column(String(20), default="active", index=True)

    # ==================== GPS DATA ====================
    _latitude = Column("latitude", Float, nullable=True)
    _longitude = Column("longitude", Float, nullable=True)
    gps_data = Column(JSON, default=dict, nullable=True)

    # ==================== DEMOGRAPHIC DATA ====================
    population = Column(Integer, nullable=True)
    area = Column(Float, nullable=True)
    density = Column(Float, nullable=True)

    # ==================== POSTAL DATA ====================
    postal_code = Column(String(20), nullable=True)

    # ==================== METADATA ====================
    extra_metadata = Column(JSON, default=dict)

    # ==================== RELATIONSHIPS ====================
    parent = relationship(
        "Location",
        remote_side=lambda: [Location.id],
        back_populates="children",
        lazy="noload",
        foreign_keys=[parent_id],
    )
    children = relationship(
        "Location",
        back_populates="parent",
        lazy="noload",
        foreign_keys=[parent_id],
    )

    # ==================== VALIDATION ====================
    @validates('level')
    def validate_level(self, key, value):
        if value < 1 or value > 7:
            raise ValueError(f"Level must be between 1 and 7, got {value}")
        return value

    @validates('location_type')
    def validate_location_type(self, key, value):
        valid_types = ['country', 'region', 'district', 'county', 'subcounty', 'parish', 'village']
        if value and value not in valid_types:
            raise ValueError(f"Location type must be one of {valid_types}, got {value}")
        return value

    @validates('location_mode')
    def validate_location_mode(self, key, value):
        valid_modes = ['address', 'buildings', 'mixed']
        if value and value not in valid_modes:
            raise ValueError(f"Location mode must be one of {valid_modes}, got {value}")
        return value

    # ==================== PROPERTIES ====================
    
    @property
    def latitude(self) -> Optional[float]:
        """Get latitude"""
        return self._latitude
    
    @latitude.setter
    def latitude(self, value: Optional[float]) -> None:
        """Set latitude"""
        if value is not None:
            if not (-90 <= value <= 90):
                raise ValueError(f"Latitude must be between -90 and 90, got {value}")
        self._latitude = value
    
    @property
    def longitude(self) -> Optional[float]:
        """Get longitude"""
        return self._longitude
    
    @longitude.setter
    def longitude(self, value: Optional[float]) -> None:
        """Set longitude"""
        if value is not None:
            if not (-180 <= value <= 180):
                raise ValueError(f"Longitude must be between -180 and 180, got {value}")
        self._longitude = value
    
    @property
    def gps_coordinates(self) -> Optional[Dict[str, Any]]:
        """Get GPS coordinates as dictionary"""
        if self._latitude is not None and self._longitude is not None:
            return {
                "latitude": self._latitude,
                "longitude": self._longitude,
                "altitude": self.gps_data.get("altitude") if self.gps_data else None
            }
        return None
    
    @gps_coordinates.setter
    def gps_coordinates(self, value: Union[str, Dict, tuple, list]) -> None:
        """Set GPS coordinates from various formats"""
        if value is None:
            self._latitude = None
            self._longitude = None
            return
        
        try:
            # Handle string format: "latitude,longitude" or "latitude,longitude,altitude"
            if isinstance(value, str):
                parts = value.split(',')
                if len(parts) >= 2:
                    self._latitude = float(parts[0].strip())
                    self._longitude = float(parts[1].strip())
                    if len(parts) >= 3 and parts[2].strip():
                        if self.gps_data is None:
                            self.gps_data = {}
                        self.gps_data["altitude"] = float(parts[2].strip())
            
            # Handle dictionary format
            elif isinstance(value, dict):
                if 'latitude' in value and 'longitude' in value:
                    self._latitude = float(value['latitude'])
                    self._longitude = float(value['longitude'])
                    if 'altitude' in value and value['altitude']:
                        if self.gps_data is None:
                            self.gps_data = {}
                        self.gps_data["altitude"] = float(value['altitude'])
            
            # Handle tuple/list format: (latitude, longitude) or (latitude, longitude, altitude)
            elif isinstance(value, (tuple, list)) and len(value) >= 2:
                self._latitude = float(value[0])
                self._longitude = float(value[1])
                if len(value) >= 3 and value[2]:
                    if self.gps_data is None:
                        self.gps_data = {}
                    self.gps_data["altitude"] = float(value[2])
            
            else:
                raise ValueError(f"Unsupported GPS coordinates format: {type(value)}")
                
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid GPS coordinates: {e}")
    
    @property
    def gps_coordinates_string(self) -> Optional[str]:
        """Get GPS coordinates as string"""
        if self._latitude is not None and self._longitude is not None:
            return f"{self._latitude},{self._longitude}"
        return None
    
    @property
    def level_name(self) -> str:
        level_names = {
            1: "Country",
            2: "Region",
            3: "District",
            4: "County",
            5: "SubCounty",
            6: "Parish",
            7: "Village"
        }
        return level_names.get(self.level, f"Level {self.level}")

    @property
    def mode_name(self) -> str:
        mode_names = {
            'address': "Address Location",
            'buildings': "Building/Facility",
            'mixed': "Mixed Use"
        }
        return mode_names.get(self.location_mode, self.location_mode)

    @property
    def is_address_mode(self) -> bool:
        return self.location_mode == 'address'

    @property
    def is_buildings_mode(self) -> bool:
        return self.location_mode == 'buildings'

    @property
    def is_mixed_mode(self) -> bool:
        return self.location_mode == 'mixed'

    @property
    def is_country(self) -> bool:
        return self.level == 1

    @property
    def is_region(self) -> bool:
        return self.level == 2

    @property
    def is_district(self) -> bool:
        return self.level == 3

    @property
    def is_county(self) -> bool:
        return self.level == 4

    @property
    def is_subcounty(self) -> bool:
        return self.level == 5

    @property
    def is_parish(self) -> bool:
        return self.level == 6

    @property
    def is_village(self) -> bool:
        return self.level == 7

    @property
    def display_name(self) -> str:
        if self.short_name:
            return f"{self.short_name} ({self.level_name})"
        return f"{self.name} ({self.level_name})"

    @property
    def display_name_with_mode(self) -> str:
        base_name = self.display_name
        mode_icon = "📍" if self.is_address_mode else "🏢" if self.is_buildings_mode else "🔄"
        return f"{mode_icon} {base_name} [{self.mode_name}]"

    @property
    def display_name_with_code(self) -> str:
        return f"{self.name} ({self.code})"

    @property
    def hierarchical_path(self) -> str:
        try:
            if self.parent_id:
                return f"Level {self.level}: {self.name}"
            return self.name
        except Exception:
            return self.name

    @property
    def ancestor_ids(self) -> List[UUID]:
        return []

    @property
    def has_gps(self) -> bool:
        return self._latitude is not None and self._longitude is not None

    @property
    def gps_geojson(self) -> Optional[Dict[str, Any]]:
        if self.has_gps:
            return {
                "type": "Point",
                "coordinates": [float(self._longitude), float(self._latitude)]
            }
        return None

    @property
    def bounding_box(self) -> Optional[Dict[str, Any]]:
        if self.gps_data and "bounding_box" in self.gps_data:
            return self.gps_data["bounding_box"]
        return None

    @property
    def is_active(self) -> bool:
        return self.status == "active"

    # ==================== METHODS ====================
    
    def set_gps(self, latitude: Union[float, str], longitude: Union[float, str], altitude: Optional[float] = None, **kwargs) -> None:
        """Set GPS coordinates"""
        self._latitude = float(latitude)
        self._longitude = float(longitude)
        
        if self.gps_data is None:
            self.gps_data = {}
        
        self.gps_data.update({
            "latitude": self._latitude,
            "longitude": self._longitude,
            "altitude": altitude,
            "timestamp": datetime.now().isoformat(),
            **kwargs
        })

    def set_bounding_box(self, min_lat: float, max_lat: float, min_lon: float, max_lon: float) -> None:
        """Set bounding box"""
        if self.gps_data is None:
            self.gps_data = {}
        
        self.gps_data["bounding_box"] = {
            "min_latitude": min_lat,
            "max_latitude": max_lat,
            "min_longitude": min_lon,
            "max_longitude": max_lon
        }

    def get_gps_center(self) -> Optional[tuple]:
        """Get GPS center point"""
        if self.bounding_box:
            bb = self.bounding_box
            center_lat = (bb["min_latitude"] + bb["max_latitude"]) / 2
            center_lon = (bb["min_longitude"] + bb["max_longitude"]) / 2
            return (center_lat, center_lon)
        elif self.has_gps:
            return (self._latitude, self._longitude)
        return None

    def activate(self) -> None:
        """Activate location"""
        self.status = "active"

    def deactivate(self) -> None:
        """Deactivate location"""
        self.status = "inactive"

    def archive(self) -> None:
        """Archive location"""
        self.status = "archived"

    def set_address_mode(self) -> None:
        """Set location mode to address"""
        self.location_mode = 'address'

    def set_buildings_mode(self) -> None:
        """Set location mode to buildings"""
        self.location_mode = 'buildings'

    def set_mixed_mode(self) -> None:
        """Set location mode to mixed"""
        self.location_mode = 'mixed'

    def to_dict(self, include_children: bool = False, depth: int = 1, max_depth: int = 2) -> Dict[str, Any]:
        """Convert to dictionary"""
        result = {
            "id": str(self.id) if self.id else None,
            "code": self.code,
            "alt_code": self.alt_code,
            "name": self.name,
            "short_name": self.short_name,
            "native_name": self.native_name,
            "full_name": self.full_name,
            "level": self.level,
            "level_name": self.level_name,
            "location_type": self.location_type,
            "location_mode": self.location_mode,
            "mode_name": self.mode_name,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "hierarchical_path": self.hierarchical_path,
            "display_name": self.display_name,
            "display_name_with_mode": self.display_name_with_mode,
            "gps": self.gps_coordinates,
            "gps_coordinates_string": self.gps_coordinates_string,
            "gps_geojson": self.gps_geojson,
            "bounding_box": self.bounding_box,
            "population": self.population,
            "area": self.area,
            "density": self.density,
            "postal_code": self.postal_code,
            "status": self.status,
            "is_active": self.is_active,
            "is_address_mode": self.is_address_mode,
            "is_buildings_mode": self.is_buildings_mode,
            "is_mixed_mode": self.is_mixed_mode,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": str(self.created_by) if self.created_by else None,
            "updated_by": str(self.updated_by) if self.updated_by else None,
        }
        
        if include_children and hasattr(self, '_children_loaded') and self.children and depth < max_depth:
            result["children"] = [
                child.to_dict(include_children=True, depth=depth + 1, max_depth=max_depth)
                for child in self.children
                if child.status == "active"
            ]
        
        return result

    def to_brief_dict(self) -> Dict[str, Any]:
        """Convert to brief dictionary"""
        return {
            "id": str(self.id) if self.id else None,
            "code": self.code,
            "name": self.name,
            "short_name": self.short_name,
            "level": self.level,
            "level_name": self.level_name,
            "location_type": self.location_type,
            "location_mode": self.location_mode,
            "mode_name": self.mode_name,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "status": self.status,
        }

    def to_address_dict(self) -> Dict[str, Any]:
        """Convert to address dictionary"""
        return {
            "id": str(self.id) if self.id else None,
            "name": self.name,
            "full_name": self.full_name,
            "code": self.code,
            "level": self.level,
            "level_name": self.level_name,
            "postal_code": self.postal_code,
            "parent_id": str(self.parent_id) if self.parent_id else None,
        }

    def to_building_dict(self) -> Dict[str, Any]:
        """Convert to building dictionary"""
        return {
            "id": str(self.id) if self.id else None,
            "name": self.name,
            "code": self.code,
            "location_type": self.location_type,
            "gps": self.gps_coordinates,
            "address": self.hierarchical_path,
            "parent_id": str(self.parent_id) if self.parent_id else None,
        }

    def __repr__(self) -> str:
        try:
            code = getattr(self, 'code', None)
            name = getattr(self, 'name', None)
            level = getattr(self, 'level', None)
            mode = getattr(self, 'location_mode', 'address')
            
            if code and name and level:
                mode_icon = "📍" if mode == 'address' else "🏢" if mode == 'buildings' else "🔄"
                return f"<Location {mode_icon} {code}: {name} (Level {level})>"
            elif code:
                return f"<Location {code}>"
            else:
                obj_id = getattr(self, 'id', None)
                return f"<Location {obj_id}>" if obj_id else f"<Location at {hex(id(self))}>"
        except Exception:
            return f"<Location at {hex(id(self))}>"

    def __str__(self) -> str:
        return self.display_name_with_mode if hasattr(self, 'location_mode') else self.display_name
    
    def to_dict(self) -> dict:
        """Convert to dictionary - safe to call while session is active."""
        return {
            "id": str(self.id) if self.id else None,
            "code": self.code,
            "alt_code": self.alt_code,
            "name": self.name,
            "short_name": self.short_name,
            "native_name": self.native_name,
            "full_name": self.full_name,
            "level": self.level,
            "level_name": self.level_name,
            "location_type": self.location_type,
            "location_mode": self.location_mode,
            "mode_name": self.mode_name,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "status": self.status,
            "is_active": self.status == "active",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": str(self.created_by) if self.created_by else None,
            "updated_by": str(self.updated_by) if self.updated_by else None,
            "display_name": self.display_name,
            "hierarchical_path": self.hierarchical_path,
            "has_children": False,  # Set this separately if needed
            "child_count": 0,
            "gps_coordinates": self.gps_coordinates,
            "gps_geojson": self.gps_geojson,
            "population": self.population,
            "area": self.area,
            "postal_code": self.postal_code,
        }