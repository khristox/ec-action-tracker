# app/api/v1/endpoints/attribute_groups/post.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid
import logging

from app.api import deps
from app.crud.attribute_group import attribute_group
from app.crud.attribute import attribute
from app.schemas.attribute_group import (
    AttributeGroupCreate,
    AttributeGroupResponse
)
from app.schemas.attribute import AttributeResponse, AttributeCreate
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/", response_model=AttributeGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_attribute_group(
    *,
    db: AsyncSession = Depends(deps.get_db),
    group_in: AttributeGroupCreate,
    current_user: User = Depends(deps.require_admin)
) -> AttributeGroupResponse:
    """
    Create a new attribute group (admin only)
    """
    existing = await attribute_group.get_by_code(db, code=group_in.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Attribute group with code '{group_in.code}' already exists"
        )
    
    group = await attribute_group.create(db, obj_in=group_in, user=current_user)
    return group


@router.post("/{group_id}/attributes", response_model=AttributeResponse, status_code=status.HTTP_201_CREATED)
async def create_attribute_in_group(
    *,
    db: AsyncSession = Depends(deps.get_db),
    group_id: uuid.UUID,
    attr_in: AttributeCreate,
    current_user: User = Depends(deps.require_admin)
) -> AttributeResponse:
    """
    Create a new attribute in a specific group (admin only)
    """
    group = await attribute_group.get(db, id=group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attribute group not found"
        )
    
    existing = await attribute.get_by_code(db, group_id=group_id, code=attr_in.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Attribute with code '{attr_in.code}' already exists in group '{group.name}'"
        )
    
    attr_data = attr_in.model_dump()
    attr_data['group_id'] = group_id
    attr = await attribute.create(db, obj_in=attr_data, user=current_user)
    
    result = await attribute.get_with_group(db, id=attr.id)
    return result