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
  LinearProgress
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
  ErrorOutline as ErrorOutlineIcon
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
const NOT_FOUND_DELAY_MS = 7000; // 7 seconds delay before showing "Not Found"

// ==================== Memoized Rich Text Content Component ====================
const RichTextContent = memo(({ content }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  if (!content || content.trim() === '' || content === '<p></p>') {
    return (
      <Typography variant="body2" sx={{ 
        fontStyle: 'italic',
        color: isDarkMode ? '#9CA3AF' : 'text.secondary'
      }}>
        No agenda provided.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        color: isDarkMode ? '#E5E7EB' : 'inherit',
        '& p': { 
          marginBottom: '12px', 
          lineHeight: 1.7,
          color: isDarkMode ? '#D1D5DB' : 'inherit'
        },
        '& p:last-child': { marginBottom: 0 },
        '& ul, & ol': { 
          paddingLeft: '24px', 
          marginBottom: '12px',
          color: isDarkMode ? '#D1D5DB' : 'inherit'
        },
        '& li': { 
          marginBottom: '6px',
          color: isDarkMode ? '#D1D5DB' : 'inherit'
        },
        '& h1, & h2, & h3': { 
          margin: '16px 0 8px 0', 
          fontWeight: 600,
          color: isDarkMode ? '#FFFFFF' : 'inherit'
        },
        '& blockquote': {
          borderLeft: '4px solid',
          borderColor: isDarkMode ? '#7C3AED' : 'primary.main',
          paddingLeft: '16px',
          color: isDarkMode ? '#9CA3AF' : 'text.secondary',
          fontStyle: 'italic',
          margin: '16px 0',
          backgroundColor: isDarkMode ? alpha('#7C3AED', 0.1) : 'transparent'
        },
        '& pre': {
          backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.05) : '#F3F4F6',
          padding: '12px',
          borderRadius: 1,
          overflowX: 'auto',
          fontFamily: 'monospace',
          color: isDarkMode ? '#E5E7EB' : 'inherit'
        },
        '& img': {
          maxWidth: '100%',
          height: 'auto',
          borderRadius: 1,
          margin: '12px 0'
        },
        '& a': {
          color: isDarkMode ? '#A78BFA' : '#7C3AED',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline'
          }
        },
        '& strong, & b': {
          color: isDarkMode ? '#FFFFFF' : 'inherit',
          fontWeight: 700
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

// ==================== Loading Timeout Component ====================
const LoadingTimeout = ({ timeout, onTimeout }) => {
  const [progress, setProgress] = useState(0);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const percent = Math.min((elapsed / timeout) * 100, 100);
      setProgress(percent);
      
      if (elapsed >= timeout) {
        clearInterval(interval);
        setShowTimeoutMessage(true);
        onTimeout();
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [timeout, onTimeout]);

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      {!showTimeoutMessage ? (
        <>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 4, 
              borderRadius: 2,
              bgcolor: alpha('#7C3AED', 0.2),
              '& .MuiLinearProgress-bar': {
                bgcolor: '#7C3AED'
              }
            }} 
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
            Loading meeting details... Please wait
          </Typography>
        </>
      ) : (
        <Alert 
          severity="warning" 
          icon={<ErrorOutlineIcon />}
          sx={{ mt: 2, borderRadius: 2 }}
        >
          Still loading? This is taking longer than expected. The meeting might have been deleted or you might have connectivity issues.
        </Alert>
      )}
    </Box>
  );
};

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
      elevation={isDarkMode ? 0 : 2}
      sx={{
        bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
        borderBottom: 1,
        borderColor: isDarkMode ? '#374151' : '#E5E7EB',
        zIndex: theme.zIndex.drawer + 1,
        boxShadow: isDarkMode ? 'none' : '0px 1px 2px 0px rgba(0,0,0,0.05)'
      }}
    >
      <Toolbar sx={{ px: { xs: 1.5, sm: 3 } }}>
        <IconButton 
          onClick={onBack} 
          edge="start" 
          sx={{ 
            mr: 2,
            color: isDarkMode ? '#D1D5DB' : '#374151',
            '&:hover': {
              backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04)
            }
          }}
        >
          <ArrowBackIcon />
        </IconButton>

        <Typography variant="h6" sx={{ 
          flex: 1, 
          fontWeight: 700,
          color: isDarkMode ? '#FFFFFF' : '#111827'
        }}>
          Meeting Details
        </Typography>

        {isMobile ? (
          <Stack direction="row" spacing={1}>
            <IconButton 
              onClick={onNotify}
              sx={{
                color: isDarkMode ? '#D1D5DB' : '#6B7280',
                '&:hover': {
                  backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04)
                }
              }}
            >
              <Badge badgeContent={participantCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton 
              onClick={onRefresh}
              sx={{
                color: isDarkMode ? '#D1D5DB' : '#6B7280',
                '&:hover': {
                  backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04)
                }
              }}
            >
              <RefreshIcon />
            </IconButton>
            <IconButton 
              onClick={onMoreMenuOpen}
              sx={{
                color: isDarkMode ? '#D1D5DB' : '#6B7280',
                '&:hover': {
                  backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04)
                }
              }}
            >
              <MoreVertIcon />
            </IconButton>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1}>
            <Tooltip title="Update Meeting Link">
              <IconButton 
                onClick={onUpdateLink} 
                size="small"
                sx={{
                  color: isDarkMode ? '#60A5FA' : '#3B82F6',
                  backgroundColor: isDarkMode ? 'transparent' : alpha('#3B82F6', 0.05),
                  '&:hover': {
                    backgroundColor: isDarkMode ? alpha('#60A5FA', 0.08) : alpha('#3B82F6', 0.1)
                  }
                }}
              >
                <UpdateIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Send Notifications">
              <IconButton 
                onClick={onNotify} 
                size="small"
                sx={{
                  color: isDarkMode ? '#A78BFA' : '#7C3AED',
                  backgroundColor: isDarkMode ? 'transparent' : alpha('#7C3AED', 0.05),
                  '&:hover': {
                    backgroundColor: isDarkMode ? alpha('#A78BFA', 0.08) : alpha('#7C3AED', 0.1)
                  }
                }}
              >
                <Badge badgeContent={participantCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={onRefresh} 
                size="small"
                sx={{
                  color: isDarkMode ? '#D1D5DB' : '#6B7280',
                  '&:hover': {
                    backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04)
                  }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit Meeting">
              <IconButton 
                onClick={onEdit} 
                size="small"
                sx={{
                  color: isDarkMode ? '#A78BFA' : '#7C3AED',
                  backgroundColor: isDarkMode ? 'transparent' : alpha('#7C3AED', 0.05),
                  '&:hover': {
                    backgroundColor: isDarkMode ? alpha('#A78BFA', 0.08) : alpha('#7C3AED', 0.1)
                  }
                }}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Update Status">
              <Button
                variant={isDarkMode ? "outlined" : "contained"}
                size="small"
                startIcon={getStatusIcon()}
                onClick={onStatusMenuOpen}
                sx={{
                  textTransform: 'none',
                  ...(isDarkMode ? {
                    borderColor: '#4B5563',
                    color: '#D1D5DB',
                    '&:hover': {
                      borderColor: '#6B7280',
                      backgroundColor: alpha('#FFFFFF', 0.08)
                    }
                  } : {
                    bgcolor: '#7C3AED',
                    color: '#FFFFFF',
                    '&:hover': {
                      bgcolor: '#6D28D9'
                    }
                  })
                }}
              >
                {getStatusDisplay()}
              </Button>
            </Tooltip>
            <Tooltip title="More Options">
              <IconButton 
                onClick={onMoreMenuOpen} 
                size="small"
                sx={{
                  color: isDarkMode ? '#D1D5DB' : '#6B7280',
                  '&:hover': {
                    backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04)
                  }
                }}
              >
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
  const [agendaExpanded, setAgendaExpanded] = useState(false);
  
  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();
  
  const hasAgenda = meeting?.agenda && meeting.agenda.trim() !== '' && meeting.agenda !== '<p></p>';
  
  const getAgendaPreview = useCallback(() => {
    if (!hasAgenda) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = meeting.agenda;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    if (plainText.length <= 150) return plainText;
    return plainText.substring(0, 150) + '...';
  }, [meeting?.agenda, hasAgenda]);
  
  return (
    <Card sx={{ 
      mb: 3, 
      borderRadius: 3,
      overflow: 'hidden',
      border: `1px solid ${isDarkMode ? alpha('#FFFFFF', 0.1) : '#E5E7EB'}`,
      bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
      boxShadow: isDarkMode ? '0 1px 3px 0 rgba(0, 0, 0, 0.3)' : '0px 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight={800} sx={{ 
            color: isDarkMode ? '#FFFFFF' : 'inherit',
            wordBreak: 'break-word'
          }}>
            {meeting?.title}
          </Typography>
          <Chip
            label={getStatusDisplay()}
            color={statusColor}
            icon={statusIcon}
            sx={{ 
              fontWeight: 600, 
              '& .MuiChip-label': { fontWeight: 600 },
              ...(isDarkMode && statusColor === 'default' && {
                bgcolor: '#374151',
                color: '#D1D5DB'
              })
            }}
          />
        </Stack>

        {meeting?.description && (
          <>
            <Divider sx={{ my: 2, borderColor: isDarkMode ? '#374151' : 'rgba(0, 0, 0, 0.12)' }} />
            <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
              {meeting.description}
            </Typography>
          </>
        )}

        <Divider sx={{ my: 2, borderColor: isDarkMode ? '#374151' : 'rgba(0, 0, 0, 0.12)' }} />

        <Grid container spacing={{ xs: 2, sm: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: isDarkMode ? alpha('#7C3AED', 0.2) : alpha('#7C3AED', 0.1), color: isDarkMode ? '#A78BFA' : '#7C3AED', width: 48, height: 48 }}>
                <CalendarIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                  DATE & TIME
                </Typography>
                <Typography variant="body1" fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                  {formatDate(meeting?.meeting_date)}
                </Typography>
                {meeting?.start_time && (
                  <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
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
              <Avatar sx={{ bgcolor: isDarkMode ? alpha('#3B82F6', 0.2) : alpha('#3B82F6', 0.1), color: isDarkMode ? '#60A5FA' : '#3B82F6', width: 48, height: 48 }}>
                {isOnlineMeeting ? <VideoCallIcon /> : <LocationIcon />}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                  {isOnlineMeeting ? 'MEETING PLATFORM' : 'LOCATION'}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body1" fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                    {isOnlineMeeting 
                      ? (meeting?.platform === 'zoom' ? 'Zoom' :
                         meeting?.platform === 'google_meet' ? 'Google Meet' :
                         meeting?.platform === 'microsoft_teams' ? 'Microsoft Teams' :
                         'Online Meeting')
                      : (meeting?.location_text || 'Not specified')}
                  </Typography>
                  <Tooltip title="Update Meeting Link">
                    <IconButton size="small" onClick={onUpdateLink} sx={{ color: isDarkMode ? '#60A5FA' : '#3B82F6' }}>
                      <UpdateIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                {(isOnlineMeeting && hasMeetingLink) && (
                  <Button size="small" startIcon={<LinkIcon />} onClick={onJoinMeeting} sx={{ mt: 0.5, textTransform: 'none', color: isDarkMode ? '#60A5FA' : '#3B82F6' }}>
                    Join Meeting
                  </Button>
                )}
              </Box>
            </Stack>
          </Grid>

          {meeting?.facilitator && (
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: isDarkMode ? alpha('#10B981', 0.2) : alpha('#10B981', 0.1), color: isDarkMode ? '#34D399' : '#10B981', width: 48, height: 48 }}>
                  <PeopleIcon />
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                    SECRETARY
                  </Typography>
                  <Typography variant="body1" fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                    {meeting.facilitator}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          )}

          {meeting?.chairperson_name && (
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: isDarkMode ? alpha('#F59E0B', 0.2) : alpha('#F59E0B', 0.1), color: isDarkMode ? '#FBBF24' : '#F59E0B', width: 48, height: 48 }}>
                  <PeopleIcon />
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                    CHAIRPERSON
                  </Typography>
                  <Typography variant="body1" fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                    {meeting.chairperson_name}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          )}
        </Grid>

        {hasAgenda && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ mb: 3, borderColor: isDarkMode ? '#374151' : 'rgba(0, 0, 0, 0.12)' }} />
            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ cursor: 'pointer' }} onClick={() => setAgendaExpanded(!agendaExpanded)}>
              <Avatar sx={{ bgcolor: isDarkMode ? alpha('#F59E0B', 0.2) : alpha('#F59E0B', 0.1), color: isDarkMode ? '#FBBF24' : '#F59E0B', width: 48, height: 48 }}>
                <DescriptionIcon />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                    Agenda
                  </Typography>
                  <IconButton size="small" sx={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                    {agendaExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Stack>
                <Collapse in={agendaExpanded} collapsedSize={60}>
                  <Paper variant="outlined" sx={{ p: 3, bgcolor: isDarkMode ? alpha('#FFFFFF', 0.03) : alpha('#000000', 0.02), borderRadius: 2, borderColor: isDarkMode ? '#374151' : 'rgba(0, 0, 0, 0.12)' }}>
                    <RichTextContent content={meeting.agenda} />
                  </Paper>
                </Collapse>
                {!agendaExpanded && (
                  <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', mt: 1 }}>
                    {getAgendaPreview()}
                  </Typography>
                )}
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
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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

  const isOnlineMeeting = useMemo(() => currentMeeting?.platform && currentMeeting.platform !== 'physical', [currentMeeting?.platform]);
  const hasMeetingLink = useMemo(() => currentMeeting?.meeting_link, [currentMeeting?.meeting_link]);
  const participantCount = useMemo(() => participants.length, [participants]);

  const fetchMeeting = useCallback(() => { if (id) dispatch(fetchMeetingById(id)); }, [id, dispatch]);
  const fetchParticipants = useCallback(() => { if (id) dispatch(fetchMeetingParticipants(id)); }, [id, dispatch]);

  useEffect(() => {
    setShowNotFound(false);
    setLoadingTimeout(false);
    setInitialLoadComplete(false);
  }, [id]);

  useEffect(() => {
    if (loading && !initialLoadComplete) {
      const timer = setTimeout(() => setLoadingTimeout(true), NOT_FOUND_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [loading, initialLoadComplete]);

  useEffect(() => {
    if (currentMeeting || error) setInitialLoadComplete(true);
  }, [currentMeeting, error]);

  useEffect(() => {
    if (!loading && !currentMeeting && initialLoadComplete) {
      const timer = setTimeout(() => setShowNotFound(true), 500);
      return () => clearTimeout(timer);
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
      setSnackbar({ open: true, message: `✅ Notifications sent to ${lastNotificationResult.sent} participants successfully!`, severity: 'success' });
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

  const handleRefresh = useCallback(() => {
    setShowNotFound(false);
    setLoadingTimeout(false);
    setInitialLoadComplete(false);
    fetchMeeting();
    fetchParticipants();
  }, [fetchMeeting, fetchParticipants]);

  const handleBack = useCallback(() => navigate('/meetings'), [navigate]);
  const handleEdit = useCallback(() => navigate(`/meetings/${id}/edit`), [navigate, id]);

  const handleJoinMeeting = useCallback(() => {
    if (!currentMeeting) return;
    if (isOnlineMeeting && hasMeetingLink) {
      let meetingUrl = currentMeeting.meeting_link;
      if (!meetingUrl.startsWith('http://') && !meetingUrl.startsWith('https://')) meetingUrl = 'https://' + meetingUrl;
      window.open(meetingUrl, '_blank');
    } else if (!isOnlineMeeting && currentMeeting.location_text) {
      setSnackbar({ open: true, message: `📍 Physical Location: ${currentMeeting.location_text}`, severity: 'info' });
    } else {
      setSnackbar({ open: true, message: 'No meeting link or location available', severity: 'warning' });
    }
  }, [currentMeeting, isOnlineMeeting, hasMeetingLink]);

  const handleNotifyClick = useCallback(() => {
    fetchParticipants();
    setNotificationDialogOpen(true);
  }, [fetchParticipants]);

  const handleSendNotifications = useCallback((notificationData) => {
    dispatch(sendMeetingNotifications({ meetingId: id, notificationData }));
  }, [id, dispatch]);

  const handleStatusMenuOpen = (event) => setStatusMenuAnchor(event.currentTarget);
  const handleStatusMenuClose = () => setStatusMenuAnchor(null);
  const handleMoreMenuOpen = (event) => setMoreMenuAnchor(event.currentTarget);
  const handleMoreMenuClose = () => setMoreMenuAnchor(null);

  const handleStatusSelect = (status) => {
    setSelectedStatus(status);
    setStatusDialogOpen(true);
    setStatusMenuAnchor(null);
  };

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

  const handleSnackbarClose = () => setSnackbar(prev => ({ ...prev, open: false }));
  const handleErrorClose = () => {
    setLocalError(null);
    dispatch(clearMeetingState());
  };

  // Loading state with timeout
  if (loading && !currentMeeting && !showNotFound) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? '#111827' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF' }}>
            <CircularProgress size={60} sx={{ mb: 3, color: '#7C3AED' }} />
            <Typography variant="h6" fontWeight={600} gutterBottom>Loading Meeting Details</Typography>
            <LoadingTimeout timeout={NOT_FOUND_DELAY_MS} onTimeout={() => {}} />
          </Paper>
        </Container>
      </Box>
    );
  }

  // Not found state
  if (showNotFound && (!currentMeeting || (!loading && !currentMeeting))) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? '#111827' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF' }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: alpha('#EF4444', 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
              <ErrorOutlineIcon sx={{ fontSize: 48, color: '#EF4444' }} />
            </Box>
            <Typography variant="h5" color="error" gutterBottom fontWeight={700}>Meeting Not Found</Typography>
            <Typography variant="body2" sx={{ mb: 4, color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
              The meeting you're looking for doesn't exist, has been deleted, or you don't have permission to view it.
            </Typography>
            <Stack spacing={2}>
              <Button variant="contained" onClick={handleBack} size="large" sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>
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

  // Error state
  if (error && !currentMeeting && !showNotFound) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? '#111827' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF' }}>
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{typeof error === 'string' ? error : 'Failed to load meeting details'}</Alert>
            <Button variant="contained" onClick={handleBack} size="large" sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>
              Back to Meetings
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  // Main render
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
        participantCount={participantCount}
        getStatusIcon={getStatusIcon}
        getStatusDisplay={getStatusDisplay}
        isMobile={isMobile}
      />

      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
        {(error || localError) && (
          <Alert severity="error" onClose={handleErrorClose} sx={{ mb: 3, bgcolor: isDarkMode ? '#7F1D1D' : undefined, color: isDarkMode ? '#FCA5A5' : undefined }}>
            {typeof error === 'string' ? error : (localError || 'Failed to load meeting')}
          </Alert>
        )}

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

        <Paper sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF', boxShadow: isDarkMode ? 'none' : '0px 2px 4px -1px rgba(0,0,0,0.1)', border: isDarkMode ? 'none' : '1px solid #E5E7EB' }}>
          <Tabs
            value={tabValue}
            onChange={(e, v) => setTabValue(v)}
            variant={isMobile ? "scrollable" : "standard"}
            scrollButtons={isMobile ? "auto" : false}
            allowScrollButtonsMobile
            sx={{
              borderBottom: 1,
              borderColor: isDarkMode ? '#374151' : '#E5E7EB',
              bgcolor: isDarkMode ? '#1F2937' : '#F9FAFB',
              '& .MuiTab-root': {
                py: 2,
                fontWeight: 600,
                minWidth: isMobile ? 'auto' : 120,
                color: isDarkMode ? '#9CA3AF' : '#6B7280',
                '&.Mui-selected': { color: isDarkMode ? '#A78BFA' : '#7C3AED' }
              },
              '& .MuiTabs-indicator': { backgroundColor: isDarkMode ? '#A78BFA' : '#7C3AED', height: 3 }
            }}
          >
            <Tab icon={<DescriptionIcon />} iconPosition="start" label="Minutes" />
            <Tab icon={<AssignmentIcon />} iconPosition="start" label="Actions" />
            <Tab icon={<PeopleIcon />} iconPosition="start" label="Participants" />
            <Tab icon={<DescriptionIcon />} iconPosition="start" label="Documents" />
            <Tab icon={<HistoryIcon />} iconPosition="start" label="History" />
            <Tab icon={<HistoryIcon />} iconPosition="start" label="Audit" />
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF' }}>
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
        PaperProps={{ sx: { borderRadius: 2, minWidth: 180, bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF', border: isDarkMode ? '1px solid #374151' : 'none' } }}
      >
        

        <MenuItem onClick={() => { setUpdateLinkDialogOpen(true); handleMoreMenuClose(); }} sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
          <ListItemIcon><UpdateIcon fontSize="small" sx={{ color: isDarkMode ? '#60A5FA' : '#3B82F6' }} /></ListItemIcon>
          <ListItemText>Update Meeting Link</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleNotifyClick} sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
          <ListItemIcon><NotificationsIcon fontSize="small" sx={{ color: isDarkMode ? '#A78BFA' : '#7C3AED' }} /></ListItemIcon>
          <ListItemText>Send Notifications</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEdit} sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
          <ListItemIcon><EditIcon fontSize="small" sx={{ color: isDarkMode ? '#A78BFA' : '#7C3AED' }} /></ListItemIcon>
          <ListItemText>Edit Meeting</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleStatusMenuOpen} sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
          <ListItemIcon>{getStatusIcon()}</ListItemIcon>
          <ListItemText>Update Status</ListItemText>
        </MenuItem>
        <Divider sx={{ bgcolor: isDarkMode ? '#374151' : undefined }} />
        <MenuItem onClick={handleDeleteClick} sx={{ color: isDarkMode ? '#F87171' : 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: isDarkMode ? '#F87171' : 'error.main' }} /></ListItemIcon>
          <ListItemText>Delete Meeting</ListItemText>
        </MenuItem>
      </Menu>

      {/* Status Update Menu */}
      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={handleStatusMenuClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 200, bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF', border: isDarkMode ? '1px solid #374151' : 'none' } }}
      >
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
      </Menu>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF', borderRadius: 2 } }}>
        <DialogTitle><Typography variant="h6" fontWeight={700}>Update Meeting Status</Typography></DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={selectedStatus} label="Status" onChange={(e) => setSelectedStatus(e.target.value)}>
                <MenuItem value="SCHEDULED">Scheduled</MenuItem>
                <MenuItem value="STARTED">Started</MenuItem>
                <MenuItem value="ENDED">Ended</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth label="Comment (Optional)" multiline rows={3} value={statusComment} onChange={(e) => setStatusComment(e.target.value)} placeholder="Add a comment about this status change..." />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleStatusUpdate} disabled={statusUpdating || !selectedStatus}>
            {statusUpdating ? <CircularProgress size={24} /> : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF', borderRadius: 2 } }}>
        <DialogTitle><Typography variant="h6" fontWeight={700}>Delete Meeting</Typography></DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>Are you sure you want to delete this meeting?</Typography>
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
          setSnackbar({ open: true, message: '✅ Meeting link updated successfully!', severity: 'success' });
        }}
      />

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingDetail;