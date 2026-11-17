"""
app/api/v1/endpoints/action_tracker/meetings_access_control.py

Access level of a user for one meeting.

Uses the same rule as the meetings list (meeting_visibility.py), so the list,
the detail page and the minutes can never disagree:

  - Admins and the meeting's creator: FULL.
  - Users whose department (or a department above it) covers the meeting:
    FULL. This is the hierarchy rule: higher departments see lower ones,
    never the other way round.
  - Anyone else who may view the meeting (an invited participant outside
    the hierarchy): LIMITED.
  - Everyone else: NONE.

Management authority (OWNER/ORGANIZER) is handled separately by
PermissionChecker in meetings.py.
"""

import logging
from enum import Enum
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.endpoints.action_tracker.department_hierarchy import (
    get_accessible_department_ids,
)
from app.api.v1.endpoints.action_tracker.meeting_visibility import (
    department_scope_clause,
    user_can_view_meeting,
)
from app.models.meetings.action_tracker import Meeting
from app.models.meetings.user_department import (
    UserDepartment,
    UserDepartmentStatus,
)
from app.models.user import User

logger = logging.getLogger(__name__)


class AccessLevel(str, Enum):
    FULL = "full"
    LIMITED = "limited"
    NONE = "none"


class DepartmentAccessControl:
    """Department-based access control for meetings."""

    @staticmethod
    async def get_access_level(
        db: AsyncSession,
        meeting_id: UUID,
        user_id: UUID,
        user_email: str,
        is_superuser: bool = False,
    ) -> AccessLevel:
        if is_superuser:
            return AccessLevel.FULL

        try:
            # Load roles eagerly so the admin check works on a freshly loaded user
            user = (await db.execute(
                select(User).where(User.id == user_id).options(selectinload(User.roles))
            )).scalar_one_or_none()
            if not user:
                return AccessLevel.NONE

            # Single source of truth: same rule as the list and GET /meetings/{id}
            if not await user_can_view_meeting(db, user, meeting_id):
                return AccessLevel.NONE

            meeting = (await db.execute(
                select(Meeting).where(Meeting.id == meeting_id)
            )).scalar_one_or_none()
            if not meeting:
                return AccessLevel.NONE

            if meeting.created_by_id == user_id:
                return AccessLevel.FULL

            # Department hierarchy (own departments and below) gets FULL
            accessible = await get_accessible_department_ids(db, user_id)
            if accessible:
                in_scope = await db.execute(
                    select(Meeting.id)
                    .where(Meeting.id == meeting_id, department_scope_clause(accessible))
                    .limit(1)
                )
                if in_scope.first():
                    return AccessLevel.FULL

            # Visible, but not through the hierarchy: invited participant only
            return AccessLevel.LIMITED

        except Exception as exc:
            logger.error(
                "Error determining access level for user %s to meeting %s: %s",
                user_id, meeting_id, exc, exc_info=True,
            )
            return AccessLevel.NONE

    @staticmethod
    async def _user_in_department(
        db: AsyncSession,
        user_id: UUID,
        department_id: UUID,
    ) -> bool:
        """Direct active membership only. For hierarchy use get_accessible_department_ids()."""
        if not department_id:
            return False

        result = await db.execute(
            select(UserDepartment).where(
                UserDepartment.user_id == user_id,
                UserDepartment.department_id == department_id,
                UserDepartment.status == UserDepartmentStatus.ACTIVE,
                UserDepartment.end_date.is_(None),
            )
        )
        return result.scalar_one_or_none() is not None


async def check_meeting_access_or_403(
    db: AsyncSession,
    meeting_id: UUID,
    user_id: UUID,
    user_email: str,
    is_superuser: bool = False,
    required_level: AccessLevel = AccessLevel.FULL,
) -> AccessLevel:
    """Return the user's access level, or raise 403 if it is below `required_level`."""
    level = await DepartmentAccessControl.get_access_level(
        db=db,
        meeting_id=meeting_id,
        user_id=user_id,
        user_email=user_email,
        is_superuser=is_superuser,
    )

    if level == AccessLevel.FULL:        # FULL satisfies every requirement
        return level
    if level == required_level:
        return level

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You don't have permission to access this resource",
    )