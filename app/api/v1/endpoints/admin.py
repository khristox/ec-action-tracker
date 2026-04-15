# app/api/v1/endpoints/admin.py

from datetime import datetime, timezone
from typing import Any, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.security import get_password_hash
from app.crud.user import user as user_crud
from app.crud.role import role as role_crud
from app.models.user import User
from app.models.role import Role
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.schemas.role import RoleResponse
from app.schemas.auth import MessageResponse

router = APIRouter()


@router.get("/users", response_model=dict)
async def get_users(
    db: AsyncSession = Depends(deps.get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    role: Optional[str] = None,
    current_user: User = Depends(deps.get_current_admin),
) -> Any:
    """Get list of users with pagination and filters (admin only)."""
    from asyncio.log import logger
    
    # Build query with eager loading of roles
    query = select(User).options(selectinload(User.roles))
    
    # Apply filters
    if search:
        query = query.where(
            or_(
                User.username.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.first_name.ilike(f"%{search}%"),
                User.last_name.ilike(f"%{search}%"),
            )
        )
    
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    
    if role:
        query = query.where(User.roles.any(Role.code == role))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    # Apply pagination
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()
    
    # Convert users to response format
    user_list = []
    for user in users:
        user_list.append({
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "middle_name": getattr(user, "middle_name", "") or "",
            "phone": user.phone or "",
            "roles": [r.code for r in user.roles] if user.roles else [],
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        })
    
    logger.info(f"Admin {current_user.username} fetched {len(user_list)} users")
    
    return {
        "items": user_list,
        "total": total or 0,
        "page": page,
        "limit": limit,
    }


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
    current_user: User = Depends(deps.get_current_admin)
) -> Any:
    """Create new user. Admin only."""
    from asyncio.log import logger
    
    # Check if user exists by email
    user_exists = await user_crud.get_by_email(db, email=user_in.email)
    if user_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Check if user exists by username
    if user_in.username:
        user_exists = await user_crud.get_by_username(db, username=user_in.username)
        if user_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this username already exists"
            )
    
    # Create user
    new_user = await user_crud.create_with_roles(
        db,
        email=user_in.email,
        username=user_in.username,
        full_name=f"{user_in.first_name or ''} {user_in.last_name or ''}".strip() or user_in.username,
        password=user_in.password,
        roles=user_in.roles or ["user"],
        is_verified=user_in.is_verified or False
    )
    
    if not new_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    await db.commit()
    await db.refresh(new_user)
    
    logger.info(f"Admin {current_user.username} created user: {new_user.username}")
    
    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        username=new_user.username,
        first_name=new_user.first_name or "",
        last_name=new_user.last_name or "",
        middle_name=getattr(new_user, "middle_name", "") or "",
        phone=new_user.phone or "",
        is_active=new_user.is_active,
        is_verified=new_user.is_verified,
        created_at=new_user.created_at,
        updated_at=new_user.updated_at
    )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user_by_admin(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_id: str,
    user_in: UserUpdate,
    current_user: User = Depends(deps.get_current_admin)
) -> Any:
    """Update user. Admin only."""
    from asyncio.log import logger
    
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Get user WITHOUT filtering by active status
    # Use a direct query instead of user_crud.get if it filters inactive users
    result = await db.execute(
        select(User).where(User.id == user_uuid)
    )
    target_user = result.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User not found with ID: {user_id}"
        )
    
    # Update user fields
    update_data = user_in.dict(exclude_unset=True)
    logger.info(f"Updating user {target_user.username} with data: {update_data}")
    
    for field, value in update_data.items():
        if value is not None and hasattr(target_user, field):
            setattr(target_user, field, value)
    
    target_user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(target_user)
    
    logger.info(f"Admin {current_user.username} updated user: {target_user.username} (active: {target_user.is_active})")
    
    return UserResponse(
        id=target_user.id,
        email=target_user.email,
        username=target_user.username,
        first_name=target_user.first_name or "",
        last_name=target_user.last_name or "",
        middle_name=getattr(target_user, "middle_name", "") or "",
        phone=target_user.phone or "",
        is_active=target_user.is_active,
        is_verified=target_user.is_verified,
        created_at=target_user.created_at,
        updated_at=target_user.updated_at
    )
@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user_by_admin(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_id: str,
    current_user: User = Depends(deps.get_current_admin)
) -> Any:
    """Delete user. Admin only."""
    from asyncio.log import logger
    
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Prevent self-deletion
    if user_uuid == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )
    
    # Get user
    target_user = await user_crud.get(db, id=user_uuid)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    await db.delete(target_user)
    await db.commit()
    
    logger.info(f"Admin {current_user.username} deleted user: {target_user.username}")
    
    return MessageResponse(message="User deleted successfully")


@router.post("/users/{user_id}/reset-password", response_model=MessageResponse)
async def reset_user_password(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_id: str,
    password_data: dict,
    current_user: User = Depends(deps.get_current_admin)
) -> Any:
    """Reset user password (admin only)."""
    from asyncio.log import logger
    
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Get user
    target_user = await user_crud.get(db, id=user_uuid)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    new_password = password_data.get("new_password")
    if not new_password or len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
    
    # Update password
    target_user.hashed_password = get_password_hash(new_password)
    target_user.password_changed_at = datetime.now(timezone.utc)
    await db.commit()
    
    logger.info(f"Admin {current_user.username} reset password for user: {target_user.username}")
    
    return MessageResponse(message="Password reset successfully")


@router.put("/users/{user_id}/roles", response_model=UserResponse)
async def update_user_roles(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_id: str,
    role_names: List[str],  # The body is a list directly
    current_user: User = Depends(deps.get_current_admin)
) -> Any:
    """Update user roles. Admin only."""
    from asyncio.log import logger
    
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Get user with roles using eager loading
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == user_uuid)
    )
    target_user = result.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Clear existing roles
    target_user.roles.clear()
    
    # Add new roles
    for role_name in role_names:
        # Get role by code/name
        result = await db.execute(
            select(Role).where(Role.code == role_name)
        )
        role_obj = result.scalar_one_or_none()
        if role_obj:
            target_user.roles.append(role_obj)
    
    target_user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(target_user)
    
    logger.info(f"Admin {current_user.username} updated roles for user: {target_user.username}")
    
    return UserResponse(
        id=target_user.id,
        email=target_user.email,
        username=target_user.username,
        first_name=target_user.first_name or "",
        last_name=target_user.last_name or "",
        middle_name=getattr(target_user, "middle_name", "") or "",
        phone=target_user.phone or "",
        is_active=target_user.is_active,
        is_verified=target_user.is_verified,
        roles=[role.code for role in target_user.roles],
        created_at=target_user.created_at,
        updated_at=target_user.updated_at
    )


@router.get("/reports/user-statistics")
async def get_user_statistics(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin)
) -> Any:
    """Get user statistics. Admin only."""
    from asyncio.log import logger
    
    # Count users
    result = await db.execute(select(func.count()).select_from(User))
    total_users = result.scalar() or 0
    
    result = await db.execute(select(func.count()).select_from(User).where(User.is_active == True))
    active_users = result.scalar() or 0
    
    result = await db.execute(select(func.count()).select_from(User).where(User.is_verified == True))
    verified_users = result.scalar() or 0
    
    # Count by roles
    result = await db.execute(
        select(func.count()).select_from(User).where(User.roles.any(Role.code == 'admin'))
    )
    admin_users = result.scalar() or 0
    
    logger.info(f"Admin {current_user.username} fetched user statistics")
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "inactive_users": total_users - active_users,
        "verified_users": verified_users,
        "unverified_users": total_users - verified_users,
        "admin_users": admin_users
    }


@router.get("/roles", response_model=List[RoleResponse])
async def get_roles(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin)
) -> Any:
    """Get all roles. Admin only."""
    from asyncio.log import logger
    
    roles = await role_crud.get_multi(db)
    
    logger.info(f"Admin {current_user.username} fetched {len(roles)} roles")
    
    return [
        RoleResponse(
            id=role.id,
            name=role.name,
            code=role.code,
            description=role.description,
            is_system_role=role.is_system_role,
            priority=role.priority,
            created_at=role.created_at,
            updated_at=role.updated_at
        )
        for role in roles
    ]