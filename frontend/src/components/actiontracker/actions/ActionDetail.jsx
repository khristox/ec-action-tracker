// src/components/actiontracker/actions/ActionDetail.jsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button, IconButton,
  Divider, LinearProgress, Avatar, TextField, Grid,
  List, ListItem, ListItemText, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Skeleton, Alert, Collapse,
  useTheme, useMediaQuery, Tooltip, CircularProgress
} from '@mui/material';
import {
  ArrowBack, Edit, Delete, History, Person, Schedule,
  Description, OpenInNew, AccessTime, Event, Info,
  PriorityHigh, CheckCircle, Cancel, PlayCircle, Pending,
  ExpandMore, ExpandLess, TaskAlt, Error as ErrorIcon,
  WatchLater, CheckCircleOutlined, PauseCircle, CancelOutlined,
  HighlightOff, HourglassEmpty, People, Label, Flag, Lightbulb,
  Link as LinkIcon
} from '@mui/icons-material';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LockIcon from '@mui/icons-material/Lock';

import {
  selectCurrentAction,
  selectActionImplementers,
  fetchActionById,
  updateActionProgress,
  deleteAction,
  clearCurrentAction,
  clearError,
  fetchActionImplementers
} from '../../../store/slices/actionTracker/actionSlice';
import {
  fetchActionTrackerAttributes,
  selectActionStatusOptions,
  selectActionTrackerLoading,
  selectActionTrackerError
} from '../../../store/slices/actionTracker/meetingSlice';
import api from '../../../services/api';

// ==================== CONSTANTS ====================

const PRIORITY = {
  1: { label: 'High', color: 'error', icon: <PriorityHigh /> },
  2: { label: 'Medium', color: 'warning', icon: <Schedule /> },
  3: { label: 'Low', color: 'success', icon: <CheckCircle /> },
  4: { label: 'Very Low', color: 'default', icon: <Info /> },
};

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
    icon: <HourglassEmpty fontSize="small" />,
    muiColor: 'warning'
  },
  started: {
    label: 'Started',
    color: '#60A5FA',
    bgColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: '#60A5FA',
    icon: <PlayCircle fontSize="small" />,
    muiColor: 'info'
  },
  in_progress: {
    label: 'In Progress',
    color: '#60A5FA',
    bgColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: '#60A5FA',
    icon: <Pending fontSize="small" />,
    muiColor: 'info'
  },
  awaiting: {
    label: 'Awaiting',
    color: '#A78BFA',
    bgColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: '#A78BFA',
    icon: <WatchLater fontSize="small" />,
    muiColor: 'secondary'
  },
  awaiting_approval: {
    label: 'Awaiting Approval',
    color: '#A78BFA',
    bgColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: '#A78BFA',
    icon: <Pending fontSize="small" />,
    muiColor: 'secondary'
  },
  in_review: {
    label: 'In Review',
    color: '#818CF8',
    bgColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: '#818CF8',
    icon: <CheckCircleOutlined fontSize="small" />,
    muiColor: 'secondary'
  },
  on_hold: {
    label: 'On Hold',
    color: '#9CA3AF',
    bgColor: 'rgba(156, 163, 175, 0.15)',
    borderColor: '#9CA3AF',
    icon: <PauseCircle fontSize="small" />,
    muiColor: 'default'
  },
  blocked: {
    label: 'Blocked',
    color: '#F87171',
    bgColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: '#F87171',
    icon: <CancelOutlined fontSize="small" />,
    muiColor: 'error'
  },
  completed: {
    label: 'Completed',
    color: '#34D399',
    bgColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: '#34D399',
    icon: <CheckCircle fontSize="small" />,
    muiColor: 'success'
  },
  closed: {
    label: 'Closed',
    color: '#34D399',
    bgColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: '#34D399',
    icon: <TaskAlt fontSize="small" />,
    muiColor: 'success'
  },
  cancelled: {
    label: 'Cancelled',
    color: '#F87171',
    bgColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: '#F87171',
    icon: <HighlightOff fontSize="small" />,
    muiColor: 'error'
  },
  overdue: {
    label: 'Overdue',
    color: '#F87171',
    bgColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: '#F87171',
    icon: <ErrorIcon fontSize="small" />,
    muiColor: 'error'
  },
  ended: {
    label: 'Ended',
    color: '#9CA3AF',
    bgColor: 'rgba(156, 163, 175, 0.15)',
    borderColor: '#9CA3AF',
    icon: <Cancel fontSize="small" />,
    muiColor: 'default'
  }
};

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ==================== LAYOUT PRIMITIVES ====================

const FieldRow = ({ label, value, icon, color, isDarkMode }) => (
  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 0.5 }}>
    <Box sx={{ minWidth: 140, display: 'flex', alignItems: 'center', gap: 1 }}>
      {icon && <span style={{ color: color || (isDarkMode ? 'rgba(255,255,255,0.5)' : '#6B7280'), display: 'flex' }}>{icon}</span>}
      <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#6B7280', fontWeight: 600 }}>
        {label}
      </Typography>
    </Box>
    <Typography variant="body2" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'inherit', flex: 1, minWidth: 120 }}>
      {value || '—'}
    </Typography>
  </Box>
);

// ==================== COMPONENT ====================

const ActionDetail = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';

  // Redux state
  const { currentAction, loading, updatingProgress, error: reduxError } = useSelector((state) => state.actions);
  const statusOptions = useSelector(selectActionStatusOptions);
  const loadingStatusOptions = useSelector(selectActionTrackerLoading);
  const statusOptionsError = useSelector(selectActionTrackerError);
  const currentUser = useSelector((state) => state.auth?.user);
  const implementers = useSelector(selectActionImplementers);

  // Local UI state
  const [history, setHistory] = useState([]);
  const [progress, setProgress] = useState(0);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [selectedStatusValue, setSelectedStatusValue] = useState('');
  const [progressRemarks, setProgressRemarks] = useState('');
  const [localError, setLocalError] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showDeleteTaskDialog, setShowDeleteTaskDialog] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const displayImplementers = useMemo(() => {
    if (currentAction?.persons_implementing && currentAction.persons_implementing.length > 0) {
      return currentAction.persons_implementing;
    }
    if (implementers && implementers.length > 0) {
      return implementers;
    }
    return [];
  }, [currentAction?.persons_implementing, implementers]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (id && !isValidUUID(id)) {
      navigate('/actions/my-tasks', { replace: true });
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    dispatch(fetchActionById(id));
    dispatch(fetchActionTrackerAttributes());
    return () => {
      dispatch(clearCurrentAction());
      dispatch(clearError());
    };
  }, [id, dispatch]);

  const implementersFetchedForId = useRef(null);
  useEffect(() => {
    if (!currentAction?.id || currentAction.id !== id) return;
    const hasEmbeddedPersons = (currentAction.persons_implementing?.length || 0) > 0;
    if (hasEmbeddedPersons) return;
    if (implementersFetchedForId.current === currentAction.id) return;

    implementersFetchedForId.current = currentAction.id;
    dispatch(fetchActionImplementers(currentAction.id));
  }, [currentAction?.id, currentAction?.persons_implementing?.length, id, dispatch]);

  const fetchHistory = useCallback(async (actionId) => {
    if (!actionId) return;
    try {
      const res = await api.get(`/action-tracker/actions/${actionId}/history`);
      const historyData = (res.data || []).map((entry) => ({
        ...entry,
        created_by_name: entry.created_by_name || entry.created_by?.username || 'System'
      }));
      setHistory(historyData);
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setHistory([]);
    }
  }, []);

  const historyFetchedForId = useRef(null);
  useEffect(() => {
    if (currentAction?.id && historyFetchedForId.current !== currentAction.id) {
      historyFetchedForId.current = currentAction.id;
      fetchHistory(currentAction.id);
    }
  }, [currentAction?.id, fetchHistory]);

  useEffect(() => {
    if (currentAction) {
      setProgress(currentAction.overall_progress_percentage || 0);
      setSelectedStatusId(currentAction.overall_status_id || '');
      if (currentAction.overall_status_name) {
        setSelectedStatusValue(currentAction.overall_status_name);
      }
    }
  }, [currentAction?.overall_progress_percentage, currentAction?.overall_status_id, currentAction?.overall_status_name]);

  // ==================== HANDLERS ====================

  const refreshAction = useCallback(() => {
    if (id) dispatch(fetchActionById(id));
  }, [id, dispatch]);

  const handleGoBack = useCallback(() => {
    const hasHistory = window.history.state?.idx > 0 || window.history.length > 2;
    if (hasHistory) {
      navigate(-1);
    } else {
      navigate('/actions/my-tasks');
    }
  }, [navigate]);

  const handleUpdateProgress = async () => {
    if (!selectedStatusId && !selectedStatusValue) {
      setLocalError('Please select a status');
      return;
    }

    setLocalError('');
    setIsActionInProgress(true);

    try {
      const selectedOption = statusOptions.find(opt =>
        opt.id === selectedStatusId ||
        opt.value === selectedStatusValue ||
        opt.short_name === selectedStatusValue
      );

      const statusIdToUse = selectedOption?.id || selectedStatusId;

      if (!statusIdToUse) {
        setLocalError('Invalid status selected');
        return;
      }

      const payload = {
        progress_percentage: parseInt(progress),
        individual_status_id: statusIdToUse,
        remarks: progressRemarks.trim() || `Progress updated to ${progress}%`,
      };

      await dispatch(updateActionProgress({ id, progressData: payload })).unwrap();
      setShowProgressDialog(false);
      setProgressRemarks('');
      refreshAction();
      fetchHistory(id);
    } catch (err) {
      setLocalError(err.message || 'Failed to update progress');
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleMarkAsCompleted = async () => {
    const completedStatus = statusOptions.find(s =>
      s.code === 'ACTION_STATUS_COMPLETED' ||
      s.value === 'completed' ||
      s.short_name === 'completed' ||
      s.label?.toLowerCase().includes('completed')
    );

    if (!completedStatus) {
      setLocalError('Completed status not found.');
      setShowCompleteConfirm(false);
      return;
    }

    setIsActionInProgress(true);

    try {
      const payload = {
        progress_percentage: 100,
        individual_status_id: completedStatus.id,
        remarks: 'Task marked as completed',
      };

      await dispatch(updateActionProgress({ id, progressData: payload })).unwrap();
      setShowCompleteConfirm(false);
      refreshAction();
      fetchHistory(id);
    } catch (err) {
      setLocalError(err.message || 'Failed to mark as completed');
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleDeleteTask = async () => {
    setIsActionInProgress(true);
    setDeletingTask(true);
    try {
      await dispatch(deleteAction(id)).unwrap();
      setShowDeleteTaskDialog(false);
      navigate('/actions/my-tasks');
    } catch (err) {
      console.error('Failed to delete task:', err);
      setLocalError(err.message || 'Failed to delete task');
      setShowDeleteTaskDialog(false);
    } finally {
      setIsActionInProgress(false);
      setDeletingTask(false);
    }
  };

  // ==================== COMPUTED PROPERTIES ====================

  const isCompleted = useMemo(() =>
    Boolean(currentAction?.completed_at || currentAction?.overall_progress_percentage === 100),
    [currentAction?.completed_at, currentAction?.overall_progress_percentage]
  );

  const currentStatusConfig = useMemo(() => {
    if (isCompleted) return STATUS_CONFIG.completed;
    if (currentAction?.is_overdue) return STATUS_CONFIG.overdue;

    const statusValue = currentAction?.overall_status_name?.toLowerCase() ||
      currentAction?.status?.toLowerCase() ||
      'pending';

    return STATUS_CONFIG[statusValue] || STATUS_CONFIG.pending;
  }, [isCompleted, currentAction?.is_overdue, currentAction?.overall_status_name, currentAction?.status]);

  const activePriority = PRIORITY[currentAction?.priority] || PRIORITY[2];

  const canDeleteTask = () => {
    if (!currentUser || !currentAction) return false;
    return currentUser.is_admin || currentAction.created_by_id === currentUser.id;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0]?.[0]?.toUpperCase() || '?';
  };

  const getStatusName = (statusId) => {
    const option = statusOptions.find(opt => opt.id === statusId);
    return option?.label || option?.short_name || 'Unknown';
  };

  const getStatusConfigForHistory = (statusId, statusName) => {
    const option = statusOptions.find(opt => opt.id === statusId);
    const statusValue = option?.value || statusName?.toLowerCase() || 'pending';
    return STATUS_CONFIG[statusValue] || STATUS_CONFIG.pending;
  };

  // Common Paper Card styling for unified single-card layout
  const centralCardSx = {
    p: { xs: 2.5, sm: 4 },
    borderRadius: 3,
    bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: isDarkMode ? 'none' : '0 4px 20px rgba(0,0,0,0.04)',
  };

  // ==================== EARLY RETURNS ====================

  if (loading && !currentAction) {
    return (
      <Container sx={{ py: 4 }} maxWidth="md">
        <Stack spacing={2.5}>
          <Skeleton variant="rectangular" height={70} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 3 }} />
        </Stack>
      </Container>
    );
  }

  if (!currentAction) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <ErrorIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" fontWeight={700}>Task Not Found</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            The task you're looking for doesn't exist or has been removed.
          </Typography>
          <Button variant="contained" startIcon={<ArrowBack />} onClick={handleGoBack}>
            Go Back
          </Button>
        </Paper>
      </Container>
    );
  }

  // ==================== MAIN RENDER ====================

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 3 }, pb: { xs: 8, md: 4 } }}>
      
      {/* Top Bar Navigation (Back Button Only) */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleGoBack}
          size="small"
          sx={{
            color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'text.secondary',
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
          }}
        >
          Back
        </Button>
      </Stack>

      {/* Global Errors */}
      {(localError || reduxError) && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => { setLocalError(''); dispatch(clearError()); }}>
          {localError || reduxError}
        </Alert>
      )}

      {/* Completed Banner */}
      {isCompleted && (
        <Alert
          severity="success"
          icon={<TaskAlt />}
          sx={{
            mb: 3,
            borderRadius: 2,
            bgcolor: isDarkMode ? 'rgba(52, 211, 153, 0.12)' : 'success.light',
            color: isDarkMode ? '#34D399' : 'success.dark',
            '& .MuiAlert-icon': { color: isDarkMode ? '#34D399' : 'success.main' }
          }}
        >
          Completed on {currentAction.completed_at ? new Date(currentAction.completed_at).toLocaleDateString() : 'recently'}
        </Alert>
      )}

      {/* ==================== CENTRAL CARD CONTAINER ==================== */}
      <Paper sx={centralCardSx}>
        
        {/* Title & Overview Section */}
        <Box sx={{ mb: 3.5 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: isDarkMode ? '#fff' : 'text.primary', lineHeight: 1.35, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
            {currentAction.title || currentAction.description}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            <Chip
              icon={activePriority.icon}
              label={activePriority.label}
              color={activePriority.color}
              size="small"
              sx={{ fontWeight: 600, height: 24 }}
            />
            <Chip
              icon={currentStatusConfig.icon}
              label={currentStatusConfig.label}
              size="small"
              sx={{
                bgcolor: currentStatusConfig.bgColor,
                border: `1px solid ${currentStatusConfig.borderColor}`,
                color: currentStatusConfig.color,
                fontWeight: 600,
                height: 24,
                '& .MuiChip-icon': { color: currentStatusConfig.color }
              }}
            />
            {currentAction.type_of_action && (
              <Chip label={currentAction.type_of_action} variant="outlined" size="small" sx={{ height: 24 }} />
            )}
            {currentAction.is_key_action && (
              <Chip icon={<Lightbulb fontSize="small" />} label="Key Action" color="warning" size="small" sx={{ height: 24 }} />
            )}
            {currentAction.meeting_title && (
              <Chip
                icon={<OpenInNew fontSize="small" />}
                label={currentAction.meeting_title}
                variant="outlined"
                size="small"
                clickable
                onClick={() => navigate(`/meetings/${currentAction.minutes?.meeting_id}`)}
                sx={{ height: 24 }}
              />
            )}
          </Stack>

          {currentAction.tags && currentAction.tags.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
              {currentAction.tags.map((tag, idx) => (
                <Chip key={idx} label={`#${tag}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
              ))}
            </Stack>
          )}
        </Box>

        <Divider sx={{ mb: 3.5, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />

        {/* Core Details & Implementers Section */}
        <Box sx={{ mb: 3.5 }}>
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5} sx={{ mb: 2, fontSize: '0.75rem' }}>
            Action Specification
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FieldRow label="Issue / Challenge" value={currentAction.issue_challenge} icon={<ErrorIcon fontSize="small" />} isDarkMode={isDarkMode} />
              <FieldRow label="Date Initiated" value={currentAction.date_initiated ? new Date(currentAction.date_initiated).toLocaleDateString() : null} icon={<Event fontSize="small" />} isDarkMode={isDarkMode} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FieldRow label="Due Date" value={currentAction.due_date ? new Date(currentAction.due_date).toLocaleDateString() : null} icon={<Schedule fontSize="small" />} isDarkMode={isDarkMode} />
              <FieldRow label="Category / Title" value={currentAction.title} icon={<Label fontSize="small" />} isDarkMode={isDarkMode} />
            </Grid>
          </Grid>

          {displayImplementers.length > 0 && (
            <>
              <Box sx={{ mt: 3, mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.85rem' }}>
                  <People fontSize="small" color="action" />
                  Assigned Implementers ({displayImplementers.length})
                </Typography>
              </Box>

              <Stack spacing={1}>
                {displayImplementers.map((person, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 1,
                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                      border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.04)',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
                        {getInitials(person.name)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ color: isDarkMode ? '#fff' : 'text.primary' }}>
                          {person.name}
                        </Typography>
                        <Stack direction="row" spacing={1.5} flexWrap="wrap">
                          {person.email && (
                            <Typography variant="caption" color="text.secondary">
                              {person.email}
                            </Typography>
                          )}
                          {person.phone && (
                            <Typography variant="caption" color="text.secondary">
                              {person.phone}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                    {person.is_private && (
                      <Chip label="Private" size="small" icon={<LockIcon sx={{ fontSize: '10px !important' }} />} sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Box>

        <Divider sx={{ mb: 3.5, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />

        {/* Progress & Timeline Control Section */}
        <Box sx={{ mb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5} sx={{ fontSize: '0.75rem' }}>
              Current Progress
            </Typography>
            <Typography variant="h6" fontWeight={800} color={isCompleted ? 'success.main' : 'primary.main'}>
              {progress}%
            </Typography>
          </Stack>

          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              mb: 2.5,
              bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              '& .MuiLinearProgress-bar': { bgcolor: isCompleted ? '#34D399' : '#60A5FA', borderRadius: 4 }
            }}
          />

          {!isCompleted && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={3}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setShowProgressDialog(true)}
                disabled={isActionInProgress}
                size="small"
                sx={{ py: 1, borderRadius: 2, fontWeight: 600 }}
              >
                Update Progress
              </Button>
              <Button
                fullWidth
                variant="contained"
                color="success"
                startIcon={<TaskAlt />}
                onClick={() => setShowCompleteConfirm(true)}
                disabled={isActionInProgress}
                size="small"
                sx={{ py: 1, borderRadius: 2, fontWeight: 600 }}
              >
                Mark Completed
              </Button>
            </Stack>
          )}

          <Divider sx={{ my: 3, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />

          {/* Collapsible History Drawer */}
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setHistoryExpanded((v) => !v)}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <History fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: isDarkMode ? '#fff' : 'text.primary' }}>
                Activity & Status History
              </Typography>
              <Chip label={history.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
            </Stack>
            <IconButton size="small">
              {historyExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>

          <Collapse in={historyExpanded}>
            <Box sx={{ mt: 2 }}>
              {history.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  No update logs recorded yet.
                </Typography>
              ) : (
                <List disablePadding>
                  {history.map((entry, index) => {
                    const statusName = getStatusName(entry.individual_status_id);
                    const statusConfig = STATUS_CONFIG[entry.status_value] || getStatusConfigForHistory(entry.individual_status_id, statusName);

                    return (
                      <React.Fragment key={entry.id || index}>
                        <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.5 }}>
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Chip
                                  label={statusName}
                                  size="small"
                                  icon={statusConfig.icon}
                                  sx={{
                                    height: 22,
                                    fontSize: '0.7rem',
                                    bgcolor: statusConfig.bgColor,
                                    border: `1px solid ${statusConfig.borderColor}`,
                                    color: statusConfig.color,
                                    fontWeight: 600,
                                    '& .MuiChip-icon': { color: statusConfig.color }
                                  }}
                                />
                                <Typography variant="caption" fontWeight={600} color="text.secondary">
                                  {entry.progress_percentage}% completed
                                </Typography>
                              </Stack>
                            }
                            secondary={
                              <Box sx={{ mt: 0.75 }}>
                                {entry.remarks && (
                                  <Typography variant="body2" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'text.primary', mb: 0.5, fontSize: '0.85rem' }}>
                                    {entry.remarks}
                                  </Typography>
                                )}
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                  <Typography variant="caption" color="text.secondary">
                                    By {entry.created_by_name || 'System'}
                                  </Typography>
                                  <span>•</span>
                                  <Typography variant="caption" color="text.secondary">
                                    {entry.created_at ? new Date(entry.created_at.replace('Z', '')).toLocaleString() : 'Recent'}
                                  </Typography>
                                </Stack>
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < history.length - 1 && <Divider component="li" sx={{ opacity: 0.5 }} />}
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </Box>
          </Collapse>
        </Box>

        {/* Delete Button moved safely to the bottom of the Central Card */}
        {canDeleteTask() && !isCompleted && (
          <Box sx={{ mt: 4, pt: 3, borderTop: `1px dashed ${isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              color="error"
              startIcon={<Delete fontSize="small" />}
              onClick={() => setShowDeleteTaskDialog(true)}
              size="small"
              disabled={isActionInProgress}
              sx={{ textTransform: 'none', fontWeight: 600 }}
              variant="text"
            >
              Delete Task Permanently
            </Button>
          </Box>
        )}

      </Paper>

      {/* Progress Dialog */}
      <Dialog
        open={showProgressDialog}
        onClose={() => setShowProgressDialog(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle fontWeight={700}>Update Task Progress</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Progress Percentage: {progress}%
              </Typography>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', height: 6 }}
              />
            </Box>

            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={selectedStatusId}
                onChange={(e) => setSelectedStatusId(e.target.value)}
                label="Status"
                disabled={loadingStatusOptions}
              >
                {statusOptions.map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    {opt.label || opt.short_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Remarks / Note"
              multiline
              rows={2}
              size="small"
              value={progressRemarks}
              onChange={(e) => setProgressRemarks(e.target.value)}
              placeholder="What changed or was achieved?"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowProgressDialog(false)} size="small">Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateProgress}
            disabled={updatingProgress || !selectedStatusId || isActionInProgress}
            size="small"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark Complete Confirmation Dialog */}
      <Dialog open={showCompleteConfirm} onClose={() => setShowCompleteConfirm(false)} PaperProps={{ sx: { borderRadius: 3, p: 1, maxWidth: 360 } }}>
        <DialogTitle fontWeight={700}>Complete Task?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will immediately mark the progress at 100% and record completion.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowCompleteConfirm(false)} size="small">Cancel</Button>
          <Button color="success" variant="contained" onClick={handleMarkAsCompleted} disabled={isActionInProgress} size="small">
            Confirm Complete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Task Confirmation Dialog */}
      <Dialog open={showDeleteTaskDialog} onClose={() => setShowDeleteTaskDialog(false)} PaperProps={{ sx: { borderRadius: 3, p: 1, maxWidth: 360 } }}>
        <DialogTitle fontWeight={700} color="error">Delete Task</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete this action item permanently? This action cannot be reversed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowDeleteTaskDialog(false)} disabled={deletingTask} size="small">Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteTask} disabled={deletingTask} size="small">
            {deletingTask ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ActionDetail;