# app/services/chart_data_service.py - IMPROVED VERSION

from datetime import datetime, timedelta
from sqlalchemy import func, and_, or_, select, case
from sqlalchemy.ext.asyncio import AsyncSession
from collections import defaultdict
import logging
from typing import Optional, List, Dict, Any, Callable, Awaitable
from functools import wraps

logger = logging.getLogger(__name__)


def retry_on_error(max_retries: int = 2):
    """Decorator to retry database operations on error"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    logger.warning(f"Retry {attempt + 1}/{max_retries} for {func.__name__}: {e}")
            return None
        return wrapper
    return decorator


class ChartDataService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.task_model = None
        self._discover_models()
    
    def _discover_models(self):
        """Dynamically discover the correct model from action_tracker"""
        try:
            from app.models import action_tracker
            
            # List of possible model names to try
            possible_names = ['ActionItem', 'ActionPlan', 'Action', 'Task', 'ActionTask', 'MyTask']
            
            for name in possible_names:
                if hasattr(action_tracker, name):
                    self.task_model = getattr(action_tracker, name)
                    logger.info(f"✅ Found task model: {name}")
                    # Discover field names once
                    self._discover_field_names()
                    return
            
            # If none found, try to get any model from action_tracker
            import inspect
            for name, obj in inspect.getmembers(action_tracker):
                if inspect.isclass(obj) and name != 'Base' and hasattr(obj, '__tablename__'):
                    self.task_model = obj
                    self._discover_field_names()
                    return
                    
            logger.warning("⚠️ No task model found in action_tracker")
        except Exception as e:
            logger.error(f"Error discovering models: {e}")
    
    def _discover_field_names(self):
        """Discover available field names on the task model"""
        if not self.task_model:
            return
        
        self.available_fields = set()
        for column in self.task_model.__table__.columns:
            self.available_fields.add(column.name)
        
        # Also check relationships
        if hasattr(self.task_model, '__mapper__'):
            for rel in self.task_model.__mapper__.relationships:
                self.available_fields.add(rel.key)
        
        logger.debug(f"Available fields: {self.available_fields}")
    
    def _has_attribute(self, obj, attr_name: str) -> bool:
        """Safely check if object has attribute"""
        return hasattr(obj, attr_name) and getattr(obj, attr_name) is not None
    
    def _get_user_id_field(self) -> Optional[str]:
        """Find the correct user ID field name"""
        if not self.task_model:
            return None
        
        # Priority order for user ID fields
        user_id_fields = ['assignee_id', 'assigned_to_id', 'user_id', 'created_by_id', 'owner_id']
        
        for field in user_id_fields:
            if field in getattr(self, 'available_fields', set()) or self._has_attribute(self.task_model, field):
                return field
        
        # Check relationship fields
        relationship_fields = ['assignee', 'assigned_to', 'created_by', 'owner']
        for field in relationship_fields:
            if self._has_attribute(self.task_model, field):
                # Return the foreign key column name
                fk_name = f"{field}_id"
                if self._has_attribute(self.task_model, fk_name):
                    return fk_name
        
        return None
    
    def _apply_user_filter(self, query, user_id: Optional[str]):
        """Apply user filter correctly using the proper field"""
        if not user_id:
            return query
        
        user_id_field = self._get_user_id_field()
        
        if user_id_field:
            # Direct column comparison
            return query.where(getattr(self.task_model, user_id_field) == user_id)
        else:
            # Try relationship with has()
            for rel_field in ['assignee', 'assigned_to', 'created_by', 'owner']:
                if self._has_attribute(self.task_model, rel_field):
                    return query.where(getattr(self.task_model, rel_field).has(id=user_id))
        
        logger.warning(f"No user filter field found for model {self.task_model}")
        return query
    
    @retry_on_error(max_retries=2)
    async def get_weekly_activity(self, user_id: str = None, days: int = 7) -> Dict[str, Any]:
        """Get weekly task creation and completion activity"""
        if not self.task_model:
            return self._get_empty_chart_data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Build query using select
        query = select(self.task_model).limit(2000)
        
        # Apply user filter
        query = self._apply_user_filter(query, user_id)
        
        # Date filter using date fields
        date_conditions = []
        if self._has_attribute(self.task_model, 'created_at'):
            date_conditions.append(self.task_model.created_at >= start_date)
        if self._has_attribute(self.task_model, 'updated_at'):
            date_conditions.append(self.task_model.updated_at >= start_date)
        if self._has_attribute(self.task_model, 'completed_at'):
            date_conditions.append(self.task_model.completed_at >= start_date)
        
        if date_conditions:
            query = query.where(or_(*date_conditions))
        
        # Execute query
        try:
            result = await self.db.execute(query)
            tasks = result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing weekly activity query: {e}")
            return self._get_empty_chart_data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        
        # Prepare date range
        date_range = []
        for i in range(days):
            date = end_date - timedelta(days=days-1-i)
            date_range.append(date.date())
        
        # Count activities
        created_counts = defaultdict(int)
        completed_counts = defaultdict(int)
        
        for task in tasks:
            if self._has_attribute(task, 'created_at') and task.created_at:
                created_date = task.created_at.date()
                if created_date >= start_date.date():
                    created_counts[created_date] += 1
            
            # Check for completion
            if self._has_attribute(task, 'completed_at') and task.completed_at:
                completed_date = task.completed_at.date()
                if completed_date >= start_date.date():
                    completed_counts[completed_date] += 1
            elif self._has_attribute(task, 'status') and task.status in ['completed', 'done', 'closed']:
                # Check if task is marked completed
                if self._has_attribute(task, 'updated_at') and task.updated_at:
                    completed_date = task.updated_at.date()
                    if completed_date >= start_date.date():
                        completed_counts[completed_date] += 1
        
        labels = [d.strftime("%a") for d in date_range]
        created_data = [created_counts.get(d, 0) for d in date_range]
        completed_data = [completed_counts.get(d, 0) for d in date_range]
        
        return {
            "labels": labels,
            "datasets": [
                {
                    "label": "Tasks Created",
                    "data": created_data,
                    "backgroundColor": "#1976d2",
                    "borderColor": "#1976d2",
                    "borderRadius": 6
                },
                {
                    "label": "Tasks Completed",
                    "data": completed_data,
                    "backgroundColor": "#2e7d32",
                    "borderColor": "#2e7d32",
                    "borderRadius": 6
                }
            ]
        }
    
    @retry_on_error(max_retries=2)
    async def get_status_distribution(self, user_id: str = None) -> Dict[str, Any]:
        """Get task status distribution"""
        if not self.task_model:
            return self._get_empty_status_distribution()
        
        query = select(self.task_model).limit(2000)
        query = self._apply_user_filter(query, user_id)
        
        try:
            result = await self.db.execute(query)
            tasks = result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing status distribution query: {e}")
            return self._get_empty_status_distribution()
        
        status_config = {
            "pending": {"label": "Pending", "color": "#ed6c02", "count": 0},
            "in_progress": {"label": "In Progress", "color": "#1976d2", "count": 0},
            "completed": {"label": "Completed", "color": "#2e7d32", "count": 0},
            "overdue": {"label": "Overdue", "color": "#d32f2f", "count": 0}
        }
        
        current_date = datetime.utcnow().date()
        
        for task in tasks:
            # Check status field
            status = None
            if self._has_attribute(task, 'status'):
                status = str(task.status).lower() if task.status else None
            elif self._has_attribute(task, 'state'):
                status = str(task.state).lower() if task.state else None
            
            if status in ['completed', 'done', 'closed', 'finished']:
                status_config["completed"]["count"] += 1
            elif status in ['in_progress', 'in-progress', 'ongoing', 'active']:
                status_config["in_progress"]["count"] += 1
            elif status in ['pending', 'open', 'new', 'todo']:
                # Check if overdue
                if self._has_attribute(task, 'due_date') and task.due_date and task.due_date.date() < current_date:
                    status_config["overdue"]["count"] += 1
                else:
                    status_config["pending"]["count"] += 1
            else:
                # Try to determine by other fields
                if self._has_attribute(task, 'completed_at') and task.completed_at:
                    status_config["completed"]["count"] += 1
                elif self._has_attribute(task, 'due_date') and task.due_date and task.due_date.date() < current_date:
                    status_config["overdue"]["count"] += 1
                elif self._has_attribute(task, 'progress') and task.progress:
                    if task.progress >= 100:
                        status_config["completed"]["count"] += 1
                    elif task.progress > 0:
                        status_config["in_progress"]["count"] += 1
                    else:
                        status_config["pending"]["count"] += 1
                else:
                    status_config["pending"]["count"] += 1
        
        return {
            "labels": [s["label"] for s in status_config.values()],
            "datasets": [{
                "data": [s["count"] for s in status_config.values()],
                "backgroundColor": [s["color"] for s in status_config.values()],
                "borderWidth": 0
            }]
        }
    
    @retry_on_error(max_retries=2)
    async def get_monthly_trend(self, user_id: str = None, months: int = 6) -> Dict[str, Any]:
        """Get monthly task trends"""
        if not self.task_model:
            return self._get_empty_monthly_trend(months)
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=months*30)
        
        query = select(self.task_model).limit(2000)
        query = self._apply_user_filter(query, user_id)
        
        if self._has_attribute(self.task_model, 'created_at'):
            query = query.where(self.task_model.created_at >= start_date)
        
        try:
            result = await self.db.execute(query)
            tasks = result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing monthly trend query: {e}")
            return self._get_empty_monthly_trend(months)
        
        # Prepare month range (last N months)
        month_range = []
        month_keys = []
        for i in range(months-1, -1, -1):
            month_date = end_date - timedelta(days=30*i)
            month_range.append(month_date.strftime("%b"))
            month_keys.append(month_date.strftime("%Y-%m"))
        
        # Count per month
        created_counts = defaultdict(int)
        completed_counts = defaultdict(int)
        
        for task in tasks:
            if self._has_attribute(task, 'created_at') and task.created_at:
                month_key = task.created_at.strftime("%Y-%m")
                created_counts[month_key] += 1
            
            if self._has_attribute(task, 'completed_at') and task.completed_at:
                month_key = task.completed_at.strftime("%Y-%m")
                completed_counts[month_key] += 1
        
        created_data = [created_counts.get(key, 0) for key in month_keys]
        completed_data = [completed_counts.get(key, 0) for key in month_keys]
        
        return {
            "labels": month_range,
            "datasets": [
                {
                    "label": "Tasks Created",
                    "data": created_data,
                    "borderColor": "#1976d2",
                    "backgroundColor": "rgba(25, 118, 210, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Tasks Completed",
                    "data": completed_data,
                    "borderColor": "#2e7d32",
                    "backgroundColor": "rgba(46, 125, 50, 0.1)",
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
        
        query = select(self.task_model).limit(2000)
        query = self._apply_user_filter(query, user_id)
        
        try:
            result = await self.db.execute(query)
            tasks = result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing priority distribution query: {e}")
            return self._get_empty_priority_distribution()
        
        priority_config = {
            "high": {"label": "High", "color": "#d32f2f", "count": 0},
            "medium": {"label": "Medium", "color": "#ed6c02", "count": 0},
            "low": {"label": "Low", "color": "#2e7d32", "count": 0}
        }
        
        for task in tasks:
            # Try different priority field names
            priority = None
            if self._has_attribute(task, 'priority'):
                priority = str(task.priority).lower() if task.priority else None
            elif self._has_attribute(task, 'priority_level'):
                priority = str(task.priority_level).lower() if task.priority_level else None
            elif self._has_attribute(task, 'urgency'):
                priority = str(task.urgency).lower() if task.urgency else None
            
            if priority:
                if priority in ['high', '1', 'critical', 'urgent']:
                    priority_config["high"]["count"] += 1
                elif priority in ['medium', '2', 'normal', 'standard']:
                    priority_config["medium"]["count"] += 1
                elif priority in ['low', '3']:
                    priority_config["low"]["count"] += 1
                else:
                    priority_config["medium"]["count"] += 1
            else:
                priority_config["medium"]["count"] += 1
        
        return {
            "labels": [p["label"] for p in priority_config.values()],
            "datasets": [{
                "data": [p["count"] for p in priority_config.values()],
                "backgroundColor": [p["color"] for p in priority_config.values()],
                "borderWidth": 0
            }]
        }
    
    async def get_cached_or_compute(self, cache_key: str, compute_func: Callable[[], Awaitable], ttl_minutes: int = 30):
        """Get data from cache or compute it"""
        try:
            from app.models.chart_data import ChartDataCache
            
            # Check cache - using async
            result = await self.db.execute(
                select(ChartDataCache).where(ChartDataCache.cache_key == cache_key)
            )
            cache_entry = result.scalar_one_or_none()
            
            if cache_entry and cache_entry.expires_at > datetime.utcnow():
                logger.debug(f"Cache hit for {cache_key}")
                return cache_entry.data
            
            # Compute new data
            logger.debug(f"Cache miss for {cache_key}, computing...")
            data = await compute_func()
            
            # Store in cache
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
            return data
        except Exception as e:
            logger.warning(f"Cache error (continuing without cache): {e}")
            return await compute_func()
    
    # ==================== Helper Methods for Empty Data ====================
    
    def _get_empty_chart_data(self, labels):
        """Return empty chart data structure"""
        return {
            "labels": labels,
            "datasets": [
                {"label": "Tasks Created", "data": [0] * len(labels), "backgroundColor": "#1976d2", "borderRadius": 6},
                {"label": "Tasks Completed", "data": [0] * len(labels), "backgroundColor": "#2e7d32", "borderRadius": 6}
            ]
        }
    
    def _get_empty_status_distribution(self):
        """Return empty status distribution"""
        return {
            "labels": ["Pending", "In Progress", "Completed", "Overdue"],
            "datasets": [{
                "data": [0, 0, 0, 0],
                "backgroundColor": ["#ed6c02", "#1976d2", "#2e7d32", "#d32f2f"],
                "borderWidth": 0
            }]
        }
    
    def _get_empty_monthly_trend(self, months):
        """Return empty monthly trend"""
        end_date = datetime.utcnow()
        month_range = []
        for i in range(months-1, -1, -1):
            month_date = end_date - timedelta(days=30*i)
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
                }
            ]
        }
    
    def _get_empty_priority_distribution(self):
        """Return empty priority distribution"""
        return {
            "labels": ["High", "Medium", "Low"],
            "datasets": [{
                "data": [0, 0, 0],
                "backgroundColor": ["#d32f2f", "#ed6c02", "#2e7d32"],
                "borderWidth": 0
            }]
        }