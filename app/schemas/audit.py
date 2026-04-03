# app/schemas/audit.py
from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid

class AuditLogBase(BaseModel):
    action: str
    table_name: str
    record_id: Optional[str] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    endpoint: Optional[str] = None
    request_id: Optional[str] = None
    changes_summary: Optional[str] = None

class AuditLogResponse(AuditLogBase):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    username: Optional[str] = None
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)

class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    size: int
    pages: int

class AuditLogSummary(BaseModel):
    period_days: int
    total_actions: int
    actions_by_type: Dict[str, int]
    top_users: List[Dict[str, Any]]