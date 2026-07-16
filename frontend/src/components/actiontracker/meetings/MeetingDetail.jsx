// src/components/meetings/MeetingDetail.jsx
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  AppBar,
  Toolbar,
  useMediaQuery,
  useTheme,
  Badge,
  Snackbar,
  alpha,
  LinearProgress,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Zoom,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as Edit,
  Delete as Delete,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Refresh as RefreshIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Schedule as ScheduleIcon,
  Cancel as Cancel,
  MoreVert as MoreVertIcon,
  Notifications as NotificationsIcon,
  History as HistoryIcon,
  Update as UpdateIcon,
  ErrorOutlined as ErrorOutlinedIcon,
  HourglassEmpty as HourglassEmptyIcon,
  FiberManualRecord as FiberManualRecordIcon,
  Share as ShareIcon,
  CopyAll as CopyAllIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Code as CodeIcon,
  ViewStream as ViewStreamIcon,
  ViewAgenda as ViewAgendaIcon,
  MarkEmailRead as MarkEmailReadIcon,
  Info as InfoIcon,
  Restore as RestoreIcon,
} from '@mui/icons-material';
import {
  fetchMeetingById,
  clearMeetingState,
  updateMeetingStatus,
  deleteMeeting,
  fetchActionTrackerAttributes,
  selectCurrentMeeting,
  selectMeetingsLoading,
  selectMeetingsError,
  selectMeetingStatusOptions,
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
  sendMeetingNotifications,
  fetchMeetingParticipants,
  selectNotificationParticipants,
  selectNotificationSending,
  selectNotificationError,
  selectLastNotificationResult,
  clearNotificationError,
  clearLastNotificationResult,
} from '../../../store/slices/actionTracker/notificationSlice';
import MeetingAudit from './MeetingAudit';
import MeetingRecorder from './MeetingRecorder';
import api from '../../../services/api';
import { selectUserPermissions, hasPermission } from '../../../store/slices/authSlice';

import MeetingEmailNotifications from './components/meetings/MeetingEmailNotifications.jsx';

// ==================== Permission Constants ====================
const PERMISSIONS = {
  DELETE_MEETING: 'meeting:delete',
  UPDATE_MEETING: 'meeting:update',
  CREATE_MEETING: 'meeting:create',
  VIEW_ALL_MEETINGS: 'meeting:view_all',
  VIEW_OWN_MEETINGS: 'meeting:view',
  CHANGE_STATUS: 'meeting:status_change',
  RECORD_MEETING: 'meeting:record',
  VIEW_RECORDER: 'meeting:view_recorder',
  SEND_NOTIFICATIONS: 'notification:send',
  SEND_EMAIL_NOTIFICATIONS: 'notification:email',
  VIEW_NOTIFICATIONS: 'notification:view',
  MANAGE_NOTIFICATION_TEMPLATES: 'notification:manage_templates',
  ADD_MINUTES: 'minutes:add',
  EDIT_MINUTES: 'minutes:edit',
  DELETE_MINUTES: 'minutes:delete',
  APPROVE_MINUTES: 'minutes:approve',
  SIGN_MINUTES: 'minutes:sign',
  VIEW_MINUTES: 'minutes:view',
  EXPORT_MINUTES: 'minutes:export',
  CREATE_ACTIONS: 'action:create',
  UPDATE_ACTIONS: 'action:update',
  DELETE_ACTIONS: 'action:delete',
  ASSIGN_ACTIONS: 'action:assign',
  COMMENT_ACTIONS: 'action:comment',
  UPDATE_ACTION_STATUS: 'action:status_update',
  UPDATE_ACTION_PRIORITY: 'action:priority_update',
  VIEW_ALL_ACTIONS: 'action:view_all',
  VIEW_OWN_ACTIONS: 'action:view_own',
  ADD_ACTION_ATTACHMENTS: 'action:attachment',
  ACTION_REPORTS: 'report:action',
  ADD_PARTICIPANTS: 'participant:add',
  REMOVE_PARTICIPANTS: 'participant:remove',
  VIEW_PARTICIPANTS: 'participant:view',
  MANAGE_PARTICIPANT_LISTS: 'participant:manage_lists',
  EXPORT_REPORTS: 'report:export',
  VIEW_REPORTS: 'report:view',
  MEETING_REPORTS: 'report:meeting',
  PARTICIPANT_REPORTS: 'report:participant',
  VIEW_FINANCIAL_REPORTS: 'report:financial',
  VIEW_DASHBOARD: 'dashboard:view',
  CUSTOMIZE_DASHBOARD: 'dashboard:customize',
  DASHBOARD_OVERVIEW: 'dashboard:overview',
  UPCOMING_MEETINGS_WIDGET: 'dashboard:upcoming_meetings',
  RECENT_MEETINGS_WIDGET: 'dashboard:recent_meetings',
  PENDING_ACTIONS_WIDGET: 'dashboard:pending_actions',
  OVERDUE_ACTIONS_WIDGET: 'dashboard:overdue_actions',
  NOTIFICATIONS_WIDGET: 'dashboard:notifications',
  VIEW_AUDIT_LOGS: 'admin:view_audit',
  MANAGE_LOCATIONS: 'admin:manage_locations',
  CREATE_STRUCTURE: 'structure:create',
  UPDATE_STRUCTURE: 'structure:update',
  DELETE_STRUCTURE: 'structure:delete',
  READ_STRUCTURE: 'structure:read',
  MANAGE_ADMIN_STRUCTURES: 'admin:manage_structures',
  CREATE_USER: 'user:create',
  UPDATE_USER: 'user:update',
  DELETE_USER: 'user:delete',
  READ_USER: 'user:read',
  MANAGE_USERS: 'admin:manage_users',
  VIEW_OTHERS_PROFILES: 'profile:view_others',
  UPDATE_PROFILE: 'profile:update',
  READ_PROFILE: 'profile:read',
  VIEW_PROFILE: 'profile:view',
  CHANGE_PASSWORD: 'profile:change_password',
  MANAGE_ROLES: 'admin:manage_roles',
  ASSIGN_ROLE: 'role:assign',
  MANAGE_MENU_ASSIGNMENT: 'admin:manage_menu_assignment',
  CREATE_PAYMENT: 'payment:create',
  READ_PAYMENT: 'payment:read',
  UPDATE_PAYMENT: 'payment:update',
  PROCESS_PAYMENT: 'payment:process',
  CREATE_LEASE: 'lease:create',
  READ_LEASE: 'lease:read',
  UPDATE_LEASE: 'lease:update',
  TERMINATE_LEASE: 'lease:terminate',
  CREATE_TENANT: 'tenant:create',
  READ_TENANT: 'tenant:read',
  UPDATE_TENANT: 'tenant:update',
  DELETE_TENANT: 'tenant:delete',
};

// ==================== Constants ====================
const NOT_FOUND_DELAY_MS = 7000;
const SNACKBAR_AUTO_HIDE_MS = 6000;
const TAB_STORAGE_KEY_PREFIX = 'meeting_detail_last_tab_';
const TAB_ORDER_STORAGE_KEY_PREFIX = 'meeting_detail_tab_order_';
const PINNED_TAB_VALUE = 0; // Overview - always first, not draggable

// Elegant near-black dark palette (replaces flat Tailwind-slate grays).
// A single true-black-adjacent surface family with a faint warm undertone,
// rather than blue-gray slate — reads as considered rather than a default.
const DARK = {
  bg: '#0B0B0D',
  surface: '#161618',
  surfaceAlt: '#1D1D20',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  textSecondary: '#A3A3AA',
};

// Status configurations
const STATUS_CONFIG = {
  pending:     { label: 'Pending',     icon: <ScheduleIcon />,     color: 'warning', action: 'Schedule Meeting'  },
  started:     { label: 'In Progress', icon: <PendingIcon />,      color: 'info',    action: 'Start Meeting'     },
  ongoing:     { label: 'In Progress', icon: <PendingIcon />,      color: 'info',    action: 'Continue Meeting'  },
  in_progress: { label: 'In Progress', icon: <PendingIcon />,      color: 'info',    action: 'Continue Meeting'  },
  ended:       { label: 'Ended',       icon: <CheckCircleIcon />,  color: 'success', action: 'End Meeting'       },
  closed:      { label: 'Closed',      icon: <CheckCircleIcon />,  color: 'success', action: 'Close Meeting'     },
  cancelled:   { label: 'Cancelled',   icon: <Cancel />,       color: 'error',   action: 'Cancel Meeting'    },
  awaiting:    { label: 'Awaiting',    icon: <HourglassEmptyIcon />, color: 'warning', action: 'Awaiting Action' },
};

// Tab configurations with proper permission codes
const TABS = [
  { label: 'Overview',     icon: <InfoIcon />,               value: 0, simple: true, requiresPermission: null },
  { label: 'Minutes',      icon: <DescriptionIcon />,       value: 1, simple: true, requiresPermission: PERMISSIONS.VIEW_MINUTES },
  { label: 'Actions',      icon: <AssignmentIcon />,        value: 2, simple: true, requiresPermission: PERMISSIONS.VIEW_OWN_ACTIONS },
  { label: 'Participants', icon: <PeopleIcon />,            value: 3, simple: true, requiresPermission: PERMISSIONS.VIEW_PARTICIPANTS },
  { label: 'Documents',    icon: <DescriptionIcon />,       value: 4, simple: false, requiresPermission: null },
  { label: 'History',      icon: <HistoryIcon />,           value: 5, simple: false, requiresPermission: null },
  { label: 'Audit',        icon: <HistoryIcon />,           value: 6, simple: false, requiresPermission: PERMISSIONS.VIEW_AUDIT_LOGS },
  { label: 'Recordings',   icon: <FiberManualRecordIcon />, value: 7, simple: false, requiresPermission: PERMISSIONS.VIEW_RECORDER },
];

// Speed Dial Actions
const getSpeedDialActions = (hasUpdatePermission, hasNotificationPermission, hasEmailPermission, hasExportPermission, hasDeletePermission) => {
  const actions = [];
  if (hasUpdatePermission) actions.push({ icon: <Edit />, name: 'Edit', action: 'edit' });
  if (hasNotificationPermission || hasEmailPermission) actions.push({ icon: <NotificationsIcon />, name: 'Notify', action: 'notify' });
  actions.push({ icon: <ShareIcon />, name: 'Share', action: 'share' });
  if (hasExportPermission) {
    actions.push({ icon: <PictureAsPdfIcon />, name: 'PDF Report', action: 'pdf' });
    actions.push({ icon: <CodeIcon />, name: 'Export JSON', action: 'json' });
  }
  if (hasDeletePermission) actions.push({ icon: <Delete />, name: 'Delete', action: 'delete' });
  return actions;
};

// ==================== Helper Functions ====================
const normalizeStatus = (status) => {
  if (!status) return null;
  if (status.short_name) return status;
  if (typeof status === 'string' && status.includes('_')) {
    const parts = status.split('_');
    return { short_name: parts[parts.length - 1].toLowerCase(), name: status, code: status, id: null };
  }
  if (typeof status === 'string') return { short_name: status.toLowerCase(), name: status, code: status, id: null };
  return status;
};

// ==================== Tab Panel Component ====================
const TabPanel = memo(({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`meeting-tabpanel-${index}`}
    aria-labelledby={`meeting-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
));
TabPanel.displayName = 'TabPanel';

// ==================== Loading Timeout Component ====================
const LoadingTimeout = ({ timeout }) => {
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
};

// ==================== View Mode Toggle ====================
const ViewModeToggle = memo(({ viewMode, onChange }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <Tooltip title={viewMode === 'simple' ? 'Switch to Detailed view' : 'Switch to Simple view'} arrow>
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
            px: { xs: 1, sm: 1.75 },
            py: 0.5,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.75rem',
            color: isDarkMode ? DARK.textSecondary : 'text.secondary',
            gap: 0.6,
            '&.Mui-selected': {
              bgcolor: alpha('#7C3AED', 0.12),
              color: '#7C3AED',
              '&:hover': { bgcolor: alpha('#7C3AED', 0.18) },
            },
          },
        }}
      >
        <ToggleButton value="simple">
          <ViewStreamIcon sx={{ fontSize: 15 }} />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Simple</Box>
        </ToggleButton>
        <ToggleButton value="detailed">
          <ViewAgendaIcon sx={{ fontSize: 15 }} />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Detailed</Box>
        </ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
});
ViewModeToggle.displayName = 'ViewModeToggle';

// ==================== Header Bar ====================
const HeaderBar = memo(({
  onBack,
  onNotify,
  onRefresh,
  onEdit,
  onStatusMenuOpen,
  onMoreMenuOpen,
  onUpdateLink,
  onShare,
  onPrintPDF,
  onExportJSON,
  onRecord,
  participantCount,
  getStatusIcon,
  getStatusDisplay,
  isMobile,
  canRecord,
  hasRecordPermission,
  viewMode,
  onViewModeChange,
  canSendNotifications,
  hasUpdatePermission,
  emailSentCount,
  emailFailedCount,
  onEmailHistoryOpen,
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const emailTooltipTitle = `${emailSentCount} email${emailSentCount !== 1 ? 's' : ''} sent${emailFailedCount ? ` \u00b7 ${emailFailedCount} failed` : ''}`;

  return (
    <AppBar
      position="sticky"
      elevation={isDarkMode ? 0 : 2}
      sx={{
        bgcolor: isDarkMode ? DARK.surfaceAlt : '#FFFFFF',
        borderBottom: 1,
        borderColor: isDarkMode ? DARK.border : '#E5E7EB',
        zIndex: theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ px: { xs: 1.5, sm: 3 }, minHeight: { md: 56 } }}>
        <IconButton onClick={onBack} edge="start" sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>

        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
          Meeting Details
        </Typography>

        <Box sx={{ mr: { xs: 1, sm: 2 } }}>
          <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
        </Box>

        {isMobile ? (
          <Stack direction="row" spacing={0.5}>
            {canSendNotifications && (
              <IconButton onClick={onNotify}>
                <Badge badgeContent={participantCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            )}
            <Tooltip title={emailTooltipTitle} arrow>
              <IconButton onClick={onEmailHistoryOpen}>
                <Badge badgeContent={emailSentCount} color="success" max={99}>
                  <MarkEmailReadIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <IconButton onClick={onRefresh}><RefreshIcon /></IconButton>
            <IconButton onClick={onMoreMenuOpen}><MoreVertIcon /></IconButton>
          </Stack>
        ) : (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Generate PDF Report"><IconButton onClick={onPrintPDF} size="small"><PictureAsPdfIcon /></IconButton></Tooltip>
            <Tooltip title="Update Meeting Link"><IconButton onClick={onUpdateLink} size="small"><UpdateIcon /></IconButton></Tooltip>
            {canSendNotifications && (
              <Tooltip title="Send Notifications" arrow>
                <IconButton onClick={onNotify} size="small">
                  <Badge badgeContent={participantCount} color="error"><NotificationsIcon /></Badge>
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={emailTooltipTitle} arrow>
              <IconButton onClick={onEmailHistoryOpen} size="small">
                <Badge badgeContent={emailSentCount} color="success" max={99}>
                  <MarkEmailReadIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh"><IconButton onClick={onRefresh} size="small"><RefreshIcon /></IconButton></Tooltip>
            {hasUpdatePermission && (
              <Tooltip title="Edit Meeting"><IconButton onClick={onEdit} size="small"><Edit /></IconButton></Tooltip>
            )}
            {canRecord && hasRecordPermission && (
              <Tooltip title="Record Meeting" arrow>
                <IconButton onClick={onRecord} size="small" sx={{ color: '#f44336' }}>
                  <FiberManualRecordIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Update Status">
              <Button
                variant={isDarkMode ? 'outlined' : 'contained'}
                size="small"
                startIcon={getStatusIcon()}
                onClick={onStatusMenuOpen}
                sx={{ textTransform: 'none', ml: 0.5 }}
              >
                {getStatusDisplay()}
              </Button>
            </Tooltip>
            <Tooltip title="More Options"><IconButton onClick={onMoreMenuOpen} size="small"><MoreVertIcon /></IconButton></Tooltip>
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
});
HeaderBar.displayName = 'HeaderBar';

// ==================== Meeting Title Bar (always visible; slim) ====================
const MeetingTitleBar = memo(({ meeting, isMobile }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const statusConfig = STATUS_CONFIG[meeting?.status?.short_name?.toLowerCase()] || STATUS_CONFIG.pending;

  return (
    <Box
      sx={{
        mb: 2,
        px: { xs: 2, sm: 2.5 },
        py: 1.5,
        borderRadius: 3,
        border: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}`,
        bgcolor: isDarkMode ? DARK.surface : '#FFFFFF',
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        gap: 1.5,
      }}
    >
      <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={800} sx={{ fontSize: { md: '1.25rem' } }}>
        {meeting?.title}
      </Typography>
      <Chip label={statusConfig.label} color={statusConfig.color} icon={statusConfig.icon} sx={{ fontWeight: 600, flexShrink: 0 }} />
    </Box>
  );
});
MeetingTitleBar.displayName = 'MeetingTitleBar';

// ==================== Main Component ====================
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
  const statusOptions = useSelector(selectMeetingStatusOptions);
  const participants = useSelector(selectNotificationParticipants);
  const sendingNotifications = useSelector(selectNotificationSending);
  const notificationError = useSelector(selectNotificationError);
  const lastNotificationResult = useSelector(selectLastNotificationResult);

  const userPermissions = useSelector(selectUserPermissions);
  const currentUser = useSelector((state) => state.auth.user);

  const hasDeleteMeetingPermission = hasPermission(userPermissions, PERMISSIONS.DELETE_MEETING);
  const hasUpdateMeetingPermission = hasPermission(userPermissions, PERMISSIONS.UPDATE_MEETING);
  const hasRecordPermission = hasPermission(userPermissions, PERMISSIONS.RECORD_MEETING);
  const hasViewRecorderPermission = hasPermission(userPermissions, PERMISSIONS.VIEW_RECORDER);
  const hasSendInAppNotificationPermission = hasPermission(userPermissions, PERMISSIONS.SEND_NOTIFICATIONS);
  const hasSendEmailNotificationPermission = hasPermission(userPermissions, PERMISSIONS.SEND_EMAIL_NOTIFICATIONS);
  const hasExportReportPermission = hasPermission(userPermissions, PERMISSIONS.EXPORT_REPORTS);
  const hasViewAuditPermission = hasPermission(userPermissions, PERMISSIONS.VIEW_AUDIT_LOGS);

  const isAdmin = currentUser?.is_superuser || currentUser?.is_admin || false;

  const canDeleteMeeting = isAdmin || hasDeleteMeetingPermission;
  const canUpdateMeeting = isAdmin || hasUpdateMeetingPermission;
  const canSendNotifications = hasSendInAppNotificationPermission || hasSendEmailNotificationPermission;
  const canExportReports = isAdmin || hasExportReportPermission;
  const canViewAudit = isAdmin || hasViewAuditPermission;

  // ---- Tab persistence: restore the last tab selected for THIS meeting id (if any) ----
  const [tabValue, setTabValue] = useState(() => {
    try {
      const saved = localStorage.getItem(`${TAB_STORAGE_KEY_PREFIX}${id}`);
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // ---- Tab order persistence: restore custom drag-and-drop tab order for THIS meeting id ----
  const [tabOrder, setTabOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(`${TAB_ORDER_STORAGE_KEY_PREFIX}${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore malformed storage
    }
    return TABS.map((t) => t.value);
  });

  // Drag-and-drop state for tab reordering
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

  // ==== Email notification badge count ====
  // Only fetched to drive the header badge/tooltip count - clicking the
  // icon navigates to a dedicated full page (MeetingEmailNotifications)
  // rather than opening an in-place dialog.
  const [emailNotifications, setEmailNotifications] = useState([]);

  const fetchEmailNotifications = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.get('/notifications', {
        params: { meeting_id: id, channel: 'email', limit: 50 }
      });
      setEmailNotifications(response.data?.items || []);
    } catch (err) {
      console.error('Error fetching email notification count:', err);
    }
  }, [id]);

  const emailSentCount = useMemo(
    () => emailNotifications.filter((n) => n.status === 'successful').length,
    [emailNotifications]
  );
  const emailFailedCount = useMemo(
    () => emailNotifications.filter((n) => n.status === 'failed').length,
    [emailNotifications]
  );

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const speedDialActions = useMemo(() => getSpeedDialActions(
    canUpdateMeeting,
    hasSendInAppNotificationPermission,
    hasSendEmailNotificationPermission,
    canExportReports,
    canDeleteMeeting
  ), [canUpdateMeeting, hasSendInAppNotificationPermission, hasSendEmailNotificationPermission, canExportReports, canDeleteMeeting]);

  const normalizedMeeting = useMemo(
    () => (currentMeeting ? { ...currentMeeting, status: normalizeStatus(currentMeeting.status) } : null),
    [currentMeeting]
  );

  const isOnlineMeeting = useMemo(
    () => normalizedMeeting?.platform && normalizedMeeting?.platform !== 'physical',
    [normalizedMeeting?.platform]
  );

  const hasMeetingLink = useMemo(
    () => normalizedMeeting?.meeting_link,
    [normalizedMeeting?.meeting_link]
  );

  const participantCount = useMemo(() => participants.length, [participants]);

  const canRecord = useMemo(
    () => normalizedMeeting?.status?.short_name === 'started' ||
          normalizedMeeting?.status?.short_name === 'ongoing' ||
          normalizedMeeting?.status?.short_name === 'in_progress',
    [normalizedMeeting?.status?.short_name]
  );

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

  // Tabs actually shown given the current view mode (simple vs detailed).
  const visibleTabsForMode = useMemo(
    () => visibleTabs.filter((t) => viewMode === 'detailed' || t.simple),
    [visibleTabs, viewMode]
  );

  // ---- Apply the user's custom drag-and-drop order on top of the
  // permission/view-mode-filtered tab list. Any tab not yet present in
  // tabOrder (e.g. newly granted permission) is appended at the end. ----
  const orderedVisibleTabsForMode = useMemo(() => {
    const byValue = new Map(visibleTabsForMode.map((t) => [t.value, t]));
    const ordered = [];
    tabOrder.forEach((v) => {
      if (byValue.has(v)) {
        ordered.push(byValue.get(v));
        byValue.delete(v);
      }
    });
    byValue.forEach((t) => ordered.push(t));
    return ordered;
  }, [visibleTabsForMode, tabOrder]);

  // ---- FIX: always render Tabs/TabPanels with a value that's actually visible ----
  const isTabValueVisible = visibleTabsForMode.some((t) => t.value === tabValue);
  const effectiveTabValue = isTabValueVisible
    ? tabValue
    : (visibleTabsForMode[0]?.value ?? tabValue);

  // ---- FIX: keep the selected tab in sync with what's actually visible ----
  useEffect(() => {
    if (visibleTabsForMode.length === 0) return;
    if (!isTabValueVisible) {
      setTabValue(visibleTabsForMode[0].value);
    }
  }, [visibleTabsForMode, isTabValueVisible]);

  // ---- Tab persistence: whenever the meeting id changes, restore whatever tab
  // was last selected for that specific meeting (defaults to Overview if none saved) ----
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${TAB_STORAGE_KEY_PREFIX}${id}`);
      setTabValue(saved !== null ? parseInt(saved, 10) : 0);
    } catch {
      setTabValue(0);
    }
  }, [id]);

  // ---- Tab persistence: save the current tab selection for this meeting id ----
  useEffect(() => {
    if (!id) return;
    try {
      localStorage.setItem(`${TAB_STORAGE_KEY_PREFIX}${id}`, String(tabValue));
    } catch {
      // ignore storage errors (e.g. private browsing / quota exceeded)
    }
  }, [tabValue, id]);

  // ---- Tab order persistence: whenever the meeting id changes, restore whatever
  // custom order was last saved for that specific meeting (defaults to natural order) ----
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${TAB_ORDER_STORAGE_KEY_PREFIX}${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTabOrder(parsed);
          return;
        }
      }
    } catch {
      // ignore malformed storage
    }
    setTabOrder(TABS.map((t) => t.value));
  }, [id]);

  // ---- Tab order persistence: save the current custom order for this meeting id ----
  useEffect(() => {
    if (!id) return;
    try {
      localStorage.setItem(`${TAB_ORDER_STORAGE_KEY_PREFIX}${id}`, JSON.stringify(tabOrder));
    } catch {
      // ignore storage errors (e.g. private browsing / quota exceeded)
    }
  }, [tabOrder, id]);

  const getStatusValue = useCallback(() => {
    const status = normalizedMeeting?.status;
    if (!status) return '';
    if (status.short_name) return status.short_name.toLowerCase();
    if (typeof status === 'string') {
      if (status.includes('_')) return status.split('_').pop().toLowerCase();
      return status.toLowerCase();
    }
    return '';
  }, [normalizedMeeting?.status]);

  const getStatusColor = useCallback(() => STATUS_CONFIG[getStatusValue()]?.color || 'default', [getStatusValue]);
  const getStatusIcon = useCallback(() => STATUS_CONFIG[getStatusValue()]?.icon || <ScheduleIcon />, [getStatusValue]);
  const getStatusDisplay = useCallback(() => {
    const status = normalizedMeeting?.status;
    if (!status) return 'Unknown';
    if (status.short_name) return status.short_name.charAt(0).toUpperCase() + status.short_name.slice(1);
    if (typeof status === 'string') {
      if (status.includes('_')) {
        const part = status.split('_').pop();
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
      return status.charAt(0).toUpperCase() + status.slice(1);
    }
    return status.name || 'Unknown';
  }, [normalizedMeeting?.status]);

  const fetchMeeting = useCallback(() => { if (id) dispatch(fetchMeetingById(id)); }, [id, dispatch]);
  const fetchParticipants = useCallback(() => { if (id) dispatch(fetchMeetingParticipants(id)); }, [id, dispatch]);

  const handlePrintPDF = useCallback(async () => {
    if (!canExportReports) {
      setSnackbar({ open: true, message: 'You don\'t have permission to export reports', severity: 'error' });
      return;
    }
    setSnackbar({ open: true, message: 'Generating PDF report...', severity: 'info' });
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/meetings/${id}/report/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to generate report');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meeting_report_${id}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'PDF Report generated successfully!', severity: 'success' });
    } catch (error) {
      console.error('Error generating report:', error);
      setSnackbar({ open: true, message: 'Failed to generate report', severity: 'error' });
    }
  }, [id, canExportReports]);

  const handleExportJSON = useCallback(async () => {
    if (!canExportReports) {
      setSnackbar({ open: true, message: 'You don\'t have permission to export data', severity: 'error' });
      return;
    }
    setSnackbar({ open: true, message: 'Exporting data...', severity: 'info' });
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/meetings/${id}/report`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to export data');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meeting_data_${id}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'Data exported successfully!', severity: 'success' });
    } catch (error) {
      console.error('Error exporting data:', error);
      setSnackbar({ open: true, message: 'Failed to export data', severity: 'error' });
    }
  }, [id, canExportReports]);

  useEffect(() => {
    setShowNotFound(false);
    setLoadingTimeout(false);
    setInitialLoadComplete(false);
  }, [id]);

  useEffect(() => {
    if (loading && !initialLoadComplete) {
      setTimeout(() => setLoadingTimeout(true), NOT_FOUND_DELAY_MS);
    }
  }, [loading, initialLoadComplete]);

  useEffect(() => {
    if (currentMeeting || error) setInitialLoadComplete(true);
  }, [currentMeeting, error]);

  useEffect(() => {
    if (!loading && !currentMeeting && initialLoadComplete) {
      setTimeout(() => setShowNotFound(true), 500);
    } else if (loadingTimeout && !currentMeeting && !error) {
      setShowNotFound(true);
    }
  }, [loading, currentMeeting, initialLoadComplete, loadingTimeout, error]);

  useEffect(() => {
    if (id) {
      fetchMeeting();
      fetchParticipants();
      fetchEmailNotifications();
      dispatch(fetchActionTrackerAttributes());
    }
    return () => {
      dispatch(clearMeetingState());
      dispatch(clearNotificationError());
      dispatch(clearLastNotificationResult());
    };
  }, [id, dispatch, fetchMeeting, fetchParticipants, fetchEmailNotifications]);

  useEffect(() => {
    if (lastNotificationResult) {
      setSnackbar({ open: true, message: `✅ Notifications sent to ${lastNotificationResult.sent} participants!`, severity: 'success' });
      setNotificationDialogOpen(false);
      fetchEmailNotifications();
      dispatch(clearLastNotificationResult());
    }
  }, [lastNotificationResult, dispatch, fetchEmailNotifications]);

  useEffect(() => {
    if (notificationError) {
      setSnackbar({ open: true, message: notificationError, severity: 'error' });
      dispatch(clearNotificationError());
    }
  }, [notificationError, dispatch]);

  const handleRefresh = useCallback(() => {
    setShowNotFound(false);
    setLoadingTimeout(false);
    setInitialLoadComplete(false);
    fetchMeeting();
    fetchParticipants();
    fetchEmailNotifications();
  }, [fetchMeeting, fetchParticipants, fetchEmailNotifications]);

  const handleBack = useCallback(() => navigate('/meetings'), [navigate]);
  const handleEdit = useCallback(() => {
    if (!canUpdateMeeting) {
      setSnackbar({ open: true, message: 'You don\'t have permission to edit meetings', severity: 'error' });
      return;
    }
    navigate(`/meetings/${id}/edit`);
  }, [navigate, id, canUpdateMeeting]);

  const handleRecord = useCallback(() => {
    if (!hasRecordPermission) {
      setSnackbar({ open: true, message: 'You don\'t have permission to record meetings', severity: 'error' });
      return;
    }
    navigate(`/meetings/${id}/record`);
  }, [navigate, id, hasRecordPermission]);

  const handleJoinMeeting = useCallback(() => {
    if (!normalizedMeeting) return;
    if (isOnlineMeeting && hasMeetingLink) {
      let meetingUrl = normalizedMeeting.meeting_link;
      if (!meetingUrl.startsWith('http://') && !meetingUrl.startsWith('https://')) {
        meetingUrl = 'https://' + meetingUrl;
      }
      window.open(meetingUrl, '_blank');
    } else if (!isOnlineMeeting && normalizedMeeting.location_text) {
      setSnackbar({ open: true, message: `📍 Physical Location: ${normalizedMeeting.location_text}`, severity: 'info' });
    } else {
      setSnackbar({ open: true, message: 'No meeting link or location available', severity: 'warning' });
    }
  }, [normalizedMeeting, isOnlineMeeting, hasMeetingLink]);

  const handleShare = useCallback(() => {
    const meetingUrl = `${window.location.origin}/meetings/${id}`;
    navigator.clipboard.writeText(meetingUrl);
    setSnackbar({ open: true, message: 'Meeting link copied to clipboard!', severity: 'success' });
    setShareDialogOpen(false);
  }, [id]);

  const handleNotifyClick = useCallback(() => {
    if (!canSendNotifications) {
      setSnackbar({ open: true, message: 'You don\'t have permission to send notifications', severity: 'error' });
      return;
    }
    fetchParticipants();
    setNotificationDialogOpen(true);
  }, [fetchParticipants, canSendNotifications]);

  const handleSendNotifications = useCallback((notificationData) => {
    if (!notificationData.notification_type || notificationData.notification_type.length === 0) {
      setSnackbar({ open: true, message: 'Please select at least one notification type', severity: 'warning' });
      return;
    }
    if (notificationData.notification_type.includes('email') && !hasSendEmailNotificationPermission) {
      setSnackbar({ open: true, message: 'You do not have permission to send email notifications', severity: 'error' });
      return;
    }
    if (notificationData.notification_type.includes('in_app') && !hasSendInAppNotificationPermission) {
      setSnackbar({ open: true, message: 'You do not have permission to send in-app notifications', severity: 'error' });
      return;
    }
    dispatch(sendMeetingNotifications({ meetingId: id, notificationData }));
  }, [id, dispatch, hasSendEmailNotificationPermission, hasSendInAppNotificationPermission]);

  const handleEmailHistoryOpen = useCallback(() => {
    navigate(`/meetings/${id}/notifications`);
  }, [navigate, id]);

  const handleStatusMenuOpen = (event) => setStatusMenuAnchor(event.currentTarget);
  const handleStatusMenuClose = () => setStatusMenuAnchor(null);
  const handleMoreMenuOpen = (event) => setMoreMenuAnchor(event.currentTarget);
  const handleMoreMenuClose = () => setMoreMenuAnchor(null);

  const handleStatusSelect = (statusValue) => {
    setSelectedStatus(statusValue);
    setStatusDialogOpen(true);
    setStatusMenuAnchor(null);
  };

const handleStatusUpdate = async () => {
  if (!selectedStatus) return;
  setStatusUpdating(true);
  try {
    console.log('Sending status update:', { id, status: selectedStatus, comment: statusComment });
    
    const result = await dispatch(updateMeetingStatus({ 
      id, 
      status: selectedStatus, 
      comment: statusComment 
    })).unwrap();
    
    console.log('Status update result:', result);
    
    // Close dialogs and reset form
    setStatusDialogOpen(false);
    setSelectedStatus('');
    setStatusComment('');
    
    // Force refresh the meeting data
    await fetchMeeting();
    
    // Show success message
    setSnackbar({ 
      open: true, 
      message: '✅ Meeting status updated successfully!', 
      severity: 'success' 
    });
  } catch (err) {
    console.error('Status update error:', err);
    setSnackbar({ 
      open: true, 
      message: err.message || 'Failed to update meeting status', 
      severity: 'error' 
    });
  } finally {
    setStatusUpdating(false);
  }
};


  const handleDeleteClick = () => {
    if (!canDeleteMeeting) {
      setSnackbar({ open: true, message: 'You don\'t have permission to delete meetings', severity: 'error' });
      return;
    }
    setDeleteDialogOpen(true);
    handleMoreMenuClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await dispatch(deleteMeeting(id)).unwrap();
      setDeleteDialogOpen(false);
      navigate('/meetings');
    } catch (err) {
      setLocalError(err.message || 'Failed to delete meeting');
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSpeedDialAction = (action) => {
    switch (action) {
      case 'edit': handleEdit(); break;
      case 'notify': handleNotifyClick(); break;
      case 'share': setShareDialogOpen(true); break;
      case 'pdf': handlePrintPDF(); break;
      case 'delete': handleDeleteClick(); break;
      default: break;
    }
    setSpeedDialOpen(false);
  };

  const handleSnackbarClose = () => setSnackbar((prev) => ({ ...prev, open: false }));
  const handleErrorClose = () => { setLocalError(null); dispatch(clearMeetingState()); };

  const handleTabChange = useCallback((_, newValue) => {
    setTabValue(newValue);
  }, []);

  // ==================== Tab Drag-and-Drop Handlers ====================
  const handleTabDragStart = useCallback((event, tabValueDragged) => {
    if (tabValueDragged === PINNED_TAB_VALUE) {
      event.preventDefault();
      return;
    }
    setDraggedTabValue(tabValueDragged);
    setIsDraggingTab(true);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(tabValueDragged));
  }, []);

  const handleTabDragOver = useCallback((event, tabValueOver) => {
    event.preventDefault();
    if (tabValueOver === PINNED_TAB_VALUE || draggedTabValue === null) return;
    event.dataTransfer.dropEffect = 'move';
    if (dragOverTabValue !== tabValueOver) {
      setDragOverTabValue(tabValueOver);
    }
  }, [draggedTabValue, dragOverTabValue]);

  const handleTabDrop = useCallback((event, tabValueDropped) => {
    event.preventDefault();
    if (
      tabValueDropped === PINNED_TAB_VALUE ||
      draggedTabValue === null ||
      draggedTabValue === tabValueDropped
    ) {
      setDraggedTabValue(null);
      setDragOverTabValue(null);
      setIsDraggingTab(false);
      return;
    }

    setTabOrder((prevOrder) => {
      const order = [...prevOrder];
      const fromIndex = order.indexOf(draggedTabValue);
      const toIndex = order.indexOf(tabValueDropped);
      if (fromIndex === -1 || toIndex === -1) return prevOrder;
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, draggedTabValue);
      return order;
    });

    setDraggedTabValue(null);
    setDragOverTabValue(null);
    setIsDraggingTab(false);
  }, [draggedTabValue]);

  const handleTabDragEnd = useCallback(() => {
    setDraggedTabValue(null);
    setDragOverTabValue(null);
    setIsDraggingTab(false);
  }, []);

  const handleResetTabOrder = useCallback(() => {
    setTabOrder(TABS.map((t) => t.value));
  }, []);

  const isTabOrderCustomized = useMemo(() => {
    const defaultOrder = TABS.map((t) => t.value);
    if (tabOrder.length !== defaultOrder.length) return true;
    return tabOrder.some((v, i) => v !== defaultOrder[i]);
  }, [tabOrder]);

  if (loading && !currentMeeting && !showNotFound) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: isDarkMode ? DARK.surface : '#FFFFFF', border: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}` }}>
            <CircularProgress size={60} sx={{ mb: 3, color: '#7C3AED' }} />
            <Typography variant="h6" fontWeight={600} gutterBottom>Loading Meeting Details</Typography>
            <LoadingTimeout timeout={NOT_FOUND_DELAY_MS} />
          </Paper>
        </Container>
      </Box>
    );
  }

  if (showNotFound && (!currentMeeting || (!loading && !currentMeeting))) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: isDarkMode ? DARK.surface : '#FFFFFF', border: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}` }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: alpha('#EF4444', 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
              <ErrorOutlinedIcon sx={{ fontSize: 48, color: '#EF4444' }} />
            </Box>
            <Typography variant="h5" color="error" gutterBottom fontWeight={700}>Meeting Not Found</Typography>
            <Typography variant="body2" sx={{ mb: 4, color: isDarkMode ? DARK.textSecondary : 'text.secondary' }}>
              The meeting you're looking for doesn't exist or has been deleted.
            </Typography>
            <Stack spacing={2}>
              <Button variant="contained" onClick={handleBack} size="large" sx={{ bgcolor: '#7C3AED' }}>Back to Meetings</Button>
              <Button variant="outlined" onClick={handleRefresh} sx={{ borderColor: '#7C3AED', color: '#7C3AED' }}>Try Again</Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? DARK.bg : '#F3F4F6' }}>
      <HeaderBar
        onBack={handleBack}
        onNotify={handleNotifyClick}
        onRefresh={handleRefresh}
        onEdit={handleEdit}
        onStatusMenuOpen={handleStatusMenuOpen}
        onMoreMenuOpen={handleMoreMenuOpen}
        onUpdateLink={() => setUpdateLinkDialogOpen(true)}
        onShare={() => setShareDialogOpen(true)}
        onPrintPDF={handlePrintPDF}
        onExportJSON={handleExportJSON}
        onRecord={handleRecord}
        participantCount={participantCount}
        getStatusIcon={getStatusIcon}
        getStatusDisplay={getStatusDisplay}
        isMobile={isMobile}
        canRecord={canRecord}
        hasRecordPermission={hasRecordPermission}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        canSendNotifications={canSendNotifications}
        hasUpdatePermission={canUpdateMeeting}
        emailSentCount={emailSentCount}
        emailFailedCount={emailFailedCount}
        onEmailHistoryOpen={handleEmailHistoryOpen}
      />

      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 2.5, md: 2.5 } }}>
        {(error || localError) && (
          <Alert severity="error" onClose={handleErrorClose} sx={{ mb: 3 }}>
            {typeof error === 'string' ? error : (localError || 'Failed to load meeting')}
          </Alert>
        )}

        <MeetingTitleBar meeting={normalizedMeeting} isMobile={isMobile} />

        {visibleTabsForMode.length > 0 && (
          <Paper sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}` }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: isDarkMode ? DARK.surfaceAlt : alpha('#7C3AED', 0.045),
                borderBottom: `2px solid ${isDarkMode ? DARK.borderStrong : alpha('#7C3AED', 0.12)}`,
                px: 1,
                pr: 1.5,
              }}
            >
              <Tabs
                value={effectiveTabValue}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                TabIndicatorProps={{ sx: { display: 'none' } }}
                sx={{
                  flex: 1,
                  minHeight: 58,
                  py: 1,
                  '& .MuiTabs-flexContainer': { gap: 0.5 },
                  '& .MuiTab-root': {
                    py: 1.25,
                    px: 2,
                    minHeight: 42,
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: isDarkMode ? DARK.textSecondary : 'text.secondary',
                    transition: 'background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease',
                    '&:hover': {
                      bgcolor: isDarkMode ? alpha('#FFFFFF', 0.04) : alpha('#7C3AED', 0.05),
                    },
                    '&.Mui-selected': {
                      color: isDarkMode ? '#FFFFFF' : '#FFFFFF',
                      bgcolor: '#7C3AED',
                      boxShadow: `0 2px 10px ${alpha('#7C3AED', 0.4)}`,
                    },
                  },
                }}
              >
                {orderedVisibleTabsForMode.map((tab) => {
                  const isDraggable = tab.value !== PINNED_TAB_VALUE;
                  const isBeingDragged = isDraggingTab && draggedTabValue === tab.value;
                  const isDropTarget = isDraggingTab && dragOverTabValue === tab.value && isDraggable;

                  return (
                    <Tab
                      key={tab.value}
                      value={tab.value}
                      icon={tab.icon}
                      iconPosition="start"
                      label={tab.label}
                      disableRipple
                      draggable={isDraggable}
                      onDragStart={(e) => handleTabDragStart(e, tab.value)}
                      onDragOver={(e) => handleTabDragOver(e, tab.value)}
                      onDrop={(e) => handleTabDrop(e, tab.value)}
                      onDragEnd={handleTabDragEnd}
                      sx={{
                        cursor: isDraggable ? 'grab' : 'default',
                        opacity: isBeingDragged ? 0.35 : 1,
                        ...(isDropTarget && {
                          boxShadow: `inset 3px 0 0 0 ${isDarkMode ? '#FFFFFF' : '#7C3AED'}`,
                        }),
                      }}
                    />
                  );
                })}
              </Tabs>

              {isTabOrderCustomized && (
                <Tooltip title="Reset tab order" arrow>
                  <IconButton
                    size="small"
                    onClick={handleResetTabOrder}
                    sx={{
                      ml: 0.5,
                      flexShrink: 0,
                      opacity: 0.6,
                      '&:hover': { opacity: 1, bgcolor: isDarkMode ? alpha('#FFFFFF', 0.06) : alpha('#7C3AED', 0.08) },
                    }}
                  >
                    <RestoreIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}

              {viewMode === 'simple' && (
                <Tooltip title={`Also available: ${visibleTabs.filter((t) => !t.simple).map((t) => t.label).join(', ')} — switch to Detailed`} arrow>
                  <Chip
                    label={`+${visibleTabs.filter((t) => !t.simple).length} more`}
                    size="small"
                    onClick={() => handleViewModeChange('detailed')}
                    sx={{ ml: 1, height: 24, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0, bgcolor: alpha('#7C3AED', 0.08), color: '#7C3AED', border: `1px dashed ${alpha('#7C3AED', 0.45)}`, '&:hover': { bgcolor: alpha('#7C3AED', 0.16) }, '& .MuiChip-label': { px: 1 } }}
                  />
                </Tooltip>
              )}
            </Box>

            <Box sx={{ p: { xs: 2, sm: 2.5, md: 2.5 } }}>
              <TabPanel value={effectiveTabValue} index={0}>
                <MeetingOverviewTab
                  meeting={normalizedMeeting}
                  onUpdateLink={() => setUpdateLinkDialogOpen(true)}
                  onJoinMeeting={handleJoinMeeting}
                />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={1}>
                <MeetingMinutes meetingId={id} meetingStatus={normalizedMeeting?.status?.short_name} onRefresh={handleRefresh} />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={2}>
                <MeetingActionsList meetingId={id} meetingStatus={normalizedMeeting?.status?.short_name} onRefresh={handleRefresh} />
              </TabPanel>
              <TabPanel value={effectiveTabValue} index={3}>
                <ParticipantsTab
                  meetingId={id}
                  participants={participants}
                  onRefresh={fetchParticipants}
                  meetingStatus={normalizedMeeting?.status?.short_name}
                  meetingStartTime={normalizedMeeting?.start_time}
                  currentChairpersonId={normalizedMeeting?.chairperson_id}
                  currentSecretaryId={normalizedMeeting?.secretary_id}
                />
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

      {isMobile && speedDialActions.length > 0 && (
        <Zoom in={true}>
          <SpeedDial
            ariaLabel="Meeting Actions"
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
            icon={<SpeedDialIcon />}
            onClose={() => setSpeedDialOpen(false)}
            onOpen={() => setSpeedDialOpen(true)}
            open={speedDialOpen}
          >
            {speedDialActions.map((action) => (
              <SpeedDialAction key={action.name} icon={action.icon} tooltipTitle={action.name} onClick={() => handleSpeedDialAction(action.action)} />
            ))}
          </SpeedDial>
        </Zoom>
      )}

      <Menu anchorEl={moreMenuAnchor} open={Boolean(moreMenuAnchor)} onClose={handleMoreMenuClose}>
        <MenuItem onClick={() => { setUpdateLinkDialogOpen(true); handleMoreMenuClose(); }}>
          <ListItemIcon><UpdateIcon /></ListItemIcon><ListItemText>Update Meeting Link</ListItemText>
        </MenuItem>
        {canSendNotifications && (
          <MenuItem onClick={handleNotifyClick}>
            <ListItemIcon><Badge badgeContent={participantCount} color="error"><NotificationsIcon /></Badge></ListItemIcon>
            <ListItemText>Send Notifications</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => { handleEmailHistoryOpen(); handleMoreMenuClose(); }}>
          <ListItemIcon><Badge badgeContent={emailSentCount} color="success" max={99}><MarkEmailReadIcon /></Badge></ListItemIcon>
          <ListItemText>View Email Notifications</ListItemText>
        </MenuItem>
        {canUpdateMeeting && (
          <MenuItem onClick={handleEdit}><ListItemIcon><Edit /></ListItemIcon><ListItemText>Edit Meeting</ListItemText></MenuItem>
        )}
        <MenuItem onClick={handleStatusMenuOpen}><ListItemIcon>{getStatusIcon()}</ListItemIcon><ListItemText>Update Status</ListItemText></MenuItem>
        <MenuItem onClick={() => { setShareDialogOpen(true); handleMoreMenuClose(); }}><ListItemIcon><ShareIcon /></ListItemIcon><ListItemText>Share Meeting</ListItemText></MenuItem>
        {canExportReports && (
          <>
            <MenuItem onClick={handlePrintPDF}><ListItemIcon><PictureAsPdfIcon /></ListItemIcon><ListItemText>PDF Report</ListItemText></MenuItem>
            <MenuItem onClick={handleExportJSON}><ListItemIcon><CodeIcon /></ListItemIcon><ListItemText>Export JSON</ListItemText></MenuItem>
          </>
        )}
        <Divider />
        {canDeleteMeeting && (
          <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
            <ListItemIcon><Delete sx={{ color: 'error.main' }} /></ListItemIcon><ListItemText>Delete Meeting</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Menu anchorEl={statusMenuAnchor} open={Boolean(statusMenuAnchor)} onClose={handleStatusMenuClose}>
        {(statusOptions?.length > 0 ? statusOptions : Object.entries(STATUS_CONFIG).map(([key, config]) => ({ short_name: key, label: config.label, id: key }))).map((status) => {
          const statusValue = status.short_name || status.value;
          const displayName = status.label || status.short_name;
          const config = STATUS_CONFIG[statusValue] || STATUS_CONFIG.pending;
          return (
            <MenuItem key={status.id || statusValue} onClick={() => handleStatusSelect(statusValue)}>
              <ListItemIcon sx={{ color: config.color === 'warning' ? '#F59E0B' : config.color === 'info' ? '#3B82F6' : config.color === 'success' ? '#10B981' : config.color === 'error' ? '#EF4444' : '#6B7280' }}>
                {config.icon}
              </ListItemIcon>
              <ListItemText primary={displayName?.charAt(0).toUpperCase() + displayName?.slice(1)} />
            </MenuItem>
          );
        })}
      </Menu>

      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle><Typography variant="h6" fontWeight={700}>Update Meeting Status</Typography></DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={selectedStatus} label="Status" onChange={(e) => setSelectedStatus(e.target.value)}>
                {(statusOptions?.length > 0 ? statusOptions : Object.entries(STATUS_CONFIG).map(([key, config]) => ({ short_name: key, label: config.label }))).map((status) => {
                  const statusValue = status.short_name || status.value;
                  const config = STATUS_CONFIG[statusValue] || STATUS_CONFIG.pending;
                  return (
                    <MenuItem key={status.id || statusValue} value={statusValue}>
                      <Stack direction="row" alignItems="center" spacing={1}>{config.icon}<span>{status.short_name?.charAt(0).toUpperCase() + status.short_name?.slice(1)}</span></Stack>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Comment (Optional)"
              multiline
              rows={3}
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              placeholder="Add a comment about this status change..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleStatusUpdate} disabled={statusUpdating || !selectedStatus} sx={{ bgcolor: '#7C3AED' }}>
            {statusUpdating ? <CircularProgress size={24} /> : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle><Typography variant="h6" fontWeight={700}>Delete Meeting</Typography></DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>Are you sure you want to delete this meeting?</Typography>
          <Alert severity="error" sx={{ mt: 2 }}><strong>Warning:</strong> This action cannot be undone. All minutes, actions, and documents will also be deleted.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? <CircularProgress size={24} /> : 'Delete Meeting'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle><Typography variant="h6" fontWeight={700}>Share Meeting</Typography></DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">Share this meeting link with participants:</Typography>
            <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: alpha('#7C3AED', 0.05) }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{`${window.location.origin}/meetings/${id}`}</Typography>
              <Tooltip title="Copy Link"><IconButton onClick={handleShare} size="small" sx={{ color: '#7C3AED' }}><CopyAllIcon /></IconButton></Tooltip>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <UpdateMeetingLinkDialog
        open={updateLinkDialogOpen}
        onClose={() => setUpdateLinkDialogOpen(false)}
        meeting={normalizedMeeting}
        onUpdate={() => {
          fetchMeeting();
          setSnackbar({ open: true, message: '✅ Meeting link updated successfully!', severity: 'success' });
        }}
      />

      <NotificationDialog
        open={notificationDialogOpen}
        onClose={() => setNotificationDialogOpen(false)}
        meeting={normalizedMeeting}
        participants={participants}
        onSend={handleSendNotifications}
        sending={sendingNotifications}
        hasEmailPermission={hasSendEmailNotificationPermission}
        hasInAppPermission={hasSendInAppNotificationPermission}
      />

      <Snackbar open={snackbar.open} autoHideDuration={SNACKBAR_AUTO_HIDE_MS} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingDetail;