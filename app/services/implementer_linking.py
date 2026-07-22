# app/services/implementer_linking.py
"""
Implementer <-> User linking.

An action implementer is a PERSON, who may or may not have a system account.

    user_id IS NULL      -> external person (participant, guest, colleague)
    user_id IS NOT NULL  -> linked to a system account

Identity is carried by EMAIL (and optionally phone), not by an id from the
client. The client must never send user_id directly: the ids it holds come
from the participant picker (meeting_participants.id) and are NOT user ids.
Sending one is what caused the fk_action_implementers_user violation.

Everything that resolves or links an implementer lives in this file.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meetings.action_tracker import ActionImplementer
from app.models.user import User

logger = logging.getLogger(__name__)


# ==================== NORMALISATION ====================

def normalize_email(email: Optional[str]) -> Optional[str]:
    """Lowercase + strip. Returns None for blanks so we never store ''."""
    if not email:
        return None
    cleaned = email.strip().lower()
    return cleaned or None


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    """
    Strip spaces/dashes/parens. Keeps a leading '+'.

    NOTE: this is deliberately simple. If you want reliable phone-based
    linking for Ugandan numbers (0789..., +256789..., 256789... are all the
    same person), install `phonenumbers` and convert to E.164 here.
    Until then, treat phone linking as best-effort and rely on email.
    """
    if not phone:
        return None
    cleaned = "".join(c for c in phone if c.isdigit() or c == "+")
    return cleaned or None


# ==================== RESOLUTION (used when CREATING implementers) ====================

async def resolve_user_by_email(
    db: AsyncSession, email: Optional[str]
) -> Optional[User]:
    """Find a system user whose email matches, case-insensitively."""
    email = normalize_email(email)
    if not email:
        return None
    result = await db.execute(
        select(User).where(func.lower(User.email) == email)
    )
    return result.scalar_one_or_none()


async def resolve_implementer_user_id(
    db: AsyncSession,
    user_id: Optional[Any] = None,
    email: Optional[str] = None,
) -> Optional[UUID]:
    """
    Return a VALID users.id, or None if this implementer is an external person.

    Never raises on a bad id. An unknown id simply means "not a system user",
    which is a legitimate state in this design.
    """
    # 1. If an explicit user_id was supplied, verify it actually exists.
    if user_id:
        try:
            uid = user_id if isinstance(user_id, UUID) else UUID(str(user_id))
        except (ValueError, TypeError):
            uid = None
        if uid:
            user = await db.get(User, uid)
            if user:
                return user.id
            logger.warning(
                "Implementer id %s is not a users.id (likely a participant id "
                "from the picker); treating as external person.",
                uid,
            )

    # 2. Otherwise try to auto-link by email.
    user = await resolve_user_by_email(db, email)
    if user:
        logger.info("Implementer auto-linked to user %s by email.", user.id)
        return user.id

    # 3. External person with no account (yet).
    return None


async def build_implementer(
    db: AsyncSession,
    action_id: UUID,
    person: Dict[str, Any],
    sort_order: int,
) -> ActionImplementer:
    """
    Build one ActionImplementer row from whatever the client sent.

    Accepts any of these key spellings, because different parts of the
    frontend send different shapes:
        user_id / assigned_to_id / id   -> candidate user id (validated)
        name
        email
        phone / telephone
    """
    raw_id = (
        person.get("user_id")
        or person.get("assigned_to_id")
        or person.get("id")
    )
    email = normalize_email(person.get("email"))
    phone = normalize_phone(person.get("phone") or person.get("telephone"))

    user_id = await resolve_implementer_user_id(db, user_id=raw_id, email=email)

    return ActionImplementer(
        action_id=action_id,
        user_id=user_id,
        name=(person.get("name") or "").strip() or "Unassigned",
        email=email,
        phone=phone,
        sort_order=sort_order,
        linked_at=func.now() if user_id else None,
    )


async def build_implementers(
    db: AsyncSession,
    action_id: UUID,
    people: List[Dict[str, Any]],
) -> List[ActionImplementer]:
    """Build the full implementer list for an action, de-duplicated by email."""
    seen_emails: set[str] = set()
    rows: List[ActionImplementer] = []

    for person in people or []:
        # Pydantic models get converted; plain dicts pass through.
        if hasattr(person, "model_dump"):
            person = person.model_dump()
        elif hasattr(person, "dict"):
            person = person.dict()

        email = normalize_email(person.get("email"))
        if email and email in seen_emails:
            continue
        if email:
            seen_emails.add(email)

        rows.append(await build_implementer(db, action_id, person, len(rows)))

    return rows


# ==================== LINKING (used when a user VERIFIES their account) ====================

async def link_implementers_to_user(
    db: AsyncSession,
    user: User,
    match_phone: bool = False,
) -> int:
    """
    Attach all existing external implementer rows for this person to their
    new account. Call this AFTER email verification, never at registration --
    otherwise anyone could sign up as someone else's address and inherit
    their tasks.

    Set match_phone=True only if you have actually verified the phone by OTP.

    Returns the number of rows linked.
    """
    conditions = []

    email = normalize_email(getattr(user, "email", None))
    if email:
        conditions.append(func.lower(ActionImplementer.email) == email)

    if match_phone:
        phone = normalize_phone(getattr(user, "phone", None))
        if phone:
            conditions.append(ActionImplementer.phone == phone)

    if not conditions:
        return 0

    result = await db.execute(
        update(ActionImplementer)
        .where(or_(*conditions), ActionImplementer.user_id.is_(None))
        .values(user_id=user.id, linked_at=func.now())
    )
    count = result.rowcount or 0

    if count:
        logger.info("Linked %s existing action(s) to user %s.", count, user.id)

    return count


# ==================== QUERY HELPER (used by "my tasks") ====================

def implementer_belongs_to(user: User, email_verified: bool = True):
    """
    SQLAlchemy condition for "this implementer row is me".

    Covers both states:
      1. already linked  -> user_id matches
      2. not yet linked  -> email matches and my email is verified

    Usage:
        select(MeetingAction)
            .join(ActionImplementer)
            .where(implementer_belongs_to(current_user))
    """
    email = normalize_email(getattr(user, "email", None))

    conditions = [ActionImplementer.user_id == user.id]

    if email and email_verified:
        conditions.append(
            (ActionImplementer.user_id.is_(None))
            & (func.lower(ActionImplementer.email) == email)
        )

    return or_(*conditions)


async def resolve_person_identity(
    db: AsyncSession,
    raw_id: Optional[Any] = None,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> tuple[Optional[UUID], str, Optional[str], Optional[str]]:
    """
    Resolve a person to (user_id, name, email, phone).

    When the person IS a system user, their details come from the users
    table — the client often sends only an id, and trusting its blanks is
    how rows end up named 'Unassigned' with no email. An implementer with
    no email can never be linked to an account later, so this matters.
    """
    email = normalize_email(email)
    phone = normalize_phone(phone)
    name = (name or "").strip()

    user = None
    if raw_id:
        try:
            uid = raw_id if isinstance(raw_id, UUID) else UUID(str(raw_id))
            user = await db.get(User, uid)
        except (ValueError, TypeError):
            user = None
    if user is None:
        user = await resolve_user_by_email(db, email)

    if user:
        return (
            user.id,
            name or getattr(user, "full_name", None) or user.username,
            normalize_email(user.email) or email,
            phone or normalize_phone(getattr(user, "phone", None)),
        )

    return None, name or "Unassigned", email, phone