# app/db/base_class.py
"""Base class for SQLAlchemy models (sync version for Alembic)."""
from app.db.base import Base  # Import from base.py instead of creating new

# Re-export Base
__all__ = ["Base"]