# app/db/base.py
"""
Database configuration with automatic model discovery.
"""
import importlib
import pkgutil
from pathlib import Path
from typing import AsyncGenerator
import logging

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

# ==================== BASE DECLARATIVE ====================
Base = declarative_base()

# ==================== ENGINE CONFIGURATION ====================
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    future=True,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=getattr(settings, 'DATABASE_MAX_OVERFLOW', 10),
    pool_pre_ping=True,
    pool_recycle=3600,
)

# ==================== SESSION FACTORY ====================
AsyncSessionFactory = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

AsyncSessionLocal = AsyncSessionFactory

# ==================== DEPENDENCY ====================
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency function that yields database sessions."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# ==================== AUTOMATIC MODEL DISCOVERY ====================
def _discover_and_import_models():
    """Automatically discover and import all models from app.models."""
    import app.models
    
    models_module = app.models
    model_modules = []
    
    # Walk through all submodules
    for _, module_name, is_pkg in pkgutil.walk_packages(
        models_module.__path__, 
        models_module.__name__ + "."
    ):
        try:
            imported_module = importlib.import_module(module_name)
            model_modules.append(imported_module)
            logger.debug(f"  Imported module: {module_name}")
        except ImportError as e:
            logger.debug(f"  Skipped {module_name}: {e}")
    
    # Collect all model classes
    model_classes = {}
    for module in model_modules:
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (isinstance(attr, type) and 
                hasattr(attr, '__tablename__') and 
                attr.__tablename__ is not None and
                attr.__module__ == module.__name__):
                model_classes[attr_name] = attr
                logger.debug(f"  Found model: {attr_name}")
    
    return model_classes


# Discover and import all models
_models = _discover_and_import_models()

logger.info(f"✅ Discovered and imported {len(_models)} models:")
for model_name in _models.keys():
    logger.info(f"   - {model_name}")

# ==================== EXPORTS ====================
__all__ = [
    "Base",
    "async_engine",
    "AsyncSessionFactory",
    "AsyncSessionLocal",
    "get_db",
]

# Add all discovered models to exports
for model_name, model_class in _models.items():
    __all__.append(model_name)
    globals()[model_name] = model_class