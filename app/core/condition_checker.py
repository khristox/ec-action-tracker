from datetime import datetime, time
from typing import Dict, Any, Optional, List
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

class ConditionChecker:
    """Check if conditions are satisfied for a permission"""
    
    def __init__(self):
        self.checkers = {
            "time_restricted": self.check_time_restricted,
            "date_range": self.check_date_range,
            "ownership": self.check_ownership,
            "team_membership": self.check_team_membership,
            "attribute_match": self.check_attribute_match,
            "resource_state": self.check_resource_state,
            "hierarchy": self.check_hierarchy,
            "quota": self.check_quota,
            "threshold": self.check_threshold,
            "composite": self.check_composite,
            "geographic": self.check_geographic,
            "ip_restricted": self.check_ip_restricted,
            "department_match": self.check_department_match
        }
    
    async def check_conditions(
        self,
        conditions: Optional[Dict],
        user: User,
        resource: Optional[Any] = None,
        context: Optional[Dict] = None
    ) -> bool:
        """Check if all conditions are satisfied"""
        if not conditions:
            return True
        
        condition_type = conditions.get("type")
        if not condition_type:
            # If no type specified, treat as simple condition block
            return await self.check_condition_block(conditions, user, resource, context)
        
        checker = self.checkers.get(condition_type)
        
        if not checker:
            logger.warning(f"Unknown condition type: {condition_type}")
            return False
        
        try:
            return await checker(conditions, user, resource, context or {})
        except Exception as e:
            logger.error(f"Error checking condition {condition_type}: {e}")
            return False
    
    async def check_condition_block(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Optional[Dict]
    ) -> bool:
        """Check a block of conditions (for backward compatibility)"""
        for key, value in conditions.items():
            if key == "owner_only" and value:
                if not await self.check_ownership({"type": "ownership"}, user, resource, context):
                    return False
            elif key == "department_match" and value:
                if not await self.check_department_match({"type": "department_match"}, user, resource, context):
                    return False
        return True
    
    async def check_time_restricted(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check if current time is within allowed hours"""
        now = datetime.now()
        current_day = now.strftime("%A").lower()
        current_time = now.time()
        
        # Check allowed days
        allowed_days = conditions.get("allowed_days", [])
        if allowed_days:
            allowed_days = [day.lower() for day in allowed_days]
            if current_day not in allowed_days:
                logger.debug(f"Day {current_day} not in allowed days: {allowed_days}")
                return False
        
        # Check allowed hours
        hours = conditions.get("allowed_hours", {})
        if hours:
            start_str = hours.get("start", "00:00")
            end_str = hours.get("end", "23:59")
            
            start = datetime.strptime(start_str, "%H:%M").time()
            end = datetime.strptime(end_str, "%H:%M").time()
            
            if start <= end:
                # Normal time range (e.g., 09:00-17:00)
                if not (start <= current_time <= end):
                    logger.debug(f"Time {current_time} not in range {start}-{end}")
                    return False
            else:
                # Overnight range (e.g., 22:00-06:00)
                if not (current_time >= start or current_time <= end):
                    logger.debug(f"Time {current_time} not in overnight range {start}-{end}")
                    return False
        
        return True
    
    async def check_date_range(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check if current date is within allowed range"""
        now = datetime.now()
        
        start_date = conditions.get("start_date")
        if start_date:
            start = datetime.fromisoformat(start_date)
            if now < start:
                logger.debug(f"Current date {now} before start date {start}")
                return False
        
        end_date = conditions.get("end_date")
        if end_date:
            end = datetime.fromisoformat(end_date)
            if now > end:
                logger.debug(f"Current date {now} after end date {end}")
                return False
        
        return True
    
    async def check_ownership(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check if user owns the resource"""
        if not resource:
            # If no resource, ownership check fails
            return False
        
        owner_field = conditions.get("owner_field", "created_by_id")
        resource_owner_id = getattr(resource, owner_field, None)
        
        if resource_owner_id == user.id:
            return True
        
        # Check delegates if allowed
        if conditions.get("allow_delegates"):
            delegate_field = conditions.get("delegate_field")
            if delegate_field:
                delegate_id = getattr(resource, delegate_field, None)
                if delegate_id == user.id:
                    return True
            
            # Check delegates list
            delegates_field = conditions.get("delegates_field")
            if delegates_field:
                delegates = getattr(resource, delegates_field, [])
                if user.id in delegates:
                    return True
        
        logger.debug(f"User {user.id} does not own resource (owner: {resource_owner_id})")
        return False
    
    async def check_team_membership(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check if user is a member of the resource's team"""
        if not resource:
            return False
        
        team_field = conditions.get("team_field", "team_id")
        resource_team_id = getattr(resource, team_field, None)
        
        if not resource_team_id:
            return False
        
        # Get user's teams from context or database
        user_teams = context.get("user_teams", [])
        if resource_team_id in user_teams:
            return True
        
        # Check role in team if specified
        role_in_team = conditions.get("role_in_team")
        if role_in_team:
            user_team_roles = context.get("user_team_roles", {})
            if user_team_roles.get(resource_team_id) in role_in_team:
                return True
        
        return False
    
    async def check_attribute_match(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check if user attribute matches resource attribute"""
        if not resource:
            return False
        
        resource_attr = conditions.get("resource_attribute")
        user_attr = conditions.get("user_attribute")
        
        if not resource_attr or not user_attr:
            return False
        
        resource_value = getattr(resource, resource_attr, None)
        user_value = getattr(user, user_attr, None)
        
        # Check if we need to check in array
        if conditions.get("in_array", False):
            if not isinstance(resource_value, list):
                resource_value = [resource_value]
            return user_value in resource_value
        
        if conditions.get("allow_null", False) and resource_value is None:
            return True
        
        return resource_value == user_value
    
    async def check_resource_state(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check if resource is in required state"""
        if not resource:
            return False
        
        required_state = conditions.get("required_state", {})
        
        for attr, required_value in required_state.items():
            actual_value = getattr(resource, attr, None)
            if actual_value != required_value:
                logger.debug(f"Resource state mismatch: {attr}={actual_value}, required={required_value}")
                return False
        
        return True
    
    async def check_hierarchy(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check hierarchical relationship"""
        if not resource:
            return False
        
        relation = conditions.get("relation")
        if not relation:
            return False
        
        if relation == "manages":
            # Check if user manages the resource owner
            managed_users = context.get("managed_users", [])
            resource_owner_id = getattr(resource, "created_by_id", None)
            
            if resource_owner_id in managed_users:
                return True
            
            # Check depth
            depth = conditions.get("depth", 1)
            if depth > 1:
                # Check indirect reports
                indirect_reports = context.get("indirect_reports", [])
                if resource_owner_id in indirect_reports:
                    return True
        
        return False
    
    async def check_quota(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check if user hasn't exceeded their quota"""
        usage_service = context.get("usage_service")
        if not usage_service:
            # Can't check quota, allow by default but log warning
            logger.warning("Quota check requested but no usage service provided")
            return True
        
        limit = conditions.get("limit")
        period = conditions.get("period", "total")
        resource_type = conditions.get("resource", "general")
        
        current_usage = await usage_service.get_user_usage(
            user.id,
            resource_type=resource_type,
            period=period
        )
        
        if current_usage >= limit:
            logger.debug(f"User {user.id} quota exceeded: {current_usage}/{limit}")
            return False
        
        return True
    
    async def check_threshold(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check if operation is within allowed threshold"""
        value = context.get("value")
        if value is None:
            # If no value provided, can't check threshold
            return True
        
        amount_field = conditions.get("amount_field")
        if amount_field and resource:
            value = getattr(resource, amount_field, value)
        
        # Check against limits
        limits = conditions.get("limits", [])
        for limit in limits:
            if value <= limit.get("max", float('inf')):
                required_role = limit.get("requires")
                if required_role:
                    # Check if user has required role for this limit
                    if user.has_role(required_role):
                        return True
                    else:
                        context["required_approval_role"] = required_role
                        return False
                return True
        
        max_amount = conditions.get("max_amount")
        if max_amount and value > max_amount:
            logger.debug(f"Value {value} exceeds max amount {max_amount}")
            return False
        
        return True
    
    async def check_composite(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check composite conditions with AND/OR logic"""
        subconditions = conditions.get("conditions", [])
        operator = conditions.get("operator", "AND")
        
        if not subconditions:
            return True
        
        if operator.upper() == "AND":
            for subcond in subconditions:
                if not await self.check_conditions(subcond, user, resource, context):
                    return False
            return True
        
        elif operator.upper() == "OR":
            for subcond in subconditions:
                if await self.check_conditions(subcond, user, resource, context):
                    return True
            return False
        
        elif operator.upper() == "NOT":
            # NOT should have exactly one condition
            if subconditions:
                return not await self.check_conditions(subconditions[0], user, resource, context)
            return True
        
        return False
    
    async def check_geographic(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check geographic restrictions"""
        # Get user's location from context
        user_location = context.get("user_location")
        if not user_location:
            # If no location, check if it's required
            if conditions.get("require_location", False):
                return False
            return True
        
        allowed_countries = conditions.get("allowed_countries", [])
        if allowed_countries and user_location.get("country") not in allowed_countries:
            return False
        
        allowed_regions = conditions.get("allowed_regions", [])
        if allowed_regions and user_location.get("region") not in allowed_regions:
            return False
        
        return True
    
    async def check_ip_restricted(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check IP address restrictions"""
        client_ip = context.get("client_ip")
        if not client_ip:
            return False
        
        allowed_ips = conditions.get("allowed_ips", [])
        if allowed_ips and client_ip not in allowed_ips:
            return False
        
        allowed_ranges = conditions.get("allowed_ranges", [])
        if allowed_ranges and not self._ip_in_ranges(client_ip, allowed_ranges):
            return False
        
        return True
    
    async def check_department_match(
        self,
        conditions: Dict,
        user: User,
        resource: Optional[Any],
        context: Dict
    ) -> bool:
        """Check if user's department matches resource department"""
        if not resource:
            return False
        
        resource_dept_field = conditions.get("resource_department_field", "department_id")
        resource_dept = getattr(resource, resource_dept_field, None)
        
        if not resource_dept:
            return False
        
        return resource_dept == user.department_id
    
    def _ip_in_ranges(self, ip: str, ranges: List[str]) -> bool:
        """Check if IP is in any of the CIDR ranges"""
        import ipaddress
        
        try:
            ip_obj = ipaddress.ip_address(ip)
            for cidr in ranges:
                network = ipaddress.ip_network(cidr)
                if ip_obj in network:
                    return True
        except Exception:
            pass
        
        return False