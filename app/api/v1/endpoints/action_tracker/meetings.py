# app/api/v1/endpoints/action_tracker/meetings.py
"""
Meeting Management API Endpoints

This module handles all meeting-related operations with improved connection management,
caching, and error handling.
"""

import asyncio
import csv
import json
import logging
import shutil
import uuid
from datetime import datetime, timedelta, date
from io import StringIO
from math import radians, sin, cos, sqrt, atan2
from pathlib import Path
from typing import List, Optional, Dict, Any, Callable, TypeVar, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import and_, distinct, func, select, or_, desc, asc, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError

from app.api import deps
from app.core.config import settings
from app.core.database import get_db, execute_with_retry
from app.core.security import get_current_user
from app.crud.meetings.action_tracker import (
    meeting_crud, meeting_action, meeting_minutes, meeting_participant
)
from app.db.session import get_db as get_db_original
from app.models.audit import AuditLog
from app.models.general.dynamic_attribute import Attribute
from app.models.role import Role
from app.models.user import User
from app.models.meetings.action_tracker import (
    Meeting, MeetingAction, MeetingDocument, MeetingParticipant, 
    MeetingQuery, MeetingStatusHistory, MeetingMinutes, Participant
)
from app.schemas.action_tracker import (
    MeetingCreateResponse, MeetingMinutesResponse, MeetingPaginationResponse, 
    MeetingCreate, MeetingParticipantCreate, MeetingParticipantResponse, MeetingParticipantUpdate, 
    MeetingStatusHistoryResponse, MeetingUpdate, MeetingResponse, 
    MeetingListResponse, NotificationRequest, ZoomMeetingCreate
)
from app.schemas.action_tracker_participants import ParticipantCreate
from app.schemas.meeting_minutes.meeting_minutes import (
    MeetingActionCreate, MeetingActionResponse, MeetingMinutesCreate,
    MeetingMinutesResponse, MeetingMinutesUpdate
)
from app.schemas.meetings import ParticipantMeetingSummarySchema
from app.services.email_service import email_service
from app.models.notification import NotificationChannel, NotificationCategory
from app.services.notification_service import NotificationService
from .status_utils import get_status_id_by_short_name, get_status_by_short_name, get_valid_status_short_names
from .utils import build_meeting_response as utils_build_meeting_response

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== CONSTANTS ====================

EARTH_RADIUS_KM = 6371
DEFAULT_PAGINATION_LIMIT = 12
MAX_PAGINATION_LIMIT = 100
DEFAULT_DOCUMENT_LIMIT = 100
MAX_DOCUMENT_LIMIT = 500
RADIUS_MIN_KM = 1
RADIUS_MAX_KM = 100
CACHE_TTL = 300  # 5 minutes
MAX_RETRIES = 3
RETRY_DELAY = 1

# Priority mapping for sorting
PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
STATUS_ORDER = {"pending": 0, "in_progress": 1, "completed": 2, "blocked": 3}

# ==================== TYPE HINTS ====================

T = TypeVar('T')
AsyncQueryFunc = Callable[[], T]

# ==================== REDIS CACHE SETUP ====================

class RedisCache:
    """Redis cache handler with connection pooling and fallback"""
    
    CACHE_KEY = "meeting_stats"
    CACHE_TTL = 300  # 5 minutes
    
    def __init__(self):
        self.redis = None
        self._initialized = False
        self._use_redis = False
    
    async def initialize(self):
        """Initialize Redis connection with retry logic"""
        if self._initialized:
            return
        
        try:
            try:
                import redis.asyncio as redis_lib
                
                self.redis = await redis_lib.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    max_connections=20,
                    socket_timeout=5,
                    socket_connect_timeout=5,
                    retry_on_timeout=True,
                    health_check_interval=30,
                )
                self._use_redis = True
                logger.info("Redis connection established for stats caching")
            except ImportError:
                logger.warning("redis library not installed, using in-memory cache fallback")
                self._use_redis = False
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}, using in-memory cache fallback")
                self._use_redis = False
        except Exception as e:
            logger.warning(f"Redis initialization failed: {e}, using in-memory cache fallback")
            self._use_redis = False
        finally:
            self._initialized = True
    
    async def get_stats(self) -> Optional[Dict[str, Any]]:
        """Get cached stats with fallback to memory"""
        try:
            if self._use_redis and self.redis:
                cached = await self.redis.get(self.CACHE_KEY)
                if cached:
                    return json.loads(cached)
            return await self._get_memory_cache()
        except Exception as e:
            logger.warning(f"Failed to read stats from cache: {e}")
            return None
    
    async def set_stats(self, stats_data: Dict[str, Any]) -> None:
        """Store stats with fallback to memory"""
        try:
            json_data = json.dumps(stats_data)
            if self._use_redis and self.redis:
                await self.redis.setex(self.CACHE_KEY, self.CACHE_TTL, json_data)
            else:
                await self._set_memory_cache(stats_data)
        except Exception as e:
            logger.warning(f"Failed to write stats to cache: {e}")
    
    async def invalidate(self) -> None:
        """Invalidate the cache"""
        try:
            if self._use_redis and self.redis:
                await self.redis.delete(self.CACHE_KEY)
            else:
                await self._clear_memory_cache()
        except Exception as e:
            logger.warning(f"Failed to invalidate cache: {e}")
    
    # ==================== IN-MEMORY CACHE FALLBACK ====================
    
    _memory_cache = {}
    _memory_expiry = {}
    
    async def _get_memory_cache(self) -> Optional[Dict[str, Any]]:
        """Get from in-memory cache"""
        if self.CACHE_KEY in self._memory_cache:
            if datetime.now() < self._memory_expiry.get(self.CACHE_KEY, datetime.min):
                return self._memory_cache[self.CACHE_KEY]
            else:
                await self._clear_memory_cache()
        return None
    
    async def _set_memory_cache(self, stats_data: Dict[str, Any]) -> None:
        """Set in-memory cache"""
        self._memory_cache[self.CACHE_KEY] = stats_data
        self._memory_expiry[self.CACHE_KEY] = datetime.now() + timedelta(seconds=self.CACHE_TTL)
    
    async def _clear_memory_cache(self) -> None:
        """Clear in-memory cache"""
        self._memory_cache.pop(self.CACHE_KEY, None)
        self._memory_expiry.pop(self.CACHE_KEY, None)

# Global cache instance
_stats_cache = RedisCache()

# ==================== INITIALIZE CACHE ON STARTUP ====================

async def init_stats_cache():
    """Initialize the stats cache - call this during app startup"""
    await _stats_cache.initialize()

# ==================== HELPER FUNCTIONS ====================

async def get_meeting_or_404(db: AsyncSession, meeting_id: UUID) -> Meeting:
    """
    Get meeting by ID or raise 404 with connection error handling.
    """
    try:
        meeting = await meeting_crud.get(db, meeting_id)
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        return meeting
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching meeting {meeting_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please try again later."
        )


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth.
    Returns distance in kilometers rounded to 2 decimal places.
    """
    lat1, lon1 = radians(lat1), radians(lng1)
    lat2, lon2 = radians(lat2), radians(lng2)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return round(EARTH_RADIUS_KM * c, 2)


def safe_isoformat(value: Optional[datetime]) -> Optional[str]:
    """Safely convert datetime to ISO format string."""
    return value.isoformat() if value else None


def safe_get_attribute(obj: Any, attr: str, default: Any = None) -> Any:
    """Safely get attribute from object."""
    try:
        return getattr(obj, attr, default)
    except Exception:
        return default


def build_meeting_list_response(meeting: Meeting) -> Optional[Dict[str, Any]]:
    """Build meeting response dictionary from ORM object."""
    if not meeting:
        return None
    
    try:
        return {
            "id": meeting.id,
            "title": meeting.title,
            "description": meeting.description,
            "meeting_date": safe_isoformat(meeting.meeting_date),
            "start_time": safe_isoformat(meeting.start_time),
            "end_time": safe_isoformat(meeting.end_time),
            "location_text": meeting.location_text,
            "status": {
                "id": meeting.status.id,
                "short_name": meeting.status.short_name,
                "name": meeting.status.name,
                "description": meeting.status.description,
                "color": safe_get_attribute(meeting.status, 'color'),
            } if meeting.status else None,
            "status_id": meeting.status_id,
            "participants_count": len(meeting.participants) if meeting.participants else 0,
            "created_by_id": meeting.created_by_id,
            "created_by": {
                "id": meeting.created_by.id,
                "full_name": safe_get_attribute(meeting.created_by, 'full_name'),
                "name": safe_get_attribute(meeting.created_by, 'name'),
                "email": safe_get_attribute(meeting.created_by, 'email'),
            } if meeting.created_by else None,
            "updated_by_id": meeting.updated_by_id,
            "updated_by": {
                "id": meeting.updated_by.id,
                "full_name": safe_get_attribute(meeting.updated_by, 'full_name'),
                "name": safe_get_attribute(meeting.updated_by, 'name'),
                "email": safe_get_attribute(meeting.updated_by, 'email'),
            } if meeting.updated_by else None,
            "created_at": safe_isoformat(meeting.created_at),
            "updated_at": safe_isoformat(meeting.updated_at),
            "is_active": meeting.is_active,
            "is_recurring": safe_get_attribute(meeting, 'is_recurring', False),
            "recurring_meeting_id": safe_get_attribute(meeting, 'recurring_meeting_id'),
            "total_occurrences_generated": safe_get_attribute(meeting, 'total_occurrences_generated', 0),
            "latitude": safe_get_attribute(meeting, 'latitude'),
            "longitude": safe_get_attribute(meeting, 'longitude'),
            "venue": safe_get_attribute(meeting, 'venue'),
            "district_office": safe_get_attribute(meeting, 'district_office'),
            "district": safe_get_attribute(meeting, 'district'),
            "region": safe_get_attribute(meeting, 'region'),
            "is_virtual": safe_get_attribute(meeting, 'is_virtual', False),
            "virtual_link": safe_get_attribute(meeting, 'virtual_link'),
            "is_mixed_mode": safe_get_attribute(meeting, 'is_mixed_mode', False),
        }
    except Exception as e:
        logger.error(f"Error building meeting response: {e}", exc_info=True)
        return None


async def build_meeting_items(
    meetings_list: List[Meeting],
    statuses_map: Optional[Dict[str, Attribute]] = None,
    is_geo_search: bool = False,
    lat: Optional[float] = None,
    lng: Optional[float] = None
) -> List[Dict[str, Any]]:
    """Build meeting response items with proper error handling."""
    items = []
    for meeting in meetings_list:
        try:
            participants_count = len(meeting.participants) if hasattr(meeting, 'participants') and meeting.participants else 0
            
            meeting_dict = {
                "id": str(meeting.id),
                "title": meeting.title,
                "description": meeting.description,
                "location_id": str(meeting.location_id) if meeting.location_id else None,
                "location_text": meeting.location_text,
                "gps_coordinates": meeting.gps_coordinates,
                "meeting_date": safe_isoformat(meeting.meeting_date),
                "start_time": safe_isoformat(meeting.start_time),
                "end_time": safe_isoformat(meeting.end_time),
                "agenda": meeting.agenda,
                "facilitator": meeting.facilitator,
                "chairperson_name": meeting.chairperson_name,
                "status_id": str(meeting.status_id) if meeting.status_id else None,
                "created_by_id": str(meeting.created_by_id) if meeting.created_by_id else None,
                "created_by_name": meeting.created_by_name,
                "created_at": safe_isoformat(meeting.created_at),
                "updated_by_id": str(meeting.updated_by_id) if meeting.updated_by_id else None,
                "updated_by_name": meeting.updated_by_name,
                "updated_at": safe_isoformat(meeting.updated_at),
                "is_active": meeting.is_active,
                "participants_count": participants_count,
                "visibility": meeting.visibility,
            }
            
            if meeting.status_id and statuses_map:
                status_obj = statuses_map.get(str(meeting.status_id))
                if status_obj:
                    meeting_dict["status"] = {
                        "id": str(status_obj.id),
                        "name": status_obj.name,
                        "short_name": safe_get_attribute(status_obj, "short_name"),
                        "color": safe_get_attribute(status_obj, "color"),
                        "hex_color": safe_get_attribute(status_obj, "hex_color"),
                        "bg_color": safe_get_attribute(status_obj, "bg_color"),
                        "description": safe_get_attribute(status_obj, "description"),
                    }
                else:
                    meeting_dict["status"] = None
                    logger.warning(f"⚠️ Status not found for meeting {meeting.id} (status_id: {meeting.status_id})")
            else:
                meeting_dict["status"] = None
                
            if is_geo_search and lat is not None and lng is not None:
                if hasattr(meeting, 'latitude') and meeting.latitude and hasattr(meeting, 'longitude') and meeting.longitude:
                    distance = calculate_distance(lat, lng, meeting.latitude, meeting.longitude)
                    meeting_dict["distance_km"] = distance
                
            items.append(meeting_dict)
        except Exception as e:
            logger.error(f"Error building meeting item for {meeting.id}: {e}", exc_info=True)
            continue
    
    return items


def build_minutes_response(minute: MeetingMinutes) -> Dict[str, Any]:
    """Build response for meeting minutes with error handling."""
    try:
        return {
            "id": minute.id,
            "meeting_id": minute.meeting_id,
            "topic": minute.topic,
            "discussion": minute.discussion,
            "decisions": minute.decisions,
            "timestamp": safe_isoformat(minute.timestamp),
            "recorded_by_id": minute.recorded_by_id,
            "recorded_by_name": minute.recorded_by.username if minute.recorded_by else None,
            "created_by_id": minute.created_by_id,
            "created_by_name": minute.created_by.username if minute.created_by else None,
            "created_at": safe_isoformat(minute.created_at),
            "updated_by_id": minute.updated_by_id,
            "updated_by_name": minute.updated_by.username if minute.updated_by else None,
            "updated_at": safe_isoformat(minute.updated_at),
            "is_active": minute.is_active,
            "is_default": safe_get_attribute(minute, 'is_default', False),
            "actions": [
                {
                    "id": action.id,
                    "minute_id": action.minute_id,
                    "description": action.description,
                    "assigned_to_id": action.assigned_to_id,
                    "assigned_to_name": action.assigned_to_name,
                    "due_date": safe_isoformat(action.due_date),
                    "priority": action.priority,
                    "remarks": action.remarks,
                    "completed_at": safe_isoformat(action.completed_at),
                    "overall_progress_percentage": action.overall_progress_percentage or 0,
                    "overall_status_name": action.overall_status_name,
                    "assigned_at": safe_isoformat(action.assigned_at),
                    "created_at": safe_isoformat(action.created_at),
                    "assigned_by_id": action.assigned_by_id,
                    "overall_status_id": action.overall_status_id,
                    "is_active": action.is_active,
                    "updated_at": safe_isoformat(action.updated_at),
                    "created_by_id": action.created_by_id,
                }
                for action in (minute.actions or [])
            ] if hasattr(minute, 'actions') else []
        }
    except Exception as e:
        logger.error(f"Error building minutes response: {e}", exc_info=True)
        return {}


def build_status_history_response(history: MeetingStatusHistory) -> Optional[MeetingStatusHistoryResponse]:
    """Build response for status history entry with error handling."""
    try:
        return MeetingStatusHistoryResponse(
            id=history.id,
            meeting_id=history.meeting_id,
            status_id=history.status_id,
            status_name=history.status.name if history.status else None,
            status_code=history.status.code if history.status else None,
            status_shortname=history.status.short_name if history.status else None,
            comment=history.comment,
            status_date=history.status_date,
            created_by_id=history.created_by_id,
            created_by_name=history.created_by.username if history.created_by else None,
            created_at=history.created_at,
            updated_by_id=history.updated_by_id,
            updated_by_name=history.updated_by.username if history.updated_by else None,
            updated_at=history.updated_at,
            is_active=history.is_active
        )
    except Exception as e:
        logger.error(f"Error building status history response: {e}", exc_info=True)
        return None


async def execute_db_operation(
    func: AsyncQueryFunc,
    max_retries: int = MAX_RETRIES,
    delay: float = RETRY_DELAY
) -> T:
    """
    Execute a database operation with retry logic.
    """
    last_exception = None
    current_delay = delay
    
    for attempt in range(max_retries):
        try:
            return await func()
        except (OperationalError, ConnectionError, TimeoutError) as e:
            last_exception = e
            if attempt < max_retries - 1:
                logger.warning(
                    f"Database operation failed (attempt {attempt + 1}/{max_retries}): {e}. "
                    f"Retrying in {current_delay}s..."
                )
                await asyncio.sleep(current_delay)
                current_delay *= 2
            else:
                logger.error(f"Database operation failed after {max_retries} attempts: {e}")
                raise
        except SQLAlchemyError as e:
            logger.error(f"SQLAlchemy error: {e}")
            raise
    
    if last_exception:
        raise last_exception
    raise RuntimeError("Database operation failed")

# ==================== ENDPOINTS ====================

@router.get("/stats")
async def get_meeting_stats(
    db: AsyncSession = Depends(deps.get_db),
    refresh: bool = Query(False, description="Force refresh the cache"),
):
    """
    Get meeting statistics for the dashboard with improved connection management.
    Results are cached for 5 minutes for better performance.
    """
    await _stats_cache.initialize()
    
    if not refresh:
        cached_stats = await _stats_cache.get_stats()
        if cached_stats:
            logger.info("Returning cached meeting stats")
            return cached_stats
    
    try:
        logger.info("Computing meeting stats from database...")
        
        async def get_stats_data():
            async with db.begin():
                async def get_total():
                    result = await db.execute(
                        select(func.count(Meeting.id)).where(Meeting.is_active == True)
                    )
                    return result.scalar() or 0
                
                async def get_upcoming():
                    today = date.today()
                    result = await db.execute(
                        select(func.count(Meeting.id)).where(
                            Meeting.meeting_date >= today,
                            Meeting.is_active == True
                        )
                    )
                    return result.scalar() or 0
                
                async def get_in_progress():
                    result = await db.execute(
                        select(func.count(Meeting.id))
                        .join(Attribute, Meeting.status_id == Attribute.id)
                        .where(
                            Attribute.short_name.in_(['started', 'ongoing', 'in_progress']),
                            Meeting.is_active == True
                        )
                    )
                    return result.scalar() or 0
                
                async def get_completed():
                    result = await db.execute(
                        select(func.count(Meeting.id))
                        .join(Attribute, Meeting.status_id == Attribute.id)
                        .where(
                            Attribute.short_name.in_(['ended', 'closed', 'completed']),
                            Meeting.is_active == True
                        )
                    )
                    return result.scalar() or 0
                
                async def get_cancelled():
                    result = await db.execute(
                        select(func.count(Meeting.id))
                        .join(Attribute, Meeting.status_id == Attribute.id)
                        .where(
                            Attribute.short_name == 'cancelled',
                            Meeting.is_active == True
                        )
                    )
                    return result.scalar() or 0
                
                async def get_today_meetings():
                    today = date.today()
                    result = await db.execute(
                        select(func.count(Meeting.id)).where(
                            Meeting.meeting_date == today,
                            Meeting.is_active == True
                        )
                    )
                    return result.scalar() or 0
                
                results = await asyncio.gather(
                    get_total(),
                    get_upcoming(),
                    get_in_progress(),
                    get_completed(),
                    get_cancelled(),
                    get_today_meetings(),
                    return_exceptions=True
                )
                
                total = results[0] if not isinstance(results[0], Exception) else 0
                upcoming = results[1] if not isinstance(results[1], Exception) else 0
                in_progress = results[2] if not isinstance(results[2], Exception) else 0
                completed = results[3] if not isinstance(results[3], Exception) else 0
                cancelled = results[4] if not isinstance(results[4], Exception) else 0
                today_meetings = results[5] if not isinstance(results[5], Exception) else 0
                
                return {
                    "total": total,
                    "upcoming": upcoming,
                    "in_progress": in_progress,
                    "completed": completed,
                    "cancelled": cancelled,
                    "today": today_meetings,
                    "high_priority": 0,
                    "cached": False,
                    "cached_at": datetime.now().isoformat(),
                }
        
        stats_data = await execute_db_operation(get_stats_data, max_retries=MAX_RETRIES)
        await _stats_cache.set_stats(stats_data)
        
        logger.info(f"Meeting stats computed: {stats_data}")
        return stats_data
        
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching meeting stats: {str(e)}", exc_info=True)
        stale_cache = await _stats_cache.get_stats()
        if stale_cache:
            stale_cache["cached"] = True
            stale_cache["stale"] = True
            stale_cache["error"] = str(e)
            return stale_cache
        
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please try again later."
        )
    except Exception as e:
        logger.error(f"Error fetching meeting stats: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stats: {str(e)}"
        )


@router.post("/stats/refresh")
async def refresh_meeting_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),  # ✅ Fixed
):
    """
    Force refresh the meeting stats cache.
    Requires authentication.
    """
    await _stats_cache.invalidate()
    
    response = await get_meeting_stats(db, refresh=True)
    
    return {
        "message": "Stats cache refreshed successfully",
        "data": response
    }


@router.get("/stats/status")
async def get_stats_cache_status(
    current_user: User = Depends(deps.get_current_user),  # ✅ Fixed
):
    """
    Get the current status of the stats cache.
    Requires authentication.
    """
    await _stats_cache.initialize()
    
    cached = await _stats_cache.get_stats()
    
    return {
        "cached": cached is not None,
        "ttl_seconds": CACHE_TTL,
        "cache_key": _stats_cache.CACHE_KEY,
        "redis_connected": _stats_cache._use_redis
    }


@router.get("/filter-options")
async def get_filter_options(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),  # ✅ Fixed
):
    """
    Get all available filter options for the meetings dropdown.
    Requires authentication.
    """
    today = date.today()
    
    status_result = await db.execute(
        select(Attribute).where(
            Attribute.is_active == True
        ).order_by(Attribute.name)
    )
    statuses = status_result.scalars().all()
    
    location_result = await db.execute(
        select(distinct(Meeting.location_text))
        .where(Meeting.is_active == True, Meeting.location_text.isnot(None))
        .order_by(Meeting.location_text)
    )
    locations = [loc for loc in location_result.scalars().all() if loc]
    
    district_result = await db.execute(
        select(distinct(Meeting.district_office))
        .where(Meeting.is_active == True, Meeting.district_office.isnot(None))
        .order_by(Meeting.district_office)
    )
    districts = [dist for dist in district_result.scalars().all() if dist]
    
    region_result = await db.execute(
        select(distinct(Meeting.region))
        .where(Meeting.is_active == True, Meeting.region.isnot(None))
        .order_by(Meeting.region)
    )
    regions = [reg for reg in region_result.scalars().all() if reg]
    
    date_range_result = await db.execute(
        select(
            func.min(Meeting.meeting_date).label("min_date"),
            func.max(Meeting.meeting_date).label("max_date")
        ).where(Meeting.is_active == True)
    )
    date_range = date_range_result.one()
    
    return {
        "statuses": [
            {
                "value": str(s.id),
                "label": s.name,
                "short_name": s.short_name,
                "color": safe_get_attribute(s, 'color', '#808080')
            }
            for s in statuses
        ],
        "locations": locations,
        "districts": districts,
        "regions": regions,
        "date_range": {
            "min": date_range.min_date.isoformat() if date_range.min_date else None,
            "max": date_range.max_date.isoformat() if date_range.max_date else None
        },
        "defaults": {
            "show_upcoming": True,
            "show_past": False,
            "limit": DEFAULT_PAGINATION_LIMIT
        }
    }


@router.get("/", response_model=MeetingPaginationResponse)
async def get_meetings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),  # ✅ Fixed
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(DEFAULT_PAGINATION_LIMIT, ge=1, le=MAX_PAGINATION_LIMIT, description="Items per page"),
    show_past: bool = Query(False, description="Include past meetings"),
    show_upcoming: bool = Query(True, description="Include upcoming meetings"),
    status_query: Optional[str] = Query(None, alias="status", description="Filter by status name"),
    status_filter: Optional[str] = Query(None, description="Filter by status name"),
    status_id: Optional[UUID] = Query(None, description="Filter by status UUID (preferred)"),
    search: Optional[str] = Query(None, description="Search by title or description"),
    location: Optional[str] = Query(None, description="Filter by location name"),
    district: Optional[str] = Query(None, description="Filter by district office"),
    region: Optional[str] = Query(None, description="Filter by region"),
    lat: Optional[float] = Query(None, description="Latitude for proximity search"),
    lng: Optional[float] = Query(None, description="Longitude for proximity search"),
    radius_km: Optional[float] = Query(RADIUS_MIN_KM, ge=RADIUS_MIN_KM, le=RADIUS_MAX_KM, description="Search radius in kilometers"),
    sort_by: str = Query("meeting_date", description="Sort field: meeting_date, title, created_at, updated_at"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
):
    """
    Get paginated list of meetings with comprehensive filtering.
    Uses improved connection management and error handling.
    """
    if status_query and not status_filter:
        status_filter = status_query

    skip = (page - 1) * limit
    today = date.today()

    try:
        async def execute_query():
            query = select(Meeting).options(
                selectinload(Meeting.participants),
                selectinload(Meeting.created_by),
                selectinload(Meeting.updated_by),
            ).where(Meeting.is_active == True)

            date_conditions = []
            if show_upcoming:
                date_conditions.append(Meeting.meeting_date >= today)
            if show_past:
                date_conditions.append(Meeting.meeting_date < today)

            if date_conditions:
                query = query.where(or_(*date_conditions))

            if status_id:
                query = query.where(Meeting.status_id == status_id)
            elif status_filter:
                status_filter_value = f"%{status_filter}%"
                matching_status_ids = select(Attribute.id).where(
                    or_(
                        Attribute.name.ilike(status_filter_value),
                        Attribute.short_name.ilike(status_filter_value),
                        Attribute.code.ilike(status_filter_value)
                    )
                )
                query = query.where(
                    cast(Meeting.status_id, String).in_(
                        select(cast(Attribute.id, String)).where(Attribute.id.in_(matching_status_ids))
                    )
                )

            if search:
                search_term = f"%{search}%"
                query = query.where(
                    or_(
                        Meeting.title.ilike(search_term),
                        Meeting.description.ilike(search_term)
                    )
                )

            if location:
                query = query.where(Meeting.location_text.ilike(f"%{location}%"))
            
            if district:
                query = query.where(Meeting.district_office.ilike(f"%{district}%"))
            
            if region:
                query = query.where(Meeting.region.ilike(f"%{region}%"))

            sort_column = getattr(Meeting, sort_by, Meeting.meeting_date)
            query = query.order_by(desc(sort_column) if sort_order.lower() == "desc" else asc(sort_column))

            paginated_query = query.offset(skip).limit(limit)
            result = await db.execute(paginated_query)
            meetings_list = result.scalars().all()

            status_ids = [m.status_id for m in meetings_list if m.status_id]
            statuses_map = {}
            if status_ids:
                status_id_strings = [str(sid) for sid in status_ids]
                status_result = await db.execute(
                    select(Attribute).where(
                        cast(Attribute.id, String).in_(status_id_strings),
                        Attribute.is_active == True
                    )
                )
                for status_obj in status_result.scalars().all():
                    statuses_map[str(status_obj.id)] = status_obj

            count_query = select(func.count(Meeting.id)).where(Meeting.is_active == True)
            if date_conditions:
                count_query = count_query.where(or_(*date_conditions))
            if status_id:
                count_query = count_query.where(Meeting.status_id == status_id)
            if search:
                search_term = f"%{search}%"
                count_query = count_query.where(
                    or_(
                        Meeting.title.ilike(search_term),
                        Meeting.description.ilike(search_term)
                    )
                )
            
            count_res = await db.execute(count_query)
            total_count = count_res.scalar() or 0

            return meetings_list, statuses_map, total_count
        
        meetings_list, statuses_map, total_count = await execute_db_operation(
            execute_query, max_retries=2
        )

        items = await build_meeting_items(
            meetings_list, statuses_map, 
            is_geo_search=lat is not None, 
            lat=lat, lng=lng
        )
        
        return MeetingPaginationResponse(
            items=items,
            total=total_count,
            page=page,
            size=limit,
            pages=(total_count + limit - 1) // limit
        )
        
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching meetings: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please try again later."
        )
    except Exception as e:
        logger.error(f"Error fetching meetings: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch meetings: {str(e)}"
        )


@router.post("/", response_model=MeetingCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),  # ✅ Fixed
):
    """
    Create a new meeting with audit fields and improved error handling.
    """
    try:
        meeting_dict = meeting_in.model_dump(exclude_unset=True)
        fields_to_remove = [
            'has_online_meeting', 'has_physical_meeting', 'platform',
            'meeting_link', 'passcode', 'dial_in_numbers', 'venue',
            'address', 'location_instructions', 'send_reminders',
            'reminder_minutes_before', 'meeting_id_online', 'meeting_id',
            'status', 'participant_list_id'
        ]
        for field in fields_to_remove:
            meeting_dict.pop(field, None)
        
        async def create_meeting_transaction():
            result = await meeting_crud.create_with_participants(
                db, meeting_dict, current_user.id
            )
            await db.commit()
            return result
        
        result = await execute_db_operation(create_meeting_transaction, max_retries=2)
        await _stats_cache.invalidate()
        
        return MeetingCreateResponse(
            id=result.id,
            title=result.title,
            description=result.description,
            meeting_date=result.meeting_date,
            start_time=result.start_time,
            end_time=result.end_time,
            location_text=result.location_text,
            agenda=result.agenda,
            facilitator=result.facilitator,
            chairperson_name=result.chairperson_name,
            status_id=result.status_id,
            created_by_id=result.created_by_id,
            created_by_name=current_user.username,
            created_at=result.created_at,
            updated_by_id=None,
            updated_by_name=None,
            updated_at=None,
            is_active=result.is_active,
            message="Meeting created successfully"
        )
        
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Database error creating meeting: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please try again later."
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating meeting: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create meeting: {str(e)}"
        )


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)  # ✅ Fixed
):
    """
    Get meeting by ID with proper connection management.
    """
    try:
        async def get_meeting_query():
            return await meeting_crud.get_meeting_with_details(db, meeting_id)
        
        meeting = await execute_db_operation(get_meeting_query, max_retries=2)
        
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        return await utils_build_meeting_response(meeting, db)
        
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching meeting {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please try again later."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching meeting {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch meeting: {str(e)}"
        )


@router.patch("/{meeting_id}/status", response_model=MeetingResponse)
async def update_meeting_status(
    meeting_id: UUID,
    status_value: str = Query(..., alias="status"),
    comment: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),  # ✅ Fixed
):
    """
    Update meeting status with audit trail and improved error handling.
    """
    try:
        meeting = await get_meeting_or_404(db, meeting_id)
        status_info = await get_status_by_short_name(db, status_value)
        
        if not status_info:
            valid = await get_valid_status_short_names(db)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Valid: {', '.join(valid)}"
            )
        
        async def update_status_transaction():
            meeting.status_id = status_info.id
            meeting.updated_by_id = current_user.id
            meeting.updated_at = datetime.now()
            
            history_entry = MeetingStatusHistory(
                id=uuid.uuid4(),
                meeting_id=meeting_id,
                status_id=status_info.id,
                comment=comment or f"Status updated to {status_value}",
                status_date=datetime.now(),
                created_by_id=current_user.id,
                created_at=datetime.now(),
                is_active=True
            )
            db.add(history_entry)
            await db.commit()
            await db.refresh(meeting)
            return await meeting_crud.get_meeting_with_details(db, meeting_id)
        
        updated_meeting = await execute_db_operation(update_status_transaction, max_retries=2)
        await _stats_cache.invalidate()
        
        return await utils_build_meeting_response(updated_meeting, db)
        
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Database error updating meeting status {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please try again later."
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating meeting status {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update meeting status: {str(e)}"
        )


@router.get("/{meeting_id}/minutes", response_model=List[MeetingMinutesResponse])
async def get_meeting_minutes(
    meeting_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)  # ✅ Fixed
):
    """
    Get all minutes for a meeting with improved connection handling.
    """
    try:
        async def get_minutes_query():
            query = select(MeetingMinutes).where(
                MeetingMinutes.meeting_id == meeting_id,
                MeetingMinutes.is_active == True
            ).order_by(desc(MeetingMinutes.created_at))
            result = await db.execute(query.offset(skip).limit(limit))
            return result.scalars().all()
        
        minutes = await execute_db_operation(get_minutes_query, max_retries=2)
        return [build_minutes_response(m) for m in minutes if m]
        
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching minutes for meeting {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please try again later."
        )
    except Exception as e:
        logger.error(f"Error fetching minutes for meeting {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch minutes: {str(e)}"
        )


@router.post("/{meeting_id}/minutes", response_model=MeetingMinutesResponse, status_code=status.HTTP_201_CREATED)
async def add_meeting_minutes(
    meeting_id: UUID,
    minutes_in: MeetingMinutesCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),  # ✅ Fixed
):
    """
    Add minutes to meeting with audit fields and improved error handling.
    """
    try:
        await get_meeting_or_404(db, meeting_id)
        
        async def create_minutes_transaction():
            now = datetime.now()
            minute = MeetingMinutes(
                meeting_id=meeting_id,
                topic=minutes_in.topic or f"Minutes - {now.strftime('%Y-%m-%d')}",
                discussion=minutes_in.discussion,
                decisions=minutes_in.decisions,
                timestamp=now,
                recorded_by_id=current_user.id,
                created_by_id=current_user.id,
                created_at=now,
                is_active=True
            )
            db.add(minute)
            await db.commit()
            await db.refresh(minute)
            return minute
        
        minute = await execute_db_operation(create_minutes_transaction, max_retries=2)
        return minute
        
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Database error adding minutes to meeting {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please try again later."
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error adding minutes to meeting {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add minutes: {str(e)}"
        )


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),  # ✅ Fixed
):
    """
    Soft delete meeting (set is_active=False) with audit and error handling.
    """
    try:
        meeting_obj = await get_meeting_or_404(db, meeting_id)
        
        async def delete_transaction():
            meeting_obj.is_active = False
            meeting_obj.updated_by_id = current_user.id
            meeting_obj.updated_at = datetime.now()
            await db.commit()
        
        await execute_db_operation(delete_transaction, max_retries=2)
        await _stats_cache.invalidate()
        
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Database error deleting meeting {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please try again later."
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting meeting {meeting_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete meeting: {str(e)}"
        )
    


# ==================== MEETING PARTICIPANTS ENDPOINTS ====================

@router.get("/{meeting_id}/members", response_model=List[MeetingParticipantResponse])
async def get_meeting_participants(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get all participants for a meeting with privacy protection.
    Phone and email are partially masked for privacy.
    """
    try:
        # Check if meeting exists
        meeting = await db.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = meeting.scalar_one_or_none()
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        # Get all participants for this meeting
        result = await db.execute(
            select(MeetingParticipant).where(
                MeetingParticipant.meeting_id == meeting_id,
                MeetingParticipant.is_active == True
            )
        )
        participants = result.scalars().all()
        
        # Prepare response - partially mask phone and email
        response_participants = []
        for p in participants:
            participant_dict = {
                "id": p.id,
                "meeting_id": p.meeting_id,
                # FIX: Use participant_id instead of user_id (or check the actual field name)
                "participant_id": getattr(p, 'participant_id', None),
                "name": p.name,
                "title": getattr(p, 'title', None),
                "organization": getattr(p, 'organization', None),
                "is_chairperson": getattr(p, 'is_chairperson', False),
                "is_secretary": getattr(p, 'is_secretary', False),
                "attendance_status": getattr(p, 'attendance_status', 'pending'),
                "apology_comment": getattr(p, 'apology_comment', None),
                "created_at": p.created_at,
                "updated_at": getattr(p, 'updated_at', None),
                "is_active": p.is_active,
                "email": mask_email(p.email) if hasattr(p, 'email') and p.email else None,
                "telephone": mask_phone_number(p.telephone) if hasattr(p, 'telephone') and p.telephone else None,
            }
            response_participants.append(participant_dict)
        
        return response_participants
        
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching participants: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error"
        )




@router.post("/{meeting_id}/members", response_model=MeetingParticipantResponse)
async def add_meeting_participant(
    meeting_id: UUID,
    participant_data: MeetingParticipantCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Add a participant to a meeting
    """
    try:
        # Check if meeting exists
        meeting = await db.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = meeting.scalar_one_or_none()
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        # Check if participant already exists
        existing = await db.execute(
            select(MeetingParticipant).where(
                MeetingParticipant.meeting_id == meeting_id,
                MeetingParticipant.user_id == participant_data.user_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Participant already added to this meeting"
            )
        
        # Create new meeting participant
        new_participant = MeetingParticipant(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            user_id=participant_data.user_id,
            name=participant_data.name,
            email=participant_data.email,
            telephone=participant_data.telephone,
            title=participant_data.title,
            organization=participant_data.organization,
            is_chairperson=participant_data.is_chairperson or False,
            is_secretary=participant_data.is_secretary or False,
            attendance_status=participant_data.attendance_status or "pending",
            apology_comment=participant_data.apology_comment,
            created_by_id=current_user.id,
            created_at=datetime.now(),
            is_active=True
        )
        
        db.add(new_participant)
        await db.commit()
        await db.refresh(new_participant)
        return new_participant
        
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Database error adding participant: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error"
        )


@router.delete("/{meeting_id}/members/{participant_id}")
async def remove_meeting_participant(
    meeting_id: UUID,
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Remove a participant from a meeting
    """
    try:
        result = await db.execute(
            select(MeetingParticipant).where(
                MeetingParticipant.id == participant_id,
                MeetingParticipant.meeting_id == meeting_id
            )
        )
        participant = result.scalar_one_or_none()
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        # Soft delete
        participant.is_active = False
        participant.updated_by_id = current_user.id
        participant.updated_at = datetime.now()
        
        await db.commit()
        return {"message": "Participant removed successfully"}
        
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Database error removing participant: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error"
        )


@router.patch("/{meeting_id}/members/{participant_id}", response_model=MeetingParticipantResponse)
async def update_meeting_participant(
    meeting_id: UUID,
    participant_id: UUID,
    participant_data: MeetingParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update a meeting participant's details
    """
    try:
        result = await db.execute(
            select(MeetingParticipant).where(
                MeetingParticipant.id == participant_id,
                MeetingParticipant.meeting_id == meeting_id
            )
        )
        participant = result.scalar_one_or_none()
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        # Update fields
        update_data = participant_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(participant, key, value)
        
        participant.updated_by_id = current_user.id
        participant.updated_at = datetime.now()
        
        await db.commit()
        await db.refresh(participant)
        return participant
        
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Database error updating participant: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error"
        )


# Also add the PATCH endpoint for attendance status (used by ParticipantsTab)
@router.patch("/{meeting_id}/participants/{participant_id}")
async def update_participant_attendance(
    meeting_id: UUID,
    participant_id: UUID,
    attendance_data: dict,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update a participant's attendance status
    """
    try:
        result = await db.execute(
            select(MeetingParticipant).where(
                MeetingParticipant.id == participant_id,
                MeetingParticipant.meeting_id == meeting_id
            )
        )
        participant = result.scalar_one_or_none()
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        # Update attendance fields
        if 'attendance_status' in attendance_data:
            participant.attendance_status = attendance_data['attendance_status']
        if 'apology_comment' in attendance_data:
            participant.apology_comment = attendance_data['apology_comment']
        
        participant.updated_by_id = current_user.id
        participant.updated_at = datetime.now()
        
        await db.commit()
        await db.refresh(participant)
        return participant
        
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Database error updating attendance: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error"
        )
    


# ==================== PRIVACY HELPER FUNCTIONS ====================

def mask_phone_number(phone: str) -> str:
    """
    Mask a phone number for privacy.
    Shows first 2 and last 2 digits, hides the rest with asterisks.
    Example: +256789123456 -> +2******56
    """
    if not phone:
        return None
    
    # Remove any non-digit characters for counting
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) <= 4:
        return phone
    
    # Find where the digits start in the original string
    # Keep the prefix (like +, 0, etc.)
    prefix = ''
    for char in phone:
        if char.isdigit():
            break
        prefix += char
    
    # Get first 2 and last 2 digits
    first_two = digits[:2]
    last_two = digits[-2:]
    masked_digits = first_two + '*' * (len(digits) - 4) + last_two
    
    return prefix + masked_digits


def mask_email(email: str) -> str:
    """
    Mask an email address for privacy.
    Shows first 2 characters and the domain, hides the rest.
    Example: john.doe@example.com -> jo***@example.com
    """
    if not email:
        return None
    
    parts = email.split('@')
    if len(parts) != 2:
        # If no domain, just mask the email
        if len(email) <= 3:
            return email[0] + '*' * (len(email) - 1)
        return email[:2] + '*' * (len(email) - 2)
    
    local_part = parts[0]
    domain = parts[1]
    
    if len(local_part) <= 2:
        # If local part is very short, just show first character and asterisks
        masked_local = local_part[0] + '*' * (len(local_part) - 1)
    else:
        # Show first 2 characters, then asterisks for the rest
        masked_local = local_part[:2] + '*' * (len(local_part) - 2)
    
    return f"{masked_local}@{domain}"
