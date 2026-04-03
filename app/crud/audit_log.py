# app/crud/audit_crud.py
from typing import Optional, Dict, Any, List, TypeVar, Generic, Type
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, inspect
from app.services.audit_service import AuditService
from app.models.user import User
from app.crud.base import CRUDBase
import uuid
import logging

logger = logging.getLogger(__name__)

ModelType = TypeVar("ModelType")

class AuditableCRUD(CRUDBase[ModelType, Any, Any]):
    """
    Extended CRUD that automatically logs changes to the audit log.
    """
    
    def __init__(self, model: Type[ModelType], model_name: str):
        super().__init__(model)
        self.model_name = model_name
    
    async def create_with_audit(
        self,
        db: AsyncSession,
        *,
        obj_in: Any,
        user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        request_id: Optional[str] = None,
        **kwargs
    ) -> ModelType:
        """Create with automatic audit logging"""
        # Create the object
        obj = await super().create(db, obj_in=obj_in, **kwargs)
        
        # Log the creation
        audit_service = AuditService(db)
        await audit_service.log_create(
            table_name=self.model_name,
            user=user,
            record_id=obj.id,
            new_values=self._get_model_values(obj),
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_id=request_id
        )
        
        return obj
    
    async def update_with_audit(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: Any,
        user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        request_id: Optional[str] = None,
        **kwargs
    ) -> ModelType:
        """Update with automatic audit logging"""
        # Get old values before update
        old_values = self._get_model_values(db_obj)
        
        # Update the object
        updated_obj = await super().update(db, db_obj=db_obj, obj_in=obj_in, **kwargs)
        
        # Log the update
        audit_service = AuditService(db)
        await audit_service.log_update(
            table_name=self.model_name,
            user=user,
            record_id=updated_obj.id,
            old_values=old_values,
            new_values=self._get_model_values(updated_obj),
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_id=request_id
        )
        
        return updated_obj
    
    async def remove_with_audit(
        self,
        db: AsyncSession,
        *,
        id: uuid.UUID,
        user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        request_id: Optional[str] = None,
        **kwargs
    ) -> Optional[ModelType]:
        """Delete with automatic audit logging"""
        # Get the object before deletion
        obj = await self.get(db, id=id)
        if not obj:
            return None
        
        old_values = self._get_model_values(obj)
        
        # Delete the object
        deleted_obj = await super().remove(db, id=id, **kwargs)
        
        # Log the deletion
        audit_service = AuditService(db)
        await audit_service.log_delete(
            table_name=self.model_name,
            user=user,
            record_id=id,
            old_values=old_values,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_id=request_id
        )
        
        return deleted_obj
    
    def _get_model_values(self, obj: ModelType) -> Dict[str, Any]:
        """Extract values from model instance"""
        values = {}
        for column in inspect(obj).mapper.column_attrs:
            value = getattr(obj, column.key)
            # Convert UUID and datetime to strings for JSON
            if isinstance(value, uuid.UUID):
                value = str(value)
            elif hasattr(value, 'isoformat'):
                value = value.isoformat()
            values[column.key] = value
        return values