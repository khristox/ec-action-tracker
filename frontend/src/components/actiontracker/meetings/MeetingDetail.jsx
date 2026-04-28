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
  Grid,
  Avatar,
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
  Card,
  CardContent,
  Collapse,
  LinearProgress,
  Breadcrumbs,
  Skeleton,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Zoom,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon,
  Refresh as RefreshIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon,
  VideoCall as VideoCallIcon,
  Link as LinkIcon,
  Notifications as NotificationsIcon,
  History as HistoryIcon,
  Update as UpdateIcon,
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ErrorOutline as ErrorOutlineIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  Apartment as ApartmentIcon,
  MeetingRoom as MeetingRoomIcon,
  EventSeat as EventSeatIcon,
  ChevronRight as ChevronRightIcon,
  FiberManualRecord as FiberManualRecordIcon,
  Share as ShareIcon,
  CopyAll as CopyAllIcon,
  Print as PrintIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Code as CodeIcon,
  ViewStream as ViewStreamIcon,
  ViewAgenda as ViewAgendaIcon,
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

// ==================== Constants ====================
const NOT_FOUND_DELAY_MS = 7000;
const SNACKBAR_AUTO_HIDE_MS = 6000;

// Location level configurations
const LOCATION_LEVELS = {
  1:  { name: 'Country',    icon: <PublicIcon fontSize="small" />,      color: '#4CAF50' },
  2:  { name: 'Region',     icon: <FlagIcon fontSize="small" />,        color: '#2196F3' },
  3:  { name: 'District',   icon: <TerrainIcon fontSize="small" />,     color: '#9C27B0' },
  4:  { name: 'County',     icon: <BusinessIcon fontSize="small" />,    color: '#FF9800' },
  5:  { name: 'Subcounty',  icon: <HomeIcon fontSize="small" />,        color: '#795548' },
  6:  { name: 'Parish',     icon: <LocationIcon fontSize="small" />,    color: '#607D8B' },
  7:  { name: 'Village',    icon: <HomeIcon fontSize="small" />,        color: '#8BC34A' },
  11: { name: 'Office',     icon: <ApartmentIcon fontSize="small" />,   color: '#E91E63' },
  12: { name: 'Building',   icon: <BusinessIcon fontSize="small" />,    color: '#3F51B5' },
  13: { name: 'Room',       icon: <MeetingRoomIcon fontSize="small" />, color: '#009688' },
  14: { name: 'Conference', icon: <EventSeatIcon fontSize="small" />,   color: '#673AB7' },
};

// Status configurations
const STATUS_CONFIG = {
  pending:     { label: 'Pending',     icon: <ScheduleIcon />,     color: 'warning', action: 'Schedule Meeting'  },
  started:     { label: 'In Progress', icon: <PendingIcon />,      color: 'info',    action: 'Start Meeting'     },
  ongoing:     { label: 'In Progress', icon: <PendingIcon />,      color: 'info',    action: 'Continue Meeting'  },
  in_progress: { label: 'In Progress', icon: <PendingIcon />,      color: 'info',    action: 'Continue Meeting'  },
  ended:       { label: 'Ended',       icon: <CheckCircleIcon />,  color: 'success', action: 'End Meeting'       },
  closed:      { label: 'Closed',      icon: <CheckCircleIcon />,  color: 'success', action: 'Close Meeting'     },
  cancelled:   { label: 'Cancelled',   icon: <CancelIcon />,       color: 'error',   action: 'Cancel Meeting'    },
  awaiting:    { label: 'Awaiting',    icon: <HourglassEmptyIcon />, color: 'warning', action: 'Awaiting Action' },
};

// Tab configurations — `simple: true` = shown in both modes; `simple: false` = detailed only
const TABS = [
  { label: 'Minutes',      icon: <DescriptionIcon />,       value: 0, simple: true  },
  { label: 'Actions',      icon: <AssignmentIcon />,        value: 1, simple: true  },
  { label: 'Participants', icon: <PeopleIcon />,            value: 2, simple: true  },
  { label: 'Documents',    icon: <DescriptionIcon />,       value: 3, simple: false },
  { label: 'History',      icon: <HistoryIcon />,           value: 4, simple: false },
  { label: 'Audit',        icon: <HistoryIcon />,           value: 5, simple: false },
  { label: 'Recordings',   icon: <FiberManualRecordIcon />, value: 6, simple: false, recording: true },
];

// Speed Dial Actions
const SPEED_DIAL_ACTIONS = [
  { icon: <EditIcon />,          name: 'Edit',        action: 'edit'   },
  { icon: <NotificationsIcon />, name: 'Notify',      action: 'notify' },
  { icon: <ShareIcon />,         name: 'Share',       action: 'share'  },
  { icon: <PictureAsPdfIcon />,  name: 'PDF Report',  action: 'pdf'    },
  { icon: <CodeIcon />,          name: 'Export JSON', action: 'json'   },
];

// ==================== Helper Functions ====================
const getLevelInfo = (level) =>
  LOCATION_LEVELS[level] || { name: `Level ${level}`, icon: <LocationIcon fontSize="small" />, color: '#7C3AED' };

const hexAlpha = (color, opacity) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (result) {
    const [r, g, b] = [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

const formatDate = (dateString) => {
  if (!dateString) return 'Date not set';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return 'Invalid date'; }
};

const formatTime = (dateString) => {
  if (!dateString) return 'Time not set';
  try {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return 'Invalid time'; }
};

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

// ==================== CTE Location Display Component ====================
const CTELocationDisplay = memo(({ locationId, locationData }) => {
  const [locationHierarchy, setLocationHierarchy] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLocationHierarchy = async () => {
      if (!locationId && !locationData) { setLocationHierarchy([]); return; }
      setLoading(true);
      setError(null);
      try {
        if (locationData && locationData.ancestors) {
          setLocationHierarchy([...locationData.ancestors, locationData]);
          setLoading(false);
          return;
        }
        const [locationRes, ancestorsRes] = await Promise.all([
          api.get(`/locations/${locationId}`),
          api.get(`/locations/${locationId}/ancestors`),
        ]);
        const location = locationRes.data;
        const ancestors = ancestorsRes.data || [];
        setLocationHierarchy([...ancestors, location]);
      } catch (err) {
        console.error('Error loading location hierarchy:', err);
        setError(err.response?.data?.detail || 'Failed to load location');
      } finally {
        setLoading(false);
      }
    };
    fetchLocationHierarchy();
  }, [locationId, locationData]);

  if (loading) return <Skeleton variant="rounded" width={200} height={32} />;

  if (error || locationHierarchy.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {locationData?.name || 'Location not specified'}
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      <Breadcrumbs separator={<ChevronRightIcon sx={{ fontSize: 14 }} />} sx={{ flexWrap: 'wrap' }}>
        {locationHierarchy.map((item, index) => {
          const levelInfo = getLevelInfo(item.level);
          const isLast = index === locationHierarchy.length - 1;
          return (
            <Chip
              key={item.id}
              label={item.name}
              size="small"
              icon={levelInfo.icon}
              sx={{
                bgcolor: hexAlpha(levelInfo.color, 0.1),
                borderColor: levelInfo.color,
                color: levelInfo.color,
                border: '1px solid',
                fontWeight: isLast ? 700 : 500,
                '& .MuiChip-label': { fontWeight: isLast ? 700 : 500 },
                ...(isLast && { bgcolor: hexAlpha(levelInfo.color, 0.2) }),
              }}
            />
          );
        })}
      </Breadcrumbs>
      {locationHierarchy[locationHierarchy.length - 1]?.address && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          📍 {locationHierarchy[locationHierarchy.length - 1].address}
        </Typography>
      )}
    </Stack>
  );
});
CTELocationDisplay.displayName = 'CTELocationDisplay';

// ==================== Rich Text Content Component ====================
const RichTextContent = memo(({ content }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  if (!content || content.trim() === '' || content === '<p></p>') {
    return (
      <Typography variant="body2" sx={{ fontStyle: 'italic', color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
        No agenda provided.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        color: isDarkMode ? '#E5E7EB' : 'inherit',
        '& p': { marginBottom: '12px', lineHeight: 1.7, color: isDarkMode ? '#D1D5DB' : 'inherit' },
        '& p:last-child': { marginBottom: 0 },
        '& ul, & ol': { paddingLeft: '24px', marginBottom: '12px', color: isDarkMode ? '#D1D5DB' : 'inherit' },
        '& li': { marginBottom: '6px', color: isDarkMode ? '#D1D5DB' : 'inherit' },
        '& h1, & h2, & h3': { margin: '16px 0 8px 0', fontWeight: 600, color: isDarkMode ? '#FFFFFF' : 'inherit' },
        '& blockquote': {
          borderLeft: '4px solid', borderColor: isDarkMode ? '#7C3AED' : 'primary.main',
          paddingLeft: '16px', color: isDarkMode ? '#9CA3AF' : 'text.secondary',
          fontStyle: 'italic', margin: '16px 0',
          backgroundColor: isDarkMode ? alpha('#7C3AED', 0.1) : 'transparent',
        },
        '& a': { color: isDarkMode ? '#A78BFA' : '#7C3AED', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
        '& strong, & b': { color: isDarkMode ? '#FFFFFF' : 'inherit', fontWeight: 700 },
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
});
RichTextContent.displayName = 'RichTextContent';

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
            border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
            '&:not(:first-of-type)': { borderLeft: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}` },
          },
          '& .MuiToggleButton-root': {
            px: { xs: 1, sm: 1.75 },
            py: 0.5,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.75rem',
            color: isDarkMode ? '#9CA3AF' : 'text.secondary',
            gap: 0.6,
            '&.Mui-selected': {
              bgcolor: alpha('#7C3AED', 0.12),
              color: '#7C3AED',
              '&:hover': { bgcolor: alpha('#7C3AED', 0.18) },
            },
            '&:hover': { bgcolor: isDarkMode ? alpha('#FFFFFF', 0.05) : alpha('#000000', 0.04) },
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
  participantCount,
  getStatusIcon,
  getStatusDisplay,
  isMobile,
  canRecord,
  onRecord,
  viewMode,
  onViewModeChange,
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <AppBar
      position="sticky"
      elevation={isDarkMode ? 0 : 2}
      sx={{
        bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
        borderBottom: 1,
        borderColor: isDarkMode ? '#374151' : '#E5E7EB',
        zIndex: theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ px: { xs: 1.5, sm: 3 } }}>
        <IconButton onClick={onBack} edge="start" sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>

        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
          Meeting Details
        </Typography>

        {/* View Mode Toggle — always visible */}
        <Box sx={{ mr: { xs: 1, sm: 2 } }}>
          <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
        </Box>

        {isMobile ? (
          <Stack direction="row" spacing={0.5}>
            <IconButton onClick={onNotify}>
              <Badge badgeContent={participantCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton onClick={onRefresh}>
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={onMoreMenuOpen}>
              <MoreVertIcon />
            </IconButton>
          </Stack>
        ) : (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Share Meeting">
              <IconButton onClick={onShare} size="small">
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Generate PDF Report">
              <IconButton onClick={onPrintPDF} size="small">
                <PictureAsPdfIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export as JSON">
              <IconButton onClick={onExportJSON} size="small">
                <CodeIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Update Meeting Link">
              <IconButton onClick={onUpdateLink} size="small">
                <UpdateIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Send Notifications">
              <IconButton onClick={onNotify} size="small">
                <Badge badgeContent={participantCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit Meeting">
              <IconButton onClick={onEdit} size="small">
                <EditIcon />
              </IconButton>
            </Tooltip>
            {canRecord && (
              <Tooltip title="Record Meeting">
                <IconButton
                  onClick={onRecord}
                  size="small"
                  sx={{
                    color: '#f44336',
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%':       { opacity: 0.6 },
                    },
                  }}
                >
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
            <Tooltip title="More Options">
              <IconButton onClick={onMoreMenuOpen} size="small">
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
});
HeaderBar.displayName = 'HeaderBar';

// ==================== Meeting Info Card ====================
const MeetingInfoCard = memo(({ meeting, isMobile, onUpdateLink, onJoinMeeting, viewMode }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [agendaExpanded, setAgendaExpanded] = useState(false);

  const isSimple = viewMode === 'simple';
  const hasAgenda = meeting?.agenda && meeting.agenda.trim() !== '' && meeting.agenda !== '<p></p>';
  const statusConfig = STATUS_CONFIG[meeting?.status?.short_name?.toLowerCase()] || STATUS_CONFIG.pending;
  const isOnlineMeeting = meeting?.platform && meeting?.platform !== 'physical';
  const hasMeetingLink = meeting?.meeting_link;

  const getAgendaPreview = useCallback(() => {
    if (!hasAgenda) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = meeting.agenda;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    return plainText.length <= 150 ? plainText : plainText.substring(0, 150) + '...';
  }, [meeting?.agenda, hasAgenda]);

  return (
    <Card
      sx={{
        mb: 3,
        borderRadius: 3,
        overflow: 'hidden',
        border: `1px solid ${isDarkMode ? alpha('#FFFFFF', 0.1) : '#E5E7EB'}`,
        bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
        transition: 'all 0.25s ease',
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Title + Status — always shown */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={800}>
            {meeting?.title}
          </Typography>
          <Chip
            label={statusConfig.label}
            color={statusConfig.color}
            icon={statusConfig.icon}
            sx={{ fontWeight: 600 }}
          />
        </Stack>

        {/* Description — detailed only */}
        {!isSimple && meeting?.description && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
              {meeting.description}
            </Typography>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {/* Date & Time — always shown */}
          <Grid size={{ xs: 12, sm: 6, md: isSimple ? 4 : 3 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: alpha('#7C3AED', 0.1), color: '#7C3AED' }}>
                <CalendarIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  DATE & TIME
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatDate(meeting?.meeting_date)}
                </Typography>
                {meeting?.start_time && (
                  <Typography variant="body2" color="text.secondary">
                    <AccessTimeIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                    {formatTime(meeting.start_time)}
                    {meeting?.end_time && ` - ${formatTime(meeting.end_time)}`}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Grid>

          {/* Location / Platform — always shown */}
          <Grid size={{ xs: 12, sm: 6, md: isSimple ? 4 : 3 }}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Avatar sx={{ bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' }}>
                {isOnlineMeeting ? <VideoCallIcon /> : <LocationIcon />}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  {isOnlineMeeting ? 'PLATFORM' : 'LOCATION'}
                </Typography>
                {isOnlineMeeting ? (
                  <>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body1" fontWeight={600}>
                        {meeting?.platform === 'zoom'             ? 'Zoom'
                         : meeting?.platform === 'google_meet'    ? 'Google Meet'
                         : meeting?.platform === 'microsoft_teams' ? 'Microsoft Teams'
                         : 'Online Meeting'}
                      </Typography>
                      <Tooltip title="Update Meeting Link">
                        <IconButton size="small" onClick={onUpdateLink}>
                          <UpdateIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    {hasMeetingLink && (
                      <Button
                        size="small"
                        startIcon={<LinkIcon />}
                        onClick={onJoinMeeting}
                        sx={{ mt: 0.5, textTransform: 'none' }}
                      >
                        Join Meeting
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <CTELocationDisplay locationId={meeting?.location_id} locationData={meeting?.location} />
                    {meeting?.location_text && meeting?.location_text !== meeting?.location?.name && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        📍 {meeting.location_text}
                      </Typography>
                    )}
                  </>
                )}
              </Box>
            </Stack>
          </Grid>

          {/* Secretary — detailed only */}
          {!isSimple && meeting?.facilitator && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: alpha('#10B981', 0.1), color: '#10B981' }}>
                  <PeopleIcon />
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    SECRETARY
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {meeting.facilitator}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          )}

          {/* Chairperson — detailed only */}
          {!isSimple && meeting?.chairperson_name && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B' }}>
                  <PeopleIcon />
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    CHAIRPERSON
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {meeting.chairperson_name}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          )}

          {/* Simple mode: show secretary & chairperson as compact inline text */}
          {isSimple && (meeting?.facilitator || meeting?.chairperson_name) && (
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Avatar sx={{ bgcolor: alpha('#10B981', 0.1), color: '#10B981' }}>
                  <PeopleIcon />
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    KEY PERSONS
                  </Typography>
                  {meeting?.chairperson_name && (
                    <Typography variant="body2" fontWeight={600}>
                      Chair: {meeting.chairperson_name}
                    </Typography>
                  )}
                  {meeting?.facilitator && (
                    <Typography variant="body2" color="text.secondary">
                      Secretary: {meeting.facilitator}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Grid>
          )}
        </Grid>

        {/* Agenda — detailed only */}
        {!isSimple && hasAgenda && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ mb: 3 }} />
            <Stack
              direction="row"
              spacing={2}
              alignItems="flex-start"
              sx={{ cursor: 'pointer' }}
              onClick={() => setAgendaExpanded(!agendaExpanded)}
            >
              <Avatar sx={{ bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B' }}>
                <DescriptionIcon />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Agenda
                  </Typography>
                  <IconButton size="small">
                    {agendaExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Stack>
                <Collapse in={agendaExpanded} collapsedSize={60}>
                  <Paper variant="outlined" sx={{ p: 3, bgcolor: alpha('#000000', 0.02), borderRadius: 2 }}>
                    <RichTextContent content={meeting.agenda} />
                  </Paper>
                </Collapse>
                {!agendaExpanded && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {getAgendaPreview()}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>
        )}

        {/* Simple mode hint */}
        {isSimple && (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px dashed ${isDarkMode ? '#374151' : '#E5E7EB'}` }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Switch to <strong>Detailed</strong> view to see agenda, description, chairperson, secretary and more.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
});
MeetingInfoCard.displayName = 'MeetingInfoCard';

// ==================== Main Component ====================
const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Redux selectors
  const currentMeeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingsError);
  const statusOptions = useSelector(selectMeetingStatusOptions);
  const participants = useSelector(selectNotificationParticipants);
  const sendingNotifications = useSelector(selectNotificationSending);
  const notificationError = useSelector(selectNotificationError);
  const lastNotificationResult = useSelector(selectLastNotificationResult);

  // Local state
  const [tabValue, setTabValue] = useState(0);
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

  // View mode — persisted to localStorage
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('meetingViewMode') || 'simple'
  );

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    localStorage.setItem('meetingViewMode', mode);
  }, []);

  // Memoized values
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
    () =>
      normalizedMeeting?.status?.short_name === 'started' ||
      normalizedMeeting?.status?.short_name === 'ongoing' ||
      normalizedMeeting?.status?.short_name === 'in_progress',
    [normalizedMeeting?.status?.short_name]
  );

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

  const getStatusColor = useCallback(() => {
    const status = getStatusValue();
    return STATUS_CONFIG[status]?.color || 'default';
  }, [getStatusValue]);

  const getStatusIcon = useCallback(() => {
    const status = getStatusValue();
    return STATUS_CONFIG[status]?.icon || <ScheduleIcon />;
  }, [getStatusValue]);

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

  // Fetch functions
  const fetchMeeting = useCallback(() => {
    if (id) dispatch(fetchMeetingById(id));
  }, [id, dispatch]);

  const fetchParticipants = useCallback(() => {
    if (id) dispatch(fetchMeetingParticipants(id));
  }, [id, dispatch]);

  // Report/export handlers
  const handlePrintPDF = useCallback(async () => {
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
  }, [id]);

  const handleExportJSON = useCallback(async () => {
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
  }, [id]);

  // Effects
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
      dispatch(fetchActionTrackerAttributes());
    }
    return () => {
      dispatch(clearMeetingState());
      dispatch(clearNotificationError());
      dispatch(clearLastNotificationResult());
    };
  }, [id, dispatch, fetchMeeting, fetchParticipants]);

  useEffect(() => {
    if (lastNotificationResult) {
      setSnackbar({
        open: true,
        message: `✅ Notifications sent to ${lastNotificationResult.sent} participants!`,
        severity: 'success',
      });
      setNotificationDialogOpen(false);
      dispatch(clearLastNotificationResult());
    }
  }, [lastNotificationResult, dispatch]);

  useEffect(() => {
    if (notificationError) {
      setSnackbar({ open: true, message: notificationError, severity: 'error' });
      dispatch(clearNotificationError());
    }
  }, [notificationError, dispatch]);

  // Handlers
  const handleRefresh = useCallback(() => {
    setShowNotFound(false);
    setLoadingTimeout(false);
    setInitialLoadComplete(false);
    fetchMeeting();
    fetchParticipants();
  }, [fetchMeeting, fetchParticipants]);

  const handleBack   = useCallback(() => navigate('/meetings'), [navigate]);
  const handleEdit   = useCallback(() => navigate(`/meetings/${id}/edit`), [navigate, id]);
  const handleRecord = useCallback(() => navigate(`/meetings/${id}/record`), [navigate, id]);

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
    fetchParticipants();
    setNotificationDialogOpen(true);
  }, [fetchParticipants]);

  const handleSendNotifications = useCallback(
    (notificationData) => dispatch(sendMeetingNotifications({ meetingId: id, notificationData })),
    [id, dispatch]
  );

  const handleStatusMenuOpen  = (event) => setStatusMenuAnchor(event.currentTarget);
  const handleStatusMenuClose = ()      => setStatusMenuAnchor(null);
  const handleMoreMenuOpen    = (event) => setMoreMenuAnchor(event.currentTarget);
  const handleMoreMenuClose   = ()      => setMoreMenuAnchor(null);

  const handleStatusSelect = (statusValue) => {
    setSelectedStatus(statusValue);
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
      fetchMeeting();
      setSnackbar({ open: true, message: '✅ Meeting status updated successfully!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Failed to update meeting status', severity: 'error' });
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDeleteClick = () => { setDeleteDialogOpen(true); handleMoreMenuClose(); };

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
      case 'edit':   handleEdit();                   break;
      case 'notify': handleNotifyClick();            break;
      case 'share':  setShareDialogOpen(true);       break;
      case 'pdf':    handlePrintPDF();               break;
      case 'json':   handleExportJSON();             break;
      default: break;
    }
    setSpeedDialOpen(false);
  };

  const handleSnackbarClose = () => setSnackbar((prev) => ({ ...prev, open: false }));
  const handleErrorClose    = () => { setLocalError(null); dispatch(clearMeetingState()); };

  // ---- Loading state ----
  if (loading && !currentMeeting && !showNotFound) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? '#111827' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <CircularProgress size={60} sx={{ mb: 3, color: '#7C3AED' }} />
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Loading Meeting Details
            </Typography>
            <LoadingTimeout timeout={NOT_FOUND_DELAY_MS} />
          </Paper>
        </Container>
      </Box>
    );
  }

  // ---- Not found state ----
  if (showNotFound && (!currentMeeting || (!loading && !currentMeeting))) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? '#111827' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: alpha('#EF4444', 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
              <ErrorOutlineIcon sx={{ fontSize: 48, color: '#EF4444' }} />
            </Box>
            <Typography variant="h5" color="error" gutterBottom fontWeight={700}>
              Meeting Not Found
            </Typography>
            <Typography variant="body2" sx={{ mb: 4, color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
              The meeting you're looking for doesn't exist or has been deleted.
            </Typography>
            <Stack spacing={2}>
              <Button variant="contained" onClick={handleBack} size="large" sx={{ bgcolor: '#7C3AED' }}>
                Back to Meetings
              </Button>
              <Button variant="outlined" onClick={handleRefresh} sx={{ borderColor: '#7C3AED', color: '#7C3AED' }}>
                Try Again
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  // ---- Main render ----
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? '#111827' : '#F3F4F6' }}>
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
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
        {(error || localError) && (
          <Alert severity="error" onClose={handleErrorClose} sx={{ mb: 3 }}>
            {typeof error === 'string' ? error : (localError || 'Failed to load meeting')}
          </Alert>
        )}

        <MeetingInfoCard
          meeting={normalizedMeeting}
          isMobile={isMobile}
          onUpdateLink={() => setUpdateLinkDialogOpen(true)}
          onJoinMeeting={handleJoinMeeting}
          viewMode={viewMode}
        />

        {(() => {
          // Filter visible tabs based on view mode
          const visibleTabs = TABS.filter((t) => viewMode === 'detailed' || t.simple);
          // Find which visible-tab index corresponds to the currently active tab value
          const visibleIndex = visibleTabs.findIndex((t) => t.value === tabValue);
          const activeVisibleIndex = visibleIndex === -1 ? 0 : visibleIndex;
          const handleTabChange = (_, newVisibleIdx) => setTabValue(visibleTabs[newVisibleIdx].value);

          return (
            <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
              {/* Tab header row */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: isDarkMode ? '#1F2937' : '#F9FAFB',
                  pr: 1.5,
                }}
              >
                <Tabs
                  value={activeVisibleIndex}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    flex: 1,
                    minHeight: 48,
                    '& .MuiTab-root': {
                      py: 1.5,
                      minHeight: 48,
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      '&.Mui-selected': { color: '#7C3AED' },
                    },
                    '& .MuiTabs-indicator': { backgroundColor: '#7C3AED', height: 3 },
                  }}
                >
                  {visibleTabs.map((tab) => (
                    <Tab
                      key={tab.value}
                      icon={tab.icon}
                      iconPosition="start"
                      label={tab.label}
                      sx={tab.recording && canRecord ? { color: '#f44336' } : {}}
                    />
                  ))}
                </Tabs>

                {/* "+N more" chip — shown in simple mode, clicking switches to detailed */}
                {viewMode === 'simple' && (
                  <Tooltip
                    title={`Also available: ${TABS.filter((t) => !t.simple).map((t) => t.label).join(', ')} — switch to Detailed`}
                    arrow
                  >
                    <Chip
                      label={`+${TABS.filter((t) => !t.simple).length} more`}
                      size="small"
                      onClick={() => handleViewModeChange('detailed')}
                      sx={{
                        ml: 1,
                        height: 24,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                        bgcolor: alpha('#7C3AED', 0.08),
                        color: '#7C3AED',
                        border: `1px dashed ${alpha('#7C3AED', 0.45)}`,
                        '&:hover': { bgcolor: alpha('#7C3AED', 0.16) },
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                  </Tooltip>
                )}
              </Box>

              {/* Tab panels — always keyed to original tab values so content is stable */}
              <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <TabPanel value={tabValue} index={0}>
                  <MeetingMinutes meetingId={id} meetingStatus={normalizedMeeting?.status?.short_name} onRefresh={handleRefresh} />
                </TabPanel>
                <TabPanel value={tabValue} index={1}>
                  <MeetingActionsList meetingId={id} meetingStatus={normalizedMeeting?.status?.short_name} onRefresh={handleRefresh} />
                </TabPanel>
                <TabPanel value={tabValue} index={2}>
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
                <TabPanel value={tabValue} index={3}>
                  <MeetingDocuments meetingId={id} onRefresh={handleRefresh} />
                </TabPanel>
                <TabPanel value={tabValue} index={4}>
                  <MeetingHistory meetingId={id} />
                </TabPanel>
                <TabPanel value={tabValue} index={5}>
                  <MeetingAudit meetingId={id} />
                </TabPanel>
                <TabPanel value={tabValue} index={6}>
                  <MeetingRecorder meetingId={id} />
                </TabPanel>
              </Box>
            </Paper>
          );
        })()}
      </Container>

      {/* Speed Dial — mobile only */}
      {isMobile && (
        <Zoom in={true}>
          <SpeedDial
            ariaLabel="Meeting Actions"
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
            icon={<SpeedDialIcon />}
            onClose={() => setSpeedDialOpen(false)}
            onOpen={() => setSpeedDialOpen(true)}
            open={speedDialOpen}
          >
            {SPEED_DIAL_ACTIONS.map((action) => (
              <SpeedDialAction
                key={action.name}
                icon={action.icon}
                tooltipTitle={action.name}
                onClick={() => handleSpeedDialAction(action.action)}
              />
            ))}
          </SpeedDial>
        </Zoom>
      )}

      {/* More Options Menu */}
      <Menu anchorEl={moreMenuAnchor} open={Boolean(moreMenuAnchor)} onClose={handleMoreMenuClose}>
        <MenuItem onClick={() => { setUpdateLinkDialogOpen(true); handleMoreMenuClose(); }}>
          <ListItemIcon><UpdateIcon /></ListItemIcon>
          <ListItemText>Update Meeting Link</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleNotifyClick}>
          <ListItemIcon><NotificationsIcon /></ListItemIcon>
          <ListItemText>Send Notifications</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon><EditIcon /></ListItemIcon>
          <ListItemText>Edit Meeting</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleStatusMenuOpen}>
          <ListItemIcon>{getStatusIcon()}</ListItemIcon>
          <ListItemText>Update Status</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setShareDialogOpen(true); handleMoreMenuClose(); }}>
          <ListItemIcon><ShareIcon /></ListItemIcon>
          <ListItemText>Share Meeting</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlePrintPDF}>
          <ListItemIcon><PictureAsPdfIcon /></ListItemIcon>
          <ListItemText>PDF Report</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleExportJSON}>
          <ListItemIcon><CodeIcon /></ListItemIcon>
          <ListItemText>Export JSON</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon sx={{ color: 'error.main' }} /></ListItemIcon>
          <ListItemText>Delete Meeting</ListItemText>
        </MenuItem>
      </Menu>

      {/* Status Update Menu */}
      <Menu anchorEl={statusMenuAnchor} open={Boolean(statusMenuAnchor)} onClose={handleStatusMenuClose}>
        {statusOptions && statusOptions.length > 0 ? (
          statusOptions.map((status) => {
            const statusValue  = status.short_name || status.value;
            const displayName  = status.label || status.short_name;
            const config       = STATUS_CONFIG[statusValue] || STATUS_CONFIG.pending;
            return (
              <MenuItem key={status.id} onClick={() => handleStatusSelect(statusValue)}>
                <ListItemIcon sx={{
                  color: config.color === 'warning' ? '#F59E0B'
                       : config.color === 'info'    ? '#3B82F6'
                       : config.color === 'success' ? '#10B981'
                       : config.color === 'error'   ? '#EF4444'
                       : '#6B7280',
                }}>
                  {config.icon}
                </ListItemIcon>
                <ListItemText primary={displayName?.charAt(0).toUpperCase() + displayName?.slice(1)} />
              </MenuItem>
            );
          })
        ) : (
          Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <MenuItem key={key} onClick={() => handleStatusSelect(key)}>
              <ListItemIcon sx={{
                color: config.color === 'warning' ? '#F59E0B'
                     : config.color === 'info'    ? '#3B82F6'
                     : config.color === 'success' ? '#10B981'
                     : config.color === 'error'   ? '#EF4444'
                     : '#6B7280',
              }}>
                {config.icon}
              </ListItemIcon>
              <ListItemText primary={config.label} />
            </MenuItem>
          ))
        )}
      </Menu>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={700}>Update Meeting Status</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={selectedStatus} label="Status" onChange={(e) => setSelectedStatus(e.target.value)}>
                {statusOptions && statusOptions.length > 0 ? (
                  statusOptions.map((status) => {
                    const statusValue = status.short_name || status.value;
                    const config      = STATUS_CONFIG[statusValue] || STATUS_CONFIG.pending;
                    return (
                      <MenuItem key={status.id || status.code} value={statusValue}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {config.icon}
                          <span>{status.short_name?.charAt(0).toUpperCase() + status.short_name?.slice(1)}</span>
                        </Stack>
                      </MenuItem>
                    );
                  })
                ) : (
                  Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <MenuItem key={key} value={key}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {config.icon}
                        <span>{config.label}</span>
                      </Stack>
                    </MenuItem>
                  ))
                )}
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
          <Button
            variant="contained"
            onClick={handleStatusUpdate}
            disabled={statusUpdating || !selectedStatus}
            sx={{ bgcolor: '#7C3AED' }}
          >
            {statusUpdating ? <CircularProgress size={24} /> : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={700}>Delete Meeting</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete this meeting?
          </Typography>
          <Alert severity="error" sx={{ mt: 2 }}>
            <strong>Warning:</strong> This action cannot be undone. All minutes, actions, and documents will also be deleted.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? <CircularProgress size={24} /> : 'Delete Meeting'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={700}>Share Meeting</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Share this meeting link with participants:
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: alpha('#7C3AED', 0.05),
              }}
            >
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {`${window.location.origin}/meetings/${id}`}
              </Typography>
              <Tooltip title="Copy Link">
                <IconButton onClick={handleShare} size="small" sx={{ color: '#7C3AED' }}>
                  <CopyAllIcon />
                </IconButton>
              </Tooltip>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Update Meeting Link Dialog */}
      <UpdateMeetingLinkDialog
        open={updateLinkDialogOpen}
        onClose={() => setUpdateLinkDialogOpen(false)}
        meeting={normalizedMeeting}
        onUpdate={() => {
          fetchMeeting();
          setSnackbar({ open: true, message: '✅ Meeting link updated successfully!', severity: 'success' });
        }}
      />

      {/* Notification Dialog */}
      <NotificationDialog
        open={notificationDialogOpen}
        onClose={() => setNotificationDialogOpen(false)}
        meeting={normalizedMeeting}
        participants={participants}
        onSend={handleSendNotifications}
        sending={sendingNotifications}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={SNACKBAR_AUTO_HIDE_MS}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingDetail;