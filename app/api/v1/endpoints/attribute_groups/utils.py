# app/api/v1/endpoints/attribute_groups/utils.py
import base64
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.general.dynamic_attribute import AttributeGroup as AttributeGroupModel, Attribute as AttributeModel
from app.schemas.attribute_group import (
    AttributeGroupLimitedResponse,
    AttributeLimitedResponse
)

# Define public groups that don't require authentication
PUBLIC_GROUPS = ["GENDER", "COUNTRY"]


class CursorPaginator:
    """Handles cursor encoding/decoding for pagination"""
    
    def encode_cursor(self, data: dict) -> str:
        """Encode cursor data to a safe string"""
        # Convert the data to JSON and then to base64
        json_str = json.dumps(data, sort_keys=True)
        # Encode to base64 and make it URL-safe
        encoded = base64.urlsafe_b64encode(json_str.encode()).decode()
        return encoded
    
    def decode_cursor(self, cursor: str) -> dict:
        """Decode cursor string back to dictionary"""
        try:
            # Decode from base64
            decoded_bytes = base64.urlsafe_b64decode(cursor.encode())
            json_str = decoded_bytes.decode()
            return json.loads(json_str)
        except Exception as e:
            logger.warning(f"Failed to decode cursor: {e}")
            return {}

async def check_group_permissions(group, current_user: Optional[User] = None, db: AsyncSession = None) -> bool:
    """
    Check if the current user has permission to access the group.
    """
    if group is None:
        return False
    
    if group.extra_metadata and group.extra_metadata.get("public", False):
        return True
    
    if group.code in PUBLIC_GROUPS:
        return True
    
    if not current_user:
        return False
    
    if group.extra_metadata and "required_roles" in group.extra_metadata:
        required_roles = group.extra_metadata["required_roles"]
        if required_roles:
            user_roles = [role.name for role in current_user.roles]
            if not any(role in user_roles for role in required_roles):
                return False
    
    if group.extra_metadata and "required_permissions" in group.extra_metadata:
        required_perms = group.extra_metadata["required_permissions"]
        if required_perms and db:
            user_permissions = set()
            for role in current_user.roles:
                await db.refresh(role, attribute_names=["permissions"])
                for perm in role.permissions:
                    user_permissions.add(perm.name)
            
            if not any(perm in user_permissions for perm in required_perms):
                return False
    
    return True


def convert_to_limited_group(group, include_attributes: bool = False) -> AttributeGroupLimitedResponse:
    """Convert a full group object to limited response format"""
    
    limited_attributes = []
    if include_attributes and hasattr(group, 'attributes') and group.attributes:
        for attr in group.attributes:
            limited_attributes.append(
                AttributeLimitedResponse(
                    id=attr.id,
                    code=attr.code,
                    name=attr.name,
                    short_name=attr.short_name,
                    sort_order=attr.sort_order
                )
            )
    
    return AttributeGroupLimitedResponse(
        id=group.id,
        code=group.code,
        name=group.name,
        description=group.description,
        allow_multiple=group.allow_multiple,
        is_required=group.is_required,
        validation_rules=group.validation_rules,
        display_order=group.display_order,
        attributes=limited_attributes  # This will be empty when include_attributes=False
    )

async def search_attribute_groups(
    db: AsyncSession,
    search_term: Optional[str] = None,
    search_fields: Optional[List[str]] = None,
    filters: Optional[Dict[str, Any]] = None,
    cursor: Optional[str] = None,
    limit: int = 20
) -> tuple[List[AttributeGroupModel], Optional[str], int]:
    """
    Search attribute groups with continuous scroll
    """
    paginator = CursorPaginator()
    query = select(AttributeGroupModel)
    
    if search_term:
        search_fields = search_fields or ['code', 'name', 'description']
        search_conditions = []
        
        for field in search_fields:
            if hasattr(AttributeGroupModel, field):
                search_conditions.append(
                    getattr(AttributeGroupModel, field).ilike(f"%{search_term}%")
                )
        
        if search_conditions:
            query = query.where(or_(*search_conditions))
    
    if filters:
        for field, value in filters.items():
            if hasattr(AttributeGroupModel, field):
                query = query.where(getattr(AttributeGroupModel, field) == value)
    
    cursor_data = paginator.decode_cursor(cursor)
    query = paginator.apply_cursor_filter(query, cursor_data)
    query = query.order_by(AttributeGroupModel.created_at.desc(), AttributeGroupModel.id.desc())
    
    count_query = select(func.count()).select_from(AttributeGroupModel)
    if search_term and search_conditions:
        count_query = count_query.where(or_(*search_conditions))
    if filters:
        for field, value in filters.items():
            if hasattr(AttributeGroupModel, field):
                count_query = count_query.where(getattr(AttributeGroupModel, field) == value)
    
    total_result = await db.execute(count_query)
    total_count = total_result.scalar()
    
    query = query.limit(limit + 1)
    result = await db.execute(query)
    items = result.scalars().all()
    
    has_next = len(items) > limit
    next_cursor = None
    if has_next:
        items = items[:limit]
        next_cursor = paginator.get_next_cursor(items, limit)
    
    for item in items:
        await db.refresh(item, attribute_names=["attributes"])
    
    return items, next_cursor, total_count