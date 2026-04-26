// src/components/actiontracker/meetings/MeetingActionsList.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Paper, Typography, Box, Stack, Button, IconButton,
  Chip, Alert, CircularProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  Avatar, Tooltip, LinearProgress, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, Slider,
  Grid, Divider, Card, CardContent, Fade, Grow,
  Autocomplete, Skeleton, Badge
} from '@mui/material';
import {
  Edit as EditIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  TrendingUp as TrendingUpIcon,
  PlayCircle as PlayCircleIcon,
  TaskAlt as TaskAltIcon,
  Visibility as VisibilityIcon,
  PersonAdd as PersonAddIcon,
  Flag as FlagIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { updateActionProgress } from '../../../store/slices/actionTracker/actionSlice';
import api from '../../../services/api';

import EditActionDialog from './EditActionDialog';
import AssignUserDialog from './AssignUserDialog';

// ==================== Helper Functions ====================

const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
};

const getAssignedToName = (action) => {
  // Priority 1: Full user object from relationship
  if (action.assigned_to?.full_name) {
    return action.assigned_to.full_name;
  }
  if (action.assigned_to?.username) {
    return action.assigned_to.username;
  }
  
  // Priority 2: Direct string field
  if (typeof action.assigned_to_name === 'string' && action.assigned_to_name && action.assigned_to_name !== 'null') {
    return action.assigned_to_name;
  }
  
  // Priority 3: Object with name property
  if (action.assigned_to_name && typeof action.assigned_to_name === 'object') {
    return action.assigned_to_name.name || action.assigned_to_name.email || null;
  }
  
  // Priority 4: Fallback to assigned_by (who created/assigned)
  if (action.assigned_by_name && typeof action.assigned_by_name === 'string' && action.assigned_by_name !== 'null') {
    return `${action.assigned_by_name} (assigned by)`;
  }
  
  // Priority 5: Created by
  if (action.created_by_name && typeof action.created_by_name === 'string' && action.created_by_name !== 'null') {
    return `${action.created_by_name} (created)`;
  }
  
  return 'Unassigned';
};

const getStatusConfig = (action) => {
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const isCompleted = action.completed_at || action.overall_progress_percentage >= 100;
  
  if (isCompleted) {
    return { 
      label: 'Completed', 
      color: 'success', 
      icon: <CheckCircleIcon fontSize="small" />, 
      bgColor: '#D1FAE5', 
      textColor: '#065F46' 
    };
  }
  if (isOverdue) {
    return { 
      label: 'Overdue', 
      color: 'error', 
      icon: <WarningIcon fontSize="small" />, 
      bgColor: '#FEE2E2', 
      textColor: '#991B1B' 
    };
  }
  if (action.overall_status_name === 'in_progress') {
    return { 
      label: 'In Progress', 
      color: 'info', 
      icon: <PendingIcon fontSize="small" />, 
      bgColor: '#DBEAFE', 
      textColor: '#1E40AF' 
    };
  }
  return { 
    label: 'Pending', 
    color: 'warning', 
    icon: <ScheduleIcon fontSize="small" />, 
    bgColor: '#FEF3C7', 
    textColor: '#92400E' 
  };
};

const getPriorityConfig = (priority) => {
  switch(priority) {
    case 1: return { label: 'High', color: '#EF4444', bgColor: '#FEE2E2' };
    case 2: return { label: 'Medium', color: '#F59E0B', bgColor: '#FEF3C7' };
    case 3: return { label: 'Low', color: '#10B981', bgColor: '#D1FAE5' };
    case 4: return { label: 'Very Low', color: '#6B7280', bgColor: '#F3F4F6' };
    default: return { label: 'Medium', color: '#F59E0B', bgColor: '#FEF3C7' };
  }
};

const PROGRESS_PRESETS = [
  { value: 0, label: 'Not Started', icon: <ScheduleIcon sx={{ fontSize: 20 }} />, color: '#6B7280' },
  { value: 25, label: 'Just Started', icon: <PlayCircleIcon sx={{ fontSize: 20 }} />, color: '#3B82F6' },
  { value: 50, label: 'Halfway There', icon: <TrendingUpIcon sx={{ fontSize: 20 }} />, color: '#F59E0B' },
  { value: 75, label: 'Almost Done', icon: <PendingIcon sx={{ fontSize: 20 }} />, color: '#8B5CF6' },
  { value: 100, label: 'Completed', icon: <TaskAltIcon sx={{ fontSize: 20 }} />, color: '#10B981' },
];

// ==================== Loading Skeleton ====================
const TableSkeleton = () => (
  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
    <Table>
      <TableHead>
        <TableRow sx={{ bgcolor: '#f1f5f9' }}>
          {['Description', 'Assigned To', 'Due Date', 'Status', 'Progress', 'Actions'].map((header) => (
            <TableCell key={header} sx={{ fontWeight: 700 }}>{header}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {[1, 2, 3].map((i) => (
          <TableRow key={i}>
            <TableCell><Skeleton variant="text" width="100%" /></TableCell>
            <TableCell>
              <Skeleton variant="circular" width={28} height={28} />
              <Skeleton variant="text" width={80} />
            </TableCell>
            <TableCell><Skeleton variant="text" width={100} /></TableCell>
            <TableCell><Skeleton variant="rounded" width={90} height={26} /></TableCell>
            <TableCell><Skeleton variant="rounded" width={120} height={30} /></TableCell>
            <TableCell><Skeleton variant="circular" width={28} height={28} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

// ==================== Action Row Component ====================
const ActionRow = ({ action, onOpenProgress, onEdit, onAssign, onView }) => {
  const statusConfig = getStatusConfig(action);
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const assignedToName = getAssignedToName(action);
  const progress = action.overall_progress_percentage || 0;
  const progressColor = progress >= 100 ? '#10B981' : progress >= 75 ? '#8B5CF6' : progress >= 50 ? '#F59E0B' : progress >= 25 ? '#3B82F6' : '#6B7280';
  const priorityConfig = getPriorityConfig(action.priority);

  return (
    <TableRow hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
      <TableCell>
        <Stack spacing={0.5}>
          <Typography variant="body2" fontWeight={500}>
            {action.description}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              label={priorityConfig.label}
              sx={{
                height: 20,
                fontSize: '0.65rem',
                bgcolor: priorityConfig.bgColor,
                color: priorityConfig.color,
                fontWeight: 500
              }}
            />
            {action.remarks && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FlagIcon sx={{ fontSize: 12 }} />
                {action.remarks.length > 50 ? `${action.remarks.substring(0, 50)}...` : action.remarks}
              </Typography>
            )}
          </Stack>
        </Stack>
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            variant="dot"
            color={assignedToName !== 'Unassigned' ? 'success' : 'warning'}
          >
            <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.light', fontSize: '0.75rem' }}>
              {assignedToName?.[0]?.toUpperCase() || '?'}
            </Avatar>
          </Badge>
          <Typography variant="body2" color={assignedToName === 'Unassigned' ? 'text.secondary' : 'text.primary'}>
            {assignedToName}
          </Typography>
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
            <IconButton size="small" onClick={() => onOpenProgress(action)} color="primary">
              <TrendingUpIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Action">
            <IconButton size="small" onClick={() => onEdit(action)} color="secondary">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Assign/Reassign User">
            <IconButton size="small" onClick={() => onAssign(action)} color="success">
              <PersonAddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => onView(action.id)} color="default">
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
};

// ==================== Empty State Component ====================
const EmptyState = ({ onRefresh }) => (
  <Grow in timeout={500}>
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <AssignmentIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
      <Typography variant="body1" color="text.secondary" gutterBottom>
        No action items found for this meeting.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Actions can be added from the Minutes tab by expanding a minute and clicking "Add Action".
      </Typography>
      <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRefresh} sx={{ mt: 1 }}>
        Refresh
      </Button>
    </Box>
  </Grow>
);

// ==================== Main Component ====================
const MeetingActionsList = ({ meetingId: propMeetingId, onRefresh }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id: urlMeetingId } = useParams();
  
  // Use meetingId from props or from URL as fallback
  const meetingId = propMeetingId || urlMeetingId;
  

  const { updatingProgress } = useSelector((state) => state.actions || {});
  
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressRemarks, setProgressRemarks] = useState('');
  const [localUpdating, setLocalUpdating] = useState(false);
  const [statusOptions, setStatusOptions] = useState([]);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [selectedStatusName, setSelectedStatusName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

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

  // Fetch actions
  const fetchActions = useCallback(async () => {
    if (!meetingId) {
      console.error('No meetingId available');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      
      let actionsData = [];
      
      const minutesResponse = await api.get(`/action-tracker/meetings/${meetingId}/minutes`);
      const minutes = minutesResponse.data?.items || minutesResponse.data || [];
      
      minutes.forEach(minute => {
        if (minute.actions && minute.actions.length > 0) {
          actionsData.push(...minute.actions);
        }
      });
      
      // Sort actions: Overdue first, then by due date
      actionsData.sort((a, b) => {
        const aOverdue = a.due_date && new Date(a.due_date) < new Date() && !a.completed_at;
        const bOverdue = b.due_date && new Date(b.due_date) < new Date() && !b.completed_at;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return new Date(a.due_date) - new Date(b.due_date);
      });
      
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
      fetchStatusOptions();
    }
  }, [fetchActions, fetchStatusOptions, meetingId, refreshKey]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleRefresh = () => {
    fetchActions();
    if (onRefresh) onRefresh();
    setRefreshKey(prev => prev + 1);
  };

  const handleViewAction = (actionId) => {
    navigate(`/actions/${actionId}`);
  };

  const handleEditAction = (action) => {
    setSelectedAction(action);
    setShowEditDialog(true);
  };

  const handleAssignAction = (action) => {
    setSelectedAction(action);
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

  const stats = useMemo(() => {
    const total = actions.length;
    const completed = actions.filter(a => a.completed_at || a.overall_progress_percentage >= 100).length;
    const inProgress = actions.filter(a => a.overall_status_name === 'in_progress' && !a.completed_at).length;
    const overdue = actions.filter(a => a.due_date && new Date(a.due_date) < new Date() && !a.completed_at).length;
    return { total, completed, inProgress, overdue };
  }, [actions]);

  const isUpdating = localUpdating || updatingProgress;

  if (loading && actions.length === 0) {
    return <TableSkeleton />;
  }

  if (actions.length === 0 && !loading) {
    return <EmptyState onRefresh={handleRefresh} />;
  }

  return (
    <Fade in timeout={500}>
      <Box>
        {/* Header with Stats */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }} flexWrap="wrap" gap={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              Action Items
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip size="small" label={`Total: ${stats.total}`} variant="outlined" />
              {stats.completed > 0 && <Chip size="small" label={`Completed: ${stats.completed}`} color="success" variant="outlined" />}
              {stats.inProgress > 0 && <Chip size="small" label={`In Progress: ${stats.inProgress}`} color="info" variant="outlined" />}
              {stats.overdue > 0 && <Chip size="small" label={`Overdue: ${stats.overdue}`} color="error" variant="outlined" />}
            </Stack>
          </Stack>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} size="small" disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Success Message */}
        {successMessage && (
          <Alert 
            severity="success" 
            sx={{ mb: 3, borderRadius: 2 }}
            onClose={() => setSuccessMessage('')}
          >
            {successMessage}
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Actions Table */}
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table sx={{ minWidth: 800 }}>
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
              {actions.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  onOpenProgress={handleOpenProgressDialog}
                  onEdit={handleEditAction}
                  onAssign={handleAssignAction}
                  onView={handleViewAction}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>

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
                        '&:hover': {
                          bgcolor: preset.color,
                          color: '#fff',
                          opacity: 0.9
                        }
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
          meetingId={meetingId}
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