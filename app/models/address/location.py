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
        {'extend_existing': True}
    )
    
    # ==================== PRIMARY IDENTIFIERS ====================
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4, index=True)
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
    
    # ==================== STATUS ====================
    status = Column(String(20), default="active", index=True)
    
    # ==================== GPS DATA ====================
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    gps_data = Column(JSON, default=dict, nullable=True)
    
    # ==================== DEMOGRAPHIC DATA ====================
    population = Column(Integer, nullable=True)
    area = Column(Float, nullable=True)
    density = Column(Float, nullable=True)
    
    # ==================== POSTAL DATA ====================
    postal_code = Column(String(20), nullable=True)
    
    # ==================== METADATA ====================
    extra_metadata = Column(JSON, default=dict)
    
    # ==================== AUDIT FIELDS ====================
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(CustomUUID, nullable=True)
    updated_by = Column(CustomUUID, nullable=True)
    
    # ==================== RELATIONSHIPS ====================
    parent = relationship(
        "Location",
        remote_side=[id],
        back_populates="children",
        lazy="noload",   # we never need parent object, just parent_id
        foreign_keys=[parent_id],
    )
    children = relationship(
        "Location",
        back_populates="parent",
        lazy="noload",   # never auto-load — prevents the greenlet error entirely
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
    
    # ==================== PROPERTIES ====================
    
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
    def display_name_with_code(self) -> str:
        return f"{self.name} ({self.code})"
    
    @property
    def hierarchical_path(self) -> str:
        """Get full hierarchical path - safe without lazy loading"""
        try:
            if self.parent_id and hasattr(self, '_parent'):
                return f"{self.parent.hierarchical_path} > {self.name}"
            return self.name
        except Exception:
            return self.name
    
    @property
    def ancestor_ids(self) -> List[UUID]:
        """Get list of ancestor IDs - requires explicit query"""
        # This should not be a property that triggers lazy loading
        # Move this logic to the CRUD layer
        return []
    
    @property
    def has_gps(self) -> bool:
        return self.latitude is not None and self.longitude is not None
    
    @property
    def gps_coordinates(self) -> Optional[Dict[str, Any]]:
        if self.has_gps:
            return {
                "latitude": self.latitude,
                "longitude": self.longitude,
                "altitude": self.gps_data.get("altitude") if self.gps_data else None
            }
        return None
    
    @property
    def gps_geojson(self) -> Optional[Dict[str, Any]]:
        if self.has_gps:
            return {
                "type": "Point",
                "coordinates": [float(self.longitude), float(self.latitude)]
            }
        return None
    
    @property
    def bounding_box(self) -> Optional[Dict[str, Any]]:
        if self.gps_data and "bounding_box" in self.gps_data:
            return self.gps_data["bounding_box"]
        return None
    
    # Remove properties that trigger lazy loading
    # child_count and has_children should be handled in CRUD or via explicit queries
    
    @property
    def is_active(self) -> bool:
        return self.status == "active"
    
    # ==================== METHODS ====================
    
    def set_gps(self, latitude: Union[float, str], longitude: Union[float, str], altitude: Optional[float] = None, **kwargs) -> None:
        self.latitude = float(latitude)
        self.longitude = float(longitude)
        
        if self.gps_data is None:
            self.gps_data = {}
        
        self.gps_data.update({
            "latitude": self.latitude,
            "longitude": self.longitude,
            "altitude": altitude,
            "timestamp": datetime.now().isoformat(),
            **kwargs
        })
    
    def set_bounding_box(self, min_lat: float, max_lat: float, min_lon: float, max_lon: float) -> None:
        if self.gps_data is None:
            self.gps_data = {}
        
        self.gps_data["bounding_box"] = {
            "min_latitude": min_lat,
            "max_latitude": max_lat,
            "min_longitude": min_lon,
            "max_longitude": max_lon
        }
    
    def get_gps_center(self) -> Optional[tuple]:
        if self.bounding_box:
            bb = self.bounding_box
            center_lat = (bb["min_latitude"] + bb["max_latitude"]) / 2
            center_lon = (bb["min_longitude"] + bb["max_longitude"]) / 2
            return (center_lat, center_lon)
        elif self.has_gps:
            return (self.latitude, self.longitude)
        return None
    
    def activate(self) -> None:
        self.status = "active"
    
    def deactivate(self) -> None:
        self.status = "inactive"
    
    def archive(self) -> None:
        self.status = "archived"
    
    def to_dict(self, include_children: bool = False, depth: int = 1, max_depth: int = 2) -> Dict[str, Any]:
        """Convert to dictionary - does not include child_count to avoid lazy loading"""
        result = {
            "id": str(self.id),
            "code": self.code,
            "alt_code": self.alt_code,
            "name": self.name,
            "short_name": self.short_name,
            "native_name": self.native_name,
            "full_name": self.full_name,
            "level": self.level,
            "level_name": self.level_name,
            "location_type": self.location_type,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "hierarchical_path": self.hierarchical_path,
            "display_name": self.display_name,
            "gps": self.gps_coordinates,
            "gps_geojson": self.gps_geojson,
            "bounding_box": self.bounding_box,
            "population": self.population,
            "area": self.area,
            "density": self.density,
            "postal_code": self.postal_code,
            "status": self.status,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        
        # Only include children if explicitly requested and we're in a sync context
        # For async, children should be loaded via selectinload or explicit query
        if include_children and hasattr(self, '_children_loaded') and self.children and depth < max_depth:
            result["children"] = [
                child.to_dict(include_children=True, depth=depth + 1, max_depth=max_depth)
                for child in self.children
                if child.status == "active"
            ]
        
        return result
    
    def to_brief_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "code": self.code,
            "name": self.name,
            "short_name": self.short_name,
            "level": self.level,
            "level_name": self.level_name,
            "location_type": self.location_type,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "status": self.status,
        }
    
    def __repr__(self) -> str:
        """Safe string representation that works with detached instances"""
        try:
            data = getattr(self, '__dict__', {})
            code = data.get('code', getattr(self, 'code', None))
            name = data.get('name', getattr(self, 'name', None))
            level = data.get('level', getattr(self, 'level', None))
            
            if code and name and level:
                return f"<Location {code}: {name} (Level {level})>"
            elif code:
                return f"<Location {code}>"
            else:
                obj_id = getattr(self, 'id', None)
                return f"<Location {obj_id}>" if obj_id else f"<Location at {hex(id(self))}>"
        except Exception:
            return f"<Location at {hex(id(self))}>"
    
    def __str__(self) -> str:
        return self.display_name