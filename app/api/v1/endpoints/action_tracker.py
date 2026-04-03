# app/api/v1/endpoints/action_tracker.py
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select  # ADD THIS IMPORT
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app import db
from app.api import deps
from app.models.user import User
from app.models.action_tracker import Meeting  # ADD THIS IMPORT
from app.crud.action_tracker import (
    participant, participant_list, meeting, meeting_minutes, 
    meeting_action, meeting_document, dashboard
)
from app.schemas.action_tracker import (
    MeetingCreateResponse, ParticipantCreate, ParticipantUpdate, ParticipantResponse,
    ParticipantListCreate, ParticipantListUpdate, ParticipantListResponse,
    MeetingCreate, MeetingUpdate, MeetingResponse,
    MeetingListResponse,
    MeetingMinutesCreate, MeetingMinutesUpdate, MeetingMinutesResponse,
    MeetingActionCreate, MeetingActionUpdate, MeetingActionResponse,
    ActionProgressUpdate, ActionCommentCreate, ActionCommentResponse,
    MeetingDocumentCreate, MeetingDocumentUpdate, MeetingDocumentResponse,
    ActionStatusHistoryResponse, MeetingSummary, ActionSummary, MyTaskResponse
)

router = APIRouter()

# ==================== TEST ENDPOINTS ====================

@router.get("/ping")
async def ping():
    """Simple ping endpoint to test if router is working"""
    return {"message": "pong", "status": "ok", "timestamp": datetime.now().isoformat()}


@router.get("/health")
async def action_tracker_health():
    """Health check for action tracker module"""
    return {"status": "healthy", "module": "action-tracker"}


# ==================== Participant Endpoints ====================

@router.post("/participants", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_participant(
    participant_in: ParticipantCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new participant"""
    if participant_in.email:
        existing = await participant.get_by_email(db, participant_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Participant with email {participant_in.email} already exists"
            )
    return await participant.create(db, participant_in, created_by_id=current_user.id)


@router.get("/participants", response_model=List[ParticipantResponse])
async def get_participants(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None, description="Search by name, email, or organization"),
):
    """Get all participants"""
    if search:
        return await participant.search(db, search, skip, limit)
    return await participant.get_multi(db, skip=skip, limit=limit)


@router.get("/participants/my", response_model=List[ParticipantResponse])
async def get_my_participants(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get participants created by current user"""
    return await participant.get_my_participants(db, current_user.id)


@router.get("/participants/{participant_id}", response_model=ParticipantResponse)
async def get_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get participant by ID"""
    result = await participant.get(db, participant_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    return result


@router.put("/participants/{participant_id}", response_model=ParticipantResponse)
async def update_participant(
    participant_id: UUID,
    participant_in: ParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update participant"""
    result = await participant.get(db, participant_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    return await participant.update(db, participant_id, participant_in)


@router.delete("/participants/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete participant"""
    result = await participant.get(db, participant_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    await participant.remove(db, participant_id)


# ==================== Participant List Endpoints ====================

@router.post("/participant-lists", response_model=ParticipantListResponse, status_code=status.HTTP_201_CREATED)
async def create_participant_list(
    list_in: ParticipantListCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new participant list"""
    return await participant_list.create(db, list_in, created_by_id=current_user.id)


@router.get("/participant-lists", response_model=List[ParticipantListResponse])
async def get_participant_lists(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get participant lists accessible to current user"""
    return await participant_list.get_accessible_lists(db, current_user.id, skip, limit)


@router.get("/participant-lists/{list_id}", response_model=ParticipantListResponse)
async def get_participant_list(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get participant list by ID"""
    result = await participant_list.get(db, list_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant list not found")
    return result


@router.put("/participant-lists/{list_id}", response_model=ParticipantListResponse)
async def update_participant_list(
    list_id: UUID,
    list_in: ParticipantListUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update participant list"""
    result = await participant_list.get(db, list_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant list not found")
    return await participant_list.update(db, list_id, list_in)


@router.delete("/participant-lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_participant_list(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete participant list"""
    result = await participant_list.get(db, list_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant list not found")
    await participant_list.remove(db, list_id)


# ==================== Meeting Endpoints ====================

# In actiontracker.py - update the create_meeting endpoint

@router.post("/meetings", response_model=MeetingCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new meeting with participants"""
    result = await meeting.create_with_participants(db, meeting_in, current_user.id)
    
    # Return simplified response without relationships
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
        created_at=result.created_at,
        is_active=result.is_active,
        message="Meeting created successfully"
    )

@router.get("/meetings", response_model=List[MeetingListResponse])
async def get_meetings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    upcoming: bool = Query(False, description="Get only upcoming meetings"),
    status: Optional[str] = Query(None, description="Filter by status"),
):
    """Get all meetings with optional filters"""
    # Build query WITHOUT selectinload to avoid relationship loading
    query = select(Meeting).where(Meeting.is_active == True)
    
    if upcoming:
        query = query.where(Meeting.meeting_date >= datetime.now())
    
    if status:
        # Add status filter if needed
        pass
    
    query = query.order_by(Meeting.meeting_date.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    meetings = result.scalars().all()
    
    # Build response WITHOUT accessing relationships
    response = []
    for m in meetings:
        response.append(MeetingListResponse(
            id=m.id,
            title=m.title,
            description=m.description,
            location_id=m.location_id,
            location_text=m.location_text,
            gps_coordinates=m.gps_coordinates,
            meeting_date=m.meeting_date,
            start_time=m.start_time,
            end_time=m.end_time,
            agenda=m.agenda,
            facilitator=m.facilitator,
            chairperson_name=m.chairperson_name,
            status_id=m.status_id,
            created_by_id=m.created_by_id,
            created_at=m.created_at,
            updated_at=m.updated_at,
            is_active=m.is_active,
            status_name=None,
            location_name=None,
            participants_count=0,
            minutes_count=0,
            actions_count=0,
            documents_count=0
        ))
    return response


@router.get("/meetings/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get meeting by ID with all details"""
    result = await meeting.get_meeting_with_details(db, meeting_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return result


@router.put("/meetings/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: UUID,
    meeting_in: MeetingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update meeting"""
    result = await meeting.get(db, meeting_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return await meeting.update(db, meeting_id, meeting_in)


@router.delete("/meetings/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete meeting"""
    result = await meeting.get(db, meeting_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    await meeting.remove(db, meeting_id)


# ==================== Meeting Minutes Endpoints ====================

@router.post("/meetings/{meeting_id}/minutes", response_model=MeetingMinutesResponse, status_code=status.HTTP_201_CREATED)
async def add_meeting_minutes(
    meeting_id: UUID,
    minutes_in: MeetingMinutesCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Add minutes to a meeting"""
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return await meeting.add_minutes(db, meeting_id, minutes_in, current_user.id)


@router.get("/meetings/{meeting_id}/minutes", response_model=List[MeetingMinutesResponse])
async def get_meeting_minutes(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get all minutes for a meeting"""
    return await meeting_minutes.get_meeting_minutes(db, meeting_id, skip, limit)


@router.get("/minutes/{minute_id}", response_model=MeetingMinutesResponse)
async def get_minutes(
    minute_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get minutes by ID"""
    result = await meeting_minutes.get(db, minute_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Minutes not found")
    return result


@router.put("/minutes/{minute_id}", response_model=MeetingMinutesResponse)
async def update_minutes(
    minute_id: UUID,
    minutes_in: MeetingMinutesUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update meeting minutes"""
    result = await meeting_minutes.get(db, minute_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Minutes not found")
    return await meeting_minutes.update(db, minute_id, minutes_in)


@router.delete("/minutes/{minute_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_minutes(
    minute_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete meeting minutes"""
    result = await meeting_minutes.get(db, minute_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Minutes not found")
    await meeting_minutes.remove(db, minute_id)


# ==================== Meeting Action Endpoints ====================

@router.post("/minutes/{minute_id}/actions", response_model=MeetingActionResponse, status_code=status.HTTP_201_CREATED)
async def create_action(
    minute_id: UUID,
    action_in: MeetingActionCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create an action item from meeting minutes"""
    minutes_obj = await meeting_minutes.get(db, minute_id)
    if not minutes_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Minutes not found")
    return await meeting_action.create_action(db, minute_id, action_in, current_user.id)


@router.get("/actions", response_model=List[MeetingActionResponse])
async def get_actions(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = Query(None, description="Filter by status"),
):
    """Get all actions"""
    return await meeting_action.get_multi(db, skip=skip, limit=limit)


@router.get("/actions/{action_id}", response_model=MeetingActionResponse)
async def get_action(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get action by ID"""
    result = await meeting_action.get(db, action_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return result


@router.put("/actions/{action_id}", response_model=MeetingActionResponse)
async def update_action(
    action_id: UUID,
    action_in: MeetingActionUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update action"""
    result = await meeting_action.get(db, action_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.update(db, action_id, action_in)


@router.post("/actions/{action_id}/progress", response_model=MeetingActionResponse)
async def update_action_progress(
    action_id: UUID,
    progress_update: ActionProgressUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update action progress (for assigned users)"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    
    # Check if user is assigned to this action
    if action_obj.assigned_to_id and action_obj.assigned_to_id != current_user.id:
        # Check if user is admin
        is_admin = any(role.code in ["admin", "super_admin"] for role in current_user.roles)
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the assigned user or admin can update progress"
            )
    
    return await meeting_action.update_progress(db, action_id, progress_update, current_user.id)


@router.post("/actions/{action_id}/comments", response_model=ActionCommentResponse, status_code=status.HTTP_201_CREATED)
async def add_action_comment(
    action_id: UUID,
    comment_in: ActionCommentCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Add a comment to an action"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.add_comment(db, action_id, comment_in, current_user.id)


@router.get("/actions/{action_id}/comments", response_model=List[ActionCommentResponse])
async def get_action_comments(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get all comments for an action"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.get_comments(db, action_id, skip, limit)


@router.get("/actions/{action_id}/history", response_model=List[ActionStatusHistoryResponse])
async def get_action_history(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get status history for an action"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return await meeting_action.get_status_history(db, action_id)


@router.get("/actions/my-tasks", response_model=List[MyTaskResponse])
async def get_my_tasks(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get actions assigned to current user"""
    actions = await meeting_action.get_actions_assigned_to_user(db, current_user.id)
    
    result = []
    for action in actions:
        result.append(MyTaskResponse(
            id=action.id,
            description=action.description,
            meeting_title=action.minutes.meeting.title if action.minutes and action.minutes.meeting else "",
            meeting_date=action.minutes.meeting.meeting_date if action.minutes and action.minutes.meeting else datetime.now(),
            due_date=action.due_date,
            overall_progress_percentage=action.overall_progress_percentage,
            overall_status_name=None,
            priority=action.priority,
            is_overdue=action.due_date and action.due_date < datetime.now() and not action.completed_at
        ))
    return result


@router.delete("/actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action(
    action_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete an action"""
    action_obj = await meeting_action.get(db, action_id)
    if not action_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    await meeting_action.remove(db, action_id)


# ==================== Meeting Document Endpoints ====================

@router.post("/meetings/{meeting_id}/documents", response_model=MeetingDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    meeting_id: UUID,
    document_in: MeetingDocumentCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Upload a document to a meeting"""
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # For now, use a placeholder file path
    file_path = f"uploads/meetings/{meeting_id}/{document_in.file_name}"
    
    return await meeting_document.upload_document(
        db, meeting_id, document_in, file_path, 0, "application/octet-stream", current_user.id
    )


@router.get("/meetings/{meeting_id}/documents", response_model=List[MeetingDocumentResponse])
async def get_meeting_documents(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all documents for a meeting"""
    return await meeting_document.get_meeting_documents(db, meeting_id)


@router.get("/documents/{document_id}", response_model=MeetingDocumentResponse)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get document by ID"""
    result = await meeting_document.get(db, document_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return result


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete a document"""
    result = await meeting_document.get(db, document_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await meeting_document.remove(db, document_id)


# ==================== Dashboard Endpoints ====================

@router.get("/dashboard/summary", response_model=MeetingSummary)
async def get_dashboard_summary(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get dashboard summary statistics"""
    return await dashboard.get_summary(db)


@router.get("/dashboard/actions-summary", response_model=ActionSummary)
async def get_actions_summary(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get actions summary for dashboard"""
    return await dashboard.get_actions_summary(db)


# ==================== Statistics Endpoints ====================

@router.get("/statistics/meetings-by-month")
async def get_meetings_by_month(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    year: int = Query(datetime.now().year, description="Year to filter"),
):
    """Get meetings grouped by month"""
    return await dashboard.get_meetings_by_month(db, year)


@router.get("/statistics/actions-by-status")
async def get_actions_by_status(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get actions grouped by status"""
    return await dashboard.get_actions_by_status(db)


# ==================== RAW SQL Fallback Endpoint (if needed) ====================

@router.get("/meetings-raw")
async def get_meetings_raw(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get meetings using raw SQL - fallback if ORM has issues"""
    from sqlalchemy import text
    
    result = await db.execute(
        text("""
            SELECT 
                id, title, description, meeting_date, start_time, 
                end_time, location_text, agenda, facilitator, 
                chairperson_name, created_by_id, created_at, is_active
            FROM meetings 
            WHERE is_active = 1 
            ORDER BY meeting_date DESC 
            LIMIT 100
        """)
    )
    
    meetings = []
    for row in result:
        meetings.append({
            "id": str(row[0]),
            "title": row[1],
            "description": row[2],
            "meeting_date": row[3].isoformat() if row[3] else None,
            "start_time": row[4].isoformat() if row[4] else None,
            "end_time": row[5].isoformat() if row[5] else None,
            "location_text": row[6],
            "agenda": row[7],
            "facilitator": row[8],
            "chairperson_name": row[9],
            "created_by_id": str(row[10]),
            "created_at": row[11].isoformat() if row[11] else None,
            "is_active": bool(row[12]),
        })
    
    return meetings