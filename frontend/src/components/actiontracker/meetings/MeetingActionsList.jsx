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
  alpha,
  Collapse,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Badge,
  Menu,
  MenuItem,
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
  PersonAdd as PersonAdd,
  Add as Add,
  Save as Save,
  Close as Close,
  Lock as LockIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  People as PeopleIcon,
  Label as LabelIcon,
  Flag as FlagIcon,
  Lightbulb as LightbulbIcon,
  MoreVert as MoreVertIcon,
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

import AddActionDialog from './components/AddActionDialog';
import AssignUserDialog from './components/AssignUserDialog';
import UpdateProgress from '../actions/UpdateProgress';

// ==================== HELPER FUNCTIONS ====================

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
    if (data.message) return data.message;
    if (typeof data === 'string') return data;
    return JSON.stringify(data);
  }
  if (error.message) return error.message;
  return 'An unexpected error occurred';
};

const canEditActions = (meetingStatus) => {
  if (!meetingStatus) return false;
  const statusLower = String(meetingStatus).toLowerCase();
  const allowedStatuses = ['started', 'ongoing', 'in_progress', 'in progress', 'completed'];
  return allowedStatuses.some(status => statusLower.includes(status));
};

const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.[0]?.toUpperCase() || '?';
};

// ==================== MAIN COMPONENT ====================

const MeetingActionsList = ({ meetingId, meetingStatus, onRefresh }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // ==================== REDUX SELECTORS ====================
  // ✅ Use the minutes data from Redux (shared with MeetingMinutes)
  const minutesList = useSelector(selectMeetingMinutes);
  const statusOptions = useSelector(selectActionStatusOptions);
  const loadingStatusOptions = useSelector(selectActionTrackerLoading);
  const statusOptionsError = useSelector(selectActionTrackerError);
  const { updatingProgress } = useSelector((state) => state.actions || {});

  // ==================== REFS ====================
  const isMountedRef = useRef(true);
  const previousMinutesStringRef = useRef('');
  const attributesFetchedRef = useRef(false);

  // ==================== LOCAL STATE ====================
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingAction, setEditingAction] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [localUpdating, setLocalUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedActions, setExpandedActions] = useState({});
  const [anchorElMap, setAnchorElMap] = useState({});

  const progressFormRef = useRef(null);

  // ==================== COMPUTED VALUES ====================
  const canEdit = canEditActions(meetingStatus);
  const isUpdating = localUpdating || updatingProgress;
  const hasNoMinutes = minutesList.length === 0 && !loading;
  const statusMessage = getStatusMessage(meetingStatus);

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
    // Check persons_implementing first (new field)
    if (action.persons_implementing && action.persons_implementing.length > 0) {
      const firstPerson = action.persons_implementing[0];
      return firstPerson.name || 'Unassigned';
    }
    
    // Fallback to legacy fields
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

  const getImplementers = (action) => {
    if (action.persons_implementing && action.persons_implementing.length > 0) {
      return action.persons_implementing;
    }
    // Fallback to legacy single assignee
    if (action.assigned_to || action.assigned_to_name) {
      return [{
        name: getAssignedToName(action),
        email: action.assigned_to?.email || action.assigned_to_name?.email,
        phone: action.assigned_to?.phone || action.assigned_to_name?.phone,
        user_id: action.assigned_to?.id || action.assigned_to_id,
      }];
    }
    return [];
  };

  const getPriorityLabel = (priority) => {
    const map = {
      1: { label: 'High', color: '#EF4444' },
      2: { label: 'Medium', color: '#F59E0B' },
      3: { label: 'Low', color: '#10B981' },
      4: { label: 'Very Low', color: '#9CA3AF' },
    };
    return map[priority] || map[2];
  };

  // ==================== EXTRACT ACTIONS FROM MINUTES ====================
  const extractActionsFromMinutes = useCallback(() => {
    if (!isMountedRef.current) return;

    try {
      const actionsData = [];
      (minutesList || []).forEach(minute => {
        if (minute.actions && minute.actions.length > 0) {
          actionsData.push(...minute.actions);
        }
      });
      
      const currentString = JSON.stringify(actionsData);
      
      if (currentString !== previousMinutesStringRef.current) {
        previousMinutesStringRef.current = currentString;
        if (isMountedRef.current) {
          setActions(actionsData);
          setError(null);
        }
      }
    } catch (err) {
      console.error('Error extracting actions:', err);
      if (isMountedRef.current) {
        setError('Failed to load actions');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [minutesList]);

  // ==================== EFFECTS ====================

  // ✅ Effect 1: Fetch attributes only (once), NOT minutes
  // The minutes are already fetched by MeetingMinutes.jsx
  useEffect(() => {
    isMountedRef.current = true;

    // Only fetch attributes if not already fetched
    if (!attributesFetchedRef.current) {
      attributesFetchedRef.current = true;
      dispatch(fetchActionTrackerAttributes());
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [dispatch]);

  // ✅ Effect 2: Extract actions when minutesList changes (shared from Redux)
  useEffect(() => {
    if (minutesList && isMountedRef.current) {
      extractActionsFromMinutes();
    }
  }, [minutesList, extractActionsFromMinutes]);

  // ✅ Effect 3: Handle success messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          setSuccessMessage('');
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // ✅ Effect 4: Log status options errors
  useEffect(() => {
    if (statusOptionsError) {
      console.error('Failed to load status options:', statusOptionsError);
    }
  }, [statusOptionsError]);

  // ==================== EVENT HANDLERS ====================

  const handleRefresh = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // ✅ Refresh minutes data (will be shared with MeetingMinutes)
    dispatch(fetchMeetingMinutes(meetingId));
    
    // Also refresh attributes
    dispatch(fetchActionTrackerAttributes());
    
    if (onRefresh) onRefresh();
  }, [dispatch, meetingId, onRefresh]);

  const handleViewAction = useCallback((actionId) => {
    navigate(`/actions/${actionId}`);
  }, [navigate]);

  const handleEditAction = useCallback((action) => {
    if (!isMountedRef.current) return;
    setEditingAction(action);
    setShowEditDialog(true);
  }, []);

  const handleAssignAction = useCallback((action) => {
    if (!isMountedRef.current) return;
    const meetingIdFromAction = action.minutes?.meeting_id || action.meeting_id;
    setSelectedAction({
      ...action,
      _meetingId: meetingIdFromAction
    });
    setShowAssignDialog(true);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!isMountedRef.current) return;
    // ✅ Refresh minutes data
    dispatch(fetchMeetingMinutes(meetingId));
    setSuccessMessage('Action updated successfully!');
  }, [dispatch, meetingId]);

  const handleAssignSave = useCallback(() => {
    if (!isMountedRef.current) return;
    // ✅ Refresh minutes data
    dispatch(fetchMeetingMinutes(meetingId));
    setSuccessMessage('Action assigned successfully!');
  }, [dispatch, meetingId]);

  const handleActionCreated = useCallback(() => {
    if (!isMountedRef.current) return;
    // ✅ Refresh minutes data
    dispatch(fetchMeetingMinutes(meetingId));
    if (onRefresh) onRefresh();
    setSuccessMessage('Action created successfully!');
  }, [dispatch, meetingId, onRefresh]);

  const handleOpenProgressDialog = useCallback((action) => {
    if (!isMountedRef.current) return;
    setSelectedAction(action);
    setShowProgressDialog(true);
  }, []);

  const handleProgressUpdateComplete = useCallback(() => {
    if (!isMountedRef.current) return;
    // ✅ Refresh minutes data
    dispatch(fetchMeetingMinutes(meetingId));
    if (onRefresh) onRefresh();
    setSuccessMessage('Progress updated successfully!');
    setShowProgressDialog(false);
  }, [dispatch, meetingId, onRefresh]);

  const handleActionCreate = useCallback(async (payload) => {
    if (!isMountedRef.current) return;
    
    try {
      // Get or create a minute
      let minuteId = payload.minute_id;
      if (!minuteId && minutesList && minutesList.length > 0) {
        minuteId = minutesList[0]?.id;
      }
      
      if (!minuteId) {
        // Create a default minute
        const response = await api.post(`/action-tracker/meetings/${meetingId}/minutes`, {
          title: 'General',
          content: '',
        });
        minuteId = response.data?.id;
        if (!minuteId) {
          throw new Error('Failed to create default minute');
        }
        // ✅ Refresh minutes after creating
        dispatch(fetchMeetingMinutes(meetingId));
      }

      const actionResponse = await api.post(
        '/action-tracker/actions/',
        {
          minute_id: minuteId,
          meeting_id: meetingId,
          description: payload.description,
          due_date: payload.due_date || null,
          priority: payload.priority || 2,
          remarks: payload.remarks || null,
          assigned_to_id: payload.assigned_to_id,
          assigned_to_name: payload.assigned_to_name,
          title: payload.title || null,
          issue_challenge: payload.issue_challenge || null,
          type_of_action: payload.type_of_action || null,
          date_initiated: payload.date_initiated || null,
          is_key_action: payload.is_key_action || false,
          tags: payload.tags || [],
          assign_to_meeting_id: payload.assign_to_meeting_id || null,
          persons_implementing: payload.persons_implementing || []
        }
      );

      handleActionCreated();
      return actionResponse.data;
    } catch (err) {
      console.error('Error creating action:', err);
      const errorMessage = extractErrorMessage(err);
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw err;
    }
  }, [meetingId, minutesList, dispatch, handleActionCreated]);

  const toggleExpand = useCallback((actionId) => {
    setExpandedActions(prev => ({
      ...prev,
      [actionId]: !prev[actionId]
    }));
  }, []);

  const handleMenuOpen = useCallback((event, actionId) => {
    setAnchorElMap(prev => ({
      ...prev,
      [actionId]: event.currentTarget
    }));
  }, []);

  const handleMenuClose = useCallback((actionId) => {
    setAnchorElMap(prev => ({
      ...prev,
      [actionId]: null
    }));
  }, []);

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
            Action Items ({actions.length})
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={!canEdit ? (statusMessage || "Meeting must be started to add actions") : "Add new action item"}>
              <span>
                <Button
                  variant="contained"
                  startIcon={!canEdit ? <LockIcon /> : <Add />}
                  onClick={() => setShowAddDialog(true)}
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
          </Box>
        </Box>

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
                  <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Priority</TableCell>
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
                  const implementers = getImplementers(action);
                  const priorityInfo = getPriorityLabel(action.priority);
                  const isExpanded = expandedActions[action.id] || false;
                  const isKeyAction = action.is_key_action || false;

                  return (
                    <React.Fragment key={action.id}>
                      <TableRow hover sx={{
                        '&:hover': { bgcolor: isDarkMode ? alpha('#FFFFFF', 0.05) : alpha('#000000', 0.02) },
                        bgcolor: isKeyAction ? (isDarkMode ? alpha('#F59E0B', 0.05) : alpha('#F59E0B', 0.03)) : 'transparent'
                      }}>
                        <TableCell>
                          <Stack spacing={0.5}>
                            <Typography variant="body2" fontWeight={500} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                              {action.description}
                            </Typography>
                            {/* Show additional info badges */}
                            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                              {action.title && (
                                <Chip
                                  label={action.title}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                              )}
                              {action.type_of_action && (
                                <Chip
                                  label={action.type_of_action}
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                              )}
                              {isKeyAction && (
                                <Chip
                                  label="Key Action"
                                  size="small"
                                  color="warning"
                                  icon={<LightbulbIcon sx={{ fontSize: 12 }} />}
                                  sx={{ height: 20, fontSize: '0.6rem' }}
                                />
                              )}
                              {action.tags && action.tags.length > 0 && (
                                <Chip
                                  label={`+${action.tags.length} tags`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.6rem' }}
                                />
                              )}
                              {action.remarks && (
                                <Tooltip title={action.remarks}>
                                  <Chip
                                    label="Has remarks"
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.6rem' }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {implementers.length > 0 ? (
                              <Badge
                                badgeContent={implementers.length > 1 ? implementers.length : null}
                                color="primary"
                                sx={{
                                  '& .MuiBadge-badge': {
                                    fontSize: '0.6rem',
                                    height: 16,
                                    minWidth: 16,
                                  }
                                }}
                              >
                                <Avatar
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    bgcolor: isDarkMode ? alpha('#A78BFA', 0.2) : 'primary.light',
                                    fontSize: '0.75rem',
                                    color: isDarkMode ? '#A78BFA' : 'primary.contrastText'
                                  }}
                                >
                                  {getInitials(implementers[0]?.name)}
                                </Avatar>
                              </Badge>
                            ) : (
                              <Avatar
                                sx={{
                                  width: 28,
                                  height: 28,
                                  bgcolor: isDarkMode ? alpha('#6B7280', 0.2) : 'grey.300',
                                  fontSize: '0.75rem',
                                  color: isDarkMode ? '#6B7280' : 'grey.600'
                                }}
                              >
                                ?
                              </Avatar>
                            )}
                            <Box>
                              <Typography variant="body2" sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
                                {assignedToName}
                              </Typography>
                              {implementers.length > 1 && (
                                <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                                  +{implementers.length - 1} more
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ScheduleIcon fontSize="small" sx={{ color: isOverdue ? (isDarkMode ? '#F87171' : 'error') : (isDarkMode ? '#6B7280' : 'action') }} />
                            <Typography variant="body2" sx={{ color: isOverdue ? (isDarkMode ? '#F87171' : 'error') : (isDarkMode ? '#D1D5DB' : 'text.primary') }}>
                              {formatDate(action.due_date)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={priorityInfo.label}
                            sx={{
                              height: 24,
                              fontWeight: 600,
                              bgcolor: alpha(priorityInfo.color, 0.15),
                              color: priorityInfo.color,
                              borderColor: alpha(priorityInfo.color, 0.3),
                            }}
                            variant="outlined"
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
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'center' }}>
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
                            <Tooltip title="More Info">
                              <IconButton
                                size="small"
                                onClick={() => toggleExpand(action.id)}
                                sx={{ color: isDarkMode ? '#9CA3AF' : 'default' }}
                              >
                                {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>

                      {/* ==================== EXPANDED ROW ==================== */}
                      <TableRow>
                        <TableCell colSpan={6} sx={{ p: 0, borderBottom: isExpanded ? '1px solid' : 'none', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: isDarkMode ? alpha('#FFFFFF', 0.02) : alpha('#000000', 0.02) }}>
                              <Stack spacing={2}>
                                {/* New Fields Display */}
                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                                  {action.title && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <LabelIcon fontSize="small" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }} />
                                      <Typography variant="caption" fontWeight={600}>Title:</Typography>
                                      <Typography variant="caption">{action.title}</Typography>
                                    </Box>
                                  )}
                                  {action.type_of_action && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <FlagIcon fontSize="small" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }} />
                                      <Typography variant="caption" fontWeight={600}>Type:</Typography>
                                      <Typography variant="caption">{action.type_of_action}</Typography>
                                    </Box>
                                  )}
                                  {action.date_initiated && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <ScheduleIcon fontSize="small" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }} />
                                      <Typography variant="caption" fontWeight={600}>Initiated:</Typography>
                                      <Typography variant="caption">{formatDate(action.date_initiated)}</Typography>
                                    </Box>
                                  )}
                                </Box>

                                {/* Issue/Challenge */}
                                {action.issue_challenge && (
                                  <Box>
                                    <Typography variant="caption" fontWeight={600} sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                                      Issue / Challenge:
                                    </Typography>
                                    <Typography variant="body2" sx={{ mt: 0.5, color: isDarkMode ? '#D1D5DB' : 'text.primary' }}>
                                      {action.issue_challenge}
                                    </Typography>
                                  </Box>
                                )}

                                {/* Remarks */}
                                {action.remarks && (
                                  <Box>
                                    <Typography variant="caption" fontWeight={600} sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                                      Remarks:
                                    </Typography>
                                    <Typography variant="body2" sx={{ mt: 0.5, color: isDarkMode ? '#D1D5DB' : 'text.primary' }}>
                                      {action.remarks}
                                    </Typography>
                                  </Box>
                                )}

                                {/* Implementers List */}
                                {implementers.length > 1 && (
                                  <Box>
                                    <Typography variant="caption" fontWeight={600} sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                                      All Implementers:
                                    </Typography>
                                    <List dense sx={{ mt: 0.5 }}>
                                      {implementers.map((person, idx) => (
                                        <ListItem key={idx} sx={{ px: 0, py: 0.5 }}>
                                          <ListItemAvatar sx={{ minWidth: 32 }}>
                                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.65rem' }}>
                                              {getInitials(person.name)}
                                            </Avatar>
                                          </ListItemAvatar>
                                          <ListItemText
                                            primary={person.name}
                                            secondary={
                                              <Box component="span" sx={{ display: 'flex', gap: 1 }}>
                                                {person.email && <Typography variant="caption">{person.email}</Typography>}
                                                {person.phone && <Typography variant="caption">{person.phone}</Typography>}
                                              </Box>
                                            }
                                            primaryTypographyProps={{ variant: 'caption', fontWeight: 500 }}
                                            secondaryTypographyProps={{ variant: 'caption', component: 'span' }}
                                          />
                                        </ListItem>
                                      ))}
                                    </List>
                                  </Box>
                                )}

                                {/* Tags */}
                                {action.tags && action.tags.length > 0 && (
                                  <Box>
                                    <Typography variant="caption" fontWeight={600} sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                                      Tags:
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                                      {action.tags.map((tag, idx) => (
                                        <Chip
                                          key={idx}
                                          label={tag}
                                          size="small"
                                          variant="outlined"
                                          sx={{ height: 20, fontSize: '0.6rem' }}
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                )}
                              </Stack>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* ==================== DIALOGS ==================== */}

        {/* Add Action Dialog */}
        <AddActionDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={handleActionCreate}
          editingAction={null}
          meetingId={meetingId}
          meetingName={null}
          minutes={minutesList}
          selectedMinuteId={null}
          loading={loading}
          error={error}
          busy={false}
        />

        {/* Edit Action Dialog */}
        <AddActionDialog
          open={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setEditingAction(null);
          }}
          onSave={handleActionCreate}
          editingAction={editingAction}
          meetingId={meetingId}
          meetingName={null}
          minutes={minutesList}
          selectedMinuteId={editingAction?.minute_id || null}
          loading={loading}
          error={error}
          busy={false}
        />

        {/* Progress Dialog */}
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