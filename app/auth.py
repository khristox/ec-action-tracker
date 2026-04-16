"""
Authentication module for the Action Tracker
"""
import os
from typing import Optional
from fastapi import APIRouter, Depends
from app.core.config import settings

# Import everything from security.py
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    get_current_user,
    get_current_active_user,
    get_current_verified_user,
    decode_token as get_token_payload,
    oauth2_scheme,
    authenticate_user  # Import it from security now
)

# Build dynamic token URL
ROOT_PATH = os.getenv("ROOT_PATH", "")
API_V1_STR = getattr(settings, 'API_V1_STR', '/api/v1')
TOKEN_URL = f"{ROOT_PATH}{API_V1_STR}/auth/login".replace('//', '/')

# Re-export for the rest of the app
__all__ = [
    'verify_password',
    'get_password_hash', 
    'authenticate_user',
    'create_access_token',
    'create_refresh_token',
    'verify_refresh_token',
    'get_current_user',
    'get_current_active_user',
    'get_current_verified_user',
    'get_token_payload',
    'oauth2_scheme',
    'TOKEN_URL',
]