# app/crud/attribute.py (simplified)
from typing import Dict, Optional, List, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.crud.base import CRUDBase
from app.models.general.dynamic_attribute import Attribute, AttributeGroup
from app.models.user import User
from app.schemas.attribute import AttributeCreate, AttributeUpdate
import uuid
import logging

logger = logging.getLogger(__name__)


class CRUDAttribute(CRUDBase[Attribute, AttributeCreate, AttributeUpdate]):
    
    async def get_by_code(self, db: AsyncSession, *, group_id: uuid.UUID, code: str) -> Optional[Attribute]:
        """Get attribute by group_id and code"""
        result = await db.execute(
            select(Attribute)
            .where(
                and_(
                    Attribute.group_id == group_id,
                    Attribute.code == code
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def get_by_group(self, db: AsyncSession, *, group_id: uuid.UUID, active_only: bool = True) -> List[Attribute]:
        """Get all attributes for a group"""
        query = select(Attribute).where(Attribute.group_id == group_id)
        if active_only:
            query = query.where(Attribute.is_active == True)
        query = query.order_by(Attribute.sort_order)
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_active(self, db: AsyncSession, *, skip: int = 0, limit: int = 100) -> List[Attribute]:
        """Get all active attributes"""
        result = await db.execute(
            select(Attribute)
            .where(Attribute.is_active == True)
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
    
    async def get_with_group(self, db: AsyncSession, *, id: uuid.UUID) -> Optional[Attribute]:
        """Get attribute with its group"""
        result = await db.execute(
            select(Attribute)
            .options(selectinload(Attribute.group))
            .where(Attribute.id == id)
        )
        return result.scalar_one_or_none()


attribute = CRUDAttribute(Attribute)