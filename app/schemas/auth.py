# app/schemas/auth.py

from pydantic import BaseModel, Field, EmailStr
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


class PasswordChange(BaseModel):
    """Schema for password change"""
    old_password: str
    new_password: str = Field(..., min_length=6)


class PasswordResetRequest(BaseModel):
    """Schema for password reset request"""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation"""
    email: EmailStr
    token: str
    new_password: str = Field(..., min_length=6)


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