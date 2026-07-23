// src/components/actiontracker/actions/UpdateProgress.jsx

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Paper, Typography, Box, Button, TextField,
  Slider, MenuItem, Alert, CircularProgress, Stack, Card,
  Chip, IconButton, Tooltip, Fade,
  InputAdornment, useTheme, Grid, Divider
} from '@mui/material';
import {
  TrendingUp, Save, ArrowBack, CheckCircle, Cancel,
  Pending, Schedule, PlayCircle, TaskAlt, Error as ErrorIcon,
  PriorityHigh, AccessTime, Comment, Assignment, Refresh
} from '@mui/icons-material';
import api from '../../../services/api';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    icon: <Pending fontSize="small" />
  },
  in_progress: {
    label: 'In Progress',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    icon: <PlayCircle fontSize="small" />
  },
  inprogress: {
    label: 'In Progress',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    icon: <PlayCircle fontSize="small" />
  },
  completed: {
    label: 'Completed',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    icon: <CheckCircle fontSize="small" />
  },
  overdue: {
    label: 'Overdue',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    icon: <ErrorIcon fontSize="small" />
  },
  on_hold: {
    label: 'On Hold',
    color: '#9CA3AF',
    bgColor: 'rgba(156, 163, 175, 0.15)',
    icon: <Schedule fontSize="small" />
  },
  onhold: {
    label: 'On Hold',
    color: '#9CA3AF',
    bgColor: 'rgba(156, 163, 175, 0.15)',
    icon: <Schedule fontSize="small" />
  },
  cancelled: {
    label: 'Cancelled',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    icon: <Cancel fontSize="small" />
  }
};

const FALLBACK_STATUSES = [
  { id: 'pending', name: 'Pending', value: 'pending', short_name: 'pending' },
  { id: 'in_progress', name: 'In Progress', value: 'in_progress', short_name: 'in_progress' },
  { id: 'completed', name: 'Completed', value: 'completed', short_name: 'completed' },
  { id: 'overdue', name: 'Overdue', value: 'overdue', short_name: 'overdue' },
  { id: 'on_hold', name: 'On Hold', value: 'on_hold', short_name: 'on_hold' },
  { id: 'cancelled', name: 'Cancelled', value: 'cancelled', short_name: 'cancelled' }
];

const PRIORITY_CONFIG = {
  1: { label: 'High', color: '#EF4444', icon: <PriorityHigh fontSize="small" /> },
  2: { label: 'Medium', color: '#F59E0B', icon: <Schedule fontSize="small" /> },
  3: { label: 'Low', color: '#10B981', icon: <CheckCircle fontSize="small" /> },
  4: { label: 'Very Low', color: '#9CA3AF', icon: <TaskAlt fontSize="small" /> }
};

const QUICK_OPTIONS = [0, 25, 50, 75, 100];

const UpdateProgress = forwardRef(({
  actionId: propActionId,
  onSuccess,
  onCancel,
  embedded = false,
  statusOptions = null,
}, ref) => {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const formRef = useRef(null);

  const actionId = propActionId || paramId;

  const effectiveStatuses = (statusOptions && statusOptions.length > 0)
    ? statusOptions
    : FALLBACK_STATUSES;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [action, setAction] = useState(null);
  const [formData, setFormData] = useState({
    overall_progress_percentage: 0,
    overall_status_id: '',
    remarks: ''
  });
  const [touched, setTouched] = useState(false);

  useImperativeHandle(ref, () => ({
    submitForm: () => {
      formRef.current?.requestSubmit();
    },
    isLoading: loading,
  }), [loading]);

  useEffect(() => {
    if (actionId) {
      fetchActionData();
    }
  }, [actionId, statusOptions]);

  const fetchActionData = async () => {
    try {
      setFetching(true);
      setError(null);

      const actionRes = await api.get(`/action-tracker/actions/${actionId}`);
      const actionData = actionRes.data;
      setAction(actionData);

      const statusId = actionData.overall_status_id || '';
      const statusExists = effectiveStatuses.some(s => s.id === statusId);
      const defaultStatusId = statusExists
        ? statusId
        : (effectiveStatuses[0]?.id || '');

      setFormData({
        overall_progress_percentage: actionData.overall_progress_percentage || 0,
        overall_status_id: defaultStatusId,
        remarks: actionData.remarks || ''
      });

      if (statusId && !statusExists && !embedded) {
        setError(`The current status could not be matched to an available option.`);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      if (!embedded) {
        setError('Failed to load action data. Please try again.');
      }
    } finally {
      setFetching(false);
    }
  };

  const handleProgressChange = (e, newValue) => {
    setFormData(prev => ({ ...prev, overall_progress_percentage: newValue }));
    setTouched(true);
  };

  const handleStatusChange = (e) => {
    setFormData(prev => ({ ...prev, overall_status_id: e.target.value }));
    setTouched(true);
    if (error && error.includes('could not be matched')) {
      setError(null);
    }
  };

  const handleQuickProgress = (percentage) => {
    setFormData(prev => ({ ...prev, overall_progress_percentage: percentage }));
    setTouched(true);
  };

  const handleRetry = () => {
    fetchActionData();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.overall_status_id) {
      setError('Please select a status');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        progress_percentage: formData.overall_progress_percentage,
        individual_status_id: formData.overall_status_id,
        remarks: formData.remarks || `Progress updated to ${formData.overall_progress_percentage}%`
      };

      await api.patch(`/action-tracker/actions/${actionId}/progress`, payload);
      setSuccess(true);

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 500);
      } else {
        setTimeout(() => {
          navigate(`/actions/${actionId}`);
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update progress. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const progressValue = formData.overall_progress_percentage || 0;
  const isCompleted = progressValue >= 100;

  const getStatusConfig = (statusId) => {
    if (!statusId) return null;
    const status = effectiveStatuses.find(s => s.id === statusId);
    if (!status) return null;
    const key = status.value?.toLowerCase() || status.short_name?.toLowerCase() || status.name?.toLowerCase() || 'pending';
    const cleanKey = key.replace(/[_\s]/g, '');
    return STATUS_CONFIG[cleanKey] || STATUS_CONFIG[key] || STATUS_CONFIG.pending;
  };

  const priorityConfig = action ? PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG[2] : null;

  const previousStatusObj = action ? effectiveStatuses.find(s => s.id === action.overall_status_id) : null;
  const previousStatusConfig = getStatusConfig(action?.overall_status_id);

  const handleClose = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  if (fetching) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading action details...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      height: '100%',
      overflow: 'auto',
      p: 0,
      m: 0,
      bgcolor: 'transparent',
    }}>
      <Box sx={{
        maxWidth: 850,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        p: embedded ? 0 : 1,
      }}>
        {/* Header - only show when not embedded */}
        {!embedded && (
          <Box sx={{ mb: 1.5, flexShrink: 0, px: 0.5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Tooltip title="Go Back">
                <IconButton
                  onClick={handleClose}
                  size="small"
                  sx={{
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    color: isDarkMode ? '#94A3B8' : 'inherit',
                    '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }
                  }}
                >
                  <ArrowBack />
                </IconButton>
              </Tooltip>
              <Box flex={1}>
                <Typography variant="h6" fontWeight={700} sx={{ color: isDarkMode ? '#F8FAFC' : 'inherit', fontSize: '1.1rem' }}>
                  Update Progress
                </Typography>
              </Box>
              {action && priorityConfig && (
                <Chip
                  icon={priorityConfig.icon}
                  label={`Priority: ${priorityConfig.label}`}
                  size="small"
                  sx={{
                    bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'error.light',
                    color: priorityConfig.color,
                    fontWeight: 600,
                    border: `1px solid ${isDarkMode ? 'rgba(239, 68, 68, 0.2)' : priorityConfig.color}`,
                    '& .MuiChip-icon': { color: priorityConfig.color }
                  }}
                />
              )}
            </Stack>
          </Box>
        )}

        {/* Alerts */}
        <Fade in={success}>
          <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 1.5, mt: 0 }}>
            <Typography variant="subtitle2" fontWeight={600}>Progress updated successfully!</Typography>
          </Alert>
        </Fade>

        {error && !embedded && (
          <Alert 
            severity="warning" 
            sx={{ mb: 1.5, mt: 0 }} 
            onClose={() => setError(null)}
            action={error.includes('Failed to load') ? <Button color="inherit" size="small" onClick={handleRetry} startIcon={<Refresh />}>Retry</Button> : null}
          >
            {error}
          </Alert>
        )}

        {/* Main Form Container */}
        <Paper sx={{ p: 0, borderRadius: 0, bgcolor: 'transparent', boxShadow: 'none' }}>
          <form ref={formRef} onSubmit={handleSubmit}>
            
            {/* SINGLE MASTER CARD CONTAINER */}
            <Card
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2.5,
                bgcolor: isDarkMode ? '#1E293B' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                boxShadow: isDarkMode ? '0 4px 6px -1px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <Stack spacing={2.5}>
                
                {/* Task Summary Subsection */}
                {action && (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                      <Assignment sx={{ fontSize: 15, color: isDarkMode ? '#60A5FA' : 'primary.main' }} />
                      <Typography variant="caption" fontWeight={700} sx={{ color: isDarkMode ? '#94A3B8' : 'text.secondary', letterSpacing: 0.8, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                        Task Summary
                      </Typography>
                    </Stack>
                    <Typography variant="body1" fontWeight={600} sx={{ color: isDarkMode ? '#F8FAFC' : 'text.primary', fontSize: '0.95rem', mb: 1 }}>
                      {action.description}
                    </Typography>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      <Chip
                        size="small"
                        label={`Progress: ${action.overall_progress_percentage || 0}%`}
                        sx={{ 
                          bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'info.light', 
                          color: isDarkMode ? '#60A5FA' : 'info.dark', 
                          fontWeight: 600, 
                          height: 24, 
                          fontSize: '0.7rem' 
                        }}
                      />
                      {previousStatusConfig && (
                        <Chip
                          size="small"
                          icon={previousStatusConfig.icon}
                          label={`Previous: ${previousStatusObj?.label || previousStatusObj?.name || 'Status'}`}
                          sx={{ 
                            bgcolor: previousStatusConfig.bgColor, 
                            color: previousStatusConfig.color, 
                            fontWeight: 600, 
                            height: 24, 
                            fontSize: '0.7rem', 
                            '& .MuiChip-icon': { color: previousStatusConfig.color } 
                          }}
                        />
                      )}
                      {action.due_date && (
                        <Chip
                          size="small"
                          icon={<AccessTime sx={{ fontSize: '13px !important' }} />}
                          label={`Due: ${new Date(action.due_date).toLocaleDateString()}`}
                          variant="outlined"
                          sx={{ 
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0,0,0,0.15)', 
                            color: isDarkMode ? '#CBD5E1' : 'inherit',
                            height: 24, 
                            fontSize: '0.7rem' 
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                )}

                <Divider sx={{ borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' }} />

                {/* Progress & Status Update Section */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <TrendingUp sx={{ fontSize: 16, color: isDarkMode ? '#38BDF8' : 'primary.main' }} />
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: isDarkMode ? '#F8FAFC' : 'text.primary', letterSpacing: 0.5 }}>
                      Progress & Status Update
                    </Typography>
                  </Stack>

                  <Stack spacing={2.5}>
                    {/* Status Update Field */}
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75, color: isDarkMode ? '#94A3B8' : 'text.secondary', letterSpacing: 0.8, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                        Status Update *
                      </Typography>
                      <TextField
                        select
                        fullWidth
                        required
                        size="small"
                        value={formData.overall_status_id || ''}
                        onChange={handleStatusChange}
                        error={touched && !formData.overall_status_id}
                        helperText={touched && !formData.overall_status_id ? 'Please select a status' : ''}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: isDarkMode ? '#0F172A' : 'transparent',
                            color: isDarkMode ? '#F8FAFC' : 'inherit',
                            '& fieldset': { borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0,0,0,0.12)' },
                            '&:hover fieldset': { borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0,0,0,0.2)' },
                            '&.Mui-focused fieldset': { borderColor: '#3B82F6' },
                          },
                          '& .MuiSelect-select': { color: isDarkMode ? '#F8FAFC' : 'inherit' },
                          '& .MuiSvgIcon-root': { color: isDarkMode ? '#94A3B8' : 'inherit' }
                        }}
                        SelectProps={{
                          renderValue: (selected) => {
                            if (!selected) {
                              return <Typography color="text.secondary">Select Status</Typography>;
                            }
                            const config = getStatusConfig(selected);
                            const status = effectiveStatuses.find(s => s.id === selected);
                            return (
                              <Stack direction="row" alignItems="center" spacing={1.5}>
                                {config?.icon}
                                <Typography fontWeight={600} sx={{ color: isDarkMode ? '#F8FAFC' : 'inherit', fontSize: '0.9rem' }}>
                                  {status?.label || status?.name || status?.short_name || 'Select Status'}
                                </Typography>
                              </Stack>
                            );
                          }
                        }}
                      >
                        {effectiveStatuses.map((status) => {
                          const config = getStatusConfig(status.id);
                          return (
                            <MenuItem key={status.id} value={status.id} sx={{ py: 1 }}>
                              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%', justifyContent: 'space-between' }}>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                  <span style={{ color: config?.color }}>{config?.icon}</span>
                                  <Typography fontWeight={500}>{status.label || status.name || status.short_name || status.id}</Typography>
                                </Stack>
                                {config && (
                                  <Chip
                                    size="small"
                                    label={config.label}
                                    sx={{ bgcolor: config.bgColor, color: config.color, fontWeight: 600, fontSize: '0.65rem', height: 20 }}
                                  />
                                )}
                              </Stack>
                            </MenuItem>
                          );
                        })}
                      </TextField>
                    </Box>

                    {/* Progress Percentage Field */}
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: isDarkMode ? '#94A3B8' : 'text.secondary', letterSpacing: 0.8, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                          Progress Percentage
                        </Typography>
                        <Chip 
                          label={`${progressValue}%`}
                          color={isCompleted ? 'success' : 'primary'}
                          sx={{ fontWeight: 800, px: 0.5, height: 24, fontSize: '0.8rem' }}
                        />
                      </Stack>

                      <Slider
                        value={progressValue}
                        onChange={handleProgressChange}
                        aria-labelledby="progress-slider"
                        valueLabelDisplay="auto"
                        step={5}
                        marks
                        min={0}
                        max={100}
                        sx={{
                          color: isCompleted ? '#10B981' : '#3B82F6',
                          '& .MuiSlider-thumb': {
                            width: 18,
                            height: 18,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                          },
                          '& .MuiSlider-rail': {
                            bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.1)',
                          },
                          mt: 1,
                        }}
                      />

                      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                        <Typography variant="caption" sx={{ color: isDarkMode ? '#94A3B8' : 'text.secondary', fontWeight: 600, mr: 0.5, fontSize: '0.7rem' }}>
                          Quick Jump:
                        </Typography>
                        {QUICK_OPTIONS.map((value) => (
                          <Button
                            key={value}
                            size="small"
                            variant={progressValue === value ? 'contained' : 'outlined'}
                            onClick={() => handleQuickProgress(value)}
                            sx={{
                              minWidth: 40,
                              height: 28,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              borderRadius: 1.5,
                              bgcolor: progressValue === value 
                                ? (isCompleted ? '#10B981' : '#3B82F6') 
                                : (isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'transparent'),
                              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0,0,0,0.15)',
                              color: progressValue === value 
                                ? '#ffffff' 
                                : (isDarkMode ? '#CBD5E1' : 'text.secondary'),
                              '&:hover': {
                                bgcolor: progressValue === value 
                                  ? (isCompleted ? '#059669' : '#2563EB') 
                                  : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.04)'),
                              }
                            }}
                          >
                            {value}%
                          </Button>
                        ))}
                      </Stack>
                    </Box>

                    {/* Remarks Field */}
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75, color: isDarkMode ? '#94A3B8' : 'text.secondary', letterSpacing: 0.8, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                        Remarks / Progress Notes
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        size="small"
                        placeholder="Add specific achievements, hurdles faced, or next execution milestones..."
                        value={formData.remarks}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, remarks: e.target.value }));
                          setTouched(true);
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                              <Comment sx={{ color: isDarkMode ? '#94A3B8' : 'text.secondary', fontSize: 16 }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: isDarkMode ? '#0F172A' : 'transparent',
                            color: isDarkMode ? '#F8FAFC' : 'inherit',
                            '& fieldset': { borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0,0,0,0.12)' },
                            '&:hover fieldset': { borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0,0,0,0.2)' },
                            '&.Mui-focused fieldset': { borderColor: '#3B82F6' },
                          },
                          '& .MuiInputBase-input': { color: isDarkMode ? '#F8FAFC' : 'inherit' }
                        }}
                      />
                    </Box>
                  </Stack>
                </Box>

                {/* Action Buttons */}
                {!embedded && (
                  <Stack 
                    direction="row" 
                    spacing={1.5} 
                    justifyContent="flex-end" 
                    sx={{ pt: 1, borderTop: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}` }}
                  >
                    <Button
                      variant="outlined"
                      size="medium"
                      onClick={handleClose}
                      disabled={loading}
                      sx={{ 
                        px: 3, 
                        py: 0.75,
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0,0,0,0.2)',
                        color: isDarkMode ? '#CBD5E1' : 'text.secondary',
                        fontWeight: 600,
                        '&:hover': {
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0,0,0,0.4)',
                          bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0,0,0,0.04)'
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      size="medium"
                      disabled={loading || !formData.overall_status_id}
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Save />}
                      sx={{ 
                        px: 3, 
                        py: 0.75, 
                        fontWeight: 700,
                        bgcolor: '#3B82F6',
                        '&:hover': { bgcolor: '#2563EB' },
                        '&.Mui-disabled': {
                          bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(25, 118, 210, 0.3)',
                        }
                      }}
                    >
                      {loading ? 'Saving...' : 'Update Progress'}
                    </Button>
                  </Stack>
                )}

              </Stack>
            </Card>

          </form>
        </Paper>

      </Box>
    </Box>
  );
});

UpdateProgress.displayName = 'UpdateProgress';

export default UpdateProgress;