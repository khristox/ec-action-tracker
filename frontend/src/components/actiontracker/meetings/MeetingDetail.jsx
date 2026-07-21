// src/components/meetings/MeetingDetail.jsx
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
  { label: 'Overview',     icon: <InfoIcon />,               value: 0, simple: true, requiresPermission: null },
  { label: 'Minutes',      icon: <DescriptionIcon />,        value: 1, simple: true, requiresPermission: 'minutes:view' },
  { label: 'Actions',      icon: <AssignmentIcon />,         value: 2, simple: true, requiresPermission: 'action:view_own' },
  { label: 'Participants', icon: <PeopleIcon />,             value: 3, simple: true, requiresPermission: 'participant:view' },
  { label: 'Documents',    icon: <DescriptionIcon />,        value: 4, simple: false, requiresPermission: null },
  { label: 'History',      icon: <HistoryIcon />,            value: 5, simple: false, requiresPermission: null },
  { label: 'Audit',        icon: <HistoryIcon />,            value: 6, simple: false, requiresPermission: 'admin:view_audit' },
  { label: 'Recordings',   icon: <FiberManualRecordIcon />,  value: 7, simple: false, requiresPermission: 'meeting:view_recorder' },
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
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('simple');
  const [emailNotifications, setEmailNotifications] = useState([]);

  const normalizedMeeting = useMemo(() => currentMeeting ? { ...currentMeeting, status: normalizeStatus(currentMeeting.status) } : null, [currentMeeting]);
  const isOnlineMeeting = useMemo(() => normalizedMeeting?.platform && normalizedMeeting?.platform !== 'physical', [normalizedMeeting]);
  const hasMeetingLink = useMemo(() => normalizedMeeting?.meeting_link, [normalizedMeeting]);
  const participantCount = useMemo(() => participants.length, [participants]);
  const emailSentCount = useMemo(() => emailNotifications.filter((n) => n.status === 'successful').length, [emailNotifications]);

  // ==================== STATUS FUNCTIONS ====================

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
    
    // Map default config statuses to hex fallbacks safely
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
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      await dispatch(fetchMeetingById(id));
      await dispatch(fetchMeetingParticipants(id));
      const res = await api.get('/notifications', { 
        params: { meeting_id: id, channel: 'email', limit: 50 }, 
        signal: abortControllerRef.current.signal 
      });
      if (isMountedRef.current) setEmailNotifications(res.data?.items || []);
      await dispatch(fetchActionTrackerAttributes());
      if (isMountedRef.current) { 
        setInitialLoadComplete(true); 
        setLoadingTimeout(false); 
      }
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        console.error('Error fetching meeting data:', err);
      }
      if (isMountedRef.current) setInitialLoadComplete(true);
    }
  }, [id, dispatch]);

  const handleRefresh = useCallback(() => {
    setShowNotFound(false); 
    setLoadingTimeout(false); 
    setInitialLoadComplete(false);
    fetchAttemptedRef.current = false; 
    fetchMeetingData();
  }, [fetchMeetingData]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    isMountedRef.current = true;
    if (id && !fetchAttemptedRef.current) { 
      fetchAttemptedRef.current = true; 
      fetchMeetingData(); 
    }
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
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
      const timer = setTimeout(() => setShowNotFound(true), 500);
      return () => clearTimeout(timer);
    }
  }, [loading, currentMeeting, initialLoadComplete]);

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
    if (canUpdateMeeting) {
      navigate(`/meetings/${id}/edit`);
    } else {
      setSnackbar({ open: true, message: 'Missing permissions to edit', severity: 'error' });
    }
  }, [navigate, id, canUpdateMeeting]);

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
    if (canSendNotifications) {
      setNotificationDialogOpen(true);
    } else {
      setSnackbar({ open: true, message: 'Notification permission error', severity: 'error' });
    }
  }, [canSendNotifications]);

  const handleSendNotifications = useCallback((data) => {
    dispatch(sendMeetingNotifications({ meetingId: id, notificationData: data }));
  }, [id, dispatch]);

  const handleEmailHistoryOpen = useCallback(() => {
    navigate(`/meetings/${id}/notifications`);
  }, [navigate, id]);

  const handleStatusMenuOpen = (e) => setStatusMenuAnchor(e.currentTarget);
  const handleStatusMenuClose = () => setStatusMenuAnchor(null);
  const handleMoreMenuOpen = (e) => setMoreMenuAnchor(e.currentTarget);
  const handleMoreMenuClose = () => setMoreMenuAnchor(null);

  const handleStatusSelect = (val) => { 
    setSelectedStatus(val); 
    setStatusDialogOpen(true); 
    setStatusMenuAnchor(null); 
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    setStatusUpdating(true);
    try {
      await dispatch(updateMeetingStatus({ id, status: selectedStatus, comment: statusComment })).unwrap();
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
  };

  const handleDeleteClick = () => {
    if (canDeleteMeeting) {
      setDeleteDialogOpen(true);
    } else {
      setSnackbar({ open: true, message: 'Missing delete rights', severity: 'error' });
    }
  };

  const handleDelete = async () => {
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
  };

  const handlePrintPDF = useCallback(async () => {
    if (!canExportReports) return;
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
  }, [id, canExportReports]);

  const handleExportJSON = useCallback(async () => {
    if (!canExportReports) return;
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
  }, [id, canExportReports]);

  const handleSpeedDialAction = (act) => {
    if (act === 'edit') handleEdit();
    else if (act === 'notify') handleNotifyClick();
    else if (act === 'share') setShareDialogOpen(true);
    else if (act === 'pdf') handlePrintPDF();
    else if (act === 'delete') handleDeleteClick();
    setSpeedDialOpen(false);
  };

  // ==================== TAB DRAG AND DROP ====================

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

  // ==================== MEMOIZED VALUES ====================

  const speedDialActions = useMemo(() => {
    const actions = [];
    if (canUpdateMeeting) actions.push({ icon: <EditIcon />, name: 'Edit', action: 'edit' });
    if (canSendNotifications) actions.push({ icon: <NotificationsIcon />, name: 'Notify', action: 'notify' });
    actions.push({ icon: <ShareIcon />, name: 'Share', action: 'share' });
    if (canExportReports) actions.push({ icon: <PictureAsPdfIcon />, name: 'PDF Report', action: 'pdf' });
    if (canDeleteMeeting) actions.push({ icon: <DeleteIcon />, name: 'Delete', action: 'delete' });
    return actions;
  }, [canUpdateMeeting, canSendNotifications, canExportReports, canDeleteMeeting]);

  const visibleTabs = useMemo(() => {
    return TABS.filter(t => isAdmin || !t.requiresPermission || hasPermission(userPermissions, t.requiresPermission));
  }, [isAdmin, userPermissions]);

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

  if (showNotFound && !currentMeeting) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6' }}>
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3, maxWidth: 400 }}>
          <ErrorOutlinedIcon sx={{ fontSize: 48, color: '#EF4444', mb: 2 }} />
          <Typography variant="h6" fontWeight={700}>Meeting Workspace Not Found</Typography>
          <Stack spacing={1.5} sx={{ mt: 3 }}>
            <Button variant="contained" onClick={handleBack} sx={{ bgcolor: '#7C3AED' }}>Back to Dashboard</Button>
            <Button variant="outlined" onClick={handleRefresh}>Retry Connection</Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: isDarkMode ? DARK.surfaceAlt : '#FFFFFF', borderBottom: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}`, color: 'text.primary' }}>
        <Toolbar sx={{ px: 2, minHeight: 56 }}>
          <IconButton onClick={handleBack} edge="start" sx={{ mr: 1 }}><ArrowBackIcon /></IconButton>
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700 }}>Meeting Workspace</Typography>
          
          <Box sx={{ mr: 1 }}><ViewModeToggle viewMode={viewMode} onChange={setViewMode} /></Box>
          
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            {!isMobile && (
              <>
                <Tooltip title="PDF Report">
                  <IconButton onClick={handlePrintPDF} size="small"><PictureAsPdfIcon sx={{ fontSize: 20 }} /></IconButton>
                </Tooltip>
                <Tooltip title="Sync Settings">
                  <IconButton onClick={() => setUpdateLinkDialogOpen(true)} size="small"><UpdateIcon sx={{ fontSize: 20 }} /></IconButton>
                </Tooltip>
              </>
            )}
            
            <Tooltip title="Send Notifications">
              <IconButton onClick={handleNotifyClick} size="small">
                <Badge badgeContent={participantCount} color="error">
                  <NotificationsIcon sx={{ fontSize: 20 }} />
                </Badge>
              </IconButton>
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
            
            {/* Status Button (Safely passing explicit hex overrides without triggering MUI default validation errors) */}
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={getStatusIcon()} 
              onClick={handleStatusMenuOpen} 
              sx={{ 
                textTransform: 'none', 
                ml: 0.5,
                borderColor: statusColorHex,
                color: statusColorHex,
                '&:hover': {
                  borderColor: statusColorHex,
                  bgcolor: alpha(statusColorHex, 0.1)
                }
              }}
            >
              {getStatusDisplay()}
            </Button>
            
            <Tooltip title="More Options">
              <IconButton onClick={handleMoreMenuOpen} size="small">
                <MoreVertIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {(error || localError) && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setLocalError(null)}>
            {localError || 'Network Sync Error'}
          </Alert>
        )}

        <Box sx={{ mb: 2, p: 2, borderRadius: 3, border: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}`, bgcolor: isDarkMode ? DARK.surface : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={800}>{normalizedMeeting?.title || normalizedMeeting?.name}</Typography>
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
                <MeetingOverviewTab 
                  meeting={normalizedMeeting} 
                  onUpdateLink={() => setUpdateLinkDialogOpen(true)} 
                  onJoinMeeting={handleJoinMeeting} 
                />
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
                <ParticipantsTab 
                  meetingId={id} 
                  participants={participants} 
                  onRefresh={handleRefresh} 
                />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={4}>
                <MeetingDocuments meetingId={id} />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={5}>
                <MeetingHistory meetingId={id} />
              </TabPanel>
              {canViewAudit && (
                <TabPanel value={effectiveTabValue} index={6}>
                  <MeetingAudit meetingId={id} />
                </TabPanel>
              )}
              {hasPermission(userPermissions, 'meeting:view_recorder') && (
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
        <MenuItem onClick={handleStatusMenuOpen}>
          <ListItemIcon>{getStatusIcon()}</ListItemIcon>
          <ListItemText>Change Status</ListItemText>
        </MenuItem>
        {canDeleteMeeting && (
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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {statusOptions && statusOptions.length > 0 ? (
          statusOptions.map((status) => (
            <MenuItem 
              key={status.id || status.value} 
              onClick={() => handleStatusSelect(status.value)}
              selected={getStatusValue() === status.value}
              sx={{
                '&.Mui-selected': {
                  bgcolor: alpha(status.color || '#7C3AED', 0.1),
                }
              }}
            >
              <ListItemIcon>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: status.color || '#6B7280' }} />
              </ListItemIcon>
              <ListItemText 
                primary={status.label || status.short_name || status.value}
                primaryTypographyProps={{
                  fontWeight: getStatusValue() === status.value ? 600 : 400,
                }}
              />
              {getStatusValue() === status.value && (
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
              <ListItemText 
                primary={STATUS_CONFIG[key].label}
                primaryTypographyProps={{
                  fontWeight: getStatusValue() === key ? 600 : 400,
                }}
              />
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
                  {/* Show target status preview */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Target Status:</Typography>
                    <Chip 
                      label={selectedStatus ? selectedStatus.replace('_', ' ').toUpperCase() : ''} 
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