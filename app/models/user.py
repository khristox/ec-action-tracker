# app/models/user.py

"""
User Model - Core authentication with standard fields
Extended attributes go to user_attributes table
"""

from sqlalchemy import Column, String, Boolean, DateTime, Date, ForeignKey, Index, Integer, Table, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base
from app.db.types import UUID as CustomUUID
import uuid
from datetime import datetime, timedelta
from typing import Any


# Association table for user roles (many-to-many)
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', CustomUUID, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', CustomUUID, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('assigned_at', DateTime(timezone=True), server_default=func.now()),
    Column('assigned_by', CustomUUID, ForeignKey('users.id'), nullable=True),
    Column('is_active', Boolean, default=True),
    Column('entity_type', String(50), nullable=True),
    Column('entity_id', CustomUUID, nullable=True),
    Column('extra_metadata', JSON, default=dict),
    extend_existing=True
)


class User(Base):
    """
    User Model - Core authentication with standard fields.
    Extended attributes are stored in user_attributes table.
    """
    __tablename__ = "users"
    __table_args__ = (
        Index('idx_user_email', 'email'),
        Index('idx_user_username', 'username'),
        Index('idx_user_phone', 'phone'),
        Index('idx_user_is_active', 'is_active'),
        Index('idx_user_nationality', 'nationality_attribute_id'),
        {'extend_existing': True}
    )
    
    # ==================== CORE AUTHENTICATION ====================
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)

    
    
    # ==================== ACCOUNT STATUS ====================
    is_active = Column(Boolean, default=True, index=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    
    # ==================== STANDARD FIELDS ====================
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    middle_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True, index=True)
    alternate_phone = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)

    
    
    # Nationality - Linked to Country attribute group
    nationality_attribute_id = Column(CustomUUID, ForeignKey("attributes.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # ==================== ACCOUNT SECURITY ====================
    last_login = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    lock_reason = Column(String(255), nullable=True)
    
    # Verification Tokens
    verification_token = Column(String(255), nullable=True)
    verification_token_expires = Column(DateTime(timezone=True), nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    
    # ==================== AUDIT FIELDS ====================
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(CustomUUID, nullable=True)
    updated_by = Column(CustomUUID, nullable=True)
    


    # Roles (Many-to-Many) - Specify foreign_keys to avoid ambiguity
    roles = relationship(
        "Role", 
        secondary=user_roles, 
        back_populates="users", 
        lazy="selectin",
        primaryjoin="User.id == user_roles.c.user_id",  # Specify which foreign key to use
        secondaryjoin="Role.id == user_roles.c.role_id"
    )
    
    # Nationality (from attribute system)
    nationality = relationship(
        "Attribute", 
        foreign_keys=[nationality_attribute_id], 
        lazy="selectin"
    )
    
    # Extended user attributes
    extended_attributes = relationship(
        "UserAttribute",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    # ==================== PROPERTIES ====================
    
    @property
    def full_name(self) -> str:
        """Return full name"""
        if self.first_name and self.last_name:
            if self.middle_name:
                return f"{self.first_name} {self.middle_name} {self.last_name}"
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        return self.username or self.email
    
    @property
    def username_or_email(self) -> str:
        """Return username if exists, otherwise email"""
        return self.username or self.email
    
    @property
    def age(self) -> int:
        """Calculate age from date of birth"""
        if self.date_of_birth:
            today = datetime.now().date()
            return today.year - self.date_of_birth.year - (
                (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
            )
        return None
    
    @property
    def nationality_name(self) -> str:
        """Get nationality name from attribute"""
        if self.nationality:
            return self.nationality.value_display or self.nationality.value
        return None
    
    # ==================== ROLE CHECKS ====================
    
    @property
    def is_student(self) -> bool:
        """Check if user has student role"""
        return any(role.code == "student" for role in self.roles)
    
    @property
    def is_academic_staff(self) -> bool:
        """Check if user has academic staff role"""
        return any(role.code == "academic_staff" for role in self.roles)
    
    @property
    def is_administrative_staff(self) -> bool:
        """Check if user has administrative staff role"""
        return any(role.code == "administrative_staff" for role in self.roles)
    
    @property
    def is_staff(self) -> bool:
        """Check if user has any staff role"""
        return self.is_academic_staff or self.is_administrative_staff
    
    def has_role(self, role_code: str) -> bool:
        """Check if user has a specific role"""
        return any(role.code == role_code for role in self.roles)
    
    def has_permission(self, permission_code: str) -> bool:
        """Check if user has a specific permission through roles"""
        if self.is_superuser:
            return True
        
        for role in self.roles:
            for permission in role.permissions:
                if permission.code == permission_code:
                    return True
        return False
    
    # ==================== EXTENDED ATTRIBUTES ====================
    
    def get_extended_attribute(self, attr_code: str) -> Any:
        """Get an extended attribute value by attribute code."""
        for attr in self.extended_attributes:
            if attr.attribute and attr.attribute.code == attr_code:
                return attr.value
        return None
    
    def get_extended_attributes_dict(self) -> dict:
        """Get all extended attributes as a dictionary."""
        return {
            attr.attribute.code: attr.value 
            for attr in self.extended_attributes 
            if attr.attribute
        }
    
    # ==================== ACCOUNT METHODS ====================
    
    def is_account_locked(self) -> bool:
        """Check if account is locked"""
        if self.locked_until:
            return self.locked_until > datetime.now()
        return False
    
    def increment_login_attempts(self) -> None:
        """Increment login attempts counter"""
        self.login_attempts += 1
    
    def reset_login_attempts(self) -> None:
        """Reset login attempts counter"""
        self.login_attempts = 0
    
    def lock_account(self, reason: str = None, duration_minutes: int = 30) -> None:
        """Lock the user account"""
        self.locked_until = datetime.now() + timedelta(minutes=duration_minutes)
        self.lock_reason = reason
    
    def unlock_account(self) -> None:
        """Unlock the user account"""
        self.locked_until = None
        self.lock_reason = None
        self.login_attempts = 0
    
    def __repr__(self) -> str:
        return f"<User {self.username_or_email}>"