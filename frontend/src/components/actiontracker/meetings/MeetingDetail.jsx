// src/components/meetings/MeetingDetail.jsx
// Complete file with all fixes for 403 Access Denied handling & simplified No Access view

import React, { useState, useEffect, useCallback, useMemo, memo, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Container, Paper, Typography, Stack, Chip, Button, IconButton, Divider, Alert,
  CircularProgress, Tooltip, Tabs, Tab, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, AppBar, Toolbar, useMediaQuery, useTheme, Badge, Snackbar, LinearProgress,
  SpeedDial, SpeedDialAction, SpeedDialIcon, Zoom, ToggleButton, ToggleButtonGroup, alpha
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CancelIcon from '@mui/icons-material/Cancel';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HistoryIcon from '@mui/icons-material/History';
import UpdateIcon from '@mui/icons-material/Update';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ShareIcon from '@mui/icons-material/Share';
import CopyAllIcon from '@mui/icons-material/CopyAll';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CodeIcon from '@mui/icons-material/Code';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import InfoIcon from '@mui/icons-material/Info';
import LockIcon from '@mui/icons-material/Lock';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import BlockIcon from '@mui/icons-material/Block';
import {
  fetchMeetingById, clearMeetingState, updateMeetingStatus, deleteMeeting,
  fetchActionTrackerAttributes, selectCurrentMeeting, selectMeetingsLoading,
  selectMeetingsError, selectMeetingStatusOptions,
} from '../../../store/slices/actionTracker/meetingSlice';
import {
  sendMeetingNotifications, fetchMeetingParticipants, selectNotificationParticipants,
  selectNotificationSending, selectNotificationError, selectLastNotificationResult,
  clearNotificationError, clearLastNotificationResult,
} from '../../../store/slices/actionTracker/notificationSlice';
import { selectUserPermissions, hasPermission } from '../../../store/slices/authSlice';
import api from '../../../services/api';

const MeetingMinutes = lazy(() => import('./MeetingMinutes'));
const MeetingActionsList = lazy(() => import('./MeetingActionsList'));
const MeetingDocuments = lazy(() => import('./MeetingDocuments'));
const MeetingHistory = lazy(() => import('./components/MeetingHistory'));
const MeetingOverviewTab = lazy(() => import('./components/MeetingOverviewTab'));
const ParticipantsTab = lazy(() => import('./components/ParticipantsTab'));
const NotificationDialog = lazy(() => import('./components/NotificationDialog'));
const UpdateMeetingLinkDialog = lazy(() => import('./components/UpdateMeetingLinkDialog'));
const MeetingAudit = lazy(() => import('./MeetingAudit'));
const MeetingRecorder = lazy(() => import('./MeetingRecorder'));

const NOT_FOUND_DELAY_MS = 7000;
const SNACKBAR_AUTO_HIDE_MS = 6000;
const TAB_STORAGE_KEY_PREFIX = 'meeting_detail_last_tab_';
const TAB_ORDER_STORAGE_KEY_PREFIX = 'meeting_detail_tab_order_';
const PINNED_TAB_VALUE = 0;

const DARK = {
  bg: '#0B0B0D', surface: '#161618', surfaceAlt: '#1D1D20',
  border: 'rgba(255,255,255,0.08)', borderStrong: 'rgba(255,255,255,0.14)', textSecondary: '#A3A3AA',
};

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     icon: <ScheduleIcon />,     color: 'warning' },
  started:     { label: 'In Progress', icon: <PendingIcon />,      color: 'info' },
  ongoing:     { label: 'In Progress', icon: <PendingIcon />,      color: 'info' },
  in_progress: { label: 'In Progress', icon: <PendingIcon />,      color: 'info' },
  ended:       { label: 'Ended',       icon: <CheckCircleIcon />,  color: 'success' },
  closed:      { label: 'Closed',      icon: <CheckCircleIcon />,  color: 'success' },
  cancelled:   { label: 'Cancelled',   icon: <CancelIcon />,       color: 'error' },
  awaiting:    { label: 'Awaiting',    icon: <HourglassEmptyIcon />, color: 'warning' },
};

const TABS = [
  { 
    label: 'Overview',     
    icon: <InfoIcon />,               
    value: 0, 
    simple: true, 
    requiresPermission: null,
    minAccessLevel: 'limited'
  },
  { 
    label: 'Minutes',      
    icon: <DescriptionIcon />,        
    value: 1, 
    simple: true, 
    requiresPermission: 'minutes:view',
    minAccessLevel: 'full'
  },
  { 
    label: 'Actions',      
    icon: <AssignmentIcon />,         
    value: 2, 
    simple: true, 
    requiresPermission: 'action:view_own',
    minAccessLevel: 'limited'
  },
  { 
    label: 'Participants', 
    icon: <PeopleIcon />,             
    value: 3, 
    simple: true, 
    requiresPermission: 'participant:view',
    minAccessLevel: 'limited'
  },
  { 
    label: 'Documents',    
    icon: <DescriptionIcon />,        
    value: 4, 
    simple: false, 
    requiresPermission: null,
    minAccessLevel: 'full'
  },
  { 
    label: 'History',      
    icon: <HistoryIcon />,            
    value: 5, 
    simple: false, 
    requiresPermission: null,
    minAccessLevel: 'full'
  },
  { 
    label: 'Audit',        
    icon: <HistoryIcon />,            
    value: 6, 
    simple: false, 
    requiresPermission: 'admin:view_audit',
    minAccessLevel: 'full'
  },
  { 
    label: 'Recordings',   
    icon: <FiberManualRecordIcon />,  
    value: 7, 
    simple: false, 
    requiresPermission: 'meeting:view_recorder',
    minAccessLevel: 'full'
  },
];

const normalizeStatus = (status) => {
  if (!status) return null;
  if (status.short_name) return status;
  if (typeof status === 'string') {
    const s = status.includes('_') ? status.split('_').pop() : status;
    return { short_name: s.toLowerCase(), name: status, code: status, id: null };
  }
  return status;
};

const TabPanel = memo(({ children, value, index, ...other }) => (
  <div role="tabpanel" hidden={value !== index} id={`meeting-tabpanel-${index}`} {...other}>
    {value === index && (
      <Box sx={{ pt: 3 }}>
        <Suspense fallback={<Box sx={{ display: 'flex', py: 6, justifyContent: 'center' }}><CircularProgress size={32} /></Box>}>
          {children}
        </Suspense>
      </Box>
    )}
  </div>
));
TabPanel.displayName = 'TabPanel';

const LoadingTimeout = ({ timeout }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setProgress(Math.min(((Date.now() - startTime) / timeout) * 100, 100));
    }, 150);
    return () => clearInterval(interval);
  }, [timeout]);
  return <LinearProgress variant="determinate" value={progress} sx={{ height: 4, borderRadius: 2, mt: 2 }} />;
};

const ViewModeToggle = memo(({ viewMode, onChange }) => {
  return (
    <ToggleButtonGroup value={viewMode} exclusive onChange={(_, val) => val && onChange(val)} size="small">
      <ToggleButton value="simple" sx={{ gap: 0.6, fontSize: '0.75rem', textTransform: 'none' }}>
        <ViewStreamIcon sx={{ fontSize: 15 }} /> Simple
      </ToggleButton>
      <ToggleButton value="detailed" sx={{ gap: 0.6, fontSize: '0.75rem', textTransform: 'none' }}>
        <ViewAgendaIcon sx={{ fontSize: 15 }} /> Detailed
      </ToggleButton>
    </ToggleButtonGroup>
  );
});
ViewModeToggle.displayName = 'ViewModeToggle';

const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isDarkMode = useTheme().palette.mode === 'dark';
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  const fetchAttemptedRef = useRef(false);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  const currentMeeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingsError);
  const statusOptions = useSelector(selectMeetingStatusOptions);
  const participants = useSelector(selectNotificationParticipants);
  const sendingNotifications = useSelector(selectNotificationSending);
  const notificationError = useSelector(selectNotificationError);
  const lastNotificationResult = useSelector(selectLastNotificationResult);
  const userPermissions = useSelector(selectUserPermissions);
  const currentUser = useSelector((state) => state.auth.user);

  const isAdmin = currentUser?.is_superuser || currentUser?.is_admin || false;
  const canDeleteMeeting = isAdmin || hasPermission(userPermissions, 'meeting:delete');
  const canUpdateMeeting = isAdmin || hasPermission(userPermissions, 'meeting:update');
  const canSendNotifications = hasPermission(userPermissions, 'notification:send') || hasPermission(userPermissions, 'notification:email');
  const canExportReports = isAdmin || hasPermission(userPermissions, 'report:export');
  const canViewAudit = isAdmin || hasPermission(userPermissions, 'admin:view_audit');

  const [tabValue, setTabValue] = useState(() => {
    const saved = localStorage.getItem(`${TAB_STORAGE_KEY_PREFIX}${id}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [tabOrder, setTabOrder] = useState(() => {
    const saved = localStorage.getItem(`${TAB_ORDER_STORAGE_KEY_PREFIX}${id}`);
    return saved ? JSON.parse(saved) : TABS.map((t) => t.value);
  });
  const [draggedTabValue, setDraggedTabValue] = useState(null);
  const [dragOverTabValue, setDragOverTabValue] = useState(null);
  const [isDraggingTab, setIsDraggingTab] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [updateLinkDialogOpen, setUpdateLinkDialogOpen] = useState(false);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [localError, setLocalError] = useState(null);
  const [showNotFound, setShowNotFound] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('simple');
  const [emailNotifications, setEmailNotifications] = useState([]);

  const normalizedMeeting = useMemo(() => currentMeeting ? { ...currentMeeting, status: normalizeStatus(currentMeeting.status) } : null, [currentMeeting]);
  
  const accessLevel = useMemo(() => {
    return normalizedMeeting?.access_level || 'none';
  }, [normalizedMeeting?.access_level]);
  
  const isFullAccess = accessLevel === 'full';
  const isLimitedAccess = accessLevel === 'limited';
  const hasAnyAccess = isFullAccess || isLimitedAccess;

  // Meeting is soft-deleted or inactive - controls should be locked down
  const isDeleted = Boolean(normalizedMeeting?.is_deleted);
  const isInactive = normalizedMeeting?.is_active === false;
  const controlsDisabled = isDeleted || isInactive;
  
  const isOnlineMeeting = useMemo(() => normalizedMeeting?.platform && normalizedMeeting?.platform !== 'physical', [normalizedMeeting]);
  const hasMeetingLink = useMemo(() => normalizedMeeting?.meeting_link, [normalizedMeeting]);
  const participantCount = useMemo(() => participants.length, [participants]);
  const emailSentCount = useMemo(() => emailNotifications.filter((n) => n.status === 'successful').length, [emailNotifications]);

  const getStatusValue = useCallback(() => {
    if (!normalizedMeeting?.status) return '';
    return normalizedMeeting.status.short_name?.toLowerCase() || '';
  }, [normalizedMeeting]);

  const getStatusDisplay = useCallback(() => {
    if (!normalizedMeeting?.status) return 'Unknown';
    const statusValue = normalizedMeeting.status.short_name?.toLowerCase() || '';
    
    const dynamicStatus = statusOptions?.find(s => s.value === statusValue);
    if (dynamicStatus) {
      return dynamicStatus.label || dynamicStatus.short_name || statusValue;
    }
    
    return STATUS_CONFIG[statusValue]?.label || normalizedMeeting.status.short_name || 'Unknown';
  }, [normalizedMeeting, statusOptions]);

  const getStatusColor = useCallback(() => {
    if (!normalizedMeeting?.status) return '#6B7280';
    const statusValue = normalizedMeeting.status.short_name?.toLowerCase() || '';
    
    const dynamicStatus = statusOptions?.find(s => s.value === statusValue);
    if (dynamicStatus && dynamicStatus.color) {
      return dynamicStatus.color;
    }
    
    const defaultConfigColors = {
      warning: '#F59E0B',
      info: '#3B82F6',
      success: '#10B981',
      error: '#EF4444',
    };
    const mappedConfigColor = STATUS_CONFIG[statusValue]?.color;
    return defaultConfigColors[mappedConfigColor] || '#6B7280';
  }, [normalizedMeeting, statusOptions]);

  const getStatusIcon = useCallback(() => {
    if (!normalizedMeeting?.status) return <ScheduleIcon />;
    const statusValue = normalizedMeeting.status.short_name?.toLowerCase() || '';
    
    const dynamicStatus = statusOptions?.find(s => s.value === statusValue);
    if (dynamicStatus) {
      const color = dynamicStatus.color || '#6B7280';
      return <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />;
    }
    
    return STATUS_CONFIG[statusValue]?.icon || <ScheduleIcon />;
  }, [normalizedMeeting, statusOptions]);

  // ==================== DATA FETCHING ====================
  const fetchMeetingData = useCallback(async () => {
    if (!id || !isMountedRef.current) return;
    
    // Reset states
    setShowNotFound(false);
    setShowAccessDenied(false);
    setLocalError(null);
    
    try {
      console.log('📥 Fetching meeting:', id);
      
      let meetingResponse;
      try {
        meetingResponse = await dispatch(fetchMeetingById(id)).unwrap();
        console.log('✅ Meeting fetched:', meetingResponse);
      } catch (fetchErr) {
        console.error('❌ Fetch error:', fetchErr);
        
        // Check for 403 Access Denied
        const is403 = 
          fetchErr?.response?.status === 403 || 
          fetchErr?.status === 403 || 
          fetchErr?.message?.toLowerCase()?.includes('access') ||
          fetchErr?.detail?.toLowerCase()?.includes('access') ||
          fetchErr?.response?.data?.detail?.toLowerCase()?.includes('access');
        
        if (is403) {
          console.warn('🚫 Access Denied (403)');
          setShowAccessDenied(true);
          setInitialLoadComplete(true);
          return;
        }
        
        // Check for 404 Not Found
        if (fetchErr?.response?.status === 404 || fetchErr?.status === 404) {
          setLocalError(`❌ Meeting not found (ID: ${id}). It may have been deleted.`);
          setShowNotFound(true);
          setInitialLoadComplete(true);
          return;
        }
        
        throw fetchErr;
      }
      
      const meetingData = meetingResponse;
      const accessLevel = meetingData?.access_level || 'none';
      console.log('📊 Access level:', accessLevel);
      
      if (accessLevel === 'none') {
        console.warn('🚫 No access to meeting');
        setShowAccessDenied(true);
        setInitialLoadComplete(true);
        return;
      }
      
      try {
        await dispatch(fetchMeetingParticipants(id));
        console.log('✅ Participants fetched');
      } catch (participantsErr) {
        console.warn('⚠️ Failed to fetch participants, continuing...', participantsErr);
      }

      try {
        const res = await api.get('/action-tracker/notifications', { 
          params: { meeting_id: id, channel: 'email', limit: 50 }
        });
        
        if (isMountedRef.current) {
          setEmailNotifications(res.data?.items || []);
        }
      } catch (notificationsErr) {
        console.warn('⚠️ Failed to fetch notifications, continuing...', notificationsErr);
      }
      
      try {
        await dispatch(fetchActionTrackerAttributes());
        console.log('✅ Attributes fetched');
      } catch (attrsErr) {
        console.warn('⚠️ Failed to fetch attributes, continuing...', attrsErr);
      }
      
      if (isMountedRef.current) { 
        setInitialLoadComplete(true); 
        setLoadingTimeout(false); 
      }
      
    } catch (err) {
      console.error('❌ Error fetching meeting:', err);
      
      const is403 = 
        err?.response?.status === 403 || 
        err?.status === 403 || 
        err?.message?.toLowerCase()?.includes('access') ||
        err?.detail?.toLowerCase()?.includes('access') ||
        err?.response?.data?.detail?.toLowerCase()?.includes('access');
      
      if (is403) {
        console.warn('🚫 Access Denied (403)');
        setShowAccessDenied(true);
      } else if (err?.response?.status === 404 || err?.status === 404) {
        setLocalError(`❌ Meeting not found (ID: ${id}). It may have been deleted.`);
        setShowNotFound(true);
      } else {
        setLocalError(err?.message || 'Failed to load meeting');
      }
      
      if (isMountedRef.current) {
        setInitialLoadComplete(true);
      }
    }
  }, [id, dispatch]);

  const handleRefresh = useCallback(() => {
    setShowNotFound(false);
    setShowAccessDenied(false);
    setLoadingTimeout(false); 
    setInitialLoadComplete(false);
    fetchAttemptedRef.current = false; 
    fetchMeetingData();
  }, [fetchMeetingData]);

  useEffect(() => {
    isMountedRef.current = true;
    if (id && !fetchAttemptedRef.current) { 
      fetchAttemptedRef.current = true; 
      fetchMeetingData(); 
    }
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setShowAccessDenied(false);
      dispatch(clearMeetingState()); 
      dispatch(clearNotificationError()); 
      dispatch(clearLastNotificationResult());
    };
  }, [id, dispatch, fetchMeetingData]);

  useEffect(() => {
    if (!loading || initialLoadComplete) { 
      setLoadingTimeout(false); 
      return; 
    }
    const timer = setTimeout(() => { 
      if (!initialLoadComplete && isMountedRef.current) setLoadingTimeout(true); 
    }, NOT_FOUND_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading, initialLoadComplete]);

  useEffect(() => {
    if (!loading && !currentMeeting && initialLoadComplete && isMountedRef.current) {
      if (!showAccessDenied && !localError) {
        const timer = setTimeout(() => setShowNotFound(true), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, currentMeeting, initialLoadComplete, showAccessDenied, localError]);

  useEffect(() => {
    if (lastNotificationResult && isMountedRef.current) {
      setSnackbar({ 
        open: true, 
        message: `✅ Notifications sent to ${lastNotificationResult.sent} participants!`, 
        severity: 'success' 
      });
      setNotificationDialogOpen(false); 
      handleRefresh(); 
      dispatch(clearLastNotificationResult());
    }
  }, [lastNotificationResult, dispatch, handleRefresh]);

  useEffect(() => {
    if (notificationError && isMountedRef.current) { 
      setSnackbar({ 
        open: true, 
        message: notificationError, 
        severity: 'error' 
      }); 
      dispatch(clearNotificationError()); 
    }
  }, [notificationError, dispatch]);

  useEffect(() => { 
    if (id) localStorage.setItem(`${TAB_STORAGE_KEY_PREFIX}${id}`, String(tabValue)); 
  }, [tabValue, id]);
  
  useEffect(() => { 
    if (id) localStorage.setItem(`${TAB_ORDER_STORAGE_KEY_PREFIX}${id}`, JSON.stringify(tabOrder)); 
  }, [tabOrder, id]);

  // ==================== HANDLERS ====================
  const handleBack = useCallback(() => navigate('/meetings'), [navigate]);
  
  const handleEdit = useCallback(() => {
    if (controlsDisabled) {
      setSnackbar({ open: true, message: isDeleted ? 'This meeting has been deleted' : 'This meeting is inactive', severity: 'info' });
      return;
    }
    if (canUpdateMeeting && isFullAccess) {
      navigate(`/meetings/${id}/edit`);
    } else {
      setSnackbar({ open: true, message: 'Missing permissions to edit', severity: 'error' });
    }
  }, [navigate, id, canUpdateMeeting, isFullAccess, controlsDisabled, isDeleted]);

  const handleJoinMeeting = useCallback(() => {
    if (isOnlineMeeting && hasMeetingLink) {
      const url = hasMeetingLink.startsWith('http') ? hasMeetingLink : `https://${hasMeetingLink}`;
      window.open(url, '_blank');
    } else {
      setSnackbar({ 
        open: true, 
        message: normalizedMeeting?.location_text ? `📍 Physical: ${normalizedMeeting.location_text}` : 'No location specified', 
        severity: 'info' 
      });
    }
  }, [isOnlineMeeting, hasMeetingLink, normalizedMeeting]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/meetings/${id}`);
    setSnackbar({ open: true, message: 'Meeting link copied!', severity: 'success' });
    setShareDialogOpen(false);
  }, [id]);

  const handleNotifyClick = useCallback(() => {
    if (controlsDisabled) {
      setSnackbar({ open: true, message: isDeleted ? 'This meeting has been deleted' : 'This meeting is inactive', severity: 'info' });
      return;
    }
    if (canSendNotifications && isFullAccess) {
      setNotificationDialogOpen(true);
    } else {
      setSnackbar({ open: true, message: 'Limited access users cannot send notifications', severity: 'info' });
    }
  }, [canSendNotifications, isFullAccess, controlsDisabled, isDeleted]);

  const handleSendNotifications = useCallback((data) => {
    dispatch(sendMeetingNotifications({ meetingId: id, notificationData: data }));
  }, [id, dispatch]);

  const handleEmailHistoryOpen = useCallback(() => {
    navigate(`/meetings/${id}/notifications`);
  }, [navigate, id]);

  const handleStatusMenuOpen = useCallback((e) => {
    if (controlsDisabled) {
      setSnackbar({ open: true, message: isDeleted ? 'This meeting has been deleted' : 'This meeting is inactive', severity: 'info' });
      return;
    }
    if (!isFullAccess) {
      setSnackbar({ 
        open: true, 
        message: 'Limited access users cannot change meeting status', 
        severity: 'info' 
      });
      return;
    }
    setStatusMenuAnchor(e.currentTarget);
  }, [isFullAccess, controlsDisabled, isDeleted]);

  const handleStatusMenuClose = useCallback(() => setStatusMenuAnchor(null), []);
  const handleMoreMenuOpen = useCallback((e) => setMoreMenuAnchor(e.currentTarget), []);
  const handleMoreMenuClose = useCallback(() => setMoreMenuAnchor(null), []);

  const handleStatusSelect = useCallback((statusValue) => { 
    let selectedStatusObj = null;
    
    if (statusOptions && statusOptions.length > 0) {
      selectedStatusObj = statusOptions.find(s => 
        s.value === statusValue || 
        s.short_name === statusValue ||
        s.id === statusValue
      );
    }
    
    if (!selectedStatusObj) {
      const defaultStatus = Object.keys(STATUS_CONFIG).find(key => key === statusValue);
      if (defaultStatus) {
        selectedStatusObj = { 
          value: defaultStatus, 
          short_name: defaultStatus,
          label: STATUS_CONFIG[defaultStatus].label,
          id: null
        };
      }
    }
    
    setSelectedStatus(selectedStatusObj || statusValue); 
    setStatusDialogOpen(true); 
    setStatusMenuAnchor(null); 
  }, [statusOptions]);

  const handleStatusUpdate = useCallback(async () => {
    if (!selectedStatus) return;
    setStatusUpdating(true);
    try {
      let statusId = null;
      
      if (selectedStatus && typeof selectedStatus === 'object') {
        statusId = selectedStatus.id;
        
        if (!statusId && (selectedStatus.value || selectedStatus.short_name)) {
          const match = statusOptions?.find(s => 
            s.value === selectedStatus.value || 
            s.short_name === selectedStatus.short_name ||
            s.short_name === selectedStatus.value
          );
          if (match) {
            statusId = match.id;
          }
        }
      } 
      else if (typeof selectedStatus === 'string') {
        const match = statusOptions?.find(s => 
          s.value === selectedStatus || 
          s.short_name === selectedStatus
        );
        if (match) {
          statusId = match.id;
        }
      }
      
      if (!statusId && typeof selectedStatus === 'string') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(selectedStatus)) {
          statusId = selectedStatus;
        }
      }
      
      if (!statusId && normalizedMeeting?.status?.id) {
        statusId = normalizedMeeting.status.id;
      }
      
      if (statusId) {
        await dispatch(updateMeetingStatus({ 
          id, 
          status_id: statusId,
          comment: statusComment 
        })).unwrap();
      } else {
        await dispatch(updateMeetingStatus({ 
          id, 
          status: typeof selectedStatus === 'object' ? selectedStatus.value || selectedStatus.short_name : selectedStatus,
          comment: statusComment 
        })).unwrap();
      }
      
      setStatusDialogOpen(false); 
      setSelectedStatus(''); 
      setStatusComment(''); 
      handleRefresh();
      setSnackbar({ open: true, message: '✅ Meeting status updated!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Status update failed', severity: 'error' });
    } finally { 
      setStatusUpdating(false); 
    }
  }, [selectedStatus, statusOptions, normalizedMeeting, statusComment, id, dispatch, handleRefresh]);

  const handleDeleteClick = useCallback(() => {
    if (isDeleted) {
      setSnackbar({ open: true, message: 'This meeting has already been deleted', severity: 'info' });
      return;
    }
    if (canDeleteMeeting && isFullAccess) {
      setDeleteDialogOpen(true);
    } else {
      setSnackbar({ open: true, message: 'Missing delete rights', severity: 'error' });
    }
  }, [canDeleteMeeting, isFullAccess, isDeleted]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await dispatch(deleteMeeting(id)).unwrap(); 
      setDeleteDialogOpen(false); 
      navigate('/meetings');
    } catch (err) {
      setLocalError(err.message || 'Deletion failed'); 
      setDeleteDialogOpen(false);
    } finally { 
      setDeleting(false); 
    }
  }, [id, dispatch, navigate]);

  const handlePrintPDF = useCallback(async () => {
    if (!canExportReports || !isFullAccess || controlsDisabled) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/meetings/${id}/report/pdf`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const blob = await res.blob();
      const link = document.createElement('a'); 
      link.href = window.URL.createObjectURL(blob);
      link.download = `meeting_report_${id}.pdf`; 
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (err) { 
      setSnackbar({ open: true, message: 'PDF export failed', severity: 'error' }); 
    }
  }, [id, canExportReports, isFullAccess, controlsDisabled]);

  const handleExportJSON = useCallback(async () => {
    if (!canExportReports || !isFullAccess || controlsDisabled) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/meetings/${id}/report`, { 
        headers: { 
          Authorization: `Bearer ${token}`, 
          Accept: 'application/json' 
        } 
      });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a'); 
      link.href = window.URL.createObjectURL(blob);
      link.download = `meeting_${id}.json`; 
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (err) { 
      setSnackbar({ open: true, message: 'JSON export failed', severity: 'error' }); 
    }
  }, [id, canExportReports, isFullAccess, controlsDisabled]);

  const handleSpeedDialAction = useCallback((act) => {
    if (act === 'edit') handleEdit();
    else if (act === 'notify') handleNotifyClick();
    else if (act === 'share') setShareDialogOpen(true);
    else if (act === 'pdf') handlePrintPDF();
    else if (act === 'delete') handleDeleteClick();
    setSpeedDialOpen(false);
  }, [handleEdit, handleNotifyClick, handlePrintPDF, handleDeleteClick]);

  const handleTabDragStart = useCallback((e, val) => {
    if (val === PINNED_TAB_VALUE) { e.preventDefault(); return; }
    setDraggedTabValue(val); 
    setIsDraggingTab(true);
  }, []);

  const handleTabDragOver = useCallback((e, val) => {
    e.preventDefault(); 
    if (val === PINNED_TAB_VALUE || draggedTabValue === null) return;
    if (dragOverTabValue !== val) setDragOverTabValue(val);
  }, [draggedTabValue, dragOverTabValue]);

  const handleTabDrop = useCallback((e, val) => {
    e.preventDefault(); 
    if (val === PINNED_TAB_VALUE || draggedTabValue === null || draggedTabValue === val) { 
      handleTabDragEnd(); 
      return; 
    }
    setTabOrder((prev) => {
      const order = [...prev]; 
      const from = order.indexOf(draggedTabValue); 
      const to = order.indexOf(val);
      order.splice(from, 1); 
      order.splice(to, 0, draggedTabValue); 
      return order;
    });
    handleTabDragEnd();
  }, [draggedTabValue]);

  const handleTabDragEnd = useCallback(() => { 
    setDraggedTabValue(null); 
    setDragOverTabValue(null); 
    setIsDraggingTab(false); 
  }, []);

  const speedDialActions = useMemo(() => {
    const actions = [];

    if (controlsDisabled) {
      // Only allow Share when the meeting is deleted/inactive
      actions.push({ icon: <ShareIcon />, name: 'Share', action: 'share' });
      return actions;
    }
    
    if (canUpdateMeeting && isFullAccess) {
      actions.push({ icon: <EditIcon />, name: 'Edit', action: 'edit' });
    }
    
    if (canSendNotifications && isFullAccess) {
      actions.push({ icon: <NotificationsIcon />, name: 'Notify', action: 'notify' });
    }
    
    actions.push({ icon: <ShareIcon />, name: 'Share', action: 'share' });
    
    if (canExportReports && isFullAccess) {
      actions.push({ icon: <PictureAsPdfIcon />, name: 'PDF Report', action: 'pdf' });
    }
    
    if (canDeleteMeeting && isFullAccess) {
      actions.push({ icon: <DeleteIcon />, name: 'Delete', action: 'delete' });
    }
    
    return actions;
  }, [canUpdateMeeting, canSendNotifications, canExportReports, canDeleteMeeting, isFullAccess, controlsDisabled]);
 
  // Show ONLY the Overview tab if user has No Access, or if the meeting is deleted
  const visibleTabs = useMemo(() => {
    if (accessLevel === 'none') {
      return TABS.filter(tab => tab.value === 0);
    }

    if (isDeleted) {
      return TABS.filter(tab => tab.value === 0);
    }

    return TABS.filter(tab => {
      if (isAdmin || !tab.requiresPermission || hasPermission(userPermissions, tab.requiresPermission)) {
        const { minAccessLevel } = tab;
        
        if (minAccessLevel === 'full') {
          return isFullAccess;
        } else if (minAccessLevel === 'limited') {
          return hasAnyAccess;
        }
        
        return true;
      }
      
      return false;
    });
  }, [accessLevel, isAdmin, userPermissions, isFullAccess, isLimitedAccess, hasAnyAccess, isDeleted]);
 
  const visibleTabsForMode = useMemo(() => {
    return visibleTabs.filter(t => viewMode === 'detailed' || t.simple);
  }, [visibleTabs, viewMode]);

  const orderedVisibleTabsForMode = useMemo(() => {
    const map = new Map(visibleTabsForMode.map(t => [t.value, t]));
    const ordered = [];
    tabOrder.forEach(v => { 
      if (map.has(v)) { 
        ordered.push(map.get(v)); 
        map.delete(v); 
      } 
    });
    map.forEach(t => ordered.push(t));
    return ordered;
  }, [visibleTabsForMode, tabOrder]);

  const effectiveTabValue = useMemo(() => {
    return visibleTabsForMode.some(t => t.value === tabValue) ? tabValue : (visibleTabsForMode[0]?.value ?? tabValue);
  }, [visibleTabsForMode, tabValue]);

  const statusColorHex = getStatusColor();

  // ==================== RENDER ====================
  if (loading && !currentMeeting && !showNotFound) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6' }}>
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: isDarkMode ? DARK.surface : '#FFFFFF' }}>
          <CircularProgress size={50} sx={{ mb: 2, color: '#7C3AED' }} />
          <Typography variant="subtitle1" fontWeight={600}>Loading Meeting Workspace...</Typography>
          <LoadingTimeout timeout={NOT_FOUND_DELAY_MS} />
        </Paper>
      </Box>
    );
  }

  // Access Denied screen - shown for explicit 403 HTTP response errors
  if (showAccessDenied) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6' }}>
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3, maxWidth: 400 }}>
          <LockIcon sx={{ fontSize: 48, color: '#EF4444', mb: 2 }} />
          <Typography variant="h6" fontWeight={700}>Access Denied</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 3 }}>
            You don't have permission to access this meeting. This may be due to department restrictions or you not being added as a participant.
          </Typography>
          <Stack spacing={1.5}>
            <Button variant="contained" onClick={handleBack} sx={{ bgcolor: '#7C3AED' }}>
              Back to Dashboard
            </Button>
            <Button variant="outlined" onClick={handleRefresh}>
              Request Access
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  // Not Found screen - shown for 404 errors
  if (showNotFound && !currentMeeting) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6' }}>
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3, maxWidth: 400 }}>
          <ErrorOutlinedIcon sx={{ fontSize: 48, color: '#EF4444', mb: 2 }} />
          <Typography variant="h6" fontWeight={700}>Meeting Not Found</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 3 }}>
            The meeting you're looking for doesn't exist or has been deleted.
          </Typography>
          <Stack spacing={1.5}>
            <Button variant="contained" onClick={handleBack} sx={{ bgcolor: '#7C3AED' }}>Back to Dashboard</Button>
            <Button variant="outlined" onClick={handleRefresh}>Retry</Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6' }}>
      {/* ==================== APPBAR ==================== */}
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: isDarkMode ? DARK.surfaceAlt : '#FFFFFF', borderBottom: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}`, color: 'text.primary' }}>
        <Toolbar sx={{ px: 2, minHeight: 56 }}>
          <IconButton onClick={handleBack} edge="start" sx={{ mr: 1 }}><ArrowBackIcon /></IconButton>
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700 }}>Meeting Workspace</Typography>

          {isDeleted && (
            <Chip
              icon={<DeleteForeverIcon />}
              label="Deleted"
              size="small"
              sx={{ mr: 1, fontWeight: 700, bgcolor: alpha('#d32f2f', 0.12), color: '#d32f2f' }}
            />
          )}
          {!isDeleted && isInactive && (
            <Chip
              icon={<BlockIcon />}
              label="Inactive"
              size="small"
              sx={{ mr: 1, fontWeight: 700, bgcolor: alpha('#6B7280', 0.15), color: '#6B7280' }}
            />
          )}
          
          <Chip
            label={
              isFullAccess ? '🔓 Full Access' :
              isLimitedAccess ? '🔒 Limited Access' :
              '❌ No Access'
            }
            size="small"
            sx={{
              mr: 1.5,
              fontWeight: 600,
              bgcolor: isFullAccess ? alpha('#2e7d32', 0.1) : isLimitedAccess ? alpha('#ed6c02', 0.1) : alpha('#d32f2f', 0.1),
              color: isFullAccess ? '#2e7d32' : isLimitedAccess ? '#ed6c02' : '#d32f2f',
            }}
          />
          
          <Box sx={{ mr: 1 }}><ViewModeToggle viewMode={viewMode} onChange={setViewMode} /></Box>
          
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            {!isMobile && (
              <>
                <Tooltip title={controlsDisabled ? (isDeleted ? 'Meeting deleted' : 'Meeting inactive') : isFullAccess ? 'Export PDF' : 'Limited access users cannot export'}>
                  <Box component="span">
                    <IconButton onClick={handlePrintPDF} size="small" disabled={!isFullAccess || controlsDisabled}>
                      <PictureAsPdfIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Box>
                </Tooltip>

                <Tooltip title={controlsDisabled ? (isDeleted ? 'Meeting deleted' : 'Meeting inactive') : isFullAccess ? 'Sync Settings' : 'Limited access users cannot sync'}>
                  <Box component="span">
                    <IconButton onClick={() => setUpdateLinkDialogOpen(true)} size="small" disabled={!isFullAccess || controlsDisabled}>
                      <UpdateIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Box>
                </Tooltip>
              </>
            )}

            <Tooltip title={controlsDisabled ? (isDeleted ? 'Meeting deleted' : 'Meeting inactive') : isFullAccess ? 'Send Notifications' : 'Limited access users cannot send notifications'}>
              <Box component="span">
                <IconButton onClick={handleNotifyClick} size="small" disabled={!isFullAccess || controlsDisabled}>
                  <Badge badgeContent={participantCount} color="error">
                    <NotificationsIcon sx={{ fontSize: 20 }} />
                  </Badge>
                </IconButton>
              </Box>
            </Tooltip>

            <Tooltip title="Email History">
              <IconButton onClick={handleEmailHistoryOpen} size="small">
                <Badge badgeContent={emailSentCount} color="success">
                  <MarkEmailReadIcon sx={{ fontSize: 20 }} />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} size="small">
                <RefreshIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>

            <Tooltip title={controlsDisabled ? (isDeleted ? 'Meeting deleted' : 'Meeting inactive') : isFullAccess ? 'Change Status' : 'Limited access users cannot change status'}>
              <Box component="span">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={getStatusIcon()}
                  onClick={handleStatusMenuOpen}
                  disabled={!isFullAccess || controlsDisabled}
                  sx={{
                    textTransform: 'none',
                    ml: 0.5,
                    borderColor: statusColorHex,
                    color: statusColorHex,
                    '&:hover': {
                      borderColor: statusColorHex,
                      bgcolor: alpha(statusColorHex, 0.1),
                    },
                  }}
                >
                  {getStatusDisplay()}
                </Button>
              </Box>
            </Tooltip>

            <Tooltip title="More Options">
              <IconButton onClick={handleMoreMenuOpen} size="small">
                <MoreVertIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* ==================== CONTENT ==================== */}
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {(error || localError) && accessLevel !== 'none' && !showAccessDenied && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }} 
            onClose={() => setLocalError(null)}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={handleRefresh}
              >
                Retry
              </Button>
            }
          >
            <Typography variant="body2" fontWeight={600}>
              Error Loading Meeting
            </Typography>
            <Typography variant="caption">
              {localError || error || 'Unknown error'}
            </Typography>
            {id && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7 }}>
                Meeting ID: {id}
              </Typography>
            )}
          </Alert>
        )}

        {isDeleted && (
          <Alert severity="error" icon={<DeleteForeverIcon />} sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600}>
              🗑️ This meeting has been deleted
            </Typography>
            <Typography variant="caption">
              All editing, status, notification, export and sync controls are disabled. Only the Overview tab is available.
            </Typography>
          </Alert>
        )}

        {!isDeleted && isInactive && (
          <Alert severity="warning" icon={<BlockIcon />} sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600}>
              ⏸️ This meeting is inactive
            </Typography>
            <Typography variant="caption">
              Editing, status, notification, export and sync controls are disabled until the meeting is reactivated.
            </Typography>
          </Alert>
        )}
       
        {isLimitedAccess && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600}>
              📋 You have limited access to this meeting as a participant.
            </Typography>
            <Typography variant="caption">
              You can view the overview and your assigned actions, but cannot access minutes, documents, or meeting history.
            </Typography>
          </Alert>
        )}

        <Box sx={{ mb: 2, p: 2, borderRadius: 3, border: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}`, bgcolor: isDarkMode ? DARK.surface : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={800}>{normalizedMeeting?.title || normalizedMeeting?.name || 'Meeting Details'}</Typography>
          <Chip 
            label={getStatusDisplay()} 
            icon={getStatusIcon()} 
            size="small" 
            sx={{ 
              fontWeight: 600,
              bgcolor: alpha(statusColorHex, 0.15),
              color: statusColorHex,
              borderColor: statusColorHex,
              '& .MuiChip-icon': { color: statusColorHex }
            }} 
          />
        </Box>

        {visibleTabsForMode.length > 0 && (
          <Paper sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: isDarkMode ? DARK.surfaceAlt : alpha('#7C3AED', 0.04), borderBottom: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}`, px: 1 }}>
              <Tabs value={effectiveTabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto" sx={{ flex: 1, '& .MuiTabs-indicator': { display: 'none' }, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', minHeight: 44, borderRadius: 2, mx: 0.25, '&.Mui-selected': { bgcolor: '#7C3AED', color: '#FFF' } } }}>
                {orderedVisibleTabsForMode.map((tab) => (
                  <Tab
                    key={tab.value}
                    value={tab.value}
                    icon={tab.icon}
                    iconPosition="start"
                    label={tab.label}
                    draggable={tab.value !== PINNED_TAB_VALUE}
                    onDragStart={(e) => handleTabDragStart(e, tab.value)}
                    onDragOver={(e) => handleTabDragOver(e, tab.value)}
                    onDrop={(e) => handleTabDrop(e, tab.value)}
                    onDragEnd={handleTabDragEnd}
                    sx={{ opacity: isDraggingTab && draggedTabValue === tab.value ? 0.4 : 1 }}
                  />
                ))}
              </Tabs>
            </Box>
            <Box sx={{ p: 2.5 }}>
              <TabPanel value={effectiveTabValue} index={0}>
                {accessLevel === 'none' ? (
                  <Alert severity="warning" icon={<LockIcon />} sx={{ my: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Access Denied
                    </Typography>
                    <Typography variant="body2">
                      You do not have access to view this meeting details.
                    </Typography>
                  </Alert>
                ) : (
                  <MeetingOverviewTab 
                    meeting={normalizedMeeting} 
                    onUpdateLink={() => setUpdateLinkDialogOpen(true)} 
                    onJoinMeeting={handleJoinMeeting} 
                    readOnly={controlsDisabled}
                  />
                )}
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={1}>
                <MeetingMinutes 
                  meetingId={id} 
                  meetingStatus={getStatusValue()} 
                  onRefresh={handleRefresh} 
                />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={2}>
                <MeetingActionsList 
                  meetingId={id} 
                  meetingStatus={getStatusValue()} 
                  onRefresh={handleRefresh} 
                />
              </TabPanel>

              <TabPanel value={effectiveTabValue} index={3}>
                {isLimitedAccess && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    You can only view your own participant record.
                  </Alert>
                )}
                <ParticipantsTab 
                  meetingId={id} 
                  participants={
                    isLimitedAccess 
                      ? participants.filter(p => p.email === currentUser?.email)
                      : participants
                  }
                  isLimitedAccess={isLimitedAccess}
                  onRefresh={handleRefresh} 
                />
              </TabPanel>

              <TabPanel value={effectiveTabValue} index={4}>
                <MeetingDocuments meetingId={id} />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={5}>
                <MeetingHistory meetingId={id} />
              </TabPanel>
              {canViewAudit && isFullAccess && (
                <TabPanel value={effectiveTabValue} index={6}>
                  <MeetingAudit meetingId={id} />
                </TabPanel>
              )}
              {hasPermission(userPermissions, 'meeting:view_recorder') && isFullAccess && (
                <TabPanel value={effectiveTabValue} index={7}>
                  <MeetingRecorder meetingId={id} />
                </TabPanel>
              )}
            </Box>
          </Paper>
        )}
      </Container>

      {isMobile && speedDialActions.length > 0 && (
        <Zoom in={true}>
          <SpeedDial 
            ariaLabel="Actions" 
            sx={{ position: 'fixed', bottom: 16, right: 16 }} 
            icon={<SpeedDialIcon />} 
            onClose={() => setSpeedDialOpen(false)} 
            onOpen={() => setSpeedDialOpen(true)} 
            open={speedDialOpen}
          >
            {speedDialActions.map((a) => (
              <SpeedDialAction 
                key={a.name} 
                icon={a.icon} 
                tooltipTitle={a.name} 
                onClick={() => handleSpeedDialAction(a.action)} 
              />
            ))}
          </SpeedDial>
        </Zoom>
      )}

      <Menu anchorEl={moreMenuAnchor} open={Boolean(moreMenuAnchor)} onClose={handleMoreMenuClose}>
        <MenuItem onClick={handleShare}>
          <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Share Link</ListItemText>
        </MenuItem>
        
        {isFullAccess && !controlsDisabled && (
          <MenuItem onClick={handleStatusMenuOpen}>
            <ListItemIcon>{getStatusIcon()}</ListItemIcon>
            <ListItemText>Change Status</ListItemText>
          </MenuItem>
        )}
        
        {canDeleteMeeting && isFullAccess && !isDeleted && (
          <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Delete Workspace</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Menu 
        anchorEl={statusMenuAnchor} 
        open={Boolean(statusMenuAnchor)} 
        onClose={handleStatusMenuClose}
      >
        {statusOptions && statusOptions.length > 0 ? (
          statusOptions.map((status) => (
            <MenuItem 
              key={status.id || status.value} 
              onClick={() => handleStatusSelect(status.id || status.value)}
              selected={getStatusValue() === (status.short_name || status.value)}
            >
              <ListItemIcon>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: status.color || '#6B7280' }} />
              </ListItemIcon>
              <ListItemText 
                primary={status.label || status.short_name || status.value}
              />
              {getStatusValue() === (status.short_name || status.value) && (
                <CheckCircleIcon sx={{ fontSize: 16, color: status.color || '#7C3AED', ml: 1 }} />
              )}
            </MenuItem>
          ))
        ) : (
          Object.keys(STATUS_CONFIG).map((key) => (
            <MenuItem 
              key={key} 
              onClick={() => handleStatusSelect(key)}
              selected={getStatusValue() === key}
            >
              <ListItemIcon>{STATUS_CONFIG[key].icon}</ListItemIcon>
              <ListItemText primary={STATUS_CONFIG[key].label} />
              {getStatusValue() === key && (
                <CheckCircleIcon sx={{ fontSize: 16, color: STATUS_CONFIG[key].color, ml: 1 }} />
              )}
            </MenuItem>
          ))
        )}
      </Menu>

      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Typography variant="subtitle1" fontWeight={700}>Update Status</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">Target Status:</Typography>
              <Chip 
                label={
                  typeof selectedStatus === 'object' && selectedStatus !== null
                    ? (selectedStatus.label || selectedStatus.short_name || selectedStatus.value || '').replace('_', ' ').toUpperCase()
                    : typeof selectedStatus === 'string' && selectedStatus
                      ? selectedStatus.replace('_', ' ').toUpperCase()
                      : ''
                } 
                size="small"
                color="primary"
                sx={{ fontWeight: 600 }}
              />
            </Box>
            <TextField 
              fullWidth 
              label="Reason / Comment" 
              multiline 
              rows={2} 
              value={statusComment} 
              onChange={(e) => setStatusComment(e.target.value)} 
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleStatusUpdate} 
            disabled={statusUpdating} 
            sx={{ bgcolor: '#7C3AED' }}
          >
            {statusUpdating ? <CircularProgress size={20} color="inherit" /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Permanently delete this workspace tracking file? This metadata action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <NotificationDialog 
        open={notificationDialogOpen} 
        onClose={() => setNotificationDialogOpen(false)} 
        meeting={normalizedMeeting} 
        participants={participants} 
        onSend={handleSendNotifications} 
        sending={sendingNotifications} 
      />
      
      <UpdateMeetingLinkDialog 
        open={updateLinkDialogOpen} 
        onClose={() => setUpdateLinkDialogOpen(false)} 
        meeting={normalizedMeeting} 
        onUpdate={handleRefresh} 
      />
      
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={SNACKBAR_AUTO_HIDE_MS} 
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingDetail;