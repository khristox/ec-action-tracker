# app/services/action_due_reminders.py
"""
Due-date email reminders for the people implementing an action.

WHO gets an email
    Every implementer of an open action (the linked account's email if they
    have one, otherwise the email stored on the implementer row). If an action
    has no implementers, the legacy `assigned_to` user is used instead.

WHEN
    A few days before the due date. Default: 3 days and 1 day before. Change it
    with ACTION_REMINDER_DAYS_BEFORE in .env, e.g.  ACTION_REMINDER_DAYS_BEFORE=7,3,1
    An action created with only 20 hours left gets ONE reminder (the "1 day"
    one), not all of them at once. Overdue and completed actions get nothing.

NO DUPLICATES
    Every (action, recipient, reminder) is recorded in `action_due_reminders`
    with a unique constraint, so a restart, a second worker, or a repeated run
    can never send the same reminder twice. A failed send is retried on later
    runs, up to MAX_ATTEMPTS.

SETTINGS (all optional, read from the environment or settings)
    ACTION_REMINDER_DAYS_BEFORE       "3,1"
    ACTION_REMINDER_INTERVAL_MINUTES  "15"   how often the scheduler looks
    ACTION_REMINDER_TIMEZONE          "Africa/Kampala"  for the date shown in the email
    FRONTEND_URL                      used for the "view details" link

RUN IT
    * Background:  start `action_due_reminder_scheduler` next to the meeting
      reminder scheduler in app/main.py (see the instructions that came with this file).
    * By hand:     python -m app.services.action_due_reminders --dry-run   (lists, sends nothing)
                   python -m app.services.action_due_reminders             (sends now)
"""
from __future__ import annotations

import asyncio
import html
import inspect
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, tzinfo
from typing import Dict, List, Optional, Sequence, Tuple
from uuid import UUID, uuid4

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    select,
    update,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func

from app.core.config import settings
from app.db.base import Base
from app.db.session import AsyncSessionLocal
from app.db.types import UUID as CustomUUID
from app.models.meetings.action_tracker import (
    ActionImplementer,
    MeetingAction,
    MeetingMinutes,
)
from app.services.email_service import email_service
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

DEFAULT_DAYS_BEFORE = (3, 1)
DEFAULT_INTERVAL_MINUTES = 15
MAX_ATTEMPTS = 3
TEMPLATE_NAME = "action_due_reminder.html"

PRIORITY_COLORS = {
    "High": "#b91c1c",
    "Medium": "#b45309",
    "Low": "#0369a1",
    "Very Low": "#4b5563",
}


# ==================== TABLE ====================

class ActionDueReminder(Base):
    """One row per reminder email already sent (or attempted)."""

    __tablename__ = "action_due_reminders"
    __table_args__ = (
        UniqueConstraint(
            "action_id", "recipient_email", "reminder_key",
            name="uq_action_due_reminder",
        ),
    )

    id = Column(CustomUUID, primary_key=True, default=uuid4)
    action_id = Column(
        CustomUUID,
        ForeignKey("meeting_actions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_email = Column(String(255), nullable=False)
    # e.g. "D-3|2026-10-20": the 3-day window for a due date of 20 Oct 2026.
    # The date is part of the key, so if the due date is moved, the new date
    # gets its own reminders.
    reminder_key = Column(String(60), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | sent | failed
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)


async def ensure_table() -> None:
    """Create action_due_reminders if it does not exist yet (safe to call every start)."""
    try:
        async with AsyncSessionLocal() as db:
            await db.run_sync(
                lambda session: ActionDueReminder.__table__.create(
                    bind=session.connection(), checkfirst=True
                )
            )
            await db.commit()
    except Exception as exc:  # pragma: no cover - depends on the database
        logger.error("❌ Could not create action_due_reminders table: %s", exc)


# ==================== SETTINGS ====================

def _days_before() -> List[int]:
    raw = os.getenv("ACTION_REMINDER_DAYS_BEFORE")
    if raw is None:
        raw = getattr(settings, "ACTION_REMINDER_DAYS_BEFORE", None)
    if raw is None:
        return list(DEFAULT_DAYS_BEFORE)

    parts = raw if isinstance(raw, (list, tuple, set)) else str(raw).split(",")
    days = set()
    for part in parts:
        try:
            value = int(str(part).strip())
        except ValueError:
            continue
        if value >= 1:
            days.add(value)
    return sorted(days, reverse=True) or list(DEFAULT_DAYS_BEFORE)


def _interval_seconds() -> int:
    raw = os.getenv("ACTION_REMINDER_INTERVAL_MINUTES") or getattr(
        settings, "ACTION_REMINDER_INTERVAL_MINUTES", None
    )
    try:
        minutes = int(raw) if raw is not None else DEFAULT_INTERVAL_MINUTES
    except (TypeError, ValueError):
        minutes = DEFAULT_INTERVAL_MINUTES
    return max(1, minutes) * 60


def _local_tz() -> tzinfo:
    name = (
        os.getenv("ACTION_REMINDER_TIMEZONE")
        or getattr(settings, "ACTION_REMINDER_TIMEZONE", None)
        or "Africa/Kampala"
    )
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo(name)
    except Exception:
        return timezone(timedelta(hours=3))  # East Africa Time


def _frontend_url() -> str:
    return (getattr(settings, "FRONTEND_URL", None) or "http://localhost:3000").rstrip("/")


# ==================== PURE HELPERS ====================

def _norm(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    cleaned = email.strip().lower()
    return cleaned if "@" in cleaned else None


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _pick_window(remaining: timedelta, days_before: Sequence[int]) -> Optional[int]:
    """
    The smallest reminder window that has been reached, or None.
    remaining 2.5 days, windows (3, 1) -> 3
    remaining 20 hours, windows (3, 1) -> 1   (the 3-day reminder is skipped, not sent late)
    remaining 5 days                   -> None (too early)
    remaining <= 0                     -> None (already due: this service is for BEFORE the date)
    """
    if remaining <= timedelta(0):
        return None
    reached = [d for d in days_before if remaining <= timedelta(days=d)]
    return min(reached) if reached else None


def _human_remaining(remaining: timedelta) -> str:
    minutes = int(remaining.total_seconds() // 60)
    if minutes < 60:
        n = max(minutes, 1)
        return f"in {n} minute{'s' if n != 1 else ''}"
    hours = minutes // 60
    if hours < 24:
        return f"in {hours} hour{'s' if hours != 1 else ''}"
    days = max(1, round(hours / 24))
    return f"in {days} day{'s' if days != 1 else ''}"


# ==================== DATA ====================

@dataclass
class ReminderJob:
    action_id: UUID
    recipient_email: str
    recipient_name: str
    reminder_key: str
    title: str
    description: str
    due_date: datetime
    priority_label: str
    meeting_id: Optional[UUID]
    meeting_title: Optional[str]


def _recipients(action: MeetingAction) -> List[Tuple[str, str]]:
    """(email, name) for everyone who should hear about this action."""
    out: List[Tuple[str, str]] = []
    seen = set()

    for imp in action.implementers or []:
        user = imp.user
        if user is not None and getattr(user, "is_active", True) is False:
            continue
        # A linked account's email wins: the stored copy may be out of date.
        email = _norm(getattr(user, "email", None)) or _norm(imp.email)
        if not email or email in seen:
            continue
        seen.add(email)
        name = imp.name or getattr(user, "full_name", None) or email
        out.append((email, name))

    if not out and action.assigned_to is not None:
        user = action.assigned_to
        email = _norm(getattr(user, "email", None))
        if email and getattr(user, "is_active", True) is not False:
            name = getattr(user, "full_name", None) or getattr(user, "username", None) or email
            out.append((email, name))

    return out


async def _collect_jobs(now: datetime, days_before: Sequence[int]) -> List[ReminderJob]:
    horizon = now + timedelta(days=max(days_before))

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MeetingAction)
            .options(
                selectinload(MeetingAction.implementers).selectinload(ActionImplementer.user),
                selectinload(MeetingAction.assigned_to),
                selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
            )
            .where(
                MeetingAction.is_active == True,  # noqa: E712
                MeetingAction.completed_at.is_(None),
                MeetingAction.overall_progress_percentage < 100,
                MeetingAction.due_date.is_not(None),
                MeetingAction.due_date > now,
                MeetingAction.due_date <= horizon,
            )
        )
        actions = result.scalars().all()

        jobs: List[ReminderJob] = []
        for action in actions:
            due = _aware(action.due_date)
            window = _pick_window(due - now, days_before)
            if window is None:
                continue

            meeting = action.minutes.meeting if action.minutes is not None else None
            key = f"D-{window}|{due.astimezone(timezone.utc).date().isoformat()}"
            title = (action.title or "").strip() or (action.description or "").strip()[:120] or "Action"

            for email, name in _recipients(action):
                jobs.append(
                    ReminderJob(
                        action_id=action.id,
                        recipient_email=email,
                        recipient_name=name,
                        reminder_key=key,
                        title=title,
                        description=(action.description or "").strip(),
                        due_date=due,
                        priority_label=action.priority_label,
                        meeting_id=meeting.id if meeting is not None else None,
                        meeting_title=meeting.title if meeting is not None else None,
                    )
                )
    # session closed here: nothing below holds a database connection
    return jobs


# ==================== EMAIL ====================

def _fallback_html(ctx: Dict[str, str]) -> str:
    e = html.escape
    link = (
        f'<p style="text-align:center;margin:24px 0;"><a href="{e(ctx["action_link"])}" '
        f'style="background:#1e40af;color:#fff;padding:12px 24px;border-radius:6px;'
        f'text-decoration:none;font-weight:bold;">View details</a></p>'
        if ctx.get("action_link")
        else ""
    )
    description = (
        f'<p style="white-space:pre-wrap;color:#374151;">{e(ctx["action_description"])}</p>'
        if ctx.get("action_description")
        else ""
    )
    meeting = (
        f'<p><strong>Meeting:</strong> {e(ctx["meeting_title"])}</p>' if ctx.get("meeting_title") else ""
    )
    return f"""
    <html><body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:20px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;padding:28px;border-radius:8px;">
        <h2 style="color:#1e40af;margin-top:0;">Action due {e(ctx["time_until"])}</h2>
        <p>Dear <strong>{e(ctx["recipient_name"])}</strong>,</p>
        <p>This is a reminder about an action assigned to you:</p>
        <h3 style="margin-bottom:4px;">{e(ctx["action_title"])}</h3>
        {description}
        <p><strong>Due:</strong> {e(ctx["due_text"])}<br>
           <strong>Priority:</strong> {e(ctx["priority_label"])}</p>
        {meeting}
        {link}
        <p>Best regards,<br><strong>{e(ctx["project_name"])} Team</strong></p>
      </div></body></html>
    """


def _build_email(job: ReminderJob, now: datetime) -> Tuple[str, str]:
    remaining = job.due_date - now
    time_until = _human_remaining(remaining)
    due_text = job.due_date.astimezone(_local_tz()).strftime("%A, %d %B %Y at %I:%M %p %Z")

    try:
        project_name = NotificationService.get_organization_name()
    except Exception:
        project_name = getattr(settings, "PROJECT_NAME", "Action Tracker")

    logo_url = None
    try:
        logo_info = NotificationService.get_logo_for_email()
        if logo_info and logo_info.get("type") == "url":
            logo_url = logo_info.get("value")
    except Exception:
        pass

    base = _frontend_url()
    action_link = f"{base}/meetings/{job.meeting_id}" if job.meeting_id else base

    ctx = {
        "title": "Action Reminder",
        "header_title": f"Action due {time_until}",
        "header_subtitle": job.title,
        "primary_color": "#1e40af",
        "primary_color_dark": "#1e3a8a",
        "priority_color": PRIORITY_COLORS.get(job.priority_label, "#4b5563"),
        "logo_url": logo_url,
        "project_name": project_name,
        "year": datetime.now().year,
        "frontend_url": base,
        "recipient_name": job.recipient_name,
        "action_title": job.title,
        "action_description": job.description,
        "due_text": due_text,
        "time_until": time_until,
        "priority_label": job.priority_label,
        "meeting_title": job.meeting_title,
        "action_link": action_link,
    }

    html_body = ""
    renderer = getattr(email_service, "render_template", None) or getattr(
        email_service, "_render_template", None
    )
    if renderer:
        try:
            html_body = renderer(TEMPLATE_NAME, ctx) or ""
        except Exception as exc:
            logger.warning("Template %s failed (%s); using the built-in layout.", TEMPLATE_NAME, exc)
    if not html_body:
        html_body = _fallback_html(ctx)

    subject = f"⏳ Action due {time_until}: {job.title}"
    return subject, html_body


async def _send_email(to_email: str, subject: str, html_body: str) -> Tuple[bool, str]:
    kwargs = {"to_email": to_email, "subject": subject, "html_content": html_body}

    # Some versions of email_service.send_email also take the organisation logo.
    try:
        if "logo_info" in inspect.signature(email_service.send_email).parameters:
            kwargs["logo_info"] = NotificationService.get_logo_for_email()
    except Exception:
        pass

    result = await email_service.send_email(**kwargs)

    # send_email returns {"success": bool, "message": str} (or a bare bool in
    # older versions). Do NOT use `if not result`: a failure dict is truthy.
    if isinstance(result, dict):
        return bool(result.get("success")), str(result.get("message", ""))
    return bool(result), ""


# ==================== PROCESSING ====================

async def _process_job(job: ReminderJob, now: datetime, dry_run: bool) -> str:
    """Returns 'sent', 'failed' or 'skipped'."""
    if dry_run:
        logger.info(
            "📝 [dry run] would email %s about '%s' (%s, due %s)",
            job.recipient_email, job.title, job.reminder_key, job.due_date.isoformat(),
        )
        return "skipped"

    # ---- 1. Claim the reminder (the unique constraint makes this safe) ----
    claim_id = uuid4()
    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(
                select(ActionDueReminder).where(
                    ActionDueReminder.action_id == job.action_id,
                    ActionDueReminder.recipient_email == job.recipient_email,
                    ActionDueReminder.reminder_key == job.reminder_key,
                )
            )
        ).scalar_one_or_none()

        if existing is not None:
            if existing.status == "sent" or existing.attempts >= MAX_ATTEMPTS:
                return "skipped"
            claim_id = existing.id  # a failed attempt: try again
        else:
            db.add(
                ActionDueReminder(
                    id=claim_id,
                    action_id=job.action_id,
                    recipient_email=job.recipient_email,
                    reminder_key=job.reminder_key,
                    status="pending",
                    attempts=0,
                )
            )
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                return "skipped"  # another run claimed it first

    # ---- 2. Send (no database session held during the slow network call) ----
    ok, message = False, ""
    try:
        subject, html_body = _build_email(job, now)
        ok, message = await _send_email(job.recipient_email, subject, html_body)
    except Exception as exc:
        message = str(exc)
        logger.error("❌ Reminder to %s failed: %s", job.recipient_email, exc, exc_info=True)

    # ---- 3. Record the outcome ----
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(ActionDueReminder)
                .where(ActionDueReminder.id == claim_id)
                .values(
                    status="sent" if ok else "failed",
                    attempts=ActionDueReminder.attempts + 1,
                    last_error=None if ok else (message or "unknown error")[:500],
                    sent_at=datetime.now(timezone.utc) if ok else None,
                )
            )
            await db.commit()
    except Exception as exc:
        logger.error("Could not record the reminder outcome: %s", exc)

    if ok:
        logger.info("✅ Due-date reminder sent to %s for '%s'", job.recipient_email, job.title)
        return "sent"
    logger.warning("⚠️ Due-date reminder to %s failed: %s", job.recipient_email, message)
    return "failed"


async def run_once(dry_run: bool = False) -> Dict[str, int]:
    """Look for actions that need a reminder now and send them."""
    if not dry_run and not email_service.is_configured():
        logger.warning("Email service is not configured: skipping action due-date reminders.")
        return {"candidates": 0, "sent": 0, "failed": 0, "skipped": 0}

    now = datetime.now(timezone.utc)
    jobs = await _collect_jobs(now, _days_before())
    counts = {"candidates": len(jobs), "sent": 0, "failed": 0, "skipped": 0}

    for job in jobs:
        outcome = await _process_job(job, now, dry_run)
        counts[outcome] += 1

    if counts["sent"] or counts["failed"]:
        logger.info("📊 Action due-date reminders: %s", counts)
    return counts


# ==================== SCHEDULER ====================

class ActionDueReminderScheduler:
    """Background loop. Start it next to the meeting reminder scheduler."""

    def __init__(self) -> None:
        self.is_running = False

    async def start(self) -> None:
        if self.is_running:
            logger.warning("Action due-date reminder scheduler is already running")
            return

        self.is_running = True
        logger.info(
            "🚀 Starting action due-date reminder scheduler (every %s min, %s days before due)",
            _interval_seconds() // 60,
            _days_before(),
        )
        await ensure_table()

        while self.is_running:
            try:
                await run_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error("Error in action due-date reminder scheduler: %s", exc, exc_info=True)
            await asyncio.sleep(_interval_seconds())

    async def stop(self) -> None:
        self.is_running = False
        logger.info("🛑 Stopping action due-date reminder scheduler")


action_due_reminder_scheduler = ActionDueReminderScheduler()


# ==================== COMMAND LINE ====================

async def _cli(dry_run: bool) -> None:
    await ensure_table()
    print(run_once.__doc__)
    print(await run_once(dry_run=dry_run))


if __name__ == "__main__":  # python -m app.services.action_due_reminders [--dry-run]
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
    asyncio.run(_cli(dry_run="--dry-run" in sys.argv))
