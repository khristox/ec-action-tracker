// src/components/actiontracker/meetings/MeetingMinutes.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Button,
  IconButton,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Tooltip,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Skeleton,
  LinearProgress,
  alpha,
  Snackbar
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
import api from '../../../services/api';
import { 
  fetchMeetingMinutes, 
  createMeetingMinutes, 
  deleteMeetingMinutes,
  clearMinutesError,
  selectMeetingMinutes,
  selectMinutesLoading,
  selectMinutesError
} from '../../../store/slices/actionTracker/meetingSlice';
import AddActionDialog from './components/AddActionDialog';
import EditActionDialog from './components/EditActionDialog';
import EditMinuteDialog from './components/EditMinuteDialog';
import RichTextEditor from './components/RichTextEditor';

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

// ==================== Improved Rich Text Display ====================
const RichTextContent = ({ content }) => {
  if (!content || content.trim() === '' || content === '<p></p>') {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        No content provided.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        textAlign: 'left',
        lineHeight: 1.7,
        color: 'text.primary',
        '& p': {
          margin: '0 0 12px 0',
          '&:last-child': { marginBottom: 0 }
        },
        '& ul, & ol': {
          paddingLeft: '24px',
          margin: '8px 0 16px 0'
        },
        '& li': {
          marginBottom: '6px'
        },
        '& h1, & h2, & h3': {
          margin: '16px 0 8px 0',
          fontWeight: 600
        },
        '& blockquote': {
          margin: '16px 0',
          paddingLeft: '16px',
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          color: 'text.secondary',
          fontStyle: 'italic'
        },
        '& pre': {
          backgroundColor: '#f8fafc',
          padding: '12px',
          borderRadius: 1,
          overflowX: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          border: '1px solid #e2e8f0'
        },
        '& code': {
          backgroundColor: '#f1f5f9',
          padding: '2px 6px',
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.9rem'
        },
        '& img': {
          maxWidth: '100%',
          height: 'auto',
          borderRadius: 1,
          margin: '12px 0'
        },
        '& hr': {
          margin: '20px 0',
          border: 'none',
          borderTop: '1px solid #e2e8f0'
        }
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

// ==================== Action Row Component ====================
const ActionRow = ({ action, onEdit }) => {
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const statusConfig = getStatusConfig(action);
  
  let assignedToName = 'Unassigned';
  if (action.assigned_to?.full_name) assignedToName = action.assigned_to.full_name;
  else if (action.assigned_to?.username) assignedToName = action.assigned_to.username;
  else if (typeof action.assigned_to_name === 'string') assignedToName = action.assigned_to_name;
  else if (action.assigned_to_name?.name) assignedToName = action.assigned_to_name.name;

  const progress = action.overall_progress_percentage || 0;

  return (
    <TableRow hover>
      <TableCell sx={{ pl: 2 }}>
        <Typography variant="body2" fontWeight={500}>{action.description}</Typography>
        {action.remarks && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" fontWeight={500}>{progress}%</Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 6, 
              borderRadius: 3,
              bgcolor: '#e2e8f0',
              '& .MuiLinearProgress-bar': {
                bgcolor: statusConfig.label === 'Completed' ? '#10b981' : (isOverdue ? '#ef4444' : '#3b82f6')
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
const MinutesCard = ({ minute, expanded, onToggle, onAddAction, onEditAction, onEditMinute, onDelete, onMenuOpen }) => {
  const minuteId = minute.id;
  const title = minute.topic || minute.title || 'Untitled Minutes';
  const discussion = minute.discussion || minute.content || '';
  const decisions = minute.decisions || '';
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
        boxShadow: expanded ? 3 : 1
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ '&:hover': { bgcolor: alpha('#000', 0.02) } }}
      >
        <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
            <DescriptionIcon />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">{formatDate(timestamp)}</Typography>
              {recordedByName && (
                <Typography variant="caption" color="text.secondary">Recorded by: {recordedByName}</Typography>
              )}
              <Chip 
                label={`${actionCount} action${actionCount !== 1 ? 's' : ''}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Stack>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Edit Minutes">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditMinute(minute); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMenuOpen(e, minute); }}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </AccordionSummary>
      
      <AccordionDetails sx={{ pt: 0 }}>
        <Divider sx={{ mb: 3 }} />
        <Stack spacing={4}>
          {/* Discussion */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <NotesIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={600}>Discussion</Typography>
            </Stack>
            <Paper variant="outlined" sx={{ p: 3, bgcolor: '#f8fafc', borderRadius: 2 }}>
              <RichTextContent content={discussion} />
            </Paper>
          </Box>

          {/* Decisions */}
          {decisions && decisions !== '<p></p>' && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <AssignmentIcon fontSize="small" color="success" />
                <Typography variant="subtitle2" fontWeight={600} color="success.main">Decisions</Typography>
              </Stack>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: '#f0fdf4', borderRadius: 2 }}>
                <RichTextContent content={decisions} />
              </Paper>
            </Box>
          )}

          {/* Actions Section */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AssignmentIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>Action Items</Typography>
                {actionCount > 0 && (
                  <Chip label={`${completedActions}/${actionCount} completed`} size="small" color="success" variant="outlined" />
                )}
              </Stack>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => onAddAction(minuteId)}>
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
                      <ActionRow key={action.id} action={action} onEdit={onEditAction} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: '#fafafa' }}>
                <AssignmentIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
                <Typography variant="body2" color="text.secondary">No action items yet.</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => onAddAction(minuteId)} sx={{ mt: 2 }}>
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
  
  const minutesList = useSelector(selectMeetingMinutes);
  const isLoading = useSelector(selectMinutesLoading);
  const error = useSelector(selectMinutesError);
  
  const [expandedMinute, setExpandedMinute] = useState(null);
  const [showAddMinutesDialog, setShowAddMinutesDialog] = useState(false);
  const [showAddActionDialog, setShowAddActionDialog] = useState(false);
  const [showEditActionDialog, setShowEditActionDialog] = useState(false);
  const [showEditMinuteDialog, setShowEditMinuteDialog] = useState(false);
  const [selectedMinuteId, setSelectedMinuteId] = useState(null);
  const [selectedMinute, setSelectedMinute] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [newMinutes, setNewMinutes] = useState({ topic: '', discussion: '', decisions: '' });
  const [submitting, setSubmitting] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [deleting, setDeleting] = useState(false);

  const fetchMinutes = useCallback(() => {
    if (meetingId) dispatch(fetchMeetingMinutes(meetingId));
  }, [dispatch, meetingId]);

  useEffect(() => {
    if (meetingId) fetchMinutes();
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
      await dispatch(createMeetingMinutes({ meetingId, data: newMinutes })).unwrap();
      setShowAddMinutesDialog(false);
      setNewMinutes({ topic: '', discussion: '', decisions: '' });
      setSnackbar({ open: true, message: 'Minutes added successfully!', severity: 'success' });
      fetchMinutes(); // Refresh the list
      if (onRefresh) onRefresh();
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Failed to add minutes', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAction = (minuteId) => {
    setSelectedMinuteId(minuteId);
    setShowAddActionDialog(true);
  };

  const handleEditAction = (actionId) => {
    let action = null;
    for (const minute of minutesList) {
      action = minute.actions?.find(a => a.id === actionId);
      if (action) break;
    }
    setSelectedAction(action);
    setShowEditActionDialog(true);
  };

  const handleEditMinute = (minute) => {
    setSelectedMinute(minute);
    setShowEditMinuteDialog(true);
  };

  const handleActionCreated = () => {
    fetchMinutes();
    setSnackbar({ open: true, message: 'Action created successfully!', severity: 'success' });
  };

  const handleActionUpdated = () => {
    fetchMinutes();
    setSnackbar({ open: true, message: 'Action updated successfully!', severity: 'success' });
  };

  const handleMinuteUpdated = () => {
    fetchMinutes();
    setSnackbar({ open: true, message: 'Minutes updated successfully!', severity: 'success' });
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
    if (!selectedMinute?.id) return;
    if (!window.confirm(`Delete "${selectedMinute.topic || 'this minute'}" and all its actions?`)) {
      handleMenuClose();
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/action-tracker/minutes/${selectedMinute.id}`);
      handleMenuClose();
      setSnackbar({ open: true, message: 'Minutes deleted successfully!', severity: 'success' });
      fetchMinutes(); // Refresh the list
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to delete minutes', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleMinute = (minuteId) => {
    setExpandedMinute(expandedMinute === minuteId ? null : minuteId);
  };

  // Don't show loading skeleton when there are no minutes but still loading
  if (isLoading && minutesList.length === 0) return <LoadingSkeleton />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={700}>
          Meeting Minutes ({minutesList.length})
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={isLoading}>
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

      {error && (
        <Alert severity="error" onClose={() => dispatch(clearMinutesError())} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!isLoading && minutesList.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <AutoAwesomeIcon sx={{ fontSize: 80, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Minutes Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Start by adding the first meeting minutes
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => setShowAddMinutesDialog(true)}
            size="large"
          >
            Add First Minutes
          </Button>
        </Paper>
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
              onEditMinute={handleEditMinute}
              onMenuOpen={handleMenuOpen}
            />
          ))}
        </Stack>
      )}

      {/* Add Minutes Dialog */}
      <Dialog 
        open={showAddMinutesDialog} 
        onClose={() => !submitting && setShowAddMinutesDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Add Meeting Minutes
          {submitting && <LinearProgress sx={{ mt: 1 }} />}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Topic *"
              value={newMinutes.topic}
              onChange={(e) => setNewMinutes({ ...newMinutes, topic: e.target.value })}
              required
              disabled={submitting}
              helperText="Required - A descriptive title for these minutes"
            />
            <Box>
              <Typography variant="subtitle2" gutterBottom>Discussion</Typography>
              <RichTextEditor
                value={newMinutes.discussion}
                onChange={(html) => setNewMinutes({ ...newMinutes, discussion: html })}
                placeholder="Record discussion points..."
                minHeight={220}
                disabled={submitting}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Decisions (Optional)</Typography>
              <RichTextEditor
                value={newMinutes.decisions}
                onChange={(html) => setNewMinutes({ ...newMinutes, decisions: html })}
                placeholder="Record decisions made during the meeting..."
                minHeight={160}
                disabled={submitting}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddMinutesDialog(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAddMinutes} 
            disabled={submitting || !newMinutes.topic.trim()}
          >
            {submitting ? 'Saving...' : 'Save Minutes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Action Dialog */}
     {/* Add Action Dialog */}
{showAddActionDialog && (
  <AddActionDialog 
    open={showAddActionDialog} 
    onClose={() => setShowAddActionDialog(false)}
    meetingId={meetingId}
    minutes={minutesList}  // Pass the minutes list
    selectedMinuteId={selectedMinuteId}  // Use correct prop name
    onSave={async (payload) => {
      try {
        // Use the minute-based endpoint
        const response = await api.post(
          `/action-tracker/minutes/${payload.minute_id}/actions`,
          {
            description: payload.description,
            due_date: payload.due_date,
            priority: payload.priority,
            remarks: payload.remarks,
            assigned_to_id: payload.assigned_to_id,
            assigned_to_name: payload.assigned_to_name
          }
        );
        handleActionCreated();
        return response.data;
      } catch (err) {
        console.error('Error creating action:', err);
        throw err;
      }
    }}
    loading={submitting}
    error={error}
  />
)}

      {/* Edit Action Dialog */}
      {showEditActionDialog && selectedAction && (
        <EditActionDialog 
          open={showEditActionDialog} 
          action={selectedAction}
          onClose={() => setShowEditActionDialog(false)} 
          onSave={handleActionUpdated}
          meetingId={meetingId}
        />
      )}

      {/* Edit Minute Dialog */}
      {showEditMinuteDialog && selectedMinute && (
        <EditMinuteDialog 
          open={showEditMinuteDialog} 
          minute={selectedMinute}
          onClose={() => setShowEditMinuteDialog(false)} 
          onSave={handleMinuteUpdated}
        />
      )}

      {/* Menu for minutes actions */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem 
          onClick={() => { 
            handleMenuClose(); 
            if (selectedMinute) handleAddAction(selectedMinute.id); 
          }}
        >
          <AssignmentIcon fontSize="small" sx={{ mr: 1 }} />
          Add Action Item
        </MenuItem>
        <MenuItem onClick={handleDeleteMinutes} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete Minutes
        </MenuItem>
      </Menu>

      {/* Snackbar for notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingMinutes;