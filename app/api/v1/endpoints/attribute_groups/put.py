# app/api/v1/endpoints/attribute_groups/put.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import logging

from app.api import deps
from app.crud.attribute_group import attribute_group
from app.crud.attribute import attribute
from app.schemas.attribute_group import (
    AttributeGroupUpdate,
    AttributeGroupResponse
)
from app.schemas.attribute import AttributeResponse, AttributeUpdate
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


@router.put("/{group_id}", response_model=AttributeGroupResponse)
async def update_attribute_group(
    *,
    db: AsyncSession = Depends(deps.get_db),
    group_id: uuid.UUID,
    group_in: AttributeGroupUpdate,
    current_user: User = Depends(deps.require_admin)
) -> AttributeGroupResponse:
    """
    Update attribute group (admin only)
    """
    group = await attribute_group.get(db, id=group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attribute group not found"
        )
    
    if group_in.code and group_in.code != group.code:
        existing = await attribute_group.get_by_code(db, code=group_in.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Attribute group with code '{group_in.code}' already exists"
            )
    
    group = await attribute_group.update(db, db_obj=group, obj_in=group_in, user=current_user)
    return group


@router.put("/{group_id}/attributes/{attribute_id}", response_model=AttributeResponse)
async def update_attribute_in_group(
    *,
    db: AsyncSession = Depends(deps.get_db),
    group_id: uuid.UUID,
    attribute_id: uuid.UUID,
    attr_in: AttributeUpdate,
    current_user: User = Depends(deps.require_admin)
) -> AttributeResponse:
    """
    Update an attribute in a specific group (admin only)
    """
    group = await attribute_group.get(db, id=group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attribute group not found"
        )
    
    attr = await attribute.get(db, id=attribute_id)
    if not attr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attribute not found"
        )
    
    if attr.group_id != group_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attribute does not belong to this group"
        )
    
    if attr_in.code and attr_in.code != attr.code:
        existing = await attribute.get_by_code(db, group_id=group_id, code=attr_in.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Attribute with code '{attr_in.code}' already exists in group '{group.name}'"
            )
    
    attr = await attribute.update(db, db_obj=attr, obj_in=attr_in, user=current_user)
    
    result = await attribute.get_with_group(db, id=attr.id)
    return result