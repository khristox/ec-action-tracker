// src/components/actiontracker/meetings/MeetingDocuments.jsx
// Enhanced with preview functionality

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Avatar,
  LinearProgress,
  useTheme,
  alpha,
  Fade,
  Skeleton,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  useMediaQuery,
  Tab,
  Tabs
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  CloudUpload as CloudUploadIcon,
  Construction as ConstructionIcon,
  FolderOpen as FolderOpenIcon,
  AttachFile as AttachFileIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../../../services/api';

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', 
  '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', 
  '.png', '.gif', '.mp4', '.zip'
];

// Document type icons
const getDocumentIcon = (type, size = 'default') => {
  const typeLower = type?.toLowerCase() || '';
  const iconProps = size === 'large' ? { fontSize: 'large' } : {};
  
  if (typeLower.includes('pdf')) return <PdfIcon {...iconProps} />;
  if (typeLower.includes('image') || typeLower.includes('jpg') || typeLower.includes('jpeg') || 
      typeLower.includes('png') || typeLower.includes('gif') || typeLower.includes('bmp')) {
    return <ImageIcon {...iconProps} />;
  }
  return <FileIcon {...iconProps} />;
};

// Format file size
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = parseFloat((bytes / Math.pow(1024, i)).toFixed(2));
  return `${value} ${sizes[i]}`;
};

// Get file extension
const getFileExtension = (filename) => {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts[parts.length - 1]?.toLowerCase() || '';
};

// Color map for document types
const getTypeColor = (type, isDark) => {
  const typeLower = type?.toLowerCase() || '';
  const colors = {
    pdf: isDark ? '#F87171' : '#EF4444',
    doc: isDark ? '#60A5FA' : '#3B82F6',
    docx: isDark ? '#60A5FA' : '#3B82F6',
    xls: isDark ? '#34D399' : '#10B981',
    xlsx: isDark ? '#34D399' : '#10B981',
    ppt: isDark ? '#FBBF24' : '#F59E0B',
    pptx: isDark ? '#FBBF24' : '#F59E0B',
    image: isDark ? '#F472B6' : '#EC4899',
    jpg: isDark ? '#F472B6' : '#EC4899',
    jpeg: isDark ? '#F472B6' : '#EC4899',
    png: isDark ? '#F472B6' : '#EC4899',
    gif: isDark ? '#F472B6' : '#EC4899',
    txt: isDark ? '#9CA3AF' : '#6B7280',
    zip: isDark ? '#FCD34D' : '#F59E0B',
    mp4: isDark ? '#A78BFA' : '#8B5CF6',
  };
  return colors[typeLower] || (isDark ? '#9CA3AF' : '#6B7280');
};

// Preview Dialog Component
const PreviewDialog = ({ open, onClose, document, isDark }) => {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const [previewContent, setPreviewContent] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Get MIME type and determine preview type
  const getPreviewType = () => {
    if (!document?.mime_type) return null;
    
    const mime = document.mime_type.toLowerCase();
    
    if (mime.startsWith('image/')) return 'image';
    if (mime.includes('pdf')) return 'pdf';
    if (mime.startsWith('text/') || mime.includes('word') || mime.includes('document')) return 'text';
    
    return null;
  };

  const previewType = getPreviewType();

  // Fetch preview content when dialog opens
  useEffect(() => {
    if (!open || !document?.id) {
      setPreviewContent(null);
      setPreviewError(null);
      return;
    }

    const fetchPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      
      try {
        if (previewType === 'image') {
          // For images, download as blob
          const response = await api.get(
            `/action-tracker/documents/document/${document.id}/download`,
            { responseType: 'blob' }
          );
          const url = window.URL.createObjectURL(response.data);
          setPreviewContent(url);
        } else if (previewType === 'pdf') {
          // For PDFs, create a blob URL for iframe
          const response = await api.get(
            `/action-tracker/documents/document/${document.id}/download`,
            { responseType: 'blob' }
          );
          const url = window.URL.createObjectURL(response.data);
          setPreviewContent(url);
        } else if (previewType === 'text') {
          // For text, fetch content
          const response = await api.get(
            `/action-tracker/documents/document/${document.id}/content`,
            { params: { format: 'html' } }
          );
          setPreviewContent(response.data);
        }
      } catch (err) {
        console.error('Error fetching preview:', err);
        setPreviewError('Unable to preview this document. Try downloading it instead.');
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchPreview();

    // Cleanup blob URLs on unmount
    return () => {
      if (previewType === 'image' && previewContent) {
        window.URL.revokeObjectURL(previewContent);
      } else if (previewType === 'pdf' && previewContent) {
        window.URL.revokeObjectURL(previewContent);
      }
    };
  }, [open, document?.id, previewType]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          bgcolor: isDark ? '#1F2937' : undefined,
          borderRadius: isMobile ? 0 : 2,
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Preview: {document?.file_name || 'Document'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(document?.file_size)} • {document?.document_type_name || 'General'} • {previewType?.toUpperCase() || 'Unknown'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2, bgcolor: isDark ? '#111827' : '#f3f4f6' }}>
        {previewLoading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: 500,
            flexDirection: 'column',
            gap: 2
          }}>
            <CircularProgress />
            <Typography color="text.secondary">Loading preview...</Typography>
          </Box>
        ) : previewError ? (
          <Box sx={{ p: 3, textAlign: 'center', minHeight: 400, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography color="error" sx={{ mb: 1 }}>{previewError}</Typography>
            <Typography variant="body2" color="text.secondary">
              File type: {document?.mime_type || 'Unknown'}
            </Typography>
          </Box>
        ) : previewType === 'image' && previewContent ? (
          // Image Preview
          <Box sx={{ textAlign: 'center', bgcolor: isDark ? '#1F2937' : 'white', p: 2, borderRadius: 1 }}>
            <img
              src={previewContent}
              alt={document?.file_name || 'Preview'}
              style={{
                maxWidth: '100%',
                maxHeight: 600,
                borderRadius: 4,
                boxShadow: isDark ? '0 4px 6px rgba(0,0,0,0.3)' : '0 4px 6px rgba(0,0,0,0.1)',
              }}
              onError={() => setPreviewError('Failed to load image')}
            />
          </Box>
        ) : previewType === 'pdf' && previewContent ? (
          // PDF Preview using iframe
          <Box sx={{ bgcolor: isDark ? '#1F2937' : 'white', borderRadius: 1, overflow: 'hidden' }}>
            <iframe
              src={`${previewContent}#toolbar=1&navpanes=0&scrollbar=1`}
              width="100%"
              height={isMobile ? 600 : 800}
              style={{
                border: 'none',
                display: 'block',
              }}
              title="PDF Preview"
            />
            <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block', textAlign: 'center' }}>
              Note: PDF viewer may not work in all browsers. Download if preview fails.
            </Typography>
          </Box>
        ) : previewType === 'text' && previewContent ? (
          // Text Content Preview
          <Box
            sx={{
              bgcolor: isDark ? '#1F2937' : 'white',
              p: 3,
              borderRadius: 1,
              minHeight: 400,
              maxHeight: 600,
              overflowY: 'auto',
              '& h1, & h2, & h3': { color: isDark ? '#F3F4F6' : '#1F2937', mt: 2, mb: 1 },
              '& p': { color: isDark ? '#D1D5DB' : '#374151', mb: 1, lineHeight: 1.6 },
              '& li': { color: isDark ? '#D1D5DB' : '#374151', mb: 0.5 },
              '& pre': {
                bgcolor: isDark ? '#111827' : '#f3f4f6',
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
                mb: 2,
                fontSize: '0.85rem',
              },
              '& code': {
                color: isDark ? '#FBBF24' : '#D97706',
                fontFamily: 'monospace'
              },
              '& blockquote': {
                borderLeft: `4px solid ${isDark ? '#818CF8' : '#6366F1'}`,
                pl: 2,
                py: 1,
                color: isDark ? '#9CA3AF' : '#6B7280',
                fontStyle: 'italic'
              },
              '& table': {
                width: '100%',
                borderCollapse: 'collapse',
                mb: 2,
                fontSize: '0.9rem',
              },
              '& th, & td': {
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                p: 1,
                textAlign: 'left'
              },
              '& th': {
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
                fontWeight: 600
              }
            }}
            dangerouslySetInnerHTML={{ __html: previewContent.content || '<p>No content available</p>' }}
          />
        ) : (
          <Box sx={{ p: 3, textAlign: 'center', minHeight: 400, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              Cannot preview this file type
            </Typography>
            <Typography variant="body2" color="text.secondary">
              MIME type: {document?.mime_type || 'Unknown'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Download the file to view it
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const MeetingDocuments = ({ meetingId }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [documentTypes, setDocumentTypes] = useState([]);
  const [description, setDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);

  // Refs
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const fileInputRef = useRef(null);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!meetingId || !isMountedRef.current) return;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(
        `/action-tracker/documents/${meetingId}/documents`,
        {
          params: {
            skip: page * rowsPerPage,
            limit: rowsPerPage,
            sort_by: 'created_at',
            sort_order: 'desc'
          },
          signal: abortControllerRef.current.signal,
        }
      );
      
      if (isMountedRef.current) {
        const data = response.data?.items || response.data || [];
        setDocuments(data);
        setTotalCount(response.data?.total || data.length);
        setFeatureAvailable(true);
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }
      
      if (isMountedRef.current) {
        if (err.response?.status === 404) {
          setFeatureAvailable(false);
          setError(null);
          setDocuments([]);
        } else {
          console.error('Error fetching documents:', err);
          setError('Failed to load documents');
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [meetingId, page, rowsPerPage]);

  // Fetch document types
  const fetchDocumentTypes = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const response = await api.get('/action-tracker/documents/document-types');
      if (isMountedRef.current) {
        setDocumentTypes(response.data || []);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.debug('Document types not available:', err.message);
      }
    }
  }, []);

  // Effect
  useEffect(() => {
    isMountedRef.current = true;
    fetchDocuments();
    fetchDocumentTypes();
    
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Handle refresh
  const handleRefresh = async () => {
    setFeatureAvailable(true);
    setSuccessMessage('');
    await fetchDocuments();
  };

  // Handle preview
  const handlePreview = (doc) => {
    setPreviewDocument(doc);
    setPreviewOpen(true);
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit.`);
      return;
    }

    const fileExt = getFileExtension(selectedFile.name);
    if (!ALLOWED_FILE_TYPES.includes(`.${fileExt}`)) {
      setError(`File type .${fileExt} is not supported.`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const title = selectedFile.name.split('.').slice(0, -1).join('.') || selectedFile.name;
      formData.append('title', title);
      
      if (documentTypeId) {
        formData.append('document_type_id', documentTypeId);
      }
      
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      await api.post(
        `/action-tracker/documents/${meetingId}/documents`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );
            setUploadProgress(progress);
          },
        }
      );
      
      setSuccessMessage('Document uploaded successfully!');
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setDocumentTypeId('');
      setDescription('');
      setUploadProgress(0);
      setPage(0);
      await fetchDocuments();
      
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error uploading document:', err);
      
      let errorMsg = 'Failed to upload document. Please try again.';
      
      if (err.response?.status === 422) {
        const errorData = err.response?.data;
        
        if (Array.isArray(errorData?.detail)) {
          errorMsg = errorData.detail
            .map((e) => {
              const field = e.loc?.join('.') || 'unknown';
              return `${field}: ${e.msg}`;
            })
            .join('; ');
        } else if (Array.isArray(errorData?.message)) {
          errorMsg = errorData.message
            .map((e) => {
              if (typeof e === 'object') {
                return e.msg || e.message || JSON.stringify(e);
              }
              return String(e);
            })
            .join('; ');
        } else if (typeof errorData?.detail === 'string') {
          errorMsg = errorData.detail;
        } else if (typeof errorData?.message === 'string') {
          errorMsg = errorData.message;
        }
      } else if (err.response?.data?.detail) {
        errorMsg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : 'Validation error occurred';
      }
      
      setError(typeof errorMsg === 'string' ? errorMsg : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  // Download document
  const handleDownload = async (doc) => {
    if (!doc?.id) return;
    
    setDownloadingId(doc.id);
    setError(null);
    
    try {
      const response = await api.get(
        `/action-tracker/documents/document/${doc.id}/download`,
        { 
          responseType: 'blob',
          params: { format: 'original' }
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.file_name || 'document');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage('Download started!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error downloading document:', err);
      
      let errorMsg = 'Failed to download document. ';
      if (err.response?.status === 404) {
        errorMsg += 'The document file may have been moved or deleted.';
      } else if (err.response?.status === 403) {
        errorMsg += 'You do not have permission to download this file.';
      } else {
        errorMsg += 'Please try again later.';
      }
      setError(errorMsg);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDownloadingId(null);
    }
  };

  // Delete document
  const handleDelete = async (docId) => {
    if (!docId) return;
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) return;

    setDeletingId(docId);
    try {
      await api.delete(`/action-tracker/documents/document/${docId}`);
      setSuccessMessage('Document deleted successfully!');
      await fetchDocuments();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  // File selection handlers
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Render loading skeletons
  const renderSkeletons = () => {
    const count = isMobile ? 3 : rowsPerPage;
    if (isMobile) {
      return Array.from({ length: count }).map((_, index) => (
        <Card key={index} sx={{ mb: 2, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : undefined }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <Skeleton variant="circular" width={40} height={40} />
              <Box flex={1}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ));
    }
    return Array.from({ length: count }).map((_, index) => (
      <TableRow key={index}>
        <TableCell>
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="circular" width={36} height={36} />
            <Box>
              <Skeleton variant="text" width={150} />
              <Skeleton variant="text" width={100} />
            </Box>
          </Stack>
        </TableCell>
        <TableCell><Skeleton variant="text" width={80} /></TableCell>
        <TableCell><Skeleton variant="text" width={60} /></TableCell>
        <TableCell><Skeleton variant="text" width={100} /></TableCell>
        <TableCell><Skeleton variant="text" width={80} /></TableCell>
        <TableCell align="center">
          <Stack direction="row" spacing={1} justifyContent="center">
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="circular" width={32} height={32} />
          </Stack>
        </TableCell>
      </TableRow>
    ));
  };

  // Render grid view
  const renderGridView = () => (
    <Grid container spacing={2}>
      {documents.map((doc) => (
        <Grid item xs={12} sm={6} md={4} key={doc.id}>
          <Card 
            sx={{ 
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : undefined,
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[8],
              },
            }}
          >
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Avatar 
                    sx={{ 
                      bgcolor: isDark ? 'rgba(129,140,248,0.15)' : 'rgba(99,102,241,0.1)',
                      color: isDark ? '#818CF8' : 'primary.main',
                      width: 48,
                      height: 48,
                    }}
                  >
                    {getDocumentIcon(doc.document_type_name || doc.document_type, 'large')}
                  </Avatar>
                  <Chip
                    label={doc.document_type_name || doc.document_type || 'General'}
                    size="small"
                    sx={{
                      color: getTypeColor(doc.document_type_name || doc.document_type, isDark),
                      borderColor: alpha(getTypeColor(doc.document_type_name || doc.document_type, isDark), 0.3),
                    }}
                  />
                </Stack>
                <Box>
                  <Typography variant="body1" fontWeight={600} noWrap>
                    {doc.file_name || doc.filename || 'Untitled'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {doc.description || 'No description'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(doc.file_size)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {doc.uploaded_by_name || doc.created_by_name || 'Unknown'}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {doc.uploaded_at || doc.created_at ? 
                    format(new Date(doc.uploaded_at || doc.created_at), 'MMM d, yyyy') : 
                    'Unknown'
                  }
                </Typography>
              </Stack>
            </CardContent>
            <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : undefined }} />
            <CardActions>
              <Stack direction="row" spacing={1} width="100%" justifyContent="flex-end">
                <Tooltip title="Preview">
                  <IconButton 
                    size="small" 
                    onClick={() => handlePreview(doc)}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download">
                  <IconButton 
                    size="small" 
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                  >
                    {downloadingId === doc.id ? 
                      <CircularProgress size={20} /> : 
                      <DownloadIcon fontSize="small" />
                    }
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton 
                    size="small" 
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? 
                      <CircularProgress size={20} /> : 
                      <DeleteIcon fontSize="small" />
                    }
                  </IconButton>
                </Tooltip>
              </Stack>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  // Render table view
  const renderTableView = () => (
    <TableContainer 
      component={Paper} 
      variant="outlined" 
      sx={{ 
        borderRadius: 2,
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : undefined,
        bgcolor: isDark ? 'transparent' : undefined,
        overflowX: 'auto',
      }}
    >
      <Table>
        <TableHead>
          <TableRow sx={{ 
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9',
            '& .MuiTableCell-root': {
              color: isDark ? '#D1D5DB' : undefined,
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
              fontWeight: 700,
            }
          }}>
            <TableCell>File</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Size</TableCell>
            <TableCell>Uploaded By</TableCell>
            <TableCell>Date</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {documents.map((doc) => (
            <TableRow 
              key={doc.id}
              sx={{
                '& .MuiTableCell-root': {
                  borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : undefined,
                  color: isDark ? '#D1D5DB' : undefined,
                },
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                }
              }}
            >
              <TableCell>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar 
                    sx={{ 
                      bgcolor: isDark ? 'rgba(129,140,248,0.15)' : 'rgba(99,102,241,0.1)',
                      color: isDark ? '#818CF8' : 'primary.main',
                      width: 36,
                      height: 36,
                    }}
                  >
                    {getDocumentIcon(doc.document_type_name || doc.document_type)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {doc.file_name || doc.filename || 'Untitled'}
                    </Typography>
                    {doc.description && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {doc.description}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </TableCell>
              <TableCell>
                <Chip
                  label={doc.document_type_name || doc.document_type || 'General'}
                  size="small"
                  sx={{
                    color: getTypeColor(doc.document_type_name || doc.document_type, isDark),
                    borderColor: alpha(getTypeColor(doc.document_type_name || doc.document_type, isDark), 0.3),
                  }}
                />
              </TableCell>
              <TableCell>{formatFileSize(doc.file_size)}</TableCell>
              <TableCell>{doc.uploaded_by_name || doc.created_by_name || 'Unknown'}</TableCell>
              <TableCell>
                {doc.uploaded_at || doc.created_at ? 
                  format(new Date(doc.uploaded_at || doc.created_at), 'MMM d, yyyy') : 
                  'Unknown'
                }
              </TableCell>
              <TableCell align="center">
                <Stack direction="row" spacing={0.5} justifyContent="center">
                  <Tooltip title="Preview">
                    <IconButton 
                      size="small" 
                      onClick={() => handlePreview(doc)}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Download">
                    <IconButton 
                      size="small" 
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id}
                    >
                      {downloadingId === doc.id ? 
                        <CircularProgress size={20} /> : 
                        <DownloadIcon fontSize="small" />
                      }
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton 
                      size="small" 
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                    >
                      {deletingId === doc.id ? 
                        <CircularProgress size={20} /> : 
                        <DeleteIcon fontSize="small" />
                      }
                    </IconButton>
                  </Tooltip>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // Coming soon view
  if (!featureAvailable && !loading) {
    return (
      <Fade in timeout={400}>
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <ConstructionIcon sx={{ fontSize: 64, color: 'warning.main', opacity: 0.6, mb: 2 }} />
          <Typography variant="h5" gutterBottom fontWeight={600}>
            Documents Coming Soon
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 450, mx: 'auto', mb: 3 }}>
            The documents feature is currently under development.
          </Typography>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh}>
            Check Again
          </Button>
        </Paper>
      </Fade>
    );
  }

  // Loading state
  if (loading && documents.length === 0) {
    return (
      <Box sx={{ py: 4 }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Documents</Typography>
            <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: 2 }} />
          </Box>
          {renderSkeletons()}
        </Stack>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ borderRadius: 2 }}
        action={
          <Button color="inherit" size="small" onClick={handleRefresh}>
            Retry
          </Button>
        }
      >
        {typeof error === 'string' ? error : 'An error occurred'}
      </Alert>
    );
  }

  // Main render
  return (
    <Box sx={{ pb: 4 }}>
      <Stack spacing={3}>
        {/* Success Message */}
        {successMessage && (
          <Alert 
            severity="success" 
            sx={{ borderRadius: 2 }}
            onClose={() => setSuccessMessage('')}
          >
            {successMessage}
          </Alert>
        )}
        
        {/* Header */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            justifyContent="space-between" 
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={2}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <DescriptionIcon sx={{ color: 'primary.main', fontSize: 28 }} />
              <Typography variant="h6" fontWeight={700}>
                Documents
              </Typography>
              <Chip 
                label={`${totalCount} file${totalCount !== 1 ? 's' : ''}`} 
                size="small" 
                variant="outlined"
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => setUploadDialogOpen(true)}
                fullWidth={isMobile}
              >
                Upload
              </Button>
              <IconButton onClick={handleRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Paper>

        {/* Documents List */}
        {documents.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <FolderOpenIcon sx={{ fontSize: 64, color: 'action.disabled', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Documents Found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Upload your first document for this meeting.
            </Typography>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Document
            </Button>
          </Paper>
        ) : (
          <>
            {isMobile ? renderGridView() : renderTableView()}
            
            {totalCount > rowsPerPage && (
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={totalCount}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            )}
          </>
        )}
      </Stack>

      {/* Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onClose={() => !uploading && setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <CloudUploadIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={700}>
                Upload Document
              </Typography>
            </Stack>
            <IconButton 
              onClick={() => !uploading && setUploadDialogOpen(false)}
              disabled={uploading}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* File Drop Zone */}
            <Box
              sx={{
                border: `2px ${dragOver ? 'solid' : 'dashed'} ${dragOver ? 'primary.main' : '#e5e7eb'}`,
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                bgcolor: dragOver ? 'rgba(99,102,241,0.02)' : 'transparent',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(99,102,241,0.02)',
                },
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_FILE_TYPES.join(',')}
                style={{ display: 'none' }}
                id="file-upload"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
                {selectedFile ? (
                  <Stack spacing={2} alignItems="center">
                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(99,102,241,0.1)' }}>
                      <AttachFileIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    </Avatar>
                    <Box>
                      <Typography variant="body1" fontWeight={600}>
                        {selectedFile.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
                      </Typography>
                    </Box>
                    <Button 
                      size="small" 
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearFile();
                      }}
                      disabled={uploading}
                    >
                      Remove
                    </Button>
                  </Stack>
                ) : (
                  <Stack spacing={2} alignItems="center">
                    <CloudUploadIcon sx={{ fontSize: 56, color: 'action.disabled' }} />
                    <Box>
                      <Typography variant="body1">
                        Drag & drop a file here, or click to browse
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {`Max size: ${formatFileSize(MAX_FILE_SIZE)}`}
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </label>
            </Box>

            {/* Document Type */}
            <FormControl fullWidth>
              <InputLabel>Document Type</InputLabel>
              <Select
                value={documentTypeId}
                onChange={(e) => setDocumentTypeId(e.target.value)}
                label="Document Type"
                disabled={uploading}
              >
                <MenuItem value="">General</MenuItem>
                {documentTypes.map((type) => (
                  <MenuItem key={type.id || type} value={type.id || type}>
                    {type.name || type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Description */}
            <TextField
              fullWidth
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              disabled={uploading}
              placeholder="Add a brief description"
            />

            {/* Upload Progress */}
            {uploading && (
              <Box sx={{ width: '100%' }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">
                      Uploading {selectedFile?.name}
                    </Typography>
                    <Typography variant="caption" fontWeight={600} color="primary">
                      {uploadProgress}%
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={uploadProgress}
                    sx={{ borderRadius: 2, height: 8 }}
                  />
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
          >
            {uploading ? `Uploading ${uploadProgress}%` : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        document={previewDocument}
        isDark={isDark}
      />
    </Box>
  );
};

export default MeetingDocuments;