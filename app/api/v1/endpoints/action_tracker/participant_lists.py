from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.api import deps
from app.models.user import User
from app.crud.action_tracker import participant_list
from app.schemas.action_tracker_participants import (
    ParticipantListCreate, ParticipantListUpdate, ParticipantListResponse
)

router = APIRouter()

@router.post("/", response_model=ParticipantListResponse, status_code=status.HTTP_201_CREATED)
async def create_participant_list(
    list_in: ParticipantListCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    return await participant_list.create(db, list_in, created_by_id=current_user.id)

@router.get("/", response_model=List[ParticipantListResponse])
async def get_participant_lists(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    return await participant_list.get_accessible_lists(db, current_user.id, skip, limit)

@router.get("/{list_id}", response_model=ParticipantListResponse)
async def get_participant_list(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await participant_list.get(db, list_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant list not found")
    return result

@router.put("/{list_id}", response_model=ParticipantListResponse)
async def update_participant_list(
    list_id: UUID,
    list_in: ParticipantListUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await participant_list.get(db, list_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant list not found")
    return await participant_list.update(db, list_id, list_in)

@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_participant_list(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await participant_list.get(db, list_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant list not found")
    await participant_list.remove(db, list_id)