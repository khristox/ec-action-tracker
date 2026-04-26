# app/models/user.py

"""
User Model - Core authentication with standard fields
Extended attributes go to user_attributes table
"""

from sqlalchemy import Column, LargeBinary, String, Boolean, DateTime, Date, ForeignKey, Index, Integer, Table, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base
from app.db.types import UUID as CustomUUID
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional, List, Dict


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
        Index('idx_user_gender_attribute', 'gender_attribute_id'),
        Index('idx_user_language_attribute', 'language_attribute_id'),
        Index('idx_user_currency_attribute', 'currency_attribute_id'),
        Index('idx_user_country_attribute', 'country_attribute_id'),
        Index('idx_user_location', 'location_id'),
        {'extend_existing': True}
    )
    
    # ==================== CORE AUTHENTICATION ====================
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)

    # ==================== USER PREFERENCES ====================
    # Direct string fields (not relationships)
    preferred_language = Column(String(10), nullable=False, default="en")
    preferred_timezone = Column(String(50), nullable=False, default="UTC")
    preferred_currency = Column(String(3), nullable=True)
    
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
    
    # Address fields
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    
    # Professional fields
    occupation = Column(String(100), nullable=True)
    education = Column(String(200), nullable=True)
    bio = Column(String(500), nullable=True)

    # ==================== ATTRIBUTE REFERENCES (with Foreign Keys) ====================
    # Gender - Links to attributes table where group_code = 'GENDER'
    gender_attribute_id = Column(
        CustomUUID, 
        ForeignKey("attributes.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )
    
    # Language - Links to attributes table where group_code = 'LANGUAGE'
    language_attribute_id = Column(
        CustomUUID, 
        ForeignKey("attributes.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )
    
    # Currency - Links to attributes table where group_code = 'CURRENCY'
    currency_attribute_id = Column(
        CustomUUID, 
        ForeignKey("attributes.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )
    
    # Country - Links to attributes table where group_code = 'COUNTRY'
    country_attribute_id = Column(
        CustomUUID, 
        ForeignKey("attributes.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )
    
    # Nationality - Links to Country attribute group
    nationality_attribute_id = Column(
        CustomUUID, 
        ForeignKey("attributes.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )
    
    # Location from CTE - Links to locations table (if exists)
    location_id = Column(
        CustomUUID, 
        ForeignKey("locations.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )
    
    # ==================== ACCOUNT SECURITY ====================
    last_login = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    lock_reason = Column(String(255), nullable=True)
    
    # Verification Tokens
    verification_token = Column(String(1000), nullable=True)
    verification_token_expires = Column(DateTime(timezone=True), nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)

    verification_sent_at = Column(DateTime(timezone=True), nullable=True)
    verification_sent_count = Column(Integer, default=0)
    reset_sent_at = Column(DateTime(timezone=True), nullable=True)
    reset_sent_count = Column(Integer, default=0)

    # Profile picture fields
    profile_picture = Column(LargeBinary, nullable=True)
    profile_picture_type = Column(String(50), nullable=True)
    
    # ==================== AUDIT FIELDS ====================
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(CustomUUID, nullable=True)
    updated_by = Column(CustomUUID, nullable=True)
    
    # ==================== RELATIONSHIPS (Renamed to avoid conflict) ====================
    
    # Roles (Many-to-Many)
    roles = relationship(
        "Role", 
        secondary=user_roles, 
        back_populates="users", 
        lazy="selectin",
        primaryjoin="User.id == user_roles.c.user_id",
        secondaryjoin="Role.id == user_roles.c.role_id"
    )
    
    # Attribute relationships - RENAMED to avoid conflict with column names
    gender_attribute = relationship(
        "Attribute", 
        foreign_keys=[gender_attribute_id],
        primaryjoin="User.gender_attribute_id == Attribute.id",
        lazy="selectin"
    )
    
    language_attribute = relationship(
        "Attribute", 
        foreign_keys=[language_attribute_id],
        primaryjoin="User.language_attribute_id == Attribute.id",
        lazy="selectin"
    )
    
    currency_attribute = relationship(
        "Attribute", 
        foreign_keys=[currency_attribute_id],
        primaryjoin="User.currency_attribute_id == Attribute.id",
        lazy="selectin"
    )
    
    country_attribute = relationship(
        "Attribute", 
        foreign_keys=[country_attribute_id],
        primaryjoin="User.country_attribute_id == Attribute.id",
        lazy="selectin"
    )
    
    nationality_attribute = relationship(
        "Attribute", 
        foreign_keys=[nationality_attribute_id],
        primaryjoin="User.nationality_attribute_id == Attribute.id",
        lazy="selectin"
    )
    
    # Location relationship (if locations table exists)
    # location = relationship(
    #     "Location", 
    #     foreign_keys=[location_id],
    #     primaryjoin="User.location_id == Location.id",
    #     lazy="selectin"
    # )
    
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
    def age(self) -> Optional[int]:
        """Calculate age from date of birth"""
        if self.date_of_birth:
            today = datetime.now().date()
            return today.year - self.date_of_birth.year - (
                (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
            )
        return None
    
    # Attribute name properties (using renamed relationships)
    @property
    def gender_name(self) -> Optional[str]:
        """Get gender name from attribute"""
        if self.gender_attribute:
            return self.gender_attribute.value_display or self.gender_attribute.value
        return None
    
    @property
    def language_name(self) -> Optional[str]:
        """Get language name from attribute"""
        if self.language_attribute:
            return self.language_attribute.value_display or self.language_attribute.value
        return None
    
    @property
    def currency_name(self) -> Optional[str]:
        """Get currency name from attribute"""
        if self.currency_attribute:
            return self.currency_attribute.value_display or self.currency_attribute.value
        return None
    
    @property
    def country_name(self) -> Optional[str]:
        """Get country name from attribute"""
        if self.country_attribute:
            return self.country_attribute.value_display or self.country_attribute.value
        return None
    
    @property
    def nationality_name(self) -> Optional[str]:
        """Get nationality name from attribute"""
        if self.nationality_attribute:
            return self.nationality_attribute.value_display or self.nationality_attribute.value
        return None
    
    # Simple preference properties (no relationship needed)
    @property
    def language(self) -> str:
        """Get preferred language (direct field)"""
        return self.preferred_language
    
    @language.setter
    def language(self, value: str):
        """Set preferred language"""
        self.preferred_language = value
    
    @property
    def timezone(self) -> str:
        """Get preferred timezone (direct field)"""
        return self.preferred_timezone
    
    @timezone.setter
    def timezone(self, value: str):
        """Set preferred timezone"""
        self.preferred_timezone = value
    
    @property
    def currency(self) -> Optional[str]:
        """Get preferred currency"""
        return self.preferred_currency
    
    @currency.setter
    def currency(self, value: Optional[str]):
        """Set preferred currency"""
        self.preferred_currency = value
    
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
    
    def get_extended_attributes_dict(self) -> Dict[str, Any]:
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
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert user to dictionary for serialization"""
        return {
            "id": str(self.id),
            "email": self.email,
            "username": self.username,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "middle_name": self.middle_name,
            "phone": self.phone,
            "alternate_phone": self.alternate_phone,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "country": self.country,
            "postal_code": self.postal_code,
            "occupation": self.occupation,
            "education": self.education,
            "bio": self.bio,
            "language": self.preferred_language,
            "timezone": self.preferred_timezone,
            "preferred_currency": self.preferred_currency,
            "gender_attribute_id": str(self.gender_attribute_id) if self.gender_attribute_id else None,
            "language_attribute_id": str(self.language_attribute_id) if self.language_attribute_id else None,
            "currency_attribute_id": str(self.currency_attribute_id) if self.currency_attribute_id else None,
            "country_attribute_id": str(self.country_attribute_id) if self.country_attribute_id else None,
            "nationality_attribute_id": str(self.nationality_attribute_id) if self.nationality_attribute_id else None,
            "location_id": str(self.location_id) if self.location_id else None,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "is_superuser": self.is_superuser,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "full_name": self.full_name,
            "gender_name": self.gender_name,
            "language_name": self.language_name,
            "currency_name": self.currency_name,
            "country_name": self.country_name,
            "nationality_name": self.nationality_name,
            "role_codes": [role.code for role in self.roles],
        }
    
    def __repr__(self) -> str:
        return f"<User {self.username_or_email}>"