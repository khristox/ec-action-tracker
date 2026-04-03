# app/crud/permission.py

from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from app.crud.base import CRUDBase
from app.models.role import Permission  # FIXED: Import from role.py, not user.py
from app.schemas.permission import PermissionCreate, PermissionUpdate
import logging

logger = logging.getLogger(__name__)


class CRUDPermission(CRUDBase[Permission, PermissionCreate, PermissionUpdate]):
    
    async def get_by_code(self, db: AsyncSession, code: str) -> Optional[Permission]:
        """Get a permission by its code."""
        try:
            result = await db.execute(select(Permission).where(Permission.code == code))
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching permission by code '{code}': {e}")
            return None
    
    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[Permission]:
        """Get a permission by its name."""
        try:
            result = await db.execute(select(Permission).where(Permission.name == name))
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching permission by name '{name}': {e}")
            return None
    
    async def get_by_resource_action(self, db: AsyncSession, resource: str, action: str) -> Optional[Permission]:
        """Get a permission by resource and action."""
        try:
            result = await db.execute(
                select(Permission).where(
                    Permission.resource == resource,
                    Permission.action == action
                )
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching permission by resource {resource} and action {action}: {e}")
            return None
    
    async def create_system_permissions(self, db: AsyncSession) -> int:
        """Create all system permissions."""
        permissions_data = [
            # User permissions
            {"name": "Create User", "code": "user:create", "resource": "user", "action": "create", "is_system": True},
            {"name": "Read User", "code": "user:read", "resource": "user", "action": "read", "is_system": True},
            {"name": "Update User", "code": "user:update", "resource": "user", "action": "update", "is_system": True},
            {"name": "Delete User", "code": "user:delete", "resource": "user", "action": "delete", "is_system": True},
            
            # Course permissions
            {"name": "Create Course", "code": "course:create", "resource": "course", "action": "create", "is_system": True},
            {"name": "Read Course", "code": "course:read", "resource": "course", "action": "read", "is_system": True},
            {"name": "Update Course", "code": "course:update", "resource": "course", "action": "update", "is_system": True},
            {"name": "Delete Course", "code": "course:delete", "resource": "course", "action": "delete", "is_system": True},
            {"name": "Enroll in Course", "code": "course:enroll", "resource": "course", "action": "enroll", "is_system": True},
            {"name": "Grade Course", "code": "course:grade", "resource": "course", "action": "grade", "is_system": True},
            
            # Profile permissions
            {"name": "Read Profile", "code": "profile:read", "resource": "profile", "action": "read", "is_system": True},
            {"name": "Update Profile", "code": "profile:update", "resource": "profile", "action": "update", "is_system": True},
            
            # Dashboard permissions
            {"name": "View Dashboard", "code": "dashboard:view", "resource": "dashboard", "action": "view", "is_system": True},
            
            # Report permissions
            {"name": "View Reports", "code": "report:view", "resource": "report", "action": "view", "is_system": True},
            {"name": "Export Reports", "code": "report:export", "resource": "report", "action": "export", "is_system": True},
            
            # Role permissions
            {"name": "Assign Role", "code": "role:assign", "resource": "role", "action": "assign", "is_system": True},
            {"name": "Create Role", "code": "role:create", "resource": "role", "action": "create", "is_system": True},
            {"name": "Read Role", "code": "role:read", "resource": "role", "action": "read", "is_system": True},
            {"name": "Update Role", "code": "role:update", "resource": "role", "action": "update", "is_system": True},
            {"name": "Delete Role", "code": "role:delete", "resource": "role", "action": "delete", "is_system": True},
        ]
        
        created = 0
        for perm_data in permissions_data:
            existing = await self.get_by_code(db, perm_data["code"])
            if not existing:
                permission = Permission(**perm_data)
                db.add(permission)
                created += 1
        
        await db.commit()
        logger.info(f"✅ Created {created} system permissions")
        return created


# Create a single instance
permission = CRUDPermission(Permission)