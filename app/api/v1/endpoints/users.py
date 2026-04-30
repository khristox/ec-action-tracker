# app/api/v1/endpoints/users.py

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.crud.user import user as user_crud
from app.crud.role import role as role_crud
from app.models.user import User
from app.models.role import Role
from app.schemas.user import UserResponse, UserCreate, UserUpdate, UserWithRoles
from app.schemas.role import RoleResponse

router = APIRouter()


@router.get("/available", response_model=List[UserResponse])
async def get_available_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by name, email, or username"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),  # Not admin-only
) -> List[UserResponse]:
    """
    Get available users for adding to meetings.
    Accessible to any authenticated user.
    """
    # Only return active users
    query = select(User).where(User.is_active == True)
    
    # Add search filter if provided
    if search and len(search.strip()) >= 2:
        search_term = f"%{search.strip()}%"
        search_filter = or_(
            User.first_name.ilike(search_term),
            User.last_name.ilike(search_term),
            User.email.ilike(search_term),
            User.username.ilike(search_term),
            User.phone.ilike(search_term),
            func.concat(User.first_name, ' ', User.last_name).ilike(search_term)
        )
        query = query.where(search_filter)
    
    # Add pagination
    query = query.offset(skip).limit(limit).order_by(User.first_name, User.last_name)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=user.id,
            email='xxxx',
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            middle_name=user.middle_name,
            phone='xxxx',
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
        for user in users
    ]

@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    active_only: bool = Query(True, description="Filter to only active users"),
    is_active: Optional[bool] = Query(None, description="Alias for active_only (overrides active_only if provided)"),
    search: Optional[str] = Query(None, description="Search by name, email, or username"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> List[UserResponse]:
    """
    Get all users (admin only).
    Supports searching by first_name, last_name, email, or username.
    
    - Use `active_only=true` to get only active users
    - Use `active_only=false` to get all users
    - `is_active` can be used as an alias for `active_only`
    """
    # Determine active filter - is_active takes precedence if provided
    if is_active is not None:
        filter_active = is_active
    else:
        filter_active = active_only
    
    # Build the base query
    if filter_active:
        query = select(User).where(User.is_active == True)
    else:
        query = select(User)
    
    # Add search filter if provided
    if search and len(search.strip()) >= 2:
        search_term = f"%{search.strip()}%"
        search_filter = or_(
            User.first_name.ilike(search_term),
            User.last_name.ilike(search_term),
            User.email.ilike(search_term),
            User.username.ilike(search_term),
            User.phone.ilike(search_term),
            # Search full name (first + last)
            func.concat(User.first_name, ' ', User.last_name).ilike(search_term)
        )
        query = query.where(search_filter)
    
    # Add pagination
    query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            middle_name=user.middle_name,
            phone=user.phone,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
        for user in users
    ]
@router.get("/{user_id}", response_model=UserWithRoles)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> UserWithRoles:
    """
    Get a specific user by ID (admin only).
    """
    user = await user_crud.get_with_roles(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get user's roles
    roles = await user_crud.get_roles(db, user_id)
    
    return UserWithRoles(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        middle_name=user.middle_name,
        phone=user.phone,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at,
        updated_at=user.updated_at,
        roles=[
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
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> UserResponse:
    """
    Update a user (admin only).
    """
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update user fields
    update_data = user_data.dict(exclude_unset=True)
    updated_user = await user_crud.update(db, db_obj=user, obj_in=update_data)
    
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )
    
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


@router.delete("/{user_id}", response_model=dict)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """
    Delete a user (admin only).
    """
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    success = await user_crud.delete(db, id=user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )
    
    return {"message": "User deleted successfully"}


@router.post("/{user_id}/roles/{role_id}")
async def assign_role_to_user(
    user_id: UUID,
    role_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """
    Assign a role to a user (admin only).
    """
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    role = await role_crud.get(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    success = await user_crud.add_role(db, user_id, role_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign role"
        )
    
    return {"message": f"Role '{role.name}' assigned to user '{user.username}'"}


@router.delete("/{user_id}/roles/{role_id}")
async def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """
    Remove a role from a user (admin only).
    """
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    role = await role_crud.get(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    success = await user_crud.remove_role(db, user_id, role_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove role"
        )
    
    return {"message": f"Role '{role.name}' removed from user '{user.username}'"}




def mask_email(email: str) -> str:
    if not email:
        return None
    parts = email.split('@')
    if len(parts) != 2:
        return email
    local, domain = parts
    if len(local) <= 3:
        masked_local = local[0] + '***'
    else:
        masked_local = local[:3] + '***' + local[-2:]
    return f"{masked_local}@{domain}"


def mask_phone(phone: str) -> str:
    if not phone:
        return None
    cleaned = ''.join(filter(str.isdigit, phone))
    if len(cleaned) <= 4:
        return '****'
    return '*' * (len(cleaned) - 4) + cleaned[-4:]


@router.get("/users/search")
async def search_users(
    search: str = Query(..., min_length=2, description="Search by name, email, or username"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Search for users by name, email, or username (excludes current user)"""
    
    search_term = f"%{search}%"
    
    query = select(User).where(
        User.id != current_user.id,
        User.is_active == True,
        or_(
            User.full_name.ilike(search_term),
            User.username.ilike(search_term),
            User.email.ilike(search_term),
            User.first_name.ilike(search_term),
            User.last_name.ilike(search_term)
        )
    ).limit(limit)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [
        {
            "id": str(user.id),
            "name": user.full_name or f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
            "email": user.email,
            "telephone": getattr(user, 'telephone', None) or getattr(user, 'phone', None),
            "masked_email": mask_email(user.email),
            "masked_telephone": mask_phone(getattr(user, 'telephone', None) or getattr(user, 'phone', None)),
            "username": user.username
        }
        for user in users
    ]


@router.get("/users/by-id/{user_id}")
async def get_user_by_id(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get user by ID with masked contact info"""
    
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user.id),
        "name": user.full_name or f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
        "email": user.email,
        "telephone": getattr(user, 'telephone', None) or getattr(user, 'phone', None),
        "masked_email": mask_email(user.email),
        "masked_telephone": mask_phone(getattr(user, 'telephone', None) or getattr(user, 'phone', None)),
        "username": user.username
    }