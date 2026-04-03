# app/api/v1/endpoints/menus.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Set
from uuid import UUID
from datetime import datetime
from app.api import deps
from app.models.user import User
from app.models.role import Role
from app.models.menu import Menu, RoleMenuPermission
from app.crud.menu import menu, role_menu_permission
from app.schemas.menu import (
    MenuCreate, MenuUpdate, MenuResponse, MenuTreeResponse,
    RoleMenuPermissionCreate, RoleMenuPermissionUpdate,
    RoleMenuPermissionResponse, BatchRoleMenuPermissionUpdate
)
from app.core.config import settings

router = APIRouter()




# ==================== MOBILE BOTTOM NAVIGATION CONFIGURATION ====================

# Define which menus should show on mobile bottom navigation for each role
MOBILE_BOTTOM_NAV_CONFIG: Dict[str, Set[str]] = {
    "admin": {
        "dashboard", "properties", "tenants", "payments", "calendar"
    },
    "property_manager": {
        "dashboard", "properties", "tenants", "payments", "calendar"
    },
    "landlord": {
        "dashboard", "properties", "tenants", "payments", "calendar"
    },
    "tenant": {
        "dashboard", "payments", "maintenance", "calendar", "documents"
    },
    "accountant": {
        "dashboard", "payments", "reports", "analytics", "calendar"
    },
    "user": {
        "dashboard", "properties", "payments", "calendar"
    }
}

# Menus that should NEVER show on mobile bottom navigation
NEVER_MOBILE_BOTTOM = {
    "settings", "profile", "security", "notifications", "preferences",
    "users", "roles", "audit", "backup", "api_keys",
    "structures", "units", "leases"
}

def should_show_mobile_bottom(role_code: str, menu_code: str) -> bool:
    """Determine if a menu should show on mobile bottom navigation for a role."""
    if menu_code in NEVER_MOBILE_BOTTOM:
        return False
    
    if role_code in MOBILE_BOTTOM_NAV_CONFIG:
        return menu_code in MOBILE_BOTTOM_NAV_CONFIG[role_code]
    
    return menu_code in {"dashboard", "payments"}

# ==================== MENU ENDPOINTS ====================

# app/api/v1/endpoints/menus.py

@router.get("/", response_model=List[MenuTreeResponse])
async def get_menus(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    hierarchy: bool = Query(True, description="Return hierarchical structure"),
    flat: bool = Query(False, description="Return flat list instead of hierarchy"),
    include_inactive: bool = Query(False, description="Include inactive menus"),
) -> List[MenuTreeResponse]:
    """Get all menus accessible to the current user with their permissions."""
    from sqlalchemy import and_
    
    # Get user's role IDs
    user_role_ids = [role.id for role in current_user.roles]
    
    if not user_role_ids:
        return []
    
    # Get all permissions for the user's roles
    perm_result = await db.execute(
        select(RoleMenuPermission)
        .options(selectinload(RoleMenuPermission.menu))
        .where(
            and_(
                RoleMenuPermission.role_id.in_(user_role_ids),
                RoleMenuPermission.can_view == True
            )
        )
    )
    permissions = perm_result.scalars().all()
    
    # Build a map of menu_id -> permission
    permission_map = {}
    for perm in permissions:
        if perm.menu_id not in permission_map:
            permission_map[perm.menu_id] = perm
    
    # Get unique menus from permissions
    menus = []
    for perm in permissions:
        if perm.menu and perm.menu.is_active:
            menus.append(perm.menu)
    
    # Remove duplicates (in case user has multiple roles)
    seen_ids = set()
    unique_menus = []
    for menu in menus:
        if menu.id not in seen_ids:
            seen_ids.add(menu.id)
            unique_menus.append(menu)
    menus = unique_menus
    
    if hierarchy and not flat:
        # Build hierarchy with permission data
        return build_menu_hierarchy_with_permissions(menus, permission_map)
    else:
        # Return flat list with permission data
        return [build_menu_response_with_permissions(menu, permission_map.get(menu.id)) for menu in menus]


def build_menu_response_with_permissions(menu: Menu, permission: Optional[RoleMenuPermission]) -> MenuResponse:
    """Build a MenuResponse with permission data."""
    return MenuResponse(
        id=menu.id,
        code=menu.code,
        title=menu.title,
        icon=menu.icon,
        path=menu.path,
        parent_id=menu.parent_id,
        sort_order=menu.sort_order,
        is_active=menu.is_active,
        requires_auth=menu.requires_auth,
        target=menu.target,
        badge=menu.badge,
        created_at=menu.created_at,
        updated_at=menu.updated_at,
        children=[],
        can_view=permission.can_view if permission else True,
        can_access=permission.can_access if permission else True,
        can_show_mb_bottom=permission.can_show_mb_bottom if permission else False,
        level=0,
        has_children=bool(menu.children)
    )


def build_menu_hierarchy_with_permissions(menus: List[Menu], permission_map: Dict[UUID, RoleMenuPermission]) -> List[MenuTreeResponse]:
    """Build hierarchical menu structure with permission data."""
    menu_dict = {}
    root_menus = []
    
    # First pass: create all menu responses
    for menu in menus:
        permission = permission_map.get(menu.id)
        menu_response = MenuResponse(
            id=menu.id,
            code=menu.code,
            title=menu.title,
            icon=menu.icon,
            path=menu.path,
            parent_id=menu.parent_id,
            sort_order=menu.sort_order,
            is_active=menu.is_active,
            requires_auth=menu.requires_auth,
            target=menu.target,
            badge=menu.badge,
            created_at=menu.created_at,
            updated_at=menu.updated_at,
            children=[],
            can_view=permission.can_view if permission else True,
            can_access=permission.can_access if permission else True,
            can_show_mb_bottom=permission.can_show_mb_bottom if permission else False,
            level=0,
            has_children=False
        )
        menu_dict[menu.id] = menu_response
    
    # Second pass: build hierarchy
    for menu in menus:
        menu_response = menu_dict[menu.id]
        if menu.parent_id and menu.parent_id in menu_dict:
            parent = menu_dict[menu.parent_id]
            parent.children.append(menu_response)
            parent.has_children = True
        else:
            root_menus.append(menu_response)
    
    # Sort children by sort_order
    for menu_response in menu_dict.values():
        if menu_response.children:
            menu_response.children.sort(key=lambda x: x.sort_order)
    
    # Sort root menus
    root_menus.sort(key=lambda x: x.sort_order)
    
    # Set levels
    def set_level(menus_list, level=0):
        for menu in menus_list:
            menu.level = level
            if menu.children:
                set_level(menu.children, level + 1)
    
    set_level(root_menus)
    
    return root_menus

@router.get("/all", response_model=List[MenuResponse])
async def get_all_menus_admin(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    include_inactive: bool = Query(False, description="Include inactive menus"),
) -> List[MenuResponse]:
    """Get all menus (admin only)."""
    if not any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    query = select(Menu).options(
        selectinload(Menu.children)
    ).order_by(Menu.sort_order)
    
    if not include_inactive:
        query = query.where(Menu.is_active == True)
    
    if skip:
        query = query.offset(skip)
    if limit:
        query = query.limit(limit)
    
    result = await db.execute(query)
    menus = result.scalars().all()
    return menus

@router.get("/flat", response_model=List[MenuResponse])
async def get_flat_menus(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    include_inactive: bool = Query(False, description="Include inactive menus"),
) -> List[MenuResponse]:
    """Get flat list of menus accessible to the current user."""
    role_ids = [role.id for role in current_user.roles]
    all_menus = await menu.get_all(db, active_only=not include_inactive)
    
    if role_ids:
        result = await db.execute(
            select(RoleMenuPermission.menu_id).where(
                RoleMenuPermission.role_id.in_(role_ids),
                RoleMenuPermission.can_view == True
            )
        )
        allowed_menu_ids = {row[0] for row in result.all()}
        menus = [m for m in all_menus if m.id in allowed_menu_ids]
    else:
        menus = all_menus
    
    return menus

@router.get("/{menu_id}", response_model=MenuResponse)
async def get_menu(
    menu_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> MenuResponse:
    """Get a specific menu by ID."""
    menu_item = await menu.get(db, menu_id)
    if not menu_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found"
        )
    
    user_role_ids = [role.id for role in current_user.roles]
    has_permission = False
    
    if any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        has_permission = True
    else:
        for perm in menu_item.role_permissions:
            if perm.role_id in user_role_ids and perm.can_view:
                has_permission = True
                break
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this menu"
        )
    
    return menu_item

@router.post("/", response_model=MenuResponse, status_code=status.HTTP_201_CREATED)
async def create_menu(
    menu_in: MenuCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> MenuResponse:
    """Create a new menu (admin only)."""
    if not any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    existing = await menu.get_by_code(db, menu_in.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Menu with code '{menu_in.code}' already exists"
        )
    
    if menu_in.parent_id:
        parent = await menu.get(db, menu_in.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent menu not found"
            )
    
    new_menu = await menu.create(db, menu_in)
    await db.refresh(new_menu)
    
    return MenuResponse(
        id=new_menu.id,
        code=new_menu.code,
        title=new_menu.title,
        icon=new_menu.icon,
        path=new_menu.path,
        parent_id=new_menu.parent_id,
        sort_order=new_menu.sort_order,
        is_active=new_menu.is_active,
        requires_auth=new_menu.requires_auth,
        target=new_menu.target,
        badge=new_menu.badge,
        created_at=new_menu.created_at,
        updated_at=new_menu.updated_at,
        children=[]
    )

@router.put("/{menu_id}", response_model=MenuResponse)
async def update_menu(
    menu_id: UUID,
    menu_in: MenuUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> MenuResponse:
    """Update a menu (admin only)."""
    if not any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    menu_item = await menu.get(db, menu_id)
    if not menu_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found"
        )
    
    if menu_in.code and menu_in.code != menu_item.code:
        existing = await menu.get_by_code(db, menu_in.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Menu with code '{menu_in.code}' already exists"
            )
    
    updated_menu = await menu.update(db, menu_id, menu_in)
    return updated_menu

@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu(
    menu_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    cascade: bool = Query(False, description="Also delete child menus"),
):
    """Delete a menu (admin only)."""
    if not any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    deleted = await menu.delete(db, menu_id, cascade=cascade)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found"
        )
    
    return None

# ==================== ROLE MENU PERMISSIONS ENDPOINTS ====================

@router.get("/permissions/role/{role_id}", response_model=List[RoleMenuPermissionResponse])
async def get_role_menu_permissions(
    role_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> List[RoleMenuPermissionResponse]:
    """Get all menu permissions for a specific role (admin only)."""
    if not any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(
        select(RoleMenuPermission)
        .options(
            selectinload(RoleMenuPermission.menu),
            selectinload(RoleMenuPermission.role)
        )
        .where(RoleMenuPermission.role_id == role_id)
    )
    permissions = result.scalars().all()
    return [RoleMenuPermissionResponse.model_validate(p, from_attributes=True) for p in permissions]

@router.post("/permissions", response_model=RoleMenuPermissionResponse)
async def assign_menu_permission(
    permission_in: RoleMenuPermissionCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> RoleMenuPermissionResponse:
    """Assign a menu permission to a role with automatic can_show_mb_bottom logic."""
    if not any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Get role and menu
    role_result = await db.execute(select(Role).where(Role.id == permission_in.role_id))
    role = role_result.scalar_one_or_none()
    
    menu_result = await db.execute(select(Menu).where(Menu.id == permission_in.menu_id))
    menu_item = menu_result.scalar_one_or_none()
    
    if not role or not menu_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role or menu not found"
        )
    
    # Auto-determine can_show_mb_bottom
    can_show_mb_bottom = permission_in.can_show_mb_bottom
    if can_show_mb_bottom is None:
        can_show_mb_bottom = should_show_mobile_bottom(role.code, menu_item.code)
    
    permission = await role_menu_permission.set_permission(
        db,
        role_id=permission_in.role_id,
        menu_id=permission_in.menu_id,
        can_view=permission_in.can_view,
        can_access=permission_in.can_access,
        can_show_mb_bottom=can_show_mb_bottom
    )
    return permission

@router.put("/permissions/{permission_id}", response_model=RoleMenuPermissionResponse)
async def update_menu_permission(
    permission_id: UUID,
    permission_in: RoleMenuPermissionUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> RoleMenuPermissionResponse:
    """Update a menu permission with automatic can_show_mb_bottom logic."""
    if not any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    result = await db.execute(
        select(RoleMenuPermission)
        .options(
            selectinload(RoleMenuPermission.role),
            selectinload(RoleMenuPermission.menu)
        )
        .where(RoleMenuPermission.id == permission_id)
    )
    permission = result.scalar_one_or_none()
    
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    update_data = permission_in.model_dump(exclude_unset=True)
    
    if 'can_show_mb_bottom' not in update_data and permission.role and permission.menu:
        update_data['can_show_mb_bottom'] = should_show_mobile_bottom(
            permission.role.code, 
            permission.menu.code
        )
    
    for field, value in update_data.items():
        setattr(permission, field, value)
    
    await db.commit()
    await db.refresh(permission)
    return permission

@router.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_menu_permission(
    permission_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Remove a menu permission (admin only)."""
    if not any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    result = await db.execute(
        delete(RoleMenuPermission).where(RoleMenuPermission.id == permission_id)
    )
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    return None

# ==================== MOBILE BOTTOM NAVIGATION ENDPOINTS ====================

@router.get("/mobile-bottom/my-menus", response_model=List[MenuResponse])
async def get_my_mobile_bottom_menus(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> List[MenuResponse]:
    """Get mobile bottom navigation menus for the current user."""
    user_role_ids = [role.id for role in current_user.roles]
    
    result = await db.execute(
        select(RoleMenuPermission)
        .options(selectinload(RoleMenuPermission.menu))
        .where(
            RoleMenuPermission.role_id.in_(user_role_ids),
            RoleMenuPermission.can_show_mb_bottom == True,
            RoleMenuPermission.can_view == True
        )
    )
    permissions = result.scalars().all()
    
    menus_dict = {}
    for perm in permissions:
        if perm.menu and perm.menu.id not in menus_dict and perm.menu.is_active:
            menus_dict[perm.menu.id] = perm.menu
    
    menus = sorted(menus_dict.values(), key=lambda m: m.sort_order)
    return menus

@router.post("/permissions/sync-mobile-bottom")
async def sync_mobile_bottom_permissions(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    dry_run: bool = Query(False, description="If true, only show what would change"),
) -> dict:
    """
    Synchronize can_show_mb_bottom permissions based on current configuration.
    Call this after running your seed script to fix can_show_mb_bottom values.
    """
    if not any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Get all roles
    role_result = await db.execute(select(Role))
    roles = role_result.scalars().all()
    role_dict = {r.id: r for r in roles}
    
    # Get all menus
    menu_result = await db.execute(select(Menu))
    menus = {m.id: m for m in menu_result.scalars().all()}
    
    # Get all permissions
    perm_result = await db.execute(select(RoleMenuPermission))
    permissions = perm_result.scalars().all()
    
    changes = []
    updates = 0
    
    for permission in permissions:
        role = role_dict.get(permission.role_id)
        menu = menus.get(permission.menu_id)
        
        if not role or not menu:
            continue
        
        expected_value = should_show_mobile_bottom(role.code, menu.code)
        
        if permission.can_show_mb_bottom != expected_value:
            changes.append({
                "role_code": role.code,
                "menu_code": menu.code,
                "current_value": permission.can_show_mb_bottom,
                "expected_value": expected_value
            })
            
            if not dry_run:
                permission.can_show_mb_bottom = expected_value
                updates += 1
    
    if not dry_run and updates > 0:
        await db.commit()
    
    return {
        "dry_run": dry_run,
        "changes_found": len(changes),
        "updates_performed": updates if not dry_run else 0,
        "changes": changes[:100]
    }

@router.get("/mobile-bottom/config", response_model=Dict)
async def get_mobile_bottom_config(
    current_user: User = Depends(deps.get_current_user),
) -> dict:
    """Get the mobile bottom navigation configuration for debugging."""
    if not any(role.code in ["admin", "super_admin"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return {
        "config": {k: list(v) for k, v in MOBILE_BOTTOM_NAV_CONFIG.items()},
        "never_show": list(NEVER_MOBILE_BOTTOM)
    }