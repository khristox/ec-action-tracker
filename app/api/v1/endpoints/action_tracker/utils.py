from typing import Tuple

from app.models.action_tracker import Meeting
from app.schemas.action_tracker import MeetingResponse

def validate_pagination(skip: int, limit: int) -> Tuple[int, int]:
    return max(0, skip), min(500, max(1, limit))

def build_meeting_response(meeting_obj: Meeting) -> MeetingResponse:
    status_data = None
    if meeting_obj.status:
        s = meeting_obj.status
        status_data = {
            "id": str(s.id),
            "code": s.code,
            "name": s.name,
            "short_name": s.short_name,
            "description": s.description,
            "extra_metadata": s.extra_metadata,
        }
    participants_data = [
        {
            "id": p.id, "meeting_id": p.meeting_id, "name": p.name,
            "email": p.email, "telephone": p.telephone, "title": p.title,
            "organization": p.organization, "is_chairperson": p.is_chairperson,
            "created_at": p.created_at,
        }
        for p in (meeting_obj.participants or [])
    ]
    minutes_data = [
        {
            "id": m.id, "meeting_id": m.meeting_id, "topic": m.topic,
            "discussion": m.discussion, "decisions": m.decisions,
            "timestamp": m.timestamp, "recorded_by_id": m.recorded_by_id,
            "created_at": m.created_at, "updated_at": m.updated_at,
            "actions": [
                {
                    "id": a.id, "minute_id": a.minute_id,
                    "description": a.description,
                    "assigned_to_id": a.assigned_to_id,
                    "assigned_to_name": a.assigned_to_name,
                    "assigned_by_id": a.assigned_by_id,
                    "assigned_at": a.assigned_at,
                    "due_date": a.due_date, "start_date": a.start_date,
                    "completed_at": a.completed_at, "priority": a.priority,
                    "estimated_hours": a.estimated_hours,
                    "actual_hours": a.actual_hours, "remarks": a.remarks,
                    "overall_status_id": a.overall_status_id,
                    "overall_progress_percentage": a.overall_progress_percentage,
                    "created_at": a.created_at, "updated_at": a.updated_at,
                }
                for a in (m.actions or [])
            ],
        }
        for m in (meeting_obj.minutes or [])
    ]
    return MeetingResponse(
        id=meeting_obj.id,
        title=meeting_obj.title,
        description=meeting_obj.description,
        location_id=meeting_obj.location_id,
        location_text=meeting_obj.location_text,
        gps_coordinates=meeting_obj.gps_coordinates,
        meeting_date=meeting_obj.meeting_date,
        start_time=meeting_obj.start_time,
        end_time=meeting_obj.end_time,
        agenda=meeting_obj.agenda,
        facilitator=meeting_obj.facilitator,
        chairperson_name=meeting_obj.chairperson_name,
        status_id=meeting_obj.status_id,
        created_by_id=meeting_obj.created_by_id,
        created_at=meeting_obj.created_at,
        updated_at=meeting_obj.updated_at,
        is_active=meeting_obj.is_active,
        status=status_data,
        participants=participants_data,
        minutes=minutes_data,
        documents=[],
    )