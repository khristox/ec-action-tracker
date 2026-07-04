# app/core/redis_client.py
import logging
from typing import Optional
import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_pool: Optional[redis.ConnectionPool] = None
_redis_client: Optional[redis.Redis] = None


async def init_redis() -> None:
    """Call once on app startup."""
    global _redis_pool, _redis_client
    _redis_pool = redis.ConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=settings.REDIS_MAX_CONNECTIONS,
        decode_responses=True,  # get str back, not bytes
    )
    _redis_client = redis.Redis(connection_pool=_redis_pool)
    try:
        await _redis_client.ping()
        logger.info("✅ Redis connected")
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
        _redis_client = None


async def close_redis() -> None:
    """Call once on app shutdown."""
    global _redis_client, _redis_pool
    if _redis_client:
        await _redis_client.aclose()
    if _redis_pool:
        await _redis_pool.disconnect()


def get_redis() -> Optional[redis.Redis]:
    """
    Accessor used throughout the app (account_lockout.py, chart_data_service.py, etc).
    Returns None if Redis isn't connected — callers must handle that gracefully.
    """
    return _redis_client