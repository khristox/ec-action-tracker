// src/components/actiontracker/meetings/MeetingDetail.jsx
import React, { useState, useEffect, useCallback } from 'react';
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
  List,
  Checkbox,
  Snackbar,
  FormControlLabel
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  AccessTime as AccessTimeIcon,
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
  NotificationsActive as NotificationsIcon,
  Send as SendIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
  Sms as SmsIcon
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
import api from '../../../services/api';

// ==================== Rich Text Content Component ====================
const RichTextContent = ({ content }) => {
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
};

// Tab Panel Component
const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`meeting-tabpanel-${index}`}
    aria-labelledby={`meeting-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

// Notification Dialog Component
const NotificationDialog = ({ open, onClose, meeting, participants, onSend }) => {
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [notificationType, setNotificationType] = useState(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (open && participants) {
      setSelectedParticipants(participants.map(p => p.id));
      setSelectAll(true);
    }
  }, [open, participants]);

  const handleToggleParticipant = (participantId) => {
    setSelectedParticipants(prev => 
      prev.includes(participantId) 
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
    setSelectAll(selectedParticipants.length === participants?.length - 1);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(participants.map(p => p.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend({
        participant_ids: selectedParticipants,
        notification_type: notificationType,
        custom_message: customMessage
      });
      onClose();
    } catch (error) {
      console.error('Failed to send notifications:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Badge badgeContent={selectedParticipants.length} color="primary">
              <NotificationsIcon color="primary" />
            </Badge>
            <Typography variant="h6" fontWeight={700}>Send Meeting Notifications</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Meeting Info */}
          <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom color="primary">
              {meeting?.title}
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                📅 {new Date(meeting?.meeting_date).toLocaleDateString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ⏰ {new Date(meeting?.meeting_date).toLocaleTimeString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                👥 {participants?.length || 0} participants
              </Typography>
            </Stack>
          </Paper>

          {/* Notification Types */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Send via</Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<EmailIcon />}
                label="Email"
                color={notificationType.includes('email') ? 'primary' : 'default'}
                onClick={() => {
                  if (notificationType.includes('email')) {
                    setNotificationType(notificationType.filter(t => t !== 'email'));
                  } else {
                    setNotificationType([...notificationType, 'email']);
                  }
                }}
                sx={{ py: 2, '& .MuiChip-label': { fontWeight: 600 } }}
              />
              <Chip
                icon={<WhatsAppIcon />}
                label="WhatsApp"
                color={notificationType.includes('whatsapp') ? 'primary' : 'default'}
                onClick={() => {
                  if (notificationType.includes('whatsapp')) {
                    setNotificationType(notificationType.filter(t => t !== 'whatsapp'));
                  } else {
                    setNotificationType([...notificationType, 'whatsapp']);
                  }
                }}
                sx={{ py: 2, '& .MuiChip-label': { fontWeight: 600 } }}
              />
              <Chip
                icon={<SmsIcon />}
                label="SMS"
                color={notificationType.includes('sms') ? 'primary' : 'default'}
                onClick={() => {
                  if (notificationType.includes('sms')) {
                    setNotificationType(notificationType.filter(t => t !== 'sms'));
                  } else {
                    setNotificationType([...notificationType, 'sms']);
                  }
                }}
                sx={{ py: 2, '& .MuiChip-label': { fontWeight: 600 } }}
              />
            </Stack>
          </Box>

          {/* Participants Selection */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={600}>Select Participants</Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectAll}
                    onChange={handleSelectAll}
                    size="small"
                  />
                }
                label="Select All"
                sx={{ '& .MuiTypography-root': { fontSize: '0.8rem', fontWeight: 500 } }}
              />
            </Stack>
            
            <Paper variant="outlined" sx={{ maxHeight: 320, overflow: 'auto', borderRadius: 2 }}>
              {participants?.map((participant) => (
                <Stack
                  key={participant.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ 
                    p: 1.5, 
                    borderBottom: '1px solid #f0f0f0',
                    '&:hover': { bgcolor: '#fafafa' }
                  }}
                >
                  <Checkbox
                    checked={selectedParticipants.includes(participant.id)}
                    onChange={() => handleToggleParticipant(participant.id)}
                    size="small"
                  />
                  <Avatar sx={{ width: 36, height: 36, bgcolor: '#6366f1', color: 'white' }}>
                    {participant.full_name?.[0] || participant.username?.[0] || '?'}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {participant.full_name || participant.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {participant.email}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Paper>
          </Box>

          {/* Custom Message */}
          <TextField
            label="Custom Message (Optional)"
            multiline
            rows={3}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add any additional information for participants..."
            fullWidth
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} variant="outlined">Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={sending || selectedParticipants.length === 0}
          startIcon={sending ? <CircularProgress size={20} /> : <SendIcon />}
          sx={{ 
            bgcolor: '#6366f1',
            '&:hover': { bgcolor: '#4f46e5' },
            px: 3
          }}
        >
          {sending ? 'Sending...' : `Send to ${selectedParticipants.length} Participant(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const currentMeeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingsError);
  const statusOptions = useSelector(selectMeetingStatusOptions);
  
  const [tabValue, setTabValue] = useState(0);
  const [localError, setLocalError] = useState(null);
  const [statusAnchorEl, setStatusAnchorEl] = useState(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moreAnchorEl, setMoreAnchorEl] = useState(null);
  
  // Notification state
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Fetch meeting details
  const fetchMeeting = useCallback(() => {
    if (id) {
      dispatch(fetchMeetingById(id));
    }
  }, [id, dispatch]);

  useEffect(() => {
    if (id) {
      fetchMeeting();
      dispatch(fetchActionTrackerAttributes());
    }
    
    return () => {
      dispatch(clearMeetingState());
    };
  }, [id, dispatch, fetchMeeting]);

  const handleRefresh = () => {
    fetchMeeting();
  };

  const handleBack = () => {
    navigate('/meetings');
  };

  const handleEdit = () => {
    navigate(`/meetings/${id}/edit/`);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await dispatch(deleteMeeting(id)).unwrap();
      setShowDeleteDialog(false);
      navigate('/meetings');
    } catch (err) {
      console.error('Error deleting meeting:', err);
      setLocalError(err.message || 'Failed to delete meeting');
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleStatusMenuOpen = (event) => {
    setStatusAnchorEl(event.currentTarget);
  };

  const handleStatusMenuClose = () => {
    setStatusAnchorEl(null);
  };

  const handleMoreMenuOpen = (event) => {
    setMoreAnchorEl(event.currentTarget);
  };

  const handleMoreMenuClose = () => {
    setMoreAnchorEl(null);
  };

  const handleStatusSelect = (status) => {
    setSelectedStatus(status);
    setStatusComment('');
    setShowStatusDialog(true);
    handleStatusMenuClose();
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    
    setUpdatingStatus(true);
    try {
      await dispatch(updateMeetingStatus({
        id: id,
        status: selectedStatus,
        comment: statusComment
      })).unwrap();
      
      setShowStatusDialog(false);
      setSelectedStatus('');
      setStatusComment('');
      fetchMeeting();
    } catch (err) {
      console.error('Error updating status:', err);
      setLocalError(err.message || 'Failed to update meeting status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Notification handlers
  const handleNotifyClick = async () => {
    setNotificationDialogOpen(true);
    try {
      const response = await api.get(`/action-tracker/meetings/${id}/participants`);
      setMeetingParticipants(response.data?.items || response.data || []);
    } catch (error) {
      console.error('Failed to fetch participants:', error);
      setMeetingParticipants([]);
    }
  };

  const handleSendNotifications = async (notificationData) => {
    try {
      const response = await api.post(
        `/action-tracker/meetings/${id}/notify-participants`,
        notificationData
      );
      
      setSnackbar({
        open: true,
        message: `✅ Notifications sent to ${response.data.sent} participants successfully!`,
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || '❌ Failed to send notifications',
        severity: 'error'
      });
    }
  };

  const formatDate = (dateString) => {
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
  };

  const formatTime = (dateString) => {
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
  };

  const getStatusColor = (status) => {
    if (!status) return 'default';
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed' || statusLower === 'ended') return 'success';
    if (statusLower === 'cancelled') return 'error';
    if (statusLower === 'in_progress' || statusLower === 'ongoing') return 'info';
    if (statusLower === 'pending' || statusLower === 'scheduled') return 'warning';
    return 'default';
  };

  const getStatusIcon = (status) => {
    if (!status) return <ScheduleIcon />;
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed' || statusLower === 'ended') return <CheckCircleIcon />;
    if (statusLower === 'cancelled') return <CancelIcon />;
    if (statusLower === 'in_progress' || statusLower === 'ongoing') return <PendingIcon />;
    return <ScheduleIcon />;
  };

  const getStatusDisplay = () => {
    const status = currentMeeting?.status;
    if (!status) return 'Unknown';
    if (typeof status === 'string') return status;
    return status.short_name || status.name || 'Unknown';
  };

  const getStatusValue = () => {
    const status = currentMeeting?.status;
    if (!status) return '';
    if (typeof status === 'string') return status;
    return status.short_name || status.value || '';
  };

  const isOnlineMeeting = currentMeeting?.platform && currentMeeting.platform !== 'physical';
  const hasMeetingLink = currentMeeting?.meeting_link;
  const participantCount = currentMeeting?.participants?.length || 0;

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
      {/* Header Bar */}
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <Toolbar sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <IconButton edge="start" onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 700, color: '#0f172a' }}>
            Meeting Details
          </Typography>
          {!isMobile && (
            <Stack direction="row" spacing={1}>
              {/* Send Notification Button */}
              <Tooltip title="Send Notifications">
                <IconButton onClick={handleNotifyClick} color="primary" size="small">
                  <Badge badgeContent={participantCount} color="error">
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh">
                <IconButton onClick={handleRefresh} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit Meeting">
                <IconButton onClick={handleEdit} color="primary" size="small">
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Update Status">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={getStatusIcon(getStatusValue())}
                  onClick={handleStatusMenuOpen}
                  sx={{ textTransform: 'none' }}
                >
                  {getStatusDisplay()}
                </Button>
              </Tooltip>
              <Tooltip title="More Options">
                <IconButton onClick={handleMoreMenuOpen} size="small">
                  <MoreVertIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
          {isMobile && (
            <IconButton onClick={handleMoreMenuOpen}>
              <MoreVertIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* More Options Menu */}
      <Menu
        anchorEl={moreAnchorEl}
        open={Boolean(moreAnchorEl)}
        onClose={handleMoreMenuClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 180 } }}
      >
        <MenuItem onClick={() => { handleMoreMenuClose(); handleNotifyClick(); }}>
          <ListItemIcon><NotificationsIcon fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText>Send Notifications</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleMoreMenuClose(); handleRefresh(); }}>
          <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Refresh</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleMoreMenuClose(); handleEdit(); }}>
          <ListItemIcon><EditIcon fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText>Edit Meeting</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleMoreMenuClose(); handleStatusMenuOpen(); }}>
          <ListItemIcon>{getStatusIcon(getStatusValue())}</ListItemIcon>
          <ListItemText>Update Status</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { handleMoreMenuClose(); setShowDeleteDialog(true); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete Meeting</ListItemText>
        </MenuItem>
      </Menu>

      {/* Status Update Menu */}
      <Menu
        anchorEl={statusAnchorEl}
        open={Boolean(statusAnchorEl)}
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
      <Dialog open={showStatusDialog} onClose={() => setShowStatusDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
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
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              placeholder="Add a comment about this status change..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setShowStatusDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleStatusUpdate}
            disabled={updatingStatus || !selectedStatus}
          >
            {updatingStatus ? <CircularProgress size={24} /> : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} maxWidth="sm" fullWidth>
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
          <Button onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
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
          <Alert severity="error" onClose={() => { setLocalError(null); dispatch(clearMeetingState()); }}>
            {typeof error === 'string' ? error : (localError || 'Failed to load meeting')}
          </Alert>
        </Container>
      )}

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
        {/* Meeting Details Card */}
        <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, mb: 4, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant={isMobile ? "h5" : "h4"} fontWeight={800} gutterBottom>
                {currentMeeting?.title}
              </Typography>
              {currentMeeting?.description && (
                <Typography variant="body1" color="text.secondary">
                  {currentMeeting.description}
                </Typography>
              )}
            </Box>
            <Chip
              label={getStatusDisplay()}
              color={getStatusColor(getStatusValue())}
              icon={getStatusIcon(getStatusValue())}
              sx={{ fontWeight: 600, px: 1, py: 2, '& .MuiChip-label': { fontWeight: 600 } }}
            />
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
                    {formatDate(currentMeeting?.meeting_date)}
                  </Typography>
                  {currentMeeting?.start_time && (
                    <Typography variant="body2" color="text.secondary">
                      {formatTime(currentMeeting.start_time)}
                      {currentMeeting?.end_time && ` - ${formatTime(currentMeeting.end_time)}`}
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
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {isOnlineMeeting ? 'MEETING PLATFORM' : 'LOCATION'}
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {isOnlineMeeting 
                      ? (currentMeeting?.platform === 'zoom' ? 'Zoom' :
                         currentMeeting?.platform === 'google_meet' ? 'Google Meet' :
                         currentMeeting?.platform === 'microsoft_teams' ? 'Microsoft Teams' :
                         'Online Meeting')
                      : (currentMeeting?.location_text || 'Not specified')}
                  </Typography>
                  {hasMeetingLink && (
                    <Button
                      size="small"
                      startIcon={<LinkIcon />}
                      href={currentMeeting.meeting_link}
                      target="_blank"
                      sx={{ mt: 0.5, textTransform: 'none' }}
                    >
                      Join Meeting
                    </Button>
                  )}
                </Box>
              </Stack>
            </Grid>

            {/* Facilitator */}
            {currentMeeting?.facilitator && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: 'info.main', width: 48, height: 48 }}>
                    <PeopleIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      FACILITATOR
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {currentMeeting.facilitator}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            )}

            {/* Chairperson */}
            {currentMeeting?.chairperson_name && (
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
                      {currentMeeting.chairperson_name}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            )}
          </Grid>

          {/* Agenda Section */}
          {currentMeeting?.agenda && (
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
                    <RichTextContent content={currentMeeting.agenda} />
                  </Paper>
                </Box>
              </Stack>
            </Box>
          )}
        </Paper>

        {/* Tabs Section */}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant={isMobile ? "fullWidth" : "standard"}
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              bgcolor: 'white',
              '& .MuiTab-root': { py: 2, fontWeight: 600 }
            }}
          >
            <Tab icon={<DescriptionIcon />} iconPosition="start" label="Minutes" />
            <Tab icon={<AssignmentIcon />} iconPosition="start" label="Actions" />
            <Tab icon={<DescriptionIcon />} iconPosition="start" label="Documents" />
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <TabPanel value={tabValue} index={0}>
              <MeetingMinutes meetingId={id} onRefresh={handleRefresh} />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <MeetingActionsList meetingId={id} onRefresh={handleRefresh} />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <MeetingDocuments meetingId={id} onRefresh={handleRefresh} />
            </TabPanel>
          </Box>
        </Paper>
      </Container>

      {/* Notification Dialog */}
      <NotificationDialog
        open={notificationDialogOpen}
        onClose={() => {
          setNotificationDialogOpen(false);
          setMeetingParticipants([]);
        }}
        meeting={currentMeeting}
        participants={meetingParticipants}
        onSend={handleSendNotifications}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingDetail;