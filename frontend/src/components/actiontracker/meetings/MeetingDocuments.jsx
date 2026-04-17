// src/components/actiontracker/meetings/MeetingDocuments.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper, Typography, Box, Stack, Button, IconButton,
  List, ListItem, ListItemText, ListItemIcon, ListItemSecondaryAction,
  Chip, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Tooltip,
  LinearProgress, Fade, Grow, Card, CardContent, Divider,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
  Description as DescriptionIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  InsertDriveFile as FileIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  CloudUpload as UploadIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const MeetingDocuments = ({ meetingId, onRefresh }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileTitle, setFileTitle] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState('');

  // Fetch document types from attributes
  const fetchDocumentTypes = useCallback(async () => {
    try {
      console.log('Fetching document types...');
      const response = await api.get('/attribute-groups/DOCUMENT_TYPE/attributes');
      const types = response.data?.items || response.data || [];
      console.log('Document types fetched:', types.length);
      setDocumentTypes(types);
      
      // Set default to first active document type
      if (types.length > 0 && !selectedDocumentTypeId) {
        setSelectedDocumentTypeId(types[0].id);
      }
    } catch (err) {
      console.error('Error fetching document types:', err);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    if (!meetingId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching documents for meeting:', meetingId);
      const response = await api.get(`/action-tracker/meetings/${meetingId}/documents`);
      const docsData = response.data?.items || response.data || [];
      console.log('Documents fetched:', docsData.length);
      setDocuments(docsData);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (meetingId) {
      fetchDocuments();
      fetchDocumentTypes();
    }
  }, [fetchDocuments, fetchDocumentTypes, meetingId]);

  const handleRefresh = () => {
    fetchDocuments();
    if (onRefresh) onRefresh();
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileTitle(file.name.replace(/\.[^/.]+$/, '')); // Default title from filename without extension
      setFileName(file.name);
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }
    
    if (!fileTitle.trim()) {
      setError('Please enter a document title');
      return;
    }
    
    if (!selectedDocumentTypeId) {
      setError('Please select a document type');
      return;
    }
    
    setUploading(true);
    setError(null);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', fileTitle);
    formData.append('description', fileDescription);
    formData.append('document_type_id', selectedDocumentTypeId);
    
    try {
      console.log('Uploading document to meeting:', meetingId);
      // ✅ CORRECT: POST /api/v1/action-tracker/documents/documents/{meeting_id}/documents
      const response = await api.post(
        `/action-tracker/documents/documents/${meetingId}/documents`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      );
      
      console.log('Upload successful:', response.data);
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setFileTitle('');
      setFileName('');
      setFileDescription('');
      setSelectedDocumentTypeId(documentTypes[0]?.id || '');
      setUploadProgress(0);
      await fetchDocuments();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error uploading document:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      console.log('Downloading document:', doc.id);
      const response = await api.get(`/action-tracker/documents/${doc.id}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name || doc.file_name || 'document');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to download document');
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }
    
    setDeletingId(docId);
    try {
      console.log('Deleting document:', docId);
      await api.delete(`/action-tracker/documents/${docId}`);
      console.log('Document deleted successfully');
      await fetchDocuments();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const getFileIcon = (fileName, documentType) => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    
    // Use document type icon if available
    if (documentType?.extra_metadata?.icon) {
      const iconName = documentType.extra_metadata.icon;
      if (iconName === 'article') return <DescriptionIcon sx={{ color: '#3B82F6' }} />;
      if (iconName === 'slideshow') return <DescriptionIcon sx={{ color: '#8B5CF6' }} />;
      if (iconName === 'assessment') return <DescriptionIcon sx={{ color: '#10B981' }} />;
      if (iconName === 'description') return <DescriptionIcon sx={{ color: '#F59E0B' }} />;
      if (iconName === 'attach_file') return <FileIcon sx={{ color: '#6B7280' }} />;
      if (iconName === 'menu_book') return <DescriptionIcon sx={{ color: '#EF4444' }} />;
    }
    
    // Fallback to file extension icons
    if (extension === 'pdf') return <PdfIcon sx={{ color: '#ef4444' }} />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return <ImageIcon sx={{ color: '#10b981' }} />;
    if (['doc', 'docx'].includes(extension)) return <DescriptionIcon sx={{ color: '#3b82f6' }} />;
    if (['xls', 'xlsx'].includes(extension)) return <DescriptionIcon sx={{ color: '#10b981' }} />;
    if (['ppt', 'pptx'].includes(extension)) return <DescriptionIcon sx={{ color: '#f59e0b' }} />;
    return <FileIcon sx={{ color: '#6b7280' }} />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getDocumentTypeName = (doc) => {
    const docType = documentTypes.find(t => t.id === doc.document_type_id);
    return docType?.name || doc.document_type_name || 'Document';
  };

  if (loading && documents.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading documents...
        </Typography>
      </Box>
    );
  }

  return (
    <Fade in timeout={500}>
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Documents ({documents.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} size="small" disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Document
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {documents.length === 0 ? (
          <Grow in timeout={500}>
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
              <FileIcon sx={{ fontSize: 80, color: '#cbd5e1', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Documents Yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
                Upload meeting agendas, presentations, minutes, or other relevant documents.
              </Typography>
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => setUploadDialogOpen(true)}
              >
                Upload First Document
              </Button>
            </Paper>
          </Grow>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <List sx={{ p: 0 }}>
              {documents.map((doc, index) => (
                <React.Fragment key={doc.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      py: 2,
                      transition: 'background-color 0.2s',
                      '&:hover': { bgcolor: '#f8fafc' }
                    }}
                  >
                    <ListItemIcon>
                      {getFileIcon(doc.file_name || doc.name, doc.document_type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="subtitle2" fontWeight={600}>
                          {doc.title || doc.name || doc.file_name}
                        </Typography>
                      }
                      secondary={
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap">
                          <Chip
                            label={getDocumentTypeName(doc)}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                          {doc.file_size && (
                            <Chip
                              label={formatFileSize(doc.file_size)}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <ScheduleIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              Uploaded: {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : (doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Unknown date')}
                            </Typography>
                          </Stack>
                          {doc.description && (
                            <Typography variant="caption" color="text.secondary">
                              {doc.description}
                            </Typography>
                          )}
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Download">
                        <IconButton edge="end" onClick={() => handleDownload(doc)} sx={{ mr: 1 }}>
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          edge="end" 
                          onClick={() => handleDelete(doc.id)} 
                          color="error"
                          disabled={deletingId === doc.id}
                        >
                          {deletingId === doc.id ? <CircularProgress size={20} /> : <DeleteIcon />}
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Paper>
        )}

        {/* Upload Dialog */}
        <Dialog 
          open={uploadDialogOpen} 
          onClose={() => !uploading && setUploadDialogOpen(false)} 
          maxWidth="sm" 
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                Upload Document
              </Typography>
              <IconButton onClick={() => !uploading && setUploadDialogOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={2.5}>
              {/* File Selection */}
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                fullWidth
                sx={{ py: 2, borderStyle: 'dashed' }}
                disabled={uploading}
              >
                {selectedFile ? 'Change File' : 'Select File'}
                <input
                  type="file"
                  hidden
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </Button>
              
              {selectedFile && (
                <Card variant="outlined" sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {getFileIcon(selectedFile.name)}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={500}>
                          {selectedFile.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(selectedFile.size)}
                        </Typography>
                      </Box>
                      {!uploading && (
                        <IconButton size="small" onClick={() => setSelectedFile(null)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Upload Progress */}
              {uploading && uploadProgress > 0 && uploadProgress < 100 && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="caption">Uploading...</Typography>
                    <Typography variant="caption">{uploadProgress}%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 6, borderRadius: 3 }} />
                </Box>
              )}

              {/* Document Title */}
              {selectedFile && (
                <TextField
                  fullWidth
                  label="Document Title *"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  placeholder="Enter document title"
                  disabled={uploading}
                  required
                  helperText="Title is required for the document"
                />
              )}

              {/* Document Type Selection */}
              {selectedFile && documentTypes.length > 0 && (
                <FormControl fullWidth>
                  <InputLabel>Document Type *</InputLabel>
                  <Select
                    value={selectedDocumentTypeId}
                    label="Document Type *"
                    onChange={(e) => setSelectedDocumentTypeId(e.target.value)}
                    disabled={uploading}
                  >
                    {documentTypes.map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {type.extra_metadata?.icon === 'article' && <DescriptionIcon sx={{ fontSize: 20 }} />}
                          {type.extra_metadata?.icon === 'slideshow' && <DescriptionIcon sx={{ fontSize: 20 }} />}
                          {type.extra_metadata?.icon === 'assessment' && <DescriptionIcon sx={{ fontSize: 20 }} />}
                          {type.extra_metadata?.icon === 'description' && <DescriptionIcon sx={{ fontSize: 20 }} />}
                          {type.extra_metadata?.icon === 'attach_file' && <FileIcon sx={{ fontSize: 20 }} />}
                          {type.extra_metadata?.icon === 'menu_book' && <DescriptionIcon sx={{ fontSize: 20 }} />}
                          <Typography>{type.name}</Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Description Input */}
              <TextField
                fullWidth
                label="Description (Optional)"
                multiline
                rows={3}
                value={fileDescription}
                onChange={(e) => setFileDescription(e.target.value)}
                placeholder="Add a description for this document..."
                disabled={uploading}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 0 }}>
            <Button onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !fileTitle.trim() || !selectedDocumentTypeId}
              startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default MeetingDocuments;