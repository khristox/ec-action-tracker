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
  Divider,
  useTheme,
  alpha
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
  Close as CloseIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { 
  updateActionProgress
} from '../../../store/slices/actionTracker/actionSlice';
import { 
  fetchMeetingMinutes, 
  selectMeetingMinutes 
} from '../../../store/slices/actionTracker/meetingSlice';
import api from '../../../services/api';

import EditActionDialog from './components/EditActionDialog';
import AssignUserDialog from './components/AssignUserDialog';
import AddActionDialog from './components/AddActionDialog';

// Progress presets for the slider
const PROGRESS_PRESETS = [
  { value: 0, label: 'Not Started', colorKey: 'grey', icon: <ScheduleIcon fontSize="small" /> },
  { value: 25, label: '25%', colorKey: 'primary', icon: <PendingIcon fontSize="small" /> },
  { value: 50, label: '50%', colorKey: 'warning', icon: <TrendingUpIcon fontSize="small" /> },
  { value: 75, label: '75%', colorKey: 'secondary', icon: <TrendingUpIcon fontSize="small" /> },
  { value: 100, label: 'Complete', colorKey: 'success', icon: <CheckCircleIcon fontSize="small" /> }
];

// Check if meeting allows editing actions
const canEditActions = (meetingStatus) => {
  if (!meetingStatus) return false;
  const statusLower = String(meetingStatus).toLowerCase();
  const allowedStatuses = ['started', 'ongoing', 'in_progress', 'in progress', 'completed'];
  return allowedStatuses.some(status => statusLower.includes(status));
};

const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  return format(new Date(dateString), 'MMM d, yyyy');
};

const getStatusConfig = (action, theme) => {
  const isDarkMode = theme?.palette?.mode === 'dark';
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const isCompleted = action.completed_at || action.overall_progress_percentage >= 100;
  
  if (isCompleted) {
    return { 
      label: 'Completed', 
      color: 'success', 
      icon: <CheckCircleIcon fontSize="small" />,
      chipSx: isDarkMode ? { bgcolor: alpha('#10B981', 0.2), color: '#34D399' } : {}
    };
  }
  if (isOverdue) {
    return { 
      label: 'Overdue', 
      color: 'error', 
      icon: <WarningIcon fontSize="small" />,
      chipSx: isDarkMode ? { bgcolor: alpha('#EF4444', 0.2), color: '#F87171' } : {}
    };
  }
  if (action.overall_status_name === 'in_progress') {
    return { 
      label: 'In Progress', 
      color: 'info', 
      icon: <PendingIcon fontSize="small" />,
      chipSx: isDarkMode ? { bgcolor: alpha('#3B82F6', 0.2), color: '#60A5FA' } : {}
    };
  }
  return { 
    label: 'Pending', 
    color: 'warning', 
    icon: <ScheduleIcon fontSize="small" />,
    chipSx: isDarkMode ? { bgcolor: alpha('#F59E0B', 0.2), color: '#FBBF24' } : {}
  };
};

const MeetingActionsList = ({ meetingId, meetingStatus, onRefresh }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  // Redux selectors
  const minutesList = useSelector(selectMeetingMinutes);
  const { updatingProgress } = useSelector((state) => state.actions || {});
  
  const [actions, setActions] = useState([]);
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
  const [successMessage, setSuccessMessage] = useState('');

  // Check if user can edit actions based on meeting status
  const canEdit = canEditActions(meetingStatus);
  
  // Get status display message
  const getStatusMessage = () => {
    if (!meetingStatus) return null;
    const statusLower = String(meetingStatus).toLowerCase();
    if (statusLower === 'scheduled' || statusLower === 'pending') {
      return "Meeting hasn't started yet. Actions can only be created and edited once the meeting is in progress.";
    }
    if (statusLower === 'cancelled') {
      return "Meeting has been cancelled. Actions cannot be created or edited.";
    }
    return null;
  };

  // Fetch minutes using Redux
  const fetchMinutes = useCallback(() => {
    if (meetingId) {
      dispatch(fetchMeetingMinutes(meetingId));
    }
  }, [dispatch, meetingId]);

  // Extract actions from minutes
  const extractActionsFromMinutes = useCallback(() => {
    setLoading(true);
    try {
      const actionsData = [];
      (minutesList || []).forEach(minute => {
        if (minute.actions && minute.actions.length > 0) {
          actionsData.push(...minute.actions);
        }
      });
      setActions(actionsData);
    } catch (err) {
      console.error('Error extracting actions:', err);
      setError('Failed to load actions');
    } finally {
      setLoading(false);
    }
  }, [minutesList]);

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

  useEffect(() => {
    if (meetingId) {
      fetchMinutes();
      fetchStatusOptions();
    }
  }, [fetchMinutes, fetchStatusOptions, meetingId]);

  useEffect(() => {
    extractActionsFromMinutes();
  }, [minutesList, extractActionsFromMinutes]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleRefresh = () => {
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
    setSelectedAction({
      ...action,
      _meetingId: meetingIdFromAction
    });
    setShowAssignDialog(true);
  };

  const handleEditSave = () => {
    fetchMinutes();
    setSuccessMessage('Action updated successfully!');
  };

  const handleAssignSave = () => {
    fetchMinutes();
    setSuccessMessage('Action assigned successfully!');
  };

  const handleActionCreated = () => {
    fetchMinutes();
    if (onRefresh) onRefresh();
    setSuccessMessage('Action created successfully!');
  };

  const handleProgressUpdate = async () => {
    if (!selectedAction) return;
    
    if (!selectedStatusId) {
      setError('Please select a status');
      return;
    }
    
    setLocalUpdating(true);
    
    try {
      const payload = {
        progress_percentage: parseInt(progressValue),
        individual_status_id: selectedStatusId,
        remarks: progressRemarks.trim() || `Progress updated to ${progressValue}%`
      };
      
      await dispatch(updateActionProgress({ 
        id: selectedAction.id, 
        progressData: payload 
      })).unwrap();
      
      setShowProgressDialog(false);
      setProgressRemarks('');
      setProgressValue(0);
      setSelectedStatusId('');
      setSuccessMessage('Progress updated successfully!');
      
      await fetchMinutes();
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
    setShowProgressDialog(true);
  };

  const getProgressColor = (value) => {
    if (value >= 100) return isDarkMode ? '#34D399' : 'success.main';
    if (value >= 75) return isDarkMode ? '#A78BFA' : 'secondary.main';
    if (value >= 50) return isDarkMode ? '#FBBF24' : 'warning.main';
    if (value >= 25) return isDarkMode ? '#60A5FA' : 'primary.main';
    return isDarkMode ? '#6B7280' : 'grey.500';
  };

  const isUpdating = localUpdating || updatingProgress;
  const statusMessage = getStatusMessage();

  if (loading && actions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', mt: 2 }}>
          Loading actions...
        </Typography>
      </Box>
    );
  }

  if (minutesList.length === 0 && !loading) {
    return (
      <Grow in timeout={500}>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <AssignmentIcon sx={{ fontSize: 64, color: isDarkMode ? '#6B7280' : 'action.disabled', mb: 2 }} />
          <Typography variant="body1" sx={{ color: isDarkMode ? '#D1D5DB' : 'text.secondary' }} gutterBottom>
            No action items found for this meeting.
          </Typography>
          <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', mb: 2 }}>
            {canEdit 
              ? "Actions can be added from the Minutes tab by expanding a minute and clicking 'Add Action'."
              : statusMessage || "Actions can only be created once the meeting is in progress."}
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
          <Typography variant="h6" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
            Action Items ({actions.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title={!canEdit ? (statusMessage || "Meeting must be started to add actions") : "Add new action item"}>
              <span>
                <Button
                  variant="contained"
                  startIcon={!canEdit ? <LockIcon /> : <AddIcon />}
                  onClick={() => setShowAddActionDialog(true)}
                  size="small"
                  disabled={!canEdit}
                  sx={{
                    bgcolor: isDarkMode ? '#7C3AED' : undefined,
                    '&:hover': { bgcolor: isDarkMode ? '#6D28D9' : undefined }
                  }}
                >
                  Add Action
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={handleRefresh} 
                size="small" 
                disabled={loading}
                sx={{
                  color: isDarkMode ? '#D1D5DB' : 'inherit',
                  '&:hover': { backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04) }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Status message when meeting hasn't started */}
        {statusMessage && (
          <Alert 
            severity="info" 
            icon={<LockIcon />} 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              bgcolor: isDarkMode ? alpha('#3B82F6', 0.1) : undefined,
              color: isDarkMode ? '#60A5FA' : undefined
            }}
          >
            {statusMessage}
          </Alert>
        )}

        {successMessage && (
          <Alert 
            severity="success" 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              bgcolor: isDarkMode ? alpha('#10B981', 0.1) : undefined,
              color: isDarkMode ? '#34D399' : undefined
            }}
            onClose={() => setSuccessMessage('')}
          >
            {successMessage}
          </Alert>
        )}

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              bgcolor: isDarkMode ? alpha('#EF4444', 0.1) : undefined,
              color: isDarkMode ? '#F87171' : undefined
            }} 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <TableContainer 
          component={Paper} 
          variant="outlined" 
          sx={{ 
            borderRadius: 2,
            bgcolor: isDarkMode ? '#1F2937' : 'background.paper',
            borderColor: isDarkMode ? '#374151' : '#E5E7EB'
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: isDarkMode ? alpha('#A78BFA', 0.1) : 'action.hover' }}>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Assigned To</TableCell>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Due Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Progress</TableCell>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {actions.map((action) => {
                const statusConfig = getStatusConfig(action, theme);
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
                  <TableRow key={action.id} hover sx={{ 
                    '&:hover': { bgcolor: isDarkMode ? alpha('#FFFFFF', 0.05) : alpha('#000000', 0.02) } 
                  }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                        {action.description}
                      </Typography>
                      {action.remarks && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                          {action.remarks}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Avatar sx={{ 
                          width: 28, 
                          height: 28, 
                          bgcolor: isDarkMode ? alpha('#A78BFA', 0.2) : 'primary.light', 
                          fontSize: '0.75rem',
                          color: isDarkMode ? '#A78BFA' : 'primary.contrastText'
                        }}>
                          {assignedToName?.[0]?.toUpperCase() || '?'}
                        </Avatar>
                        <Typography variant="body2" sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
                          {assignedToName}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <ScheduleIcon fontSize="small" sx={{ color: isOverdue ? (isDarkMode ? '#F87171' : 'error') : (isDarkMode ? '#6B7280' : 'action') }} />
                        <Typography variant="body2" sx={{ color: isOverdue ? (isDarkMode ? '#F87171' : 'error') : (isDarkMode ? '#D1D5DB' : 'text.primary') }}>
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
                          ...statusConfig.chipSx
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <Stack spacing={0.5}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" fontWeight={500} sx={{ color: progressColor }}>
                            {progress}%
                          </Typography>
                          {progress === 100 && (
                            <CheckCircleIcon sx={{ fontSize: 14, color: isDarkMode ? '#34D399' : 'success.main' }} />
                          )}
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: isDarkMode ? '#374151' : 'action.disabledBackground',
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
                        <Tooltip title={canEdit ? "Update Progress" : "Meeting must be started to update progress"}>
                          <span>
                            <IconButton 
                              size="small" 
                              onClick={() => handleOpenProgressDialog(action)} 
                              disabled={!canEdit}
                              sx={{ color: isDarkMode ? '#60A5FA' : 'primary.main' }}
                            >
                              <TrendingUpIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={canEdit ? "Edit Action" : "Meeting must be started to edit actions"}>
                          <span>
                            <IconButton 
                              size="small" 
                              onClick={() => handleEditAction(action)} 
                              disabled={!canEdit}
                              sx={{ color: isDarkMode ? '#A78BFA' : 'secondary.main' }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={canEdit ? "Assign User" : "Meeting must be started to assign users"}>
                          <span>
                            <IconButton 
                              size="small" 
                              onClick={() => handleAssignAction(action)} 
                              disabled={!canEdit}
                              sx={{ color: isDarkMode ? '#34D399' : 'success.main' }}
                            >
                              <PersonAddIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            onClick={() => handleViewAction(action.id)}
                            sx={{ color: isDarkMode ? '#9CA3AF' : 'default' }}
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
          minutes={minutesList}
          selectedMinuteId={null}
          onSave={async (payload) => {
            try {
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
          PaperProps={{
            sx: {
              bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
              borderRadius: 2
            }
          }}
        >
          <DialogTitle sx={{ pb: 1, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                Update Progress
              </Typography>
              <IconButton onClick={() => setShowProgressDialog(false)} size="small" sx={{ color: isDarkMode ? '#9CA3AF' : 'inherit' }}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>
          <Divider sx={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }} />
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={3}>
              <Card 
                variant="outlined" 
                sx={{ 
                  bgcolor: isDarkMode ? alpha('#A78BFA', 0.1) : 'action.hover',
                  borderColor: isDarkMode ? '#374151' : 'divider',
                  borderRadius: 2 
                }}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <AssignmentIcon sx={{ color: isDarkMode ? '#A78BFA' : 'primary.main' }} />
                    <Box>
                      <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                        Current Task
                      </Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                        {selectedAction?.description}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
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
                  sx={{
                    '& .MuiSlider-markLabel': {
                      color: isDarkMode ? '#9CA3AF' : 'inherit'
                    }
                  }}
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
                        ...(isDarkMode && progressValue === preset.value && {
                          bgcolor: '#7C3AED',
                          '&:hover': { bgcolor: '#6D28D9' }
                        })
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

              <Divider sx={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }} />

              {statusOptions.length > 0 && (
                <FormControl fullWidth>
                  <InputLabel sx={{ color: isDarkMode ? '#9CA3AF' : 'inherit' }}>Status</InputLabel>
                  <Select
                    value={selectedStatusId}
                    onChange={(e) => setSelectedStatusId(e.target.value)}
                    label="Status"
                    sx={{
                      color: isDarkMode ? '#D1D5DB' : 'inherit',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: isDarkMode ? '#4B5563' : undefined
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: isDarkMode ? '#6B7280' : undefined
                      }
                    }}
                  >
                    {statusOptions.map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {opt.short_name === 'COMPLETED' && <CheckCircleIcon fontSize="small" sx={{ color: '#10B981' }} />}
                          {opt.short_name === 'IN_PROGRESS' && <PendingIcon fontSize="small" sx={{ color: '#3B82F6' }} />}
                          {opt.short_name === 'PENDING' && <ScheduleIcon fontSize="small" sx={{ color: '#F59E0B' }} />}
                          {opt.short_name === 'OVERDUE' && <WarningIcon fontSize="small" sx={{ color: '#EF4444' }} />}
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: isDarkMode ? '#D1D5DB' : 'inherit',
                    '& fieldset': { borderColor: isDarkMode ? '#4B5563' : undefined },
                    '&:hover fieldset': { borderColor: isDarkMode ? '#6B7280' : undefined }
                  },
                  '& .MuiInputLabel-root': { color: isDarkMode ? '#9CA3AF' : undefined }
                }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 0 }}>
            <Button 
              onClick={() => setShowProgressDialog(false)} 
              disabled={isUpdating}
              sx={{ color: isDarkMode ? '#9CA3AF' : 'inherit' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleProgressUpdate}
              disabled={isUpdating || !selectedStatusId}
              startIcon={isUpdating ? <CircularProgress size={16} /> : <SaveIcon />}
              sx={{
                bgcolor: isDarkMode ? '#7C3AED' : undefined,
                '&:hover': { bgcolor: isDarkMode ? '#6D28D9' : undefined }
              }}
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