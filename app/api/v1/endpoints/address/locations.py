# app/api/v1/endpoints/address/locations.py
import logging
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api import deps
from app.crud.address.location import location as location_crud
from app.models.address.location import Location
from app.models.user import User
from app.schemas.address.location import (
    LocationCreate,
    LocationUpdate,
    LocationResponse,
    LocationTreeResponse,
    LocationListResponse,
    LocationBreadcrumb,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

VALID_LOCATION_MODES = ["address", "buildings"]


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _orm_to_dict(loc) -> dict:
    """Convert a Location ORM object to a plain dict safely."""
    try:
        def safe_get(obj, attr, default=None):
            try:
                return getattr(obj, attr, default)
            except Exception:
                return default
        
        return {
            "id": str(loc.id) if loc.id else None,
            "code": safe_get(loc, "code"),
            "alt_code": safe_get(loc, "alt_code"),
            "name": safe_get(loc, "name"),
            "short_name": safe_get(loc, "short_name"),
            "native_name": safe_get(loc, "native_name"),
            "full_name": safe_get(loc, "full_name"),
            "level": safe_get(loc, "level"),
            "level_name": safe_get(loc, "level_name", f"Level {safe_get(loc, 'level')}"),
            "location_type": safe_get(loc, "location_type"),
            "location_mode": safe_get(loc, "location_mode", "address"),
            "parent_id": str(loc.parent_id) if loc.parent_id else None,
            "status": safe_get(loc, "status", "active"),
            "created_at": safe_get(loc, "created_at"),
            "updated_at": safe_get(loc, "updated_at"),
            "created_by": str(loc.created_by) if loc.created_by else None,
            "updated_by": str(loc.updated_by) if loc.updated_by else None,
            "display_name": safe_get(loc, "display_name", safe_get(loc, "name")),
            "hierarchical_path": safe_get(loc, "hierarchical_path", safe_get(loc, "name")),
            "has_children": False,
            "child_count": 0,
            "gps_coordinates": safe_get(loc, "gps_coordinates"),
            "gps_geojson": safe_get(loc, "gps_geojson"),
            "population": safe_get(loc, "population"),
            "area": safe_get(loc, "area"),
            "postal_code": safe_get(loc, "postal_code"),
        }
    except Exception as e:
        logger.error(f"Error converting location to dict: {e}")
        return {
            "id": str(loc.id) if hasattr(loc, 'id') and loc.id else None,
            "code": getattr(loc, 'code', None),
            "name": getattr(loc, 'name', None),
            "level": getattr(loc, 'level', None),
        }


def _validate_location_mode(mode: str) -> bool:
    """Validate location mode value."""
    return mode in VALID_LOCATION_MODES


# ─────────────────────────────────────────────
# TREE ENDPOINT - OPTIMIZED
# ─────────────────────────────────────────────

@router.get("/tree", response_model=List[LocationTreeResponse])
async def get_location_tree(
    location_mode: str = Query("address", description="address or buildings"),
    max_depth: int = Query(7, ge=1, le=10),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> List[LocationTreeResponse]:
    """
    Get hierarchical tree of locations.
    
    OPTIMIZED: Single query loads ALL locations at once,
    builds tree in memory for instant response.
    """
    try:
        logger.info(f"🌳 Building location tree: mode={location_mode}")
        
        # ✅ SINGLE QUERY - Load all locations at once
        result = await db.execute(
            select(Location)
            .where(
                Location.location_mode == location_mode,
                Location.status == "active"
            )
            .order_by(Location.level, Location.name)
        )
        all_locations = result.scalars().all()
        
        logger.info(f"📊 Loaded {len(all_locations)} locations")
        
        if not all_locations:
            logger.warning(f"⚠️ No locations found for mode: {location_mode}")
            return []
        
        # ✅ BUILD TREE IN MEMORY - O(n) time complexity
        location_map = {}
        roots = []
        
        # First pass: Create map of all locations
        for loc in all_locations:
            location_map[loc.id] = {
                "id": str(loc.id),
                "code": loc.code,
                "name": loc.name,
                "short_name": loc.short_name,
                "native_name": loc.native_name,
                "full_name": loc.full_name,
                "level": loc.level,
                "level_name": loc.level_name or f"Level {loc.level}",
                "location_type": loc.location_type,
                "location_mode": loc.location_mode,
                "parent_id": str(loc.parent_id) if loc.parent_id else None,
                "display_name": loc.display_name or loc.name,
                "status": loc.status,
                "has_children": False,
                "child_count": 0,
                "children": []
            }
        
        # Second pass: Build parent-child relationships
        for loc in all_locations:
            node = location_map[loc.id]
            if loc.parent_id and loc.parent_id in location_map:
                parent = location_map[loc.parent_id]
                parent["children"].append(node)
                parent["has_children"] = True
                parent["child_count"] += 1
            else:
                roots.append(node)
        
        # ✅ Sort all children by name recursively
        def sort_children(nodes):
            if not nodes:
                return
            nodes.sort(key=lambda x: x["name"].lower())
            for node in nodes:
                if node["children"]:
                    sort_children(node["children"])
        
        sort_children(roots)
        
        # ✅ Limit depth if max_depth is specified
        def limit_depth(nodes, current_depth=1):
            if current_depth >= max_depth:
                for node in nodes:
                    node["children"] = []
                    node["has_children"] = node["child_count"] > 0
                return
            for node in nodes:
                if node["children"]:
                    limit_depth(node["children"], current_depth + 1)
        
        if max_depth < 7:
            limit_depth(roots)
        
        logger.info(f"✅ Tree built: {len(roots)} root nodes, {len(all_locations)} total nodes")
        
        # ✅ Count total children for each node efficiently
        def count_all_children(nodes):
            total = 0
            for node in nodes:
                if node["children"]:
                    node["child_count"] = len(node["children"])
                    total += len(node["children"])
            return total
        
        total_children = count_all_children(roots)
        logger.info(f"📊 Total children across all nodes: {total_children}")
        
        return roots
        
    except Exception as exc:
        logger.exception("get_location_tree failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


# ─────────────────────────────────────────────
# TREE ROOTS - FOR LAZY LOADING (Alternative)
# ─────────────────────────────────────────────

@router.get("/tree/roots")
async def get_location_tree_roots(
    location_mode: str = Query("address", description="address or buildings"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> List[dict]:
    """
    Get root nodes only (for lazy loading).
    Much faster for initial load.
    """
    try:
        root_level = 1 if location_mode == "address" else 11
        
        result = await db.execute(
            select(Location)
            .where(
                Location.location_mode == location_mode,
                Location.level == root_level,
                Location.status == "active"
            )
            .order_by(Location.name)
        )
        roots = result.scalars().all()
        
        # Check if each root has children
        tree = []
        for root in roots:
            child_count = await db.scalar(
                select(func.count())
                .select_from(Location)
                .where(
                    Location.parent_id == root.id,
                    Location.status == "active"
                )
            )
            
            tree.append({
                "id": str(root.id),
                "code": root.code,
                "name": root.name,
                "level": root.level,
                "level_name": root.level_name or f"Level {root.level}",
                "location_type": root.location_type,
                "location_mode": root.location_mode,
                "has_children": child_count > 0,
                "child_count": child_count,
                "children": []  # Load on demand
            })
        
        return tree
        
    except Exception as exc:
        logger.exception("get_location_tree_roots failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.get("/tree/children/{parent_id}")
async def get_location_tree_children(
    parent_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> List[dict]:
    """
    Get children of a specific node (for lazy loading).
    """
    try:
        result = await db.execute(
            select(Location)
            .where(
                Location.parent_id == parent_id,
                Location.status == "active"
            )
            .order_by(Location.name)
        )
        children = result.scalars().all()
        
        tree = []
        for child in children:
            child_count = await db.scalar(
                select(func.count())
                .select_from(Location)
                .where(
                    Location.parent_id == child.id,
                    Location.status == "active"
                )
            )
            
            tree.append({
                "id": str(child.id),
                "code": child.code,
                "name": child.name,
                "level": child.level,
                "level_name": child.level_name or f"Level {child.level}",
                "location_type": child.location_type,
                "location_mode": child.location_mode,
                "has_children": child_count > 0,
                "child_count": child_count,
                "children": []  # Load on demand
            })
        
        return tree
        
    except Exception as exc:
        logger.exception("get_location_tree_children failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


# ─────────────────────────────────────────────
# PUBLIC — list / search
# ─────────────────────────────────────────────

@router.get("/", response_model=LocationListResponse)
async def list_locations(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    level: Optional[int] = Query(None, ge=1, le=14),
    location_type: Optional[str] = Query(None),
    location_mode: Optional[str] = Query(None, description="Filter by location mode: address, buildings, or 'all' for both"),
    parent_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
) -> LocationListResponse:
    """List locations with filtering and pagination (public)."""
    try:
        if not location_mode:
            location_mode = "address"
        
        filter_mode = None
        if location_mode.lower() != 'all':
            filter_mode = location_mode
            if not _validate_location_mode(filter_mode):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid location_mode. Must be one of: address, buildings, all"
                )

        items_orm = []
        total = 0

        if search:
            items_orm = await location_crud.search(
                db, query=search, limit=limit, skip=skip,
                location_mode=filter_mode
            )
            total = len(items_orm)
        elif parent_id:
            items_orm = await location_crud.get_children(
                db, parent_id=parent_id, skip=skip, limit=limit,
                include_inactive=include_inactive, location_mode=filter_mode
            )
            total = await location_crud.count_children(db, parent_id, include_inactive, filter_mode)
        elif level:
            items_orm = await location_crud.get_by_level(
                db, level=level, skip=skip, limit=limit,
                include_inactive=include_inactive, location_mode=filter_mode
            )
            total = len(items_orm)
        elif location_type:
            items_orm = await location_crud.get_by_location_type(
                db, location_type=location_type, skip=skip, limit=limit,
                location_mode=filter_mode
            )
            total = len(items_orm)
        else:
            first_level = 11 if filter_mode == "buildings" else 1
            items_orm = await location_crud.get_by_level(
                db, level=first_level, skip=skip, limit=limit,
                include_inactive=include_inactive, location_mode=filter_mode if filter_mode != 'all' else None
            )
            total = len(items_orm)

        items = [_orm_to_dict(loc) for loc in items_orm]
        pages = (total + limit - 1) // limit if total > 0 else 0

        return LocationListResponse(
            items=items,
            total=total,
            page=skip // limit + 1 if limit > 0 else 1,
            size=limit,
            pages=pages,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("list_locations failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.get("/statistics", response_model=dict)
async def get_location_statistics(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """Get location statistics (admin only)."""
    try:
        stats = await location_crud.get_statistics(db)
        stats["by_mode"] = {
            "address": await location_crud.count_by_mode(db, "address"),
            "buildings": await location_crud.count_by_mode(db, "buildings"),
        }
        return stats
    except Exception as exc:
        logger.exception("get_statistics failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


# ─────────────────────────────────────────────
# PUBLIC — lookups by code / level
# ─────────────────────────────────────────────

@router.get("/by-code/{code}", response_model=LocationResponse)
async def get_location_by_code(
    code: str,
    db: AsyncSession = Depends(deps.get_db),
) -> LocationResponse:
    """Get a location by its code (public)."""
    try:
        loc_dict = await location_crud.get_by_code_as_dict(db, code)
        if not loc_dict:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location '{code}' not found"
            )
        return loc_dict
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_by_code failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.get("/by-level/{level}", response_model=List[LocationResponse])
async def get_locations_by_level(
    level: int,
    db: AsyncSession = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    include_inactive: bool = Query(False),
    location_mode: Optional[str] = Query(None, description="Filter by location mode: address, buildings"),
) -> List[LocationResponse]:
    """Get locations by hierarchy level (public)."""
    if not (1 <= level <= 7):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Level must be between 1 and 7"
        )
    
    if location_mode and not _validate_location_mode(location_mode):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid location_mode. Must be one of: {', '.join(VALID_LOCATION_MODES)}"
        )
    
    try:
        locs = await location_crud.get_by_level(
            db, level=level, skip=skip, limit=limit,
            include_inactive=include_inactive, location_mode=location_mode
        )
        return [_orm_to_dict(loc) for loc in locs]
    except Exception as exc:
        logger.exception("get_by_level failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


# ─────────────────────────────────────────────
# PUBLIC — single location + sub-resources
# ─────────────────────────────────────────────

@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    include_children_count: bool = Query(True),
) -> LocationResponse:
    """Get a location by ID (public)."""
    try:
        loc = await location_crud.get(db, location_id)
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location {location_id} not found"
            )

        result = _orm_to_dict(loc)

        if include_children_count:
            count = await location_crud.count_children(db, location_id)
            result["child_count"] = count
            result["has_children"] = count > 0

        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_location failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.get("/{location_id}/ancestors", response_model=List[LocationResponse])
async def get_location_ancestors(
    location_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
) -> List[LocationResponse]:
    """Get all ancestors of a location (public)."""
    try:
        loc = await location_crud.get(db, location_id)
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location {location_id} not found"
            )
        ancestors = await location_crud.get_ancestors(db, location_id)
        return [_orm_to_dict(a) for a in ancestors]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_ancestors failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.get("/{location_id}/breadcrumb", response_model=List[LocationBreadcrumb])
async def get_location_breadcrumb(
    location_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
) -> List[LocationBreadcrumb]:
    """Get breadcrumb trail for a location (public)."""
    try:
        loc = await location_crud.get(db, location_id)
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location {location_id} not found"
            )
        return await location_crud.get_breadcrumb(db, location_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_breadcrumb failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.get("/{location_id}/children", response_model=List[LocationResponse])
async def get_location_children(
    location_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    include_inactive: bool = Query(False),
    location_mode: Optional[str] = Query(None, description="Filter by location mode: address, buildings"),
) -> List[LocationResponse]:
    """Get child locations (public)."""
    try:
        loc = await location_crud.get(db, location_id)
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location {location_id} not found"
            )
        
        if location_mode and not _validate_location_mode(location_mode):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid location_mode. Must be one of: {', '.join(VALID_LOCATION_MODES)}"
            )
        
        children = await location_crud.get_children(
            db, parent_id=location_id, skip=skip, limit=limit,
            include_inactive=include_inactive, location_mode=location_mode
        )
        return [_orm_to_dict(c) for c in children]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_children failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


# ─────────────────────────────────────────────
# ADMIN — create / update / delete
# ─────────────────────────────────────────────

@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_in: LocationCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> LocationResponse:
    """Create a new location (admin only)."""
    try:
        if location_in.location_mode and location_in.location_mode not in VALID_LOCATION_MODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid location_mode. Must be one of: {', '.join(VALID_LOCATION_MODES)}"
            )
        
        if await location_crud.get_by_code(db, location_in.code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Code '{location_in.code}' already exists"
            )

        if location_in.parent_id:
            parent_result = await db.execute(
                select(Location).where(Location.id == location_in.parent_id)
            )
            parent = parent_result.scalar_one_or_none()
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Parent {location_in.parent_id} not found"
                )

        if not location_in.location_mode:
            location_in.location_mode = "address"

        if not location_in.location_type:
            if location_in.location_mode == 'buildings':
                type_map = {11: 'office', 12: 'building', 13: 'room', 14: 'conference'}
                location_in.location_type = type_map.get(location_in.level)
            else:
                type_map = {1: 'country', 2: 'region', 3: 'district', 4: 'county', 
                           5: 'subcounty', 6: 'parish', 7: 'village'}
                location_in.location_type = type_map.get(location_in.level)

        loc = await location_crud.create(db, obj_in=location_in, user=current_user)
        return loc.to_dict() if hasattr(loc, 'to_dict') else _orm_to_dict(loc)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("create_location failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: UUID,
    location_in: LocationUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> LocationResponse:
    """Update a location (admin only)."""
    try:
        loc = await location_crud.get(db, location_id)
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location {location_id} not found"
            )

        if location_in.location_mode is not None:
            if not _validate_location_mode(location_in.location_mode):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid location_mode. Must be one of: {', '.join(VALID_LOCATION_MODES)}"
                )

        updated = await location_crud.update(db, db_obj=loc, obj_in=location_in, user=current_user)
        return _orm_to_dict(updated)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("update_location failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.patch("/{location_id}/gps", response_model=LocationResponse)
async def update_location_gps(
    location_id: UUID,
    gps_data: dict,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> LocationResponse:
    """Update GPS data for a location (admin only)."""
    try:
        loc = await location_crud.get(db, location_id)
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location {location_id} not found"
            )
        updated = await location_crud.update_gps(db, location_id, gps_data)
        return _orm_to_dict(updated)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("update_gps failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> None:
    """Delete a location (admin only)."""
    try:
        loc = await location_crud.get(db, location_id)
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location {location_id} not found"
            )
        child_count = await location_crud.count_children(db, location_id)
        if child_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete: has {child_count} child locations"
            )
        await location_crud.remove(db, id=location_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("delete_location failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.post("/bulk", response_model=List[LocationResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_locations(
    locations: List[LocationCreate],
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> List[LocationResponse]:
    """Bulk create locations (admin only)."""
    created = []
    for location_data in locations:
        try:
            if location_data.location_mode and not _validate_location_mode(location_data.location_mode):
                logger.warning(f"bulk_create skipped {location_data.code}: invalid location_mode")
                continue
            
            if await location_crud.get_by_code(db, location_data.code):
                continue
            
            if not location_data.location_mode:
                location_data.location_mode = "address"
            
            loc = await location_crud.create(db, obj_in=location_data, user=current_user)
            created.append(_orm_to_dict(loc))
        except Exception as exc:
            logger.warning(f"bulk_create skipped {location_data.code}: {exc}")
            continue
    return created


@router.get("/modes/", response_model=dict)
async def get_location_modes(
    db: AsyncSession = Depends(deps.get_db),
) -> dict:
    """Get available location modes (public)."""
    return {
        "modes": VALID_LOCATION_MODES,
        "descriptions": {
            "address": "Physical address locations (countries, regions, districts, etc.)",
            "buildings": "Building and facility locations"
        }
    }


# ─────────────────────────────────────────────
# REMOVE DUPLICATE ENDPOINTS
# ─────────────────────────────────────────────
# The duplicate /tree-2 endpoint has been removed.
# All tree functionality is now handled by:
#   1. /tree - Full tree (optimized single query)
#   2. /tree/roots - Lazy loading roots
#   3. /tree/children/{parent_id} - Lazy loading children