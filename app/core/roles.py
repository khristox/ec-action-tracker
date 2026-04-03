from functools import wraps
from typing import List, Callable
from fastapi import HTTPException, status
from app.models.user import User

def check_roles(required_roles: List[str], require_all: bool = False):
    """
    Decorator for role-based access control in services/functions.
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs or args
            current_user = kwargs.get('current_user')
            if not current_user:
                # Try to find in args
                for arg in args:
                    if isinstance(arg, User):
                        current_user = arg
                        break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not authenticated"
                )
            
            user_roles = [role.name for role in current_user.roles]
            
            if require_all:
                if not all(role in user_roles for role in required_roles):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"User missing required roles: {required_roles}"
                    )
            else:
                if not any(role in user_roles for role in required_roles):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"User must have at least one of these roles: {required_roles}"
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Usage example in a service:
"""
@check_roles(["admin", "manager"])
async def some_service_function(current_user: User, data: dict):
    # This function can only be called by admin or manager
    pass
"""