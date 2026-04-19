# app/schemas/action_tracker/action.py
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any

class ActionBase(BaseModel):
    description: str
    due_date: Optional[datetime] = None
    priority: int = Field(ge=1, le=4, description="1=High, 2=Medium, 3=Low, 4=Very Low")
    remarks: Optional[str] = None
    minute_id: Optional[UUID] = None
    assigned_to_id: Optional[UUID] = None
    assigned_to_name: Optional[Dict[str, Any]] = None

class ActionCreate(ActionBase):
    pass

class ActionUpdate(BaseModel):
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[int] = Field(None, ge=1, le=4)
    remarks: Optional[str] = None
    assigned_to_id: Optional[UUID] = None
    assigned_to_name: Optional[Dict[str, Any]] = None
    overall_progress_percentage: Optional[int] = Field(None, ge=0, le=100)
    overall_status_id: Optional[UUID] = None

class ActionResponse(ActionBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    overall_progress_percentage: int = 0
    overall_status_name: Optional[str] = None
    overall_status_id: Optional[UUID] = None
    assigned_to: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True