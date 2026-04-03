# app/crud/attribute_group.py
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from app.crud.base import CRUDBase
from app.models.general.dynamic_attribute import AttributeGroup, Attribute
from app.schemas.attribute_group import AttributeGroupCreate, AttributeGroupUpdate
import uuid
import logging

logger = logging.getLogger(__name__)


class CRUDAttributeGroup(CRUDBase[AttributeGroup, AttributeGroupCreate, AttributeGroupUpdate]):
    
    async def get_by_code(self, db: AsyncSession, *, code: str) -> Optional[AttributeGroup]:
        """Get attribute group by code"""
        result = await db.execute(
            select(AttributeGroup).where(AttributeGroup.code == code)
        )
        return result.scalar_one_or_none()
    
    async def get_with_attributes(self, db: AsyncSession, *, id: uuid.UUID) -> Optional[AttributeGroup]:
        """Get attribute group with its attributes"""
        result = await db.execute(
            select(AttributeGroup)
            .options(selectinload(AttributeGroup.attributes))
            .where(AttributeGroup.id == id)
        )
        return result.scalar_one_or_none()
    
    async def get_all_with_attributes(self, db: AsyncSession) -> List[AttributeGroup]:
        """Get all attribute groups with their attributes"""
        result = await db.execute(
            select(AttributeGroup)
            .options(selectinload(AttributeGroup.attributes))
            .order_by(AttributeGroup.display_order)
        )
        return result.scalars().all()
    
    async def get_required_groups(self, db: AsyncSession) -> List[AttributeGroup]:
        """Get all required attribute groups"""
        result = await db.execute(
            select(AttributeGroup)
            .where(AttributeGroup.is_required == True)
            .order_by(AttributeGroup.display_order)
        )
        return result.scalars().all()


attribute_group = CRUDAttributeGroup(AttributeGroup)