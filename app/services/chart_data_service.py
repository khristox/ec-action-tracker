# app/services/chart_data_service.py - IMPROVED VERSION

from datetime import datetime, timedelta
from sqlalchemy import func, and_, or_, select, case
from sqlalchemy.ext.asyncio import AsyncSession
from collections import defaultdict
import logging
from typing import Optional, List, Dict, Any, Callable, Awaitable
from functools import wraps

from app.models.meetings.action_tracker import Meeting, MeetingAction, MeetingParticipant

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
    def __init__(self, db_session):
        self.db = db_session
        # Use MeetingAction for tasks, NOT ActionComment
        self.task_model = MeetingAction  # This was incorrectly set to ActionComment
        self.meeting_model = Meeting
        self.participant_model = MeetingParticipant

    def _get_empty_monthly_trend(self, months: int) -> Dict[str, Any]:
        """Return empty monthly trend data structure"""
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

    
    def _discover_models(self):
        """Dynamically discover the correct model from action_tracker"""
        try:
            from app.models.meetings import action_tracker
            
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
    async def get_weekly_activity1(self, user_id: str = None, user_email: str = None, user_phone: str = None, days: int = 7) -> Dict[str, Any]:
        """Get weekly task creation and completion activity for tasks assigned to user
        
        Checks both:
        1. assigned_to_id matches the user_id directly (handles NULL)
        2. assigned_to_name JSON contains user's email or phone (for legacy/imported data)
        """
        from sqlalchemy import or_, and_, func
        from sqlalchemy.sql import expression
        
        if not self.task_model:
            return self._get_empty_chart_data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Build query using select
        query = select(self.task_model).limit(2000)
        
        # Apply user filter with both ID and JSON matching
        if user_id or user_email or user_phone:
            conditions = []
            
            # Condition 1: Direct user ID match (NULL assigned_to_id won't match)
            if user_id:
                conditions.append(self.task_model.assigned_to_id == user_id)
            
            # Condition 2: Match by email in JSON field (handles NULL assigned_to_name)
            if user_email:
                email_condition = func.json_unquote(
                    func.json_extract(
                        func.ifnull(self.task_model.assigned_to_name, '{}'), 
                        '$.email'
                    )
                ).like(f"%{user_email}%")
                conditions.append(email_condition)
            
            # Condition 3: Match by phone in JSON field (handles NULL assigned_to_name)
            if user_phone:
                phone_condition = func.json_unquote(
                    func.json_extract(
                        func.ifnull(self.task_model.assigned_to_name, '{}'), 
                        '$.phone'
                    )
                ).like(f"%{user_phone}%")
                conditions.append(phone_condition)
            
            # Apply OR condition if we have conditions
            if conditions:
                query = query.where(or_(*conditions))
            else:
                # No valid conditions, return empty chart
                return self._get_empty_chart_data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        
        # Date filter using date fields - improved to better capture relevant dates
        date_conditions = []
        if self._has_attribute(self.task_model, 'created_at'):
            date_conditions.append(self.task_model.created_at >= start_date)
        
        if self._has_attribute(self.task_model, 'completed_at'):
            date_conditions.append(self.task_model.completed_at >= start_date)
        
        # Also include updated_at for status changes to completion
        if self._has_attribute(self.task_model, 'updated_at'):
            date_conditions.append(self.task_model.updated_at >= start_date)
        
        # Apply date conditions with OR (show tasks that were created, completed, or updated in range)
        if date_conditions:
            query = query.where(or_(*date_conditions))
        else:
            # If no date fields exist, apply no filter
            pass
        
        # Execute query
        try:
            result = await self.db.execute(query)
            tasks = result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing weekly activity query: {e}")
            return self._get_empty_chart_data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        
        # Prepare date range (last 'days' days including today)
        date_range = []
        for i in range(days):
            date = end_date - timedelta(days=days-1-i)
            date_range.append(date.date())
        
        # Helper function to safely get attribute
        def get_attr(obj, attr_name, default=None):
            return getattr(obj, attr_name, default) if self._has_attribute(obj, attr_name) else default
        
        # Count activities with proper date handling
        created_counts = defaultdict(int)
        completed_counts = defaultdict(int)
        
        for task in tasks:
            # Count creation
            created_at = get_attr(task, 'created_at')
            if created_at:
                created_date = created_at.date()
                # Check if within range (including timezone considerations)
                if start_date.date() <= created_date <= end_date.date():
                    created_counts[created_date] += 1
            
            # Count completion - check multiple indicators
            is_completed = False
            completion_date = None
            
            # Check explicit completed_at
            completed_at = get_attr(task, 'completed_at')
            if completed_at:
                completion_date = completed_at.date()
                is_completed = True
            
            # Check status field for completion
            if not is_completed:
                status = get_attr(task, 'status')
                if status and str(status).lower() in ['completed', 'done', 'closed', 'finished']:
                    # Use updated_at if available, otherwise created_at, otherwise today
                    updated_at = get_attr(task, 'updated_at')
                    if updated_at:
                        completion_date = updated_at.date()
                    elif created_at:
                        completion_date = created_at.date()
                    else:
                        completion_date = end_date.date()
                    is_completed = True
            
            # Check state field for completion
            if not is_completed:
                state = get_attr(task, 'state')
                if state and str(state).lower() in ['completed', 'done', 'closed', 'finished']:
                    updated_at = get_attr(task, 'updated_at')
                    if updated_at:
                        completion_date = updated_at.date()
                    elif created_at:
                        completion_date = created_at.date()
                    else:
                        completion_date = end_date.date()
                    is_completed = True
            
            # Check progress for completion
            if not is_completed:
                progress = get_attr(task, 'progress')
                if progress is not None:
                    try:
                        if float(progress) >= 100:
                            updated_at = get_attr(task, 'updated_at')
                            if updated_at:
                                completion_date = updated_at.date()
                            elif created_at:
                                completion_date = created_at.date()
                            else:
                                completion_date = end_date.date()
                            is_completed = True
                    except (ValueError, TypeError):
                        pass
            
            # Count completion if within date range
            if is_completed and completion_date and start_date.date() <= completion_date <= end_date.date():
                completed_counts[completion_date] += 1
        
        # Prepare chart data
        weekday_labels = [d.strftime("%a") for d in date_range]
        created_data = [created_counts.get(d, 0) for d in date_range]
        completed_data = [completed_counts.get(d, 0) for d in date_range]
        
        # Calculate max value for better chart scaling
        max_value = max(max(created_data) if created_data else 0, 
                    max(completed_data) if completed_data else 0)
        
        return {
            "labels": weekday_labels,
            "full_dates": [d.strftime("%Y-%m-%d") for d in date_range],  # Useful for tooltips
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
                "max_value": max_value
            }
        }

    @retry_on_error(max_retries=2)
    async def get_weekly_activity(self, user_id: str = None, user_email: str = None, user_phone: str = None, days: int = 7) -> Dict[str, Any]:
        """Get weekly task creation and completion activity for tasks assigned to user
        
        Checks both:
        1. assigned_to_id matches the user_id directly (handles NULL)
        2. assigned_to_name JSON contains user's email or phone (for legacy/imported data)
        
        Note: Only applies JSON matching if the model has assigned_to_name attribute
        """
        from sqlalchemy import or_, and_, func
        from sqlalchemy.sql import expression
        
        if not self.task_model:
            return self._get_empty_chart_data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Build query using select
        query = select(self.task_model).limit(2000)
        
        # Check what attributes the model has
        has_assigned_to_id = self._has_attribute(self.task_model, 'assigned_to_id')
        has_assigned_to_name = self._has_attribute(self.task_model, 'assigned_to_name')
        
        # Apply user filter with both ID and JSON matching (only if attributes exist)
        if user_id or user_email or user_phone:
            conditions = []
            
            # Condition 1: Direct user ID match (if attribute exists)
            if user_id and has_assigned_to_id:
                conditions.append(self.task_model.assigned_to_id == user_id)
            
            # Condition 2: Match by email in JSON field (only if model has assigned_to_name)
            if user_email and has_assigned_to_name:
                email_condition = func.json_unquote(
                    func.json_extract(
                        func.ifnull(self.task_model.assigned_to_name, '{}'), 
                        '$.email'
                    )
                ).like(f"%{user_email}%")
                conditions.append(email_condition)
            
            # Condition 3: Match by phone in JSON field (only if model has assigned_to_name)
            if user_phone and has_assigned_to_name:
                phone_condition = func.json_unquote(
                    func.json_extract(
                        func.ifnull(self.task_model.assigned_to_name, '{}'), 
                        '$.phone'
                    )
                ).like(f"%{user_phone}%")
                conditions.append(phone_condition)
            
            # Apply OR condition if we have conditions
            if conditions:
                query = query.where(or_(*conditions))
            else:
                # No valid conditions but user filter was requested
                if user_id or user_email or user_phone:
                    logger.warning(f"Model {self.task_model.__name__} has no attributes for user filtering (assigned_to_id={has_assigned_to_id}, assigned_to_name={has_assigned_to_name})")
                    return self._get_empty_chart_data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        
        # Date filter using date fields - improved to better capture relevant dates
        date_conditions = []
        if self._has_attribute(self.task_model, 'created_at'):
            date_conditions.append(self.task_model.created_at >= start_date)
        
        if self._has_attribute(self.task_model, 'completed_at'):
            date_conditions.append(self.task_model.completed_at >= start_date)
        
        # Also include updated_at for status changes to completion
        if self._has_attribute(self.task_model, 'updated_at'):
            date_conditions.append(self.task_model.updated_at >= start_date)
        
        # Apply date conditions with OR (show tasks that were created, completed, or updated in range)
        if date_conditions:
            query = query.where(or_(*date_conditions))
        else:
            # If no date fields exist, apply no filter
            pass
        
        # Execute query
        try:
            result = await self.db.execute(query)
            tasks = result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing weekly activity query: {e}")
            return self._get_empty_chart_data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        
        # Prepare date range (last 'days' days including today)
        date_range = []
        for i in range(days):
            date = end_date - timedelta(days=days-1-i)
            date_range.append(date.date())
        
        # Helper function to safely get attribute
        def get_attr(obj, attr_name, default=None):
            return getattr(obj, attr_name, default) if hasattr(obj, attr_name) else default
        
        # Count activities with proper date handling
        created_counts = defaultdict(int)
        completed_counts = defaultdict(int)
        
        for task in tasks:
            # Count creation
            created_at = get_attr(task, 'created_at')
            if created_at:
                created_date = created_at.date()
                # Check if within range (including timezone considerations)
                if start_date.date() <= created_date <= end_date.date():
                    created_counts[created_date] += 1
            
            # Count completion - check multiple indicators
            is_completed = False
            completion_date = None
            
            # Check explicit completed_at
            completed_at = get_attr(task, 'completed_at')
            if completed_at:
                completion_date = completed_at.date()
                is_completed = True
            
            # Check status field for completion
            if not is_completed:
                status = get_attr(task, 'status')
                if status and str(status).lower() in ['completed', 'done', 'closed', 'finished']:
                    # Use updated_at if available, otherwise created_at, otherwise today
                    updated_at = get_attr(task, 'updated_at')
                    if updated_at:
                        completion_date = updated_at.date()
                    elif created_at:
                        completion_date = created_at.date()
                    else:
                        completion_date = end_date.date()
                    is_completed = True
            
            # Check state field for completion
            if not is_completed:
                state = get_attr(task, 'state')
                if state and str(state).lower() in ['completed', 'done', 'closed', 'finished']:
                    updated_at = get_attr(task, 'updated_at')
                    if updated_at:
                        completion_date = updated_at.date()
                    elif created_at:
                        completion_date = created_at.date()
                    else:
                        completion_date = end_date.date()
                    is_completed = True
            
            # Check progress for completion
            if not is_completed:
                progress = get_attr(task, 'progress')
                if progress is not None:
                    try:
                        if float(progress) >= 100:
                            updated_at = get_attr(task, 'updated_at')
                            if updated_at:
                                completion_date = updated_at.date()
                            elif created_at:
                                completion_date = created_at.date()
                            else:
                                completion_date = end_date.date()
                            is_completed = True
                    except (ValueError, TypeError):
                        pass
            
            # Count completion if within date range
            if is_completed and completion_date and start_date.date() <= completion_date <= end_date.date():
                completed_counts[completion_date] += 1
        
        # Prepare chart data
        weekday_labels = [d.strftime("%a") for d in date_range]
        created_data = [created_counts.get(d, 0) for d in date_range]
        completed_data = [completed_counts.get(d, 0) for d in date_range]
        
        # Calculate max value for better chart scaling
        max_value = max(max(created_data) if created_data else 0, 
                    max(completed_data) if completed_data else 0)
        
        return {
            "labels": weekday_labels,
            "full_dates": [d.strftime("%Y-%m-%d") for d in date_range],  # Useful for tooltips
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
                "max_value": max_value
            }
        }


    @retry_on_error(max_retries=2)
    async def get_status_distribution(self, user_id: str = None, user_email: str = None, user_phone: str = None) -> Dict[str, Any]:
        """Get task status distribution for tasks assigned to user
        
        Checks matches on:
        1. assigned_to_id matches the user_id (handles NULL - NULL won't match)
        2. assigned_to_name JSON contains user's email (if attribute exists)
        3. assigned_to_name JSON contains user's phone (if attribute exists)
        
        Note: If assigned_to_id is NULL, the task will only be included if email/phone matches
        """
        from sqlalchemy import or_, and_, func
        from sqlalchemy.sql import expression
        
        if not self.task_model:
            return self._get_empty_status_distribution()
        
        query = select(self.task_model).limit(2000)
        
        # Build user assignment filter - only if attributes exist
        if user_id or user_email or user_phone:
            conditions = []
            
            # Condition 1: Direct user ID match (if attribute exists)
            if user_id and self._has_attribute(self.task_model, 'assigned_to_id'):
                conditions.append(self.task_model.assigned_to_id == user_id)
            
            # Condition 2: Match by email in JSON field (if attribute exists)
            if user_email and self._has_attribute(self.task_model, 'assigned_to_name'):
                # Use nullsafe_json_extract or handle NULL assigned_to_name
                email_condition = func.json_unquote(
                    func.json_extract(
                        func.ifnull(self.task_model.assigned_to_name, '{}'), 
                        '$.email'
                    )
                ).like(f"%{user_email}%")
                conditions.append(email_condition)
            
            # Condition 3: Match by phone in JSON field (if attribute exists)
            if user_phone and self._has_attribute(self.task_model, 'assigned_to_name'):
                phone_condition = func.json_unquote(
                    func.json_extract(
                        func.ifnull(self.task_model.assigned_to_name, '{}'), 
                        '$.phone'
                    )
                ).like(f"%{user_phone}%")
                conditions.append(phone_condition)
            
            # Apply OR condition only if we have conditions
            if conditions:
                query = query.where(or_(*conditions))
            else:
                # No valid conditions (model missing required attributes), return all tasks? or empty?
                # For safety, return empty if we have user filter but no way to apply it
                if user_id or user_email or user_phone:
                    logger.warning(f"Model {self.task_model.__name__} missing required attributes for user filtering")
                    return self._get_empty_status_distribution()
        
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
            # Helper function to safely get attribute
            def get_attr(obj, attr_name, default=None):
                return getattr(obj, attr_name, default) if self._has_attribute(obj, attr_name) else default
            
            # Check explicit completed status (most reliable)
            completed_at = get_attr(task, 'completed_at')
            if completed_at:
                status_config["completed"]["count"] += 1
                continue
            
            # Check status field
            status = get_attr(task, 'status')
            if status:
                status_lower = str(status).lower()
                if status_lower in ['completed', 'done', 'closed', 'finished']:
                    status_config["completed"]["count"] += 1
                    continue
                elif status_lower in ['in_progress', 'in-progress', 'ongoing', 'active', 'in progress']:
                    status_config["in_progress"]["count"] += 1
                    continue
            
            # Check state field
            state = get_attr(task, 'state')
            if state:
                state_lower = str(state).lower()
                if state_lower in ['completed', 'done', 'closed', 'finished']:
                    status_config["completed"]["count"] += 1
                    continue
                elif state_lower in ['in_progress', 'in-progress', 'ongoing', 'active', 'in progress']:
                    status_config["in_progress"]["count"] += 1
                    continue
            
            # Check progress percentage
            progress = get_attr(task, 'progress')
            if progress is not None:
                try:
                    progress_val = float(progress)
                    if progress_val >= 100:
                        status_config["completed"]["count"] += 1
                        continue
                    elif progress_val > 0:
                        status_config["in_progress"]["count"] += 1
                        continue
                except (ValueError, TypeError):
                    pass
            
            # Check overall status name
            overall_status_name = get_attr(task, 'overall_status_name')
            if overall_status_name:
                status_lower = str(overall_status_name).lower()
                if status_lower in ['completed', 'done', 'closed', 'finished']:
                    status_config["completed"]["count"] += 1
                    continue
                elif status_lower in ['in_progress', 'in-progress', 'ongoing', 'active', 'in progress']:
                    status_config["in_progress"]["count"] += 1
                    continue
            
            # Check overall status ID
            overall_status_id = get_attr(task, 'overall_status_id')
            if overall_status_id is not None:
                # Common status ID mappings
                if overall_status_id in [3, 4, 5, 100]:  # Completed status IDs
                    status_config["completed"]["count"] += 1
                    continue
                elif overall_status_id in [2, 6]:  # In progress status IDs
                    status_config["in_progress"]["count"] += 1
                    continue
            
            # If not completed or in_progress, check if overdue
            due_date = get_attr(task, 'due_date')
            if due_date and due_date.date() < current_date:
                status_config["overdue"]["count"] += 1
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
    async def get_monthly_trend(self, user_id: str = None, user_email: str = None, user_phone: str = None, months: int = 6) -> Dict[str, Any]:
        """Get monthly task and meeting trends for user
        
        Checks both:
        1. Tasks: assigned_to_id matches user_id OR assigned_to_name JSON contains user's email/phone
        2. Meetings: user is participant OR is the creator of the meeting
        """
        from sqlalchemy import or_, func
        from app.models.meetings.action_tracker import Meeting, MeetingParticipant
        
        if not self.task_model:
            return self._get_empty_monthly_trend(months)
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=months*30)

        
        # ========== TASKS QUERY ==========
        task_query = select(self.task_model).limit(2000)
        
        # Apply user filter for tasks
        if user_id:
            conditions = [self.task_model.assigned_to_id == user_id]
            
            if user_email:
                email_condition = func.json_unquote(
                    func.json_extract(self.task_model.assigned_to_name, '$.email')
                ).like(f"%{user_email}%")
                conditions.append(email_condition)
            
            if user_phone:
                phone_condition = func.json_unquote(
                    func.json_extract(self.task_model.assigned_to_name, '$.phone')
                ).like(f"%{user_phone}%")
                conditions.append(phone_condition)
            
            if conditions:
                task_query = task_query.where(or_(*conditions))
        
        if self._has_attribute(self.task_model, 'created_at'):
            task_query = task_query.where(self.task_model.created_at >= start_date)
        
        # ========== MEETINGS QUERY ==========
        meeting_ids = set()
        
        # Find meetings where user is a participant
        if user_email or user_phone:
            participant_conditions = []
            if user_email:
                participant_conditions.append(MeetingParticipant.email == user_email)
            if user_phone:
                participant_conditions.append(MeetingParticipant.telephone == user_phone)
            
            participant_result = await self.db.execute(
                select(MeetingParticipant.meeting_id).where(or_(*participant_conditions))
            )
            participant_meeting_ids = participant_result.scalars().all()
            meeting_ids.update(participant_meeting_ids)

        
        
        # Find meetings where user is the creator
        if user_id:
            creator_result = await self.db.execute(
                select(Meeting.id).where(
                    Meeting.created_by_id == user_id,
                    Meeting.is_active == True
                )
            )
            creator_meeting_ids = creator_result.scalars().all()
            meeting_ids.update(creator_meeting_ids)
        
        # Query meetings
        meetings = []
        if meeting_ids:
            meeting_query = select(Meeting).where(
                Meeting.id.in_(list(meeting_ids)),
                Meeting.is_active == True,
                Meeting.created_at >= start_date
            )
            meeting_result = await self.db.execute(meeting_query)
            meetings = meeting_result.scalars().all()
        
        # ========== PROCESS TASKS ==========
        try:
            task_result = await self.db.execute(task_query)
            tasks = task_result.scalars().all()
        except Exception as e:
            logger.error(f"Error executing monthly trend query for tasks: {e}")
            tasks = []
        
        # Prepare month range (last N months)
        month_range = []
        month_keys = []
        for i in range(months-1, -1, -1):
            month_date = end_date - timedelta(days=30*i)
            month_range.append(month_date.strftime("%b"))
            month_keys.append(month_date.strftime("%Y-%m"))
        
        # Count tasks per month
        tasks_created_counts = defaultdict(int)
        tasks_completed_counts = defaultdict(int)
        
        for task in tasks:
            if self._has_attribute(task, 'created_at') and task.created_at:
                month_key = task.created_at.strftime("%Y-%m")
                tasks_created_counts[month_key] += 1
            
            if self._has_attribute(task, 'completed_at') and task.completed_at:
                month_key = task.completed_at.strftime("%Y-%m")
                tasks_completed_counts[month_key] += 1
        
        # Count meetings per month
        meetings_created_counts = defaultdict(int)
        meetings_completed_counts = defaultdict(int)
        
        for meeting in meetings:
            if hasattr(meeting, 'created_at') and meeting.created_at:
                month_key = meeting.created_at.strftime("%Y-%m")
                meetings_created_counts[month_key] += 1
            
            # For meetings, "completed" could mean meetings that have passed or have status "completed"
            if hasattr(meeting, 'meeting_date') and meeting.meeting_date:
                if meeting.meeting_date < datetime.utcnow():
                    month_key = meeting.meeting_date.strftime("%Y-%m")
                    meetings_completed_counts[month_key] += 1
        
        # Build datasets
        tasks_created_data = [tasks_created_counts.get(key, 0) for key in month_keys]
        tasks_completed_data = [tasks_completed_counts.get(key, 0) for key in month_keys]
        meetings_created_data = [meetings_created_counts.get(key, 0) for key in month_keys]
        meetings_completed_data = [meetings_completed_counts.get(key, 0) for key in month_keys]
        
        return {
            "labels": month_range,
            "datasets": [
                {
                    "label": "Tasks Created",
                    "data": tasks_created_data,
                    "borderColor": "#1976d2",
                    "backgroundColor": "rgba(25, 118, 210, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Tasks Completed",
                    "data": tasks_completed_data,
                    "borderColor": "#2e7d32",
                    "backgroundColor": "rgba(46, 125, 50, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Meetings Attended",
                    "data": meetings_completed_data,
                    "borderColor": "#ed6c02",
                    "backgroundColor": "rgba(237, 108, 2, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Meetings Organized",
                    "data": meetings_created_data,
                    "borderColor": "#9c27b0",
                    "backgroundColor": "rgba(156, 39, 176, 0.1)",
                    "fill": True,
                    "tension": 0.4
                }
            ]
        }

    def _get_empty_monthly_trend(self, months: int) -> Dict[str, Any]:
        """Return empty monthly trend data structure"""
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