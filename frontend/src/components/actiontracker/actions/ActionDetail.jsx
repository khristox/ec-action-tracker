// src/components/actiontracker/actions/ActionDetail.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ArrowBack, Edit, Delete, Comment, History, Person, Schedule,
  Description, Send, OpenInNew, AccessTime, Event, Info,
  PriorityHigh, CheckCircle, Cancel, PlayCircle, Pending,
  ExpandMore, ExpandLess, TaskAlt, Error as ErrorIcon,
  WatchLater, CheckCircleOutlined, PauseCircle, CancelOutlined,
  HighlightOff, HourglassEmpty
} from '@mui/icons-material';

import {
  fetchActionById,
  updateActionProgress,
  addActionComment,
  deleteAction,
  clearCurrentAction,
  clearError
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

// Enhanced status configuration with dark mode optimized colors
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

  // Local UI state
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [progress, setProgress] = useState(0);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [selectedStatusValue, setSelectedStatusValue] = useState('');
  const [progressRemarks, setProgressRemarks] = useState('');
  const [localError, setLocalError] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    comments: true,
    history: false,
  });
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showDeleteCommentDialog, setShowDeleteCommentDialog] = useState(false);
  const [showDeleteTaskDialog, setShowDeleteTaskDialog] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (id && !isValidUUID(id)) {
      navigate('/actions/my-tasks', { replace: true });
    }
  }, [id, navigate]);

  const fetchAction = useCallback(() => {
    if (id) {
      dispatch(fetchActionById(id));
    }
  }, [id, dispatch]);

  const fetchAttributes = useCallback(() => {
    dispatch(fetchActionTrackerAttributes());
  }, [dispatch]);

  useEffect(() => {
    fetchAction();
    fetchAttributes();
    return () => {
      dispatch(clearCurrentAction());
      dispatch(clearError());
    };
  }, [fetchAction, fetchAttributes, dispatch]);

  const fetchSupplementaryData = useCallback(async () => {
    if (!id) return;

    try {
      const [commentsRes, historyRes] = await Promise.all([
        api.get(`/action-tracker/actions/${id}/comments`).catch(() => ({ data: [] })),
        api.get(`/action-tracker/actions/${id}/history`).catch(() => ({ data: [] })),
      ]);
      
      const commentsData = (commentsRes.data || []).map(comment => ({
        ...comment,
        created_by_name: comment.created_by_name || comment.created_by?.username || 'System',
        created_by: comment.created_by || { username: comment.created_by_name || 'System' }
      }));
      setComments(commentsData);

      const historyData = (historyRes.data || []).map(entry => ({
        ...entry,
        created_by_name: entry.created_by_name || entry.created_by?.username || 'System'
      }));
      setHistory(historyData);
    } catch (err) {
      console.error('Failed to fetch supplementary data:', err);
    }
  }, [id]);

  useEffect(() => {
    if (currentAction) {
      fetchSupplementaryData();
    }
  }, [currentAction, fetchSupplementaryData]);

  useEffect(() => {
    if (currentAction) {
      setProgress(currentAction.overall_progress_percentage || 0);
      setSelectedStatusId(currentAction.overall_status_id || '');
      if (currentAction.overall_status_name) {
        setSelectedStatusValue(currentAction.overall_status_name);
      }
    }
  }, [currentAction]);

  useEffect(() => {
    if (statusOptionsError) {
      console.error('Failed to load status options:', statusOptionsError);
    }
  }, [statusOptionsError]);

  // ==================== HANDLERS ====================

  const handleGoBack = () => {
    window.history.back();
  };

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
      handleGoBack();
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
      handleGoBack();
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
      handleGoBack();
    } catch (err) {
      console.error('Failed to delete task:', err);
      setLocalError(err.message || 'Failed to delete task');
      setShowDeleteTaskDialog(false);
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsActionInProgress(true);
    try {
      await dispatch(addActionComment({ id, commentData: { comment: newComment } })).unwrap();
      setNewComment('');
      await fetchSupplementaryData();
    } catch (err) {
      setLocalError('Failed to add comment');
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!selectedComment) return;
    
    setDeletingComment(true);
    try {
      await api.delete(`/action-tracker/actions/${id}/comments/${selectedComment.id}`);
      setComments(comments.filter(c => c.id !== selectedComment.id));
      setShowDeleteCommentDialog(false);
      setSelectedComment(null);
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setLocalError('Failed to delete comment');
    } finally {
      setDeletingComment(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // ==================== COMPUTED PROPERTIES ====================

  const isCompleted = useMemo(() => 
    Boolean(currentAction?.completed_at || currentAction?.overall_progress_percentage === 100), 
    [currentAction]
  );

  const getCurrentStatusConfig = () => {
    if (isCompleted) {
      return STATUS_CONFIG.completed;
    }
    if (currentAction?.is_overdue) {
      return STATUS_CONFIG.overdue;
    }
    
    const statusValue = currentAction?.overall_status_name?.toLowerCase() || 
                        currentAction?.status?.toLowerCase() || 
                        'pending';
    
    return STATUS_CONFIG[statusValue] || STATUS_CONFIG.pending;
  };

  const currentStatusConfig = getCurrentStatusConfig();
  const activePriority = PRIORITY[currentAction?.priority] || PRIORITY[2];

  const canDeleteComment = (comment) => {
    return currentUser && (comment.created_by_id === currentUser.id || currentUser.is_admin);
  };

  const canDeleteTask = () => {
    if (!currentUser || !currentAction) return false;
    return currentUser.is_admin || currentAction.created_by_id === currentUser.id;
  };

  const getStatusConfigForHistory = (statusId, statusName) => {
    const option = statusOptions.find(opt => opt.id === statusId);
    const statusValue = option?.value || statusName?.toLowerCase() || 'pending';
    return STATUS_CONFIG[statusValue] || STATUS_CONFIG.pending;
  };

  const getStatusName = (statusId) => {
    const option = statusOptions.find(opt => opt.id === statusId);
    return option?.label || option?.short_name || 'Unknown';
  };

  const getStatusIcon = (statusConfig) => {
    return statusConfig.icon || <Schedule fontSize="small" />;
  };

  // ==================== RENDER HELPERS ====================

  // Dark mode optimized paper styles
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

      {/* Header Card */}
      <Paper sx={paperSx}>
        <Typography 
          variant="h5" 
          fontWeight={700} 
          gutterBottom
          sx={{ color: isDarkMode ? '#fff' : 'inherit' }}
        >
          {currentAction.description || currentAction.title}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip 
            icon={activePriority.icon} 
            label={activePriority.label} 
            color={activePriority.color} 
            size="small" 
            sx={{
              '& .MuiChip-icon': {
                color: isDarkMode ? 'inherit' : 'inherit'
              }
            }}
          />
          <Chip 
            icon={getStatusIcon(currentStatusConfig)}
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
      </Paper>

      {/* Status History Section */}
      <Paper sx={paperSx}>
        <Stack 
          direction="row" 
          justifyContent="space-between" 
          alignItems="center" 
          sx={{ cursor: 'pointer' }}
          onClick={() => toggleSection('history')}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <History sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'inherit' }} />
            <Typography 
              variant="h6" 
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
            {expandedSections.history ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Stack>
        
        <Collapse in={expandedSections.history}>
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

      {/* Comments Section */}
      <Paper sx={paperSx}>
        <Stack 
          direction="row" 
          justifyContent="space-between" 
          alignItems="center" 
          sx={{ cursor: 'pointer' }}
          onClick={() => toggleSection('comments')}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Comment sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'inherit' }} />
            <Typography 
              variant="h6" 
              fontWeight={700}
              sx={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'inherit' }}
            >
              Comments
            </Typography>
            <Chip 
              label={comments.length} 
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
            {expandedSections.comments ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Stack>
        
        <Collapse in={expandedSections.comments}>
          <Divider sx={{ 
            my: 2,
            borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
          }} />
          
          {/* Add Comment Input */}
          <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              disabled={isActionInProgress}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
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
                '& .MuiInputBase-input': {
                  color: isDarkMode ? '#fff' : 'inherit',
                }
              }}
            />
            <IconButton 
              color="primary" 
              onClick={handleAddComment}
              disabled={!newComment.trim() || isActionInProgress}
              sx={{
                bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.12)' : 'rgba(25, 118, 210, 0.04)',
                '&:hover': {
                  bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.2)' : 'rgba(25, 118, 210, 0.08)',
                }
              }}
            >
              <Send />
            </IconButton>
          </Stack>
          
          {/* Comments List */}
          {comments.length === 0 ? (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ py: 2, textAlign: 'center' }}
            >
              No comments yet
            </Typography>
          ) : (
            <List>
              {comments.map((comment, index) => (
                <React.Fragment key={comment.id || index}>
                  <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Typography 
                          variant="body2"
                          sx={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'inherit' }}
                        >
                          {comment.comment}
                        </Typography>
                      }
                      secondary={
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ 
                              width: 24, 
                              height: 24, 
                              fontSize: '0.75rem',
                              bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.2)' : 'primary.main',
                              color: isDarkMode ? '#60A5FA' : '#fff'
                            }}>
                              {(comment.created_by_name || 'S')[0].toUpperCase()}
                            </Avatar>
                            <Typography 
                              variant="caption" 
                              fontWeight={500}
                              sx={{ color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'text.primary' }}
                            >
                              {comment.created_by_name || comment.created_by?.full_name || comment.created_by?.username || 'System'}
                            </Typography>
                            <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Unknown date'}
                            </Typography>
                          </Stack>
                          {canDeleteComment(comment) && (
                            <Tooltip title="Delete comment">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => {
                                  setSelectedComment(comment);
                                  setShowDeleteCommentDialog(true);
                                }}
                                sx={{
                                  '&:hover': {
                                    bgcolor: isDarkMode ? 'rgba(244, 67, 54, 0.12)' : 'rgba(244, 67, 54, 0.04)',
                                  }
                                }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      }
                    />
                  </ListItem>
                  {index < comments.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
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
            This action cannot be undone. All comments and history will be permanently deleted.
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

      {/* Delete Comment Confirmation Dialog */}
      <Dialog 
        open={showDeleteCommentDialog} 
        onClose={() => setShowDeleteCommentDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: isDarkMode ? '#1a1a2e' : '#fff',
            borderRadius: 3,
            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : 'none',
          }
        }}
      >
        <DialogTitle sx={{ color: isDarkMode ? '#fff' : 'inherit' }}>
          Delete Comment
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'inherit' }}>
            Are you sure you want to delete this comment?
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
            onClick={() => setShowDeleteCommentDialog(false)} 
            disabled={deletingComment}
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
            onClick={handleDeleteComment}
            disabled={deletingComment}
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
            {deletingComment ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ActionDetail;