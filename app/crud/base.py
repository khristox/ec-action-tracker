"""
Base CRUD operations with comprehensive features
"""
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union, Protocol, Callable
import uuid
from datetime import datetime
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_, or_, inspect
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
import logging

from app.models.user import User

# Setup logger
logger = logging.getLogger(__name__)

# Define a protocol that matches SQLAlchemy models
class SQLAlchemyModel(Protocol):
    """Protocol for SQLAlchemy models."""
    __tablename__: str
    metadata: Any
    id: Any

# Type variables
ModelType = TypeVar("ModelType", bound=SQLAlchemyModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class AuditContext:
    """Audit logging context for tracking changes"""
    
    def __init__(self, log_function: Optional[Callable] = None):
        self.log_function = log_function
        self.entries = []
    
    async def log(self, action: str, table_name: str, record_id: str, 
                  old_values: Optional[Dict] = None, new_values: Optional[Dict] = None):
        """Log an audit entry"""
        entry = {
            "action": action,
            "table_name": table_name,
            "record_id": record_id,
            "old_values": old_values,
            "new_values": new_values,
            "timestamp": datetime.utcnow()
        }
        self.entries.append(entry)
        
        if self.log_function:
            await self.log_function(entry)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Enhanced Base class for CRUD operations with common database operations.
    
    Provides standard CRUD methods that can be inherited and extended
    by specific model CRUD classes. Includes:
    - Automatic audit field management
    - Soft delete support
    - Bulk operations
    - Advanced filtering
    - Upsert functionality
    - Optimistic locking support
    """
    
    def __init__(
        self, 
        model: Type[ModelType],
        soft_delete_field: str = "is_active",
        use_audit_fields: bool = True
    ):
        """
        Initialize CRUD base with a SQLAlchemy model.
        
        Args:
            model: SQLAlchemy model class
            soft_delete_field: Field name for soft delete (default: is_active)
            use_audit_fields: Whether to automatically handle created_by/updated_by fields
        """
        self.model = model
        self.soft_delete_field = soft_delete_field
        self.use_audit_fields = use_audit_fields
        
        # Detect available audit fields
        self.has_created_by = hasattr(model, 'created_by_id') or hasattr(model, 'created_by')
        self.has_updated_by = hasattr(model, 'updated_by_id') or hasattr(model, 'updated_by')
        self.has_deleted_at = hasattr(model, 'deleted_at')
        self.has_version = hasattr(model, 'version')
        
        logger.debug(f"Initialized CRUD for model: {model.__name__}")
    
    # ==================== HELPER METHODS ====================
    
    def _get_id_column(self):
        """Get the ID column of the model"""
        return getattr(self.model, 'id')
    
    def _get_audit_fields(self, user_id: Optional[uuid.UUID] = None, 
                         for_update: bool = False) -> Dict[str, Any]:
        """Get audit fields dictionary for create/update operations"""
        audit_fields = {}
        
        if self.use_audit_fields:
            if for_update and self.has_updated_by:
                if hasattr(self.model, 'updated_by_id'):
                    audit_fields['updated_by_id'] = user_id
                elif hasattr(self.model, 'updated_by'):
                    audit_fields['updated_by'] = user_id
            elif not for_update:
                if self.has_created_by:
                    if hasattr(self.model, 'created_by_id'):
                        audit_fields['created_by_id'] = user_id
                    elif hasattr(self.model, 'created_by'):
                        audit_fields['created_by'] = user_id
                if self.has_updated_by:
                    if hasattr(self.model, 'updated_by_id'):
                        audit_fields['updated_by_id'] = user_id
                    elif hasattr(self.model, 'updated_by'):
                        audit_fields['updated_by'] = user_id
        
        return audit_fields
    
    def _prepare_data(
        self, 
        obj_in: Union[CreateSchemaType, UpdateSchemaType, Dict[str, Any]],
        user_id: Optional[uuid.UUID] = None,
        for_update: bool = False
    ) -> Dict[str, Any]:
        """Prepare data from input object"""
        if isinstance(obj_in, dict):
            data = obj_in.copy()
        else:
            data = obj_in.model_dump(exclude_unset=for_update)
        
        # Add audit fields
        audit_fields = self._get_audit_fields(user_id, for_update)
        data.update(audit_fields)
        
        return data
    
    def _apply_filters(self, query, filters: Optional[Dict[str, Any]] = None):
        """Apply filters to query"""
        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    column = getattr(self.model, field)
                    if isinstance(value, (list, tuple)):
                        query = query.where(column.in_(value))
                    elif value is None:
                        query = query.where(column.is_(None))
                    else:
                        query = query.where(column == value)
        return query
    
    def _apply_exclude_deleted(self, query, include_deleted: bool = False):
        """Exclude soft-deleted records if needed"""
        if not include_deleted and hasattr(self.model, self.soft_delete_field):
            query = query.where(getattr(self.model, self.soft_delete_field) == True)
        return query
    
    def _apply_sorting(self, query, sort_by: Optional[str] = None, sort_desc: bool = False):
        """Apply sorting to query"""
        if sort_by and hasattr(self.model, sort_by):
            sort_column = getattr(self.model, sort_by)
            if sort_desc:
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
        return query
    
    # ==================== READ OPERATIONS ====================
    
    async def get(
        self, 
        db: AsyncSession, 
        id: uuid.UUID,
        include_deleted: bool = False
    ) -> Optional[ModelType]:
        """
        Get a single record by ID.
        
        Args:
            db: Database session
            id: Record UUID
            include_deleted: Whether to include soft-deleted records
            
        Returns:
            Model instance or None if not found
        """
        try:
            query = select(self.model).where(self._get_id_column() == id)
            query = self._apply_exclude_deleted(query, include_deleted)
            
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error getting {self.model.__name__} by id {id}: {e}")
            raise
    
    async def get_by_ids(
        self, 
        db: AsyncSession, 
        ids: List[uuid.UUID],
        include_deleted: bool = False
    ) -> List[ModelType]:
        """
        Get multiple records by their IDs.
        
        Args:
            db: Database session
            ids: List of record UUIDs
            include_deleted: Whether to include soft-deleted records
            
        Returns:
            List of model instances
        """
        try:
            query = select(self.model).where(self._get_id_column().in_(ids))
            query = self._apply_exclude_deleted(query, include_deleted)
            
            result = await db.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error getting {self.model.__name__} by ids: {e}")
            raise
    
    async def get_multi(
        self, 
        db: AsyncSession, 
        *, 
        skip: int = 0, 
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: Optional[str] = None,
        sort_desc: bool = False,
        include_deleted: bool = False
    ) -> List[ModelType]:
        """
        Get multiple records with pagination, filtering, and sorting.
        
        Args:
            db: Database session
            skip: Number of records to skip (offset)
            limit: Maximum number of records to return
            filters: Dictionary of field-value pairs to filter by
            sort_by: Field name to sort by
            sort_desc: Sort in descending order if True
            include_deleted: Whether to include soft-deleted records
            
        Returns:
            List of model instances
        """
        try:
            query = select(self.model)
            query = self._apply_filters(query, filters)
            query = self._apply_exclude_deleted(query, include_deleted)
            query = self._apply_sorting(query, sort_by, sort_desc)
            query = query.offset(skip).limit(limit)
            
            result = await db.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error getting multi {self.model.__name__}: {e}")
            raise
    
    
    async def count(
        self, 
        db: AsyncSession, 
        filters: Optional[Dict[str, Any]] = None,
        include_deleted: bool = False
    ) -> int:
        """
        Count records with optional filters.
        
        Args:
            db: Database session
            filters: Dictionary of field-value pairs to filter by
            include_deleted: Whether to include soft-deleted records
            
        Returns:
            Number of records
        """
        try:
            query = select(func.count()).select_from(self.model)
            query = self._apply_filters(query, filters)
            query = self._apply_exclude_deleted(query, include_deleted)
            
            result = await db.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting {self.model.__name__}: {e}")
            raise
    
    async def exists(self, db: AsyncSession, id: uuid.UUID) -> bool:
        """
        Check if a record exists by ID.
        
        Args:
            db: Database session
            id: Record UUID
            
        Returns:
            True if record exists, False otherwise
        """
        try:
            result = await db.execute(
                select(func.count())
                .select_from(self.model)
                .where(self._get_id_column() == id)
            )
            return result.scalar() > 0
        except SQLAlchemyError as e:
            logger.error(f"Error checking existence of {self.model.__name__} {id}: {e}")
            raise
    
    # ==================== CREATE OPERATIONS ====================
    
    async def create(
        self, 
        db: AsyncSession, 
        *, 
        obj_in: Union[CreateSchemaType, Dict[str, Any]],
        user: Optional[User] = None
    ) -> ModelType:
        """
        Create a new record with automatic audit field population.
        
        Args:
            db: Database session
            obj_in: Pydantic schema or dict with creation data
            user: Current user for audit tracking
            
        Returns:
            Created model instance
        """
        try:
            # Prepare data
            user_id = user.id if user else None
            data = self._prepare_data(obj_in, user_id, for_update=False)
            
            # Create instance
            db_obj = self.model(**data)
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            
            logger.info(f"Created {self.model.__name__} with id: {db_obj.id}")
            return db_obj
            
        except IntegrityError as e:
            await db.rollback()
            logger.error(f"Integrity error creating {self.model.__name__}: {e}")
            raise
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error creating {self.model.__name__}: {e}")
            raise
    
    async def create_multi(
        self,
        db: AsyncSession,
        *,
        objs_in: List[CreateSchemaType],
        user: Optional[User] = None
    ) -> List[ModelType]:
        """
        Create multiple records in bulk.
        
        Args:
            db: Database session
            objs_in: List of Pydantic schemas with creation data
            user: Current user for audit tracking
            
        Returns:
            List of created model instances
        """
        try:
            user_id = user.id if user else None
            db_objs = []
            
            for obj_in in objs_in:
                data = self._prepare_data(obj_in, user_id, for_update=False)
                db_obj = self.model(**data)
                db.add(db_obj)
                db_objs.append(db_obj)
            
            await db.commit()
            
            # Refresh all objects
            for db_obj in db_objs:
                await db.refresh(db_obj)
            
            logger.info(f"Created {len(db_objs)} {self.model.__name__} records")
            return db_objs
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error bulk creating {self.model.__name__}: {e}")
            raise
    
    # ==================== UPDATE OPERATIONS ====================
    
    async def update(
        self, 
        db: AsyncSession, 
        *, 
        db_obj: Optional[ModelType] = None,
        id: Optional[uuid.UUID] = None,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]],
        user: Optional[User] = None,
        version_check: bool = True
    ) -> Optional[ModelType]:
        """
        Update an existing record with optimistic locking support.
        
        Args:
            db: Database session
            db_obj: Existing model instance (optional)
            id: ID of record to update (used if db_obj not provided)
            obj_in: Pydantic schema or dict with update data
            user: Current user for audit tracking
            version_check: Whether to check version for optimistic locking
            
        Returns:
            Updated model instance or None if not found
        """
        try:
            # Get the object if only id provided
            if db_obj is None and id is not None:
                db_obj = await self.get(db, id)
            
            if db_obj is None:
                logger.warning(f"{self.model.__name__} not found for update")
                return None
            
            # Store old version for optimistic locking
            old_version = getattr(db_obj, 'version', None) if version_check else None
            
            # Prepare update data
            user_id = user.id if user else None
            update_data = self._prepare_data(obj_in, user_id, for_update=True)
            
            # Capture old values for audit
            old_values = {}
            for field in update_data.keys():
                if hasattr(db_obj, field):
                    old_values[field] = getattr(db_obj, field)
            
            # Update object attributes
            for field, value in update_data.items():
                if hasattr(db_obj, field):
                    setattr(db_obj, field, value)
            
            # Increment version if available
            if self.has_version:
                setattr(db_obj, 'version', (old_version or 0) + 1)
            
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            
            logger.info(f"Updated {self.model.__name__} with id: {db_obj.id}")
            return db_obj
            
        except IntegrityError as e:
            await db.rollback()
            logger.error(f"Integrity error updating {self.model.__name__}: {e}")
            raise
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error updating {self.model.__name__}: {e}")
            raise
    
    async def update_multi(
        self,
        db: AsyncSession,
        *,
        ids: List[uuid.UUID],
        obj_in: Union[UpdateSchemaType, Dict[str, Any]],
        user: Optional[User] = None
    ) -> int:
        """
        Update multiple records in bulk.
        
        Args:
            db: Database session
            ids: List of record IDs to update
            obj_in: Pydantic schema or dict with update data
            user: Current user for audit tracking
            
        Returns:
            Number of records updated
        """
        try:
            # Prepare update data
            user_id = user.id if user else None
            update_data = self._prepare_data(obj_in, user_id, for_update=True)
            
            if not update_data:
                return 0
            
            # Build update statement
            stmt = (
                update(self.model)
                .where(self._get_id_column().in_(ids))
                .values(**update_data)
                .execution_options(synchronize_session="fetch")
            )
            
            # Add version increment if available
            if self.has_version:
                stmt = stmt.values(version=self.model.version + 1)
            
            result = await db.execute(stmt)
            await db.commit()
            
            count = result.rowcount
            logger.info(f"Updated {count} {self.model.__name__} records")
            return count
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error bulk updating {self.model.__name__}: {e}")
            raise
    
    # ==================== DELETE OPERATIONS ====================
    
    async def remove(
        self, 
        db: AsyncSession, 
        *, 
        id: uuid.UUID,
        user: Optional[User] = None,
        soft_delete: bool = True
    ) -> Optional[ModelType]:
        """
        Delete a record by ID (hard or soft delete).
        
        Args:
            db: Database session
            id: Record UUID
            user: Current user for audit tracking
            soft_delete: If True, perform soft delete; otherwise hard delete
            
        Returns:
            Deleted/updated model instance or None if not found
        """
        try:
            obj = await self.get(db, id)
            if not obj:
                logger.warning(f"{self.model.__name__} with id {id} not found for deletion")
                return None
            
            if soft_delete and hasattr(obj, self.soft_delete_field):
                # Soft delete
                setattr(obj, self.soft_delete_field, False)
                if self.has_deleted_at:
                    setattr(obj, 'deleted_at', datetime.utcnow())
                
                # Add audit field for deletion
                if user and self.has_updated_by:
                    update_data = self._get_audit_fields(user.id, for_update=True)
                    for field, value in update_data.items():
                        if hasattr(obj, field):
                            setattr(obj, field, value)
                
                db.add(obj)
                await db.commit()
                await db.refresh(obj)
                
                logger.info(f"Soft deleted {self.model.__name__} with id: {id}")
                return obj
            else:
                # Hard delete
                await db.delete(obj)
                await db.commit()
                
                logger.info(f"Hard deleted {self.model.__name__} with id: {id}")
                return None
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error deleting {self.model.__name__} {id}: {e}")
            raise
    
    async def restore(self, db: AsyncSession, *, id: uuid.UUID) -> Optional[ModelType]:
        """
        Restore a soft-deleted record.
        
        Args:
            db: Database session
            id: Record UUID
            
        Returns:
            Restored model instance or None if not found
        """
        try:
            # Get record including deleted
            query = select(self.model).where(self._get_id_column() == id)
            query = self._apply_exclude_deleted(query, include_deleted=True)
            
            result = await db.execute(query)
            obj = result.scalar_one_or_none()
            
            if not obj:
                logger.warning(f"{self.model.__name__} with id {id} not found for restoration")
                return None
            
            # Restore
            if hasattr(obj, self.soft_delete_field):
                setattr(obj, self.soft_delete_field, True)
            if self.has_deleted_at:
                setattr(obj, 'deleted_at', None)
            
            db.add(obj)
            await db.commit()
            await db.refresh(obj)
            
            logger.info(f"Restored {self.model.__name__} with id: {id}")
            return obj
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error restoring {self.model.__name__} {id}: {e}")
            raise
    
    async def remove_multi(
        self,
        db: AsyncSession,
        *,
        ids: List[uuid.UUID],
        soft_delete: bool = True
    ) -> int:
        """
        Delete multiple records in bulk.
        
        Args:
            db: Database session
            ids: List of record IDs to delete
            soft_delete: If True, perform soft delete; otherwise hard delete
            
        Returns:
            Number of records deleted
        """
        try:
            if soft_delete and hasattr(self.model, self.soft_delete_field):
                # Bulk soft delete
                update_data = {self.soft_delete_field: False}
                if self.has_deleted_at:
                    update_data['deleted_at'] = datetime.utcnow()
                
                stmt = (
                    update(self.model)
                    .where(self._get_id_column().in_(ids))
                    .values(**update_data)
                    .execution_options(synchronize_session="fetch")
                )
                result = await db.execute(stmt)
                count = result.rowcount
            else:
                # Bulk hard delete
                stmt = delete(self.model).where(self._get_id_column().in_(ids))
                result = await db.execute(stmt)
                count = result.rowcount
            
            await db.commit()
            logger.info(f"Deleted {count} {self.model.__name__} records")
            return count
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error bulk deleting {self.model.__name__}: {e}")
            raise
    
    # ==================== UTILITY METHODS ====================
    
    async def get_or_create(
        self,
        db: AsyncSession,
        *,
        defaults: Optional[Dict[str, Any]] = None,
        user: Optional[User] = None,
        **kwargs
    ) -> tuple[ModelType, bool]:
        """
        Get an existing record or create a new one.
        
        Args:
            db: Database session
            defaults: Default values for creation
            user: Current user for audit tracking
            **kwargs: Lookup parameters
            
        Returns:
            Tuple of (instance, created_flag)
        """
        try:
            # Build query from kwargs
            query = select(self.model)
            for key, value in kwargs.items():
                if hasattr(self.model, key):
                    query = query.where(getattr(self.model, key) == value)
            
            result = await db.execute(query)
            instance = result.scalar_one_or_none()
            
            if instance:
                return instance, False
            
            # Create new instance
            create_data = {**kwargs, **(defaults or {})}
            instance = await self.create(db, obj_in=create_data, user=user)
            
            return instance, True
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error in get_or_create {self.model.__name__}: {e}")
            raise
    
    async def upsert(
        self,
        db: AsyncSession,
        *,
        obj_in: CreateSchemaType,
        lookup_fields: List[str],
        user: Optional[User] = None
    ) -> ModelType:
        """
        Update existing record or create new one based on lookup fields.
        
        Args:
            db: Database session
            obj_in: Pydantic schema with data
            lookup_fields: Fields to use for looking up existing record
            user: Current user for audit tracking
            
        Returns:
            Created or updated model instance
        """
        try:
            obj_data = obj_in.model_dump()
            
            # Build lookup query
            query = select(self.model)
            for field in lookup_fields:
                if field in obj_data and hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == obj_data[field])
            
            result = await db.execute(query)
            existing = result.scalar_one_or_none()
            
            if existing:
                # Update existing
                return await self.update(
                    db,
                    db_obj=existing,
                    obj_in=obj_in,
                    user=user
                )
            else:
                # Create new
                return await self.create(
                    db,
                    obj_in=obj_in,
                    user=user
                )
                
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error in upsert {self.model.__name__}: {e}")
            raise