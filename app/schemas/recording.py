
# Response schemas
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class MeetingRecordingResponse(BaseModel):
    id: str
    meeting_id: str
    title: str
    description: Optional[str] = None
    file_name: str
    file_size: int
    duration: int
    quality: Optional[str] = None
    format: Optional[str] = None
    recording_type: str
    view_count: int
    download_count: int
    created_at: datetime
    message: Optional[str] = None

    class Config:
        from_attributes = True

class MeetingRecordingListResponse(BaseModel):
    items: List[MeetingRecordingResponse]
    total: int
    skip: int
    limit: int
    pages: int