// src/components/actiontracker/actions/ActionDetail.jsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Paper, Typography, Box, Stack, Chip, Button, IconButton,
  Divider, LinearProgress, Avatar, TextField, Grid,
  List, ListItem, ListItemText, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Skeleton, Alert, Collapse,
  useTheme, useMediaQuery, CircularProgress, Card,
  CardContent, Tooltip, Badge, Tabs, Tab
} from '@mui/material';
import {
  ArrowBack, Delete, History,
  Description, OpenInNew, AccessTime, Event, Info,
  PriorityHigh, CheckCircle, Cancel, PlayCircle, Pending,
  ExpandMore, ExpandLess, TaskAlt, Error as ErrorIcon,
  WatchLater, CheckCircleOutlined, PauseCircle, CancelOutlined,
  HighlightOff, HourglassEmpty, People, Label, Lightbulb, Schedule,
  Assignment, Flag, Category, Refresh, MoreVert, Person,
  Email, Phone
} from '@mui/icons-material';
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

// ==================== COMPACT FIELD ITEM ====================

const DetailField = ({ label, value, icon, isDarkMode }) => (
  <Box sx={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: 1.5, 
    py: 1,
    borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#F3F4F6'}`,
    '&:last-child': { borderBottom: 'none' }
  }}>
    <Box sx={{ 
      color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#9CA3AF', 
      display: 'flex', 
      alignItems: 'center',
      minWidth: 20
    }}>
      {icon ? React.cloneElement(icon, { fontSize: 'small' }) : <Info fontSize="small" />}
    </Box>
    <Typography 
      variant="body2" 
      sx={{ 
        color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#6B7280',
        fontWeight: 500,
        minWidth: 100,
        flexShrink: 0,
        fontSize: '0.8rem'
      }}
    >
      {label}
    </Typography>
    <Typography 
      variant="body2" 
      sx={{ 
        color: isDarkMode ? '#FFFFFF' : '#111827', 
        fontWeight: 500,
        wordBreak: 'break-word',
        flex: 1,
        fontSize: '0.85rem'
      }}
    >
      {value || '—'}
    </Typography>
  </Box>
);

// ==================== IMPLEMENTER CARD ====================

const ImplementerCard = ({ person, isDarkMode }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0]?.[0]?.toUpperCase() || '?';
  };

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#F9FAFB',
        border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E5E7EB',
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
        }
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem', bgcolor: 'primary.main' }}>
          {getInitials(person.name)}
        </Avatar>
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ color: isDarkMode ? '#fff' : 'text.primary' }}>
            {person.name}
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {person.email && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Email sx={{ fontSize: 12 }} />
                {person.email}
              </Typography>
            )}
            {person.phone && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Phone sx={{ fontSize: 12 }} />
                {person.phone}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
      {person.is_private && (
        <Chip 
          label="Private" 
          size="small" 
          icon={<LockIcon sx={{ fontSize: '10px !important' }} />} 
          sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }} 
        />
      )}
    </Box>
  );
};

// ==================== COMPONENT ====================

const ActionDetail = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { currentAction, loading, updatingProgress, error: reduxError } = useSelector((state) => state.actions);
  const statusOptions = useSelector(selectActionStatusOptions);
  const loadingStatusOptions = useSelector(selectActionTrackerLoading);
  const currentUser = useSelector((state) => state.auth?.user);
  const implementers = useSelector(selectActionImplementers);

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
  const [activeTab, setActiveTab] = useState(0);

  const displayImplementers = useMemo(() => {
    if (currentAction?.persons_implementing && currentAction.persons_implementing.length > 0) {
      return currentAction.persons_implementing;
    }
    if (implementers && implementers.length > 0) {
      return implementers;
    }
    return [];
  }, [currentAction?.persons_implementing, implementers]);

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

  const getStatusName = (statusId) => {
    const option = statusOptions.find(opt => opt.id === statusId);
    return option?.label || option?.short_name || 'Unknown';
  };

  const getStatusConfigForHistory = (statusId, statusName) => {
    const option = statusOptions.find(opt => opt.id === statusId);
    const statusValue = option?.value || statusName?.toLowerCase() || 'pending';
    return STATUS_CONFIG[statusValue] || STATUS_CONFIG.pending;
  };

  if (loading && !currentAction) {
    return (
      <Box sx={{ width: '100%', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: theme.palette.primary.main }} />
        <Typography sx={{ ml: 2, color: theme.palette.text.secondary }}>Loading task details...</Typography>
      </Box>
    );
  }

  if (!currentAction) {
    return (
      <Box sx={{ width: '100%', p: 4, display: 'flex', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, maxWidth: 500, width: '100%' }}>
          <ErrorIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" fontWeight={700}>Task Not Found</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            The task you're looking for doesn't exist or has been removed.
          </Typography>
          <Button variant="contained" startIcon={<ArrowBack />} onClick={handleGoBack}>
            Go Back
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: isDarkMode ? '#0F172A' : '#F3F4F6', p: { xs: 1.5, sm: 3 } }}>
      
      {/* ========== STICKY HEADER ========== */}
      <Paper 
        elevation={0}
        sx={{ 
          position: 'sticky',
          top: 0,
          zIndex: 10,
          p: { xs: 2, sm: 3 },
          borderRadius: 2,
          bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : '#FFFFFF',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E5E7EB',
          backdropFilter: 'blur(8px)',
          mb: 2
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
          <IconButton onClick={handleGoBack} size="small" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6B7280' }}>
            <ArrowBack />
          </IconButton>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="h6" 
              fontWeight={700} 
              sx={{ 
                color: isDarkMode ? '#FFFFFF' : '#111827',
                fontSize: { xs: '1rem', sm: '1.25rem' },
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {currentAction.title || currentAction.description || 'Action Tracker Form'}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={activePriority.icon}
              label={activePriority.label}
              color={activePriority.color}
              size="small"
              sx={{ height: 24, fontSize: '0.7rem' }}
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
                fontSize: '0.7rem',
                '& .MuiChip-icon': { color: currentStatusConfig.color }
              }}
            />
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={refreshAction} disabled={isActionInProgress}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Progress Bar in Header */}
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="caption" fontWeight={600} sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6B7280' }}>
              Progress
            </Typography>
            <Typography variant="caption" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
              {progress}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
              '& .MuiLinearProgress-bar': { bgcolor: isCompleted ? '#34D399' : '#3B82F6', borderRadius: 2 }
            }}
          />
        </Box>

        {/* Action Buttons */}
        {!isCompleted && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowProgressDialog(true)}
              disabled={isActionInProgress}
              sx={{ 
                flex: 1,
                borderRadius: 1.5,
                fontWeight: 600,
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#D1D5DB',
                color: isDarkMode ? '#FFFFFF' : '#374151',
                py: 0.75
              }}
            >
              Update
            </Button>
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<CheckCircle sx={{ fontSize: 16 }} />}
              onClick={() => setShowCompleteConfirm(true)}
              disabled={isActionInProgress}
              sx={{ 
                flex: 1,
                borderRadius: 1.5,
                fontWeight: 600,
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                bgcolor: '#10B981',
                '&:hover': { bgcolor: '#059669' },
                py: 0.75
              }}
            >
              Complete
            </Button>
          </Stack>
        )}
      </Paper>

      {(localError || reduxError) && (
        <Alert 
          severity="error" 
          sx={{ mb: 2, borderRadius: 1.5 }} 
          onClose={() => { setLocalError(''); dispatch(clearError()); }}
        >
          {localError || reduxError}
        </Alert>
      )}

      {isCompleted && (
        <Alert
          severity="success"
          icon={<TaskAlt />}
          sx={{ mb: 2, borderRadius: 1.5 }}
        >
          Completed on {currentAction.completed_at ? new Date(currentAction.completed_at).toLocaleDateString() : 'recently'}
        </Alert>
      )}

      {/* ========== MAIN CONTENT ========== */}
      <Paper 
        elevation={0}
        sx={{ 
          borderRadius: 2,
          bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#FFFFFF',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E5E7EB',
          overflow: 'hidden'
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant={isMobile ? "fullWidth" : "standard"}
          sx={{
            px: { xs: 1, sm: 3 },
            pt: 1,
            '& .MuiTab-root': {
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.8rem',
              minHeight: 40
            }
          }}
        >
          <Tab label="Details & Implementers" icon={<Info sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label="History" icon={<History sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>

        <Divider />

        {/* ===== TAB 1: DETAILS & IMPLEMENTERS ===== */}
        {activeTab === 0 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Grid container spacing={3}>
              {/* LEFT COLUMN - Details */}
              <Grid item xs={12} md={6}>
                <Typography 
                  variant="subtitle2" 
                  fontWeight={600} 
                  sx={{ 
                    color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6B7280',
                    mb: 1.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontSize: '0.7rem'
                  }}
                >
                  Details
                </Typography>
                <Box>
                  <DetailField 
                    label="Category" 
                    value={currentAction.title} 
                    icon={<Category />} 
                    isDarkMode={isDarkMode} 
                  />
                  <DetailField 
                    label="Key Action" 
                    value={currentAction.is_key_action ? 'Yes' : 'No'} 
                    icon={<Lightbulb />} 
                    isDarkMode={isDarkMode} 
                  />
                  <DetailField 
                    label="Issue" 
                    value={currentAction.issue_challenge} 
                    icon={<ErrorIcon />} 
                    isDarkMode={isDarkMode} 
                  />
                  <DetailField 
                    label="Type" 
                    value={currentAction.type_of_action} 
                    icon={<Info />} 
                    isDarkMode={isDarkMode} 
                  />
                  <DetailField 
                    label="Action" 
                    value={currentAction.description} 
                    icon={<Assignment />} 
                    isDarkMode={isDarkMode} 
                  />
                  <DetailField 
                    label="Priority" 
                    value={activePriority.label} 
                    icon={<Flag />} 
                    isDarkMode={isDarkMode} 
                  />
                  <DetailField 
                    label="Initiated" 
                    value={currentAction.date_initiated ? new Date(currentAction.date_initiated).toLocaleDateString() : '—'} 
                    icon={<Event />} 
                    isDarkMode={isDarkMode} 
                  />
                  <DetailField 
                    label="Due Date" 
                    value={currentAction.due_date ? new Date(currentAction.due_date).toLocaleDateString() : '—'} 
                    icon={<AccessTime />} 
                    isDarkMode={isDarkMode} 
                  />
                  <DetailField 
                    label="Tags" 
                    value={currentAction.tags?.join(', ')} 
                    icon={<Label />} 
                    isDarkMode={isDarkMode} 
                  />
                </Box>
              </Grid>

              {/* RIGHT COLUMN - Implementers */}
              <Grid item xs={12} md={6}>
                <Typography 
                  variant="subtitle2" 
                  fontWeight={600} 
                  sx={{ 
                    color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6B7280',
                    mb: 1.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontSize: '0.7rem'
                  }}
                >
                  Implementers {displayImplementers.length > 0 && `(${displayImplementers.length})`}
                </Typography>
                {displayImplementers.length === 0 ? (
                  <Box 
                    sx={{ 
                      p: 3, 
                      textAlign: 'center',
                      border: `2px dashed ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#E5E7EB'}`,
                      borderRadius: 2
                    }}
                  >
                    <People sx={{ fontSize: 40, color: isDarkMode ? 'rgba(255,255,255,0.2)' : '#D1D5DB', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No implementers assigned
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    {displayImplementers.map((person, idx) => (
                      <ImplementerCard 
                        key={idx} 
                        person={person} 
                        isDarkMode={isDarkMode} 
                      />
                    ))}
                  </Stack>
                )}
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ===== TAB 2: HISTORY ===== */}
        {activeTab === 1 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {history.length === 0 ? (
              <Box 
                sx={{ 
                  p: 4, 
                  textAlign: 'center',
                  border: `2px dashed ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#E5E7EB'}`,
                  borderRadius: 2
                }}
              >
                <History sx={{ fontSize: 40, color: isDarkMode ? 'rgba(255,255,255,0.2)' : '#D1D5DB', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No update logs recorded yet.
                </Typography>
              </Box>
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
                              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
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
        )}
      </Paper>

      {/* ========== DELETE BUTTON ========== */}
      {canDeleteTask() && !isCompleted && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            color="error"
            startIcon={<Delete fontSize="small" />}
            onClick={() => setShowDeleteTaskDialog(true)}
            size="small"
            disabled={isActionInProgress}
            sx={{ textTransform: 'none', fontWeight: 500 }}
            variant="text"
          >
            Delete Task
          </Button>
        </Box>
      )}

      {/* ========== DIALOGS ========== */}

      {/* Progress Dialog */}
      <Dialog
        open={showProgressDialog}
        onClose={() => setShowProgressDialog(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle fontWeight={700}>Update Progress</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Progress: {progress}%
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
              label="Remarks"
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
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark Complete Confirmation */}
      <Dialog open={showCompleteConfirm} onClose={() => setShowCompleteConfirm(false)} PaperProps={{ sx: { borderRadius: 2, p: 1, maxWidth: 360 } }}>
        <DialogTitle fontWeight={700}>Complete Task?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will mark progress at 100% and record completion.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowCompleteConfirm(false)} size="small">Cancel</Button>
          <Button color="success" variant="contained" onClick={handleMarkAsCompleted} disabled={isActionInProgress} size="small">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteTaskDialog} onClose={() => setShowDeleteTaskDialog(false)} PaperProps={{ sx: { borderRadius: 2, p: 1, maxWidth: 360 } }}>
        <DialogTitle fontWeight={700} color="error">Delete Task</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete this action item permanently?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowDeleteTaskDialog(false)} disabled={deletingTask} size="small">Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteTask} disabled={deletingTask} size="small">
            {deletingTask ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default ActionDetail;