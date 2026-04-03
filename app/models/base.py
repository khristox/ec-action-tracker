# app/models/base.py
from sqlalchemy import Column, DateTime, Boolean, JSON, Integer
from app.db.types import UUID as CustomUUID
from sqlalchemy.sql import func
from app.db.base import Base  # Import from base.py
import uuid

class BaseModel(Base):
    """Base model with common fields for all models"""
    __abstract__ = True
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True, index=True)
    created_by = Column(CustomUUID, nullable=True)
    updated_by = Column(CustomUUID, nullable=True)
    extra_metadata = Column(JSON, nullable=True)
    sort_order = Column(Integer, default=0)