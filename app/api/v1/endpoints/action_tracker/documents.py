# app/api/v1/endpoints/action_tracker/documents.py

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
import logging

from app.api import deps
from app.crud.action_tracker import meeting, meeting_document
from app.models.general.dynamic_attribute import Attribute
from app.models.user import User
from app.schemas.action_tracker import MeetingDocumentResponse, MeetingDocumentCreate

logger = logging.getLogger(__name__)

router = APIRouter()

async def validate_document_type_id(db: AsyncSession, document_type_id: UUID) -> bool:
    """
    Validate that the document_type_id exists in the DOCUMENT_TYPE attribute group.
    
    This checks if the provided UUID corresponds to a valid attribute 
    within the DOCUMENT_TYPE group (e.g., DOC_TYPE_AGENDA, DOC_TYPE_ATTACHMENT, etc.)
    """
    from sqlalchemy import select
    from app.models.general.dynamic_attribute import Attribute
    
    # Query to find attributes in the DOCUMENT_TYPE group with the given ID
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
    
    logger.warning(f"❌ Invalid document_type_id: {document_type_id} - Not found in DOCUMENT_TYPE group")
    return False


async def get_document_type_by_id(db: AsyncSession, document_type_id: UUID) -> Optional[dict]:
    """
    Get document type details by ID.
    Returns a dict with code, name, and extra_metadata.
    """
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
        return {
            "id": document_type_attr.id,
            "code": document_type_attr.code,
            "name": document_type_attr.name,
            "short_name": document_type_attr.short_name,
            "extra_metadata": document_type_attr.extra_metadata
        }
    
    return None


async def get_all_document_types(db: AsyncSession, include_inactive: bool = False) -> List[dict]:
    """
    Get all available document types from the DOCUMENT_TYPE group.
    """
    from sqlalchemy import select
    from app.models.general.dynamic_attribute import Attribute
    
    query = select(Attribute).where(
        Attribute.group.has(code="DOCUMENT_TYPE")
    )
    
    if not include_inactive:
        query = query.where(Attribute.is_active == True)
    
    query = query.order_by(Attribute.sort_order)
    
    result = await db.execute(query)
    attributes = result.scalars().all()
    
    return [
        {
            "id": attr.id,
            "code": attr.code,
            "name": attr.name,
            "short_name": attr.short_name,
            "description": attr.description,
            "sort_order": attr.sort_order,
            "extra_metadata": attr.extra_metadata,
            "is_active": attr.is_active
        }
        for attr in attributes
    ]


async def get_document_type_by_code(db: AsyncSession, code: str) -> Optional[dict]:
    """
    Get document type by its code (e.g., 'DOC_TYPE_ATTACHMENT').
    """
    from sqlalchemy import select
    from app.models.general.dynamic_attribute import Attribute
    
    result = await db.execute(
        select(Attribute).where(
            Attribute.code == code,
            Attribute.group.has(code="DOCUMENT_TYPE"),
            Attribute.is_active == True
        )
    )
    
    document_type_attr = result.scalar_one_or_none()
    
    if document_type_attr:
        return {
            "id": document_type_attr.id,
            "code": document_type_attr.code,
            "name": document_type_attr.name,
            "extra_metadata": document_type_attr.extra_metadata
        }
    
    return None

@router.post("/documents/{meeting_id}/documents", response_model=MeetingDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    meeting_id: UUID,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    document_type_id: UUID = Form(...),  # Changed from document_type to document_type_id (UUID)
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
        document_type_id=document_type_id,  # Now using UUID directly
        file_size=None,  # Will be set in CRUD
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


@router.get("/documents/{meeting_id}/documents", response_model=List[MeetingDocumentResponse])
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
    """Get a single document by ID"""
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


# Optional: Helper endpoint to get available document types
@router.get("/document-types", response_model=List[dict])
async def get_document_types(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get available document types for the dropdown"""
    from sqlalchemy import select
    
    result = await db.execute(
        select(Attribute).where(
            Attribute.code == "DOCUMENT_TYPE",
            Attribute.is_active == True
        )
    )
    document_type_attr = result.scalar_one_or_none()
    
    if not document_type_attr:
        return []
    
    # Return the options for the frontend dropdown
    options = []
    if document_type_attr.options:
        for option in document_type_attr.options:
            options.append({
                "id": document_type_attr.id,  # Or option.get('id') if available
                "value": option.get('value'),
                "label": option.get('label'),
                "icon": option.get('icon'),
                "sort_order": option.get('sort_order')
            })
    
    # Sort by sort_order
    options.sort(key=lambda x: x.get('sort_order', 999))
    
    return options