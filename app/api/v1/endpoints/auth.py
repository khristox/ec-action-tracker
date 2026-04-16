import base64
import io
import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import (
    APIRouter, BackgroundTasks, Depends, HTTPException, 
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
from app.services.email_service import EmailService, email_service

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

    # Use a sub-transaction (savepoint) so an audit failure doesn't 
    # kill the main login transaction
    try:
        async with db.begin_nested():
            audit_entry = AuditLog(
                id=uuid.uuid4(),
                action=action.upper(),
                table_name="auth",
                username=username,
                user_id=user_id, # Must be a UUID object or None
                ip_address=request.client.host if request else None,
                user_agent=request.headers.get("user-agent")[:500] if request else None,
                endpoint=f"{request.method} {request.url.path}" if request else None,
                status="SUCCESS" if success else "FAILURE",
                error_message=error_message if not success else None,
                extra_data={"timestamp": datetime.now(timezone.utc).isoformat()},
                timestamp=datetime.now(timezone.utc)
            )
            db.add(audit_entry)
            # No need to commit here, nested transaction handles it via the context manager
    except Exception as e:
        logger.error(f"⚠️ Audit logging failed (likely FK constraint): {e}")
        # We don't raise the error here because we want the user to still be able to login
        #  

async def _send_verification_email(
    email_service_instance: EmailService,
    user: User,
    background_tasks: BackgroundTasks = None,
) -> bool:
    if user.is_verified:
        return True
    
    try:
        if not email_service_instance._is_configured():
            logger.error("Email service not configured")
            return False

        token = email_service_instance.generate_verification_token(str(user.id), user.email)
        email_args = {
            "to_email": user.email,
            "token": token,
            "username": user.full_name or user.username
        }

        if background_tasks:
            background_tasks.add_task(email_service_instance.send_verification_email, **email_args)
            return True
        else:
            return await email_service_instance.send_verification_email(**email_args)
            
    except Exception as e:
        logger.error(f"Email failure: {str(e)}")
        return False

# ==================== ENDPOINTS ====================

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
    background_tasks: BackgroundTasks
) -> Any:
    """Register a new user (with auto-cleanup of unverified stale accounts)."""
    existing_user = await user_crud.get_by_email(db, email=user_in.email)
    
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(status_code=409, detail="Email already verified.")
        else:
            # Cleanup old unverified attempt
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

    await _send_verification_email(email_service, new_user, background_tasks)
    await db.commit()
    return new_user

@router.post("/login", response_model=Token)
async def login(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request = None
) -> Any:
    # Use standard identifier lookup
    user = await user_crud.get_by_email(db, email=form_data.username) or \
           await user_crud.get_by_username(db, username=form_data.username)
    
    if not user or not await user_crud.authenticate(db, username=user.username, password=form_data.password):
        await _log_audit_event(db, "login", form_data.username, success=False, error_message="Invalid credentials")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_verified:
        await _send_verification_email(email_service, user, background_tasks)
        raise HTTPException(status_code=403, detail="Email not verified. Verification link resent.")

    # Token Generation
    access_token = create_access_token(
        data={"sub": user.username, "user_id": str(user.id), "roles": [r.code for r in user.roles]}
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Persistence
    db.add(RefreshToken(
        id=uuid.uuid4(), user_id=user.id, token=refresh_token,
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
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, # Added this
        "username": user.username,  # Added this
        "email": user.email         # Added this
    
    }

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(deps.get_current_user)):
    return current_user