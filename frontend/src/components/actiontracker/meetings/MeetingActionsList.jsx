// src/components/actiontracker/meetings/MeetingActionsList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper, Typography, Box, Stack, Button, IconButton,
  Chip, Alert, CircularProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  Avatar, Tooltip, LinearProgress, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select
} from '@mui/material';
import {
  Edit as EditIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  Flag as FlagIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../../../services/api';

const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  return format(new Date(dateString), 'MMM d, yyyy');
};

const getStatusConfig = (action) => {
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const isCompleted = action.completed_at || action.overall_progress_percentage >= 100;
  
  if (isCompleted) return { label: 'Completed', color: 'success', icon: <CheckCircleIcon fontSize="small" /> };
  if (isOverdue) return { label: 'Overdue', color: 'error', icon: <WarningIcon fontSize="small" /> };
  if (action.overall_status_name === 'in_progress') return { label: 'In Progress', color: 'info', icon: <PendingIcon fontSize="small" /> };
  return { label: 'Pending', color: 'warning', icon: <ScheduleIcon fontSize="small" /> };
};

const MeetingActionsList = ({ meetingId, onRefresh }) => {
  const navigate = useNavigate();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [updatingProgress, setUpdatingProgress] = useState(false);

  const fetchActions = useCallback(async () => {
    if (!meetingId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/actions`);
      const actionsData = response.data?.items || response.data || [];
      setActions(actionsData);
    } catch (err) {
      console.error('Error fetching actions:', err);
      setError(err.response?.data?.detail || 'Failed to load actions');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions, meetingId]);

  const handleRefresh = () => {
    fetchActions();
    if (onRefresh) onRefresh();
  };

  const handleEditAction = (actionId) => {
    navigate(`/actions/edit/${actionId}`);
  };

  const handleProgressUpdate = async () => {
    if (!selectedAction) return;
    
    setUpdatingProgress(true);
    try {
      await api.patch(`/action-tracker/actions/${selectedAction.id}/progress`, {
        progress_percentage: progressValue
      });
      setShowProgressDialog(false);
      fetchActions();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error updating progress:', err);
      setError(err.response?.data?.detail || 'Failed to update progress');
    } finally {
      setUpdatingProgress(false);
    }
  };

  const handleMenuOpen = (event, action) => {
    setAnchorEl(event.currentTarget);
    setSelectedAction(action);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAction(null);
  };

  const handleOpenProgressDialog = () => {
    if (selectedAction) {
      setProgressValue(selectedAction.overall_progress_percentage || 0);
      setShowProgressDialog(true);
      handleMenuClose();
    }
  };

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
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <AssignmentIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
        <Typography variant="body1" color="text.secondary" gutterBottom>
          No action items found for this meeting.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Actions can be added from the Minutes tab.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={700}>
          Action Items ({actions.length})
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
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
              const assignedToName = action.assigned_to?.full_name || action.assigned_to_name || 'Unassigned';
              
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
                      sx={{ height: 26, fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    <Stack spacing={0.5}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" fontWeight={500}>
                          {action.overall_progress_percentage || 0}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={action.overall_progress_percentage || 0}
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
                    <IconButton size="small" onClick={() => handleEditAction(action.id)} color="primary">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, action)}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 180 } }}
      >
        <MenuItem onClick={handleOpenProgressDialog}>
          Update Progress
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedAction) handleEditAction(selectedAction.id);
          handleMenuClose();
        }}>
          Edit Action
        </MenuItem>
      </Menu>

      {/* Progress Update Dialog */}
      <Dialog open={showProgressDialog} onClose={() => setShowProgressDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Progress</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedAction?.description}
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Progress (%)</InputLabel>
              <Select
                value={progressValue}
                label="Progress (%)"
                onChange={(e) => setProgressValue(e.target.value)}
              >
                <MenuItem value={0}>0% - Not Started</MenuItem>
                <MenuItem value={25}>25% - Quarter Done</MenuItem>
                <MenuItem value={50}>50% - Half Done</MenuItem>
                <MenuItem value={75}>75% - Almost Done</MenuItem>
                <MenuItem value={100}>100% - Completed</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProgressDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleProgressUpdate}
            disabled={updatingProgress}
          >
            {updatingProgress ? <CircularProgress size={24} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MeetingActionsList;