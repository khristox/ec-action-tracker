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
  Skeleton
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
  Close as CloseIcon,
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
  ChevronRight as ChevronRightIcon
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
  selectMeetingStatusOptions
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
import api from '../../../services/api';

// ==================== Constants ====================
const NOT_FOUND_DELAY_MS = 7000;

// Location level configurations
const LOCATION_LEVELS = {
  1: { name: 'Country', icon: <PublicIcon fontSize="small" />, color: '#4CAF50' },
  2: { name: 'Region', icon: <FlagIcon fontSize="small" />, color: '#2196F3' },
  3: { name: 'District', icon: <TerrainIcon fontSize="small" />, color: '#9C27B0' },
  4: { name: 'County', icon: <BusinessIcon fontSize="small" />, color: '#FF9800' },
  5: { name: 'Subcounty', icon: <HomeIcon fontSize="small" />, color: '#795548' },
  6: { name: 'Parish', icon: <LocationIcon fontSize="small" />, color: '#607D8B' },
  7: { name: 'Village', icon: <HomeIcon fontSize="small" />, color: '#8BC34A' },
  11: { name: 'Office', icon: <ApartmentIcon fontSize="small" />, color: '#E91E63' },
  12: { name: 'Building', icon: <BusinessIcon fontSize="small" />, color: '#3F51B5' },
  13: { name: 'Room', icon: <MeetingRoomIcon fontSize="small" />, color: '#009688' },
  14: { name: 'Conference', icon: <EventSeatIcon fontSize="small" />, color: '#673AB7' },
};

const getLevelInfo = (level) => LOCATION_LEVELS[level] || { name: `Level ${level}`, icon: <LocationIcon fontSize="small" />, color: '#7C3AED' };
const hexAlpha = (color, opacity) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (result) {
    const [r, g, b] = [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

// ==================== CTE Location Display Component ====================
const CTELocationDisplay = memo(({ locationId, locationData }) => {
  const [locationHierarchy, setLocationHierarchy] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const theme = useTheme();

  useEffect(() => {
    const fetchLocationHierarchy = async () => {
      if (!locationId && !locationData) {
        setLocationHierarchy([]);
        return;
      }

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
          api.get(`/locations/${locationId}/ancestors`)
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

  if (loading) {
    return <Skeleton variant="rounded" width={200} height={32} />;
  }

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
                ...(isLast && { bgcolor: hexAlpha(levelInfo.color, 0.2) })
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

// ==================== Helper Function to Normalize Status ====================
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

// ==================== Memoized Rich Text Content Component ====================
const RichTextContent = memo(({ content }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  if (!content || content.trim() === '' || content === '<p></p>') {
    return <Typography variant="body2" sx={{ fontStyle: 'italic', color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>No agenda provided.</Typography>;
  }

  return (
    <Box sx={{
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
        backgroundColor: isDarkMode ? alpha('#7C3AED', 0.1) : 'transparent'
      },
      '& a': { color: isDarkMode ? '#A78BFA' : '#7C3AED', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
      '& strong, & b': { color: isDarkMode ? '#FFFFFF' : 'inherit', fontWeight: 700 }
    }} dangerouslySetInnerHTML={{ __html: content }} />
  );
});

RichTextContent.displayName = 'RichTextContent';

// ==================== Tab Panel Component ====================
const TabPanel = memo(({ children, value, index, ...other }) => (
  <div role="tabpanel" hidden={value !== index} id={`meeting-tabpanel-${index}`} aria-labelledby={`meeting-tab-${index}`} {...other}>
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

// ==================== Header Bar ====================
const HeaderBar = memo(({ onBack, onNotify, onRefresh, onEdit, onStatusMenuOpen, onMoreMenuOpen, onUpdateLink, participantCount, getStatusIcon, getStatusDisplay, isMobile }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  return (
    <AppBar position="sticky" elevation={isDarkMode ? 0 : 2} sx={{
      bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
      borderBottom: 1, borderColor: isDarkMode ? '#374151' : '#E5E7EB',
      zIndex: theme.zIndex.drawer + 1
    }}>
      <Toolbar sx={{ px: { xs: 1.5, sm: 3 } }}>
        <IconButton onClick={onBack} edge="start" sx={{ mr: 2 }}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>Meeting Details</Typography>

        {isMobile ? (
          <Stack direction="row" spacing={1}>
            <IconButton onClick={onNotify}><Badge badgeContent={participantCount} color="error"><NotificationsIcon /></Badge></IconButton>
            <IconButton onClick={onRefresh}><RefreshIcon /></IconButton>
            <IconButton onClick={onMoreMenuOpen}><MoreVertIcon /></IconButton>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1}>
            <Tooltip title="Update Meeting Link"><IconButton onClick={onUpdateLink} size="small"><UpdateIcon /></IconButton></Tooltip>
            <Tooltip title="Send Notifications"><IconButton onClick={onNotify} size="small"><Badge badgeContent={participantCount} color="error"><NotificationsIcon /></Badge></IconButton></Tooltip>
            <Tooltip title="Refresh"><IconButton onClick={onRefresh} size="small"><RefreshIcon /></IconButton></Tooltip>
            <Tooltip title="Edit Meeting"><IconButton onClick={onEdit} size="small"><EditIcon /></IconButton></Tooltip>
            <Tooltip title="Update Status">
              <Button variant={isDarkMode ? "outlined" : "contained"} size="small" startIcon={getStatusIcon()} onClick={onStatusMenuOpen} sx={{ textTransform: 'none' }}>
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

// ==================== Meeting Info Card ====================
const MeetingInfoCard = memo(({ meeting, isMobile, formatDate, formatTime, getStatusDisplay, getStatusColor, getStatusIcon, isOnlineMeeting, hasMeetingLink, onUpdateLink, onJoinMeeting }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [agendaExpanded, setAgendaExpanded] = useState(false);
  const hasAgenda = meeting?.agenda && meeting.agenda.trim() !== '' && meeting.agenda !== '<p></p>';
  
  const getAgendaPreview = useCallback(() => {
    if (!hasAgenda) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = meeting.agenda;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    return plainText.length <= 150 ? plainText : plainText.substring(0, 150) + '...';
  }, [meeting?.agenda, hasAgenda]);
  
  return (
    <Card sx={{ mb: 3, borderRadius: 3, overflow: 'hidden', border: `1px solid ${isDarkMode ? alpha('#FFFFFF', 0.1) : '#E5E7EB'}`, bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight={800}>{meeting?.title}</Typography>
          <Chip label={getStatusDisplay()} color={getStatusColor()} icon={getStatusIcon()} sx={{ fontWeight: 600 }} />
        </Stack>

        {meeting?.description && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>{meeting.description}</Typography>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={{ xs: 2, sm: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: alpha('#7C3AED', 0.1), color: '#7C3AED' }}><CalendarIcon /></Avatar>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>DATE & TIME</Typography>
                <Typography variant="body1" fontWeight={600}>{formatDate(meeting?.meeting_date)}</Typography>
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

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Avatar sx={{ bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' }}>{isOnlineMeeting ? <VideoCallIcon /> : <LocationIcon />}</Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>{isOnlineMeeting ? 'PLATFORM' : 'LOCATION'}</Typography>
                {isOnlineMeeting ? (
                  <>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body1" fontWeight={600}>
                        {meeting?.platform === 'zoom' ? 'Zoom' : 
                         meeting?.platform === 'google_meet' ? 'Google Meet' : 
                         meeting?.platform === 'microsoft_teams' ? 'Microsoft Teams' : 'Online Meeting'}
                      </Typography>
                      <Tooltip title="Update Meeting Link"><IconButton size="small" onClick={onUpdateLink}><UpdateIcon fontSize="small" /></IconButton></Tooltip>
                    </Stack>
                    {hasMeetingLink && (<Button size="small" startIcon={<LinkIcon />} onClick={onJoinMeeting} sx={{ mt: 0.5, textTransform: 'none' }}>Join Meeting</Button>)}
                  </>
                ) : (
                  <>
                    <CTELocationDisplay locationId={meeting?.location_id} locationData={meeting?.location} />
                    {meeting?.location_text && meeting?.location_text !== meeting?.location?.name && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>📍 {meeting.location_text}</Typography>
                    )}
                  </>
                )}
              </Box>
            </Stack>
          </Grid>

          {meeting?.facilitator && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: alpha('#10B981', 0.1), color: '#10B981' }}><PeopleIcon /></Avatar>
                <Box><Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>SECRETARY</Typography><Typography variant="body1" fontWeight={600}>{meeting.facilitator}</Typography></Box>
              </Stack>
            </Grid>
          )}

          {meeting?.chairperson_name && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B' }}><PeopleIcon /></Avatar>
                <Box><Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>CHAIRPERSON</Typography><Typography variant="body1" fontWeight={600}>{meeting.chairperson_name}</Typography></Box>
              </Stack>
            </Grid>
          )}
        </Grid>

        {hasAgenda && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ mb: 3 }} />
            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ cursor: 'pointer' }} onClick={() => setAgendaExpanded(!agendaExpanded)}>
              <Avatar sx={{ bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B' }}><DescriptionIcon /></Avatar>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Agenda</Typography>
                  <IconButton size="small">{agendaExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
                </Stack>
                <Collapse in={agendaExpanded} collapsedSize={60}>
                  <Paper variant="outlined" sx={{ p: 3, bgcolor: alpha('#000000', 0.02), borderRadius: 2 }}><RichTextContent content={meeting.agenda} /></Paper>
                </Collapse>
                {!agendaExpanded && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{getAgendaPreview()}</Typography>}
              </Box>
            </Stack>
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
  
  const currentMeeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingsError);
  const statusOptions = useSelector(selectMeetingStatusOptions);
  const participants = useSelector(selectNotificationParticipants);
  const sendingNotifications = useSelector(selectNotificationSending);
  const notificationError = useSelector(selectNotificationError);
  const lastNotificationResult = useSelector(selectLastNotificationResult);
  
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

  const normalizedMeeting = useMemo(() => currentMeeting ? { ...currentMeeting, status: normalizeStatus(currentMeeting.status) } : null, [currentMeeting]);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Date not set';
    try { return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); } 
    catch { return 'Invalid date'; }
  }, []);

  const formatTime = useCallback((dateString) => {
    if (!dateString) return 'Time not set';
    try { return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } 
    catch { return 'Invalid time'; }
  }, []);

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
    if (status === 'ended' || status === 'closed') return 'success';
    if (status === 'cancelled') return 'error';
    if (status === 'started') return 'info';
    if (status === 'pending' || status === 'awaiting') return 'warning';
    return 'default';
  }, [getStatusValue]);

  const getStatusIcon = useCallback(() => {
    const status = getStatusValue();
    if (status === 'ended' || status === 'closed') return <CheckCircleIcon />;
    if (status === 'cancelled') return <CancelIcon />;
    if (status === 'started') return <PendingIcon />;
    if (status === 'pending' || status === 'awaiting') return <ScheduleIcon />;
    return <ScheduleIcon />;
  }, [getStatusValue]);

  const getStatusDisplay = useCallback(() => {
    const status = normalizedMeeting?.status;
    if (!status) return 'Unknown';
    if (status.short_name) return status.short_name.charAt(0).toUpperCase() + status.short_name.slice(1);
    if (typeof status === 'string') {
      if (status.includes('_')) return status.split('_').pop().charAt(0).toUpperCase() + status.split('_').pop().slice(1).toLowerCase();
      return status.charAt(0).toUpperCase() + status.slice(1);
    }
    return status.name || 'Unknown';
  }, [normalizedMeeting?.status]);

  const isOnlineMeeting = useMemo(() => normalizedMeeting?.platform && normalizedMeeting?.platform !== 'physical', [normalizedMeeting?.platform]);
  const hasMeetingLink = useMemo(() => normalizedMeeting?.meeting_link, [normalizedMeeting?.meeting_link]);
  const participantCount = useMemo(() => participants.length, [participants]);

  const fetchMeeting = useCallback(() => { if (id) dispatch(fetchMeetingById(id)); }, [id, dispatch]);
  const fetchParticipants = useCallback(() => { if (id) dispatch(fetchMeetingParticipants(id)); }, [id, dispatch]);

  useEffect(() => { setShowNotFound(false); setLoadingTimeout(false); setInitialLoadComplete(false); }, [id]);

  useEffect(() => {
    if (loading && !initialLoadComplete) setTimeout(() => setLoadingTimeout(true), NOT_FOUND_DELAY_MS);
  }, [loading, initialLoadComplete]);

  useEffect(() => {
    if (currentMeeting || error) setInitialLoadComplete(true);
  }, [currentMeeting, error]);

  useEffect(() => {
    if (!loading && !currentMeeting && initialLoadComplete) setTimeout(() => setShowNotFound(true), 500);
    else if (loadingTimeout && !currentMeeting && !error) setShowNotFound(true);
  }, [loading, currentMeeting, initialLoadComplete, loadingTimeout, error]);

  useEffect(() => {
    if (id) { fetchMeeting(); fetchParticipants(); dispatch(fetchActionTrackerAttributes()); }
    return () => { dispatch(clearMeetingState()); dispatch(clearNotificationError()); dispatch(clearLastNotificationResult()); };
  }, [id, dispatch, fetchMeeting, fetchParticipants]);

  useEffect(() => {
    if (lastNotificationResult) {
      setSnackbar({ open: true, message: `✅ Notifications sent to ${lastNotificationResult.sent} participants!`, severity: 'success' });
      setNotificationDialogOpen(false);
      dispatch(clearLastNotificationResult());
    }
  }, [lastNotificationResult, dispatch]);

  useEffect(() => {
    if (notificationError) { setSnackbar({ open: true, message: notificationError, severity: 'error' }); dispatch(clearNotificationError()); }
  }, [notificationError, dispatch]);

  const handleRefresh = useCallback(() => { setShowNotFound(false); setLoadingTimeout(false); setInitialLoadComplete(false); fetchMeeting(); fetchParticipants(); }, [fetchMeeting, fetchParticipants]);
  const handleBack = useCallback(() => navigate('/meetings'), [navigate]);
  const handleEdit = useCallback(() => navigate(`/meetings/${id}/edit`), [navigate, id]);

  const handleJoinMeeting = useCallback(() => {
    if (!normalizedMeeting) return;
    if (isOnlineMeeting && hasMeetingLink) {
      let meetingUrl = normalizedMeeting.meeting_link;
      if (!meetingUrl.startsWith('http://') && !meetingUrl.startsWith('https://')) meetingUrl = 'https://' + meetingUrl;
      window.open(meetingUrl, '_blank');
    } else if (!isOnlineMeeting && normalizedMeeting.location_text) {
      setSnackbar({ open: true, message: `📍 Physical Location: ${normalizedMeeting.location_text}`, severity: 'info' });
    } else {
      setSnackbar({ open: true, message: 'No meeting link or location available', severity: 'warning' });
    }
  }, [normalizedMeeting, isOnlineMeeting, hasMeetingLink]);

  const handleNotifyClick = useCallback(() => { fetchParticipants(); setNotificationDialogOpen(true); }, [fetchParticipants]);
  const handleSendNotifications = useCallback((notificationData) => dispatch(sendMeetingNotifications({ meetingId: id, notificationData })), [id, dispatch]);
  const handleStatusMenuOpen = (event) => setStatusMenuAnchor(event.currentTarget);
  const handleStatusMenuClose = () => setStatusMenuAnchor(null);
  const handleMoreMenuOpen = (event) => setMoreMenuAnchor(event.currentTarget);
  const handleMoreMenuClose = () => setMoreMenuAnchor(null);

  const handleStatusSelect = (statusValue) => { setSelectedStatus(statusValue); setStatusDialogOpen(true); setStatusMenuAnchor(null); };

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    setStatusUpdating(true);
    try {
      await dispatch(updateMeetingStatus({ id: id, status: selectedStatus, comment: statusComment })).unwrap();
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

  const handleSnackbarClose = () => setSnackbar(prev => ({ ...prev, open: false }));
  const handleErrorClose = () => { setLocalError(null); dispatch(clearMeetingState()); };

  if (loading && !currentMeeting && !showNotFound) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? '#111827' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm"><Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}><CircularProgress size={60} sx={{ mb: 3, color: '#7C3AED' }} /><Typography variant="h6" fontWeight={600} gutterBottom>Loading Meeting Details</Typography><LoadingTimeout timeout={NOT_FOUND_DELAY_MS} /></Paper></Container>
      </Box>
    );
  }

  if (showNotFound && (!currentMeeting || (!loading && !currentMeeting))) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? '#111827' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: alpha('#EF4444', 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}><ErrorOutlineIcon sx={{ fontSize: 48, color: '#EF4444' }} /></Box>
            <Typography variant="h5" color="error" gutterBottom fontWeight={700}>Meeting Not Found</Typography>
            <Typography variant="body2" sx={{ mb: 4, color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>The meeting you're looking for doesn't exist or has been deleted.</Typography>
            <Stack spacing={2}><Button variant="contained" onClick={handleBack} size="large" sx={{ bgcolor: '#7C3AED' }}>Back to Meetings</Button><Button variant="outlined" onClick={handleRefresh} sx={{ borderColor: '#7C3AED', color: '#7C3AED' }}>Try Again</Button></Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? '#111827' : '#F3F4F6' }}>
      <HeaderBar onBack={handleBack} onNotify={handleNotifyClick} onRefresh={handleRefresh} onEdit={handleEdit} onStatusMenuOpen={handleStatusMenuOpen} onMoreMenuOpen={handleMoreMenuOpen} onUpdateLink={() => setUpdateLinkDialogOpen(true)} participantCount={participantCount} getStatusIcon={getStatusIcon} getStatusDisplay={getStatusDisplay} isMobile={isMobile} />

      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
        {(error || localError) && <Alert severity="error" onClose={handleErrorClose} sx={{ mb: 3 }}>{typeof error === 'string' ? error : (localError || 'Failed to load meeting')}</Alert>}

        <MeetingInfoCard meeting={normalizedMeeting} isMobile={isMobile} formatDate={formatDate} formatTime={formatTime} getStatusDisplay={getStatusDisplay} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} isOnlineMeeting={isOnlineMeeting} hasMeetingLink={hasMeetingLink} onUpdateLink={() => setUpdateLinkDialogOpen(true)} onJoinMeeting={handleJoinMeeting} />

        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} variant={isMobile ? "scrollable" : "standard"} scrollButtons={isMobile ? "auto" : false} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: isDarkMode ? '#1F2937' : '#F9FAFB', '& .MuiTab-root': { py: 2, fontWeight: 600, '&.Mui-selected': { color: '#7C3AED' } }, '& .MuiTabs-indicator': { backgroundColor: '#7C3AED', height: 3 } }}>
            <Tab icon={<DescriptionIcon />} iconPosition="start" label="Minutes" />
            <Tab icon={<AssignmentIcon />} iconPosition="start" label="Actions" />
            <Tab icon={<PeopleIcon />} iconPosition="start" label="Participants" />
            <Tab icon={<DescriptionIcon />} iconPosition="start" label="Documents" />
            <Tab icon={<HistoryIcon />} iconPosition="start" label="History" />
            <Tab icon={<HistoryIcon />} iconPosition="start" label="Audit" />
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <TabPanel value={tabValue} index={0}><MeetingMinutes meetingId={id} meetingStatus={normalizedMeeting?.status?.short_name} onRefresh={handleRefresh} /></TabPanel>
            <TabPanel value={tabValue} index={1}><MeetingActionsList meetingId={id} meetingStatus={normalizedMeeting?.status?.short_name} onRefresh={handleRefresh} /></TabPanel>
            <TabPanel value={tabValue} index={2}><ParticipantsTab meetingId={id} participants={participants} onRefresh={fetchParticipants} meetingStatus={normalizedMeeting?.status?.short_name} meetingStartTime={normalizedMeeting?.start_time} currentChairpersonId={normalizedMeeting?.chairperson_id} currentSecretaryId={normalizedMeeting?.secretary_id} /></TabPanel>
            <TabPanel value={tabValue} index={3}><MeetingDocuments meetingId={id} onRefresh={handleRefresh} /></TabPanel>
            <TabPanel value={tabValue} index={4}><MeetingHistory meetingId={id} /></TabPanel>
            <TabPanel value={tabValue} index={5}><MeetingAudit meetingId={id} /></TabPanel>
          </Box>
        </Paper>
      </Container>

      {/* More Options Menu */}
      <Menu anchorEl={moreMenuAnchor} open={Boolean(moreMenuAnchor)} onClose={handleMoreMenuClose}>
        <MenuItem onClick={() => { setUpdateLinkDialogOpen(true); handleMoreMenuClose(); }}><ListItemIcon><UpdateIcon /></ListItemIcon><ListItemText>Update Meeting Link</ListItemText></MenuItem>
        <MenuItem onClick={handleNotifyClick}><ListItemIcon><NotificationsIcon /></ListItemIcon><ListItemText>Send Notifications</ListItemText></MenuItem>
        <MenuItem onClick={handleEdit}><ListItemIcon><EditIcon /></ListItemIcon><ListItemText>Edit Meeting</ListItemText></MenuItem>
        <MenuItem onClick={handleStatusMenuOpen}><ListItemIcon>{getStatusIcon()}</ListItemIcon><ListItemText>Update Status</ListItemText></MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}><ListItemIcon><DeleteIcon sx={{ color: 'error.main' }} /></ListItemIcon><ListItemText>Delete Meeting</ListItemText></MenuItem>
      </Menu>

      {/* Status Update Menu */}
      <Menu anchorEl={statusMenuAnchor} open={Boolean(statusMenuAnchor)} onClose={handleStatusMenuClose}>
        {statusOptions && statusOptions.length > 0 ? (
          statusOptions.map((status) => {
            const statusValue = status.short_name || status.value;
            const displayName = status.label || status.short_name;
            return (
              <MenuItem key={status.id} onClick={() => handleStatusSelect(statusValue)}>
                <ListItemIcon>{statusValue === 'pending' && <ScheduleIcon sx={{ color: status.color }} />}{statusValue === 'started' && <PendingIcon sx={{ color: status.color }} />}{statusValue === 'ended' && <CheckCircleIcon sx={{ color: status.color }} />}{statusValue === 'cancelled' && <CancelIcon sx={{ color: status.color }} />}{statusValue === 'awaiting' && <HourglassEmptyIcon sx={{ color: status.color }} />}{statusValue === 'closed' && <CheckCircleIcon sx={{ color: status.color }} />}</ListItemIcon>
                <ListItemText primary={displayName?.charAt(0).toUpperCase() + displayName?.slice(1)} />
              </MenuItem>
            );
          })
        ) : (
          <>
            <MenuItem onClick={() => handleStatusSelect('pending')}><ListItemIcon><ScheduleIcon /></ListItemIcon><ListItemText>Pending</ListItemText></MenuItem>
            <MenuItem onClick={() => handleStatusSelect('started')}><ListItemIcon><PendingIcon /></ListItemIcon><ListItemText>Started</ListItemText></MenuItem>
            <MenuItem onClick={() => handleStatusSelect('ended')}><ListItemIcon><CheckCircleIcon /></ListItemIcon><ListItemText>Ended</ListItemText></MenuItem>
            <MenuItem onClick={() => handleStatusSelect('awaiting')}><ListItemIcon><HourglassEmptyIcon /></ListItemIcon><ListItemText>Awaiting</ListItemText></MenuItem>
            <MenuItem onClick={() => handleStatusSelect('closed')}><ListItemIcon><CheckCircleIcon /></ListItemIcon><ListItemText>Closed</ListItemText></MenuItem>
            <MenuItem onClick={() => handleStatusSelect('cancelled')}><ListItemIcon><CancelIcon /></ListItemIcon><ListItemText>Cancelled</ListItemText></MenuItem>
          </>
        )}
      </Menu>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle><Typography variant="h6" fontWeight={700}>Update Meeting Status</Typography></DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth><InputLabel>Status</InputLabel><Select value={selectedStatus} label="Status" onChange={(e) => setSelectedStatus(e.target.value)}>{statusOptions && statusOptions.length > 0 ? (statusOptions.map((status) => <MenuItem key={status.id || status.code} value={status.short_name?.toLowerCase()}>{status.short_name?.charAt(0).toUpperCase() + status.short_name?.slice(1)}</MenuItem>)) : (<><MenuItem value="pending">Pending</MenuItem><MenuItem value="started">Started</MenuItem><MenuItem value="ended">Ended</MenuItem><MenuItem value="awaiting">Awaiting</MenuItem><MenuItem value="closed">Closed</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem></>)}</Select></FormControl>
            <TextField fullWidth label="Comment (Optional)" multiline rows={3} value={statusComment} onChange={(e) => setStatusComment(e.target.value)} placeholder="Add a comment about this status change..." />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleStatusUpdate} disabled={statusUpdating || !selectedStatus} sx={{ bgcolor: '#7C3AED' }}>{statusUpdating ? <CircularProgress size={24} /> : 'Update Status'}</Button></DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle><Typography variant="h6" fontWeight={700}>Delete Meeting</Typography></DialogTitle>
        <DialogContent><Typography variant="body1" gutterBottom>Are you sure you want to delete this meeting?</Typography><Alert severity="error" sx={{ mt: 2 }}><strong>Warning:</strong> This action cannot be undone. All minutes, actions, and documents will also be deleted.</Alert></DialogContent>
        <DialogActions><Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button><Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>{deleting ? <CircularProgress size={24} /> : 'Delete Meeting'}</Button></DialogActions>
      </Dialog>

      <NotificationDialog open={notificationDialogOpen} onClose={() => setNotificationDialogOpen(false)} meeting={normalizedMeeting} participants={participants} onSend={handleSendNotifications} sending={sendingNotifications} />
      <UpdateMeetingLinkDialog open={updateLinkDialogOpen} onClose={() => setUpdateLinkDialogOpen(false)} meeting={normalizedMeeting} onUpdate={() => { fetchMeeting(); setSnackbar({ open: true, message: '✅ Meeting link updated successfully!', severity: 'success' }); }} />
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}><Alert onClose={handleSnackbarClose} severity={snackbar.severity} variant="filled">{snackbar.message}</Alert></Snackbar>
    </Box>
  );
};

export default MeetingDetail;