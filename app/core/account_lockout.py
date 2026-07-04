# app/core/account_lockout.py
import logging
from typing import Optional, Tuple
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

# ==================== Config ====================
MAX_FAILED_ATTEMPTS = 5
ATTEMPT_WINDOW_SECONDS = 15 * 60      # failed attempts count resets after 15 min of no failures
LOCKOUT_DURATION_SECONDS = 15 * 60    # account stays locked for 15 min once triggered


def _attempts_key(identifier: str) -> str:
    return f"login_attempts:{identifier.lower()}"


def _lock_key(identifier: str) -> str:
    return f"login_locked:{identifier.lower()}"


async def is_locked(identifier: str) -> Tuple[bool, int]:
    """
    Check if an account is currently locked out.
    Returns (is_locked, seconds_remaining). If Redis is unavailable,
    fails open (returns not-locked) — availability of login shouldn't
    depend on Redis being up, and the DB-level checks in auth.py remain
    the source of truth for anything security-critical.
    """
    r = get_redis()
    if r is None:
        return False, 0

    try:
        ttl = await r.ttl(_lock_key(identifier))
        if ttl and ttl > 0:
            return True, ttl
        return False, 0
    except Exception as e:
        logger.warning(f"Redis lockout check failed, failing open: {e}")
        return False, 0


async def record_failed_attempt(identifier: str) -> Tuple[int, bool]:
    """
    Record a failed login attempt. Returns (attempt_count, just_got_locked).
    Uses a Redis pipeline so the increment + TTL-set happen atomically
    and the window resets correctly the first time a key is created.
    """
    r = get_redis()
    if r is None:
        return 0, False

    key = _attempts_key(identifier)
    try:
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, ATTEMPT_WINDOW_SECONDS, nx=True)  # only set TTL if not already set
        results = await pipe.execute()
        count = results[0]

        if count >= MAX_FAILED_ATTEMPTS:
            await r.setex(_lock_key(identifier), LOCKOUT_DURATION_SECONDS, "1")
            await r.delete(key)  # clear the counter now that the lock itself is the gate
            return count, True

        return count, False
    except Exception as e:
        logger.warning(f"Redis failed-attempt tracking error: {e}")
        return 0, False


async def clear_failed_attempts(identifier: str) -> None:
    """Call this on successful login to reset the slate."""
    r = get_redis()
    if r is None:
        return
    try:
        await r.delete(_attempts_key(identifier), _lock_key(identifier))
    except Exception as e:
        logger.warning(f"Redis clear-attempts error: {e}")