# app/crud/role_menu.py
from typing import Dict, List, Optional, Any
from uuid import UUID
from sqlalchemy import select, and_, update, delete, func, text
from app.db.base import get_db
from app.models.role import RoleMenuPermission, Role
from app.models.menu import Menu
from app.models.user import User
import logging

logger = logging.getLogger(__name__)


class RoleMenuCRUD:
    
    @staticmethod
    async def _get_audit_service(db):
        """Helper to get audit service instance (lazy import to avoid circular dependency)"""
        from app.services.audit_service import AuditService
        return AuditService(db)
    
    @staticmethod
    async def get_role_permissions(role_id: UUID, include_menu_details: bool = True) -> Dict:
        """Get all menu permissions for a specific role."""
        try:
            async for db in get_db():
                query = select(
                    RoleMenuPermission.id,
                    RoleMenuPermission.role_id,
                    RoleMenuPermission.menu_id,
                    RoleMenuPermission.can_view,
                    RoleMenuPermission.can_access,
                    RoleMenuPermission.can_show_mb_bottom,
                    RoleMenuPermission.created_at,
                    RoleMenuPermission.updated_at,
                    Menu.code.label('menu_code'),
                    Menu.title.label('menu_title'),
                    Menu.path.label('menu_path'),
                    Menu.icon.label('menu_icon'),
                    Menu.parent_id.label('menu_parent_id'),
                    Menu.sort_order.label('menu_sort_order')
                ).join(
                    Menu, RoleMenuPermission.menu_id == Menu.id
                ).where(
                    RoleMenuPermission.role_id == role_id
                ).order_by(
                    Menu.sort_order,
                    Menu.title
                )
                
                result = await db.execute(query)
                rows = result.fetchall()
                
                permissions_data = []
                for row in rows:
                    perm_dict = {
                        'id': str(row.id),
                        'role_id': str(row.role_id),
                        'menu_id': str(row.menu_id),
                        'can_view': row.can_view,
                        'can_access': row.can_access,
                        'can_show_mb_bottom': row.can_show_mb_bottom,
                        'created_at': row.created_at.isoformat() if row.created_at else None,
                        'updated_at': row.updated_at.isoformat() if row.updated_at else None
                    }
                    
                    if include_menu_details:
                        perm_dict['menu'] = {
                            'id': str(row.menu_id),
                            'code': row.menu_code,
                            'title': row.menu_title,
                            'path': row.menu_path,
                            'icon': row.menu_icon,
                            'parent_id': str(row.menu_parent_id) if row.menu_parent_id else None,
                            'sort_order': row.menu_sort_order
                        }
                    
                    permissions_data.append(perm_dict)
                
                role_result = await db.execute(
                    select(Role.name, Role.code).where(Role.id == role_id)
                )
                role = role_result.first()
                
                return {
                    'success': True,
                    'data': permissions_data,
                    'total': len(permissions_data),
                    'role_id': str(role_id),
                    'role_name': role.name if role else None,
                    'role_code': role.code if role else None
                }
        except Exception as e:
            logger.error(f"Error getting role permissions: {e}", exc_info=True)
            return {'success': False, 'error': str(e), 'data': []}
    
    @staticmethod
    async def get_role_menu_tree(role_id: UUID) -> Dict:
        """Get role menu tree with permissions"""
        try:
            async for db in get_db():
                # NOTE: this query was originally written for MySQL and used
                # syntax that Postgres either rejects outright or silently
                # mishandles:
                #   - CAST(... AS CHAR(1000)) -> CHAR(n) in Postgres is a
                #     fixed-length, blank-padded type, not a MySQL-style
                #     variable-length string; TEXT is the portable choice.
                #   - m.is_active = 1 / rmp.id IS NOT NULL comparisons against
                #     bare integer literals -> is_active is a boolean column,
                #     and Postgres does not implicitly cast int to bool the
                #     way MySQL does.
                #   - COALESCE(rmp.can_view, 0) -> same boolean/integer
                #     COALESCE type mismatch as in get_role_menus_for_assignment;
                #     defaults now match the True/True/False convention used
                #     everywhere else in this file (assign_menu_to_role, etc).
                #   - CONCAT(p.tree_path, '/', c.id) -> Postgres does support
                #     CONCAT(), so this line itself was fine, but c.id is a
                #     UUID and needs an explicit ::text cast to concatenate
                #     cleanly rather than relying on implicit stringification.
                query = text("""
                WITH RECURSIVE menu_hierarchy AS (
                    SELECT 
                        m.id,
                        m.code,
                        m.title,
                        m.path,
                        m.icon,
                        m.parent_id,
                        m.sort_order,
                        m.is_active,
                        COALESCE(rmp.can_view, true) as can_view,
                        COALESCE(rmp.can_access, true) as can_access,
                        COALESCE(rmp.can_show_mb_bottom, false) as can_show_mb_bottom,
                        CASE WHEN rmp.id IS NOT NULL THEN 1 ELSE 0 END as is_assigned,
                        0 as depth,
                        CAST(m.id AS TEXT) as tree_path
                    FROM menus m
                    LEFT JOIN role_menu_permissions rmp 
                        ON rmp.menu_id = m.id AND rmp.role_id = :role_id
                    WHERE m.parent_id IS NULL AND m.is_active = true
                    
                    UNION ALL
                    
                    SELECT 
                        c.id,
                        c.code,
                        c.title,
                        c.path,
                        c.icon,
                        c.parent_id,
                        c.sort_order,
                        c.is_active,
                        COALESCE(rmp.can_view, true) as can_view,
                        COALESCE(rmp.can_access, true) as can_access,
                        COALESCE(rmp.can_show_mb_bottom, false) as can_show_mb_bottom,
                        CASE WHEN rmp.id IS NOT NULL THEN 1 ELSE 0 END as is_assigned,
                        p.depth + 1,
                        CONCAT(p.tree_path, '/', CAST(c.id AS TEXT))
                    FROM menus c
                    INNER JOIN menu_hierarchy p ON c.parent_id = p.id
                    LEFT JOIN role_menu_permissions rmp 
                        ON rmp.menu_id = c.id AND rmp.role_id = :role_id
                    WHERE c.is_active = true
                )
                SELECT * FROM menu_hierarchy
                ORDER BY tree_path
                """)
                
                result = await db.execute(query, {'role_id': str(role_id)})
                rows = result.fetchall()
                
                permissions = []
                for row in rows:
                    permissions.append({
                        'id': str(row.id),
                        'code': row.code,
                        'title': row.title,
                        'path': row.path,
                        'icon': row.icon,
                        'parent_id': str(row.parent_id) if row.parent_id else None,
                        'sort_order': row.sort_order,
                        'is_active': row.is_active,
                        'can_view': row.can_view,
                        'can_access': row.can_access,
                        'can_show_mb_bottom': row.can_show_mb_bottom,
                        'is_assigned': row.is_assigned,
                        'depth': row.depth,
                        'tree_path': row.tree_path
                    })
                
                tree = RoleMenuCRUD._build_menu_tree(permissions)
                total_menus = len([p for p in permissions if p.get('depth') == 0])
                assigned_menus = len([p for p in permissions if p.get('is_assigned', 0) == 1])
                
                return {
                    'success': True,
                    'data': tree,
                    'total_menus': total_menus,
                    'assigned_menus': assigned_menus
                }
        except Exception as e:
            logger.error(f"Error getting role menu tree: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    async def get_assignable_menus(role_id: UUID) -> Dict:
        """Get all menus with assignment status for a role (alias for get_role_menus_for_assignment)"""
        return await RoleMenuCRUD.get_role_menus_for_assignment(role_id)
    
    @staticmethod
    async def get_role_menus_for_assignment(role_id: UUID) -> Dict:
        """Get all menus with assignment status for a role. Used in the assignment form UI."""
        try:
            async for db in get_db():
                # NOTE: :role_id (SQLAlchemy named bind param), not $1
                # (asyncpg positional placeholder). text() compiles bind
                # params by name via the dict passed to execute() - a raw
                # $1 in the SQL string is invisible to SQLAlchemy's param
                # binding, so it reaches the driver as a literal with no
                # value supplied, causing "the server expects 1 argument
                # for this query, 0 were passed".
                #
                # parent_id is cast to ::text in the ORDER BY because it's
                # a UUID column - COALESCE(uuid_col, '0') fails since '0'
                # isn't a valid UUID, so both sides must be text instead.
                query = text("""
               SELECT
                    m.id as menu_id,
                    m.code,
                    m.title,
                    m.icon,
                    m.path,
                    m.parent_id,
                    m.sort_order,
                    m.is_active,
                    CASE WHEN rmp.id IS NOT NULL THEN 1 ELSE 0 END as is_assigned,
                    COALESCE(rmp.can_view, true) as can_view,
                    COALESCE(rmp.can_access, true) as can_access,
                    COALESCE(rmp.can_show_mb_bottom, false) as can_show_mb_bottom,
                    rmp.id as permission_id
                FROM menus m
                LEFT JOIN role_menu_permissions rmp
                    ON rmp.menu_id = m.id AND rmp.role_id = :role_id
                WHERE m.is_active = true
                ORDER BY COALESCE(m.parent_id::text, '0'), m.sort_order, m.title
                """)
                
                result = await db.execute(query, {'role_id': str(role_id)})
                rows = result.fetchall()
                
                menus = []
                for row in rows:
                    menus.append({
                        'menu_id': str(row.menu_id),
                        'code': row.code,
                        'title': row.title,
                        'icon': row.icon,
                        'path': row.path,
                        'parent_id': str(row.parent_id) if row.parent_id else None,
                        'sort_order': row.sort_order,
                        'is_active': row.is_active,
                        'is_assigned': row.is_assigned,
                        'can_view': row.can_view,
                        'can_access': row.can_access,
                        'can_show_mb_bottom': row.can_show_mb_bottom,
                        'permission_id': str(row.permission_id) if row.permission_id else None
                    })
                
                # Build tree structure for UI
                tree = RoleMenuCRUD._build_assignment_tree(menus)
                
                return {
                    'success': True,
                    'data': tree,
                    'total_menus': len(menus)
                }
        except Exception as e:
            logger.error(f"Error getting assignable menus: {e}", exc_info=True)
            return {'success': False, 'error': str(e), 'data': []}
    
    @staticmethod
    def _build_menu_tree(flat_list: List[Dict], parent_id: str = None) -> List[Dict]:
        """Build menu tree from flat list"""
        tree = []
        for item in flat_list:
            item_parent = str(item.get('parent_id')) if item.get('parent_id') else None
            compare_parent = str(parent_id) if parent_id else None
            
            if item_parent == compare_parent:
                children = RoleMenuCRUD._build_menu_tree(flat_list, str(item['id']))
                if children:
                    item['children'] = children
                tree.append(item)
        return tree
    
    @staticmethod
    def _build_assignment_tree(flat_list: List[Dict], parent_id: str = None) -> List[Dict]:
        """Build assignment tree from flat list"""
        tree = []
        for item in flat_list:
            item_parent = str(item.get('parent_id')) if item.get('parent_id') else None
            compare_parent = str(parent_id) if parent_id else None
            
            if item_parent == compare_parent:
                children = RoleMenuCRUD._build_assignment_tree(flat_list, str(item['menu_id']))
                if children:
                    item['children'] = children
                tree.append(item)
        return tree
    
    @staticmethod
    async def assign_menu_to_role(
        role_id: UUID, 
        menu_id: UUID, 
        permissions: Dict,
        user: Optional[User] = None,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Dict:
        """Assign a single menu to role with audit logging"""
        db_session = None
        try:
            async for db in get_db():
                db_session = db
                
                # Get role and menu info for audit
                role_result = await db.execute(
                    select(Role.name, Role.code).where(Role.id == role_id)
                )
                role = role_result.first()
                
                menu_result = await db.execute(
                    select(Menu.title, Menu.code).where(Menu.id == menu_id)
                )
                menu = menu_result.first()
                
                stmt = select(RoleMenuPermission).where(
                    and_(
                        RoleMenuPermission.role_id == role_id,
                        RoleMenuPermission.menu_id == menu_id
                    )
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()
                
                audit_service = await RoleMenuCRUD._get_audit_service(db)
                
                if existing:
                    # Capture old values
                    old_values = {
                        'can_view': existing.can_view,
                        'can_access': existing.can_access,
                        'can_show_mb_bottom': existing.can_show_mb_bottom
                    }
                    
                    # Update existing
                    existing.can_view = permissions.get('can_view', True)
                    existing.can_access = permissions.get('can_access', True)
                    existing.can_show_mb_bottom = permissions.get('can_show_mb_bottom', False)
                    existing.updated_at = func.now()
                    
                    new_values = {
                        'can_view': existing.can_view,
                        'can_access': existing.can_access,
                        'can_show_mb_bottom': existing.can_show_mb_bottom
                    }
                    
                    await db.commit()
                    
                    # Audit log for update
                    await audit_service.log_update(
                        table_name='role_menu_permissions',
                        user=user,
                        record_id=existing.id,
                        old_values=old_values,
                        new_values=new_values,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        endpoint=endpoint,
                        request_id=request_id
                    )
                    
                else:
                    # Create new
                    new_permission = RoleMenuPermission(
                        role_id=role_id,
                        menu_id=menu_id,
                        can_view=permissions.get('can_view', True),
                        can_access=permissions.get('can_access', True),
                        can_show_mb_bottom=permissions.get('can_show_mb_bottom', False)
                    )
                    db.add(new_permission)
                    await db.flush()
                    
                    new_values = {
                        'can_view': new_permission.can_view,
                        'can_access': new_permission.can_access,
                        'can_show_mb_bottom': new_permission.can_show_mb_bottom
                    }
                    
                    await db.commit()
                    
                    # Audit log for create
                    await audit_service.log_create(
                        table_name='role_menu_permissions',
                        user=user,
                        record_id=new_permission.id,
                        new_values=new_values,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        endpoint=endpoint,
                        request_id=request_id
                    )
                
                return {
                    'success': True,
                    'message': 'Menu assigned to role successfully'
                }
        except Exception as e:
            logger.error(f"Error assigning menu to role: {e}", exc_info=True)
            if db_session:
                await db_session.rollback()
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    async def bulk_assign_menus_to_role(
        role_id: UUID, 
        menus: List[Dict],
        user: Optional[User] = None,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Dict:
        """Bulk assign multiple menus to role with audit logging"""
        db_session = None
        try:
            if not menus:
                return {
                    'success': False,
                    'error': 'No menus provided for assignment'
                }
            
            async for db in get_db():
                db_session = db
                
                # Get role info for audit
                role_result = await db.execute(
                    select(Role.name, Role.code).where(Role.id == role_id)
                )
                role = role_result.first()
                
                assigned_menus = []
                updated_menus = []
                
                for menu in menus:
                    # Get menu info for audit
                    menu_result = await db.execute(
                        select(Menu.title, Menu.code).where(Menu.id == menu['menu_id'])
                    )
                    menu_info = menu_result.first()
                    
                    stmt = select(RoleMenuPermission).where(
                        and_(
                            RoleMenuPermission.role_id == role_id,
                            RoleMenuPermission.menu_id == menu['menu_id']
                        )
                    )
                    result = await db.execute(stmt)
                    existing = result.scalar_one_or_none()
                    
                    if existing:
                        # Update existing
                        existing.can_view = menu.get('can_view', True)
                        existing.can_access = menu.get('can_access', True)
                        existing.can_show_mb_bottom = menu.get('can_show_mb_bottom', False)
                        existing.updated_at = func.now()
                        updated_menus.append({
                            'menu_id': str(menu['menu_id']),
                            'menu_title': menu_info.title if menu_info else None
                        })
                    else:
                        # Create new
                        new_permission = RoleMenuPermission(
                            role_id=role_id,
                            menu_id=menu['menu_id'],
                            can_view=menu.get('can_view', True),
                            can_access=menu.get('can_access', True),
                            can_show_mb_bottom=menu.get('can_show_mb_bottom', False)
                        )
                        db.add(new_permission)
                        assigned_menus.append({
                            'menu_id': str(menu['menu_id']),
                            'menu_title': menu_info.title if menu_info else None
                        })
                
                await db.commit()
                
                # Audit log for bulk operation
                audit_service = await RoleMenuCRUD._get_audit_service(db)
                await audit_service.log(
                    action='BULK_ASSIGN',
                    table_name='role_menu_permissions',
                    user=user,
                    record_id=role_id,
                    new_values={
                        'assigned_menus': assigned_menus,
                        'updated_menus': updated_menus,
                        'total_processed': len(menus)
                    },
                    ip_address=ip_address,
                    user_agent=user_agent,
                    endpoint=endpoint,
                    request_id=request_id,
                    changes_summary=f"Bulk assigned {len(assigned_menus)} menus, updated {len(updated_menus)} menus for role {role.name if role else role_id}",
                    status="success"
                )
                
                return {
                    'success': True,
                    'message': f'{len(menus)} menus assigned to role successfully',
                    'total_assigned': len(menus),
                    'created_count': len(assigned_menus),
                    'updated_count': len(updated_menus)
                }
        except Exception as e:
            logger.error(f"Error bulk assigning menus: {e}", exc_info=True)
            if db_session:
                await db_session.rollback()
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    async def update_menu_permission(
        permission_id: UUID, 
        update_data: Dict,
        user: Optional[User] = None,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Dict:
        """Update a specific menu permission with audit logging"""
        db_session = None
        try:
            async for db in get_db():
                db_session = db
                
                # Get existing permission with related data
                stmt = select(RoleMenuPermission).where(
                    RoleMenuPermission.id == permission_id
                )
                result = await db.execute(stmt)
                permission = result.scalar_one_or_none()
                
                if not permission:
                    return {
                        'success': False,
                        'error': 'Permission not found'
                    }
                
                # Get role and menu info for audit
                role_result = await db.execute(
                    select(Role.name, Role.code).where(Role.id == permission.role_id)
                )
                role = role_result.first()
                
                menu_result = await db.execute(
                    select(Menu.title, Menu.code).where(Menu.id == permission.menu_id)
                )
                menu = menu_result.first()
                
                # Capture old values
                old_values = {
                    'can_view': permission.can_view,
                    'can_access': permission.can_access,
                    'can_show_mb_bottom': permission.can_show_mb_bottom
                }
                
                # Update permission
                for key, value in update_data.items():
                    if hasattr(permission, key):
                        setattr(permission, key, value)
                
                permission.updated_at = func.now()
                await db.commit()
                
                # Capture new values
                new_values = {
                    'can_view': permission.can_view,
                    'can_access': permission.can_access,
                    'can_show_mb_bottom': permission.can_show_mb_bottom
                }
                
                # Audit log
                audit_service = await RoleMenuCRUD._get_audit_service(db)
                await audit_service.log_update(
                    table_name='role_menu_permissions',
                    user=user,
                    record_id=permission_id,
                    old_values=old_values,
                    new_values=new_values,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    endpoint=endpoint,
                    request_id=request_id
                )
                
                return {
                    'success': True,
                    'message': 'Menu permission updated successfully'
                }
        except Exception as e:
            logger.error(f"Error updating menu permission: {e}", exc_info=True)
            if db_session:
                await db_session.rollback()
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    async def remove_menu_permission(
        role_id: UUID, 
        menu_id: UUID,
        user: Optional[User] = None,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Dict:
        """Remove menu permission from role with audit logging"""
        db_session = None
        try:
            async for db in get_db():
                db_session = db
                
                # Get permission info before deletion for audit
                stmt = select(RoleMenuPermission).where(
                    and_(
                        RoleMenuPermission.role_id == role_id,
                        RoleMenuPermission.menu_id == menu_id
                    )
                )
                result = await db.execute(stmt)
                permission = result.scalar_one_or_none()
                
                if not permission:
                    return {
                        'success': False,
                        'error': 'Permission not found'
                    }
                
                # Get role and menu info for audit
                role_result = await db.execute(
                    select(Role.name, Role.code).where(Role.id == role_id)
                )
                role = role_result.first()
                
                menu_result = await db.execute(
                    select(Menu.title, Menu.code).where(Menu.id == menu_id)
                )
                menu = menu_result.first()
                
                # Capture permission data before deletion
                old_values = {
                    'can_view': permission.can_view,
                    'can_access': permission.can_access,
                    'can_show_mb_bottom': permission.can_show_mb_bottom,
                    'role_name': role.name if role else None,
                    'menu_title': menu.title if menu else None
                }
                
                # Delete permission
                stmt = delete(RoleMenuPermission).where(
                    and_(
                        RoleMenuPermission.role_id == role_id,
                        RoleMenuPermission.menu_id == menu_id
                    )
                )
                result = await db.execute(stmt)
                await db.commit()
                
                if result.rowcount > 0:
                    # Audit log
                    audit_service = await RoleMenuCRUD._get_audit_service(db)
                    await audit_service.log_delete(
                        table_name='role_menu_permissions',
                        user=user,
                        record_id=permission.id,
                        old_values=old_values,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        endpoint=endpoint,
                        request_id=request_id
                    )
                    
                    return {
                        'success': True,
                        'message': 'Menu permission removed successfully'
                    }
                
                return {
                    'success': False,
                    'error': 'Permission not found'
                }
        except Exception as e:
            logger.error(f"Error removing menu permission: {e}", exc_info=True)
            if db_session:
                await db_session.rollback()
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    async def remove_all_role_permissions(
        role_id: UUID,
        user: Optional[User] = None,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Dict:
        """Remove all menu permissions for a role with audit logging"""
        db_session = None
        try:
            async for db in get_db():
                db_session = db
                
                # Get role info for audit
                role_result = await db.execute(
                    select(Role.name, Role.code).where(Role.id == role_id)
                )
                role = role_result.first()
                
                # Get count of permissions to delete
                count_stmt = select(func.count()).select_from(RoleMenuPermission).where(
                    RoleMenuPermission.role_id == role_id
                )
                count_result = await db.execute(count_stmt)
                permissions_count = count_result.scalar() or 0
                
                # Delete all permissions
                stmt = delete(RoleMenuPermission).where(RoleMenuPermission.role_id == role_id)
                result = await db.execute(stmt)
                await db.commit()
                
                # Audit log
                audit_service = await RoleMenuCRUD._get_audit_service(db)
                await audit_service.log(
                    action='DELETE_ALL',
                    table_name='role_menu_permissions',
                    user=user,
                    record_id=role_id,
                    old_values={
                        'role_name': role.name if role else None,
                        'role_code': role.code if role else None,
                        'permissions_removed_count': permissions_count
                    },
                    ip_address=ip_address,
                    user_agent=user_agent,
                    endpoint=endpoint,
                    request_id=request_id,
                    changes_summary=f"Removed all {permissions_count} menu permissions from role {role.name if role else role_id}",
                    status="success"
                )
                
                return {
                    'success': True,
                    'message': 'All menu permissions removed from role',
                    'removed_count': result.rowcount
                }
        except Exception as e:
            logger.error(f"Error removing all permissions: {e}", exc_info=True)
            if db_session:
                await db_session.rollback()
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    async def sync_role_menus(
        role_id: UUID, 
        menu_ids: List[str],
        user: Optional[User] = None,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Dict:
        """Sync role menus - remove old ones and add new ones with audit logging"""
        db_session = None
        try:
            async for db in get_db():
                db_session = db
                
                # Get role info for audit
                role_result = await db.execute(
                    select(Role.name, Role.code).where(Role.id == role_id)
                )
                role = role_result.first()
                
                # Get existing permissions before deletion
                existing_stmt = select(RoleMenuPermission.menu_id).where(
                    RoleMenuPermission.role_id == role_id
                )
                existing_result = await db.execute(existing_stmt)
                existing_menu_ids = [str(row[0]) for row in existing_result.fetchall()]
                
                # Get menu titles for existing menus
                removed_menus = []
                for mid in existing_menu_ids:
                    if mid not in menu_ids:
                        menu_result = await db.execute(
                            select(Menu.title, Menu.code).where(Menu.id == UUID(mid))
                        )
                        menu = menu_result.first()
                        if menu:
                            removed_menus.append({'menu_id': mid, 'title': menu.title, 'code': menu.code})
                
                # First, remove all existing permissions
                stmt = delete(RoleMenuPermission).where(RoleMenuPermission.role_id == role_id)
                await db.execute(stmt)
                
                # Then add new ones with default permissions
                added_menus = []
                for menu_id in menu_ids:
                    # Get menu info for audit
                    menu_result = await db.execute(
                        select(Menu.title, Menu.code).where(Menu.id == UUID(menu_id))
                    )
                    menu = menu_result.first()
                    
                    new_permission = RoleMenuPermission(
                        role_id=role_id,
                        menu_id=UUID(menu_id),
                        can_view=True,
                        can_access=True,
                        can_show_mb_bottom=False
                    )
                    db.add(new_permission)
                    added_menus.append({
                        'menu_id': menu_id,
                        'title': menu.title if menu else None,
                        'code': menu.code if menu else None
                    })
                
                await db.commit()
                
                # Audit log for sync
                audit_service = await RoleMenuCRUD._get_audit_service(db)
                await audit_service.log(
                    action='SYNC_MENUS',
                    table_name='role_menu_permissions',
                    user=user,
                    record_id=role_id,
                    old_values={
                        'previous_menu_ids': existing_menu_ids,
                        'previous_menus_count': len(existing_menu_ids),
                        'removed_menus': removed_menus
                    },
                    new_values={
                        'new_menu_ids': menu_ids,
                        'new_menus_count': len(menu_ids),
                        'added_menus': added_menus
                    },
                    ip_address=ip_address,
                    user_agent=user_agent,
                    endpoint=endpoint,
                    request_id=request_id,
                    changes_summary=f"Synced menus for role {role.name if role else role_id}: removed {len(removed_menus)}, added {len(added_menus)}",
                    status="success"
                )
                
                return {
                    'success': True,
                    'message': f'Role menus synced successfully. {len(menu_ids)} menus assigned',
                    'total_assigned': len(menu_ids),
                    'added_count': len(added_menus),
                    'removed_count': len(removed_menus),
                    'added_menus': added_menus,
                    'removed_menus': removed_menus
                }
        except Exception as e:
            logger.error(f"Error syncing role menus: {e}", exc_info=True)
            if db_session:
                await db_session.rollback()
            return {'success': False, 'error': str(e)}