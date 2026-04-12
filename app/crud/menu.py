# app/crud/menu.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload, joinedload
from typing import Optional, List, Dict, Any, Set, Tuple
from uuid import UUID
from datetime import datetime, timezone
import logging
from app.models.menu import Menu
from app.models.role import RoleMenuPermission, Role
from app.schemas.menu import MenuCreate, MenuUpdate

logger = logging.getLogger(__name__)


class MenuCRUD:
    """CRUD operations for Menu model with optimized queries"""
    
    async def get(
        self, 
        db: AsyncSession, 
        id: UUID,
        load_children: bool = False,
        load_permissions: bool = False
    ) -> Optional[Menu]:
        """Get menu by ID with optional eager loading"""
        try:
            query = select(Menu).where(Menu.id == id)
            
            if load_children:
                query = query.options(selectinload(Menu.children))
            if load_permissions:
                query = query.options(selectinload(Menu.role_permissions))
            
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching menu {id}: {e}")
            return None
    
    async def get_by_code(
        self, 
        db: AsyncSession, 
        code: str,
        load_children: bool = False
    ) -> Optional[Menu]:
        """Get menu by code with optional eager loading"""
        try:
            query = select(Menu).where(Menu.code == code)
            
            if load_children:
                query = query.options(selectinload(Menu.children))
            
            result = await db.execute(query)
            return result.scalar_one_or_none()
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
        load_permissions: bool = False
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
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching all menus: {e}")
            return []
    
    async def get_root_menus(
        self, 
        db: AsyncSession,
        active_only: bool = True
    ) -> List[Menu]:
        """Get only root menus (no parent)"""
        try:
            query = select(Menu).where(Menu.parent_id.is_(None))
            
            if active_only:
                query = query.where(Menu.is_active == True)
            
            query = query.order_by(Menu.sort_order)
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching root menus: {e}")
            return []
    
    async def get_children(
        self, 
        db: AsyncSession, 
        parent_id: UUID,
        active_only: bool = True,
        recursive: bool = False
    ) -> List[Menu]:
        """Get children of a menu, optionally recursive"""
        try:
            if recursive:
                return await self._get_descendants(db, parent_id, active_only)
            
            query = select(Menu).where(Menu.parent_id == parent_id)
            
            if active_only:
                query = query.where(Menu.is_active == True)
            
            query = query.order_by(Menu.sort_order)
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching children for menu {parent_id}: {e}")
            return []
    
    async def _get_descendants(
        self, 
        db: AsyncSession, 
        parent_id: UUID,
        active_only: bool = True
    ) -> List[Menu]:
        """Get all descendants of a menu (recursive)"""
        # Use recursive CTE for PostgreSQL
        # For simplicity, we'll do iterative fetching
        descendants = []
        to_process = [parent_id]
        
        while to_process:
            current_id = to_process.pop()
            children = await self.get_children(db, current_id, active_only)
            descendants.extend(children)
            to_process.extend([child.id for child in children])
        
        return descendants
    
    async def get_hierarchy(
        self, 
        db: AsyncSession, 
        role_ids: Optional[List[UUID]] = None,
        user_id: Optional[UUID] = None,
        include_inactive: bool = False,
        max_depth: int = 10
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
            return self._build_hierarchy(menus, max_depth)
            
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
    
    async def create(self, db: AsyncSession, obj_in: MenuCreate) -> Menu:
        """Create a new menu with validation"""
        try:
            # Check for duplicate code
            existing = await self.get_by_code(db, obj_in.code)
            if existing:
                raise ValueError(f"Menu with code '{obj_in.code}' already exists")
            
            # Check for circular reference
            if obj_in.parent_id:
                await self._validate_no_circular_reference(db, obj_in.parent_id, None)
            
            # Create menu instance with timestamps
            menu_data = obj_in.model_dump()
            menu_data['created_at'] = datetime.now(timezone.utc)
            menu_data['updated_at'] = datetime.now(timezone.utc)
            
            menu = Menu(**menu_data)
            db.add(menu)
            await db.commit()
            await db.refresh(menu)
            
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
        """Update an existing menu"""
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
        user_roles: List[Role]
    ) -> List[Menu]:
        """Get menu tree for a user based on their roles"""
        role_ids = [role.id for role in user_roles]
        return await self.get_hierarchy(db, role_ids)
    
    async def search_menus(
        self, 
        db: AsyncSession, 
        query: str,
        limit: int = 20
    ) -> List[Menu]:
        """Search menus by code or title"""
        try:
            search_term = f"%{query}%"
            result = await db.execute(
                select(Menu)
                .where(
                    or_(
                        Menu.code.ilike(search_term),
                        Menu.title.ilike(search_term)
                    )
                )
                .limit(limit)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error searching menus: {e}")
            return []
    
    async def get_statistics(self, db: AsyncSession) -> Dict[str, Any]:
        """Get menu statistics"""
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
            
            return {
                "total": total,
                "active": active,
                "inactive": total - active,
                "root": root,
                "has_menus": total > 0
            }
        except Exception as e:
            logger.error(f"Error getting menu statistics: {e}")
            return {"total": 0, "active": 0, "inactive": 0, "root": 0, "has_menus": False}
    
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
        include_menu_details: bool = False
    ) -> List[RoleMenuPermission]:
        """Get all permissions for a role"""
        try:
            query = select(RoleMenuPermission).where(RoleMenuPermission.role_id == role_id)
            
            if include_menu_details:
                query = query.options(selectinload(RoleMenuPermission.menu))
            
            result = await db.execute(query)
            return result.scalars().all()
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
    
    # app/crud/menu.py - Update the set_permission method

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
            from datetime import datetime, timezone
            
            permission = await self.get_by_role_and_menu(db, role_id, menu_id)
            now = datetime.now(timezone.utc)
            
            if permission:
                # Update existing
                permission.can_view = can_view
                permission.can_access = can_access
                permission.can_show_mb_bottom = can_show_mb_bottom
                permission.updated_at = now
                action = "updated"
            else:
                # Create new with explicit timestamps
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
        default_can_show_mb_bottom: bool = False
    ) -> List[RoleMenuPermission]:
        """Batch assign multiple menus to a role"""
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
            
            for menu_id in menu_ids:
                if not replace_existing:
                    existing = await self.get_by_role_and_menu(db, role_id, menu_id)
                    if existing:
                        permissions.append(existing)
                        continue
                
                permission = RoleMenuPermission(
                    role_id=role_id,
                    menu_id=menu_id,
                    can_view=True,
                    can_access=True,
                    can_show_mb_bottom=default_can_show_mb_bottom,
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
            # Get current permissions
            current_menu_ids = await self.get_role_menu_ids(db, role_id)
            target_menu_ids = set(menu_ids)
            
            # Calculate changes
            to_add = target_menu_ids - current_menu_ids
            to_remove = current_menu_ids - target_menu_ids
            
            # Apply changes
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
        """Get summary of permissions for a role"""
        try:
            permissions = await self.get_by_role(db, role_id, include_menu_details=True)
            
            total = len(permissions)
            can_view = sum(1 for p in permissions if p.can_view)
            can_access = sum(1 for p in permissions if p.can_access)
            mobile_bottom = sum(1 for p in permissions if p.can_show_mb_bottom)
            
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
                "by_parent": {},
                "error": str(e)
            }


# Create instances
menu = MenuCRUD()
role_menu_permission = RoleMenuPermissionCRUD()