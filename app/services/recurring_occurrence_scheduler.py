# app/services/recurring_occurrence_scheduler.py
"""
Creates the next occurrence of every active recurring meeting once the latest
generated occurrence's scheduled time has been reached.

Same shape as ReminderScheduler / ActionDueReminderScheduler: a plain asyncio
loop started from main.py's lifespan. It is safe with several workers or
replicas, because RecurringMeetingService.create_next_occurrence() locks the
series row (SELECT ... FOR UPDATE SKIP LOCKED) and re-checks inside the lock.
"""
import asyncio
import logging

from sqlalchemy import select

from app.crud.meetings.recurring_meeting_service import (
    RecurringMeetingService,
    get_utc_now,
)
from app.db.session import AsyncSessionLocal
from app.models.general.dynamic_attribute import Attribute
from app.models.meetings.recurring_meeting import RecurringMeeting

logger = logging.getLogger(__name__)


class RecurringOccurrenceScheduler:
    """Background job: keep one upcoming occurrence for each active series."""

    def __init__(self, check_interval: int = 60):
        self.is_running = False
        self.check_interval = check_interval  # seconds

    async def start(self):
        if self.is_running:
            logger.warning("Recurring occurrence scheduler is already running")
            return

        self.is_running = True
        logger.info("Starting recurring occurrence scheduler (every %ss)", self.check_interval)

        while self.is_running:
            try:
                await self.run_once()
            except Exception:
                logger.exception("Error in recurring occurrence scheduler")
            await asyncio.sleep(self.check_interval)

    async def stop(self):
        self.is_running = False
        logger.info("Stopping recurring occurrence scheduler")

    async def run_once(self) -> int:
        """One pass. Returns how many occurrences were created."""
        now = get_utc_now()  # naive UTC, the convention used by the stored dates

        # 1. Cheap candidate query: active series whose latest occurrence has
        #    started and that still have a next date to generate.
        async with AsyncSessionLocal() as db:
            active_id = (
                await db.execute(
                    select(Attribute.id).where(Attribute.code == "RECURRING_STATUS_ACTIVE")
                )
            ).scalars().first()

            stmt = select(RecurringMeeting.id).where(
                RecurringMeeting.is_deleted == False,  # noqa: E712
                RecurringMeeting.last_occurrence_date.is_not(None),
                RecurringMeeting.last_occurrence_date <= now,
                RecurringMeeting.next_occurrence_date.is_not(None),
            )
            if active_id:
                stmt = stmt.where(RecurringMeeting.status_id == active_id)
            series_ids = (await db.execute(stmt)).scalars().all()

        # 2. One short session per series, so one failure never blocks the rest.
        created = 0
        for series_id in series_ids:
            async with AsyncSessionLocal() as db:
                try:
                    meeting = await RecurringMeetingService(db).create_next_occurrence(
                        series_id, automatic=True
                    )
                    if meeting:
                        created += 1
                        logger.info(
                            "Auto-generated occurrence #%s (%s) for recurring meeting %s",
                            meeting.occurrence_number,
                            meeting.start_time,
                            series_id,
                        )
                except Exception:
                    await db.rollback()
                    logger.exception("Could not auto-generate occurrence for %s", series_id)
        return created


recurring_occurrence_scheduler = RecurringOccurrenceScheduler()