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
  WatchLater, CheckCircleOutline, PauseCircle, CancelOutlined,
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

const PRIORITY = {
  1: { label: 'High', color: 'error', icon: <PriorityHigh /> },
  2: { label: 'Medium', color: 'warning', icon: <Schedule /> },
  3: { label: 'Low', color: 'success', icon: <CheckCircle /> },
  4: { label: 'Very Low', color: 'default', icon: <Info /> },
};

// Enhanced status configuration with specific colors and icons
const STATUS_CONFIG = {
  pending: { 
    label: 'Pending', 
    color: '#F59E0B',
    bgColor: '#F59E0B',
    icon: <HourglassEmpty fontSize="small" />,
    muiColor: 'warning'
  },
  started: { 
    label: 'Started', 
    color: '#3B82F6',
    bgColor: '#3B82F6',
    icon: <PlayCircle fontSize="small" />,
    muiColor: 'info'
  },
  in_progress: { 
    label: 'In Progress', 
    color: '#3B82F6',
    bgColor: '#3B82F6',
    icon: <Pending fontSize="small" />,
    muiColor: 'info'
  },
  awaiting: { 
    label: 'Awaiting', 
    color: '#8B5CF6',
    bgColor: '#8B5CF6',
    icon: <WatchLater fontSize="small" />,
    muiColor: 'secondary'
  },
  awaiting_approval: { 
    label: 'Awaiting Approval', 
    color: '#8B5CF6',
    bgColor: '#8B5CF6',
    icon: <Pending fontSize="small" />,
    muiColor: 'secondary'
  },
  in_review: { 
    label: 'In Review', 
    color: '#A78BFA',
    bgColor: '#A78BFA',
    icon: <CheckCircleOutline fontSize="small" />,
    muiColor: 'secondary'
  },
  on_hold: { 
    label: 'On Hold', 
    color: '#6B7280',
    bgColor: '#6B7280',
    icon: <PauseCircle fontSize="small" />,
    muiColor: 'default'
  },
  blocked: { 
    label: 'Blocked', 
    color: '#EF4444',
    bgColor: '#EF4444',
    icon: <CancelOutlined fontSize="small" />,
    muiColor: 'error'
  },
  completed: { 
    label: 'Completed', 
    color: '#10B981',
    bgColor: '#10B981',
    icon: <CheckCircle fontSize="small" />,
    muiColor: 'success'
  },
  closed: { 
    label: 'Closed', 
    color: '#059669',
    bgColor: '#059669',
    icon: <TaskAlt fontSize="small" />,
    muiColor: 'success'
  },
  cancelled: { 
    label: 'Cancelled', 
    color: '#DC2626',
    bgColor: '#DC2626',
    icon: <HighlightOff fontSize="small" />,
    muiColor: 'error'
  },
  overdue: { 
    label: 'Overdue', 
    color: '#EF4444',
    bgColor: '#EF4444',
    icon: <ErrorIcon fontSize="small" />,
    muiColor: 'error'
  },
  ended: { 
    label: 'Ended', 
    color: '#6B7280',
    bgColor: '#6B7280',
    icon: <Cancel fontSize="small" />,
    muiColor: 'default'
  }
};

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const ActionDetail = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  // Validate ID
  useEffect(() => {
    if (id && !isValidUUID(id)) {
      navigate('/actions/my-tasks', { replace: true });
    }
  }, [id, navigate]);

  // Fetch main action data using Redux
  const fetchAction = useCallback(() => {
    if (id) {
      dispatch(fetchActionById(id));
    }
  }, [id, dispatch]);

  // Fetch action tracker attributes (statuses) if not already loaded
  const fetchAttributes = useCallback(() => {
    dispatch(fetchActionTrackerAttributes());
  }, [dispatch]);

  useEffect(() => {
    fetchAction();
    fetchAttributes(); // Fetch status options if not already cached
    return () => {
      dispatch(clearCurrentAction());
      dispatch(clearError());
    };
  }, [fetchAction, fetchAttributes, dispatch]);

  // Fetch supplementary data (comments, history)
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

  // Run supplementary fetch when action is loaded
  useEffect(() => {
    if (currentAction) {
      fetchSupplementaryData();
    }
  }, [currentAction, fetchSupplementaryData]);

  // Sync local form values
  useEffect(() => {
    if (currentAction) {
      setProgress(currentAction.overall_progress_percentage || 0);
      setSelectedStatusId(currentAction.overall_status_id || '');
      if (currentAction.overall_status_name) {
        setSelectedStatusValue(currentAction.overall_status_name);
      }
    }
  }, [currentAction]);

  // Handle errors from status options fetch
  useEffect(() => {
    if (statusOptionsError) {
      console.error('Failed to load status options:', statusOptionsError);
    }
  }, [statusOptionsError]);

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

  const isCompleted = useMemo(() => 
    Boolean(currentAction?.completed_at || currentAction?.overall_progress_percentage === 100), 
    [currentAction]
  );

  // Get status configuration for current action
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

  // Check if user can delete comment (creator or admin)
  const canDeleteComment = (comment) => {
    return currentUser && (comment.created_by_id === currentUser.id || currentUser.is_admin);
  };

  // Check if user can delete task (admin or creator)
  const canDeleteTask = () => {
    if (!currentUser || !currentAction) return false;
    return currentUser.is_admin || currentAction.created_by_id === currentUser.id;
  };

  // Helper function to get status config for history entries
  const getStatusConfigForHistory = (statusId, statusName) => {
    const option = statusOptions.find(opt => opt.id === statusId);
    const statusValue = option?.value || statusName?.toLowerCase() || 'pending';
    return STATUS_CONFIG[statusValue] || STATUS_CONFIG.pending;
  };

  // Get status name from option
  const getStatusName = (statusId) => {
    const option = statusOptions.find(opt => opt.id === statusId);
    return option?.label || option?.short_name || 'Unknown';
  };

  // Get status icon component
  const getStatusIcon = (statusConfig) => {
    return statusConfig.icon || <Schedule fontSize="small" />;
  };

  // Early returns
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
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
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

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, pb: isMobile ? 10 : 4 }}>
      {/* Header - Back button and Delete button */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Tooltip title="Go Back">
          <IconButton onClick={handleGoBack} size={isMobile ? 'medium' : 'large'}>
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1, textAlign: 'center' }}>
          Task Details
        </Typography>
        {canDeleteTask() && !isCompleted && (
          <Tooltip title="Delete Task">
            <IconButton 
              color="error" 
              onClick={() => setShowDeleteTaskDialog(true)}
              size={isMobile ? 'medium' : 'large'}
              disabled={isActionInProgress}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Global Error */}
      {(localError || reduxError) && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => { setLocalError(''); dispatch(clearError()); }}>
          {localError || reduxError}
        </Alert>
      )}

      {/* Completed Banner */}
      {isCompleted && (
        <Alert severity="success" icon={<TaskAlt />} sx={{ mb: 3 }}>
          This task has been completed on {currentAction.completed_at ? new Date(currentAction.completed_at).toLocaleString() : 'an unknown date'}
        </Alert>
      )}

      {/* Header Card */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {currentAction.description || currentAction.title}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip 
            icon={activePriority.icon} 
            label={activePriority.label} 
            color={activePriority.color} 
            size="small" 
          />
          <Chip 
            icon={getStatusIcon(currentStatusConfig)}
            label={currentStatusConfig.label}
            size="small"
            sx={{ 
              bgcolor: currentStatusConfig.bgColor,
              color: '#fff',
              fontWeight: 500,
              '& .MuiChip-icon': { color: '#fff' }
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
            />
          )}
        </Stack>
      </Paper>

      {/* Progress Section */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={700}>Progress</Typography>
          <Typography variant="h6" fontWeight={800} color={isCompleted ? 'success.main' : 'primary.main'}>
            {progress}%
          </Typography>
        </Stack>

        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ height: 12, borderRadius: 6, mb: 2 }}
        />

        {!isCompleted && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button 
              fullWidth={isMobile} 
              variant="outlined" 
              onClick={() => setShowProgressDialog(true)}
              disabled={isActionInProgress}
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
            >
              Mark as Completed
            </Button>
          </Stack>
        )}
      </Paper>

      {/* Status History Section */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stack 
          direction="row" 
          justifyContent="space-between" 
          alignItems="center" 
          sx={{ cursor: 'pointer' }}
          onClick={() => toggleSection('history')}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <History />
            <Typography variant="h6" fontWeight={700}>
              Status History
            </Typography>
            <Chip label={history.length} size="small" />
          </Stack>
          <IconButton size="small">
            {expandedSections.history ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Stack>
        
        <Collapse in={expandedSections.history}>
          <Divider sx={{ my: 2 }} />
          
          {history.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
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
                                color: '#fff',
                                fontWeight: 500,
                                '& .MuiChip-icon': { color: '#fff' }
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
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
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
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stack 
          direction="row" 
          justifyContent="space-between" 
          alignItems="center" 
          sx={{ cursor: 'pointer' }}
          onClick={() => toggleSection('comments')}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Comment />
            <Typography variant="h6" fontWeight={700}>
              Comments
            </Typography>
            <Chip label={comments.length} size="small" />
          </Stack>
          <IconButton size="small">
            {expandedSections.comments ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Stack>
        
        <Collapse in={expandedSections.comments}>
          <Divider sx={{ my: 2 }} />
          
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
            />
            <IconButton 
              color="primary" 
              onClick={handleAddComment}
              disabled={!newComment.trim() || isActionInProgress}
            >
              <Send />
            </IconButton>
          </Stack>
          
          {/* Comments List */}
          {comments.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No comments yet
            </Typography>
          ) : (
            <List>
              {comments.map((comment, index) => (
                <React.Fragment key={comment.id || index}>
                  <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2">
                          {comment.comment}
                        </Typography>
                      }
                      secondary={
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                              {(comment.created_by_name || 'S')[0].toUpperCase()}
                            </Avatar>
                            <Typography variant="caption" fontWeight={500}>
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
      <Dialog open={showProgressDialog} onClose={() => setShowProgressDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Update Progress</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography gutterBottom>Progress: {progress}%</Typography>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </Box>
            
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={selectedStatusId}
                onChange={(e) => setSelectedStatusId(e.target.value)}
                label="Status"
                disabled={loadingStatusOptions}
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
                      <MenuItem key={opt.id} value={opt.id}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {statusConfig.icon}
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
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProgressDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateProgress} 
            disabled={updatingProgress || !selectedStatusId || isActionInProgress || loadingStatusOptions}
          >
            Save Progress
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complete Confirmation Dialog */}
      <Dialog open={showCompleteConfirm} onClose={() => setShowCompleteConfirm(false)}>
        <DialogTitle>Mark as Completed?</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to mark this task as completed?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCompleteConfirm(false)}>Cancel</Button>
          <Button 
            color="success" 
            variant="contained" 
            onClick={handleMarkAsCompleted}
            disabled={isActionInProgress}
          >
            Yes, Complete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Task Confirmation Dialog */}
      <Dialog open={showDeleteTaskDialog} onClose={() => setShowDeleteTaskDialog(false)}>
        <DialogTitle>Delete Task</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this task?</Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This action cannot be undone. All comments and history will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteTaskDialog(false)} disabled={deletingTask || isActionInProgress}>
            Cancel
          </Button>
          <Button 
            color="error" 
            variant="contained" 
            onClick={handleDeleteTask}
            disabled={deletingTask || isActionInProgress}
          >
            {deletingTask ? 'Deleting...' : 'Delete Task'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Comment Confirmation Dialog */}
      <Dialog open={showDeleteCommentDialog} onClose={() => setShowDeleteCommentDialog(false)}>
        <DialogTitle>Delete Comment</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this comment?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteCommentDialog(false)} disabled={deletingComment}>
            Cancel
          </Button>
          <Button 
            color="error" 
            variant="contained" 
            onClick={handleDeleteComment}
            disabled={deletingComment}
          >
            {deletingComment ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ActionDetail;