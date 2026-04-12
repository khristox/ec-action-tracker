"""
Role and Permission Models - Role-Based Access Control
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, JSON, 
    ForeignKey, Table, Index, UniqueConstraint, text
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from app.db.base import Base
from app.db.types import UUID as CustomUUID

# ==================== MIXINS ====================

class TimestampMixin:
    """Mixin for consistent created/updated timestamps using server-side logic"""
    created_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        server_default=func.now(),
        index=True
    )
    updated_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        server_default=func.now(), 
        onupdate=func.now()
    )

# ==================== ASSOCIATION TABLES ====================

# Role-Permissions association table (many-to-many)
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', CustomUUID, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('permission_id', CustomUUID, ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now()),
    extend_existing=True
)

# ==================== MODELS ====================

class Permission(Base, TimestampMixin):
    """
    Permission model for fine-grained access control.
    Each permission represents a specific action on a resource (e.g., 'user:create').
    """
    __tablename__ = "permissions"
    __table_args__ = (
        Index('idx_permission_resource_action', 'resource', 'action'),
        {'extend_existing': True}
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True) # e.g., 'USR_CREATE'
    resource = Column(String(50), nullable=False, index=True)          # e.g., 'user'
    action = Column(String(50), nullable=False, index=True)            # e.g., 'create'
    description = Column(String(255), nullable=True)
    conditions = Column(JSON, nullable=True, comment="Abac conditions for dynamic filtering")
    is_system = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions", lazy="selectin")
    
    def __repr__(self):
        return f"<Permission {self.code}: {self.resource}:{self.action}>"


class Role(Base, TimestampMixin):
    """
    Role model for grouping permissions. 
    Priority allows for hierarchical role resolution.
    """
    __tablename__ = "roles"
    __table_args__ = (
        Index('idx_role_lookup', 'code', 'is_system_role'),
        {'extend_existing': True}
    )
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    is_system_role = Column(Boolean, default=False, nullable=False)
    priority = Column(Integer, default=0, nullable=False, server_default=text("0"))
    
    # Relationships
    # Note: User relationship primaryjoin is defined explicitly to ensure clarity in complex RBAC
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
    
    menu_permissions = relationship(
        "RoleMenuPermission", 
        back_populates="role", 
        cascade="all, delete-orphan",
        passive_deletes=True
    )
    
    def __repr__(self):
        return f"<Role {self.code}: {self.name}>"


class RoleMenuPermission(Base):
    """
    Junction model controlling which UI elements/menus a role can interact with.
    """
    __tablename__ = "role_menu_permissions"
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4)
    role_id = Column(
        CustomUUID, 
        ForeignKey("roles.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )
    menu_id = Column(
        CustomUUID, 
        ForeignKey("menus.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )
    
    can_view = Column(Boolean, default=True, nullable=False, server_default=text("true"))
    can_access = Column(Boolean, default=True, nullable=False, server_default=text("true"))
    can_show_mb_bottom = Column(
        Boolean, 
        default=False, 
        nullable=False,
        server_default=text("false"),
        comment="Visibility on mobile bottom navigation bars"
    )
    
    # Use server_default for efficiency and to avoid the "datetime" module error reported
    created_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        server_default=func.now()
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())  # ADD THIS LINE

    
    # Relationships
    role = relationship("Role", back_populates="menu_permissions")
    menu = relationship("Menu", back_populates="role_permissions")
    
    __table_args__ = (
        UniqueConstraint('role_id', 'menu_id', name='uq_role_menu'),
        Index('idx_role_menu_access', 'role_id', 'can_view', 'can_access'),
        Index('idx_mobile_nav_lookup', 'role_id', 'can_show_mb_bottom'),
    )
    
    def __repr__(self) -> str:
        return f"<RoleMenuPermission Role:{self.role_id} Menu:{self.menu_id}>"

    @property
    def has_full_access(self) -> bool:
        """Check if this permission grants both view and interaction rights"""
        return self.can_view and self.can_access
    
    @property
    def is_mobile_enabled(self) -> bool:
        """Logic for inclusion in mobile navigation"""
        return self.can_view and self.can_show_mb_bottom