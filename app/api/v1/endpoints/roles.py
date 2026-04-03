# app/api/v1/endpoints/roles.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from app.api import deps
from app.models.user import User
from app.models.role import Role, Permission
from app.db.base import get_db
from app.schemas.role import RoleResponse, RoleCreate, RoleUpdate

router = APIRouter()


# ==================== GET ROLES ENDPOINTS ====================

@router.get("/", response_model=List[RoleResponse])
async def get_roles(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    code: Optional[str] = Query(None, description="Filter by role code"),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """
    Get all roles (admin only).
    """
    query = select(Role)
    
    if code:
        query = query.where(Role.code == code)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    roles = result.scalars().all()
    
    return roles


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """
    Get a specific role by ID (admin only).
    """
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    return role


@router.get("/code/{code}", response_model=RoleResponse)
async def get_role_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """
    Get a specific role by code (admin only).
    """
    result = await db.execute(select(Role).where(Role.code == code))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with code '{code}' not found"
        )
    return role


# ==================== CREATE/UPDATE/DELETE ROLES ====================

@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_in: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """
    Create a new role (admin only).
    """
    # Check if role with same code exists
    result = await db.execute(select(Role).where(Role.code == role_in.code))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role with code '{role_in.code}' already exists"
        )
    
    role = Role(
        code=role_in.code,
        name=role_in.name,
        description=role_in.description,
        is_active=role_in.is_active
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    
    return role


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: UUID,
    role_in: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """
    Update a role (admin only).
    """
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    update_data = role_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(role, field, value)
    
    await db.commit()
    await db.refresh(role)
    
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """
    Delete a role (admin only).
    """
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    await db.delete(role)
    await db.commit()
    
    return None


# ==================== ROLE PERMISSIONS ENDPOINTS ====================

@router.post("/{role_id}/permissions")
async def assign_permissions_to_role(
    *,
    db: AsyncSession = Depends(get_db),
    role_id: UUID,
    permission_ids: List[UUID],
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Assign permissions to a role - Admin only"""
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Get permissions
    result = await db.execute(
        select(Permission).where(Permission.id.in_(permission_ids))
    )
    permissions = result.scalars().all()
    
    # Assign to role
    role.permissions = permissions
    await db.commit()
    
    return {"message": f"Assigned {len(permissions)} permissions to role {role.name}"}


@router.delete("/{role_id}/permissions/{permission_id}")
async def remove_permission_from_role(
    *,
    db: AsyncSession = Depends(get_db),
    role_id: UUID,
    permission_id: UUID,
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Remove a permission from a role - Admin only"""
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Remove permission
    role.permissions = [p for p in role.permissions if p.id != permission_id]
    await db.commit()
    
    return {"message": "Permission removed successfully"}


@router.post("/admin/permissions/bulk")
async def bulk_create_permissions(
    *,
    db: AsyncSession = Depends(get_db),
    permissions: List[dict],
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Bulk create permissions from JSON configuration - Admin only"""
    
    created = []
    skipped = []
    
    for perm_data in permissions:
        # Validate permission structure
        if not all(k in perm_data for k in ["resource", "action"]):
            skipped.append({"data": perm_data, "reason": "Missing resource or action"})
            continue
        
        perm_name = f"{perm_data['resource']}:{perm_data['action']}"
        
        # Check if already exists
        result = await db.execute(
            select(Permission).where(Permission.name == perm_name)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            skipped.append({"name": perm_name, "reason": "Already exists"})
            continue
        
        perm = Permission(
            name=perm_name,
            resource=perm_data['resource'],
            action=perm_data['action'],
            description=perm_data.get('description', ''),
            conditions=perm_data.get('conditions', {})
        )
        
        db.add(perm)
        created.append(perm_name)
    
    await db.commit()
    
    return {
        "created": created,
        "created_count": len(created),
        "skipped": skipped,
        "skipped_count": len(skipped)
    }