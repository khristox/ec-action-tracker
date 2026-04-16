# app/models/audit.py
import uuid

from pygments.lexer import default
from sqlalchemy import Column, String, DateTime, Text, JSON, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import enum
from app.db.types import UUID as CustomUUID


from app.db.base import Base


class AuditStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    PENDING = "pending"


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(CustomUUID, nullable=True)
    username = Column(String(255), nullable=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False)
    table_name = Column(String(100), nullable=True)
    record_id = Column(String(255), nullable=True)
    old_data = Column(JSON, nullable=True)
    new_data = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    endpoint = Column(String(500), nullable=True)
    request_id = Column(String(255), nullable=True)
    changes_summary = Column(Text, nullable=True)
    status = Column(Enum(AuditStatus), default=AuditStatus.SUCCESS, nullable=False)
    error_message = Column(Text, nullable=True)
    extra_data = Column(JSON, nullable=True)  # Changed from 'metadata' to 'extra_data'
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Indexes for better performance
    __table_args__ = (
        Index('idx_audit_logs_user_id', 'user_id'),
        Index('idx_audit_logs_action', 'action'),
        Index('idx_audit_logs_table_name', 'table_name'),
        Index('idx_audit_logs_timestamp', 'timestamp'),
        Index('idx_audit_logs_record_id', 'record_id'),
        Index('idx_audit_logs_status', 'status'),
    )