"""
Password Helper - Handles bcrypt 72-byte limit properly
"""
import hashlib
import secrets
from typing import Tuple


def truncate_password(password: str, max_bytes: int = 72) -> str:
    """
    Truncate password to specified bytes limit.
    
    Args:
        password: Original password string
        max_bytes: Maximum bytes allowed (default 72 for bcrypt)
    
    Returns:
        Truncated password string
    """
    if not password:
        return password
    
    # Convert to bytes
    password_bytes = password.encode('utf-8')
    
    # Truncate if too long
    if len(password_bytes) > max_bytes:
        # Truncate to max_bytes
        truncated_bytes = password_bytes[:max_bytes]
        # Decode back to string, ignoring any partial characters
        return truncated_bytes.decode('utf-8', errors='ignore')
    
    return password


def pre_hash_long_password(password: str) -> str:
    """
    For extremely long passwords, pre-hash with SHA256 before bcrypt.
    This is a standard approach for handling passwords longer than 72 bytes.
    
    Args:
        password: Original password string
    
    Returns:
        Pre-hashed password (or original if within limit)
    """
    password_bytes = password.encode('utf-8')
    
    # If password is within limit, return as-is
    if len(password_bytes) <= 72:
        return password
    
    # For long passwords, pre-hash with SHA256
    # This creates a fixed-length hash that's always within 72 bytes
    sha256_hash = hashlib.sha256(password_bytes).hexdigest()
    return sha256_hash


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Validate password strength before hashing.
    
    Args:
        password: Password to validate
    
    Returns:
        Tuple of (is_valid, message)
    """
    if not password:
        return False, "Password cannot be empty"
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    
    # Check for uppercase
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    
    # Check for lowercase
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    
    # Check for digit
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    
    # Check for special character (optional but recommended)
    # special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    # if not any(c in special_chars for c in password):
    #     return False, "Password must contain at least one special character"
    
    return True, "Password is valid"


def safe_password_hash(password: str) -> str:
    """
    Safely hash a password with bcrypt, handling the 72-byte limit.
    
    Args:
        password: Plain text password
    
    Returns:
        Hashed password string
    """
    from passlib.context import CryptContext
    
    # First, validate password strength
    is_valid, message = validate_password_strength(password)
    if not is_valid:
        raise ValueError(f"Invalid password: {message}")
    
    # Pre-hash long passwords
    password_to_hash = pre_hash_long_password(password)
    
    # Create password context with bcrypt
    pwd_context = CryptContext(
        schemes=["bcrypt"],
        deprecated="auto",
        bcrypt__truncate_error=False  # Don't raise error, just truncate
    )
    
    return pwd_context.hash(password_to_hash)


def safe_password_verify(password: str, hashed: str) -> bool:
    """
    Safely verify a password against a bcrypt hash.
    
    Args:
        password: Plain text password to check
        hashed: Hashed password from database
    
    Returns:
        True if password matches, False otherwise
    """
    from passlib.context import CryptContext
    
    try:
        # Pre-hash long password (same as during hash)
        password_to_check = pre_hash_long_password(password)
        
        # Create password context
        pwd_context = CryptContext(
            schemes=["bcrypt"],
            deprecated="auto",
            bcrypt__truncate_error=False
        )
        
        return pwd_context.verify(password_to_check, hashed)
    except Exception as e:
        print(f"Password verification error: {e}")
        return False