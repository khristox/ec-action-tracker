# app/api/v1/endpoints/auth.py

import base64
from datetime import datetime, timedelta, timezone
import io
from pathlib import Path
from typing import Any, List, Optional, Tuple

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
import uuid


# Add this import for image processing
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("Warning: Pillow not installed. Run: pip install Pillow")


from starlette.datastructures import UploadFile

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, get_password_hash, verify_refresh_token, verify_password
from app.api import deps
from app.crud.user import user as user_crud
from app.crud.role import role as role_crud
from app.crud.permission import permission as permission_crud
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.schemas.token import Token, RefreshTokenRequest, RefreshTokenResponse
from app.schemas.auth import PasswordChange, PasswordResetRequest, PasswordResetConfirm, MessageResponse, ResendVerificationRequest
from app.schemas.permission import PermissionResponse
from app.schemas.role import RoleCreate, RoleResponse, RoleUpdate
from app.services.email_service import EmailService, email_service


from fastapi import UploadFile, File, HTTPException, Depends


# Only import AuditLog if the model exists
try:
    from app.models.audit import AuditLog
    from app.services.audit_service import AuditService
    AUDIT_ENABLED = True
except ImportError:
    AUDIT_ENABLED = False
    # Create dummy AuditService if not available
    class AuditService:
        def __init__(self, db):
            pass
        async def log_login(self, **kwargs):
            pass
        async def log_logout(self, **kwargs):
            pass

router = APIRouter()
templates_dir = Path(__file__).parent.parent.parent.parent / "templates"
templates = Jinja2Templates(directory=templates_dir)


# ==================== HELPER FUNCTIONS ====================

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
    if not AUDIT_ENABLED:
        return
    
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
    except Exception as e:
        from asyncio.log import logger
        logger.error(f"Failed to log audit event: {str(e)}")


async def _send_verification_email(
    email_service_instance: EmailService,
    user: User,
    background_tasks: BackgroundTasks = None,
    is_verified: bool = False,
    wait_for_send: bool = False
) -> bool:
    """Unified function to send verification email."""
    from asyncio.log import logger
    
    if is_verified:
        logger.info(f"ℹ️ User already verified, skipping email: {user.email}")
        return True
    
    if not user:
        logger.error("❌ User is None, cannot send verification email")
        return False
    
    try:
        logger.info(f"📧 {'Sending' if wait_for_send else 'Queueing'} verification email to: {user.email}")
        
        if email_service_instance is None:
            logger.error("❌ Email service instance is None!")
            return False
        
        if not email_service_instance._is_configured():
            logger.error("❌ Email service is not properly configured!")
            logger.error(f"   EMAIL_HOST: {settings.EMAIL_HOST}")
            logger.error(f"   EMAIL_PORT: {settings.EMAIL_PORT}")
            logger.error(f"   EMAIL_USER: {settings.EMAIL_USER}")
            return False

        # Generate new token
        token = email_service_instance.generate_verification_token(str(user.id), user.email)
        logger.info(f"✅ New token generated: {token[:30]}...")

        if wait_for_send:
            result = await email_service_instance.send_verification_email(
                to_email=user.email,
                token=token,
                username=user.full_name or user.username
            )
            success = result.get("success", False) if isinstance(result, dict) else bool(result)
            if success:
                logger.info(f"✅ Verification email sent to {user.email}")
            else:
                logger.error(f"❌ Failed to send email to {user.email}")
            return success
        else:
            if background_tasks:
                background_tasks.add_task(
                    email_service_instance.send_verification_email,
                    to_email=user.email,
                    token=token,
                    username=user.full_name or user.username
                )
                logger.info(f"✅ Verification email queued for: {user.email}")
                return True
            else:
                result = await email_service_instance.send_verification_email(
                    to_email=user.email,
                    token=token,
                    username=user.full_name or user.username
                )
                success = result.get("success", False) if isinstance(result, dict) else bool(result)
                return success
            
    except Exception as e:
        logger.error(f"❌ Failed to {'send' if wait_for_send else 'queue'} verification email: {str(e)}", exc_info=True)
        return False


# ==================== REGISTRATION ENDPOINT (SINGLE VERSION) ====================

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
    background_tasks: BackgroundTasks
) -> Any:
    """Register a new user with email verification."""
    from asyncio.log import logger
    
    logger.info(f"🚀 Registration started for {user_in.email}")

    try:
        # Check if user already exists and is verified
        existing_user = await user_crud.get_by_email(db, email=user_in.email)
        
        if existing_user:
            if existing_user.is_verified:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "message": "A verified account already exists with this email address.",
                        "field": "email",
                        "error": "EMAIL_ALREADY_VERIFIED"
                    }
                )
            else:
                # Unverified account exists - delete it to allow new registration
                logger.info(f"🗑️ Deleting existing unverified account for {user_in.email}")
                await db.delete(existing_user)
                await db.flush()
        
        # Check if username is taken
        existing_username = await user_crud.get_by_username(db, username=user_in.username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "This username is already taken.",
                    "field": "username",
                    "error": "USERNAME_TAKEN"
                }
            )

        # Create new user
        logger.info(f"🏗️ Creating new user: {user_in.email}")
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

        if not new_user:
            logger.error(f"❌ Failed to create user: {user_in.email}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user account. Please try again."
            )

        await db.flush()
        
        # Send verification email
        email_sent = await _send_verification_email(
            email_service, 
            new_user, 
            background_tasks, 
            is_verified=False
        )
        
        if not email_sent:
            logger.warning(f"⚠️ Verification email may not have been sent for {new_user.email}")
        
        await db.commit()

        logger.info(f"✅ New user registered successfully: {new_user.username}")
        return new_user

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"💥 Critical error during registration: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during registration. Please try again."
        )


# ==================== CURRENT USER ENDPOINTS ====================

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get the currently authenticated user's information."""
    from asyncio.log import logger
    
    logger.info(f"🔐 Fetching current user info: {current_user.username}")
    
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        phone=current_user.phone,
        #bio=current_user.bio,
        full_name=current_user.full_name,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        roles=[role.code for role in current_user.roles],
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at
    )


# ==================== PROFILE UPDATE ENDPOINTS (ADDED) ====================

@router.put("/profile", response_model=UserResponse)
async def update_current_user_profile(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_update: UserUpdate,
    current_user: User = Depends(deps.get_current_user),
    request: Request = None
) -> Any:
    """Update the currently authenticated user's profile."""
    from asyncio.log import logger
    
    logger.info(f"📝 Profile update attempt for user: {current_user.username}")
    
    client_ip = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    
    try:
        # Update user fields
        update_data = user_update.dict(exclude_unset=True)
        
        if update_data:
            for field, value in update_data.items():
                if value is not None and hasattr(current_user, field):
                    setattr(current_user, field, value)
        
        # Update timestamp
        current_user.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(current_user)
        
        # Log audit event if enabled
        if AUDIT_ENABLED:
            await _log_audit_event(
                db=db, action="profile_update", username=current_user.username,
                user_id=current_user.id, ip_address=client_ip,
                user_agent=user_agent, endpoint="/auth/profile", success=True
            )
        
        logger.info(f"✅ Profile updated successfully for: {current_user.username}")
        
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
        
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Profile update error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )


@router.patch("/profile", response_model=UserResponse)
async def patch_current_user_profile(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_update: UserUpdate,
    current_user: User = Depends(deps.get_current_user),
    request: Request = None
) -> Any:
    """Partially update the currently authenticated user's profile."""
    from asyncio.log import logger
    
    logger.info(f"📝 Partial profile update attempt for user: {current_user.username}")
    
    client_ip = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    
    try:
        # Update only provided fields
        update_data = user_update.dict(exclude_unset=True)
        
        if update_data:
            for field, value in update_data.items():
                if value is not None and hasattr(current_user, field):
                    setattr(current_user, field, value)
        
        # Update timestamp
        current_user.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(current_user)
        
        # Log audit event if enabled
        if AUDIT_ENABLED:
            await _log_audit_event(
                db=db, action="profile_update", username=current_user.username,
                user_id=current_user.id, ip_address=client_ip,
                user_agent=user_agent, endpoint="/auth/profile", success=True
            )
        
        logger.info(f"✅ Profile partially updated for: {current_user.username}")
        
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
        
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Profile update error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )




@router.post("/profile-picture", response_model=dict)
async def upload_profile_picture(
    *,
    db: AsyncSession = Depends(deps.get_db),
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Upload profile picture for current user (stored as BLOB in DB)."""
    from asyncio.log import logger
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only JPEG, PNG, and WEBP are allowed."
        )
    
    # Read file content
    content = await file.read()
    
    # Validate file size (5MB max)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File size too large. Maximum size is 5MB."
        )
    
    # Compress the image
    try:
        # Open image with PIL
        image = Image.open(io.BytesIO(content))
        
        # Convert RGBA to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            # Create white background for transparent images
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize image to max dimensions (800x800)
        max_size = 800
        if image.width > max_size or image.height > max_size:
            ratio = min(max_size / image.width, max_size / image.height)
            new_size = (int(image.width * ratio), int(image.height * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Compress and save to bytes
        output = io.BytesIO()
        image.save(output, format='JPEG', quality=70, optimize=True)
        compressed_content = output.getvalue()
        
        logger.info(f"Image compressed: {len(content)} -> {len(compressed_content)} bytes")
        
    except Exception as e:
        logger.error(f"Image compression error: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Failed to process image. Please try another image."
        )
    
    # Store as BLOB in database
    current_user.profile_picture = compressed_content
    current_user.profile_picture_type = 'image/jpeg'  # We convert everything to JPEG
    await db.commit()
    
    logger.info(f"✅ Profile picture updated for user: {current_user.username}")
    
    # Return base64 encoded image for frontend
    base64_image = base64.b64encode(compressed_content).decode('utf-8')
    return {
        "profile_picture": f"data:image/jpeg;base64,{base64_image}",
        "message": "Profile picture uploaded successfully"
    }


@router.get("/profile-picture", response_model=dict)
async def get_profile_picture(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get current user's profile picture as base64."""
    from asyncio.log import logger
    
    if not current_user.profile_picture:
        raise HTTPException(
            status_code=404,
            detail="No profile picture found"
        )
    
    base64_image = base64.b64encode(current_user.profile_picture).decode('utf-8')
    return {
        "profile_picture": f"data:{current_user.profile_picture_type or 'image/jpeg'};base64,{base64_image}"
    }


@router.delete("/profile-picture", response_model=dict)
async def delete_profile_picture(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Delete current user's profile picture."""
    from asyncio.log import logger
    
    current_user.profile_picture = None
    current_user.profile_picture_type = None
    await db.commit()
    
    logger.info(f"✅ Profile picture deleted for user: {current_user.username}")
    return {"message": "Profile picture deleted successfully"}
    
# ==================== EMAIL VERIFICATION ENDPOINTS ====================

@router.get("/verify-email", response_model=MessageResponse)
async def verify_email(
    *,
    db: AsyncSession = Depends(deps.get_db),
    token: str,
    background_tasks: BackgroundTasks
) -> Any:
    """Verify user's email address using the verification token."""
    from asyncio.log import logger
    
    logger.info(f"🔐 Email verification attempt")
    
    payload = email_service.verify_token(token, "email_verification")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token."
        )
    
    user_id = payload.get("user_id")
    email = payload.get("email")
    
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token payload"
        )
    
    db_user = await user_crud.get(db, id=uuid.UUID(user_id))
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if db_user.is_verified:
        return MessageResponse(message="Email already verified. You can now log in.")
    
    # Update verification status
    db_user.is_verified = True
    db_user.verified_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(db_user)
    
    # Send welcome email
    try:
        background_tasks.add_task(
            email_service.send_welcome_email,
            to_email=db_user.email,
            username=db_user.username
        )
        logger.info(f"📧 Welcome email queued for: {db_user.email}")
    except Exception as e:
        logger.error(f"❌ Failed to send welcome email: {str(e)}")
    
    logger.info(f"✅ Email verified for user: {db_user.username}")
    return MessageResponse(message="Email verified successfully! You can now log in.")


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    *,
    db: AsyncSession = Depends(deps.get_db),
    request_data: ResendVerificationRequest,
    background_tasks: BackgroundTasks
) -> Any:
    """Resend verification email to user"""
    from asyncio.log import logger
    
    email = request_data.email
    logger.info(f"📧 Resend verification requested for: {email}")
    
    user = await user_crud.get_by_email(db, email=email)
    if not user:
        # Return success even if user doesn't exist for security
        return MessageResponse(
            message="If your email is registered, a verification link has been sent."
        )
    
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified. Please login."
        )
    
    # Send verification email
    email_sent = await _send_verification_email(
        email_service,
        user,
        background_tasks,
        is_verified=False
    )
    
    if email_sent:
        logger.info(f"✅ Verification email resent to: {email}")
        return MessageResponse(message="Verification email sent. Please check your inbox.")
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again."
        )


# ==================== LOGIN ENDPOINT ====================

@router.post("/login", response_model=Token)
async def login(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request = None
) -> Any:
    """OAuth2 compatible token login using email or username."""
    from asyncio.log import logger
    
    login_identifier = form_data.username
    logger.info(f"🔐 Login attempt - Identifier: {login_identifier}")
    
    client_ip = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    endpoint = f"{request.method} {request.url.path}" if request else None
    
    try:
        # Find user by email or username
        user = None
        if '@' in login_identifier:
            user = await user_crud.get_by_email(db, email=login_identifier)
        else:
            user = await user_crud.get_by_username(db, username=login_identifier)
        
        if not user:
            user = await user_crud.get_by_username(db, username=login_identifier)
        
        # Authenticate
        authenticated_user = None
        if user:
            authenticated_user = await user_crud.authenticate(
                db, username=user.username, password=form_data.password, load_roles=True
            )
        
        if not authenticated_user:
            await _log_audit_event(
                db=db, action="login", username=login_identifier, success=False,
                ip_address=client_ip, user_agent=user_agent, endpoint=endpoint,
                error_message="Invalid credentials"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email/username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Validate user status
        if not authenticated_user.is_verified:
            # Send verification email
            logger.info(f"📧 Sending verification email to unverified user: {authenticated_user.email}")
            
            email_sent = await _send_verification_email(
                email_service,
                authenticated_user,
                background_tasks,
                is_verified=False,
                wait_for_send=False
            )
            
            await _log_audit_event(
                db=db, action="login", username=authenticated_user.username,
                user_id=authenticated_user.id, success=False, ip_address=client_ip,
                user_agent=user_agent, endpoint=endpoint, error_message="Email not verified"
            )
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. A verification link has been sent to your email."
            )
        
        if not authenticated_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is inactive. Please contact support."
            )
        
        # Generate tokens
        token_data = {
            "sub": authenticated_user.username,
            "user_id": str(authenticated_user.id),
            "email": authenticated_user.email,
            "roles": [role.code for role in authenticated_user.roles],
        }
        
        access_token = create_access_token(
            data=token_data,
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        refresh_token = create_refresh_token(
            data={"sub": str(authenticated_user.id), "username": authenticated_user.username},
            expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        
        # Store refresh token
        refresh_token_record = RefreshToken(
            id=uuid.uuid4(),
            user_id=authenticated_user.id,
            token=refresh_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            user_agent=user_agent,
            ip_address=client_ip
        )
        db.add(refresh_token_record)
        
        # Update user
        authenticated_user.last_login = datetime.now(timezone.utc)
        await db.commit()
        
        await _log_audit_event(
            db=db, action="login", username=authenticated_user.username,
            user_id=authenticated_user.id, ip_address=client_ip,
            user_agent=user_agent, endpoint=endpoint, success=True
        )
        
        logger.info(f"✅ Login successful: {authenticated_user.username}")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user_id": str(authenticated_user.id),
            "username": authenticated_user.username,
            "email": authenticated_user.email,
            "roles": [role.code for role in authenticated_user.roles]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Login error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login."
        )


# ==================== TOKEN REFRESH ENDPOINTS ====================

@router.post("/refresh", response_model=Token)
async def refresh_token(
    request_data: RefreshTokenRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """Refresh access token using refresh token."""
    from asyncio.log import logger
    
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
    
    # Verify refresh token in database
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
    
    # Generate new access token
    token_data = {
        "sub": user.username,
        "user_id": str(user.id),
        "email": user.email,
        "roles": [role.code for role in user.roles],
    }
    
    access_token = create_access_token(
        data=token_data,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    
    logger.info(f"✅ Token refreshed for user: {user.username}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user_id": str(user.id),
        "username": user.username,
        "roles": [role.code for role in user.roles]
    }


# ==================== LOGOUT ENDPOINTS ====================

@router.post("/logout", response_model=MessageResponse)
async def logout(
    *,
    db: AsyncSession = Depends(deps.get_db),
    refresh_token: str,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Logout and invalidate refresh token."""
    from asyncio.log import logger
    
    logger.info(f"🔓 Logout attempt: {current_user.username}")
    
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
        logger.info(f"✅ Refresh token revoked")
    else:
        logger.warning(f"⚠️ Refresh token not found")
    
    return MessageResponse(message="Logged out successfully")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all_devices(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Logout from all devices - revoke all refresh tokens."""
    from asyncio.log import logger
    
    logger.info(f"🔓 Logout from all devices: {current_user.username}")
    
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
    
    logger.info(f"✅ Revoked {revoked_count} tokens")
    return MessageResponse(
        message=f"Logged out from all devices. {revoked_count} sessions terminated."
    )


# ==================== PASSWORD RESET ENDPOINTS ====================

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    *,
    db: AsyncSession = Depends(deps.get_db),
    request_data: PasswordResetRequest,
    background_tasks: BackgroundTasks
) -> Any:
    """Send password reset email to user."""
    from asyncio.log import logger
    
    email = request_data.email
    logger.info(f"🔑 Password reset requested for: {email}")
    
    db_user = await user_crud.get_by_email(db, email=email)
    
    # Always return same message for security
    if not db_user:
        return MessageResponse(
            message="If your email is registered, you will receive a password reset link."
        )
    
    # Generate and store token
    token = email_service.generate_password_reset_token(str(db_user.id), db_user.email)
    db_user.reset_token = token
    db_user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.commit()
    
    # Send email
    background_tasks.add_task(
        email_service.send_password_reset_email,
        db_user.email,
        token,
        db_user.full_name or db_user.username
    )
    
    logger.info(f"✅ Password reset email queued for: {email}")
    
    return MessageResponse(
        message="If your email is registered, you will receive a password reset link."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password_confirm(
    *,
    db: AsyncSession = Depends(deps.get_db),
    request_data: PasswordResetConfirm,
    background_tasks: BackgroundTasks
) -> Any:
    """Reset password using token."""
    from asyncio.log import logger
    
    logger.info(f"🔐 Password reset confirmation")
    
    payload = email_service.verify_token(request_data.token, "password_reset")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token."
        )
    
    user_id = payload.get("user_id")
    email = payload.get("email")
    
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token payload"
        )
    
    db_user = await user_crud.get(db, id=uuid.UUID(user_id))
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if db_user.reset_token != request_data.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )
    
    if db_user.reset_token_expires and db_user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired."
        )
    
    # Update password
    db_user.hashed_password = get_password_hash(request_data.new_password)
    db_user.password_changed_at = datetime.now(timezone.utc)
    db_user.reset_token = None
    db_user.reset_token_expires = None
    await db.commit()
    
    # Send confirmation
    background_tasks.add_task(
        email_service.send_password_reset_confirmation_email,
        db_user.email,
        db_user.full_name or db_user.username
    )
    
    logger.info(f"✅ Password reset successful for: {db_user.username}")
    return MessageResponse(message="Password reset successful! You can now log in.")



@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    *,
    db: AsyncSession = Depends(deps.get_db),
    password_data: PasswordChange,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Change current user's password."""
    from asyncio.log import logger
    
    logger.info(f"🔐 Password change attempt for user: {current_user.username}")
    
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Current password is incorrect",
                "field": "current_password",
                "error": "INVALID_CURRENT_PASSWORD"
            }
        )
    
    # Check if new password is same as current
    if verify_password(password_data.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "New password cannot be the same as current password",
                "field": "new_password",
                "error": "PASSWORD_SAME_AS_CURRENT"
            }
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.password_changed_at = datetime.now(timezone.utc)
    await db.commit()
    
    logger.info(f"✅ Password changed successfully for user: {current_user.username}")
    
    return MessageResponse(message="Password changed successfully")