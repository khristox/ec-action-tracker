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
    Request, Response, status, UploadFile, File
)
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.templating import Jinja2Templates
import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import get_db

# Image Processing safely handled
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from app.core.config import settings
from app.core.security import (
    create_access_token, create_refresh_token, get_current_active_user, get_current_user, get_password_hash, 
    verify_refresh_token, verify_password
)
from app.api import deps
from app.crud.user import user as user_crud
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.user import ProfilePictureResponse, ProfilePictureUpload, UserCreate, UserResponse, UserUpdate, encode_profile_picture
from app.schemas.token import Token, RefreshTokenRequest
from app.schemas.auth import (
    ForgotPasswordRequest, MessageResponse, PasswordResetRequest, PasswordResetResponse, ResendVerificationRequest, ResetPasswordRequest
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
    

@router.post("/forgot-password", response_model=PasswordResetResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(deps.get_db),
    req: Request = None
) -> Any:
    """
    Request password reset - sends email with reset link
    """
    try:
        logger.info(f"Password reset requested for email: {request.email}")
        
        # Find user by email
        user = await user_crud.get_by_email(db, email=request.email)
        
        if not user:
            logger.info(f"User not found: {request.email}")
            return PasswordResetResponse(
                message="If an account exists with this email, you will receive password reset instructions.",
                success=True
            )
        
        # Check if user is verified
        if not user.is_verified:
            logger.warning(f"Unverified user attempted password reset: {request.email}")
            return PasswordResetResponse(
                message="Please verify your email first. Check your inbox for verification link.",
                success=False
            )
        
        # Check if email service is configured
        if not email_service.is_configured():
            logger.error("Email service not configured for password reset")
            raise HTTPException(
                status_code=500,
                detail="Password reset service is temporarily unavailable. Please try again later."
            )
        
        # Generate password reset token
        token = email_service.generate_password_reset_token(
            user_id=str(user.id),
            email=user.email
        )
        
        # Send password reset email - Use 'token' parameter, not 'reset_link'
        email_sent = await email_service.send_password_reset_email(
            to_email=user.email,
            token=token,  # Changed from reset_link to token
            username=user.full_name or user.username
        )
        
        if email_sent:
            logger.info(f"✅ Password reset email sent to {user.email}")
            await _log_audit_event(
                db, "password_reset_request", user.username, 
                user_id=user.id, request=req, success=True
            )
            await db.commit()
            
            return PasswordResetResponse(
                message="Password reset instructions have been sent to your email.",
                success=True
            )
        else:
            logger.error(f"❌ Failed to send password reset email to {user.email}")
            raise HTTPException(
                status_code=500,
                detail="Failed to send password reset email. Please try again later."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset error for {request.email}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Unable to process password reset request. Please try again later."
        )



# app/api/v1/endpoints/auth.py

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    reset_data: PasswordResetRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    """Reset password using valid token"""
    try:
        # Convert SecretStr to string if needed
        secret_key = settings.SECRET_KEY
        if hasattr(secret_key, 'get_secret_value'):
            secret_key = secret_key.get_secret_value()
        else:
            secret_key = str(secret_key)
        
        # Verify the token
        payload = jwt.decode(
            reset_data.token, 
            secret_key,  # Use the string version
            algorithms=[settings.ALGORITHM]
        )
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        # Check token type
        if payload.get("type") != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type"
            )
        
        user_id = payload.get("user_id")
        email = payload.get("email")
        
        if not user_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token payload"
            )
        
        # Get user
        user = await user_crud.get(db, id=uuid.UUID(user_id))
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.email != email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token email doesn't match user"
            )
        
        # Hash the new password
        from app.core.security import get_password_hash
        user.hashed_password = get_password_hash(reset_data.new_password)
        user.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        
        return MessageResponse(message="Password reset successfully")
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid password reset token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or malformed reset token"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )
    

@router.get("/reset-password", response_class=HTMLResponse)
async def reset_password_page(
    request: Request,
    token: str,
):
    """Show password reset form (HTML page for email link)"""
    try:
        # Verify token is valid
        payload = email_service.verify_token(token, "password_reset")
        
        if not payload:
            return templates.TemplateResponse(
                "error.html",
                {"request": request, "error": "Invalid or expired reset link"}
            )
        
        # Return the reset form (React will handle this, not the backend)
        return templates.TemplateResponse(
            "reset_password.html",
            {
                "request": request,
                "token": token,
                "frontend_url": settings.FRONTEND_URL
            }
        )
    except Exception as e:
        logger.error(f"Reset password page error: {e}")
        return templates.TemplateResponse(
            "error.html",
            {"request": request, "error": "Invalid reset link"}
        )



@router.patch("/auth/profile-picture")
async def update_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user's profile picture
    """
    try:
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
            )
        
        # Validate file size (max 5MB)
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB"
            )
        
        # Read image and convert to bytes for blob storage
        await file.seek(0)  # Reset file position
        image_data = await file.read()
        
        # Update user's profile picture
        current_user.profile_picture = image_data
        current_user.profile_picture_type = file.content_type
        db.commit()
        db.refresh(current_user)
        
        # Return base64 encoded image for frontend
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        return {
            "success": True,
            "message": "Profile picture updated successfully",
            "profile_picture": f"data:{file.content_type};base64,{image_base64}",
            "profile_picture_type": file.content_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/auth/profile-picture")
async def delete_profile_picture(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete user's profile picture
    """
    if not current_user.profile_picture:
        raise HTTPException(status_code=404, detail="Profile picture not found")
    
    current_user.profile_picture = None
    current_user.profile_picture_type = None
    db.commit()
    
    return {"success": True, "message": "Profile picture deleted successfully"}


# ==================== USER UPDATE ENDPOINTS ====================

@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user information",
    description="""
    Update an existing user's information.
    
    - **Admin**: Can update any user
    - **Regular User**: Can only update their own information
    - All fields are optional for partial updates
    
    Supports profile picture upload via base64 string in the `profile_picture` field.
    """
)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user information including profile picture
    """
    # Check permissions
    print(user_update)
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user"
        )
    
    # Get user using async query - FIXED
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get updates dictionary
    updates = user_update.get_updates_dict()
    
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    # Apply updates
    for field, value in updates.items():
        setattr(user, field, value)
    
    # Update timestamp
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    # Create response with base64 profile picture
    response_data = UserResponse.model_validate(user).model_dump()
    
    # Add base64 encoded profile picture if exists
    if user.profile_picture:
        base64_image = base64.b64encode(user.profile_picture).decode('utf-8')
        response_data["profile_picture"] = f"data:{user.profile_picture_type or 'image/jpeg'};base64,{base64_image}"
    
    return response_data


@router.get(
    "/{user_id}/profile-picture/base64",
    response_model=dict,
    summary="Get user's profile picture as base64",
    description="Retrieve user's profile picture as base64 encoded string"
)
async def get_profile_picture_base64(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's profile picture as base64 encoded string
    
    Returns a data URL that can be directly used in img src
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user's profile picture"
        )
    
    # Get user using async query - FIXED
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.profile_picture:
        return {"profile_picture": None, "has_picture": False}
    
    # Convert to base64
    base64_image = base64.b64encode(user.profile_picture).decode('utf-8')
    data_url = f"data:{user.profile_picture_type or 'image/jpeg'};base64,{base64_image}"
    
    return {
        "profile_picture": data_url,
        "has_picture": True,
        "content_type": user.profile_picture_type
    }


@router.patch(
    "/{user_id}/profile-picture/base64",
    response_model=UserResponse,
    summary="Update user's profile picture (base64)",
    description="Update a user's profile picture using base64 encoded string"
)
async def update_profile_picture_base64(
    user_id: str,
    profile_picture_data: ProfilePictureUpload,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user's profile picture using base64 encoded string
    
    Accepts data URL format: data:image/jpeg;base64,base64data
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user's profile picture"
        )
    
    # Get user using async query - FIXED
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get processed image data
    image_bytes = profile_picture_data.get_profile_picture_bytes()
    content_type = profile_picture_data.get_profile_picture_content_type()
    
    # Update user's profile picture
    user.profile_picture = image_bytes
    user.profile_picture_type = content_type
    user.updated_at =  datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(user)
    
    # Return response with base64 profile picture
    response_data = UserResponse.model_validate(user).model_dump()
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    response_data["profile_picture"] = f"data:{content_type};base64,{base64_image}"
    
    return response_data


@router.delete(
    "/{user_id}/profile-picture",
    response_model=UserResponse,
    summary="Delete user's profile picture",
    description="Remove user's profile picture"
)
async def delete_profile_picture(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete user's profile picture
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this user's profile picture"
        )
    
    # Get user using async query - FIXED
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.profile_picture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile picture not found"
        )
    
    # Remove profile picture
    user.profile_picture = None
    user.profile_picture_type = None
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse.model_validate(user)

# ==================== PROFILE PICTURE SPECIFIC ENDPOINTS ====================

@router.patch(
    "/{user_id}/profile-picture",
    response_model=UserResponse,
    summary="Update user's profile picture",
    description="Update a user's profile picture using file upload"
)
async def update_profile_picture_file(
    user_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)  # Changed from Session to AsyncSession
):
    """
    Update user's profile picture using file upload
    
    - Accepts: JPEG, PNG, GIF, WEBP
    - Max size: 5MB
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user's profile picture"
        )
    
    # Get user - Fixed for async session
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Read file
    contents = await file.read()
    
    # Validate file size (max 5MB)
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size too large. Maximum size is 5MB"
        )
    
    # Update user's profile picture
    user.profile_picture = contents
    user.profile_picture_type = file.content_type
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    # Return response with base64 profile picture
    response_data = UserResponse.model_validate(user).model_dump()
    base64_image = base64.b64encode(contents).decode('utf-8')
    response_data["profile_picture"] = f"data:{file.content_type};base64,{base64_image}"
    
    return response_data

@router.patch(
    "/{user_id}/profile-picture/base64",
    response_model=UserResponse,
    summary="Update user's profile picture (base64)",
    description="Update a user's profile picture using base64 encoded string with automatic compression"
)
async def update_profile_picture_base64(
    user_id: str,
    profile_picture_data: ProfilePictureUpload,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update user's profile picture using base64 encoded string
    
    Accepts data URL format: data:image/jpeg;base64,base64data
    Automatically compresses images to WebP format for smallest size
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user's profile picture"
        )
    
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get processed image data
    image_bytes = profile_picture_data.get_profile_picture_bytes()
    content_type = profile_picture_data.get_profile_picture_content_type()
    
    # Compress image to WebP format (smallest size)
    try:
        from PIL import Image
        import io
        
        # Open image from bytes
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'LA', 'P'):
            # Create white background for transparency
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'RGBA':
                background.paste(img, mask=img.split()[-1])
            else:
                background.paste(img)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Calculate optimal dimensions (max 400x400 for profile pictures)
        max_size = 400
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Compress to WebP with quality 75 (good balance of size/quality)
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=75, optimize=True)
        compressed_bytes = output.getvalue()
        
        # Use compressed version if smaller
        if len(compressed_bytes) < len(image_bytes):
            image_bytes = compressed_bytes
            content_type = 'image/webp'
            
    except ImportError:
        # PIL not available, use original
        print("PIL not installed, using original image without compression")
    except Exception as e:
        print(f"Error compressing image: {e}, using original")
    
    # Update user's profile picture
    user.profile_picture = image_bytes
    user.profile_picture_type = content_type
    user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    # Return response with base64 profile picture
    response_data = UserResponse.model_validate(user).model_dump()
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    response_data["profile_picture"] = f"data:{content_type};base64,{base64_image}"
    
    return response_data


# Alternative: File upload endpoint with compression
@router.patch(
    "/{user_id}/profile-picture",
    response_model=UserResponse,
    summary="Update user's profile picture",
    description="Update a user's profile picture using file upload with automatic compression"
)
async def update_profile_picture_file(
    user_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update user's profile picture using file upload with compression
    
    - Accepts: JPEG, PNG, GIF, WEBP
    - Max size: 5MB (before compression)
    - Automatically compressed to WebP format
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user's profile picture"
        )
    
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Read file
    contents = await file.read()
    
    # Validate file size (max 5MB before compression)
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size too large. Maximum size is 5MB"
        )
    
    # Compress image
    try:
        from PIL import Image
        import io
        
        img = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'RGBA':
                background.paste(img, mask=img.split()[-1])
            else:
                background.paste(img)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize to max 400x400
        max_size = 400
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Compress to WebP
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=75, optimize=True)
        compressed_contents = output.getvalue()
        
        # Use compressed version
        contents = compressed_contents
        content_type = 'image/webp'
        
    except ImportError:
        content_type = file.content_type
        print("PIL not installed, using original image without compression")
    except Exception as e:
        content_type = file.content_type
        print(f"Error compressing image: {e}, using original")
    
    # Update user's profile picture
    user.profile_picture = contents
    user.profile_picture_type = content_type
    user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    # Return response with base64 profile picture
    response_data = UserResponse.model_validate(user).model_dump()
    base64_image = base64.b64encode(contents).decode('utf-8')
    response_data["profile_picture"] = f"data:{content_type};base64,{base64_image}"
    
    return response_data

@router.get("/profile-picture")
async def get_profile_picture(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's profile picture
    """
    user = db.query(User).filter(User.id == current_user.id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.profile_picture:
        return {"profile_picture": None}

    base64_image = base64.b64encode(user.profile_picture).decode("utf-8")

    return {
        "profile_picture": f"data:{user.profile_picture_type or 'image/jpeg'};base64,{base64_image}"
    }

@router.get(
    "/{user_id}/profile-picture/base64",
    response_model=dict,
    summary="Get user's profile picture as base64",
    description="Retrieve user's profile picture as base64 encoded string"
)
async def get_profile_picture_base64(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's profile picture as base64 encoded string
    
    Returns a data URL that can be directly used in img src
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user's profile picture"
        )
    
    # Get user using async query - FIXED
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.profile_picture:
        return {"profile_picture": None, "has_picture": False}
    
    # Convert to base64
    base64_image = base64.b64encode(user.profile_picture).decode('utf-8')
    data_url = f"data:{user.profile_picture_type or 'image/jpeg'};base64,{base64_image}"
    
    return {
        "profile_picture": data_url,
        "has_picture": True,
        "content_type": user.profile_picture_type
    }


@router.patch(
    "/{user_id}/profile-picture/base64",
    response_model=UserResponse,
    summary="Update user's profile picture (base64)",
    description="Update a user's profile picture using base64 encoded string"
)
async def update_profile_picture_base64(
    user_id: str,
    profile_picture_data: ProfilePictureUpload,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user's profile picture using base64 encoded string
    
    Accepts data URL format: data:image/jpeg;base64,base64data
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user's profile picture"
        )
    
    # Get user using async query - FIXED
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get processed image data
    image_bytes = profile_picture_data.get_profile_picture_bytes()
    content_type = profile_picture_data.get_profile_picture_content_type()
    
    # Update user's profile picture
    user.profile_picture = image_bytes
    user.profile_picture_type = content_type
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    # Return response with base64 profile picture
    response_data = UserResponse.model_validate(user).model_dump()
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    response_data["profile_picture"] = f"data:{content_type};base64,{base64_image}"
    
    return response_data


@router.delete(
    "/{user_id}/profile-picture",
    response_model=UserResponse,
    summary="Delete user's profile picture",
    description="Remove user's profile picture"
)
async def delete_profile_picture(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete user's profile picture
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this user's profile picture"
        )
    
    # Get user using async query - FIXED
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.profile_picture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile picture not found"
        )
    
    # Remove profile picture
    user.profile_picture = None
    user.profile_picture_type = None
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse.model_validate(user)

@router.delete(
    "/{user_id}/profile-picture",
    response_model=UserResponse,
    summary="Delete user's profile picture",
    description="Remove user's profile picture"
)
async def delete_profile_picture(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)  # Ensure this is AsyncSession
):
    """
    Delete user's profile picture
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this user's profile picture"
        )
    
    # Get user using async query
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.profile_picture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile picture not found"
        )
    
    # Remove profile picture
    user.profile_picture = None
    user.profile_picture_type = None
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse.model_validate(user)


@router.patch(
    "/{user_id}/profile-picture",
    response_model=UserResponse,
    summary="Update user's profile picture",
    description="Update a user's profile picture using file upload"
)
async def update_profile_picture_file(
    user_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user's profile picture using file upload
    
    - Accepts: JPEG, PNG, GIF, WEBP
    - Max size: 5MB
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user's profile picture"
        )
    
    # Get user using async query
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Read file
    contents = await file.read()
    
    # Validate file size (max 5MB)
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size too large. Maximum size is 5MB"
        )
    
    # Optional: Compress image
    try:
        from PIL import Image
        import io
        
        img = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'RGBA':
                background.paste(img, mask=img.split()[-1])
            else:
                background.paste(img)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize to max 400x400
        max_size = 400
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Compress to WebP
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=75, optimize=True)
        contents = output.getvalue()
        content_type = 'image/webp'
    except ImportError:
        content_type = file.content_type
        print("PIL not installed, using original image")
    except Exception as e:
        content_type = file.content_type
        print(f"Error compressing image: {e}")
    
    # Update user's profile picture
    user.profile_picture = contents
    user.profile_picture_type = content_type
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    # Return response with base64 profile picture
    response_data = UserResponse.model_validate(user).model_dump()
    base64_image = base64.b64encode(contents).decode('utf-8')
    response_data["profile_picture"] = f"data:{content_type};base64,{base64_image}"
    
    return response_data


@router.patch(
    "/{user_id}/profile-picture/base64",
    response_model=UserResponse,
    summary="Update user's profile picture (base64)",
    description="Update a user's profile picture using base64 encoded string"
)
async def update_profile_picture_base64(
    user_id: str,
    profile_picture_data: ProfilePictureUpload,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user's profile picture using base64 encoded string
    
    Accepts data URL format: data:image/jpeg;base64,base64data
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user's profile picture"
        )
    
    # Get user using async query
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get processed image data
    image_bytes = profile_picture_data.get_profile_picture_bytes()
    content_type = profile_picture_data.get_profile_picture_content_type()
    
    # Update user's profile picture
    user.profile_picture = image_bytes
    user.profile_picture_type = content_type
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    # Return response with base64 profile picture
    response_data = UserResponse.model_validate(user).model_dump()
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    response_data["profile_picture"] = f"data:{content_type};base64,{base64_image}"
    
    return response_data


@router.get(
    "/{user_id}/profile-picture/base64",
    response_model=dict,
    summary="Get user's profile picture as base64",
    description="Retrieve user's profile picture as base64 encoded string"
)
async def get_profile_picture_base64(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's profile picture as base64 encoded string
    
    Returns a data URL that can be directly used in img src
    """
    # Check permissions
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="3-Not authorized to view this user's profile picture"
        )
    
    # Get user using async query
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.profile_picture:
        return {"profile_picture": None, "has_picture": False}
    
    # Convert to base64
    base64_image = base64.b64encode(user.profile_picture).decode('utf-8')
    data_url = f"data:{user.profile_picture_type or 'image/jpeg'};base64,{base64_image}"
    
    return {
        "profile_picture": data_url,
        "has_picture": True,
        "content_type": user.profile_picture_type
    }

# ==================== CURRENT USER ENDPOINTS ====================

@router.patch(
    "/me/profile-picture",
    response_model=UserResponse,
    summary="Update current user's profile picture",
    description="Convenience endpoint for current user to update their profile picture"
)
async def update_my_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile picture using file upload
    """
    return await update_profile_picture_file(
        user_id=current_user.id,
        file=file,
        current_user=current_user,
        db=db
    )


@router.patch(
    "/me/profile-picture/base64",
    response_model=UserResponse,
    summary="Update current user's profile picture (base64)",
    description="Convenience endpoint for current user to update their profile picture using base64"
)
async def update_my_profile_picture_base64(
    profile_picture_data: ProfilePictureUpload,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile picture using base64 encoded string
    """
    return await update_profile_picture_base64(
        user_id=current_user.id,
        profile_picture_data=profile_picture_data,
        current_user=current_user,
        db=db
    )


# ==================== EXISTING ENDPOINTS ====================

@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    description="Retrieve user information by ID"
)
async def get_user(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user information
    """
    print(current_user.id,user_id)     
    # Check permissions
    if str(current_user.id) != str(user_id) :
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="4-Not authorized to view this user"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Create response with base64 profile picture
    response_data = UserResponse.model_validate(user).model_dump()
    
    if user.profile_picture:
        base64_image = base64.b64encode(user.profile_picture).decode('utf-8')
        response_data["profile_picture"] = f"data:{user.profile_picture_type or 'image/jpeg'};base64,{base64_image}"
    
    return response_data



@router.get("/me")
async def get_current_user_info(
    current_user = Depends(get_current_active_user),
):
    """
    Get current user information (without profile picture)
    """
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "middle_name": current_user.middle_name,
        "phone": current_user.phone,
        "alternate_phone": current_user.alternate_phone,
        "date_of_birth": current_user.date_of_birth.isoformat() if current_user.date_of_birth else None,
        "address": current_user.address,
        "city": current_user.city,
        "state": current_user.state,
        "country": current_user.country,
        "postal_code": current_user.postal_code,
        "occupation": current_user.occupation,
        "education": current_user.education,
        "bio": current_user.bio,
        "preferred_currency": current_user.preferred_currency,
        "language": current_user.language or "en",
        "timezone": current_user.timezone or "UTC",
        "is_active": current_user.is_active,
        "is_verified": current_user.is_verified,
        "is_superuser": current_user.is_superuser,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "updated_at": current_user.updated_at.isoformat() if current_user.updated_at else None,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
        "gender_attribute_id": str(current_user.gender_attribute_id) if current_user.gender_attribute_id else None,
        "language_attribute_id": str(current_user.language_attribute_id) if current_user.language_attribute_id else None,
        "currency_attribute_id": str(current_user.currency_attribute_id) if current_user.currency_attribute_id else None,
        "country_attribute_id": str(current_user.country_attribute_id) if current_user.country_attribute_id else None,
        "has_profile_picture": bool(current_user.profile_picture),
    }


@router.get("/me/profile-picture")
async def get_my_profile_picture(
    current_user = Depends(get_current_active_user),
):
    """
    Get current user's profile picture as base64
    """
    if not current_user.profile_picture:
        return {"profile_picture": None, "has_picture": False}
    
    base64_str = encode_profile_picture(
        current_user.profile_picture,
        getattr(current_user, 'profile_picture_type', None)
    )
    
    return {
        "profile_picture": base64_str,
        "has_picture": True,
        "content_type": current_user.profile_picture_type or "image/jpeg"
    }