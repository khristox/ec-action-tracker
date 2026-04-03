# app/schemas/token.py

from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class Token(BaseModel):
    """Schema for access token with refresh token"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    username: str
    email: str
    roles: List[str] = []


class RefreshTokenRequest(BaseModel):
    """Schema for refresh token request"""
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    """Schema for refresh token response"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    username: str
    email: str
    roles: List[str] = []


class TokenPayload(BaseModel):
    """Schema for token payload - sub can be either UUID (user_id) or username"""
    sub: Optional[str] = None  # Changed from UUID to str to accept username
    exp: Optional[int] = None
    username: Optional[str] = None
    email: Optional[str] = None
    user_id: Optional[str] = None
    roles: Optional[List[str]] = None
    token_id: Optional[str] = None
    type: Optional[str] = None  # "access" or "refresh"
    iat: Optional[int] = None