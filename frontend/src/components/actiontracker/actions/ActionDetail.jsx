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
  useTheme, useMediaQuery, Tooltip, CircularProgress,
  Card
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
// Defined at module scope on purpose — components declared inside another
// component's render body get a new identity every render, which causes
// React to unmount/remount the subtree (and drop input focus). Keeping
// these outside AddActionDialog/ActionDetail avoids that class of bug.

const FieldRow = ({ label, value, icon, color, isDarkMode }) => (
  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 0.5 }}>
    <Box sx={{ minWidth: 160, display: 'flex', alignItems: 'center', gap: 1 }}>
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

  // Embedded data on currentAction is guaranteed to belong to the action
  // being viewed. The separately-fetched `implementers` array is kept in
  // its own slice and isn't cleared when navigating between actions, so
  // it's only used as a fallback when nothing is embedded.
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
  // NOTE ON THE FETCH LOOPS BELOW:
  // These effects used to depend on the *whole* currentAction object (and
  // the implementers array) coming out of Redux. Redux Toolkit/Immer hands
  // back a new object reference on basically every dispatch to that slice,
  // even when the underlying data hasn't changed. An effect that depends
  // on that object reference re-fires on every one of those dispatches,
  // fires another fetch, gets another new reference, and so on forever —
  // which is exactly what the endless "Action ... retrieved" log spam was.
  // Fix: depend on primitive values (id strings, lengths) and use a ref to
  // make sure each thing is only ever fetched once per action id.

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const implementersFetchedForId = useRef(null);
  useEffect(() => {
    // Guard against a currentAction left over from the previous route
    // (async fetch hasn't caught up with the new id yet).
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

  useEffect(() => {
    if (statusOptionsError) {
      console.error('Failed to load status options:', statusOptionsError);
    }
  }, [statusOptionsError]);

  // ==================== HANDLERS ====================

  const refreshAction = useCallback(() => {
    if (id) dispatch(fetchActionById(id));
  }, [id, dispatch]);

  // Prefer actual browser-history "back" so the user lands wherever they
  // came from (a filtered list, a meeting page, search results, etc.)
  // instead of always being dropped on the generic tasks list. Falls back
  // to that list only when there's no in-app history to go back to, e.g.
  // the page was opened directly via a shared link.
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

  // ==================== RENDER HELPERS ====================

  const paperSx = {
    p: 3,
    mb: 3,
    borderRadius: 3,
    bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
    backdropFilter: isDarkMode ? 'blur(10px)' : 'none',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
    }
  };

  // ==================== EARLY RETURNS ====================

  if (loading && !currentAction) {
    return (
      <Container sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
        </Stack>
      </Container>
    );
  }

  if (!currentAction) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{
          p: 4,
          textAlign: 'center',
          borderRadius: 3,
          bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
        }}>
          <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={700}>Task Not Found</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            The task you're looking for doesn't exist or has been deleted.
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBack />}
            onClick={handleGoBack}
            sx={{ mt: 2 }}
          >
            Go Back
          </Button>
        </Paper>
      </Container>
    );
  }

  // ==================== MAIN RENDER ====================

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, pb: isMobile ? 10 : 4 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Tooltip title="Go Back">
          <IconButton
            onClick={handleGoBack}
            size={isMobile ? 'medium' : 'large'}
            sx={{
              color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit',
              '&:hover': {
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              }
            }}
          >
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{
            flex: 1,
            textAlign: 'center',
            color: isDarkMode ? '#fff' : 'inherit'
          }}
        >
          Task Details
        </Typography>
        {canDeleteTask() && !isCompleted && (
          <Tooltip title="Delete Task">
            <IconButton
              color="error"
              onClick={() => setShowDeleteTaskDialog(true)}
              size={isMobile ? 'medium' : 'large'}
              disabled={isActionInProgress}
              sx={{
                '&:hover': {
                  bgcolor: isDarkMode ? 'rgba(244, 67, 54, 0.12)' : 'rgba(244, 67, 54, 0.04)',
                }
              }}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Global Error */}
      {(localError || reduxError) && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => { setLocalError(''); dispatch(clearError()); }}
        >
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
            bgcolor: isDarkMode ? 'rgba(52, 211, 153, 0.12)' : 'success.light',
            color: isDarkMode ? '#34D399' : 'success.dark',
            '& .MuiAlert-icon': {
              color: isDarkMode ? '#34D399' : 'success.main'
            }
          }}
        >
          This task has been completed on {currentAction.completed_at ? new Date(currentAction.completed_at).toLocaleString() : 'an unknown date'}
        </Alert>
      )}

      {/* Overview Card: title, status chips */}
      <Paper sx={paperSx}>
        <Typography
          variant="h5"
          fontWeight={700}
          gutterBottom
          sx={{ color: isDarkMode ? '#fff' : 'inherit' }}
        >
          {currentAction.title || currentAction.description}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            icon={activePriority.icon}
            label={`Priority: ${activePriority.label}`}
            color={activePriority.color}
            size="small"
          />
          <Chip
            icon={currentStatusConfig.icon}
            label={currentStatusConfig.label}
            size="small"
            sx={{
              bgcolor: currentStatusConfig.bgColor,
              border: `1px solid ${currentStatusConfig.borderColor}`,
              color: currentStatusConfig.color,
              fontWeight: 500,
              '& .MuiChip-icon': {
                color: currentStatusConfig.color
              },
              '&:hover': {
                bgcolor: currentStatusConfig.bgColor,
              }
            }}
          />
          {currentAction.type_of_action && (
            <Chip
              icon={<Flag />}
              label={currentAction.type_of_action}
              variant="outlined"
              size="small"
              sx={{
                borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
                color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'inherit',
              }}
            />
          )}
          {currentAction.is_key_action && (
            <Chip
              icon={<Lightbulb />}
              label="Key Action"
              color="warning"
              size="small"
            />
          )}
          {currentAction.meeting_title && (
            <Chip
              icon={<OpenInNew />}
              label={currentAction.meeting_title}
              variant="outlined"
              size="small"
              clickable
              onClick={() => navigate(`/meetings/${currentAction.minutes?.meeting_id}`)}
              sx={{
                borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
                color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'inherit',
                '&:hover': {
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.24)',
                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                }
              }}
            />
          )}
        </Stack>

        {/* Tags moved here so overview + metadata live in one card */}
        {currentAction.tags && currentAction.tags.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            {currentAction.tags.map((tag, idx) => (
              <Chip
                key={idx}
                label={tag}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
                  color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'inherit',
                }}
              />
            ))}
          </Stack>
        )}
      </Paper>

      {/* ==================== DETAILS + PERSONS IMPLEMENTING (merged) ==================== */}
      <Paper sx={paperSx}>
        <Typography
          variant="h6"
          fontWeight={700}
          gutterBottom
          sx={{ color: isDarkMode ? '#fff' : 'inherit', mb: 2 }}
        >
          Details
        </Typography>

        <Divider sx={{ mb: 2, borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FieldRow
              label="Issue / Challenge"
              value={currentAction.issue_challenge}
              icon={<ErrorIcon fontSize="small" />}
              isDarkMode={isDarkMode}
            />
            <FieldRow
              label="Title / Category"
              value={currentAction.title}
              icon={<Label fontSize="small" />}
              isDarkMode={isDarkMode}
            />
            <FieldRow
              label="Date Initiated"
              value={currentAction.date_initiated ? new Date(currentAction.date_initiated).toLocaleDateString() : null}
              icon={<Event fontSize="small" />}
              isDarkMode={isDarkMode}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FieldRow
              label="Expected Resolution"
              value={currentAction.due_date ? new Date(currentAction.due_date).toLocaleDateString() : null}
              icon={<Schedule fontSize="small" />}
              isDarkMode={isDarkMode}
            />
            <FieldRow
              label="Key Action"
              value={currentAction.is_key_action ? 'Yes' : 'No'}
              icon={<Lightbulb fontSize="small" />}
              isDarkMode={isDarkMode}
            />
            <FieldRow
              label="From Meeting"
              value={currentAction.meeting_title || '—'}
              icon={<LinkIcon fontSize="small" />}
              isDarkMode={isDarkMode}
            />
          </Grid>
        </Grid>

        {displayImplementers.length > 0 && (
          <>
            <Divider sx={{ my: 2, borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'inherit', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <People fontSize="small" />
              Person(s) Implementing ({displayImplementers.length})
            </Typography>

            <Stack spacing={1.5}>
              {displayImplementers.map((person, idx) => (
                <Card
                  key={idx}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#fafafa',
                    borderRadius: 2,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Avatar
                      sx={{
                        bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.2)' : 'primary.main',
                        color: isDarkMode ? '#60A5FA' : '#fff',
                      }}
                    >
                      {getInitials(person.name)}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ color: isDarkMode ? '#fff' : 'inherit' }}>
                        {person.name}
                      </Typography>
                      <Stack direction="row" spacing={2} flexWrap="wrap">
                        {person.email && (
                          <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#6B7280' }}>
                            <EmailIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
                            {person.email}
                          </Typography>
                        )}
                        {person.phone && (
                          <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#6B7280' }}>
                            <PhoneIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
                            {person.phone}
                          </Typography>
                        )}
                        {person.is_private && (
                          <Chip
                            label="Private"
                            size="small"
                            icon={<LockIcon sx={{ fontSize: 12 }} />}
                            sx={{
                              height: 18,
                              fontSize: '0.6rem',
                              bgcolor: isDarkMode ? 'rgba(156, 163, 175, 0.2)' : 'rgba(0,0,0,0.06)',
                              color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#6B7280',
                            }}
                          />
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </Card>
              ))}
            </Stack>
          </>
        )}
      </Paper>

      {/* Progress Section */}
      <Paper sx={paperSx}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'inherit' }}
          >
            Progress
          </Typography>
          <Typography
            variant="h6"
            fontWeight={800}
            color={isCompleted ? 'success.main' : 'primary.main'}
          >
            {progress}%
          </Typography>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 12,
            borderRadius: 6,
            mb: 2,
            bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            '& .MuiLinearProgress-bar': {
              bgcolor: isCompleted ? '#34D399' : '#60A5FA',
              borderRadius: 6,
            }
          }}
        />

        {!isCompleted && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              fullWidth={isMobile}
              variant="outlined"
              onClick={() => setShowProgressDialog(true)}
              disabled={isActionInProgress}
              sx={{
                borderColor: isDarkMode ? 'rgba(96, 165, 250, 0.3)' : 'primary.main',
                color: isDarkMode ? '#60A5FA' : 'primary.main',
                '&:hover': {
                  borderColor: isDarkMode ? '#60A5FA' : 'primary.dark',
                  bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.08)' : 'rgba(25, 118, 210, 0.04)',
                }
              }}
            >
              Update Progress
            </Button>
            <Button
              fullWidth={isMobile}
              variant="contained"
              color="success"
              startIcon={<TaskAlt />}
              onClick={() => setShowCompleteConfirm(true)}
              disabled={isActionInProgress}
              sx={{
                bgcolor: isDarkMode ? '#34D399' : 'success.main',
                '&:hover': {
                  bgcolor: isDarkMode ? '#2DD4BF' : 'success.dark',
                }
              }}
            >
              Mark as Completed
            </Button>
          </Stack>
        )}

        {/* Status History nested under Progress so it reads as one narrative */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ cursor: 'pointer', mt: 3 }}
          onClick={() => setHistoryExpanded((v) => !v)}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <History fontSize="small" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'inherit' }} />
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'inherit' }}
            >
              Status History
            </Typography>
            <Chip
              label={history.length}
              size="small"
              sx={{
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit',
              }}
            />
          </Stack>
          <IconButton
            size="small"
            sx={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'inherit' }}
          >
            {historyExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Stack>

        <Collapse in={historyExpanded}>
          <Divider sx={{
            my: 2,
            borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
          }} />

          {history.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ py: 2, textAlign: 'center' }}
            >
              No status changes recorded yet
            </Typography>
          ) : (
            <List>
              {history.map((entry, index) => {
                const statusName = getStatusName(entry.individual_status_id);
                const statusConfig = getStatusConfigForHistory(entry.individual_status_id, statusName);

                return (
                  <React.Fragment key={entry.id || index}>
                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip
                              label={statusName}
                              size="small"
                              icon={statusConfig.icon}
                              sx={{
                                bgcolor: statusConfig.bgColor,
                                border: `1px solid ${statusConfig.borderColor}`,
                                color: statusConfig.color,
                                fontWeight: 500,
                                '& .MuiChip-icon': {
                                  color: statusConfig.color
                                }
                              }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              Progress: {entry.progress_percentage}%
                            </Typography>
                          </Stack>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            {entry.remarks && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 0.5 }}
                              >
                                {entry.remarks}
                              </Typography>
                            )}
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Person sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {entry.created_by_name || entry.created_by?.full_name || entry.created_by?.username || 'System'}
                              </Typography>
                              <AccessTime sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
                              <Typography variant="caption" color="text.secondary">
                                {entry.created_at ? new Date(entry.created_at).toLocaleString() : 'Unknown date'}
                              </Typography>
                            </Stack>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < history.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Collapse>
      </Paper>

      {/* Progress Dialog */}
      <Dialog
        open={showProgressDialog}
        onClose={() => setShowProgressDialog(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: isDarkMode ? '#1a1a2e' : '#fff',
            borderRadius: 3,
            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : 'none',
          }
        }}
      >
        <DialogTitle sx={{ color: isDarkMode ? '#fff' : 'inherit' }}>
          Update Progress
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography
                gutterBottom
                sx={{ color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'inherit' }}
              >
                Progress: {progress}%
              </Typography>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: isDarkMode ? '#60A5FA' : '#1976d2',
                }}
              />
            </Box>

            <FormControl fullWidth>
              <InputLabel sx={{ color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit' }}>
                Status
              </InputLabel>
              <Select
                value={selectedStatusId}
                onChange={(e) => setSelectedStatusId(e.target.value)}
                label="Status"
                disabled={loadingStatusOptions}
                sx={{
                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'transparent',
                  color: isDarkMode ? '#fff' : 'inherit',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDarkMode ? '#60A5FA' : 'primary.main',
                  },
                  '& .MuiSelect-icon': {
                    color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit',
                  }
                }}
              >
                {loadingStatusOptions && statusOptions.length === 0 ? (
                  <MenuItem disabled>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={16} />
                      <Typography variant="body2">Loading statuses...</Typography>
                    </Stack>
                  </MenuItem>
                ) : (
                  statusOptions.map((opt) => {
                    const statusConfig = STATUS_CONFIG[opt.value] || STATUS_CONFIG.pending;
                    return (
                      <MenuItem
                        key={opt.id}
                        value={opt.id}
                        sx={{
                          color: isDarkMode ? '#fff' : 'inherit',
                          '&:hover': {
                            bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                          }
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <span style={{ color: statusConfig.color }}>
                            {statusConfig.icon}
                          </span>
                          <Typography variant="body2">
                            {opt.label || opt.short_name}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    );
                  })
                )}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Remarks (Optional)"
              multiline
              rows={3}
              value={progressRemarks}
              onChange={(e) => setProgressRemarks(e.target.value)}
              placeholder="Add any notes about this progress update..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'transparent',
                  color: isDarkMode ? '#fff' : 'inherit',
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
                }
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setShowProgressDialog(false)}
            sx={{
              color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit',
              '&:hover': {
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateProgress}
            disabled={updatingProgress || !selectedStatusId || isActionInProgress || loadingStatusOptions}
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
            Save Progress
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complete Confirmation Dialog */}
      <Dialog
        open={showCompleteConfirm}
        onClose={() => setShowCompleteConfirm(false)}
        PaperProps={{
          sx: {
            bgcolor: isDarkMode ? '#1a1a2e' : '#fff',
            borderRadius: 3,
            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : 'none',
          }
        }}
      >
        <DialogTitle sx={{ color: isDarkMode ? '#fff' : 'inherit' }}>
          Mark as Completed?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'inherit' }}>
            Are you sure you want to mark this task as completed?
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1 }}
          >
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setShowCompleteConfirm(false)}
            sx={{
              color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit',
              '&:hover': {
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              }
            }}
          >
            Cancel
          </Button>
          <Button
            color="success"
            variant="contained"
            onClick={handleMarkAsCompleted}
            disabled={isActionInProgress}
            sx={{
              bgcolor: isDarkMode ? '#34D399' : 'success.main',
              '&:hover': {
                bgcolor: isDarkMode ? '#2DD4BF' : 'success.dark',
              },
              '&.Mui-disabled': {
                bgcolor: isDarkMode ? 'rgba(52, 211, 153, 0.3)' : 'rgba(46, 125, 50, 0.3)',
              }
            }}
          >
            Yes, Complete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Task Confirmation Dialog */}
      <Dialog
        open={showDeleteTaskDialog}
        onClose={() => setShowDeleteTaskDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: isDarkMode ? '#1a1a2e' : '#fff',
            borderRadius: 3,
            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : 'none',
          }
        }}
      >
        <DialogTitle sx={{ color: isDarkMode ? '#fff' : 'inherit' }}>
          Delete Task
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'inherit' }}>
            Are you sure you want to delete this task?
          </Typography>
          <Typography
            variant="body2"
            color="error"
            sx={{ mt: 1 }}
          >
            This action cannot be undone. All history will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setShowDeleteTaskDialog(false)}
            disabled={deletingTask || isActionInProgress}
            sx={{
              color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'inherit',
              '&:hover': {
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              }
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteTask}
            disabled={deletingTask || isActionInProgress}
            sx={{
              bgcolor: isDarkMode ? '#EF4444' : 'error.main',
              '&:hover': {
                bgcolor: isDarkMode ? '#DC2626' : 'error.dark',
              },
              '&.Mui-disabled': {
                bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(211, 47, 47, 0.3)',
              }
            }}
          >
            {deletingTask ? 'Deleting...' : 'Delete Task'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ActionDetail;