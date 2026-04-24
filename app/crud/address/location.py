# app/crud/address/location.py

import logging
from typing import Optional, List, Dict, Any, Tuple, Set
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, update, delete, text
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.crud.base import CRUDBase
from app.models.address.location import Location
from app.models.user import User
from app.schemas.address.location import LocationCreate, LocationUpdate

logger = logging.getLogger(__name__)

# ============================================================================
# Constants - Address Mode (Levels 1-7)
# ============================================================================

ADDRESS_LEVELS = {
    1: {"name": "Country", "type": "country", "icon": "🌍", "description": "Sovereign nation"},
    2: {"name": "Region", "type": "region", "icon": "🏛️", "description": "Administrative region"},
    3: {"name": "District", "type": "district", "icon": "🏢", "description": "District or municipality"},
    4: {"name": "County", "type": "county", "icon": "🏘️", "description": "County division"},
    5: {"name": "Subcounty", "type": "subcounty", "icon": "🏠", "description": "Subcounty area"},
    6: {"name": "Parish", "type": "parish", "icon": "⛪", "description": "Parish community"},
    7: {"name": "Village", "type": "village", "icon": "🏡", "description": "Village locality"},
}

# ============================================================================
# Constants - Buildings Mode (Levels 11-14)
# ============================================================================

BUILDINGS_LEVELS = {
    11: {"name": "Office", "type": "office", "icon": "💼", "description": "Office complex or headquarters"},
    12: {"name": "Building", "type": "building", "icon": "🏢", "description": "Individual building structure"},
    13: {"name": "Room", "type": "room", "icon": "🚪", "description": "Room or office space"},
    14: {"name": "Conference", "type": "conference", "icon": "📊", "description": "Conference/meeting facility"},
}

# Building facility types (for location_type in buildings mode)
BUILDING_FACILITY_TYPES = {
    "office": {"name": "Office", "icon": "💼", "level": 11},
    "headquarters": {"name": "Headquarters", "icon": "🏢", "level": 11},
    "branch": {"name": "Branch Office", "icon": "🏛️", "level": 11},
    "building": {"name": "Building", "icon": "🏢", "level": 12},
    "annex": {"name": "Annex Building", "icon": "🏘️", "level": 12},
    "room": {"name": "Room", "icon": "🚪", "level": 13},
    "office_space": {"name": "Office Space", "icon": "💺", "level": 13},
    "conference_room": {"name": "Conference Room", "icon": "📊", "level": 14},
    "meeting_room": {"name": "Meeting Room", "icon": "🤝", "level": 14},
    "training_room": {"name": "Training Room", "icon": "📚", "level": 14},
    "boardroom": {"name": "Boardroom", "icon": "👔", "level": 14},
}

# ============================================================================
# Constants - Common
# ============================================================================

VALID_LOCATION_MODES = ["address", "buildings", "mixed"]
VALID_ADDRESS_TYPES = ["country", "region", "district", "county", "subcounty", "parish", "village"]

VALID_BUILDING_TYPES = list(BUILDING_FACILITY_TYPES.keys())

VALID_LOCATION_TYPES = VALID_ADDRESS_TYPES + VALID_BUILDING_TYPES


MAX_ADDRESS_DEPTH = 7
MAX_BUILDINGS_DEPTH = 14

LEVEL_NAMES = {
    1: "Country",
    2: "Region", 
    3: "District",
    4: "County",
    5: "SubCounty",
    6: "Parish",
    7: "Village",
    11: "Office",
    12: "Building",
    13: "Room",
    14: "Conference"
}

# ============================================================================
# CRUD Class
# ============================================================================

class CRUDLocation(CRUDBase[Location, LocationCreate, LocationUpdate]):
    
    def __init__(self, model):
        super().__init__(model)
        # Cache for frequently accessed locations
        self._code_cache: Dict[str, Location] = {}
        self._id_cache: Dict[UUID, Location] = {}
        self._hierarchy_cache: Dict[str, Any] = {}

    # List of all read-only properties
    READONLY_PROPERTIES: Set[str] = {
        'gps_coordinates',
        'gps_geojson',
        'display_name',
        'display_name_with_mode',
        'display_name_with_code',
        'level_name',
        'mode_name',
        'hierarchical_path',
        'has_gps',
        'is_active',
        'is_address_mode',
        'is_buildings_mode',
        'is_mixed_mode',
        'is_country',
        'is_region',
        'is_district',
        'is_county',
        'is_subcounty',
        'is_parish',
        'is_village',
        'ancestor_ids',
        'bounding_box',
        'gps_coordinates_string',
    }

    # ==================== CACHE MANAGEMENT ====================
    
    def _invalidate_cache(self, location_id: Optional[UUID] = None, code: Optional[str] = None) -> None:
        """Invalidate cache entries"""
        if location_id and location_id in self._id_cache:
            del self._id_cache[location_id]
        if code and code in self._code_cache:
            del self._code_cache[code]
        self._hierarchy_cache.clear()
    
    def _clear_cache(self) -> None:
        """Clear all caches"""
        self._code_cache.clear()
        self._id_cache.clear()
        self._hierarchy_cache.clear()

    # ==================== LOCATION MODE HELPERS ====================
    
    def get_levels_for_mode(self, mode: str = "address") -> Dict[int, Dict]:
        """Get level configuration for a specific mode"""
        if mode == "buildings":
            return BUILDINGS_LEVELS
        return ADDRESS_LEVELS
    
    def get_valid_levels(self, mode: str = "address") -> List[int]:
        """Get valid level numbers for a mode"""
        levels = self.get_levels_for_mode(mode)
        return sorted(levels.keys())
    
    def get_next_level(self, current_level: int, mode: str = "address") -> Optional[int]:
        """Get the next level in hierarchy"""
        valid_levels = self.get_valid_levels(mode)
        try:
            current_index = valid_levels.index(current_level)
            if current_index + 1 < len(valid_levels):
                return valid_levels[current_index + 1]
        except ValueError:
            pass
        return None
    
    def get_previous_level(self, current_level: int, mode: str = "address") -> Optional[int]:
        """Get the previous level in hierarchy"""
        valid_levels = self.get_valid_levels(mode)
        try:
            current_index = valid_levels.index(current_level)
            if current_index > 0:
                return valid_levels[current_index - 1]
        except ValueError:
            pass
        return None
    
    def get_level_info(self, level: int, mode: str = "address") -> Optional[Dict]:
        """Get level information"""
        levels = self.get_levels_for_mode(mode)
        return levels.get(level)
    
    def get_default_level(self, mode: str = "address") -> int:
        """Get default starting level for a mode"""
        if mode == "buildings":
            return 11  # Office level
        return 1  # Country level
    
    def validate_building_type(self, location_type: str) -> bool:
        """Validate building facility type"""
        return location_type in BUILDING_FACILITY_TYPES
    
    def get_building_type_info(self, location_type: str) -> Optional[Dict]:
        """Get building type information"""
        return BUILDING_FACILITY_TYPES.get(location_type)
    
    def get_auto_location_type(self, level: int, mode: str = "address") -> Optional[str]:
        """Get auto-generated location type based on level"""
        level_info = self.get_level_info(level, mode)
        if level_info:
            return level_info["type"]
        return None

    # ==================== BASIC CRUD METHODS ====================
    
    async def get(
        self, 
        db: AsyncSession, 
        id: UUID,
        use_cache: bool = True
    ) -> Optional[Location]:
        """Get location by ID with optional caching"""
        if use_cache and id in self._id_cache:
            return self._id_cache[id]
        
        result = await super().get(db, id)
        if result and use_cache:
            self._id_cache[id] = result
        return result
    
    async def get_by_code(
        self, 
        db: AsyncSession, 
        code: str,
        load_parent: bool = False,
        load_children: bool = False,
        use_cache: bool = True
    ) -> Optional[Location]:
        """Get location by code with optional caching and eager loading"""
        if use_cache and code in self._code_cache:
            return self._code_cache[code]
        
        try:
            query = select(Location).where(Location.code == code)
            
            if load_parent:
                query = query.options(selectinload(Location.parent))
            if load_children:
                query = query.options(selectinload(Location.children))
                
            result = await db.execute(query)
            location = result.scalar_one_or_none()
            
            if location and use_cache:
                self._code_cache[code] = location
                self._id_cache[location.id] = location
                
            return location
        except SQLAlchemyError as e:
            logger.error(f"Error fetching location by code '{code}': {e}")
            return None
    
    async def get_by_level(
        self,
        db: AsyncSession,
        level: int,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False,
        location_mode: Optional[str] = None,
        order_by: str = "name"
    ) -> List[Location]:
        """Get locations by level with filtering and ordering"""
        # Validate level based on mode
        valid_levels = self.get_valid_levels(location_mode or "address")
        if level not in valid_levels:
            logger.error(f"Invalid level: {level} for mode {location_mode}")
            return []
        
        try:
            query = select(Location).where(Location.level == level)
            
            if not include_inactive:
                query = query.where(Location.status == "active")
            if location_mode:
                query = query.where(Location.location_mode == location_mode)
            
            # Apply ordering
            if order_by == "name":
                query = query.order_by(Location.name)
            elif order_by == "code":
                query = query.order_by(Location.code)
            elif order_by == "created_at":
                query = query.order_by(Location.created_at.desc())
            
            query = query.offset(skip).limit(limit)
            result = await db.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching locations by level {level}: {e}")
            return []
    
    async def get_children(
        self,
        db: AsyncSession,
        parent_id: UUID,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False,
        location_mode: Optional[str] = None,
        recursive: bool = False,
        max_depth: Optional[int] = None
    ) -> List[Location]:
        """Get child locations with optional recursive fetching"""
        if recursive:
            return await self._get_descendants_recursive(
                db, parent_id, max_depth or MAX_ADDRESS_DEPTH, include_inactive, location_mode
            )
        
        try:
            query = select(Location).where(Location.parent_id == parent_id)
            
            if not include_inactive:
                query = query.where(Location.status == "active")
            if location_mode:
                query = query.where(Location.location_mode == location_mode)
            
            query = query.offset(skip).limit(limit).order_by(Location.name)
            result = await db.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching children for parent {parent_id}: {e}")
            return []
    
    async def _get_descendants_recursive(
        self,
        db: AsyncSession,
        parent_id: UUID,
        max_depth: int,
        include_inactive: bool,
        location_mode: Optional[str],
        current_depth: int = 0
    ) -> List[Location]:
        """Recursively get all descendants"""
        if current_depth >= max_depth:
            return []
        
        children = await self.get_children(
            db, parent_id, 0, 1000, include_inactive, location_mode
        )
        
        descendants = list(children)
        for child in children:
            sub_descendants = await self._get_descendants_recursive(
                db, child.id, max_depth, include_inactive, location_mode, current_depth + 1
            )
            descendants.extend(sub_descendants)
        
        return descendants
    
    async def search(
        self,
        db: AsyncSession,
        query: str,
        level: Optional[int] = None,
        location_mode: Optional[str] = None,
        location_type: Optional[str] = None,
        parent_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 50,
        include_inactive: bool = False,
        exact_match: bool = False
    ) -> List[Location]:
        """Enhanced search with multiple criteria"""
        if not query or len(query.strip()) < 2:
            return []
        
        try:
            search_pattern = f"%{query}%" if not exact_match else query
            
            conditions = []
            for field in ['name', 'code', 'short_name', 'native_name', 'full_name', 'alt_code']:
                if hasattr(Location, field):
                    if exact_match:
                        conditions.append(getattr(Location, field) == search_pattern)
                    else:
                        conditions.append(getattr(Location, field).ilike(search_pattern))
            
            stmt = select(Location).where(or_(*conditions))
            
            if not include_inactive:
                stmt = stmt.where(Location.status == "active")
            if level:
                stmt = stmt.where(Location.level == level)
            if location_mode:
                stmt = stmt.where(Location.location_mode == location_mode)
            if location_type:
                stmt = stmt.where(Location.location_type == location_type)
            if parent_id:
                stmt = stmt.where(Location.parent_id == parent_id)
                
            stmt = stmt.offset(skip).limit(limit).order_by(Location.name)
            result = await db.execute(stmt)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error searching locations with query '{query}': {e}")
            return []
    
    async def count(
        self,
        db: AsyncSession,
        include_inactive: bool = False,
        location_mode: Optional[str] = None,
        level: Optional[int] = None,
        parent_id: Optional[UUID] = None
    ) -> int:
        """Count locations with multiple filters"""
        try:
            query = select(func.count()).select_from(Location)
            
            if not include_inactive:
                query = query.where(Location.status == "active")
            if location_mode:
                query = query.where(Location.location_mode == location_mode)
            if level:
                query = query.where(Location.level == level)
            if parent_id:
                query = query.where(Location.parent_id == parent_id)
                
            result = await db.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting locations: {e}")
            return 0
    
    async def count_children(
        self,
        db: AsyncSession,
        location_id: UUID,
        include_inactive: bool = False,
        location_mode: Optional[str] = None,
        recursive: bool = False
    ) -> int:
        """Count child locations"""
        if recursive:
            max_depth = MAX_ADDRESS_DEPTH if location_mode != "buildings" else MAX_BUILDINGS_DEPTH
            descendants = await self._get_descendants_recursive(
                db, location_id, max_depth, include_inactive, location_mode
            )
            return len(descendants)
        
        try:
            query = select(func.count()).select_from(Location).where(
                Location.parent_id == location_id
            )
            if not include_inactive:
                query = query.where(Location.status == "active")
            if location_mode:
                query = query.where(Location.location_mode == location_mode)
            result = await db.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting children for {location_id}: {e}")
            return 0

    def _clean_location_data(self, data: dict) -> dict:
        """Remove read-only properties and handle None values"""
        for prop in self.READONLY_PROPERTIES:
            data.pop(prop, None)
        
        optional_fields = ['alt_code', 'short_name', 'native_name', 'full_name', 
                          'location_type', 'postal_code', 'extra_metadata', 'gps_data',
                          'latitude', 'longitude', 'population', 'area', 'density']
        for field in optional_fields:
            if field in data and data[field] is None:
                data.pop(field)
        
        return data

    # ==================== CREATE/UPDATE/DELETE ====================

    async def create(
        self,
        db: AsyncSession,
        obj_in: LocationCreate,
        user: Optional[User] = None
    ) -> Optional[Location]:
        """Create a new location with validation"""
        try:
            # Validate location_mode
            if obj_in.location_mode and obj_in.location_mode not in VALID_LOCATION_MODES:
                logger.error(f"Invalid location_mode: {obj_in.location_mode}")
                return None
            
            # Set default location_mode
            if not obj_in.location_mode:
                obj_in.location_mode = "address"
            
            # Auto-set level if not provided
            if not obj_in.level:
                obj_in.level = self.get_default_level(obj_in.location_mode)
            
            # Validate level is appropriate for mode
            valid_levels = self.get_valid_levels(obj_in.location_mode)
            if obj_in.level not in valid_levels:
                logger.error(f"Invalid level {obj_in.level} for mode {obj_in.location_mode}")
                return None
            
            # Auto-set location_type based on level if not provided
            if not obj_in.location_type:
                obj_in.location_type = self.get_auto_location_type(obj_in.level, obj_in.location_mode)
            
            # Validate building type if in buildings mode
            if obj_in.location_mode == "buildings" and obj_in.location_type:
                if not self.validate_building_type(obj_in.location_type):
                    logger.warning(f"Unknown building type: {obj_in.location_type}")
            
            # Auto-calculate level from parent
            if obj_in.parent_id:
                parent_result = await db.execute(
                    select(Location).where(Location.id == obj_in.parent_id)
                )
                parent = parent_result.scalar_one_or_none()
                
                if parent:
                    next_level = self.get_next_level(parent.level, parent.location_mode)
                    if next_level:
                        obj_in.level = next_level
                        obj_in.location_mode = parent.location_mode
                        obj_in.location_type = self.get_auto_location_type(next_level, parent.location_mode)
                else:
                    logger.error(f"Parent location {obj_in.parent_id} not found")
                    return None
            
            # Convert to dictionary and clean
            location_data = obj_in.model_dump(exclude_unset=False)
            location_data = self._clean_location_data(location_data)
            
            # Add user audit fields
            if user:
                location_data["created_by"] = user.id
            
            # Create location
            location = Location(**location_data)
            db.add(location)
            await db.commit()
            await db.refresh(location)
            
            # Expunge from session
            db.expunge(location)
            
            # Invalidate cache
            self._invalidate_cache()
            
            logger.info(f"✅ Created location: {location.code} - {location.name} (Level {location.level})")
            return location
            
        except IntegrityError as e:
            await db.rollback()
            logger.error(f"Integrity error creating location: {e}")
            return None
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error creating location: {e}")
            return None

    async def update(
        self,
        db: AsyncSession,
        db_obj: Location,
        obj_in: LocationUpdate,
        user: Optional[User] = None
    ) -> Optional[Location]:
        """Update a location with validation"""
        try:
            update_data = obj_in.model_dump(exclude_unset=True)
            update_data = self._clean_location_data(update_data)
            
            # Validate location_mode
            if "location_mode" in update_data:
                if update_data["location_mode"] not in VALID_LOCATION_MODES:
                    logger.error(f"Invalid location_mode: {update_data['location_mode']}")
                    return None
            
            # Validate level change
            if "level" in update_data:
                valid_levels = self.get_valid_levels(update_data.get("location_mode", db_obj.location_mode))
                if update_data["level"] not in valid_levels:
                    logger.error(f"Invalid level {update_data['level']}")
                    return None
            
            # Apply updates
            for field, value in update_data.items():
                if value is not None:
                    setattr(db_obj, field, value)
            
            if user:
                db_obj.updated_by = user.id
            
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            
            # Invalidate cache
            self._invalidate_cache(db_obj.id, db_obj.code)
            
            logger.info(f"✅ Updated location: {db_obj.code} - {db_obj.name}")
            return db_obj
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error updating location: {e}")
            return None

    async def remove(
        self,
        db: AsyncSession,
        id: UUID,
        soft_delete: bool = True
    ) -> Optional[Location]:
        """Remove a location (soft or hard delete)"""
        try:
            location = await self.get(db, id)
            if not location:
                return None
            
            # Check for children
            child_count = await self.count_children(db, id)
            if child_count > 0:
                logger.warning(f"Cannot delete location {id} - has {child_count} children")
                return None
            
            if soft_delete:
                location.status = "archived"
                db.add(location)
                await db.commit()
                await db.refresh(location)
                logger.info(f"✅ Soft deleted location: {location.code}")
            else:
                await db.delete(location)
                await db.commit()
                logger.info(f"✅ Hard deleted location: {location.code}")
            
            self._invalidate_cache(id, location.code)
            return location
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error removing location: {e}")
            return None

    async def get_ancestors(
        self,
        db: AsyncSession,
        location_id: UUID,
        include_self: bool = False
    ) -> List[Location]:
        """Get all ancestors of a location"""
        try:
            ancestors = []
            current = await self.get(db, location_id)
            
            if include_self and current:
                ancestors.append(current)
            
            while current and current.parent_id:
                parent = await self.get(db, current.parent_id)
                if parent:
                    ancestors.insert(0 if not include_self else 0, parent)
                    current = parent
                else:
                    break
            
            return ancestors
        except SQLAlchemyError as e:
            logger.error(f"Error fetching ancestors for {location_id}: {e}")
            return []
    
    async def get_descendants(
        self,
        db: AsyncSession,
        location_id: UUID,
        max_depth: Optional[int] = None,
        include_self: bool = False
    ) -> List[Location]:
        """Get all descendants of a location"""
        try:
            location = await self.get(db, location_id)
            if not location:
                return []
            
            max_depth = max_depth or (MAX_ADDRESS_DEPTH if location.location_mode != "buildings" else MAX_BUILDINGS_DEPTH)
            
            descendants = []
            if include_self:
                descendants.append(location)
            
            children = await self.get_children(db, location_id, limit=1000)
            for child in children:
                descendants.append(child)
                sub_descendants = await self.get_descendants(
                    db, child.id, max_depth - 1 if max_depth > 1 else 0
                )
                descendants.extend(sub_descendants)
            
            return descendants
        except SQLAlchemyError as e:
            logger.error(f"Error fetching descendants for {location_id}: {e}")
            return []
    
    async def get_breadcrumb(
        self,
        db: AsyncSession,
        location_id: UUID
    ) -> List[Dict[str, Any]]:
        """Get breadcrumb trail"""
        try:
            ancestors = await self.get_ancestors(db, location_id)
            location = await self.get(db, location_id)
            
            breadcrumb = []
            for anc in ancestors:
                breadcrumb.append({
                    "id": str(anc.id),
                    "code": anc.code,
                    "name": anc.name,
                    "level": anc.level,
                    "level_name": anc.level_name,
                    "location_mode": anc.location_mode
                })
            
            if location:
                breadcrumb.append({
                    "id": str(location.id),
                    "code": location.code,
                    "name": location.name,
                    "level": location.level,
                    "level_name": location.level_name,
                    "location_mode": location.location_mode
                })
            
            return breadcrumb
        except SQLAlchemyError as e:
            logger.error(f"Error getting breadcrumb for {location_id}: {e}")
            return []
    

    async def get_tree(
        self,
        db: AsyncSession,
        root_id: Optional[UUID] = None,
        max_depth: int = 7,
        location_mode: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get location hierarchy tree"""
        
        if root_id:
            # Start from specific root
            root_result = await db.execute(
                select(Location).where(
                    Location.id == root_id,
                    Location.is_active == True
                )
            )
            root = root_result.scalar_one_or_none()
            if not root:
                return []
            
            # Build tree from this root
            node = await self._build_tree_node(db, root, max_depth, 1, location_mode)
            return [node] if node else []
        else:
            # Get all top-level locations
            # Determine first level based on mode
            if location_mode == "buildings":
                first_level = 11
            else:
                first_level = 1
            
            filter_conditions = [
                Location.is_active == True,
                Location.level == first_level
            ]
            
            if location_mode:
                filter_conditions.append(Location.location_mode == location_mode)
            
            root_result = await db.execute(
                select(Location)
                .where(and_(*filter_conditions))
                .order_by(Location.name)
            )
            roots = root_result.scalars().all()
            
            # Build tree for each root
            tree = []
            for root in roots:
                node = await self._build_tree_node(db, root, max_depth, 1, location_mode)
                if node:
                    tree.append(node)
            
            return tree

    async def _build_tree_node(
        self,
        db: AsyncSession,
        location: Location,
        max_depth: int,
        current_depth: int,
        location_mode: Optional[str] = None
    ) -> Dict[str, Any]:
        """Recursively build a tree node"""
        
        node = {
            "id": str(location.id),
            "name": location.name,
            "code": location.code,
            "level": location.level,
            "location_mode": location.location_mode,
            "location_type": location.location_type,
            "children": []
        }
        
        # Add children if within depth limit
        if current_depth < max_depth:
            # Build filter conditions for children
            filter_conditions = [
                Location.parent_id == location.id,
                Location.is_active == True
            ]
            
            if location_mode:
                filter_conditions.append(Location.location_mode == location_mode)
            
            children_result = await db.execute(
                select(Location)
                .where(and_(*filter_conditions))
                .order_by(Location.name)
            )
            children = children_result.scalars().all()
            
            for child in children:
                child_node = await self._build_tree_node(
                    db, child, max_depth, current_depth + 1, location_mode
                )
                if child_node:
                    node["children"].append(child_node)
        
        return node

    # app/crud/address/location.py

    async def get_statistics(self, db: AsyncSession) -> Dict[str, Any]:
        """Get comprehensive location statistics"""
        try:
            stats = {
                "total": await self.count(db),
                "by_level": {},
                "by_mode": {},
                "by_type": {},
                "by_status": {},
                "with_gps": 0,
                "total_population": 0,
                "total_area": 0
            }
            
            # Count by level (Address levels 1-7)
            for level in range(1, 8):
                count = await self.count(db, level=level)
                if count > 0:
                    stats["by_level"][LEVEL_NAMES.get(level, f"Level {level}")] = count
            
            # Count by level (Buildings levels 11-14)
            for level in [11, 12, 13, 14]:
                count = await self.count(db, level=level)
                if count > 0:
                    level_name = {11: "Office", 12: "Building", 13: "Room", 14: "Conference"}.get(level, f"Level {level}")
                    stats["by_level"][level_name] = count
            
            # Count by mode
            for mode in VALID_LOCATION_MODES:
                stats["by_mode"][mode] = await self.count(db, location_mode=mode)
            
            # Count by type
            for loc_type in VALID_LOCATION_TYPES:
                query = select(func.count()).select_from(Location).where(Location.location_type == loc_type)
                result = await db.execute(query)
                count = result.scalar() or 0
                if count > 0:
                    stats["by_type"][loc_type] = count
            
            # Count by status
            for status in ['active', 'inactive', 'archived']:
                query = select(func.count()).select_from(Location).where(Location.status == status)
                result = await db.execute(query)
                stats["by_status"][status] = result.scalar() or 0
            
            # Count locations with GPS - FIX: Use the column name, not the property
            # The column names are '_latitude' and '_longitude' in the model
            query = select(func.count()).select_from(Location).where(
                Location._latitude.isnot(None),  # Use _latitude, not latitude
                Location._longitude.isnot(None)   # Use _longitude, not longitude
            )
            result = await db.execute(query)
            stats["with_gps"] = result.scalar() or 0
            
            # Sum population and area
            query = select(func.sum(Location.population), func.sum(Location.area))
            result = await db.execute(query)
            total_pop, total_area = result.first()
            stats["total_population"] = total_pop or 0
            stats["total_area"] = total_area or 0
            
            return stats
        except SQLAlchemyError as e:
            logger.error(f"Error getting statistics: {e}")
            return {}

    async def count_by_mode(self, db: AsyncSession, mode: str) -> int:
        """Count locations by mode"""
        return await self.count(db, location_mode=mode)
    
    async def get_by_code_as_dict(
        self, 
        db: AsyncSession, 
        code: str
    ) -> Optional[dict]:
        """Get location by code and return as dictionary (session-safe)."""
        try:
            query = select(Location).where(Location.code == code).options(
                selectinload(Location.parent),
                selectinload(Location.children)
            )
            
            result = await db.execute(query)
            location = result.scalar_one_or_none()
            
            if not location:
                return None
            
            return location.to_dict()
            
        except SQLAlchemyError as e:
            logger.error(f"Error fetching location by code '{code}': {e}")
            return None
    
    # ==================== CTE HIERARCHY QUERIES ====================
    
    async def get_location_hierarchy_cte(
        self,
        db: AsyncSession,
        root_id: Optional[UUID] = None,
        location_mode: Optional[str] = None,
        max_depth: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Get location hierarchy using recursive CTE
        Returns parent-to-child tree structure
        """
        try:
            mode_filter = f"AND location_mode = '{location_mode}'" if location_mode else ""
            root_filter = f"AND id = '{root_id}'" if root_id else ""
            
            cte_query = f"""
            WITH RECURSIVE location_hierarchy AS (
                -- Anchor: Root nodes
                SELECT 
                    id,
                    code,
                    name,
                    level,
                    location_type,
                    location_mode,
                    parent_id,
                    status,
                    ARRAY[id] as path,
                    1 as depth,
                    name as tree_label
                FROM locations
                WHERE (parent_id IS NULL OR level = 1 OR level = 11)
                {mode_filter}
                {root_filter}
                
                UNION ALL
                
                -- Recursive: Children
                SELECT 
                    l.id,
                    l.code,
                    l.name,
                    l.level,
                    l.location_type,
                    l.location_mode,
                    l.parent_id,
                    l.status,
                    h.path || l.id,
                    h.depth + 1,
                    REPEAT('  ', h.depth) || l.name as tree_label
                FROM locations l
                INNER JOIN location_hierarchy h ON l.parent_id = h.id
                WHERE h.depth < {max_depth}
            )
            SELECT 
                id,
                code,
                name,
                level,
                location_type,
                location_mode,
                status,
                depth,
                tree_label,
                array_to_string(ARRAY(
                    SELECT name FROM locations 
                    WHERE id = ANY(path) 
                    ORDER BY level
                ), ' > ') as breadcrumb
            FROM location_hierarchy
            ORDER BY path;
            """
            
            result = await db.execute(text(cte_query))
            rows = result.fetchall()
            
            hierarchy = []
            for row in rows:
                hierarchy.append({
                    "id": str(row.id),
                    "code": row.code,
                    "name": row.name,
                    "level": row.level,
                    "location_type": row.location_type,
                    "location_mode": row.location_mode,
                    "status": row.status,
                    "depth": row.depth,
                    "tree_label": row.tree_label,
                    "breadcrumb": row.breadcrumb
                })
            
            return hierarchy
            
        except Exception as e:
            logger.error(f"Error getting location hierarchy: {e}")
            return []


# Create singleton instance
location = CRUDLocation(Location)