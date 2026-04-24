# backend/app/api/v1/endpoints/action_tracker/participants.py

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
import csv
import io
from fastapi.responses import StreamingResponse

from app.api import deps
from app.models.action_tracker import Participant
from app.models.user import User
from app.crud.action_tracker import participant, meeting_participant
from app.schemas.action_tracker_participants import (
    PaginatedParticipantResponse,
    ParticipantBulkCreate,
    ParticipantCreate,
    ParticipantResponse,
    ParticipantSearchResult,
    ParticipantUpdate
)

router = APIRouter()


from app.models.action_tracker import participant_list_members

from app.models.action_tracker import Participant, ParticipantList  # Import the model, not the table




# ==================== CREATE ====================

@router.post("/", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_participant(
    participant_in: ParticipantCreate,
    participant_list_id: UUID = Query(..., description="ID of the participant list to check"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new participant and add to a participant list"""
    
    # First, check if participant with same email exists in the specific participant list
    if participant_in.email:
        # Check if participant list exists
        stmt_list = select(ParticipantList).where(
            ParticipantList.id == participant_list_id,
            ParticipantList.is_active == True
        )
        participant_list_result = await db.execute(stmt_list)
        participant_list_obj = participant_list_result.scalar_one_or_none()
        
        if not participant_list_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Participant list with ID '{participant_list_id}' not found",
            )
        
        # Check if any participant in this list has the same email
        # Using the Table object with .c to access columns
        stmt = (
            select(Participant)
            .join(
                participant_list_members, 
                Participant.id == participant_list_members.c.participant_id  # Use .c. for Table columns
            )
            .where(
                participant_list_members.c.participant_list_id == participant_list_id,  # Note: column name is participant_list_id, not list_id
                Participant.email == participant_in.email,
                Participant.is_active == True
            )
        )
        result = await db.execute(stmt)
        existing_in_list = result.scalar_one_or_none()
        
        if existing_in_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Participant with email '{participant_in.email}' already exists in list '{participant_list_obj.name}'",
            )
    
    # Check if participant exists globally
    existing_global = await participant.get_by_email(db, participant_in.email)
    
    if existing_global:
        # Participant exists globally, just add to the list
        new_participant = existing_global
    else:
        # Create new participant globally
        new_participant = await participant.create(
            db, 
            obj_in=participant_in, 
            created_by_id=current_user.id
        )
        await db.flush()
    
    # Add participant to the list if not already added
    # Check if already in list using the Table
    list_participant_stmt = select(participant_list_members).where(
        participant_list_members.c.participant_list_id == participant_list_id,
        participant_list_members.c.participant_id == new_participant.id
    )
    list_participant_result = await db.execute(list_participant_stmt)
    already_in_list = list_participant_result.first()  # Use first() for Table results
    
    if not already_in_list:
        # Add to participant list using the Table's insert
        insert_stmt = participant_list_members.insert().values(
            participant_list_id=participant_list_id,
            participant_id=new_participant.id,
            added_by_id=current_user.id
        )
        await db.execute(insert_stmt)
    
    await db.commit()
    await db.refresh(new_participant)
    
    # Convert to response format
    return ParticipantResponse(
        id=new_participant.id,
        name=new_participant.name,
        email=new_participant.email,
        telephone=new_participant.telephone,
        title=new_participant.title,
        organization=new_participant.organization,
        notes=getattr(new_participant, 'notes', None),
        created_by_id=new_participant.created_by_id,
        created_at=new_participant.created_at,
        updated_by_id=getattr(new_participant, 'updated_by_id', None),
        updated_at=getattr(new_participant, 'updated_at', None),
        is_active=new_participant.is_active,
    )

@router.post("/bulk", response_model=List[ParticipantResponse])
async def bulk_create_participants(
    participants_in: ParticipantBulkCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Bulk create participants"""
    created = []
    for p_data in participants_in.participants:
        try:
            new_p = await participant.create(db, p_data, current_user.id)
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
        "pages": (total + limit - 1) // limit if limit > 0 else 1,
    }


@router.get("/search")
@router.get("/participants/search", response_model=ParticipantSearchResult)
async def search_participants_endpoint(
    q: str = Query(..., min_length=1, description="Search query (email, name, or telephone)"),
    list_id: Optional[UUID] = Query(None, description="Optional: Filter participants by list ID"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results to return"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),  # Add user authentication
):
    """
    Search for participants by email, name, or telephone.
    Optionally filter by list_id to only search within a specific participant list.
    Returns a list of matching participants without binary fields.
    """
    try:
        # If list_id is provided, search only within that list
        if list_id:
            results = await participant.search_participants_with_list_filter(
                db, 
                list_id=list_id, 
                query=q, 
                limit=limit,
                user_id=current_user.id  # Ensure user has access to the list
            )
        else:
            # Search across all participants (existing behavior)
            results = await participant.search_participants(
                db, 
                query=q, 
                limit=limit,
                user_id=current_user.id
            )
        
        return {
            "items": results,
            "total": len(results),
            "pages": 1,
            "query": q,
            "list_id": list_id  # Include list_id in response for context
        }
    except PermissionError as e:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: {str(e)}"
        )
    except Exception as e:
        print(f"Search endpoint error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/export")
async def export_participants(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    format: str = Query("csv"),
):
    data = await participant.get_multi(db, skip=0, limit=1000)
    
    if format == "csv":
        import csv
        from io import StringIO
        from fastapi.responses import StreamingResponse
        
        # Use StringIO for string data
        output = StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow(["Name", "Email", "Organization", "Phone", "Title"])
        
        # Write data
        for p in data:
            writer.writerow([
                p.name, 
                p.email or "", 
                p.organization or "", 
                p.telephone or "",
                p.title or ""
            ])
        
        # Get the string value and encode to bytes for the response
        output.seek(0)
        csv_content = output.getvalue()
        
        # Return as streaming response with proper encoding
        return StreamingResponse(
            iter([csv_content.encode('utf-8')]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=participants.csv"}
        )
    
    return {"items": data, "total": len(data)}

# ==================== GET SINGLE PARTICIPANT ====================

@router.get("/{participant_id}", response_model=ParticipantResponse)
async def get_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get a single participant by ID"""
    participant_obj = await participant.get(db, participant_id)
    if not participant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found"
        )
    return participant_obj


# ==================== UPDATE PARTICIPANT ====================

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
    
    # Update the participant
    updated_participant = await participant.update(
        db, 
        participant_id, 
        participant_in, 
        updated_by_id=current_user.id
    )
    
    if not updated_participant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update participant"
        )
    
    return updated_participant


# ==================== DELETE PARTICIPANT ====================

@router.delete("/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete a participant"""
    existing_participant = await participant.get(db, participant_id)
    if not existing_participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found"
        )
    
    await participant.soft_delete(db, participant_id, current_user.id)
    return None


# ==================== PATCH (optional, same as PUT) ====================

@router.patch("/{participant_id}", response_model=ParticipantResponse)
async def patch_participant(
    participant_id: UUID,
    participant_in: ParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Partially update a participant"""
    return await update_participant(participant_id, participant_in, db, current_user)