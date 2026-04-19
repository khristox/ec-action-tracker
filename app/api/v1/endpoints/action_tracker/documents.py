# app/api/v1/endpoints/action_tracker/documents.py

import os
import io
import asyncio
import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api import deps
from app.crud.action_tracker import meeting, meeting_document
from app.models.general.dynamic_attribute import Attribute, AttributeGroup
from app.models.user import User
from app.models.action_tracker import MeetingDocument
from app.schemas.action_tracker import MeetingDocumentResponse, MeetingDocumentCreate

# Image processing - Using PIL only (no tkinter)
from PIL import Image

# OCR imports with graceful fallback
try:
    import pytesseract
    from pdf2image import convert_from_path
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    pytesseract = None
    convert_from_path = None

logger = logging.getLogger(__name__)

router = APIRouter()

# Thread pool for CPU-intensive OCR operations
_executor = ThreadPoolExecutor(max_workers=2)


async def validate_document_type_id(db: AsyncSession, document_type_id: UUID) -> bool:
    """Validate that the document_type_id exists in the DOCUMENT_TYPE attribute group."""
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


async def run_ocr_in_thread(func, *args, **kwargs):
    """Run OCR operations in a thread pool to avoid blocking the event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, lambda: func(*args, **kwargs))


# ============ MAIN ENDPOINTS ============

@router.post("/{meeting_id}/documents", response_model=MeetingDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    meeting_id: UUID,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    document_type_id: UUID = Form(...), 
    file: UploadFile = File(...),
    ocr_enabled: bool = Form(False),
    ocr_language: str = Form("eng"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Upload a document to a meeting with optional OCR processing."""
    
    logger.info("=" * 60)
    logger.info(f"📄 UPLOAD_DOCUMENT: {file.filename}")
    logger.info(f"   Meeting ID: {meeting_id}")
    logger.info(f"   Title: {title}")
    logger.info(f"   Document Type ID: {document_type_id}")
    logger.info(f"   OCR Enabled: {ocr_enabled}")
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
            detail=f"Invalid document_type_id: {document_type_id}"
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
    
    # Save file and create database record
    result = await meeting_document.upload_document(
        db=db,
        meeting_id=meeting_id,
        document_in=document_in,
        file=file,
        user_id=current_user.id
    )
    
    logger.info(f"✅ Document uploaded: {result.id}")
    
    return result


@router.get("/{meeting_id}/documents", response_model=List[MeetingDocumentResponse])
async def get_meeting_documents(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all documents for a meeting."""
    documents = await meeting_document.get_meeting_documents(db, meeting_id)
    return documents


# ============ MEETINGS PREFIX ENDPOINTS ============

@router.get("/meetings/{meeting_id}/documents", response_model=List[MeetingDocumentResponse])
async def get_meeting_documents_alt(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all documents for a meeting (alternative endpoint for frontend)."""
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
    """Upload a document to a meeting (alternative endpoint for frontend)."""
    
    logger.info("=" * 60)
    logger.info(f"📄 UPLOAD_DOCUMENT_ALT: {file.filename}")
    logger.info(f"   Meeting ID: {meeting_id}")
    logger.info(f"   Title: {title}")
    logger.info(f"   Document Type ID: {document_type_id}")
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
            detail=f"Invalid document_type_id: {document_type_id}"
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
    
    logger.info(f"✅ Document uploaded: {result.id}, Type ID: {result.document_type_id}")
    
    return result


# ============ SINGLE DOCUMENT ENDPOINTS ============

@router.get("/document/{document_id}", response_model=MeetingDocumentResponse)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get a single document by ID."""
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
    """Delete a document (soft delete)."""
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
    """Download the actual file content."""
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
    """Get all document type attributes (matches frontend expectation)."""
    
    logger.info("📄 FETCHING DOCUMENT TYPES")
    
    # Find the DOCUMENT_TYPE group
    result = await db.execute(
        select(AttributeGroup).where(AttributeGroup.code == "DOCUMENT_TYPE")
    )
    group = result.scalar_one_or_none()
    
    if not group:
        logger.warning("DOCUMENT_TYPE attribute group not found")
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
    
    # Return as array directly
    return [
        {
            "id": str(attr.id),
            "name": attr.name,
            "code": attr.code,
            "description": attr.description,
            "short_name": attr.short_name
        }
        for attr in attributes
    ]


@router.get("/document-types", response_model=List[dict])
async def get_document_types_simple(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get simplified document types for dropdown."""
    
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


# ============ OCR ENDPOINTS ============

@router.post("/document/{document_id}/ocr")
async def process_document_ocr(
    document_id: UUID,
    language: str = "eng",
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Process OCR on a document to extract text.
    Supports PDF and image files (JPEG, PNG, TIFF, BMP).
    """
    logger.info(f"🔍 OCR REQUEST for document: {document_id}, language: {language}")
    
    # Check if OCR is available
    if not OCR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OCR is not available. Please install pytesseract and poppler-utils."
        )
    
    # Get the document
    document = await meeting_document.get(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    # Check if file exists
    if not document.file_path or not os.path.exists(document.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on server")
    
    # Check if file type is supported for OCR
    supported_mimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/bmp']
    if document.mime_type not in supported_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OCR not supported for file type: {document.mime_type}"
        )
    
    try:
        extracted_text = ""
        pages_processed = 0
        
        # Process PDF files
        if document.mime_type == 'application/pdf':
            # Convert PDF to images
            images = await run_ocr_in_thread(convert_from_path, document.file_path)
            pages_processed = len(images)
            
            # Process each page with OCR
            for i, image in enumerate(images):
                text = await run_ocr_in_thread(pytesseract.image_to_string, image, lang=language)
                extracted_text += f"\n--- Page {i+1} ---\n{text}\n"
        
        # Process image files
        elif document.mime_type and document.mime_type.startswith('image/'):
            image = Image.open(document.file_path)
            extracted_text = await run_ocr_in_thread(pytesseract.image_to_string, image, lang=language)
            pages_processed = 1
        
        # Update document with OCR text
        document.ocr_text = extracted_text
        document.ocr_processed_at = datetime.now()
        document.ocr_language = language
        document.updated_at = datetime.now()
        document.updated_by_id = current_user.id
        
        await db.commit()
        await db.refresh(document)
        
        logger.info(f"✅ OCR completed: {pages_processed} pages, {len(extracted_text)} chars")
        
        return {
            "success": True,
            "document_id": str(document_id),
            "text": extracted_text[:5000],  # Return first 5000 chars for preview
            "text_length": len(extracted_text),
            "pages": pages_processed,
            "language": language
        }
        
    except Exception as e:
        logger.error(f"OCR processing failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}"
        )


@router.get("/document/{document_id}/ocr-text")
async def get_document_ocr_text(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get the OCR extracted text for a document."""
    document = await meeting_document.get(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    return {
        "document_id": str(document_id),
        "has_ocr": bool(document.ocr_text),
        "text": document.ocr_text,
        "processed_at": document.ocr_processed_at,
        "language": document.ocr_language
    }