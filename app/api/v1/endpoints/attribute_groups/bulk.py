# app/api/v1/endpoints/attribute_groups/bulk.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
import uuid
import logging

from app.api import deps
from app.crud.attribute_group import attribute_group
from app.crud.attribute import attribute
from app.schemas.attribute_group import AttributeGroupCreate
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/", response_model=Dict[str, Any])
async def bulk_create_attribute_groups(
    *,
    db: AsyncSession = Depends(deps.get_db),
    groups_in: List[AttributeGroupCreate],
    current_user: User = Depends(deps.require_admin)
) -> Dict[str, Any]:
    """
    Bulk create multiple attribute groups (admin only)
    """
    created = []
    failed = []
    
    for group_in in groups_in:
        try:
            existing = await attribute_group.get_by_code(db, code=group_in.code)
            if existing:
                failed.append({"code": group_in.code, "reason": "Already exists"})
                continue
            
            group = await attribute_group.create(db, obj_in=group_in, user=current_user)
            created.append({
                "id": str(group.id),  # Convert UUID to string for JSON
                "code": group.code,
                "name": group.name
            })
        except Exception as e:
            failed.append({"code": group_in.code, "reason": str(e)})
    
    return {
        "created": created,
        "created_count": len(created),
        "failed": failed,
        "failed_count": len(failed)
    }


@router.delete("/", response_model=Dict[str, Any])
async def bulk_delete_attribute_groups(
    *,
    db: AsyncSession = Depends(deps.get_db),
    group_ids: List[uuid.UUID],  # Use uuid.UUID type directly
    current_user: User = Depends(deps.require_admin)
) -> Dict[str, Any]:
    """
    Bulk delete multiple attribute groups (admin only)
    """
    deleted = []
    failed = []
    
    for group_id in group_ids:
        try:
            group = await attribute_group.get(db, id=group_id)
            if not group:
                failed.append({"id": str(group_id), "reason": "Not found"})
                continue
            
            # Check if group has attributes
            attrs = await attribute.get_by_group(db, group_id=group_id, active_only=False)
            if attrs:
                failed.append({"id": str(group_id), "code": group.code, "reason": f"Has {len(attrs)} attributes"})
                continue
            
            await attribute_group.remove(db, id=group_id)
            deleted.append({"id": str(group_id), "code": group.code})
        except Exception as e:
            failed.append({"id": str(group_id), "reason": str(e)})
    
    return {
        "deleted": deleted,
        "deleted_count": len(deleted),
        "failed": failed,
        "failed_count": len(failed)
    }