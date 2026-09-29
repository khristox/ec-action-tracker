// src/components/actiontracker/actions/UpdateProgress.jsx

import React, {
  useState, useEffect, useMemo, forwardRef, useImperativeHandle, useRef
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Paper, Typography, Box, Button, TextField,
  Slider, MenuItem, Alert, CircularProgress, Stack, Card,
  Chip, IconButton, Tooltip, Fade,
  InputAdornment, useTheme, Divider
} from '@mui/material';
import {
  TrendingUp, Save, ArrowBack, CheckCircle, Cancel,
  Pending, Schedule, PlayCircle, TaskAlt, Error as ErrorIcon,
  PriorityHigh, AccessTime, Comment, Assignment, Refresh
} from '@mui/icons-material';
import api from '../../../services/api';

// ==================== Helpers ====================

const isValidUuid = (v) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const normalizeError = (detail, fallback = 'Something went wrong') => {
  if (detail === null || detail === undefined) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((d) => {
      if (typeof d === 'string') return d;
      if (d && typeof d === 'object') {
        const loc = Array.isArray(d.loc) ? d.loc.join('.') : d.loc;
        const msg = d.msg || d.message || JSON.stringify(d);
        return loc ? `${loc}: ${msg}` : msg;
      }
      return String(d);
    });
    return parts.join('; ') || fallback;
  }
  if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return String(detail);
};

const buildStatusOptions = (attributes) => {
  const list = attributes?.items || attributes?.data || attributes || [];
  return list
    .filter((attr) => attr.code && attr.code.startsWith('ACTION_STATUS_'))
    .map((attr) => ({
      id: attr.id,
      value: (attr.short_name || attr.code).toLowerCase().replace('action_status_', ''),
      label: attr.name?.replace('Action Status - ', '') || attr.name,
      code: attr.code,
      short_name: attr.short_name,
      sort_order: attr.sort_order,
    }))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
};

const normalizeStatusOptions = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((opt, idx) => ({
    id: opt.id ?? opt.value ?? opt.short_name ?? opt.code ?? `opt-${idx}`,
    value: String(opt.value ?? opt.short_name ?? opt.code ?? opt.name ?? '').toLowerCase(),
    label: opt.label ?? opt.name ?? opt.short_name ?? opt.code ?? opt.value ?? `Option ${idx}`,
    code: opt.code ?? null,
    short_name: opt.short_name ?? null,
    sort_order: opt.sort_order ?? idx,
  }));
};

// ==================== Config ====================

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)', icon: <Pending fontSize="small" /> },
  in_progress: { label: 'In Progress', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: <PlayCircle fontSize="small" /> },
  inprogress:  { label: 'In Progress', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: <PlayCircle fontSize="small" /> },
  completed:   { label: 'Completed',   color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.15)', icon: <CheckCircle fontSize="small" /> },
  overdue:     { label: 'Overdue',     color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)',  icon: <ErrorIcon fontSize="small" /> },
  on_hold:     { label: 'On Hold',     color: '#9CA3AF', bgColor: 'rgba(156, 163, 175, 0.15)', icon: <Schedule fontSize="small" /> },
  onhold:      { label: 'On Hold',     color: '#9CA3AF', bgColor: 'rgba(156, 163, 175, 0.15)', icon: <Schedule fontSize="small" /> },
  cancelled:   { label: 'Cancelled',   color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)',  icon: <Cancel fontSize="small" /> },
};

const FALLBACK_STATUSES = [
  { id: 'pending',     name: 'Pending',     value: 'pending',     short_name: 'pending' },
  { id: 'in_progress', name: 'In Progress', value: 'in_progress', short_name: 'in_progress' },
  { id: 'completed',   name: 'Completed',   value: 'completed',   short_name: 'completed' },
  { id: 'overdue',     name: 'Overdue',     value: 'overdue',     short_name: 'overdue' },
  { id: 'on_hold',     name: 'On Hold',     value: 'on_hold',     short_name: 'on_hold' },
  { id: 'cancelled',   name: 'Cancelled',   value: 'cancelled',   short_name: 'cancelled' },
];

const PRIORITY_CONFIG = {
  1: { label: 'High',     color: '#EF4444', icon: <PriorityHigh fontSize="small" /> },
  2: { label: 'Medium',   color: '#F59E0B', icon: <Schedule fontSize="small" /> },
  3: { label: 'Low',      color: '#10B981', icon: <CheckCircle fontSize="small" /> },
  4: { label: 'Very Low', color: '#9CA3AF', icon: <TaskAlt fontSize="small" /> },
};

const QUICK_OPTIONS = [0, 25, 50, 75, 100];

// ==================== Component ====================

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

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [action, setAction] = useState(null);
  const [fetchedStatuses, setFetchedStatuses] = useState(null);
  const [formData, setFormData] = useState({
    overall_progress_percentage: 0,
    overall_status_id: '',
    remarks: '',
  });
  const [touched, setTouched] = useState(false);

  // ------------------------------------------------
  // Effective statuses = real UUIDs preferred
  //   order: fetched (real) > parent (real) > fetched > parent > fallback
  // ------------------------------------------------
  const effectiveStatuses = useMemo(() => {
    const parent = Array.isArray(statusOptions)
      ? normalizeStatusOptions(statusOptions)
      : [];
    const fetched = Array.isArray(fetchedStatuses)
      ? normalizeStatusOptions(fetchedStatuses)
      : [];

    const parentHasRealIds = parent.some((s) => isValidUuid(s.id));
    const fetchedHasRealIds = fetched.some((s) => isValidUuid(s.id));

    if (fetchedHasRealIds) return fetched;
    if (parentHasRealIds) return parent;
    if (fetched.length > 0) return fetched;
    if (parent.length > 0) return parent;
    return normalizeStatusOptions(FALLBACK_STATUSES);
  }, [statusOptions, fetchedStatuses]);

  // ------------------------------------------------
  // Find the option id matching a status reference
  // ------------------------------------------------
  const findMatchingStatusId = useMemo(() => (
    (rawStatusId, rawStatusName) => {
      if (!effectiveStatuses.length) return '';

      if (rawStatusId) {
        const byId = effectiveStatuses.find((s) => s.id === rawStatusId);
        if (byId) return byId.id;
      }
      if (rawStatusId) {
        const needle = String(rawStatusId).toLowerCase();
        const byValue = effectiveStatuses.find((s) => s.value === needle);
        if (byValue) return byValue.id;
      }
      if (rawStatusName) {
        const needle = String(rawStatusName).toLowerCase().replace(/[_\s-]/g, '');
        const byName = effectiveStatuses.find((s) => {
          const candidates = [s.label, s.value, s.short_name, s.code]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase().replace(/[_\s-]/g, ''));
          return candidates.includes(needle);
        });
        if (byName) return byName.id;
      }
      return '';
    }
  ), [effectiveStatuses]);

  useImperativeHandle(ref, () => ({
    submitForm: () => formRef.current?.requestSubmit(),
    isLoading: loading,
  }), [loading]);

  // ------------------------------------------------
  // Fetch statuses from backend if parent didn't give real UUIDs
  // ------------------------------------------------
  useEffect(() => {
    const parentHasRealIds =
      Array.isArray(statusOptions) &&
      statusOptions.length > 0 &&
      statusOptions.some((o) => isValidUuid(o?.id));

    if (parentHasRealIds) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/attribute-groups/ACTION_TRACKER/attributes');
        const opts = buildStatusOptions(res.data);
        if (!cancelled && opts.length > 0) setFetchedStatuses(opts);
      } catch (err) {
        console.warn('Could not fetch status options, using fallback:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [statusOptions]);

  // ------------------------------------------------
  // Load action data (re-runs when effectiveStatuses changes)
  // ------------------------------------------------
  useEffect(() => {
    if (actionId && effectiveStatuses.length > 0) fetchActionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId, effectiveStatuses]);

  const fetchActionData = async () => {
    try {
      setFetching(true);
      setError(null);

      const actionRes = await api.get(`/action-tracker/actions/${actionId}`);
      const actionData = actionRes.data;
      setAction(actionData);

      const matchedId = findMatchingStatusId(
        actionData.overall_status_id,
        actionData.overall_status_name ||
        actionData.overall_status_label ||
        actionData.overall_status_short_name ||
        actionData.status
      );
      const defaultStatusId = matchedId || (effectiveStatuses[0]?.id || '');

      setFormData({
        overall_progress_percentage: actionData.overall_progress_percentage || 0,
        overall_status_id: defaultStatusId,
        remarks: actionData.remarks || '',
      });

      const hadStatus = Boolean(
        actionData.overall_status_id ||
        actionData.overall_status_name ||
        actionData.status
      );
      if (hadStatus && !matchedId && !embedded) {
        setError('The current status could not be matched to an available option.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      if (!embedded) {
        const status = err.response?.status;
        const detail = err.response?.data?.detail || err.message || 'Unknown error';
        setError(`Failed to load action data (${status || 'network error'}): ${normalizeError(detail)}`);
      }
    } finally {
      setFetching(false);
    }
  };

  const handleProgressChange = (e, newValue) => {
    setFormData((prev) => ({ ...prev, overall_progress_percentage: newValue }));
    setTouched(true);
  };

  const handleStatusChange = (e) => {
    setFormData((prev) => ({ ...prev, overall_status_id: e.target.value }));
    setTouched(true);
    if (typeof error === 'string' && error.includes('could not be matched')) setError(null);
  };

  const handleQuickProgress = (percentage) => {
    setFormData((prev) => ({ ...prev, overall_progress_percentage: percentage }));
    setTouched(true);
  };

  const handleRetry = () => fetchActionData();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.overall_status_id) {
      setError('Please select a status');
      return;
    }

    const submitStatusId =
      findMatchingStatusId(formData.overall_status_id, null) ||
      formData.overall_status_id;

    if (!isValidUuid(submitStatusId)) {
      setError('Status options did not load correctly. Please refresh the page and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        progress_percentage: formData.overall_progress_percentage,
        individual_status_id: submitStatusId,
        remarks: formData.remarks || `Progress updated to ${formData.overall_progress_percentage}%`,
      };

      await api.patch(`/action-tracker/actions/${actionId}/progress`, payload);
      setSuccess(true);

      if (onSuccess) setTimeout(() => onSuccess(), 500);
      else setTimeout(() => navigate(`/actions/${actionId}`), 1500);
    } catch (err) {
      console.error('Update error:', err.response?.data);
      setError(normalizeError(err.response?.data?.detail, 'Failed to update progress. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const progressValue = formData.overall_progress_percentage || 0;
  const isCompleted = progressValue >= 100;

  const getStatusConfig = (statusId) => {
    if (!statusId) return null;
    const status = effectiveStatuses.find((s) => s.id === statusId);
    if (!status) return null;
    const key =
      status.value?.toLowerCase() ||
      status.short_name?.toLowerCase() ||
      status.label?.toLowerCase() ||
      'pending';
    const cleanKey = key.replace(/[_\s]/g, '');
    return STATUS_CONFIG[cleanKey] || STATUS_CONFIG[key] || STATUS_CONFIG.pending;
  };

  const priorityConfig = action ? PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG[2] : null;
  const previousStatusObj = action
    ? effectiveStatuses.find((s) => s.id === action.overall_status_id) ||
      effectiveStatuses.find((s) =>
        s.id === findMatchingStatusId(action.overall_status_id, action.overall_status_name)
      )
    : null;
  const previousStatusConfig = getStatusConfig(previousStatusObj?.id);

  const handleClose = () => {
    if (onCancel) onCancel();
    else navigate(-1);
  };

  if (fetching) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Loading action details...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 0, m: 0, bgcolor: 'transparent' }}>
      <Box sx={{
        maxWidth: 720,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        p: embedded ? 0 : { xs: 0.75, sm: 1 },
      }}>
        {!embedded && (
          <Box sx={{ mb: 1, flexShrink: 0, px: 0.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Tooltip title="Go Back">
                <IconButton
                  onClick={handleClose}
                  size="small"
                  sx={{
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    color: isDarkMode ? '#94A3B8' : 'inherit',
                    '&:hover': {
                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    },
                  }}
                >
                  <ArrowBack fontSize="small" />
                </IconButton>
              </Tooltip>
              <Box flex={1}>
                <Typography variant="subtitle1" fontWeight={700} sx={{
                  color: isDarkMode ? '#F8FAFC' : 'inherit',
                  fontSize: '1rem',
                  lineHeight: 1.2,
                }}>
                  Update Progress
                </Typography>
              </Box>
              {action && priorityConfig && (
                <Chip
                  icon={priorityConfig.icon}
                  label={priorityConfig.label}
                  size="small"
                  sx={{
                    bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'error.light',
                    color: priorityConfig.color,
                    fontWeight: 600,
                    height: 22,
                    fontSize: '0.7rem',
                    border: `1px solid ${isDarkMode ? 'rgba(239, 68, 68, 0.2)' : priorityConfig.color}`,
                    '& .MuiChip-icon': { color: priorityConfig.color, fontSize: 14 },
                  }}
                />
              )}
            </Stack>
          </Box>
        )}

        <Fade in={success}>
          <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 1, py: 0.25 }}>
            <Typography variant="caption" fontWeight={600}>
              Progress updated successfully!
            </Typography>
          </Alert>
        </Fade>

        {error && !embedded && (
          <Alert
            severity="warning"
            sx={{ mb: 1, py: 0.25, '& .MuiAlert-message': { fontSize: '0.8rem' } }}
            onClose={() => setError(null)}
            action={
              typeof error === 'string' && error.includes('Failed to load')
                ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={handleRetry}
                    startIcon={<Refresh fontSize="small" />}
                    sx={{ fontSize: '0.7rem' }}
                  >
                    Retry
                  </Button>
                )
                : null
            }
          >
            {typeof error === 'string' ? error : normalizeError(error)}
          </Alert>
        )}

        <Paper sx={{ p: 0, borderRadius: 0, bgcolor: 'transparent', boxShadow: 'none' }}>
          <form ref={formRef} onSubmit={handleSubmit}>
            <Card
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: isDarkMode ? '#1E293B' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                boxShadow: isDarkMode
                  ? '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                  : '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <Stack spacing={1.75}>

                {action && (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                      <Assignment sx={{ fontSize: 13, color: isDarkMode ? '#60A5FA' : 'primary.main' }} />
                      <Typography variant="caption" fontWeight={700} sx={{
                        color: isDarkMode ? '#94A3B8' : 'text.secondary',
                        letterSpacing: 0.6,
                        fontSize: '0.6rem',
                        textTransform: 'uppercase',
                      }}>
                        Task
                      </Typography>
                    </Stack>

                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        color: isDarkMode ? '#F8FAFC' : 'text.primary',
                        fontSize: '0.875rem',
                        mb: 0.75,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {action.description}
                    </Typography>

                    <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ gap: 0.5 }}>
                      <Chip
                        size="small"
                        label={`${action.overall_progress_percentage || 0}%`}
                        sx={{
                          bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'info.light',
                          color: isDarkMode ? '#60A5FA' : 'info.dark',
                          fontWeight: 600,
                          height: 20,
                          fontSize: '0.65rem',
                        }}
                      />
                      {previousStatusConfig && (
                        <Chip
                          size="small"
                          icon={previousStatusConfig.icon}
                          label={previousStatusObj?.label || previousStatusObj?.name || 'Status'}
                          sx={{
                            bgcolor: previousStatusConfig.bgColor,
                            color: previousStatusConfig.color,
                            fontWeight: 600,
                            height: 20,
                            fontSize: '0.65rem',
                            '& .MuiChip-icon': { color: previousStatusConfig.color, fontSize: 13 },
                          }}
                        />
                      )}
                      {action.due_date && (
                        <Chip
                          size="small"
                          icon={<AccessTime sx={{ fontSize: '12px !important' }} />}
                          label={new Date(action.due_date).toLocaleDateString()}
                          variant="outlined"
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0,0,0,0.15)',
                            color: isDarkMode ? '#CBD5E1' : 'inherit',
                            height: 20,
                            fontSize: '0.65rem',
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                )}

                <Divider sx={{
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                }} />

                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <TrendingUp sx={{ fontSize: 14, color: isDarkMode ? '#38BDF8' : 'primary.main' }} />
                  <Typography variant="caption" fontWeight={700} sx={{
                    color: isDarkMode ? '#F8FAFC' : 'text.primary',
                    letterSpacing: 0.4,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                  }}>
                    Progress & Status
                  </Typography>
                </Stack>

                <Stack spacing={1.75}>

                  {/* Status */}
                  <Box>
                    <Typography variant="caption" fontWeight={700} sx={{
                      display: 'block',
                      mb: 0.5,
                      color: isDarkMode ? '#94A3B8' : 'text.secondary',
                      letterSpacing: 0.6,
                      fontSize: '0.6rem',
                      textTransform: 'uppercase',
                    }}>
                      Status *
                    </Typography>
                    <TextField
                      select
                      fullWidth
                      required
                      size="small"
                      value={formData.overall_status_id || ''}
                      onChange={handleStatusChange}
                      error={touched && !formData.overall_status_id}
                      helperText={
                        touched && !formData.overall_status_id ? 'Please select a status' : ''
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: isDarkMode ? '#0F172A' : 'transparent',
                          color: isDarkMode ? '#F8FAFC' : 'inherit',
                          fontSize: '0.85rem',
                          '& fieldset': {
                            borderColor: isDarkMode
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(0,0,0,0.12)',
                          },
                          '&:hover fieldset': {
                            borderColor: isDarkMode
                              ? 'rgba(255, 255, 255, 0.25)'
                              : 'rgba(0,0,0,0.2)',
                          },
                          '&.Mui-focused fieldset': { borderColor: '#3B82F6' },
                        },
                        '& .MuiSelect-select': {
                          color: isDarkMode ? '#F8FAFC' : 'inherit',
                          py: 1,
                        },
                        '& .MuiSvgIcon-root': {
                          color: isDarkMode ? '#94A3B8' : 'inherit',
                        },
                        '& .MuiFormHelperText-root': { fontSize: '0.7rem', mt: 0.25, mx: 0 },
                      }}
                      SelectProps={{
                        renderValue: (selected) => {
                          if (!selected) {
                            return (
                              <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                Select Status
                              </Typography>
                            );
                          }
                          const config = getStatusConfig(selected);
                          const status = effectiveStatuses.find((s) => s.id === selected);
                          return (
                            <Stack direction="row" alignItems="center" spacing={1}>
                              {config?.icon}
                              <Typography
                                fontWeight={600}
                                sx={{
                                  color: isDarkMode ? '#F8FAFC' : 'inherit',
                                  fontSize: '0.85rem',
                                }}
                              >
                                {status?.label || status?.name || status?.short_name || 'Select Status'}
                              </Typography>
                            </Stack>
                          );
                        },
                      }}
                    >
                      {effectiveStatuses.map((status) => {
                        const config = getStatusConfig(status.id);
                        return (
                          <MenuItem key={status.id} value={status.id} sx={{ py: 0.75 }}>
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={1}
                              sx={{ width: '100%', justifyContent: 'space-between' }}
                            >
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <span style={{ color: config?.color }}>{config?.icon}</span>
                                <Typography sx={{ fontSize: '0.85rem' }}>
                                  {status.label || status.name || status.short_name || status.id}
                                </Typography>
                              </Stack>
                              {config && (
                                <Chip
                                  size="small"
                                  label={config.label}
                                  sx={{
                                    bgcolor: config.bgColor,
                                    color: config.color,
                                    fontWeight: 600,
                                    fontSize: '0.6rem',
                                    height: 18,
                                  }}
                                />
                              )}
                            </Stack>
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  </Box>

                  {/* Progress */}
                  <Box>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 0.5 }}
                    >
                      <Typography variant="caption" fontWeight={700} sx={{
                        color: isDarkMode ? '#94A3B8' : 'text.secondary',
                        letterSpacing: 0.6,
                        fontSize: '0.6rem',
                        textTransform: 'uppercase',
                      }}>
                        Progress
                      </Typography>
                      <Chip
                        label={`${progressValue}%`}
                        color={isCompleted ? 'success' : 'primary'}
                        size="small"
                        sx={{ fontWeight: 800, height: 20, fontSize: '0.7rem' }}
                      />
                    </Stack>

                    <Slider
                      value={progressValue}
                      onChange={handleProgressChange}
                      valueLabelDisplay="auto"
                      step={5}
                      min={0}
                      max={100}
                      marks={false}
                      size="small"
                      sx={{
                        color: isCompleted ? '#10B981' : '#3B82F6',
                        py: 0.75,
                        '& .MuiSlider-thumb': {
                          width: 14,
                          height: 14,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        },
                        '& .MuiSlider-rail': {
                          bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.1)',
                        },
                      }}
                    />

                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.5}
                      flexWrap="wrap"
                      sx={{ mt: 0.5 }}
                    >
                      <Typography variant="caption" sx={{
                        color: isDarkMode ? '#94A3B8' : 'text.secondary',
                        fontWeight: 600,
                        mr: 0.5,
                        fontSize: '0.65rem',
                      }}>
                        Quick:
                      </Typography>
                      {QUICK_OPTIONS.map((value) => (
                        <Button
                          key={value}
                          size="small"
                          variant={progressValue === value ? 'contained' : 'outlined'}
                          onClick={() => handleQuickProgress(value)}
                          sx={{
                            minWidth: 36,
                            height: 24,
                            px: 0.75,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            borderRadius: 1,
                            bgcolor:
                              progressValue === value
                                ? (isCompleted ? '#10B981' : '#3B82F6')
                                : (isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'transparent'),
                            borderColor: isDarkMode
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(0,0,0,0.15)',
                            color:
                              progressValue === value
                                ? '#ffffff'
                                : (isDarkMode ? '#CBD5E1' : 'text.secondary'),
                            '&:hover': {
                              bgcolor:
                                progressValue === value
                                  ? (isCompleted ? '#059669' : '#2563EB')
                                  : (isDarkMode
                                      ? 'rgba(255, 255, 255, 0.08)'
                                      : 'rgba(0,0,0,0.04)'),
                            },
                          }}
                        >
                          {value}
                        </Button>
                      ))}
                    </Stack>
                  </Box>

                  {/* Remarks */}
                  <Box>
                    <Typography variant="caption" fontWeight={700} sx={{
                      display: 'block',
                      mb: 0.5,
                      color: isDarkMode ? '#94A3B8' : 'text.secondary',
                      letterSpacing: 0.6,
                      fontSize: '0.6rem',
                      textTransform: 'uppercase',
                    }}>
                      Remarks
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      placeholder="What changed or was achieved?"
                      value={formData.remarks}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, remarks: e.target.value }));
                        setTouched(true);
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment
                            position="start"
                            sx={{ alignSelf: 'flex-start', mt: 0.75 }}
                          >
                            <Comment
                              sx={{
                                color: isDarkMode ? '#94A3B8' : 'text.secondary',
                                fontSize: 14,
                              }}
                            />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: isDarkMode ? '#0F172A' : 'transparent',
                          color: isDarkMode ? '#F8FAFC' : 'inherit',
                          fontSize: '0.85rem',
                          '& fieldset': {
                            borderColor: isDarkMode
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(0,0,0,0.12)',
                          },
                          '&:hover fieldset': {
                            borderColor: isDarkMode
                              ? 'rgba(255, 255, 255, 0.25)'
                              : 'rgba(0,0,0,0.2)',
                          },
                          '&.Mui-focused fieldset': { borderColor: '#3B82F6' },
                        },
                        '& .MuiInputBase-input': {
                          color: isDarkMode ? '#F8FAFC' : 'inherit',
                          py: 0.75,
                        },
                      }}
                    />
                  </Box>
                </Stack>

                {!embedded && (
                  <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="flex-end"
                    sx={{
                      pt: 1,
                      borderTop: `1px solid ${isDarkMode
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.06)'}`,
                    }}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleClose}
                      disabled={loading}
                      sx={{
                        px: 2,
                        py: 0.5,
                        fontSize: '0.8rem',
                        borderColor: isDarkMode
                          ? 'rgba(255, 255, 255, 0.15)'
                          : 'rgba(0,0,0,0.2)',
                        color: isDarkMode ? '#CBD5E1' : 'text.secondary',
                        fontWeight: 600,
                        '&:hover': {
                          borderColor: isDarkMode
                            ? 'rgba(255, 255, 255, 0.3)'
                            : 'rgba(0,0,0,0.4)',
                          bgcolor: isDarkMode
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(0,0,0,0.04)',
                        },
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      size="small"
                      disabled={loading || !formData.overall_status_id}
                      startIcon={
                        loading
                          ? <CircularProgress size={14} color="inherit" />
                          : <Save fontSize="small" />
                      }
                      sx={{
                        px: 2.5,
                        py: 0.5,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        bgcolor: '#3B82F6',
                        '&:hover': { bgcolor: '#2563EB' },
                        '&.Mui-disabled': {
                          bgcolor: isDarkMode
                            ? 'rgba(59, 130, 246, 0.3)'
                            : 'rgba(25, 118, 210, 0.3)',
                        },
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