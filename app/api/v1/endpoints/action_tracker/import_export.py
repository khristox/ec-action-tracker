# app/api/v1/endpoints/action_tracker/import_export.py

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
import csv
import io

from app.api import deps
from app.models.user import User
from app.crud.action_tracker_import import participant_import
from app.services.csv_parser import CSVParserService
from app.schemas.action_tracker_import import (
    BulkImportPreviewResponse,
    BulkImportResult,
    BulkImportRequest
)

router = APIRouter()


@router.get("/import/template")
async def download_import_template():
    """Download CSV template for bulk import"""
    template_content = CSVParserService.generate_template_csv()
    
    return StreamingResponse(
        iter([template_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=participant_import_template.csv"
        }
    )


@router.post("/import/preview", response_model=BulkImportPreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Preview CSV import without saving"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported"
        )
    
    content = await file.read()
    csv_content = content.decode('utf-8')
    
    result = await participant_import.preview_import(db, csv_content)
    return result


@router.post("/import/execute", response_model=BulkImportResult)
async def execute_import(
    file: UploadFile = File(...),
    skip_duplicates: bool = Form(True),
    add_to_list_id: Optional[UUID] = Form(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Execute bulk import of participants"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported"
        )
    
    content = await file.read()
    csv_content = content.decode('utf-8')
    
    result = await participant_import.execute_import(
        db,
        csv_content,
        current_user.id,
        skip_duplicates,
        add_to_list_id
    )
    
    return result


@router.post("/import/from-text", response_model=BulkImportResult)
async def execute_import_from_text(
    request: BulkImportRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Execute bulk import from CSV text content"""
    result = await participant_import.execute_import(
        db,
        request.file_content,
        current_user.id,
        request.skip_duplicates,
        request.add_to_list_id
    )
    
    return result