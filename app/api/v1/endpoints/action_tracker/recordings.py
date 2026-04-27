# app/api/v1/endpoints/action_tracker/recordings.py

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from typing import Optional, List
from datetime import datetime
from pathlib import Path
import uuid

from app.db.session import get_db
from app.api import deps
from app.core.security import get_current_user
from app.models.user import User
from app.models.action_tracker import Meeting
from app.models.meeting_recording import MeetingRecording, RecordingType, RecordingStatus

router = APIRouter()


@router.post("/{meeting_id}/recordings", status_code=status.HTTP_201_CREATED)
async def upload_recording(
    meeting_id: str,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form("meeting"),
    duration: Optional[int] = Form(0),
    quality: Optional[str] = Form(None),
    format: Optional[str] = Form(None),
    mode: Optional[str] = Form("video"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Upload a recording for a specific meeting."""
    
    # Parse meeting_id (handle both with and without hyphens)
    try:
        clean_id = meeting_id.replace('-', '')
        if len(clean_id) == 32:
            meeting_uuid = str(uuid.UUID(clean_id))
        else:
            meeting_uuid = str(uuid.UUID(meeting_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid meeting ID format: {meeting_id}"
        )
    
    # Verify meeting exists
    meeting_query = select(Meeting).where(
        Meeting.id == meeting_uuid,
        Meeting.is_active == True
    )
    meeting_result = await db.execute(meeting_query)
    meeting = meeting_result.scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting not found with ID: {meeting_id}"
        )
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Validate file size (max 500MB)
    max_size = 500 * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is 500MB. Your file is {file_size / 1024 / 1024:.2f}MB"
        )
    
    # Create unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"
    
    # Define recording_id FIRST
    recording_id = str(uuid.uuid4())
    
    # Determine recording type (use uppercase for enum)
    if mode == "video":
        recording_type = RecordingType.VIDEO
    elif mode == "audio":
        recording_type = RecordingType.AUDIO
    else:
        recording_type = RecordingType.VIDEO
    
    # Create recording record
    recording = MeetingRecording(
        id=recording_id,
        meeting_id=meeting_uuid,
        title=title or file.filename,
        description=description,
        category=category,
        recording_type=recording_type,
        file_data=content,
        file_name=unique_filename,
        file_size=file_size,
        mime_type=file.content_type,
        duration=duration,
        quality=quality,
        format=format,
        status=RecordingStatus.COMPLETED,
        created_by_id=str(current_user.id),
        created_at=datetime.utcnow(),
        is_active=True
    )
    
    db.add(recording)
    await db.commit()
    await db.refresh(recording)
    
    return {
        "id": recording.id,
        "meeting_id": recording.meeting_id,
        "title": recording.title,
        "description": recording.description,
        "file_name": recording.file_name,
        "file_size": recording.file_size,
        "duration": recording.duration,
        "quality": recording.quality,
        "format": recording.format,
        "recording_type": recording.recording_type.value if recording.recording_type else "VIDEO",
        "created_at": recording.created_at.isoformat(),
        "message": "Recording uploaded successfully"
    }


@router.get("/{meeting_id}/recordings")
async def get_meeting_recordings(
    meeting_id: str,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    recording_type: Optional[str] = Query(None, description="Filter by recording type (VIDEO/AUDIO)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all recordings for a meeting with pagination and filtering."""
    
    # Parse meeting_id
    try:
        clean_id = meeting_id.replace('-', '')
        if len(clean_id) == 32:
            meeting_uuid = str(uuid.UUID(clean_id))
        else:
            meeting_uuid = str(uuid.UUID(meeting_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid meeting ID format: {meeting_id}"
        )
    
    # Verify meeting exists
    meeting_query = select(Meeting).where(
        Meeting.id == meeting_uuid,
        Meeting.is_active == True
    )
    meeting_result = await db.execute(meeting_query)
    meeting = meeting_result.scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting not found with ID: {meeting_id}"
        )
    
    # Build query
    query = select(MeetingRecording).where(
        MeetingRecording.meeting_id == meeting_uuid,
        MeetingRecording.is_active == True,
        MeetingRecording.status != RecordingStatus.DELETED
    )
    
    # Apply type filter if provided
    if recording_type:
        if recording_type.upper() == "VIDEO":
            query = query.where(MeetingRecording.recording_type == RecordingType.VIDEO)
        elif recording_type.upper() == "AUDIO":
            query = query.where(MeetingRecording.recording_type == RecordingType.AUDIO)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # Apply pagination and ordering
    query = query.order_by(desc(MeetingRecording.created_at)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    recordings = result.scalars().all()
    
    # Build response
    items = []
    for recording in recordings:
        items.append({
            "id": recording.id,
            "meeting_id": recording.meeting_id,
            "title": recording.title,
            "description": recording.description,
            "category": recording.category,
            "file_name": recording.file_name,
            "file_size": recording.file_size,
            "duration": recording.duration,
            "quality": recording.quality,
            "format": recording.format,
            "recording_type": recording.recording_type.value if recording.recording_type else "VIDEO",
            "status": recording.status.value if recording.status else "COMPLETED",
            "view_count": recording.view_count,
            "download_count": recording.download_count,
            "is_public": recording.is_public,
            "created_at": recording.created_at,
            "created_by_id": recording.created_by_id,
            "url": f"/api/v1/meetings/{meeting_id}/recordings/{recording.id}/download",
            "stream_url": f"/api/v1/meetings/{meeting_id}/recordings/{recording.id}/stream"
        })
    
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 1
    }


@router.get("/{meeting_id}/recordings/{recording_id}")
async def get_recording_details(
    meeting_id: str,
    recording_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get details of a specific recording."""
    
    query = select(MeetingRecording).where(
        MeetingRecording.id == recording_id,
        MeetingRecording.meeting_id == meeting_id,
        MeetingRecording.is_active == True
    )
    result = await db.execute(query)
    recording = result.scalar_one_or_none()
    
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording not found"
        )
    
    return {
        "id": recording.id,
        "meeting_id": recording.meeting_id,
        "title": recording.title,
        "description": recording.description,
        "category": recording.category,
        "file_name": recording.file_name,
        "file_size": recording.file_size,
        "duration": recording.duration,
        "quality": recording.quality,
        "format": recording.format,
        "recording_type": recording.recording_type.value if recording.recording_type else "VIDEO",
        "status": recording.status.value if recording.status else "COMPLETED",
        "view_count": recording.view_count,
        "download_count": recording.download_count,
        "is_public": recording.is_public,
        "created_at": recording.created_at,
        "created_by_id": recording.created_by_id,
        "url": f"/api/v1/meetings/{meeting_id}/recordings/{recording_id}/download",
        "stream_url": f"/api/v1/meetings/{meeting_id}/recordings/{recording_id}/stream"
    }


@router.get("/{meeting_id}/recordings/{recording_id}/download")
async def download_recording(
    meeting_id: str,
    recording_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Download a recording file."""
    
    query = select(MeetingRecording).where(
        MeetingRecording.id == recording_id,
        MeetingRecording.is_active == True
    )
    result = await db.execute(query)
    recording = result.scalar_one_or_none()
    
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording not found"
        )
    
    # Increment download count
    recording.download_count += 1
    await db.commit()
    
    # Return file
    return Response(
        content=recording.file_data,
        media_type=recording.mime_type or "video/webm",
        headers={
            "Content-Disposition": f"attachment; filename={recording.file_name}",
            "Content-Length": str(recording.file_size)
        }
    )


@router.get("/{meeting_id}/recordings/{recording_id}/stream")
async def stream_recording(
    meeting_id: str,
    recording_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Stream a recording for playback (no download)."""
    
    query = select(MeetingRecording).where(
        MeetingRecording.id == recording_id,
        MeetingRecording.is_active == True
    )
    result = await db.execute(query)
    recording = result.scalar_one_or_none()
    
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording not found"
        )
    
    # Increment view count
    recording.view_count += 1
    await db.commit()
    
    # Return streamable content
    return Response(
        content=recording.file_data,
        media_type=recording.mime_type or "video/webm",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
            "Content-Disposition": f"inline; filename={recording.file_name}"
        }
    )


@router.delete("/{meeting_id}/recordings/{recording_id}")
async def delete_recording(
    meeting_id: str,
    recording_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete a recording."""
    
    query = select(MeetingRecording).where(
        MeetingRecording.id == recording_id,
        MeetingRecording.is_active == True
    )
    result = await db.execute(query)
    recording = result.scalar_one_or_none()
    
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording not found"
        )
    
    # Check authorization
    if str(recording.created_by_id) != str(current_user.id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this recording"
        )
    
    # Soft delete
    recording.is_active = False
    recording.status = RecordingStatus.DELETED
    recording.deleted_at = datetime.utcnow()
    recording.updated_by_id = str(current_user.id)
    
    await db.commit()
    
    return {
        "success": True, 
        "message": "Recording deleted successfully",
        "recording_id": recording_id
    }


@router.patch("/{meeting_id}/recordings/{recording_id}")
async def update_recording_metadata(
    meeting_id: str,
    recording_id: str,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    is_public: Optional[bool] = Form(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update recording metadata (title, description, category, public status)."""
    
    query = select(MeetingRecording).where(
        MeetingRecording.id == recording_id,
        MeetingRecording.is_active == True
    )
    result = await db.execute(query)
    recording = result.scalar_one_or_none()
    
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording not found"
        )
    
    # Check authorization
    if str(recording.created_by_id) != str(current_user.id) and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this recording"
        )
    
    # Update fields
    if title is not None:
        recording.title = title
    if description is not None:
        recording.description = description
    if category is not None:
        recording.category = category
    if is_public is not None:
        recording.is_public = is_public
    
    recording.updated_by_id = str(current_user.id)
    recording.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(recording)
    
    return {
        "id": recording.id,
        "meeting_id": recording.meeting_id,
        "title": recording.title,
        "description": recording.description,
        "category": recording.category,
        "is_public": recording.is_public,
        "updated_at": recording.updated_at,
        "message": "Recording updated successfully"
    }