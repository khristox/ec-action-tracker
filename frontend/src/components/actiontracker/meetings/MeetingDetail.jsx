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
  Skeleton,
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
  Snackbar
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
  ContentCopy as ContentCopyIcon,
  Save as SaveIcon
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
  selectNotificationLoading,
  selectNotificationSending,
  selectNotificationError,
  selectLastNotificationResult,
  clearNotificationError,
  clearLastNotificationResult,
} from '../../../store/slices/actionTracker/notificationSlice';
import api from '../../../services/api';
import MeetingAudit from './MeetingAudit';

// ==================== Memoized Rich Text Content Component ====================
const RichTextContent = memo(({ content }) => {
  if (!content || content.trim() === '' || content === '<p></p>') {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        No agenda provided.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        '& p': { marginBottom: '12px', lineHeight: 1.7 },
        '& p:last-child': { marginBottom: 0 },
        '& ul, & ol': { paddingLeft: '24px', marginBottom: '12px' },
        '& li': { marginBottom: '6px' },
        '& h1, & h2, & h3': { margin: '16px 0 8px 0', fontWeight: 600 },
        '& blockquote': {
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          paddingLeft: '16px',
          color: 'text.secondary',
          fontStyle: 'italic',
          margin: '16px 0'
        },
        '& pre': {
          backgroundColor: '#f8fafc',
          padding: '12px',
          borderRadius: 1,
          overflowX: 'auto',
          fontFamily: 'monospace'
        },
        '& img': {
          maxWidth: '100%',
          height: 'auto',
          borderRadius: 1,
          margin: '12px 0'
        }
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
});

RichTextContent.displayName = 'RichTextContent';

// ==================== Memoized Tab Panel Component ====================
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

// ==================== Memoized Meeting Info Card ====================
const MeetingInfoCard = memo(({ 
  meeting, 
  isMobile, 
  formatDate, 
  formatTime, 
  getStatusDisplay, 
  getStatusColor, 
  getStatusIcon, 
  getStatusValue, 
  isOnlineMeeting, 
  hasMeetingLink, 
  onUpdateLink,
  onJoinMeeting
}) => (
  <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, mb: 4, borderRadius: 3 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
      <Box sx={{ flex: 1 }}>
        <Typography variant={isMobile ? "h5" : "h4"} fontWeight={800} gutterBottom>
          {meeting?.title}
        </Typography>
        {meeting?.description && (
          <Typography variant="body1" color="text.secondary">
            {meeting.description}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={1}>
        <Chip
          label={getStatusDisplay()}
          color={getStatusColor(getStatusValue())}
          icon={getStatusIcon(getStatusValue())}
          sx={{ fontWeight: 600, px: 1, py: 2, '& .MuiChip-label': { fontWeight: 600 } }}
        />
      </Stack>
    </Stack>

    <Divider sx={{ my: 3 }} />

    <Grid container spacing={3}>
      {/* Date and Time */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            <CalendarIcon />
          </Avatar>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              DATE & TIME
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {formatDate(meeting?.meeting_date)}
            </Typography>
            {meeting?.start_time && (
              <Typography variant="body2" color="text.secondary">
                {formatTime(meeting.start_time)}
                {meeting?.end_time && ` - ${formatTime(meeting.end_time)}`}
              </Typography>
            )}
          </Box>
        </Stack>
      </Grid>

      {/* Location / Meeting Platform */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: 'secondary.main', width: 48, height: 48 }}>
            {isOnlineMeeting ? <VideoCallIcon /> : <LocationIcon />}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {isOnlineMeeting ? 'MEETING PLATFORM' : 'LOCATION'}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body1" fontWeight={600}>
                {isOnlineMeeting 
                  ? (meeting?.platform === 'zoom' ? 'Zoom' :
                     meeting?.platform === 'google_meet' ? 'Google Meet' :
                     meeting?.platform === 'microsoft_teams' ? 'Microsoft Teams' :
                     meeting?.platform === 'webex' ? 'Cisco Webex' :
                     'Online Meeting')
                  : (meeting?.location_text || 'Not specified')}
              </Typography>
              <Tooltip title="Update Meeting Link">
                <IconButton size="small" onClick={onUpdateLink} color="primary">
                  <UpdateIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {(isOnlineMeeting && hasMeetingLink) && (
              <Button
                size="small"
                startIcon={<LinkIcon />}
                onClick={onJoinMeeting}
                sx={{ mt: 0.5, textTransform: 'none' }}
              >
                Join Meeting
              </Button>
            )}
            {(!isOnlineMeeting && meeting?.location_text) && (
              <Button
                size="small"
                startIcon={<LocationIcon />}
                onClick={onJoinMeeting}
                sx={{ mt: 0.5, textTransform: 'none' }}
              >
                View Location
              </Button>
            )}
          </Box>
        </Stack>
      </Grid>

      {/* Secretary */}
      {meeting?.facilitator && (
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: 'info.main', width: 48, height: 48 }}>
              <PeopleIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                SECRETARY
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {meeting.facilitator}
              </Typography>
            </Box>
          </Stack>
        </Grid>
      )}

      {/* Chairperson */}
      {meeting?.chairperson_name && (
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: 'warning.main', width: 48, height: 48 }}>
              <PeopleIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                CHAIRPERSON
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {meeting.chairperson_name}
              </Typography>
            </Box>
          </Stack>
        </Grid>
      )}
    </Grid>

    {/* Agenda Section */}
    {meeting?.agenda && (
      <Box sx={{ mt: 4 }}>
        <Divider sx={{ mb: 3 }} />
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar sx={{ bgcolor: 'success.main', width: 48, height: 48 }}>
            <DescriptionIcon />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Agenda
            </Typography>
            <Paper variant="outlined" sx={{ p: 3, bgcolor: '#f8fafc', borderRadius: 2 }}>
              <RichTextContent content={meeting.agenda} />
            </Paper>
          </Box>
        </Stack>
      </Box>
    )}
  </Paper>
));

MeetingInfoCard.displayName = 'MeetingInfoCard';

// ==================== Memoized Header Bar ====================
const HeaderBar = memo(({ onBack, onNotify, onRefresh, onEdit, onStatusMenuOpen, onMoreMenuOpen, onUpdateLink, participantCount, getStatusIcon, getStatusValue, getStatusDisplay, isMobile }) => (
  <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e2e8f0' }}>
    <Toolbar sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
      <IconButton edge="start" onClick={onBack} sx={{ mr: 2 }}>
        <ArrowBackIcon />
      </IconButton>
      <Typography variant="h6" sx={{ flex: 1, fontWeight: 700, color: '#0f172a' }}>
        Meeting Details
      </Typography>
      {!isMobile && (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Update Meeting Link">
            <IconButton onClick={onUpdateLink} color="info" size="small">
              <UpdateIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Send Notifications">
            <IconButton onClick={onNotify} color="primary" size="small">
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
            <IconButton onClick={onEdit} color="primary" size="small">
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Update Status">
            <Button
              variant="outlined"
              size="small"
              startIcon={getStatusIcon(getStatusValue())}
              onClick={onStatusMenuOpen}
              sx={{ textTransform: 'none' }}
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
      {isMobile && (
        <IconButton onClick={onMoreMenuOpen}>
          <MoreVertIcon />
        </IconButton>
      )}
    </Toolbar>
  </AppBar>
));

HeaderBar.displayName = 'HeaderBar';

// ==================== Main Component ====================
const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Meeting selectors
  const currentMeeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingsError);
  const statusOptions = useSelector(selectMeetingStatusOptions);
  
  // Notification selectors
  const participants = useSelector(selectNotificationParticipants);
  const loadingParticipants = useSelector(selectNotificationLoading);
  const sendingNotifications = useSelector(selectNotificationSending);
  const notificationError = useSelector(selectNotificationError);
  const lastNotificationResult = useSelector(selectLastNotificationResult);
  
  // Local UI state
  const [uiState, setUiState] = useState({
    tabValue: 0,
    notificationDialogOpen: false,
    updateLinkDialogOpen: false,
    showDeleteDialog: false,
    snackbar: { open: false, message: '', severity: 'success' }
  });
  
  const [statusState, setStatusState] = useState({
    anchorEl: null,
    showDialog: false,
    selectedStatus: '',
    comment: '',
    updating: false
  });
  
  const [moreAnchorEl, setMoreAnchorEl] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const meetingStatus = useMemo(() => {
    const status = currentMeeting?.status;
    if (!status) return null;
    if (typeof status === 'string') return status;
    return status.short_name || status.name || null;
  }, [currentMeeting?.status]);

  const participantCount = useMemo(() => participants.length, [participants]);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Date not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }, []);

  const formatTime = useCallback((dateString) => {
    if (!dateString) return 'Time not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid time';
    }
  }, []);

  const getStatusColor = useCallback((status) => {
    if (!status) return 'default';
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed' || statusLower === 'ended') return 'success';
    if (statusLower === 'cancelled') return 'error';
    if (statusLower === 'in_progress' || statusLower === 'ongoing') return 'info';
    if (statusLower === 'pending' || statusLower === 'scheduled') return 'warning';
    return 'default';
  }, []);

  const getStatusIcon = useCallback((status) => {
    if (!status) return <ScheduleIcon />;
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed' || statusLower === 'ended') return <CheckCircleIcon />;
    if (statusLower === 'cancelled') return <CancelIcon />;
    if (statusLower === 'in_progress' || statusLower === 'ongoing') return <PendingIcon />;
    return <ScheduleIcon />;
  }, []);

  const getStatusDisplay = useCallback(() => {
    const status = currentMeeting?.status;
    if (!status) return 'Unknown';
    if (typeof status === 'string') return status;
    return status.short_name || status.name || 'Unknown';
  }, [currentMeeting?.status]);

  const getStatusValue = useCallback(() => {
    const status = currentMeeting?.status;
    if (!status) return '';
    if (typeof status === 'string') return status;
    return status.short_name || status.value || '';
  }, [currentMeeting?.status]);

  const isOnlineMeeting = useMemo(() => 
    currentMeeting?.platform && currentMeeting.platform !== 'physical', 
    [currentMeeting?.platform]
  );
  
  const hasMeetingLink = useMemo(() => 
    currentMeeting?.meeting_link, 
    [currentMeeting?.meeting_link]
  );

  // Calculate meeting start time
  const meetingStartTime = useMemo(() => {
    if (!currentMeeting) return null;
    if (currentMeeting.start_time) {
      return currentMeeting.start_time;
    }
    if (currentMeeting.meeting_date && currentMeeting.start_time) {
      const date = new Date(currentMeeting.meeting_date);
      const [hours, minutes] = currentMeeting.start_time.split(':');
      date.setHours(parseInt(hours), parseInt(minutes));
      return date.toISOString();
    }
    return null;
  }, [currentMeeting]);

  // Handle Join Meeting
  const handleJoinMeeting = useCallback(() => {
    if (!currentMeeting) return;
    
    if (isOnlineMeeting && hasMeetingLink) {
      let meetingUrl = currentMeeting.meeting_link;
      if (!meetingUrl.startsWith('http://') && !meetingUrl.startsWith('https://')) {
        meetingUrl = 'https://' + meetingUrl;
      }
      window.open(meetingUrl, '_blank');
    } else if (!isOnlineMeeting && currentMeeting.location_text) {
      setUiState(prev => ({
        ...prev,
        snackbar: {
          open: true,
          message: `📍 Physical Location: ${currentMeeting.location_text}`,
          severity: 'info'
        }
      }));
    } else {
      setUiState(prev => ({
        ...prev,
        snackbar: {
          open: true,
          message: 'No meeting link or location available',
          severity: 'warning'
        }
      }));
    }
  }, [currentMeeting, isOnlineMeeting, hasMeetingLink]);

  const fetchMeeting = useCallback(() => {
    if (id) dispatch(fetchMeetingById(id));
  }, [id, dispatch]);

  const fetchParticipants = useCallback(() => {
    if (id) dispatch(fetchMeetingParticipants(id));
  }, [id, dispatch]);

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
      setUiState(prev => ({
        ...prev,
        snackbar: {
          open: true,
          message: `✅ Notifications sent to ${lastNotificationResult.sent} participants successfully!`,
          severity: 'success'
        },
        notificationDialogOpen: false
      }));
      dispatch(clearLastNotificationResult());
    }
  }, [lastNotificationResult, dispatch]);

  useEffect(() => {
    if (notificationError) {
      setUiState(prev => ({
        ...prev,
        snackbar: {
          open: true,
          message: notificationError,
          severity: 'error'
        }
      }));
      dispatch(clearNotificationError());
    }
  }, [notificationError, dispatch]);

  const handleRefresh = useCallback(() => {
    fetchMeeting();
    fetchParticipants();
  }, [fetchMeeting, fetchParticipants]);

  const handleBack = useCallback(() => {
    navigate('/meetings');
  }, [navigate]);

  const handleEdit = useCallback(() => {
    navigate(`/meetings/${id}/edit/`);
  }, [navigate, id]);

  const handleTabChange = useCallback((event, newValue) => {
    setUiState(prev => ({ ...prev, tabValue: newValue }));
  }, []);

  const handleStatusMenuOpen = useCallback((event) => {
    setStatusState(prev => ({ ...prev, anchorEl: event.currentTarget }));
  }, []);

  const handleStatusMenuClose = useCallback(() => {
    setStatusState(prev => ({ ...prev, anchorEl: null }));
  }, []);

  const handleMoreMenuOpen = useCallback((event) => {
    setMoreAnchorEl(event.currentTarget);
  }, []);

  const handleMoreMenuClose = useCallback(() => {
    setMoreAnchorEl(null);
  }, []);

  const handleStatusSelect = useCallback((status) => {
    setStatusState(prev => ({
      ...prev,
      selectedStatus: status,
      comment: '',
      showDialog: true,
      anchorEl: null
    }));
  }, []);

  const handleStatusDialogClose = useCallback(() => {
    setStatusState(prev => ({ ...prev, showDialog: false, selectedStatus: '', comment: '' }));
  }, []);

  const handleStatusCommentChange = useCallback((e) => {
    setStatusState(prev => ({ ...prev, comment: e.target.value }));
  }, []);

  const handleStatusChange = useCallback((e) => {
    setStatusState(prev => ({ ...prev, selectedStatus: e.target.value }));
  }, []);

  const handleStatusUpdate = useCallback(async () => {
    if (!statusState.selectedStatus) return;
    
    setStatusState(prev => ({ ...prev, updating: true }));
    try {
      await dispatch(updateMeetingStatus({
        id: id,
        status: statusState.selectedStatus,
        comment: statusState.comment
      })).unwrap();
      
      setStatusState(prev => ({
        ...prev,
        showDialog: false,
        selectedStatus: '',
        comment: '',
        updating: false
      }));
      fetchMeeting();
    } catch (err) {
      console.error('Error updating status:', err);
      setLocalError(err.message || 'Failed to update meeting status');
      setStatusState(prev => ({ ...prev, updating: false }));
    }
  }, [id, dispatch, statusState.selectedStatus, statusState.comment, fetchMeeting]);

  const handleDeleteClick = useCallback(() => {
    setUiState(prev => ({ ...prev, showDeleteDialog: true }));
    handleMoreMenuClose();
  }, []);

  const handleDeleteDialogClose = useCallback(() => {
    setUiState(prev => ({ ...prev, showDeleteDialog: false }));
  }, []);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await dispatch(deleteMeeting(id)).unwrap();
      setUiState(prev => ({ ...prev, showDeleteDialog: false }));
      navigate('/meetings');
    } catch (err) {
      console.error('Error deleting meeting:', err);
      setLocalError(err.message || 'Failed to delete meeting');
      setUiState(prev => ({ ...prev, showDeleteDialog: false }));
    } finally {
      setDeleting(false);
    }
  }, [id, dispatch, navigate]);

  const handleNotifyClick = useCallback(() => {
    fetchParticipants();
    setUiState(prev => ({ ...prev, notificationDialogOpen: true }));
    handleMoreMenuClose();
  }, [fetchParticipants]);

  const handleNotificationDialogClose = useCallback(() => {
    setUiState(prev => ({ ...prev, notificationDialogOpen: false }));
  }, []);

  const handleSendNotifications = useCallback((notificationData) => {
    dispatch(sendMeetingNotifications({
      meetingId: id,
      notificationData
    }));
  }, [id, dispatch]);

  const handleUpdateLinkClick = useCallback(() => {
    setUiState(prev => ({ ...prev, updateLinkDialogOpen: true }));
    handleMoreMenuClose();
  }, []);

  const handleUpdateLinkDialogClose = useCallback(() => {
    setUiState(prev => ({ ...prev, updateLinkDialogOpen: false }));
  }, []);

  const handleMeetingLinkUpdate = useCallback((updatedMeeting) => {
    fetchMeeting();
    setUiState(prev => ({
      ...prev,
      snackbar: {
        open: true,
        message: '✅ Meeting information updated successfully!',
        severity: 'success'
      }
    }));
  }, [fetchMeeting]);

  const handleSnackbarClose = useCallback(() => {
    setUiState(prev => ({ ...prev, snackbar: { ...prev.snackbar, open: false } }));
  }, []);

  const handleErrorClose = useCallback(() => {
    setLocalError(null);
    dispatch(clearMeetingState());
  }, [dispatch]);

  if (loading && !currentMeeting) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', p: { xs: 2, sm: 3, md: 4 } }}>
        <Container maxWidth="xl">
          <Stack spacing={3}>
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
          </Stack>
        </Container>
      </Box>
    );
  }

  if (!currentMeeting && !loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <Typography variant="h5" color="error" gutterBottom fontWeight={700}>
              Meeting Not Found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              The meeting you're looking for doesn't exist or has been deleted.
            </Typography>
            <Button variant="contained" onClick={handleBack} size="large">
              Back to Meetings
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <HeaderBar
        onBack={handleBack}
        onNotify={handleNotifyClick}
        onRefresh={handleRefresh}
        onEdit={handleEdit}
        onStatusMenuOpen={handleStatusMenuOpen}
        onMoreMenuOpen={handleMoreMenuOpen}
        onUpdateLink={handleUpdateLinkClick}
        participantCount={participantCount}
        getStatusIcon={getStatusIcon}
        getStatusValue={getStatusValue}
        getStatusDisplay={getStatusDisplay}
        isMobile={isMobile}
      />

      {/* More Options Menu */}
      <Menu
        anchorEl={moreAnchorEl}
        open={Boolean(moreAnchorEl)}
        onClose={handleMoreMenuClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 180 } }}
      >
        <MenuItem onClick={handleUpdateLinkClick}>
          <ListItemIcon><UpdateIcon fontSize="small" color="info" /></ListItemIcon>
          <ListItemText>Update Meeting Link</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleNotifyClick}>
          <ListItemIcon><NotificationsIcon fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText>Send Notifications</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleRefresh}>
          <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Refresh</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon><EditIcon fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText>Edit Meeting</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleStatusMenuOpen}>
          <ListItemIcon>{getStatusIcon(getStatusValue())}</ListItemIcon>
          <ListItemText>Update Status</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete Meeting</ListItemText>
        </MenuItem>
      </Menu>

      {/* Status Update Menu */}
      <Menu
        anchorEl={statusState.anchorEl}
        open={Boolean(statusState.anchorEl)}
        onClose={handleStatusMenuClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 200 } }}
      >
        {statusOptions && statusOptions.length > 0 ? (
          statusOptions.map((status) => (
            <MenuItem key={status.value || status.id} onClick={() => handleStatusSelect(status.value || status.shortName)}>
              <ListItemIcon>
                {getStatusIcon(status.value || status.shortName)}
              </ListItemIcon>
              <ListItemText>{status.label || status.name}</ListItemText>
            </MenuItem>
          ))
        ) : (
          <>
            <MenuItem onClick={() => handleStatusSelect('scheduled')}>
              <ListItemIcon><ScheduleIcon color="warning" /></ListItemIcon>
              <ListItemText>Scheduled</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleStatusSelect('ongoing')}>
              <ListItemIcon><PendingIcon color="info" /></ListItemIcon>
              <ListItemText>Ongoing</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleStatusSelect('completed')}>
              <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
              <ListItemText>Completed</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleStatusSelect('cancelled')}>
              <ListItemIcon><CancelIcon color="error" /></ListItemIcon>
              <ListItemText>Cancelled</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Status Update Dialog */}
      <Dialog open={statusState.showDialog} onClose={handleStatusDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>Update Meeting Status</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusState.selectedStatus}
                label="Status"
                onChange={handleStatusChange}
              >
                {statusOptions && statusOptions.length > 0 ? (
                  statusOptions.map((status) => (
                    <MenuItem key={status.value || status.id} value={status.value || status.shortName}>
                      {status.label || status.name}
                    </MenuItem>
                  ))
                ) : (
                  <>
                    <MenuItem value="scheduled">Scheduled</MenuItem>
                    <MenuItem value="ongoing">Ongoing</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </>
                )}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Comment (Optional)"
              multiline
              rows={3}
              value={statusState.comment}
              onChange={handleStatusCommentChange}
              placeholder="Add a comment about this status change..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={handleStatusDialogClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleStatusUpdate}
            disabled={statusState.updating || !statusState.selectedStatus}
          >
            {statusState.updating ? <CircularProgress size={24} /> : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={uiState.showDeleteDialog} onClose={handleDeleteDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>Delete Meeting</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete this meeting?
          </Typography>
          <Alert severity="error" sx={{ mt: 2 }}>
            <strong>Warning:</strong> This action cannot be undone. All minutes, actions, and documents will also be deleted.
          </Alert>
          <Box sx={{ mt: 3, p: 2, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fee2e2' }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Meeting: {currentMeeting?.title}
            </Typography>
            {currentMeeting?.meeting_date && (
              <Typography variant="body2" color="text.secondary">
                Date: {formatDate(currentMeeting.meeting_date)}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={handleDeleteDialogClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete Meeting'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Alert */}
      {(error || localError) && (
        <Container maxWidth="xl" sx={{ mt: 2 }}>
          <Alert severity="error" onClose={handleErrorClose}>
            {typeof error === 'string' ? error : (localError || 'Failed to load meeting')}
          </Alert>
        </Container>
      )}

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
        <MeetingInfoCard
          meeting={currentMeeting}
          isMobile={isMobile}
          formatDate={formatDate}
          formatTime={formatTime}
          getStatusDisplay={getStatusDisplay}
          getStatusColor={getStatusColor}
          getStatusIcon={getStatusIcon}
          getStatusValue={getStatusValue}
          isOnlineMeeting={isOnlineMeeting}
          hasMeetingLink={hasMeetingLink}
          onUpdateLink={handleUpdateLinkClick}
          onJoinMeeting={handleJoinMeeting}
        />

        {/* Tabs Section */}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Tabs
            value={uiState.tabValue}
            onChange={handleTabChange}
            variant={isMobile ? "scrollable" : "standard"}
            scrollButtons={isMobile ? "auto" : false}
            allowScrollButtonsMobile
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              bgcolor: 'white',
              '& .MuiTab-root': { py: 2, fontWeight: 600, minWidth: isMobile ? 'auto' : 120 }
            }}
          >
            <Tab icon={<DescriptionIcon />} iconPosition="start" label="Minutes" />
            <Tab icon={<AssignmentIcon />} iconPosition="start" label="Actions" />
            <Tab icon={<PeopleIcon />} iconPosition="start" label="Participants" />
            <Tab icon={<DescriptionIcon />} iconPosition="start" label="Documents" />
            <Tab icon={<HistoryIcon />} iconPosition="start" label="History" />
            <Tab icon={<HistoryIcon />} iconPosition="start" label="Audit" />
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <TabPanel value={uiState.tabValue} index={0}>
              <MeetingMinutes meetingId={id} meetingStatus={meetingStatus} onRefresh={handleRefresh} />
            </TabPanel>

            <TabPanel value={uiState.tabValue} index={1}>
              <MeetingActionsList meetingId={id} meetingStatus={meetingStatus} onRefresh={handleRefresh} />
            </TabPanel>

            <TabPanel value={uiState.tabValue} index={2}>
              <ParticipantsTab 
                meetingId={id}
                participants={participants}
                onRefresh={fetchParticipants}
                meetingStatus={meetingStatus}
                meetingStartTime={meetingStartTime}
                currentChairpersonId={currentMeeting?.chairperson_id}
                currentSecretaryId={currentMeeting?.secretary_id}
              />
            </TabPanel>

            <TabPanel value={uiState.tabValue} index={3}>
              <MeetingDocuments meetingId={id} onRefresh={handleRefresh} />
            </TabPanel>

            <TabPanel value={uiState.tabValue} index={4}>
              <MeetingHistory meetingId={id} />
            </TabPanel>

            <TabPanel value={uiState.tabValue} index={5}>
              <MeetingAudit meetingId={id} />
            </TabPanel>
          </Box>
        </Paper>
      </Container>

      {/* Notification Dialog */}
      <NotificationDialog
        open={uiState.notificationDialogOpen}
        onClose={handleNotificationDialogClose}
        meeting={currentMeeting}
        participants={participants}
        onSend={handleSendNotifications}
        sending={sendingNotifications}
      />

      {/* Update Meeting Link Dialog */}
      <UpdateMeetingLinkDialog
        open={uiState.updateLinkDialogOpen}
        onClose={handleUpdateLinkDialogClose}
        meeting={currentMeeting}
        onUpdate={handleMeetingLinkUpdate}
      />

      {/* Snackbar */}
      <Snackbar
        open={uiState.snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={uiState.snackbar.severity}
          variant="filled"
        >
          {uiState.snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingDetail;