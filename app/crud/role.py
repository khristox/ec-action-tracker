# app/crud/role.py

from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import SQLAlchemyError
from app.crud.base import CRUDBase
from app.models.role import Role, Permission, role_permissions  # Import from role.py
from app.models.user import user_roles  # Import user_roles from user.py
from app.schemas.role import RoleCreate, RoleUpdate
import logging

logger = logging.getLogger(__name__)


class CRUDRole(CRUDBase[Role, RoleCreate, RoleUpdate]):
    
    # ==================== BASIC CRUD OPERATIONS ====================
    
    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[Role]:
        """Get a role by its name."""
        try:
            result = await db.execute(select(Role).where(Role.name == name))
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching role by name '{name}': {e}")
            return None
    
    async def get_by_code(self, db: AsyncSession, code: str) -> Optional[Role]:
        """Get a role by its code."""
        try:
            result = await db.execute(select(Role).where(Role.code == code))
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching role by code '{code}': {e}")
            return None
    
    async def get_with_permissions(self, db: AsyncSession, role_id: UUID) -> Optional[Role]:
        """Get a role with its permissions eagerly loaded."""
        try:
            result = await db.execute(
                select(Role)
                .where(Role.id == role_id)
                .options(selectinload(Role.permissions))
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching role {role_id} with permissions: {e}")
            return None
    
    async def create_with_permissions(
        self, 
        db: AsyncSession, 
        name: str, 
        code: str,
        description: str = None,
        permission_codes: List[str] = None
    ) -> Optional[Role]:
        """Create a new role with optional permissions."""
        try:
            existing = await self.get_by_name(db, name)
            if existing:
                return existing
            
            role = Role(
                name=name,
                code=code,
                description=description
            )
            db.add(role)
            await db.flush()
            
            if permission_codes:
                from app.crud.permission import permission
                for perm_code in permission_codes:
                    perm = await permission.get_by_code(db, perm_code)
                    if perm:
                        await db.execute(
                            role_permissions.insert().values(
                                role_id=role.id,
                                permission_id=perm.id
                            )
                        )
            
            await db.commit()
            await db.refresh(role)
            logger.info(f"✅ Created role: {role.name}")
            return role
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error creating role '{name}': {e}")
            return None
    
    async def assign_to_user(self, db: AsyncSession, user_id: UUID, role_id: UUID) -> bool:
        """Assign a role to a user."""
        try:
            existing = await db.scalar(
                select(user_roles).where(
                    user_roles.c.user_id == user_id,
                    user_roles.c.role_id == role_id
                )
            )
            
            if existing:
                return True
            
            await db.execute(
                user_roles.insert().values(
                    user_id=user_id,
                    role_id=role_id,
                    assigned_at=func.now()
                )
            )
            await db.commit()
            return True
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error assigning role: {e}")
            return False
    
    async def get_user_roles(self, db: AsyncSession, user_id: UUID) -> List[Role]:
        """Get all roles for a user."""
        try:
            result = await db.execute(
                select(Role)
                .join(user_roles)
                .where(user_roles.c.user_id == user_id)
            )
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error getting roles for user {user_id}: {e}")
            return []
    
    async def ensure_default_roles(self, db: AsyncSession) -> List[Role]:
        """Ensure default roles exist."""
        default_roles = [
            {"name": "Admin", "code": "admin", "description": "Full system access", "permissions": None},
            {"name": "User", "code": "user", "description": "Regular user", "permissions": ["course:read", "profile:read"]},
            {"name": "Lecturer", "code": "lecturer", "description": "Course manager", "permissions": ["course:create", "course:read", "course:update"]},
        ]
        
        created = []
        for role_data in default_roles:
            existing = await self.get_by_code(db, role_data["code"])
            if not existing:
                role = await self.create_with_permissions(
                    db,
                    name=role_data["name"],
                    code=role_data["code"],
                    description=role_data["description"],
                    permission_codes=role_data["permissions"]
                )
                if role:
                    created.append(role)
            else:
                created.append(existing)
        
        return created


# Create a single instance
role = CRUDRole(Role)