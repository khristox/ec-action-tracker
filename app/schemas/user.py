"""
User schemas for Action Tracker
Includes validation, documentation, and proper type handling
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict, model_validator
from typing import Optional, List, Any, Dict, ClassVar
from uuid import UUID
from datetime import datetime, date
import re
from enum import Enum


# ==================== ENUMS ====================

class CurrencyCode(str, Enum):
    """Supported currency codes (ISO 4217)"""
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    KES = "KES"
    TZS = "TZS"
    UGX = "UGX"
    NGN = "NGN"
    ZAR = "ZAR"
    GHS = "GHS"
    
    @classmethod
    def get_default(cls) -> str:
        return cls.USD.value


class LanguageCode(str, Enum):
    """Supported language codes (ISO 639-1)"""
    EN = "en"
    FR = "fr"
    ES = "es"
    DE = "de"
    SW = "sw"
    AR = "ar"
    ZH = "zh"
    
    @classmethod
    def get_default(cls) -> str:
        return cls.EN.value


class Timezone(str, Enum):
    """Common timezones"""
    UTC = "UTC"
    NAIROBI = "Africa/Nairobi"
    KAMPALA = "Africa/Kampala"
    DAR_ES_SALAAM = "Africa/Dar_es_Salaam"
    LAGOS = "Africa/Lagos"
    JOHANNESBURG = "Africa/Johannesburg"
    NEW_YORK = "America/New_York"
    LONDON = "Europe/London"
    DUBAI = "Asia/Dubai"
    
    @classmethod
    def get_default(cls) -> str:
        return cls.UTC.value


# ==================== VALIDATION UTILITIES ====================

class ValidationUtils:
    """Utility class for common validations"""
    
    @staticmethod
    def validate_username(username: Optional[str]) -> Optional[str]:
        """Validate and normalize username"""
        if username is None:
            return None
        
        username = username.strip().lower()
        
        if len(username) < 3:
            raise ValueError('Username must be at least 3 characters')
        if len(username) > 100:
            raise ValueError('Username must not exceed 100 characters')
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            raise ValueError('Username can only contain letters, numbers, and underscores')
        if username[0].isdigit():
            raise ValueError('Username cannot start with a number')
        if username.startswith('_') or username.endswith('_'):
            raise ValueError('Username cannot start or end with underscore')
        if '__' in username:
            raise ValueError('Username cannot contain consecutive underscores')
        
        return username
    
    @staticmethod
    def validate_phone(phone: Optional[str]) -> Optional[str]:
        """Validate and format phone number to E.164 format"""
        if phone is None:
            return None
        
        # Remove all non-digit characters except leading '+'
        cleaned = re.sub(r'[\s\-\(\)\.]+', '', phone.strip())
        
        # Validate format
        if not re.match(r'^\+?[0-9]{8,15}$', cleaned):
            raise ValueError('Phone number must be 8-15 digits, optionally starting with +')
        
        # Ensure E.164 format (with + prefix)
        if not cleaned.startswith('+'):
            cleaned = '+' + cleaned
        
        return cleaned
    
    @staticmethod
    def validate_name(name: Optional[str], field_name: str, max_length: int = 100, required: bool = False) -> Optional[str]:
        """Validate and format name fields"""
        if name is None:
            if required:
                raise ValueError(f'{field_name} is required')
            return None
        
        name = name.strip()
        
        if not name:
            if required:
                raise ValueError(f'{field_name} cannot be empty')
            return None
        
        if len(name) > max_length:
            raise ValueError(f'{field_name} must not exceed {max_length} characters')
        
        # Capitalize first letter of each word
        name = ' '.join(word.capitalize() for word in name.split())
        
        # Remove multiple spaces
        name = re.sub(r'\s+', ' ', name)
        
        return name
    
    @staticmethod
    def validate_date_of_birth(dob: Optional[date]) -> Optional[date]:
        """Validate date of birth (must be at least 18 years ago)"""
        if dob is None:
            return None
        
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        
        if age < 18:
            raise ValueError('User must be at least 18 years old')
        if age > 120:
            raise ValueError('Invalid date of birth (age cannot exceed 120 years)')
        if dob > today:
            raise ValueError('Date of birth cannot be in the future')
        
        return dob
    
    @staticmethod
    def validate_currency(currency: Optional[str]) -> Optional[str]:
        """Validate and normalize currency code"""
        if currency is None:
            return None
        
        currency = currency.upper().strip()
        
        if not re.match(r'^[A-Z]{3}$', currency):
            raise ValueError('Currency code must be 3 uppercase letters (ISO 4217)')
        
        # Check if currency is supported
        if currency not in [c.value for c in CurrencyCode]:
            raise ValueError(f'Unsupported currency code. Supported: {", ".join([c.value for c in CurrencyCode])}')
        
        return currency
    
    @staticmethod
    def validate_language(language: Optional[str]) -> Optional[str]:
        """Validate and normalize language code"""
        if language is None:
            return None
        
        language = language.lower().strip()
        
        if not re.match(r'^[a-z]{2,5}$', language):
            raise ValueError('Language code must be 2-5 lowercase letters (ISO 639)')
        
        # Check if language is supported
        if language not in [l.value for l in LanguageCode]:
            raise ValueError(f'Unsupported language code. Supported: {", ".join([l.value for l in LanguageCode])}')
        
        return language
    
    @staticmethod
    def validate_timezone(timezone_str: Optional[str]) -> Optional[str]:
        """Validate timezone"""
        if timezone_str is None:
            return None
        
        import pytz
        timezone_str = timezone_str.strip()
        
        if timezone_str not in pytz.all_timezones:
            raise ValueError(f'Invalid timezone. Use valid IANA timezone (e.g., Africa/Nairobi)')
        
        return timezone_str


# ==================== BASE SCHEMAS ====================

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
        example="+256712345678"
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
                "phone": "+256712345678",
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
        return ValidationUtils.validate_username(v)
    
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
        if not any(c in '!@#$%^&*()_+-=[]{};:\'",.<>/?`~' for c in v):
            raise ValueError('Password must contain at least one special character')
        return v
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return ValidationUtils.validate_phone(v)
    
    @field_validator('preferred_currency')
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        return ValidationUtils.validate_currency(v)
    
    @field_validator('roles')
    @classmethod
    def validate_roles(cls, v: List[str]) -> List[str]:
        """Validate roles list"""
        if not v:
            raise ValueError('At least one role is required')
        # Remove duplicates and ensure unique
        return list(dict.fromkeys(v))
    
    @model_validator(mode='after')
    def validate_passwords_match(self) -> 'UserCreate':
        """Validate that passwords match"""
        if self.confirm_password is not None and self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
        return self
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "john.doe@example.com",
                "username": "john_doe",
                "first_name": "John",
                "last_name": "Doe",
                "phone": "+256712345678",
                "password": "SecurePass123!",
                "roles": ["user", "property_manager"]
            }
        }
    )


# ==================== IMPROVED USER UPDATE SCHEMA ====================

class UserUpdate(BaseModel):
    """
    Schema for updating an existing user
    
    All fields are optional to allow partial updates.
    Only provided fields will be updated.
    """
    # Personal Information
    email: Optional[EmailStr] = Field(
        None,
        description="New email address",
        example="new.email@example.com"
    )
    username: Optional[str] = Field(
        None,
        min_length=3,
        max_length=100,
        description="New username (3-100 characters, letters, numbers, underscores)",
        example="new_username"
    )
    first_name: Optional[str] = Field(
        None,
        max_length=100,
        description="Updated first name",
        example="Jonathan"
    )
    last_name: Optional[str] = Field(
        None,
        max_length=100,
        description="Updated last name",
        example="Smith"
    )
    middle_name: Optional[str] = Field(
        None,
        max_length=100,
        description="Updated middle name",
        example="Michael"
    )
    
    # Contact Information
    phone: Optional[str] = Field(
        None,
        max_length=20,
        description="Updated phone number (E.164 format)",
        example="+254723456789"
    )
    alternate_phone: Optional[str] = Field(
        None,
        max_length=20,
        description="Alternate phone number",
        example="+254712345678"
    )
    
    # Personal Details
    date_of_birth: Optional[date] = Field(
        None,
        description="Date of birth (YYYY-MM-DD). User must be at least 18 years old.",
        example="1990-01-01"
    )
    
    # Address Information
    address: Optional[str] = Field(
        None,
        max_length=500,
        description="Street address",
        example="123 Main Street"
    )
    city: Optional[str] = Field(
        None,
        max_length=100,
        description="City",
        example="Nairobi"
    )
    state: Optional[str] = Field(
        None,
        max_length=100,
        description="State or province",
        example="Nairobi County"
    )
    country: Optional[str] = Field(
        None,
        max_length=100,
        description="Country",
        example="Kenya"
    )
    postal_code: Optional[str] = Field(
        None,
        max_length=20,
        description="Postal/ZIP code",
        example="00100"
    )
    
    # Professional Information
    occupation: Optional[str] = Field(
        None,
        max_length=100,
        description="Occupation",
        example="Software Engineer"
    )
    education: Optional[str] = Field(
        None,
        max_length=200,
        description="Educational background",
        example="Bachelor's in Computer Science"
    )
    
    # Bio
    bio: Optional[str] = Field(
        None,
        max_length=500,
        description="Short biography",
        example="Passionate about real estate and property management"
    )
    
    # Account Settings
    is_active: Optional[bool] = Field(
        None,
        description="Whether user account is active"
    )
    is_verified: Optional[bool] = Field(
        None,
        description="Whether email is verified (usually only admin can change)"
    )
    preferred_currency: Optional[str] = Field(
        None,
        min_length=3,
        max_length=3,
        description="Preferred currency code (ISO 4217)",
        example="KES"
    )
    language: Optional[str] = Field(
        None,
        min_length=2,
        max_length=5,
        description="Preferred language (ISO 639-1)",
        example="sw"
    )
    timezone: Optional[str] = Field(
        None,
        description="User's timezone (IANA timezone)",
        example="Africa/Nairobi"
    )
    
    # Avatar
    avatar_url: Optional[str] = Field(
        None,
        max_length=500,
        description="URL to user's avatar image",
        example="https://example.com/avatars/user.jpg"
    )
    
    # ==================== VALIDATORS ====================
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        """Validate username format"""
        return ValidationUtils.validate_username(v)
    
    @field_validator('phone', 'alternate_phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        """Validate phone number format"""
        return ValidationUtils.validate_phone(v)
    
    @field_validator('first_name', 'last_name', 'middle_name')
    @classmethod
    def validate_name(cls, v: Optional[str], info) -> Optional[str]:
        """Validate name fields"""
        field_name = info.field_name.replace('_', ' ').title()
        return ValidationUtils.validate_name(v, field_name, max_length=100, required=False)
    
    @field_validator('date_of_birth')
    @classmethod
    def validate_date_of_birth(cls, v: Optional[date]) -> Optional[date]:
        """Validate date of birth"""
        return ValidationUtils.validate_date_of_birth(v)
    
    @field_validator('preferred_currency')
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        """Validate currency code"""
        return ValidationUtils.validate_currency(v)
    
    @field_validator('language')
    @classmethod
    def validate_language(cls, v: Optional[str]) -> Optional[str]:
        """Validate language code"""
        return ValidationUtils.validate_language(v)
    
    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, v: Optional[str]) -> Optional[str]:
        """Validate timezone"""
        return ValidationUtils.validate_timezone(v)
    
    @field_validator('avatar_url')
    @classmethod
    def validate_avatar_url(cls, v: Optional[str]) -> Optional[str]:
        """Validate avatar URL"""
        if v is not None:
            if not re.match(r'^https?://', v):
                raise ValueError('Avatar URL must start with http:// or https://')
            if len(v) > 500:
                raise ValueError('Avatar URL must not exceed 500 characters')
        return v
    
    # ==================== UTILITY METHODS ====================
    
    def get_updates_dict(self) -> Dict[str, Any]:
        """
        Get dictionary of only non-None fields for database update
        """
        return {k: v for k, v in self.dict().items() if v is not None}
    
    def has_updates(self) -> bool:
        """Check if there are any updates to apply"""
        return len(self.get_updates_dict()) > 0
    
    def get_updated_fields(self) -> List[str]:
        """Get list of fields that are being updated"""
        return list(self.get_updates_dict().keys())
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "first_name": "Jonathan",
                "last_name": "Smith",
                "phone": "+254723456789",
                "preferred_currency": "KES",
                "language": "sw",
                "bio": "Experienced property manager with 10+ years in real estate"
            }
        }
    )


# ==================== RESPONSE SCHEMAS ====================

class UserResponse(UserBase):
    """
    Schema for user response (excludes sensitive data like password)
    """
    id: UUID = Field(..., description="User's unique identifier")
    date_of_birth: Optional[date] = Field(
        None,
        description="User's date of birth"
    )
    alternate_phone: Optional[str] = Field(
        None,
        description="Alternate phone number"
    )
    address: Optional[str] = Field(
        None,
        description="Street address"
    )
    city: Optional[str] = Field(
        None,
        description="City"
    )
    state: Optional[str] = Field(
        None,
        description="State or province"
    )
    country: Optional[str] = Field(
        None,
        description="Country"
    )
    postal_code: Optional[str] = Field(
        None,
        description="Postal/ZIP code"
    )
    occupation: Optional[str] = Field(
        None,
        description="Occupation"
    )
    education: Optional[str] = Field(
        None,
        description="Educational background"
    )
    bio: Optional[str] = Field(
        None,
        description="Short biography"
    )
    avatar_url: Optional[str] = Field(
        None,
        description="URL to user's avatar image"
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
    message: Optional[str] = None 
    
    @property
    def full_name(self) -> str:
        """Get user's full name"""
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join([p for p in parts if p]) or self.username or "Unknown"
    
    @property
    def display_name(self) -> str:
        """Get display name (prefers full name, falls back to username)"""
        return self.full_name if self.full_name != "Unknown" else self.username
    
    @property
    def initials(self) -> str:
        """Get user's initials"""
        initials = ""
        if self.first_name:
            initials += self.first_name[0].upper()
        if self.last_name:
            initials += self.last_name[0].upper()
        return initials or self.username[0].upper() if self.username else "U"
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "john.doe@example.com",
                "username": "john_doe",
                "first_name": "John",
                "last_name": "Doe",
                "phone": "+256712345678",
                "is_active": True,
                "is_verified": True,
                "preferred_currency": "KES",
                "created_at": "2024-01-01T00:00:00Z",
                "date_of_birth": "1990-01-01",
                "nationality_name": "Kenyan"
            }
        }
    )

class RegistrationResponse(UserResponse):
    """Response for registration endpoint with additional message"""
    message: str
    verification_sent: bool = False
    
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


# ==================== PASSWORD SCHEMAS ====================

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
        if not any(c in '!@#$%^&*()_+-=[]{};:\'",.<>/?`~' for c in v):
            raise ValueError('Password must contain at least one special character')
        return v
    
    @model_validator(mode='after')
    def validate_passwords_match(self) -> 'UserPasswordChange':
        """Validate that passwords match"""
        if self.new_password != self.confirm_new_password:
            raise ValueError('New passwords do not match')
        return self


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
    
    @model_validator(mode='after')
    def validate_passwords_match(self) -> 'UserPasswordReset':
        """Validate that passwords match"""
        if self.new_password != self.confirm_new_password:
            raise ValueError('Passwords do not match')
        return self


# ==================== FILTER SCHEMAS ====================

class UserFilterParams(BaseModel):
    """
    Query parameters for filtering users
    """
    search: Optional[str] = Field(
        None,
        description="Search term (matches name, email, username)",
        example="john"
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
        description="Filter by role code",
        example="property_manager"
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
        description="Field to sort by",
        example="created_at,username,email"
    )
    sort_desc: bool = Field(
        True,
        description="Sort in descending order"
    )
    
    @field_validator('sort_by')
    @classmethod
    def validate_sort_by(cls, v: str) -> str:
        """Validate sort field"""
        allowed_fields = ['created_at', 'updated_at', 'username', 'email', 'first_name', 'last_name']
        if v not in allowed_fields:
            raise ValueError(f'Sort by must be one of: {", ".join(allowed_fields)}')
        return v


# Import here to avoid circular imports
from app.schemas.role import RoleResponse
UserWithRoles.model_rebuild()