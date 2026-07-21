// src/components/meetings/MeetingDetail.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Container, Paper, Typography, Stack, Chip, Button, IconButton,
  Divider, Alert, CircularProgress, Tooltip, Tabs, Tab, Menu, MenuItem,
  ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, AppBar, Toolbar, useMediaQuery,
  useTheme, Badge, Snackbar, alpha, LinearProgress, SpeedDial, SpeedDialAction,
  SpeedDialIcon, Zoom, ToggleButton, ToggleButtonGroup, Drawer, List, ListItem,
  ListItemButton, ListItemText as MuiListItemText
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, Edit, Delete, People as PeopleIcon,
  Description as DescriptionIcon, Refresh as RefreshIcon, Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon, Pending as PendingIcon, Schedule as ScheduleIcon,
  Cancel, MoreVert as MoreVertIcon, Notifications as NotificationsIcon,
  History as HistoryIcon, Update as UpdateIcon, ErrorOutlined as ErrorOutlinedIcon,
  HourglassEmpty as HourglassEmptyIcon, FiberManualRecord as FiberManualRecordIcon,
  Share as ShareIcon, CopyAll as CopyAllIcon, Code as CodeIcon,
  ViewStream as ViewStreamIcon, ViewAgenda as ViewAgendaIcon, MarkEmailRead as MarkEmailReadIcon,
  Info as InfoIcon, Restore as RestoreIcon, Menu as MenuIcon, Close as CloseIcon,
  PictureAsPdf as PictureAsPdfIcon
} from '@mui/icons-material';

import {
  fetchMeetingById, clearMeetingState, updateMeetingStatus, deleteMeeting,
  fetchActionTrackerAttributes, selectCurrentMeeting, selectMeetingsLoading,
  selectMeetingsError, selectMeetingStatusOptions
} from '../../../store/slices/actionTracker/meetingSlice';
import MeetingMinutes from './MeetingMinutes';
import MeetingActionsList from './MeetingActionsList';
import MeetingDocuments from './MeetingDocuments';
import MeetingHistory from './components/MeetingHistory';
import MeetingOverviewTab from './components/MeetingOverviewTab';
import ParticipantsTab from './components/ParticipantsTab';
import NotificationDialog from './components/NotificationDialog';
import UpdateMeetingLinkDialog from './components/UpdateMeetingLinkDialog';
import {
  sendMeetingNotifications, fetchMeetingParticipants, selectNotificationParticipants,
  selectNotificationSending, selectNotificationError, selectLastNotificationResult,
  clearNotificationError, clearLastNotificationResult
} from '../../../store/slices/actionTracker/notificationSlice';
import MeetingAudit from './MeetingAudit';
import MeetingRecorder from './MeetingRecorder';
import api from '../../../services/api';
import { selectUserPermissions, hasPermission } from '../../../store/slices/authSlice';
import { deduplicatedGet } from '../../../utils/requestUtils';

// ==================== Permission Constants ====================
const PERMISSIONS = {
  DELETE_MEETING: 'meeting:delete',
  UPDATE_MEETING: 'meeting:update',
  VIEW_AUDIT_LOGS: 'admin:view_audit',
  VIEW_RECORDER: 'meeting:record',
  SEND_NOTIFICATIONS: 'notification:send',
  SEND_EMAIL_NOTIFICATIONS: 'notification:email',
  VIEW_MINUTES: 'minutes:view',
  VIEW_OWN_ACTIONS: 'action:view_own',
  VIEW_PARTICIPANTS: 'participant:view',
  EXPORT_REPORTS: 'report:export',
};

// ==================== Constants ====================
const NOT_FOUND_DELAY_MS = 7000;
const SNACKBAR_AUTO_HIDE_MS = 6000;
const TAB_STORAGE_KEY_PREFIX = 'meeting_detail_last_tab_';
const TAB_ORDER_STORAGE_KEY_PREFIX = 'meeting_detail_tab_order_';
const PINNED_TAB_VALUE = 0;

const DARK = {
  bg: '#0B0B0D',
  surface: '#161618',
  surfaceAlt: '#1D1D20',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  textSecondary: '#A3A3AA',
};

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     icon: <ScheduleIcon />,     color: 'warning' },
  started:     { label: 'In Progress', icon: <PendingIcon />,      color: 'info' },
  ongoing:     { label: 'In Progress', icon: <PendingIcon />,      color: 'info' },
  in_progress: { label: 'In Progress', icon: <PendingIcon />,      color: 'info' },
  ended:       { label: 'Ended',       icon: <CheckCircleIcon />,  color: 'success' },
  closed:      { label: 'Closed',      icon: <CheckCircleIcon />,  color: 'success' },
  cancelled:   { label: 'Cancelled',   icon: <Cancel />,           color: 'error' },
  awaiting:    { label: 'Awaiting',    icon: <HourglassEmptyIcon />, color: 'warning' },
};

const TABS = [
  { label: 'Overview',     icon: <InfoIcon />,               value: 0, simple: true, requiresPermission: null, mobileLabel: 'Info' },
  { label: 'Minutes',      icon: <DescriptionIcon />,        value: 1, simple: true, requiresPermission: PERMISSIONS.VIEW_MINUTES, mobileLabel: 'Notes' },
  { label: 'Actions',      icon: <AssignmentIcon />,         value: 2, simple: true, requiresPermission: PERMISSIONS.VIEW_OWN_ACTIONS, mobileLabel: 'Tasks' },
  { label: 'Participants', icon: <PeopleIcon />,             value: 3, simple: true, requiresPermission: PERMISSIONS.VIEW_PARTICIPANTS, mobileLabel: 'People' },
  { label: 'Documents',    icon: <DescriptionIcon />,        value: 4, simple: false, requiresPermission: null, mobileLabel: 'Files' },
  { label: 'History',      icon: <HistoryIcon />,            value: 5, simple: false, requiresPermission: null, mobileLabel: 'History' },
  { label: 'Audit',        icon: <HistoryIcon />,            value: 6, simple: false, requiresPermission: PERMISSIONS.VIEW_AUDIT_LOGS, mobileLabel: 'Audit' },
  { label: 'Recordings',   icon: <FiberManualRecordIcon />,  value: 7, simple: false, requiresPermission: PERMISSIONS.VIEW_RECORDER, mobileLabel: 'Record' },
];

const getSpeedDialActions = (hasUpdate, hasNotify, hasEmail, hasExport, hasDelete) => {
  const actions = [];
  if (hasUpdate) actions.push({ icon: <Edit />, name: 'Edit', action: 'edit' });
  if (hasNotify || hasEmail) actions.push({ icon: <NotificationsIcon />, name: 'Notify', action: 'notify' });
  actions.push({ icon: <ShareIcon />, name: 'Share', action: 'share' });
  if (hasExport) {
    actions.push({ icon: <PictureAsPdfIcon />, name: 'PDF Report', action: 'pdf' });
    actions.push({ icon: <CodeIcon />, name: 'Export JSON', action: 'json' });
  }
  if (hasDelete) actions.push({ icon: <Delete />, name: 'Delete', action: 'delete' });
  return actions;
};

const normalizeStatus = (status) => {
  if (!status) return null;
  if (status.short_name) return status;
  if (typeof status === 'string') {
    const cleaned = status.includes('_') ? status.split('_').pop() : status;
    return { short_name: cleaned.toLowerCase(), name: status, code: status, id: null };
  }
  return status;
};

// ==================== Sub-Components (Memoized) ====================
const TabPanel = memo(({ children, value, index, ...other }) => (
  <div role="tabpanel" hidden={value !== index} id={`meeting-tabpanel-${index}`} {...other}>
    {value === index && <Box sx={{ pt: { xs: 1, sm: 2, md: 3 } }}>{children}</Box>}
  </div>
));
TabPanel.displayName = 'TabPanel';

const LoadingTimeout = memo(({ timeout }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min((elapsed / timeout) * 100, 100));
    }, 100);
    return () => clearInterval(interval);
  }, [timeout]);
  return <LinearProgress variant="determinate" value={progress} sx={{ height: 4, borderRadius: 2, mt: 2 }} />;
});
LoadingTimeout.displayName = 'LoadingTimeout';

const ViewModeToggle = memo(({ viewMode, onChange }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  return (
    <Tooltip title={viewMode === 'simple' ? 'Detailed view' : 'Simple view'} arrow>
      <ToggleButtonGroup
        value={viewMode}
        exclusive
        onChange={(_, val) => val && onChange(val)}
        size="small"
        sx={{
          '& .MuiToggleButtonGroup-grouped': {
            border: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}`,
            '&:not(:first-of-type)': { borderLeft: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}` },
          },
          '& .MuiToggleButton-root': {
            px: { xs: 0.5, sm: 1, md: 1.75 }, py: 0.5,
            textTransform: 'none', fontWeight: 600, fontSize: { xs: '0.65rem', sm: '0.75rem' },
            color: isDarkMode ? DARK.textSecondary : 'text.secondary', gap: 0.4,
            '&.Mui-selected': {
              bgcolor: alpha('#7C3AED', 0.12), color: '#7C3AED',
              '&:hover': { bgcolor: alpha('#7C3AED', 0.18) },
            },
          },
        }}
      >
        <ToggleButton value="simple">
          <ViewStreamIcon sx={{ fontSize: { xs: 12, sm: 15 } }} />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Simple</Box>
        </ToggleButton>
        <ToggleButton value="detailed">
          <ViewAgendaIcon sx={{ fontSize: { xs: 12, sm: 15 } }} />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Detailed</Box>
        </ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
});
ViewModeToggle.displayName = 'ViewModeToggle';

const MobileNavigationDrawer = memo(({ open, onClose, visibleTabs, effectiveTabValue, onTabSelect, isDarkMode }) => (
  <Drawer
    anchor="bottom" open={open} onClose={onClose}
    sx={{ '& .MuiDrawer-paper': { borderTopLeftRadius: 16, borderTopRightRadius: 16, bgcolor: isDarkMode ? DARK.surface : '#FFFFFF', maxHeight: '70vh' } }}
  >
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Navigate</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </Box>
      <List>
        {visibleTabs.map((tab) => (
          <ListItem key={tab.value} disablePadding>
            <ListItemButton
              selected={effectiveTabValue === tab.value}
              onClick={() => { onTabSelect(null, tab.value); onClose(); }}
              sx={{ borderRadius: 2, mb: 0.5, '&.Mui-selected': { bgcolor: alpha('#7C3AED', 0.1), '&:hover': { bgcolor: alpha('#7C3AED', 0.15) } } }}
            >
              <ListItemIcon sx={{ color: effectiveTabValue === tab.value ? '#7C3AED' : 'inherit' }}>{tab.icon}</ListItemIcon>
              <MuiListItemText primary={tab.label} primaryTypographyProps={{ fontWeight: effectiveTabValue === tab.value ? 600 : 400, color: effectiveTabValue === tab.value ? '#7C3AED' : 'inherit' }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  </Drawer>
));
MobileNavigationDrawer.displayName = 'MobileNavigationDrawer';

const HeaderBar = memo(({
  onBack, onNotify, onRefresh, onEdit, onStatusMenuOpen, onMoreMenuOpen, onUpdateLink, onPrintPDF, onExportJSON, onRecord, onMobileMenuToggle,
  participantCount, getStatusIcon, getStatusDisplay, isMobile, canRecord, hasRecordPermission, viewMode, onViewModeChange,
  canSendNotifications, hasUpdatePermission, emailSentCount, emailFailedCount, onEmailHistoryOpen, isDarkMode
}) => {
  const theme = useTheme();
  const isDarkModeTheme = theme.palette.mode === 'dark' || isDarkMode;

  if (isMobile) {
    return (
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: isDarkModeTheme ? DARK.surfaceAlt : '#FFFFFF', borderBottom: 1, borderColor: isDarkModeTheme ? DARK.border : '#E5E7EB', zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ px: 1, minHeight: 56 }}>
          <IconButton onClick={onBack} edge="start" size="small"><ArrowBackIcon /></IconButton>
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700, fontSize: '0.9rem', ml: 1 }}>Meeting</Typography>
          <Stack direction="row" spacing={0.5}>
            <IconButton onClick={onRefresh} size="small"><RefreshIcon sx={{ fontSize: 20 }} /></IconButton>
            <IconButton onClick={onMobileMenuToggle} size="small"><MenuIcon sx={{ fontSize: 20 }} /></IconButton>
          </Stack>
        </Toolbar>
        <Box sx={{ px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: 1, borderColor: isDarkModeTheme ? DARK.border : '#E5E7EB', bgcolor: isDarkModeTheme ? DARK.surface : '#FAFAFA' }}>
          <Chip label={getStatusDisplay()} color={STATUS_CONFIG[getStatusDisplay()?.toLowerCase()]?.color || 'default'} size="small" icon={getStatusIcon()} sx={{ height: 24 }} />
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {canSendNotifications && <IconButton onClick={onNotify} size="small"><Badge badgeContent={participantCount} color="error"><NotificationsIcon sx={{ fontSize: 18 }} /></Badge></IconButton>}
            {hasUpdatePermission && <IconButton onClick={onEdit} size="small"><Edit sx={{ fontSize: 18 }} /></IconButton>}
            <IconButton onClick={onMoreMenuOpen} size="small"><MoreVertIcon sx={{ fontSize: 20 }} /></IconButton>
          </Box>
        </Box>
      </AppBar>
    );
  }

  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: isDarkModeTheme ? DARK.surfaceAlt : '#FFFFFF', borderBottom: 1, borderColor: isDarkModeTheme ? DARK.border : '#E5E7EB', zIndex: theme.zIndex.drawer + 1 }}>
      <Toolbar sx={{ px: 3, minHeight: 56 }}>
        <IconButton onClick={onBack} edge="start" sx={{ mr: 2 }}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700, color: isDarkModeTheme ? '#FFF' : 'text.primary' }}>Meeting Details</Typography>
        <Box sx={{ mr: 2 }}><ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} /></Box>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
          <IconButton onClick={onPrintPDF} size="small"><PictureAsPdfIcon sx={{ fontSize: 20 }} /></IconButton>
          <IconButton onClick={onExportJSON} size="small"><CodeIcon sx={{ fontSize: 20 }} /></IconButton>
          <IconButton onClick={onUpdateLink} size="small"><UpdateIcon sx={{ fontSize: 20 }} /></IconButton>
          {canSendNotifications && (
            <IconButton onClick={onNotify} size="small">
              <Badge badgeContent={participantCount} color="error"><NotificationsIcon sx={{ fontSize: 20 }} /></Badge>
            </IconButton>
          )}
          <IconButton onClick={onEmailHistoryOpen} size="small">
            <Badge badgeContent={emailSentCount} color="success"><MarkEmailReadIcon sx={{ fontSize: 20 }} /></Badge>
          </IconButton>
          <IconButton onClick={onRefresh} size="small"><RefreshIcon sx={{ fontSize: 20 }} /></IconButton>
          {hasUpdatePermission && <IconButton onClick={onEdit} size="small"><Edit sx={{ fontSize: 20 }} /></IconButton>}
          {canRecord && hasRecordPermission && (
            <IconButton onClick={onRecord} size="small" sx={{ color: '#f44336' }}><FiberManualRecordIcon sx={{ fontSize: 20 }} /></IconButton>
          )}
          <Button variant="outlined" size="small" startIcon={getStatusIcon()} onClick={onStatusMenuOpen} sx={{ textTransform: 'none', ml: 0.5 }}>
            {getStatusDisplay()}
          </Button>
          <IconButton onClick={onMoreMenuOpen} size="small"><MoreVertIcon sx={{ fontSize: 20 }} /></IconButton>
        </Stack>
      </Toolbar>
    </AppBar>
  );
});
HeaderBar.displayName = 'HeaderBar';

const MeetingTitleBar = memo(({ meeting, isMobile }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const statusConfig = STATUS_CONFIG[meeting?.status?.short_name?.toLowerCase()] || STATUS_CONFIG.pending;
  return (
    <Box sx={{ mb: 2, p: 2, borderRadius: 2, border: 1, borderColor: isDarkMode ? DARK.border : '#E5E7EB', bgcolor: isDarkMode ? DARK.surface : '#FFFFFF', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 1.5 }}>
      <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={800} sx={{ wordBreak: 'break-word' }}>{meeting?.title || 'Untitled Meeting'}</Typography>
      <Chip label={statusConfig.label} color={statusConfig.color} icon={statusConfig.icon} sx={{ fontWeight: 600 }} />
    </Box>
  );
});
MeetingTitleBar.displayName = 'MeetingTitleBar';

// ==================== Main Functional Component ====================
const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const currentMeeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingsError);
  const participants = useSelector(selectNotificationParticipants);
  const sendingNotifications = useSelector(selectNotificationSending);
  const userPermissions = useSelector(selectUserPermissions);
  const currentUser = useSelector((state) => state.auth.user);

  // Structural UI States
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [updateLinkDialogOpen, setUpdateLinkDialogOpen] = useState(false);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  // Form states
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [localError, setLocalError] = useState(null);
  const [showNotFound, setShowNotFound] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [viewMode, setViewMode] = useState('simple');
  const [emailNotifications, setEmailNotifications] = useState([]);

  // Drag and Drop Tab state tracking pointers
  const [draggedTabValue, setDraggedTabValue] = useState(null);
  const [dragOverTabValue, setDragOverTabValue] = useState(null);
  const [isDraggingTab, setIsDraggingTab] = useState(false);

  // Tab Setup State Management
  const [tabOrder, setTabOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(`${TAB_ORDER_STORAGE_KEY_PREFIX}${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return TABS.map((t) => t.value);
  });

  const [tabValue, setTabValue] = useState(() => {
    try {
      const saved = localStorage.getItem(`${TAB_STORAGE_KEY_PREFIX}${id}`);
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch (_) { return 0; }
  });

  // User Authority Computations
  const isAdmin = useMemo(() => currentUser?.is_superuser || currentUser?.is_admin || false, [currentUser]);
  const hasDeleteMeetingPermission = useMemo(() => hasPermission(userPermissions, PERMISSIONS.DELETE_MEETING), [userPermissions]);
  const hasUpdateMeetingPermission = useMemo(() => hasPermission(userPermissions, PERMISSIONS.UPDATE_MEETING), [userPermissions]);
  const hasRecordPermission = useMemo(() => hasPermission(userPermissions, PERMISSIONS.VIEW_RECORDER), [userPermissions]);
  const hasViewRecorderPermission = useMemo(() => hasPermission(userPermissions, PERMISSIONS.VIEW_RECORDER), [userPermissions]);
  const hasSendInAppNotificationPermission = useMemo(() => hasPermission(userPermissions, PERMISSIONS.SEND_NOTIFICATIONS), [userPermissions]);
  const hasSendEmailNotificationPermission = useMemo(() => hasPermission(userPermissions, PERMISSIONS.SEND_EMAIL_NOTIFICATIONS), [userPermissions]);
  const hasExportReportPermission = useMemo(() => hasPermission(userPermissions, PERMISSIONS.EXPORT_REPORTS), [userPermissions]);
  const hasViewAuditPermission = useMemo(() => hasPermission(userPermissions, PERMISSIONS.VIEW_AUDIT_LOGS), [userPermissions]);

  const canDeleteMeeting = isAdmin || hasDeleteMeetingPermission;
  const canUpdateMeeting = isAdmin || hasUpdateMeetingPermission;
  const canSendNotifications = hasSendInAppNotificationPermission || hasSendEmailNotificationPermission;
  const canExportReports = isAdmin || hasExportReportPermission;
  const canViewAudit = isAdmin || hasViewAuditPermission;

  // Stable data loaders
  const fetchMeeting = useCallback(() => { if (id) dispatch(fetchMeetingById(id)); }, [id, dispatch]);
  const fetchParticipants = useCallback(() => { if (id) dispatch(fetchMeetingParticipants(id)); }, [id, dispatch]);
  
const fetchEmailNotifications = useCallback(async (signal) => {
    if (!id) return;
    try {
      const response = await deduplicatedGet(
        '/notifications',
        { meeting_id: id, channel: 'email', limit: 50 },
        { key: `email_notifications_${id}`, signal }
      );
      if (!response.canceled) {
        setEmailNotifications(response.data?.items || []);
      }
    } catch (err) {
      // Completely swallow cancellation errors so they never hit the console log
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED' && err.message !== 'canceled') {
        console.error('Failed to fetch email notifications:', err);
      }
    }
  }, [id]);

  const handleRefresh = useCallback(() => {
    setShowNotFound(false);
    setLoadingTimeout(false);
    setInitialLoadComplete(false);
    fetchMeeting();
    fetchParticipants();
    fetchEmailNotifications();
  }, [fetchMeeting, fetchParticipants, fetchEmailNotifications]);

  // Completely fixed mount effect with stable abort and dispatch isolation
  useEffect(() => {
    if (!id) return;

    const emailController = new AbortController();

    dispatch(fetchMeetingById(id));
    dispatch(fetchMeetingParticipants(id));
    fetchEmailNotifications(emailController.signal);
    dispatch(fetchActionTrackerAttributes());

    return () => {
      emailController.abort();
      dispatch(clearMeetingState());
      dispatch(clearNotificationError());
      dispatch(clearLastNotificationResult());
    };
  }, [id, dispatch, fetchEmailNotifications]);

  // Loading Delay Sync
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoadingTimeout(true), NOT_FOUND_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (currentMeeting || error) setInitialLoadComplete(true);
  }, [currentMeeting, error]);

  useEffect(() => {
    if (!loading && !currentMeeting && initialLoadComplete) {
      setShowNotFound(true);
    } else if (loadingTimeout && !currentMeeting && !error) {
      setShowNotFound(true);
    }
  }, [loading, currentMeeting, initialLoadComplete, loadingTimeout, error]);

  useEffect(() => {
    try { localStorage.setItem(`${TAB_STORAGE_KEY_PREFIX}${id}`, String(tabValue)); } catch (_) {}
  }, [tabValue, id]);

  const handleTabChange = useCallback((_, newValue) => {
    setTabValue(newValue);
    setMobileDrawerOpen(false);
  }, []);

  const speedDialActions = useMemo(() => getSpeedDialActions(
    canUpdateMeeting, hasSendInAppNotificationPermission, hasSendEmailNotificationPermission, canExportReports, canDeleteMeeting
  ), [canUpdateMeeting, hasSendInAppNotificationPermission, hasSendEmailNotificationPermission, canExportReports, canDeleteMeeting]);

  const normalizedMeeting = useMemo(() => (currentMeeting ? { ...currentMeeting, status: normalizeStatus(currentMeeting.status) } : null), [currentMeeting]);
  const participantCount = useMemo(() => participants.length, [participants]);

  const emailSentCount = useMemo(() => emailNotifications.filter((n) => n.status === 'successful').length, [emailNotifications]);

  const canRecord = useMemo(() => {
    const sn = normalizedMeeting?.status?.short_name;
    return sn === 'started' || sn === 'ongoing' || sn === 'in_progress';
  }, [normalizedMeeting]);

  const visibleTabs = useMemo(() => {
    return TABS.filter((tab) => {
      if (isAdmin) return true;
      if (tab.requiresPermission) {
        if (tab.requiresPermission === PERMISSIONS.VIEW_RECORDER) return hasViewRecorderPermission;
        if (tab.requiresPermission === PERMISSIONS.VIEW_AUDIT_LOGS) return canViewAudit;
        return hasPermission(userPermissions, tab.requiresPermission);
      }
      return true;
    });
  }, [isAdmin, hasViewRecorderPermission, canViewAudit, userPermissions]);

  const visibleTabsForMode = useMemo(() => visibleTabs.filter((t) => viewMode === 'detailed' || t.simple), [visibleTabs, viewMode]);

  const orderedVisibleTabsForMode = useMemo(() => {
    const byValue = new Map(visibleTabsForMode.map((t) => [t.value, t]));
    const ordered = [];
    tabOrder.forEach((v) => {
      if (byValue.has(v)) { ordered.push(byValue.get(v)); byValue.delete(v); }
    });
    byValue.forEach((t) => ordered.push(t));
    return ordered;
  }, [visibleTabsForMode, tabOrder]);

  const effectiveTabValue = useMemo(() => {
    const visible = visibleTabsForMode.some((t) => t.value === tabValue);
    return visible ? tabValue : (visibleTabsForMode[0]?.value ?? 0);
  }, [visibleTabsForMode, tabValue]);

  // Drag and Drop implementation logic
  const handleTabDragStart = useCallback((event, value) => {
    if (value === PINNED_TAB_VALUE || isMobile) { event.preventDefault(); return; }
    setDraggedTabValue(value);
    setIsDraggingTab(true);
  }, [isMobile]);

  const handleTabDragOver = useCallback((event, value) => {
    event.preventDefault();
    if (value === PINNED_TAB_VALUE || draggedTabValue === null || isMobile) return;
    if (dragOverTabValue !== value) setDragOverTabValue(value);
  }, [draggedTabValue, dragOverTabValue, isMobile]);

  const handleTabDrop = useCallback((event, value) => {
    event.preventDefault();
    if (value === PINNED_TAB_VALUE || draggedTabValue === null || draggedTabValue === value || isMobile) {
      setDraggedTabValue(null); setDragOverTabValue(null); setIsDraggingTab(false); return;
    }
    setTabOrder((prev) => {
      const order = [...prev];
      const from = order.indexOf(draggedTabValue);
      const to = order.indexOf(value);
      if (from === -1 || to === -1) return prev;
      order.splice(from, 1);
      order.splice(to, 0, draggedTabValue);
      try { localStorage.setItem(`${TAB_ORDER_STORAGE_KEY_PREFIX}${id}`, JSON.stringify(order)); } catch (_) {}
      return order;
    });
    setDraggedTabValue(null); setDragOverTabValue(null); setIsDraggingTab(false);
  }, [draggedTabValue, id, isMobile]);

  // File Download Handlers
  const handlePrintPDF = useCallback(async () => {
    if (!canExportReports) return;
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/meetings/${id}/report/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  }, [id, canExportReports]);

  const handleExportJSON = useCallback(async () => {
    if (!canExportReports) return;
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/meetings/${id}/report`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meeting_${id}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  }, [id, canExportReports]);

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    setStatusUpdating(true);
    try {
      await dispatch(updateMeetingStatus({ id, status: selectedStatus, comment: statusComment })).unwrap();
      setStatusDialogOpen(false);
      fetchMeeting();
      setSnackbar({ open: true, message: 'Status updated successfully!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Failed code update', severity: 'error' });
    } finally { setStatusUpdating(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await dispatch(deleteMeeting(id)).unwrap();
      navigate('/meetings');
    } catch (err) { setLocalError(err.message); }
    finally { setDeleting(false); }
  };

  const handleShare = useCallback(() => {
    const meetingUrl = `${window.location.origin}/meetings/${id}`;
    navigator.clipboard.writeText(meetingUrl);
    setSnackbar({ open: true, message: 'Meeting link copied to clipboard!', severity: 'success' });
    setShareDialogOpen(false);
  }, [id]);

  const getStatusValue = () => normalizedMeeting?.status?.short_name?.toLowerCase() || '';
  const getStatusIcon = () => STATUS_CONFIG[getStatusValue()]?.icon || <ScheduleIcon />;
  const getStatusDisplay = () => normalizedMeeting?.status?.short_name || 'Unknown';

  if (loading && !currentMeeting && !showNotFound) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: isDarkMode ? DARK.surface : '#FFFFFF' }}>
            <CircularProgress size={50} sx={{ mb: 3, color: '#7C3AED' }} />
            <Typography variant="h5" fontWeight={600}>Loading Meeting Details</Typography>
            <LoadingTimeout timeout={NOT_FOUND_DELAY_MS} />
          </Paper>
        </Container>
      </Box>
    );
  }

  if (showNotFound && !currentMeeting) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: isDarkMode ? DARK.surface : '#FFFFFF' }}>
            <ErrorOutlinedIcon sx={{ fontSize: 48, color: '#EF4444', mb: 2 }} />
            <Typography variant="h5" color="error" fontWeight={700}>Meeting Not Found</Typography>
            <Button variant="contained" onClick={() => navigate('/meetings')} sx={{ mt: 3, bgcolor: '#7C3AED' }}>Back to Meetings</Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6' }}>
      <HeaderBar
        onBack={() => navigate('/meetings')} onNotify={() => setNotificationDialogOpen(true)} onRefresh={handleRefresh}
        onEdit={() => navigate(`/meetings/${id}/edit`)} onStatusMenuOpen={(e) => setStatusMenuAnchor(e.currentTarget)}
        onMoreMenuOpen={(e) => setMoreMenuAnchor(e.currentTarget)} onUpdateLink={() => setUpdateLinkDialogOpen(true)}
        onPrintPDF={handlePrintPDF} onExportJSON={handleExportJSON} onRecord={() => navigate(`/meetings/${id}/record`)} onMobileMenuToggle={() => setMobileDrawerOpen(p => !p)}
        participantCount={participantCount} getStatusIcon={getStatusIcon} getStatusDisplay={getStatusDisplay}
        isMobile={isMobile} canRecord={canRecord} hasRecordPermission={hasRecordPermission} viewMode={viewMode}
        onViewModeChange={setViewMode} canSendNotifications={canSendNotifications} hasUpdatePermission={canUpdateMeeting}
        emailSentCount={emailSentCount} emailFailedCount={emailNotifications.filter(n => n.status === 'failed').length} onEmailHistoryOpen={() => navigate(`/meetings/${id}/notifications`)} isDarkMode={isDarkMode}
      />

      <Container maxWidth="xl" sx={{ py: 2.5 }}>
        {(error || localError) && (
          <Alert severity="error" onClose={() => setLocalError(null)} sx={{ mb: 3 }}>
            {typeof error === 'string' ? error : (localError || 'Failed to load meeting')}
          </Alert>
        )}

        <MeetingTitleBar meeting={normalizedMeeting} isMobile={isMobile} />

        {visibleTabsForMode.length > 0 && (
          <Paper sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: isDarkMode ? DARK.surface : '#FFFFFF', border: 1, borderColor: isDarkMode ? DARK.border : '#E5E7EB' }}>
            {!isMobile && (
              <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: isDarkMode ? DARK.surfaceAlt : alpha('#7C3AED', 0.045), borderBottom: 1, borderColor: isDarkMode ? DARK.borderStrong : '#E5E7EB' }}>
                <Tabs value={effectiveTabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
                  {orderedVisibleTabsForMode.map((tab) => {
                    const isDraggable = tab.value !== PINNED_TAB_VALUE;
                    return (
                      <Tab
                        key={tab.value} value={tab.value} icon={tab.icon} iconPosition="start" label={tab.label}
                        draggable={isDraggable}
                        onDragStart={(e) => handleTabDragStart(e, tab.value)}
                        onDragOver={(e) => handleTabDragOver(e, tab.value)}
                        onDrop={(e) => handleTabDrop(e, tab.value)}
                        sx={{
                          cursor: isDraggable ? 'grab' : 'default',
                          opacity: isDraggingTab && draggedTabValue === tab.value ? 0.35 : 1,
                          boxShadow: isDraggingTab && dragOverTabValue === tab.value && isDraggable ? `inset 3px 0 0 0 #7C3AED` : 'none'
                        }}
                      />
                    );
                  })}
                </Tabs>
              </Box>
            )}

            <Box sx={{ p: 2 }}>
              <TabPanel value={effectiveTabValue} index={0}>
                <MeetingOverviewTab meeting={normalizedMeeting} onUpdateLink={() => setUpdateLinkDialogOpen(true)} onJoinMeeting={handleRefresh} />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={1}>
                <MeetingMinutes meetingId={id} meetingStatus={normalizedMeeting?.status?.short_name} onRefresh={handleRefresh} />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={2}>
                <MeetingActionsList meetingId={id} meetingStatus={normalizedMeeting?.status?.short_name} onRefresh={handleRefresh} />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={3}>
                <ParticipantsTab meetingId={id} participants={participants} onRefresh={fetchParticipants} meetingStatus={normalizedMeeting?.status?.short_name} />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={4}>
                <MeetingDocuments meetingId={id} meetingStatus={normalizedMeeting?.status?.short_name} onRefresh={handleRefresh} />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={5}>
                <MeetingHistory meetingId={id} />
              </TabPanel>
              {canViewAudit && (
                <TabPanel value={effectiveTabValue} index={6}>
                  <MeetingAudit meetingId={id} />
                </TabPanel>
              )}
              {hasViewRecorderPermission && (
                <TabPanel value={effectiveTabValue} index={7}>
                  <MeetingRecorder meetingId={id} />
                </TabPanel>
              )}
            </Box>
          </Paper>
        )}
      </Container>

      {/* Mobile Speed Dial Menu */}
      {isMobile && speedDialActions.length > 0 && (
        <Zoom in={true}>
          <SpeedDial ariaLabel="Meeting Actions" sx={{ position: 'fixed', bottom: 16, right: 16 }} icon={<SpeedDialIcon />} onClose={() => setSpeedDialOpen(false)} onOpen={() => setSpeedDialOpen(true)} open={speedDialOpen}>
            {speedDialActions.map((action) => (
              <SpeedDialAction key={action.name} icon={action.icon} tooltipTitle={action.name} onClick={() => {
                if (action.action === 'edit') navigate(`/meetings/${id}/edit`);
                if (action.action === 'notify') setNotificationDialogOpen(true);
                if (action.action === 'share') setShareDialogOpen(true);
                if (action.action === 'pdf') handlePrintPDF();
                if (action.action === 'delete') setDeleteDialogOpen(true);
                setSpeedDialOpen(false);
              }} />
            ))}
          </SpeedDial>
        </Zoom>
      )}

      {/* Desktop Context Menu wrappers */}
      <Menu anchorEl={moreMenuAnchor} open={Boolean(moreMenuAnchor)} onClose={() => setMoreMenuAnchor(null)}>
        <MenuItem onClick={() => { setUpdateLinkDialogOpen(true); setMoreMenuAnchor(null); }}><ListItemIcon><UpdateIcon /></ListItemIcon>Update Meeting Link</MenuItem>
        {canSendNotifications && <MenuItem onClick={() => { setNotificationDialogOpen(true); setMoreMenuAnchor(null); }}><ListItemIcon><NotificationsIcon /></ListItemIcon>Send Notifications</MenuItem>}
        {canUpdateMeeting && <MenuItem onClick={() => { navigate(`/meetings/${id}/edit`); setMoreMenuAnchor(null); }}><ListItemIcon><Edit /></ListItemIcon>Edit Meeting</MenuItem>}
        <MenuItem onClick={() => { setShareDialogOpen(true); setMoreMenuAnchor(null); }}><ListItemIcon><ShareIcon /></ListItemIcon>Share Meeting</MenuItem>
        {canDeleteMeeting && <MenuItem onClick={() => { setDeleteDialogOpen(true); setMoreMenuAnchor(null); }} sx={{ color: 'error.main' }}><ListItemIcon><Delete sx={{ color: 'error.main' }} /></ListItemIcon>Delete Meeting</MenuItem>}
      </Menu>

      <Menu anchorEl={statusMenuAnchor} open={Boolean(statusMenuAnchor)} onClose={() => setStatusMenuAnchor(null)}>
        {Object.entries(STATUS_CONFIG).map(([key, value]) => (
          <MenuItem key={key} onClick={() => { setSelectedStatus(key); setStatusDialogOpen(true); setStatusMenuAnchor(null); }}>
            <ListItemIcon>{value.icon}</ListItemIcon>{value.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Action Dialog Overlays */}
      <MobileNavigationDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} visibleTabs={orderedVisibleTabsForMode} effectiveTabValue={effectiveTabValue} onTabSelect={handleTabChange} isDarkMode={isDarkMode} />
      
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Meeting</DialogTitle>
        <DialogContent><Typography>Are you sure you want to delete this meeting permanently?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Meeting Status</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth multiline rows={3} label="Comment (Optional)" value={statusComment} onChange={(e) => setStatusComment(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleStatusUpdate} disabled={statusUpdating} sx={{ bgcolor: '#7C3AED' }}>Update</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share Meeting</DialogTitle>
        <DialogContent>
          <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: alpha('#7C3AED', 0.05) }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{`${window.location.origin}/meetings/${id}`}</Typography>
            <IconButton onClick={handleShare} size="small" sx={{ color: '#7C3AED' }}><CopyAllIcon /></IconButton>
          </Paper>
        </DialogContent>
        <DialogActions><Button onClick={() => setShareDialogOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <UpdateMeetingLinkDialog open={updateLinkDialogOpen} onClose={() => setUpdateLinkDialogOpen(false)} meeting={normalizedMeeting} onUpdate={handleRefresh} />
      <NotificationDialog open={notificationDialogOpen} onClose={() => setNotificationDialogOpen(false)} meeting={normalizedMeeting} participants={participants} onSend={handleRefresh} sending={sendingNotifications} hasEmailPermission={hasSendEmailNotificationPermission} hasInAppPermission={hasSendInAppNotificationPermission} />

      <Snackbar open={snackbar.open} autoHideDuration={SNACKBAR_AUTO_HIDE_MS} onClose={() => setSnackbar(p => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default memo(MeetingDetail);