# app/api/v1/endpoints/permissions.py

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.crud.permission import permission as permission_crud
from app.models.user import User
from app.models.role import Permission
from app.schemas.permission import PermissionCreate, PermissionUpdate, PermissionResponse

router = APIRouter()


@router.get("/", response_model=List[PermissionResponse])
async def get_permissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    resource: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
) -> List[PermissionResponse]:
    """
    Get all permissions (admin only).
    """
    permissions = await permission_crud.get_multi(
        db, skip=skip, limit=limit, resource=resource
    )
    
    return [
        PermissionResponse(
            id=perm.id,
            name=perm.name,
            code=perm.code,
            resource=perm.resource,
            action=perm.action,
            description=perm.description,
            is_system=perm.is_system,
            created_at=perm.created_at,
            updated_at=perm.updated_at
        )
        for perm in permissions
    ]


@router.get("/{permission_id}", response_model=PermissionResponse)
async def get_permission(
    permission_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
) -> PermissionResponse:
    """
    Get a specific permission by ID (admin only).
    """
    permission = await permission_crud.get(db, permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    return PermissionResponse(
        id=permission.id,
        name=permission.name,
        code=permission.code,
        resource=permission.resource,
        action=permission.action,
        description=permission.description,
        is_system=permission.is_system,
        created_at=permission.created_at,
        updated_at=permission.updated_at
    )


@router.post("/", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
async def create_permission(
    permission_in: PermissionCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
) -> PermissionResponse:
    """
    Create a new permission (admin only).
    """
    # Check if permission already exists
    existing = await permission_crud.get_by_code(db, permission_in.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission with this code already exists"
        )
    
    permission = await permission_crud.create(db, obj_in=permission_in)
    
    return PermissionResponse(
        id=permission.id,
        name=permission.name,
        code=permission.code,
        resource=permission.resource,
        action=permission.action,
        description=permission.description,
        is_system=permission.is_system,
        created_at=permission.created_at,
        updated_at=permission.updated_at
    )


@router.put("/{permission_id}", response_model=PermissionResponse)
async def update_permission(
    permission_id: UUID,
    permission_in: PermissionUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
) -> PermissionResponse:
    """
    Update a permission (admin only).
    """
    permission = await permission_crud.get(db, permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    # Prevent modification of system permissions if needed
    if permission.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system permissions"
        )
    
    updated_permission = await permission_crud.update(
        db, db_obj=permission, obj_in=permission_in
    )
    
    return PermissionResponse(
        id=updated_permission.id,
        name=updated_permission.name,
        code=updated_permission.code,
        resource=updated_permission.resource,
        action=updated_permission.action,
        description=updated_permission.description,
        is_system=updated_permission.is_system,
        created_at=updated_permission.created_at,
        updated_at=updated_permission.updated_at
    )


@router.delete("/{permission_id}", response_model=dict)
async def delete_permission(
    permission_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
) -> dict:
    """
    Delete a permission (admin only).
    """
    permission = await permission_crud.get(db, permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    # Prevent deletion of system permissions
    if permission.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete system permissions"
        )
    
    success = await permission_crud.delete(db, id=permission_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete permission"
        )
    
    return {"message": "Permission deleted successfully"}