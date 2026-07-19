# app/core/database.py

import os
import logging
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

logger = logging.getLogger(__name__)

DATABASE_URL = settings.DATABASE_URL

# Create async engine with proper connection pooling
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_timeout=60,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

# ✅ Add this function if you want to use it
@asynccontextmanager
async def get_db_context():
    """
    Get database session as context manager.
    Use this for manual session management.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# ✅ Keep this for FastAPI dependency injection
async def get_db() -> AsyncSession:
    """
    Get database session with proper cleanup.
    Use this as a dependency in FastAPI endpoints.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# ✅ Keep this for retry logic
async def execute_with_retry(func, max_retries=3, delay=1):
    """
    Execute a database operation with retry logic.
    """
    import asyncio
    
    last_exception = None
    current_delay = delay
    
    for attempt in range(max_retries):
        try:
            return await func()
        except Exception as e:
            last_exception = e
            if attempt < max_retries - 1:
                logger.warning(
                    f"Database operation failed (attempt {attempt + 1}/{max_retries}): {e}. "
                    f"Retrying in {current_delay}s..."
                )
                await asyncio.sleep(current_delay)
                current_delay *= 2
            else:
                logger.error(f"Database operation failed after {max_retries} attempts: {e}")
                raise
    
    if last_exception:
        raise last_exception
    raise RuntimeError("Database operation failed")