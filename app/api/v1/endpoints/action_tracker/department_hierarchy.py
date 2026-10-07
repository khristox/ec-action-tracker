"""
app/api/v1/endpoints/action_tracker/department_hierarchy.py

Hierarchical department access.

Rule: a user who belongs to a department can access meetings restricted to
that department AND to any of its descendants (children, grandchildren, ...).
Membership of a child department does NOT give access to the parent's meetings.

Everything is derived from organization_nodes.parent_id with a recursive CTE,
so it does not depend on the format of the `path` column.
"""

from typing import Iterable, List, Set
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.meetings.organization import OrganizationNode
from app.models.meetings.user_department import UserDepartment, UserDepartmentStatus


async def get_user_department_ids(db: AsyncSession, user_id: UUID) -> Set[UUID]:
    """Departments the user is currently an ACTIVE member of (direct only)."""
    result = await db.execute(
        select(UserDepartment.department_id).where(
            UserDepartment.user_id == user_id,
            UserDepartment.status == UserDepartmentStatus.ACTIVE,
            UserDepartment.end_date.is_(None),
        )
    )
    return {row[0] for row in result.all()}


async def get_descendant_ids(
    db: AsyncSession, root_ids: Iterable[UUID], include_roots: bool = True
) -> Set[UUID]:
    """
    All active descendants of the given departments (children, grandchildren, ...).
    When include_roots is True the given departments are part of the result.
    """
    roots = list(root_ids)
    if not roots:
        return set()

    tree = (
        select(OrganizationNode.id)
        .where(OrganizationNode.id.in_(roots))
        .cte("dept_tree", recursive=True)
    )
    tree_alias = tree.alias("t")
    child = aliased(OrganizationNode)
    # UNION (not UNION ALL) so a bad parent_id cycle cannot loop forever.
    tree = tree.union(
        select(child.id).where(
            child.parent_id == tree_alias.c.id,
            child.is_active == True,  # noqa: E712
        )
    )

    result = await db.execute(select(tree.c.id))
    ids = {row[0] for row in result.all()}
    if not include_roots:
        ids -= set(roots)
    return ids


async def get_accessible_department_ids(db: AsyncSession, user_id: UUID) -> Set[UUID]:
    """
    Every department whose meetings the user may access:
    their own active departments plus all of those departments' descendants.
    """
    own = await get_user_department_ids(db, user_id)
    if not own:
        return set()
    return await get_descendant_ids(db, own, include_roots=True)


async def user_can_access_department(
    db: AsyncSession, user_id: UUID, department_id: UUID
) -> bool:
    """True if department_id is one of the user's departments or a descendant of one."""
    if department_id is None:
        return False
    return department_id in await get_accessible_department_ids(db, user_id)
