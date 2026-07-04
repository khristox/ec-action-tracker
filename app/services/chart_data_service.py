# app/services/chart_data_service.py - POSTGRESQL COMPATIBLE VERSION

from datetime import datetime, timedelta, timezone
from sqlalchemy import func, and_, or_, select, case, text
from sqlalchemy.ext.asyncio import AsyncSession
from collections import defaultdict
import logging
from typing import Optional, List, Dict, Any, Callable, Awaitable
from functools import wraps
import json

from app.models.meetings.action_tracker import Meeting, MeetingAction, MeetingParticipant

logger = logging.getLogger(__name__)


def retry_on_error(max_retries: int = 2):
    """
    Decorator to retry database operations on error.

    NOTE: this retries on *any* Exception, including programming bugs
    (TypeError, AttributeError, etc.), not just transient DB errors. That's
    intentionally left as-is here since narrowing it is a behavior change,
    but be aware: if the wrapped function captures ORM objects (e.g. a
    `current_user` from the request) in a closure, retrying after certain
    failures can hand back a stale/expired object on the next attempt and
    produce a *different*, more confusing error (e.g. MissingGreenlet).
    If you see that pattern, the fix belongs in the caller — re-fetch or
    re-pass fresh objects on each attempt — not in this decorator.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exc = e
                    if attempt == max_retries - 1:
                        raise
                    logger.warning(f"Retry {attempt + 1}/{max_retries} for {func.__name__}: {e}")
                    # Rollback session on retry
                    if len(args) > 0 and hasattr(args[0], 'db'):
                        try:
                            await args[0].db.rollback()
                        except Exception:
                            pass
            # Unreachable in practice (loop always returns or raises above),
            # kept only as a defensive fallback.
            if last_exc:
                raise last_exc
            return None
        return wrapper
    return decorator


def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Normalize a datetime to naive UTC so it can be safely compared against
    datetime.utcnow() (which this file uses consistently, and which is
    itself naive). If a value comes back from the DB as timezone-aware
    (common with PostgreSQL TIMESTAMPTZ columns via asyncpg), this strips
    the tzinfo after converting to UTC so comparisons never raise
    "can't compare offset-naive and offset-aware datetimes".
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class ChartDataService:
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.task_model = MeetingAction
        self.meeting_model = Meeting
        self.participant_model = MeetingParticipant
        self._db_type = None

    @property
    def db_type(self) -> str:
        """Get database type (postgresql/mysql)"""
        if self._db_type is None:
            try:
                url = str(self.db.bind.url)
                if 'postgresql' in url or 'postgres' in url:
                    self._db_type = 'postgresql'
                elif 'mysql' in url:
                    self._db_type = 'mysql'
                else:
                    self._db_type = 'unknown'
            except Exception:
                self._db_type = 'unknown'
        return self._db_type

    def is_postgres(self) -> bool:
        """Check if using PostgreSQL"""
        return self.db_type == 'postgresql'

    def is_mysql(self) -> bool:
        """Check if using MySQL"""
        return self.db_type == 'mysql'

    def _has_attribute(self, obj, attr_name: str) -> bool:
        """Safely check if object has attribute"""
        return hasattr(obj, attr_name) and getattr(obj, attr_name) is not None

    def _get_json_extract(self, column, path: str) -> str:
        """
        Get database-specific JSON extraction expression.
        PostgreSQL: column->>'path'
        MySQL: JSON_UNQUOTE(JSON_EXTRACT(column, '$.path'))
        """
        if self.is_postgres():
            return f"{column}->>'{path}'"
        else:
            return f"JSON_UNQUOTE(JSON_EXTRACT({column}, '$.{path}'))"

    def _get_ifnull(self, column, default: str = "'{}'") -> str:
        """
        Get database-specific IFNULL/COALESCE.
        """
        if self.is_postgres():
            return f"COALESCE({column}, {default})"
        else:
            return f"IFNULL({column}, {default})"

    # ==================== Safe user-filter builder ====================
    # Every query below used to interpolate user_id/user_email/user_phone
    # directly into an f-string passed to text(), e.g.:
    #     f"assigned_to_id = '{user_id}'"
    # That's a SQL injection vector: any of those values reaching this code
    # unsanitized (e.g. a phone/email field a user can edit on their own
    # profile) lets them break out of the string and run arbitrary SQL.
    # This helper builds the same OR-clause but with bound parameters, so
    # values are always sent to the driver separately from the query text.

    def _build_user_filter(self, user_id: str = None, user_email: str = None,
                            user_phone: str = None) -> tuple:
        """
        Returns (clause_text_or_None, params_dict) using bound parameters.
        Caller passes params via `.execute(query, params)`.
        """
        conditions = []
        params = {}

        if user_id and self._has_attribute(self.task_model, 'assigned_to_id'):
            conditions.append("assigned_to_id = :user_id")
            params["user_id"] = user_id

        if user_email and self._has_attribute(self.task_model, 'assigned_to_name'):
            if self.is_postgres():
                conditions.append("assigned_to_name->>'email' LIKE :user_email")
            else:
                conditions.append("JSON_UNQUOTE(JSON_EXTRACT(assigned_to_name, '$.email')) LIKE :user_email")
            params["user_email"] = f"%{user_email}%"

        if user_phone and self._has_attribute(self.task_model, 'assigned_to_name'):
            if self.is_postgres():
                conditions.append("assigned_to_name->>'phone' LIKE :user_phone")
            else:
                conditions.append("JSON_UNQUOTE(JSON_EXTRACT(assigned_to_name, '$.phone')) LIKE :user_phone")
            params["user_phone"] = f"%{user_phone}%"

        if not conditions:
            return None, {}

        return " OR ".join(conditions), params

    def _get_empty_chart_data(self, labels: List[str]) -> Dict[str, Any]:
        """Return empty chart data structure"""
        return {
            "labels": labels,
            "datasets": [
                {
                    "label": "Tasks Created",
                    "data": [0] * len(labels),
                    "backgroundColor": "rgba(25, 118, 210, 0.7)",
                    "borderColor": "#1976d2",
                    "borderWidth": 1,
                    "borderRadius": 6
                },
                {
                    "label": "Tasks Completed",
                    "data": [0] * len(labels),
                    "backgroundColor": "rgba(46, 125, 50, 0.7)",
                    "borderColor": "#2e7d32",
                    "borderWidth": 1,
                    "borderRadius": 6
                }
            ]
        }

    def _get_empty_status_distribution(self) -> Dict[str, Any]:
        """Return empty status distribution"""
        return {
            "labels": ["Pending", "In Progress", "Completed", "Overdue"],
            "datasets": [{
                "data": [0, 0, 0, 0],
                "backgroundColor": ["#ed6c02", "#1976d2", "#2e7d32", "#d32f2f"],
                "borderWidth": 0
            }]
        }

    def _get_empty_monthly_trend(self, months: int) -> Dict[str, Any]:
        """Return empty monthly trend data structure"""
        end_date = datetime.utcnow()
        month_range = []
        for i in range(months - 1, -1, -1):
            month_date = end_date - timedelta(days=30 * i)
            month_range.append(month_date.strftime("%b"))

        return {
            "labels": month_range,
            "datasets": [
                {
                    "label": "Tasks Created",
                    "data": [0] * months,
                    "borderColor": "#1976d2",
                    "backgroundColor": "rgba(25, 118, 210, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Tasks Completed",
                    "data": [0] * months,
                    "borderColor": "#2e7d32",
                    "backgroundColor": "rgba(46, 125, 50, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Meetings Attended",
                    "data": [0] * months,
                    "borderColor": "#ed6c02",
                    "backgroundColor": "rgba(237, 108, 2, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Meetings Organized",
                    "data": [0] * months,
                    "borderColor": "#9c27b0",
                    "backgroundColor": "rgba(156, 39, 176, 0.1)",
                    "fill": True,
                    "tension": 0.4
                }
            ]
        }

    def _get_empty_priority_distribution(self) -> Dict[str, Any]:
        """Return empty priority distribution"""
        return {
            "labels": ["High", "Medium", "Low"],
            "datasets": [{
                "data": [0, 0, 0],
                "backgroundColor": ["#d32f2f", "#ed6c02", "#2e7d32"],
                "borderWidth": 0
            }]
        }

    @retry_on_error(max_retries=2)
    async def get_weekly_activity(self, user_id: str = None, user_email: str = None,
                                   user_phone: str = None, days: int = 7) -> Dict[str, Any]:
        """Get weekly task creation and completion activity for tasks assigned to user"""
        if not self.task_model:
            return self._get_empty_chart_data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        query = select(self.task_model)
        params = {}

        user_clause, user_params = self._build_user_filter(user_id, user_email, user_phone)
        if user_clause:
            query = query.where(text(user_clause))
            params.update(user_params)

        date_conditions = []
        if self._has_attribute(self.task_model, 'created_at'):
            date_conditions.append("created_at >= :start_date")
        if self._has_attribute(self.task_model, 'completed_at'):
            date_conditions.append("completed_at >= :start_date")
        if self._has_attribute(self.task_model, 'updated_at'):
            date_conditions.append("updated_at >= :start_date")

        if date_conditions:
            query = query.where(text(" OR ".join(date_conditions)))
            params["start_date"] = start_date

        try:
            result = await self.db.execute(query, params)
            tasks = result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing weekly activity query: {e}")
            return self._get_empty_chart_data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])

        date_range = [end_date - timedelta(days=days - 1 - i) for i in range(days)]
        created_counts = defaultdict(int)
        completed_counts = defaultdict(int)

        for task in tasks:
            created_at = _to_naive_utc(getattr(task, 'created_at', None))
            if created_at and start_date <= created_at <= end_date:
                created_counts[created_at.date()] += 1

            is_completed = False
            completion_date = None

            completed_at = _to_naive_utc(getattr(task, 'completed_at', None))
            if completed_at:
                completion_date = completed_at.date()
                is_completed = True

            if not is_completed:
                status = getattr(task, 'status', None)
                if status and str(status).lower() in ['completed', 'done', 'closed']:
                    updated_at = _to_naive_utc(getattr(task, 'updated_at', None))
                    completion_date = (updated_at or created_at or end_date).date()
                    is_completed = True

            if not is_completed:
                progress = getattr(task, 'progress', None)
                if progress is not None:
                    try:
                        if float(progress) >= 100:
                            updated_at = _to_naive_utc(getattr(task, 'updated_at', None))
                            completion_date = (updated_at or created_at or end_date).date()
                            is_completed = True
                    except (TypeError, ValueError):
                        pass

            if is_completed and completion_date and start_date.date() <= completion_date <= end_date.date():
                completed_counts[completion_date] += 1

        labels = [d.strftime("%a") for d in date_range]
        created_data = [created_counts.get(d.date(), 0) for d in date_range]
        completed_data = [completed_counts.get(d.date(), 0) for d in date_range]

        return {
            "labels": labels,
            "full_dates": [d.strftime("%Y-%m-%d") for d in date_range],
            "datasets": [
                {
                    "label": "Tasks Created",
                    "data": created_data,
                    "backgroundColor": "rgba(25, 118, 210, 0.7)",
                    "borderColor": "#1976d2",
                    "borderWidth": 1,
                    "borderRadius": 6,
                    "barPercentage": 0.65,
                    "categoryPercentage": 0.8
                },
                {
                    "label": "Tasks Completed",
                    "data": completed_data,
                    "backgroundColor": "rgba(46, 125, 50, 0.7)",
                    "borderColor": "#2e7d32",
                    "borderWidth": 1,
                    "borderRadius": 6,
                    "barPercentage": 0.65,
                    "categoryPercentage": 0.8
                }
            ],
            "summary": {
                "total_created": sum(created_data),
                "total_completed": sum(completed_data),
                "completion_rate": round((sum(completed_data) / sum(created_data) * 100) if sum(created_data) > 0 else 0, 1),
                "max_value": max(max(created_data) if created_data else 0, max(completed_data) if completed_data else 0)
            }
        }

    @retry_on_error(max_retries=2)
    async def get_status_distribution(self, user_id: str = None, user_email: str = None,
                                       user_phone: str = None) -> Dict[str, Any]:
        """Get task status distribution for tasks assigned to user"""
        if not self.task_model:
            return self._get_empty_status_distribution()

        query = select(self.task_model)
        params = {}

        user_clause, user_params = self._build_user_filter(user_id, user_email, user_phone)
        if user_clause:
            query = query.where(text(user_clause))
            params.update(user_params)

        try:
            result = await self.db.execute(query, params)
            tasks = result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing status distribution query: {e}")
            return self._get_empty_status_distribution()

        status_counts = {
            "pending": 0,
            "in_progress": 0,
            "completed": 0,
            "overdue": 0
        }

        current_date = datetime.utcnow().date()

        for task in tasks:
            completed_at = _to_naive_utc(getattr(task, 'completed_at', None))
            if completed_at:
                status_counts["completed"] += 1
                continue

            status = getattr(task, 'status', None)
            if status:
                status_lower = str(status).lower()
                if status_lower in ['completed', 'done', 'closed']:
                    status_counts["completed"] += 1
                    continue
                elif status_lower in ['in_progress', 'in-progress', 'ongoing', 'active']:
                    status_counts["in_progress"] += 1
                    continue

            progress = getattr(task, 'progress', None)
            if progress is not None:
                try:
                    progress_val = float(progress)
                    if progress_val >= 100:
                        status_counts["completed"] += 1
                        continue
                    elif progress_val > 0:
                        status_counts["in_progress"] += 1
                        continue
                except (TypeError, ValueError):
                    pass

            due_date = _to_naive_utc(getattr(task, 'due_date', None))
            if due_date and due_date.date() < current_date:
                status_counts["overdue"] += 1
            else:
                status_counts["pending"] += 1

        status_config = {
            "pending": {"label": "Pending", "color": "#ed6c02"},
            "in_progress": {"label": "In Progress", "color": "#1976d2"},
            "completed": {"label": "Completed", "color": "#2e7d32"},
            "overdue": {"label": "Overdue", "color": "#d32f2f"}
        }

        return {
            "labels": [status_config[k]["label"] for k in ["pending", "in_progress", "completed", "overdue"]],
            "datasets": [{
                "data": [status_counts[k] for k in ["pending", "in_progress", "completed", "overdue"]],
                "backgroundColor": [status_config[k]["color"] for k in ["pending", "in_progress", "completed", "overdue"]],
                "borderWidth": 0
            }]
        }

    @retry_on_error(max_retries=2)
    async def get_monthly_trend(self, user_id: str = None, user_email: str = None,
                                 user_phone: str = None, months: int = 6) -> Dict[str, Any]:
        """Get monthly task and meeting trends for user"""
        if not self.task_model:
            return self._get_empty_monthly_trend(months)

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=months * 30)

        # ========== TASKS QUERY ==========
        task_query = select(self.task_model)
        task_params = {}

        user_clause, user_params = self._build_user_filter(user_id, user_email, user_phone)
        if user_clause:
            task_query = task_query.where(text(user_clause))
            task_params.update(user_params)

        if self._has_attribute(self.task_model, 'created_at'):
            task_query = task_query.where(text("created_at >= :start_date"))
            task_params["start_date"] = start_date

        # ========== MEETINGS QUERY ==========
        meeting_ids = set()

        if user_email or user_phone:
            participant_conditions = []
            participant_params = {}
            if user_email:
                participant_conditions.append("email = :user_email")
                participant_params["user_email"] = user_email
            if user_phone:
                participant_conditions.append("telephone = :user_phone")
                participant_params["user_phone"] = user_phone

            if participant_conditions:
                participant_query = select(self.participant_model.meeting_id).where(
                    text(" OR ".join(participant_conditions))
                )
                participant_result = await self.db.execute(participant_query, participant_params)
                meeting_ids.update(participant_result.scalars().all())

        if user_id:
            creator_query = select(self.meeting_model.id).where(
                text("created_by_id = :user_id AND is_active = TRUE")
            )
            creator_result = await self.db.execute(creator_query, {"user_id": user_id})
            meeting_ids.update(creator_result.scalars().all())

        meetings = []
        if meeting_ids:
            # meeting_ids come from our own prior queries (UUIDs from the DB),
            # never directly from user input, so building an IN(...) list here
            # is safe — but we still use bound params rather than string
            # formatting, both for consistency and to avoid quoting issues.
            meeting_query = select(self.meeting_model).where(
                self.meeting_model.id.in_(meeting_ids),
                text("is_active = TRUE AND created_at >= :start_date")
            )
            meeting_result = await self.db.execute(meeting_query, {"start_date": start_date})
            meetings = meeting_result.scalars().all()

        try:
            task_result = await self.db.execute(task_query, task_params)
            tasks = task_result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing monthly trend query for tasks: {e}")
            tasks = []

        month_keys = []
        month_labels = []
        for i in range(months - 1, -1, -1):
            month_date = end_date - timedelta(days=30 * i)
            month_keys.append(month_date.strftime("%Y-%m"))
            month_labels.append(month_date.strftime("%b"))

        tasks_created = defaultdict(int)
        tasks_completed = defaultdict(int)

        for task in tasks:
            created_at = _to_naive_utc(getattr(task, 'created_at', None))
            if created_at:
                tasks_created[created_at.strftime("%Y-%m")] += 1

            completed_at = _to_naive_utc(getattr(task, 'completed_at', None))
            if completed_at:
                tasks_completed[completed_at.strftime("%Y-%m")] += 1
            else:
                status = getattr(task, 'status', None)
                if status and str(status).lower() in ['completed', 'done', 'closed']:
                    updated_at = _to_naive_utc(getattr(task, 'updated_at', None))
                    if updated_at:
                        tasks_completed[updated_at.strftime("%Y-%m")] += 1

        meetings_created = defaultdict(int)
        meetings_attended = defaultdict(int)

        for meeting in meetings:
            created_at = _to_naive_utc(getattr(meeting, 'created_at', None))
            if created_at:
                meetings_created[created_at.strftime("%Y-%m")] += 1

            meeting_date = _to_naive_utc(getattr(meeting, 'meeting_date', None))
            if meeting_date and meeting_date < end_date:
                meetings_attended[meeting_date.strftime("%Y-%m")] += 1

        return {
            "labels": month_labels,
            "datasets": [
                {
                    "label": "Tasks Created",
                    "data": [tasks_created.get(key, 0) for key in month_keys],
                    "borderColor": "#1976d2",
                    "backgroundColor": "rgba(25, 118, 210, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Tasks Completed",
                    "data": [tasks_completed.get(key, 0) for key in month_keys],
                    "borderColor": "#2e7d32",
                    "backgroundColor": "rgba(46, 125, 50, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Meetings Attended",
                    "data": [meetings_attended.get(key, 0) for key in month_keys],
                    "borderColor": "#ed6c02",
                    "backgroundColor": "rgba(237, 108, 2, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Meetings Organized",
                    "data": [meetings_created.get(key, 0) for key in month_keys],
                    "borderColor": "#9c27b0",
                    "backgroundColor": "rgba(156, 39, 176, 0.1)",
                    "fill": True,
                    "tension": 0.4
                }
            ]
        }

    @retry_on_error(max_retries=2)
    async def get_priority_distribution(self, user_id: str = None) -> Dict[str, Any]:
        """Get task priority distribution"""
        if not self.task_model:
            return self._get_empty_priority_distribution()

        query = select(self.task_model)
        params = {}

        if user_id and self._has_attribute(self.task_model, 'assigned_to_id'):
            query = query.where(text("assigned_to_id = :user_id"))
            params["user_id"] = user_id

        try:
            result = await self.db.execute(query, params)
            tasks = result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing priority distribution query: {e}")
            return self._get_empty_priority_distribution()

        priority_counts = {"high": 0, "medium": 0, "low": 0}

        for task in tasks:
            priority = None
            for attr in ['priority', 'priority_level', 'urgency']:
                if self._has_attribute(task, attr):
                    priority = getattr(task, attr, None)
                    if priority is not None:
                        break

            if priority is not None:
                priority_str = str(priority).lower()
                if priority_str in ['high', 'critical', 'urgent', '1']:
                    priority_counts["high"] += 1
                elif priority_str in ['low', '3']:
                    priority_counts["low"] += 1
                else:
                    priority_counts["medium"] += 1
            else:
                priority_counts["medium"] += 1

        return {
            "labels": ["High", "Medium", "Low"],
            "datasets": [{
                "data": [priority_counts["high"], priority_counts["medium"], priority_counts["low"]],
                "backgroundColor": ["#d32f2f", "#ed6c02", "#2e7d32"],
                "borderWidth": 0
            }]
        }

    async def get_cached_or_compute(self, cache_key: str, compute_func: Callable[[], Awaitable],
                                     ttl_minutes: int = 30) -> Any:
        """Get data from cache or compute it"""
        try:
            from app.models.chart_data import ChartDataCache

            result = await self.db.execute(
                select(ChartDataCache).where(ChartDataCache.cache_key == cache_key)
            )
            cache_entry = result.scalar_one_or_none()

            if cache_entry:
                expires_at = _to_naive_utc(cache_entry.expires_at)
                if expires_at and expires_at > datetime.utcnow():
                    logger.debug(f"Cache hit for {cache_key}")
                    return cache_entry.data

            logger.debug(f"Cache miss for {cache_key}, computing...")
            data = await compute_func()

            try:
                if cache_entry:
                    cache_entry.data = data
                    cache_entry.expires_at = datetime.utcnow() + timedelta(minutes=ttl_minutes)
                    cache_entry.updated_at = datetime.utcnow()
                else:
                    cache_entry = ChartDataCache(
                        cache_key=cache_key,
                        data=data,
                        expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes)
                    )
                    self.db.add(cache_entry)

                await self.db.commit()
            except Exception as e:
                logger.warning(f"Cache save error (continuing without cache): {e}")
                await self.db.rollback()

            return data
        except Exception as e:
            logger.warning(f"Cache error (continuing without cache): {e}")
            try:
                await self.db.rollback()
            except Exception:
                pass
            return await compute_func()