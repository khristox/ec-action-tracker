// src/components/actiontracker/meetings/MeetingActionsList.jsx

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Fade,
  Grow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  useTheme,
  alpha,
  Card,
  CardContent,
  useMediaQuery,
  Badge,
  LinearProgress,
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
  Star as StarIcon,
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

const canEditActions = () => {
  return true;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'EEE, dd-MMM-yyyy');
  } catch {
    return 'Invalid date';
  }
};

const getInitials = (name) => {
  if (!name || name === 'Unassigned') return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.[0]?.toUpperCase() || '?';
};

// Map priority values (1: High, 2: Medium, 3: Low, 4: Very Low) to configuration labels and visual stars
const getPriorityConfig = (priority) => {
  switch (Number(priority)) {
    case 1:
      return { label: 'High', stars: 3, color: 'error' };
    case 2:
      return { label: 'Medium', stars: 2, color: 'warning' };
    case 3:
      return { label: 'Low', stars: 1, color: 'success' };
    case 4:
    default:
      return { label: 'Very Low', stars: 0, color: 'default' };
  }
};

// ==================== STATUS DISPLAY COMPONENT ====================
const ActionStatusChip = ({ action, statusOptions, isDarkMode }) => {
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const isCompleted = action.completed_at || action.overall_progress_percentage >= 100;

  // If completed, show completed status
  if (isCompleted) {
    return (
      <Chip
        size="small"
        label="Completed"
        color="success"
        sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }}
      />
    );
  }

  // Find the status from options
  const status = statusOptions.find(s => s.id === action.overall_status_id);
  
  let statusLabel = status?.label || status?.name?.replace('Action Status - ', '') || 'Pending';
  let statusColor = status?.color || '#F59E0B';
  
  // If overdue, show overdue status (even if status says something else)
  if (isOverdue) {
    return (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Chip
          size="small"
          label="Overdue"
          icon={<WarningIcon sx={{ fontSize: 14 }} />}
          sx={{ 
            height: 20, 
            fontSize: '0.6rem', 
            fontWeight: 700,
            bgcolor: alpha('#EF4444', 0.15),
            color: '#EF4444',
            '& .MuiChip-icon': { color: '#EF4444', fontSize: 14 }
          }}
        />
        {/* Show original status as secondary chip */}
        <Chip
          size="small"
          label={statusLabel}
          sx={{ 
            height: 18, 
            fontSize: '0.5rem', 
            fontWeight: 500,
            bgcolor: alpha(statusColor, 0.1),
            color: statusColor,
            opacity: 0.7,
            '& .MuiChip-label': { px: 0.8 }
          }}
        />
      </Stack>
    );
  }

  // Regular status (not overdue, not completed)
  return (
    <Chip
      size="small"
      label={statusLabel}
      sx={{ 
        height: 20, 
        fontSize: '0.6rem', 
        fontWeight: 600,
        bgcolor: alpha(statusColor, 0.12),
        color: statusColor,
      }}
    />
  );
};

// ==================== MINIMAL PROGRESS COMPONENT ====================
const MinimalProgress = ({ percentage }) => {
  const clamped = Math.min(Math.max(percentage || 0, 0), 100);
  const isComplete = clamped >= 100;
  
  return (
    <Tooltip title={`${clamped}% complete`} placement="top">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 60 }}>
        <LinearProgress
          variant="determinate"
          value={clamped}
          sx={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            bgcolor: alpha('#6B7280', 0.15),
            '& .MuiLinearProgress-bar': {
              borderRadius: 2,
              bgcolor: isComplete ? '#10B981' : clamped > 50 ? '#3B82F6' : '#F59E0B',
            }
          }}
        />
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{
            fontSize: '0.6rem',
            color: isComplete ? '#10B981' : 'text.secondary',
            minWidth: 28,
            textAlign: 'right',
          }}
        >
          {clamped}%
        </Typography>
      </Box>
    </Tooltip>
  );
};

// ==================== MAIN COMPONENT ====================

const MeetingActionsList = ({ meetingId, meetingStatus, onRefresh }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ==================== REDUX SELECTORS ====================
  const minutesList = useSelector(selectMeetingMinutes);
  const statusOptions = useSelector(selectActionStatusOptions);
  const statusOptionsError = useSelector(selectActionTrackerError);
  const { updatingProgress } = useSelector((state) => state.actions || {});

  // ==================== REFS ====================
  const isMountedRef = useRef(true);
  const fetchTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false);
  const previousMinutesStringRef = useRef('');

  // ==================== LOCAL STATE ====================
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingAction, setEditingAction] = useState(null);
  const [loadingActionId, setLoadingActionId] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const progressFormRef = useRef(null);

  // ==================== COMPUTED VALUES ====================
  const canEdit = useMemo(() => canEditActions(meetingStatus), [meetingStatus]);
  const hasNoMinutes = minutesList.length === 0 && !loading;
  const statusMessage = useMemo(() => getStatusMessage(meetingStatus), [meetingStatus]);

  const tagSuggestions = useMemo(() => {
    const set = new Set();
    actions.forEach(a => {
      if (Array.isArray(a.tags)) {
        a.tags.forEach(t => { if (t) set.add(t); });
      }
    });
    return Array.from(set).sort();
  }, [actions]);

  // ==================== HELPER FUNCTIONS ====================

  function getStatusMessage(status) {
    if (!status) return null;
    const statusLower = String(status).toLowerCase();
    if (statusLower === 'cancelled') {
      return "Meeting has been cancelled. Actions cannot be created or edited.";
    }
    return null;
  }

  const getStatusConfig = useCallback((action) => {
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
  }, [statusOptions, isDarkMode]);

  const getImplementersNames = useCallback((action) => {
    if (action.persons_implementing && action.persons_implementing.length > 0) {
      const names = action.persons_implementing.map(p => {
        if (p.name && p.name !== 'Unassigned') return p.name;
        if (p.full_name) return p.full_name;
        if (p.email) return p.email;
        return null;
      }).filter(Boolean);

      if (names.length > 0) return names.join(', ');
    }
    if (action.assigned_to?.full_name) return action.assigned_to.full_name;
    if (action.assigned_to?.username) return action.assigned_to.username;
    if (typeof action.assigned_to_name === 'string' && action.assigned_to_name !== 'Unassigned') return action.assigned_to_name;
    if (action.assigned_to_name && typeof action.assigned_to_name === 'object') {
      return action.assigned_to_name.name || action.assigned_to_name.email || 'Unassigned';
    }
    return 'Unassigned';
  }, []);

  const getImplementersList = useCallback((action) => {
    if (action.persons_implementing && action.persons_implementing.length > 0) {
      return action.persons_implementing.map(p => ({
        ...p,
        name: (p.name && p.name !== 'Unassigned') ? p.name : (p.full_name || p.email || 'Unassigned')
      }));
    }
    if (action.assigned_to || action.assigned_to_name) {
      return [{
        name: getImplementersNames(action),
        email: action.assigned_to?.email || action.assigned_to_name?.email,
        phone: action.assigned_to?.phone || action.assigned_to_name?.phone,
        user_id: action.assigned_to?.id || action.assigned_to_id,
      }];
    }
    return [];
  }, [getImplementersNames]);

  // ==================== API CALLS ====================

  const fetchMinutes = useCallback(() => {
    if (!meetingId || !isMountedRef.current || isFetchingRef.current) {
      return Promise.resolve();
    }

    isFetchingRef.current = true;
    return dispatch(fetchMeetingMinutes(meetingId))
      .finally(() => {
        isFetchingRef.current = false;
      });
  }, [dispatch, meetingId]);

  const fetchAttributes = useCallback(() => {
    if (!isMountedRef.current) return;
    dispatch(fetchActionTrackerAttributes());
  }, [dispatch]);

  // ==================== EXTRACT ACTIONS ====================
  const extractActionsFromMinutes = useCallback(() => {
    if (!isMountedRef.current || !minutesList) return;

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

  useEffect(() => {
    if (!meetingId) return;

    let isActive = true;
    isMountedRef.current = true;
    previousMinutesStringRef.current = '';

    const fetchData = async () => {
      if (!isActive) return;
      setLoading(true);
      try {
        await fetchMinutes();
        await fetchAttributes();
      } catch (error) {
        console.error('Error fetching data:', error);
        if (isActive && isMountedRef.current) {
          setError('Failed to load meeting data');
        }
      } finally {
        if (isActive && isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      if (isActive) {
        fetchData();
      }
    }, 100);

    return () => {
      isActive = false;
      isMountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [meetingId, fetchMinutes, fetchAttributes]);

  useEffect(() => {
    if (minutesList && isMountedRef.current) {
      extractActionsFromMinutes();
    }
  }, [minutesList, extractActionsFromMinutes]);

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

  // ==================== EVENT HANDLERS ====================

  const handleRefresh = useCallback(() => {
    if (!isMountedRef.current || isFetchingRef.current) return;

    setLoading(true);
    previousMinutesStringRef.current = '';
    fetchMinutes()
      .finally(() => {
        if (isMountedRef.current) {
          setLoading(false);
        }
      });
    if (onRefresh) onRefresh();
  }, [fetchMinutes, onRefresh]);

  const handleViewAction = useCallback((actionId) => {
    navigate(`/actions/${actionId}`);
  }, [navigate]);

  const handleEditAction = useCallback(async (action) => {
    if (!isMountedRef.current) return;

    setLoadingActionId(action.id);
    let fullAction = action;

    try {
      const res = await api.get(`/action-tracker/actions/${action.id}`);
      if (res?.data) {
        fullAction = { ...action, ...res.data };
      }
    } catch (err) {
      console.error('Could not fetch full action detail, using list data:', err);
    }

    if (isMountedRef.current) {
      setEditingAction(fullAction);
      setShowEditDialog(true);
      setLoadingActionId(null);
    }
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

  const handleRefreshAfterAction = useCallback(() => {
    if (!isMountedRef.current) return;
    previousMinutesStringRef.current = '';
    fetchMinutes();
  }, [fetchMinutes]);

  const handleEditSave = useCallback(() => {
    handleRefreshAfterAction();
    setSuccessMessage('Action updated successfully!');
  }, [handleRefreshAfterAction]);

  const handleAssignSave = useCallback(() => {
    handleRefreshAfterAction();
    setSuccessMessage('Action assigned successfully!');
  }, [handleRefreshAfterAction]);

  const handleActionCreated = useCallback(() => {
    handleRefreshAfterAction();
    if (onRefresh) onRefresh();
    setSuccessMessage('Action created successfully!');
  }, [handleRefreshAfterAction, onRefresh]);

  const handleOpenProgressDialog = useCallback((action) => {
    if (!isMountedRef.current) return;
    setSelectedAction(action);
    setShowProgressDialog(true);
  }, []);

  const handleProgressUpdateComplete = useCallback(() => {
    if (!isMountedRef.current) return;
    handleRefreshAfterAction();
    if (onRefresh) onRefresh();
    setSuccessMessage('Progress updated successfully!');
    setShowProgressDialog(false);
  }, [handleRefreshAfterAction, onRefresh]);

  const handleActionCreate = useCallback(async (payload) => {
    if (!isMountedRef.current || !meetingId) return;

    if (isFetchingRef.current) return;

    try {
      let minuteId = payload.minute_id;
      if (!minuteId && minutesList && minutesList.length > 0) {
        minuteId = minutesList[0]?.id;
      }

      if (!minuteId) {
        const response = await api.post(`/action-tracker/meetings/${meetingId}/minutes`, {
          title: 'General',
          content: '',
        });
        minuteId = response.data?.id;
        if (!minuteId) {
          throw new Error('Failed to create default minute');
        }
        await fetchMinutes();
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
  }, [meetingId, minutesList, fetchMinutes, handleActionCreated]);

  const handleActionUpdate = useCallback(async (payload) => {
    if (!isMountedRef.current || !editingAction?.id) return;

    try {
      const response = await api.put(
        `/action-tracker/actions/${editingAction.id}`,
        {
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
          minute_id: payload.minute_id || editingAction.minute_id || null,
          persons_implementing: payload.persons_implementing || []
        }
      );

      handleEditSave();
      return response.data;
    } catch (err) {
      console.error('Error updating action:', err);
      const errorMessage = extractErrorMessage(err);
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw err;
    }
  }, [editingAction, handleEditSave]);

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
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 3 }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
            Action Items ({actions.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Add new action item">
              <span>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setShowAddDialog(true)}
                  size="small"
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
                disabled={loading || isFetchingRef.current}
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
                Use "Add Action" above to create your first one — we'll set up the meeting minutes for you automatically.
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
        ) : isMobile ? (
          /* ==================== MOBILE CARD LAYOUT ==================== */
          <Stack spacing={2}>
            {actions.map((action, index) => {
              const statusConfig = getStatusConfig(action);
              const implementers = getImplementersList(action);
              const implementerNames = getImplementersNames(action);
              const priorityConfig = getPriorityConfig(action.priority);
              const progress = action.overall_progress_percentage || 0;

              return (
                <Card
                  key={action.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    bgcolor: isDarkMode ? '#1F2937' : 'background.paper',
                    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    {/* Top Row: Index and Status */}
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 1.5 }}
                    >
                      <Typography variant="caption" fontWeight={600} sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                        #{index + 1} • {action.meeting_title || action.minutes?.meeting?.title || 'Meeting Committee'}
                      </Typography>
                      <ActionStatusChip 
                        action={action} 
                        statusOptions={statusOptions} 
                        isDarkMode={isDarkMode} 
                      />
                    </Stack>

                    {/* Action Title / Description */}
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : 'text.primary', mb: 1 }}>
                      {action.description}
                    </Typography>

                    {/* Issue / Challenge */}
                    {action.issue_challenge && (
                      <Box sx={{ mb: 1.5, p: 1, borderRadius: 1, bgcolor: isDarkMode ? alpha('#FFFFFF', 0.03) : alpha('#000000', 0.02) }}>
                        <Typography variant="caption" fontWeight={600} display="block" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                          Issue/Challenge:
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: isDarkMode ? '#D1D5DB' : 'text.primary' }}>
                          {action.issue_challenge}
                        </Typography>
                      </Box>
                    )}

                    {/* Details Grid */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 1,
                        mb: 1.5,
                        fontSize: '0.75rem',
                      }}
                    >
                      <Box>
                        <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', display: 'block' }}>
                          Date Initiated
                        </Typography>
                        <Typography variant="body2" fontWeight={500} sx={{ color: isDarkMode ? '#D1D5DB' : 'text.primary' }}>
                          {formatDate(action.date_initiated || action.created_at)}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', display: 'block' }}>
                          Expected Resolution
                        </Typography>
                        <Typography variant="body2" fontWeight={500} sx={{ color: isDarkMode ? '#D1D5DB' : 'text.primary' }}>
                          {formatDate(action.due_date)}
                        </Typography>
                      </Box>

                      {/* Person(s) Implementing with Badge for count > 1 — spans full width */}
                      <Box sx={{ gridColumn: '1 / -1', mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', display: 'block' }}>
                          Person(s) field
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                          <Badge
                            badgeContent={implementers.length > 1 ? implementers.length : null}
                            color="primary"
                            sx={{
                              '& .MuiBadge-badge': {
                                fontSize: '0.65rem',
                                height: 16,
                                minWidth: 16,
                              }
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 26,
                                height: 26,
                                bgcolor: isDarkMode ? alpha('#7C3AED', 0.3) : 'primary.light',
                                fontSize: '0.7rem',
                                color: isDarkMode ? '#A78BFA' : 'primary.contrastText'
                              }}
                            >
                              {getInitials(implementers[0]?.name)}
                            </Avatar>
                          </Badge>
                          <Typography variant="body2" fontWeight={500} sx={{ color: isDarkMode ? '#D1D5DB' : 'text.primary' }}>
                            {implementerNames}
                          </Typography>
                        </Stack>
                      </Box>

                      {action.remarks && (
                        <Box sx={{ gridColumn: '1 / -1', mt: 0.5 }}>
                          <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', display: 'block' }}>
                            Latest Update
                          </Typography>
                          <Typography variant="body2" sx={{ color: isDarkMode ? '#D1D5DB' : 'text.primary' }}>
                            {action.remarks}
                          </Typography>
                        </Box>
                      )}

                      {/* ✅ PROGRESS - Added for mobile view */}
                      <Box sx={{ gridColumn: '1 / -1', mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', display: 'block' }}>
                          Progress
                        </Typography>
                        <MinimalProgress percentage={progress} />
                      </Box>
                    </Box>

                    {/* Footer Row: Priority & Actions */}
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{
                        pt: 1,
                        borderTop: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`
                      }}
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                          Priority:
                        </Typography>
                        {priorityConfig.stars > 0 ? (
                          <Stack direction="row" spacing={0.1}>
                            {[...Array(priorityConfig.stars)].map((_, i) => (
                              <StarIcon key={i} sx={{ fontSize: 14, color: '#F59E0B' }} />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="caption" fontWeight={600} color="text.secondary">
                            {priorityConfig.label}
                          </Typography>
                        )}
                      </Stack>

                      {/* Action Tool Buttons */}
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Update Progress">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenProgressDialog(action)}
                              disabled={false}
                              sx={{ color: isDarkMode ? '#60A5FA' : 'primary.main' }}
                            >
                              <TrendingUpIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Edit Action">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleEditAction(action)}
                              disabled={loadingActionId === action.id}
                              sx={{ color: isDarkMode ? '#A78BFA' : 'secondary.main' }}
                            >
                              {loadingActionId === action.id ? <CircularProgress size={14} /> : <EditIcon sx={{ fontSize: 18 }} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Assign User">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleAssignAction(action)}
                              disabled={false}
                              sx={{ color: isDarkMode ? '#34D399' : 'success.main' }}
                            >
                              <PersonAdd sx={{ fontSize: 18 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewAction(action.id)}
                            sx={{ color: isDarkMode ? '#9CA3AF' : 'default' }}
                          >
                            <VisibilityIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        ) : (
          /* ==================== DESKTOP TABLE LAYOUT ==================== */
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              borderRadius: 2,
              bgcolor: isDarkMode ? '#1F2937' : 'background.paper',
              borderColor: isDarkMode ? '#374151' : '#E5E7EB',
              overflowX: 'auto',
            }}
          >
            <Table size="small" sx={{ minWidth: 1000, tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow sx={{ bgcolor: isDarkMode ? alpha('#A78BFA', 0.1) : 'action.hover' }}>
                  <TableCell width="40" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>#</TableCell>
                  <TableCell width="140" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Issue/Challenge</TableCell>
                  <TableCell width="100" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Date Initiated</TableCell>
                  <TableCell width="160" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Action</TableCell>
                  <TableCell width="100" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Due Date</TableCell>
                  <TableCell width="140" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Person(s) Implementing</TableCell>
                  <TableCell width="140" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Latest Update</TableCell>
                  <TableCell width="100" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Date Updated</TableCell>
                  <TableCell width="90" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }} align="center">Priority</TableCell>
                  <TableCell width="120" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }} align="center">Status</TableCell>
                  <TableCell width="100" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }} align="center">Progress</TableCell>
                  <TableCell width="120" sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {actions.map((action, index) => {
                  const statusConfig = getStatusConfig(action);
                  const implementers = getImplementersList(action);
                  const implementerNames = getImplementersNames(action);
                  const priorityConfig = getPriorityConfig(action.priority);
                  const progress = action.overall_progress_percentage || 0;

                  return (
                    <TableRow
                      key={action.id}
                      hover
                      sx={{
                        '&:hover': {
                          bgcolor: isDarkMode ? '#FFFFFF0D' : '#00000005'
                        },
                      }}
                    >
                      <TableCell sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', fontSize: '0.75rem', fontWeight: 500 }}>
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: isDarkMode ? '#D1D5DB' : 'text.primary' }}>
                          {action.issue_challenge || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: isDarkMode ? '#D1D5DB' : 'text.primary', fontSize: '0.75rem' }}>
                        {formatDate(action.date_initiated || action.created_at)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.75rem', color: isDarkMode ? '#FFFFFF' : 'text.primary' }}>
                          {action.description}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: isDarkMode ? '#D1D5DB' : 'text.primary', fontSize: '0.75rem' }}>
                        {formatDate(action.due_date)}
                      </TableCell>

                      {/* Person(s) Implementing with Circular Badge for > 1 */}
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Badge
                            badgeContent={implementers.length > 1 ? implementers.length : null}
                            color="primary"
                            sx={{
                              flexShrink: 0,
                              '& .MuiBadge-badge': {
                                fontSize: '0.65rem',
                                height: 16,
                                minWidth: 16,
                              }
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 26,
                                height: 26,
                                bgcolor: isDarkMode ? alpha('#7C3AED', 0.3) : 'primary.light',
                                fontSize: '0.75rem',
                                color: isDarkMode ? '#A78BFA' : 'primary.contrastText'
                              }}
                            >
                              {getInitials(implementers[0]?.name)}
                            </Avatar>
                          </Badge>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.75rem',
                              color: isDarkMode ? '#D1D5DB' : 'text.primary'
                            }}
                          >
                            {implementerNames}
                          </Typography>
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: isDarkMode ? '#D1D5DB' : 'text.primary' }}>
                          {action.remarks || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: isDarkMode ? '#D1D5DB' : 'text.primary', fontSize: '0.75rem' }}>
                        {formatDate(action.updated_at || action.created_at)}
                      </TableCell>
                      
                      {/* Priority */}
                      <TableCell align="center">
                        {priorityConfig.stars > 0 ? (
                          <Stack direction="row" spacing={0.2} justifyContent="center">
                            {[...Array(priorityConfig.stars)].map((_, i) => (
                              <StarIcon key={i} sx={{ fontSize: 16, color: '#F59E0B' }} />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="caption" fontWeight={600} color="text.secondary">
                            {priorityConfig.label}
                          </Typography>
                        )}
                      </TableCell>
                      
                      {/* Status */}
                      <TableCell align="center">
                        <ActionStatusChip 
                          action={action} 
                          statusOptions={statusOptions} 
                          isDarkMode={isDarkMode} 
                        />
                      </TableCell>
                      
                      {/* Progress */}
                      <TableCell align="center">
                        <MinimalProgress percentage={progress} />
                      </TableCell>
                      
                      {/* Actions */}
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.2} justifyContent="center">
                          <Tooltip title="Update Progress">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenProgressDialog(action)}
                                disabled={false}
                                sx={{ color: isDarkMode ? '#60A5FA' : 'primary.main', '&.Mui-disabled': { opacity: 0.4 } }}
                              >
                                <TrendingUpIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Edit Action">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleEditAction(action)}
                                disabled={loadingActionId === action.id}
                                sx={{ color: isDarkMode ? '#A78BFA' : 'secondary.main', '&.Mui-disabled': { opacity: 0.4 } }}
                              >
                                {loadingActionId === action.id ? <CircularProgress size={14} /> : <EditIcon sx={{ fontSize: 16 }} />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Assign User">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleAssignAction(action)}
                                disabled={false}
                                sx={{ color: isDarkMode ? '#34D399' : 'success.main', '&.Mui-disabled': { opacity: 0.4 } }}
                              >
                                <PersonAdd sx={{ fontSize: 16 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewAction(action.id)}
                              sx={{ color: isDarkMode ? '#9CA3AF' : 'default' }}
                            >
                              <VisibilityIcon sx={{ fontSize: 16 }} />
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

        {/* ==================== DIALOGS ==================== */}

        <AddActionDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={handleActionCreate}
          editingAction={null}
          meetingId={meetingId}
          meetingName={null}
          minutes={minutesList}
          tagSuggestions={tagSuggestions}
          selectedMinuteId={null}
          loading={loading}
          error={error}
          busy={false}
        />

        <AddActionDialog
          open={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setEditingAction(null);
          }}
          onSave={handleActionUpdate}
          editingAction={editingAction}
          meetingId={meetingId}
          meetingName={null}
          minutes={minutesList}
          tagSuggestions={tagSuggestions}
          selectedMinuteId={editingAction?.minute_id || null}
          loading={loading}
          error={error}
          busy={false}
        />

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
            }
          }}
        >
          <DialogTitle sx={{
            pb: 1.5,
            pt: 2.5,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: isDarkMode ? '#FFFFFF' : 'inherit',
          }}>
            <Typography variant="h6" fontWeight={600}>Update Progress</Typography>
            <IconButton onClick={() => setShowProgressDialog(false)} size="small">
              <Close />
            </IconButton>
          </DialogTitle>
          <Divider sx={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }} />
          <DialogContent sx={{ p: 0, overflowY: 'auto', flex: 1 }}>
            <UpdateProgress
              ref={progressFormRef}
              actionId={selectedAction?.id}
              statusOptions={statusOptions}
              onSuccess={handleProgressUpdateComplete}
              onCancel={() => setShowProgressDialog(false)}
              embedded={true}
            />
          </DialogContent>
          <DialogActions sx={{
            p: 2,
            px: 3,
            gap: 1.5,
            borderTop: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
            bgcolor: isDarkMode ? '#1F2937' : '#FAFAFA',
          }}>
            <Button
              onClick={() => setShowProgressDialog(false)}
              variant="outlined"
              sx={{
                borderColor: isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.15)',
                color: isDarkMode ? '#D1D5DB' : 'text.secondary',
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<Save fontSize="small" />}
              onClick={() => progressFormRef.current?.submitForm()}
              sx={{
                bgcolor: isDarkMode ? '#7C3AED' : 'primary.main',
                '&:hover': {
                  bgcolor: isDarkMode ? '#6D28D9' : 'primary.dark',
                },
              }}
            >
              Update Progress
            </Button>
          </DialogActions>
        </Dialog>

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