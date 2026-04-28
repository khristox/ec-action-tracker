# app/schemas/meeting_report.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

class MeetingReportParticipant(BaseModel):
    id: UUID
    name: str
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    is_chairperson: bool = False
    is_secretary: bool = False
    attendance_status: Optional[str] = None

class MeetingReportMinute(BaseModel):
    id: UUID
    topic: str
    discussion: Optional[str] = None
    decisions: Optional[str] = None
    timestamp: datetime
    actions: List[Dict[str, Any]] = []

class MeetingReportAction(BaseModel):
    id: UUID
    action_item: str
    responsible_person: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    completion_notes: Optional[str] = None

class MeetingReportResponse(BaseModel):
    # Meeting Basic Info
    id: UUID
    title: str
    description: Optional[str] = None
    meeting_date: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    # Location Info
    location_id: Optional[UUID] = None
    location_text: Optional[str] = None
    location_hierarchy: Optional[List[Dict[str, Any]]] = []
    venue: Optional[str] = None
    address: Optional[str] = None
    gps_coordinates: Optional[str] = None
    
    # Online Meeting Info
    platform: Optional[str] = None
    meeting_link: Optional[str] = None
    meeting_id_online: Optional[str] = None
    passcode: Optional[str] = None
    
    # Roles
    chairperson_name: Optional[str] = None
    facilitator: Optional[str] = None  # Secretary
    
    # Status
    status: Dict[str, Any]
    status_history: List[Dict[str, Any]] = []
    
    # Content
    agenda: Optional[str] = None
    
    # Statistics
    statistics: Dict[str, Any] = {}
    
    # Related Data
    participants: List[MeetingReportParticipant] = []
    minutes: List[MeetingReportMinute] = []
    actions: List[MeetingReportAction] = []
    
    # Audit Info
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    
    # Report Metadata
    generated_at: datetime
    generated_by: str
    
    class Config:
        from_attributes = True