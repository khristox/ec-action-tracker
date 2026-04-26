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


def generate_password_reset_token(self, user_id: str, email: str) -> str:
    """Generate JWT token for password reset"""
    expire = datetime.utcnow() + timedelta(hours=1)  # 1 hour expiry for password reset
    payload = {
        "user_id": str(user_id),
        "email": str(email),
        "type": "password_reset",
        "exp": expire,
        "iat": datetime.utcnow(),
        "sub": str(user_id)
    }
    token = jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
    logger.info(f"🔐 Generated password reset token for {email}")
    return token


async def send_password_reset_email(
    self,
    to_email: str,
    reset_link: str,
    username: str
) -> bool:
    """
    Send password reset email
    
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    if not self.config.is_configured:
        logger.error("Email service not configured")
        return False
    
    try:
        # HTML template for password reset
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #4CAF50; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; background-color: #f9f9f9; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
                .warning {{ color: #ff9800; font-size: 14px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Password Reset Request</h2>
                </div>
                <div class="content">
                    <p>Hello <strong>{username}</strong>,</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <div style="text-align: center;">
                        <a href="{reset_link}" class="button">Reset Password</a>
                    </div>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p><a href="{reset_link}">{reset_link}</a></p>
                    <p class="warning"><strong>⚠️ This link will expire in 1 hour for security reasons.</strong></p>
                    <p>If you didn't request this password reset, please ignore this email or contact support.</p>
                </div>
                <div class="footer">
                    <p>This is an automated message, please do not reply to this email.</p>
                    <p>&copy; {datetime.now().year} Action Tracker. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        message = MessageSchema(
            subject="Reset Your Password - Action Tracker",
            recipients=[to_email],
            body=html_content,
            subtype=MessageType.html
        )
        
        await self.fastmail.send_message(message)
        logger.info(f"✅ Password reset email sent to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send password reset email to {to_email}: {str(e)}")
        return False


def verify_password_reset_token(token: str) -> Optional[str]:
    try:
        payload = decode_token(token, token_type="access")
        if payload and payload.get("type") == "reset":
            return payload.get("sub")
        return None
    except Exception as e:
        logger.error(f"Reset token verification error: {e}")
        return None


# Add to security.py if you want a complete security module
async def authenticate_user(db: AsyncSession, username: str, password: str) -> Optional[User]:
    """Authenticate a user by username/email"""
    from sqlalchemy import select
    from app.models.user import User
    
    result = await db.execute(
        select(User).where(
            (User.username == username) | (User.email == username)
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        return None
    
    if not verify_password(password, user.hashed_password):
        return None
    
    return user
# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates the JWT and returns the current user.
    Prioritizes UUID lookup for performance and consistency.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 1. Decode and Validate Payload
    payload = decode_token(token, token_type="access")
    if not payload:
        raise credentials_exception

    # 2. Extract Identifiers
    # Using 'user_id' as the primary lookup is faster with UUIDs
    user_id: Optional[str] = payload.get("user_id")
    username: Optional[str] = payload.get("sub")

    if not user_id and not username:
        raise credentials_exception

    try:
        # 3. Optimized Database Lookup
        # We use a single query to find the user by ID (preferred) or username
        query = select(User)
        if user_id:
            query = query.where(User.id == user_id)
        else:
            query = query.where(User.username == username)
        
        # Load roles eagerly if your logic needs them immediately
        # from sqlalchemy.orm import selectinload
        # query = query.options(selectinload(User.roles))

        result = await db.execute(query)
        user = result.scalar_one_or_none()
        
    except Exception as e:
        logger.error(f"Database error during user injection: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal authentication service error"
        )

    if not user:
        logger.warning(f"User in token not found in DB: ID={user_id}, Sub={username}")
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