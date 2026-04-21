# app/crud/address/location.py

import logging
from typing import Optional, List, Dict, Any, Tuple, Set
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, update, delete
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.crud.base import CRUDBase
from app.models.address.location import Location
from app.models.user import User
from app.schemas.address.location import LocationCreate, LocationUpdate

logger = logging.getLogger(__name__)

# Constants
VALID_LOCATION_MODES = ["address", "buildings", "mixed"]
VALID_LOCATION_TYPES = ["country", "region", "district", "county", "subcounty", "parish", "village", "building"]
LEVEL_NAMES = {
    1: "Country",
    2: "Region", 
    3: "District",
    4: "County",
    5: "SubCounty",
    6: "Parish",
    7: "Village"
}
MAX_DEPTH = 7


class CRUDLocation(CRUDBase[Location, LocationCreate, LocationUpdate]):
    
    def __init__(self, model):
        super().__init__(model)
        # Cache for frequently accessed locations
        self._code_cache: Dict[str, Location] = {}
        self._id_cache: Dict[UUID, Location] = {}

    # List of all read-only properties that should never be passed to the constructor
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
    
    def _clear_cache(self) -> None:
        """Clear all caches"""
        self._code_cache.clear()
        self._id_cache.clear()

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
    
    async def get_by_ids(
        self,
        db: AsyncSession,
        ids: List[UUID],
        use_cache: bool = True
    ) -> List[Location]:
        """Get multiple locations by IDs"""
        if not ids:
            return []
        
        # Check cache first
        if use_cache:
            cached_locations = [self._id_cache.get(id) for id in ids if id in self._id_cache]
            missing_ids = [id for id in ids if id not in self._id_cache]
            
            if not missing_ids:
                return [loc for loc in cached_locations if loc is not None]
            
            # Fetch missing ones
            try:
                query = select(Location).where(Location.id.in_(missing_ids))
                result = await db.execute(query)
                fetched = result.scalars().all()
                
                # Update cache
                for loc in fetched:
                    self._id_cache[loc.id] = loc
                
                # Combine cached and fetched
                all_locations = [self._id_cache.get(id) for id in ids]
                return [loc for loc in all_locations if loc is not None]
            except SQLAlchemyError as e:
                logger.error(f"Error fetching locations by IDs: {e}")
                return [loc for loc in cached_locations if loc is not None]
        
        # No cache, fetch all
        try:
            query = select(Location).where(Location.id.in_(ids))
            result = await db.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching locations by IDs: {e}")
            return []
    
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
        if not 1 <= level <= MAX_DEPTH:
            logger.error(f"Invalid level: {level}")
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
                db, parent_id, max_depth or MAX_DEPTH, include_inactive, location_mode
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
    
    async def get_by_location_type(
        self,
        db: AsyncSession,
        location_type: str,
        skip: int = 0,
        limit: int = 100,
        location_mode: Optional[str] = None,
        include_inactive: bool = False
    ) -> List[Location]:
        """Get locations by type with mode filtering"""
        if location_type not in VALID_LOCATION_TYPES:
            logger.warning(f"Invalid location_type: {location_type}")
        
        try:
            query = select(Location).where(Location.location_type == location_type)
            
            if not include_inactive:
                query = query.where(Location.status == "active")
            if location_mode:
                query = query.where(Location.location_mode == location_mode)
            
            query = query.offset(skip).limit(limit).order_by(Location.name)
            result = await db.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching locations by type '{location_type}': {e}")
            return []
    
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
            descendants = await self._get_descendants_recursive(
                db, location_id, MAX_DEPTH, include_inactive, location_mode
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
        # Remove read-only properties
        for prop in self.READONLY_PROPERTIES:
            data.pop(prop, None)
        
        # Remove None values for optional fields
        optional_fields = ['alt_code', 'short_name', 'native_name', 'full_name', 
                          'location_type', 'postal_code', 'extra_metadata', 'gps_data',
                          'latitude', 'longitude', 'population', 'area', 'density']
        for field in optional_fields:
            if field in data and data[field] is None:
                data.pop(field)
        
        return data


# app/crud/address/location.py

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
            
            # Set default location_mode if not provided
            if not obj_in.location_mode:
                obj_in.location_mode = "address"
            
            # Auto-calculate level from parent
            if obj_in.parent_id:
                # Get parent within the same session
                parent_result = await db.execute(
                    select(Location).where(Location.id == obj_in.parent_id)
                )
                parent = parent_result.scalar_one_or_none()
                
                if parent:
                    obj_in.level = parent.level + 1
                    if not obj_in.location_mode:
                        obj_in.location_mode = parent.location_mode
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
            
            # Expunge from session to avoid detachment issues later
            db.expunge(location)
            
            logger.info(f"✅ Created location: {location.code} - {location.name}")
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
            
            # Validate level change doesn't break hierarchy
            if "level" in update_data and update_data["level"] != db_obj.level:
                if db_obj.children:
                    logger.error(f"Cannot change level of location with children")
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
                # Soft delete
                location.status = "archived"
                db.add(location)
                await db.commit()
                await db.refresh(location)
                logger.info(f"✅ Soft deleted location: {location.code}")
            else:
                # Hard delete
                await db.delete(location)
                await db.commit()
                logger.info(f"✅ Hard deleted location: {location.code}")
            
            # Invalidate cache
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
            max_depth = max_depth or MAX_DEPTH
            
            descendants = []
            if include_self:
                location = await self.get(db, location_id)
                if location:
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
            
            # Count by level
            for level in range(1, MAX_DEPTH + 1):
                count = await self.count(db, level=level)
                if count > 0:
                    stats["by_level"][LEVEL_NAMES.get(level, f"Level {level}")] = count
            
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
            
            # Count locations with GPS
            query = select(func.count()).select_from(Location).where(
                Location.latitude.isnot(None),
                Location.longitude.isnot(None)
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
            # Eagerly load any relationships you might need
            from sqlalchemy.orm import selectinload
            
            query = select(Location).where(Location.code == code).options(
                selectinload(Location.parent),
                selectinload(Location.children)
            )
            
            result = await db.execute(query)
            location = result.scalar_one_or_none()
            
            if not location:
                return None
            
            # Convert to dict while session is still active
            return location.to_dict()
            
        except SQLAlchemyError as e:
            logger.error(f"Error fetching location by code '{code}': {e}")
            return None
        
# Create singleton instance
location = CRUDLocation(Location)