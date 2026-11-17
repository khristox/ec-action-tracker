from fastapi import HTTPException, status
from sqlalchemy import and_, false, func, or_, select, true

from app.api.v1.endpoints.action_tracker.meeting_visibility import (
    build_meeting_access_filter, user_is_admin,
)
from app.models.meetings.action_tracker import (
    ActionImplementer, Meeting, MeetingAction, MeetingMinutes,
)


async def build_action_access_filter(db, user):
    """Actions the user may see: own, assigned/implementing, or in a meeting they can see."""
    if await user_is_admin(db, user):
        return true()

    email = (getattr(user, "email", None) or "").strip().lower()
    impl_match = [ActionImplementer.user_id == user.id]
    if email:
        impl_match.append(and_(
            ActionImplementer.user_id.is_(None),
            func.lower(ActionImplementer.email) == email,
        ))
    implementing = select(ActionImplementer.id).where(
        ActionImplementer.action_id == MeetingAction.id, or_(*impl_match)
    ).exists()

    meeting_access = await build_meeting_access_filter(db, user)
    visible_minutes = select(MeetingMinutes.id).where(
        MeetingMinutes.meeting_id.in_(
            select(Meeting.id).where(Meeting.is_active == True, meeting_access)  # noqa: E712
        )
    )

    return or_(
        MeetingAction.created_by_id == user.id,
        MeetingAction.assigned_to_id == user.id,
        implementing,
        MeetingAction.minute_id.in_(visible_minutes),
    )


async def ensure_can_view_action(db, action, user) -> None:
    cond = await build_action_access_filter(db, user)
    row = await db.execute(
        select(MeetingAction.id).where(MeetingAction.id == action.id, cond).limit(1)
    )
    if not row.first():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have access to this action")