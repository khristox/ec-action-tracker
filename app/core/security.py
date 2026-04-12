"""
Security utilities for authentication and password hashing
"""
import os
import re
import bcrypt
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.models.user import User
from app.db.base import get_db
import logging

logger = logging.getLogger(__name__)

# OAuth2 scheme — ROOT_PATH makes this portable across environments
ROOT_PATH = os.getenv("ROOT_PATH", "")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{ROOT_PATH}/api/v1/auth/login")

# JWT settings
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


# ---------------------------------------------------------------------------
# Password utilities - Manual bcrypt implementation
# ---------------------------------------------------------------------------

def truncate_password(password: str, max_bytes: int = 72) -> str:
    if not password:
        return password
    encoded = password.encode('utf-8')
    if len(encoded) <= max_bytes:
        return password
    truncated = encoded[:max_bytes]
    try:
        return truncated.decode('utf-8')
    except UnicodeDecodeError:
        for i in range(max_bytes, max_bytes - 10, -1):
            try:
                return encoded[:i].decode('utf-8')
            except UnicodeDecodeError:
                continue
        return password[:70]


def get_password_hash(password: str) -> str:
    if not password:
        raise ValueError("Password cannot be empty")
    truncated = truncate_password(password)
    try:
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(truncated.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    except Exception as e:
        logger.error(f"Password hashing error: {e}")
        raise ValueError(f"Failed to hash password: {e}")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        logger.warning("Empty password or hash provided")
        return False
    if not is_valid_bcrypt_hash(hashed_password):
        logger.warning("Invalid bcrypt hash format")
        return False
    truncated = truncate_password(plain_password)
    try:
        return bcrypt.checkpw(
            truncated.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def is_valid_bcrypt_hash(hash_str: str) -> bool:
    if not hash_str or not isinstance(hash_str, str):
        return False
    pattern = r'^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
    return bool(re.match(pattern, hash_str))


def needs_rehash(hashed_password: str) -> bool:
    if not hashed_password:
        return True
    if not is_valid_bcrypt_hash(hashed_password):
        return True
    try:
        cost = int(hashed_password.split('$')[2])
        return cost < 12
    except (IndexError, ValueError):
        return True


async def upgrade_password_hash(
    db: AsyncSession,
    user: User,
    plain_password: str
) -> bool:
    if needs_rehash(user.hashed_password):
        try:
            new_hash = get_password_hash(plain_password)
            user.hashed_password = new_hash
            await db.commit()
            logger.info(f"Upgraded password hash for user: {user.username}")
            return True
        except Exception as e:
            logger.error(f"Failed to upgrade password hash: {e}")
            await db.rollback()
            return False
    return False


# ---------------------------------------------------------------------------
# Token utilities
# ---------------------------------------------------------------------------

def get_secret_key(key_type: str = "access") -> str:
    try:
        if key_type == "refresh" and settings.REFRESH_TOKEN_SECRET_KEY is not None:
            secret = settings.REFRESH_TOKEN_SECRET_KEY
        else:
            secret = settings.SECRET_KEY
        if hasattr(secret, "get_secret_value"):
            return secret.get_secret_value()
        return str(secret)
    except Exception as e:
        logger.error(f"Error getting secret key: {e}")
        raise ValueError(f"Failed to get {key_type} secret key")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    try:
        return jwt.encode(to_encode, get_secret_key("access"), algorithm=ALGORITHM)
    except Exception as e:
        logger.error(f"Failed to create access token: {e}")
        raise


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=7))
    to_encode.update({"exp": expire, "type": "refresh"})
    try:
        return jwt.encode(to_encode, get_secret_key("refresh"), algorithm=ALGORITHM)
    except Exception as e:
        logger.error(f"Failed to create refresh token: {e}")
        raise


def decode_token(token: str, token_type: str = "access") -> Optional[dict]:
    try:
        secret_key = get_secret_key(token_type)
        if not secret_key:
            logger.error(f"{token_type.upper()} secret key is not set")
            return None
        payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
        if payload.get("type") != token_type:
            logger.warning(
                f"Token type mismatch: expected {token_type}, got {payload.get('type')}"
            )
            return None
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning(f"{token_type.upper()} token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"{token_type.upper()} token invalid: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error decoding token: {e}")
        return None


def verify_refresh_token(refresh_token: str) -> Optional[Dict[str, Any]]:
    return decode_token(refresh_token, token_type="refresh")


def generate_password_reset_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode = {"sub": email, "exp": expire, "type": "reset"}
    try:
        return jwt.encode(to_encode, get_secret_key("access"), algorithm=ALGORITHM)
    except Exception as e:
        logger.error(f"Failed to create reset token: {e}")
        raise


def verify_password_reset_token(token: str) -> Optional[str]:
    try:
        payload = decode_token(token, token_type="access")
        if payload and payload.get("type") == "reset":
            return payload.get("sub")
        return None
    except Exception as e:
        logger.error(f"Reset token verification error: {e}")
        return None


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token, token_type="access")
        if not payload:
            raise credentials_exception
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        raise credentials_exception

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )
    return current_user


async def get_current_verified_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email address.",
        )
    return current_user