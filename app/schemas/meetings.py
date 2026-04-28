# schemas.py
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional

class UserBriefSchema(BaseModel):
    id: int
    full_name: Optional[str] = None
    name: Optional[str] = None
    email: str
    
    model_config = ConfigDict(from_attributes=True)

class ActionItemSchema(BaseModel):
    id: int
    description: str
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str
    priority: str
    remarks: Optional[str] = None
    completed_at: Optional[datetime] = None
    overall_progress_percentage: int = 0
    assigned_to: Optional[UserBriefSchema] = None
    
    model_config = ConfigDict(from_attributes=True)

class MeetingMinuteSchema(BaseModel):
    id: int
    topic: str
    discussion: Optional[str] = None
    decisions: Optional[str] = None
    created_at: datetime
    actions: List[ActionItemSchema] = []
    
    model_config = ConfigDict(from_attributes=True)

class MeetingParticipantSchema(BaseModel):
    id: int
    meeting_id: int
    user_id: int
    invited_at: datetime
    response_status: str
    user: UserBriefSchema

class MeetingDetailSchema(BaseModel):
    id: int
    title: str
    topic: Optional[str] = None
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    status: str
    is_virtual: bool
    created_by: int
    created_at: datetime
    updated_at: datetime
    participants: List[UserBriefSchema] = []
    minutes: List[MeetingMinuteSchema] = []
    
    model_config = ConfigDict(from_attributes=True)

class ParticipantMeetingSummarySchema(BaseModel):
    meeting: MeetingDetailSchema
    user_action_items: List[ActionItemSchema]
    minutes_count: int
    action_items_count: int
    pending_actions_count: int
    completed_actions_count: int
    
    model_config = ConfigDict(from_attributes=True)