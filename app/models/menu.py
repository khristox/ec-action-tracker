# app/models/menu.py
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship, object_session
from datetime import datetime, timezone
import uuid
from app.db.base import Base
from app.db.types import UUID as CustomUUID


class Menu(Base):
    """Menu model for navigation hierarchy"""
    __tablename__ = "menus"
    
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(100), nullable=False)
    icon = Column(String(50), nullable=True)
    path = Column(String(255), nullable=True)
    parent_id = Column(CustomUUID, ForeignKey("menus.id", ondelete="SET NULL"), nullable=True, index=True)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    requires_auth = Column(Boolean, default=True, nullable=False)
    target = Column(String(20), default="_self", nullable=False)
    badge = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    parent = relationship(
        "Menu", 
        remote_side=[id], 
        backref="children",
        lazy="select"
    )
    role_permissions = relationship(
        "RoleMenuPermission", 
        back_populates="menu", 
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    # Indexes for better performance
    __table_args__ = (
        Index('idx_menu_parent_active', 'parent_id', 'is_active'),
        Index('idx_menu_sort_order', 'sort_order'),
        Index('idx_menu_code_active', 'code', 'is_active'),
    )
    
    def __repr__(self) -> str:
        """Safe __repr__ that works with detached instances"""
        # Get the ID safely without triggering database loads
        id_value = self._get_safe_id()
        if id_value:
            return f"<Menu {id_value}>"
        return f"<Menu at {hex(id(self))}>"
    
    def _get_safe_id(self) -> str | None:
        """Safely retrieve ID without triggering database loads"""
        try:
            # Check if we have a session and if the ID is already loaded
            session = object_session(self)
            if session:
                # Try to get from identity map without loading
                if hasattr(self, '_sa_instance_state'):
                    # Check if id is in committed state
                    state = self._sa_instance_state
                    if state.key and len(state.key) > 1:
                        return state.key[1]
            
            # Try to access id attribute directly (won't load if not present)
            if 'id' in self.__dict__:
                return str(self.__dict__['id'])
            
            # Try to access through property (might be loaded)
            id_value = getattr(self, 'id', None)
            if id_value is not None:
                return str(id_value)
                
        except Exception:
            # Silently fail and return None
            pass
        
        return None
    
    @property
    def is_root(self) -> bool:
        """Check if menu is a root level menu"""
        return self.parent_id is None
    
    @property
    def has_children(self) -> bool:
        """Check if menu has child menus (lazy check)"""
        try:
            # Check if children are already loaded
            if 'children' in self.__dict__:
                return len(self.__dict__['children']) > 0
            # If not loaded, assume False to avoid triggering load
            return False
        except Exception:
            return False
    
    @property
    def full_path(self) -> str | None:
        """Get full path for the menu"""
        if self.path:
            return self.path
        if self.code:
            return f"/{self.code}"
        return None


class RoleMenuPermission(Base):
    """Role-Menu permission junction model"""
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
    can_view = Column(Boolean, default=True, nullable=False)
    can_access = Column(Boolean, default=True, nullable=False)
    can_show_mb_bottom = Column(
        Boolean, 
        default=False, 
        nullable=False,
        comment="Can show on mobile bottom navigation for this role"
    )
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    role = relationship(
        "Role", 
        back_populates="menu_permissions",
        lazy="select"
    )
    menu = relationship(
        "Menu", 
        back_populates="role_permissions",
        lazy="select"
    )
    
    __table_args__ = (
        UniqueConstraint('role_id', 'menu_id', name='uq_role_menu'),
        Index('idx_role_menu_permissions', 'role_id', 'menu_id', 'can_view', 'can_access'),
        Index('idx_role_mobile_bottom', 'role_id', 'can_show_mb_bottom'),
    )
    
    def __repr__(self) -> str:
        """Safe __repr__ for RoleMenuPermission"""
        id_value = self._get_safe_id()
        if id_value:
            return f"<RoleMenuPermission {id_value}>"
        return f"<RoleMenuPermission at {hex(id(self))}>"
    
    def _get_safe_id(self) -> str | None:
        """Safely retrieve ID without triggering database loads"""
        try:
            if 'id' in self.__dict__:
                return str(self.__dict__['id'])
            
            id_value = getattr(self, 'id', None)
            if id_value is not None:
                return str(id_value)
        except Exception:
            pass
        
        return None
    
    @property
    def has_full_access(self) -> bool:
        """Check if this permission grants full access"""
        return self.can_view and self.can_access
    
    @property
    def is_mobile_enabled(self) -> bool:
        """Check if this permission enables mobile bottom navigation"""
        return self.has_full_access and self.can_show_mb_bottom