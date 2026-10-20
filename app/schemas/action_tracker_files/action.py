# app/schemas/action_tracker_files/action.py
from pydantic import AliasChoices, BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List


class ActionImplementerIn(BaseModel):
    """One row of the Person(s) Implementing table, as submitted by the client."""

    # Set when the person was picked from the SYSTEM USERS. Kept as a plain
    # string on purpose: a malformed value must not reject the whole action with
    # a 422. The server checks it against the users table
    # (see app/services/implementer_linking.py).
    user_id: Optional[str] = None

    # Older clients send the picked id here. It may be a users.id OR a
    # meeting_participants.id, so it is never trusted blindly: the server only
    # uses it if it really is a users.id, otherwise it matches by email.
    id: Optional[str] = None

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

    # The MeetingAction model has no attribute called `persons_implementing`;
    # its list is `implementers`. Without this alias, from_attributes found
    # nothing and silently returned [] even when implementers existed.
    persons_implementing: List[ActionImplementerOut] = Field(
        default_factory=list,
        validation_alias=AliasChoices("persons_implementing", "implementers"),
    )

    class Config:
        from_attributes = True
