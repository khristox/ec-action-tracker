from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.api import deps
from app.models.user import User
from app.crud.action_tracker import participant_list
from app.schemas.action_tracker_participants import (
    AddParticipantsToListRequest,
    BulkAddParticipantsResponse,
    PaginatedParticipantResponse,
    ParticipantListCreate,
    ParticipantListDetailResponse,
    ParticipantListUpdate,
    ParticipantListResponse
)

router = APIRouter()


# ==================== HELPER FUNCTIONS ====================

async def get_and_verify_list(
    db: AsyncSession,
    list_id: UUID,
    current_user: User,
    require_ownership: bool = False
):
    """
    Helper function to get a participant list and verify permissions.
    
    Args:
        db: Database session
        list_id: ID of the list to retrieve
        current_user: Current authenticated user
        require_ownership: If True, requires user to be the owner
    
    Returns:
        The participant list object
    
    Raises:
        HTTPException: If list not found or permission denied
    """
    list_obj = await participant_list.get(db, list_id)
    if not list_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant list not found"
        )
    
    # Check access permissions
    if not list_obj.is_global and list_obj.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this list"
        )
    
    # Check ownership if required
    if require_ownership and list_obj.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can perform this action"
        )
    
    return list_obj


# ==================== CREATE OPERATIONS ====================

@router.post(
    "/",
    response_model=ParticipantListResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new participant list",
    description="Create a new participant list. The list can optionally include initial participants."
)
async def create_participant_list(
    list_in: ParticipantListCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Create a new participant list.
    
    - **name**: Name of the list (required)
    - **description**: Optional description
    - **is_global**: Whether the list is accessible by all users (default: false)
    - **participant_ids**: Optional list of participant IDs to add initially
    """
    return await participant_list.create_with_participants(
        db, list_in, list_in.participant_ids, current_user.id
    )


# ==================== READ OPERATIONS ====================

@router.get(
    "/",
    response_model=List[ParticipantListResponse],
    summary="Get all accessible participant lists",
    description="Get all participant lists accessible to the current user (owned lists + global lists)."
)
async def get_participant_lists(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
):
    """
    Get all participant lists accessible to the current user.
    
    This includes:
    - Lists created by the current user
    - Global lists created by other users
    
    Results are paginated using skip and limit parameters.
    """
    lists = await participant_list.get_accessible_lists(db, current_user.id, skip, limit)
    return lists


@router.get(
    "/{list_id}",
    response_model=ParticipantListDetailResponse,
    summary="Get a specific participant list",
    description="Get detailed information about a specific participant list including its members."
)
async def get_participant_list(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get a specific participant list by ID.
    
    Returns the list details including:
    - List metadata (name, description, etc.)
    - All participants in the list
    - Audit information (creator, timestamps)
    """
    list_obj = await participant_list.get_list_with_participants(db, list_id)
    if not list_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant list not found"
        )
    
    # Check access
    if not list_obj.is_global and list_obj.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this list"
        )
    
    return list_obj


# ==================== UPDATE OPERATIONS ====================

@router.put(
    "/{list_id}",
    response_model=ParticipantListResponse,
    summary="Update a participant list",
    description="Update an existing participant list. Only the owner can update a list."
)
async def update_participant_list(
    list_id: UUID,
    list_in: ParticipantListUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update a participant list.
    
    Only the owner of the list can update it.
    Fields that can be updated:
    - **name**: New name for the list
    - **description**: New description
    - **is_global**: Whether the list should be global
    - **participant_ids**: Complete replacement list of participant IDs
    """
    list_obj = await get_and_verify_list(db, list_id, current_user, require_ownership=True)
    
    return await participant_list.update(db, list_obj, list_in, current_user.id)


# ==================== DELETE OPERATIONS ====================

@router.delete(
    "/{list_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a participant list",
    description="Soft delete a participant list. Only the owner can delete a list."
)
async def delete_participant_list(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Delete a participant list.
    
    This is a soft delete - the list is marked as inactive but not removed from the database.
    Only the owner of the list can delete it.
    """
    await get_and_verify_list(db, list_id, current_user, require_ownership=True)
    await participant_list.soft_delete(db, list_id, current_user.id)
    return None


# ==================== LIST MEMBERS MANAGEMENT ====================

@router.get(
    "/{list_id}/members",
    response_model=PaginatedParticipantResponse,
    summary="Get list members",
    description="Get all participants in a specific list with pagination."
)
async def get_list_members(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of records to return"),
):
    """
    Get all members of a participant list with pagination.
    
    Returns a paginated list of participants in the list.
    """
    await get_and_verify_list(db, list_id, current_user, require_ownership=False)
    
    members = await participant_list.get_list_participants(db, list_id, skip, limit)
    total = len(members)
    
    return {
        "items": members,
        "total": total,
        "page": skip // limit + 1 if limit > 0 else 1,
        "size": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 1
    }


@router.post(
    "/{list_id}/members",
    response_model=BulkAddParticipantsResponse,
    status_code=status.HTTP_200_OK,
    summary="Add members to list",
    description="Add multiple participants to a list. Only the owner can add members."
)
async def add_members_to_list(
    list_id: UUID,
    request: AddParticipantsToListRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Add participants to a participant list.
    
    Only the owner of the list can add members.
    The request body should contain a list of participant IDs to add.
    
    Returns:
    - **added_count**: Number of participants successfully added
    - **skipped_count**: Number of participants already in the list
    - **skipped_ids**: IDs of participants that were already in the list
    - **errors**: Any errors that occurred during the operation
    """
    await get_and_verify_list(db, list_id, current_user, require_ownership=True)
    
    result = await participant_list.add_participants_to_list_batch(
        db, list_id, request.participant_ids, current_user.id
    )
    
    return result


@router.delete(
    "/{list_id}/members/{participant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from list",
    description="Remove a specific participant from a list. Only the owner can remove members."
)
async def remove_member_from_list(
    list_id: UUID,
    participant_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Remove a participant from a list.
    
    Only the owner of the list can remove members.
    """
    await get_and_verify_list(db, list_id, current_user, require_ownership=True)
    
    success = await participant_list.remove_participant_from_list(db, list_id, participant_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found in this list"
        )
    
    return None


@router.get(
    "/{list_id}/available-participants",
    response_model=PaginatedParticipantResponse,
    summary="Get available participants",
    description="Get participants that are not already in the list and can be added."
)
async def get_available_participants(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    search: Optional[str] = Query(None, min_length=1, description="Search term to filter participants"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of records to return"),
):
    """
    Get participants that are not already in the list.
    
    This is useful for adding new members to a list.
    You can optionally search by name, email, or organization.
    """
    await get_and_verify_list(db, list_id, current_user, require_ownership=False)
    
    participants, total = await participant_list.get_participants_not_in_list_paginated(
        db, list_id, search, skip, limit
    )
    
    return {
        "items": participants,
        "total": total,
        "page": skip // limit + 1 if limit > 0 else 1,
        "size": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 1
    }

@router.get("/{list_id}/members", response_model=PaginatedParticipantResponse)
async def get_list_members(
    list_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """Get all members of a participant list"""
    try:
        # First check if list exists and user has access
        list_obj = await participant_list.get(db, list_id)
        if not list_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant list not found"
            )
        
        # Check access
        if not list_obj.is_global and list_obj.created_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this list"
            )
        
        # Get members with pagination
        members = await participant_list.get_list_participants(db, list_id, skip, limit)
        
        # Get total count
        from sqlalchemy import func
        from app.models.action_tracker import participant_list_members
        
        total_result = await db.execute(
            select(func.count()).select_from(participant_list_members).where(
                participant_list_members.c.participant_list_id == list_id
            )
        )
        total = total_result.scalar() or 0
        
        return {
            "items": members,
            "total": total,
            "page": skip // limit + 1 if limit > 0 else 1,
            "size": limit,
            "pages": (total + limit - 1) // limit if limit > 0 else 1
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting list members: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get list members: {str(e)}"
        )