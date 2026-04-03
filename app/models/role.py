# app/models/role.py

"""
Role and Permission Models - Role-Based Access Control
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, JSON, ForeignKey, Table, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base
from app.db.types import UUID as CustomUUID
import uuid


# Role-Permissions association table (many-to-many)
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', CustomUUID, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('permission_id', CustomUUID, ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now()),
    extend_existing=True
)


class Permission(Base):
    """
    Permission model for fine-grained access control.
    Each permission represents a specific action on a resource.
    """
    __tablename__ = "permissions"
    __table_args__ = (
        Index('idx_permission_code', 'code'),
        Index('idx_permission_resource_action', 'resource', 'action'),
        {'extend_existing': True}
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    resource = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)
    conditions = Column(JSON, nullable=True)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions", lazy="selectin")
    
    def __repr__(self):
        return f"<Permission {self.code}: {self.resource}:{self.action}>"


class Role(Base):
    """
    Role model for role-based access control.
    Roles group permissions together for easier management.
    """
    __tablename__ = "roles"
    __table_args__ = (
        Index('idx_role_code', 'code'),
        Index('idx_role_name', 'name'),
        {'extend_existing': True}
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(50), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    is_system_role = Column(Boolean, default=False)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships - Specify foreign_keys to avoid ambiguity
    users = relationship(
        "User", 
        secondary="user_roles", 
        back_populates="roles", 
        lazy="selectin",
        primaryjoin="Role.id == user_roles.c.role_id",
        secondaryjoin="User.id == user_roles.c.user_id"
    )
    permissions = relationship(
        "Permission", 
        secondary=role_permissions, 
        back_populates="roles", 
        lazy="selectin"
    )
    menu_permissions = relationship("RoleMenuPermission", back_populates="role", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Role {self.code}: {self.name}>"