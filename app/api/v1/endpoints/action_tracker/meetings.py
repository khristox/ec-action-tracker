# app/api/v1/endpoints/action_tracker/meetings.py

import csv
from io import StringIO
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, distinct, func, select, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from collections import defaultdict

from app.api import deps
from app.core.security import get_current_user
from app.crud.action_tracker import meeting_crud, meeting_action, meeting_minutes, meeting_participant
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.general.dynamic_attribute import Attribute
from app.models.user import User
from app.models.action_tracker import (
    Meeting, MeetingAction, MeetingDocument, MeetingParticipant, 
    MeetingQuery, MeetingStatus, MeetingStatusHistory, MeetingMinutes
)
from app.schemas.action_tracker import (
    MeetingCreateResponse, MeetingMinutesResponse, MeetingPaginationResponse, 
    MeetingCreate, MeetingParticipantResponse, MeetingParticipantUpdate, 
    MeetingStatusHistoryResponse, MeetingUpdate, MeetingResponse, 
    MeetingListResponse, NotificationRequest, ZoomMeetingCreate
)
from app.schemas.meeting_minutes.meeting_minutes import (
    MeetingActionCreate, MeetingActionResponse, MeetingMinutesCreate,
    MeetingMinutesResponse, MeetingMinutesUpdate
)

from .status_utils import get_status_id_by_short_name, get_status_by_short_name, get_valid_status_short_names
from .utils import build_meeting_response
from app.services.email_service import EmailService, email_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== HELPER FUNCTIONS ====================

async def get_meeting_or_404(db: AsyncSession, meeting_id: UUID) -> Meeting:
    """Get meeting by ID or raise 404"""
    meeting = await meeting_crud.get(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return meeting


def apply_meeting_filters(query, filters: Dict[str, Any]):
    """Apply common filters to meeting query"""
    if filters.get("upcoming"):
        query = query.where(Meeting.meeting_date >= datetime.now().date())
    
    if filters.get("search"):
        search_term = f"%{filters['search']}%"
        query = query.where(
            or_(
                Meeting.title.ilike(search_term),
                Meeting.location_text.ilike(search_term),
                Meeting.facilitator.ilike(search_term)
            )
        )
    
    if filters.get("status"):
        query = query.where(Meeting.status.has(Attribute.short_name == filters["status"]))
    
    return query.where(Meeting.is_active == True)


def build_meeting_list_response(meeting_obj: Meeting) -> MeetingListResponse:
    """Build list response for a meeting"""
    status_data = None
    if meeting_obj.status:
        status_data = {
            "id": str(meeting_obj.status.id),
            "code": meeting_obj.status.code,
            "name": meeting_obj.status.name,
            "short_name": meeting_obj.status.short_name,
            "description": meeting_obj.status.description,
            "extra_metadata": meeting_obj.status.extra_metadata,
        }
    
    return MeetingListResponse(
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
        status=status_data,
        created_by_id=meeting_obj.created_by_id,
        created_by_name=meeting_obj.created_by.username if meeting_obj.created_by else None,
        created_at=meeting_obj.created_at,
        updated_by_id=meeting_obj.updated_by_id,
        updated_by_name=meeting_obj.updated_by.username if meeting_obj.updated_by else None,
        updated_at=meeting_obj.updated_at,
        is_active=meeting_obj.is_active,
        location_name=None,
        participants_count=len(meeting_obj.participants) if meeting_obj.participants else 0,
        minutes_count=0,
        actions_count=0,
        documents_count=0
    )


async def update_meeting_common(
    db: AsyncSession,
    meeting_id: UUID,
    update_data: Dict[str, Any],
    current_user: User,
    source: str = "PUT"
) -> Meeting:
    """Common function for updating meeting (used by PUT and PATCH)"""
    db_obj = await get_meeting_or_404(db, meeting_id)
    

    print(update_data)

    old_status_id = db_obj.status_id
    status_comment = update_data.pop("status_comment", None)
    status_date_raw = update_data.pop("status_date", None)
    new_status_id = update_data.get("status_id")
    
    # Update regular fields
    for field, value in update_data.items():
        if hasattr(db_obj, field) and value is not None:
            setattr(db_obj, field, value)
    
    # Update audit fields
    db_obj.updated_by_id = current_user.id
    db_obj.updated_at = datetime.now()
    
    # Handle status change with history
    if new_status_id and str(new_status_id) != str(old_status_id):
        if isinstance(status_date_raw, str):
            try:
                status_date = datetime.fromisoformat(status_date_raw.replace('Z', '+00:00'))
            except ValueError:
                status_date = datetime.now()
        else:
            status_date = status_date_raw or datetime.now()
        
        history_entry = MeetingStatusHistory(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            status_id=new_status_id,
            comment=status_comment or f"Status updated via {source}",
            status_date=status_date,
            created_by_id=current_user.id,
            created_at=datetime.now(),
            is_active=True
        )
        db.add(history_entry)
    
    await db.commit()
    await db.refresh(db_obj)
    
    # Reload with all relationships
    return await meeting_crud.get_meeting_with_details(db, meeting_id)


def build_minutes_response(minute: MeetingMinutes) -> Dict[str, Any]:
    """Build response for meeting minutes"""
    return {
        "id": minute.id,
        "meeting_id": minute.meeting_id,
        "topic": minute.topic,
        "discussion": minute.discussion,
        "decisions": minute.decisions,
        "timestamp": minute.timestamp,
        "recorded_by_id": minute.recorded_by_id,
        "recorded_by_name": minute.recorded_by.username if minute.recorded_by else None,
        "created_by_id": minute.created_by_id,
        "created_by_name": minute.created_by.username if minute.created_by else None,
        "created_at": minute.created_at,
        "updated_by_id": minute.updated_by_id,
        "updated_by_name": minute.updated_by.username if minute.updated_by else None,
        "updated_at": minute.updated_at,
        "is_active": minute.is_active,
        "actions": minute.actions if hasattr(minute, 'actions') else []
    }


def build_status_history_response(history: MeetingStatusHistory) -> MeetingStatusHistoryResponse:
    """Build response for status history entry"""
    return MeetingStatusHistoryResponse(
        id=history.id,
        meeting_id=history.meeting_id,
        status_id=history.status_id,
        status_name=history.status.name if history.status else None,
        status_code=history.status.code if history.status else None,
        status_shortname=history.status.short_name if history.status else None,
        comment=history.comment,
        status_date=history.status_date,
        created_by_id=history.created_by_id,
        created_by_name=history.created_by.username if history.created_by else None,
        created_at=history.created_at,
        updated_by_id=history.updated_by_id,
        updated_by_name=history.updated_by.username if history.updated_by else None,
        updated_at=history.updated_at,
        is_active=history.is_active
    )


# ==================== MEETING CRUD OPERATIONS ====================

@router.post("/", response_model=MeetingCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new meeting with audit fields"""
    try:
        logger.debug(f"Creating meeting for user: {current_user.id}")
        logger.debug(f"Meeting data: {meeting_in.model_dump()}")
        
        result = await meeting_crud.create_with_participants(db, meeting_in, current_user.id)
        logger.debug(f"Meeting created successfully: {result.id}")
        
        return MeetingCreateResponse(
            id=result.id,
            title=result.title,
            description=result.description,
            meeting_date=result.meeting_date,
            start_time=result.start_time,
            end_time=result.end_time,
            location_text=result.location_text,
            agenda=result.agenda,
            facilitator=result.facilitator,
            chairperson_name=result.chairperson_name,
            status_id=result.status_id,
            created_by_id=result.created_by_id,
            created_by_name=current_user.username,
            created_at=result.created_at,
            updated_by_id=None,
            updated_by_name=None,
            updated_at=None,
            is_active=result.is_active,
            message="Meeting created successfully"
        )
    except Exception as e:
        logger.error(f"Error creating meeting: {type(e).__name__}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create meeting: {str(e)}"
        )


@router.get("/", response_model=MeetingPaginationResponse)
async def get_meetings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    upcoming: bool = Query(False),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """Get paginated list of meetings with audit info"""
    skip = (page - 1) * limit
    
    # Build query
    query = select(Meeting).options(
        selectinload(Meeting.status),
        selectinload(Meeting.participants),
        selectinload(Meeting.created_by),
        selectinload(Meeting.updated_by)
    ).order_by(desc(Meeting.meeting_date), desc(Meeting.start_time))
    
    # Apply filters
    query = apply_meeting_filters(query, {
        "upcoming": upcoming,
        "search": search,
        "status": status
    })
    
    # Execute paginated query
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    meetings_list = result.scalars().all()
    
    # Count total
    count_query = select(func.count(Meeting.id))
    count_query = apply_meeting_filters(count_query, {
        "upcoming": upcoming,
        "search": search,
        "status": status
    })
    count_res = await db.execute(count_query)
    total_count = count_res.scalar() or 0
    
    items = [build_meeting_list_response(meeting) for meeting in meetings_list]
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "size": limit,
        "pages": (total_count + limit - 1) // limit
    }


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get meeting by ID with minutes and actions loaded"""
    query = MeetingQuery.get_with_audit_info().where(
        Meeting.id == meeting_id, 
        Meeting.is_active == True
    )
    
    result = await db.execute(query)
    meeting_obj = result.scalar_one_or_none()
    
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    return meeting_obj


@router.put("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: UUID,
    meeting_in: MeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Full update meeting with audit fields"""
    logger.debug(f"Full incoming payload: {meeting_in.model_dump(exclude_unset=True)}")
    update_data = meeting_in.model_dump(exclude_unset=True)
    updated_meeting = await update_meeting_common(db, meeting_id, update_data, current_user, "PUT")
    return build_meeting_response(updated_meeting)


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def partial_update_meeting(
    meeting_id: UUID,
    meeting_in: MeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Partial update meeting - only update provided fields"""
    logger.debug(f"Partial update payload: {meeting_in.model_dump(exclude_unset=True)}")
    update_data = meeting_in.model_dump(exclude_unset=True)
    updated_meeting = await update_meeting_common(db, meeting_id, update_data, current_user, "PATCH")
    return build_meeting_response(updated_meeting)


@router.patch("/{meeting_id}/status", response_model=MeetingResponse)
async def update_meeting_status(
    meeting_id: UUID,
    status_value: str = Query(..., alias="status"),
    comment: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update meeting status with audit trail"""
    status_info = await get_status_by_short_name(db, status_value)
    if not status_info:
        valid = await get_valid_status_short_names(db)
        raise HTTPException(400, f"Invalid status. Use: {', '.join(valid)}")
    
    update_data = {"status_id": UUID(status_info["id"]), "status_comment": comment}
    updated_meeting = await update_meeting_common(db, meeting_id, update_data, current_user, "PATCH")
    return build_meeting_response(updated_meeting)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete meeting (set is_active=False) with audit"""
    meeting_obj = await get_meeting_or_404(db, meeting_id)
    
    meeting_obj.is_active = False
    meeting_obj.updated_by_id = current_user.id
    meeting_obj.updated_at = datetime.now()
    
    await db.commit()


# ==================== MEETING MINUTES ====================

@router.post("/{meeting_id}/minutes", response_model=MeetingMinutesResponse, status_code=status.HTTP_201_CREATED)
async def add_meeting_minutes(
    meeting_id: UUID,
    minutes_in: MeetingMinutesCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Add minutes to meeting with audit fields"""
    await get_meeting_or_404(db, meeting_id)
    
    minutes = await meeting_crud.add_minutes(db, meeting_id, minutes_in, current_user.id)
    
    # Reload with actions to ensure complete response
    query = select(MeetingMinutes).options(
        selectinload(MeetingMinutes.actions),
        selectinload(MeetingMinutes.created_by),
        selectinload(MeetingMinutes.updated_by)
    ).where(MeetingMinutes.id == minutes.id)
    
    result = await db.execute(query)
    return result.scalar_one()


@router.get("/{meeting_id}/minutes", response_model=List[MeetingMinutesResponse])
async def get_meeting_minutes(
    meeting_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all minutes for a meeting"""
    await get_meeting_or_404(db, meeting_id)
    
    minutes_list = await meeting_minutes.get_meeting_minutes(
        db=db, meeting_id=meeting_id, skip=skip, limit=limit
    )
    
    return [build_minutes_response(minute) for minute in minutes_list]


# ==================== MEETING STATUS HISTORY ====================

@router.get("/{meeting_id}/history", response_model=List[MeetingStatusHistoryResponse])
async def get_meeting_status_history(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get status change history for a meeting with audit info"""
    await get_meeting_or_404(db, meeting_id)
    
    query = (
        select(MeetingStatusHistory)
        .where(MeetingStatusHistory.meeting_id == meeting_id, MeetingStatusHistory.is_active == True)
        .options(
            selectinload(MeetingStatusHistory.status),
            selectinload(MeetingStatusHistory.created_by),
            selectinload(MeetingStatusHistory.updated_by)
        )
        .order_by(desc(MeetingStatusHistory.status_date))
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    history_list = result.scalars().all()
    
    return [build_status_history_response(history) for history in history_list]


@router.get("/{meeting_id}/history/latest", response_model=Optional[MeetingStatusHistoryResponse])
async def get_latest_meeting_status_history(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get the latest status change for a meeting"""
    await get_meeting_or_404(db, meeting_id)
    
    query = (
        select(MeetingStatusHistory)
        .where(MeetingStatusHistory.meeting_id == meeting_id, MeetingStatusHistory.is_active == True)
        .options(
            selectinload(MeetingStatusHistory.status),
            selectinload(MeetingStatusHistory.created_by),
            selectinload(MeetingStatusHistory.updated_by)
        )
        .order_by(desc(MeetingStatusHistory.status_date))
        .limit(1)
    )
    
    result = await db.execute(query)
    history = result.scalar_one_or_none()
    
    return build_status_history_response(history) if history else None


# ==================== MEETING PARTICIPANTS ====================

@router.get("/{meeting_id}/participants", response_model=List[MeetingParticipantResponse])
async def get_meeting_participants(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all participants for a meeting"""
    await get_meeting_or_404(db, meeting_id)
    return await meeting_participant.get_by_meeting(db, meeting_id)


@router.patch("/{meeting_id}/participants/{participant_id}", response_model=MeetingParticipantResponse)
async def update_participant_attendance(
    meeting_id: UUID,
    participant_id: UUID,
    attendance_update: MeetingParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update participant attendance status"""
    await get_meeting_or_404(db, meeting_id)
    
    participant = await meeting_participant.update_attendance(
        db, participant_id, attendance_update.attendance_status, current_user.id
    )
    
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    
    return participant


# ==================== MEETING NOTIFICATIONS ====================

@router.post("/{meeting_id}/notify-participants")
async def notify_meeting_participants(
    meeting_id: str,
    notification_data: NotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Send notifications to meeting participants"""
    logger.debug("=" * 80)
    logger.debug("NOTIFY PARTICIPANTS ENDPOINT CALLED")
    logger.debug(f"Meeting ID: {meeting_id}")
    logger.debug(f"Participant IDs: {notification_data.participant_ids}")
    logger.debug("=" * 80)

    meeting = await get_meeting_or_404(db, UUID(meeting_id))
    
    # Get participants from meeting_participants table
    participants = await db.execute(
        select(MeetingParticipant)
        .where(
            MeetingParticipant.id.in_(notification_data.participant_ids),
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.is_active == True
        )
    )
    participants = participants.scalars().all()
    
    if not participants:
        raise HTTPException(status_code=404, detail="No participants found")
    
    sent_count = 0
    results = []
    
    for participant in participants:
        for notif_type in notification_data.notification_type:
            try:
                success = await _send_notification_by_type(
                    notif_type, participant, meeting, notification_data.custom_message
                )
                if success:
                    sent_count += 1
                results.append(_build_notification_result(participant, notif_type, success))
            except Exception as e:
                results.append(_build_notification_result(participant, notif_type, False, str(e)))
                logger.error(f"Failed to send {notif_type} to {participant.name}: {e}")
    
    return {
        "success": True,
        "sent": sent_count,
        "total": len(participants) * len(notification_data.notification_type),
        "results": results,
        "meeting_title": meeting.title
    }


async def _send_notification_by_type(notif_type: str, participant, meeting, custom_message: str) -> bool:
    """Helper to send notification based on type"""
    if notif_type == 'email' and participant.email:
        return await send_email_notification(
            to_email=participant.email,
            meeting=meeting,
            custom_message=custom_message,
            participant_name=participant.name
        )
    elif notif_type in ['whatsapp', 'sms'] and participant.telephone:
        logger.info(f"Sending {notif_type.upper()} to {participant.telephone} for meeting {meeting.title}")
        # Implement actual API calls here
        return True
    return False


def _build_notification_result(participant, notif_type: str, success: bool, error: str = None) -> dict:
    """Build notification result dictionary"""
    result = {
        "participant": participant.name,
        "type": notif_type,
        "status": "sent" if success else "failed",
        "contact": participant.email if notif_type == 'email' else participant.telephone
    }
    if error:
        result["reason"] = error
    elif not success:
        result["reason"] = f"No {notif_type} contact available"
    return result


# ==================== AUDIT LOGS ====================

async def _get_audit_conditions(meeting_id: str, db: AsyncSession) -> List:
    """Build conditions for audit log queries"""
    conditions = [AuditLog.record_id == meeting_id, AuditLog.table_name == "meetings"]
    
    related_queries = {
        "meeting_minutes": select(MeetingMinutes.id).where(MeetingMinutes.meeting_id == meeting_id),
        "meeting_actions": select(MeetingAction.id)
            .join(MeetingMinutes, MeetingAction.minute_id == MeetingMinutes.id)
            .where(MeetingMinutes.meeting_id == meeting_id),
        "meeting_documents": select(MeetingDocument.id).where(MeetingDocument.meeting_id == meeting_id),
        "meeting_participants": select(MeetingParticipant.id).where(MeetingParticipant.meeting_id == meeting_id)
    }
    
    for table_name, query in related_queries.items():
        result = await db.execute(query)
        record_ids = [str(r) for r in result.scalars().all()]
        if record_ids:
            conditions.append(
                and_(AuditLog.record_id.in_(record_ids), AuditLog.table_name == table_name)
            )
    
    return conditions


@router.get("/{meeting_id}/audit-logs")
async def get_meeting_audit_logs(
    meeting_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    action: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Get audit logs for a specific meeting"""
    await get_meeting_or_404(db, UUID(meeting_id))
    
    conditions = await _get_audit_conditions(meeting_id, db)
    query = select(AuditLog).where(or_(*conditions))
    
    # Apply filters
    if action and action != "all":
        query = query.where(AuditLog.action == action)
    if user_id and user_id != "all":
        query = query.where(AuditLog.user_id == user_id)
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)
    
    # Get total count
    count_query = select(func.count()).select_from(AuditLog).where(or_(*conditions))
    total = (await db.execute(count_query)).scalar() or 0
    
    # Get paginated results
    query = query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    # Build response
    enhanced_logs = []
    for log in logs:
        log_dict = {
            "id": str(log.id),
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "action": log.action,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "user_id": str(log.user_id) if log.user_id else None,
            "username": log.username,
            "user_email": log.user_email,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "changes_summary": log.changes_summary,
            "ip_address": log.ip_address,
            "endpoint": log.endpoint,
            "status": log.status,
            "error_message": log.error_message,
            "extra_data": log.extra_data,
        }
        enhanced_logs.append(log_dict)
    
    return {"items": enhanced_logs, "total": total, "skip": skip, "limit": limit}


@router.get("/{meeting_id}/audit-logs/filters")
async def get_audit_log_filters(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Get available filter options for audit logs"""
    conditions = await _get_audit_conditions(meeting_id, db)
    query = select(AuditLog).where(or_(*conditions))
    result = await db.execute(query)
    logs = result.scalars().all()
    
    actions = set()
    users = {}
    table_types = set()
    timestamps = []
    
    for log in logs:
        if log.action:
            actions.add(log.action)
        if log.user_id and str(log.user_id) not in users:
            users[str(log.user_id)] = {
                "id": str(log.user_id),
                "name": log.username or "",
                "email": log.user_email or ""
            }
        if log.table_name:
            table_types.add(log.table_name)
        if log.timestamp:
            timestamps.append(log.timestamp)
    
    return {
        "actions": sorted(list(actions)),
        "users": list(users.values()),
        "table_types": sorted(list(table_types)),
        "date_range": {
            "min": min(timestamps).isoformat() if timestamps else None,
            "max": max(timestamps).isoformat() if timestamps else None
        }
    }


@router.get("/{meeting_id}/audit-logs/export")
async def export_audit_logs(
    meeting_id: str,
    format: str = Query("csv", regex="^(csv|json)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Export audit logs to CSV or JSON format"""
    conditions = await _get_audit_conditions(meeting_id, db)
    query = select(AuditLog).where(or_(*conditions)).order_by(AuditLog.timestamp.desc())
    result = await db.execute(query)
    logs = result.scalars().all()
    
    if format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Timestamp', 'Action', 'Table Name', 'Record ID', 'User Name', 'User Email', 'Changes Summary', 'IP Address', 'Endpoint', 'Status'])
        
        for log in logs:
            writer.writerow([
                log.timestamp.isoformat() if log.timestamp else '',
                log.action or '',
                log.table_name or '',
                log.record_id or '',
                log.username or '',
                log.user_email or '',
                log.changes_summary or '',
                log.ip_address or '',
                log.endpoint or '',
                log.status or ''
            ])
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=meeting_{meeting_id}_audit.csv"}
        )
    else:
        return {
            "meeting_id": meeting_id,
            "export_date": datetime.now().isoformat(),
            "total_records": len(logs),
            "data": [
                {
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "action": log.action,
                    "table_name": log.table_name,
                    "record_id": log.record_id,
                    "user_name": log.username,
                    "user_email": log.user_email,
                    "changes_summary": log.changes_summary,
                    "ip_address": log.ip_address,
                    "endpoint": log.endpoint,
                    "status": log.status
                }
                for log in logs
            ]
        }


# ==================== EMAIL NOTIFICATION HELPER ====================

async def send_email_notification(to_email: str, meeting, custom_message: str = "", participant_name: str = "") -> bool:
    """Send email notification using existing email service"""
    try:
        meeting_time = f"{meeting.start_time} - {meeting.end_time}" if meeting.start_time else "Time TBD"
        meeting_date = meeting.meeting_date.strftime("%A, %B %d, %Y") if meeting.meeting_date else "Date TBD"
        
        is_online = hasattr(meeting, 'platform') and meeting.platform and meeting.platform != 'physical'
        location_text = meeting.location_text or "Location TBD"
        meeting_link = getattr(meeting, 'meeting_link', '')
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Meeting Notification</title></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                <h2>📋 Meeting Invitation</h2>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <p>Dear <strong>{participant_name or 'Participant'}</strong>,</p>
                <p>You have been invited to:</p>
                <h3>{meeting.title}</h3>
                <p><strong>Date:</strong> {meeting_date}</p>
                <p><strong>Time:</strong> {meeting_time}</p>
                <p><strong>{'Online Meeting' if is_online else 'Location'}:</strong> {location_text}</p>
                {f'<p><strong>Join Link:</strong> <a href="{meeting_link}">{meeting_link}</a></p>' if meeting_link else ''}
                {f'<p><strong>Additional Information:</strong></p><p>{custom_message}</p>' if custom_message else ''}
                <hr>
                <p style="font-size: 12px; color: #999;">This is an automated notification from the Meeting Management System.</p>
            </div>
        </body>
        </html>
        """
        
        if email_service._is_configured():
            return email_service.send_email(
                to_email=to_email,
                subject=f"📅 Meeting Invitation: {meeting.title}",
                html_content=html_content
            )
        else:
            logger.warning(f"Email service not configured, would send to {to_email}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {e}")
        return False


async def get_default_meeting_status(db: AsyncSession) -> Optional[MeetingStatus]:
    """Get the default meeting status (usually 'scheduled')"""
    result = await db.execute(
        select(MeetingStatus).where(
            MeetingStatus.code == 'scheduled',
            MeetingStatus.is_active == True
        )
    )
    status = result.scalar_one_or_none()
    
    if not status:
        result = await db.execute(
            select(MeetingStatus).where(MeetingStatus.is_active == True).limit(1)
        )
        status = result.scalar_one_or_none()
    
    return status


# ==================== ZOOM INTEGRATION (PLACEHOLDER) ====================

@router.post("/create-zoom-meeting")
async def create_zoom_meeting(
    meeting_data: ZoomMeetingCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a Zoom meeting using Zoom API"""
    # Implement Zoom API integration
    return {
        "join_url": "https://zoom.us/j/123456789",
        "id": "123456789",
        "password": "123456"
    }