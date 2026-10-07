"""
app/api/v1/endpoints/action_tracker/meeting_visibility.py

One place that decides which meetings a user can see.

A user can see a meeting when ANY of these is true:
  1. The meeting is open to all.
  2. They created it.
  3. They were added as a participant (matched by email, case-insensitive).
  4. The meeting belongs to one of their departments or to a department BELOW
     one of theirs. A meeting "belongs" to its restricted department, and also
     to every department its creator is an active member of. So a meeting
     created from a lower-level department is visible to members of that
     department's parent, grandparent ... up to the root.

Department filter (for the meetings list):
  Members of a higher-level department may narrow the list to one department
  (optionally including everything below it). Admins may pick any department.

Requires department_hierarchy.py (same folder).
"""

from typing import Iterable, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, false, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.endpoints.action_tracker.department_hierarchy import (
    get_accessible_department_ids,
    get_descendant_ids,
)
from app.models.meetings.action_tracker import Meeting, MeetingParticipant
from app.models.meetings.user_department import UserDepartment, UserDepartmentStatus
from app.models.user import User


def participant_clause(user):
    """True for meetings where `user` is an active participant (email match, case-insensitive)."""
    email = (getattr(user, "email", None) or "").strip().lower()
    if not email:
        return false()
    return Meeting.participants.any(
        and_(
            func.lower(MeetingParticipant.email) == email,
            MeetingParticipant.is_active == True,  # noqa: E712
        )
    )


def department_scope_clause(dept_ids: Iterable[UUID]):
    """
    True for meetings that belong to any of the given departments:
      - restricted to one of them, or
      - created by someone who is an active member of one of them.
    """
    ids = list(dept_ids)
    if not ids:
        return false()

    members = select(UserDepartment.user_id).where(
        UserDepartment.department_id.in_(ids),
        UserDepartment.status == UserDepartmentStatus.ACTIVE,
        UserDepartment.end_date.is_(None),
    )
    return or_(
        Meeting.restricted_department_id.in_(ids),
        Meeting.created_by_id.in_(members),
    )


async def build_meeting_access_filter(db: AsyncSession, user):
    """SQLAlchemy condition for 'meetings this user is allowed to see'."""
    accessible = await get_accessible_department_ids(db, user.id)

    clauses = [
        Meeting.visibility == "open",
        Meeting.created_by_id == user.id,
        participant_clause(user),
    ]
    if accessible:
        clauses.append(department_scope_clause(accessible))
    return or_(*clauses)


async def is_admin_user(db: AsyncSession, user) -> bool:
    if getattr(user, "is_superuser", False):
        return True
    result = await db.execute(
        select(User).where(User.id == user.id).options(selectinload(User.roles))
    )
    loaded = result.scalar_one_or_none()
    return bool(loaded) and any(r.code in ("admin", "super_admin") for r in loaded.roles)


async def build_department_filter(
    db: AsyncSession,
    user,
    department_id: UUID,
    include_children: bool = True,
):
    """
    Condition for 'meetings of this department (and optionally everything below it)'.
    Raises 403 if the user is not allowed to look at that department.
    Combine it with build_meeting_access_filter so users never see more than they may.
    """
    if not await is_admin_user(db, user):
        accessible = await get_accessible_department_ids(db, user.id)
        if department_id not in accessible:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only filter by your own departments or the ones below them",
            )

    if include_children:
        ids = await get_descendant_ids(db, [department_id], include_roots=True)
    else:
        ids = {department_id}
    return department_scope_clause(ids)
