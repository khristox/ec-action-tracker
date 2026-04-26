"""
User schemas for Action Tracker
Includes validation, documentation, and proper type handling
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict, model_validator
from typing import Optional, List, Any, Dict, Union
from uuid import UUID
from datetime import datetime, date
import re
import base64
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
        
        cleaned = re.sub(r'[\s\-\(\)\.]+', '', phone.strip())
        
        if not re.match(r'^\+?[0-9]{8,15}$', cleaned):
            raise ValueError('Phone number must be 8-15 digits, optionally starting with +')
        
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
        
        name = ' '.join(word.capitalize() for word in name.split())
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
    
    @staticmethod
    def validate_profile_picture(profile_picture: Optional[str]) -> Optional[bytes]:
        """Validate and decode profile picture from base64"""
        if profile_picture is None:
            return None
        
        if profile_picture.startswith('data:image/'):
            base64_data = profile_picture.split(',', 1)[-1]
        else:
            base64_data = profile_picture
        
        try:
            image_data = base64.b64decode(base64_data)
            
            if len(image_data) > 5 * 1024 * 1024:
                raise ValueError('Profile picture must be less than 5MB')
            
            magic_bytes = image_data[:4]
            valid_magic = [
                b'\xff\xd8\xff',  # JPEG
                b'\x89PNG',       # PNG
                b'GIF8',          # GIF
                b'RIFF',          # WEBP
            ]
            
            if not any(magic_bytes.startswith(magic) for magic in valid_magic):
                raise ValueError('Invalid image format. Supported: JPEG, PNG, GIF, WEBP')
            
            return image_data
            
        except base64.binascii.Error:
            raise ValueError('Invalid base64 encoding for profile picture')
        except Exception as e:
            raise ValueError(f'Invalid profile picture: {str(e)}')
    
    @staticmethod
    def detect_content_type(image_data: bytes) -> str:
        """Detect content type from image data"""
        if image_data.startswith(b'\xff\xd8\xff'):
            return 'image/jpeg'
        elif image_data.startswith(b'\x89PNG'):
            return 'image/png'
        elif image_data.startswith(b'GIF8'):
            return 'image/gif'
        elif image_data.startswith(b'RIFF'):
            return 'image/webp'
        else:
            return 'image/jpeg'


# ==================== BASE SCHEMAS ====================

class UserBase(BaseModel):
    """
    Base schema for User with common attributes
    """
    email: EmailStr = Field(..., description="Valid email address", example="user@example.com")
    username: Optional[str] = Field(None, min_length=3, max_length=100, description="Unique username (3-100 characters)", example="john_doe")
    first_name: Optional[str] = Field(None, max_length=100, description="User's first name", example="John")
    last_name: Optional[str] = Field(None, max_length=100, description="User's last name", example="Doe")
    middle_name: Optional[str] = Field(None, max_length=100, description="User's middle name", example="Robert")
    phone: Optional[str] = Field(None, max_length=20, description="Phone number with international format", example="+256712345678")
    is_active: bool = Field(True, description="Whether user account is active")
    is_verified: bool = Field(False, description="Whether email is verified")
    preferred_currency: Optional[str] = Field(None, min_length=3, max_length=3, description="Preferred currency code (ISO 4217)", example="USD")
    language: str = Field("en", min_length=2, max_length=5, description="Preferred language code", example="en")
    timezone: str = Field("UTC", description="User's timezone", example="Africa/Nairobi")
    
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
    password: str = Field(..., min_length=8, max_length=72, description="Password (8-72 characters, must contain uppercase, lowercase, digit)")
    roles: List[str] = Field(default=["user"], description="List of role codes to assign to user", example=["user", "property_manager"])
    confirm_password: Optional[str] = Field(None, description="Password confirmation (required if password is provided)")
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        return ValidationUtils.validate_username(v)
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
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
        if not v:
            raise ValueError('At least one role is required')
        return list(dict.fromkeys(v))
    
    @model_validator(mode='after')
    def validate_passwords_match(self) -> 'UserCreate':
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


# ==================== USER UPDATE SCHEMA ====================

class UserUpdate(BaseModel):
    """
    Schema for updating an existing user
    
    All fields are optional to allow partial updates.
    Only provided fields will be updated.
    """
    # Personal Information
    email: Optional[EmailStr] = Field(None, description="New email address", example="new.email@example.com")
    username: Optional[str] = Field(None, min_length=3, max_length=100, description="New username", example="new_username")
    first_name: Optional[str] = Field(None, max_length=100, description="Updated first name", example="Jonathan")
    last_name: Optional[str] = Field(None, max_length=100, description="Updated last name", example="Smith")
    middle_name: Optional[str] = Field(None, max_length=100, description="Updated middle name", example="Michael")
    
    # Contact Information
    phone: Optional[str] = Field(None, max_length=20, description="Updated phone number (E.164 format)", example="+254723456789")
    alternate_phone: Optional[str] = Field(None, max_length=20, description="Alternate phone number", example="+254712345678")
    
    # Personal Details
    date_of_birth: Optional[date] = Field(None, description="Date of birth (YYYY-MM-DD)", example="1990-01-01")
    
    # Address Information
    address: Optional[str] = Field(None, max_length=500, description="Street address", example="123 Main Street")
    city: Optional[str] = Field(None, max_length=100, description="City", example="Nairobi")
    state: Optional[str] = Field(None, max_length=100, description="State or province", example="Nairobi County")
    country: Optional[str] = Field(None, max_length=100, description="Country", example="Kenya")
    postal_code: Optional[str] = Field(None, max_length=20, description="Postal/ZIP code", example="00100")
    
    # Professional Information
    occupation: Optional[str] = Field(None, max_length=100, description="Occupation", example="Software Engineer")
    education: Optional[str] = Field(None, max_length=200, description="Educational background", example="Bachelor's in Computer Science")
    
    # Bio
    bio: Optional[str] = Field(None, max_length=500, description="Short biography", example="Passionate about real estate")
    
    # Account Settings
    is_active: Optional[bool] = Field(None, description="Whether user account is active")
    is_verified: Optional[bool] = Field(None, description="Whether email is verified (usually only admin can change)")
    preferred_currency: Optional[str] = Field(None, min_length=3, max_length=3, description="Preferred currency code (ISO 4217)", example="KES")
    language: Optional[str] = Field(None, min_length=2, max_length=5, description="Preferred language (ISO 639-1)", example="sw")
    timezone: Optional[str] = Field(None, description="User's timezone (IANA timezone)", example="Africa/Nairobi")
    
    # Attribute References (from attribute groups)
    gender_attribute_id: Optional[UUID] = Field(None, description="Gender attribute ID from GENDER attribute group", example="fd089bf8-d8c0-46a7-8aba-7817e4a80de5")
    language_attribute_id: Optional[UUID] = Field(None, description="Language attribute ID from LANGUAGE attribute group", example="9febbfa6-5bc8-4c40-9cee-ccac11bd3a15")
    currency_attribute_id: Optional[UUID] = Field(None, description="Currency attribute ID from CURRENCY attribute group", example="053821c4-308f-4b91-9835-e3d30ee3f5e8")
    country_attribute_id: Optional[UUID] = Field(None, description="Country attribute ID from COUNTRY attribute group", example="123e4567-e89b-12d3-a456-426614174000")
    
    # Location Information (from CTE)
    location_id: Optional[UUID] = Field(None, description="Location ID from CTE location system", example="123e4567-e89b-12d3-a456-426614174000")
    
    # Avatar
    avatar_url: Optional[str] = Field(None, max_length=500, description="URL to user's avatar image", example="https://example.com/avatars/user.jpg")
    
    # Profile Picture Support
    profile_picture: Optional[str] = Field(None, description="Base64 encoded profile picture image", example="data:image/jpeg;base64,/9j/4AAQSkZJRg...")
    
    # Internal use only
    _profile_picture_bytes: Optional[bytes] = None
    _profile_picture_content_type: Optional[str] = None
    
    # ==================== VALIDATORS ====================
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        return ValidationUtils.validate_username(v)
    
    @field_validator('phone', 'alternate_phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return ValidationUtils.validate_phone(v)
    
    @field_validator('first_name', 'last_name', 'middle_name')
    @classmethod
    def validate_name(cls, v: Optional[str], info) -> Optional[str]:
        field_name = info.field_name.replace('_', ' ').title()
        return ValidationUtils.validate_name(v, field_name, max_length=100, required=False)
    
    @field_validator('date_of_birth')
    @classmethod
    def validate_date_of_birth(cls, v: Optional[date]) -> Optional[date]:
        return ValidationUtils.validate_date_of_birth(v)
    
    @field_validator('preferred_currency')
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        return ValidationUtils.validate_currency(v)
    
    @field_validator('language')
    @classmethod
    def validate_language(cls, v: Optional[str]) -> Optional[str]:
        return ValidationUtils.validate_language(v)
    
    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, v: Optional[str]) -> Optional[str]:
        return ValidationUtils.validate_timezone(v)
    
    @field_validator('avatar_url')
    @classmethod
    def validate_avatar_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not re.match(r'^https?://', v):
                raise ValueError('Avatar URL must start with http:// or https://')
            if len(v) > 500:
                raise ValueError('Avatar URL must not exceed 500 characters')
        return v
    
    @field_validator('profile_picture')
    @classmethod
    def validate_profile_picture(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip() == '':
            return None
        return v
    
    @field_validator('gender_attribute_id', 'language_attribute_id', 'currency_attribute_id', 'country_attribute_id', 'location_id')
    @classmethod
    def validate_uuid(cls, v: Optional[UUID]) -> Optional[UUID]:
        if v is not None and not isinstance(v, UUID):
            try:
                return UUID(str(v))
            except ValueError:
                raise ValueError(f'Invalid UUID format: {v}')
        return v
    
    @model_validator(mode='after')
    def process_profile_picture(self) -> 'UserUpdate':
        if self.profile_picture:
            try:
                image_bytes = ValidationUtils.validate_profile_picture(self.profile_picture)
                self._profile_picture_bytes = image_bytes
                self._profile_picture_content_type = ValidationUtils.detect_content_type(image_bytes)
            except ValueError as e:
                raise ValueError(f'Profile picture validation failed: {str(e)}')
        return self
    
    # ==================== UTILITY METHODS ====================
    
    def get_updates_dict(self) -> Dict[str, Any]:
        updates = {}
        for k, v in self.model_dump().items():
            if k.startswith('_'):
                continue
            if k == 'profile_picture':
                if self._profile_picture_bytes is not None:
                    updates['profile_picture'] = self._profile_picture_bytes
                    updates['profile_picture_type'] = self._profile_picture_content_type
                continue
            if v is not None:
                updates[k] = v
        return updates
    
    def has_updates(self) -> bool:
        return len(self.get_updates_dict()) > 0
    
    def get_updated_fields(self) -> List[str]:
        return list(self.get_updates_dict().keys())
    
    def has_profile_picture_update(self) -> bool:
        return self._profile_picture_bytes is not None
    
    def get_profile_picture_bytes(self) -> Optional[bytes]:
        return self._profile_picture_bytes
    
    def get_profile_picture_content_type(self) -> Optional[str]:
        return self._profile_picture_content_type
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "first_name": "Jonathan",
                "last_name": "Smith",
                "phone": "+254723456789",
                "gender_attribute_id": "fd089bf8-d8c0-46a7-8aba-7817e4a80de5",
                "language_attribute_id": "9febbfa6-5bc8-4c40-9cee-ccac11bd3a15",
                "currency_attribute_id": "053821c4-308f-4b91-9835-e3d30ee3f5e8",
                "location_id": "123e4567-e89b-12d3-a456-426614174000",
                "bio": "Experienced property manager",
                "profile_picture": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
            }
        }
    )


# ==================== PROFILE PICTURE SCHEMAS ====================

class ProfilePictureUpload(BaseModel):
    """Schema for profile picture upload with validation"""
    profile_picture: str = Field(..., description="Base64 encoded profile picture image (data URL format)")
    _profile_picture_bytes: Optional[bytes] = None
    _profile_picture_content_type: Optional[str] = None
    
    @field_validator('profile_picture')
    @classmethod
    def validate_profile_picture(cls, v: str) -> str:
        if not v or v.strip() == '':
            raise ValueError('Profile picture is required')
        if not v.startswith('data:image/'):
            raise ValueError('Invalid image format. Expected data URL')
        return v
    
    @model_validator(mode='after')
    def process_profile_picture(self) -> 'ProfilePictureUpload':
        try:
            import base64
            from PIL import Image
            import io
            import re
            
            header, base64_data = self.profile_picture.split(',', 1)
            image_bytes = base64.b64decode(base64_data)
            
            img = Image.open(io.BytesIO(image_bytes))
            
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'RGBA':
                    background.paste(img, mask=img.split()[-1])
                else:
                    background.paste(img)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            max_size = 400
            if img.width > max_size or img.height > max_size:
                img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            output = io.BytesIO()
            img.save(output, format='WEBP', quality=75, optimize=True)
            compressed_bytes = output.getvalue()
            
            self._profile_picture_bytes = compressed_bytes
            self._profile_picture_content_type = 'image/webp'
            
        except ImportError:
            import base64
            header, base64_data = self.profile_picture.split(',', 1)
            self._profile_picture_bytes = base64.b64decode(base64_data)
            self._profile_picture_content_type = header.split(':')[1].split(';')[0]
            
        except Exception as e:
            raise ValueError(f'Failed to process image: {str(e)}')
        
        return self
    
    def get_profile_picture_bytes(self) -> bytes:
        return self._profile_picture_bytes
    
    def get_profile_picture_content_type(self) -> str:
        return self._profile_picture_content_type


class ProfilePictureResponse(BaseModel):
    """Response schema for profile picture endpoints"""
    profile_picture: Optional[str] = Field(None, description="Base64 encoded profile picture (data URL)")
    content_type: Optional[str] = Field(None, description="MIME type of the image")
    has_picture: bool = Field(False, description="Whether user has a profile picture")
    size_bytes: Optional[int] = Field(None, description="Size of the image in bytes")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "profile_picture": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
                "content_type": "image/jpeg",
                "has_picture": True,
                "size_bytes": 102400
            }
        }
    )


# ==================== RESPONSE SCHEMAS ====================

class UserResponse(BaseModel):
    """
    Schema for user response (excludes sensitive data like password)
    """
    id: UUID
    email: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    occupation: Optional[str] = None
    education: Optional[str] = None
    bio: Optional[str] = None
    preferred_currency: Optional[str] = None
    language: Optional[str] = "en"
    timezone:  Optional[str] = "UTC"
    is_active: bool = True
    is_verified: bool = False
    is_superuser: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    profile_picture: Optional[str] = None
    profile_picture_type: Optional[str] = None
    nationality_name: Optional[str] = None
    
    # Attribute references
    gender_attribute_id: Optional[UUID] = Field(None, description="Gender attribute ID")
    language_attribute_id: Optional[UUID] = Field(None, description="Language attribute ID")
    currency_attribute_id: Optional[UUID] = Field(None, description="Currency attribute ID")
    country_attribute_id: Optional[UUID] = Field(None, description="Country attribute ID")
    
    # Location from CTE
    location_id: Optional[UUID] = Field(None, description="Location ID from CTE")
    location_name: Optional[str] = Field(None, description="Location name")
    location_code: Optional[str] = Field(None, description="Location code")
    location_level: Optional[int] = Field(None, description="Location level")
    location_mode: Optional[str] = Field(None, description="Location mode (address/buildings)")
    
    # Computed properties
    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join([p for p in parts if p]) or self.username or "Unknown"
    
    @property
    def display_name(self) -> str:
        return self.full_name if self.full_name != "Unknown" else (self.username or "User")
    
    @property
    def initials(self) -> str:
        initials = ""
        if self.first_name:
            initials += self.first_name[0].upper()
        if self.last_name:
            initials += self.last_name[0].upper()
        return initials or (self.username[0].upper() if self.username else "U")
    
    @field_validator('profile_picture', mode='before')
    @classmethod
    def convert_profile_picture(cls, v):
        if isinstance(v, bytes):
            return base64.b64encode(v).decode('utf-8')
        return v
    
    @field_validator('email', mode='after')
    @classmethod
    def validate_email(cls, v):
        return v.lower() if v else v
    
    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """Response schema for paginated user list"""
    items: List[UserResponse] = Field(..., description="List of users")
    total: int = Field(..., description="Total number of users")
    page: int = Field(1, description="Current page number")
    pages: int = Field(1, description="Total number of pages")
    limit: int = Field(50, description="Items per page")
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "items": [],
                "total": 0,
                "page": 1,
                "pages": 1,
                "limit": 50
            }
        }
    )


class BulkUserUpdateResponse(BaseModel):
    """Response schema for bulk user updates"""
    success: List[Dict[str, Any]] = Field(default_factory=list, description="Successfully updated users")
    failed: List[Dict[str, Any]] = Field(default_factory=list, description="Failed updates")
    total_success: int = Field(0, description="Number of successful updates")
    total_failed: int = Field(0, description="Number of failed updates")


class RegistrationResponse(UserResponse):
    """Response for registration endpoint with additional message"""
    message: str
    verification_sent: bool = False


class UserWithRoles(UserResponse):
    """
    Schema for user with associated roles
    """
    roles: List['RoleResponse'] = Field(default_factory=list, description="List of roles assigned to user")
    
    @property
    def role_codes(self) -> List[str]:
        return [role.code for role in self.roles]
    
    @property
    def is_admin(self) -> bool:
        return "admin" in self.role_codes
    
    @property
    def is_property_manager(self) -> bool:
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
    current_password: str = Field(..., min_length=1, description="Current password")
    new_password: str = Field(..., min_length=8, max_length=72, description="New password (8-72 characters)")
    confirm_new_password: str = Field(..., description="Confirm new password")
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
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
        if self.new_password != self.confirm_new_password:
            raise ValueError('New passwords do not match')
        return self


class UserPasswordReset(BaseModel):
    """
    Schema for resetting user password (forgot password)
    """
    email: EmailStr = Field(..., description="User's email address")
    reset_token: str = Field(..., description="Password reset token")
    new_password: str = Field(..., min_length=8, max_length=72, description="New password")
    confirm_new_password: str = Field(..., description="Confirm new password")
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
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
        if self.new_password != self.confirm_new_password:
            raise ValueError('Passwords do not match')
        return self


# ==================== FILTER SCHEMAS ====================

class UserFilterParams(BaseModel):
    """
    Query parameters for filtering users
    """
    search: Optional[str] = Field(None, description="Search term (matches name, email, username)", example="john")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    is_verified: Optional[bool] = Field(None, description="Filter by verification status")
    role: Optional[str] = Field(None, description="Filter by role code", example="property_manager")
    date_from: Optional[datetime] = Field(None, description="Filter users created after this date")
    date_to: Optional[datetime] = Field(None, description="Filter users created before this date")
    skip: int = Field(0, ge=0, description="Number of records to skip (pagination)")
    limit: int = Field(100, ge=1, le=1000, description="Maximum number of records to return")
    sort_by: str = Field("created_at", description="Field to sort by", example="created_at,username,email")
    sort_desc: bool = Field(True, description="Sort in descending order")
    
    @field_validator('sort_by')
    @classmethod
    def validate_sort_by(cls, v: str) -> str:
        allowed_fields = ['created_at', 'updated_at', 'username', 'email', 'first_name', 'last_name']
        if v not in allowed_fields:
            raise ValueError(f'Sort by must be one of: {", ".join(allowed_fields)}')
        return v


# Helper function
def encode_profile_picture(image_data: Optional[bytes], content_type: Optional[str] = None) -> Optional[str]:
    """Convert binary image data to base64 data URL"""
    if not image_data:
        return None
    
    try:
        if not content_type:
            if image_data[:2] == b'\xff\xd8':
                content_type = 'image/jpeg'
            elif image_data[:4] == b'\x89PNG':
                content_type = 'image/png'
            elif image_data[:3] == b'GIF':
                content_type = 'image/gif'
            elif image_data[:4] == b'RIFF':
                content_type = 'image/webp'
            else:
                content_type = 'image/jpeg'
        
        base64_str = base64.b64encode(image_data).decode('utf-8')
        return f"data:{content_type};base64,{base64_str}"
    except Exception as e:
        print(f"Error encoding profile picture: {e}")
        return None


# Import here to avoid circular imports
from app.schemas.role import RoleResponse
UserWithRoles.model_rebuild()