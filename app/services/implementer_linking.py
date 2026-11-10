# app/services/implementer_linking.py
"""
Implementer <-> User linking.

An action implementer is a PERSON, who may or may not have a system account.

    user_id IS NULL      -> external person (participant, guest, colleague)
    user_id IS NOT NULL  -> linked to a system account

Identity is resolved on the SERVER, never trusted from the client:

  * The client may send `user_id` (a person picked from the system users) and/or
    the legacy `id` field. Either one is VERIFIED against the users table before
    it is used. An id that is not a users.id (for example a
    meeting_participants.id from the participant picker) is simply ignored and
    the person is matched by EMAIL instead. That is what caused the
    fk_action_implementers_user violation before: a participant id was written
    straight into action_implementers.user_id.
  * When the person IS a system user, their name, email and phone are read from
    the users table (the picker only sees masked contact details). An
    implementer without a real email can never receive a reminder and can never
    be linked to an account later, so this matters.

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
    # .first(), not scalar_one_or_none(): two accounts that differ only by
    # letter case must not crash the whole action save.
    return result.scalars().first()


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
    table: the client often sends only an id (or a masked email), and trusting
    its blanks is how rows end up named 'Unassigned' with no email.
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
            logger.debug(
                "Id %s is not a users.id (probably a participant id); "
                "falling back to email matching.",
                raw_id,
            )
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


async def build_implementer(
    db: AsyncSession,
    action_id: UUID,
    person: Dict[str, Any],
    sort_order: int,
) -> ActionImplementer:
    """Build an implementer without mistaking participant IDs for user IDs."""
    email = normalize_email(person.get("email"))
    phone = normalize_phone(
        person.get("phone") or person.get("telephone")
    )
    name = (person.get("name") or "").strip()

    # `user_id` is the explicit field. The legacy `id` is accepted too, but
    # either one is only used if it really is a users.id (resolve_person_identity
    # checks the users table), so a participant's id can never end up in
    # action_implementers.user_id.
    raw_user_id = person.get("user_id") or person.get("id")

    user_id, resolved_name, resolved_email, resolved_phone = (
        await resolve_person_identity(
            db,
            raw_id=raw_user_id,
            name=name,
            email=email,
            phone=phone,
        )
    )

    return ActionImplementer(
        action_id=action_id,
        user_id=user_id,
        name=resolved_name,
        email=resolved_email,
        phone=resolved_phone,
        sort_order=sort_order,
    )


async def build_implementers(
    db: AsyncSession,
    action_id: UUID,
    people: List[Dict[str, Any]],
) -> List[ActionImplementer]:
    """
    Build the full implementer list for an action.

    De-duplicated by email AND by linked account, so the same person picked
    twice (once as a system user, once as a meeting participant) is stored once
    and gets one reminder email, not two.
    """
    seen_emails: set[str] = set()
    seen_user_ids: set[UUID] = set()
    rows: List[ActionImplementer] = []

    for person in people or []:
        # Pydantic models get converted; plain dicts pass through.
        if hasattr(person, "model_dump"):
            person = person.model_dump()
        elif hasattr(person, "dict"):
            person = person.dict()

        client_email = normalize_email(person.get("email"))
        if client_email and client_email in seen_emails:
            continue

        row = await build_implementer(db, action_id, person, len(rows))

        # The row's final identity may differ from what the client sent
        # (e.g. the real email read from the account).
        if row.user_id and row.user_id in seen_user_ids:
            continue
        if row.email and row.email in seen_emails:
            continue

        if row.user_id:
            seen_user_ids.add(row.user_id)
        if row.email:
            seen_emails.add(row.email)
        if client_email:
            seen_emails.add(client_email)

        rows.append(row)

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
        .values(user_id=user.id)
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
