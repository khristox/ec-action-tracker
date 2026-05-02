# app/services/token_blacklist_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timedelta
from app.models.token_blacklist import TokenBlacklist
from app.core.config import settings

class TokenBlacklistService:
    
    @staticmethod
    async def add_to_blacklist(db: AsyncSession, token: str, user_id: str, expires_in: int = None):
        """Add a token to the blacklist"""
        # Calculate expiration time (default 24 hours)
        if expires_in:
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        else:
            expires_at = datetime.utcnow() + timedelta(hours=24)
        
        blacklisted_token = TokenBlacklist(
            token=token,
            user_id=user_id,
            expires_at=expires_at
        )
        db.add(blacklisted_token)
        await db.commit()
        
    @staticmethod
    async def is_blacklisted(db: AsyncSession, token: str) -> bool:
        """Check if a token is blacklisted"""
        # Clean up expired tokens first
        await TokenBlacklistService.cleanup_expired(db)
        
        # Check if token is blacklisted
        stmt = select(TokenBlacklist).where(TokenBlacklist.token == token)
        result = await db.execute(stmt)
        blacklisted = result.scalar_one_or_none()
        
        return blacklisted is not None
    
    @staticmethod
    async def cleanup_expired(db: AsyncSession):
        """Remove expired tokens from blacklist"""
        stmt = delete(TokenBlacklist).where(TokenBlacklist.expires_at < datetime.utcnow())
        await db.execute(stmt)
        await db.commit()
    
    @staticmethod
    async def get_user_blacklisted_tokens(db: AsyncSession, user_id: str):
        """Get all blacklisted tokens for a user"""
        stmt = select(TokenBlacklist).where(TokenBlacklist.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalars().all()