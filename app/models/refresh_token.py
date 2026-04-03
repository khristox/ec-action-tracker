# app/models/refresh_token.py

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.db.types import UUID as CustomUUID
import uuid


class RefreshToken(Base):
    """Refresh token model for storing refresh tokens."""
    __tablename__ = "refresh_tokens"
    __table_args__ = (
        Index('idx_refresh_token_user', 'user_id'),
        Index('idx_refresh_token_token', 'token', unique=True),
        Index('idx_refresh_token_expires', 'expires_at'),
        {'extend_existing': True}
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(CustomUUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(500), unique=True, nullable=False)  # Make sure this field exists
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    user = relationship("User")