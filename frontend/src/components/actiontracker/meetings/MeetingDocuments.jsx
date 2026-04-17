// src/components/actiontracker/meetings/MeetingDocuments.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper, Typography, Box, Stack, Button, IconButton,
  List, ListItem, ListItemText, ListItemIcon, ListItemSecondaryAction,
  Chip, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Tooltip
} from '@mui/material';
import {
  Description as DescriptionIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  InsertDriveFile as FileIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  CloudUpload as UploadIcon,
  Refresh as RefreshIcon
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
  const [fileDescription, setFileDescription] = useState('');

  const fetchDocuments = useCallback(async () => {
    if (!meetingId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/documents`);
      const docsData = response.data?.items || response.data || [];
      setDocuments(docsData);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err.response?.data?.detail || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, meetingId]);

  const handleRefresh = () => {
    fetchDocuments();
    if (onRefresh) onRefresh();
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', fileName);
    if (fileDescription) formData.append('description', fileDescription);
    
    try {
      await api.post(`/action-tracker/meetings/${meetingId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setFileName('');
      setFileDescription('');
      fetchDocuments();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error uploading document:', err);
      setError(err.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const response = await api.get(`/action-tracker/documents/${doc.id}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name || doc.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document:', err);
      setError('Failed to download document');
    }
  };

  const handleDelete = async (docId) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await api.delete(`/action-tracker/documents/${docId}`);
        fetchDocuments();
        if (onRefresh) onRefresh();
      } catch (err) {
        console.error('Error deleting document:', err);
        setError(err.response?.data?.detail || 'Failed to delete document');
      }
    }
  };

  const getFileIcon = (fileName) => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return <PdfIcon color="error" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return <ImageIcon color="success" />;
    return <DescriptionIcon color="primary" />;
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
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={700}>
          Documents ({documents.length})
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} size="small">
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
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {documents.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <FileIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No documents uploaded yet.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload meeting agendas, presentations, or other relevant documents.
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <List>
            {documents.map((doc, index) => (
              <React.Fragment key={doc.id}>
                {index > 0 && <Divider />}
                <ListItem>
                  <ListItemIcon>
                    {getFileIcon(doc.name || doc.file_name)}
                  </ListItemIcon>
                  <ListItemText
                    primary={doc.name || doc.file_name}
                    secondary={
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          Uploaded: {new Date(doc.uploaded_at || doc.created_at).toLocaleDateString()}
                        </Typography>
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
                      <IconButton edge="end" onClick={() => handleDelete(doc.id)} color="error">
                        <DeleteIcon />
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
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadIcon />}
              fullWidth
            >
              Select File
              <input
                type="file"
                hidden
                onChange={handleFileSelect}
              />
            </Button>
            {selectedFile && (
              <Typography variant="body2" color="success.main">
                Selected: {selectedFile.name}
              </Typography>
            )}
            <TextField
              fullWidth
              label="Document Name"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Enter document name"
            />
            <TextField
              fullWidth
              label="Description (Optional)"
              multiline
              rows={3}
              value={fileDescription}
              onChange={(e) => setFileDescription(e.target.value)}
              placeholder="Enter document description"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
          >
            {uploading ? <CircularProgress size={24} /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MeetingDocuments;