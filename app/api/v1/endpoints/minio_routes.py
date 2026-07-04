# api/minio_routes.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel
from config.minio_config import minio_config
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])

class FileUploadResponse(BaseModel):
    success: bool
    file_key: str
    url: str
    file_name: str
    file_size: int
    content_type: Optional[str]
    uploaded_at: str

class PresignedUploadResponse(BaseModel):
    success: bool
    url: str
    file_key: str
    expires_in: int

class DeleteFileResponse(BaseModel):
    success: bool
    file_key: str

class ListFilesResponse(BaseModel):
    success: bool
    files: List[dict]

@router.post("/upload/{meeting_id}")
async def upload_file(
    meeting_id: str,
    file: UploadFile = File(...),
    folder: str = Form("documents")
):
    """
    Upload a file to MinIO
    """
    try:
        # Read file content
        content = await file.read()
        
        # Create file-like object
        from io import BytesIO
        file_data = BytesIO(content)
        
        # Upload to MinIO
        result = minio_config.upload_file(
            file_data=file_data,
            meeting_id=meeting_id,
            file_name=file.filename,
            content_type=file.content_type,
            folder=folder
        )
        
        return JSONResponse(content=result, status_code=201)
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-multiple/{meeting_id}")
async def upload_multiple_files(
    meeting_id: str,
    files: List[UploadFile] = File(...),
    folder: str = Form("documents")
):
    """
    Upload multiple files to MinIO
    """
    results = []
    errors = []
    
    for file in files:
        try:
            content = await file.read()
            from io import BytesIO
            file_data = BytesIO(content)
            
            result = minio_config.upload_file(
                file_data=file_data,
                meeting_id=meeting_id,
                file_name=file.filename,
                content_type=file.content_type,
                folder=folder
            )
            results.append(result)
        except Exception as e:
            errors.append({
                'file': file.filename,
                'error': str(e)
            })
    
    return JSONResponse(content={
        'success': len(errors) == 0,
        'uploaded': results,
        'failed': errors,
        'total': len(files)
    })

@router.get("/presigned-upload-url/{meeting_id}")
async def get_presigned_upload_url(
    meeting_id: str,
    file_name: str,
    folder: str = "documents",
    expires: int = 3600
):
    """
    Get a presigned URL for direct upload from browser
    """
    try:
        result = minio_config.get_presigned_upload_url(
            meeting_id=meeting_id,
            file_name=file_name,
            expires=expires,
            folder=folder
        )
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Error generating presigned upload URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/file/{file_key:path}")
async def get_file_url(
    file_key: str,
    expires: int = 3600
):
    """
    Get a presigned URL for file access
    """
    try:
        url = minio_config.get_presigned_url(file_key, expires)
        return JSONResponse(content={
            'success': True,
            'url': url,
            'file_key': file_key,
            'expires_in': expires
        })
    except Exception as e:
        logger.error(f"Error getting file URL: {e}")
        raise HTTPException(status_code=404, detail="File not found")

@router.delete("/file/{file_key:path}")
async def delete_file(file_key: str):
    """
    Delete a file from MinIO
    """
    try:
        result = minio_config.delete_file(file_key)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list/{meeting_id}")
async def list_files(
    meeting_id: str,
    folder: str = "documents"
):
    """
    List all files for a meeting
    """
    try:
        result = minio_config.list_files(meeting_id, folder)
        
        # Add presigned URLs to each file
        for file in result['files']:
            try:
                file['url'] = minio_config.get_presigned_url(file['key'])
            except:
                file['url'] = None
        
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"List files error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/info/{file_key:path}")
async def get_file_info(file_key: str):
    """
    Get file metadata
    """
    try:
        result = minio_config.get_file_info(file_key)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Get file info error: {e}")
        raise HTTPException(status_code=404, detail="File not found")