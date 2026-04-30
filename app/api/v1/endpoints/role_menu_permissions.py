# app/api/v1/endpoints/role_menu_permissions.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from uuid import UUID
from app.crud.role_menu import RoleMenuCRUD
from app.schemas.role_menu import (
    RoleMenuPermissionCreate,
    RoleMenuPermissionUpdate,
    BulkMenuAssignment,
    MenuAssignment
)
from app.api import deps
from app.models.user import User



import logging


logger = logging.getLogger(__name__)

router = APIRouter()

def handle_response(result: dict):
    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('error', 'Unknown error')
        )
    return result

# ============ Menu Tree and View Endpoints ============

@router.get(
    "/roles/{role_id}/menu-tree",
    operation_id="get_role_menu_tree_permissions"  # Unique operation_id
)
async def get_role_menu_tree(
    role_id: UUID,
    current_user: User = Depends(deps.require_roles(["admin", "super_admin", "auditor"]))
):
    """Get menu tree with permissions for a specific role"""
    result = await RoleMenuCRUD.get_role_menu_tree(role_id)
    return handle_response(result)

@router.get(
    "/roles/{role_id}/assignable-menus",
    operation_id="get_role_assignable_menus"  # Unique operation_id
)
async def get_assignable_menus(
    role_id: UUID,
    current_user: User = Depends(deps.require_roles(["admin", "super_admin"]))
):
    """Get all menus with assignment status for a role (for assignment form)"""
    result = await RoleMenuCRUD.get_assignable_menus(role_id)
    return handle_response(result)

@router.get(
    "/roles/{role_id}/permissions",
    operation_id="get_role_menu_permissions_list"  # Unique operation_id
)
async def get_role_permissions(
    role_id: UUID,
    current_user: User = Depends(deps.require_roles(["admin", "super_admin", "auditor"]))
):
    """Get all menu permissions for a role"""
    result = await RoleMenuCRUD.get_role_permissions(role_id)
    return handle_response(result)

# ============ Assignment Endpoints ============

@router.post(
    "/assign",
    status_code=status.HTTP_201_CREATED,
    operation_id="assign_single_menu_to_role"  # Unique operation_id
)
async def assign_menu_to_role(
    data: RoleMenuPermissionCreate,
    current_user: User = Depends(deps.require_roles(["admin", "super_admin"]))
):
    """Assign a single menu to a role"""
    logger.info(f"User {current_user.id} assigning menu {data.menu_id} to role {data.role_id}")
    result = await RoleMenuCRUD.assign_menu_to_role(
        data.role_id, 
        data.menu_id, 
        data.dict()
    )
    return handle_response(result)

@router.post(
    "/bulk-assign",
    status_code=status.HTTP_201_CREATED,
    operation_id="bulk_assign_menus_to_role"  # Unique operation_id
)
async def bulk_assign_menus_to_role(
    data: BulkMenuAssignment,
    current_user: User = Depends(deps.require_roles(["admin", "super_admin"]))
):
    """Bulk assign multiple menus to a role"""
    logger.info(f"User {current_user.id} bulk assigning {len(data.menus)} menus to role {data.role_id}")
    menus = [menu.dict() for menu in data.menus]
    result = await RoleMenuCRUD.bulk_assign_menus_to_role(data.role_id, menus)
    return handle_response(result)

@router.post(
    "/roles/{role_id}/sync",
    operation_id="sync_role_menus_assignment"  # Unique operation_id
)
async def sync_role_menus(
    role_id: UUID,
    menu_ids: List[str],
    current_user: User = Depends(deps.require_roles(["admin", "super_admin"]))
):
    """Sync role menus - replaces all existing menu assignments with new ones"""
    logger.info(f"User {current_user.id} syncing menus for role {role_id}")
    result = await RoleMenuCRUD.sync_role_menus(role_id, menu_ids)
    return handle_response(result)

# ============ Update and Remove Endpoints ============

@router.put(
    "/permissions/{permission_id}",
    operation_id="update_menu_permission_record"  # Unique operation_id
)
async def update_menu_permission(
    permission_id: UUID,
    update_data: RoleMenuPermissionUpdate,
    current_user: User = Depends(deps.require_roles(["admin", "super_admin"]))
):
    """Update a specific menu permission"""
    logger.info(f"User {current_user.id} updating permission {permission_id}")
    result = await RoleMenuCRUD.update_menu_permission(
        permission_id, 
        update_data.dict(exclude_none=True)
    )
    return handle_response(result)

@router.delete(
    "/roles/{role_id}/menus/{menu_id}",
    operation_id="remove_menu_permission_from_role"  # Unique operation_id
)
async def remove_menu_permission(
    role_id: UUID,
    menu_id: UUID,
    current_user: User = Depends(deps.require_roles(["admin", "super_admin"]))
):
    """Remove a specific menu permission from a role"""
    logger.info(f"User {current_user.id} removing menu {menu_id} from role {role_id}")
    result = await RoleMenuCRUD.remove_menu_permission(role_id, menu_id)
    return handle_response(result)

@router.delete(
    "/roles/{role_id}/permissions",
    operation_id="remove_all_role_menu_permissions"  # Unique operation_id
)
async def remove_all_role_permissions(
    role_id: UUID,
    current_user: User = Depends(deps.require_roles(["admin", "super_admin"]))
):
    """Remove all menu permissions from a role"""
    logger.info(f"User {current_user.id} removing all permissions from role {role_id}")
    result = await RoleMenuCRUD.remove_all_role_permissions(role_id)
    return handle_response(result)