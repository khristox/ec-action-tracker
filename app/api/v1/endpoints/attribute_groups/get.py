# app/api/v1/endpoints/attribute_groups/get.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from typing import List, Optional, Union, Dict, Any
import uuid
import logging
from sqlalchemy.orm import selectinload
from datetime import datetime
from sqlalchemy import Boolean  # Add this import at the top
from sqlalchemy import Boolean, cast, true


from app.api import deps
from app.crud.attribute_group import attribute_group
from app.crud.attribute import attribute
from app.schemas.attribute_group import (
    AttributeGroupResponse,
    AttributeGroupWithAttributes,
    AttributeGroupLimitedResponse,
    AttributeLimitedResponse
)
from app.schemas.attribute import AttributeResponse
from app.models.user import User
from app.models.general.dynamic_attribute import AttributeGroup as AttributeGroupModel, Attribute as AttributeModel
from .utils import (
    PUBLIC_GROUPS,
    CursorPaginator,
    check_group_permissions,
    convert_to_limited_group,
    search_attribute_groups
)


router = APIRouter()
logger = logging.getLogger(__name__)

# Create paginator instance
paginator = CursorPaginator()


# ==================== SHARED INTERNAL LOGIC ====================
async def list_attribute_groups_internal(
    db: AsyncSession,
    current_user: Optional[User],
    code: Optional[str] = None,
    search: Optional[str] = None,
    search_fields: Optional[str] = None,
    allow_multiple: Optional[bool] = None,
    is_required: Optional[bool] = None,
    is_public: Optional[bool] = None,
    public_only: bool = False,
    include_attributes: bool = True,
    detail_level: str = "limited",
    cursor: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """Core logic for listing attribute groups with filters and cursor pagination."""
    
    # Build base query without selectinload for counting
    base_query = select(AttributeGroupModel)
    
    # Define public filter once
    public_filter = or_(
        AttributeGroupModel.code.in_(PUBLIC_GROUPS),
        and_(
            AttributeGroupModel.extra_metadata.is_not(None),
            func.JSON_EXTRACT(AttributeGroupModel.extra_metadata, '$.public') == true()
        )
    )
    
    # Apply visibility rules
    if public_only:
        base_query = base_query.where(public_filter)
    elif current_user is None:
        base_query = base_query.where(public_filter)
    else:
        base_query = base_query.where(
            or_(
                public_filter,
                # AttributeGroupModel.owner_id == current_user.id,
            )
        )
    
    # Apply other filters
    if code:
        base_query = base_query.where(AttributeGroupModel.code == code.upper())
    
    if allow_multiple is not None:
        base_query = base_query.where(AttributeGroupModel.allow_multiple == allow_multiple)
    
    if is_required is not None:
        base_query = base_query.where(AttributeGroupModel.is_required == is_required)
    
    if search:
        search_conditions = []
        fields = [f.strip() for f in (search_fields or "name,code,description").split(",")]
        for field in fields:
            if hasattr(AttributeGroupModel, field):
                search_conditions.append(
                    getattr(AttributeGroupModel, field).ilike(f"%{search}%")
                )
        if search_conditions:
            base_query = base_query.where(or_(*search_conditions))
    
    # COUNT - Create a separate count query WITHOUT selectinload
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Now build the main query with ordering and pagination
    main_query = base_query
    
    # Add selectinload ONLY if requested
    if include_attributes:
        main_query = main_query.options(selectinload(AttributeGroupModel.attributes))
    
    # Sorting
    main_query = main_query.order_by(AttributeGroupModel.code.asc())
    
    # Cursor pagination
    if cursor:
        try:
            cursor_data = paginator.decode_cursor(cursor)
            if cursor_data and "id" in cursor_data:
                last_id = uuid.UUID(cursor_data["id"])
                direction = cursor_data.get("direction", "next")
                if direction == "next":
                    main_query = main_query.where(AttributeGroupModel.id > last_id)
                elif direction == "prev":
                    main_query = main_query.where(AttributeGroupModel.id < last_id)
        except Exception as e:
            logger.warning(f"Invalid cursor ignored: {cursor} – {str(e)}")
    
    # Limit +1 to detect if more exist
    main_query = main_query.limit(limit + 1)
    result = await db.execute(main_query)
    groups = result.scalars().all()
    
    has_next = len(groups) > limit
    next_cursor = None
    if has_next:
        groups = groups[:limit]
        last_group = groups[-1]
        next_cursor = paginator.encode_cursor({
            "id": str(last_group.id),
            "direction": "next"
        })
    
    # Prepare response items
    if detail_level == "limited":
        items = [convert_to_limited_group(g, include_attributes) for g in groups]
    else:
        items = [AttributeGroupWithAttributes.model_validate(g) for g in groups]
    
    return {
        "items": items,
        "total": total,
        "next_cursor": next_cursor,
        "limit": limit,
        "has_more": has_next,
        "filters_applied": {
            "code": code,
            "search": search,
            "allow_multiple": allow_multiple,
            "is_required": is_required,
            "is_public": is_public,
            "public_only": public_only,
            "include_attributes": include_attributes,
            "detail_level": detail_level,
        }
    }

# ==================== PUBLIC ENDPOINTS (No Auth) ====================

@router.get("/public", response_model=Dict[str, Any])
async def list_public_attribute_groups(
    db: AsyncSession = Depends(deps.get_db),
    search: Optional[str] = Query(None, description="Search term"),
    include_attributes: bool = Query(True, description="Include attributes in response"),
    detail_level: str = Query("limited", description="Response detail level: 'limited' or 'full'"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Items per page")
) -> Dict[str, Any]:
    """List only public attribute groups (no authentication required)."""
    return await list_attribute_groups_internal(
        db=db,
        current_user=None,
        search=search,
        public_only=True,
        include_attributes=include_attributes,
        detail_level=detail_level,
        cursor=cursor,
        limit=limit
    )


# ==================== MAIN LIST ENDPOINT ====================

@router.get("/", response_model=Dict[str, Any])
async def list_attribute_groups(
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    code: Optional[str] = Query(None, description="Filter by group code"),
    search: Optional[str] = Query(None, description="Search term"),
    search_fields: Optional[str] = Query(None, description="Comma-separated fields to search in"),
    allow_multiple: Optional[bool] = Query(None, description="Filter by allow_multiple"),
    is_required: Optional[bool] = Query(None, description="Filter by is_required"),
    is_public: Optional[bool] = Query(None, description="Filter by public status"),
    public_only: bool = Query(False, description="Only show public groups"),
    include_attributes: bool = Query(True, description="Include attributes in response"),
    detail_level: str = Query("limited", description="Response detail level: 'limited' or 'full'"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Items per page")
) -> Dict[str, Any]:
    """List all attribute groups with search and continuous scroll pagination."""
    return await list_attribute_groups_internal(
        db=db,
        current_user=current_user,
        code=code,
        search=search,
        search_fields=search_fields,
        allow_multiple=allow_multiple,
        is_required=is_required,
        is_public=is_public,
        public_only=public_only,
        include_attributes=include_attributes,
        detail_level=detail_level,
        cursor=cursor,
        limit=limit
    )


# ==================== SEARCH ENDPOINT ====================

@router.get("/search", response_model=Dict[str, Any])
async def search_attribute_groups_endpoint(
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    q: str = Query(..., min_length=1, description="Search query"),
    fields: Optional[str] = Query(None, description="Comma-separated fields to search in"),
    is_public: Optional[bool] = Query(None, description="Filter by public status"),
    public_only: bool = Query(False, description="Only show public groups"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    detail_level: str = Query("limited", description="Response detail level: 'limited' or 'full'")
) -> Dict[str, Any]:
    """Dedicated search endpoint with continuous scroll pagination."""
    return await list_attribute_groups_internal(
        db=db,
        current_user=current_user,
        search=q,
        search_fields=fields,
        is_public=is_public,
        public_only=public_only,
        cursor=cursor,
        limit=limit,
        detail_level=detail_level
    )


# ==================== STRING CODE ROUTES ====================

@router.get("/by-code/{code}", response_model=Union[AttributeGroupLimitedResponse, AttributeGroupWithAttributes])
async def get_attribute_group_by_code_alias(
    code: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    include_attributes: bool = Query(True),
    detail_level: str = Query("limited"),
    search: Optional[str] = Query(None)
) -> Union[AttributeGroupLimitedResponse, AttributeGroupWithAttributes]:
    """Alias for getting attribute group by code."""
    return await get_attribute_group_by_code_internal(
        code=code,
        db=db,
        current_user=current_user,
        include_attributes=include_attributes,
        detail_level=detail_level,
        search=search
    )


@router.get("/{code}", response_model=Union[AttributeGroupLimitedResponse, AttributeGroupWithAttributes])
async def get_attribute_group_by_code(
    code: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    include_attributes: bool = Query(True),
    detail_level: str = Query("limited"),
    search: Optional[str] = Query(None)
) -> Union[AttributeGroupLimitedResponse, AttributeGroupWithAttributes]:
    """Get attribute group by code with its attributes."""
    return await get_attribute_group_by_code_internal(
        code=code,
        db=db,
        current_user=current_user,
        include_attributes=include_attributes,
        detail_level=detail_level,
        search=search
    )


async def get_attribute_group_by_code_internal(
    code: str,
    db: AsyncSession,
    current_user: Optional[User],
    include_attributes: bool,
    detail_level: str,
    search: Optional[str]
) -> Union[AttributeGroupLimitedResponse, AttributeGroupWithAttributes]:
    group = await attribute_group.get_by_code(db, code=code.upper())
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attribute group with code '{code}' not found"
        )

    is_public_group = (
        group.code in PUBLIC_GROUPS or
        (group.extra_metadata and group.extra_metadata.get("public", False))
    )

    if not is_public_group and not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication required to access this group. Group '{group.code}' is private."
        )

    if not is_public_group and not await check_group_permissions(group, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this attribute group"
        )

    if include_attributes:
        group = await attribute_group.get_with_attributes(db, id=group.id)
        if search and group.attributes:
            filtered = []
            term = search.lower()
            for attr in group.attributes:
                if (term in (attr.name or "").lower() or
                    term in (attr.code or "").lower() or
                    (attr.short_name and term in (attr.short_name or "").lower()) or
                    (attr.description and term in (attr.description or "").lower())):
                    filtered.append(attr)
            group.attributes = filtered

    if detail_level == "limited":
        return convert_to_limited_group(group)

    return group


# ==================== UUID ROUTES ====================

@router.get("/id/{group_id}", response_model=Union[AttributeGroupLimitedResponse, AttributeGroupWithAttributes])
async def get_attribute_group_by_id(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    include_attributes: bool = Query(True),
    detail_level: str = Query("limited"),
    search: Optional[str] = Query(None)
) -> Union[AttributeGroupLimitedResponse, AttributeGroupWithAttributes]:
    group = await attribute_group.get_with_attributes(db, id=group_id) if include_attributes else await attribute_group.get(db, id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Attribute group not found")

    is_public_group = (
        group.code in PUBLIC_GROUPS or
        (group.extra_metadata and group.extra_metadata.get("public", False))
    )

    if not is_public_group and not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    if not is_public_group and not await check_group_permissions(group, current_user, db):
        raise HTTPException(status_code=403, detail="No permission")

    if search and group.attributes:
        term = search.lower()
        group.attributes = [
            a for a in group.attributes
            if term in (a.name or "").lower() or
               term in (a.code or "").lower() or
               (a.short_name and term in (a.short_name or "").lower()) or
               (a.description and term in (a.description or "").lower())
        ]

    if detail_level == "limited":
        return convert_to_limited_group(group)

    return group


# ==================== GROUP ATTRIBUTES ENDPOINTS ====================

@router.get("/{code}/attributes", response_model=Dict[str, Any])
async def get_group_attributes_by_code(
    code: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    active_only: bool = Query(True),
    detail_level: str = Query("limited"),
    search: Optional[str] = Query(None),
    search_fields: Optional[str] = Query(None),
    code_filter: Optional[str] = Query(None, alias="code"),
    min_sort_order: Optional[int] = Query(None),
    max_sort_order: Optional[int] = Query(None),
    sort_by: str = Query("sort_order"),
    sort_order: str = Query("asc"),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100)
) -> Dict[str, Any]:
    group = await attribute_group.get_by_code(db, code=code.upper())
    if not group:
        raise HTTPException(404, detail=f"Group '{code}' not found")

    is_public_group = group.code in PUBLIC_GROUPS or (group.extra_metadata and group.extra_metadata.get("public", False))

    if not is_public_group and not current_user:
        raise HTTPException(401, detail="Authentication required")

    if not is_public_group and not await check_group_permissions(group, current_user, db):
        raise HTTPException(403, detail="No permission")

    return await get_group_attributes_internal(
        group_id=group.id,
        db=db,
        current_user=current_user,
        active_only=active_only,
        detail_level=detail_level,
        search=search,
        search_fields=search_fields,
        code=code_filter,
        min_sort_order=min_sort_order,
        max_sort_order=max_sort_order,
        sort_by=sort_by,
        sort_order=sort_order,
        cursor=cursor,
        limit=limit
    )


@router.get("/{group_id}/attributes", response_model=Dict[str, Any])
async def get_group_attributes_by_uuid(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    active_only: bool = Query(True),
    detail_level: str = Query("limited"),
    search: Optional[str] = Query(None),
    search_fields: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    min_sort_order: Optional[int] = Query(None),
    max_sort_order: Optional[int] = Query(None),
    sort_by: str = Query("sort_order"),
    sort_order: str = Query("asc"),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100)
) -> Dict[str, Any]:
    return await get_group_attributes_internal(
        group_id=group_id,
        db=db,
        current_user=current_user,
        active_only=active_only,
        detail_level=detail_level,
        search=search,
        search_fields=search_fields,
        code=code,
        min_sort_order=min_sort_order,
        max_sort_order=max_sort_order,
        sort_by=sort_by,
        sort_order=sort_order,
        cursor=cursor,
        limit=limit
    )


async def get_group_attributes_internal(
    group_id: uuid.UUID,
    db: AsyncSession,
    current_user: Optional[User],
    active_only: bool,
    detail_level: str,
    search: Optional[str] = None,
    search_fields: Optional[str] = None,
    code: Optional[str] = None,
    min_sort_order: Optional[int] = None,
    max_sort_order: Optional[int] = None,
    sort_by: str = "sort_order",
    sort_order: str = "asc",
    cursor: Optional[str] = None,
    limit: int = 20
) -> Dict[str, Any]:
    group = await attribute_group.get(db, id=group_id)
    if not group:
        raise HTTPException(404, detail="Attribute group not found")

    is_public_group = group.code in PUBLIC_GROUPS or (group.extra_metadata and group.extra_metadata.get("public", False))

    if not is_public_group and not current_user:
        raise HTTPException(401, detail="Authentication required")

    if not is_public_group and not await check_group_permissions(group, current_user, db):
        raise HTTPException(403, detail="No permission")

    # Build attribute query
    query = select(AttributeModel).where(AttributeModel.group_id == group_id)

    if active_only:
        query = query.where(AttributeModel.is_active == True)

    if search:
        fields = [f.strip() for f in (search_fields or "code,name,short_name,description").split(",")]
        conditions = []
        for f in fields:
            if hasattr(AttributeModel, f):
                conditions.append(getattr(AttributeModel, f).ilike(f"%{search}%"))
        if conditions:
            query = query.where(or_(*conditions))

    if code:
        query = query.where(AttributeModel.code == code)

    if min_sort_order is not None:
        query = query.where(AttributeModel.sort_order >= min_sort_order)
    if max_sort_order is not None:
        query = query.where(AttributeModel.sort_order <= max_sort_order)

    # Sorting
    sort_column = {
        "sort_order": AttributeModel.sort_order,
        "code": AttributeModel.code,
        "name": AttributeModel.name,
        "created_at": AttributeModel.created_at,
    }.get(sort_by, AttributeModel.sort_order)

    if sort_order.lower() == "desc":
        query = query.order_by(sort_column.desc(), AttributeModel.id.desc())
    else:
        query = query.order_by(sort_column.asc(), AttributeModel.id.asc())

    # Cursor pagination (simplified version – expand as needed)
    if cursor:
        cursor_data = paginator.decode_cursor(cursor)
        if cursor_data and "id" in cursor_data:
            last_id = uuid.UUID(cursor_data["id"])
            if sort_order.lower() == "desc":
                query = query.where(AttributeModel.id < last_id)
            else:
                query = query.where(AttributeModel.id > last_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.limit(limit + 1)
    result = await db.execute(query)
    attrs = result.scalars().all()

    has_next = len(attrs) > limit
    next_cursor = None
    if has_next:
        attrs = attrs[:limit]
        last_attr = attrs[-1]
        next_cursor = paginator.encode_cursor({"id": str(last_attr.id)})

    if detail_level == "limited":
        response_items = [
            {
                "id": a.id,
                "code": a.code,
                "name": a.name,
                "short_name": a.short_name,
                "sort_order": a.sort_order,
                "description": a.description if a.description else None
            }
            for a in attrs
        ]
    else:
        response_items = attrs

    return {
        "items": response_items,
        "next_cursor": next_cursor,
        "total": total,
        "limit": limit,
        "has_more": has_next,
        "group": {
            "id": group.id,
            "code": group.code,
            "name": group.name,
            "is_public": is_public_group
        }
    }