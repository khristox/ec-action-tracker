# app/api/v1/endpoints/address/locations.py

"""
Location API endpoints
"""
from sqlalchemy import select

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

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

# In app/api/v1/endpoints/address/locations.py

def _orm_to_dict(loc) -> dict:
    """Convert a Location ORM object to a plain dict safely.
    Handles detached instances by accessing attributes safely.
    """
    try:
        # Safely get attributes with fallbacks for detached instances
        def safe_get(obj, attr, default=None):
            try:
                return getattr(obj, attr, default)
            except Exception:
                return default
        
        return {
            "id":               str(loc.id) if loc.id else None,
            "code":             safe_get(loc, "code"),
            "alt_code":         safe_get(loc, "alt_code"),
            "name":             safe_get(loc, "name"),
            "short_name":       safe_get(loc, "short_name"),
            "native_name":      safe_get(loc, "native_name"),
            "full_name":        safe_get(loc, "full_name"),
            "level":            safe_get(loc, "level"),
            "level_name":       safe_get(loc, "level_name", f"Level {safe_get(loc, 'level')}"),
            "location_type":    safe_get(loc, "location_type"),
            "location_mode":    safe_get(loc, "location_mode", "address"),
            "parent_id":        str(loc.parent_id) if loc.parent_id else None,
            "status":           safe_get(loc, "status", "active"),
            "created_at":       safe_get(loc, "created_at"),
            "updated_at":       safe_get(loc, "updated_at"),
            "created_by":       str(loc.created_by) if loc.created_by else None,
            "updated_by":       str(loc.updated_by) if loc.updated_by else None,
            "display_name":     safe_get(loc, "display_name", safe_get(loc, "name")),
            "hierarchical_path": safe_get(loc, "hierarchical_path", safe_get(loc, "name")),
            "has_children":     False,  # Default for detached
            "child_count":      0,
            "gps_coordinates":  safe_get(loc, "gps_coordinates"),
            "gps_geojson":      safe_get(loc, "gps_geojson"),
            "population":       safe_get(loc, "population"),
            "area":             safe_get(loc, "area"),
            "postal_code":      safe_get(loc, "postal_code"),
        }
    except Exception as e:
        logger.error(f"Error converting location to dict: {e}")
        # Return minimal dict with available data
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
# PUBLIC — list / search
# ─────────────────────────────────────────────

@router.get("/", response_model=LocationListResponse)
async def list_locations(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    level: Optional[int] = Query(None, ge=1, le=7),
    location_type: Optional[str] = Query(None),
    location_mode: Optional[str] = Query(None, description="Filter by location mode: address, buildings"),
    parent_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
) -> LocationListResponse:
    """List locations with filtering and pagination (public)."""
    try:
        # Validate location_mode if provided
        if location_mode and not _validate_location_mode(location_mode):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid location_mode. Must be one of: {', '.join(VALID_LOCATION_MODES)}"
            )

        items_orm: list = []
        total: int = 0

        # Build query with filters
        if search:
            items_orm = await location_crud.search(
                db, query=search, limit=limit, skip=skip,
                location_mode=location_mode
            )
            total = len(items_orm)

        elif parent_id:
            items_orm = await location_crud.get_children(
                db, parent_id=parent_id, skip=skip, limit=limit,
                include_inactive=include_inactive, location_mode=location_mode
            )
            total = await location_crud.count_children(db, parent_id, include_inactive, location_mode)

        elif level:
            items_orm = await location_crud.get_by_level(
                db, level=level, skip=skip, limit=limit,
                include_inactive=include_inactive, location_mode=location_mode
            )
            total = len(items_orm)

        elif location_type:
            items_orm = await location_crud.get_by_location_type(
                db, location_type=location_type, skip=skip, limit=limit,
                location_mode=location_mode
            )
            total = len(items_orm)

        else:
            items_orm = await location_crud.get_multi(
                db, skip=skip, limit=limit,
                location_mode=location_mode
            )
            total = await location_crud.count(db, location_mode=location_mode)

        logger.info(f"list_locations → {len(items_orm)} rows, total={total}, mode_filter={location_mode}")

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


@router.get("/statistics", response_model=dict)
async def get_location_statistics(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """Get location statistics (admin only)."""
    try:
        stats = await location_crud.get_statistics(db)
        # Add mode breakdown
        stats["by_mode"] = {
            "address": await location_crud.count_by_mode(db, "address"),
            "buildings": await location_crud.count_by_mode(db, "buildings"),
        }
        return stats
    except Exception as exc:
        logger.exception("get_statistics failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


# ─────────────────────────────────────────────
# PUBLIC — tree
# ─────────────────────────────────────────────

@router.get("/tree", response_model=List[LocationTreeResponse])
async def get_location_tree(
    db: AsyncSession = Depends(deps.get_db),
    root_id: Optional[UUID] = Query(None),
    max_depth: int = Query(7, ge=1, le=7),
    location_mode: Optional[str] = Query(None, description="Filter by location mode: address, buildings"),
) -> List[LocationTreeResponse]:
    """Get location hierarchy tree (public)."""
    try:
        if location_mode and not _validate_location_mode(location_mode):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid location_mode. Must be one of: {', '.join(VALID_LOCATION_MODES)}"
            )
        return await location_crud.get_tree(
            db, root_id=root_id, max_depth=max_depth,
            location_mode=location_mode
        )
    except Exception as exc:
        logger.exception("get_tree failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


# ─────────────────────────────────────────────
# PUBLIC — lookups by code / level
# ─────────────────────────────────────────────

# In app/api/v1/endpoints/address/locations.py

@router.get("/by-code/{code}", response_model=LocationResponse)
async def get_location_by_code(
    code: str,
    db: AsyncSession = Depends(deps.get_db),
) -> LocationResponse:
    """Get a location by its code (public)."""
    try:
        # Use the new dictionary method instead of ORM object
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Level must be between 1 and 7")
    
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Location {location_id} not found")

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


@router.get("/{location_id}/ancestors", response_model=List[LocationResponse])
async def get_location_ancestors(
    location_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
) -> List[LocationResponse]:
    """Get all ancestors of a location (public)."""
    try:
        loc = await location_crud.get(db, location_id)
        if not loc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Location {location_id} not found")
        ancestors = await location_crud.get_ancestors(db, location_id)
        return [_orm_to_dict(a) for a in ancestors]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_ancestors failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


@router.get("/{location_id}/breadcrumb", response_model=List[LocationBreadcrumb])
async def get_location_breadcrumb(
    location_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
) -> List[LocationBreadcrumb]:
    """Get breadcrumb trail for a location (public)."""
    try:
        loc = await location_crud.get(db, location_id)
        if not loc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Location {location_id} not found")
        return await location_crud.get_breadcrumb(db, location_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_breadcrumb failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Location {location_id} not found")
        
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


# ─────────────────────────────────────────────
# ADMIN — create / update / delete
# ─────────────────────────────────────────────

# In app/api/v1/endpoints/address/locations.py

@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_in: LocationCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> LocationResponse:
    """Create a new location (admin only)."""
    try:
        # Validate location_mode
        if location_in.location_mode and location_in.location_mode not in VALID_LOCATION_MODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid location_mode. Must be one of: {', '.join(VALID_LOCATION_MODES)}"
            )
        
        # Check code uniqueness
        if await location_crud.get_by_code(db, location_in.code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Code '{location_in.code}' already exists"
            )

        # Validate parent relationship - KEEP THE OBJECT ATTACHED
        if location_in.parent_id:
            # Use a fresh query that stays within this session context
            parent_result = await db.execute(
                select(Location).where(Location.id == location_in.parent_id)
            )
            parent = parent_result.scalar_one_or_none()
            
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Parent {location_in.parent_id} not found"
                )
            
            # Force load the level attribute while still in session
            parent_level = parent.level  # Access it while session is active
            
            expected = parent_level + 1
            if location_in.level != expected:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Level must be {expected} (parent is {parent_level})"
                )
            
            # Inherit location_mode from parent if not specified
            if not location_in.location_mode:
                location_in.location_mode = parent.location_mode

        # Set default location_mode if not provided
        if not location_in.location_mode:
            location_in.location_mode = "address"

        loc = await location_crud.create(db, obj_in=location_in, user=current_user)
        
        # Convert to dict while session is still active
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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Location {location_id} not found")

        # Validate location_mode if being updated
        if location_in.location_mode is not None:
            if not _validate_location_mode(location_in.location_mode):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid location_mode. Must be one of: {', '.join(VALID_LOCATION_MODES)}"
                )

        # Validate parent relationship if being updated
        if location_in.parent_id is not None:
            if location_in.parent_id == location_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Location cannot be its own parent")
            parent = await location_crud.get(db, location_in.parent_id)
            if not parent:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail=f"Parent {location_in.parent_id} not found")
            new_level = location_in.level or loc.level
            if new_level != parent.level + 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Level must be {parent.level + 1}")

        updated = await location_crud.update(db, db_obj=loc, obj_in=location_in, user=current_user)
        return _orm_to_dict(updated)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("update_location failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Location {location_id} not found")
        updated = await location_crud.update_gps(db, location_id, gps_data)
        return _orm_to_dict(updated)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("update_gps failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Location {location_id} not found")
        child_count = await location_crud.count_children(db, location_id)
        if child_count > 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Cannot delete: has {child_count} child locations")
        await location_crud.remove(db, id=location_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("delete_location failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(exc))


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
            # Validate location_mode
            if location_data.location_mode and not _validate_location_mode(location_data.location_mode):
                logger.warning(f"bulk_create skipped {location_data.code}: invalid location_mode")
                continue
            
            if await location_crud.get_by_code(db, location_data.code):
                continue
            
            # Set default location_mode
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