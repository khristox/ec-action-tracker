# app/crud/menu.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func, case
from sqlalchemy.orm import selectinload, joinedload
from typing import Optional, List, Dict, Any, Set, Tuple
from uuid import UUID
from datetime import datetime, timezone
import logging
from app.models.menu import Menu
from app.models.role import RoleMenuPermission, Role
from app.schemas.menu import (
    MenuCreate, MenuUpdate, IconConfig, BadgeConfig,
    IconType, IconLibrary, IconSize, IconAnimation,
    BadgeType, BadgeColor
)

logger = logging.getLogger(__name__)


class MenuCRUD:
    """CRUD operations for Menu model with enhanced icon support"""
    
    # Cache for frequently accessed menus (TTL: 5 minutes)
    _cache: Dict[str, Any] = {}
    _cache_timestamp: Dict[str, float] = {}
    _CACHE_TTL = 300  # 5 seconds

    def _get_cache_key(self, *args, **kwargs) -> str:
        """Generate cache key from arguments"""
        return f"{args}_{sorted(kwargs.items())}"

    def _is_cache_valid(self, key: str) -> bool:
        """Check if cache entry is still valid"""
        if key not in self._cache_timestamp:
            return False
        return (datetime.now().timestamp() - self._cache_timestamp[key]) < self._CACHE_TTL

    def _invalidate_cache(self, pattern: Optional[str] = None):
        """Invalidate cache entries"""
        if pattern:
            keys_to_remove = [k for k in self._cache.keys() if pattern in k]
            for k in keys_to_remove:
                self._cache.pop(k, None)
                self._cache_timestamp.pop(k, None)
        else:
            self._cache.clear()
            self._cache_timestamp.clear()

    async def get(
        self, 
        db: AsyncSession, 
        id: UUID,
        load_children: bool = False,
        load_permissions: bool = False,
        use_cache: bool = False
    ) -> Optional[Menu]:
        """Get menu by ID with optional eager loading"""
        cache_key = self._get_cache_key("get", str(id), load_children, load_permissions)
        
        if use_cache and self._is_cache_valid(cache_key):
            return self._cache.get(cache_key)
        
        try:
            query = select(Menu).where(Menu.id == id)
            
            if load_children:
                query = query.options(selectinload(Menu.children))
            if load_permissions:
                query = query.options(selectinload(Menu.role_permissions))
            
            result = await db.execute(query)
            menu = result.scalar_one_or_none()
            
            if use_cache and menu:
                self._cache[cache_key] = menu
                self._cache_timestamp[cache_key] = datetime.now().timestamp()
            
            return menu
        except Exception as e:
            logger.error(f"Error fetching menu {id}: {e}")
            return None
    
    async def get_by_code(
        self, 
        db: AsyncSession, 
        code: str,
        load_children: bool = False,
        use_cache: bool = False
    ) -> Optional[Menu]:
        """Get menu by code with optional eager loading"""
        cache_key = self._get_cache_key("get_by_code", code, load_children)
        
        if use_cache and self._is_cache_valid(cache_key):
            return self._cache.get(cache_key)
        
        try:
            query = select(Menu).where(Menu.code == code)
            
            if load_children:
                query = query.options(selectinload(Menu.children))
            
            result = await db.execute(query)
            menu = result.scalar_one_or_none()
            
            if use_cache and menu:
                self._cache[cache_key] = menu
                self._cache_timestamp[cache_key] = datetime.now().timestamp()
            
            return menu
        except Exception as e:
            logger.error(f"Error fetching menu by code {code}: {e}")
            return None
    
    async def get_by_codes(
        self, 
        db: AsyncSession, 
        codes: List[str]
    ) -> List[Menu]:
        """Get multiple menus by codes"""
        if not codes:
            return []
        
        try:
            query = select(Menu).where(Menu.code.in_(codes))
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching menus by codes: {e}")
            return []
    
    async def get_all(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        active_only: bool = True,
        load_children: bool = False,
        load_permissions: bool = False,
        include_icons: bool = True
    ) -> List[Menu]:
        """Get all menus with pagination and optional eager loading"""
        try:
            query = select(Menu).order_by(Menu.sort_order)
            
            if active_only:
                query = query.where(Menu.is_active == True)
            
            if load_children:
                query = query.options(selectinload(Menu.children))
            if load_permissions:
                query = query.options(selectinload(Menu.role_permissions))
            
            query = query.offset(skip).limit(limit)
            result = await db.execute(query)
            menus = result.scalars().all()
            
            # Compute icon configs for each menu
            if include_icons:
                for menu in menus:
                    menu.icon_config = self._compute_icon_config(menu)
                    menu.badge_display = self._compute_badge_display(menu)
                    menu.show_badge = bool(menu.badge_display)
            
            return menus
        except Exception as e:
            logger.error(f"Error fetching all menus: {e}")
            return []
    
    async def get_root_menus(
        self, 
        db: AsyncSession,
        active_only: bool = True,
        include_icons: bool = True
    ) -> List[Menu]:
        """Get only root menus (no parent)"""
        try:
            query = select(Menu).where(Menu.parent_id.is_(None))
            
            if active_only:
                query = query.where(Menu.is_active == True)
            
            query = query.order_by(Menu.sort_order)
            result = await db.execute(query)
            menus = result.scalars().all()
            
            if include_icons:
                for menu in menus:
                    menu.icon_config = self._compute_icon_config(menu)
                    menu.badge_display = self._compute_badge_display(menu)
                    menu.show_badge = bool(menu.badge_display)
            
            return menus
        except Exception as e:
            logger.error(f"Error fetching root menus: {e}")
            return []
    
    async def get_children(
        self, 
        db: AsyncSession, 
        parent_id: UUID,
        active_only: bool = True,
        recursive: bool = False,
        include_icons: bool = True
    ) -> List[Menu]:
        """Get children of a menu, optionally recursive"""
        try:
            if recursive:
                menus = await self._get_descendants(db, parent_id, active_only)
            else:
                query = select(Menu).where(Menu.parent_id == parent_id)
                
                if active_only:
                    query = query.where(Menu.is_active == True)
                
                query = query.order_by(Menu.sort_order)
                result = await db.execute(query)
                menus = result.scalars().all()
            
            if include_icons:
                for menu in menus:
                    menu.icon_config = self._compute_icon_config(menu)
                    menu.badge_display = self._compute_badge_display(menu)
                    menu.show_badge = bool(menu.badge_display)
            
            return menus
        except Exception as e:
            logger.error(f"Error fetching children for menu {parent_id}: {e}")
            return []
    
    async def _get_descendants(
        self, 
        db: AsyncSession, 
        parent_id: UUID,
        active_only: bool = True
    ) -> List[Menu]:
        """Get all descendants of a menu (recursive using CTE)"""
        # Use recursive CTE for better performance
        from sqlalchemy import text
        
        active_filter = "AND m.is_active = 1" if active_only else ""
        
        query = text(f"""
            WITH RECURSIVE menu_tree AS (
                SELECT id, code, title, icon, icon_type, icon_library, icon_color,
                       icon_size, icon_animation, badge, path, parent_id, sort_order,
                       is_active, requires_auth, target, created_at, updated_at,
                       0 as level
                FROM menus
                WHERE id = :parent_id
                
                UNION ALL
                
                SELECT m.id, m.code, m.title, m.icon, m.icon_type, m.icon_library,
                       m.icon_color, m.icon_size, m.icon_animation, m.badge,
                       m.path, m.parent_id, m.sort_order, m.is_active,
                       m.requires_auth, m.target, m.created_at, m.updated_at,
                       mt.level + 1
                FROM menus m
                INNER JOIN menu_tree mt ON m.parent_id = mt.id
                WHERE m.is_active = 1 {active_filter}
            )
            SELECT * FROM menu_tree WHERE id != :parent_id
            ORDER BY level, sort_order
        """)
        
        result = await db.execute(query, {"parent_id": parent_id})
        return [Menu(**row._mapping) for row in result]
    
    async def get_hierarchy(
        self, 
        db: AsyncSession, 
        role_ids: Optional[List[UUID]] = None,
        user_id: Optional[UUID] = None,
        include_inactive: bool = False,
        max_depth: int = 10,
        include_icons: bool = True
    ) -> List[Menu]:
        """
        Get hierarchical menu structure with role-based filtering.
        Uses eager loading to prevent N+1 queries.
        """
        try:
            query = select(Menu)
            
            if not include_inactive:
                query = query.where(Menu.is_active == True)
            
            # Eager load children and permissions
            query = query.options(
                selectinload(Menu.children).selectinload(Menu.role_permissions),
                selectinload(Menu.role_permissions)
            )
            
            # Filter by role permissions if roles provided
            if role_ids:
                subquery = select(RoleMenuPermission.menu_id).where(
                    RoleMenuPermission.role_id.in_(role_ids),
                    RoleMenuPermission.can_view == True
                ).distinct()
                
                query = query.where(Menu.id.in_(subquery))
            
            query = query.order_by(Menu.sort_order)
            result = await db.execute(query)
            menus = result.scalars().all()
            
            # Build hierarchy with depth limiting
            hierarchy = self._build_hierarchy(menus, max_depth)
            
            # Compute icon configs and badges
            if include_icons:
                hierarchy = self._enrich_menus_with_icons(hierarchy)
            
            return hierarchy
            
        except Exception as e:
            logger.error(f"Error building menu hierarchy: {e}")
            return []
    
    def _build_hierarchy(self, menus: List[Menu], max_depth: int = 10) -> List[Menu]:
        """
        Build tree structure from flat menu list.
        Sets children attribute on parent menus with depth limiting.
        """
        if not menus:
            return []
        
        menu_dict = {}
        root_menus = []
        
        # Create dictionary of all menus
        for menu in menus:
            menu_dict[menu.id] = menu
            if not hasattr(menu, 'children'):
                menu.children = []
            if not hasattr(menu, 'level'):
                menu.level = 0
        
        # Build tree structure
        for menu in menus:
            if menu.parent_id and menu.parent_id in menu_dict:
                parent = menu_dict[menu.parent_id]
                if len(self._get_ancestor_chain(parent, menu_dict)) < max_depth:
                    if menu not in parent.children:
                        parent.children.append(menu)
                        menu.level = parent.level + 1
            elif not menu.parent_id:
                if menu not in root_menus:
                    root_menus.append(menu)
        
        # Sort children by sort_order
        for menu in menu_dict.values():
            if hasattr(menu, 'children') and menu.children:
                menu.children.sort(key=lambda x: x.sort_order)
        
        # Sort root menus
        root_menus.sort(key=lambda x: x.sort_order)
        
        return root_menus
    
    def _get_ancestor_chain(self, menu: Menu, menu_dict: Dict[UUID, Menu]) -> List[Menu]:
        """Get chain of ancestors for a menu"""
        ancestors = []
        current = menu
        while current.parent_id and current.parent_id in menu_dict:
            current = menu_dict[current.parent_id]
            ancestors.append(current)
        return ancestors
    
    def _compute_icon_config(self, menu: Menu) -> Optional[Dict[str, Any]]:
        """Compute icon configuration for a menu"""
        if not menu.icon:
            return None
        
        return {
            "name": menu.icon,
            "type": getattr(menu, 'icon_type', 'mui'),
            "library": getattr(menu, 'icon_library', 'mui'),
            "color": getattr(menu, 'icon_color', 'inherit'),
            "size": getattr(menu, 'icon_size', 'medium'),
            "animation": getattr(menu, 'icon_animation', 'none'),
            "rotation": getattr(menu, 'icon_rotation', None)
        }
    
    def _compute_badge_display(self, menu: Menu) -> Optional[str]:
        """Compute badge display text"""
        if menu.badge_config:
            if menu.badge_config.type == BadgeType.COUNT and menu.badge_config.count:
                if menu.badge_config.count > menu.badge_config.max_count:
                    return f"{menu.badge_config.max_count}+"
                return str(menu.badge_config.count)
            if menu.badge_config.type == BadgeType.TEXT and menu.badge_config.text:
                return menu.badge_config.text
            if menu.badge_config.type == BadgeType.DOT:
                return "●"
            if menu.badge_config.type == BadgeType.STATUS:
                return menu.badge_config.text or "●"
        elif menu.badge:
            return menu.badge
        return None
    
    def _enrich_menus_with_icons(self, menus: List[Menu]) -> List[Menu]:
        """Recursively enrich menus with computed icon configs and badges"""
        for menu in menus:
            menu.icon_config = self._compute_icon_config(menu)
            menu.badge_display = self._compute_badge_display(menu)
            menu.show_badge = bool(menu.badge_display)
            
            if hasattr(menu, 'children') and menu.children:
                self._enrich_menus_with_icons(menu.children)
        
        return menus
    
    async def create(self, db: AsyncSession, obj_in: MenuCreate) -> Menu:
        """Create a new menu with validation and icon support"""
        try:
            # Check for duplicate code
            existing = await self.get_by_code(db, obj_in.code)
            if existing:
                raise ValueError(f"Menu with code '{obj_in.code}' already exists")
            
            # Check for circular reference
            if obj_in.parent_id:
                await self._validate_no_circular_reference(db, obj_in.parent_id, None)
            
            # Create menu instance with timestamps
            menu_data = obj_in.model_dump(exclude_unset=True)
            menu_data['created_at'] = datetime.now(timezone.utc)
            menu_data['updated_at'] = datetime.now(timezone.utc)
            
            # Handle badge_config if provided
            if 'badge_config' in menu_data and menu_data['badge_config']:
                badge_config = menu_data['badge_config']
                if isinstance(badge_config, dict):
                    # Convert dict to BadgeConfig
                    menu_data['badge'] = badge_config.get('text')
            
            menu = Menu(**menu_data)
            db.add(menu)
            await db.commit()
            await db.refresh(menu)
            
            # Invalidate cache
            self._invalidate_cache()
            
            logger.info(f"Menu created: {menu.code} (ID: {menu.id})")
            return menu
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create menu: {e}")
            raise
    
    async def update(
        self, 
        db: AsyncSession, 
        id: UUID, 
        obj_in: MenuUpdate
    ) -> Optional[Menu]:
        """Update an existing menu with icon support"""
        try:
            menu = await self.get(db, id)
            if not menu:
                logger.warning(f"Menu not found for update: {id}")
                return None
            
            # Check for duplicate code if code is being changed
            if obj_in.code and obj_in.code != menu.code:
                existing = await self.get_by_code(db, obj_in.code)
                if existing:
                    raise ValueError(f"Menu with code '{obj_in.code}' already exists")
            
            # Check for circular reference if parent_id is being changed
            if obj_in.parent_id and obj_in.parent_id != menu.parent_id:
                await self._validate_no_circular_reference(db, obj_in.parent_id, id)
            
            update_data = obj_in.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(menu, field, value)
            
            menu.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(menu)
            
            # Invalidate cache
            self._invalidate_cache()
            
            logger.info(f"Menu updated: {menu.code} (ID: {menu.id})")
            return menu
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update menu {id}: {e}")
            raise
    
    async def delete(self, db: AsyncSession, id: UUID, cascade: bool = False) -> bool:
        """Delete a menu with option to cascade delete children"""
        try:
            menu = await self.get(db, id)
            if not menu:
                logger.warning(f"Menu not found for deletion: {id}")
                return False
            
            # Get children
            children = await self.get_children(db, id, active_only=False)
            
            if children:
                if cascade:
                    # Delete all children recursively
                    for child in children:
                        await self.delete(db, child.id, cascade=True)
                    logger.info(f"Deleted {len(children)} child menus")
                else:
                    # Reassign children to parent of deleted menu
                    for child in children:
                        child.parent_id = menu.parent_id
                    await db.commit()
                    logger.info(f"Reassigned {len(children)} children to parent {menu.parent_id}")
            
            # Delete the menu
            result = await db.execute(delete(Menu).where(Menu.id == id))
            await db.commit()
            
            deleted = result.rowcount > 0
            if deleted:
                logger.info(f"Menu deleted: {menu.code} (ID: {id})")
                self._invalidate_cache()
            
            return deleted
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete menu {id}: {e}")
            return False
    
    async def bulk_create(self, db: AsyncSession, menus: List[MenuCreate]) -> List[Menu]:
        """Create multiple menus in batch"""
        created_menus = []
        for menu_in in menus:
            try:
                menu = await self.create(db, menu_in)
                created_menus.append(menu)
            except Exception as e:
                logger.error(f"Failed to create menu {menu_in.code}: {e}")
        return created_menus
    
    async def reorder(self, db: AsyncSession, menu_ids: List[UUID]) -> bool:
        """Reorder menus by providing list of IDs in desired order"""
        if not menu_ids:
            return False
        
        try:
            for index, menu_id in enumerate(menu_ids):
                await db.execute(
                    update(Menu)
                    .where(Menu.id == menu_id)
                    .values(sort_order=index, updated_at=datetime.now(timezone.utc))
                )
            await db.commit()
            self._invalidate_cache()
            logger.info(f"Reordered {len(menu_ids)} menus")
            return True
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to reorder menus: {e}")
            return False
    
    async def toggle_active(self, db: AsyncSession, id: UUID) -> Optional[Menu]:
        """Toggle menu active status"""
        try:
            menu = await self.get(db, id)
            if not menu:
                return None
            
            menu.is_active = not menu.is_active
            menu.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(menu)
            
            self._invalidate_cache()
            
            status = "activated" if menu.is_active else "deactivated"
            logger.info(f"Menu {status}: {menu.code}")
            return menu
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to toggle menu {id}: {e}")
            return None
    
    async def get_menu_tree_for_user(
        self, 
        db: AsyncSession, 
        user_roles: List[Role],
        include_icons: bool = True
    ) -> List[Menu]:
        """Get menu tree for a user based on their roles"""
        role_ids = [role.id for role in user_roles]
        return await self.get_hierarchy(db, role_ids, include_icons=include_icons)
    
    async def search_menus(
        self, 
        db: AsyncSession, 
        query: str,
        limit: int = 20,
        include_icons: bool = True
    ) -> List[Menu]:
        """Search menus by code, title, or keywords"""
        try:
            search_term = f"%{query}%"
            result = await db.execute(
                select(Menu)
                .where(
                    or_(
                        Menu.code.ilike(search_term),
                        Menu.title.ilike(search_term),
                        Menu.description.ilike(search_term) if hasattr(Menu, 'description') else False,
                        func.JSON_CONTAINS(Menu.keywords, f'"{query}"') if hasattr(Menu, 'keywords') else False
                    )
                )
                .limit(limit)
            )
            menus = result.scalars().all()
            
            if include_icons:
                for menu in menus:
                    menu.icon_config = self._compute_icon_config(menu)
                    menu.badge_display = self._compute_badge_display(menu)
                    menu.show_badge = bool(menu.badge_display)
            
            return menus
        except Exception as e:
            logger.error(f"Error searching menus: {e}")
            return []
    
    async def get_statistics(self, db: AsyncSession) -> Dict[str, Any]:
        """Get menu statistics including icon usage"""
        try:
            total_menus = await db.execute(select(func.count()).select_from(Menu))
            total = total_menus.scalar() or 0
            
            active_menus = await db.execute(
                select(func.count()).select_from(Menu).where(Menu.is_active == True)
            )
            active = active_menus.scalar() or 0
            
            root_menus = await db.execute(
                select(func.count()).select_from(Menu).where(Menu.parent_id.is_(None))
            )
            root = root_menus.scalar() or 0
            
            # Icon usage statistics
            mui_icons = await db.execute(
                select(func.count()).select_from(Menu).where(Menu.icon_type == 'mui')
            )
            fa_icons = await db.execute(
                select(func.count()).select_from(Menu).where(Menu.icon_type == 'fontawesome')
            )
            material_icons = await db.execute(
                select(func.count()).select_from(Menu).where(Menu.icon_type == 'material_symbols')
            )
            
            # Badge usage
            menus_with_badge = await db.execute(
                select(func.count()).select_from(Menu).where(Menu.badge.isnot(None))
            )
            
            return {
                "total": total,
                "active": active,
                "inactive": total - active,
                "root": root,
                "has_menus": total > 0,
                "icon_usage": {
                    "mui": mui_icons.scalar() or 0,
                    "fontawesome": fa_icons.scalar() or 0,
                    "material_symbols": material_icons.scalar() or 0
                },
                "menus_with_badge": menus_with_badge.scalar() or 0
            }
        except Exception as e:
            logger.error(f"Error getting menu statistics: {e}")
            return {"total": 0, "active": 0, "inactive": 0, "root": 0, "has_menus": False}
    
    async def get_mobile_bottom_menus(
        self, 
        db: AsyncSession, 
        role_ids: List[UUID],
        limit: int = 5
    ) -> List[Menu]:
        """Get menus configured for mobile bottom navigation"""
        try:
            # Get permissions with mobile bottom enabled
            permissions_query = select(RoleMenuPermission.menu_id).where(
                RoleMenuPermission.role_id.in_(role_ids),
                RoleMenuPermission.can_show_mb_bottom == True,
                RoleMenuPermission.can_view == True
            ).distinct()
            
            result = await db.execute(permissions_query)
            menu_ids = [row[0] for row in result.all()]
            
            if not menu_ids:
                return []
            
            # Get menus
            query = select(Menu).where(
                Menu.id.in_(menu_ids),
                Menu.is_active == True
            ).order_by(Menu.sort_order).limit(limit)
            
            result = await db.execute(query)
            menus = result.scalars().all()
            
            # Enrich with icon configs
            for menu in menus:
                menu.icon_config = self._compute_icon_config(menu)
                menu.badge_display = self._compute_badge_display(menu)
                menu.show_badge = bool(menu.badge_display)
            
            return menus
        except Exception as e:
            logger.error(f"Error fetching mobile bottom menus: {e}")
            return []
    
    async def _validate_no_circular_reference(
        self, 
        db: AsyncSession, 
        parent_id: UUID, 
        menu_id: Optional[UUID]
    ) -> None:
        """Validate that setting parent_id doesn't create a circular reference"""
        current_parent_id = parent_id
        visited = set()
        
        while current_parent_id:
            if current_parent_id in visited:
                raise ValueError("Circular reference detected in menu hierarchy")
            visited.add(current_parent_id)
            
            parent_menu = await self.get(db, current_parent_id)
            if not parent_menu:
                break
            
            current_parent_id = parent_menu.parent_id
        
        # Also check if menu_id would become its own ancestor
        if menu_id and menu_id in visited:
            raise ValueError("Cannot set parent that would create a circular reference")


class RoleMenuPermissionCRUD:
    """CRUD operations for RoleMenuPermission model"""
    
    async def get_by_role(
        self, 
        db: AsyncSession, 
        role_id: UUID,
        include_menu_details: bool = False,
        include_menu_icons: bool = True
    ) -> List[RoleMenuPermission]:
        """Get all permissions for a role"""
        try:
            query = select(RoleMenuPermission).where(RoleMenuPermission.role_id == role_id)
            
            if include_menu_details:
                query = query.options(selectinload(RoleMenuPermission.menu))
            
            result = await db.execute(query)
            permissions = result.scalars().all()
            
            # Enrich with icon configs if requested
            if include_menu_icons and include_menu_details:
                for perm in permissions:
                    if perm.menu:
                        perm.menu.icon_config = MenuCRUD()._compute_icon_config(perm.menu)
                        perm.menu.badge_display = MenuCRUD()._compute_badge_display(perm.menu)
                        perm.menu.show_badge = bool(perm.menu.badge_display)
            
            return permissions
        except Exception as e:
            logger.error(f"Error fetching permissions for role {role_id}: {e}")
            return []
    
    async def get_by_menu(
        self, 
        db: AsyncSession, 
        menu_id: UUID,
        include_role_details: bool = False
    ) -> List[RoleMenuPermission]:
        """Get all permissions for a menu"""
        try:
            query = select(RoleMenuPermission).where(RoleMenuPermission.menu_id == menu_id)
            
            if include_role_details:
                query = query.options(selectinload(RoleMenuPermission.role))
            
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching permissions for menu {menu_id}: {e}")
            return []
    
    async def get_by_role_and_menu(
        self, 
        db: AsyncSession, 
        role_id: UUID, 
        menu_id: UUID
    ) -> Optional[RoleMenuPermission]:
        """Get specific permission for a role and menu"""
        try:
            result = await db.execute(
                select(RoleMenuPermission).where(
                    and_(
                        RoleMenuPermission.role_id == role_id,
                        RoleMenuPermission.menu_id == menu_id
                    )
                )
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching permission for role {role_id} and menu {menu_id}: {e}")
            return None
    
    async def set_permission(
        self, 
        db: AsyncSession, 
        role_id: UUID, 
        menu_id: UUID, 
        can_view: bool = True,
        can_access: bool = True,
        can_show_mb_bottom: bool = False
    ) -> RoleMenuPermission:
        """Set permission for a role on a menu (create or update)"""
        try:
            permission = await self.get_by_role_and_menu(db, role_id, menu_id)
            now = datetime.now(timezone.utc)
            
            if permission:
                permission.can_view = can_view
                permission.can_access = can_access
                permission.can_show_mb_bottom = can_show_mb_bottom
                permission.updated_at = now
                action = "updated"
            else:
                permission = RoleMenuPermission(
                    role_id=role_id,
                    menu_id=menu_id,
                    can_view=can_view,
                    can_access=can_access,
                    can_show_mb_bottom=can_show_mb_bottom,
                    created_at=now,
                    updated_at=now
                )
                db.add(permission)
                action = "created"
            
            await db.commit()
            await db.refresh(permission)
            
            logger.info(f"Permission {action} for role {role_id} on menu {menu_id}")
            return permission
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to set permission: {e}")
            raise
    
    async def batch_assign_menus(
        self, 
        db: AsyncSession, 
        role_id: UUID, 
        menu_ids: List[UUID],
        replace_existing: bool = True,
        default_can_show_mb_bottom: bool = False,
        auto_detect_mobile_bottom: bool = True
    ) -> List[RoleMenuPermission]:
        """Batch assign multiple menus to a role with mobile bottom detection"""
        if not menu_ids:
            return []
        
        try:
            if replace_existing:
                await db.execute(
                    delete(RoleMenuPermission).where(
                        RoleMenuPermission.role_id == role_id
                    )
                )
                logger.info(f"Removed existing permissions for role {role_id}")
            
            permissions = []
            now = datetime.now(timezone.utc)
            
            # Get menu data for mobile bottom detection
            menu_crud = MenuCRUD()
            menus = await menu_crud.get_by_codes(db, [])  # Would need to get by IDs
            
            for menu_id in menu_ids:
                if not replace_existing:
                    existing = await self.get_by_role_and_menu(db, role_id, menu_id)
                    if existing:
                        permissions.append(existing)
                        continue
                
                # Auto-detect if this menu should show on mobile bottom
                can_show_mb = default_can_show_mb_bottom
                if auto_detect_mobile_bottom:
                    # Logic for auto-detection based on menu properties
                    # For example: root menus, dashboards, actions, meetings
                    can_show_mb = await self._should_show_on_mobile_bottom(db, menu_id)
                
                permission = RoleMenuPermission(
                    role_id=role_id,
                    menu_id=menu_id,
                    can_view=True,
                    can_access=True,
                    can_show_mb_bottom=can_show_mb,
                    created_at=now,
                    updated_at=now
                )
                db.add(permission)
                permissions.append(permission)
            
            await db.commit()
            
            for permission in permissions:
                await db.refresh(permission)
            
            logger.info(f"Assigned {len(permissions)} menus to role {role_id}")
            return permissions
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to batch assign menus: {e}")
            raise
    
    async def _should_show_on_mobile_bottom(self, db: AsyncSession, menu_id: UUID) -> bool:
        """Determine if a menu should show on mobile bottom navigation"""
        menu_crud = MenuCRUD()
        menu = await menu_crud.get(db, menu_id)
        
        if not menu:
            return False
        
        # Mobile bottom navigation candidates
        mobile_candidates = [
            "dashboard", "meetings", "actions", "calendar",
            "my_tasks", "notifications", "participants"
        ]
        
        # Check if menu code is in candidates or if it's a root menu
        return menu.code in mobile_candidates or menu.parent_id is None
    
    async def get_role_menu_ids(
        self, 
        db: AsyncSession, 
        role_id: UUID,
        only_can_view: bool = True
    ) -> Set[UUID]:
        """Get set of menu IDs that a role has access to"""
        try:
            query = select(RoleMenuPermission.menu_id).where(
                RoleMenuPermission.role_id == role_id
            )
            if only_can_view:
                query = query.where(RoleMenuPermission.can_view == True)
            
            result = await db.execute(query)
            return {row[0] for row in result.all()}
        except Exception as e:
            logger.error(f"Error fetching menu IDs for role {role_id}: {e}")
            return set()
    
    async def get_roles_for_menu(
        self, 
        db: AsyncSession, 
        menu_id: UUID,
        only_can_view: bool = True
    ) -> List[UUID]:
        """Get list of role IDs that can access a menu"""
        try:
            query = select(RoleMenuPermission.role_id).where(
                RoleMenuPermission.menu_id == menu_id
            )
            if only_can_view:
                query = query.where(RoleMenuPermission.can_view == True)
            
            result = await db.execute(query)
            return [row[0] for row in result.all()]
        except Exception as e:
            logger.error(f"Error fetching roles for menu {menu_id}: {e}")
            return []
    
    async def remove_permission(
        self, 
        db: AsyncSession, 
        role_id: UUID, 
        menu_id: UUID
    ) -> bool:
        """Remove a permission"""
        try:
            result = await db.execute(
                delete(RoleMenuPermission).where(
                    and_(
                        RoleMenuPermission.role_id == role_id,
                        RoleMenuPermission.menu_id == menu_id
                    )
                )
            )
            await db.commit()
            
            removed = result.rowcount > 0
            if removed:
                logger.info(f"Removed permission for role {role_id} on menu {menu_id}")
            
            return removed
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to remove permission: {e}")
            return False
    
    async def remove_all_role_permissions(
        self, 
        db: AsyncSession, 
        role_id: UUID
    ) -> int:
        """Remove all permissions for a role"""
        try:
            result = await db.execute(
                delete(RoleMenuPermission).where(RoleMenuPermission.role_id == role_id)
            )
            await db.commit()
            
            count = result.rowcount
            logger.info(f"Removed {count} permissions for role {role_id}")
            return count
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to remove permissions for role {role_id}: {e}")
            return 0
    
    async def sync_role_permissions(
        self, 
        db: AsyncSession, 
        role_id: UUID, 
        menu_ids: List[UUID]
    ) -> Dict[str, Any]:
        """Sync role permissions to exactly match the provided menu IDs"""
        try:
            current_menu_ids = await self.get_role_menu_ids(db, role_id)
            target_menu_ids = set(menu_ids)
            
            to_add = target_menu_ids - current_menu_ids
            to_remove = current_menu_ids - target_menu_ids
            
            for menu_id in to_add:
                await self.set_permission(db, role_id, menu_id, True, True)
            
            for menu_id in to_remove:
                await self.remove_permission(db, role_id, menu_id)
            
            return {
                "role_id": str(role_id),
                "added": len(to_add),
                "removed": len(to_remove),
                "total": len(target_menu_ids),
                "success": True
            }
        except Exception as e:
            logger.error(f"Failed to sync permissions for role {role_id}: {e}")
            return {
                "role_id": str(role_id),
                "added": 0,
                "removed": 0,
                "total": 0,
                "success": False,
                "error": str(e)
            }
    
    async def get_permission_summary(
        self, 
        db: AsyncSession, 
        role_id: UUID
    ) -> Dict[str, Any]:
        """Get summary of permissions for a role including icon usage"""
        try:
            permissions = await self.get_by_role(db, role_id, include_menu_details=True)
            
            total = len(permissions)
            can_view = sum(1 for p in permissions if p.can_view)
            can_access = sum(1 for p in permissions if p.can_access)
            mobile_bottom = sum(1 for p in permissions if p.can_show_mb_bottom)
            
            # Icon type distribution
            icon_types = {
                "mui": 0,
                "fontawesome": 0,
                "material_symbols": 0,
                "custom": 0
            }
            
            for p in permissions:
                if p.menu and p.menu.icon_type:
                    icon_types[p.menu.icon_type] = icon_types.get(p.menu.icon_type, 0) + 1
            
            # Group by parent menu
            by_parent = {}
            for p in permissions:
                if p.menu and p.menu.parent_id:
                    parent_id = str(p.menu.parent_id)
                    by_parent[parent_id] = by_parent.get(parent_id, 0) + 1
            
            return {
                "role_id": str(role_id),
                "total_permissions": total,
                "can_view_count": can_view,
                "can_access_count": can_access,
                "mobile_bottom_count": mobile_bottom,
                "icon_type_distribution": icon_types,
                "by_parent": by_parent
            }
        except Exception as e:
            logger.error(f"Error getting permission summary for role {role_id}: {e}")
            return {
                "role_id": str(role_id),
                "total_permissions": 0,
                "can_view_count": 0,
                "can_access_count": 0,
                "mobile_bottom_count": 0,
                "icon_type_distribution": {},
                "by_parent": {},
                "error": str(e)
            }


# Create instances
menu = MenuCRUD()
role_menu_permission = RoleMenuPermissionCRUD()