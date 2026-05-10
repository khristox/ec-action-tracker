# app/api/v1/endpoints/auth.py - FIXED with unique operation_ids

import base64
import io
import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.models.base import BaseModel
from app.models.meetings.organization import OrganizationNode
from app.models.meetings.user_department import UserDepartment
from fastapi import (
    APIRouter, Depends, HTTPException, 
    Request, Response, status, UploadFile, File, Query as FastQuery
)
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.templating import Jinja2Templates
import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from sqlalchemy.orm import Query, Session

from app.db.base import get_db
from app.models.role import Role
from app.schemas.permission import PermissionResponse




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
from app.schemas.user import DepartmentResponse, ProfilePictureResponse, ProfilePictureUpload, UserCreate, UserResponse, UserUpdate, encode_profile_picture
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
        if not email_service.config.is_configured:
            logger.error("Email service not configured")
            return False

        token = email_service.generate_verification_token(str(user.id), user.email)
        
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


async def _send_welcome_email(user: User) -> bool:
    """Send welcome email - matches the async method in email_service.py"""
    try:
        if not email_service.config.is_configured:
            logger.error("Email service not configured")
            return False

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


# ==================== AUTH ENDPOINTS ====================

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, operation_id="auth_register")
async def register(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """Register a new user."""
    
    existing_user = await user_crud.get_by_email(db, email=user_in.email)
    
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(status_code=409, detail="Email already verified.")
        else:
            await db.delete(existing_user)
            await db.flush()
    
    if await user_crud.get_by_username(db, username=user_in.username):
        raise HTTPException(status_code=409, detail="Username already taken.")

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

    email_sent = await _send_verification_email(new_user)
    
    await db.commit()
    
    response_data = UserResponse.model_validate(new_user).model_dump()
    response_data["verification_email_sent"] = email_sent
    if not email_sent:
        response_data["warning"] = "Verification email could not be sent. Please contact support."
    
    return response_data


@router.post("/resend-verification", response_model=MessageResponse, operation_id="auth_resend_verification")
async def resend_verification_email(
    request: ResendVerificationRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> MessageResponse:
    """Resend verification email to user"""
    user = await user_crud.get_by_email(db, email=request.email)
    
    if not user:
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


@router.post("/login", response_model=Token, operation_id="auth_login")
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

    access_token = create_access_token(
        data={"sub": user.username, "user_id": str(user.id), "roles": [r.code for r in user.roles]}
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

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


@router.post("/logout", status_code=status.HTTP_200_OK, operation_id="auth_logout")
async def logout(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Logout user by removing refresh token and blacklisting access token"""
    try:
        # Delete refresh token for this user
        stmt = delete(RefreshToken).where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.is_active == True
        )
        result = await db.execute(stmt)
        
        # Log the logout event
        await _log_audit_event(
            db, "logout", current_user.username,
            user_id=current_user.id,
            success=True
        )
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Successfully logged out"
        }
        
    except Exception as e:
        logger.error(f"Logout error for user {current_user.username}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to logout"
        )


@router.get("/verify-email", operation_id="auth_verify_email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """Verify user's email address"""
    
    payload = email_service.verify_token(token, "email_verification")
    
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    
    user_id = payload.get("user_id")
    email = payload.get("email")
    
    if not user_id or not email:
        raise HTTPException(status_code=400, detail="Invalid token payload")
    
    user = await user_crud.get(db, id=uuid.UUID(user_id))
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.email != email:
        raise HTTPException(status_code=400, detail="Token email doesn't match user email")
    
    if user.is_verified:
        return {"message": "Email already verified. Please login."}
    
    user.is_verified = True
    user.verified_at = datetime.now(timezone.utc)
    
    import asyncio
    asyncio.create_task(_send_welcome_email(user))
    
    await db.commit()
    
    return {"message": "Email verified successfully! You can now login."}


# ==================== USER INFO ENDPOINTS ====================

@router.get("/me", response_model=UserResponse, operation_id="auth_get_current_user_full")
async def get_current_user_info_full(
    current_user: User = Depends(deps.get_current_user)
) -> UserResponse:
    """Get current user information"""
    
    # 1. Convert SQLAlchemy object to dict while excluding problematic fields
    user_dict = current_user.__dict__.copy()   # Safe way to get raw attributes

    # Remove SQLAlchemy internal state
    user_dict.pop('_sa_instance_state', None)
    user_dict.pop('departments', None)        # Critical: remove the bad relationship

    # Convert UUIDs and datetime to JSON-friendly formats
    if 'id' in user_dict and isinstance(user_dict['id'], uuid.UUID):
        user_dict['id'] = str(user_dict['id'])
    
    for dt_field in ['created_at', 'updated_at', 'last_login', 'date_of_birth', 'verified_at']:
        if dt_field in user_dict and user_dict[dt_field]:
            user_dict[dt_field] = user_dict[dt_field].isoformat()

    # 2. Handle profile picture
    if getattr(current_user, 'profile_picture', None):
        try:
            base64_image = base64.b64encode(current_user.profile_picture).decode('utf-8')
            content_type = getattr(current_user, 'profile_picture_type', 'image/jpeg')
            user_dict["profile_picture"] = f"data:{content_type};base64,{base64_image}"
        except Exception:
            user_dict["profile_picture"] = None
    else:
        user_dict["profile_picture"] = None

    # 3. Validate with clean dict
    return UserResponse.model_validate(user_dict)


@router.get("/me/simple", operation_id="auth_get_current_user_simple")
async def get_current_user_info_simple(
    current_user = Depends(get_current_active_user),
) -> Any:
    """Get current user information (simple dict without profile picture)"""
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


# ✅ ADDED /me/permissions endpoint
@router.get("/me/permissions", response_model=List[str], operation_id="auth_get_current_user_permissions")
async def get_current_user_permissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get all permissions for the current user.
    Returns a list of permission codes (strings) that the user has.
    """
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(User)
        .where(User.id == current_user.id)
        .options(
            selectinload(User.roles).selectinload(Role.permissions)
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    permission_codes = set()
    for role in user.roles:
        if role.permissions:
            for permission in role.permissions:
                if permission.code:
                    permission_codes.add(permission.code)
    
    return list(permission_codes)


@router.get("/me/permissions/detailed", response_model=List[PermissionResponse], operation_id="auth_get_current_user_permissions_detailed")
async def get_current_user_permissions_detailed(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get detailed permissions for the current user.
    Returns a list of permission objects with all details.
    """
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(User)
        .where(User.id == current_user.id)
        .options(
            selectinload(User.roles).selectinload(Role.permissions)
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    permissions_dict = {}
    for role in user.roles:
        if role.permissions:
            for permission in role.permissions:
                if permission.id not in permissions_dict:
                    permissions_dict[permission.id] = permission
    
    return list(permissions_dict.values())


@router.get("/me/profile-picture", operation_id="auth_get_my_profile_picture")
async def get_my_profile_picture(
    current_user = Depends(get_current_active_user),
) -> Any:
    """Get current user's profile picture as base64"""
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



# Add this to your router file (likely alongside your existing endpoints)



@router.get(
    "/me/departments", 
    response_model=DepartmentResponse,
    operation_id="auth_get_current_user_departments"
)
async def get_current_user_departments(
    limit: int = FastQuery(100, ge=1, le=1000),
    active_only: bool = FastQuery(True),
    role_filter: Optional[str] = FastQuery(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Get all departments assigned to the current user"""
    try:
        logger.info(f"Fetching departments for user: {current_user.id}")
        
        query = select(
            UserDepartment,
            OrganizationNode
        ).join(
            OrganizationNode,
            OrganizationNode.id == UserDepartment.department_id
        ).where(
            UserDepartment.user_id == current_user.id
        )
        
        if active_only:
            query = query.where(OrganizationNode.is_active == True)
            query = query.where(UserDepartment.status == 'active')
        
        if role_filter:
            query = query.where(UserDepartment.role == role_filter)
        
        query = query.limit(limit)
        
        result = await db.execute(query)
        rows = result.all()
        
        departments_list = []
        for user_department, org_node in rows:
            department_data = {
                "id": str(user_department.id),
                "user_id": str(user_department.user_id),
                "department_id": str(org_node.id),
                "department_name": str(org_node.name) if org_node.name else "",
                "department_path":str(org_node.path),
                "role": str(user_department.role) if user_department.role else "member",
                "status": str(user_department.status) if user_department.status else "active",
                "is_primary": bool(user_department.is_primary),
                "path": str(org_node.path) if org_node.path else "",
                "code": str(org_node.department_code) if org_node.department_code else "",
            }
            departments_list.append(department_data)
        
        return DepartmentResponse(
            success=True,
            data=departments_list,
            total=len(departments_list)
        )
        
    except Exception as e:
        logger.error(f"Error fetching departments: {str(e)}", exc_info=True)
        return DepartmentResponse(
            success=False,
            data=[],
            total=0
        )


@router.post("/test-email", operation_id="auth_test_email")
async def test_email_configuration(
    email: str = "test@example.com",
) -> Any:
    """Test endpoint to verify email configuration"""
    
    if not email_service.config.is_configured:
        raise HTTPException(status_code=500, detail="Email service not configured")
    
    try:
        test_token = "test-token-" + str(uuid.uuid4())
        
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
    

@router.post("/forgot-password", response_model=PasswordResetResponse, operation_id="auth_forgot_password")
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
        
        user = await user_crud.get_by_email(db, email=request.email)
        
        if not user:
            logger.info(f"User not found: {request.email}")
            return PasswordResetResponse(
                message="If an account exists with this email, you will receive password reset instructions.",
                success=True
            )
        
        if not user.is_verified:
            logger.warning(f"Unverified user attempted password reset: {request.email}")
            return PasswordResetResponse(
                message="Please verify your email first. Check your inbox for verification link.",
                success=False
            )
        
        if not email_service.is_configured():
            logger.error("Email service not configured for password reset")
            raise HTTPException(
                status_code=500,
                detail="Password reset service is temporarily unavailable. Please try again later."
            )
        
        token = email_service.generate_password_reset_token(
            user_id=str(user.id),
            email=user.email
        )
        
        email_sent = await email_service.send_password_reset_email(
            to_email=user.email,
            token=token,
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


# Add this to app/api/v1/endpoints/auth.py

@router.post("/refresh", response_model=Token, operation_id="auth_refresh_token")
async def refresh_access_token(
    refresh_token_request: RefreshTokenRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    Refresh access token using a valid refresh token.
    Returns a new access token and refresh token.
    """
    try:
        # Verify the refresh token
        refresh_token_str = refresh_token_request.refresh_token
        payload = verify_refresh_token(refresh_token_str)
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token payload",
            )
        
        # Check if refresh token exists in database and is active
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.token == refresh_token_str,
                RefreshToken.is_active == True,
                RefreshToken.expires_at > datetime.now(timezone.utc)
            )
        )
        stored_token = result.scalar_one_or_none()
        
        if not stored_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token not found or expired",
            )
        
        # Get the user
        user = await user_crud.get(db, id=uuid.UUID(user_id))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )
        
        # Generate new tokens
        new_access_token = create_access_token(
            data={"sub": user.username, "user_id": str(user.id), "roles": [r.code for r in user.roles]}
        )
        new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
        
        # Deactivate old refresh token
        stored_token.is_active = False
        stored_token.revoked_at = datetime.now(timezone.utc)
        
        # Create new refresh token
        db.add(RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token=new_refresh_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        ))
        
        await db.commit()
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "user_id": str(user.id),
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "username": user.username,
            "email": user.email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh token"
        )
    
@router.post("/reset-password", response_model=MessageResponse, operation_id="auth_reset_password")
async def reset_password(
    reset_data: PasswordResetRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """Reset password using valid token"""
    try:
        secret_key = settings.SECRET_KEY
        if hasattr(secret_key, 'get_secret_value'):
            secret_key = secret_key.get_secret_value()
        else:
            secret_key = str(secret_key)
        
        payload = jwt.decode(
            reset_data.token, 
            secret_key,
            algorithms=[settings.ALGORITHM]
        )
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
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


@router.get("/reset-password", response_class=HTMLResponse, operation_id="auth_reset_password_page")
async def reset_password_page(
    request: Request,
    token: str,
):
    """Show password reset form (HTML page for email link)"""
    try:
        payload = email_service.verify_token(token, "password_reset")
        
        if not payload:
            return templates.TemplateResponse(
                "error.html",
                {"request": request, "error": "Invalid or expired reset link"}
            )
        
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


# ==================== PROFILE PICTURE ENDPOINTS ====================

@router.patch("/profile-picture", operation_id="auth_update_profile_picture")
async def update_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)  # Change Session to AsyncSession
):
    """Update user's profile picture"""
    try:
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
            )
        
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB"
            )
        
        # Update user's profile picture (no need to read again)
        current_user.profile_picture = contents
        current_user.profile_picture_type = file.content_type
        current_user.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(current_user)
        
        image_base64 = base64.b64encode(contents).decode('utf-8')
        
        return {
            "success": True,
            "message": "Profile picture updated successfully",
            "profile_picture": f"data:{file.content_type};base64,{image_base64}",
            "profile_picture_type": file.content_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Profile picture update error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/profile-picture", operation_id="auth_delete_profile_picture")
async def delete_profile_picture(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)  # Change to AsyncSession
):
    """Delete user's profile picture"""
    if not current_user.profile_picture:
        raise HTTPException(status_code=404, detail="Profile picture not found")
    
    current_user.profile_picture = None
    current_user.profile_picture_type = None
    current_user.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    
    return {"success": True, "message": "Profile picture deleted successfully"}



@router.get("/profile-picture", operation_id="auth_get_my_profile_picture_simple")
async def get_my_profile_picture_simple(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get current user's profile picture (simpler endpoint for frontend)"""
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
# ==================== USER UPDATE ENDPOINTS ====================

@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    operation_id="auth_update_user",
    summary="Update user information",
    description="Update an existing user's information."
)
async def update_user(
    user_id: uuid.UUID,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Update user information including profile picture"""
    
    if str(current_user.id) != str(user_id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    updates = user_update.get_updates_dict()
    
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    for field, value in updates.items():
        setattr(user, field, value)
    
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    response_data = UserResponse.model_validate(user).model_dump()
    
    if user.profile_picture:
        base64_image = base64.b64encode(user.profile_picture).decode('utf-8')
        response_data["profile_picture"] = f"data:{user.profile_picture_type or 'image/jpeg'};base64,{base64_image}"
    
    return response_data


# ==================== GET USER BY ID ====================
@router.get(
    "/{user_id}",
    response_model=UserResponse,
    operation_id="auth_get_user_by_id",
    summary="Get user by ID",
    description="Retrieve user information by ID"
)
async def get_user(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)  # Use AsyncSession
) -> Any:
    """Get user information"""
    
    if str(current_user.id) != user_id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user"
        )
    
    # Use async syntax
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    response_data = UserResponse.model_validate(user).model_dump()
    
    if user.profile_picture:
        base64_image = base64.b64encode(user.profile_picture).decode('utf-8')
        response_data["profile_picture"] = f"data:{user.profile_picture_type or 'image/jpeg'};base64,{base64_image}"
    
    return response_data

@router.get(
    "/{user_id}/profile-picture/base64",
    response_model=dict,
    operation_id="auth_get_user_profile_picture_base64",
    summary="Get user's profile picture as base64",
    description="Retrieve user's profile picture as base64 encoded string"
)
async def get_user_profile_picture_base64(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's profile picture as base64 encoded string
    
    Returns a data URL that can be directly used in img src
    """
    # Check permissions - users can only view their own or admins can view any
    if str(current_user.id) != user_id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user's profile picture"
        )
    
    # Get user using async query
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
    
    # Convert to base64
    base64_image = base64.b64encode(user.profile_picture).decode('utf-8')
    data_url = f"data:{user.profile_picture_type or 'image/jpeg'};base64,{base64_image}"
    
    return {
        "profile_picture": data_url,
        "has_picture": True,
        "content_type": user.profile_picture_type
    }