# app/db/base.py
"""
Database configuration (clean, production-safe).
NO auto model discovery to avoid circular imports.
"""

import logging
from typing import AsyncGenerator

from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

# ==================== BASE ====================
Base = declarative_base()

# ==================== ENGINE ====================
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    future=True,
    pool_size=getattr(settings, "DATABASE_POOL_SIZE", 10),
    max_overflow=getattr(settings, "DATABASE_MAX_OVERFLOW", 10),
    pool_pre_ping=True,
    pool_recycle=3600,
)

# ==================== SESSION FACTORY ====================
AsyncSessionFactory = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Alias (optional)
AsyncSessionLocal = AsyncSessionFactory

# ==================== DEPENDENCY ====================
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for DB session
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# ==================== IMPORTANT ====================
# DO NOT import models here
# Import them in app/models/__init__.py instead