// src/components/actiontracker/participants/BulkImportPage.jsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, LinearProgress, 
  Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Chip, IconButton, Tooltip,
  Card, CardContent, Stepper, Step, StepLabel,
  Breadcrumbs, Link, useMediaQuery, useTheme
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
  Description as DescriptionIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const BulkImportPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Upload CSV', 'Preview Data', 'Confirm Import'];

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      previewImport(selectedFile);
      setActiveStep(1);
    } else {
      setError('Please select a valid CSV file');
    }
  };

  const previewImport = async (selectedFile) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      const response = await api.post('/action-tracker/participants/import/preview', formData);
      setPreview(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to preview import');
      setActiveStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('skip_duplicates', 'true');
    
    try {
      const response = await api.post('/action-tracker/participants/import/execute', formData);
      setSuccess({
        imported: response.data.successfully_imported,
        failed: response.data.failed,
        total: response.data.total_processed
      });
      setActiveStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to import');
    } finally {
      setImporting(false);
    }
  };

const downloadTemplate = async () => {
  try {
    const response = await api.get('/action-tracker/participants/import/template', {
      responseType: 'blob'  // Important for file download
    });
    
    // Create a blob link to download
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
  }
};


  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setSuccess(null);
    setActiveStep(0);
  };

  const handleDone = () => {
    navigate('/participants');
  };

  return (
    <Box sx={{ p: isMobile ? 2 : 3 }}>
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link 
          color="inherit" 
          href="/participants" 
          onClick={(e) => { e.preventDefault(); navigate('/participants'); }}
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700}>
            Bulk Import Participants
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Import multiple participants at once using CSV file
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

      {/* Step 1: Upload */}
      {activeStep === 0 && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <DescriptionIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Upload CSV File
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Download the template, fill it with your data, and upload it here
          </Typography>
          
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
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
          
          {error && (
            <Alert severity="error" sx={{ mt: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Card>
      )}

      {/* Step 2: Preview */}
      {activeStep === 1 && (
        <>
          {loading && <LinearProgress sx={{ mb: 2 }} />}
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {preview && (
            <>
              <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8fafc' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Import Summary
                </Typography>
                <Box display="flex" gap={3} flexWrap="wrap">
                  <Box>
                    <Typography variant="h4" color="primary">
                      {preview.total_rows}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Total Rows</Typography>
                  </Box>
                  <Box>
                    <Typography variant="h4" color="success.main">
                      {preview.valid_rows}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Valid</Typography>
                  </Box>
                  <Box>
                    <Typography variant="h4" color="error.main">
                      {preview.invalid_rows}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Invalid</Typography>
                  </Box>
                </Box>
              </Paper>
              
              <Typography variant="subtitle1" gutterBottom>
                Data Preview (first 50 rows)
              </Typography>
              
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Organization</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.preview?.map((row) => (
                      <TableRow key={row.row_number}>
                        <TableCell>{row.row_number}</TableCell>
                        <TableCell>{row.data?.name}</TableCell>
                        <TableCell>{row.data?.email}</TableCell>
                        <TableCell>{row.data?.organization}</TableCell>
                        <TableCell>
                          {row.is_valid ? (
                            <Chip label="Valid" size="small" color="success" icon={<CheckCircleIcon />} />
                          ) : (
                            <Tooltip title={row.errors?.join(', ')}>
                              <Chip label="Invalid" size="small" color="error" icon={<ErrorIcon />} />
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
                <Button onClick={handleReset}>
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleImport}
                  disabled={preview.valid_rows === 0 || importing}
                >
                  {importing ? 'Importing...' : `Import ${preview.valid_rows} Participants`}
                </Button>
              </Box>
            </>
          )}
        </>
      )}

      {/* Step 3: Complete */}
      {activeStep === 2 && success && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Import Complete!
          </Typography>
          
          <Paper sx={{ p: 2, mb: 3, display: 'inline-block', textAlign: 'left' }}>
            <Typography variant="body1">
              ✅ Successfully imported: <strong>{success.imported}</strong>
            </Typography>
            <Typography variant="body1" color="error">
              ❌ Failed: <strong>{success.failed}</strong>
            </Typography>
            <Typography variant="body1">
              📊 Total processed: <strong>{success.total}</strong>
            </Typography>
          </Paper>
          
          <Box display="flex" gap={2} justifyContent="center">
            <Button variant="outlined" onClick={handleReset}>
              Import Another
            </Button>
            <Button variant="contained" onClick={handleDone}>
              View Participants
            </Button>
          </Box>
        </Card>
      )}
    </Box>
  );
};

export default BulkImportPage;