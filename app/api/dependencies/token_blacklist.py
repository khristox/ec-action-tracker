# app/dependencies/token_blacklist.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.token_blacklist_service import TokenBlacklistService
from app.db.session import get_db
from app.core.security import decode_token

security = HTTPBearer()

async def verify_token_not_blacklisted(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Verify that the token is not blacklisted"""
    token = credentials.credentials
    
    # Check if token is in blacklist
    if await TokenBlacklistService.is_blacklisted(db, token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Decode and validate token
    try:
        payload = decode_token(token)
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )