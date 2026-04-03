from typing import List, Optional, Any
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_current_user
from app.models.user import User,Permission
from app.core.condition_checker import ConditionChecker
from app.db.base import get_db

condition_checker = ConditionChecker()

class PermissionChecker:
    def __init__(self, required_permissions: List[str]):
        self.required_permissions = required_permissions
    
    async def __call__(
        self,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        resource: Optional[Any] = None,
        **context
    ) -> User:
        """
        Check if user has required permissions with conditions
        """
        # Get all permissions from user's roles
        user_permissions = await self._get_user_permissions(db, current_user)
        
        # Check each required permission
        for required_perm_name in self.required_permissions:
            # Find the permission definition
            permission_def = await self._get_permission_definition(db, required_perm_name)
            if not permission_def:
                # Permission doesn't exist in system
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission {required_perm_name} does not exist"
                )
            
            # Check if user has this permission
            user_perm = user_permissions.get(required_perm_name)
            if not user_perm:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing required permission: {required_perm_name}"
                )
            
            # Check conditions if they exist
            if permission_def.conditions:
                has_condition = await condition_checker.check_conditions(
                    conditions=permission_def.conditions,
                    user=current_user,
                    resource=resource,
                    context=context
                )
                
                if not has_condition:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission {required_perm_name} conditions not satisfied"
                    )
        
        return current_user
    
    async def _get_user_permissions(self, db: AsyncSession, user: User) -> dict:
        """Get all permissions for a user"""
        permissions = {}
        
        # Eager load roles and permissions
        await db.refresh(user, ['roles'])
        for role in user.roles:
            await db.refresh(role, ['permissions'])
            for perm in role.permissions:
                permissions[perm.name] = perm
        
        return permissions
    
    async def _get_permission_definition(self, db: AsyncSession, perm_name: str) -> Permission:
        """Get permission definition from database"""
        result = await db.execute(
            select(Permission).where(Permission.name == perm_name)
        )
        return result.scalar_one_or_none()

# Convenience function
def require_permissions(permissions: List[str]):
    return PermissionChecker(permissions)

# Common permission checks
require_user_create = require_permissions(["user:create"])
require_user_delete = require_permissions(["user:delete"])
require_course_create = require_permissions(["course:create"])
require_course_publish = require_permissions(["course:publish"])