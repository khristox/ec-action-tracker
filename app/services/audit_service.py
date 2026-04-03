# app/services/audit_service.py
import json
from typing import Optional, Dict, Any, List, Union
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.models.audit import AuditLog
from app.models.user import User
import logging
import uuid

logger = logging.getLogger(__name__)


class AuditService:
    """Service for creating audit logs"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def log(
        self,
        action: str,
        table_name: str,
        user: Optional[User] = None,
        record_id: Optional[Union[str, uuid.UUID]] = None,
        old_values: Optional[Dict] = None,
        new_values: Optional[Dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        request_id: Optional[str] = None,
        changes_summary: Optional[str] = None
    ) -> Optional[AuditLog]:
        """Create an audit log entry"""
        try:
            # Create audit entry
            audit_entry = AuditLog(
                action=action.upper(),
                table_name=table_name,
                record_id=str(record_id) if record_id else None,
                old_values=self._sanitize_values(old_values),
                new_values=self._sanitize_values(new_values),
                ip_address=ip_address,
                user_agent=user_agent,
                endpoint=endpoint,
                request_id=request_id,
                changes_summary=changes_summary
            )
            
            # Add user info if provided
            if user:
                audit_entry.user_id = user.id
                audit_entry.username = user.username
            
            self.db.add(audit_entry)
            await self.db.commit()
            
            logger.debug(f"Audit log created: {action} on {table_name}")
            return audit_entry
            
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
            await self.db.rollback()
            return None
    
    def _sanitize_values(self, values: Optional[Dict]) -> Optional[Dict]:
        """Remove sensitive data from logs"""
        if not values:
            return None
        
        sensitive = ['password', 'hashed_password', 'token', 'secret', 'reset_token']
        sanitized = values.copy()
        
        for field in sensitive:
            if field in sanitized:
                sanitized[field] = '***REDACTED***'
        
        return sanitized
    
    # ========== Convenience Methods for Database Changes ==========
    
    async def log_create(
        self,
        table_name: str,
        user: Optional[User],
        record_id: Any,
        new_values: Dict,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Optional[AuditLog]:
        """Log a CREATE operation"""
        return await self.log(
            action='CREATE',
            table_name=table_name,
            user=user,
            record_id=record_id,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_id=request_id,
            changes_summary=f"Created new {table_name}"
        )
    
    async def log_update(
        self,
        table_name: str,
        user: Optional[User],
        record_id: Any,
        old_values: Dict,
        new_values: Dict,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Optional[AuditLog]:
        """Log an UPDATE operation"""
        # Find what changed
        changed = []
        for key in old_values:
            if key in new_values and old_values[key] != new_values[key]:
                changed.append(key)
        
        summary = f"Updated {table_name} - changed: {', '.join(changed)}" if changed else f"Updated {table_name}"
        
        return await self.log(
            action='UPDATE',
            table_name=table_name,
            user=user,
            record_id=record_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_id=request_id,
            changes_summary=summary
        )
    
    async def log_delete(
        self,
        table_name: str,
        user: Optional[User],
        record_id: Any,
        old_values: Dict,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Optional[AuditLog]:
        """Log a DELETE operation"""
        return await self.log(
            action='DELETE',
            table_name=table_name,
            user=user,
            record_id=record_id,
            old_values=old_values,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_id=request_id,
            changes_summary=f"Deleted {table_name} record"
        )
    
    # ========== Authentication Logs ==========
    
    async def log_login(
        self,
        username: str,
        success: bool,
        user_id: Optional[uuid.UUID] = None,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None,
        error_message: str = None
    ) -> Optional[AuditLog]:
        """Log a login attempt"""
        action = 'LOGIN_SUCCESS' if success else 'LOGIN_FAILED'
        
        # Create a temporary user-like object for the log
        class TempUser:
            def __init__(self, uid, uname):
                self.id = uid
                self.username = uname
        
        temp_user = TempUser(user_id, username) if user_id else None
        
        return await self.log(
            action=action,
            table_name='auth',
            user=temp_user,
            record_id=user_id,
            new_values={'username': username, 'success': success, 'error': error_message} if not success else None,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_id=request_id,
            changes_summary=f"Login {action} for {username}"
        )
    
    async def log_logout(
        self,
        user: User,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Optional[AuditLog]:
        """Log a logout"""
        return await self.log(
            action='LOGOUT',
            table_name='auth',
            user=user,
            record_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_id=request_id,
            changes_summary=f"User {user.username} logged out"
        )
    
    # ========== Role Management Logs ==========
    
    async def log_role_change(
        self,
        actor: User,
        target_user: User,
        old_roles: List[str],
        new_roles: List[str],
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None
    ) -> Optional[AuditLog]:
        """Log role assignment/removal"""
        added = set(new_roles) - set(old_roles)
        removed = set(old_roles) - set(new_roles)
        
        summary_parts = []
        if added:
            summary_parts.append(f"Added roles: {', '.join(added)}")
        if removed:
            summary_parts.append(f"Removed roles: {', '.join(removed)}")
        
        summary = f"Role changes for {target_user.username}: {'; '.join(summary_parts)}"
        
        return await self.log(
            action='ROLE_CHANGE',
            table_name='users',
            user=actor,
            record_id=target_user.id,
            old_values={'roles': old_roles},
            new_values={'roles': new_roles},
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_id=request_id,
            changes_summary=summary
        )
    
    # ========== Query Methods ==========
    
    async def get_logs(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        table_name: Optional[str] = None,
        record_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditLog]:
        """Retrieve audit logs with filters"""
        query = select(AuditLog).order_by(desc(AuditLog.timestamp))
        
        if user_id:
            query = query.where(AuditLog.user_id == user_id)
        if action:
            query = query.where(AuditLog.action == action)
        if table_name:
            query = query.where(AuditLog.table_name == table_name)
        if record_id:
            query = query.where(AuditLog.record_id == record_id)
        if start_date:
            query = query.where(AuditLog.timestamp >= start_date)
        if end_date:
            query = query.where(AuditLog.timestamp <= end_date)
        
        query = query.offset(offset).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_record_history(
        self,
        table_name: str,
        record_id: str,
        limit: int = 50
    ) -> List[AuditLog]:
        """Get all changes for a specific record"""
        return await self.get_logs(
            table_name=table_name,
            record_id=record_id,
            limit=limit
        )
    
    async def get_user_activity(
        self,
        user_id: str,
        days: int = 7,
        limit: int = 50
    ) -> List[AuditLog]:
        """Get recent activity for a specific user"""
        start_date = datetime.utcnow() - timedelta(days=days)
        return await self.get_logs(
            user_id=user_id,
            start_date=start_date,
            limit=limit
        )