from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Index, Text
from app.db.types import UUID
from sqlalchemy.sql import func
import uuid
from app.db.base import Base

class AuditLog(Base):
    """
    Audit log model to track all changes to the database.
    Records who did what, when, and what data changed.
    """
    __tablename__ = "audit_logs"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    username = Column(String(100), nullable=True)  # Denormalized for when user is deleted
    action = Column(String(50), nullable=False, index=True)  # CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
    table_name = Column(String(100), nullable=False, index=True)  # The table affected
    record_id = Column(String(100), nullable=True, index=True)  # The ID of the affected record
    old_values = Column(JSON, nullable=True)  # Previous state (for UPDATE/DELETE)
    new_values = Column(JSON, nullable=True)  # New state (for CREATE/UPDATE)
    ip_address = Column(String(45), nullable=True)  # IPv6 ready
    user_agent = Column(Text, nullable=True)
    endpoint = Column(String(255), nullable=True)  # API endpoint called
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Additional context
    request_id = Column(String(100), nullable=True)  # To group related changes in a single request
    changes_summary = Column(String(500), nullable=True)  # Human-readable summary
    
    __table_args__ = (
        # Composite indexes for common queries
        Index('ix_audit_logs_user_timestamp', user_id, timestamp),
        Index('ix_audit_logs_table_record', table_name, record_id),
        Index('ix_audit_logs_action_timestamp', action, timestamp),
    )
    
    def __repr__(self):
        return f"<AuditLog {self.action} on {self.table_name} at {self.timestamp}>"