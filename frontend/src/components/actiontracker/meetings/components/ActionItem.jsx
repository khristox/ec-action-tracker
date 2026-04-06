import React, { useState } from 'react';
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

const ActionItem = ({ action, minuteId, onUpdate, onEdit }) => {
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const handleUpdateProgress = async () => {
    setUpdatingProgress(true);
    try {
      await api.post(`/action-tracker/actions/${action.id}/progress`, {
        overall_progress_percentage: Math.min((action.overall_progress_percentage || 0) + 25, 100)
      });
      onUpdate();
    } catch (err) {
      console.error("Failed to update progress", err);
    } finally {
      setUpdatingProgress(false);
    }
  };

  const handleDeleteAction = async () => {
    if (!window.confirm("Delete this action item?")) return;
    try {
      await api.delete(`/action-tracker/actions/${action.id}`);
      onUpdate();
    } catch (err) {
      console.error("Failed to delete action", err);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return 'error';
      case 2: return 'warning';
      case 3: return 'info';
      default: return 'default';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 1: return 'High';
      case 2: return 'Medium';
      case 3: return 'Low';
      default: return 'Very Low';
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

  return (
    <>
      <Paper sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2, mb: 2 }} elevation={0}>
        <Stack spacing={1.5}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1}>
              <Typography variant="subtitle2" fontWeight={600}>
                {action.description}
              </Typography>
              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                <Chip
                  size="small"
                  icon={<PersonIcon />}
                  label={`Assigned to: ${action.assigned_to_name || action.assigned_to?.username || 'Unassigned'}`}
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
                  sx={{ flex: 1, height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption" fontWeight={600}>
                  {action.overall_progress_percentage || 0}%
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box display="flex" justifyContent="flex-end" gap={1}>
            {action.overall_progress_percentage !== 100 && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleUpdateProgress}
                disabled={updatingProgress}
              >
                Update Progress (+25%)
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