// src/components/actiontracker/meetings/MeetingActionsList.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  TableCell,
  TableBody,
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
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Edit as Edit,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon,
  PersonAdd as PersonAdd,
  Add as Add,
  Save as Save,
  Close as Close,
  Lock as LockIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
  fetchMeetingMinutes,
  selectMeetingMinutes,
  fetchActionTrackerAttributes,
  selectActionStatusOptions,
  selectActionTrackerLoading,
  selectActionTrackerError
} from '../../../store/slices/actionTracker/meetingSlice';
import api from '../../../services/api';

import EditActionDialog from './components/EditActionDialog';
import AssignUserDialog from './components/AssignUserDialog';
import AddActionDialog from './components/AddActionDialog';
import UpdateProgress from '../actions/UpdateProgress';

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract error message from various error formats
 * Handles Pydantic validation errors, FastAPI errors, and generic errors
 */
const extractErrorMessage = (error) => {
  if (error.response?.data) {
    const data = error.response.data;

    if (Array.isArray(data)) {
      return data.map(e => {
        if (e.msg) return e.msg;
        if (e.message) return e.message;
        return JSON.stringify(e);
      }).join(', ');
    }

    if (data.detail) {
      if (Array.isArray(data.detail)) {
        return data.detail.map(e => e.msg || e.message || e).join(', ');
      }
      return data.detail;
    }

    if (data.message) {
      return data.message;
    }

    if (typeof data === 'string') {
      return data;
    }

    return JSON.stringify(data);
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred';
};

/**
 * Check if meeting allows editing actions based on its status
 */
const canEditActions = (meetingStatus) => {
  if (!meetingStatus) return false;
  const statusLower = String(meetingStatus).toLowerCase();
  const allowedStatuses = ['started', 'ongoing', 'in_progress', 'in progress', 'completed'];
  return allowedStatuses.some(status => statusLower.includes(status));
};

/**
 * Format date string to readable format
 */
const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
};

// ==================== MAIN COMPONENT ====================

const MeetingActionsList = ({ meetingId, meetingStatus, onRefresh }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // ==================== REDUX SELECTORS ====================
  const minutesList = useSelector(selectMeetingMinutes);
  const statusOptions = useSelector(selectActionStatusOptions);
  const loadingStatusOptions = useSelector(selectActionTrackerLoading);
  const statusOptionsError = useSelector(selectActionTrackerError);
  const { updatingProgress } = useSelector((state) => state.actions || {});

  // ==================== LOCAL STATE ====================
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAddActionDialog, setShowAddActionDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [localUpdating, setLocalUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [creatingDefaultMinute, setCreatingDefaultMinute] = useState(false);

  // Ref into UpdateProgress's imperative API (submitForm / isLoading),
  // so this dialog's own button row can drive the child form directly
  // instead of relying on document.querySelector('form').
  const progressFormRef = useRef(null);

  // ==================== COMPUTED VALUES ====================
  const canEdit = canEditActions(meetingStatus);
  const isUpdating = localUpdating || updatingProgress;
  const statusMessage = getStatusMessage(meetingStatus);
  const hasNoMinutes = minutesList.length === 0 && !loading;

  // ==================== HELPER FUNCTIONS ====================

  function getStatusMessage(status) {
    if (!status) return null;
    const statusLower = String(status).toLowerCase();
    if (statusLower === 'scheduled' || statusLower === 'pending') {
      return "Meeting hasn't started yet. Actions can only be created and edited once the meeting is in progress.";
    }
    if (statusLower === 'cancelled') {
      return "Meeting has been cancelled. Actions cannot be created or edited.";
    }
    return null;
  }

  const getProgressColor = (value) => {
    if (value >= 100) return isDarkMode ? '#34D399' : 'success.main';
    if (value >= 75) return isDarkMode ? '#A78BFA' : 'secondary.main';
    if (value >= 50) return isDarkMode ? '#FBBF24' : 'warning.main';
    if (value >= 25) return isDarkMode ? '#60A5FA' : 'primary.main';
    return isDarkMode ? '#6B7280' : 'grey.500';
  };

  /**
   * Get status configuration for an action.
   * NOTE: status.short_name from processActionStatusOptions is always
   * lowercased, so the comparison here must be lowercase too.
   */
  const getStatusConfig = (action) => {
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

    const status = statusOptions.find(s => s.id === action.overall_status_id);
    if (status?.short_name === 'in_progress') {
      return {
        label: 'In Progress',
        color: 'info',
        icon: <PendingIcon fontSize="small" />,
        chipSx: isDarkMode ? { bgcolor: alpha('#3B82F6', 0.2), color: '#60A5FA' } : {}
      };
    }

    return {
      label: status?.label || status?.name?.replace('Action Status - ', '') || 'Pending',
      color: 'warning',
      icon: <ScheduleIcon fontSize="small" />,
      chipSx: isDarkMode ? { bgcolor: alpha('#F59E0B', 0.2), color: '#FBBF24' } : {}
    };
  };

  const getAssignedToName = (action) => {
    if (action.assigned_to?.full_name) {
      return action.assigned_to.full_name;
    }
    if (action.assigned_to?.username) {
      return action.assigned_to.username;
    }
    if (typeof action.assigned_to_name === 'string') {
      return action.assigned_to_name;
    }
    if (action.assigned_to_name && typeof action.assigned_to_name === 'object') {
      return action.assigned_to_name.name || action.assigned_to_name.email || 'Unassigned';
    }
    return 'Unassigned';
  };

  // ==================== API CALLS ====================

  const fetchMinutes = useCallback(() => {
    if (meetingId) {
      return dispatch(fetchMeetingMinutes(meetingId));
    }
    return Promise.resolve();
  }, [dispatch, meetingId]);

  const fetchAttributes = useCallback(() => {
    dispatch(fetchActionTrackerAttributes());
  }, [dispatch]);

  const ensureDefaultMinute = useCallback(async () => {
    if (minutesList && minutesList.length > 0) {
      return minutesList[0].id;
    }

    setCreatingDefaultMinute(true);
    try {
      const response = await api.post(`/action-tracker/meetings/${meetingId}/minutes`, {
        title: 'General',
        content: '',
      });
      const newMinuteId = response.data?.id;
      if (!newMinuteId) {
        throw new Error('Minute was created but no id was returned');
      }
      await fetchMinutes();
      return newMinuteId;
    } finally {
      setCreatingDefaultMinute(false);
    }
  }, [meetingId, minutesList, fetchMinutes]);

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

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (meetingId) {
      fetchMinutes();
      fetchAttributes();
    }
  }, [fetchMinutes, fetchAttributes, meetingId]);

  useEffect(() => {
    extractActionsFromMinutes();
  }, [minutesList, extractActionsFromMinutes]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (statusOptionsError) {
      console.error('Failed to load status options:', statusOptionsError);
    }
  }, [statusOptionsError]);

  // ==================== EVENT HANDLERS ====================

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

  const handleOpenProgressDialog = (action) => {
    setSelectedAction(action);
    setShowProgressDialog(true);
  };

  const handleProgressUpdateComplete = () => {
    fetchMinutes();
    if (onRefresh) onRefresh();
    setSuccessMessage('Progress updated successfully!');
    setShowProgressDialog(false);
  };

  const handleActionCreate = async (payload) => {
    try {
      const minuteId = payload.minute_id || await ensureDefaultMinute();

      const response = await api.post(
        '/action-tracker/actions/',
        {
          minute_id: minuteId,
          meeting_id: meetingId,
          description: payload.description,
          due_date: payload.due_date || null,
          priority: payload.priority || 2,
          remarks: payload.remarks || null,
          assigned_to_id: payload.assigned_to_id,
          assigned_to_name: payload.assigned_to_name
        }
      );

      handleActionCreated();
      return response.data;
    } catch (err) {
      console.error('Error creating action:', err);
      const errorMessage = extractErrorMessage(err);
      setError(errorMessage);
      throw err;
    }
  };

  // ==================== RENDER ====================

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

  return (
    <Fade in timeout={500}>
      <Box>
        {/* ==================== HEADER ==================== */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
            Action Items ({actions.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title={!canEdit ? (statusMessage || "Meeting must be started to add actions") : "Add new action item"}>
              <span>
                <Button
                  variant="contained"
                  startIcon={!canEdit ? <LockIcon /> : <Add />}
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

        {/* ==================== STATUS MESSAGES ==================== */}
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
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </Alert>
        )}

        {/* ==================== NO ACTIONS STATE ==================== */}
        {hasNoMinutes ? (
          <Grow in timeout={500}>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <AssignmentIcon sx={{ fontSize: 64, color: isDarkMode ? '#6B7280' : 'action.disabled', mb: 2 }} />
              <Typography variant="body1" sx={{ color: isDarkMode ? '#D1D5DB' : 'text.secondary' }} gutterBottom>
                No action items found for this meeting.
              </Typography>
              <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', mb: 2 }}>
                {canEdit
                  ? "Use \"Add Action\" above to create your first one — we'll set up the meeting minutes for you automatically."
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
        ) : (
          // ==================== ACTIONS TABLE ====================
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
                  const statusConfig = getStatusConfig(action);
                  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
                  const assignedToName = getAssignedToName(action);
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
                                <Edit fontSize="small" />
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
                                <PersonAdd fontSize="small" />
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
        )}

        {/* ==================== ADD ACTION DIALOG ==================== */}
        <AddActionDialog
          open={showAddActionDialog}
          onClose={() => setShowAddActionDialog(false)}
          meetingId={meetingId}
          minutes={minutesList}
          selectedMinuteId={null}
          busy={creatingDefaultMinute}
          onSave={handleActionCreate}
          loading={loading}
          error={error}
        />

        {/* ==================== PROGRESS UPDATE DIALOG ====================
             Single button row lives here (DialogActions). UpdateProgress
             renders no buttons of its own while embedded; this dialog's
             "Update Progress" button drives submission via
             progressFormRef.current.submitForm(). */}
        <Dialog
          open={showProgressDialog}
          onClose={() => setShowProgressDialog(false)}
          fullWidth
          maxWidth="md"
          PaperProps={{
            sx: {
              bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
              borderRadius: 3,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              m: 1,
              boxShadow: isDarkMode
                ? '0 20px 60px rgba(0,0,0,0.6)'
                : '0 20px 60px rgba(0,0,0,0.15)',
            }
          }}
        >
          <DialogTitle sx={{
            pb: 1.5,
            pt: 2.5,
            px: 3,
            color: isDarkMode ? '#FFFFFF' : 'inherit',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Typography variant="h6" fontWeight={600}>
              Update Progress
            </Typography>
            <IconButton
              onClick={() => setShowProgressDialog(false)}
              size="small"
              sx={{
                color: isDarkMode ? '#9CA3AF' : 'text.secondary',
                '&:hover': {
                  bgcolor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04),
                }
              }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <Divider sx={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB', flexShrink: 0 }} />
          <DialogContent
            sx={{
              p: 0,
              overflowY: 'auto',
              flex: 1,
              '&:first-of-type': {
                pt: 0,
              }
            }}
          >
            <UpdateProgress
              ref={progressFormRef}
              actionId={selectedAction?.id}
              statusOptions={statusOptions}
              onSuccess={handleProgressUpdateComplete}
              onCancel={() => setShowProgressDialog(false)}
              embedded={true}
            />
          </DialogContent>
          <DialogActions
            sx={{
              p: 2,
              px: 3,
              flexShrink: 0,
              gap: 1.5,
              borderTop: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
              bgcolor: isDarkMode ? '#1F2937' : '#FAFAFA',
            }}
          >
            <Button
              onClick={() => setShowProgressDialog(false)}
              variant="outlined"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.15)',
                color: isDarkMode ? '#D1D5DB' : 'text.secondary',
                '&:hover': {
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)',
                  bgcolor: isDarkMode ? alpha('#FFFFFF', 0.05) : alpha('#000000', 0.03),
                },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<Save fontSize="small" />}
              onClick={() => progressFormRef.current?.submitForm()}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2,
                px: 3,
                bgcolor: isDarkMode ? '#7C3AED' : 'primary.main',
                boxShadow: isDarkMode ? 'none' : undefined,
                '&:hover': {
                  bgcolor: isDarkMode ? '#6D28D9' : 'primary.dark',
                },
              }}
            >
              Update Progress
            </Button>
          </DialogActions>
        </Dialog>

        {/* ==================== EDIT ACTION DIALOG ==================== */}
        <EditActionDialog
          open={showEditDialog}
          action={selectedAction}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedAction(null);
          }}
          onSave={handleEditSave}
        />

        {/* ==================== ASSIGN USER DIALOG ==================== */}
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