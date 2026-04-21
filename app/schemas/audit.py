# app/schemas/audit.py

from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
import uuid
import re


# ==================== Enums ====================

class AuditAction(str, Enum):
    """Standard audit action types"""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    VIEW = "VIEW"
    EXPORT = "EXPORT"
    IMPORT = "IMPORT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    ASSIGN = "ASSIGN"
    COMPLETE = "COMPLETE"
    CANCEL = "CANCEL"
    RESTORE = "RESTORE"
    ARCHIVE = "ARCHIVE"


class AuditStatus(str, Enum):
    """Audit log status"""
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    PARTIAL = "PARTIAL"
    PENDING = "PENDING"

    @classmethod
    def _missing_(cls, value):
        """Handle case-insensitive lookups"""
        if isinstance(value, str):
            upper_value = value.upper()
            for member in cls:
                if member.value == upper_value:
                    return member
        return None


class AuditTableName(str, Enum):
    """Valid table names for audit logs"""
    MEETINGS = "meetings"
    MEETING_MINUTES = "meeting_minutes"
    MEETING_ACTIONS = "meeting_actions"
    MEETING_DOCUMENTS = "meeting_documents"
    MEETING_PARTICIPANTS = "meeting_participants"
    USERS = "users"
    ROLES = "roles"
    PERMISSIONS = "permissions"
    PARTICIPANTS = "participants"
    PARTICIPANT_LISTS = "participant_lists"


# ==================== Base Schemas ====================

class AuditLogBase(BaseModel):
    """Base schema for audit log"""
    action: str = Field(..., description="Action performed", min_length=1, max_length=100)
    table_name: str = Field(..., description="Database table name", min_length=1, max_length=100)
    record_id: Optional[str] = Field(None, description="ID of the affected record", max_length=255)
    old_values: Optional[Dict[str, Any]] = Field(None, description="Old values before change")
    new_values: Optional[Dict[str, Any]] = Field(None, description="New values after change")
    ip_address: Optional[str] = Field(None, description="IP address of the requester")
    user_agent: Optional[str] = Field(None, description="User agent string", max_length=500)
    endpoint: Optional[str] = Field(None, description="API endpoint called", max_length=500)
    request_id: Optional[str] = Field(None, description="Request ID for tracing", max_length=100)
    changes_summary: Optional[str] = Field(None, description="Human-readable summary of changes", max_length=1000)
    status: AuditStatus = Field(default=AuditStatus.SUCCESS, description="Status of the operation")
    error_message: Optional[str] = Field(None, description="Error message if operation failed", max_length=1000)
    duration_ms: Optional[int] = Field(None, description="Operation duration in milliseconds", ge=0)
    
    @field_validator("ip_address")
    @classmethod
    def validate_ip_address(cls, v: Optional[str]) -> Optional[str]:
        """Validate IP address format"""
        if v:
            # Simple IPv4 validation
            ipv4_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
            if not re.match(ipv4_pattern, v):
                # Could also be IPv6, we'll just accept it
                pass
        return v
    
    @field_validator("action", "table_name")
    @classmethod
    def validate_no_special_chars(cls, v: str) -> str:
        """Ensure no dangerous characters in action and table_name"""
        if v and any(c in v for c in [';', '--', '/*', '*/']):
            raise ValueError(f"Invalid characters in {v}")
        return v.upper() if v else v
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "action": "UPDATE",
                "table_name": "meetings",
                "record_id": "123e4567-e89b-12d3-a456-426614174000",
                "old_values": {"title": "Old Title"},
                "new_values": {"title": "New Title"},
                "ip_address": "192.168.1.1",
                "user_agent": "Mozilla/5.0...",
                "endpoint": "/api/v1/meetings/123",
                "changes_summary": "Updated meeting title from 'Old Title' to 'New Title'",
                "status": "SUCCESS"
            }
        }
    )


# ==================== Request Schemas ====================

class AuditLogCreate(AuditLogBase):
    """Schema for creating an audit log"""
    user_id: Optional[uuid.UUID] = Field(None, description="ID of the user who performed the action")
    username: Optional[str] = Field(None, description="Username of the user", max_length=100)
    user_email: Optional[str] = Field(None, description="Email of the user", max_length=255)
    
    @field_validator("user_email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Validate email format"""
        if v:
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, v):
                raise ValueError("Invalid email format")
        return v


class AuditLogFilter(BaseModel):
    """Filter parameters for audit logs"""
    action: Optional[str] = Field(None, description="Filter by action")
    table_name: Optional[str] = Field(None, description="Filter by table name")
    user_id: Optional[uuid.UUID] = Field(None, description="Filter by user ID")
    username: Optional[str] = Field(None, description="Filter by username")
    status: Optional[AuditStatus] = Field(None, description="Filter by status")
    start_date: Optional[datetime] = Field(None, description="Filter by start date (inclusive)")
    end_date: Optional[datetime] = Field(None, description="Filter by end date (inclusive)")
    search: Optional[str] = Field(None, description="Search in action, table_name, changes_summary")
    record_id: Optional[str] = Field(None, description="Filter by record ID")
    min_duration_ms: Optional[int] = Field(None, description="Minimum duration in milliseconds", ge=0)
    max_duration_ms: Optional[int] = Field(None, description="Maximum duration in milliseconds", ge=0)
    
    @field_validator("start_date", "end_date")
    @classmethod
    def validate_date_range(cls, v: Optional[datetime], info) -> Optional[datetime]:
        """Validate date range"""
        if v and info.data.get("start_date") and info.data.get("end_date"):
            if info.data["start_date"] > info.data["end_date"]:
                raise ValueError("start_date must be before end_date")
        return v
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "action": "UPDATE",
            "table_name": "meetings",
            "start_date": "2024-01-01T00:00:00",
            "end_date": "2024-12-31T23:59:59",
            "status": "SUCCESS"
        }
    })


class AuditLogExportRequest(BaseModel):
    """Request schema for exporting audit logs"""
    format: str = Field("csv", description="Export format (csv or json)", pattern="^(csv|json)$")
    filters: Optional[AuditLogFilter] = Field(None, description="Filters to apply before export")
    include_old_values: bool = Field(False, description="Include old values in export")
    include_new_values: bool = Field(False, description="Include new values in export")
    include_extra_data: bool = Field(False, description="Include extra data in export")


# ==================== Response Schemas ====================

class AuditLogResponse(AuditLogBase):
    """Response schema for a single audit log"""
    id: uuid.UUID = Field(..., description="Unique identifier")
    user_id: Optional[uuid.UUID] = Field(None, description="ID of the user")
    username: Optional[str] = Field(None, description="Username of the user")
    user_email: Optional[str] = Field(None, description="Email of the user")
    timestamp: datetime = Field(..., description="When the action occurred")
    meeting_id: Optional[str] = Field(None, description="Associated meeting ID (if applicable)")
    context: Optional[str] = Field(None, description="Additional context about the record")
    
    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    """Response schema for paginated audit logs"""
    items: List[AuditLogResponse] = Field(default_factory=list, description="List of audit logs")
    total: int = Field(0, description="Total number of records", ge=0)
    page: int = Field(1, description="Current page number", ge=1)
    size: int = Field(100, description="Number of items per page", ge=1, le=500)
    pages: int = Field(0, description="Total number of pages", ge=0)
    
    @field_validator("pages")
    @classmethod
    def calculate_pages(cls, v: int, info) -> int:
        """Calculate total pages if not provided"""
        if v == 0 and info.data.get("total") and info.data.get("size"):
            return (info.data["total"] + info.data["size"] - 1) // info.data["size"]
        return v


class AuditLogSummary(BaseModel):
    """Summary statistics for audit logs"""
    period_days: int = Field(..., description="Number of days in the summary period", ge=1)
    total_actions: int = Field(0, description="Total number of actions", ge=0)
    actions_by_type: Dict[str, int] = Field(default_factory=dict, description="Actions grouped by type")
    top_users: List[Dict[str, Any]] = Field(default_factory=list, description="Top users by activity")
    status_breakdown: Dict[str, int] = Field(default_factory=dict, description="Breakdown by status")
    daily_breakdown: List[Dict[str, Any]] = Field(default_factory=list, description="Daily activity breakdown")
    average_duration_ms: Optional[float] = Field(None, description="Average operation duration")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "period_days": 30,
            "total_actions": 1250,
            "actions_by_type": {"UPDATE": 500, "CREATE": 300, "DELETE": 200, "VIEW": 250},
            "top_users": [
                {"user": "admin", "count": 400},
                {"user": "john.doe", "count": 300}
            ],
            "status_breakdown": {"SUCCESS": 1200, "FAILURE": 50},
            "daily_breakdown": [
                {"date": "2024-01-01", "count": 45},
                {"date": "2024-01-02", "count": 52}
            ],
            "average_duration_ms": 125.5
        }
    })


class AuditLogFilterOptions(BaseModel):
    """Available filter options for audit logs"""
    actions: List[str] = Field(default_factory=list, description="Available action types")
    table_names: List[str] = Field(default_factory=list, description="Available table names")
    users: List[Dict[str, str]] = Field(default_factory=list, description="Available users")
    statuses: List[str] = Field(default_factory=list, description="Available statuses")
    date_range: Dict[str, Optional[str]] = Field(default_factory=dict, description="Date range of logs")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "actions": ["CREATE", "UPDATE", "DELETE", "LOGIN"],
            "table_names": ["meetings", "users", "roles"],
            "users": [
                {"id": "123", "name": "admin", "email": "admin@example.com"}
            ],
            "statuses": ["SUCCESS", "FAILURE"],
            "date_range": {"min": "2024-01-01T00:00:00", "max": "2024-12-31T23:59:59"}
        }
    })


# ==================== Statistics Schemas ====================

class AuditStatisticsRequest(BaseModel):
    """Request schema for audit statistics"""
    period_days: int = Field(30, description="Number of days to analyze", ge=1, le=365)
    group_by: Optional[str] = Field("day", description="Group by (day, week, month, year)", pattern="^(day|week|month|year)$")
    include_trends: bool = Field(True, description="Include trend analysis")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "period_days": 30,
            "group_by": "day",
            "include_trends": True
        }
    })


class AuditTrend(BaseModel):
    """Trend analysis for audit logs"""
    direction: str = Field(..., description="Trend direction (up, down, stable)")
    percentage_change: float = Field(..., description="Percentage change compared to previous period")
    comparison_period: str = Field(..., description="Comparison period description")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "direction": "up",
            "percentage_change": 15.5,
            "comparison_period": "previous 30 days"
        }
    })


class AuditStatisticsResponse(BaseModel):
    """Response schema for audit statistics"""
    period: Dict[str, str] = Field(..., description="Period analyzed")
    summary: AuditLogSummary
    trends: Optional[AuditTrend] = Field(None, description="Trend analysis")
    
    model_config = ConfigDict(from_attributes=True)


# ==================== Export Schemas ====================

class AuditExportResponse(BaseModel):
    """Response schema for audit export"""
    meeting_id: Optional[str] = Field(None, description="Meeting ID if applicable")
    export_date: datetime = Field(default_factory=datetime.now, description="Export timestamp")
    total_records: int = Field(0, description="Total number of exported records")
    format: str = Field(..., description="Export format")
    filename: str = Field(..., description="Export filename")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "meeting_id": "123e4567-e89b-12d3-a456-426614174000",
            "export_date": "2024-01-15T10:30:00",
            "total_records": 150,
            "format": "csv",
            "filename": "audit_logs_20240115_103000.csv"
        }
    })


# ==================== Helper Schemas ====================

class FieldChange(BaseModel):
    """Schema for individual field change"""
    field: str = Field(..., description="Field name")
    old_value: Optional[Any] = Field(None, description="Old value")
    new_value: Optional[Any] = Field(None, description="New value")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "field": "title",
            "old_value": "Old Meeting Title",
            "new_value": "New Meeting Title"
        }
    })


class AuditChangeSet(BaseModel):
    """Schema for a set of changes in an audit log"""
    changes: List[FieldChange] = Field(default_factory=list, description="List of field changes")
    summary: str = Field(..., description="Summary of changes")
    affected_fields_count: int = Field(0, description="Number of affected fields")


# ==================== Utility Functions ====================

def create_audit_log_from_change_set(
    action: str,
    table_name: str,
    record_id: str,
    change_set: AuditChangeSet,
    user_id: Optional[uuid.UUID] = None,
    username: Optional[str] = None,
    user_email: Optional[str] = None,
    ip_address: Optional[str] = None,
    endpoint: Optional[str] = None
) -> AuditLogCreate:
    """
    Create an audit log from a change set
    """
    return AuditLogCreate(
        action=action,
        table_name=table_name,
        record_id=record_id,
        changes_summary=change_set.summary,
        old_values={c.field: c.old_value for c in change_set.changes if c.old_value is not None},
        new_values={c.field: c.new_value for c in change_set.changes if c.new_value is not None},
        user_id=user_id,
        username=username,
        user_email=user_email,
        ip_address=ip_address,
        endpoint=endpoint,
        status=AuditStatus.SUCCESS
    )