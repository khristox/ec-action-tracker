"""
User schemas for Action Tracker
Includes validation, documentation, and proper type handling
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime, date
import re


class UserBase(BaseModel):
    """
    Base schema for User with common attributes
    
    Attributes:
        email: Valid email address
        username: Unique username (3-100 chars)
        first_name: User's first name
        last_name: User's last name
        middle_name: Optional middle name
        phone: Phone number with international format
        is_active: Whether user account is active
        is_verified: Whether email is verified
        preferred_currency: User's preferred currency code
        language: Preferred language (default: en)
        timezone: User's timezone
    """
    email: EmailStr = Field(
        ...,
        description="Valid email address",
        example="user@example.com"
    )
    username: Optional[str] = Field(
        None,
        min_length=3,
        max_length=100,
        description="Unique username (3-100 characters)",
        example="john_doe"
    )
    first_name: Optional[str] = Field(
        None,
        max_length=100,
        description="User's first name",
        example="John"
    )
    last_name: Optional[str] = Field(
        None,
        max_length=100,
        description="User's last name",
        example="Doe"
    )
    middle_name: Optional[str] = Field(
        None,
        max_length=100,
        description="User's middle name",
        example="Robert"
    )
    phone: Optional[str] = Field(
        None,
        max_length=20,
        description="Phone number with international format",
        example="+254712345678"
    )
    is_active: bool = Field(
        True,
        description="Whether user account is active"
    )
    is_verified: bool = Field(
        False,
        description="Whether email is verified"
    )
    preferred_currency: Optional[str] = Field(
        None,
        min_length=3,
        max_length=3,
        description="Preferred currency code (ISO 4217)",
        example="USD"
    )
    language: str = Field(
        "en",
        min_length=2,
        max_length=5,
        description="Preferred language code",
        example="en"
    )
    timezone: str = Field(
        "UTC",
        description="User's timezone",
        example="Africa/Nairobi"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "john.doe@example.com",
                "username": "john_doe",
                "first_name": "John",
                "last_name": "Doe",
                "phone": "+254712345678",
                "preferred_currency": "KES",
                "language": "en",
                "timezone": "Africa/Nairobi"
            }
        }
    )


class UserCreate(UserBase):
    """
    Schema for creating a new user
    
    Includes password validation and role assignment
    """
    password: str = Field(
        ...,
        min_length=8,
        max_length=72,  # bcrypt limit
        description="Password (8-72 characters, must contain uppercase, lowercase, digit)"
    )
    roles: List[str] = Field(
        default=["user"],
        description="List of role codes to assign to user",
        example=["user", "property_manager"]
    )
    confirm_password: Optional[str] = Field(
        None,
        description="Password confirmation (required if password is provided)"
    )
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        """Validate username format"""
        if v is not None:
            if len(v) < 3:
                raise ValueError('Username must be at least 3 characters')
            if not re.match(r'^[a-zA-Z0-9_]+$', v):
                raise ValueError('Username can only contain letters, numbers, and underscores')
        return v
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        """Validate phone number format"""
        if v is not None:
            # Remove spaces, dashes, etc.
            cleaned = re.sub(r'[\s\-\(\)]+', '', v)
            if not re.match(r'^\+?[0-9]{8,15}$', cleaned):
                raise ValueError('Phone number must be 8-15 digits, optionally starting with +')
            return cleaned
        return v
    
    @field_validator('preferred_currency')
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        """Validate currency code format"""
        if v is not None:
            v = v.upper()
            if not re.match(r'^[A-Z]{3}$', v):
                raise ValueError('Currency code must be 3 uppercase letters (ISO 4217)')
        return v
    
    @field_validator('roles')
    @classmethod
    def validate_roles(cls, v: List[str]) -> List[str]:
        """Validate roles list"""
        if not v:
            raise ValueError('At least one role is required')
        # Remove duplicates and ensure unique
        return list(dict.fromkeys(v))
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "john.doe@example.com",
                "username": "john_doe",
                "first_name": "John",
                "last_name": "Doe",
                "phone": "+254712345678",
                "password": "SecurePass123",
                "roles": ["user", "property_manager"]
            }
        }
    )


class UserUpdate(BaseModel):
    """
    Schema for updating an existing user
    
    All fields are optional to allow partial updates
    """
    email: Optional[EmailStr] = Field(
        None,
        description="New email address"
    )
    username: Optional[str] = Field(
        None,
        min_length=3,
        max_length=100,
        description="New username"
    )
    first_name: Optional[str] = Field(
        None,
        max_length=100,
        description="Updated first name"
    )
    last_name: Optional[str] = Field(
        None,
        max_length=100,
        description="Updated last name"
    )
    middle_name: Optional[str] = Field(
        None,
        max_length=100,
        description="Updated middle name"
    )
    phone: Optional[str] = Field(
        None,
        max_length=20,
        description="Updated phone number"
    )
    date_of_birth: Optional[date] = Field(
        None,
        description="Date of birth (YYYY-MM-DD)"
    )
    is_active: Optional[bool] = Field(
        None,
        description="Whether user account is active"
    )
    is_verified: Optional[bool] = Field(
        None,
        description="Whether email is verified"
    )
    preferred_currency: Optional[str] = Field(
        None,
        min_length=3,
        max_length=3,
        description="Preferred currency code"
    )
    language: Optional[str] = Field(
        None,
        min_length=2,
        max_length=5,
        description="Preferred language"
    )
    timezone: Optional[str] = Field(
        None,
        description="User's timezone"
    )
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        """Validate username format"""
        if v is not None:
            if len(v) < 3:
                raise ValueError('Username must be at least 3 characters')
            if not re.match(r'^[a-zA-Z0-9_]+$', v):
                raise ValueError('Username can only contain letters, numbers, and underscores')
        return v
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        """Validate phone number format"""
        if v is not None:
            cleaned = re.sub(r'[\s\-\(\)]+', '', v)
            if not re.match(r'^\+?[0-9]{8,15}$', cleaned):
                raise ValueError('Phone number must be 8-15 digits, optionally starting with +')
            return cleaned
        return v
    
    @field_validator('date_of_birth')
    @classmethod
    def validate_date_of_birth(cls, v: Optional[date]) -> Optional[date]:
        """Validate date of birth (must be at least 18 years ago)"""
        if v is not None:
            today = date.today()
            age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
            if age < 18:
                raise ValueError('User must be at least 18 years old')
            if age > 120:
                raise ValueError('Invalid date of birth')
        return v
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "first_name": "Jonathan",
                "phone": "+254723456789",
                "preferred_currency": "KES"
            }
        }
    )


class UserResponse(UserBase):
    """
    Schema for user response (excludes sensitive data like password)
    """
    id: UUID = Field(..., description="User's unique identifier")
    date_of_birth: Optional[date] = Field(
        None,
        description="User's date of birth"
    )
    nationality_name: Optional[str] = Field(
        None,
        description="Nationality name (from attributes)"
    )
    created_at: datetime = Field(
        ...,
        description="Account creation timestamp"
    )
    updated_at: Optional[datetime] = Field(
        None,
        description="Last update timestamp"
    )
    last_login: Optional[datetime] = Field(
        None,
        description="Last login timestamp"
    )
    
    @property
    def full_name(self) -> str:
        """Get user's full name"""
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join([p for p in parts if p]) or self.username or "Unknown"
    
    @property
    def display_name(self) -> str:
        """Get display name (prefers full name, falls back to username)"""
        return self.full_name if self.full_name != "Unknown" else self.username
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "john.doe@example.com",
                "username": "john_doe",
                "first_name": "John",
                "last_name": "Doe",
                "phone": "+254712345678",
                "is_active": True,
                "is_verified": True,
                "preferred_currency": "KES",
                "created_at": "2024-01-01T00:00:00Z",
                "date_of_birth": "1990-01-01",
                "nationality_name": "Kenyan"
            }
        }
    )


class UserWithRoles(UserResponse):
    """
    Schema for user with associated roles
    """
    roles: List['RoleResponse'] = Field(
        default_factory=list,
        description="List of roles assigned to user"
    )
    
    @property
    def role_codes(self) -> List[str]:
        """Get list of role codes"""
        return [role.code for role in self.roles]
    
    @property
    def is_admin(self) -> bool:
        """Check if user has admin role"""
        return "admin" in self.role_codes
    
    @property
    def is_property_manager(self) -> bool:
        """Check if user has property_manager role"""
        return "property_manager" in self.role_codes
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "john.doe@example.com",
                "username": "john_doe",
                "first_name": "John",
                "last_name": "Doe",
                "roles": [
                    {"id": "role-1", "name": "User", "code": "user"},
                    {"id": "role-2", "name": "Property Manager", "code": "property_manager"}
                ]
            }
        }
    )


class UserPasswordChange(BaseModel):
    """
    Schema for changing user password
    """
    current_password: str = Field(
        ...,
        min_length=1,
        description="Current password"
    )
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="New password (8-72 characters)"
    )
    confirm_new_password: str = Field(
        ...,
        description="Confirm new password"
    )
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        """Validate new password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @field_validator('confirm_new_password')
    @classmethod
    def validate_passwords_match(cls, v: str, info) -> str:
        """Validate that passwords match"""
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('Passwords do not match')
        return v


class UserPasswordReset(BaseModel):
    """
    Schema for resetting user password (forgot password)
    """
    email: EmailStr = Field(..., description="User's email address")
    reset_token: str = Field(..., description="Password reset token")
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="New password"
    )
    confirm_new_password: str = Field(
        ...,
        description="Confirm new password"
    )
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        """Validate new password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @field_validator('confirm_new_password')
    @classmethod
    def validate_passwords_match(cls, v: str, info) -> str:
        """Validate that passwords match"""
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('Passwords do not match')
        return v


class UserFilterParams(BaseModel):
    """
    Query parameters for filtering users
    """
    search: Optional[str] = Field(
        None,
        description="Search term (matches name, email, username)"
    )
    is_active: Optional[bool] = Field(
        None,
        description="Filter by active status"
    )
    is_verified: Optional[bool] = Field(
        None,
        description="Filter by verification status"
    )
    role: Optional[str] = Field(
        None,
        description="Filter by role code"
    )
    date_from: Optional[datetime] = Field(
        None,
        description="Filter users created after this date"
    )
    date_to: Optional[datetime] = Field(
        None,
        description="Filter users created before this date"
    )
    skip: int = Field(
        0,
        ge=0,
        description="Number of records to skip (pagination)"
    )
    limit: int = Field(
        100,
        ge=1,
        le=1000,
        description="Maximum number of records to return"
    )
    sort_by: str = Field(
        "created_at",
        description="Field to sort by"
    )
    sort_desc: bool = Field(
        True,
        description="Sort in descending order"
    )


# Import here to avoid circular imports
from app.schemas.role import RoleResponse
UserWithRoles.model_rebuild()