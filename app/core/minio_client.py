# app/core/minio_client.py
"""
MinIO client service for object storage.

Centralizes all interaction with MinIO: bucket creation, uploads, downloads,
presigned URLs, and deletes. Callers (CRUD layer, endpoints) should only ever
import `minio_service` from here — never instantiate `minio.Minio` directly
elsewhere. If the storage backend ever needs to change (different bucket
strategy, different provider), this is the only file that has to change.
"""

import io
import logging
import os
from datetime import timedelta
from typing import Optional

from minio import Minio
from minio.error import S3Error

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================
# Read from environment variables. Add these to your .env / deployment
# config:
#
#   MINIO_ENDPOINT=localhost:9000       # host:port, NO http:// prefix
#   MINIO_ACCESS_KEY=your-access-key
#   MINIO_SECRET_KEY=your-secret-key
#   MINIO_BUCKET_NAME=meeting-documents
#   MINIO_SECURE=false                  # true if MinIO is served over HTTPS
#
# This module reads os.environ directly rather than pulling from a central
# `app.core.config.Settings` object, since this project had no MinIO config
# before this change. If you have (or add) a central Settings class, feel
# free to source these values from there instead — just keep the names
# consistent so nothing else in this file needs to change.

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET_NAME = os.getenv("MINIO_BUCKET_NAME", "meeting-documents")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

# How long a presigned download URL stays valid before it expires.
PRESIGNED_URL_EXPIRY = timedelta(minutes=15)


class MinioService:
    """Thin wrapper around the MinIO SDK for this app's document storage needs."""

    def __init__(self):
        self._client: Optional[Minio] = None

    @property
    def client(self) -> Minio:
        # Lazy-init so importing this module never requires MinIO to be
        # reachable — the connection is only actually opened on first use.
        if self._client is None:
            self._client = Minio(
                MINIO_ENDPOINT,
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=MINIO_SECURE,
            )
        return self._client

    def ensure_bucket(self) -> None:
        """
        Create the configured bucket if it doesn't already exist.
        Call this once at application startup (see notes at the bottom of
        this file for a FastAPI startup-event snippet).
        """
        try:
            if not self.client.bucket_exists(MINIO_BUCKET_NAME):
                self.client.make_bucket(MINIO_BUCKET_NAME)
                logger.info(f"✅ Created MinIO bucket: {MINIO_BUCKET_NAME}")
            else:
                logger.info(f"MinIO bucket already exists: {MINIO_BUCKET_NAME}")
        except S3Error as e:
            logger.error(f"Failed to ensure MinIO bucket exists: {e}")
            raise

    def upload_bytes(
        self,
        object_name: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        """
        Upload raw bytes to the bucket under `object_name`.
        Returns `object_name` on success — this is what callers should store
        as the reference to the file (e.g. in a DB `file_path`/`storage_key`
        column).
        """
        try:
            data_stream = io.BytesIO(data)
            self.client.put_object(
                bucket_name=MINIO_BUCKET_NAME,
                object_name=object_name,
                data=data_stream,
                length=len(data),
                content_type=content_type or "application/octet-stream",
            )
            logger.info(f"✅ Uploaded to MinIO: {object_name} ({len(data)} bytes)")
            return object_name
        except S3Error as e:
            logger.error(f"Failed to upload {object_name} to MinIO: {e}")
            raise

    def download_bytes(self, object_name: str) -> bytes:
        """
        Download an object's full contents into memory.
        Used for server-side processing (e.g. OCR) where we need the actual
        bytes rather than a link the browser can fetch.
        """
        response = None
        try:
            response = self.client.get_object(MINIO_BUCKET_NAME, object_name)
            return response.read()
        except S3Error as e:
            logger.error(f"Failed to download {object_name} from MinIO: {e}")
            raise
        finally:
            # The MinIO SDK requires both close() and release_conn() to
            # avoid leaking the underlying connection back to the pool.
            if response is not None:
                response.close()
                response.release_conn()

    def object_exists(self, object_name: str) -> bool:
        """Check whether an object exists without downloading it."""
        try:
            self.client.stat_object(MINIO_BUCKET_NAME, object_name)
            return True
        except S3Error:
            return False

    def delete_object(self, object_name: str) -> None:
        """
        Delete an object. Safe to call even if it no longer exists — this
        deliberately swallows the error rather than raising, since delete is
        often called as cleanup (e.g. after a failed upload) where the
        object may or may not actually be there.
        """
        try:
            self.client.remove_object(MINIO_BUCKET_NAME, object_name)
            logger.info(f"🗑️ Deleted from MinIO: {object_name}")
        except S3Error as e:
            logger.warning(f"Could not delete {object_name} from MinIO: {e}")

    def get_presigned_download_url(
        self,
        object_name: str,
        filename: Optional[str] = None,
        expires: timedelta = PRESIGNED_URL_EXPIRY,
    ) -> str:
        """
        Generate a temporary, signed URL that lets the browser fetch the
        object directly from MinIO, without proxying bytes through this
        backend.

        `filename`, if given, is passed through as
        response-content-disposition so the browser saves/displays the file
        under its original name instead of the raw MinIO object key (which
        includes the meeting_id/uuid path prefix).
        """
        try:
            extra_query_params = None
            if filename:
                extra_query_params = {
                    "response-content-disposition": f'attachment; filename="{filename}"'
                }
            return self.client.presigned_get_object(
                MINIO_BUCKET_NAME,
                object_name,
                expires=expires,
                extra_query_params=extra_query_params,
            )
        except S3Error as e:
            logger.error(f"Failed to generate presigned URL for {object_name}: {e}")
            raise


# Module-level singleton. Import this everywhere:
#   from app.core.minio_client import minio_service
minio_service = MinioService()


# ============================================================================
# STARTUP NOTE
# ============================================================================
# Call minio_service.ensure_bucket() once when the app starts, so the bucket
# is guaranteed to exist before any upload is attempted. In your FastAPI app
# entrypoint (e.g. app/main.py), add:
#
#   from app.core.minio_client import minio_service
#
#   @app.on_event("startup")
#   async def startup_event():
#       minio_service.ensure_bucket()
#
# (Or, if you're on a newer FastAPI/Starlette version using lifespan context
# managers instead of on_event, call it inside that lifespan function.)