from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.api import deps
from app.crud.action_tracker import meeting
from app.models.user import User
from app.schemas.action_tracker import MeetingDocumentResponse


router = APIRouter()

@router.post("/{meeting_id}/documents", response_model=MeetingDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    meeting_id: UUID,
    title: str = Query(...),
    description: Optional[str] = Query(None),
    document_type: str = Query("attachment"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    document_in = MeetingDocumentCreate(
        file_name=file.filename,
        document_type_id=document_type,
        description=description
    )
    file_path = f"uploads/meetings/{meeting_id}/{file.filename}"
    return await meeting_document.upload_document(
        db, meeting_id, document_in, file_path, file.size, file.content_type, current_user.id
    )

@router.get("/{meeting_id}/documents", response_model=List[MeetingDocumentResponse])
async def get_meeting_documents(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    return await meeting_document.get_meeting_documents(db, meeting_id)

@router.get("/{document_id}", response_model=MeetingDocumentResponse)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await meeting_document.get(db, document_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return result

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await meeting_document.get(db, document_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await meeting_document.remove(db, document_id)