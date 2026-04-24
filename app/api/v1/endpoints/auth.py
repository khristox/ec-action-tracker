# app/api/v1/endpoints/auth.py - FIXED to match your email_service.py

import base64
import io
import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import (
    APIRouter, Depends, HTTPException, 
    Request, status, UploadFile, File
)
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Image Processing safely handled
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from app.core.config import settings
from app.core.security import (
    create_access_token, create_refresh_token, 
    verify_refresh_token, verify_password
)
from app.api import deps
from app.crud.user import user as user_crud
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.schemas.token import Token, RefreshTokenRequest
from app.schemas.auth import (
    MessageResponse, ResendVerificationRequest
)
from app.services.email_service import email_service

# Configure standard logger
logger = logging.getLogger(__name__)

# Conditional Audit Logging
try:
    from app.models.audit import AuditLog
    AUDIT_ENABLED = True
except ImportError:
    AUDIT_ENABLED = False

router = APIRouter()
templates_dir = Path(__file__).parent.parent.parent.parent / "templates"
templates = Jinja2Templates(directory=templates_dir)

# ==================== HELPER FUNCTIONS ====================

async def _log_audit_event(
    db: AsyncSession,
    action: str,
    username: str,
    user_id: Optional[uuid.UUID] = None,
    success: bool = True,
    request: Optional[Request] = None,
    error_message: Optional[str] = None,
) -> None:
    if not AUDIT_ENABLED:
        return

    try:
        async with db.begin_nested():
            audit_entry = AuditLog(
                id=uuid.uuid4(),
                action=action.upper(),
                table_name="auth",
                username=username,
                user_id=user_id,
                ip_address=request.client.host if request else None,
                user_agent=request.headers.get("user-agent")[:500] if request else None,
                endpoint=f"{request.method} {request.url.path}" if request else None,
                status="SUCCESS" if success else "FAILURE",
                error_message=error_message if not success else None,
                extra_data={"timestamp": datetime.now(timezone.utc).isoformat()},
                timestamp=datetime.now(timezone.utc)
            )
            db.add(audit_entry)
    except Exception as e:
        logger.error(f"⚠️ Audit logging failed: {e}")


async def _send_verification_email(user: User) -> bool:
    """Send verification email - matches the boolean return in email_service.py"""
    if user.is_verified:
        logger.info(f"User {user.email} already verified")
        return True
    
    try:
        # Check if email service is configured
        if not email_service.config.is_configured:
            logger.error("Email service not configured")
            return False

        # Generate token
        token = email_service.generate_verification_token(str(user.id), user.email)
        
        # Call the async send_verification_email method
        # FIX: This now correctly handles the boolean return from email_service
        success = await email_service.send_verification_email(
            to_email=user.email,
            token=token,
            username=user.full_name or user.username
        )
        
        if success:
            logger.info(f"✅ Verification email sent to {user.email}")
            return True
        else:
            logger.error(f"❌ Failed to send verification email to {user.email}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Email failure for {user.email}: {str(e)}")
        return False

async def _send_verification_email1(user: User) -> bool:
    """Send verification email - matches the async method in email_service.py"""
    if user.is_verified:
        logger.info(f"User {user.email} already verified")
        return True
    
    try:
        # Check if email service is configured
        if not email_service.config.is_configured:
            logger.error("Email service not configured")
            return False

        # Generate token
        token = email_service.generate_verification_token(str(user.id), user.email)
        
        # Call the async send_verification_email method
        # This returns a dictionary with 'success' key
        result = await email_service.send_verification_email(
            to_email=user.email,
            token=token,
            username=user.full_name or user.username
        )
        
        if result.get("success"):
            logger.info(f"✅ Verification email sent to {user.email}")
            return True
        else:
            logger.error(f"❌ Failed to send verification email to {user.email}: {result.get('message')}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Email failure for {user.email}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def _send_welcome_email(user: User) -> bool:
    """Send welcome email - matches the async method in email_service.py"""
    try:
        if not email_service.config.is_configured:
            logger.error("Email service not configured")
            return False

        # Call the async send_welcome_email method
        result = await email_service.send_welcome_email(
            to_email=user.email,
            username=user.full_name or user.username
        )
        
        if result:
            logger.info(f"✅ Welcome email sent to {user.email}")
            return True
        else:
            logger.error(f"❌ Failed to send welcome email to {user.email}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Welcome email failure for {user.email}: {str(e)}")
        return False

# ==================== ENDPOINTS ====================

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """Register a new user."""
    
    # Check for existing user
    existing_user = await user_crud.get_by_email(db, email=user_in.email)
    
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(status_code=409, detail="Email already verified.")
        else:
            # Remove stale unverified account
            await db.delete(existing_user)
            await db.flush()
    
    # Check username
    if await user_crud.get_by_username(db, username=user_in.username):
        raise HTTPException(status_code=409, detail="Username already taken.")

    # Create user
    full_name = f"{user_in.first_name or ''} {user_in.last_name or ''}".strip() or user_in.username
    new_user = await user_crud.create_with_roles(
        db=db,
        email=user_in.email,
        username=user_in.username,
        full_name=full_name,
        password=user_in.password,
        roles=user_in.roles or ["user"],
        is_verified=False
    )

    # Send verification email
    email_sent = await _send_verification_email(new_user)
    
    await db.commit()
    
    # Create response
    response_data = UserResponse.model_validate(new_user).model_dump()
    response_data["verification_email_sent"] = email_sent
    if not email_sent:
        response_data["warning"] = "Verification email could not be sent. Please contact support."
    
    return response_data

@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification_email(
    request: ResendVerificationRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> MessageResponse:
    """Resend verification email to user"""
    user = await user_crud.get_by_email(db, email=request.email)
    
    if not user:
        # Don't reveal if user exists for security
        return MessageResponse(message="If an account exists, a verification link has been sent.")
    
    if user.is_verified:
        return MessageResponse(message="Email already verified. Please login.")
    
    email_sent = await _send_verification_email(user)
    
    if email_sent:
        return MessageResponse(message="Verification email sent successfully.")
    else:
        raise HTTPException(
            status_code=500,
            detail="Failed to send verification email. Please try again later."
        )

@router.post("/login", response_model=Token)
async def login(
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request = None
) -> Any:
    """Login user"""
    
    user = await user_crud.get_by_email(db, email=form_data.username) or \
           await user_crud.get_by_username(db, username=form_data.username)
    
    if not user or not await user_crud.authenticate(db, username=user.username, password=form_data.password):
        await _log_audit_event(db, "login", form_data.username, success=False, error_message="Invalid credentials", request=request)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_verified:
        # Resend verification email
        email_sent = await _send_verification_email(user)
        if email_sent:
            raise HTTPException(
                status_code=403, 
                detail="Email not verified. A new verification link has been sent to your email."
            )
        else:
            raise HTTPException(
                status_code=403, 
                detail="Email not verified. Unable to send verification email. Please contact support."
            )

    # Generate tokens
    access_token = create_access_token(
        data={"sub": user.username, "user_id": str(user.id), "roles": [r.code for r in user.roles]}
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Save refresh token
    db.add(RefreshToken(
        id=uuid.uuid4(), 
        user_id=user.id, 
        token=refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    ))
    user.last_login = datetime.now(timezone.utc)
    
    await _log_audit_event(db, "login", user.username, user_id=user.id, request=request)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "username": user.username,
        "email": user.email
    }

@router.get("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """Verify user's email address"""
    
    # Verify token
    payload = email_service.verify_token(token, "email_verification")
    
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    
    user_id = payload.get("user_id")
    email = payload.get("email")
    
    if not user_id or not email:
        raise HTTPException(status_code=400, detail="Invalid token payload")
    
    # Get user
    user = await user_crud.get(db, id=uuid.UUID(user_id))
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.email != email:
        raise HTTPException(status_code=400, detail="Token email doesn't match user email")
    
    if user.is_verified:
        return {"message": "Email already verified. Please login."}
    
    # Mark as verified
    user.is_verified = True
    user.verified_at = datetime.now(timezone.utc)
    
    # Send welcome email (fire and forget)
    import asyncio
    asyncio.create_task(_send_welcome_email(user))
    
    await db.commit()
    
    return {"message": "Email verified successfully! You can now login."}

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(deps.get_current_user)):
    """Get current user information"""
    return current_user

@router.post("/test-email")
async def test_email_configuration(
    email: str = "test@example.com",
) -> Any:
    """Test endpoint to verify email configuration"""
    
    if not email_service.config.is_configured:
        raise HTTPException(status_code=500, detail="Email service not configured")
    
    try:
        # Generate a test token
        test_token = "test-token-" + str(uuid.uuid4())
        
        # Send test email using the async method
        result = await email_service.send_verification_email(
            to_email=email,
            token=test_token,
            username="Test User"
        )
        
        if result.get("success"):
            return {
                "message": f"Test email sent to {email}",
                "config": {
                    "host": email_service.config.host,
                    "port": email_service.config.port,
                    "from": email_service.config.from_email,
                    "configured": email_service.config.is_configured
                }
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to send test email: {result.get('message')}"
            )
            
    except Exception as e:
        logger.error(f"Test email failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send test email: {str(e)}")