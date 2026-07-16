// src/components/actiontracker/meetings/components/EditActionDialog.jsx

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Box,
  useTheme,
  alpha,
  FormHelperText
} from '@mui/material';
import { 
  Close, 
  Save, 
  Assignment as AssignmentIcon,
  Edit,
  Warning as WarningIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { updateAction } from '../../../../store/slices/actionTracker/actionSlice';
import { format, isValid, parseISO } from 'date-fns';

// Validation helper
const validateForm = (data) => {
  const errors = {};

  if (!data.description || !data.description.trim()) {
    errors.description = 'Description is required';
  } else if (data.description.trim().length < 3) {
    errors.description = 'Description must be at least 3 characters';
  } else if (data.description.trim().length > 500) {
    errors.description = 'Description must be less than 500 characters';
  }

  if (data.due_date) {
    try {
      const date = new Date(data.due_date);
      if (!isValid(date)) {
        errors.due_date = 'Invalid date format';
      } else if (date < new Date()) {
        errors.due_date = 'Due date must be in the future';
      }
    } catch (e) {
      errors.due_date = 'Invalid date format';
    }
  }

  if (!data.priority || ![1, 2, 3, 4].includes(Number(data.priority))) {
    errors.priority = 'Please select a valid priority';
  }

  if (data.remarks && data.remarks.length > 1000) {
    errors.remarks = 'Remarks must be less than 1000 characters';
  }

  return errors;
};

const EditActionDialog = ({ open, action, onClose, onSave }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const dispatch = useDispatch();
  
  const [formData, setFormData] = useState({
    description: '',
    remarks: '',
    due_date: '',
    priority: 2
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [actionNotFound, setActionNotFound] = useState(false);

  // Load action data when dialog opens
  useEffect(() => {
    if (action && open) {
      // Check if action has an ID
      if (!action.id) {
        setError('Action ID is missing. Please refresh and try again.');
        setActionNotFound(true);
        return;
      }

      // Reset states
      setActionNotFound(false);
      setError(null);
      setValidationErrors({});
      setTouched({});

      // Format the due date properly
      let dueDate = '';
      if (action.due_date) {
        try {
          const date = typeof action.due_date === 'string' 
            ? parseISO(action.due_date) 
            : new Date(action.due_date);
          if (isValid(date)) {
            dueDate = format(date, 'yyyy-MM-dd');
          }
        } catch (e) {
          console.warn('Invalid due date format:', action.due_date);
        }
      }

      setFormData({
        description: action.description || '',
        remarks: action.remarks || '',
        due_date: dueDate,
        priority: action.priority || 2
      });
    }
  }, [action, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setTouched(prev => ({ ...prev, [name]: true }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (error && !error.includes('not found')) setError(null);
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const errors = validateForm({ ...formData, [name]: formData[name] });
    if (errors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: errors[name] }));
    }
  };

  const handleRefresh = () => {
    // Close and reopen the dialog to reload the action data
    if (onClose) onClose();
    // Small delay then reopen
    setTimeout(() => {
      setActionNotFound(false);
      setError(null);
    }, 300);
  };

  const handleSubmit = async () => {
    // Check if action exists
    if (!action || !action.id) {
      setError('Action ID is missing. Please refresh and try again.');
      return;
    }

    

    // Validate all fields
    const errors = validateForm(formData);
    setValidationErrors(errors);
    
    const allTouched = Object.keys(formData).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setTouched(allTouched);

    if (Object.keys(errors).length > 0) {
      setError('Please fix the validation errors before saving');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        description: formData.description.trim(),
        remarks: formData.remarks?.trim() || '',
        due_date: formData.due_date || null,
        priority: parseInt(formData.priority)
      };

      console.log('📤 Updating action with payload:', payload);
      console.log('📤 Action ID:', action.id);

      const result = await dispatch(updateAction({ 
        id: action.id, 
        actionData: payload 
      })).unwrap();
      
      console.log('✅ Action updated successfully:', result);
      
      if (onSave) onSave();
      onClose();
    } catch (err) {
      console.error('❌ Error updating action:', err);
      
      // Check if it's a 404 error
      if (err.response?.status === 404) {
        setActionNotFound(true);
        setError('This action no longer exists. It may have been deleted by another user.');
        return;
      }
      
      // Parse other error messages
      let errorMsg = 'Failed to update action. ';
      if (err.response?.status === 422) {
        if (err.response?.data?.detail) {
          if (Array.isArray(err.response.data.detail)) {
            errorMsg += err.response.data.detail.map(d => d.msg || d).join('. ');
          } else {
            errorMsg += err.response.data.detail;
          }
        } else {
          errorMsg += 'Please check your input and try again.';
        }
      } else if (err.response?.data?.message) {
        errorMsg += err.response.data.message;
      } else if (err.message) {
        errorMsg += err.message;
      } else {
        errorMsg += 'Please try again later.';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      1: '🔴 High - Urgent',
      2: '🟠 Medium - Normal',
      3: '🟢 Low - Flexible',
      4: '⚪ Very Low - Info Only'
    };
    return labels[priority] || labels[2];
  };

  const isFormValid = () => {
    const errors = validateForm(formData);
    return Object.keys(errors).length === 0 && formData.description.trim().length > 0 && !actionNotFound;
  };

  // Dark mode styles
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
      '& fieldset': {
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0,0,0,0.12)',
      },
      '&:hover fieldset': {
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0,0,0,0.2)',
      },
      '&.Mui-focused fieldset': {
        borderColor: isDarkMode ? '#60A5FA' : 'primary.main',
      },
      '&.Mui-error fieldset': {
        borderColor: isDarkMode ? '#F87171' : 'error.main',
      }
    },
    '& .MuiInputLabel-root': {
      color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: isDarkMode ? '#60A5FA' : 'primary.main',
    },
    '& .MuiInputBase-input': {
      color: isDarkMode ? '#FFFFFF' : 'inherit',
    },
    '& .MuiFormHelperText-root': {
      color: isDarkMode ? '#9CA3AF' : 'inherit',
    }
  };

  const selectSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
      '& fieldset': {
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0,0,0,0.12)',
      },
      '&:hover fieldset': {
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0,0,0,0.2)',
      },
      '&.Mui-focused fieldset': {
        borderColor: isDarkMode ? '#60A5FA' : 'primary.main',
      }
    },
    '& .MuiInputLabel-root': {
      color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: isDarkMode ? '#60A5FA' : 'primary.main',
    },
    '& .MuiSelect-select': {
      color: isDarkMode ? '#FFFFFF' : 'inherit',
    },
    '& .MuiSelect-icon': {
      color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'inherit',
    }
  };

  // If action not found, show error state
  if (actionNotFound) {
    return (
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="sm" 
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundImage: 'none',
              bgcolor: isDarkMode ? '#1F2937' : 'background.paper',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
              borderRadius: 2,
              p: 3,
            }
          }
        }}
      >
        <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
          <WarningIcon sx={{ fontSize: 64, color: '#EF4444' }} />
          <Typography variant="h6" fontWeight={600} color={isDarkMode ? '#F3F4F6' : 'text.primary'}>
            Action Not Found
          </Typography>
          <Typography variant="body2" color={isDarkMode ? '#9CA3AF' : 'text.secondary'} align="center">
            This action may have been deleted or you don't have permission to edit it.
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={onClose}>
              Close
            </Button>
            <Button 
              variant="contained" 
              startIcon={<RefreshIcon />}
              onClick={() => {
                setActionNotFound(false);
                setError(null);
                if (onClose) onClose();
                // Reopen after a delay
                setTimeout(() => {
                  // This will trigger a re-fetch of the action data
                  if (onSave) onSave();
                }, 100);
              }}
              sx={{ bgcolor: isDarkMode ? '#3b82f6' : 'primary.main' }}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>
      </Dialog>
    );
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      slotProps={{
        paper: {
          sx: {
            backgroundImage: 'none',
            bgcolor: isDarkMode ? '#1F2937' : 'background.paper',
            border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
            boxShadow: isDarkMode 
              ? '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)' 
              : theme.shadows[16],
            borderRadius: 2,
          }
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: 1.5, 
        pt: 2.5,
        borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700} color={isDarkMode ? '#f3f4f6' : 'text.primary'}>
            Edit Action Item
          </Typography>
          <IconButton 
            onClick={onClose} 
            size="small"
            sx={{ 
              color: isDarkMode ? 'grey.400' : 'text.secondary',
              '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
            }}
          >
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3 }}>
        {/* Error Alert */}
        {error && (
          <Alert 
            severity={error.includes('not found') ? 'warning' : 'error'} 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : undefined,
              color: isDarkMode ? '#F87171' : undefined,
              '& .MuiAlert-icon': {
                color: isDarkMode ? '#F87171' : undefined,
              }
            }} 
            onClose={() => setError(null)}
            icon={error.includes('not found') ? <WarningIcon /> : undefined}
            action={
              error.includes('not found') ? (
                <Button color="inherit" size="small" onClick={handleRefresh} startIcon={<RefreshIcon />}>
                  Refresh
                </Button>
              ) : null
            }
          >
            {error}
          </Alert>
        )}

        {/* Action Info Card */}
        <Box 
          sx={{ 
            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc', 
            p: 2.5, 
            borderRadius: '12px', 
            border: '1px solid',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0', 
            mb: 4,
          }}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <AssignmentIcon 
              sx={{ 
                mt: 0.5, 
                color: isDarkMode ? '#60a5fa' : theme.palette.primary.main
              }} 
            />
            <Box flex={1}>
              <Typography variant="caption" fontWeight={600} color={isDarkMode ? 'grey.400' : 'text.secondary'}>
                Current Action
              </Typography>
              <Typography 
                variant="body2" 
                fontWeight={500} 
                color={isDarkMode ? '#f3f4f6' : 'text.primary'} 
                sx={{ mt: 0.5, lineHeight: 1.6 }}
              >
                {action?.description || 'No description'}
              </Typography>
              
              <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap" gap={1}>
                {action?.due_date && (
                  <Typography variant="caption" color={isDarkMode ? 'grey.400' : 'text.secondary'}>
                    📅 Original Due: <strong>{format(new Date(action.due_date), 'MMM d, yyyy')}</strong>
                  </Typography>
                )}
                {action?.priority && (
                  <Typography variant="caption" color={isDarkMode ? 'grey.400' : 'text.secondary'}>
                    ⚡ Priority: <strong>{getPriorityLabel(action.priority)}</strong>
                  </Typography>
                )}
                {action?.id && (
                  <Typography variant="caption" color={isDarkMode ? 'grey.500' : 'text.disabled'}>
                    ID: {action.id.substring(0, 8)}...
                  </Typography>
                )}
              </Stack>
            </Box>
            <Edit sx={{ color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }} fontSize="small" />
          </Stack>
        </Box>

        {/* Form Fields */}
        <Stack spacing={3}>
          <TextField
            fullWidth
            label="Description *"
            name="description"
            value={formData.description}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            multiline
            rows={3}
            placeholder="Update action description..."
            error={touched.description && !!validationErrors.description}
            helperText={touched.description && validationErrors.description}
            disabled={loading}
            sx={inputSx}
          />

          <TextField
            fullWidth
            label="Remarks / Notes"
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            onBlur={handleBlur}
            multiline
            rows={2}
            placeholder="Update remarks..."
            error={touched.remarks && !!validationErrors.remarks}
            helperText={touched.remarks && validationErrors.remarks}
            disabled={loading}
            sx={inputSx}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Due Date"
                name="due_date"
                type="date"
                value={formData.due_date}
                onChange={handleChange}
                onBlur={handleBlur}
                helperText={touched.due_date && validationErrors.due_date ? validationErrors.due_date : 'Select new due date (optional)'}
                error={touched.due_date && !!validationErrors.due_date}
                InputLabelProps={{ shrink: true }}
                disabled={loading}
                sx={inputSx}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl 
                fullWidth 
                error={touched.priority && !!validationErrors.priority}
              >
                <InputLabel sx={{ color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit' }}>
                  Priority
                </InputLabel>
                <Select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  label="Priority"
                  disabled={loading}
                  sx={selectSx}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
                        border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        '& .MuiMenuItem-root': {
                          color: isDarkMode ? '#FFFFFF' : 'inherit',
                          '&:hover': {
                            bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                          },
                          '&.Mui-selected': {
                            bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.15)' : 'rgba(25, 118, 210, 0.08)',
                          }
                        }
                      }
                    }
                  }}
                >
                  <MenuItem value={1}>🔴 High - Urgent</MenuItem>
                  <MenuItem value={2}>🟠 Medium - Normal</MenuItem>
                  <MenuItem value={3}>🟢 Low - Flexible</MenuItem>
                  <MenuItem value={4}>⚪ Very Low - Info Only</MenuItem>
                </Select>
                {touched.priority && validationErrors.priority && (
                  <FormHelperText>{validationErrors.priority}</FormHelperText>
                )}
              </FormControl>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ 
        p: 3, 
        pt: 2, 
        gap: 1,
        borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
      }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          sx={{ 
            color: isDarkMode ? 'grey.300' : 'text.secondary',
            '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !isFormValid()}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            bgcolor: isDarkMode ? '#3b82f6' : theme.palette.primary.main,
            '&:hover': {
              bgcolor: isDarkMode ? '#2563eb' : theme.palette.primary.dark,
            },
            '&.Mui-disabled': {
              bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : undefined,
            }
          }}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditActionDialog;