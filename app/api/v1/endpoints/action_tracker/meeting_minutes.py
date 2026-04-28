# routes/meeting_minutes.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import shutil

from app.api import deps
from app.models.action_tracker import MeetingMinutes
from app.services.document_parser import MinutesParser

router = APIRouter()


@router.post("/extract")
async def extract_minutes(file: UploadFile = File(...)):
    """Extract structured data from uploaded minutes document"""
    parser = MinutesParser()
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.split('.')[-1]}") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    
    try:
        # Extract text based on file type
        if file.filename.endswith('.docx'):
            text = parser.extract_text_from_docx(tmp_path)
        elif file.filename.endswith('.pdf'):
            text = parser.extract_text_from_pdf(tmp_path)
        else:
            raise HTTPException(400, "Only PDF or DOCX files allowed")
        
        # Parse with LLM
        extracted_data = parser.parse_with_llm(text)
        
        return JSONResponse({
            "success": True,
            "data": extracted_data,
            "original_text_preview": text[:500] + "..."
        })
    
    finally:
        # Cleanup
        import os
        os.unlink(tmp_path)

@router.post("/confirm")
async def confirm_minutes(data: dict):
    """Save confirmed minutes to database"""
    # Save to your database
    minutes = MeetingMinutes(
        meeting_info=data['meeting_info'],
        attendees=data['attendees'],
        agenda=data['agenda'],
        minutes=data['minutes'],
        resolutions=data['resolutions'],
        signatories=data['signatories'],
        created_by=deps.get_current_user()
    )
    deps.db.add(minutes)
    deps.db.commit()
    
    return {"success": True, "minutes_id": minutes.id}