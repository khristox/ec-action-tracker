# app/crud/address/location.py

"""
Location CRUD operations
"""

from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, delete, update
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.crud.base import CRUDBase
from app.models.address.location import Location
from app.models.user import User
from app.schemas.address.location import LocationCreate, LocationUpdate
import logging

logger = logging.getLogger(__name__)


class CRUDLocation(CRUDBase[Location, LocationCreate, LocationUpdate]):
    
    def __init__(self, model):
        super().__init__(model)

    def _apply_exclude_deleted(self, query, include_deleted: bool = False):
        """Location uses status column, not a boolean is_active field."""
        if not include_deleted:
            query = query.where(Location.status == "active")
        return query

    # ==================== BASIC CRUD ====================
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[Location]:
        """Get location by ID"""
        try:
            result = await db.execute(
                select(Location).where(Location.id == id)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching location by ID {id}: {e}")
            return None
    
    async def get_by_code(
        self, 
        db: AsyncSession, 
        code: str,
        load_parent: bool = False,
        load_children: bool = False
    ) -> Optional[Location]:
        """Get location by code"""
        try:
            query = select(Location).where(Location.code == code)
            if load_parent:
                query = query.options(selectinload(Location.parent))
            if load_children:
                query = query.options(selectinload(Location.children))
                
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching location by code '{code}': {e}")
            return None
    
    async def get_by_level(
        self,
        db: AsyncSession,
        level: int,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False
    ) -> List[Location]:
        """Get locations by level"""
        try:
            query = select(Location).where(Location.level == level)
            if not include_inactive:
                query = query.where(Location.status == "active")
            query = query.offset(skip).limit(limit).order_by(Location.name)
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
        include_inactive: bool = False
    ) -> List[Location]:
        """Get child locations"""
        try:
            query = select(Location).where(Location.parent_id == parent_id)
            if not include_inactive:
                query = query.where(Location.status == "active")
            query = query.offset(skip).limit(limit).order_by(Location.name)
            result = await db.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching children for parent {parent_id}: {e}")
            return []
    
    # ==================== TREE OPERATIONS ====================
    
   # app/crud/address/location.py

    async def get_tree(
        self,
        db: AsyncSession,
        root_id: Optional[UUID] = None,
        max_depth: int = 7,
        current_depth: int = 0
    ) -> List[Dict[str, Any]]:
        """Get location tree - returns dictionaries, NOT ORM objects"""
        try:
            if current_depth >= max_depth:
                return []
            
            # Query locations at current level
            if root_id:
                query = select(Location).where(Location.id == root_id)
            else:
                query = select(Location).where(Location.parent_id.is_(None))
            
            result = await db.execute(query)
            locations = result.scalars().all()
            
            tree = []
            for loc in locations:
                # Get child count
                child_count = await self._get_child_count(db, loc.id)
                
                # Build node as dictionary - NO ORM OBJECTS
                node = {
                    "id": str(loc.id),
                    "code": loc.code,
                    "name": loc.name,
                    "level": loc.level,
                    "level_name": loc.level_name,
                    "location_type": loc.location_type,
                    "parent_id": str(loc.parent_id) if loc.parent_id else None,
                    "status": loc.status,
                    "created_at": loc.created_at.isoformat() if loc.created_at else None,
                    "updated_at": loc.updated_at.isoformat() if loc.updated_at else None,
                    "created_by": str(loc.created_by) if loc.created_by else None,
                    "updated_by": str(loc.updated_by) if loc.updated_by else None,
                    "display_name": f"{loc.name} ({loc.level_name})",
                    "hierarchical_path": loc.name,
                    "child_count": child_count,
                    "has_children": child_count > 0,
                    "children": []
                }
                
                # Recursively get children
                if child_count > 0 and current_depth + 1 < max_depth:
                    node["children"] = await self.get_tree(
                        db, root_id=loc.id, max_depth=max_depth, current_depth=current_depth + 1
                    )
                
                tree.append(node)
            
            return tree
        except SQLAlchemyError as e:
            logger.error(f"Error building location tree: {e}")
            return []


    async def _get_child_count(self, db: AsyncSession, location_id: UUID) -> int:
        """Get child count - lightweight query"""
        try:
            result = await db.execute(
                select(func.count())
                .select_from(Location)
                .where(Location.parent_id == location_id)
            )
            return result.scalar() or 0
        except SQLAlchemyError:
            return 0
    
    
    def _location_to_dict(self, location: Location) -> Dict[str, Any]:
        """Convert location ORM object to dictionary safely"""
        return {
            "id": str(location.id),
            "code": location.code,
            "name": location.name,
            "level": location.level,
            "level_name": location.level_name,
            "location_type": location.location_type,
            "parent_id": str(location.parent_id) if location.parent_id else None,
            "status": location.status,
            "created_at": location.created_at.isoformat() if location.created_at else None,
            "updated_at": location.updated_at.isoformat() if location.updated_at else None,
            "created_by": str(location.created_by) if location.created_by else None,
            "updated_by": str(location.updated_by) if location.updated_by else None,
            "display_name": f"{location.name} ({location.level_name})",
            "hierarchical_path": location.name,
        }
    
    async def get_tree_nodes(
        self,
        db: AsyncSession,
        parent_id: Optional[UUID] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get tree nodes for a specific parent (pagination-friendly)"""
        try:
            query = select(Location).where(Location.parent_id == parent_id)
            query = query.offset(offset).limit(limit).order_by(Location.name)
            result = await db.execute(query)
            locations = result.scalars().all()
            
            nodes = []
            for loc in locations:
                child_count = await self._get_child_count(db, loc.id)
                node = self._location_to_dict(loc)
                node["child_count"] = child_count
                node["has_children"] = child_count > 0
                nodes.append(node)
            
            return nodes
        except SQLAlchemyError as e:
            logger.error(f"Error fetching tree nodes: {e}")
            return []
    
    # ==================== HIERARCHY OPERATIONS ====================
    
    async def get_ancestors(
        self,
        db: AsyncSession,
        location_id: UUID
    ) -> List[Location]:
        """Get all ancestors of a location"""
        try:
            ancestors = []
            current = await self.get(db, location_id)
            
            while current and current.parent_id:
                parent = await self.get(db, current.parent_id)
                if parent:
                    ancestors.insert(0, parent)
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
        depth: Optional[int] = None
    ) -> List[Location]:
        """Get all descendants of a location (recursive)"""
        try:
            descendants = []
            children = await self.get_children(db, location_id, limit=1000)
            
            for child in children:
                descendants.append(child)
                if depth is None or depth > 1:
                    sub_descendants = await self.get_descendants(
                        db, child.id, 
                        depth - 1 if depth else None
                    )
                    descendants.extend(sub_descendants)
            
            return descendants
        except SQLAlchemyError as e:
            logger.error(f"Error fetching descendants for {location_id}: {e}")
            return []
    
    async def get_hierarchical_path(
        self,
        db: AsyncSession,
        location_id: UUID,
        separator: str = " > "
    ) -> str:
        """Get hierarchical path string"""
        try:
            ancestors = await self.get_ancestors(db, location_id)
            location = await self.get(db, location_id)
            path_parts = [loc.name for loc in ancestors]
            if location:
                path_parts.append(location.name)
            return separator.join(path_parts)
        except SQLAlchemyError as e:
            logger.error(f"Error getting hierarchical path for {location_id}: {e}")
            return ""
    
    async def get_breadcrumb(
        self,
        db: AsyncSession,
        location_id: UUID
    ) -> List[dict]:
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
                    "level_name": anc.level_name
                })
            
            if location:
                breadcrumb.append({
                    "id": str(location.id),
                    "code": location.code,
                    "name": location.name,
                    "level": location.level,
                    "level_name": location.level_name
                })
            
            return breadcrumb
        except SQLAlchemyError as e:
            logger.error(f"Error getting breadcrumb for {location_id}: {e}")
            return []
    
    # ==================== FILTER OPERATIONS ====================
    
    async def get_by_location_type(
        self,
        db: AsyncSession,
        location_type: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Location]:
        """Get locations by type"""
        try:
            query = select(Location).where(
                Location.location_type == location_type,
                Location.status == "active"
            ).offset(skip).limit(limit).order_by(Location.name)
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
        skip: int = 0,
        limit: int = 50
    ) -> List[Location]:
        """Search locations by name or code"""
        try:
            stmt = select(Location).where(
                or_(
                    Location.name.ilike(f"%{query}%"),
                    Location.code.ilike(f"%{query}%"),
                    Location.short_name.ilike(f"%{query}%"),
                    Location.native_name.ilike(f"%{query}%")
                ),
                Location.status == "active"
            )
            if level:
                stmt = stmt.where(Location.level == level)
            stmt = stmt.offset(skip).limit(limit).order_by(Location.name)
            result = await db.execute(stmt)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error searching locations with query '{query}': {e}")
            return []
    
    # ==================== COUNT OPERATIONS ====================
    
    async def count_children(
        self,
        db: AsyncSession,
        location_id: UUID,
        include_inactive: bool = False
    ) -> int:
        """Count child locations"""
        try:
            query = select(func.count()).select_from(Location).where(
                Location.parent_id == location_id
            )
            if not include_inactive:
                query = query.where(Location.status == "active")
            result = await db.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting children for {location_id}: {e}")
            return 0
    
    # ==================== UPDATE OPERATIONS ====================
    
    async def update_gps(
        self,
        db: AsyncSession,
        location_id: UUID,
        gps_data: dict
    ) -> Optional[Location]:
        """Update GPS data for a location"""
        try:
            location = await self.get(db, location_id)
            if not location:
                logger.warning(f"Location {location_id} not found for GPS update")
                return None
            
            if location.gps_data is None:
                location.gps_data = {}
            location.gps_data.update(gps_data)
            
            if "latitude" in gps_data:
                location.latitude = gps_data["latitude"]
            if "longitude" in gps_data:
                location.longitude = gps_data["longitude"]
            
            db.add(location)
            await db.commit()
            await db.refresh(location)
            logger.info(f"✅ GPS data updated for location {location_id}")
            return location
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error updating GPS data for {location_id}: {e}")
            return None
    
    # ==================== BULK OPERATIONS ====================
    
    async def bulk_create(
        self,
        db: AsyncSession,
        locations: List[LocationCreate],
        user: Optional[User] = None
    ) -> List[Location]:
        """Bulk create locations"""
        created = []
        
        try:
            for location_data in locations:
                try:
                    existing = await self.get_by_code(db, location_data.code)
                    if existing:
                        logger.debug(f"Location {location_data.code} already exists, skipping")
                        continue
                    
                    location = await self.create(db, obj_in=location_data, user=user)
                    created.append(location)
                    logger.debug(f"Created location: {location_data.code}")
                    
                except Exception as e:
                    logger.error(f"Failed to create {location_data.code}: {e}")
                    continue
            
            return created
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error in bulk create: {e}")
            return []
    
    # ==================== STATISTICS ====================
    
    async def get_statistics(
        self,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Get location statistics"""
        try:
            # Count by level
            level_counts = {}
            for level in range(1, 8):
                query = select(func.count()).select_from(Location).where(
                    Location.level == level,
                    Location.status == "active"
                )
                result = await db.execute(query)
                level_counts[f"level_{level}"] = result.scalar() or 0
            
            # Total locations
            total_query = select(func.count()).select_from(Location).where(
                Location.status == "active"
            )
            total_result = await db.execute(total_query)
            
            # Top-level locations
            top_level_query = select(func.count()).select_from(Location).where(
                Location.parent_id.is_(None),
                Location.status == "active"
            )
            top_level_result = await db.execute(top_level_query)
            
            # Countries count
            countries_query = select(func.count()).select_from(Location).where(
                Location.level == 1,
                Location.status == "active"
            )
            countries_result = await db.execute(countries_query)
            
            return {
                "total": total_result.scalar() or 0,
                "top_level": top_level_result.scalar() or 0,
                "countries": countries_result.scalar() or 0,
                "by_level": level_counts
            }
        except SQLAlchemyError as e:
            logger.error(f"Error getting location statistics: {e}")
            return {"total": 0, "top_level": 0, "countries": 0, "by_level": {}}
    
    # ==================== PARENT CODE OPERATIONS ====================
    
    async def get_by_parent_code(
        self,
        db: AsyncSession,
        parent_code: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Location]:
        """Get locations by parent code"""
        try:
            parent = await self.get_by_code(db, parent_code)
            if not parent:
                return []
            
            query = select(Location).where(Location.parent_id == parent.id)
            query = query.offset(skip).limit(limit).order_by(Location.name)
            result = await db.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching locations by parent code '{parent_code}': {e}")
            return []
    
    async def create_with_parent_code(
        self,
        db: AsyncSession,
        location_in: LocationCreate,
        parent_code: Optional[str] = None,
        user: Optional[User] = None
    ) -> Optional[Location]:
        """Create location with parent code instead of parent_id"""
        try:
            if parent_code:
                parent = await self.get_by_code(db, parent_code)
                if not parent:
                    logger.error(f"Parent with code '{parent_code}' not found")
                    return None
                
                location_in.parent_id = parent.id
                location_in.level = parent.level + 1
            
            return await self.create(db, obj_in=location_in, user=user)
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error creating location with parent code: {e}")
            return None
    
    # ==================== VALIDATION ====================
    
    async def validate_hierarchy(
        self,
        db: AsyncSession,
        location_id: UUID,
        new_parent_id: Optional[UUID] = None
    ) -> Tuple[bool, str]:
        """Validate hierarchy to prevent circular references"""
        try:
            if not new_parent_id:
                return True, ""
            
            # Check if new parent is the same as location
            if new_parent_id == location_id:
                return False, "Location cannot be its own parent"
            
            # Check if new parent is a descendant (would create cycle)
            descendants = await self.get_descendants(db, location_id, depth=10)
            if any(d.id == new_parent_id for d in descendants):
                return False, "Cannot set a descendant as parent (would create cycle)"
            
            return True, ""
        except SQLAlchemyError as e:
            logger.error(f"Error validating hierarchy: {e}")
            return False, f"Validation error: {str(e)}"


# Create singleton instance
location = CRUDLocation(Location)