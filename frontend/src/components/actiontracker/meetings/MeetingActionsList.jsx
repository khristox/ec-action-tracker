// src/components/actiontracker/meetings/MeetingActionsList.jsx
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
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Tooltip,
  LinearProgress,
  Fade,
  Grow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Slider,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Edit as EditIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon,
  PersonAdd as PersonAddIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { updateActionProgress } from '../../../store/slices/actionTracker/actionSlice';
import api from '../../../services/api';

import EditActionDialog from './components/EditActionDialog';
import AssignUserDialog from './components/AssignUserDialog';
import AddActionDialog from './components/AddActionDialog';

// Progress presets for the slider
const PROGRESS_PRESETS = [
  { value: 0, label: 'Not Started', color: '#6B7280', icon: <ScheduleIcon fontSize="small" /> },
  { value: 25, label: '25%', color: '#3B82F6', icon: <PendingIcon fontSize="small" /> },
  { value: 50, label: '50%', color: '#F59E0B', icon: <TrendingUpIcon fontSize="small" /> },
  { value: 75, label: '75%', color: '#8B5CF6', icon: <TrendingUpIcon fontSize="small" /> },
  { value: 100, label: 'Complete', color: '#10B981', icon: <CheckCircleIcon fontSize="small" /> }
];

const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  return format(new Date(dateString), 'MMM d, yyyy');
};

const getStatusConfig = (action) => {
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const isCompleted = action.completed_at || action.overall_progress_percentage >= 100;
  
  if (isCompleted) return { label: 'Completed', color: 'success', icon: <CheckCircleIcon fontSize="small" />, bgColor: '#D1FAE5', textColor: '#065F46' };
  if (isOverdue) return { label: 'Overdue', color: 'error', icon: <WarningIcon fontSize="small" />, bgColor: '#FEE2E2', textColor: '#991B1B' };
  if (action.overall_status_name === 'in_progress') return { label: 'In Progress', color: 'info', icon: <PendingIcon fontSize="small" />, bgColor: '#DBEAFE', textColor: '#1E40AF' };
  return { label: 'Pending', color: 'warning', icon: <ScheduleIcon fontSize="small" />, bgColor: '#FEF3C7', textColor: '#92400E' };
};

const MeetingActionsList = ({ meetingId, onRefresh }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { updatingProgress } = useSelector((state) => state.actions || {});
  
  const [actions, setActions] = useState([]);
  const [minutes, setMinutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAddActionDialog, setShowAddActionDialog] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressRemarks, setProgressRemarks] = useState('');
  const [localUpdating, setLocalUpdating] = useState(false);
  const [statusOptions, setStatusOptions] = useState([]);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [selectedStatusName, setSelectedStatusName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch minutes for the meeting
  const fetchMinutes = useCallback(async () => {
    if (!meetingId) return;
    
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/minutes`);
      const minutesData = response.data?.items || response.data || [];
      setMinutes(minutesData);
    } catch (err) {
      console.error('Error fetching minutes:', err);
    }
  }, [meetingId]);

  // Fetch status options
  const fetchStatusOptions = useCallback(async () => {
    try {
      const response = await api.get('/attribute-groups/ACTION_TRACKER/attributes');
      const attributes = response.data?.items || response.data || [];
      const actionStatuses = attributes.filter(attr => 
        attr.code?.startsWith('ACTION_STATUS_') && attr.code !== 'ACTION_STATUS'
      );
      setStatusOptions(actionStatuses);
    } catch (err) {
      console.error('Failed to fetch status options:', err);
    }
  }, []);

  const fetchActions = useCallback(async () => {
    if (!meetingId) {
      console.error('No meetingId provided to MeetingActionsList');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching actions for meeting:', meetingId);
      
      let actionsData = [];
      
      const minutesResponse = await api.get(`/action-tracker/meetings/${meetingId}/minutes`);
      const minutesList = minutesResponse.data?.items || minutesResponse.data || [];
      
      minutesList.forEach(minute => {
        if (minute.actions && minute.actions.length > 0) {
          actionsData.push(...minute.actions);
        }
      });
      console.log('Actions extracted from minutes:', actionsData.length);
      
      setActions(actionsData);
    } catch (err) {
      console.error('Error fetching actions:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load actions');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (meetingId) {
      fetchActions();
      fetchMinutes();
      fetchStatusOptions();
    }
  }, [fetchActions, fetchMinutes, fetchStatusOptions, meetingId]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleRefresh = () => {
    fetchActions();
    fetchMinutes();
    if (onRefresh) onRefresh();
  };

  const handleViewAction = (actionId) => {
    navigate(`/actions/${actionId}`);
  };

  const handleEditAction = (action) => {
    setSelectedAction(action);
    setShowEditDialog(true);
  };

  const handleAssignAction = (action) => {
    const meetingIdFromAction = action.minutes?.meeting_id || action.meeting_id;
    console.log('Meeting ID from action:', meetingIdFromAction);
    setSelectedAction({
      ...action,
      _meetingId: meetingIdFromAction  // Store it in the action
    });
   
    setShowAssignDialog(true);
  };

  const handleEditSave = () => {
    fetchActions();
    setSuccessMessage('Action updated successfully!');
  };

  const handleAssignSave = () => {
    fetchActions();
    setSuccessMessage('Action assigned successfully!');
  };

  const handleActionCreated = () => {
    fetchActions();
    if (onRefresh) onRefresh();
    setSuccessMessage('Action created successfully!');
  };

  const handleProgressUpdate = async () => {
    if (!selectedAction) return;
    
    const selectedOption = statusOptions.find(opt => 
      opt.id === selectedStatusId || 
      opt.short_name === selectedStatusName ||
      opt.code === selectedStatusName
    );
    
    const statusIdToUse = selectedOption?.id || selectedStatusId;
    
    if (!statusIdToUse) {
      setError('Please select a status');
      return;
    }
    
    setLocalUpdating(true);
    setError(null);
    
    try {
      const payload = {
        progress_percentage: parseInt(progressValue),
        individual_status_id: statusIdToUse,
        remarks: progressRemarks.trim() || `Progress updated to ${progressValue}%`
      };
      
      console.log('Updating progress with payload:', payload);
      
      await dispatch(updateActionProgress({ 
        id: selectedAction.id, 
        progressData: payload 
      })).unwrap();
      
      setShowProgressDialog(false);
      setProgressRemarks('');
      setProgressValue(0);
      setSelectedStatusId('');
      setSuccessMessage('Progress updated successfully!');
      
      await fetchActions();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error updating progress:', err);
      setError(err.message || 'Failed to update progress');
    } finally {
      setLocalUpdating(false);
    }
  };

  const handleOpenProgressDialog = (action) => {
    setSelectedAction(action);
    setProgressValue(action.overall_progress_percentage || 0);
    setProgressRemarks('');
    setSelectedStatusId(action.overall_status_id || '');
    setSelectedStatusName(action.overall_status_name || '');
    setShowProgressDialog(true);
  };

  const getProgressColor = (value) => {
    if (value >= 100) return '#10B981';
    if (value >= 75) return '#8B5CF6';
    if (value >= 50) return '#F59E0B';
    if (value >= 25) return '#3B82F6';
    return '#6B7280';
  };

  const isUpdating = localUpdating || updatingProgress;

  if (loading && actions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading actions...
        </Typography>
      </Box>
    );
  }

  if (actions.length === 0 && !loading) {
    return (
      <Grow in timeout={500}>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <AssignmentIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No action items found for this meeting.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Actions can be added from the Minutes tab by expanding a minute and clicking "Add Action".
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            sx={{ mt: 1 }}
          >
            Refresh
          </Button>
        </Box>
      </Grow>
    );
  }

  return (
    <Fade in timeout={500}>
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Action Items ({actions.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddActionDialog(true)}
              size="small"
            >
              Add Action
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} size="small" disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {successMessage && (
          <Alert 
            severity="success" 
            sx={{ mb: 3, borderRadius: 2 }}
            onClose={() => setSuccessMessage('')}
          >
            {successMessage}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Assigned To</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {actions.map((action) => {
                const statusConfig = getStatusConfig(action);
                const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
                let assignedToName = 'Unassigned';
                if (action.assigned_to?.full_name) {
                  assignedToName = action.assigned_to.full_name;
                } else if (action.assigned_to?.username) {
                  assignedToName = action.assigned_to.username;
                } else if (typeof action.assigned_to_name === 'string') {
                  assignedToName = action.assigned_to_name;
                } else if (action.assigned_to_name && typeof action.assigned_to_name === 'object') {
                  assignedToName = action.assigned_to_name.name || action.assigned_to_name.email || 'Unassigned';
                }
                const progress = action.overall_progress_percentage || 0;
                const progressColor = getProgressColor(progress);
                
                return (
                  <TableRow key={action.id} hover>
                    <TableCell>
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
                        <ScheduleIcon fontSize="small" color={isOverdue ? 'error' : 'action'} />
                        <Typography variant="body2" color={isOverdue ? 'error' : 'inherit'}>
                          {formatDate(action.due_date)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={statusConfig.label}
                        color={statusConfig.color}
                        icon={statusConfig.icon}
                        sx={{ 
                          height: 26, 
                          fontWeight: 500,
                          bgcolor: statusConfig.bgColor,
                          color: statusConfig.textColor,
                          '& .MuiChip-icon': { color: statusConfig.textColor }
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <Stack spacing={0.5}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" fontWeight={500} color={progressColor}>
                            {progress}%
                          </Typography>
                          {progress === 100 && (
                            <CheckCircleIcon sx={{ fontSize: 14, color: '#10B981' }} />
                          )}
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: '#e2e8f0',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: progressColor,
                              borderRadius: 3
                            }
                          }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Update Progress">
                          <IconButton 
                            size="small" 
                            onClick={() => handleOpenProgressDialog(action)} 
                            color="primary"
                          >
                            <TrendingUpIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Action">
                          <IconButton 
                            size="small" 
                            onClick={() => handleEditAction(action)} 
                            color="secondary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Assign User">
                          <IconButton 
                            size="small" 
                            onClick={() => handleAssignAction(action)} 
                            color="success"
                          >
                            <PersonAddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            onClick={() => handleViewAction(action.id)} 
                            color="default"
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Add Action Dialog */}
      

      <AddActionDialog
        open={showAddActionDialog}
        onClose={() => setShowAddActionDialog(false)}
        meetingId={meetingId}
        minutes={minutes}
        selectedMinuteId={null}
        onSave={async (payload) => {
          try {
            // Use the minute-based endpoint that exists in your backend
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
        loading={loading}
        error={error}
      />

        {/* Progress Update Dialog */}
        <Dialog 
          open={showProgressDialog} 
          onClose={() => setShowProgressDialog(false)} 
          maxWidth="md" 
          fullWidth
          TransitionComponent={Fade}
          transitionDuration={300}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                Update Progress
              </Typography>
              <IconButton onClick={() => setShowProgressDialog(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={3}>
              <Card variant="outlined" sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <AssignmentIcon color="primary" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Current Task
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {selectedAction?.description}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Progress: {progressValue}%
                </Typography>
                <Slider
                  value={progressValue}
                  onChange={(e, val) => setProgressValue(val)}
                  step={5}
                  marks={PROGRESS_PRESETS.map(p => ({ value: p.value, label: p.label }))}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                />
              </Box>

              <Grid container spacing={1}>
                {PROGRESS_PRESETS.map((preset) => (
                  <Grid size={{ xs: 12, sm: 2.4 }} key={preset.value}>
                    <Button
                      fullWidth
                      variant={progressValue === preset.value ? 'contained' : 'outlined'}
                      onClick={() => setProgressValue(preset.value)}
                      sx={{
                        py: 1,
                        borderColor: preset.color,
                        color: progressValue === preset.value ? '#fff' : preset.color,
                        bgcolor: progressValue === preset.value ? preset.color : 'transparent',
                      }}
                    >
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {preset.icon}
                        <Typography variant="caption">{preset.label}</Typography>
                      </Stack>
                    </Button>
                  </Grid>
                ))}
              </Grid>

              <Divider />

              {statusOptions.length > 0 && (
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={selectedStatusId}
                    onChange={(e) => setSelectedStatusId(e.target.value)}
                    label="Status"
                  >
                    {statusOptions.map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {opt.short_name === 'COMPLETED' && <CheckCircleIcon fontSize="small" color="success" />}
                          {opt.short_name === 'IN_PROGRESS' && <PendingIcon fontSize="small" color="info" />}
                          {opt.short_name === 'PENDING' && <ScheduleIcon fontSize="small" color="warning" />}
                          {opt.short_name === 'OVERDUE' && <WarningIcon fontSize="small" color="error" />}
                          <Typography variant="body2">
                            {opt.name?.replace('Action Status - ', '') || opt.short_name}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

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
          <DialogActions sx={{ p: 2.5, pt: 0 }}>
            <Button onClick={() => setShowProgressDialog(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleProgressUpdate}
              disabled={isUpdating || !selectedStatusId}
              startIcon={isUpdating ? <CircularProgress size={16} /> : <SaveIcon />}
            >
              {isUpdating ? 'Saving...' : 'Save Progress'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Action Dialog */}
        <EditActionDialog
          open={showEditDialog}
          action={selectedAction}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedAction(null);
          }}
          onSave={handleEditSave}
        />

        {/* Assign User Dialog */}
        <AssignUserDialog
          open={showAssignDialog}
          action={selectedAction}
          meetingId={selectedAction?._meetingId || meetingId}
          onClose={() => {
            setShowAssignDialog(false);
            setSelectedAction(null);
          }}
          onAssign={handleAssignSave}
        />
      </Box>
    </Fade>
  );
};

export default MeetingActionsList;