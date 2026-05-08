# app/api/v1/endpoints/action_tracker/documents.py

import os
import io
import re
import asyncio
import logging
import html
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import hashlib

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api import deps
from app.crud.meetings.action_tracker import meeting_crud, meeting_document
from app.models.general.dynamic_attribute import Attribute, AttributeGroup
from app.models.user import User
from app.models.meetings.action_tracker import MeetingDocument
from app.schemas.action_tracker import MeetingDocumentResponse, MeetingDocumentCreate

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

# Cache for document type lookups
_document_type_cache = {}
_cache_ttl = 300  # 5 minutes


# ============ HTML/MARKUP HELPER FUNCTIONS ============

def normalize_html_content(html_content: str) -> str:
    """Normalize HTML content for consistent display."""
    if not html_content:
        return ""
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove empty paragraphs
        for p in soup.find_all('p'):
            if not p.get_text(strip=True):
                p.decompose()
        
        # Fix numbered list formatting
        # Convert "1. Text" paragraphs that are followed by lists
        for p in soup.find_all('p'):
            text = p.get_text(strip=True)
            if re.match(r'^\d+\.\s*', text) and p.find_next_sibling(['ol', 'ul']):
                # Extract the text without the number
                clean_text = re.sub(r'^\d+\.\s*', '', text)
                p.string = clean_text
                p.name = 'strong'  # Make it bold instead of paragraph
        
        # Clean up list items
        for li in soup.find_all('li'):
            # Remove extra spaces and &nbsp;
            li_text = li.get_text()
            if not li_text.strip():
                li.decompose()
        
        # Ensure lists have proper structure
        for ol in soup.find_all('ol'):
            ol['style'] = 'list-style-type: decimal; margin-bottom: 0.5rem;'
        
        for ul in soup.find_all('ul'):
            ul['style'] = 'list-style-type: disc; margin-bottom: 0.5rem;'
        
        return str(soup)
    except Exception as e:
        logger.warning(f"Failed to normalize HTML: {e}")
        return html_content


def clean_html_content(html_content: str) -> str:
    """Clean and sanitize HTML content."""
    if not html_content:
        return ""
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove dangerous tags
        for tag in soup(["script", "style", "iframe", "object", "embed", "form", "input", "button"]):
            tag.decompose()
        
        # Remove event handlers
        for tag in soup.find_all(True):
            attrs_to_remove = [attr for attr in tag.attrs if attr.startswith('on')]
            for attr in attrs_to_remove:
                del tag[attr]
        
        # Get clean text
        text = soup.get_text(separator='\n')
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception as e:
        logger.warning(f"Failed to clean HTML: {e}")
        return html_content


def extract_text_from_html(html_content: str) -> str:
    """Extract plain text from HTML content while preserving structure."""
    if not html_content:
        return ""
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Handle specific elements with better formatting
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
        
        # Get text
        text = soup.get_text()
        
        # Clean up excessive newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = text.strip()
        
        return text
    except Exception as e:
        logger.warning(f"Failed to extract text from HTML: {e}")
        return html_content


def convert_markdown_to_html(markdown_text: str) -> str:
    """Convert markdown text to HTML (for frontend compatibility)."""
    if not markdown_text:
        return ""
    
    try:
        import markdown
        html = markdown.markdown(
            markdown_text,
            extensions=['extra', 'codehilite', 'tables', 'toc', 'nl2br']
        )
        return html
    except ImportError:
        # Simple markdown conversion fallback
        html = markdown_text
        # Headers
        html = re.sub(r'^### (.*?)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
        html = re.sub(r'^## (.*?)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
        html = re.sub(r'^# (.*?)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
        # Bold
        html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
        html = re.sub(r'__(.*?)__', r'<strong>\1</strong>', html)
        # Italic
        html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)
        html = re.sub(r'_(.*?)_', r'<em>\1</em>', html)
        # Links
        html = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2">\1</a>', html)
        # Lists
        html = re.sub(r'^[\*\-] (.*?)$', r'<li>\1</li>', html, flags=re.MULTILINE)
        html = re.sub(r'^(\d+)\. (.*?)$', r'<li>\2</li>', html, flags=re.MULTILINE)
        return html


def convert_html_to_markdown(html_content: str) -> str:
    """Convert HTML content to markdown for storage/display."""
    if not html_content:
        return ""
    
    try:
        import markdownify
        markdown = markdownify.markdownify(html_content, heading_style="ATX")
        return markdown
    except ImportError:
        return html_content


def sanitize_html_for_display(html_content: str) -> str:
    """Sanitize HTML for safe display in frontend."""
    if not html_content:
        return ""
    
    # Allow only safe tags and attributes
    allowed_tags = {
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'a', 'img', 'code', 'pre', 'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td'
    }
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove disallowed tags
        for tag in soup.find_all(True):
            if tag.name not in allowed_tags:
                tag.unwrap()
        
        # Clean attributes
        allowed_attrs = {'href', 'src', 'alt', 'title', 'class', 'style'}
        for tag in soup.find_all(True):
            attrs_to_remove = [attr for attr in tag.attrs if attr not in allowed_attrs]
            for attr in attrs_to_remove:
                del tag[attr]
        
        return str(soup)
    except Exception as e:
        logger.warning(f"Failed to sanitize HTML: {e}")
        return html_content


def extract_ocr_text_with_structure(ocr_text: str) -> Dict[str, Any]:
    """Extract structured information from OCR text."""
    if not ocr_text:
        return {"text": "", "structure": {}, "keywords": []}
    
    lines = ocr_text.split('\n')
    
    # Detect potential headings (all caps or numbered lines)
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
    
    # Extract keywords (common words with length > 5, excluding common stopwords)
    stopwords = {'the', 'and', 'for', 'are', 'with', 'this', 'that', 'from', 'have', 'will', 'was', 'were', 'been', 'has', 'had', 'not', 'but', 'can', 'may', 'all', 'any', 'some', 'such', 'than', 'then', 'there', 'these', 'they', 'those', 'through', 'under', 'until', 'upon', 'with', 'within', 'without'}
    
    words = re.findall(r'\b[A-Za-z]{5,}\b', ocr_text)
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
        logger.info(f"✅ Valid document type found: {document_type_attr.code} - {document_type_attr.name}")
    else:
        logger.warning(f"❌ Invalid document_type_id: {document_type_id}")
    
    return is_valid


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
    logger.info(f"   Content Format: {content_format}")
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
    
    # Process description if it contains HTML/markup
    processed_description = description
    if description:
        if content_format == "markdown":
            processed_description = convert_markdown_to_html(description)
        else:
            processed_description = sanitize_html_for_display(description)
            processed_description = normalize_html_content(processed_description)
    
    # Create document record
    document_in = MeetingDocumentCreate(
        file_name=file.filename,
        title=title,
        description=processed_description,
        document_type_id=document_type_id,
        file_size=None,
        mime_type=file.content_type,
        content_format=content_format
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
    
    # Sanitize and normalize HTML content for safe display
    for doc in documents:
        if doc.description:
            doc.description = sanitize_html_for_display(doc.description)
    
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
    logger.info(f"   Content Format: {content_format}")
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
    
    # Process description if it contains HTML/markup
    processed_description = description
    if description:
        if content_format == "markdown":
            processed_description = convert_markdown_to_html(description)
        else:
            processed_description = sanitize_html_for_display(description)
            processed_description = normalize_html_content(processed_description)
    
    # Call CRUD method with all parameters
    result = await meeting_document.upload_document(
        db=db,
        meeting_id=meeting_id,
        file=file,
        title=title,
        description=processed_description,
        document_type_id=document_type_id,
        user_id=current_user.id,
        content_format=content_format
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
    format: str = "original",
):
    """Download the actual file content or converted format."""
    
    logger.info(f"📥 DOWNLOAD REQUEST: document_id={document_id}, format={format}")
    
    document = await meeting_document.get(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    # Handle text-based download for OCR content or description
    if format in ['html', 'markdown', 'text']:
        content = document.ocr_text or document.description or ""
        filename = f"{document.file_name.rsplit('.', 1)[0]}.{format}"
        
        if format == 'html':
            # Create a complete HTML document
            content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{html.escape(document.title)}</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }}
        h1, h2, h3 {{ color: #333; }}
        ul, ol {{ margin-bottom: 1rem; }}
        li {{ margin-bottom: 0.25rem; }}
        pre {{ background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }}
        code {{ background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }}
    </style>
</head>
<body>
    <h1>{html.escape(document.title)}</h1>
    <hr>
    {html.escape(content) if not document.ocr_html else document.ocr_html}
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
    
    # Original file download
    if not document.file_path or not os.path.exists(document.file_path):
        logger.error(f"File not found on server: {document.file_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"File not found on server: {document.file_name}"
        )
    
    # Determine the correct media type
    media_type = document.mime_type or "application/octet-stream"
    
    if document.file_name:
        ext = document.file_name.lower()
        if ext.endswith('.pdf'):
            media_type = "application/pdf"
        elif ext.endswith('.jpg') or ext.endswith('.jpeg'):
            media_type = "image/jpeg"
        elif ext.endswith('.png'):
            media_type = "image/png"
    
    logger.info(f"Returning file: {document.file_name}, type={media_type}")
    
    return FileResponse(
        path=document.file_path,
        filename=document.file_name,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{document.file_name.replace(' ', '_')}",
            "Cache-Control": "private, max-age=3600",
        }
    )


# ============ DOCUMENT CONTENT ENDPOINTS ============

@router.get("/document/{document_id}/content")
async def get_document_content(
    document_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    format: str = "html",
):
    """Get document content in specified format (for display in frontend)."""
    
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


# ============ DOCUMENT TYPES ENDPOINTS ============

@router.get("/attribute-groups/DOCUMENT_TYPE/attributes")
async def get_document_type_attributes(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all document type attributes (matches frontend expectation)."""
    
    logger.info("📄 FETCHING DOCUMENT TYPES")
    
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
            "description": attr.description,
            "short_name": attr.short_name,
            "sort_order": attr.sort_order
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
        return [
            {"id": "agenda", "name": "Agenda", "code": "AGENDA"},
            {"id": "minutes", "name": "Minutes", "code": "MINUTES"},
            {"id": "presentation", "name": "Presentation", "code": "PRESENTATION"},
            {"id": "report", "name": "Report", "code": "REPORT"},
            {"id": "attachment", "name": "Attachment", "code": "ATTACHMENT"},
            {"id": "other", "name": "Other", "code": "OTHER"},
        ]
    
    result = await db.execute(
        select(Attribute)
        .where(Attribute.group_id == group.id)
        .where(Attribute.is_active == True)
        .order_by(Attribute.sort_order)
    )
    attributes = result.scalars().all()
    
    return [
        {"id": str(attr.id), "name": attr.name, "code": attr.code}
        for attr in attributes
    ]


# ============ OCR ENHANCED ENDPOINTS ============

@router.post("/document/{document_id}/ocr")
async def process_document_ocr(
    document_id: UUID,
    language: str = "eng",
    extract_structure: bool = True,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Process OCR on a document to extract text with structure.
    Supports PDF and image files.
    """
    logger.info(f"🔍 OCR REQUEST for document: {document_id}, language: {language}")
    
    if not OCR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OCR is not available. Please install pytesseract and poppler-utils."
        )
    
    document = await meeting_document.get(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    if not document.file_path or not os.path.exists(document.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on server")
    
    supported_mimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/bmp']
    if document.mime_type not in supported_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OCR not supported for file type: {document.mime_type}"
        )
    
    try:
        extracted_text = ""
        pages_processed = 0
        structured_data = None
        
        if document.mime_type == 'application/pdf':
            images = await run_ocr_in_thread(convert_from_path, document.file_path)
            pages_processed = len(images)
            
            for i, image in enumerate(images):
                text = await run_ocr_in_thread(pytesseract.image_to_string, image, lang=language)
                extracted_text += f"\n\n## Page {i+1}\n\n{text}\n"
        
        elif document.mime_type and document.mime_type.startswith('image/'):
            image = Image.open(document.file_path)
            extracted_text = await run_ocr_in_thread(pytesseract.image_to_string, image, lang=language)
            pages_processed = 1
        
        # Clean up extracted text
        extracted_text = re.sub(r'\n{3,}', '\n\n', extracted_text)
        extracted_text = extracted_text.strip()
        
        # Extract structured information if requested
        if extract_structure:
            structured_data = extract_ocr_text_with_structure(extracted_text)
        
        # Convert to HTML for better display (preserve structure)
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
        
        # Store both plain text and HTML version
        document.ocr_text = extracted_text
        document.ocr_html = html_text
        document.ocr_processed_at = datetime.now()
        document.ocr_language = language
        document.updated_at = datetime.now()
        document.updated_by_id = current_user.id
        
        # Store structured data if available
        if structured_data:
            document.ocr_metadata = structured_data
            document.ocr_word_count = structured_data.get("word_count", 0)
        
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
            response_data["headings"] = structured_data.get("headings", [])[:10]
            response_data["key_terms"] = structured_data.get("keywords", [])[:10]
            response_data["word_count"] = structured_data.get("word_count", 0)
        
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
        "processed_at": document.ocr_processed_at,
        "language": document.ocr_language,
        "format": format,
        "word_count": getattr(document, 'ocr_word_count', 0)
    }
    
    if format == "html":
        response["content"] = document.ocr_html or f"<div class='ocr-content'><pre>{html.escape(document.ocr_text or '')}</pre></div>"
    elif format == "structured":
        response["content"] = document.ocr_metadata or extract_ocr_text_with_structure(document.ocr_text or "")
    else:  # plain
        response["content"] = document.ocr_text
    
    return response