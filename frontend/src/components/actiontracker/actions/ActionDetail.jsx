import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button, IconButton,
  Divider, LinearProgress, Avatar, TextField, Grid, 
  List, ListItem, ListItemText, Dialog, DialogTitle, 
  DialogContent, DialogActions, FormControl, InputLabel, 
  Select, MenuItem, Skeleton, Alert, SwipeableDrawer,
  BottomNavigation, BottomNavigationAction, useTheme, useMediaQuery,
  Card, CardContent, Collapse, Tooltip
} from '@mui/material';
import {
  ArrowBack, Edit, Delete, Comment, History, Person, Schedule,
  Description, Send, OpenInNew, LocationOn, AccessTime,
  Event, People, Assignment, PriorityHigh, CheckCircle,
  Cancel, PlayCircle, Pending, ExpandMore, ExpandLess,
  Info, CalendarToday, Update, AddComment, TaskAlt
} from '@mui/icons-material';

// Store & API
import { 
  fetchActionById, updateActionProgress, addActionComment, 
  clearCurrentAction 
} from '../../../store/slices/actionTracker/actionSlice';
import api from '../../../services/api';

const PRIORITY = {
  1: { label: 'High', color: 'error', icon: <PriorityHigh /> },
  2: { label: 'Medium', color: 'warning', icon: <Schedule /> },
  3: { label: 'Low', color: 'success', icon: <CheckCircle /> },
  4: { label: 'Very Low', color: 'default', icon: <Info /> }
};

const ActionDetails = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  // Redux State
  const { currentAction, loading, updatingProgress, error } = useSelector((state) => state.actions);
  
  // Local State
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [progress, setProgress] = useState(0);
  const [dialogs, setDialogs] = useState({ progress: false, meetingDetails: false, completeConfirm: false });
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [progressRemarks, setProgressRemarks] = useState('');
  const [localError, setLocalError] = useState('');
  const [expandedSections, setExpandedSections] = useState({ details: true, comments: true, history: false });
  const [bottomNav, setBottomNav] = useState(0);
  const [meetingDetails, setMeetingDetails] = useState(null);
  const [loadingMeeting, setLoadingMeeting] = useState(false);
  const [completing, setCompleting] = useState(false);

  const fetchData = useCallback(async () => {
    dispatch(fetchActionById(id));
    try {
      const [comRes, histRes, attrRes] = await Promise.all([
        api.get(`/action-tracker/actions/${id}/comments`),
        api.get(`/action-tracker/actions/${id}/history`),
        api.get('/attribute-groups/ACTION_TRACKER/attributes')
      ]);
      setComments(comRes.data || []);
      setHistory(histRes.data || []);
      
      const attributes = attrRes.data.items || attrRes.data || [];
      const actionStatuses = attributes.filter(a => a.code?.startsWith('ACTION_STATUS_'));
      setStatusOptions(actionStatuses);
    } catch (e) {
      console.error("Failed to fetch supplementary data", e);
    }
  }, [id, dispatch]);

  // Fetch meeting details when action has meeting info
  useEffect(() => {
    if (currentAction?.meeting_id) {
      const fetchMeetingDetails = async () => {
        setLoadingMeeting(true);
        try {
          const response = await api.get(`/action-tracker/meetings/${currentAction.meeting_id}`);
          setMeetingDetails(response.data);
        } catch (err) {
          console.error('Failed to fetch meeting details:', err);
        } finally {
          setLoadingMeeting(false);
        }
      };
      fetchMeetingDetails();
    }
  }, [currentAction?.meeting_id]);

  useEffect(() => {
    fetchData();
    return () => dispatch(clearCurrentAction());
  }, [fetchData, dispatch]);

  useEffect(() => {
    if (currentAction) {
      setProgress(currentAction.overall_progress_percentage || 0);
      setSelectedStatusId(currentAction.overall_status_id || '');
    }
  }, [currentAction]);

  const handleUpdateProgress = async () => {
    if (!selectedStatusId) {
      setLocalError('Please select a status');
      return;
    }
    
    setLocalError('');
    
    try {
      const payload = {
        progress_percentage: parseInt(progress),
        individual_status_id: selectedStatusId,
        remarks: progressRemarks.trim() || `Progress updated to ${progress}%`
      };
      
      const result = await dispatch(updateActionProgress({
        id: id,
        progressData: payload
      }));
      
      if (result.error) {
        setLocalError(result.error.message || 'Failed to update progress');
      } else {
        setDialogs({ ...dialogs, progress: false });
        setProgressRemarks('');
        fetchData();
      }
    } catch (err) {
      setLocalError(err.response?.data?.detail || 'Failed to update progress');
    }
  };

  // Mark as Completed function
  const handleMarkAsCompleted = async () => {
    setCompleting(true);
    setLocalError('');
    
    try {
      // Find COMPLETED status ID
      const completedStatus = statusOptions.find(s => s.code === 'ACTION_STATUS_COMPLETED');
      
      if (!completedStatus) {
        setLocalError('Completed status not found. Please contact administrator.');
        setDialogs({ ...dialogs, completeConfirm: false });
        setCompleting(false);
        return;
      }
      
      const payload = {
        progress_percentage: 100,
        individual_status_id: completedStatus.id,
        remarks: 'Task marked as completed'
      };
      
      const result = await dispatch(updateActionProgress({
        id: id,
        progressData: payload
      }));
      
      if (result.error) {
        setLocalError(result.error.message || 'Failed to mark as completed');
      } else {
        setDialogs({ ...dialogs, completeConfirm: false });
        fetchData();
      }
    } catch (err) {
      setLocalError(err.response?.data?.detail || 'Failed to mark as completed');
    } finally {
      setCompleting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await dispatch(addActionComment({
        id: id,
        commentData: { comment: newComment }
      }));
      setNewComment('');
      fetchData();
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusIcon = () => {
    if (!currentAction) return <Pending />;
    if (currentAction.completed_at) return <CheckCircle />;
    if (currentAction.is_overdue) return <Cancel />;
    if (currentAction.overall_progress_percentage > 0) return <PlayCircle />;
    return <Pending />;
  };

  const getStatusColor = () => {
    if (!currentAction) return 'default';
    if (currentAction.completed_at) return 'success';
    if (currentAction.is_overdue) return 'error';
    if (currentAction.overall_progress_percentage > 0) return 'info';
    return 'warning';
  };

  const isCompleted = currentAction?.completed_at !== null || currentAction?.overall_progress_percentage === 100;

  const StatItem = ({ icon, label, value }) => {
    let displayValue = value;
    if (typeof value === 'object') {
      displayValue = value?.name || value?.label || 'N/A';
    }
    if (!displayValue || displayValue === '') displayValue = 'N/A';
    
    return (
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'action.hover', color: 'primary.main' }}>
          {icon}
        </Avatar>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            {label}
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {displayValue}
          </Typography>
        </Box>
      </Stack>
    );
  };

  // Mobile Meeting Details Drawer
  const MeetingDetailsDrawer = () => (
    <SwipeableDrawer
      anchor="bottom"
      open={dialogs.meetingDetails}
      onClose={() => setDialogs({ ...dialogs, meetingDetails: false })}
      onOpen={() => setDialogs({ ...dialogs, meetingDetails: true })}
      disableSwipeToOpen={false}
      sx={{
        '& .MuiDrawer-paper': {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '85vh'
        }
      }}
    >
      <Box sx={{ p: 3, pb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>
            Meeting Details
          </Typography>
          <IconButton onClick={() => setDialogs({ ...dialogs, meetingDetails: false })}>
            <ArrowBack />
          </IconButton>
        </Stack>
        
        {loadingMeeting ? (
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
        ) : meetingDetails ? (
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={700} color="primary">
              {meetingDetails.title}
            </Typography>
            
            <Stack direction="row" spacing={1} alignItems="center">
              <Event fontSize="small" color="action" />
              <Typography variant="body2">
                {new Date(meetingDetails.meeting_date).toLocaleDateString()}
              </Typography>
              <AccessTime fontSize="small" color="action" sx={{ ml: 1 }} />
              <Typography variant="body2">
                {new Date(meetingDetails.start_time).toLocaleTimeString()}
              </Typography>
            </Stack>
            
            {meetingDetails.location_text && (
              <Stack direction="row" spacing={1} alignItems="center">
                <LocationOn fontSize="small" color="action" />
                <Typography variant="body2">{meetingDetails.location_text}</Typography>
              </Stack>
            )}
            
            {meetingDetails.facilitator && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Person fontSize="small" color="action" />
                <Typography variant="body2">Facilitator: {meetingDetails.facilitator}</Typography>
              </Stack>
            )}
            
            {meetingDetails.description && (
              <Box>
                <Typography variant="caption" color="text.secondary">Description</Typography>
                <Typography variant="body2">{meetingDetails.description}</Typography>
              </Box>
            )}
            
            {meetingDetails.agenda && (
              <Box>
                <Typography variant="caption" color="text.secondary">Agenda</Typography>
                <Typography variant="body2">{meetingDetails.agenda}</Typography>
              </Box>
            )}
            
            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate(`/meetings/${currentAction.meeting_id}`)}
              sx={{ mt: 1 }}
            >
              View Full Meeting Details
            </Button>
          </Stack>
        ) : (
          <Typography color="text.secondary">No meeting details available</Typography>
        )}
      </Box>
    </SwipeableDrawer>
  );

  if (loading || !currentAction) {
    return (
      <Container sx={{ py: 4, px: isMobile ? 2 : 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
        </Stack>
      </Container>
    );
  }

  const activePriority = PRIORITY[currentAction.priority] || PRIORITY[2];
  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, px: { xs: 2, sm: 3 }, pb: isMobile ? 8 : 4 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <IconButton onClick={() => navigate(-1)} size={isMobile ? "medium" : "large"}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1, textAlign: 'center' }}>
          Action Details
        </Typography>
        {!isCompleted && (
          <Stack direction="row" spacing={1}>
            <IconButton size="small" color="primary">
              <Edit />
            </IconButton>
            <IconButton size="small" color="error">
              <Delete />
            </IconButton>
          </Stack>
        )}
        {isCompleted && (
          <Box sx={{ width: 70 }} />
        )}
      </Stack>

      {/* Completed Banner */}
      {isCompleted && (
        <Alert 
          severity="success" 
          icon={<TaskAlt />}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          <Typography variant="body2" fontWeight={600}>
            This task has been completed
          </Typography>
          <Typography variant="caption">
            Completed on {formatDateTime(currentAction.completed_at)}
          </Typography>
        </Alert>
      )}

      {/* Action Header Card */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 3, opacity: isCompleted ? 0.85 : 1 }}>
        <Typography variant="h6" fontWeight={800} gutterBottom>
          {currentAction.description}
        </Typography>
        
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Chip 
            icon={activePriority.icon}
            label={activePriority.label} 
            color={activePriority.color} 
            size="small" 
          />
          <Chip 
            icon={statusIcon}
            label={currentAction.completed_at ? 'Completed' : currentAction.is_overdue ? 'Overdue' : currentAction.overall_progress_percentage > 0 ? 'In Progress' : 'Pending'}
            color={statusColor}
            size="small"
          />
          {currentAction.meeting_title && (
            <Chip 
              icon={<OpenInNew />} 
              label={currentAction.meeting_title} 
              variant="outlined" 
              size="small" 
              clickable
              onClick={() => setDialogs({ ...dialogs, meetingDetails: true })}
            />
          )}
        </Stack>
      </Paper>

      {/* Progress Section */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 3, opacity: isCompleted ? 0.85 : 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle2" fontWeight={700}>Progress</Typography>
          <Typography variant="h6" fontWeight={800} color={isCompleted ? 'success.main' : 'primary'}>
            {progress}%
          </Typography>
        </Stack>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            height: 10, 
            borderRadius: 5, 
            mb: 2,
            '& .MuiLinearProgress-bar': {
              bgcolor: isCompleted ? '#4caf50' : '#1976d2'
            }
          }} 
        />
        {!isCompleted && (
          <Stack direction="row" spacing={2}>
            <Button 
              fullWidth={isMobile} 
              size="small" 
              variant="outlined" 
              onClick={() => setDialogs({ ...dialogs, progress: true })}
            >
              Update Progress
            </Button>
            <Button 
              fullWidth={isMobile} 
              size="small" 
              variant="contained" 
              color="success"
              startIcon={<TaskAlt />}
              onClick={() => setDialogs({ ...dialogs, completeConfirm: true })}
              disabled={progress === 100}
            >
              Mark as Completed
            </Button>
          </Stack>
        )}
      </Paper>

      {/* Details Section */}
      <Paper sx={{ mb: 2, borderRadius: 3, overflow: 'hidden', opacity: isCompleted ? 0.85 : 1 }}>
        <Box 
          onClick={() => toggleSection('details')}
          sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', bgcolor: 'action.hover' }}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            <Info sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
            Details
          </Typography>
          <IconButton size="small" disabled={isCompleted}>
            {expandedSections.details ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        <Collapse in={expandedSections.details}>
          <Box sx={{ p: 2 }}>
            <Stack spacing={2}>
              <StatItem icon={<Schedule />} label="Due Date" value={currentAction.due_date ? new Date(currentAction.due_date).toLocaleDateString() : 'None'} />
              <StatItem icon={<Person />} label="Assigned To" value={currentAction.assigned_to_name} />
              <StatItem icon={<Description />} label="Remarks" value={currentAction.remarks || 'No remarks'} />
              <Divider />
              <StatItem icon={<Event />} label="Created" value={new Date(currentAction.created_at).toLocaleDateString()} />
              <StatItem icon={<Person />} label="Created By" value={currentAction.created_by_name || 'System'} />
            </Stack>
          </Box>
        </Collapse>
      </Paper>

      {/* Comments Section */}
      <Paper sx={{ mb: 2, borderRadius: 3, overflow: 'hidden' }}>
        <Box 
          onClick={() => toggleSection('comments')}
          sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', bgcolor: 'action.hover' }}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            <Comment sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
            Comments ({comments.length})
          </Typography>
          <IconButton size="small">
            {expandedSections.comments ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        <Collapse in={expandedSections.comments}>
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} mb={2}>
              <TextField 
                fullWidth 
                size="small" 
                placeholder="Add a comment..." 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={isCompleted}
              />
              <IconButton color="primary" onClick={handleAddComment} disabled={!newComment.trim() || isCompleted}>
                <Send />
              </IconButton>
            </Stack>
            
            {comments.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No comments yet
              </Typography>
            ) : (
              <List disablePadding>
                {comments.map((c) => (
                  <ListItem key={c.id} disableGutters sx={{ alignItems: 'flex-start', mb: 2, px: 0 }}>
                    <Avatar sx={{ width: 32, height: 32, mr: 2, fontSize: '0.8rem' }}>
                      {c.created_by_name?.substring(0, 2).toUpperCase() || 'U'}
                    </Avatar>
                    <ListItemText 
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="subtitle2" fontWeight={700}>{c.created_by_name || 'System'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(c.created_at).toLocaleString()}
                          </Typography>
                        </Stack>
                      }
                      secondary={c.comment} 
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* History Section */}
      <Paper sx={{ mb: 2, borderRadius: 3, overflow: 'hidden' }}>
        <Box 
          onClick={() => toggleSection('history')}
          sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', bgcolor: 'action.hover' }}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            <History sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
            Activity History
          </Typography>
          <IconButton size="small">
            {expandedSections.history ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        <Collapse in={expandedSections.history}>
          <Box sx={{ p: 2, maxHeight: 400, overflowY: 'auto' }}>
            {history.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No activity yet
              </Typography>
            ) : (
              history.map((h, index) => (
                <Box key={h.id || index} mb={2}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                    <Update fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(h.created_at).toLocaleString()}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ pl: 3 }}>
                    {h.remarks || `Progress updated to ${h.progress_percentage}%`}
                  </Typography>
                  {index < history.length - 1 && <Divider sx={{ mt: 1 }} />}
                </Box>
              ))
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Mobile Bottom Navigation */}
      {isMobile && !isCompleted && (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: 0, zIndex: 1000 }}>
          <BottomNavigation
            value={bottomNav}
            onChange={(event, newValue) => {
              setBottomNav(newValue);
              if (newValue === 0) toggleSection('details');
              if (newValue === 1) toggleSection('comments');
              if (newValue === 2) toggleSection('history');
              if (newValue === 3) setDialogs({ ...dialogs, progress: true });
              if (newValue === 4) setDialogs({ ...dialogs, meetingDetails: true });
            }}
            showLabels
          >
            <BottomNavigationAction label="Details" icon={<Info />} />
            <BottomNavigationAction label="Comments" icon={<Comment />} />
            <BottomNavigationAction label="History" icon={<History />} />
            <BottomNavigationAction label="Progress" icon={<Update />} />
            <BottomNavigationAction label="Meeting" icon={<Event />} />
          </BottomNavigation>
        </Paper>
      )}

      {/* Update Progress Dialog */}
      <Dialog open={dialogs.progress} onClose={() => setDialogs({ ...dialogs, progress: false })} fullWidth maxWidth="xs" fullScreen={isMobile}>
        <DialogTitle fontWeight={800}>
          Update Progress
          {isMobile && (
            <IconButton sx={{ position: 'absolute', right: 8, top: 8 }} onClick={() => setDialogs({ ...dialogs, progress: false })}>
              <ArrowBack />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Box py={2}>
            {localError && <Alert severity="error" sx={{ mb: 2 }}>{localError}</Alert>}
            
            <Typography variant="body2" gutterBottom>Completion: {progress}%</Typography>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="5" 
              value={progress} 
              onChange={(e) => setProgress(parseInt(e.target.value))} 
              style={{ width: '100%', marginBottom: '20px' }} 
            />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {[0, 25, 50, 75, 100].map(val => (
                <Button key={val} size="small" variant="outlined" onClick={() => setProgress(val)}>
                  {val}%
                </Button>
              ))}
            </Box>
            
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select 
                value={selectedStatusId} 
                label="Status" 
                onChange={(e) => setSelectedStatusId(e.target.value)}
              >
                {statusOptions.length === 0 ? (
                  <MenuItem disabled>Loading statuses...</MenuItem>
                ) : (
                  statusOptions.map(opt => (
                    <MenuItem key={opt.id} value={opt.id}>
                      {opt.name || opt.short_name || opt.code}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              size="small"
              label="Remarks (Optional)"
              value={progressRemarks}
              onChange={(e) => setProgressRemarks(e.target.value)}
              placeholder="Add notes about this update..."
              multiline
              rows={isMobile ? 3 : 2}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDialogs({ ...dialogs, progress: false })} fullWidth={isMobile}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateProgress} 
            disabled={updatingProgress || !selectedStatusId}
            fullWidth={isMobile}
          >
            {updatingProgress ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark as Completed Confirmation Dialog */}
      <Dialog open={dialogs.completeConfirm} onClose={() => setDialogs({ ...dialogs, completeConfirm: false })} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>Mark as Completed</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to mark this action as completed? This will set progress to 100% and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDialogs({ ...dialogs, completeConfirm: false })}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={handleMarkAsCompleted}
            disabled={completing}
            startIcon={<TaskAlt />}
          >
            {completing ? 'Processing...' : 'Yes, Mark as Completed'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Meeting Details Drawer */}
      <MeetingDetailsDrawer />
    </Container>
  );
};

// Helper function for date formatting
const formatDateTime = (dateString) => {
  if (!dateString) return 'Not set';
  return new Date(dateString).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default ActionDetails;