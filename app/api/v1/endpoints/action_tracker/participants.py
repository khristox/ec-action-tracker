from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.api import deps
from app.models.user import User
from app.crud.action_tracker import meeting, meeting_participant, participant
from app.schemas.action_tracker import (
    MeetingParticipantResponse, MeetingParticipantUpdate, ParticipantCreate, ParticipantUpdate, ParticipantResponse
)

router = APIRouter()

@router.post("/", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_participant(
    participant_in: ParticipantCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    if participant_in.email:
        existing = await participant.get_by_email(db, participant_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Participant with email {participant_in.email} already exists"
            )
    return await participant.create(db, participant_in, created_by_id=current_user.id)

@router.get("/", response_model=List[ParticipantResponse])
async def get_participants(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
):
    if search:
        return await participant.search(db, search, skip, limit)
    return await participant.get_multi(db, skip=skip, limit=limit)

@router.get("/my", response_model=List[ParticipantResponse])
async def get_my_participants(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    return await participant.get_my_participants(db, current_user.id)

@router.get("/{participant_id}", response_model=ParticipantResponse)
async def get_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await participant.get(db, participant_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    return result

@router.put("/{participant_id}", response_model=ParticipantResponse)
async def update_participant(
    participant_id: UUID,
    participant_in: ParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await participant.get(db, participant_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    return await participant.update(db, participant_id, participant_in)

@router.delete("/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await participant.get(db, participant_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    await participant.remove(db, participant_id)


@router.get("/meetings/{meeting_id}/participants", response_model=List[MeetingParticipantResponse])
async def get_meeting_participants(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all participants for a specific meeting"""
    # Check if meeting exists
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    return await meeting_participant.get_meeting_participants(db, meeting_id)


@router.patch("/meetings/{meeting_id}/participants/{participant_id}", response_model=MeetingParticipantResponse)
async def update_participant_attendance(
    meeting_id: UUID,
    participant_id: UUID,
    attendance_update: MeetingParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update participant attendance status"""
    # Check if meeting exists
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Update attendance
    participant = await meeting_participant.update_attendance(
        db, participant_id, attendance_update.attendance_status, current_user.id
    )
    
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    
    return participant