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
  DialogTitle,  DialogContent,
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
  CardContent
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
  AccessTime as AccessTimeIcon
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
import MeetingAudit from './MeetingAudit';

// ==================== Constants ====================
const COLORS = {
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  danger: '#EF4444',
  dangerLight: '#F87171',
  info: '#3B82F6',
  infoLight: '#60A5FA',
  secondary: '#6B7280',
  secondaryLight: '#9CA3AF',
  gradient: {
    primary: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
  }
};

// ==================== Memoized Rich Text Content Component ====================
const RichTextContent = memo(({ content }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
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
        '& p': { marginBottom: '12px', lineHeight: 1.7, color: isDarkMode ? '#e0e0e0' : 'inherit' },
        '& p:last-child': { marginBottom: 0 },
        '& ul, & ol': { paddingLeft: '24px', marginBottom: '12px' },
        '& li': { marginBottom: '6px', color: isDarkMode ? '#e0e0e0' : 'inherit' },
        '& h1, & h2, & h3': { margin: '16px 0 8px 0', fontWeight: 600, color: isDarkMode ? '#ffffff' : 'inherit' },
        '& blockquote': {
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          paddingLeft: '16px',
          color: 'text.secondary',
          fontStyle: 'italic',
          margin: '16px 0'
        },
        '& pre': {
          backgroundColor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : '#f8fafc',
          padding: '12px',
          borderRadius: 1,
          overflowX: 'auto',
          fontFamily: 'monospace',
          color: isDarkMode ? '#e0e0e0' : 'inherit'
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

// ==================== Header Bar ====================
const HeaderBar = memo(({ 
  onBack, 
  onNotify, 
  onRefresh, 
  onEdit, 
  onStatusMenuOpen, 
  onMoreMenuOpen, 
  onUpdateLink, 
  participantCount, 
  getStatusIcon, 
  getStatusDisplay,
  isMobile 
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        zIndex: theme.zIndex.drawer + 1
      }}
    >
      <Toolbar sx={{ px: { xs: 1.5, sm: 3 } }}>
        <IconButton onClick={onBack} edge="start" sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>

        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
          Meeting Details
        </Typography>

        {isMobile ? (
          <Stack direction="row" spacing={1}>
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
                startIcon={getStatusIcon()}
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
      </Toolbar>
    </AppBar>
  );
});

HeaderBar.displayName = 'HeaderBar';

// ==================== Meeting Info Card ====================
const MeetingInfoCard = memo(({ 
  meeting, 
  isMobile, 
  formatDate, 
  formatTime, 
  getStatusDisplay, 
  getStatusColor, 
  getStatusIcon, 
  isOnlineMeeting, 
  hasMeetingLink, 
  onUpdateLink,
  onJoinMeeting
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();
  
  return (
    <Card sx={{ 
      mb: 3, 
      borderRadius: 3,
      overflow: 'hidden',
      border: `1px solid ${isDarkMode ? alpha(theme.palette.common.white, 0.1) : alpha(COLORS.primary, 0.1)}`,
      bgcolor: 'background.paper'
    }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight={800} sx={{ color: isDarkMode ? '#ffffff' : 'inherit' }}>
            {meeting?.title}
          </Typography>
          <Chip
            label={getStatusDisplay()}
            color={statusColor}
            icon={statusIcon}
            sx={{ fontWeight: 600, '& .MuiChip-label': { fontWeight: 600 } }}
          />
        </Stack>

        {meeting?.description && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              {meeting.description}
            </Typography>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={{ xs: 2, sm: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: alpha(COLORS.primary, 0.1), color: COLORS.primary, width: 48, height: 48 }}>
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
                    <AccessTimeIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                    {formatTime(meeting.start_time)}
                    {meeting?.end_time && ` - ${formatTime(meeting.end_time)}`}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: alpha(COLORS.info, 0.1), color: COLORS.info, width: 48, height: 48 }}>
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
              </Box>
            </Stack>
          </Grid>

          {meeting?.facilitator && (
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: alpha(COLORS.success, 0.1), color: COLORS.success, width: 48, height: 48 }}>
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

          {meeting?.chairperson_name && (
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: alpha(COLORS.warning, 0.1), color: COLORS.warning, width: 48, height: 48 }}>
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
              <Avatar sx={{ bgcolor: alpha(COLORS.warning, 0.1), color: COLORS.warning, width: 48, height: 48 }}>
                <DescriptionIcon />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Agenda
                </Typography>
                <Paper variant="outlined" sx={{ p: 3, bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 2 }}>
                  <RichTextContent content={meeting.agenda} />
                </Paper>
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
  
  // Redux selectors
  const currentMeeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingsError);
  const statusOptions = useSelector(selectMeetingStatusOptions);
  
  // Notification selectors
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

  // Helper functions
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

  const getStatusColor = useCallback(() => {
    const status = currentMeeting?.status?.short_name || currentMeeting?.status;
    if (!status) return 'default';
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed' || statusLower === 'ended') return 'success';
    if (statusLower === 'cancelled') return 'error';
    if (statusLower === 'in_progress' || statusLower === 'ongoing' || statusLower === 'started') return 'info';
    if (statusLower === 'pending' || statusLower === 'scheduled') return 'warning';
    return 'default';
  }, [currentMeeting?.status]);

  const getStatusIcon = useCallback(() => {
    const status = currentMeeting?.status?.short_name || currentMeeting?.status;
    if (!status) return <ScheduleIcon />;
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed' || statusLower === 'ended') return <CheckCircleIcon />;
    if (statusLower === 'cancelled') return <CancelIcon />;
    if (statusLower === 'in_progress' || statusLower === 'ongoing' || statusLower === 'started') return <PendingIcon />;
    return <ScheduleIcon />;
  }, [currentMeeting?.status]);

  const getStatusDisplay = useCallback(() => {
    const status = currentMeeting?.status;
    if (!status) return 'Unknown';
    if (typeof status === 'string') return status;
    return status.short_name || status.name || 'Unknown';
  }, [currentMeeting?.status]);

  const isOnlineMeeting = useMemo(() => 
    currentMeeting?.platform && currentMeeting.platform !== 'physical', 
    [currentMeeting?.platform]
  );
  
  const hasMeetingLink = useMemo(() => 
    currentMeeting?.meeting_link, 
    [currentMeeting?.meeting_link]
  );

  const participantCount = useMemo(() => participants.length, [participants]);

  // Data fetching
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
      setSnackbar({
        open: true,
        message: `✅ Notifications sent to ${lastNotificationResult.sent} participants successfully!`,
        severity: 'success'
      });
      setNotificationDialogOpen(false);
      dispatch(clearLastNotificationResult());
    }
  }, [lastNotificationResult, dispatch]);

  useEffect(() => {
    if (notificationError) {
      setSnackbar({
        open: true,
        message: notificationError,
        severity: 'error'
      });
      dispatch(clearNotificationError());
    }
  }, [notificationError, dispatch]);

  // Handlers
  const handleRefresh = useCallback(() => {
    fetchMeeting();
    fetchParticipants();
  }, [fetchMeeting, fetchParticipants]);

  const handleBack = useCallback(() => {
    navigate('/meetings');
  }, [navigate]);

  const handleEdit = useCallback(() => {
    navigate(`/meetings/${id}/edit`);
  }, [navigate, id]);

  const handleJoinMeeting = useCallback(() => {
    if (!currentMeeting) return;
    
    if (isOnlineMeeting && hasMeetingLink) {
      let meetingUrl = currentMeeting.meeting_link;
      if (!meetingUrl.startsWith('http://') && !meetingUrl.startsWith('https://')) {
        meetingUrl = 'https://' + meetingUrl;
      }
      window.open(meetingUrl, '_blank');
    } else if (!isOnlineMeeting && currentMeeting.location_text) {
      setSnackbar({
        open: true,
        message: `📍 Physical Location: ${currentMeeting.location_text}`,
        severity: 'info'
      });
    } else {
      setSnackbar({
        open: true,
        message: 'No meeting link or location available',
        severity: 'warning'
      });
    }
  }, [currentMeeting, isOnlineMeeting, hasMeetingLink]);

  const handleNotifyClick = useCallback(() => {
    fetchParticipants();
    setNotificationDialogOpen(true);
  }, [fetchParticipants]);

  const handleSendNotifications = useCallback((notificationData) => {
    dispatch(sendMeetingNotifications({
      meetingId: id,
      notificationData
    }));
  }, [id, dispatch]);

  const handleStatusMenuOpen = (event) => {
    setStatusMenuAnchor(event.currentTarget);
  };

  const handleStatusMenuClose = () => {
    setStatusMenuAnchor(null);
  };

  const handleMoreMenuOpen = (event) => {
    setMoreMenuAnchor(event.currentTarget);
  };

  const handleMoreMenuClose = () => {
    setMoreMenuAnchor(null);
  };

  const handleStatusSelect = (status) => {
    setSelectedStatus(status);
    setStatusDialogOpen(true);
    setStatusMenuAnchor(null);
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    
    setStatusUpdating(true);
    try {
      await dispatch(updateMeetingStatus({
        id: id,
        status: selectedStatus,
        comment: statusComment
      })).unwrap();
      
      setStatusDialogOpen(false);
      setSelectedStatus('');
      setStatusComment('');
      fetchMeeting();
      
      setSnackbar({
        open: true,
        message: '✅ Meeting status updated successfully!',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error updating status:', err);
      setLocalError(err.message || 'Failed to update meeting status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDeleteClick = () => {
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
      console.error('Error deleting meeting:', err);
      setLocalError(err.message || 'Failed to delete meeting');
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleErrorClose = () => {
    setLocalError(null);
    dispatch(clearMeetingState());
  };

  // Loading state
  if (loading && !currentMeeting) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, sm: 3 } }}>
        <Container maxWidth="xl">
          <Stack spacing={3}>
            <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
          </Stack>
        </Container>
      </Box>
    );
  }

  // Not found state
  if (!currentMeeting && !loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <HeaderBar
        onBack={handleBack}
        onNotify={handleNotifyClick}
        onRefresh={handleRefresh}
        onEdit={handleEdit}
        onStatusMenuOpen={handleStatusMenuOpen}
        onMoreMenuOpen={handleMoreMenuOpen}
        onUpdateLink={() => setUpdateLinkDialogOpen(true)}
        participantCount={participantCount}
        getStatusIcon={getStatusIcon}
        getStatusDisplay={getStatusDisplay}
        isMobile={isMobile}
      />

      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
        {/* Error Alert */}
        {(error || localError) && (
          <Alert severity="error" onClose={handleErrorClose} sx={{ mb: 3 }}>
            {typeof error === 'string' ? error : (localError || 'Failed to load meeting')}
          </Alert>
        )}

        {/* Meeting Info Card */}
        <MeetingInfoCard
          meeting={currentMeeting}
          isMobile={isMobile}
          formatDate={formatDate}
          formatTime={formatTime}
          getStatusDisplay={getStatusDisplay}
          getStatusColor={getStatusColor}
          getStatusIcon={getStatusIcon}
          isOnlineMeeting={isOnlineMeeting}
          hasMeetingLink={hasMeetingLink}
          onUpdateLink={() => setUpdateLinkDialogOpen(true)}
          onJoinMeeting={handleJoinMeeting}
        />

        {/* Tabs Section */}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Tabs
            value={tabValue}
            onChange={(e, v) => setTabValue(v)}
            variant={isMobile ? "scrollable" : "standard"}
            scrollButtons={isMobile ? "auto" : false}
            allowScrollButtonsMobile
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              '& .MuiTab-root': {
                py: 2,
                fontWeight: 600,
                minWidth: isMobile ? 'auto' : 120
              }
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
            <TabPanel value={tabValue} index={0}>
              <MeetingMinutes meetingId={id} meetingStatus={currentMeeting?.status?.short_name} onRefresh={handleRefresh} />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <MeetingActionsList meetingId={id} meetingStatus={currentMeeting?.status?.short_name} onRefresh={handleRefresh} />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <ParticipantsTab 
                meetingId={id}
                participants={participants}
                onRefresh={fetchParticipants}
                meetingStatus={currentMeeting?.status?.short_name}
                meetingStartTime={currentMeeting?.start_time}
                currentChairpersonId={currentMeeting?.chairperson_id}
                currentSecretaryId={currentMeeting?.secretary_id}
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
          </Box>
        </Paper>
      </Container>

      {/* More Options Menu */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={handleMoreMenuClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 180 } }}
      >
        <MenuItem onClick={() => { setUpdateLinkDialogOpen(true); handleMoreMenuClose(); }}>
          <ListItemIcon><UpdateIcon fontSize="small" color="info" /></ListItemIcon>
          <ListItemText>Update Meeting Link</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleNotifyClick}>
          <ListItemIcon><NotificationsIcon fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText>Send Notifications</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon><EditIcon fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText>Edit Meeting</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleStatusMenuOpen}>
          <ListItemIcon>{getStatusIcon()}</ListItemIcon>
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
      anchorEl={statusMenuAnchor}
      open={Boolean(statusMenuAnchor)}
      onClose={handleStatusMenuClose}
      PaperProps={{ sx: { borderRadius: 2, minWidth: 200 } }}
    >
      {statusOptions && statusOptions.length > 0 ? (
        statusOptions.map((status) => (
          <MenuItem key={status.value || status.id} onClick={() => handleStatusSelect(status.value || status.shortName)}>
            <ListItemIcon>
              {status.value === 'STARTED' ? <PendingIcon /> : 
              status.value === 'ENDED' ? <CheckCircleIcon /> :
              status.value === 'CANCELLED' ? <CancelIcon /> :
              <ScheduleIcon />}
            </ListItemIcon>
            <ListItemText>{status.label || status.name}</ListItemText>
          </MenuItem>
        ))
      ) : (
        <>
          <MenuItem onClick={() => handleStatusSelect('SCHEDULED')}>
            <ListItemIcon><ScheduleIcon /></ListItemIcon>
            <ListItemText>Scheduled</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleStatusSelect('STARTED')}>
            <ListItemIcon><PendingIcon /></ListItemIcon>
            <ListItemText>Started</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleStatusSelect('ENDED')}>
            <ListItemIcon><CheckCircleIcon /></ListItemIcon>
            <ListItemText>Ended</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleStatusSelect('CANCELLED')}>
            <ListItemIcon><CancelIcon /></ListItemIcon>
            <ListItemText>Cancelled</ListItemText>
          </MenuItem>
        </>
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
              <Select
                value={selectedStatus}
                label="Status"
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <MenuItem value="SCHEDULED">Scheduled</MenuItem>
                <MenuItem value="STARTED">Started</MenuItem>
                <MenuItem value="ENDED">Ended</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
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

      {/* Notification Dialog */}
      <NotificationDialog
        open={notificationDialogOpen}
        onClose={() => setNotificationDialogOpen(false)}
        meeting={currentMeeting}
        participants={participants}
        onSend={handleSendNotifications}
        sending={sendingNotifications}
      />

      {/* Update Meeting Link Dialog */}
      <UpdateMeetingLinkDialog
        open={updateLinkDialogOpen}
        onClose={() => setUpdateLinkDialogOpen(false)}
        meeting={currentMeeting}
        onUpdate={() => {
          fetchMeeting();
          setSnackbar({
            open: true,
            message: '✅ Meeting link updated successfully!',
            severity: 'success'
          });
        }}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
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