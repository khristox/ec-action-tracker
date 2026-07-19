# app/schemas/action_tracker_files/action.py
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List


class ActionImplementerIn(BaseModel):
    """One row of the Person(s) Implementing table, as submitted by the client."""
    id: Optional[UUID] = None  # existing user id if picked via AssignToSelector, else None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class ActionImplementerOut(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True


class ActionBase(BaseModel):
    description: str
    due_date: Optional[datetime] = None
    priority: int = Field(ge=1, le=4, description="1=High, 2=Medium, 3=Low, 4=Very Low")
    remarks: Optional[str] = None
    minute_id: Optional[UUID] = None
    assigned_to_id: Optional[UUID] = None
    assigned_to_name: Optional[Dict[str, Any]] = None

    # ---- New fields ----
    title: Optional[str] = None
    issue_challenge: Optional[str] = None
    is_key_action: bool = False
    type_of_action: Optional[str] = None
    date_initiated: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)
    assign_to_meeting_id: Optional[UUID] = None


class ActionCreate(ActionBase):
    persons_implementing: List[ActionImplementerIn] = Field(default_factory=list)


class ActionUpdate(BaseModel):
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[int] = Field(None, ge=1, le=4)
    remarks: Optional[str] = None
    assigned_to_id: Optional[UUID] = None
    assigned_to_name: Optional[Dict[str, Any]] = None
    overall_progress_percentage: Optional[int] = Field(None, ge=0, le=100)
    overall_status_id: Optional[UUID] = None

    # ---- New fields ----
    title: Optional[str] = None
    issue_challenge: Optional[str] = None
    is_key_action: Optional[bool] = None
    type_of_action: Optional[str] = None
    date_initiated: Optional[datetime] = None
    tags: Optional[List[str]] = None
    assign_to_meeting_id: Optional[UUID] = None
    # None = leave implementers untouched; [] = clear the list; a list =
    # replace the list wholesale. This mirrors how the frontend always
    # sends the full current table on every save, so "partial update" of
    # individual implementers isn't a case we need to support here.
    persons_implementing: Optional[List[ActionImplementerIn]] = None


class ActionResponse(ActionBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    overall_progress_percentage: int = 0
    overall_status_name: Optional[str] = None
    overall_status_id: Optional[UUID] = None
    assigned_to: Optional[Dict[str, Any]] = None
    persons_implementing: List[ActionImplementerOut] = Field(default_factory=list)

    class Config:
        from_attributes = True