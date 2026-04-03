# app/db/types.py
"""
Custom database types for cross-database compatibility
"""
import uuid
from sqlalchemy import types
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class UUID(types.TypeDecorator):
    """
    Platform-independent UUID type.
    Uses PostgreSQL's UUID type when available, otherwise uses CHAR(36).
    """
    impl = types.TypeEngine
    cache_ok = True
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID())
        else:
            # For MySQL, SQLite, etc.
            return dialect.type_descriptor(CHAR(36))
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            # PostgreSQL accepts UUID objects directly
            return value
        else:
            # MySQL needs string representation
            if isinstance(value, uuid.UUID):
                return str(value)
            return str(value)
    
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            # PostgreSQL returns UUID objects
            return value
        else:
            # MySQL returns strings, convert to UUID
            if isinstance(value, uuid.UUID):
                return value
            try:
                return uuid.UUID(value)
            except (ValueError, TypeError):
                return value