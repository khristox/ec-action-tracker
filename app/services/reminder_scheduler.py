# app/services/reminder_scheduler.py
import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.meetings.action_tracker import Meeting, MeetingParticipant
from app.models.notification import (
    Notification,
    NotificationChannel,
    NotificationStatus,
    NotificationCategory
)
from app.services.email_service import email_service
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class ReminderScheduler:
    """Background scheduler for meeting reminders."""

    def __init__(self):
        self.is_running = False
        self.check_interval = 30  # Check every 30 seconds

    async def start(self):
        """Start the reminder scheduler."""
        if self.is_running:
            logger.warning("Reminder scheduler is already running")
            return

        self.is_running = True
        logger.info("🚀 Starting meeting reminder scheduler")

        while self.is_running:
            try:
                await self._check_and_send_reminders()
            except Exception as e:
                logger.error(f"Error in reminder scheduler: {e}")
                import traceback
                logger.error(traceback.format_exc())

            await asyncio.sleep(self.check_interval)

    async def stop(self):
        """Stop the reminder scheduler."""
        self.is_running = False
        logger.info("🛑 Stopping meeting reminder scheduler")

    def _get_current_time(self):
        """Get current time with timezone awareness."""
        try:
            return datetime.now(timezone.utc)
        except:
            return datetime.now()

    def _build_meeting_link(self, meeting: Meeting) -> str:
        """
        Builds the direct link to a meeting's detail page in the frontend
        app, e.g. http://localhost:3000/meetings/{id}, using FRONTEND_URL
        from settings/.env. Falls back to a sane default if not configured.
        Distinct from base.html's `frontend_url` (the site root "Visit our
        website" link) - this one points at the specific meeting.
        """
        frontend_url = getattr(settings, "FRONTEND_URL", None) or "http://localhost:3000"
        return f"{frontend_url.rstrip('/')}/meetings/{meeting.id}"

    async def _check_and_send_reminders(self):
        """Check all meetings and send reminders if needed."""
        async with AsyncSessionLocal() as db:
            now = self._get_current_time()
            today = now.date()

            try:
                result = await db.execute(
                    select(Meeting)
                    .options(selectinload(Meeting.participants))
                    .where(
                        Meeting.is_active == True,
                        Meeting.meeting_date >= today
                    )
                )
                meetings = result.scalars().all()

                sent_count = 0
                failed_count = 0

                for meeting in meetings:
                    if not meeting.start_time:
                        continue

                    try:
                        if isinstance(meeting.start_time, datetime):
                            meeting_datetime = meeting.start_time
                        else:
                            meeting_datetime = datetime.combine(meeting.meeting_date, meeting.start_time)

                        # Timezone handling
                        if meeting_datetime.tzinfo is None and now.tzinfo is not None:
                            meeting_datetime = meeting_datetime.replace(tzinfo=now.tzinfo)
                        elif meeting_datetime.tzinfo is not None and now.tzinfo is None:
                            now = now.replace(tzinfo=meeting_datetime.tzinfo)

                        time_diff = meeting_datetime - now
                        minutes_until = time_diff.total_seconds() / 60

                    except Exception as e:
                        logger.error(f"Error calculating time for meeting {meeting.id}: {e}")
                        continue

                    if 15 <= minutes_until <= 25:
                        logger.info(f"⏰ Meeting '{meeting.title}' starts in {int(minutes_until)} minutes")

                        if await self._reminders_already_sent(db, meeting.id):
                            logger.debug(f"Reminders already sent for meeting {meeting.id}")
                            continue

                        for participant in meeting.participants:
                            if participant.email and getattr(participant, 'is_active', True):
                                success = await self._send_reminder_to_participant(
                                    db=db,
                                    meeting=meeting,
                                    participant=participant,
                                    minutes_until=int(minutes_until)
                                )
                                if success:
                                    sent_count += 1
                                else:
                                    failed_count += 1

                        if sent_count > 0:
                            meeting.reminder_sent_at = now
                            meeting.reminder_sent_count = (getattr(meeting, 'reminder_sent_count', 0) or 0) + 1
                            await db.commit()

                if sent_count > 0 or failed_count > 0:
                    logger.info(f"📊 Reminders processed: {sent_count} sent, {failed_count} failed")

            except Exception as e:
                logger.error(f"Error checking meetings: {e}")
                import traceback
                logger.error(traceback.format_exc())
                await db.rollback()

    async def _reminders_already_sent(self, db: AsyncSession, meeting_id) -> bool:
            """Check if reminders already sent for this meeting."""
            now = self._get_current_time()
            one_hour_ago = now - timedelta(hours=1)

            result = await db.execute(
                select(Notification.id).where(
                    Notification.meeting_id == meeting_id,
                    Notification.template_name == "meeting_reminder",
                    Notification.status == NotificationStatus.SUCCESSFUL,
                    Notification.sent_at >= one_hour_ago
                ).limit(1)
            )
            return result.first() is not None

    async def _send_reminder_to_participant(
        self,
        db: AsyncSession,
        meeting: Meeting,
        participant: MeetingParticipant,
        minutes_until: int
    ) -> bool:
        """Send a reminder email to a participant, rendered from meeting_reminder.html."""
        try:
            # Check if already sent to this participant
            result = await db.execute(
                select(Notification).where(
                    Notification.meeting_id == meeting.id,
                    Notification.participant_id == participant.id,
                    Notification.template_name == "meeting_reminder",
                    Notification.status == NotificationStatus.SUCCESSFUL
                )
            )
            if result.scalar_one_or_none():
                return False

            # Organization branding. base.html's logo slot only supports a
            # plain image URL (no CID/inline-attachment markup), so only
            # "url"-type logos are passed through; a "cid" logo_info is
            # skipped here rather than rendering a broken image tag.
            organization_name = NotificationService.get_organization_name()
            logo_info = NotificationService.get_logo_for_email()
            logo_url = logo_info.get("value") if logo_info and logo_info.get("type") == "url" else None

            # Prepare meeting details
            meeting_date = meeting.meeting_date.strftime("%A, %B %d, %Y")
            start_time = self._format_time(meeting.start_time)
            end_time = self._format_time(meeting.end_time) if meeting.end_time else "TBD"
            platform = getattr(meeting, 'platform', None) or 'physical'
            meeting_link = getattr(meeting, 'meeting_link', None) or getattr(meeting, 'virtual_link', None)
            meeting_detail_link = self._build_meeting_link(meeting)

            subject = f"⏰ Reminder: {meeting.title} starts in {minutes_until} minutes"

            # NOTE: previously this called a Python-string HTML builder
            # (_build_reminder_html). Now rendered from
            # app/templates/email/meeting_reminder.html, which extends the
            # existing base.html, via email_service's Jinja2 environment.
            # email_service._render_template already auto-injects
            # year/project_name/frontend_url as defaults - only the
            # template-specific and header-override variables need to be
            # passed here.
            html_content = email_service.render_template(
                "meeting_reminder.html",
                {
                    "title": "Meeting Reminder",
                    "header_title": f"⏰ {minutes_until} Minute Reminder",
                    "header_subtitle": meeting.title,
                    "primary_color": "#1e40af",
                    "primary_color_dark": "#1e3a8a",
                    "logo_url": logo_url,
                    # Override the default project_name with the
                    # organization's configured name, if set.
                    "project_name": organization_name,
                    "participant_name": participant.name,
                    "meeting_title": meeting.title,
                    "time_until": f"{minutes_until} minutes",
                    "meeting_datetime": f"{meeting_date} at {start_time} - {end_time}",
                    "platform": platform,
                    "location": getattr(meeting, 'location_text', None) or "Virtual Meeting",
                    "meeting_link": meeting_link,
                    "meeting_detail_link": meeting_detail_link,
                }
            )

            # Send email with logo support
            result = await email_service.send_email(
                to_email=participant.email,
                subject=subject,
                html_content=html_content,
                logo_info=logo_info
            )

            if result:
                notification = Notification(
                    id=uuid.uuid4(),
                    channel=NotificationChannel.EMAIL,
                    recipient=participant.email,
                    recipient_name=participant.name,
                    content=html_content,
                    subject=subject,
                    template_name="meeting_reminder",
                    category=NotificationCategory.MEETING_NOTIFICATION,
                    meeting_id=meeting.id,
                    participant_id=participant.id,
                    status=NotificationStatus.SUCCESSFUL,
                    sent_at=datetime.now()
                )
                db.add(notification)
                await db.commit()

                logger.info(f"✅ Reminder sent to {participant.email} for '{meeting.title}'")
                return True
            else:
                logger.error(f"❌ Failed to send reminder to {participant.email}")
                return False

        except Exception as e:
            logger.error(f"Error sending reminder to {participant.email}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    def _format_time(self, time_obj) -> str:
        """Safely format time object."""
        if isinstance(time_obj, datetime):
            return time_obj.strftime("%I:%M %p")
        elif time_obj:
            try:
                return time_obj.strftime("%I:%M %p")
            except:
                return str(time_obj)
        return "TBD"


# ==================== GLOBAL INSTANCE ====================
reminder_scheduler = ReminderScheduler()