# app/api/v1/endpoints/action_tracker/participants.py

import csv
import io
import logging
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.api import deps
from app.crud.meetings.action_tracker import participant
from app.models.meetings.action_tracker import Participant, ParticipantList, participant_list_members
from app.models.user import User
from app.schemas.action_tracker_participants import (
    PaginatedParticipantResponse,
    ParticipantBulkCreate,
    ParticipantCreate,
    ParticipantResponse,
    ParticipantSearchResult,
    ParticipantUpdate
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== HELPER FUNCTIONS ====================

def clean_phone_number(phone: str) -> str:
    """
    Clean and validate phone number.
    Handles scientific notation and other formats.
    """
    if not phone:
        return phone
    
    # Convert to string if it's a number
    phone_str = str(phone)
    
    # Handle scientific notation (e.g., 2.5677E+11)
    if 'E' in phone_str.upper():
        try:
            # Convert scientific notation to regular number
            phone_num = float(phone_str)
            phone_str = str(int(phone_num))
        except (ValueError, TypeError):
            pass
    
    # Remove non-digit characters except + and -
    phone_clean = re.sub(r'[^\d+]', '', phone_str)
    
    # If it's too long, try to clean it further
    if len(phone_clean) > 20:
        # Remove any remaining non-digit characters
        phone_clean = re.sub(r'\D', '', phone_str)
        # Take only the last 15 digits if it's too long
        if len(phone_clean) > 15:
            phone_clean = phone_clean[-15:]
    
    return phone_clean


def format_phone_response(phone):
    """Format phone number for response"""
    if not phone:
        return None
    try:
        cleaned = clean_phone_number(str(phone))
        # Ensure it's a string and not None
        return cleaned if cleaned else None
    except Exception:
        return None


def model_to_response(participant_obj):
    """Convert Participant model to ParticipantResponse"""
    return ParticipantResponse(
        id=participant_obj.id,
        name=participant_obj.name,
        email=participant_obj.email,
        telephone=format_phone_response(getattr(participant_obj, 'telephone', None)),
        title=getattr(participant_obj, 'title', None),
        organization=getattr(participant_obj, 'organization', None),
        notes=getattr(participant_obj, 'notes', None),
        created_by_id=participant_obj.created_by_id,
        created_at=participant_obj.created_at,
        updated_by_id=getattr(participant_obj, 'updated_by_id', None),
        updated_at=getattr(participant_obj, 'updated_at', None),
        is_active=getattr(participant_obj, 'is_active', True),
    )


def clean_phone_in_dict(data: dict) -> dict:
    """Clean phone number in a dictionary"""
    if 'telephone' in data and data['telephone']:
        data['telephone'] = clean_phone_number(data['telephone'])
    if 'phone' in data and data['phone']:
        data['phone'] = clean_phone_number(data['phone'])
    return data


# ==================== CREATE ====================

@router.post("/", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_participant(
    participant_in: ParticipantCreate,
    participant_list_id: UUID = Query(..., description="ID of the participant list to check"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new participant and add to a participant list"""
    
    try:
        # Clean phone number if present
        if hasattr(participant_in, 'telephone') and participant_in.telephone:
            participant_in.telephone = clean_phone_number(participant_in.telephone)
        
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
        
        # Check if participant with same email exists in this list
        if participant_in.email:
            stmt = (
                select(Participant)
                .join(
                    participant_list_members, 
                    Participant.id == participant_list_members.c.participant_id
                )
                .where(
                    participant_list_members.c.participant_list_id == participant_list_id,
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
        existing_global = await participant.get_by_email(db, participant_in.email) if participant_in.email else None
        
        if existing_global:
            new_participant = existing_global
        else:
            # Create new participant
            participant_dict = participant_in.dict()
            participant_dict = clean_phone_in_dict(participant_dict)
            
            new_participant = await participant.create(
                db=db,
                obj_in=participant_dict,
                created_by_id=current_user.id
            )
            await db.flush()
        
        # Add participant to the list if not already added
        list_participant_stmt = select(participant_list_members).where(
            participant_list_members.c.participant_list_id == participant_list_id,
            participant_list_members.c.participant_id == new_participant.id
        )
        list_participant_result = await db.execute(list_participant_stmt)
        already_in_list = list_participant_result.first()
        
        if not already_in_list:
            insert_stmt = participant_list_members.insert().values(
                participant_list_id=participant_list_id,
                participant_id=new_participant.id,
                added_by_id=current_user.id
            )
            await db.execute(insert_stmt)
        
        await db.commit()
        await db.refresh(new_participant)
        
        return model_to_response(new_participant)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating participant: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create participant: {str(e)}"
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
            # Clean phone number if present
            p_dict = p_data.dict() if hasattr(p_data, 'dict') else dict(p_data)
            p_dict = clean_phone_in_dict(p_dict)
            
            new_p = await participant.create(db, p_dict, current_user.id)
            created.append(model_to_response(new_p))
        except Exception as e:
            logger.warning(f"Failed to create participant in bulk: {str(e)}")
            continue
    return created


# ==================== READ ====================

@router.get("/", response_model=PaginatedParticipantResponse)
async def get_participants(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
):
    """Get paginated list of participants"""
    try:
        skip = (page - 1) * limit
        
        # Build filters
        filters = {}
        if search:
            filters["search"] = search
        
        # Get items and total count
        items = await participant.get_multi(db, skip=skip, limit=limit, filters=filters)
        total = await participant.count(db, filters=filters)
        
        # Convert items to response format with cleaned phone numbers
        response_items = []
        for item in items:
            response_items.append(model_to_response(item))
        
        return {
            "items": response_items,
            "total": total,
            "page": page,
            "size": limit,
            "pages": (total + limit - 1) // limit if limit > 0 else 1,
        }
        
    except Exception as e:
        logger.error(f"Error fetching participants: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch participants: {str(e)}"
        )


@router.get("/search", response_model=ParticipantSearchResult)
async def search_participants_endpoint(
    q: str = Query(..., min_length=1, description="Search query (email, name, or telephone)"),
    list_id: Optional[UUID] = Query(None, description="Optional: Filter participants by list ID"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results to return"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Search for participants by email, name, or telephone.
    Optionally filter by list_id to only search within a specific participant list.
    """
    try:
        # If list_id is provided, search only within that list
        if list_id:
            results = await participant.search_participants_with_list_filter(
                db, 
                list_id=list_id, 
                query=q, 
                limit=limit,
                user_id=current_user.id
            )
        else:
            # Search across all participants
            results = await participant.search_participants(
                db, 
                query=q, 
                limit=limit,
                user_id=current_user.id
            )
        
        # Clean phone numbers in results
        cleaned_results = []
        for item in results:
            cleaned_results.append(model_to_response(item))
        
        return {
            "items": cleaned_results,
            "total": len(cleaned_results),
            "pages": 1,
            "query": q,
            "list_id": list_id
        }
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Search endpoint error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/export")
async def export_participants(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    format: str = Query("csv"),
):
    """Export participants as CSV"""
    try:
        data = await participant.get_multi(db, skip=0, limit=1000)
        
        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write headers
            writer.writerow(["Name", "Email", "Organization", "Phone", "Title"])
            
            # Write data
            for p in data:
                # Clean phone number for export
                phone = getattr(p, 'telephone', None) or getattr(p, 'phone', None)
                if phone:
                    phone = clean_phone_number(str(phone))
                
                writer.writerow([
                    p.name or "", 
                    p.email or "", 
                    getattr(p, 'organization', "") or "",
                    phone or "",
                    getattr(p, 'title', "") or ""
                ])
            
            output.seek(0)
            csv_content = output.getvalue()
            
            return StreamingResponse(
                iter([csv_content.encode('utf-8')]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=participants.csv"}
            )
        
        return {"items": data, "total": len(data)}
        
    except Exception as e:
        logger.error(f"Error exporting participants: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export participants: {str(e)}"
        )


# ==================== GET SINGLE PARTICIPANT ====================

@router.get("/{participant_id}", response_model=ParticipantResponse)
async def get_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get a single participant by ID"""
    try:
        participant_obj = await participant.get(db, participant_id)
        if not participant_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        return model_to_response(participant_obj)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching participant {participant_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch participant: {str(e)}"
        )


# ==================== UPDATE PARTICIPANT ====================

@router.put("/{participant_id}", response_model=ParticipantResponse)
async def update_participant(
    participant_id: UUID,
    participant_in: ParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update a participant with audit fields"""
    try:
        # Check if participant exists
        existing_participant = await participant.get(db, participant_id)
        if not existing_participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        # Clean phone number if present
        if hasattr(participant_in, 'telephone') and participant_in.telephone:
            participant_in.telephone = clean_phone_number(participant_in.telephone)
        
        # Check for email duplication if email is being updated
        if participant_in.email and participant_in.email != existing_participant.email:
            existing = await participant.get_by_email(db, participant_in.email)
            if existing and existing.id != participant_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Participant with email '{participant_in.email}' already exists"
                )
        
        # Update the participant
        updated_participant = await participant.update(
            db=db,
            db_obj=existing_participant,
            obj_in=participant_in
        )
        
        # Update audit fields manually
        if updated_participant:
            updated_participant.updated_by_id = current_user.id
            updated_participant.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(updated_participant)
        
        logger.info(f"Participant {participant_id} updated by user {current_user.id}")
        return model_to_response(updated_participant)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating participant {participant_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update participant: {str(e)}"
        )


@router.patch("/{participant_id}", response_model=ParticipantResponse)
async def patch_participant(
    participant_id: UUID,
    participant_in: ParticipantUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Partially update a participant"""
    return await update_participant(participant_id, participant_in, db, current_user)


# ==================== DELETE PARTICIPANT ====================

@router.delete("/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_participant(
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete a participant"""
    try:
        existing_participant = await participant.get(db, participant_id)
        if not existing_participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        await participant.soft_delete(db, participant_id, current_user.id)
        logger.info(f"Participant {participant_id} deleted by user {current_user.id}")
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting participant {participant_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete participant: {str(e)}"
        )