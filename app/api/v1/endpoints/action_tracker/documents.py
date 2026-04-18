# app/api/v1/endpoints/action_tracker/documents.py

import os

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
import logging

from app.api import deps
from app.crud.action_tracker import meeting, meeting_document
from app.models.general.dynamic_attribute import Attribute, AttributeGroup
from app.models.user import User
from app.schemas.action_tracker import MeetingDocumentResponse, MeetingDocumentCreate

logger = logging.getLogger(__name__)

router = APIRouter()

async def validate_document_type_id(db: AsyncSession, document_type_id: UUID) -> bool:
    """Validate that the document_type_id exists in the DOCUMENT_TYPE attribute group."""
    from sqlalchemy import select
    from app.models.general.dynamic_attribute import Attribute
    
    result = await db.execute(
        select(Attribute).where(
            Attribute.id == document_type_id,
            Attribute.group.has(code="DOCUMENT_TYPE"),
            Attribute.is_active == True
        )
    )
    
    document_type_attr = result.scalar_one_or_none()
    
    if document_type_attr:
        logger.info(f"✅ Valid document type found: {document_type_attr.code} - {document_type_attr.name}")
        return True
    
    logger.warning(f"❌ Invalid document_type_id: {document_type_id}")
    return False

# ============ MAIN ENDPOINTS ============

@router.post("/{meeting_id}/documents", response_model=MeetingDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    meeting_id: UUID,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    document_type_id: UUID = Form(...), 
    file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Upload a document to a meeting"""
    
    logger.info("=" * 60)
    logger.info("📄 UPLOAD_DOCUMENT ENDPOINT HIT!")
    logger.info(f"📍 Meeting ID: {meeting_id}")
    logger.info(f"📍 Title: {title}")
    logger.info(f"📍 Document Type ID: {document_type_id}")
    logger.info(f"📍 File: {file.filename}")
    logger.info("=" * 60)
    
    # Verify meeting exists
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Validate document type ID
    is_valid = await validate_document_type_id(db, document_type_id)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Invalid document_type_id: {document_type_id}. Must be a valid DOCUMENT_TYPE attribute ID."
        )
    
    # Create document record
    document_in = MeetingDocumentCreate(
        file_name=file.filename,
        title=title,
        description=description,
        document_type_id=document_type_id,
        file_size=None,
        mime_type=file.content_type
    )
    
    logger.info(f"📝 Creating document record with: title='{title}', type_id={document_type_id}")
    
    # Save file and create database record
    result = await meeting_document.upload_document(
        db=db,
        meeting_id=meeting_id,
        document_in=document_in,
        file=file,
        user_id=current_user.id
    )
    
    logger.info(f"✅ Document uploaded successfully! Document ID: {result.id}")
    
    return result


@router.get("/{meeting_id}/documents", response_model=List[MeetingDocumentResponse])
async def get_meeting_documents(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all documents for a meeting"""
    documents = await meeting_document.get_meeting_documents(db, meeting_id)
    return documents


# ============ NEW ENDPOINT FOR MEETINGS PREFIX (matches frontend) ============
@router.get("/meetings/{meeting_id}/documents", response_model=List[MeetingDocumentResponse])
async def get_meeting_documents_alt(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all documents for a meeting (alternative endpoint for frontend)"""
    from sqlalchemy import select
    from app.models.action_tracker import MeetingDocument
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(MeetingDocument)
        .where(MeetingDocument.meeting_id == meeting_id)
        .where(MeetingDocument.is_active == True)
        .options(
            selectinload(MeetingDocument.document_type),
            selectinload(MeetingDocument.uploaded_by)
        )
        .order_by(MeetingDocument.uploaded_at.desc())
    )
    documents = result.scalars().all()
    return documents


@router.post("/meetings/{meeting_id}/documents", response_model=MeetingDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document_alt(
    meeting_id: UUID,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    document_type_id: UUID = Form(...), 
    file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Upload a document to a meeting (alternative endpoint for frontend)"""
    
    logger.info("=" * 60)
    logger.info("📄 UPLOAD_DOCUMENT ALT ENDPOINT HIT!")
    logger.info(f"📍 Meeting ID: {meeting_id}")
    logger.info(f"📍 Title: {title}")
    logger.info(f"📍 Document Type ID: {document_type_id}")
    logger.info(f"📍 File: {file.filename}")
    logger.info("=" * 60)
    
    # Verify meeting exists
    meeting_obj = await meeting.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Validate document type ID
    is_valid = await validate_document_type_id(db, document_type_id)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Invalid document_type_id: {document_type_id}. Must be a valid DOCUMENT_TYPE attribute ID."
        )
    
    # Call CRUD method with all parameters
    result = await meeting_document.upload_document(
        db=db,
        meeting_id=meeting_id,
        file=file,
        title=title,
        description=description,
        document_type_id=document_type_id,
        user_id=current_user.id
    )
    
    logger.info(f"✅ Document uploaded successfully! Document ID: {result.id}")
    logger.info(f"   Document Type ID saved: {result.document_type_id}")
    
    return result

# ============ SINGLE DOCUMENT ENDPOINTS ============

@router.get("/document/{document_id}", response_model=MeetingDocumentResponse)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get a single document by ID"""
    result = await meeting_document.get(db, document_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return result


@router.delete("/document/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete a document (soft delete)"""
    result = await meeting_document.get(db, document_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    await meeting_document.remove(db, id=document_id, user=current_user.id, soft_delete=False)
    
    return None


@router.get("/document/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Download the actual file content"""
    result = await meeting_document.get(db, document_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    # Check if file exists on disk
    if not result.file_path or not os.path.exists(result.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on server")
    
    # Return the file
    return FileResponse(
        path=result.file_path,
        filename=result.file_name,
        media_type=result.mime_type or "application/octet-stream"
    )


# ============ DOCUMENT TYPES ENDPOINTS ============

@router.get("/attribute-groups/DOCUMENT_TYPE/attributes")
async def get_document_type_attributes(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all document type attributes (matches frontend expectation)"""
    from sqlalchemy import select
    from app.models.general.dynamic_attribute import Attribute, AttributeGroup
    
    logger.info("=" * 60)
    logger.info("📄 FETCHING DOCUMENT TYPES")
    logger.info("=" * 60)
    
    # Find the DOCUMENT_TYPE group
    result = await db.execute(
        select(AttributeGroup).where(AttributeGroup.code == "DOCUMENT_TYPE")
    )
    group = result.scalar_one_or_none()
    
    if not group:
        logger.warning("DOCUMENT_TYPE attribute group not found")
        # Return empty array directly (not wrapped in items)
        return []
    
    # Get all attributes in this group
    result = await db.execute(
        select(Attribute)
        .where(Attribute.group_id == group.id)
        .where(Attribute.is_active == True)
        .order_by(Attribute.sort_order)
    )
    attributes = result.scalars().all()
    
    logger.info(f"Found {len(attributes)} document types")
    
    # Return as array directly (not wrapped in items)
    response = [
        {
            "id": str(attr.id),
            "name": attr.name,
            "code": attr.code,
            "description": attr.description,
            "short_name": attr.short_name
        }
        for attr in attributes
    ]
    
    logger.info(f"✅ Returning {len(response)} document types")
    return response

@router.get("/document-types", response_model=List[dict])
async def get_document_types_simple(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get simplified document types for dropdown"""
    from sqlalchemy import select
    from app.models.general.dynamic_attribute import Attribute, AttributeGroup
    
    result = await db.execute(
        select(AttributeGroup).where(AttributeGroup.code == "DOCUMENT_TYPE")
    )
    group = result.scalar_one_or_none()
    
    if not group:
        # Return default document types
        return [
            {"id": "1", "name": "Agenda", "code": "AGENDA"},
            {"id": "2", "name": "Minutes", "code": "MINUTES"},
            {"id": "3", "name": "Presentation", "code": "PRESENTATION"},
            {"id": "4", "name": "Report", "code": "REPORT"},
            {"id": "5", "name": "Other", "code": "OTHER"},
        ]
    
    result = await db.execute(
        select(Attribute)
        .where(Attribute.group_id == group.id)
        .where(Attribute.is_active == True)
        .order_by(Attribute.sort_order)
    )
    attributes = result.scalars().all()
    
    return [
        {
            "id": str(attr.id),
            "name": attr.name,
            "code": attr.code,
        }
        for attr in attributes
    ]