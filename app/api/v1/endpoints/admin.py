# app/api/v1/endpoints/admin.py

from datetime import datetime, timezone
from typing import Any, List, Optional
import uuid

from app.models.meetings.user_department import UserDepartment
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
from app.schemas.user import DepartmentInfo, UserCreate, UserUpdate, UserResponse
from app.schemas.role import PermissionBrief, RoleResponse
from app.schemas.auth import MessageResponse

from app.models.user import user_roles 


router = APIRouter()


@router.get("/users", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    active_only: bool = Query(True),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    include_departments: bool = Query(True),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> List[UserResponse]:
    """Get all users (admin only)"""
    from sqlalchemy.orm import selectinload
    
    filter_active = is_active if is_active is not None else active_only
    
    query = select(User)
    
    if include_departments:
        query = query.options(
            selectinload(User.user_departments).selectinload(UserDepartment.department)
        )
    
    if filter_active:
        query = query.where(User.is_active == True)
    
    if search and len(search.strip()) >= 2:
        t = f"%{search.strip()}%"
        query = query.where(or_(
            User.first_name.ilike(t), 
            User.last_name.ilike(t),
            User.email.ilike(t), 
            User.username.ilike(t), 
            User.phone.ilike(t),
            func.concat(User.first_name, ' ', User.last_name).ilike(t)
        ))
    
    query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            username=u.username,
            first_name=u.first_name,
            last_name=u.last_name,
            middle_name=u.middle_name,
            phone=u.phone,
            is_active=u.is_active,
            is_verified=u.is_verified,
            is_superuser=u.is_superuser,
            created_at=u.created_at,
            updated_at=u.updated_at,
            departments=[
                DepartmentInfo(
                    id=ud.department.id,
                    name=ud.department.name,
                    code=ud.department.department_code,
                    role=ud.role,
                    is_primary=ud.is_primary
                )
                for ud in u.user_departments 
                if ud.department and ud.status == "active"
            ] if include_departments else []
        )
        for u in users
    ]

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
        is_verified=user_in.is_verified or False,
        is_superuser=user_in.is_superuser or False
    )
    
    if not new_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user 2"
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
        is_superuser=new_user.is_superuser,
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
    update_data = user_in.model_dump(exclude_unset=True)
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
        is_superuser=target_user.is_superuser,
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
        is_superuser=target_user.is_superuser,
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


@router.get("/", response_model=List[RoleResponse])
async def get_roles(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get all roles with their permissions.
    """
    # Eager load permissions to avoid N+1 queries
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))  # Add this line
        .offset(skip)
        .limit(limit)
        .order_by(Role.name)
    )
    roles = result.scalars().all()
    
    # Calculate user count for each role
    response_roles = []
    for role in roles:
        # Get user count (you might want to optimize this)
        user_count_result = await db.execute(
            select(func.count()).select_from(user_roles).where(user_roles.c.role_id == role.id)
        )
        user_count = user_count_result.scalar() or 0
        
        response_roles.append(
            RoleResponse(
                id=role.id,
                name=role.name,
                code=role.code,
                description=role.description,
                is_system_role=role.is_system_role,
                priority=role.priority,
                created_at=role.created_at,
                updated_at=role.updated_at,
                user_count=user_count,
                permissions=[  # Add permissions
                    PermissionBrief(
                        id=p.id,
                        name=p.name,
                        code=p.code,
                        resource=p.resource,
                        action=p.action,
                        category=getattr(p, 'category', None)
                    )
                    for p in role.permissions
                ]
            )
        )
    
    return response_roles