# app/api/v1/endpoints/attribute_groups/delete.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict
import uuid
import logging

from app.api import deps
from app.crud.attribute_group import attribute_group
from app.crud.attribute import attribute
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


@router.delete("/{group_id}", response_model=Dict[str, str])
async def delete_attribute_group(
    *,
    db: AsyncSession = Depends(deps.get_db),
    group_id: uuid.UUID,
    current_user: User = Depends(deps.require_admin)
) -> Dict[str, str]:
    """
    Delete attribute group (admin only)
    """
    group = await attribute_group.get(db, id=group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attribute group not found"
        )
    
    attrs = await attribute.get_by_group(db, group_id=group_id, active_only=False)
    if attrs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete group with {len(attrs)} attributes. Delete attributes first."
        )
    
    await attribute_group.remove(db, id=group_id)
    logger.info(f"Attribute group '{group.code}' deleted by user {current_user.username}")
    
    return {"message": f"Attribute group '{group.code}' deleted successfully"}


@router.delete("/{group_id}/attributes/{attribute_id}", response_model=Dict[str, str])
async def delete_attribute_from_group(
    *,
    db: AsyncSession = Depends(deps.get_db),
    group_id: uuid.UUID,
    attribute_id: uuid.UUID,
    current_user: User = Depends(deps.require_admin)
) -> Dict[str, str]:
    """
    Delete an attribute from a specific group (admin only)
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
    
    await attribute.remove(db, id=attribute_id)
    logger.info(f"Attribute '{attr.code}' deleted from group '{group.code}' by user {current_user.username}")
    
    return {"message": f"Attribute '{attr.code}' deleted successfully"}