# app/api/v1/endpoints/attributes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.api import deps
from app.crud.attribute import attribute
from app.crud.attribute_group import attribute_group
from app.schemas.attribute import (
    AttributeCreate,
    AttributeUpdate,
    AttributeResponse
)
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[AttributeResponse])
async def list_attributes(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    group_id: Optional[uuid.UUID] = Query(None, description="Filter by group ID"),
    active_only: bool = Query(True, description="Only show active attributes"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
) -> List[AttributeResponse]:
    """
    List all attributes, optionally filtered by group
    """
    if group_id:
        attrs = await attribute.get_by_group(db, group_id=group_id, active_only=active_only)
    else:
        attrs = await attribute.get_active(db, skip=skip, limit=limit)
    return attrs


@router.post("/", response_model=AttributeResponse, status_code=status.HTTP_201_CREATED)
async def create_attribute(
    *,
    db: AsyncSession = Depends(deps.get_db),
    attr_in: AttributeCreate,
    current_user: User = Depends(deps.require_admin)
) -> AttributeResponse:
    """
    Create a new attribute (admin only)
    
    You can specify either:
    - group_id: UUID of the attribute group
    - group_code: Code of the attribute group (e.g., "LVL", "LANG")
    """
    group = None
    
    # Try group_id first
    if attr_in.group_id:
        group = await attribute_group.get(db, id=attr_in.group_id)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attribute group with ID '{attr_in.group_id}' not found"
            )
    
    # If no group_id, try group_code
    elif attr_in.group_code:
        group = await attribute_group.get_by_code(db, code=attr_in.group_code)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attribute group with code '{attr_in.group_code}' not found"
            )
    
    # Neither provided
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either group_id or group_code must be provided"
        )
    
    # Check for duplicate code within group
    existing = await attribute.get_by_code(db, group_id=group.id, code=attr_in.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Attribute with code '{attr_in.code}' already exists in group '{group.name}'"
        )
    
    # Convert to dict and remove group_code (it's not in the model)
    attr_data = attr_in.model_dump(exclude={'group_code'})
    attr_data['group_id'] = group.id
    

    
    # Create the attribute
    attr = await attribute.create(db, obj_in=attr_data, user=current_user)
    
    # Load group info for response
    result = await attribute.get_with_group(db, id=attr.id)
    return result

@router.get("/{attribute_id}", response_model=AttributeResponse)
async def get_attribute(
    attribute_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> AttributeResponse:
    """
    Get attribute by ID
    """
    attr = await attribute.get_with_group(db, id=attribute_id)
    if not attr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attribute not found"
        )
    return attr


@router.put("/{attribute_id}", response_model=AttributeResponse)
async def update_attribute(
    *,
    db: AsyncSession = Depends(deps.get_db),
    attribute_id: uuid.UUID,
    attr_in: AttributeUpdate,
    current_user: User = Depends(deps.require_admin)
) -> AttributeResponse:
    """
    Update attribute (admin only)
    """
    attr = await attribute.get(db, id=attribute_id)
    if not attr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attribute not found"
        )
    
    attr = await attribute.update(db, db_obj=attr, obj_in=attr_in)
    
    # Load group info for response
    result = await attribute.get_with_group(db, id=attr.id)
    return result


@router.delete("/{attribute_id}")
async def delete_attribute(
    *,
    db: AsyncSession = Depends(deps.get_db),
    attribute_id: uuid.UUID,
    current_user: User = Depends(deps.require_admin)
) -> dict:
    """
    Delete attribute (admin only)
    """
    attr = await attribute.get(db, id=attribute_id)
    if not attr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attribute not found"
        )
    
    await attribute.remove(db, id=attribute_id)
    return {"message": "Attribute deleted successfully"}