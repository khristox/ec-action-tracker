import React, { useState, useEffect } from 'react';
import {
  Paper, Stack, Box, Typography, Chip, IconButton, Tooltip,
  Button, LinearProgress, Alert, Divider
} from '@mui/material';
import {
  Edit as EditIcon, Delete as DeleteIcon, Person as PersonIcon,
  Schedule as ScheduleIcon, PriorityHigh as PriorityIcon,
  Comment as CommentIcon, CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import api from '../../../../services/api';
import CommentsDialog from './CommentsDialog';

// Helper function to get display name from assigned_to object
const getAssignedDisplayName = (action) => {
  // Check if assigned_to relationship exists (system user)
  if (action.assigned_to?.username) {
    return action.assigned_to.username;
  }
  
  // Check if assigned_to_name is an object (new format)
  if (action.assigned_to_name) {
    if (typeof action.assigned_to_name === 'object') {
      return action.assigned_to_name.name || 'Unassigned';
    }
    // Legacy string format
    return action.assigned_to_name;
  }
  
  return 'Unassigned';
};

const ActionItem = ({ action, minuteId, onUpdate, onEdit }) => {
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [statusOptions, setStatusOptions] = useState([]);
  const [selectedStatusId, setSelectedStatusId] = useState(null);

  // Fetch status options on mount
  useEffect(() => {
    const fetchStatusOptions = async () => {
      try {
        const response = await api.get('/attribute-groups/ACTION_TRACKER/attributes');
        const attributes = response.data.items || response.data || [];
        const actionStatuses = attributes.filter(a => a.code?.startsWith('ACTION_STATUS_'));
        setStatusOptions(actionStatuses);
        
        // Set default status based on current progress
        if (action.overall_status_id) {
          setSelectedStatusId(action.overall_status_id);
        } else if (actionStatuses.length > 0) {
          // Auto-select based on progress
          const progress = action.overall_progress_percentage || 0;
          if (progress === 100) {
            const completed = actionStatuses.find(s => s.code === 'ACTION_STATUS_COMPLETED');
            if (completed) setSelectedStatusId(completed.id);
          } else if (progress > 0) {
            const inProgress = actionStatuses.find(s => s.code === 'ACTION_STATUS_IN_PROGRESS');
            if (inProgress) setSelectedStatusId(inProgress.id);
          } else {
            const pending = actionStatuses.find(s => s.code === 'ACTION_STATUS_PENDING');
            if (pending) setSelectedStatusId(pending.id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch status options:', err);
      }
    };
    fetchStatusOptions();
  }, [action.overall_status_id, action.overall_progress_percentage]);

  const handleUpdateProgress = async () => {
    const newProgress = Math.min((action.overall_progress_percentage || 0) + 25, 100);
    
    // Find appropriate status ID based on new progress
    let statusId = selectedStatusId;
    if (!statusId && statusOptions.length > 0) {
      if (newProgress === 100) {
        const completed = statusOptions.find(s => s.code === 'ACTION_STATUS_COMPLETED');
        statusId = completed?.id;
      } else if (newProgress > 0) {
        const inProgress = statusOptions.find(s => s.code === 'ACTION_STATUS_IN_PROGRESS');
        statusId = inProgress?.id;
      } else {
        const pending = statusOptions.find(s => s.code === 'ACTION_STATUS_PENDING');
        statusId = pending?.id;
      }
    }
    
    if (!statusId) {
      setError('Unable to determine status. Please refresh and try again.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    setUpdatingProgress(true);
    setError(null);
    
    try {
      const payload = {
        progress_percentage: newProgress,
        individual_status_id: statusId,
        remarks: `Progress updated from ${action.overall_progress_percentage || 0}% to ${newProgress}%`
      };
      
      console.log('Updating progress with payload:', payload);
      
      const response = await api.post(`/action-tracker/actions/${action.id}/progress`, payload);
      
      if (response.data) {
        onUpdate(); // Refresh the parent component
      }
    } catch (err) {
      console.error("Failed to update progress", err);
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Failed to update progress';
      setError(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingProgress(false);
    }
  };

  const handleDeleteAction = async () => {
    if (!window.confirm("Delete this action item? This action cannot be undone.")) return;
    try {
      await api.delete(`/action-tracker/actions/${action.id}`);
      onUpdate();
    } catch (err) {
      console.error("Failed to delete action", err);
      setError(err.response?.data?.detail || 'Failed to delete action');
      setTimeout(() => setError(null), 3000);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return 'error';
      case 2: return 'warning';
      case 3: return 'info';
      case 4: return 'default';
      default: return 'default';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 1: return 'High';
      case 2: return 'Medium';
      case 3: return 'Low';
      case 4: return 'Very Low';
      default: return 'Medium';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleString();
  };

  const assignedDisplayName = getAssignedDisplayName(action);

  return (
    <>
      <Paper sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2, mb: 2 }} elevation={0}>
        <Stack spacing={1.5}>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}
          
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
            <Box flex={1} minWidth={200}>
              <Typography variant="subtitle2" fontWeight={600}>
                {action.description}
              </Typography>
              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  icon={<PersonIcon />}
                  label={`Assigned to: ${assignedDisplayName}`}
                />
                <Chip
                  size="small"
                  icon={<ScheduleIcon />}
                  label={`Due: ${formatDate(action.due_date)}`}
                />
                <Chip
                  size="small"
                  icon={<PriorityIcon />}
                  label={`Priority: ${getPriorityLabel(action.priority)}`}
                  color={getPriorityColor(action.priority)}
                />
                <Chip
                  size="small"
                  icon={<CommentIcon />}
                  label={`Comments: ${action.comments?.length || 0}`}
                  onClick={() => setCommentsOpen(true)}
                  sx={{ cursor: 'pointer' }}
                />
              </Stack>
              {action.remarks && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  <strong>Remarks:</strong> {action.remarks}
                </Typography>
              )}
            </Box>
            <Box textAlign="right" minWidth={120}>
              <Typography variant="caption" color="text.secondary">Progress</Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <LinearProgress
                  variant="determinate"
                  value={action.overall_progress_percentage || 0}
                  sx={{ flex: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" fontWeight={600}>
                  {action.overall_progress_percentage || 0}%
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box display="flex" justifyContent="flex-end" gap={1} flexWrap="wrap">
            {action.overall_progress_percentage !== 100 && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleUpdateProgress}
                disabled={updatingProgress}
              >
                {updatingProgress ? 'Updating...' : 'Update Progress (+25%)'}
              </Button>
            )}
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => onEdit(minuteId, action)}
            >
              Edit
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteAction}
            >
              Delete
            </Button>
          </Box>

          {action.completed_at && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 1 }}>
              Completed on {formatDateTime(action.completed_at)}
            </Alert>
          )}

          <Divider />
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              size="small"
              label={`Created by: ${action.created_by_name || 'System'} on ${formatDateTime(action.created_at)}`}
              variant="outlined"
            />
            {action.updated_at && action.updated_at !== action.created_at && (
              <Chip
                size="small"
                label={`Updated by: ${action.updated_by_name || 'System'} on ${formatDateTime(action.updated_at)}`}
                variant="outlined"
                color="secondary"
              />
            )}
          </Stack>
        </Stack>
      </Paper>

      <CommentsDialog
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        action={action}
        onUpdate={onUpdate}
      />
    </>
  );
};

export default ActionItem;