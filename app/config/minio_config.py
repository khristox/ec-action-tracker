# config/minio_config.py
import os
from minio import Minio
from minio.error import S3Error
from datetime import timedelta
import logging
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MinIOConfig:
    def __init__(self):
        self.endpoint = os.getenv('MINIO_ENDPOINT', 'localhost:9000')
        self.access_key = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
        self.secret_key = os.getenv('MINIO_SECRET_KEY', 'minioadmin')
        self.bucket_name = os.getenv('MINIO_BUCKET', 'meeting-documents')
        self.secure = os.getenv('MINIO_SECURE', 'False').lower() == 'true'
        self.region = os.getenv('MINIO_REGION', 'us-east-1')
        
        # Initialize MinIO client
        self.client = Minio(
            self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=self.secure
        )
        
        # Ensure bucket exists
        self._ensure_bucket()
    
    def _ensure_bucket(self):
        """Create bucket if it doesn't exist"""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                logger.info(f"Bucket '{self.bucket_name}' created successfully")
            else:
                logger.info(f"Bucket '{self.bucket_name}' already exists")
        except S3Error as e:
            logger.error(f"Error creating bucket: {e}")
            raise
    
    def generate_file_key(self, meeting_id, file_name, folder='documents'):
        """Generate a unique file key for storage"""
        import time
        timestamp = int(time.time() * 1000)
        # Sanitize file name
        sanitized_name = ''.join(c if c.isalnum() or c in '.-' else '_' for c in file_name)
        return f"{folder}/meeting-{meeting_id}/{timestamp}_{sanitized_name}"
    
    def upload_file(self, file_data, meeting_id, file_name, content_type=None, folder='documents'):
        """Upload a file to MinIO"""
        try:
            file_key = self.generate_file_key(meeting_id, file_name, folder)
            
            # If file_data is a file object, get its size
            if hasattr(file_data, 'seek'):
                file_data.seek(0, 2)
                file_size = file_data.tell()
                file_data.seek(0)
            else:
                file_size = len(file_data) if isinstance(file_data, bytes) else 0
            
            # Upload file
            self.client.put_object(
                self.bucket_name,
                file_key,
                file_data,
                file_size,
                content_type=content_type or 'application/octet-stream'
            )
            
            # Generate presigned URL for immediate access
            url = self.get_presigned_url(file_key)
            
            return {
                'success': True,
                'file_key': file_key,
                'url': url,
                'file_name': file_name,
                'file_size': file_size,
                'content_type': content_type,
                'uploaded_at': self.get_current_iso_time()
            }
        except S3Error as e:
            logger.error(f"Upload error: {e}")
            raise
    
    def get_presigned_url(self, file_key, expires=3600):
        """Generate a presigned URL for file access"""
        try:
            url = self.client.presigned_get_object(
                self.bucket_name,
                file_key,
                expires=timedelta(seconds=expires)
            )
            return url
        except S3Error as e:
            logger.error(f"Error generating presigned URL: {e}")
            raise
    
    def get_presigned_upload_url(self, meeting_id, file_name, expires=3600, folder='documents'):
        """Generate a presigned URL for direct upload"""
        try:
            file_key = self.generate_file_key(meeting_id, file_name, folder)
            url = self.client.presigned_put_object(
                self.bucket_name,
                file_key,
                expires=timedelta(seconds=expires)
            )
            return {
                'success': True,
                'url': url,
                'file_key': file_key,
                'expires_in': expires
            }
        except S3Error as e:
            logger.error(f"Error generating presigned upload URL: {e}")
            raise
    
    def delete_file(self, file_key):
        """Delete a file from MinIO"""
        try:
            self.client.remove_object(self.bucket_name, file_key)
            return {'success': True, 'file_key': file_key}
        except S3Error as e:
            logger.error(f"Delete error: {e}")
            raise
    
    def list_files(self, meeting_id, folder='documents'):
        """List all files for a meeting"""
        try:
            prefix = f"{folder}/meeting-{meeting_id}/"
            objects = self.client.list_objects(self.bucket_name, prefix=prefix, recursive=True)
            
            files = []
            for obj in objects:
                files.append({
                    'key': obj.object_name,
                    'size': obj.size,
                    'last_modified': obj.last_modified.isoformat(),
                    'name': obj.object_name.split('/')[-1],
                    'etag': obj.etag
                })
            
            return {'success': True, 'files': files}
        except S3Error as e:
            logger.error(f"List files error: {e}")
            raise
    
    def get_file_info(self, file_key):
        """Get file metadata"""
        try:
            stat = self.client.stat_object(self.bucket_name, file_key)
            return {
                'success': True,
                'size': stat.size,
                'etag': stat.etag,
                'last_modified': stat.last_modified.isoformat(),
                'content_type': stat.content_type
            }
        except S3Error as e:
            logger.error(f"Get file info error: {e}")
            raise
    
    def get_current_iso_time(self):
        """Get current time in ISO format"""
        from datetime import datetime
        return datetime.utcnow().isoformat()

# Singleton instance
minio_config = MinIOConfig()