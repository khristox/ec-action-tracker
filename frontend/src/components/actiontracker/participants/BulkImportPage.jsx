// src/components/actiontracker/participants/BulkImportPage.jsx
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, LinearProgress,
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip,
  Card, Stepper, Step, StepLabel,
  Breadcrumbs, Link, useMediaQuery, useTheme,
  Collapse, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControlLabel, Switch
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const formatErrorMessage = (error) => {
  if (!error) return 'Unknown error occurred';
  if (typeof error === 'string') return error;
  if (Array.isArray(error)) {
    return error.map(err => {
      if (typeof err === 'string') return err;
      if (err.msg) {
        const field = err.loc ? err.loc.filter(l => l !== 'body').join(' → ') : '';
        return field ? `${field}: ${err.msg}` : err.msg;
      }
      return JSON.stringify(err);
    }).join(' · ');
  }
  if (error.message) return error.message;
  if (error.detail) {
    if (typeof error.detail === 'string') return error.detail;
    if (Array.isArray(error.detail)) {
      return error.detail.map(d => d.msg || d).join(' · ');
    }
  }
  return String(error);
};

const BulkImportPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [expandedRows, setExpandedRows] = useState({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewOptions, setPreviewOptions] = useState({
    skipDuplicates: true,
    updateExisting: false
  });

  const steps = ['Upload CSV', 'Preview & Validate', 'Confirm Import'];

  const handleFileSelect = useCallback(async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    const validTypes = ['text/csv', 'application/vnd.ms-excel'];
    const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(selectedFile.type) && fileExtension !== 'csv') {
      setError('Please select a valid CSV file');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size should be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setError(null);
    await previewImport(selectedFile);
  }, []);

  const previewImport = async (selectedFile) => {
    if (!selectedFile) return;
    
    setLoading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await api.post('/action-tracker/participants/import/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      });
      
      setPreview(response.data);
      setError(null);
      setActiveStep(1);
    } catch (err) {
      console.error('Preview error:', err);
      const errorMessage = err.response?.data?.detail || err.message;
      setError(formatErrorMessage(errorMessage));
      setActiveStep(0);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    
    setImporting(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('skip_duplicates', previewOptions.skipDuplicates);
    formData.append('update_existing', previewOptions.updateExisting);

    try {
      const response = await api.post('/action-tracker/participants/import/execute', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      });
      
      setSuccess({
        imported: response.data.successfully_imported || response.data.created || 0,
        updated: response.data.updated || 0,
        failed: response.data.failed || 0,
        skipped: response.data.skipped || 0,
        total: response.data.total_processed || response.data.total || 0,
        errors: response.data.errors || []
      });
      setActiveStep(2);
      setShowConfirmDialog(false);
    } catch (err) {
      console.error('Import error:', err);
      const errorMessage = err.response?.data?.detail || err.message;
      setError(formatErrorMessage(errorMessage));
    } finally {
      setImporting(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/action-tracker/participants/import/template', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'participant_import_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download template:', error);
      setError('Failed to download template. Please try again.');
    }
  };

  const toggleRowExpanded = (rowNumber) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowNumber]: !prev[rowNumber]
    }));
  };

  const handleReset = () => {
    setFile(null);
    setFileName('');
    setPreview(null);
    setError(null);
    setSuccess(null);
    setActiveStep(0);
    setExpandedRows({});
  };

  const stats = React.useMemo(() => {
    if (!preview) return null;
    return {
      total: preview.total_rows || preview.total || 0,
      valid: preview.valid_rows || preview.valid || 0,
      invalid: preview.invalid_rows || preview.invalid || 0,
      warnings: preview.warnings || 0
    };
  }, [preview]);

  return (
    <Box sx={{ p: isMobile ? 2 : 3, minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link 
          underline="hover"
          color="inherit" 
          onClick={() => navigate('/participants')}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
        >
          <HomeIcon fontSize="small" />
          Participants
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CloudUploadIcon fontSize="small" />
          Bulk Import
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700}>
            Bulk Import Participants
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Import multiple participants at once using CSV file format
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/participants')}
        >
          Back to Participants
        </Button>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4, overflowX: 'auto' }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Loading indicator */}
      {(loading || importing) && (
        <Box sx={{ width: '100%', mb: 3 }}>
          <LinearProgress 
            variant={uploadProgress > 0 ? "determinate" : "indeterminate"} 
            value={uploadProgress}
            sx={{ borderRadius: 1, height: 8 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {loading ? 'Processing file...' : `Importing... ${uploadProgress}%`}
          </Typography>
        </Box>
      )}

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <IconButton color="inherit" size="small" onClick={() => setError(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {error}
        </Alert>
      )}

      {/* Step 1: Upload */}
      {activeStep === 0 && (
        <Card sx={{ 
          p: { xs: 3, sm: 4, md: 6 }, 
          textAlign: 'center',
          bgcolor: 'background.paper',
          borderRadius: 3,
          border: '1px dashed',
          borderColor: 'divider'
        }}>
          <DescriptionIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2, opacity: 0.7 }} />
          <Typography variant="h5" gutterBottom fontWeight={600}>
            Upload CSV File
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Download the template, fill it with your data, and upload it here
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={downloadTemplate}
            >
              Download Template
            </Button>
            
            <Button
              variant="contained"
              component="label"
              startIcon={<UploadIcon />}
            >
              Select CSV File
              <input type="file" hidden accept=".csv" onChange={handleFileSelect} />
            </Button>
          </Box>

          {fileName && (
            <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
              Selected file: <strong>{fileName}</strong>
            </Alert>
          )}
        </Card>
      )}

      {/* Step 2: Preview */}
      {activeStep === 1 && preview && (
        <>
          {/* Preview Options */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Import Options
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={previewOptions.skipDuplicates}
                    onChange={(e) => setPreviewOptions(prev => ({ ...prev, skipDuplicates: e.target.checked }))}
                    size="small"
                  />
                }
                label="Skip duplicate entries"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={previewOptions.updateExisting}
                    onChange={(e) => setPreviewOptions(prev => ({ ...prev, updateExisting: e.target.checked }))}
                    size="small"
                  />
                }
                label="Update existing participants"
              />
            </Box>
          </Paper>

          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main" fontWeight={700}>
                  {stats.total}
                </Typography>
                <Typography variant="caption" color="text.secondary">Total Rows</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h3" color="success.main" fontWeight={700}>
                  {stats.valid}
                </Typography>
                <Typography variant="caption" color="text.secondary">Valid</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h3" color="error.main" fontWeight={700}>
                  {stats.invalid}
                </Typography>
                <Typography variant="caption" color="text.secondary">Invalid</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h3" sx={{ color: 'warning.main' }} fontWeight={700}>
                  {stats.warnings}
                </Typography>
                <Typography variant="caption" color="text.secondary">Warnings</Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Warning */}
          {stats.invalid > 0 && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }} icon={<WarningIcon />}>
              Found <strong>{stats.invalid}</strong> rows with validation errors. 
              Please review and fix these rows before importing.
            </Alert>
          )}

          {/* Data Preview Table */}
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Data Preview
          </Typography>
          
          <TableContainer component={Paper} sx={{ maxHeight: 500, borderRadius: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 60 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(preview.preview || []).map((row) => (
                  <React.Fragment key={row.row_number}>
                    <TableRow hover sx={{ bgcolor: row.is_valid ? 'inherit' : 'error.lighter' }}>
                      <TableCell>{row.row_number}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{row.data?.name || '-'}</TableCell>
                      <TableCell>{row.data?.email || '-'}</TableCell>
                      <TableCell>
                        {row.is_valid ? (
                          <Chip label="Valid" size="small" color="success" icon={<CheckCircleIcon />} />
                        ) : (
                          <Chip label="Invalid" size="small" color="error" icon={<ErrorIcon />} />
                        )}
                      </TableCell>
                      <TableCell>
                        {(row.errors?.length > 0 || row.warnings?.length > 0) && (
                          <IconButton size="small" onClick={() => toggleRowExpanded(row.row_number)}>
                            {expandedRows[row.row_number] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 0 }}>
                        <Collapse in={expandedRows[row.row_number]} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                            {row.errors?.length > 0 && (
                              <>
                                <Typography variant="caption" color="error" fontWeight={600}>Errors:</Typography>
                                {row.errors.map((err, idx) => (
                                  <Typography key={idx} variant="caption" color="error" display="block" sx={{ ml: 2 }}>
                                    • {err}
                                  </Typography>
                                ))}
                              </>
                            )}
                            {row.warnings?.length > 0 && (
                              <>
                                <Typography variant="caption" color="warning.main" fontWeight={600} sx={{ mt: 1, display: 'block' }}>
                                  Warnings:
                                </Typography>
                                {row.warnings.map((warn, idx) => (
                                  <Typography key={idx} variant="caption" color="warning.main" display="block" sx={{ ml: 2 }}>
                                    • {warn}
                                  </Typography>
                                ))}
                              </>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button onClick={handleReset} startIcon={<RefreshIcon />}>
              Start Over
            </Button>
            <Button
              variant="contained"
              onClick={() => setShowConfirmDialog(true)}
              disabled={stats.valid === 0 || importing}
            >
              Continue to Import
            </Button>
          </Box>
        </>
      )}

      {/* Step 3: Complete */}
      {activeStep === 2 && success && (
        <Card sx={{ p: { xs: 3, sm: 4, md: 5 }, textAlign: 'center', borderRadius: 3 }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom fontWeight={700}>
            Import Complete!
          </Typography>
          
          <Paper sx={{ p: 3, mb: 4, display: 'inline-block', textAlign: 'left', bgcolor: 'background.default', minWidth: { xs: '100%', sm: 300 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="success.main" fontWeight={600}>✅ Successfully imported:</Typography>
              <Typography variant="h6" color="success.main" fontWeight={700}>{success.imported}</Typography>
            </Box>
            {success.updated > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="info.main" fontWeight={600}>🔄 Updated:</Typography>
                <Typography variant="h6" color="info.main" fontWeight={700}>{success.updated}</Typography>
              </Box>
            )}
            {success.skipped > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="warning.main" fontWeight={600}>⏭️ Skipped:</Typography>
                <Typography variant="h6" color="warning.main" fontWeight={700}>{success.skipped}</Typography>
              </Box>
            )}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="error.main" fontWeight={600}>❌ Failed:</Typography>
              <Typography variant="h6" color="error.main" fontWeight={700}>{success.failed}</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.primary" fontWeight={600}>📊 Total processed:</Typography>
              <Typography variant="h6" color="text.primary" fontWeight={700}>{success.total}</Typography>
            </Box>
          </Paper>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={handleReset} startIcon={<RefreshIcon />}>
              Import Another
            </Button>
            <Button variant="contained" onClick={() => navigate('/participants')} startIcon={<VisibilityIcon />}>
              View Participants
            </Button>
          </Box>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6" fontWeight={600}>Confirm Import</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            You are about to import <strong>{stats?.valid || 0}</strong> participants.
          </Typography>
          {previewOptions.skipDuplicates && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Duplicate entries will be skipped.
            </Alert>
          )}
          {previewOptions.updateExisting && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Existing participants will be updated with new information.
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This action cannot be undone. Please verify your data before proceeding.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button onClick={handleImport} variant="contained" disabled={importing}>
            {importing ? 'Importing...' : 'Confirm Import'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkImportPage;