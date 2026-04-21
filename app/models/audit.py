# app/models/audit.py
import uuid
from sqlalchemy import Column, String, DateTime, Text, JSON, Index
from sqlalchemy.dialects.mysql import CHAR
from datetime import datetime
import enum
from app.db.base import Base


class AuditStatus(str, enum.Enum):
    """Audit status enum - stores lowercase in database but accepts both cases"""
    SUCCESS = "success"
    FAILURE = "failure"
    PENDING = "pending"
    PARTIAL = "partial"
    
    @classmethod
    def _missing_(cls, value):
        """Handle case-insensitive lookups - converts uppercase to lowercase"""
        if isinstance(value, str):
            # Convert to lowercase for lookup
            value_lower = value.lower()
            for member in cls:
                if member.value == value_lower:
                    return member
        return cls.PENDING
    
    @classmethod
    def from_string(cls, value: str):
        """Convert any string to proper enum value"""
        if not value:
            return cls.PENDING
        return cls._missing_(value)
    
    @classmethod
    def coerce(cls, value):
        """Coerce any value to a valid enum string"""
        if value is None:
            return "pending"
        if isinstance(value, cls):
            return value.value
        if isinstance(value, str):
            value_lower = value.lower()
            if value_lower in [e.value for e in cls]:
                return value_lower
            # Default to pending for unknown values
            return "pending"
        return "pending"


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), nullable=True, index=True)
    username = Column(String(255), nullable=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    table_name = Column(String(100), nullable=True, index=True)
    record_id = Column(String(255), nullable=True, index=True)
    old_data = Column(JSON, nullable=True)
    new_data = Column(JSON, nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    endpoint = Column(String(500), nullable=True)
    request_id = Column(String(255), nullable=True)
    changes_summary = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    extra_data = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Use String instead of Enum to accept any value
    # This will accept both 'SUCCESS' and 'success'
    status = Column(String(50), default="pending", nullable=False, index=True)
    
    __table_args__ = (
        Index('idx_audit_logs_user_id', 'user_id'),
        Index('idx_audit_logs_action', 'action'),
        Index('idx_audit_logs_table_name', 'table_name'),
        Index('idx_audit_logs_timestamp', 'timestamp'),
        Index('idx_audit_logs_record_id', 'record_id'),
        Index('idx_audit_logs_status', 'status'),
    )
    
    def __init__(self, **kwargs):
        """Override init to normalize status value"""
        if 'status' in kwargs:
            status_value = kwargs['status']
            if status_value:
                # Convert to lowercase for consistency
                kwargs['status'] = str(status_value).lower()
        super().__init__(**kwargs)
    
    @property
    def status_normalized(self):
        """Get normalized status value (always lowercase)"""
        return self.status.lower() if self.status else "pending"
    
    @property
    def is_success(self):
        """Check if status is success"""
        return self.status and self.status.lower() == "success"
    
    @property
    def is_failure(self):
        """Check if status is failure"""
        return self.status and self.status.lower() == "failure"
    
    @property
    def is_pending(self):
        """Check if status is pending"""
        return self.status and self.status.lower() == "pending"
    
    @property
    def is_partial(self):
        """Check if status is partial"""
        return self.status and self.status.lower() == "partial"