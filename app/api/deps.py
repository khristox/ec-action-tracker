# app/api/deps.py

from typing import List, Optional, Union, Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt
import uuid

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.crud.user import user as user_crud
from app.schemas.token import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)


def get_secret_key() -> str:
    """
    Get SECRET_KEY as string from SecretStr.
    """
    secret = settings.SECRET_KEY
    if hasattr(secret, 'get_secret_value'):
        return secret.get_secret_value()
    return str(secret)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    Get the current authenticated user from the token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
    
    try:
        secret_key = get_secret_key()
        payload = jwt.decode(
            token, secret_key, algorithms=[settings.ALGORITHM]
        )
        
        # Get user_id from payload (could be in sub or user_id)
        user_id = payload.get("user_id") or payload.get("sub")
        
        if not user_id:
            raise credentials_exception
        
        token_data = TokenPayload(
            sub=user_id,
            user_id=user_id,
            username=payload.get("username"),
            roles=payload.get("roles", [])
        )
    except JWTError:
        raise credentials_exception
    
    # Try to get user by UUID if it's a valid UUID, otherwise by username
    user = None
    try:
        # Try as UUID first
        user_uuid = uuid.UUID(str(user_id))
        user = await user_crud.get(db, id=user_uuid)
    except (ValueError, TypeError):
        # If not a valid UUID, try by username
        user = await user_crud.get_by_username(db, str(user_id))
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user


async def get_current_user_optional(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> Optional[User]:
    """
    Get the current authenticated user from the token.
    Returns None if not authenticated (no error raised).
    """
    if not token:
        return None
    
    try:
        secret_key = get_secret_key()
        payload = jwt.decode(
            token, secret_key, algorithms=[settings.ALGORITHM]
        )
        
        user_id = payload.get("user_id") or payload.get("sub")
        if not user_id:
            return None
        
        token_data = TokenPayload(
            sub=user_id,
            user_id=user_id,
            username=payload.get("username"),
            roles=payload.get("roles", [])
        )
    except JWTError:
        return None
    
    # Try to get user by UUID if it's a valid UUID, otherwise by username
    user = None
    try:
        user_uuid = uuid.UUID(str(user_id))
        user = await user_crud.get(db, id=user_uuid)
    except (ValueError, TypeError):
        user = await user_crud.get_by_username(db, str(user_id))
    
    if user is None:
        return None
    
    if not user.is_active:
        return None
    
    return user


def require_roles(allowed_roles: List[str]):
    """
    Dependency factory to require specific roles.
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.is_superuser:
            return current_user
        
        user_role_codes = [role.code for role in current_user.roles]
        
        if any(role_code in user_role_codes for role_code in allowed_roles):
            return current_user
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Required roles: {', '.join(allowed_roles)}"
        )
    
    return role_checker


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current superuser (admin with full access)."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current admin user (users with admin role or superuser)."""
    if current_user.is_superuser:
        return current_user
    
    has_admin_role = any(role.code == "admin" for role in current_user.roles)
    if not has_admin_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    
    return current_user


async def get_current_lecturer(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current lecturer (users with lecturer role)."""
    has_lecturer_role = any(role.code == "lecturer" for role in current_user.roles)
    if not has_lecturer_role and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Lecturer privileges required"
        )
    
    return current_user


async def get_current_student(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current student (users with student role)."""
    has_student_role = any(role.code == "student" for role in current_user.roles)
    if not has_student_role and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student privileges required"
        )
    
    return current_user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require admin privileges (superuser or admin role)."""
    if current_user.is_superuser:
        return current_user
    
    has_admin_role = any(role.code == "admin" for role in current_user.roles)
    if not has_admin_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    
    return current_user