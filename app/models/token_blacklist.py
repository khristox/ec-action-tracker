# app/models/token_blacklist.py
from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.sql import func
from app.db.base import Base
import uuid

class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(500), unique=True, index=True, nullable=False)
    user_id = Column(String(36), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    def __repr__(self):
        return f"<TokenBlacklist {self.user_id}>"