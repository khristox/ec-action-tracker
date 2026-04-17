// src/components/actiontracker/meetings/MeetingMinutes.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Paper, Typography, Box, Stack, Button, IconButton,
  Divider, Chip, Alert, CircularProgress, TextField, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  Avatar, Tooltip, Menu, MenuItem, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow,
  Accordion, AccordionSummary, AccordionDetails, Skeleton,
  LinearProgress, alpha, Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  AccessTime as AccessTimeIcon,
  Notes as NotesIcon,
  AutoAwesome as AutoAwesomeIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { 
  fetchMeetingMinutes, 
  createMeetingMinutes, 
  deleteMeetingMinutes,
  clearMinutesError,
  selectMeetingMinutes,
  selectMinutesLoading,
  selectMinutesError
} from '../../../store/slices/actionTracker/meetingSlice';

// ==================== Helper Functions ====================

const formatDate = (dateString) => {
  if (!dateString) return 'Date not set';
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return `Today at ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, yyyy • h:mm a');
};

const getStatusConfig = (action) => {
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const isCompleted = action.completed_at || action.overall_progress_percentage >= 100;
  
  if (isCompleted) return { label: 'Completed', color: 'success', icon: <CheckCircleIcon fontSize="small" /> };
  if (isOverdue) return { label: 'Overdue', color: 'error', icon: <WarningIcon fontSize="small" /> };
  if (action.overall_status_name === 'in_progress') return { label: 'In Progress', color: 'info', icon: <PendingIcon fontSize="small" /> };
  return { label: 'Pending', color: 'warning', icon: <ScheduleIcon fontSize="small" /> };
};

// ==================== Action Row Component ====================
// ==================== Action Row Component ====================
const ActionRow = ({ action, onEdit }) => {
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const statusConfig = getStatusConfig(action);
  
  // Handle assigned_to_name - it could be a string or an object
  let assignedToName = 'Unassigned';
  if (action.assigned_to?.full_name) {
    assignedToName = action.assigned_to.full_name;
  } else if (action.assigned_to?.username) {
    assignedToName = action.assigned_to.username;
  } else if (typeof action.assigned_to_name === 'string') {
    assignedToName = action.assigned_to_name;
  } else if (action.assigned_to_name && typeof action.assigned_to_name === 'object') {
    // Handle object with name property
    assignedToName = action.assigned_to_name.name || action.assigned_to_name.email || 'Unassigned';
  } else if (action.assigned_by_name && typeof action.assigned_by_name === 'string') {
    assignedToName = action.assigned_by_name;
  }
  
  const progress = action.overall_progress_percentage || 0;

  return (
    <TableRow hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
      <TableCell sx={{ pl: 2 }}>
        <Typography variant="body2" fontWeight={500}>
          {action.description}
        </Typography>
        {action.remarks && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {action.remarks}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.light', fontSize: '0.75rem' }}>
            {assignedToName?.[0]?.toUpperCase() || '?'}
          </Avatar>
          <Typography variant="body2">{assignedToName}</Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AccessTimeIcon fontSize="small" color={isOverdue ? 'error' : 'action'} />
          <Typography variant="body2" color={isOverdue ? 'error' : 'inherit'}>
            {action.due_date ? format(new Date(action.due_date), 'MMM d, yyyy') : 'No due date'}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Chip
          size="small"
          label={statusConfig.label}
          color={statusConfig.color}
          icon={statusConfig.icon}
          sx={{ height: 26, fontWeight: 500 }}
        />
      </TableCell>
      <TableCell sx={{ minWidth: 120 }}>
        <Stack spacing={0.5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" fontWeight={500}>
              {progress}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 6, 
              borderRadius: 3,
              bgcolor: '#e2e8f0',
              '& .MuiLinearProgress-bar': {
                bgcolor: statusConfig.label === 'Completed' ? '#10b981' : (isOverdue ? '#ef4444' : '#3b82f6'),
                borderRadius: 3
              }
            }} 
          />
        </Stack>
      </TableCell>
      <TableCell align="center">
        <Tooltip title="Edit Action">
          <IconButton size="small" onClick={() => onEdit(action.id)} color="primary">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};
// ==================== Minutes Card Component ====================
const MinutesCard = ({ minute, expanded, onToggle, onAddAction, onEditAction, onDelete, onMenuOpen }) => {
  const minuteId = minute.id;
  const title = minute.topic || minute.title || 'Untitled Minutes';
  const content = minute.discussion || minute.content || '';
  const timestamp = minute.timestamp || minute.created_at;
  const actionCount = minute.actions?.length || 0;
  const completedActions = minute.actions?.filter(a => a.completed_at || a.overall_progress_percentage >= 100).length || 0;
  const recordedByName = minute.recorded_by_name || minute.created_by_name;

  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      sx={{
        borderRadius: 2,
        '&:before': { display: 'none' },
        boxShadow: expanded ? 3 : 1,
        transition: 'box-shadow 0.2s ease'
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          '&:hover': { bgcolor: alpha('#000', 0.02) },
          borderRadius: expanded ? '8px 8px 0 0' : '8px'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1, pr: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
            <DescriptionIcon />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {title}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                {formatDate(timestamp)}
              </Typography>
              {recordedByName && (
                <Typography variant="caption" color="text.secondary">
                  Recorded by: {recordedByName}
                </Typography>
              )}
              <Chip 
                label={`${actionCount} action${actionCount !== 1 ? 's' : ''}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            </Stack>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onMenuOpen(e, minute);
            }}
            sx={{ '&:hover': { bgcolor: 'action.hover' } }}
          >
            <MoreVertIcon />
          </IconButton>
        </Stack>
      </AccordionSummary>
      
      <AccordionDetails sx={{ pt: 0 }}>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={3}>
          {/* Minutes Content */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <NotesIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={600}>
                Notes
              </Typography>
            </Stack>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {content || 'No content provided.'}
              </Typography>
            </Paper>
          </Box>

          {/* Actions Section */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AssignmentIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>
                  Action Items
                </Typography>
                {actionCount > 0 && (
                  <Chip 
                    label={`${completedActions}/${actionCount} completed`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
              </Stack>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => onAddAction(minuteId)}
              >
                Add Action
              </Button>
            </Stack>

            {actionCount > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                      <TableCell sx={{ fontWeight: 700, pl: 2 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Assigned To</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {minute.actions.map((action) => (
                      <ActionRow 
                        key={action.id} 
                        action={action} 
                        onEdit={onEditAction} 
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 2, bgcolor: '#fafafa' }}>
                <AssignmentIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  No action items have been created for these minutes.
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => onAddAction(minuteId)}
                  sx={{ mt: 1 }}
                >
                  Create First Action
                </Button>
              </Paper>
            )}
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

// ==================== Loading Skeleton ====================
const LoadingSkeleton = () => (
  <Stack spacing={2}>
    {[1, 2, 3].map((i) => (
      <Paper key={i} sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="30%" height={20} />
          </Box>
        </Stack>
      </Paper>
    ))}
  </Stack>
);

// ==================== Main Component ====================
const MeetingMinutes = ({ meetingId, onRefresh }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const minutesList = useSelector(selectMeetingMinutes);
  const isLoading = useSelector(selectMinutesLoading);
  const error = useSelector(selectMinutesError);
  
  const [expandedMinute, setExpandedMinute] = useState(null);
  const [showAddMinutesDialog, setShowAddMinutesDialog] = useState(false);
  const [newMinutes, setNewMinutes] = useState({
    topic: '',
    discussion: '',
    decisions: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMinute, setSelectedMinute] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Fetch minutes using Redux
  const fetchMinutes = useCallback(() => {
    if (meetingId) {
      console.log('Dispatching fetchMeetingMinutes for meeting:', meetingId);
      dispatch(fetchMeetingMinutes(meetingId));
    }
  }, [dispatch, meetingId]);

  useEffect(() => {
    if (meetingId) {
      fetchMinutes();
    }
  }, [meetingId, fetchMinutes]);

  const handleRefresh = () => {
    fetchMinutes();
    if (onRefresh) onRefresh();
  };

  const handleAddMinutes = async () => {
    if (!newMinutes.topic.trim()) {
      setSnackbar({ open: true, message: 'Please enter a topic', severity: 'warning' });
      return;
    }
    
    setSubmitting(true);
    
    try {
      const payload = {
        topic: newMinutes.topic.trim(),
        discussion: newMinutes.discussion.trim(),
        decisions: newMinutes.decisions.trim()
      };
      
      console.log('Creating minutes with payload:', payload);
      await dispatch(createMeetingMinutes({
        meetingId,
        data: payload
      })).unwrap();
      
      setShowAddMinutesDialog(false);
      setNewMinutes({
        topic: '',
        discussion: '',
        decisions: ''
      });
      setSnackbar({ open: true, message: 'Minutes added successfully!', severity: 'success' });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error adding minutes:', err);
      setSnackbar({ open: true, message: err || 'Failed to add minutes', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAction = (minuteId) => {
    navigate(`/actions/assign/minute/${minuteId}`);
  };

  const handleEditAction = (actionId) => {
    navigate(`/actions/edit/${actionId}`);
  };

  const handleMenuOpen = (event, minute) => {
    setAnchorEl(event.currentTarget);
    setSelectedMinute(minute);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMinute(null);
  };

  const handleDeleteMinutes = async () => {
    if (!selectedMinute) return;
    
    const title = selectedMinute.topic || selectedMinute.title || 'this minutes';
    
    if (window.confirm(`Are you sure you want to delete "${title}"? This will also delete all associated actions.`)) {
      try {
        await dispatch(deleteMeetingMinutes(selectedMinute.id)).unwrap();
        handleMenuClose();
        setSnackbar({ open: true, message: 'Minutes deleted successfully!', severity: 'success' });
        if (onRefresh) onRefresh();
      } catch (err) {
        console.error('Error deleting minutes:', err);
        setSnackbar({ open: true, message: err || 'Failed to delete minutes', severity: 'error' });
      }
    }
  };

  const handleToggleMinute = (minuteId) => {
    setExpandedMinute(expandedMinute === minuteId ? null : minuteId);
  };

  // Show loading state
  if (isLoading && minutesList.length === 0) {
    return <LoadingSkeleton />;
  }

  // Empty State
  if (!isLoading && minutesList.length === 0) {
    return (
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Meeting Minutes
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowAddMinutesDialog(true)}
          >
            Add Minutes
          </Button>
        </Stack>
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <AutoAwesomeIcon sx={{ fontSize: 80, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Minutes Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            Capture important discussions, decisions, and action items from your meeting.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowAddMinutesDialog(true)}
          >
            Add First Minutes
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }} flexWrap="wrap" gap={2}>
        <Typography variant="h6" fontWeight={700}>
          Meeting Minutes
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({minutesList.length})
          </Typography>
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={isLoading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowAddMinutesDialog(true)}
          >
            Add Minutes
          </Button>
        </Stack>
      </Stack>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => dispatch(clearMinutesError())}
        >
          {typeof error === 'string' ? error : 'Failed to load minutes'}
        </Alert>
      )}

      {/* Minutes List */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Stack spacing={2}>
          {minutesList.map((minute) => (
            <MinutesCard
              key={minute.id}
              minute={minute}
              expanded={expandedMinute === minute.id}
              onToggle={() => handleToggleMinute(minute.id)}
              onAddAction={handleAddAction}
              onEditAction={handleEditAction}
              onDelete={handleDeleteMinutes}
              onMenuOpen={handleMenuOpen}
            />
          ))}
        </Stack>
      )}

      {/* Add Minutes Dialog */}
      <Dialog 
        open={showAddMinutesDialog} 
        onClose={() => setShowAddMinutesDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              Add Meeting Minutes
            </Typography>
            <IconButton onClick={() => setShowAddMinutesDialog(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label="Topic"
              value={newMinutes.topic}
              onChange={(e) => setNewMinutes({ ...newMinutes, topic: e.target.value })}
              required
              placeholder="e.g., Opening Remarks, Project Update, Q&A Session"
              autoFocus
              error={!newMinutes.topic.trim() && submitting}
              helperText={!newMinutes.topic.trim() && submitting ? "Topic is required" : ""}
            />
            <TextField
              fullWidth
              label="Discussion"
              multiline
              rows={4}
              value={newMinutes.discussion}
              onChange={(e) => setNewMinutes({ ...newMinutes, discussion: e.target.value })}
              placeholder="Record the key discussion points from the meeting..."
            />
            <TextField
              fullWidth
              label="Decisions"
              multiline
              rows={4}
              value={newMinutes.decisions}
              onChange={(e) => setNewMinutes({ ...newMinutes, decisions: e.target.value })}
              placeholder="Record the decisions made during the meeting..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button onClick={() => setShowAddMinutesDialog(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddMinutes}
            disabled={submitting || !newMinutes.topic.trim()}
            startIcon={submitting ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {submitting ? 'Saving...' : 'Save Minutes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Minutes Options Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 180 } }}
      >
        <MenuItem onClick={() => {
          handleMenuClose();
          if (selectedMinute) {
            handleAddAction(selectedMinute.id);
          }
        }}>
          <AssignmentIcon fontSize="small" sx={{ mr: 2, color: 'primary.main' }} />
          Add Action Item
        </MenuItem>
        <MenuItem onClick={handleDeleteMinutes} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 2, color: 'error.main' }} />
          Delete Minutes
        </MenuItem>
      </Menu>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingMinutes;