# app/api/v1/endpoints/action_tracker/documents.py

import os
import io
import re
import asyncio
import logging
import html
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import hashlib

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.api import deps
from app.crud.meetings.action_tracker import meeting_crud, meeting_document
from app.core.minio_client import minio_service
from app.models.general.dynamic_attribute import Attribute, AttributeGroup
from app.models.user import User
from app.models.meetings.action_tracker import MeetingDocument, Meeting
from app.schemas.action_tracker import MeetingDocumentResponse, MeetingDocumentCreate

# Import BeautifulSoup for HTML processing
try:
    from bs4 import BeautifulSoup
    BEAUTIFULSOUP_AVAILABLE = True
except ImportError:
    BEAUTIFULSOUP_AVAILABLE = False
    BeautifulSoup = None
    logging.warning("BeautifulSoup not available. HTML processing will be limited.")

# OCR imports with graceful fallback
try:
    import pytesseract
    from pdf2image import convert_from_bytes
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    pytesseract = None
    convert_from_bytes = None
    logging.warning("OCR libraries not available. OCR functionality will be disabled.")

logger = logging.getLogger(__name__)

router = APIRouter()

# Thread pool for CPU-intensive operations
_executor = ThreadPoolExecutor(max_workers=4)

# Cache for document type lookups
_document_type_cache = {}
_cache_ttl = 300  # 5 minutes


# ============ HTML/MARKUP HELPER FUNCTIONS ============

def normalize_html_content(html_content: str) -> str:
    """Normalize HTML content for consistent display."""
    if not html_content:
        return ""
    
    if not BEAUTIFULSOUP_AVAILABLE:
        return html_content
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove empty paragraphs
        for p in soup.find_all('p'):
            if not p.get_text(strip=True):
                p.decompose()
        
        # Fix numbered list formatting
        for p in soup.find_all('p'):
            text = p.get_text(strip=True)
            if re.match(r'^\d+\.\s*', text) and p.find_next_sibling(['ol', 'ul']):
                clean_text = re.sub(r'^\d+\.\s*', '', text)
                p.string = clean_text
                p.name = 'strong'
        
        # Clean up list items
        for li in soup.find_all('li'):
            li_text = li.get_text()
            if not li_text.strip():
                li.decompose()
        
        # Add styles to lists
        for ol in soup.find_all('ol'):
            ol['style'] = 'list-style-type: decimal; margin-bottom: 0.5rem; padding-left: 1.5rem;'
        
        for ul in soup.find_all('ul'):
            ul['style'] = 'list-style-type: disc; margin-bottom: 0.5rem; padding-left: 1.5rem;'
        
        return str(soup)
    except Exception as e:
        logger.warning(f"Failed to normalize HTML: {e}")
        return html_content


def sanitize_html_for_display(html_content: str) -> str:
    """Sanitize HTML for safe display in frontend."""
    if not html_content:
        return ""
    
    if not BEAUTIFULSOUP_AVAILABLE:
        return html_content
    
    # Allow only safe tags and attributes
    allowed_tags = {
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'a', 'img', 'code', 'pre', 'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'span', 'div', 'section', 'article', 'header', 'footer',
        'hr', 'sub', 'sup', 'small', 'mark', 'del', 'ins'
    }
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove disallowed tags
        for tag in soup.find_all(True):
            if tag.name not in allowed_tags:
                tag.unwrap()
        
        # Clean attributes - allow only safe ones
        allowed_attrs = {'href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel'}
        for tag in soup.find_all(True):
            attrs_to_remove = [attr for attr in tag.attrs if attr not in allowed_attrs]
            for attr in attrs_to_remove:
                del tag[attr]
            
            # Sanitize href URLs (prevent javascript:)
            if tag.name == 'a' and tag.get('href'):
                href = tag['href']
                if href.startswith('javascript:') or href.startswith('data:'):
                    del tag['href']
        
        return str(soup)
    except Exception as e:
        logger.warning(f"Failed to sanitize HTML: {e}")
        return html_content


def clean_html_content(html_content: str) -> str:
    """Clean HTML and extract plain text."""
    if not html_content:
        return ""
    
    if not BEAUTIFULSOUP_AVAILABLE:
        return html_content
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        text = soup.get_text(separator='\n')
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception as e:
        logger.warning(f"Failed to clean HTML: {e}")
        return html_content


def convert_html_to_markdown(html_content: str) -> str:
    """Convert HTML to markdown format."""
    if not html_content:
        return ""
    
    try:
        import markdownify
        return markdownify.markdownify(html_content, heading_style="ATX")
    except ImportError:
        # Simple fallback conversion
        text = clean_html_content(html_content)
        return text


def extract_text_from_html(html_content: str) -> str:
    """Extract plain text from HTML while preserving basic structure."""
    if not html_content:
        return ""
    
    if not BEAUTIFULSOUP_AVAILABLE:
        return html_content
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Add formatting for specific elements
        for tag in soup.find_all(['p', 'div', 'section']):
            if tag.string:
                tag.insert_before('\n')
                tag.insert_after('\n')
        
        for tag in soup.find_all(['li']):
            tag.insert_before('• ')
            tag.insert_after('\n')
        
        for tag in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            level = int(tag.name[1])
            prefix = '\n' + '#' * level + ' '
            tag.insert_before(prefix)
            tag.insert_after('\n')
        
        text = soup.get_text()
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()
    except Exception as e:
        logger.warning(f"Failed to extract text from HTML: {e}")
        return html_content


def extract_ocr_text_with_structure(ocr_text: str) -> Dict[str, Any]:
    """Extract structured information from OCR text."""
    if not ocr_text:
        return {"text": "", "structure": {}, "keywords": []}
    
    lines = ocr_text.split('\n')
    
    # Detect potential headings
    headings = []
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if line_stripped:
            if line_stripped.isupper() and len(line_stripped) > 5:
                headings.append({"line": i, "text": line_stripped, "type": "all_caps"})
            elif re.match(r'^\d+\.', line_stripped):
                headings.append({"line": i, "text": line_stripped, "type": "numbered"})
            elif len(line_stripped) < 100 and line_stripped.endswith(':'):
                headings.append({"line": i, "text": line_stripped, "type": "label"})
    
    # Extract dates
    dates = re.findall(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', ocr_text)
    dates.extend(re.findall(r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}', ocr_text, re.IGNORECASE))
    
    # Extract emails
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', ocr_text)
    
    # Extract phone numbers
    phones = re.findall(r'\+?[\d\s-]{10,}', ocr_text)
    
    # Extract URLs
    urls = re.findall(r'https?://[^\s]+', ocr_text)
    
    # Extract keywords
    stopwords = {'the', 'and', 'for', 'are', 'with', 'this', 'that', 'from', 'have', 'will', 
                 'was', 'were', 'been', 'has', 'had', 'not', 'but', 'can', 'may', 'all', 'any',
                 'some', 'such', 'than', 'then', 'there', 'these', 'they', 'those', 'through',
                 'under', 'until', 'upon', 'within', 'without', 'about', 'after', 'before',
                 'during', 'between', 'among', 'amongst', 'throughout'}
    
    words = re.findall(r'\b[A-Za-z]{4,}\b', ocr_text)
    keywords = [w for w in set(words) if w.lower() not in stopwords]
    keywords = sorted(keywords, key=lambda x: len(x), reverse=True)[:20]
    
    return {
        "text": ocr_text,
        "headings": headings[:10],
        "dates": list(set(dates))[:10],
        "emails": list(set(emails))[:10],
        "phones": list(set(phones))[:10],
        "urls": list(set(urls))[:10],
        "keywords": keywords,
        "word_count": len(words),
        "line_count": len(lines)
    }


def generate_content_hash(content: str) -> str:
    """Generate a hash of content for caching."""
    if not content:
        return ""
    return hashlib.md5(content.encode('utf-8')).hexdigest()


# ============ VALIDATION FUNCTIONS ============

async def validate_document_type_id(db: AsyncSession, document_type_id: UUID) -> bool:
    """Validate that the document_type_id exists in the DOCUMENT_TYPE attribute group."""
    # Check cache first
    cache_key = str(document_type_id)
    if cache_key in _document_type_cache:
        cache_time, result = _document_type_cache[cache_key]
        if (datetime.now() - cache_time).total_seconds() < _cache_ttl:
            return result
    
    try:
        result = await db.execute(
            select(Attribute).where(
                Attribute.id == document_type_id,
                Attribute.group.has(code="DOCUMENT_TYPE"),
                Attribute.is_active == True
            )
        )
        document_type_attr = result.scalar_one_or_none()
        is_valid = document_type_attr is not None
        
        # Cache result
        _document_type_cache[cache_key] = (datetime.now(), is_valid)
        
        if is_valid:
            logger.info(f"✅ Valid document type: {document_type_attr.code} - {document_type_attr.name}")
        else:
            logger.warning(f"❌ Invalid document_type_id: {document_type_id}")
        
        return is_valid
    except Exception as e:
        logger.error(f"Error validating document type: {e}")
        return False


async def run_in_thread(func, *args, **kwargs):
    """Run a function in a thread pool to avoid blocking the event loop."""
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
    content_format: str = Form("html"),
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
    meeting_obj = await meeting_crud.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Validate document type ID
    is_valid = await validate_document_type_id(db, document_type_id)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document_type_id: {document_type_id}"
        )
    
    # Process description
    #
    # NOTE: we deliberately do NOT call `await file.read()` here anymore.
    # CRUDMeetingDocument.upload_document() takes the raw `UploadFile` and
    # reads it itself (`await file.read()` inside the CRUD method). If we
    # read the stream here first, the CRUD method's own read would come back
    # empty — UploadFile's underlying stream doesn't auto-rewind — and every
    # uploaded file would be saved as 0 bytes even if the TypeError below
    # were fixed some other way. So: read the file exactly once, and let the
    # CRUD layer own that responsibility since that's where the file actually
    # gets written to disk.
    processed_description = description
    if description:
        if content_format == "markdown":
            processed_description = convert_html_to_markdown(description)
        else:
            processed_description = sanitize_html_for_display(description)
            processed_description = normalize_html_content(processed_description)
    
    # Call CRUD method with the parameters it actually accepts.
    # CRUDMeetingDocument.upload_document(db, meeting_id, file, title,
    # description, document_type_id, user_id) — it wants the raw UploadFile,
    # not pre-extracted file_content/file_name/mime_type/file_size kwargs.
    #
    # NOTE: the CRUD method currently has no ocr_enabled/ocr_language
    # parameters, so OCR-on-upload is not actually wired up yet even though
    # the form accepts those fields — OCR only runs when triggered separately
    # via POST /document/{document_id}/ocr. That's a separate follow-up if
    # OCR-during-upload is meant to work; flagging it here so it isn't
    # mistaken for "fixed" by this change.
    result = await meeting_document.upload_document(
        db=db,
        meeting_id=meeting_id,
        file=file,
        title=title,
        description=processed_description,
        document_type_id=document_type_id,
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
    
    # Sanitize and normalize HTML content for safe display
    for doc in documents:
        if doc.description:
            doc.description = sanitize_html_for_display(doc.description)
            doc.description = normalize_html_content(doc.description)
    
    return documents


@router.get("/document-types", response_model=List[dict])
async def get_document_types_simple(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get simplified document types for dropdown."""
    
    try:
        # First try to get from Attribute group
        result = await db.execute(
            select(AttributeGroup).where(AttributeGroup.code == "DOCUMENT_TYPE")
        )
        group = result.scalar_one_or_none()
        
        if group:
            result = await db.execute(
                select(Attribute)
                .where(Attribute.group_id == group.id)
                .where(Attribute.is_active == True)
                .order_by(Attribute.sort_order)
            )
            attributes = result.scalars().all()
            
            if attributes:
                return [
                    {
                        "id": str(attr.id),
                        "name": attr.name,
                        "code": attr.code or attr.name.upper().replace(" ", "_"),
                        "description": getattr(attr, 'description', None)
                    }
                    for attr in attributes
                ]
        
        # Fallback to default types
        logger.warning("No document types found in database, using defaults")
        return [
            {"id": "00000000-0000-0000-0000-000000000001", "name": "Agenda", "code": "AGENDA"},
            {"id": "00000000-0000-0000-0000-000000000002", "name": "Minutes", "code": "MINUTES"},
            {"id": "00000000-0000-0000-0000-000000000003", "name": "Presentation", "code": "PRESENTATION"},
            {"id": "00000000-0000-0000-0000-000000000004", "name": "Report", "code": "REPORT"},
            {"id": "00000000-0000-0000-0000-000000000005", "name": "Attachment", "code": "ATTACHMENT"},
            {"id": "00000000-0000-0000-0000-000000000006", "name": "Meeting Notes", "code": "NOTES"},
            {"id": "00000000-0000-0000-0000-000000000007", "name": "Action Items", "code": "ACTIONS"},
            {"id": "00000000-0000-0000-0000-000000000008", "name": "Supporting Document", "code": "SUPPORTING"},
            {"id": "00000000-0000-0000-0000-000000000009", "name": "Other", "code": "OTHER"},
        ]
        
    except Exception as e:
        logger.error(f"Error fetching document types: {e}")
        return [
            {"id": "00000000-0000-0000-0000-000000000001", "name": "Agenda", "code": "AGENDA"},
            {"id": "00000000-0000-0000-0000-000000000002", "name": "Minutes", "code": "MINUTES"},
            {"id": "00000000-0000-0000-0000-000000000003", "name": "Presentation", "code": "PRESENTATION"},
            {"id": "00000000-0000-0000-0000-000000000004", "name": "Report", "code": "REPORT"},
            {"id": "00000000-0000-0000-0000-000000000005", "name": "Attachment", "code": "ATTACHMENT"},
        ]


@router.get("/attribute-groups/DOCUMENT_TYPE/attributes", response_model=List[dict])
async def get_document_type_attributes(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all document type attributes (matches frontend expectation)."""
    
    logger.info("📄 FETCHING DOCUMENT TYPES FROM ATTRIBUTE GROUP")
    
    try:
        result = await db.execute(
            select(AttributeGroup).where(AttributeGroup.code == "DOCUMENT_TYPE")
        )
        group = result.scalar_one_or_none()
        
        if not group:
            logger.warning("DOCUMENT_TYPE attribute group not found")
            return []
        
        result = await db.execute(
            select(Attribute)
            .where(Attribute.group_id == group.id)
            .where(Attribute.is_active == True)
            .order_by(Attribute.sort_order)
        )
        attributes = result.scalars().all()
        
        logger.info(f"Found {len(attributes)} document types")
        
        return [
            {
                "id": str(attr.id),
                "name": attr.name,
                "code": attr.code,
                "description": getattr(attr, 'description', None),
                "short_name": getattr(attr, 'short_name', None),
                "sort_order": getattr(attr, 'sort_order', 0),
                "color": getattr(attr, 'extra_metadata', {}).get('color', '#6B7280') if attr.extra_metadata else '#6B7280',
                "icon": getattr(attr, 'extra_metadata', {}).get('icon', 'description') if attr.extra_metadata else 'description'
            }
            for attr in attributes
        ]
    except Exception as e:
        logger.error(f"Error fetching document type attributes: {e}")
        return []


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
    
    # Sanitize and normalize HTML content
    if result.description:
        result.description = sanitize_html_for_display(result.description)
        result.description = normalize_html_content(result.description)
    
    return result


@router.delete("/document/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete a document (hard delete, including its object in MinIO)."""
    document = await meeting_document.get(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # NOTE: object-storage cleanup now happens inside
    # CRUDMeetingDocument.delete() itself (it calls minio_service.delete_object
    # internally when soft_delete=False) — this endpoint used to duplicate
    # that logic with a local `os.remove(document.file_path)` call, which
    # would silently do nothing once file_path became a MinIO object key
    # instead of a filesystem path.
    #
    # Also fixed a latent bug: this endpoint was calling
    # `meeting_document.remove(db, id=..., user=..., soft_delete=False)`,
    # but CRUDMeetingDocument has no `remove` method — only
    # `delete(db, id, user_id, soft_delete)`. That mismatch would have
    # raised the same class of TypeError we chased down for uploads, the
    # first time anyone actually deleted a document through this endpoint.
    await meeting_document.delete(db, id=document_id, user_id=current_user.id, soft_delete=False)

    return None


@router.get("/document/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    format: str = "original",
):
    """Download the actual file content or converted format."""
    
    logger.info(f"📥 DOWNLOAD REQUEST: document_id={document_id}, format={format}")
    
    document = await meeting_document.get(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    # Handle text-based download
    if format in ['html', 'markdown', 'text', 'txt']:
        content = document.ocr_text or document.description or ""
        filename = f"{document.file_name.rsplit('.', 1)[0] if document.file_name else 'document'}.{format.replace('txt', 'text')}"
        
        if format == 'html':
            content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{html.escape(document.title or 'Document')}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
               line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; 
               background: #fafafa; color: #333; }}
        .container {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        h1, h2, h3 {{ color: #1a202c; }}
        ul, ol {{ margin-bottom: 1rem; }}
        li {{ margin-bottom: 0.25rem; }}
        pre {{ background: #f7fafc; padding: 12px; border-radius: 6px; overflow-x: auto; border: 1px solid #e2e8f0; }}
        code {{ background: #f7fafc; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }}
        blockquote {{ border-left: 4px solid #4299e1; padding-left: 16px; margin-left: 0; color: #4a5568; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }}
        th {{ background: #f7fafc; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{html.escape(document.title or 'Document')}</h1>
        <p><small>Uploaded: {document.uploaded_at.strftime('%Y-%m-%d %H:%M') if document.uploaded_at else 'N/A'}</small></p>
        <hr>
        {content if document.ocr_html else html.escape(content)}
    </div>
</body>
</html>"""
            media_type = "text/html"
        elif format == 'markdown':
            content = convert_html_to_markdown(content)
            media_type = "text/markdown"
        else:
            content = clean_html_content(content)
            media_type = "text/plain"
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
        )
    
    # Original file download — served via a short-lived presigned MinIO URL
    # instead of streaming bytes through this server. `document.file_path`
    # holds the MinIO object key (see CRUDMeetingDocument.upload_document),
    # not a filesystem path anymore.
    if not document.file_path or not minio_service.object_exists(document.file_path):
        logger.error(f"Object not found in MinIO: {document.file_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found in storage: {document.file_name}"
        )

    presigned_url = minio_service.get_presigned_download_url(
        object_name=document.file_path,
        filename=document.file_name,
    )

    # 307 preserves the original method (GET) and is followed transparently
    # by both plain navigation and XHR/fetch-based blob requests (i.e. the
    # frontend's `api.get(..., { responseType: 'blob' })` preview/download
    # calls don't need to change).
    #
    # IMPORTANT: because this redirects to a different origin (MinIO's own
    # host:port), the *final* response needs CORS headers allowing your
    # frontend's origin, or the browser will block the blob-fetch with a
    # CORS error even though the redirect itself succeeded. This has to be
    # configured on the MinIO server/bucket — no backend code change here
    # can satisfy it. See the note in app/core/minio_client.py.
    return RedirectResponse(url=presigned_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.post("/document/{document_id}/ocr")
async def process_document_ocr(
    document_id: UUID,
    language: str = "eng",
    extract_structure: bool = True,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Process OCR on a document to extract text with structure."""
    logger.info(f"🔍 OCR REQUEST for document: {document_id}, language: {language}")
    
    if not OCR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OCR is not available. Please install pytesseract and poppler-utils."
        )
    
    document = await meeting_document.get(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    if not document.file_path or not minio_service.object_exists(document.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in storage")
    
    supported_mimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/bmp']
    if document.mime_type not in supported_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OCR not supported for file type: {document.mime_type}"
        )
    
    try:
        # Pull the object into memory from MinIO once. Both pdf2image
        # (via convert_from_bytes) and PIL (via BytesIO) work directly off
        # bytes, so there's no need to write anything to local disk anymore.
        file_bytes = await run_in_thread(minio_service.download_bytes, document.file_path)
        
        extracted_text = ""
        pages_processed = 0
        structured_data = None
        
        if document.mime_type == 'application/pdf':
            images = await run_in_thread(convert_from_bytes, file_bytes)
            pages_processed = len(images)
            
            for i, image in enumerate(images):
                text = await run_in_thread(pytesseract.image_to_string, image, lang=language)
                extracted_text += f"\n\n## Page {i+1}\n\n{text}\n"
        
        elif document.mime_type and document.mime_type.startswith('image/'):
            from PIL import Image
            image = Image.open(io.BytesIO(file_bytes))
            extracted_text = await run_in_thread(pytesseract.image_to_string, image, lang=language)
            pages_processed = 1
        
        # Clean up extracted text
        extracted_text = re.sub(r'\n{3,}', '\n\n', extracted_text)
        extracted_text = extracted_text.strip()
        
        # Extract structured information if requested
        if extract_structure:
            structured_data = extract_ocr_text_with_structure(extracted_text)
        
        # Convert to HTML for better display
        html_lines = []
        for line in extracted_text.split('\n'):
            if line.strip():
                if line.startswith('## '):
                    html_lines.append(f"<h2>{html.escape(line[3:].strip())}</h2>")
                elif line.startswith('# '):
                    html_lines.append(f"<h1>{html.escape(line[2:].strip())}</h1>")
                elif line.strip().isupper() and len(line.strip()) > 10:
                    html_lines.append(f"<h3>{html.escape(line.strip())}</h3>")
                elif re.match(r'^\d+\.', line.strip()):
                    html_lines.append(f"<li>{html.escape(line.strip())}</li>")
                else:
                    html_lines.append(f"<p>{html.escape(line)}</p>")
        
        html_text = "<div class='ocr-content'>" + ''.join(html_lines) + "</div>"
        
        # Update document with OCR results
        document.ocr_text = extracted_text
        document.ocr_html = html_text
        document.ocr_processed_at = datetime.now()
        document.ocr_language = language
        document.updated_at = datetime.now()
        document.updated_by_id = current_user.id
        
        if structured_data:
            document.ocr_metadata = structured_data
        
        await db.commit()
        await db.refresh(document)
        
        response_data = {
            "success": True,
            "document_id": str(document_id),
            "pages": pages_processed,
            "language": language,
            "text_length": len(extracted_text),
            "text_preview": extracted_text[:500],
            "html_content": html_text[:5000],
            "has_structure": structured_data is not None
        }
        
        if structured_data:
            response_data.update({
                "headings": structured_data.get("headings", [])[:10],
                "key_terms": structured_data.get("keywords", [])[:10],
                "word_count": structured_data.get("word_count", 0),
                "dates_found": structured_data.get("dates", [])[:5],
                "emails_found": structured_data.get("emails", [])[:5]
            })
        
        logger.info(f"✅ OCR completed: {pages_processed} pages, {len(extracted_text)} chars")
        return response_data
        
    except Exception as e:
        logger.error(f"OCR processing failed: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}"
        )


@router.get("/document/{document_id}/ocr-text")
async def get_document_ocr_text(
    document_id: UUID,
    format: str = "html",
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get the OCR extracted text for a document in various formats."""
    document = await meeting_document.get(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    response = {
        "document_id": str(document_id),
        "has_ocr": bool(document.ocr_text),
        "processed_at": document.ocr_processed_at.isoformat() if document.ocr_processed_at else None,
        "language": document.ocr_language,
        "format": format,
        "word_count": getattr(document, 'ocr_metadata', {}).get('word_count', 0) if document.ocr_metadata else 0
    }
    
    if format == "html":
        response["content"] = document.ocr_html or f"<div class='ocr-content'><pre>{html.escape(document.ocr_text or '')}</pre></div>"
    elif format == "structured":
        response["content"] = document.ocr_metadata or extract_ocr_text_with_structure(document.ocr_text or "")
        response["content_type"] = "structured"
    else:  # plain/text
        response["content"] = document.ocr_text
    
    return response


# ============ MEETINGS PREFIX ENDPOINTS (for compatibility) ============

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
    
    # Sanitize HTML content
    for doc in documents:
        if doc.description:
            doc.description = sanitize_html_for_display(doc.description)
            doc.description = normalize_html_content(doc.description)
    
    return documents


@router.post("/meetings/{meeting_id}/documents", response_model=MeetingDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document_alt(
    meeting_id: UUID,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    document_type_id: UUID = Form(...),
    file: UploadFile = File(...),
    content_format: str = Form("html"),
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
    meeting_obj = await meeting_crud.get(db, meeting_id)
    if not meeting_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    # Validate document type ID
    is_valid = await validate_document_type_id(db, document_type_id)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document_type_id: {document_type_id}"
        )
    
    # Process description
    # (See the comment in upload_document() above: we do NOT pre-read the
    # file here — the CRUD method owns reading/saving it via the raw
    # UploadFile it's given below.)
    processed_description = description
    if description:
        if content_format == "markdown":
            processed_description = convert_html_to_markdown(description)
        else:
            processed_description = sanitize_html_for_display(description)
            processed_description = normalize_html_content(processed_description)
    
    # Call CRUD method with the parameters it actually accepts (raw
    # UploadFile — see fix note in upload_document() above).
    result = await meeting_document.upload_document(
        db=db,
        meeting_id=meeting_id,
        file=file,
        title=title,
        description=processed_description,
        document_type_id=document_type_id,
        user_id=current_user.id
    )
    
    logger.info(f"✅ Document uploaded: {result.id}")
    
    return result


# ============ DOCUMENT CONTENT ENDPOINTS ============

@router.get("/document/{document_id}/content")
async def get_document_content(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    format: str = "html",
):
    """Get document content in specified format."""
    
    document = await meeting_document.get(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    content = {
        "document_id": str(document_id),
        "title": document.title,
        "file_name": document.file_name,
        "has_ocr": bool(document.ocr_text),
        "has_description": bool(document.description),
        "content": "",
        "format": format,
        "content_hash": generate_content_hash(document.ocr_text or document.description or "")
    }
    
    if document.ocr_text:
        if format == "html":
            content["content"] = document.ocr_html or f"<div class='ocr-content'><pre>{html.escape(document.ocr_text)}</pre></div>"
        elif format == "markdown":
            content["content"] = document.ocr_text
        else:
            content["content"] = clean_html_content(document.ocr_text)
    elif document.description:
        if format == "html":
            content["content"] = document.description
        elif format == "markdown":
            content["content"] = convert_html_to_markdown(document.description)
        else:
            content["content"] = clean_html_content(document.description)
    
    return content


@router.get("/types", response_model=List[dict])
async def get_document_types_direct(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get document types directly (simplified endpoint)."""
    return await get_document_types_simple(db, current_user)