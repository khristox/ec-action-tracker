# app/api/v1/endpoints/auth.py

from asyncio.log import logger
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, verify_password, get_password_hash, verify_refresh_token
from app.api import deps
from app.crud.user import user as user_crud
from app.crud.role import role as role_crud
from app.models.user import User
from app.models.role import Role
from app.models.refresh_token import RefreshToken
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.schemas.token import Token, RefreshTokenRequest, RefreshTokenResponse
from app.schemas.auth import (
    LoginResponse, 
    PasswordChange, 
    PasswordResetRequest, 
    PasswordResetConfirm, 
    MessageResponse
)
from app.services.email_service import email_service
from app.services.audit_service import AuditService

router = APIRouter()
templates_dir = Path(__file__).parent.parent.parent.parent / "templates"
templates = Jinja2Templates(directory=templates_dir)


# ==================== HELPER FUNCTIONS ====================

async def _validate_user_registration(
    db: AsyncSession, 
    email: str, 
    username: str
) -> None:
    """Validate that user doesn't already exist with field-specific errors"""
    # Check email
    existing = await user_crud.get_by_email(db, email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "User with this email already exists",
                "field": "email"
            }
        )
    
    # Check username
    existing = await user_crud.get_by_username(db, username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "User with this username already exists",
                "field": "username"
            }
        )


async def _send_verification_email(
    email_service_instance,
    user: User,
    background_tasks: BackgroundTasks,
    is_verified: bool = False
) -> bool:
    """Send verification email if needed with enhanced error handling"""
    if not is_verified:
        try:
            # Check if email service is configured
            if not email_service_instance._is_configured():
                logger.error("Email service not configured - cannot send verification email")
                logger.warning("Please configure EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, and EMAIL_FROM")
                return False
            
            logger.info(f"📧 Attempting to send verification email to: {user.email}")
            
            result = await email_service_instance.send_verification_email(
                to_email=user.email,
                username=user.username,
                user_id=str(user.id),
                background_tasks=background_tasks
            )
            
            if result and result.get("success"):
                logger.info(f"✅ Verification email sent to: {user.email}")
                return True
            else:
                logger.warning(f"⚠️ Failed to send verification email to: {user.email} - {result}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error sending verification email: {str(e)}", exc_info=True)
            return False
    else:
        logger.info(f"User created with pre-verified email: {user.email}")
        return True


async def _log_audit_event(
    db: AsyncSession,
    action: str,
    username: str,
    user_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    endpoint: Optional[str] = None,
    success: bool = True,
    error_message: Optional[str] = None
) -> None:
    """Helper to log audit events with error handling"""
    try:
        audit_service = AuditService(db)
        
        if action == "login":
            await audit_service.log_login(
                username=username,
                success=success,
                user_id=user_id,
                ip_address=ip_address,
                user_agent=user_agent,
                endpoint=endpoint,
                error_message=error_message
            )
        elif action == "logout":
            await audit_service.log_logout(
                username=username,
                user_id=user_id,
                ip_address=ip_address,
                user_agent=user_agent
            )
        # Add more audit actions as needed
    except Exception as e:
        logger.error(f"Failed to log audit event: {str(e)}")


# ==================== REGISTRATION ENDPOINTS ====================

@router.post(
    "/register", 
    response_model=UserResponse, 
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Create a new user account with email verification"
)
async def register(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
    request: Request,
    background_tasks: BackgroundTasks
) -> Any:
    """
    Register a new user with email verification.
    
    - **email**: Valid email address
    - **username**: Unique username (3-50 characters)
    - **password**: Strong password with at least 8 characters
    - **first_name**: Optional first name
    - **last_name**: Optional last name
    - **roles**: Optional list of role codes (defaults to ['user'])
    - **is_verified**: Optional pre-verification flag (admin use only)
    """
    logger.info(f"📝 Registration attempt - Email: {user_in.email}, Username: {user_in.username}")
    
    try:
        # Validate user doesn't exist
        await _validate_user_registration(db, user_in.email, user_in.username)
        
        # Determine if email should be pre-verified
        is_verified = user_in.is_verified or False
        
        # Create user
        new_user = await user_crud.create_with_roles(
            db, 
            email=user_in.email,
            username=user_in.username,
            full_name=f"{user_in.first_name or ''} {user_in.last_name or ''}".strip() or user_in.username,
            password=user_in.password,
            roles=user_in.roles,
            is_verified=is_verified
        )
        
        # Send verification email (if needed)
        email_sent = await _send_verification_email(
            email_service, 
            new_user, 
            background_tasks, 
            is_verified
        )
        
        if not is_verified and not email_sent:
            logger.warning(f"⚠️ Verification email could not be sent to {new_user.email}")
        
        # Log successful registration
        logger.info(f"✅ User registered - ID: {new_user.id}, Username: {new_user.username}")
        
        return new_user
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Registration failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "An error occurred during registration",
                "error": str(e) if settings.DEBUG else None
            }
        )


# ==================== CURRENT USER ENDPOINT ====================

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Get the currently authenticated user's information"
)
async def get_current_user_info(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get the current authenticated user's information.
    """
    logger.info(f"🔐 Fetching current user info: {current_user.username}")
    
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        roles=[role.code for role in current_user.roles],
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at
    )


@router.get(
    "/me/permissions",
    summary="Get current user permissions",
    description="Get all permissions for the current user"
)
async def get_current_user_permissions(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get all permissions for the current user.
    """
    logger.info(f"🔐 Fetching permissions for user: {current_user.username}")
    
    permissions = set()
    for role in current_user.roles:
        for permission in role.permissions:
            permissions.add(permission.code)
    
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "roles": [role.code for role in current_user.roles],
        "permissions": sorted(list(permissions))
    }


# ==================== TOKEN REFRESH ENDPOINT ====================

@router.post("/refresh", response_model=Token)
async def refresh_token(
    request_data: RefreshTokenRequest, # Change this
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    # Update this line to use request_data
    payload = verify_refresh_token(request_data.refresh_token)
    if not payload:
        logger.warning("❌ Invalid or expired refresh token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    token_id = payload.get("token_id")
    
    if not user_id or not token_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if refresh token exists and is valid in database
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.id == token_id,
            RefreshToken.user_id == user_id,
            RefreshToken.is_active == True
        )
    )
    refresh_token_record = result.scalar_one_or_none()
    
    if not refresh_token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if refresh_token_record.expires_at < datetime.now(timezone.utc):
        # Invalidate expired token
        refresh_token_record.is_active = False
        refresh_token_record.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user
    user = await user_crud.get(db, id=uuid.UUID(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if email is verified (optional - can be skipped for refresh)
    if not user.is_verified:
        logger.warning(f"⚠️ Unverified user {user.username} attempting token refresh")
        # You can either allow or block based on your requirements
        # raise HTTPException(
        #     status_code=status.HTTP_403_FORBIDDEN,
        #     detail="Email not verified. Please verify your email address.",
        #     headers={"WWW-Authenticate": "Bearer"},
        # )
    
    # Generate new access token
    token_data = {
        "sub": user.username,
        "user_id": str(user.id),
        "email": user.email,
        "roles": [role.code for role in user.roles],
    }
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data=token_data,
        expires_delta=access_token_expires
    )
    
    # Update last login
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    
    logger.info(f"✅ Token refreshed successfully for user: {user.username}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user_id": str(user.id),
        "username": user.username,
        "roles": [role.code for role in user.roles]
    }


# ==================== EMAIL VERIFICATION ENDPOINTS ====================

@router.get(
    "/verify-email", 
    response_model=MessageResponse,
    summary="Verify email address",
    description="Verify user's email using the token sent via email"
)
async def verify_email(
    *,
    db: AsyncSession = Depends(deps.get_db),
    token: str,
    background_tasks: BackgroundTasks
) -> Any:
    """
    Verify user's email address using the verification token.
    """
    logger.info(f"🔐 Email verification attempt - Token: {token[:20]}...")
    
    # Verify token
    payload = email_service.verify_token(token, "email_verification")
    if not payload:
        logger.warning(f"❌ Invalid or expired verification token")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token. Please request a new verification email."
        )
    
    user_id = payload.get("user_id")
    email = payload.get("email")
    
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token payload"
        )
    
    # Get user
    db_user = await user_crud.get(db, id=uuid.UUID(user_id))
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if db_user.is_verified:
        logger.info(f"ℹ️ Email already verified for user: {db_user.username}")
        return MessageResponse(
            message="Email already verified. You can now log in."
        )
    
    # Update verification status
    db_user.is_verified = True
    db_user.verification_token = None
    db_user.verification_token_expires = None
    db_user.verified_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(db_user)
    
    # Send welcome email
    try:
        await email_service.send_welcome_email(
            to_email=db_user.email,
            username=db_user.username,
            background_tasks=background_tasks
        )
        logger.info(f"📧 Welcome email sent to: {db_user.email}")
    except Exception as e:
        logger.error(f"❌ Failed to send welcome email: {str(e)}")
    
    logger.info(f"✅ Email verified for user: {db_user.username}")
    return MessageResponse(
        message="Email verified successfully! You can now log in to your account."
    )


@router.post(
    "/resend-verification", 
    response_model=MessageResponse,
    summary="Resend verification email",
    description="Resend email verification link to user"
)
async def resend_verification(
    *,
    db: AsyncSession = Depends(deps.get_db),
    email: str,
    background_tasks: BackgroundTasks
) -> Any:
    """
    Resend verification email to user with rate limiting.
    """
    logger.info(f"📧 Resend verification request for email: {email}")
    
    db_user = await user_crud.get_by_email(db, email=email)
    if not db_user:
        logger.warning(f"❌ User not found for email: {email}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if db_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )
    
    # Check rate limiting (prevent spam)
    if db_user.verification_sent_at and db_user.verification_sent_count >= 3:
        time_since_last = datetime.now(timezone.utc) - db_user.verification_sent_at
        if time_since_last.total_seconds() < 300:  # 5 minutes
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many verification requests. Please try again later."
            )
    
    # Send verification email
    try:
        await email_service.send_verification_email(
            to_email=db_user.email,
            username=db_user.username,
            user_id=str(db_user.id),
            background_tasks=background_tasks
        )
        
        # Update tracking fields
        db_user.verification_sent_at = datetime.now(timezone.utc)
        db_user.verification_sent_count = (db_user.verification_sent_count or 0) + 1
        await db.commit()
        
        logger.info(f"✅ Verification email resent to: {email}")
        
        return MessageResponse(
            message="Verification email sent. Please check your inbox (and spam folder)."
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to resend verification email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again later."
        )


# ==================== PASSWORD RESET ENDPOINTS ====================

@router.post(
    "/forgot-password", 
    response_model=MessageResponse,
    summary="Request password reset",
    description="Send password reset email to user"
)
async def forgot_password(
    *,
    db: AsyncSession = Depends(deps.get_db),
    request_data: PasswordResetRequest,
    background_tasks: BackgroundTasks
) -> Any:
    """
    Request password reset email with rate limiting.
    """
    email = request_data.email
    logger.info(f"🔑 Password reset requested for email: {email}")
    
    # Find user by email
    db_user = await user_crud.get_by_email(db, email=email)
    
    # For security, always return the same message regardless of whether user exists
    if not db_user:
        logger.info(f"Password reset requested for non-existent email: {email}")
        return MessageResponse(
            message="If your email is registered, you will receive a password reset link."
        )
    
    # Check rate limiting
    if db_user.reset_sent_at and db_user.reset_sent_count >= 3:
        time_since_last = datetime.now(timezone.utc) - db_user.reset_sent_at
        if time_since_last.total_seconds() < 300:  # 5 minutes
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many reset requests. Please try again later."
            )
    
    # Generate password reset token
    token = email_service.generate_password_reset_token(str(db_user.id), db_user.email)
    
    # Store token in database
    db_user.reset_token = token
    db_user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    db_user.reset_sent_at = datetime.now(timezone.utc)
    db_user.reset_sent_count = (db_user.reset_sent_count or 0) + 1
    await db.commit()
    
    # Send password reset email
    try:
        await email_service.send_password_reset_email(
            to_email=db_user.email,
            username=db_user.username,
            user_id=str(db_user.id),
            background_tasks=background_tasks
        )
        
        logger.info(f"✅ Password reset email sent to: {email}")
        
    except Exception as e:
        logger.error(f"❌ Failed to send password reset email: {str(e)}")
        # Don't raise, just log - we still return success for security
    
    return MessageResponse(
        message="If your email is registered, you will receive a password reset link."
    )


@router.get(
    "/reset-password", 
    response_class=HTMLResponse,
    summary="Password reset page",
    description="Display password reset form"
)
async def reset_password_page(
    token: str,
    request: Request
) -> Any:
    """
    GET endpoint for password reset page - displays HTML form.
    """
    logger.info(f"🔐 Password reset page accessed with token: {token[:20]}...")
    
    # Verify the token
    payload = email_service.verify_token(token, "password_reset")
    if not payload:
        logger.warning(f"❌ Invalid or expired reset token")
        return templates.TemplateResponse(
            "reset_password_error.html",
            {
                "request": request,
                "error": "Invalid or expired reset token. Please request a new password reset.",
                "support_email": settings.EMAIL_FROM
            }
        )
    
    # Return the password reset form
    return templates.TemplateResponse(
        "reset_password.html",
        {
            "request": request,
            "token": token,
            "support_email": settings.EMAIL_FROM
        }
    )


@router.post(
    "/reset-password", 
    response_model=MessageResponse,
    summary="Confirm password reset",
    description="Reset password using token"
)
async def reset_password_confirm(
    *,
    db: AsyncSession = Depends(deps.get_db),
    request_data: PasswordResetConfirm,
    background_tasks: BackgroundTasks
) -> Any:
    """
    Confirm password reset and set new password.
    """
    logger.info(f"🔐 Password reset confirmation attempt")
    
    # Verify token
    payload = email_service.verify_token(request_data.token, "password_reset")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token. Please request a new password reset."
        )
    
    user_id = payload.get("user_id")
    email = payload.get("email")
    
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token payload"
        )
    
    # Get user
    db_user = await user_crud.get(db, id=uuid.UUID(user_id))
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate token matches stored token
    if db_user.reset_token != request_data.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )
    
    # Check token expiration
    if db_user.reset_token_expires and db_user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new password reset."
        )
    
    # Update password
    db_user.hashed_password = get_password_hash(request_data.new_password)
    db_user.password_changed_at = datetime.now(timezone.utc)
    db_user.reset_token = None
    db_user.reset_token_expires = None
    
    await db.commit()
    
    # Send confirmation email
    try:
        await email_service.send_password_reset_confirmation_email(
            to_email=db_user.email,
            username=db_user.username,
            background_tasks=background_tasks
        )
        logger.info(f"📧 Password reset confirmation email sent to: {db_user.email}")
    except Exception as e:
        logger.error(f"❌ Failed to send password reset confirmation: {str(e)}")
    
    logger.info(f"✅ Password reset successful for user: {db_user.username}")
    return MessageResponse(
        message="Password reset successful! You can now log in with your new password."
    )


# ==================== TOKEN MANAGEMENT ENDPOINTS ====================

@router.post(
    "/refresh-token", 
    response_model=RefreshTokenResponse,
    summary="Refresh access token",
    description="Get new access token using refresh token"
)
async def refresh_access_token(
    *,
    db: AsyncSession = Depends(deps.get_db),
    refresh_token_data: RefreshTokenRequest,
    request: Request
) -> Any:
    """
    Refresh access token using a valid refresh token.
    """
    logger.info("🔄 Token refresh attempt")
    
    # Verify refresh token
    payload = verify_refresh_token(refresh_token_data.refresh_token)
    if not payload:
        logger.warning("❌ Invalid or expired refresh token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    token_id = payload.get("token_id")
    
    if not user_id or not token_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if refresh token exists and is valid in database
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.id == token_id,
            RefreshToken.user_id == user_id,
            RefreshToken.is_active == True
        )
    )
    refresh_token_record = result.scalar_one_or_none()
    
    if not refresh_token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if refresh_token_record.expires_at < datetime.now(timezone.utc):
        # Invalidate expired token
        refresh_token_record.is_active = False
        refresh_token_record.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user
    user = await user_crud.get(db, id=uuid.UUID(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if email is verified
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email address.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate new tokens
    token_data = {
        "sub": user.username,
        "user_id": str(user.id),
        "email": user.email,
        "roles": [role.code for role in user.roles],
    }
    
    # Create new access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data=token_data,
        expires_delta=access_token_expires
    )
    
    # Update last login
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    
    logger.info(f"✅ Token refreshed successfully for user: {user.username}")
    
    return RefreshTokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=str(user.id),
        username=user.username,
        roles=[role.code for role in user.roles]
    )


# ==================== LOGIN/LOGOUT ENDPOINTS ====================

@router.post(
    "/login", 
    response_model=Token,
    summary="User login",
    description="Authenticate user using email OR username with password"
)
async def login(
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request = None
) -> Any:
    """
    OAuth2 compatible token login.
    
    Users can login using either:
    - Email address
    - Username
    
    Combined with password for authentication.
    """
    login_identifier = form_data.username  # Can be email OR username
    logger.info(f"🔐 Login attempt - Identifier: {login_identifier}")
    
    client_ip = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    endpoint = f"{request.method} {request.url.path}" if request else None
    
    try:
        # Check if login_identifier is email or username
        user = None
        
        # Check if it contains @ symbol (likely an email)
        if '@' in login_identifier:
            # Try to find by email
            user = await user_crud.get_by_email(db, email=login_identifier)
            if user:
                logger.info(f"🔑 User found by email: {login_identifier}")
        else:
            # Try to find by username
            user = await user_crud.get_by_username(db, username=login_identifier)
            if user:
                logger.info(f"🔑 User found by username: {login_identifier}")
        
        # If not found by either method, try username as fallback
        if not user:
            user = await user_crud.get_by_username(db, username=login_identifier)
        
        # Authenticate the user if found
        authenticated_user = None
        if user:
            # Verify password
            authenticated_user = await user_crud.authenticate(
                db, 
                username=user.username,  # Use found user's username
                password=form_data.password,
                load_roles=True
            )
        
        if not authenticated_user:
            # Log failed attempt
            await _log_audit_event(
                db=db,
                action="login",
                username=login_identifier,
                success=False,
                ip_address=client_ip,
                user_agent=user_agent,
                endpoint=endpoint,
                error_message="Invalid credentials"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email/username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check email verification
        if not authenticated_user.is_verified:
            await _log_audit_event(
                db=db,
                action="login",
                username=authenticated_user.username,
                user_id=authenticated_user.id,
                success=False,
                ip_address=client_ip,
                user_agent=user_agent,
                endpoint=endpoint,
                error_message="Email not verified"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Please check your inbox and verify your email address."
            )
        
        # Check if account is active
        if not authenticated_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account is inactive. Please contact support."
            )
        
        # Check if account is locked
        if authenticated_user.is_account_locked():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is locked. Please try again later or contact support."
            )
        
        # Create token data
        token_data = {
            "sub": authenticated_user.username,
            "user_id": str(authenticated_user.id),
            "email": authenticated_user.email,
            "roles": [role.code for role in authenticated_user.roles],
        }
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data=token_data, 
            expires_delta=access_token_expires
        )
        
        # Create refresh token
        refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        refresh_token = create_refresh_token(
            data={
                "sub": str(authenticated_user.id),
                "username": authenticated_user.username
            },
            expires_delta=refresh_token_expires
        )
        
        # Store refresh token in database
        refresh_token_record = RefreshToken(
            id=uuid.uuid4(),
            user_id=authenticated_user.id,
            token=refresh_token,
            expires_at=datetime.now(timezone.utc) + refresh_token_expires,
            user_agent=user_agent,
            ip_address=client_ip
        )
        db.add(refresh_token_record)
        
        # Reset login attempts on successful login
        authenticated_user.reset_login_attempts()
        
        # Update last login
        authenticated_user.last_login = datetime.now(timezone.utc)
        await db.commit()
        
        # Log successful login
        await _log_audit_event(
            db=db,
            action="login",
            username=authenticated_user.username,
            user_id=authenticated_user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            endpoint=endpoint,
            success=True
        )
        
        logger.info(f"✅ Login successful - User: {authenticated_user.username} (via {login_identifier})")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user_id": str(authenticated_user.id),
            "username": authenticated_user.username,
            "email": authenticated_user.email,  # ← ADD EMAIL TO RESPONSE
            "roles": [role.code for role in authenticated_user.roles]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error during login: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login. Please try again."
        )

@router.post(
    "/logout", 
    response_model=MessageResponse,
    summary="User logout",
    description="Logout and invalidate refresh token"
)
async def logout(
    *,
    db: AsyncSession = Depends(deps.get_db),
    refresh_token: str,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Logout - invalidate refresh token.
    """
    logger.info(f"🔓 Logout attempt - User: {current_user.username}")
    
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == refresh_token,
            RefreshToken.user_id == current_user.id,
            RefreshToken.is_active == True
        )
    )
    token_record = result.scalar_one_or_none()
    
    if token_record:
        token_record.is_active = False
        token_record.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info(f"✅ Refresh token revoked for user: {current_user.username}")
    else:
        logger.warning(f"⚠️ Refresh token not found for user: {current_user.username}")
    
    return MessageResponse(message="Logged out successfully")


@router.post(
    "/logout-all", 
    response_model=MessageResponse,
    summary="Logout from all devices",
    description="Invalidate all refresh tokens for the current user"
)
async def logout_all_devices(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Logout from all devices - revoke all refresh tokens.
    """
    logger.info(f"🔓 Logout from all devices - User: {current_user.username}")
    
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.is_active == True
        )
    )
    tokens = result.scalars().all()
    
    revoked_count = 0
    for token in tokens:
        token.is_active = False
        token.revoked_at = datetime.now(timezone.utc)
        revoked_count += 1
    
    await db.commit()
    
    logger.info(f"✅ Revoked {revoked_count} refresh tokens for user: {current_user.username}")
    return MessageResponse(
        message=f"Logged out from all devices successfully. {revoked_count} sessions terminated."
    )