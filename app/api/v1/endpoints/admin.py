# app/api/v1/endpoints/admin.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, List

from app.api import deps
from app.crud.user import user as user_crud
from app.crud.role import role as role_crud
from app.schemas.user import UserResponse, UserCreate
from app.schemas.role import RoleResponse
from app.models.user import User as UserModel

router = APIRouter()


# Admin-only endpoints (must have admin role)
@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
    current_user: UserModel = Depends(deps.get_current_admin)
) -> Any:
    """
    Create new user. Admin only.
    """
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
        roles=user_in.roles,
        is_verified=user_in.is_verified
    )
    
    if not new_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        username=new_user.username,
        first_name=new_user.first_name,
        last_name=new_user.last_name,
        middle_name=new_user.middle_name,
        phone=new_user.phone,
        is_active=new_user.is_active,
        is_verified=new_user.is_verified,
        created_at=new_user.created_at,
        updated_at=new_user.updated_at
    )


# Management endpoints - can be accessed by admin OR manager role
@router.put("/users/{user_id}/roles", response_model=UserResponse)
async def update_user_roles(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_id: str,
    role_names: List[str],
    current_user: UserModel = Depends(deps.get_current_admin)  # Use get_current_admin which checks for admin role
) -> Any:
    """
    Update user roles. Admin only.
    """
    import uuid
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    target_user = await user_crud.get_with_roles(db, user_uuid)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Clear existing roles
    for role_obj in target_user.roles:
        await user_crud.remove_role(db, user_uuid, role_obj.id)
    
    # Add new roles
    for role_name in role_names:
        role_obj = await role_crud.get_by_name(db, role_name)
        if role_obj:
            await user_crud.add_role(db, user_uuid, role_obj.id)
    
    # Refresh user
    updated_user = await user_crud.get_with_roles(db, user_uuid)
    
    return UserResponse(
        id=updated_user.id,
        email=updated_user.email,
        username=updated_user.username,
        first_name=updated_user.first_name,
        last_name=updated_user.last_name,
        middle_name=updated_user.middle_name,
        phone=updated_user.phone,
        is_active=updated_user.is_active,
        is_verified=updated_user.is_verified,
        created_at=updated_user.created_at,
        updated_at=updated_user.updated_at
    )


# Reporting endpoints - can be accessed by admin, manager, OR analyst
@router.get("/reports/user-statistics")
async def get_user_statistics(
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_admin)  # Admin only for now
) -> Any:
    """
    Get user statistics. Admin only.
    """
    total_users = await user_crud.count_users(db, active_only=False)
    active_users = await user_crud.count_users(db, active_only=True)
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "inactive_users": total_users - active_users
    }


# Get all roles - admin only
@router.get("/roles", response_model=List[RoleResponse])
async def get_roles(
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_admin)
) -> Any:
    """
    Get all roles. Admin only.
    """
    roles = await role_crud.get_multi(db)
    
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