
"""
Automatically update meeting statuses based on scheduled start and end times.

Transitions:
    MEETING_STATUS_PENDING -> MEETING_STATUS_STARTED
    MEETING_STATUS_PENDING -> MEETING_STATUS_ENDED
    MEETING_STATUS_STARTED -> MEETING_STATUS_ENDED

The scheduler checks every 30 seconds and records each transition
in meeting_status_history.
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.general.dynamic_attribute import Attribute
from app.models.meetings.action_tracker import Meeting, MeetingStatusHistory

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 30

PENDING_CODE = "MEETING_STATUS_PENDING"
STARTED_CODE = "MEETING_STATUS_STARTED"
ENDED_CODE = "MEETING_STATUS_ENDED"


def _as_utc(value: datetime) -> datetime:
    """Normalize a datetime to timezone-aware UTC for safe comparison."""
    if value.tzinfo is None:
        # The model uses timezone-aware datetime columns for meeting times.
        # Treat legacy naive database values as UTC.
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


async def update_meeting_statuses() -> int:
    """
    Check active meetings and apply due status transitions.

    Returns the number of meetings whose statuses were changed.
    """
    now = datetime.now(timezone.utc)
    changed_count = 0

    async with AsyncSessionLocal() as db:
        try:
            # Fetch the actual status attributes seeded by the application.
            status_result = await db.execute(
                select(Attribute).where(
                    Attribute.code.in_(
                        [PENDING_CODE, STARTED_CODE, ENDED_CODE]
                    ),
                    Attribute.is_active.is_(True),
                )
            )

            statuses = {
                attribute.code: attribute
                for attribute in status_result.scalars().all()
            }

            missing = [
                code
                for code in (PENDING_CODE, STARTED_CODE, ENDED_CODE)
                if code not in statuses
            ]

            if missing:
                logger.error(
                    "Meeting status scheduler cannot run. "
                    "Missing active status attributes: %s",
                    ", ".join(missing),
                )
                return 0

            pending_id = statuses[PENDING_CODE].id
            started_id = statuses[STARTED_CODE].id
            ended_id = statuses[ENDED_CODE].id

            # Only inspect meetings that can still transition.
            meetings_result = await db.execute(
                select(Meeting).where(
                    Meeting.is_active.is_(True),
                    Meeting.status_id.in_([pending_id, started_id]),
                )
            )
            meetings = meetings_result.scalars().all()

            for meeting in meetings:
                if not meeting.start_time:
                    continue

                start_time = _as_utc(meeting.start_time)
                end_time = (
                    _as_utc(meeting.end_time)
                    if meeting.end_time
                    else None
                )

                old_status_id = meeting.status_id
                new_status_id = None
                comment = None

                # Check the end time first. A meeting that has already
                # passed both times must transition directly to ENDED.
                if end_time and now >= end_time:
                    new_status_id = ended_id
                    comment = (
                        "Meeting status automatically changed to ENDED "
                        "because the scheduled end time was reached."
                    )

                elif now >= start_time and old_status_id == pending_id:
                    new_status_id = started_id
                    comment = (
                        "Meeting status automatically changed to STARTED "
                        "because the scheduled start time was reached."
                    )

                if new_status_id is None or new_status_id == old_status_id:
                    continue

                meeting.status_id = new_status_id

                # The model's status_date is a naive DateTime column.
                # Store a naive UTC timestamp for compatibility.
                history = MeetingStatusHistory(
                    meeting_id=meeting.id,
                    status_id=new_status_id,
                    comment=comment,
                    status_date=now.replace(tzinfo=None),
                    created_by_id=None,
                    is_active=True,
                )
                db.add(history)

                changed_count += 1

                logger.info(
                    "Meeting '%s' (%s) status changed from %s to %s",
                    meeting.title,
                    meeting.id,
                    (
                        PENDING_CODE
                        if old_status_id == pending_id
                        else STARTED_CODE
                    ),
                    (
                        STARTED_CODE
                        if new_status_id == started_id
                        else ENDED_CODE
                    ),
                )

            if changed_count:
                await db.commit()
                logger.info(
                    "Meeting status scheduler updated %d meeting(s).",
                    changed_count,
                )

            return changed_count

        except Exception:
            await db.rollback()
            logger.exception("Error updating automatic meeting statuses.")
            return 0


async def meeting_status_scheduler() -> None:
    """Run the meeting status checker continuously until cancelled."""
    logger.info(
        "Meeting status scheduler started; checking every %s seconds.",
        CHECK_INTERVAL_SECONDS,
    )

    try:
        while True:
            await update_meeting_statuses()
            await asyncio.sleep(CHECK_INTERVAL_SECONDS)

    except asyncio.CancelledError:
        logger.info("Meeting status scheduler stopped.")
        raise
