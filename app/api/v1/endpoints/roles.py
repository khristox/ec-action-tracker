# app/api/v1/endpoints/roles.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, func, select
from typing import List
from uuid import UUID

from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.user import User
from app.models.role import Role, Permission, role_permissions
from app.db.base import get_db
from app.schemas.role import PermissionBrief, RoleResponse, RoleCreate, RoleUpdate
from app.models.user import user_roles

router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────────────

async def _get_role_with_permissions(db: AsyncSession, role_id: UUID) -> Role | None:
    """Fetch a role with permissions eagerly loaded. Returns None if not found."""
    result = await db.execute(
        select(Role)
        .where(Role.id == role_id)
        .options(selectinload(Role.permissions))
    )
    return result.scalar_one_or_none()


async def _get_user_count(db: AsyncSession, role_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(user_roles)
        .where(user_roles.c.role_id == role_id)
    )
    return result.scalar() or 0


def _build_permission_brief(p: Permission) -> PermissionBrief:
    return PermissionBrief(
        id=p.id,
        name=p.name or "",
        code=p.code or "",
        resource=getattr(p, "resource", None),
        action=getattr(p, "action", None),
        category=getattr(p, "category", None),
    )


def _build_role_response(role: Role, user_count: int) -> RoleResponse:
    """Build a fully-populated RoleResponse from an ORM Role instance.

    All fields are set explicitly so Pydantic never falls back to a missing
    attribute (which produces the cryptic 'exception str() failed' error).
    """
    return RoleResponse(
        id=role.id,
        name=role.name,
        code=role.code,
        description=role.description,
        is_system_role=role.is_system_role if role.is_system_role is not None else False,
        priority=role.priority if role.priority is not None else 0,
       
        created_at=role.created_at,
        updated_at=role.updated_at,
        user_count=user_count,
        permissions=[_build_permission_brief(p) for p in (role.permissions or [])],
    )


# ── GET endpoints ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[RoleResponse])
async def get_roles(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all roles with their permissions."""
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .offset(skip)
        .limit(limit)
        .order_by(Role.name)
    )
    roles = result.scalars().all()

    response_roles = []
    for role in roles:
        user_count = await _get_user_count(db, role.id)
        response_roles.append(_build_role_response(role, user_count))

    return response_roles


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Get a specific role by ID (admin only)."""
    role = await _get_role_with_permissions(db, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    user_count = await _get_user_count(db, role_id)
    return _build_role_response(role, user_count)


@router.get("/code/{code}", response_model=RoleResponse)
async def get_role_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Get a specific role by code (admin only)."""
    result = await db.execute(
        select(Role)
        .where(Role.code == code)
        .options(selectinload(Role.permissions))
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with code '{code}' not found",
        )

    user_count = await _get_user_count(db, role.id)
    return _build_role_response(role, user_count)


# ── CREATE / UPDATE / DELETE ──────────────────────────────────────────────────

@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_in: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Create a new role (admin only)."""
    existing = await db.execute(select(Role).where(Role.code == role_in.code))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role with code '{role_in.code}' already exists",
        )

    role = Role(
        code=role_in.code,
        name=role_in.name,
        description=role_in.description,
        is_active=role_in.is_active,
        is_system_role=role_in.is_system_role,
        priority=role_in.priority,
    )
    db.add(role)
    await db.flush()  # get role.id before assigning permissions

    # Assign initial permissions if provided
    if role_in.permission_ids:
        for perm_id in role_in.permission_ids:
            await db.execute(
                role_permissions.insert().values(role_id=role.id, permission_id=perm_id)
            )

    await db.commit()

    # Re-fetch with permissions eager-loaded
    role = await _get_role_with_permissions(db, role.id)
    return _build_role_response(role, 0)


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: UUID,
    role_in: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Update a role (admin only)."""
    role = await _get_role_with_permissions(db, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    for field, value in role_in.model_dump(exclude_unset=True).items():
        setattr(role, field, value)

    await db.commit()

    role = await _get_role_with_permissions(db, role_id)
    user_count = await _get_user_count(db, role_id)
    return _build_role_response(role, user_count)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Delete a role (admin only)."""
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    await db.delete(role)
    await db.commit()


# ── PERMISSIONS ───────────────────────────────────────────────────────────────

@router.post("/{role_id}/permissions", response_model=RoleResponse)
async def assign_permissions_to_role(
    role_id: UUID,
    permission_ids: List[UUID],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Assign (replace) permissions on a role. Superuser only."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only superusers can assign permissions")

    role = await _get_role_with_permissions(db, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    if role.is_system_role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify system role permissions")

    # Validate all permission IDs exist
    if permission_ids:
        found = await db.execute(select(Permission).where(Permission.id.in_(permission_ids)))
        found_ids = {p.id for p in found.scalars().all()}
        missing = set(permission_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Permission IDs not found: {[str(m) for m in missing]}",
            )

    # Replace permissions atomically
    await db.execute(delete(role_permissions).where(role_permissions.c.role_id == role_id))
    for perm_id in permission_ids:
        await db.execute(
            role_permissions.insert().values(role_id=role_id, permission_id=perm_id)
        )

    await db.commit()

    role = await _get_role_with_permissions(db, role_id)
    user_count = await _get_user_count(db, role_id)
    return _build_role_response(role, user_count)


@router.delete("/{role_id}/permissions/{permission_id}", status_code=status.HTTP_200_OK)
async def remove_permission_from_role(
    role_id: UUID,
    permission_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Remove a single permission from a role (admin only)."""
    role = await _get_role_with_permissions(db, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    await db.execute(
        delete(role_permissions).where(
            role_permissions.c.role_id == role_id,
            role_permissions.c.permission_id == permission_id,
        )
    )
    await db.commit()
    return {"message": "Permission removed successfully"}


# ── BULK PERMISSIONS ──────────────────────────────────────────────────────────

@router.post("/admin/permissions/bulk")
async def bulk_create_permissions(
    permissions: List[dict],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.require_roles(["admin"])),
):
    """Bulk create permissions from a JSON list (admin only)."""
    created, skipped = [], []

    for perm_data in permissions:
        if not all(k in perm_data for k in ("resource", "action")):
            skipped.append({"data": perm_data, "reason": "Missing resource or action"})
            continue

        perm_name = f"{perm_data['resource']}:{perm_data['action']}"
        existing = await db.execute(select(Permission).where(Permission.name == perm_name))
        if existing.scalar_one_or_none():
            skipped.append({"name": perm_name, "reason": "Already exists"})
            continue

        db.add(Permission(
            name=perm_name,
            resource=perm_data["resource"],
            action=perm_data["action"],
            description=perm_data.get("description", ""),
            conditions=perm_data.get("conditions", {}),
        ))
        created.append(perm_name)

    await db.commit()
    return {"created": created, "created_count": len(created), "skipped": skipped, "skipped_count": len(skipped)}