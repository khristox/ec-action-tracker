# backend/app/api/v1/endpoints/action_tracker/participants.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
import csv
import io
from fastapi.responses import StreamingResponse

from app.api import deps
from app.models.user import User
from app.crud.action_tracker import participant, meeting_participant
from app.schemas.action_tracker_participants import (
    PaginatedParticipantResponse,
    ParticipantBulkCreate,
    ParticipantCreate,
    ParticipantResponse,
    ParticipantUpdate,
)

router = APIRouter()

# ==================== CREATE ====================

@router.post("/", response_model=ParticipantResponse)
async def create_participant(
    participant_in: ParticipantCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new participant using Option 1 (Dict injection)"""
    if participant_in.email:
        existing = await participant.get_by_email(db, participant_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Participant with email '{participant_in.email}' already exists",
            )
    
    # OPTION 1: Convert to dict and inject the user ID
    # Use .model_dump() for Pydantic v2 or .dict() for Pydantic v1
    obj_data = participant_in.model_dump() 
    obj_data["created_by_id"] = current_user.id
    
    return await participant.create(db, obj_in=obj_data)


@router.post("/bulk", response_model=List[ParticipantResponse])
async def bulk_create_participants(
    participants_in: ParticipantBulkCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Bulk create participants using Option 1"""
    created = []
    for p_data in participants_in.participants:
        try:
            # OPTION 1: Apply same logic to bulk items
            obj_data = p_data.model_dump()
            obj_data["created_by_id"] = current_user.id
            
            new_p = await participant.create(db, obj_in=obj_data)
            created.append(new_p)
        except Exception:
            continue
    return created


# ==================== READ (static paths BEFORE /{id}) ====================

@router.get("/", response_model=PaginatedParticipantResponse)
async def get_participants(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
):
    skip = (page - 1) * limit
    filters = {"search": search}
    items = await participant.get_multi(db, skip=skip, limit=limit, filters=filters)
    total = await participant.count(db, filters=filters)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/search")  # Must be before /{participant_id}
async def search_participants(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(deps.get_db),
    limit: int = Query(10),
):
    results = await participant.search(db, query=q, limit=limit)
    return {"items": results, "total": len(results), "pages": 1}


@router.get("/export")  # Must be before /{participant_id}
async def export_participants(
    db: AsyncSession = Depends(deps.get_db),
    format: str = Query("csv"),
):
    data = await participant.get_multi(db, skip=0, limit=1000)
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Name", "Email", "Organization"])
        for p in data:
            writer.writerow([p.name, p.email or "", p.organization or ""])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=participants.csv"},
        )
    return {"items": data, "total": len(data)}


# ==================== UPDATE / DELETE (/{id} routes last) ====================

@router.patch("/{participant_id}", response_model=ParticipantResponse)
@router.put("/{participant_id}", response_model=ParticipantResponse)
async def update_participant(
    participant_id: UUID,
    participant_in: ParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update a participant with audit fields"""
    existing_participant = await participant.get(db, participant_id)
    if not existing_participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found"
        )
    
    if participant_in.email and participant_in.email != existing_participant.email:
        existing = await participant.get_by_email(db, participant_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Participant with email '{participant_in.email}' already exists"
            )
    
    # FIXED: Added current_user.id as the 4th argument
    return await participant.update(db, participant_id, participant_in, current_user.id)


@router.delete("/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete a participant (soft delete)"""
    # First check if participant exists
    existing_participant = await participant.get(db, participant_id)
    if not existing_participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found"
        )
    
    # Use soft_delete if available, or remove with proper arguments
    # Option 1: If you have soft_delete method
    await participant.soft_delete(db, participant_id, current_user.id)
    
    # Option 2: If you need to use remove, check your CRUDBase signature
    # await participant.remove(db, id=participant_id)
    
    return None


@router.patch("/{participant_id}", response_model=ParticipantResponse)
@router.put("/{participant_id}", response_model=ParticipantResponse)  # Add this line
async def update_participant(
    participant_id: UUID,
    participant_in: ParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    return await participant.update(db, participant_id, participant_in)


@router.patch("/{participant_id}", response_model=ParticipantResponse)
@router.put("/{participant_id}", response_model=ParticipantResponse)
async def update_participant(
    participant_id: UUID,
    participant_in: ParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update a participant with audit fields"""
    # Check if participant exists
    existing_participant = await participant.get(db, participant_id)
    if not existing_participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found"
        )
    
    # Check for email duplication if email is being updated
    if participant_in.email and participant_in.email != existing_participant.email:
        existing = await participant.get_by_email(db, participant_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Participant with email '{participant_in.email}' already exists"
            )
    
    # FIX: Add updated_by_id parameter
    updated_participant = await participant.update(
        db, 
        participant_id, 
        participant_in, 
        updated_by_id=current_user.id  # ← THIS WAS MISSING
    )
    
    if not updated_participant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update participant"
        )
    
    return updated_participant