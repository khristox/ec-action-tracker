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
  useTheme, useMediaQuery
} from '@mui/material';
import {
  ArrowBack, Edit, Delete, Comment, History, Person, Schedule,
  Description, Send, OpenInNew, AccessTime, Event, Info,
  PriorityHigh, CheckCircle, Cancel, PlayCircle, Pending,
  ExpandMore, ExpandLess, TaskAlt, Error as ErrorIcon
} from '@mui/icons-material';

import {
  fetchActionById,
  updateActionProgress,
  addActionComment,
  clearCurrentAction,
  clearError
} from '../../../store/slices/actionTracker/actionSlice';
import api from '../../../services/api'; // ✅ ADD THIS IMPORT

const PRIORITY = {
  1: { label: 'High', color: 'error', icon: <PriorityHigh /> },
  2: { label: 'Medium', color: 'warning', icon: <Schedule /> },
  3: { label: 'Low', color: 'success', icon: <CheckCircle /> },
  4: { label: 'Very Low', color: 'default', icon: <Info /> },
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

  // Local UI state
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [progress, setProgress] = useState(0);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [selectedStatusName, setSelectedStatusName] = useState('');
  const [progressRemarks, setProgressRemarks] = useState('');
  const [localError, setLocalError] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    comments: true,
    history: false,
  });
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

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

  useEffect(() => {
    fetchAction();
    return () => {
      dispatch(clearCurrentAction());
      dispatch(clearError());
    };
  }, [fetchAction, dispatch]);

  // Fetch supplementary data (comments, history, status options)
  const fetchSupplementaryData = useCallback(async () => {
    if (!id) return;

    try {
      const [commentsRes, historyRes, attrRes] = await Promise.all([
        api.get(`/action-tracker/actions/${id}/comments`).catch(() => ({ data: [] })),
        api.get(`/action-tracker/actions/${id}/history`).catch(() => ({ data: [] })),
        api.get('/attribute-groups/ACTION_TRACKER/attributes').catch(() => ({ data: { items: [] } })),
      ]);

      setComments(commentsRes.data || []);
      setHistory(historyRes.data || []);

      const attributes = attrRes.data?.items || attrRes.data || [];
      // Filter for ACTION_STATUS_* attributes
      const actionStatuses = attributes.filter(attr => 
        attr.code?.startsWith('ACTION_STATUS_') && attr.code !== 'ACTION_STATUS'
      );
      setStatusOptions(actionStatuses);
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
      // Find status name from current action
      if (currentAction.overall_status_name) {
        setSelectedStatusName(currentAction.overall_status_name);
      }
    }
  }, [currentAction]);

  const handleUpdateProgress = async () => {
    if (!selectedStatusId && !selectedStatusName) {
      setLocalError('Please select a status');
      return;
    }

    setLocalError('');
    
    try {
      // Find the selected status option to get the correct ID
      const selectedOption = statusOptions.find(opt => 
        opt.id === selectedStatusId || 
        opt.short_name === selectedStatusName ||
        opt.code === selectedStatusName
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
      fetchAction(); // Refresh action data
      fetchSupplementaryData(); // Refresh history
    } catch (err) {
      setLocalError(err.message || 'Failed to update progress');
    }
  };

  const handleMarkAsCompleted = async () => {
    const completedStatus = statusOptions.find(s =>
      s.code === 'ACTION_STATUS_COMPLETED' || 
      s.short_name === 'COMPLETED' ||
      s.name?.toLowerCase().includes('completed')
    );

    if (!completedStatus) {
      setLocalError('Completed status not found.');
      setShowCompleteConfirm(false);
      return;
    }

    try {
      const payload = {
        progress_percentage: 100,
        individual_status_id: completedStatus.id,
        remarks: 'Task marked as completed',
      };

      await dispatch(updateActionProgress({ id, progressData: payload })).unwrap();
      setShowCompleteConfirm(false);
      fetchAction(); // Refresh action data
      fetchSupplementaryData(); // Refresh history
    } catch (err) {
      setLocalError(err.message || 'Failed to mark as completed');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await dispatch(addActionComment({ id, commentData: { comment: newComment } })).unwrap();
      setNewComment('');
      fetchSupplementaryData(); // Refresh comments
    } catch (err) {
      setLocalError('Failed to add comment');
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const isCompleted = useMemo(() => 
    Boolean(currentAction?.completed_at || currentAction?.overall_progress_percentage === 100), 
    [currentAction]
  );

  const activePriority = PRIORITY[currentAction?.priority] || PRIORITY[2];
  const statusLabel = isCompleted ? 'Completed' 
    : currentAction?.is_overdue ? 'Overdue' 
    : currentAction?.overall_progress_percentage > 0 ? 'In Progress' : 'Pending';

  const statusColor = isCompleted ? 'success' 
    : currentAction?.is_overdue ? 'error' 
    : currentAction?.overall_progress_percentage > 0 ? 'info' : 'warning';

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
            onClick={() => navigate('/actions/my-tasks')}
            sx={{ mt: 2 }}
          >
            Back to My Tasks
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, pb: isMobile ? 10 : 4 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/actions/my-tasks')} size={isMobile ? 'medium' : 'large'}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1, textAlign: 'center' }}>
          Task Details
        </Typography>
        {!isCompleted && (
          <Stack direction="row" spacing={1}>
            <IconButton color="primary" onClick={() => navigate(`/actions/${id}/edit`)}>
              <Edit />
            </IconButton>
            <IconButton color="error">
              <Delete />
            </IconButton>
          </Stack>
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
          <Chip icon={activePriority.icon} label={activePriority.label} color={activePriority.color} size="small" />
          <Chip 
            icon={statusColor === 'success' ? <CheckCircle /> : statusColor === 'error' ? <Cancel /> : <PlayCircle />} 
            label={statusLabel} 
            color={statusColor} 
            size="small" 
          />
          {currentAction.meeting_title && (
            <Chip icon={<OpenInNew />} label={currentAction.meeting_title} variant="outlined" size="small" clickable 
              onClick={() => navigate(`/meetings/${currentAction.minutes?.meeting_id}`)} />
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
            <Button fullWidth={isMobile} variant="outlined" onClick={() => setShowProgressDialog(true)}>
              Update Progress
            </Button>
            <Button 
              fullWidth={isMobile} 
              variant="contained" 
              color="success" 
              startIcon={<TaskAlt />} 
              onClick={() => setShowCompleteConfirm(true)}
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
                // Find status option for this history entry
                const statusOption = statusOptions.find(opt => opt.id === entry.individual_status_id);
                const statusName = statusOption?.name?.replace('Action Status - ', '') || 
                                  statusOption?.short_name || 
                                  entry.status_name || 
                                  'Unknown';
                
                // Get status color (you can map based on status name)
                const getStatusColor = (status) => {
                  if (status === 'COMPLETED' || status?.toLowerCase().includes('completed')) return '#10B981';
                  if (status === 'IN_PROGRESS' || status?.toLowerCase().includes('in_progress')) return '#3B82F6';
                  if (status === 'OVERDUE') return '#EF4444';
                  if (status === 'BLOCKED') return '#6B7280';
                  if (status === 'CANCELLED') return '#EF4444';
                  return '#F59E0B'; // Pending default
                };
                
                return (
                  <React.Fragment key={entry.id || index}>
                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip 
                              label={statusName}
                              size="small"
                              sx={{ 
                                bgcolor: getStatusColor(statusName),
                                color: '#fff',
                                fontWeight: 500
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
                                {entry.created_by?.full_name || entry.created_by?.username || 'System'}
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
            />
            <IconButton 
              color="primary" 
              onClick={handleAddComment}
              disabled={!newComment.trim()}
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
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                          <Person sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {comment.created_by?.full_name || comment.created_by?.username || 'System'}
                          </Typography>
                          <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Unknown date'}
                          </Typography>
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
              >
                {statusOptions.map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    {opt.name?.replace('Action Status - ', '') || opt.short_name}
                  </MenuItem>
                ))}
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
            disabled={updatingProgress || !selectedStatusId}
          >
            Save Progress
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complete Confirmation */}
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
          <Button color="success" variant="contained" onClick={handleMarkAsCompleted}>
            Yes, Complete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ActionDetail;