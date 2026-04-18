// src/components/actiontracker/meetings/MeetingDocuments.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  LinearProgress,
  Fade,
  Grow,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Backdrop,
  Snackbar,
  Skeleton,
  Pagination,
  useMediaQuery,
  useTheme,
  SwipeableDrawer,
  Switch,
  FormControlLabel,
  FormHelperText
} from '@mui/material';

import {
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  InsertDriveFile as FileIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  CloudUpload as UploadIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  Info as InfoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Print as PrintIcon,
  Fullscreen as FullscreenIcon,
  FolderOpen as FolderOpenIcon,
  Error as ErrorIcon,
  MoreVert as MoreVertIcon,
  Description as TextSnippetIcon,
  CenterFocusStrong as ScanIcon,
  TextFields as TextFieldsIcon
} from '@mui/icons-material';

import api from '../../../services/api';

const MeetingDocuments = ({ meetingId, onRefresh }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State Management
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTitle, setFileTitle] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState('');
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // OCR States
  const [enableOCR, setEnableOCR] = useState(false);
  const [ocrLanguage, setOcrLanguage] = useState('eng');
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState(null);
  const [processingDocId, setProcessingDocId] = useState(null);

  // Preview States
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTab, setPreviewTab] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mobile Menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDocForMenu, setSelectedDocForMenu] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const itemsPerPage = isMobile ? 5 : 10;
  const totalPages = Math.ceil(documents.length / itemsPerPage);
  const paginatedDocs = documents.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Toast/Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Refs
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // OCR Language Options
  const ocrLanguages = [
    { code: 'eng', name: 'English' },
    { code: 'spa', name: 'Spanish' },
    { code: 'fra', name: 'French' },
    { code: 'deu', name: 'German' },
    { code: 'ita', name: 'Italian' },
    { code: 'por', name: 'Portuguese' },
    { code: 'rus', name: 'Russian' },
    { code: 'zho', name: 'Chinese (Simplified)' },
    { code: 'jpn', name: 'Japanese' },
    { code: 'ara', name: 'Arabic' }
  ];

  // Helper Functions
  const showNotification = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Check if file is OCR-compatible (PDF or image)
  const isOcrCompatible = (file) => {
    if (!file) return false;
    const compatibleTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/bmp'];
    return compatibleTypes.includes(file.type);
  };

  // Fetch document types
  const fetchDocumentTypes = useCallback(async () => {
    setLoadingTypes(true);
    try {
      const response = await api.get('/action-tracker/documents/attribute-groups/DOCUMENT_TYPE/attributes');
      let types = [];
      if (response.data?.items) {
        types = response.data.items;
      } else if (Array.isArray(response.data)) {
        types = response.data;
      }
      setDocumentTypes(types);
      if (types.length > 0 && !selectedDocumentTypeId) {
        setSelectedDocumentTypeId(types[0].id);
      }
    } catch (err) {
      console.error('Error fetching document types:', err);
      setError('Failed to load document types.');
    } finally {
      setLoadingTypes(false);
    }
  }, [selectedDocumentTypeId]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!meetingId) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/action-tracker/documents/meetings/${meetingId}/documents`, {
        signal: abortControllerRef.current.signal
      });
      const docs = response.data?.items || response.data || [];
      setDocuments(docs);
      setPage(1);
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
        const errorMsg = err.response?.data?.detail || 'Failed to load documents';
        setError(errorMsg);
        showNotification(errorMsg, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (meetingId) {
      fetchDocuments();
      fetchDocumentTypes();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [meetingId, fetchDocuments, fetchDocumentTypes]);

  const handleRefresh = () => {
    fetchDocuments();
    fetchDocumentTypes();
    if (onRefresh) onRefresh();
    showNotification('Documents refreshed', 'success');
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        showNotification('File size must be less than 50MB', 'error');
        return;
      }
      setSelectedFile(file);
      setFileTitle(file.name.replace(/\.[^/.]+$/, ''));
      setUploadProgress(0);
      setEnableOCR(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !fileTitle.trim() || !selectedDocumentTypeId) {
      showNotification('Please fill all required fields', 'warning');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', fileTitle.trim());
    formData.append('description', fileDescription);
    formData.append('document_type_id', selectedDocumentTypeId);
    
    if (enableOCR && isOcrCompatible(selectedFile)) {
      formData.append('ocr_enabled', 'true');
      formData.append('ocr_language', ocrLanguage);
    }

    try {
      await api.post(`/action-tracker/documents/meetings/${meetingId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      });

      setUploadDialogOpen(false);
      setSelectedFile(null);
      setFileTitle('');
      setFileDescription('');
      setUploadProgress(0);
      setEnableOCR(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchDocuments();
      if (onRefresh) onRefresh();
      showNotification('Document uploaded successfully!', 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to upload document';
      setError(errorMsg);
      showNotification(errorMsg, 'error');
    } finally {
      setUploading(false);
    }
  };

  // OCR Processing for existing documents
  const handleProcessOCR = async (doc) => {
    setProcessingDocId(doc.id);
    setOcrDialogOpen(true);
    setOcrProgress(0);
    setOcrResult(null);

    try {
      const interval = setInterval(() => {
        setOcrProgress(prev => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          return prev + 10;
        });
      }, 500);

      const response = await api.post(`/action-tracker/documents/document/${doc.id}/ocr`, {
        language: ocrLanguage
      });

      clearInterval(interval);
      setOcrProgress(100);
      setOcrResult(response.data);
      showNotification('OCR processing completed successfully!', 'success');
      await fetchDocuments();
    } catch (err) {
      console.error('OCR processing failed:', err);
      const errorMsg = err.response?.data?.detail || 'OCR processing failed';
      setOcrResult({ error: errorMsg });
      showNotification(errorMsg, 'error');
    } finally {
      setProcessingDocId(null);
    }
  };

  const handleCloseOcrDialog = () => {
    setOcrDialogOpen(false);
    setOcrProgress(0);
    setOcrResult(null);
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.title || doc.file_name}"?`)) return;

    setDeletingId(doc.id);
    try {
      await api.delete(`/action-tracker/documents/document/${doc.id}`);
      showNotification('Document deleted successfully', 'success');
      await fetchDocuments();
      if (onRefresh) onRefresh();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete document';
      showNotification(errorMsg, 'error');
    } finally {
      setDeletingId(null);
      setMobileMenuOpen(false);
    }
  };

  const handlePreview = async (doc) => {
    setSelectedDoc(doc);
    setPreviewTab(0);
    setPreviewError(null);
    setImageZoom(1);
    setPreviewDialogOpen(true);
    setPreviewLoading(true);

    if (doc.mime_type === 'application/pdf' || doc.mime_type?.startsWith('image/')) {
      try {
        const response = await api.get(`/action-tracker/documents/document/${doc.id}/download`, {
          responseType: 'blob'
        });
        const url = URL.createObjectURL(response.data);
        setPreviewUrl(url);
      } catch (err) {
        console.error('Preview error:', err);
        setPreviewError('Failed to load preview. You can still download the file.');
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPreviewLoading(false);
    }
    setMobileMenuOpen(false);
  };

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewDialogOpen(false);
    setSelectedDoc(null);
    setPreviewUrl(null);
    setPreviewError(null);
    setImageZoom(1);
    setIsFullscreen(false);
  };

  const handleDownload = async (doc) => {
    if (!doc) return;
    setDownloadingId(doc.id);
    try {
      const response = await api.get(`/action-tracker/documents/document/${doc.id}/download`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: doc.mime_type || 'application/octet-stream' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name || doc.title || 'document';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showNotification('Download started', 'success');
    } catch (err) {
      console.error('Download failed:', err);
      showNotification('Download failed. Please try again.', 'error');
      window.open(`/api/v1/action-tracker/documents/document/${doc.id}/download`, '_blank');
    } finally {
      setDownloadingId(null);
      setMobileMenuOpen(false);
    }
  };

  const handleZoomIn = () => setImageZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setImageZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => setImageZoom(1);

  const handlePrint = () => {
    if (previewUrl) {
      const win = window.open(previewUrl);
      win?.addEventListener('load', () => win.print());
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getFileIcon = (fileName, mimeType) => {
    if (mimeType === 'application/pdf') return <PdfIcon sx={{ color: '#ef4444', fontSize: isMobile ? 28 : 40 }} />;
    if (mimeType?.startsWith('image/')) return <ImageIcon sx={{ color: '#10b981', fontSize: isMobile ? 28 : 40 }} />;
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <PdfIcon sx={{ color: '#ef4444', fontSize: isMobile ? 28 : 40 }} />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return <ImageIcon sx={{ color: '#10b981', fontSize: isMobile ? 28 : 40 }} />;
    return <FileIcon sx={{ color: '#6b7280', fontSize: isMobile ? 28 : 40 }} />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getDocumentTypeName = (doc) => {
    if (!doc) return 'Document';
    const typeFromList = documentTypes.find((t) => t.id === doc.document_type_id);
    if (typeFromList?.name) return typeFromList.name;
    if (doc.document_type_name) return doc.document_type_name;
    return 'Document';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const options = isMobile 
        ? { month: 'short', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
      return new Date(dateString).toLocaleDateString('en-US', options);
    } catch {
      return 'Unknown';
    }
  };

  const MobileDocumentCard = ({ doc, index }) => (
    <Card key={doc.id || index} sx={{ mb: 2, borderRadius: 2 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {getFileIcon(doc.file_name, doc.mime_type)}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              {doc.title || doc.file_name || 'Untitled Document'}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
              <Chip label={getDocumentTypeName(doc)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
              <Chip label={formatFileSize(doc.file_size)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
              <Typography variant="caption" color="text.secondary">{formatDate(doc.uploaded_at)}</Typography>
            </Stack>
            {doc.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }} noWrap>
                {doc.description}
              </Typography>
            )}
            {doc.ocr_text && (
              <Chip icon={<TextSnippetIcon />} label="OCR Available" size="small" color="info" variant="outlined" sx={{ mt: 0.5, height: 20 }} />
            )}
          </Box>
          <IconButton size="small" onClick={() => { setSelectedDocForMenu(doc); setMobileMenuOpen(true); }}>
            <MoreVertIcon />
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );

  const LoadingSkeleton = () => (
    <Stack spacing={2}>
      {[1, 2, 3].map((i) => (
        <Paper key={i} sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="circular" width={isMobile ? 36 : 40} height={isMobile ? 36 : 40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="70%" height={24} />
              <Skeleton variant="text" width="50%" height={20} />
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );

  if ((loading && documents.length === 0) || loadingTypes) {
    return <LoadingSkeleton />;
  }

  return (
    <Fade in timeout={400}>
      <Box>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }} flexWrap="wrap" gap={2}>
          <Typography variant={isMobile ? "subtitle1" : "h6"} fontWeight={700}>
            Documents ({documents.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={loading} size="small"><RefreshIcon /></IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploadDialogOpen(true)} size={isMobile ? "small" : "medium"}>
              {isMobile ? "Upload" : "Upload Document"}
            </Button>
          </Stack>
        </Stack>

        {/* Error Alert */}
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

        {/* Empty State */}
        {documents.length === 0 ? (
          <Grow in timeout={500}>
            <Paper sx={{ p: isMobile ? 4 : 8, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
              <FolderOpenIcon sx={{ fontSize: isMobile ? 60 : 90, color: 'text.disabled', mb: 2 }} />
              <Typography variant={isMobile ? "subtitle1" : "h6"} color="text.secondary" gutterBottom>No Documents Yet</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 3 }}>
                Upload meeting agendas, presentations, minutes, or any supporting documents here.
              </Typography>
              <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploadDialogOpen(true)} size={isMobile ? "medium" : "large"}>
                Upload First Document
              </Button>
            </Paper>
          </Grow>
        ) : (
          <>
            {isMobile ? (
              <Box>{paginatedDocs.map((doc, index) => <MobileDocumentCard key={doc.id || index} doc={doc} index={index} />)}</Box>
            ) : (
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'auto' }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                        <TableCell sx={{ fontWeight: 700, width: '35%' }}>Document</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Uploaded</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 160 }} align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedDocs.map((doc, index) => (
                        <TableRow key={doc.id || index} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              {getFileIcon(doc.file_name, doc.mime_type)}
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {doc.title || doc.file_name || 'Untitled Document'}
                                </Typography>
                                {doc.description && <Typography variant="caption" color="text.secondary">{doc.description}</Typography>}
                                {doc.ocr_text && (
                                  <Chip icon={<TextSnippetIcon />} label="OCR Available" size="small" color="info" variant="outlined" sx={{ mt: 0.5, height: 20 }} />
                                )}
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell><Chip label={getDocumentTypeName(doc)} size="small" variant="outlined" /></TableCell>
                          <TableCell><Typography variant="body2">{formatFileSize(doc.file_size)}</Typography></TableCell>
                          <TableCell><Typography variant="caption" color="text.secondary">{formatDate(doc.uploaded_at)}</Typography></TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="Preview">
                                <IconButton onClick={() => handlePreview(doc)} size="small"><VisibilityIcon fontSize="small" /></IconButton>
                              </Tooltip>
                              <Tooltip title="Download">
                                <IconButton onClick={() => handleDownload(doc)} size="small" disabled={downloadingId === doc.id}>
                                  {downloadingId === doc.id ? <CircularProgress size={16} /> : <DownloadIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                              {isOcrCompatible({ type: doc.mime_type }) && !doc.ocr_text && (
                                <Tooltip title="Process OCR">
                                  <IconButton onClick={() => handleProcessOCR(doc)} size="small" disabled={processingDocId === doc.id} color="secondary">
                                    {processingDocId === doc.id ? <CircularProgress size={16} /> : <ScanIcon fontSize="small" />}
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Delete">
                                <IconButton onClick={() => handleDelete(doc)} color="error" size="small" disabled={deletingId === doc.id}>
                                  {deletingId === doc.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {totalPages > 1 && (
              <Stack alignItems="center" sx={{ mt: 3 }}>
                <Pagination count={totalPages} page={page} onChange={(e, value) => setPage(value)} color="primary" size={isMobile ? "small" : "large"} siblingCount={isMobile ? 0 : 1} />
              </Stack>
            )}
          </>
        )}

        {/* Mobile Action Menu */}
        <SwipeableDrawer anchor="bottom" open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} onOpen={() => {}} disableBackdropTransition>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>{selectedDocForMenu?.title || selectedDocForMenu?.file_name}</Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              <Button fullWidth startIcon={<VisibilityIcon />} onClick={() => handlePreview(selectedDocForMenu)} sx={{ justifyContent: 'flex-start' }}>Preview</Button>
              <Button fullWidth startIcon={<DownloadIcon />} onClick={() => handleDownload(selectedDocForMenu)} sx={{ justifyContent: 'flex-start' }}>Download</Button>
              {isOcrCompatible({ type: selectedDocForMenu?.mime_type }) && !selectedDocForMenu?.ocr_text && (
                <Button fullWidth startIcon={<ScanIcon />} onClick={() => handleProcessOCR(selectedDocForMenu)} sx={{ justifyContent: 'flex-start' }} disabled={processingDocId === selectedDocForMenu?.id}>
                  Process OCR
                </Button>
              )}
              <Button fullWidth startIcon={<DeleteIcon />} onClick={() => handleDelete(selectedDocForMenu)} color="error" sx={{ justifyContent: 'flex-start' }}>Delete</Button>
            </Stack>
          </Box>
        </SwipeableDrawer>

        {/* OCR Progress Dialog */}
        <Dialog open={ocrDialogOpen} onClose={handleCloseOcrDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ScanIcon color="primary" />
              <Typography variant="h6">OCR Processing</Typography>
            </Stack>
          </DialogTitle>
          <DialogContent>
            {ocrProgress < 100 ? (
              <Box sx={{ py: 3 }}>
                <LinearProgress variant="determinate" value={ocrProgress} sx={{ height: 8, borderRadius: 4, mb: 2 }} />
                <Typography variant="body2" color="text.secondary" align="center">Processing document with OCR... {ocrProgress}%</Typography>
              </Box>
            ) : ocrResult ? (
              <Box sx={{ py: 2 }}>
                {ocrResult.error ? (
                  <Alert severity="error" sx={{ mb: 2 }}>{ocrResult.error}</Alert>
                ) : (
                  <>
                    <Alert severity="success" sx={{ mb: 2 }}>OCR processing completed successfully!</Alert>
                    <Paper variant="outlined" sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                      <Typography variant="subtitle2" gutterBottom>Extracted Text:</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ocrResult.text || 'No text extracted'}</Typography>
                      {ocrResult.pages && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>Pages processed: {ocrResult.pages}</Typography>
                      )}
                    </Paper>
                  </>
                )}
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseOcrDialog}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Preview Dialog with OCR Text Tab */}
        <Dialog open={previewDialogOpen} onClose={handleClosePreview} maxWidth="xl" fullWidth fullScreen={isMobile || isFullscreen}>
          <DialogTitle sx={{ p: isMobile ? 1.5 : 2, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={600}>{selectedDoc?.title || selectedDoc?.file_name || 'Document Preview'}</Typography>
              <Stack direction="row" spacing={1}>
                {selectedDoc?.mime_type?.startsWith('image/') && !isMobile && (
                  <>
                    <IconButton onClick={handleZoomOut} size="small"><ZoomOutIcon /></IconButton>
                    <IconButton onClick={handleResetZoom} size="small"><Typography variant="caption" fontWeight="bold">{Math.round(imageZoom * 100)}%</Typography></IconButton>
                    <IconButton onClick={handleZoomIn} size="small"><ZoomInIcon /></IconButton>
                  </>
                )}
                <IconButton onClick={handlePrint} size="small"><PrintIcon /></IconButton>
                <IconButton onClick={toggleFullscreen} size="small"><FullscreenIcon /></IconButton>
                <IconButton onClick={handleClosePreview} size="small"><CloseIcon /></IconButton>
              </Stack>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ p: 0, bgcolor: '#fafafa' }}>
            <Tabs value={previewTab} onChange={(e, v) => setPreviewTab(v)} sx={{ px: isMobile ? 1 : 3, borderBottom: 1, borderColor: 'divider', bgcolor: '#fff' }} variant={isMobile ? "fullWidth" : "standard"}>
              <Tab label="Preview" icon={<VisibilityIcon />} iconPosition="start" />
              <Tab label="Details" icon={<InfoIcon />} iconPosition="start" />
              {selectedDoc?.ocr_text && <Tab label="OCR Text" icon={<TextSnippetIcon />} iconPosition="start" />}
            </Tabs>
            
            {/* Preview Tab */}
            {previewTab === 0 && (
              <Box sx={{ height: isMobile ? 'calc(100vh - 180px)' : 'calc(100% - 48px)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: isMobile ? 1 : 3, overflow: 'auto' }}>
                {previewLoading && <Backdrop open sx={{ position: 'absolute', bgcolor: 'rgba(0,0,0,0.7)', zIndex: 1 }}><CircularProgress color="inherit" /></Backdrop>}
                {previewError ? (
                  <Box textAlign="center">
                    <ErrorIcon sx={{ fontSize: isMobile ? 60 : 80, color: '#ef4444', mb: 2 }} />
                    <Typography color="error">{previewError}</Typography>
                    <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => handleDownload(selectedDoc)} sx={{ mt: 2 }}>Download File</Button>
                  </Box>
                ) : selectedDoc?.mime_type === 'application/pdf' && previewUrl ? (
                  <iframe src={previewUrl} title={selectedDoc.file_name} style={{ width: '100%', height: '100%', border: 'none', minHeight: 400 }} />
                ) : selectedDoc?.mime_type?.startsWith('image/') && previewUrl ? (
                  <Box sx={{ transform: `scale(${imageZoom})`, transition: 'transform 0.25s ease' }}>
                    <img src={previewUrl} alt={selectedDoc.file_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </Box>
                ) : (
                  <Box textAlign="center">
                    <FileIcon sx={{ fontSize: isMobile ? 60 : 100, color: '#cbd5e1', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">Preview not available</Typography>
                    <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => handleDownload(selectedDoc)} sx={{ mt: 2 }}>Download to View</Button>
                  </Box>
                )}
              </Box>
            )}
            
            {/* Details Tab */}
            {previewTab === 1 && selectedDoc && (
              <TableContainer sx={{ p: isMobile ? 2 : 4 }}>
                <Table size={isMobile ? "small" : "medium"}>
                  <TableBody>
                    <TableRow><TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>File Name</TableCell><TableCell>{selectedDoc.file_name || '—'}</TableCell></TableRow>
                    <TableRow><TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Title</TableCell><TableCell>{selectedDoc.title || '—'}</TableCell></TableRow>
                    <TableRow><TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Description</TableCell><TableCell>{selectedDoc.description || 'No description'}</TableCell></TableRow>
                    <TableRow><TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Document Type</TableCell><TableCell>{getDocumentTypeName(selectedDoc)}</TableCell></TableRow>
                    <TableRow><TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>File Size</TableCell><TableCell>{formatFileSize(selectedDoc.file_size)}</TableCell></TableRow>
                    <TableRow><TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>MIME Type</TableCell><TableCell>{selectedDoc.mime_type || 'Unknown'}</TableCell></TableRow>
                    <TableRow><TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Uploaded By</TableCell><TableCell>{selectedDoc.uploaded_by_name || 'Unknown'}</TableCell></TableRow>
                    <TableRow><TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Uploaded At</TableCell><TableCell>{formatDate(selectedDoc.uploaded_at)}</TableCell></TableRow>
                    {selectedDoc.ocr_processed_at && (
                      <TableRow><TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>OCR Processed</TableCell><TableCell>{formatDate(selectedDoc.ocr_processed_at)}</TableCell></TableRow>
                    )}
                    {selectedDoc.ocr_language && (
                      <TableRow><TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>OCR Language</TableCell><TableCell>{selectedDoc.ocr_language}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            
            {/* OCR Text Tab */}
            {previewTab === 2 && selectedDoc?.ocr_text && (
              <Box sx={{ p: 3 }}>
                <Paper variant="outlined" sx={{ p: 2, maxHeight: 500, overflow: 'auto' }}>
                  <Typography variant="subtitle2" gutterBottom>Extracted Text:</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedDoc.ocr_text}
                  </Typography>
                </Paper>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePreview}>Close</Button>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => handleDownload(selectedDoc)}>Download</Button>
          </DialogActions>
        </Dialog>

        {/* Upload Dialog with OCR Option */}
        <Dialog open={uploadDialogOpen} onClose={() => !uploading && setUploadDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700}>Upload Document</Typography>
              <IconButton onClick={() => !uploading && setUploadDialogOpen(false)} size="small"><CloseIcon /></IconButton>
            </Stack>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3 }}>
            <Stack spacing={3}>
              <Button variant="outlined" component="label" startIcon={<UploadIcon />} fullWidth sx={{ py: isMobile ? 2 : 3, borderStyle: 'dashed' }} disabled={uploading}>
                {selectedFile ? 'Change File' : 'Select File'}
                <input type="file" hidden onChange={handleFileSelect} disabled={uploading} ref={fileInputRef} accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp,.doc,.docx,.txt" />
              </Button>
              
              {selectedFile && (
                <Card variant="outlined" sx={{ bgcolor: '#f8fafc' }}>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      {getFileIcon(selectedFile.name, selectedFile.type)}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={500}>{selectedFile.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatFileSize(selectedFile.size)}</Typography>
                      </Box>
                      {!uploading && <IconButton size="small" onClick={() => setSelectedFile(null)}><CloseIcon fontSize="small" /></IconButton>}
                    </Stack>
                  </CardContent>
                </Card>
              )}
              
              {uploading && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}><Typography variant="caption">Uploading...</Typography><Typography variant="caption">{uploadProgress}%</Typography></Stack>
                  <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 6, borderRadius: 3 }} />
                </Box>
              )}
              
              {selectedFile && <TextField fullWidth label="Document Title *" value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} disabled={uploading} required />}
              
              {selectedFile && documentTypes.length > 0 && (
                <FormControl fullWidth>
                  <InputLabel>Document Type *</InputLabel>
                  <Select value={selectedDocumentTypeId} label="Document Type *" onChange={(e) => setSelectedDocumentTypeId(e.target.value)} disabled={uploading}>
                    {documentTypes.map((type) => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              
              <TextField fullWidth label="Description (Optional)" multiline rows={isMobile ? 2 : 3} value={fileDescription} onChange={(e) => setFileDescription(e.target.value)} disabled={uploading} placeholder="Add notes about this document..." />
              
              {/* OCR Option */}
              {selectedFile && isOcrCompatible(selectedFile) && (
                <Card variant="outlined" sx={{ bgcolor: '#f0fdf4', borderRadius: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={<Switch checked={enableOCR} onChange={(e) => setEnableOCR(e.target.checked)} disabled={uploading} color="primary" />}
                        label={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <ScanIcon color="primary" />
                            <Typography variant="body2" fontWeight={500}>Enable OCR (Text Recognition)</Typography>
                          </Stack>
                        }
                      />
                      {enableOCR && (
                        <>
                          <FormControl fullWidth size="small">
                            <InputLabel>OCR Language</InputLabel>
                            <Select value={ocrLanguage} label="OCR Language" onChange={(e) => setOcrLanguage(e.target.value)} disabled={uploading}>
                              {ocrLanguages.map((lang) => <MenuItem key={lang.code} value={lang.code}>{lang.name}</MenuItem>)}
                            </Select>
                            <FormHelperText>Select the language of the text in your document</FormHelperText>
                          </FormControl>
                          <Alert severity="info" icon={<InfoIcon />}>
                            <Typography variant="caption">
                              OCR will extract text from your {selectedFile.type.includes('pdf') ? 'PDF' : 'image'} document, 
                              making it searchable and selectable. This process may take a few moments.
                            </Typography>
                          </Alert>
                        </>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUploadDialogOpen(false)} disabled={uploading}>Cancel</Button>
            <Button variant="contained" onClick={handleUpload} disabled={uploading || !selectedFile || !fileTitle.trim() || !selectedDocumentTypeId} startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2 }}>{snackbar.message}</Alert>
        </Snackbar>
      </Box>
    </Fade>
  );
};

export default MeetingDocuments;