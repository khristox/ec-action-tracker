# app/core/meeting_permissions.py
"""
Who may edit a meeting and its actions.

Rule: the person who CREATED a meeting can always manage that meeting and its
actions, whether or not they are one of its participants. Admins can too.

Keep this logic in one place and call it from every endpoint that edits a
meeting or an action, so the rule cannot drift between endpoints.
"""
from typing import Any, Optional

# Adjust this import if is_admin_user lives in another module:
#   grep -rn "def is_admin_user" app
from app.core.admin_access import is_admin_user


def is_meeting_creator(meeting: Any, user: Any) -> bool:
    """True when `user` created `meeting`, even if they are not a participant."""
    return bool(
        meeting is not None
        and user is not None
        and getattr(meeting, "created_by_id", None) is not None
        and meeting.created_by_id == user.id
    )


async def can_manage_meeting(db, meeting: Any, user: Any) -> bool:
    """Creator or admin: may edit the meeting, its participants, minutes and documents."""
    if is_meeting_creator(meeting, user):
        return True
    return await is_admin_user(db, user)


def _creator_id_of_action_meeting(sync_session, action) -> Optional[Any]:
    # Runs inside AsyncSession.run_sync, so lazy relationship loading is allowed.
    minutes = getattr(action, "minutes", None)
    meeting = getattr(minutes, "meeting", None) if minutes is not None else None
    return getattr(meeting, "created_by_id", None) if meeting is not None else None


async def is_creator_of_action_meeting(db, action: Any, user: Any) -> bool:
    """True when `user` created the meeting that `action` belongs to."""
    creator_id = await db.run_sync(_creator_id_of_action_meeting, action)
    return creator_id is not None and creator_id == user.id


async def can_edit_action(db, action: Any, user: Any) -> bool:
    """
    Who may edit or delete an action:
      - anyone, while the action has no assignee (unchanged behaviour)
      - the assigned user
      - the creator of the meeting the action belongs to (participant or not)
      - admins
    """
    if not action.assigned_to_id:
        return True
    if action.assigned_to_id == user.id:
        return True
    if await is_creator_of_action_meeting(db, action, user):
        return True
    return await is_admin_user(db, user)