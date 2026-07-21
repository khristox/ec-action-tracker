# app/api/v1/endpoints/action_tracker/recordings.py

import os
import io
import uuid
import asyncio
import mimetypes
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from fastapi import (
    APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query,
    BackgroundTasks, Request, Response
)
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_
import aiofiles

from minio import Minio
from minio.error import S3Error
import urllib3

from app.api import deps
from app.models.user import User
from app.models.meetings.action_tracker import Meeting
from app.models.meetings.meeting_recording import MeetingRecording, RecordingType, RecordingStatus

router = APIRouter()

# ==================== Constants ====================
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
CHUNK_SIZE = 5 * 1024 * 1024  # 5MB chunks
STREAM_CHUNK_SIZE = 64 * 1024  # 64KB read size when streaming from MinIO

# Local staging directory used only while chunks are being assembled.
# The final file always ends up in MinIO, never persisted locally.
# Defaults to the system temp dir (always writable, even in restricted
# containers); override with CHUNK_STAGING_DIR if you want it elsewhere.
CHUNK_DIR = Path(os.getenv("CHUNK_STAGING_DIR", str(Path(tempfile.gettempdir()) / "recordings_chunks")))

ALLOWED_MIME_TYPES = {
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg', 'audio/wav'
}
ALLOWED_EXTENSIONS = {'.mp4', '.webm', '.mov', '.avi', '.mp3', '.ogg', '.wav', '.m4a'}

# Ensure local staging directory exists. This must never crash the app on
# import - if it's not writable, chunked upload will fail loudly and
# clearly at request time instead, while everything else keeps working.
try:
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
except OSError as e:
    print(f"Warning: could not create chunk staging directory {CHUNK_DIR}: {e}")

# ==================== MinIO Configuration ====================
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"
MINIO_BUCKET = os.getenv("MINIO_RECORDINGS_BUCKET", "meeting-recordings")
MINIO_OBJECT_PREFIX = os.getenv("MINIO_RECORDINGS_PREFIX", "recordings")

minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=MINIO_SECURE,
)


def _ensure_bucket() -> None:
    """Create the recordings bucket on startup if it doesn't already exist."""
    try:
        if not minio_client.bucket_exists(MINIO_BUCKET):
            minio_client.make_bucket(MINIO_BUCKET)
    except S3Error as e:
        # Don't crash import if MinIO isn't reachable yet; endpoints will
        # surface a clear error the first time they try to use storage.
        print(f"Warning: could not verify/create MinIO bucket '{MINIO_BUCKET}': {e}")


_ensure_bucket()

# ==================== Async Local File Helpers (chunk staging only) ====================

async def save_file_async(file_path: Path, content: bytes) -> None:
    """Save file asynchronously (used only for temporary chunk staging)"""
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)


async def read_file_chunk_async(file_path: Path, start: int, length: int) -> bytes:
    """Read a specific chunk from a locally staged file"""
    async with aiofiles.open(file_path, 'rb') as f:
        await f.seek(start)
        return await f.read(length)

# ==================== Chunked Upload Manager ====================

class ChunkedUploadManager:
    """Manager for handling chunked uploads with session tracking.

    Chunks are staged on local disk temporarily (since they arrive out of
    order over multiple requests); once all chunks are received the file is
    assembled in memory/on disk and uploaded to MinIO as a single object.
    """

    def __init__(self, chunk_dir: Path):
        self.chunk_dir = chunk_dir
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def get_session_dir(self, session_id: str) -> Path:
        """Get directory for a specific upload session"""
        session_dir = self.chunk_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        return session_dir

    async def save_chunk(
        self,
        session_id: str,
        chunk_number: int,
        chunk_data: bytes,
        total_chunks: int,
        file_name: str
    ) -> Dict[str, Any]:
        """Save a chunk and track progress"""

        # Initialize session if new
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                'total_chunks': total_chunks,
                'received_chunks': set(),
                'file_name': file_name,
                'created_at': datetime.utcnow(),
                'last_updated': datetime.utcnow()
            }

        session = self.sessions[session_id]
        session['last_updated'] = datetime.utcnow()

        # Save chunk to local staging disk
        chunk_path = self.get_session_dir(session_id) / f"chunk_{chunk_number:06d}"
        await save_file_async(chunk_path, chunk_data)

        session['received_chunks'].add(chunk_number)

        # Check if all chunks received
        if len(session['received_chunks']) == total_chunks:
            return {'complete': True, 'session_id': session_id}

        return {
            'complete': False,
            'session_id': session_id,
            'received': len(session['received_chunks']),
            'total': total_chunks,
            'progress': (len(session['received_chunks']) / total_chunks) * 100
        }

    async def assemble_file(self, session_id: str) -> tuple[bytes, str]:
        """Assemble locally staged chunks into a complete in-memory file"""

        if session_id not in self.sessions:
            raise ValueError("Upload session not found")

        session = self.sessions[session_id]
        session_dir = self.get_session_dir(session_id)

        # Read and combine all chunks in order
        chunks_data = []
        for i in range(session['total_chunks']):
            chunk_path = session_dir / f"chunk_{i:06d}"
            async with aiofiles.open(chunk_path, 'rb') as f:
                chunks_data.append(await f.read())

        # Combine chunks
        file_data = b''.join(chunks_data)
        file_name = session['file_name']

        # Clean up local staging files (final data lives in MinIO after upload)
        await self.cleanup_session(session_id)

        return file_data, file_name

    async def cleanup_session(self, session_id: str):
        """Remove local staging directory and clean up"""

        session_dir = self.chunk_dir / session_id
        if session_dir.exists():
            # Remove all chunk files
            for chunk_file in session_dir.glob("chunk_*"):
                try:
                    chunk_file.unlink()
                except Exception:
                    pass
            # Remove session directory
            try:
                session_dir.rmdir()
            except Exception:
                pass

        # Remove from sessions dict
        if session_id in self.sessions:
            del self.sessions[session_id]

    async def cleanup_expired_sessions(self, max_age_seconds: int = 3600):
        """Clean up expired upload sessions"""

        now = datetime.utcnow()
        expired_sessions = [
            sid for sid, session in self.sessions.items()
            if (now - session['last_updated']).total_seconds() > max_age_seconds
        ]

        for sid in expired_sessions:
            await self.cleanup_session(sid)


upload_manager = ChunkedUploadManager(CHUNK_DIR)


class RecordingService:
    """Service for managing recording files in MinIO object storage"""

    @staticmethod
    def build_object_key(meeting_id: str, file_name: str) -> str:
        """Build the MinIO object key for a recording"""
        return f"{MINIO_OBJECT_PREFIX}/{meeting_id}/{file_name}"

    @staticmethod
    async def save_to_storage(
        content: bytes,
        meeting_id: str,
        file_name: str,
        content_type: str = "application/octet-stream"
    ) -> str:
        """Upload recording bytes to MinIO. Returns the object key (stored as file_path)."""

        object_key = RecordingService.build_object_key(meeting_id, file_name)

        def _put():
            minio_client.put_object(
                MINIO_BUCKET,
                object_key,
                io.BytesIO(content),
                length=len(content),
                content_type=content_type or "application/octet-stream",
            )

        try:
            await asyncio.to_thread(_put)
        except S3Error as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to store recording in object storage: {e}"
            )

        return object_key

    @staticmethod
    async def delete_from_storage(object_key: str) -> bool:
        """Delete recording object from MinIO"""
        try:
            await asyncio.to_thread(minio_client.remove_object, MINIO_BUCKET, object_key)
            return True
        except S3Error as e:
            print(f"Error deleting object {object_key}: {e}")
            return False

    @staticmethod
    async def object_exists(object_key: str) -> bool:
        """Check whether an object exists in MinIO"""

        def _stat():
            try:
                minio_client.stat_object(MINIO_BUCKET, object_key)
                return True
            except S3Error:
                return False

        return await asyncio.to_thread(_stat)

    @staticmethod
    async def get_object_size(object_key: str) -> int:
        """Get the size in bytes of a MinIO object"""

        def _stat():
            stat = minio_client.stat_object(MINIO_BUCKET, object_key)
            return stat.size

        try:
            return await asyncio.to_thread(_stat)
        except S3Error as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recording file not found in object storage: {e}"
            )

    @staticmethod
    async def read_range(object_key: str, start: int = 0, length: Optional[int] = None) -> bytes:
        """Read a byte range from a MinIO object (used for HTTP range/seek requests)"""

        def _get():
            response = None
            try:
                if length is not None:
                    response = minio_client.get_object(
                        MINIO_BUCKET, object_key, offset=start, length=length
                    )
                else:
                    response = minio_client.get_object(
                        MINIO_BUCKET, object_key, offset=start
                    )
                return response.read()
            finally:
                if response is not None:
                    response.close()
                    response.release_conn()

        try:
            return await asyncio.to_thread(_get)
        except S3Error as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recording file not found in object storage: {e}"
            )

    @staticmethod
    async def stream_object(object_key: str):
        """Async generator that yields chunks of a MinIO object for StreamingResponse"""

        def _open():
            return minio_client.get_object(MINIO_BUCKET, object_key)

        try:
            response = await asyncio.to_thread(_open)
        except S3Error as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recording file not found in object storage: {e}"
            )

        try:
            while True:
                chunk = await asyncio.to_thread(response.read, STREAM_CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
        finally:
            await asyncio.to_thread(response.close)
            await asyncio.to_thread(response.release_conn)


# ==================== Helper Functions ====================

async def parse_meeting_id(meeting_id: str) -> str:
    """Parse meeting ID from various formats"""
    try:
        clean_id = meeting_id.replace('-', '')
        if len(clean_id) == 32:
            return str(uuid.UUID(clean_id))
        else:
            return str(uuid.UUID(meeting_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid meeting ID format: {meeting_id}"
        )


async def validate_meeting(db: AsyncSession, meeting_id: str) -> Meeting:
    """Validate meeting exists and return it"""

    meeting_uuid = await parse_meeting_id(meeting_id)

    query = select(Meeting).where(
        Meeting.id == meeting_uuid,
        Meeting.is_active == True
    )
    result = await db.execute(query)
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting not found with ID: {meeting_id}"
        )

    return meeting


def get_secure_filename(original_filename: str) -> str:
    """Generate secure unique filename"""

    extension = Path(original_filename).suffix.lower()
    return f"{uuid.uuid4().hex}{extension}"


def get_object_key_for_recording(recording: MeetingRecording) -> str:
    """Resolve the MinIO object key for a recording, falling back to a
    deterministic key if file_path wasn't populated for some reason."""
    if recording.file_path:
        return recording.file_path
    return RecordingService.build_object_key(str(recording.meeting_id), recording.file_name)


# ==================== Recording Endpoints ====================

@router.post("/{meeting_id}/recordings/initiate")
async def initiate_upload(
    meeting_id: str,
    file_name: str = Query(..., description="Original file name"),
    file_size: int = Query(..., description="Total file size in bytes"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Initiate a resumable upload session for large files"""

    # Validate meeting
    await validate_meeting(db, meeting_id)

    # Validate file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.0f}MB"
        )

    # Check file extension
    ext = Path(file_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Generate session ID
    session_id = str(uuid.uuid4())
    total_chunks = (file_size + CHUNK_SIZE - 1) // CHUNK_SIZE

    return {
        "session_id": session_id,
        "chunk_size": CHUNK_SIZE,
        "total_chunks": total_chunks,
        "expires_in": 3600,
        "max_file_size": MAX_FILE_SIZE,
        "message": "Upload session initiated. Use the chunked upload endpoint to upload chunks."
    }


@router.post("/{meeting_id}/recordings/chunk")
async def upload_chunk(
    meeting_id: str,
    session_id: str = Form(...),
    chunk_number: int = Form(...),
    total_chunks: int = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Upload a chunk of a large file"""

    # Validate meeting (cache result)
    meeting = await validate_meeting(db, meeting_id)

    # Read chunk data
    chunk_data = await file.read()

    # Validate chunk size
    if len(chunk_data) > CHUNK_SIZE + 1024:  # Allow small overhead
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chunk size exceeds maximum of {CHUNK_SIZE} bytes"
        )

    # Save chunk (staged locally until fully assembled)
    result = await upload_manager.save_chunk(
        session_id=session_id,
        chunk_number=chunk_number,
        chunk_data=chunk_data,
        total_chunks=total_chunks,
        file_name=file.filename
    )

    if result['complete']:
        # Assemble file from local staging chunks
        file_data, original_name = await upload_manager.assemble_file(session_id)

        # Create filename
        unique_filename = get_secure_filename(original_name)
        file_size = len(file_data)

        # Detect recording type
        ext = Path(original_name).suffix.lower()
        recording_type = RecordingType.AUDIO if ext in ['.mp3', '.ogg', '.wav', '.m4a'] else RecordingType.VIDEO

        content_type = file.content_type or mimetypes.guess_type(original_name)[0] or "video/webm"

        # Upload assembled file to MinIO
        object_key = await RecordingService.save_to_storage(
            file_data, str(meeting.id), unique_filename, content_type
        )

        # Create database record
        recording_id = str(uuid.uuid4())
        recording = MeetingRecording(
            id=recording_id,
            meeting_id=meeting.id,
            title=original_name.rsplit('.', 1)[0],
            file_name=unique_filename,
            file_path=object_key,
            file_size=file_size,
            mime_type=content_type,
            recording_type=recording_type,
            status=RecordingStatus.COMPLETED,
            created_by_id=str(current_user.id),
            created_at=datetime.utcnow(),
            is_active=True
        )

        db.add(recording)
        await db.commit()
        await db.refresh(recording)

        return {
            "success": True,
            "recording_id": recording.id,
            "message": "File uploaded and assembled successfully"
        }

    return {
        "success": True,
        "chunk_complete": False,
        "received": result['received'],
        "total": result['total'],
        "progress": result['progress'],
        "message": f"Chunk {chunk_number + 1}/{total_chunks} uploaded"
    }


@router.post("/{meeting_id}/recordings", status_code=status.HTTP_201_CREATED)
async def upload_recording(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form("meeting"),
    duration: Optional[int] = Form(0),
    quality: Optional[str] = Form(None),
    recording_format: Optional[str] = Form(None, alias="format"),
    recording_mode: Optional[str] = Form("video", alias="mode"),
    time_limit: Optional[int] = Form(0),
    current_user: User = Depends(deps.get_current_user),  # still needs a session, but only briefly
):
    """Upload a recording for a specific meeting (non-chunked)"""

    # ---- short session: just validate the meeting exists ----
    async with AsyncSessionLocal() as db:
        meeting = await validate_meeting(db, meeting_id)
        meeting_id_val = meeting.id  # capture what we need; don't keep `meeting` bound to this session

    # ---- no DB session held from here through the upload ----
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.0f}MB. "
                   f"Consider using chunked upload for large files."
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    unique_filename = get_secure_filename(file.filename)
    recording_type = RecordingType.AUDIO if recording_mode == "audio" else RecordingType.VIDEO
    content_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "video/webm"

    object_key = await RecordingService.save_to_storage(
        content, str(meeting_id_val), unique_filename, content_type
    )

    # ---- short session: just the insert ----
    recording_id = str(uuid.uuid4())
    async with AsyncSessionLocal() as db:
        recording = MeetingRecording(
            id=recording_id,
            meeting_id=meeting_id_val,
            title=title or file.filename.rsplit('.', 1)[0],
            description=description,
            category=category,
            recording_type=recording_type,
            file_name=unique_filename,
            file_path=object_key,
            file_size=file_size,
            mime_type=content_type,
            duration=duration,
            quality=quality,
            format=recording_format,
            time_limit=time_limit if time_limit > 0 else None,
            status=RecordingStatus.COMPLETED,
            created_by_id=str(current_user.id),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            is_active=True
        )
        db.add(recording)
        await db.commit()
        await db.refresh(recording)

    background_tasks.add_task(process_recording_async, recording.id, str(meeting_id_val))

    return {
        "success": True,
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
        "time_limit": recording.time_limit,
        "created_at": recording.created_at.isoformat(),
        "message": "Recording uploaded successfully"
    }

@router.get("/{meeting_id}/recordings")
async def get_meeting_recordings(
    meeting_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    recording_type: Optional[str] = Query(None, description="Filter by type: VIDEO/AUDIO"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search in title and description"),
    order_by: str = Query("created_at", description="Order by field"),
    order_desc: bool = Query(True, description="Descending order"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all recordings for a meeting with pagination, filtering, and search"""

    # Validate meeting
    meeting = await validate_meeting(db, meeting_id)

    # Build query
    query = select(MeetingRecording).where(
        MeetingRecording.meeting_id == meeting.id,
        MeetingRecording.is_active == True
    )

    # Apply filters
    if recording_type:
        if recording_type.upper() == "VIDEO":
            query = query.where(MeetingRecording.recording_type == RecordingType.VIDEO)
        elif recording_type.upper() == "AUDIO":
            query = query.where(MeetingRecording.recording_type == RecordingType.AUDIO)

    if status:
        try:
            status_enum = RecordingStatus(status.upper())
            query = query.where(MeetingRecording.status == status_enum)
        except ValueError:
            pass

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                MeetingRecording.title.ilike(search_term),
                MeetingRecording.description.ilike(search_term)
            )
        )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply ordering
    order_column = getattr(MeetingRecording, order_by, MeetingRecording.created_at)
    if order_desc:
        query = query.order_by(desc(order_column))
    else:
        query = query.order_by(order_column)

    # Apply pagination
    query = query.offset(skip).limit(limit)

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
            "time_limit": recording.time_limit,
            "created_at": recording.created_at.isoformat(),
            "created_by_id": recording.created_by_id,
            "download_url": f"/api/v1/meetings/{meeting_id}/recordings/{recording.id}/download",
            "stream_url": f"/api/v1/meetings/{meeting_id}/recordings/{recording.id}/stream"
        })

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 1,
        "has_next": skip + limit < total,
        "has_prev": skip > 0
    }


@router.get("/{meeting_id}/recordings/{recording_id}")
async def get_recording_details(
    meeting_id: str,
    recording_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get details of a specific recording"""

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
        "time_limit": recording.time_limit,
        "created_at": recording.created_at.isoformat(),
        "created_by": str(recording.created_by_id),
        "download_url": f"/api/v1/meetings/{meeting_id}/recordings/{recording_id}/download",
        "stream_url": f"/api/v1/meetings/{meeting_id}/recordings/{recording_id}/stream"
    }


@router.get("/{meeting_id}/recordings/{recording_id}/stream")
async def stream_recording(
    meeting_id: str,
    recording_id: str,
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Stream recording from MinIO with range support for video seeking"""

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

    object_key = get_object_key_for_recording(recording)

    # Check if object exists in MinIO
    if not await RecordingService.object_exists(object_key):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording file not found"
        )

    # Increment view count
    recording.view_count += 1
    await db.commit()

    # Get object size
    file_size = await RecordingService.get_object_size(object_key)

    # Handle range requests for video seeking
    range_header = request.headers.get('range')

    if range_header:
        # Parse range header
        range_match = range_header.replace('bytes=', '').split('-')
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else file_size - 1

        if start >= file_size:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

        end = min(end, file_size - 1)
        length = end - start + 1

        # Read the requested byte range directly from MinIO
        content = await RecordingService.read_range(object_key, start=start, length=length)

        return Response(
            content=content,
            status_code=206,
            media_type=recording.mime_type or "video/webm",
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Cache-Control": "no-cache"
            }
        )

    # Full file stream from MinIO
    return StreamingResponse(
        RecordingService.stream_object(object_key),
        media_type=recording.mime_type or "video/webm",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
            "Content-Length": str(file_size),
            "Content-Disposition": f"inline; filename={recording.file_name}"
        }
    )


@router.get("/{meeting_id}/recordings/{recording_id}/download")
async def download_recording(
    meeting_id: str,
    recording_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Download a recording file from MinIO"""

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

    object_key = get_object_key_for_recording(recording)

    # Check if object exists in MinIO
    if not await RecordingService.object_exists(object_key):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording file not found"
        )

    # Increment download count
    recording.download_count += 1
    await db.commit()

    file_size = await RecordingService.get_object_size(object_key)

    # Stream file from MinIO for download
    return StreamingResponse(
        RecordingService.stream_object(object_key),
        media_type=recording.mime_type or "video/webm",
        headers={
            "Content-Length": str(file_size),
            "Content-Disposition": f"attachment; filename={recording.file_name}"
        }
    )


@router.delete("/{meeting_id}/recordings/{recording_id}")
async def delete_recording(
    meeting_id: str,
    recording_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Soft delete a recording"""

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
    is_admin = any(role.code in ["admin", "super_admin"] for role in current_user.roles)
    if str(recording.created_by_id) != str(current_user.id) and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this recording"
        )

    object_key = get_object_key_for_recording(recording)

    # Soft delete
    recording.is_active = False
    recording.status = RecordingStatus.DELETED
    recording.deleted_at = datetime.utcnow()
    recording.updated_by_id = str(current_user.id)

    await db.commit()

    # Optionally remove the underlying object from MinIO in the background
    # background_tasks.add_task(RecordingService.delete_from_storage, object_key)

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
    """Update recording metadata"""

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
    is_admin = any(role.code in ["admin", "super_admin"] for role in current_user.roles)
    if str(recording.created_by_id) != str(current_user.id) and not is_admin:
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
        "updated_at": recording.updated_at.isoformat(),
        "message": "Recording updated successfully"
    }


@router.get("/recordings/stats")
async def get_recordings_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get statistics about recordings (admin only)"""

    # Check admin access
    is_admin = any(role.code in ["admin", "super_admin"] for role in current_user.roles)
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    # Total recordings
    total_query = select(func.count()).select_from(MeetingRecording).where(
        MeetingRecording.is_active == True
    )
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0

    # Recordings by type
    video_query = select(func.count()).select_from(MeetingRecording).where(
        MeetingRecording.recording_type == RecordingType.VIDEO,
        MeetingRecording.is_active == True
    )
    video_result = await db.execute(video_query)
    video_count = video_result.scalar() or 0

    audio_query = select(func.count()).select_from(MeetingRecording).where(
        MeetingRecording.recording_type == RecordingType.AUDIO,
        MeetingRecording.is_active == True
    )
    audio_result = await db.execute(audio_query)
    audio_count = audio_result.scalar() or 0

    # Total storage used
    size_query = select(func.sum(MeetingRecording.file_size)).where(
        MeetingRecording.is_active == True
    )
    size_result = await db.execute(size_query)
    total_size = size_result.scalar() or 0

    return {
        "total_recordings": total,
        "video_recordings": video_count,
        "audio_recordings": audio_count,
        "total_storage_bytes": total_size,
        "total_storage_mb": round(total_size / 1024 / 1024, 2),
        "total_storage_gb": round(total_size / 1024 / 1024 / 1024, 2),
        "storage_backend": "minio",
        "minio_bucket": MINIO_BUCKET
    }


# ==================== Background Tasks ====================

async def process_recording_async(recording_id: str, meeting_id: str):
    """Background task to process recording after upload"""

    # This could include:
    # - Generate thumbnail/preview
    # - Transcode to different formats
    # - Generate transcription
    # - Optimize file size
    # - Calculate audio waveform data
    #
    # Note: any processing that needs the raw bytes should fetch them from
    # MinIO first, e.g.:
    #   content = await RecordingService.read_range(object_key)

    # Example: Log processing
    print(f"Processing recording {recording_id} for meeting {meeting_id}")

    # You can add more processing here
    # await generate_thumbnail(recording_id)
    # await transcode_audio(recording_id)
    # await generate_transcription(recording_id)