# app/schemas/auth.py

from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    """Schema for login request"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """Schema for login response"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


    
class PasswordResetRequest(BaseModel):
    """Request schema for password reset"""
    token: str = Field(..., description="Password reset token from email")
    new_password: str = Field(..., min_length=8, description="New password")
    
    @field_validator('new_password')
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
            raise ValueError('Password must contain at least one number')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "new_password": "NewPassword123!"
            }
        }
         
class MessageResponse(BaseModel):
    """Schema for simple message response"""
    message: str
    success: bool = True

class ResendVerificationRequest(BaseModel):
    """Request model for resending verification email"""
    email: EmailStr  # This validates email format


class PasswordChange(BaseModel):
    """Schema for changing password"""
    current_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8)




    # Add these new schemas at the top with your other schema   s
class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class PasswordResetResponse(BaseModel):
    message: str
    success: bool