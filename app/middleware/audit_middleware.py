# app/middleware/audit_middleware.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
import uuid
from typing import Optional, Any
import logging

from app.services.audit_service import AuditService
from app.db.base import AsyncSessionLocal
from app.crud.user import user as user_crud
from app.core.security import decode_token
from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware to automatically log all API requests.
    """
    
    def __init__(self, app, skip_paths: Optional[list] = None):
        super().__init__(app)
        self.skip_paths = skip_paths or [
            '/health', '/metrics', '/docs', '/openapi.json', 
            '/redoc', '/favicon.ico'
        ]
        self.audit_enabled = settings.LOG_API_ACCESS
    
    async def dispatch(self, request: Request, call_next):
        # Skip logging for certain paths
        if self._should_skip_path(request.url.path):
            return await call_next(request)
        
        # Generate request ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        
        start_time = time.time()
        
        # Get current user if authenticated
        current_user = await self._get_current_user(request)
        
        # Process request
        response = None
        status_code = 500
        success = False
        error_message = None
        
        try:
            response = await call_next(request)
            status_code = response.status_code
            success = 200 <= status_code < 400
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
        except Exception as e:
            status_code = 500
            success = False
            error_message = str(e)
            logger.error(f"Request failed: {error_message}", exc_info=True)
            raise
        finally:
            execution_time = (time.time() - start_time) * 1000
            
            # Log asynchronously if enabled
            if self.audit_enabled:
                await self._log_async(
                    request=request,
                    response=response,
                    current_user=current_user,
                    request_id=request_id,
                    status_code=status_code,
                    execution_time=execution_time,
                    success=success,
                    error_message=error_message
                )
        
        return response
    
    def _should_skip_path(self, path: str) -> bool:
        for skip_path in self.skip_paths:
            if path.startswith(skip_path):
                return True
        return False
    
    async def _get_current_user(self, request: Request) -> Optional[User]:
        """Extract current user from authorization header - returns User object"""
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        try:
            token = auth_header.split(" ")[1]
            payload = decode_token(token)
            
            if not payload:
                return None
            
            # Get user from database - return the actual User object
            async with AsyncSessionLocal() as db:
                user_obj = await user_crud.get_by_username(
                    db, username=payload.get("sub")
                )
                return user_obj
                
        except Exception as e:
            logger.debug(f"Failed to get current user: {e}")
        
        return None
    
    async def _log_async(
        self,
        request: Request,
        response: Optional[Response],
        current_user: Optional[User],  # Now expects User object, not dict
        request_id: str,
        status_code: int,
        execution_time: float,
        success: bool,
        error_message: Optional[str]
    ):
        """Log asynchronously without blocking the main request."""
        try:
            # Use a separate database session for audit logging
            async with AsyncSessionLocal() as db:
                audit_service = AuditService(db)
                
                # Prepare audit data
                new_values = {
                    'method': request.method,
                    'path': request.url.path,
                    'query': str(request.query_params),
                    'status_code': status_code,
                    'execution_time_ms': round(execution_time, 2),
                    'client_ip': request.client.host if request.client else None,
                    'user_agent': request.headers.get("user-agent"),
                    'request_id': request_id
                }
                
                # Add error information if any
                if error_message:
                    new_values['error'] = error_message[:1000]
                
                # Log the API access - pass the User object directly
                await audit_service.log(
                    action='API_ACCESS',
                    table_name='api',
                    user=current_user,  # Pass User object, not dict
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    endpoint=f"{request.method} {request.url.path}",
                    request_id=request_id,
                    old_values=None,
                    new_values=new_values,
                    changes_summary=f"{request.method} {request.url.path} - {status_code} ({execution_time:.0f}ms)"
                )
                
                await db.commit()
                
        except Exception as e:
            logger.error(f"Failed to log API access: {e}", exc_info=True)