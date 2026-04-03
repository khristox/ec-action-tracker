from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from datetime import datetime

from app.models.general.dynamic_attribute import Attribute as AttributeModel
from app.crud.attribute_group import attribute_group
from app.api.v1.endpoints.attribute_groups.utils import (
    PUBLIC_GROUPS,
    CursorPaginator,
    check_group_permissions,
)

paginator = CursorPaginator()


async def get_group_attributes(
    db: AsyncSession,
    group_id,
    current_user,
    *,
    active_only: bool = True,
    detail_level: str = "limited",
    search: Optional[str] = None,
    search_fields: Optional[List[str]] = None,
    code: Optional[str] = None,
    min_sort_order: Optional[int] = None,
    max_sort_order: Optional[int] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    sort_by: str = "sort_order",
    sort_order: str = "asc",
    cursor: Optional[str] = None,
    limit: int = 20
) -> Dict[str, Any]:

    group = await attribute_group.get(db, id=group_id)
    if not group:
        raise ValueError("Attribute group not found")

    is_public_group = (
        group.code in PUBLIC_GROUPS or
        (group.extra_metadata and group.extra_metadata.get("public", False))
    )

    if not is_public_group and not current_user:
        raise PermissionError("Authentication required")

    if not is_public_group and not await check_group_permissions(group, current_user, db):
        raise PermissionError("Forbidden")

    # ✅ Default search fields
    if not search_fields:
        search_fields = ["code", "name", "short_name", "description"]

    query = select(AttributeModel).where(AttributeModel.group_id == group_id)

    if active_only:
        query = query.where(AttributeModel.is_active == True)

    if search:
        conditions = [
            getattr(AttributeModel, f).ilike(f"%{search}%")
            for f in search_fields
            if hasattr(AttributeModel, f)
        ]
        if conditions:
            query = query.where(or_(*conditions))

    if code:
        query = query.where(AttributeModel.code == code)

    if min_sort_order is not None:
        query = query.where(AttributeModel.sort_order >= min_sort_order)

    if max_sort_order is not None:
        query = query.where(AttributeModel.sort_order <= max_sort_order)

    if created_after:
        query = query.where(AttributeModel.created_at >= created_after)

    if created_before:
        query = query.where(AttributeModel.created_at <= created_before)

    # Sorting
    order_column = getattr(AttributeModel, sort_by, AttributeModel.sort_order)

    if sort_order == "desc":
        query = query.order_by(order_column.desc(), AttributeModel.id.desc())
    else:
        query = query.order_by(order_column.asc(), AttributeModel.id.asc())

    # Pagination
    if cursor:
        cursor_data = paginator.decode_cursor(cursor)
        # (keep your existing cursor logic here)

    # Count
    count_query = select(func.count()).select_from(AttributeModel).where(
        AttributeModel.group_id == group_id
    )

    total = (await db.execute(count_query)).scalar()

    query = query.limit(limit + 1)
    result = await db.execute(query)
    items = result.scalars().all()

    has_next = len(items) > limit
    next_cursor = None

    if has_next:
        items = items[:limit]
        next_cursor = paginator.get_next_cursor(items, limit)

    return {
        "items": items,
        "next_cursor": next_cursor,
        "total": total,
        "has_more": has_next,
    }