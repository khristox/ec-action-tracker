# app/core/permissions.py

import logging
from typing import List, Optional, Any, Dict, Set, Union
from functools import lru_cache
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.models.user import User, Permission, Role
from app.core.condition_checker import ConditionChecker
from app.db.base import get_db
from app.core.config import settings

logger = logging.getLogger(__name__)
condition_checker = ConditionChecker()

# ==================== PERMISSION CACHE ====================

class PermissionCache:
    """Simple cache for permission lookups"""
    
    def __init__(self, ttl: int = 300):  # 5 minutes default
        self._cache: Dict[str, Any] = {}
        self._ttl = ttl
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired"""
        if key in self._cache:
            value, timestamp = self._cache[key]
            import time
            if time.time() - timestamp < self._ttl:
                return value
            else:
                del self._cache[key]
        return None
    
    def set(self, key: str, value: Any):
        """Set cached value"""
        import time
        self._cache[key] = (value, time.time())
    
    def clear(self):
        """Clear all cache"""
        self._cache.clear()

# Global cache instance
_permission_cache = PermissionCache()

# ==================== PERMISSION CHECKER ====================

class PermissionChecker:
    """
    Enhanced permission checker with caching, superuser bypass, and detailed logging.
    """
    
    def __init__(
        self,
        required_permissions: List[str],
        require_all: bool = True,  # If True, require all permissions; if False, require any
        check_conditions: bool = True,
        bypass_superuser: bool = True,
    ):
        self.required_permissions = required_permissions
        self.require_all = require_all
        self.check_conditions = check_conditions
        self.bypass_superuser = bypass_superuser
    
    async def __call__(
        self,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        resource: Optional[Any] = None,
        **context
    ) -> User:
        """
        Check if user has required permissions with conditions.
        
        Args:
            current_user: Current authenticated user
            db: Database session
            resource: Optional resource object for condition checking
            context: Additional context for condition checking
            
        Returns:
            User if permission check passes
            
        Raises:
            HTTPException: 403 if permission check fails
        """
        # Bypass permission checks for superusers
        if self.bypass_superuser and current_user.is_superuser:
            logger.info(
                f"Superuser {current_user.username} bypassing permission check "
                f"for {self.required_permissions}"
            )
            return current_user
        
        # Get all permissions for the user
        user_permissions = await self._get_user_permissions(db, current_user)
        
        # Track which permissions are missing
        missing_permissions = []
        unsatisfied_conditions = []
        
        for required_perm_name in self.required_permissions:
            # Get permission definition
            permission_def = await self._get_permission_definition(db, required_perm_name)
            if not permission_def:
                logger.warning(
                    f"Permission '{required_perm_name}' not found in system"
                )
                missing_permissions.append(f"{required_perm_name} (not found)")
                continue
            
            # Check if user has this permission
            user_perm = user_permissions.get(required_perm_name)
            if not user_perm:
                missing_permissions.append(required_perm_name)
                continue
            
            # Check conditions if they exist and feature is enabled
            if self.check_conditions and permission_def.conditions:
                has_condition = await condition_checker.check_conditions(
                    conditions=permission_def.conditions,
                    user=current_user,
                    resource=resource,
                    context=context
                )
                
                if not has_condition:
                    unsatisfied_conditions.append(required_perm_name)
        
        # Determine if check passes
        if self.require_all:
            # Require ALL permissions
            if missing_permissions or unsatisfied_conditions:
                error_detail = self._build_error_detail(
                    missing_permissions, unsatisfied_conditions
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_detail
                )
        else:
            # Require ANY permission (at least one)
            has_any = len(self.required_permissions) > 0
            for perm_name in self.required_permissions:
                if perm_name not in missing_permissions and perm_name not in unsatisfied_conditions:
                    # Found one valid permission
                    break
            else:
                # No valid permissions found
                error_detail = f"Need at least one of: {', '.join(self.required_permissions)}"
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_detail
                )
        
        # Log successful permission check
        logger.debug(
            f"User {current_user.username} granted access to "
            f"{', '.join(self.required_permissions)}"
        )
        
        return current_user
    
    def _build_error_detail(
        self,
        missing_permissions: List[str],
        unsatisfied_conditions: List[str]
    ) -> str:
        """Build detailed error message"""
        detail_parts = []
        
        if missing_permissions:
            detail_parts.append(
                f"Missing required permissions: {', '.join(missing_permissions)}"
            )
        
        if unsatisfied_conditions:
            detail_parts.append(
                f"Permission conditions not satisfied for: {', '.join(unsatisfied_conditions)}"
            )
        
        return " | ".join(detail_parts) if detail_parts else "Permission denied"
    
    async def _get_user_permissions(
        self,
        db: AsyncSession,
        user: User
    ) -> Dict[str, Permission]:
        """
        Get all permissions for a user with caching.
        
        Returns:
            Dictionary mapping permission name to Permission object
        """
        cache_key = f"user_permissions_{user.id}"
        
        # Try cache first
        cached = _permission_cache.get(cache_key)
        if cached is not None:
            return cached
        
        # Query user with roles and permissions preloaded
        result = await db.execute(
            select(User)
            .options(
                selectinload(User.roles).selectinload(Role.permissions)
            )
            .where(User.id == user.id)
        )
        user_with_roles = result.scalar_one_or_none()
        
        if not user_with_roles:
            logger.warning(f"User {user.id} not found during permission check")
            return {}
        
        permissions = {}
        for role in user_with_roles.roles:
            if role.is_active:
                for perm in role.permissions:
                    if perm.is_active:
                        permissions[perm.name] = perm
        
        # Cache the result
        _permission_cache.set(cache_key, permissions)
        
        return permissions
    
    async def _get_permission_definition(
        self,
        db: AsyncSession,
        perm_name: str
    ) -> Optional[Permission]:
        """
        Get permission definition from database with caching.
        """
        cache_key = f"permission_def_{perm_name}"
        
        # Try cache first
        cached = _permission_cache.get(cache_key)
        if cached is not None:
            return cached
        
        # Query database
        result = await db.execute(
            select(Permission).where(Permission.name == perm_name)
        )
        permission = result.scalar_one_or_none()
        
        if permission:
            _permission_cache.set(cache_key, permission)
        else:
            logger.warning(f"Permission '{perm_name}' not found in database")
        
        return permission


# ==================== FACTORY FUNCTIONS ====================

def require_permissions(
    permissions: List[str],
    require_all: bool = True,
    check_conditions: bool = True,
    bypass_superuser: bool = True,
) -> PermissionChecker:
    """
    Create a permission checker for the given permissions.
    
    Args:
        permissions: List of permission names required
        require_all: If True, require ALL permissions; if False, require ANY
        check_conditions: Whether to check permission conditions
        bypass_superuser: Whether superusers bypass permission checks
        
    Returns:
        PermissionChecker instance
        
    Examples:
        # Require ALL permissions
        require_permissions(["user:create", "user:edit"])
        
        # Require ANY permission (OR logic)
        require_permissions(["admin:access", "super:access"], require_all=False)
        
        # Disable condition checking
        require_permissions(["course:publish"], check_conditions=False)
    """
    return PermissionChecker(
        required_permissions=permissions,
        require_all=require_all,
        check_conditions=check_conditions,
        bypass_superuser=bypass_superuser,
    )


def require_any_permission(permissions: List[str]) -> PermissionChecker:
    """Require any one of the given permissions (OR logic)."""
    return require_permissions(permissions, require_all=False)


# ==================== COMMON PERMISSIONS ====================

# User permissions
require_user_create = require_permissions(["user:create"])
require_user_edit = require_permissions(["user:edit"])
require_user_delete = require_permissions(["user:delete"])
require_user_view = require_permissions(["user:view"])
require_user_manage = require_permissions(["user:create", "user:edit", "user:delete", "user:view"])

# Course permissions
require_course_create = require_permissions(["course:create"])
require_course_edit = require_permissions(["course:edit"])
require_course_delete = require_permissions(["course:delete"])
require_course_view = require_permissions(["course:view"])
require_course_publish = require_permissions(["course:publish"])
require_course_manage = require_permissions([
    "course:create", "course:edit", "course:delete", 
    "course:view", "course:publish"
])

# Meeting permissions
require_meeting_create = require_permissions(["meeting:create"])
require_meeting_edit = require_permissions(["meeting:edit"])
require_meeting_delete = require_permissions(["meeting:delete"])
require_meeting_view = require_permissions(["meeting:view"])
require_meeting_manage = require_permissions([
    "meeting:create", "meeting:edit", "meeting:delete", "meeting:view"
])

# Admin permissions
require_admin = require_permissions(["admin:access"])
require_super_admin = require_permissions(["super:access"])

# ==================== PERMISSION DECORATOR ====================

def permission_required(permissions: List[str]):
    """
    Decorator for endpoint permission checks.
    
    Usage:
        @router.post("/meetings")
        @permission_required(["meeting:create"])
        async def create_meeting(...):
            ...
    """
    checker = require_permissions(permissions)
    
    async def wrapper(
        current_user: User = Depends(checker),
        *args,
        **kwargs
    ):
        return current_user
    
    return wrapper


# ==================== HELPER FUNCTIONS ====================

async def clear_permission_cache():
    """Clear the permission cache (useful during testing or user updates)."""
    _permission_cache.clear()
    logger.info("Permission cache cleared")


async def refresh_user_permissions(db: AsyncSession, user_id: int):
    """Refresh permissions for a specific user."""
    cache_key = f"user_permissions_{user_id}"
    _permission_cache.set(cache_key, None)  # Invalidate cache
    logger.info(f"Permission cache invalidated for user {user_id}")


# ==================== TYPE HINTS ====================

# Type aliases for common permission checks
from typing import Annotated

PermissionCheck = Annotated[User, Depends(require_permissions(["permission:check"]))]
AdminAccess = Annotated[User, Depends(require_admin)]
UserManage = Annotated[User, Depends(require_user_manage)]
CourseManage = Annotated[User, Depends(require_course_manage)]
MeetingManage = Annotated[User, Depends(require_meeting_manage)]