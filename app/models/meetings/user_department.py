import datetime
import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, JSON, Enum as SQLAEnum, TypeDecorator
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum
from app.db.types import UUID as CustomUUID

def generate_uuid():
    return str(uuid.uuid4())


class UserDepartmentRole(str, enum.Enum):
    """User roles within a department - MUST match database enum values (lowercase)"""
    HEAD = "head"
    MANAGER = "manager"
    SUPERVISOR = "supervisor"
    MEMBER = "member"
    TEMPORARY = "temporary"
    CONTRACTOR = "contractor"


class UserDepartmentStatus(str, enum.Enum):
    """Department assignment status - MUST match database enum values (lowercase)"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    TRANSFERRING = "transferring"


class UserDepartment(Base):
    __tablename__ = 'user_departments'
    
    id = Column(CustomUUID, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(CustomUUID, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    department_id = Column(CustomUUID, ForeignKey('organization_nodes.id', ondelete='CASCADE'), nullable=False)
    
    # Use String instead of Enum
    role = Column(String(50), default='member', nullable=False)
    status = Column(String(50), default='active', nullable=False)
    
    is_primary = Column(Boolean, default=False)
    start_date = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc))
    end_date = Column(DateTime(timezone=True), nullable=True)
    title = Column(String(200), nullable=True)
    responsibilities = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))
    created_by = Column(CustomUUID, nullable=True)
    notes = Column(String(500), nullable=True)
    
    # Relationships - ADD overlaps parameters to fix warnings
    user = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="user_departments",
        overlaps="departments,assigned_users"  # expand overlaps
    )

    department = relationship(
        "OrganizationNode",
        foreign_keys=[department_id],
        back_populates="user_departments",
        overlaps="assigned_users,departments"  # expand overlaps
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'user_email': self.user.email if self.user else None,
            'department_id': self.department_id,
            'department_name': self.department.name if self.department else None,
            'department_path': self.department.path if self.department else None,
            'department_code': self.department.department_code if self.department else None,
            'role': self.role,
            'status': self.status,
            'is_primary': self.is_primary,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'title': self.title,
            'responsibilities': self.responsibilities or [],
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }