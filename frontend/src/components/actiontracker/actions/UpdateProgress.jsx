// src/components/actiontracker/actions/UpdateProgress.jsx

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Paper, Typography, Box, Button, TextField,
  Slider, MenuItem, Alert, CircularProgress, Stack, Card,
  LinearProgress, Chip, Divider, IconButton, Tooltip, Fade,
  InputAdornment, FormHelperText, useTheme, alpha
} from '@mui/material';
import {
  TrendingUp, Save, ArrowBack, CheckCircle, Cancel,
  Pending, Schedule, PlayCircle, TaskAlt, Error as ErrorIcon,
  PriorityHigh, AccessTime, Comment, Assignment, Refresh
} from '@mui/icons-material';
import api from '../../../services/api';

// Status configurations with colors (keyed by short_name, lowercase, underscores stripped)
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    icon: <Pending fontSize="small" />
  },
  in_progress: {
    label: 'In Progress',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    icon: <PlayCircle fontSize="small" />
  },
  inprogress: {
    label: 'In Progress',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    icon: <PlayCircle fontSize="small" />
  },
  completed: {
    label: 'Completed',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    icon: <CheckCircle fontSize="small" />
  },
  overdue: {
    label: 'Overdue',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    icon: <ErrorIcon fontSize="small" />
  },
  on_hold: {
    label: 'On Hold',
    color: '#6B7280',
    bgColor: 'rgba(107, 114, 128, 0.12)',
    icon: <Schedule fontSize="small" />
  },
  onhold: {
    label: 'On Hold',
    color: '#6B7280',
    bgColor: 'rgba(107, 114, 128, 0.12)',
    icon: <Schedule fontSize="small" />
  },
  cancelled: {
    label: 'Cancelled',
    color: '#DC2626',
    bgColor: 'rgba(220, 38, 38, 0.12)',
    icon: <Cancel fontSize="small" />
  }
};

// Fallback statuses used only when no real statusOptions are supplied
// (e.g. component used standalone outside MeetingActionsList).
const FALLBACK_STATUSES = [
  { id: 'pending', name: 'Pending', value: 'pending', short_name: 'pending' },
  { id: 'in_progress', name: 'In Progress', value: 'in_progress', short_name: 'in_progress' },
  { id: 'completed', name: 'Completed', value: 'completed', short_name: 'completed' },
  { id: 'overdue', name: 'Overdue', value: 'overdue', short_name: 'overdue' },
  { id: 'on_hold', name: 'On Hold', value: 'on_hold', short_name: 'on_hold' },
  { id: 'cancelled', name: 'Cancelled', value: 'cancelled', short_name: 'cancelled' }
];

// Priority configurations
const PRIORITY_CONFIG = {
  1: { label: 'High', color: '#EF4444', icon: <PriorityHigh fontSize="small" /> },
  2: { label: 'Medium', color: '#F59E0B', icon: <Schedule fontSize="small" /> },
  3: { label: 'Low', color: '#10B981', icon: <CheckCircle fontSize="small" /> },
  4: { label: 'Very Low', color: '#6B7280', icon: <TaskAlt fontSize="small" /> }
};

// Quick progress options
const QUICK_OPTIONS = [0, 25, 50, 75, 100];

/**
 * UpdateProgress
 *
 * Props:
 * - actionId: UUID of the action being updated (falls back to route param `id`)
 * - onSuccess: called after a successful update
 * - onCancel: called when the user cancels/closes
 * - embedded: true when rendered inside a parent Dialog (hides its own header/buttons)
 * - statusOptions: real status option objects from Redux
 *     (shape: { id, value, label, short_name, color, ... }) - REQUIRED for correct
 *     behavior; if omitted, a small fallback list is used instead.
 *
 * Ref API (only meaningful when embedded, via forwardRef):
 * - submitForm(): programmatically submits the form
 * - isLoading: boolean, true while a save is in flight
 */
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

  // Use real status options when provided, otherwise fall back to the
  // static list (only relevant for standalone/non-embedded usage where
  // no Redux-backed options were passed in).
  const effectiveStatuses = (statusOptions && statusOptions.length > 0)
    ? statusOptions
    : FALLBACK_STATUSES;

  // State
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

  // Expose imperative API to parent (used when embedded in a Dialog with
  // its own action buttons, so the parent can trigger submit directly
  // instead of relying on document-wide form queries).
  useImperativeHandle(ref, () => ({
    submitForm: () => {
      formRef.current?.requestSubmit();
    },
    isLoading: loading,
  }), [loading]);

  // Fetch data
  useEffect(() => {
    if (actionId) {
      fetchActionData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setError(`The current status could not be matched to an available option. Using "${effectiveStatuses[0]?.label || effectiveStatuses[0]?.name || 'the first option'}" as default.`);
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

  // Handlers
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
      // NOTE: this hits the dedicated progress-update endpoint
      // (PATCH /action-tracker/actions/{id}/progress), which expects
      // the ActionProgressUpdate schema: progress_percentage,
      // individual_status_id, remarks. Sending overall_status_id to the
      // generic PUT /{id} endpoint previously caused 422s because the
      // field names/types didn't match what the backend validates.
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

  // Computed values
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

  const selectedStatusConfig = getStatusConfig(formData.overall_status_id);
  const priorityConfig = action ? PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG[2] : null;

  // Paper styles - no padding/border/shadow when embedded (parent Dialog handles chrome)
  const paperSx = {
    p: embedded ? { xs: 1, sm: 1.5 } : { xs: 2, sm: 2.5 },
    borderRadius: embedded ? 0 : 3,
    bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
    border: embedded ? 'none' : (isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)'),
    backdropFilter: isDarkMode ? 'blur(10px)' : 'none',
    transition: 'all 0.2s ease-in-out',
    boxShadow: embedded ? 'none' : undefined,
  };

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
      p: embedded ? { xs: 2, sm: 3 } : { xs: 1, sm: 2 },
      bgcolor: embedded ? 'transparent' : (isDarkMode ? 'transparent' : '#f5f7fa'),
    }}>
      <Box sx={{
        maxWidth: embedded ? '100%' : 900,
        mx: 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header - only show when not embedded */}
        {!embedded && (
          <Box sx={{ mb: 2, flexShrink: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Tooltip title="Go Back">
                <IconButton
                  onClick={handleClose}
                  size="small"
                  sx={{
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    '&:hover': {
                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                    }
                  }}
                >
                  <ArrowBack />
                </IconButton>
              </Tooltip>
              <Box flex={1}>
                <Typography variant="h5" fontWeight={700} sx={{ color: isDarkMode ? '#fff' : 'inherit' }}>
                  Update Progress
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Assignment sx={{ fontSize: 14 }} />
                  {action?.description || 'Task'}
                </Typography>
              </Box>
              {action && priorityConfig && (
                <Chip
                  icon={priorityConfig.icon}
                  label={priorityConfig.label}
                  size="small"
                  sx={{
                    bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : 'error.light',
                    color: priorityConfig.color,
                    fontWeight: 600,
                    border: `1px solid ${priorityConfig.color}`,
                    '& .MuiChip-icon': { color: priorityConfig.color }
                  }}
                />
              )}
            </Stack>
          </Box>
        )}

        {/* Content - Scrollable */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          pb: embedded ? 0 : 2,
        }}>
          {/* Success Alert */}
          <Fade in={success}>
            <Alert
              severity="success"
              icon={<CheckCircle />}
              sx={{ mb: embedded ? 1 : 2 }}
              action={
                !embedded && (
                  <Button color="inherit" size="small" onClick={() => navigate(`/actions/${actionId}`)}>
                    View Task
                  </Button>
                )
              }
            >
              <Typography variant="subtitle2" fontWeight={600}>
                Progress updated successfully!
              </Typography>
            </Alert>
          </Fade>

          {/* Error Alert - hide warnings when embedded (parent surfaces its own error UI) */}
          {error && !embedded && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              onClose={() => {
                setError(null);
              }}
              icon={<PriorityHigh />}
              action={
                error.includes('Failed to load') ? (
                  <Button color="inherit" size="small" onClick={handleRetry} startIcon={<Refresh />}>
                    Retry
                  </Button>
                ) : null
              }
            >
              {error}
            </Alert>
          )}

          {/* Main Form */}
          <Paper sx={paperSx}>
            <form ref={formRef} onSubmit={handleSubmit}>
              <Stack spacing={embedded ? 1.5 : 2}>
                {/* Action Summary */}
                {action && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: 0.5 }}>
                      TASK DETAILS
                    </Typography>
                    <Card
                      variant="outlined"
                      sx={{
                        p: embedded ? 1 : 1.5,
                        bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      }}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="body1" fontWeight={500} sx={{ color: isDarkMode ? '#fff' : 'inherit' }}>
                          {action.description}
                        </Typography>
                        {action.remarks && (
                          <Typography variant="body2" color="text.secondary">
                            {action.remarks}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                          <Chip
                            size="small"
                            label={`Current Progress: ${action.overall_progress_percentage || 0}%`}
                            sx={{
                              bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'info.light',
                              color: isDarkMode ? '#60A5FA' : 'info.dark',
                              height: 24,
                              fontSize: '0.7rem'
                            }}
                          />
                          {action.due_date && (
                            <Chip
                              size="small"
                              icon={<AccessTime />}
                              label={`Due: ${new Date(action.due_date).toLocaleDateString()}`}
                              variant="outlined"
                              sx={{
                                borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
                                height: 24,
                                fontSize: '0.7rem'
                              }}
                            />
                          )}
                        </Stack>
                      </Stack>
                    </Card>
                  </Box>
                )}

                <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

                {/* Progress Section */}
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'inherit' }}>
                      Progress
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color={isCompleted ? 'success.main' : 'primary.main'}>
                      {progressValue}%
                    </Typography>
                  </Stack>

                  <LinearProgress
                    variant="determinate"
                    value={progressValue}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      mb: 0.5,
                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: isCompleted ? '#34D399' : '#60A5FA',
                        borderRadius: 4,
                        transition: 'transform 0.5s ease-in-out',
                      }
                    }}
                  />

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
                      mt: 1,
                      color: isCompleted ? '#34D399' : '#60A5FA',
                      '& .MuiSlider-thumb': {
                        width: 18,
                        height: 18,
                        bgcolor: isDarkMode ? '#fff' : 'primary.main',
                        '&:hover, &.Mui-focusVisible': {
                          boxShadow: '0 0 0 8px rgba(96, 165, 250, 0.16)',
                        },
                      },
                      '& .MuiSlider-track': {
                        bgcolor: isCompleted ? '#34D399' : '#60A5FA',
                      },
                      '& .MuiSlider-rail': {
                        bgcolor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                      }
                    }}
                  />

                  {/* Quick progress buttons */}
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mr: 0.5, fontSize: '0.65rem' }}>
                      Quick set:
                    </Typography>
                    {QUICK_OPTIONS.map((value) => (
                      <Button
                        key={value}
                        size="small"
                        variant={progressValue === value ? 'contained' : 'outlined'}
                        onClick={() => handleQuickProgress(value)}
                        sx={{
                          minWidth: 32,
                          px: 1,
                          py: 0.25,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          borderRadius: 1.5,
                          bgcolor: progressValue === value
                            ? (isCompleted ? '#34D399' : '#60A5FA')
                            : 'transparent',
                          borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                          color: progressValue === value
                            ? '#fff'
                            : (isDarkMode ? 'rgba(255,255,255,0.7)' : 'text.secondary'),
                          '&:hover': {
                            bgcolor: progressValue === value
                              ? (isCompleted ? '#2DD4BF' : '#93BBFC')
                              : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                          }
                        }}
                      >
                        {value}%
                      </Button>
                    ))}
                  </Stack>
                </Box>

                <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

                {/* Status Selection */}
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5, color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'inherit' }}>
                    Status
                  </Typography>

                  <TextField
                    select
                    fullWidth
                    required
                    label="Select Status"
                    value={formData.overall_status_id || ''}
                    onChange={handleStatusChange}
                    error={touched && !formData.overall_status_id}
                    helperText={
                      touched && !formData.overall_status_id
                        ? 'Please select a status'
                        : ''
                    }
                    SelectProps={{
                      renderValue: (selected) => {
                        if (!selected) {
                          return <Typography color="text.secondary">Select Status</Typography>;
                        }
                        const config = getStatusConfig(selected);
                        const status = effectiveStatuses.find(s => s.id === selected);
                        return (
                          <Stack direction="row" alignItems="center" spacing={1}>
                            {config?.icon}
                            <Typography sx={{ color: isDarkMode ? '#fff' : 'inherit' }}>
                              {status?.label || status?.name || status?.short_name || 'Select Status'}
                            </Typography>
                          </Stack>
                        );
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'transparent',
                        '& fieldset': {
                          borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                        },
                        '&:hover fieldset': {
                          borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
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
                        color: isDarkMode ? '#fff' : 'inherit',
                      }
                    }}
                  >
                    {effectiveStatuses.map((status) => {
                      const config = getStatusConfig(status.id);
                      return (
                        <MenuItem
                          key={status.id}
                          value={status.id}
                          sx={{
                            py: 1,
                            '&:hover': {
                              bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                            }
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            {config?.icon && (
                              <span style={{ color: config.color }}>
                                {config.icon}
                              </span>
                            )}
                            <Typography sx={{ color: isDarkMode ? '#fff' : 'inherit' }}>
                              {status.label || status.name || status.short_name || status.id}
                            </Typography>
                            {config && (
                              <Chip
                                size="small"
                                label={config.label}
                                sx={{
                                  bgcolor: config.bgColor,
                                  color: config.color,
                                  fontWeight: 500,
                                  fontSize: '0.55rem',
                                  height: 16,
                                  '& .MuiChip-label': { px: 0.75 }
                                }}
                              />
                            )}
                          </Stack>
                        </MenuItem>
                      );
                    })}
                  </TextField>

                  {selectedStatusConfig && formData.overall_status_id && (
                    <FormHelperText sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {selectedStatusConfig.icon}
                      Current selection: <strong>{selectedStatusConfig.label}</strong>
                    </FormHelperText>
                  )}
                </Box>

                {/* Remarks */}
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5, color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'inherit' }}>
                    Remarks
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Add notes about progress made, challenges, or next steps..."
                    value={formData.remarks}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, remarks: e.target.value }));
                      setTouched(true);
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Comment sx={{ color: 'text.secondary', fontSize: 18 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'transparent',
                        '& fieldset': {
                          borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                        },
                        '&:hover fieldset': {
                          borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
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
                      '& .MuiInputBase-input': {
                        color: isDarkMode ? '#fff' : 'inherit',
                      }
                    }}
                  />
                </Box>

                {/* Action Buttons - only rendered in standalone (non-embedded) mode.
                    When embedded, the parent Dialog's own action row drives
                    submission via the imperative `submitForm()` ref API. */}
                {!embedded && (
                  <>
                    <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        onClick={handleClose}
                        disabled={loading}
                        fullWidth
                        sx={{
                          borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
                          color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                          '&:hover': {
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)',
                            bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                          }
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={loading || !formData.overall_status_id}
                        fullWidth
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Save />}
                        sx={{
                          bgcolor: isDarkMode ? '#60A5FA' : 'primary.main',
                          '&:hover': {
                            bgcolor: isDarkMode ? '#93BBFC' : 'primary.dark',
                          },
                          '&.Mui-disabled': {
                            bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.3)' : 'rgba(25, 118, 210, 0.3)',
                          }
                        }}
                      >
                        {loading ? 'Updating...' : 'Update Progress'}
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
            </form>
          </Paper>

          {/* Info Banner - only when not embedded */}
          {!embedded && (
            <Paper
              sx={{
                mt: 1.5,
                p: 1,
                borderRadius: 2,
                bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.06)' : 'info.light',
                border: `1px solid ${isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'info.main'}`,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <TrendingUp sx={{ color: isDarkMode ? '#60A5FA' : 'info.main', fontSize: 18 }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  <strong>Tip:</strong> Use the quick progress buttons or drag the slider for precise control.
                </Typography>
              </Stack>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
});

UpdateProgress.displayName = 'UpdateProgress';

export default UpdateProgress;