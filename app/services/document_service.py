# services/document_service.py
from config.minio_config import minio_config
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class DocumentService:
    """Service layer for document operations"""
    
    @staticmethod
    def upload_document(file_data, meeting_id: str, file_name: str, 
                       content_type: Optional[str] = None, 
                       folder: str = 'documents') -> Dict[str, Any]:
        """Upload a single document"""
        try:
            return minio_config.upload_file(
                file_data=file_data,
                meeting_id=meeting_id,
                file_name=file_name,
                content_type=content_type,
                folder=folder
            )
        except Exception as e:
            logger.error(f"Document upload failed: {e}")
            raise
    
    @staticmethod
    def upload_multiple_documents(files: List[Dict], meeting_id: str, 
                                  folder: str = 'documents') -> Dict[str, Any]:
        """Upload multiple documents"""
        results = {'uploaded': [], 'failed': []}
        
        for file_data in files:
            try:
                result = DocumentService.upload_document(
                    file_data=file_data['data'],
                    meeting_id=meeting_id,
                    file_name=file_data['name'],
                    content_type=file_data.get('content_type'),
                    folder=folder
                )
                results['uploaded'].append(result)
            except Exception as e:
                results['failed'].append({
                    'file': file_data['name'],
                    'error': str(e)
                })
        
        results['success'] = len(results['failed']) == 0
        results['total'] = len(files)
        return results
    
    @staticmethod
    def get_document_url(file_key: str, expires: int = 3600) -> str:
        """Get presigned URL for document"""
        return minio_config.get_presigned_url(file_key, expires)
    
    @staticmethod
    def delete_document(file_key: str) -> Dict[str, Any]:
        """Delete a document"""
        return minio_config.delete_file(file_key)
    
    @staticmethod
    def list_documents(meeting_id: str, folder: str = 'documents') -> List[Dict[str, Any]]:
        """List all documents for a meeting with presigned URLs"""
        result = minio_config.list_files(meeting_id, folder)
        
        # Add presigned URLs
        for file in result['files']:
            try:
                file['url'] = minio_config.get_presigned_url(file['key'])
            except:
                file['url'] = None
        
        return result['files']
    
    @staticmethod
    def get_document_info(file_key: str) -> Dict[str, Any]:
        """Get document metadata"""
        return minio_config.get_file_info(file_key)
    
    @staticmethod
    def get_presigned_upload_url(meeting_id: str, file_name: str, 
                                 folder: str = 'documents', 
                                 expires: int = 3600) -> Dict[str, Any]:
        """Get presigned URL for direct upload"""
        return minio_config.get_presigned_upload_url(
            meeting_id=meeting_id,
            file_name=file_name,
            folder=folder,
            expires=expires
        )

# Singleton instance
document_service = DocumentService()