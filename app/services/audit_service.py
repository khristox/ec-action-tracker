# app/services/audit_service.py
import json
from typing import Optional, Dict, Any, List, Union, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_, or_, delete
from app.models.audit import AuditLog, AuditStatus
from app.models.user import User
import logging
import uuid

logger = logging.getLogger(__name__)


class AuditService:
    """Service for creating and retrieving audit logs"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # ========== Helper Methods ==========
    
    def _to_uuid(self, value: Optional[Union[str, uuid.UUID]]) -> Optional[uuid.UUID]:
        """Convert string or UUID to UUID object safely"""
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        try:
            # Try to parse as UUID (supports both with and without hyphens)
            return uuid.UUID(str(value))
        except (ValueError, AttributeError):
            logger.warning(f"Invalid UUID format: {value}")
            return None
    
    def _to_string(self, value: Optional[Union[str, uuid.UUID]]) -> Optional[str]:
        """Convert UUID to string for display purposes"""
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return str(value)
        return str(value)
    
    def _sanitize_values(self, values: Optional[Dict]) -> Optional[Dict]:
        """Remove sensitive data from logs"""
        if not values:
            return None
        
        sensitive_fields = ['password', 'hashed_password', 'token', 'secret', 'reset_token', 
                           'api_key', 'private_key', 'refresh_token', 'access_token']
        sanitized = values.copy()
        
        for field in sensitive_fields:
            if field in sanitized:
                sanitized[field] = '***REDACTED***'
        
        return sanitized
    
    def _truncate_user_agent(self, user_agent: Optional[str], max_length: int = 500) -> Optional[str]:
        """Truncate user agent to avoid database issues"""
        if user_agent and len(user_agent) > max_length:
            return user_agent[:max_length] + "..."
        return user_agent
    
    def _get_changes_summary(self, old_values: Dict, new_values: Dict, max_changes: int = 5) -> str:
        """Generate a summary of changes between old and new values"""
        changed_fields = []
        
        for key in old_values:
            if key in new_values and old_values[key] != new_values[key]:
                old_val = old_values[key]
                new_val = new_values[key]
                
                # Truncate long values
                if isinstance(old_val, str) and len(old_val) > 50:
                    old_val = old_val[:47] + "..."
                if isinstance(new_val, str) and len(new_val) > 50:
                    new_val = new_val[:47] + "..."
                
                changed_fields.append(f"{key}: {old_val} → {new_val}")
        
        if changed_fields:
            summary = '; '.join(changed_fields[:max_changes])
            if len(changed_fields) > max_changes:
                summary += f" (+{len(changed_fields) - max_changes} more)"
            return summary
        return "No significant changes detected"
    
    # ========== Core Logging Methods ==========
    
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
        changes_summary: Optional[str] = None,
        status: str = "success",
        error_message: Optional[str] = None,
        extra_data: Optional[Dict] = None
    ) -> Optional[AuditLog]:
        """Create an audit log entry"""
        try:
            # Prepare extra data
            if extra_data is None:
                extra_data = {}
            extra_data["timestamp"] = datetime.utcnow().isoformat()
            
            # Convert record_id to UUID if needed
            record_uuid = self._to_uuid(record_id)
            
            # Create audit entry
            audit_entry = AuditLog(
                id=uuid.uuid4(),  # Generate UUID object
                action=action.upper(),
                table_name=table_name,
                record_id=record_uuid,  # Store as UUID object
                old_data=self._sanitize_values(old_values),
                new_data=self._sanitize_values(new_values),
                ip_address=ip_address,
                user_agent=self._truncate_user_agent(user_agent),
                endpoint=endpoint,
                request_id=request_id,
                changes_summary=changes_summary,
                status=status,
                error_message=error_message,
                extra_data=extra_data,
                timestamp=datetime.utcnow()
            )
            
            # Add user info if provided
            if user:
                audit_entry.user_id = user.id  # This should already be UUID
                audit_entry.username = user.username
                audit_entry.user_email = user.email
            
            self.db.add(audit_entry)
            await self.db.commit()
            await self.db.refresh(audit_entry)
            
            logger.debug(f"Audit log created: {action} on {table_name}")
            return audit_entry
            
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}", exc_info=True)
            await self.db.rollback()
            return None
    
    # ========== Convenience Methods ==========
    
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
        summary = f"Created new {table_name} record with ID: {record_id}"
        
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
            changes_summary=summary,
            status="success"
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
        summary = self._get_changes_summary(old_values, new_values)
        
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
            changes_summary=summary,
            status="success"
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
            changes_summary=f"Deleted {table_name} record with ID: {record_id}",
            status="success"
        )
    
    async def log_login(
        self,
        username: str,
        success: bool,
        user_id: Optional[Union[str, uuid.UUID]] = None,
        user_email: Optional[str] = None,
        user_obj: Optional[User] = None,
        ip_address: str = None,
        user_agent: str = None,
        endpoint: str = None,
        request_id: str = None,
        error_message: str = None
    ) -> Optional[AuditLog]:
        """Log a login attempt - FIXED VERSION"""
        try:
            final_user_id = None
            final_username = username
            final_user_email = user_email
            
            if user_obj:
                # CRITICAL: Use str() NOT .hex
                final_user_id = str(user_obj.id)  # This gives hyphens: "e1a1f01c-c6f4-4841-9136-1ec4dbcca149"
                final_username = user_obj.username
                final_user_email = user_obj.email
                
                # Debug log to verify
                logger.debug(f"Converting user_obj.id: {user_obj.id} -> {final_user_id} (length: {len(final_user_id)})")
                
            elif user_id:
                # Convert to proper UUID string with hyphens
                if isinstance(user_id, uuid.UUID):
                    final_user_id = str(user_id)
                else:
                    # If it's a string without hyphens, add them
                    clean_id = str(user_id).replace('-', '')
                    if len(clean_id) == 32:
                        final_user_id = f"{clean_id[:8]}-{clean_id[8:12]}-{clean_id[12:16]}-{clean_id[16:20]}-{clean_id[20:]}"
                    else:
                        final_user_id = str(user_id)
            
            # Create audit entry
            audit_entry = AuditLog(
                id=str(uuid.uuid4()),
                action='LOGIN',
                table_name='auth',
                record_id=final_user_id,
                username=final_username,
                user_email=final_user_email,
                user_id=final_user_id,  # Now this will be "e1a1f01c-c6f4-4841-9136-1ec4dbcca149"
                ip_address=ip_address,
                user_agent=self._truncate_user_agent(user_agent),
                endpoint=endpoint,
                request_id=request_id,
                changes_summary=f"Login attempt for {final_username}",
                status="success" if success else "failure",
                error_message=error_message if not success else None,
                extra_data={
                    "login_attempt": datetime.utcnow().isoformat(),
                    "success": success,
                    "username": final_username
                },
                timestamp=datetime.utcnow()
            )
            
            self.db.add(audit_entry)
            await self.db.commit()
            await self.db.refresh(audit_entry)
            
            logger.debug(f"Login log created for {final_username}")
            return audit_entry
            
        except Exception as e:
            logger.error(f"Failed to create login log: {e}", exc_info=True)
            await self.db.rollback()
            return None    
    # ========== Query Methods ==========
    
    async def get_logs(
        self,
        user_id: Optional[Union[str, uuid.UUID]] = None,
        action: Optional[str] = None,
        table_name: Optional[str] = None,
        record_id: Optional[Union[str, uuid.UUID]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditLog]:
        """Retrieve audit logs with filters"""
        query = select(AuditLog).order_by(desc(AuditLog.timestamp))
        
        if user_id:
            # Convert to UUID for proper comparison
            user_uuid = self._to_uuid(user_id)
            if user_uuid:
                query = query.where(AuditLog.user_id == user_uuid)
        
        if action:
            query = query.where(AuditLog.action == action.upper())
        
        if table_name:
            query = query.where(AuditLog.table_name == table_name)
        
        if record_id:
            record_uuid = self._to_uuid(record_id)
            if record_uuid:
                query = query.where(AuditLog.record_id == record_uuid)
        
        if start_date:
            query = query.where(AuditLog.timestamp >= start_date)
        
        if end_date:
            query = query.where(AuditLog.timestamp <= end_date)
        
        if status:
            query = query.where(AuditLog.status == status)
        
        query = query.offset(offset).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def count_logs(
        self,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None
    ) -> int:
        """Count total logs matching filters"""
        query = select(func.count()).select_from(AuditLog)
        
        if action:
            query = query.where(AuditLog.action == action.upper())
        if start_date:
            query = query.where(AuditLog.timestamp >= start_date)
        if end_date:
            query = query.where(AuditLog.timestamp <= end_date)
        if status:
            query = query.where(AuditLog.status == status)
        
        result = await self.db.execute(query)
        return result.scalar() or 0
    
    async def get_activity_summary(self, days: int = 7) -> Dict[str, Any]:
        """Get activity summary statistics"""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Use sequential queries for better compatibility
        total_result = await self.db.execute(
            select(func.count()).where(AuditLog.timestamp >= start_date)
        )
        total_events = total_result.scalar() or 0
        
        success_result = await self.db.execute(
            select(func.count()).where(
                and_(
                    AuditLog.timestamp >= start_date,
                    AuditLog.status == 'success'
                )
            )
        )
        successful = success_result.scalar() or 0
        
        failed_result = await self.db.execute(
            select(func.count()).where(
                and_(
                    AuditLog.timestamp >= start_date,
                    AuditLog.status == 'failure'
                )
            )
        )
        failed = failed_result.scalar() or 0
        
        # Count distinct users (convert UUID to string for counting)
        users_result = await self.db.execute(
            select(func.count(AuditLog.user_id.distinct())).where(
                AuditLog.timestamp >= start_date
            )
        )
        unique_users = users_result.scalar() or 0
        
        # Actions breakdown
        actions_result = await self.db.execute(
            select(AuditLog.action, func.count().label('count'))
            .where(AuditLog.timestamp >= start_date)
            .group_by(AuditLog.action)
            .order_by(func.count().desc())
        )
        actions_breakdown = {row[0]: row[1] for row in actions_result.all()}
        
        # Daily activity
        daily_result = await self.db.execute(
            select(func.date(AuditLog.timestamp).label('date'), func.count().label('count'))
            .where(AuditLog.timestamp >= start_date)
            .group_by(func.date(AuditLog.timestamp))
            .order_by(func.date(AuditLog.timestamp))
        )
        daily_activity = [
            {"date": str(row[0]), "count": row[1]} 
            for row in daily_result.all()
        ]
        
        # Top users by activity
        top_users_result = await self.db.execute(
            select(AuditLog.user_email, func.count().label('count'))
            .where(
                and_(
                    AuditLog.timestamp >= start_date,
                    AuditLog.user_email.isnot(None)
                )
            )
            .group_by(AuditLog.user_email)
            .order_by(func.count().desc())
            .limit(10)
        )
        top_users = [
            {"user": row[0] or 'Unknown', "activity_count": row[1]} 
            for row in top_users_result.all()
        ]
        
        success_rate = round((successful / total_events * 100) if total_events > 0 else 0, 2)
        
        return {
            "total_events": total_events,
            "total_actions": total_events,
            "successful": successful,
            "failed": failed,
            "success_rate": success_rate,
            "unique_users": unique_users,
            "actions_breakdown": actions_breakdown,
            "actions_by_type": actions_breakdown,
            "daily_activity": daily_activity,
            "top_users": top_users,
            "period_days": days,
            "start_date": start_date.isoformat(),
            "end_date": datetime.utcnow().isoformat(),
            "generated_at": datetime.utcnow().isoformat()
        }
    
    async def get_record_history(
        self,
        table_name: str,
        record_id: Union[str, uuid.UUID],
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
        user_id: Union[str, uuid.UUID],
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
    
    async def cleanup_old_logs(self, retention_days: int = 90, batch_size: int = 1000) -> int:
        """Delete logs older than retention_days in batches"""
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        total_deleted = 0
        
        try:
            while True:
                result = await self.db.execute(
                    delete(AuditLog)
                    .where(AuditLog.timestamp < cutoff_date)
                    .limit(batch_size)
                    .returning(AuditLog.id)
                )
                deleted_ids = result.scalars().all()
                
                if not deleted_ids:
                    break
                
                await self.db.commit()
                total_deleted += len(deleted_ids)
                logger.info(f"Deleted batch of {len(deleted_ids)} audit logs (total: {total_deleted})")
            
            logger.info(f"Cleaned up {total_deleted} audit logs older than {retention_days} days")
            return total_deleted
            
        except Exception as e:
            logger.error(f"Failed to cleanup old logs: {e}", exc_info=True)
            await self.db.rollback()
            return total_deleted
    
    async def get_logs_by_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
        limit: int = 1000
    ) -> List[AuditLog]:
        """Get logs within a date range"""
        return await self.get_logs(
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
    
    async def export_logs(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        format: str = "json",
        limit: int = 10000
    ) -> Union[List[Dict], str]:
        """Export logs to JSON or CSV format"""
        logs = await self.get_logs(
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
        
        export_data = []
        for log in logs:
            export_data.append({
                "id": str(log.id),
                "timestamp": log.timestamp.isoformat(),
                "username": log.username,
                "user_email": log.user_email,
                "action": log.action,
                "table_name": log.table_name,
                "record_id": str(log.record_id) if log.record_id else None,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "status": log.status,
                "error_message": log.error_message,
                "changes_summary": log.changes_summary,
                "endpoint": log.endpoint
            })
        
        if format == "json":
            return export_data
        elif format == "csv":
            import csv
            from io import StringIO
            
            output = StringIO()
            if export_data:
                writer = csv.DictWriter(output, fieldnames=export_data[0].keys())
                writer.writeheader()
                writer.writerows(export_data)
            return output.getvalue()
        else:
            return export_data