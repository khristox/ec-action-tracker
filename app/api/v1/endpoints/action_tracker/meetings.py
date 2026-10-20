"""
Meeting Management API - Access Control Version with Recurring Support

Features:
- Meeting-specific permissions (Owner/Organizer/Participant/Viewer)
- Email-based participant identification
- Granular stats (created vs participated)
- Recurring meeting support
- Excludes recurring meetings by default
- Full CRUD operations with permission checks
- Audit logging for all operations
- Department-hierarchy visibility and department filter (see meeting_visibility.py)
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, date
from enum import Enum
from typing import List, Optional, Dict, Any, Callable, TypeVar, Tuple
from uuid import UUID
from pydantic import BaseModel

from app.api.v1.endpoints.action_tracker.meetings_access_control import AccessLevel, DepartmentAccessControl, check_meeting_access_or_403
from app.api.v1.endpoints.action_tracker.utils import build_meeting_response
from app.api.v1.endpoints.action_tracker.audit_logger import log_audit  # ✅ ADDED
from app.api.v1.endpoints.action_tracker.meeting_visibility import (
    build_meeting_access_filter, build_department_filter,
)
from app.models.notification import Notification, NotificationChannel, NotificationStatus
from app.services.notification_service import NotificationService
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy import and_, distinct, func, select, or_, desc, asc, cast, String, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import SQLAlchemyError, OperationalError

from app.api import deps
from app.core.config import settings
from app.core.admin_access import is_admin_user
from app.models.meetings.action_tracker import (
    Meeting, MeetingAction, MeetingParticipant, MeetingStatusHistory, MeetingMinutes
)
from app.models.general.dynamic_attribute import Attribute
from app.models.user import User
from app.schemas.action_tracker import (
    MeetingCreateResponse, MeetingMinutesResponse, MeetingPaginationResponse,
    MeetingCreate, MeetingParticipantCreate, MeetingParticipantResponse,
    MeetingParticipantUpdate, MeetingResponse, MeetingUpdate, NotificationRequest
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== CONSTANTS & ENUMS ====================

EARTH_RADIUS_KM = 6371
DEFAULT_PAGINATION_LIMIT = 12
MAX_PAGINATION_LIMIT = 100
CACHE_TTL = 300  # 5 minutes
MAX_RETRIES = 3
RETRY_DELAY = 1

T = TypeVar('T')

class MeetingPermission(str, Enum):
    """Meeting access permissions"""
    OWNER = "owner"  # Can edit, delete, manage participants
    ORGANIZER = "organizer"  # Can view, manage participants (if given permission)
    PARTICIPANT = "participant"  # Can view and possibly edit actions
    VIEWER = "viewer"  # Read-only access
    NONE = "none"  # No access

class MeetingAccessRole(str, Enum):
    """User's role in a meeting"""
    CREATOR = "creator"
    CHAIRPERSON = "chairperson"
    SECRETARY = "secretary"
    PARTICIPANT = "participant"


# ==================== PERMISSION SYSTEM ====================

def _norm_email(value: Optional[str]) -> str:
    """Normalize an email for comparison (trim + lowercase)."""
    return (value or "").strip().lower()


class AccessControl:
    """
    Check if user has access to a meeting.
    Note: This is about VISIBILITY, not ACTIONS.
    """

    @staticmethod
    async def can_access_meeting(
        db: AsyncSession,
        meeting_id: UUID,
        user_id: UUID,
        user_email: str,
        is_superuser: bool = False
    ) -> bool:
        """
        Check if user can ACCESS (view) a meeting.
        
        User can access if:
        1. Is superuser
        2. Created the meeting
        3. Is a participant (by email, case-insensitive)
        4. Meeting is open/public
        """
        
        if is_superuser:
            return True
        
        try:
            result = await db.execute(
                select(Meeting).options(
                    selectinload(Meeting.participants)
                ).where(Meeting.id == meeting_id)
            )
            meeting = result.scalar_one_or_none()
            
            if not meeting:
                return False
            
            # Creator always has access
            if meeting.created_by_id == user_id:
                return True
            
            # Check if participant
            if meeting.participants:
                email_norm = _norm_email(user_email)
                for participant in meeting.participants:
                    if (_norm_email(participant.email) == email_norm and 
                        participant.is_active):
                        return True
            
            # Check visibility
            visibility = getattr(meeting, 'visibility', 'open')
            return visibility == 'open'
            
        except Exception as e:
            logger.error(f"Error checking meeting access: {e}")
            return False


class PermissionChecker:
    """
    Centralized permission management.
    Determines user permissions based on role and meeting state.
    Works with email-based participant identification.
    """

    @staticmethod
    async def get_user_permission(
        db: AsyncSession,
        meeting_id: UUID,
        user_id: UUID,
        is_superuser: bool = False
    ) -> MeetingPermission:
        """Determine user's permission level for a meeting"""
        
        if is_superuser:
            return MeetingPermission.OWNER
        
        try:
            # Get user's email first
            user_email = await PermissionChecker._get_user_email(db, user_id)
            if not user_email:
                return MeetingPermission.NONE
            
            # Fetch meeting with participants
            result = await db.execute(
                select(Meeting).options(
                    selectinload(Meeting.participants)
                ).where(Meeting.id == meeting_id)
            )
            meeting = result.scalar_one_or_none()
            
            if not meeting:
                return MeetingPermission.NONE
            
            # Creator has full access
            if meeting.created_by_id == user_id:
                return MeetingPermission.OWNER
            
            # Check if user is a participant by email (case-insensitive)
            if meeting.participants:
                email_norm = _norm_email(user_email)
                for participant in meeting.participants:
                    if _norm_email(participant.email) == email_norm and participant.is_active:
                        # Chairperson or Secretary has organizer access
                        if participant.is_chairperson or participant.is_secretary:
                            return MeetingPermission.ORGANIZER
                        return MeetingPermission.PARTICIPANT
            
            # Meeting visibility check
            visibility = getattr(meeting, 'visibility', 'open')
            if visibility == 'open':
                return MeetingPermission.VIEWER
            
            return MeetingPermission.NONE
            
        except Exception as e:
            logger.error(f"Error determining permission: {e}")
            return MeetingPermission.NONE

    @staticmethod
    async def get_user_role(
        db: AsyncSession,
        meeting_id: UUID,
        user_id: UUID
    ) -> Optional[MeetingAccessRole]:
        """Get user's specific role in meeting"""
        
        try:
            # Check if creator
            result = await db.execute(
                select(Meeting).where(
                    Meeting.id == meeting_id,
                    Meeting.created_by_id == user_id
                )
            )
            if result.scalar_one_or_none():
                return MeetingAccessRole.CREATOR
            
            # Get user email
            user_email = await PermissionChecker._get_user_email(db, user_id)
            if not user_email:
                return None
            
            # Check participant role by email (case-insensitive)
            result = await db.execute(
                select(MeetingParticipant).where(
                    MeetingParticipant.meeting_id == meeting_id,
                    func.lower(MeetingParticipant.email) == _norm_email(user_email),
                    MeetingParticipant.is_active == True
                )
            )
            participant = result.scalars().first()
            
            if participant:
                if participant.is_chairperson:
                    return MeetingAccessRole.CHAIRPERSON
                if participant.is_secretary:
                    return MeetingAccessRole.SECRETARY
                return MeetingAccessRole.PARTICIPANT
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user role: {e}")
            return None

    @staticmethod
    async def _get_user_email(db: AsyncSession, user_id: UUID) -> Optional[str]:
        """Get user email from user ID"""
        try:
            result = await db.execute(
                select(User.email).where(User.id == user_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching user email: {e}")
            return None

    @staticmethod
    def require_permission(*permissions: MeetingPermission):
        """Decorator to check permissions"""
        def decorator(func):
            async def wrapper(*args, **kwargs):
                user_permission = kwargs.get('user_permission')
                if user_permission not in permissions:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Required permissions: {[p.value for p in permissions]}"
                    )
                return await func(*args, **kwargs)
            return wrapper
        return decorator


# ==================== STATISTICS WITH PERMISSIONS ====================

class StatsCache:
    """
    Enhanced stats cache with permission-aware statistics.
    """
    
    _memory_cache: Dict[str, tuple] = {}
    
    def __init__(self):
        self.redis = None
        self._use_redis = False
    
    async def initialize(self):
        """Initialize Redis connection"""
        try:
            import redis.asyncio as redis_lib
            self.redis = await redis_lib.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=10,
                socket_timeout=5,
            )
            self._use_redis = True
            logger.info("✅ Redis initialized for stats caching")
        except Exception as e:
            logger.warning(f"⚠️ Redis unavailable: {e}. Using in-memory cache.")
            self._use_redis = False
    
    async def get(self, key: str) -> Optional[Dict]:
        """Get from cache"""
        try:
            if self._use_redis and self.redis:
                cached = await self.redis.get(key)
                return json.loads(cached) if cached else None
        except Exception as e:
            logger.warning(f"Cache read error: {e}")
        
        if key in self._memory_cache:
            data, expiry = self._memory_cache[key]
            if datetime.now() < expiry:
                return data
            else:
                del self._memory_cache[key]
        return None
    
    async def set(self, key: str, value: Dict, ttl: int = CACHE_TTL):
        """Set in cache"""
        try:
            if self._use_redis and self.redis:
                await self.redis.setex(key, ttl, json.dumps(value))
            else:
                self._memory_cache[key] = (value, datetime.now() + timedelta(seconds=ttl))
        except Exception as e:
            logger.warning(f"Cache write error: {e}")
    
    async def delete(self, key: str):
        """Delete from cache"""
        try:
            if self._use_redis and self.redis:
                await self.redis.delete(key)
            self._memory_cache.pop(key, None)
        except Exception as e:
            logger.warning(f"Cache delete error: {e}")

_stats_cache = StatsCache()


# ==================== HELPER FUNCTIONS ====================

def safe_isoformat(value: Optional[datetime]) -> Optional[str]:
    """Safely convert datetime to ISO format"""
    return value.isoformat() if value else None

async def retry_db_operation(
    func: Callable,
    max_retries: int = MAX_RETRIES,
    delay: float = RETRY_DELAY
) -> Any:
    """Execute DB operation with retry logic"""
    last_error = None
    current_delay = delay
    
    for attempt in range(max_retries):
        try:
            return await func()
        except (OperationalError, ConnectionError, TimeoutError) as e:
            last_error = e
            if attempt < max_retries - 1:
                logger.warning(
                    f"DB operation failed (attempt {attempt + 1}/{max_retries}), "
                    f"retrying in {current_delay}s..."
                )
                await asyncio.sleep(current_delay)
                current_delay *= 2
        except SQLAlchemyError as e:
            logger.error(f"SQLAlchemy error: {e}")
            raise
    
    raise last_error or RuntimeError("DB operation failed after retries")


# ==================== STATS COMPUTATION ====================

class StatsComputer:
    """Compute meeting statistics with permission awareness"""
    
    @staticmethod
    async def compute_user_stats(
        db: AsyncSession,
        user_id: UUID,
        user_email: str
    ) -> Dict[str, Any]:
        """
        Compute personalized stats separated by creator vs participant.
        
        Returns:
        {
            "created": { "total": 5, "upcoming": 2, "in_progress": 1, "completed": 2, "today": 0 },
            "participating": { "total": 10, "upcoming": 5, "in_progress": 2, "completed": 3, "today": 1 },
            "total": { "total": 15, "upcoming": 7, "in_progress": 3, "completed": 5, "today": 1 },
            "user_id": "...",
            "cached_at": "...",
        }
        """
        
        today = date.today()
        
        # Meetings created by user
        created_stats = await StatsComputer._compute_category_stats(
            db, user_id, user_email, category="created", today=today
        )
        
        # Meetings user participates in (but didn't create)
        participating_stats = await StatsComputer._compute_category_stats(
            db, user_id, user_email, category="participating", today=today
        )
        
        # Combined stats
        total_stats = {
            "total": (created_stats["total"] or 0) + (participating_stats["total"] or 0),
            "upcoming": (created_stats["upcoming"] or 0) + (participating_stats["upcoming"] or 0),
            "in_progress": (created_stats["in_progress"] or 0) + (participating_stats["in_progress"] or 0),
            "completed": (created_stats["completed"] or 0) + (participating_stats["completed"] or 0),
            "today": (created_stats["today"] or 0) + (participating_stats["today"] or 0),
        }
        
        return {
            "created": created_stats,
            "participating": participating_stats,
            "total": total_stats,
            "user_id": str(user_id),
            "cached_at": datetime.now().isoformat(),
        }
    
    @staticmethod
    async def _compute_category_stats(
        db: AsyncSession,
        user_id: UUID,
        user_email: str,
        category: str,  # "created" or "participating"
        today: date
    ) -> Dict[str, Any]:
        """Compute stats for a specific category"""
        
        try:
            if category == "created":
                # Meetings created by user
                query = select(Meeting).where(
                    Meeting.created_by_id == user_id,
                    Meeting.is_active == True
                )
            elif category == "participating":
                # Meetings user participates in (but didn't create)
                query = select(Meeting).where(
                    Meeting.participants.any(
                        and_(
                            func.lower(MeetingParticipant.email) == _norm_email(user_email),
                            MeetingParticipant.is_active == True
                        )
                    ),
                    Meeting.created_by_id != user_id,  # Exclude created meetings
                    Meeting.is_active == True
                )
            else:
                return {
                    "total": 0, "upcoming": 0, "in_progress": 0, 
                    "completed": 0, "today": 0
                }
            
            # Get all meetings for this category
            meetings_result = await db.execute(query)
            meetings = meetings_result.scalars().all()
            
            if not meetings:
                return {
                    "total": 0, "upcoming": 0, "in_progress": 0, 
                    "completed": 0, "today": 0
                }
            
            # Get status IDs for filtering
            status_result = await db.execute(
                select(Attribute.id, Attribute.short_name).where(
                    Attribute.short_name.in_(['started', 'ongoing', 'completed'])
                )
            )
            status_map = {row[1]: row[0] for row in status_result.fetchall()}
            in_progress_statuses = {
                status_map.get('started'),
                status_map.get('ongoing')
            }
            
            # Compute stats from meeting data
            total = len(meetings)
            upcoming = sum(1 for m in meetings if m.meeting_date and m.meeting_date >= today)
            in_progress = sum(1 for m in meetings if m.status_id in in_progress_statuses)
            completed = sum(1 for m in meetings if m.status_id == status_map.get('completed'))
            today_count = sum(1 for m in meetings if m.meeting_date and m.meeting_date == today)
            
            return {
                "total": total,
                "upcoming": upcoming,
                "in_progress": in_progress,
                "completed": completed,
                "today": today_count,
            }
            
        except Exception as e:
            logger.error(f"Error computing {category} stats: {e}")
            return {
                "total": 0, "upcoming": 0, "in_progress": 0, 
                "completed": 0, "today": 0
            }


# ==================== ENDPOINTS ====================

class AttendanceStatus(str, Enum):
    pending = "pending"
    attended = "attended"
    absent = "absent"
    absent_with_apology = "absent_with_apology"


class MemberIn(BaseModel):
    user_id: Optional[UUID] = None
    name: str
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    is_chairperson: bool = False
    is_secretary: bool = False
    attendance_status: AttendanceStatus = AttendanceStatus.pending
    apology_comment: Optional[str] = None


class MemberPatch(BaseModel):
    attendance_status: Optional[AttendanceStatus] = None
    apology_comment: Optional[str] = None


async def _require_manage(db, meeting_id: UUID, user: User):
    perm = await PermissionChecker.get_user_permission(
        db, meeting_id, user.id, is_admin_user(user)
    )
    if perm not in (MeetingPermission.OWNER, MeetingPermission.ORGANIZER):
        raise HTTPException(403, "Only the owner, chairperson or secretary can do this")


async def _get_member(db, meeting_id: UUID, member_id: UUID) -> MeetingParticipant:
    member = (await db.execute(
        select(MeetingParticipant).where(
            MeetingParticipant.id == member_id,
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True,
        )
    )).scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member not found")
    return member

@router.get("/series/{recurring_meeting_id}/actions")
async def get_series_actions(
    recurring_meeting_id: UUID,
    include_completed: bool = Query(True),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """All actions from every occurrence of a recurring meeting."""
    access = await build_meeting_access_filter(db, current_user)

    query = (
        select(MeetingAction)
        .join(MeetingMinutes, MeetingAction.minute_id == MeetingMinutes.id)
        .join(Meeting, MeetingMinutes.meeting_id == Meeting.id)
        .where(
            Meeting.recurring_meeting_id == recurring_meeting_id,
            Meeting.is_active == True,
            MeetingMinutes.is_active == True,
            MeetingAction.is_active == True,
            access,
        )
        .options(
            selectinload(MeetingAction.implementers),
            selectinload(MeetingAction.overall_status),
            selectinload(MeetingAction.minutes).selectinload(MeetingMinutes.meeting),
        )
        .order_by(MeetingAction.due_date.asc().nulls_last(), MeetingAction.created_at.desc())
    )
    if not include_completed:
        query = query.where(MeetingAction.completed_at.is_(None))

    actions = (await db.execute(query)).scalars().all()

    items = []
    for a in actions:
        d = a.to_dict(include_relationships=True)
        m = a.minutes.meeting if a.minutes else None
        d["meeting_id"] = str(m.id) if m else None
        d["meeting_title"] = m.title if m else None
        d["meeting_date"] = m.meeting_date.isoformat() if m and m.meeting_date else None
        d["occurrence_number"] = m.occurrence_number if m else None
        items.append(d)

    return {
        "items": items,
        "total": len(items),
        "open": sum(1 for i in items if not i["is_completed"]),
        "completed": sum(1 for i in items if i["is_completed"]),
    }


@router.post("/{meeting_id}/members", status_code=201)
async def add_member(meeting_id: UUID, data: MemberIn,
                     db: AsyncSession = Depends(deps.get_db),
                     current_user: User = Depends(deps.get_current_user)):
    await _require_manage(db, meeting_id, current_user)

    email = data.email
    if data.user_id:
        email = (await db.execute(
            select(User.email).where(User.id == data.user_id)
        )).scalar_one_or_none() or email
    email = _norm_email(email)
    if not email:
        raise HTTPException(400, "An email address is required")

    dup = (await db.execute(
        select(MeetingParticipant.id).where(
            MeetingParticipant.meeting_id == meeting_id,
            func.lower(MeetingParticipant.email) == email,
            MeetingParticipant.is_active == True,
        )
    )).first()
    if dup:
        raise HTTPException(409, "This person is already a participant")

    member = MeetingParticipant(
        id=uuid.uuid4(), meeting_id=meeting_id, name=data.name.strip(), email=email,
        telephone=data.telephone, title=data.title, organization=data.organization,
        is_chairperson=data.is_chairperson, is_secretary=data.is_secretary,
        attendance_status=data.attendance_status.value,
        apology_comment=data.apology_comment,
        created_by_id=current_user.id, is_active=True,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member.to_dict()


@router.put("/{meeting_id}/members/{member_id}")
@router.patch("/{meeting_id}/members/{member_id}")
async def update_member(meeting_id: UUID, member_id: UUID, data: MemberPatch,
                        db: AsyncSession = Depends(deps.get_db),
                        current_user: User = Depends(deps.get_current_user)):
    await _require_manage(db, meeting_id, current_user)
    member = await _get_member(db, meeting_id, member_id)
    changes = data.model_dump(exclude_unset=True)
    if "attendance_status" in changes and changes["attendance_status"]:
        member.attendance_status = changes["attendance_status"].value
    if "apology_comment" in changes:
        member.apology_comment = changes["apology_comment"]
    member.updated_by_id = current_user.id
    await db.commit()
    await db.refresh(member)
    return member.to_dict()

@router.get("/{meeting_id}/members")
async def list_members(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    await _require_manage(db, meeting_id, current_user)   # or a looser check
    rows = (await db.execute(
        select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True,
        ).order_by(MeetingParticipant.name)
    )).scalars().all()
    return [m.to_dict() for m in rows]

@router.delete("/{meeting_id}/members/{member_id}", status_code=204)
async def remove_member(meeting_id: UUID, member_id: UUID,
                        db: AsyncSession = Depends(deps.get_db),
                        current_user: User = Depends(deps.get_current_user)):
    await _require_manage(db, meeting_id, current_user)
    member = await _get_member(db, meeting_id, member_id)
    member.is_active = False
    member.updated_by_id = current_user.id
    await db.commit()

@router.get("/stats")
async def get_meeting_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    refresh: bool = Query(False),
):
    """
    Get personalized meeting statistics (cached per user).
    
    ✅ Improved:
    - Separated stats by created vs participating
    - Permission-aware
    - Better cache management
    - More granular information
    
    Response:
    {
        "created": { stats for created meetings },
        "participating": { stats for participated meetings },
        "total": { combined stats },
        "user_id": "...",
        "cached_at": "...",
        "cached": true/false
    }
    """
    
    await _stats_cache.initialize()
    
    cache_key = f"meeting_stats:user_{current_user.id}"
    
    if not refresh:
        cached = await _stats_cache.get(cache_key)
        if cached:
            logger.info(f"📦 Cache HIT for user {current_user.id}")
            return {**cached, "cached": True}
    
    try:
        async def compute_stats():
            return await StatsComputer.compute_user_stats(
                db, current_user.id, current_user.email
            )
        
        stats = await retry_db_operation(compute_stats)
        
        await _stats_cache.set(cache_key, stats)
        
        logger.info(f"✅ Stats computed for user {current_user.id}")
        return {**stats, "cached": False}
        
    except Exception as e:
        logger.error(f"Error computing stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compute stats"
        )



@router.get("/", response_model=MeetingPaginationResponse)
async def list_meetings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    timeframe: str = Query("all"),  # Default to 'all' to match dashboard total count
    show_past: bool = Query(False),
    show_upcoming: bool = Query(False),
    status_id: UUID = Query(None),
    search: str = Query(None),
    is_recurring: bool = Query(None),
    include_recurring: bool = Query(False),  # Include recurring by default to match dashboard
    department_id: Optional[UUID] = Query(None),          # filter by one department
    include_child_departments: bool = Query(True),        # ...and everything below it
    sort_by: str = Query("meeting_date"),
    sort_order: str = Query("desc"),
):
    """
    List meetings accessible to user.

    Visible to a user: open meetings, meetings they created, meetings they were
    added to as a participant (email, case-insensitive), and meetings that belong
    to one of their departments or a department below it (see meeting_visibility.py).

    Optional department filter: pass department_id (and include_child_departments)
    to narrow the list. Users may only filter by their own departments or the
    ones below them (admins: any department).
    """
    try:
        async def fetch_meetings():
            skip = (page - 1) * limit
            today = date.today()
            
            # ========== DATE / TIMEFRAME FILTER ==========
            date_conditions = []
            if timeframe == "upcoming" or (show_upcoming and not show_past):
                date_conditions.append(Meeting.meeting_date >= today)
            elif timeframe == "past" or (show_past and not show_upcoming):
                date_conditions.append(Meeting.meeting_date < today)
            # If timeframe == "all", date_conditions remains empty
            
            # BASE CONDITIONS
            base_conditions = [
                Meeting.is_active == True,
            ]
            
            # ========== UNIFIED ACCESS FILTER ==========
            # open | creator | participant (email) | own department or one below it
            base_conditions.append(await build_meeting_access_filter(db, current_user))

            # ========== OPTIONAL DEPARTMENT FILTER ==========
            if department_id:
                base_conditions.append(
                    await build_department_filter(
                        db, current_user, department_id, include_child_departments
                    )
                )
            
            # ========== OTHER FILTERS ==========
            recurring_marker = or_(
                Meeting.is_recurring == True,
                Meeting.recurring_meeting_id.is_not(None),
            )
            if is_recurring is True:
                base_conditions.append(recurring_marker)
            elif is_recurring is False or not include_recurring:
                base_conditions.append(~recurring_marker)
            
            if date_conditions:
                base_conditions.append(or_(*date_conditions))
            
            if status_id:
                base_conditions.append(Meeting.status_id == status_id)
            
            if search:
                search_term = f"%{search}%"
                base_conditions.append(
                    or_(
                        Meeting.title.ilike(search_term),
                        Meeting.description.ilike(search_term)
                    )
                )
            
            # ========== COUNT QUERY ==========
            count_query = select(func.count(distinct(Meeting.id))).where(*base_conditions)
            count_result = await db.execute(count_query)
            total = count_result.scalar() or 0
            
            # ========== MAIN QUERY ==========
            query = select(Meeting).options(
                selectinload(Meeting.participants),
                selectinload(Meeting.created_by),
                selectinload(Meeting.status),
            ).where(*base_conditions)
            
            # ========== SORTING ==========
            if sort_by == "title":
                order_col = Meeting.title
            elif sort_by == "created_at":
                order_col = Meeting.created_at
            else:
                order_col = Meeting.meeting_date
            
            from sqlalchemy import asc, desc
            if sort_order.lower() == "asc":
                query = query.order_by(asc(order_col))
            else:
                query = query.order_by(desc(order_col))
            
            # ========== PAGINATION ==========
            query = query.offset(skip).limit(limit)
            result = await db.execute(query)
            meetings = result.unique().scalars().all()
            
            return meetings, total
        
        meetings, total = await retry_db_operation(fetch_meetings)
        
        # Build responses
        items = [await build_meeting_response(m) for m in meetings]
        
        return MeetingPaginationResponse(
            items=items,
            total=total,
            page=page,
            size=limit,
            pages=(total + limit - 1) // limit if total > 0 else 1
        )
        
    except HTTPException:
        # e.g. 403 when filtering by a department the user may not look at
        raise
    except Exception as e:
        logger.error(f"Error listing meetings: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch meetings"
        )

   
@router.post("/", response_model=MeetingCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    request: Request = None,  # ✅ ADDED for audit
):
    """
    Create meeting with participants.
    
    ✅ Improved:
    - Proper participant validation and creation
    - Email normalization (strip, lowercase)
    - Existing system users are linked by user_id (real email taken from the users table)
    - Duplicate participant detection
    - Per-participant error handling
    - Comprehensive logging
    - Better error handling and rollback
    - Cache invalidation (creator AND participants)
    - Auto-assigns MEETING_STATUS_PENDING status
    - Audit logging for creation
    
    Request Body Example:
    {
        "title": "Team Meeting",
        "meeting_date": "2026-11-15T00:00:00.000Z",
        "start_time": "2026-11-15T09:00:00.000Z",
        "end_time": "2026-11-15T10:30:00.000Z",
        "location_text": "Conference Room A",
        "custom_participants": [
            {
                "name": "John Doe",
                "email": "john.doe@example.com",
                "telephone": "256123456789",
                "title": "Manager",
                "organization": "IT Department",
                "is_chairperson": true,
                "is_secretary": false
            }
        ]
    }
    """
    
    logger.info(f"🎯 Starting meeting creation by user {current_user.id}")
    logger.info(f"   Title: {meeting_in.title}")
    logger.info(f"   Participants: {len(meeting_in.custom_participants) if meeting_in.custom_participants else 0}")
    
    try:
        async def create_transaction():
            # ========== STEP 1: DETERMINE STATUS ID ==========
            logger.info("📋 Step 1: Determining meeting status...")
            
            status_id = meeting_in.status_id
            
            if not status_id:
                try:
                    # Try to find status with code 'MEETING_STATUS_PENDING'
                    status_result = await db.execute(
                        select(Attribute).where(
                            Attribute.code == 'MEETING_STATUS_PENDING',
                            Attribute.is_active == True
                        )
                    )
                    pending_status = status_result.scalar_one_or_none()
                    
                    if pending_status:
                        status_id = pending_status.id
                        logger.info(f"   ✅ Auto-assigned PENDING status: {pending_status.id}")
                    else:
                        # Fallback: try to find by short_name 'pending'
                        status_result = await db.execute(
                            select(Attribute).where(
                                Attribute.short_name == 'pending',
                                Attribute.is_active == True
                            )
                        )
                        pending_status = status_result.scalar_one_or_none()
                        if pending_status:
                            status_id = pending_status.id
                            logger.info(f"   ✅ Auto-assigned PENDING status by short_name: {pending_status.id}")
                        else:
                            logger.warning("   ⚠️ No PENDING status found, leaving status_id as None")
                except Exception as e:
                    logger.error(f"   ❌ Error finding PENDING status: {e}")
            
            # ========== STEP 2: CREATE MEETING ==========
            logger.info("📋 Step 2: Creating meeting record...")
            
            meeting = Meeting(
                id=uuid.uuid4(),
                title=meeting_in.title,
                description=meeting_in.description,
                meeting_date=meeting_in.meeting_date,
                start_time=meeting_in.start_time,
                end_time=meeting_in.end_time,
                location_text=meeting_in.location_text,
                location_id=meeting_in.location_id,
                agenda=meeting_in.agenda,
                facilitator=meeting_in.facilitator,
                chairperson_name=meeting_in.chairperson_name,
                visibility=getattr(meeting_in, 'visibility', 'open'),
                restricted_department_id=getattr(meeting_in, 'restricted_department_id', None),
                status_id=status_id,
                is_recurring=getattr(meeting_in, 'is_recurring', False),
                recurring_meeting_id=getattr(meeting_in, 'recurring_meeting_id', None),
                occurrence_number=getattr(meeting_in, 'occurrence_number', None),
                created_by_id=current_user.id,
                created_at=datetime.now(),
                is_active=True,
            )
            
            db.add(meeting)
            await db.flush()
            
            logger.info(f"   ✅ Meeting created with ID: {meeting.id}")
            
            # ========== STEP 3: ADD PARTICIPANTS ==========
            participant_count = 0
            failed_participants = []
            participants_added = []
            
            if meeting_in.custom_participants:
                logger.info(f"📋 Step 3: Processing {len(meeting_in.custom_participants)} participants...")
                
                for idx, p in enumerate(meeting_in.custom_participants):
                    try:
                        # Validate participant data
                        if not p.name or not p.name.strip():
                            logger.warning(f"   ⚠️ Participant {idx}: Missing name, skipping")
                            failed_participants.append({
                                "index": idx,
                                "email": p.email if hasattr(p, 'email') else 'N/A',
                                "reason": "Missing name"
                            })
                            continue
                        
                        # Resolve the email. For existing system users the REAL address
                        # comes from the users table (the picker may only hold a masked
                        # one), so they can see the meeting when they log in.
                        raw_email = getattr(p, 'email', None)
                        linked_user_id = getattr(p, 'user_id', None)
                        if linked_user_id:
                            linked_email = (await db.execute(
                                select(User.email).where(User.id == linked_user_id)
                            )).scalar_one_or_none()
                            if linked_email:
                                raw_email = linked_email
                        
                        if not raw_email or not raw_email.strip():
                            logger.warning(f"   ⚠️ Participant {idx} ({p.name}): Missing email, skipping")
                            failed_participants.append({
                                "index": idx,
                                "name": p.name,
                                "reason": "Missing email"
                            })
                            continue
                        
                        # Normalize email (strip whitespace and lowercase)
                        email_normalized = raw_email.strip().lower()
                        
                        # Check for duplicate emails in this batch
                        existing = await db.execute(
                            select(MeetingParticipant).where(
                                MeetingParticipant.meeting_id == meeting.id,
                                MeetingParticipant.email == email_normalized,
                                MeetingParticipant.is_active == True
                            )
                        )
                        if existing.scalars().first():
                            logger.warning(f"   ⚠️ Participant {idx}: Duplicate email {email_normalized}, skipping")
                            failed_participants.append({
                                "index": idx,
                                "name": p.name,
                                "email": email_normalized,
                                "reason": "Duplicate email"
                            })
                            continue
                        
                        # Create participant
                        participant = MeetingParticipant(
                            id=uuid.uuid4(),
                            meeting_id=meeting.id,
                            name=p.name.strip(),
                            email=email_normalized,
                            telephone=p.telephone.strip() if hasattr(p, 'telephone') and p.telephone else None,
                            title=p.title.strip() if hasattr(p, 'title') and p.title else None,
                            organization=p.organization.strip() if hasattr(p, 'organization') and p.organization else None,
                            is_chairperson=bool(getattr(p, 'is_chairperson', False)),
                            is_secretary=bool(getattr(p, 'is_secretary', False)),
                            attendance_status="pending",
                            is_active=True,
                            created_at=datetime.now(),
                        )
                        
                        db.add(participant)
                        participant_count += 1
                        participants_added.append({
                            "name": p.name.strip(),
                            "email": email_normalized,
                            "is_chairperson": participant.is_chairperson,
                            "is_secretary": participant.is_secretary
                        })
                        
                        logger.info(f"   ✅ Participant {idx + 1}: {p.name} ({email_normalized})")
                        if getattr(p, 'is_chairperson', False):
                            logger.info(f"      - Chairperson: Yes")
                        if getattr(p, 'is_secretary', False):
                            logger.info(f"      - Secretary: Yes")
                        
                    except Exception as p_error:
                        logger.error(f"   ❌ Error processing participant {idx}: {p_error}", exc_info=True)
                        failed_participants.append({
                            "index": idx,
                            "name": p.name if hasattr(p, 'name') else 'Unknown',
                            "error": str(p_error)
                        })
                        continue
                
                logger.info(f"   ✅ Successfully added {participant_count} participants")
                if failed_participants:
                    logger.warning(f"   ⚠️ Failed to add {len(failed_participants)} participants")
            else:
                logger.info("📋 Step 3: No participants provided")
            
            # ========== STEP 4: COMMIT TRANSACTION ==========
            logger.info("📋 Step 4: Committing transaction...")
            
            await db.commit()
            await db.refresh(meeting)
            
            logger.info(f"   ✅ Transaction committed successfully")
            
            return meeting, participant_count, failed_participants, participants_added
        
        meeting, participant_count, failed_participants, participants_added = await retry_db_operation(create_transaction)
        
        # ========== LOG TO AUDIT LOGS ==========
        logger.info("📋 Step 5: Creating audit log...")
        
        await log_audit(
            db=db,
            action="CREATE",
            table_name="meetings",
            record_id=str(meeting.id),
            user_id=str(current_user.id),
            new_values={
                "title": meeting.title,
                "description": meeting.description,
                "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
                "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
                "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
                "location_text": meeting.location_text,
                "location_id": str(meeting.location_id) if meeting.location_id else None,
                "agenda": meeting.agenda,
                "facilitator": meeting.facilitator,
                "chairperson_name": meeting.chairperson_name,
                "status_id": str(meeting.status_id) if meeting.status_id else None,
                "visibility": meeting.visibility,
                "restricted_department_id": str(meeting.restricted_department_id) if meeting.restricted_department_id else None,
                "is_recurring": meeting.is_recurring,
                "participants_added": participants_added,
                "participant_count": participant_count,
                "failed_participants": failed_participants
            },
            status="success",
            ip_address=request.client.host if hasattr(request, 'client') else None,
            user_agent=request.headers.get("user-agent") if hasattr(request, 'headers') else None,
            endpoint="/api/v1/meetings",
            extra_data={
                "meeting_title": meeting.title,
                "participant_count": participant_count,
                "failed_participants_count": len(failed_participants)
            }
        )
        
        logger.info("   ✅ Audit log created")
        
        # ========== INVALIDATE CACHE ==========
        logger.info("📋 Step 6: Invalidating cache...")
        
        await _stats_cache.delete(f"meeting_stats:user_{current_user.id}")

        # Also clear the cached dashboard stats of every participant who has an
        # account, so the new meeting shows up as soon as they log in.
        if participants_added:
            try:
                participant_rows = await db.execute(
                    select(User.id).where(
                        func.lower(User.email).in_([p["email"] for p in participants_added])
                    )
                )
                for (participant_user_id,) in participant_rows.all():
                    await _stats_cache.delete(f"meeting_stats:user_{participant_user_id}")
            except Exception as cache_err:
                logger.warning(f"⚠️ Could not invalidate participant stats cache: {cache_err}")
        
        logger.info(f"✅ Meeting creation completed successfully")
        logger.info(f"   Meeting ID: {meeting.id}")
        logger.info(f"   Participants added: {participant_count}")
        if failed_participants:
            logger.warning(f"   Failed participants: {len(failed_participants)}")
        
        # ========== BUILD RESPONSE ==========
        return MeetingCreateResponse(
            id=meeting.id,
            title=meeting.title,
            description=meeting.description,
            meeting_date=meeting.meeting_date,
            start_time=meeting.start_time,
            end_time=meeting.end_time,
            location_text=meeting.location_text,
            agenda=meeting.agenda,
            facilitator=meeting.facilitator,
            chairperson_name=meeting.chairperson_name,
            status_id=meeting.status_id,
            created_by_id=meeting.created_by_id,
            created_by_name=getattr(meeting, 'created_by_name', None),
            created_at=meeting.created_at,
            updated_by_id=getattr(meeting, 'updated_by_id', None),
            updated_by_name=getattr(meeting, 'updated_by_name', None),
            updated_at=getattr(meeting, 'updated_at', None),
            is_active=meeting.is_active,
            department_id=getattr(meeting, 'department_id', None),
            restricted_department_id=getattr(meeting, 'restricted_department_id', None),
            visibility=getattr(meeting, 'visibility', 'open'),
            message="Meeting created successfully"
        )
        
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"❌ Database error creating meeting: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error while creating meeting"
        )
    
    except ValueError as e:
        await db.rollback()
        logger.error(f"❌ Validation error creating meeting: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {str(e)}"
        )
    
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Unexpected error creating meeting: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create meeting: {str(e)}"
        )

    
@router.get("/{meeting_id}", response_model=dict)
async def get_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get single meeting with department-based access control.
    ✅ Returns access_level and user_role in response
    """
    
    try:
        # ✅ Step 1: Check access
        access_level = await DepartmentAccessControl.get_access_level(
            db, meeting_id, current_user.id, current_user.email,
            is_admin_user(current_user)
        )
        
        logger.info(f"📊 User {current_user.id} access level: {access_level.value}")
        
        if access_level == AccessLevel.NONE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this meeting"
            )
        
        # ✅ Step 2: Fetch meeting
        result = await db.execute(
            select(Meeting).options(
                selectinload(Meeting.participants),
                selectinload(Meeting.created_by),
                selectinload(Meeting.status),
            ).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one_or_none()
        
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        # ✅ Step 3: Get user's role
        role = await PermissionChecker.get_user_role(db, meeting_id, current_user.id)
        
        # ✅ Step 4: Build response using utility function
        response = await build_meeting_response(meeting)  # ✅ AWAIT HERE
        
        # ✅ Step 5: Convert to dict if needed
        if isinstance(response, dict):
            response_dict = response
        elif hasattr(response, 'model_dump'):
            response_dict = response.model_dump(mode='python')
        elif hasattr(response, 'dict'):
            response_dict = response.dict()
        else:
            import json
            response_dict = json.loads(response.model_dump_json())
        
        # ✅ Step 6: ADD access_level and user_role
        response_dict['access_level'] = access_level.value
        response_dict['user_role'] = role.value if role else None
        
        logger.info(f"✅ Meeting {meeting_id} returned with access_level={access_level.value}")
        
        return response_dict
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching meeting: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch meeting: {str(e)}"
        )


@router.put("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: UUID,
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    request: Request = None,  # ✅ ADDED for audit
):
    """
    Update meeting details and sync custom participants.
    
    ✅ Requires OWNER permission
    ✅ Handles participant addition, updates, and soft-deletes
    ✅ Logs all changes to audit_logs
    """
    
    try:
        # Check permission
        permission = await PermissionChecker.get_user_permission(
            db, meeting_id, current_user.id,
            is_admin_user(current_user)
        )
        
        if permission != MeetingPermission.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the meeting owner can update this meeting"
            )
        
        # Fetch meeting with participants for audit
        result = await db.execute(
            select(Meeting).options(
                selectinload(Meeting.participants)
            ).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one_or_none()
        
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        # ✅ Capture OLD values for audit
        old_values = {
            "title": meeting.title,
            "description": meeting.description,
            "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
            "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
            "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
            "location_text": meeting.location_text,
            "location_id": str(meeting.location_id) if meeting.location_id else None,
            "agenda": meeting.agenda,
            "facilitator": meeting.facilitator,
            "chairperson_name": meeting.chairperson_name,
            "status_id": str(meeting.status_id) if meeting.status_id else None,
            "visibility": meeting.visibility,
            "restricted_department_id": str(meeting.restricted_department_id) if meeting.restricted_department_id else None,
            "is_recurring": meeting.is_recurring,
            "participants": [
                {
                    "name": p.name,
                    "email": p.email,
                    "is_chairperson": p.is_chairperson,
                    "is_secretary": p.is_secretary
                }
                for p in meeting.participants if p.is_active
            ]
        }
        
        logger.info(f"📝 Updating meeting {meeting_id}")
        logger.info(f"   Old values captured: {len(old_values)} fields")
        
        # ========== UPDATE MEETING FIELDS ==========
        meeting.title = meeting_in.title
        meeting.description = meeting_in.description
        meeting.meeting_date = meeting_in.meeting_date
        meeting.start_time = meeting_in.start_time
        meeting.end_time = meeting_in.end_time
        meeting.location_text = meeting_in.location_text
        meeting.location_id = getattr(meeting_in, 'location_id', None)
        meeting.agenda = meeting_in.agenda
        meeting.facilitator = getattr(meeting_in, 'facilitator', None)
        meeting.chairperson_name = getattr(meeting_in, 'chairperson_name', None)
        meeting.status_id = meeting_in.status_id
        meeting.visibility = getattr(meeting_in, 'visibility', meeting.visibility)
        # Keep the restricted department in sync with the form (PUT previously ignored it)
        meeting.restricted_department_id = getattr(
            meeting_in, 'restricted_department_id', meeting.restricted_department_id
        )
        meeting.updated_by_id = current_user.id
        meeting.updated_at = datetime.now()

        # ========== SYNC CUSTOM PARTICIPANTS ==========
        participant_changes = {"added": [], "updated": [], "removed": []}
        
        if meeting_in.custom_participants is not None:
            # Fetch existing active participants
            existing_p_result = await db.execute(
                select(MeetingParticipant).where(
                    MeetingParticipant.meeting_id == meeting_id,
                    MeetingParticipant.is_active == True
                )
            )
            existing_participants = {
                p.email.lower(): p for p in existing_p_result.scalars().all()
            }

            incoming_emails = set()

            for idx, p in enumerate(meeting_in.custom_participants):
                try:
                    p_name = p.name if hasattr(p, 'name') else p.get('name')
                    p_email = p.email if hasattr(p, 'email') else p.get('email')

                    if not p_name or not p_email:
                        logger.warning(f"⚠️ Participant #{idx + 1}: Missing name/email")
                        continue

                    email_normalized = p_email.strip().lower()
                    incoming_emails.add(email_normalized)

                    telephone = (p.telephone if hasattr(p, 'telephone') else p.get('telephone')) or None
                    title = (p.title if hasattr(p, 'title') else p.get('title')) or None
                    org = (p.organization if hasattr(p, 'organization') else p.get('organization')) or None
                    is_chair = bool(p.is_chairperson if hasattr(p, 'is_chairperson') else p.get('is_chairperson', False))
                    is_sec = bool(p.is_secretary if hasattr(p, 'is_secretary') else p.get('is_secretary', False))

                    if email_normalized in existing_participants:
                        # UPDATE existing participant
                        p_obj = existing_participants[email_normalized]
                        old_p_data = {
                            "name": p_obj.name,
                            "email": p_obj.email,
                            "telephone": p_obj.telephone,
                            "title": p_obj.title,
                            "organization": p_obj.organization,
                            "is_chairperson": p_obj.is_chairperson,
                            "is_secretary": p_obj.is_secretary
                        }
                        
                        p_obj.name = p_name.strip()
                        p_obj.telephone = telephone.strip() if telephone else None
                        p_obj.title = title.strip() if title else None
                        p_obj.organization = org.strip() if org else None
                        p_obj.is_chairperson = is_chair
                        p_obj.is_secretary = is_sec
                        p_obj.updated_at = datetime.now()
                        
                        participant_changes["updated"].append({
                            "email": email_normalized,
                            "old": old_p_data,
                            "new": {
                                "name": p_name.strip(),
                                "email": email_normalized,
                                "telephone": telephone.strip() if telephone else None,
                                "title": title.strip() if title else None,
                                "organization": org.strip() if org else None,
                                "is_chairperson": is_chair,
                                "is_secretary": is_sec
                            }
                        })
                        logger.info(f"   🔄 Updated participant: {email_normalized}")
                    else:
                        # ADD new participant
                        new_participant = MeetingParticipant(
                            id=uuid.uuid4(),
                            meeting_id=meeting.id,
                            name=p_name.strip(),
                            email=email_normalized,
                            telephone=telephone.strip() if telephone else None,
                            title=title.strip() if title else None,
                            organization=org.strip() if org else None,
                            is_chairperson=is_chair,
                            is_secretary=is_sec,
                            attendance_status="pending",
                            created_by_id=current_user.id,
                            created_at=datetime.now(),
                            is_active=True,
                        )
                        db.add(new_participant)
                        
                        participant_changes["added"].append({
                            "name": p_name.strip(),
                            "email": email_normalized,
                            "is_chairperson": is_chair,
                            "is_secretary": is_sec
                        })
                        logger.info(f"   ➕ Added new participant: {email_normalized}")

                except Exception as p_err:
                    logger.error(f"❌ Error syncing participant #{idx + 1}: {p_err}")
                    continue

            # SOFT DELETE removed participants
            for email, p_obj in existing_participants.items():
                if email not in incoming_emails:
                    participant_changes["removed"].append({
                        "name": p_obj.name,
                        "email": email,
                        "previous_role": "participant"
                    })
                    p_obj.is_active = False
                    p_obj.updated_at = datetime.now()
                    logger.info(f"   ❌ Removed participant: {email}")

        # ========== COMMIT & REFRESH ==========
        await db.commit()
        await db.refresh(meeting)
        
        # ✅ Capture NEW values for audit
        new_values = {
            "title": meeting.title,
            "description": meeting.description,
            "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
            "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
            "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
            "location_text": meeting.location_text,
            "location_id": str(meeting.location_id) if meeting.location_id else None,
            "agenda": meeting.agenda,
            "facilitator": meeting.facilitator,
            "chairperson_name": meeting.chairperson_name,
            "status_id": str(meeting.status_id) if meeting.status_id else None,
            "visibility": meeting.visibility,
            "restricted_department_id": str(meeting.restricted_department_id) if meeting.restricted_department_id else None,
            "is_recurring": meeting.is_recurring,
            "participant_changes": participant_changes
        }
        
        # ✅ LOG TO AUDIT LOGS TABLE
        logger.info("📝 Creating audit log for update...")
        
        await log_audit(
            db=db,
            action="UPDATE",
            table_name="meetings",
            record_id=str(meeting_id),
            user_id=str(current_user.id),
            old_values=old_values,
            new_values=new_values,
            status="success",
            ip_address=request.client.host if hasattr(request, 'client') else None,
            user_agent=request.headers.get("user-agent") if hasattr(request, 'headers') else None,
            endpoint=f"/api/v1/meetings/{meeting_id}",
            extra_data={
                "meeting_title": meeting.title,
                "participant_changes": participant_changes,
                "update_fields": list(meeting_in.model_dump(exclude_unset=True).keys())
            }
        )
        
        logger.info("   ✅ Audit log created")
        
        # Invalidate caches
        await _stats_cache.delete(f"meeting_stats:user_{current_user.id}")
        if meeting.created_by_id:
            await _stats_cache.delete(f"meeting_stats:user_{meeting.created_by_id}")
        
        logger.info(f"✅ Meeting {meeting_id} updated by user {current_user.id}")
        logger.info(f"   📝 Audit log created")
        
        response = await build_meeting_response(meeting)
        
        if isinstance(response, dict):
            response["user_permission"] = permission.value
        elif hasattr(response, "__dict__"):
            setattr(response, "user_permission", permission.value)

        return response
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"SQLAlchemy error updating meeting {meeting_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable"
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating meeting {meeting_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update meeting"
        )

    
@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    request: Request = None,  # ✅ ADDED for audit
):
    """
    Delete meeting (soft delete).
    
    ✅ Requires OWNER permission
    ✅ Logs deletion to audit_logs
    """
    
    try:
        # Check permission
        permission = await PermissionChecker.get_user_permission(
            db, meeting_id, current_user.id,
            is_admin_user(current_user)
        )
        
        if permission != MeetingPermission.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the meeting owner can delete this meeting"
            )
        
        # Fetch meeting with details for audit
        result = await db.execute(
            select(Meeting).options(
                selectinload(Meeting.participants)
            ).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one_or_none()
        
        if not meeting:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        
        # ✅ Capture values BEFORE deletion for audit
        old_values = {
            "title": meeting.title,
            "description": meeting.description,
            "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
            "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
            "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
            "location_text": meeting.location_text,
            "status_id": str(meeting.status_id) if meeting.status_id else None,
            "visibility": meeting.visibility,
            "is_recurring": meeting.is_recurring,
            "participants": [
                {"name": p.name, "email": p.email}
                for p in meeting.participants if p.is_active
            ],
            "is_active": meeting.is_active
        }
        
        logger.info(f"🗑️ Deleting meeting {meeting_id}: {meeting.title}")
        
        # Soft delete
        meeting.is_active = False
        meeting.updated_by_id = current_user.id
        meeting.updated_at = datetime.now()
        
        await db.commit()
        
        # ✅ LOG DELETION TO AUDIT LOGS
        logger.info("📝 Creating audit log for deletion...")
        
        await log_audit(
            db=db,
            action="DELETE",
            table_name="meetings",
            record_id=str(meeting_id),
            user_id=str(current_user.id),
            old_values=old_values,
            new_values={"is_active": False, "deleted_by": str(current_user.id)},
            status="success",
            ip_address=request.client.host if hasattr(request, 'client') else None,
            user_agent=request.headers.get("user-agent") if hasattr(request, 'headers') else None,
            endpoint=f"/api/v1/meetings/{meeting_id}",
            extra_data={
                "meeting_title": meeting.title,
                "soft_delete": True,
                "participant_count": len(meeting.participants) if meeting.participants else 0
            }
        )
        
        logger.info("   ✅ Audit log created")
        
        # Invalidate caches
        await _stats_cache.delete(f"meeting_stats:user_{current_user.id}")
        if meeting.created_by_id:
            await _stats_cache.delete(f"meeting_stats:user_{meeting.created_by_id}")
        
        # Invalidate for all participants (by email, case-insensitive)
        if meeting.participants:
            for p in meeting.participants:
                if p.email:
                    user_rows = await db.execute(
                        select(User.id).where(func.lower(User.email) == _norm_email(p.email))
                    )
                    for (participant_user_id,) in user_rows.all():
                        await _stats_cache.delete(f"meeting_stats:user_{participant_user_id}")
        
        logger.info(f"✅ Meeting {meeting_id} deleted by user {current_user.id}")
        logger.info(f"   📝 Audit log created")
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting meeting: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete meeting"
        )


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def patch_meeting(
    meeting_id: UUID,
    meeting_update: MeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    request: Request = None,  # ✅ ADDED for audit
):
    """
    Partial update meeting (PATCH).
    Only updates the fields provided in the request.
    ✅ Logs changes to audit_logs
    """
    
    try:
        # Check permission
        permission = await PermissionChecker.get_user_permission(
            db, meeting_id, current_user.id,
            is_admin_user(current_user)
        )
        
        if permission != MeetingPermission.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the meeting owner can update this meeting"
            )
        
        # Fetch meeting
        result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
        meeting = result.scalar_one_or_none()

        # Chairperson / secretary assignment
        _provided = meeting_update.model_dump(exclude_unset=True)
        for role, flag in (("chairperson_id", "is_chairperson"), ("secretary_id", "is_secretary")):
            if role in _provided:
                raw = _provided[role]
                target_id = UUID(str(raw)) if raw else None
                target = next(
                    (p for p in meeting.participants if p.id == target_id and p.is_active),
                    None,
                )
                if target_id and not target:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"{role} is not an active participant of this meeting",
                    )
                setattr(meeting, role, target_id)
                for p in meeting.participants:
                    setattr(p, flag, p.id == target_id)
                if role == "chairperson_id":
                    meeting.chairperson_name = target.name if target else None
        
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        # ✅ Capture old values
        old_values = {
            "title": meeting.title,
            "description": meeting.description,
            "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
            "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
            "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
            "location_text": meeting.location_text,
            "location_id": str(meeting.location_id) if meeting.location_id else None,
            "agenda": meeting.agenda,
            "facilitator": meeting.facilitator,
            "chairperson_name": meeting.chairperson_name,
            "status_id": str(meeting.status_id) if meeting.status_id else None,
            "visibility": meeting.visibility,
            "restricted_department_id": str(meeting.restricted_department_id) if meeting.restricted_department_id else None,
            "is_recurring": meeting.is_recurring,
            "platform": meeting.platform,
            "meeting_link": meeting.meeting_link
        }
                        
        # Get update data
        update_data = meeting_update.model_dump(exclude_unset=True)
        logger.info(f"📝 PATCH update data for meeting {meeting_id}: {update_data}")
        
        # Helper function to convert string to UUID
        def to_uuid(value):
            if value is None or value == '':
                return None
            if isinstance(value, UUID):
                return value
            if isinstance(value, str):
                try:
                    return UUID(value)
                except ValueError:
                    return None
            return value
        
        # Update each field
        if 'title' in update_data:
            meeting.title = update_data['title']
            logger.info(f"   📝 Updated title to: {update_data['title']}")
        if 'description' in update_data:
            meeting.description = update_data['description']
            logger.info(f"   📝 Updated description")
        if 'meeting_date' in update_data:
            meeting.meeting_date = update_data['meeting_date']
            logger.info(f"   📝 Updated meeting_date to: {update_data['meeting_date']}")
        if 'start_time' in update_data:
            meeting.start_time = update_data['start_time']
            logger.info(f"   📝 Updated start_time to: {update_data['start_time']}")
        if 'end_time' in update_data:
            meeting.end_time = update_data['end_time']
            logger.info(f"   📝 Updated end_time to: {update_data['end_time']}")
        if 'location_text' in update_data:
            meeting.location_text = update_data['location_text']
            logger.info(f"   📝 Updated location_text to: {update_data['location_text']}")
        if 'location_id' in update_data:
            meeting.location_id = to_uuid(update_data['location_id'])
            logger.info(f"   📝 Updated location_id to: {meeting.location_id}")
        if 'agenda' in update_data:
            meeting.agenda = update_data['agenda']
            logger.info(f"   📝 Updated agenda")
        if 'facilitator' in update_data:
            meeting.facilitator = update_data['facilitator']
            logger.info(f"   📝 Updated facilitator to: {update_data['facilitator']}")
        if 'chairperson_name' in update_data:
            meeting.chairperson_name = update_data['chairperson_name']
            logger.info(f"   📝 Updated chairperson_name to: {update_data['chairperson_name']}")
        if 'status_id' in update_data:
            val = update_data['status_id']
            if val is None or val == '':
                meeting.status_id = None
                logger.info(f"   📝 Cleared status_id")
            else:
                status_uuid = to_uuid(val)
                if status_uuid:
                    meeting.status_id = status_uuid
                    logger.info(f"   📝 Updated status_id to: {status_uuid}")
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid status_id format. Expected UUID, got: {val}"
                    )
        if 'visibility' in update_data:
            meeting.visibility = update_data['visibility']
            logger.info(f"   📝 Updated visibility to: {update_data['visibility']}")
        if 'restricted_department_id' in update_data:
            meeting.restricted_department_id = to_uuid(update_data['restricted_department_id'])
            logger.info(f"   📝 Updated restricted_department_id to: {meeting.restricted_department_id}")
        if 'is_recurring' in update_data:
            meeting.is_recurring = bool(update_data['is_recurring'])
            logger.info(f"   📝 Updated is_recurring to: {meeting.is_recurring}")
        if 'platform' in update_data:
            meeting.platform = update_data['platform']
            logger.info(f"   📝 Updated platform to: {update_data['platform']}")
        if 'meeting_link' in update_data:
            meeting.meeting_link = update_data['meeting_link']
            logger.info(f"   📝 Updated meeting_link")
        
        meeting.updated_by_id = current_user.id
        meeting.updated_at = datetime.now()
        
        await db.commit()
        await db.refresh(meeting)
        
        # ✅ Capture new values after update
        new_values = {
            "title": meeting.title,
            "description": meeting.description,
            "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
            "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
            "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
            "location_text": meeting.location_text,
            "location_id": str(meeting.location_id) if meeting.location_id else None,
            "agenda": meeting.agenda,
            "facilitator": meeting.facilitator,
            "chairperson_name": meeting.chairperson_name,
            "status_id": str(meeting.status_id) if meeting.status_id else None,
            "visibility": meeting.visibility,
            "restricted_department_id": str(meeting.restricted_department_id) if meeting.restricted_department_id else None,
            "is_recurring": meeting.is_recurring,
            "platform": meeting.platform,
            "meeting_link": meeting.meeting_link
        }
        
        # ✅ LOG TO AUDIT LOGS
        logger.info("📝 Creating audit log for PATCH...")
        
        await log_audit(
            db=db,
            action="PATCH",
            table_name="meetings",
            record_id=str(meeting_id),
            user_id=str(current_user.id),
            old_values=old_values,
            new_values=new_values,
            status="success",
            ip_address=request.client.host if hasattr(request, 'client') else None,
            user_agent=request.headers.get("user-agent") if hasattr(request, 'headers') else None,
            endpoint=f"/api/v1/meetings/{meeting_id}",
            extra_data={
                "meeting_title": meeting.title,
                "updated_fields": list(update_data.keys())
            }
        )
        
        logger.info("   ✅ Audit log created")
        
        # Invalidate caches
        await _stats_cache.delete(f"meeting_stats:user_{current_user.id}")
        if meeting.created_by_id:
            await _stats_cache.delete(f"meeting_stats:user_{meeting.created_by_id}")
        
        logger.info(f"✅ Meeting {meeting_id} partially updated by user {current_user.id}")
        logger.info(f"   Updated fields: {list(update_data.keys())}")
        
        response = await build_meeting_response(meeting)
        response["user_permission"] = permission.value
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error patching meeting: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update meeting: {str(e)}"
        )


# ==================== MEETING MINUTES ENDPOINTS ====================

@router.get("/{meeting_id}/minutes", response_model=Optional[MeetingMinutesResponse])
async def get_meeting_minutes(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get meeting minutes, or None if they don't exist yet"""
    
    try:
        access_level = await check_meeting_access_or_403(
            db, meeting_id, current_user.id, current_user.email,
            is_admin_user(current_user),
            required_level=AccessLevel.FULL
        )
        
        result = await db.execute(
            select(MeetingMinutes).where(
                MeetingMinutes.meeting_id == meeting_id,
                MeetingMinutes.is_active == True
            ).order_by(desc(MeetingMinutes.timestamp))
        )
        minutes = result.scalar_one_or_none()
        
        return minutes  # ✅ Returns None instead of 404
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching meeting minutes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch meeting minutes"
        ) 
 

@router.post("/{meeting_id}/minutes", response_model=MeetingMinutesResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting_minutes(
    meeting_id: UUID,
    minutes_data: Dict[str, Any],
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    request: Request = None,  # ✅ ADDED for audit
):
    """
    Create or update meeting minutes.
    
    ✅ Access control: User must have access to meeting
    ✅ Logs creation/update to audit_logs
    """
    
    try:
        # Check access
        can_access = await AccessControl.can_access_meeting(
            db, meeting_id, current_user.id, current_user.email,
            is_admin_user(current_user)
        )
        
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this meeting"
            )
        
        # Check if meeting exists
        meeting_result = await db.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = meeting_result.scalar_one_or_none()
        
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        # Extract data with correct field names
        topic = minutes_data.get('topic', '')
        discussion = minutes_data.get('discussion', '')
        decisions = minutes_data.get('decisions', '')
        
        # Also support alternative field names for backward compatibility
        if not topic:
            topic = minutes_data.get('title', '') or minutes_data.get('subject', '')
        if not discussion:
            discussion = minutes_data.get('content', '') or minutes_data.get('text', '') or minutes_data.get('minutes_text', '')
        if not decisions:
            decisions = minutes_data.get('action_items', '') or minutes_data.get('decisions_made', '')
        
        # Check if minutes already exist
        existing_result = await db.execute(
            select(MeetingMinutes).where(
                MeetingMinutes.meeting_id == meeting_id,
                MeetingMinutes.is_active == True
            )
        )
        existing_minutes = existing_result.scalar_one_or_none()
        
        if existing_minutes:
            # ✅ Capture old values for audit
            old_values = {
                "topic": existing_minutes.topic,
                "discussion": existing_minutes.discussion,
                "decisions": existing_minutes.decisions,
                "is_active": existing_minutes.is_active
            }
            
            # Update existing
            existing_minutes.topic = topic
            existing_minutes.discussion = discussion
            existing_minutes.decisions = decisions
            existing_minutes.updated_by_id = current_user.id
            existing_minutes.updated_at = datetime.now()
            
            await db.commit()
            await db.refresh(existing_minutes)
            
            # ✅ Log update to audit
            await log_audit(
                db=db,
                action="UPDATE",
                table_name="meeting_minutes",
                record_id=str(meeting_id),
                user_id=str(current_user.id),
                old_values=old_values,
                new_values={
                    "topic": topic,
                    "discussion": discussion,
                    "decisions": decisions,
                    "updated_by": str(current_user.id)
                },
                status="success",
                ip_address=request.client.host if hasattr(request, 'client') else None,
                user_agent=request.headers.get("user-agent") if hasattr(request, 'headers') else None,
                endpoint=f"/api/v1/meetings/{meeting_id}/minutes",
                extra_data={
                    "meeting_title": meeting.title,
                    "action": "updated_minutes"
                }
            )
            
            logger.info(f"✅ Meeting minutes updated for meeting {meeting_id}")
            logger.info(f"   📝 Audit log created")
            return existing_minutes
        else:
            # Create new
            new_minutes = MeetingMinutes(
                id=uuid.uuid4(),
                meeting_id=meeting_id,
                topic=topic,
                discussion=discussion,
                decisions=decisions,
                recorded_by_id=current_user.id,
                created_by_id=current_user.id,
                created_at=datetime.now(),
                is_active=True,
                is_default=True,
            )
            db.add(new_minutes)
            await db.commit()
            await db.refresh(new_minutes)
            
            # ✅ Log creation to audit
            await log_audit(
                db=db,
                action="CREATE",
                table_name="meeting_minutes",
                record_id=str(meeting_id),
                user_id=str(current_user.id),
                new_values={
                    "topic": topic,
                    "discussion": discussion,
                    "decisions": decisions,
                    "created_by": str(current_user.id)
                },
                status="success",
                ip_address=request.client.host if hasattr(request, 'client') else None,
                user_agent=request.headers.get("user-agent") if hasattr(request, 'headers') else None,
                endpoint=f"/api/v1/meetings/{meeting_id}/minutes",
                extra_data={
                    "meeting_title": meeting.title,
                    "action": "created_minutes"
                }
            )
            
            logger.info(f"✅ Meeting minutes created for meeting {meeting_id}")
            logger.info(f"   📝 Audit log created")
            return new_minutes
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating/updating meeting minutes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save meeting minutes"
        )


@router.delete("/{meeting_id}/minutes", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting_minutes(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    request: Request = None,  # ✅ ADDED for audit
):
    """
    Delete meeting minutes (soft delete).
    
    ✅ Access control: User must have access to meeting
    ✅ Logs deletion to audit_logs
    """
    
    try:
        # Check access
        can_access = await AccessControl.can_access_meeting(
            db, meeting_id, current_user.id, current_user.email,
            is_admin_user(current_user)
        )
        
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this meeting"
            )
        
        # Get meeting for title
        meeting_result = await db.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = meeting_result.scalar_one_or_none()
        
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        # Get minutes
        result = await db.execute(
            select(MeetingMinutes).where(
                MeetingMinutes.meeting_id == meeting_id,
                MeetingMinutes.is_active == True
            )
        )
        minutes = result.scalar_one_or_none()
        
        if not minutes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting minutes not found"
            )
        
        # ✅ Capture old values for audit
        old_values = {
            "topic": minutes.topic,
            "discussion": minutes.discussion,
            "decisions": minutes.decisions,
            "is_active": minutes.is_active
        }
        
        # Soft delete
        minutes.is_active = False
        minutes.updated_by_id = current_user.id
        minutes.updated_at = datetime.now()
        
        await db.commit()
        
        # ✅ Log deletion to audit
        await log_audit(
            db=db,
            action="DELETE",
            table_name="meeting_minutes",
            record_id=str(meeting_id),
            user_id=str(current_user.id),
            old_values=old_values,
            new_values={"is_active": False, "deleted_by": str(current_user.id)},
            status="success",
            ip_address=request.client.host if hasattr(request, 'client') else None,
            user_agent=request.headers.get("user-agent") if hasattr(request, 'headers') else None,
            endpoint=f"/api/v1/meetings/{meeting_id}/minutes",
            extra_data={
                "meeting_title": meeting.title,
                "soft_delete": True
            }
        )
        
        logger.info(f"✅ Meeting minutes deleted for meeting {meeting_id}")
        logger.info(f"   📝 Audit log created")
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting meeting minutes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete meeting minutes"
        )
