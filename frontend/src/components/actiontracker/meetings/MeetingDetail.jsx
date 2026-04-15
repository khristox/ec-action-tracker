import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Container, Typography, Paper, Chip, Button, Tabs, Tab, 
  Stack, Snackbar, Alert, CircularProgress, useMediaQuery, useTheme,
  Avatar, Divider, Grid, IconButton, Tooltip
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon, 
  Schedule as ScheduleIcon, 
  LocationOn as LocationIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  PlayCircle as PlayCircleIcon,
  Event as EventIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import { 
  fetchMeetingById, 
  fetchMeetingStatusOptions, 
  selectCurrentMeeting, 
  selectMeetingsLoading, 
  selectStatusOptions,
  selectUpdateSuccess,
  clearUpdateSuccess
} from '../../../store/slices/actionTracker/meetingSlice';

// Sub-components
import ParticipantList from './components/ParticipantList';
import MinutesAndActions from './components/MinutesAndActions';
import MeetingHistory from './components/MeetingHistory';
import StatusUpdateDialog from './components/StatusUpdateDialog';

// ==================== Helper Functions ====================

// Format date to dd MMM yyyy HH:mm:ss
const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/,/g, '');
};

// Format date only (dd MMM yyyy)
const formatDateOnly = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Format time only (HH:mm:ss)
const formatTimeOnly = (timeString) => {
  if (!timeString) return 'N/A';
  return timeString;
};

// Helper function to get status color
const getStatusColor = (statusName) => {
  const status = statusName?.toLowerCase() || '';
  if (status.includes('scheduled') || status === 'scheduled') return { bg: '#3B82F6', text: '#FFFFFF', light: '#EFF6FF' };
  if (status.includes('ongoing') || status === 'ongoing' || status === 'started') return { bg: '#F59E0B', text: '#FFFFFF', light: '#FFFBEB' };
  if (status.includes('completed') || status === 'completed') return { bg: '#10B981', text: '#FFFFFF', light: '#ECFDF5' };
  if (status.includes('cancelled') || status === 'cancelled') return { bg: '#EF4444', text: '#FFFFFF', light: '#FEF2F2' };
  if (status.includes('postponed') || status === 'postponed') return { bg: '#8B5CF6', text: '#FFFFFF', light: '#F5F3FF' };
  return { bg: '#6B7280', text: '#FFFFFF', light: '#F3F4F6' };
};

// Helper to get status icon
const getStatusIcon = (statusName) => {
  const status = statusName?.toLowerCase() || '';
  if (status.includes('scheduled')) return <EventIcon />;
  if (status.includes('ongoing') || status === 'started') return <PlayCircleIcon />;
  if (status.includes('completed')) return <CheckCircleIcon />;
  if (status.includes('cancelled')) return <CancelIcon />;
  if (status.includes('postponed')) return <PendingIcon />;
  return <ScheduleIcon />;
};

const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const meeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const statusOptions = useSelector(selectStatusOptions);
  const updateSuccess = useSelector(selectUpdateSuccess);

  const [tabValue, setTabValue] = useState(0);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    dispatch(fetchMeetingById(id));
    dispatch(fetchMeetingStatusOptions());
  }, [dispatch, id]);

  useEffect(() => {
    if (updateSuccess) {
      setSnackbar({ open: true, message: 'Action completed successfully', severity: 'success' });
      dispatch(clearUpdateSuccess());
      dispatch(fetchMeetingById(id));
    }
  }, [updateSuccess, dispatch, id]);

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress />
    </Box>
  );
  
  if (!meeting) return (
    <Container sx={{ py: 5 }}>
      <Alert severity="warning">Meeting not found</Alert>
    </Container>
  );

  const statusColors = getStatusColor(meeting.status?.name);
  const isStarted = meeting.status?.short_name?.toUpperCase() === 'STARTED' || 
                    meeting.status?.name?.toLowerCase() === 'ongoing';

  const tabs = [
    { label: 'Participants', icon: <PersonIcon />, value: 0 },
    { label: 'Minutes & Actions', icon: <DescriptionIcon />, value: 1 },
    { label: 'History', icon: <HistoryIcon />, value: 2 }
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1, sm: 2 } }}>
        {/* Back Button */}
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/meetings')} 
          sx={{ mb: 2 }}
          size={isMobile ? "small" : "medium"}
        >
          Back to Meetings
        </Button>

        {/* Main Meeting Card */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">
                {meeting.title}
              </Typography>
              
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Created by: <strong>{meeting.created_by_name || 'Unknown'}</strong>
                {meeting.created_at && ` • ${formatDateTime(meeting.created_at)}`}
              </Typography>
              
              {/* Status Chip with Color */}
              <Box sx={{ mt: 2 }}>
                <Chip 
                  icon={getStatusIcon(meeting.status?.name)}
                  label={meeting.status?.name || 'Unknown'}
                  sx={{ 
                    bgcolor: statusColors.bg,
                    color: statusColors.text,
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: statusColors.text }
                  }}
                  size={isMobile ? "small" : "medium"}
                />
              </Box>
              
              {/* Meeting Details */}
              <Stack direction="row" flexWrap="wrap" spacing={2} sx={{ mt: 2 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    📅 {formatDateOnly(meeting.meeting_date)} | 🕐 {formatTimeOnly(meeting.start_time)} - {formatTimeOnly(meeting.end_time)}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <LocationIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    📍 {meeting.location_text || 'Location TBD'}
                  </Typography>
                </Box>
              </Stack>
              
              {/* Description */}
              {meeting.description && (
                <Paper 
                  variant="outlined" 
                  sx={{ p: 2, mt: 2, bgcolor: '#f8fafc', borderRadius: 2 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    📝 {meeting.description}
                  </Typography>
                </Paper>
              )}
              
              {/* Additional Info */}
              {(meeting.facilitator || meeting.chairperson_name) && (
                <Stack direction="row" flexWrap="wrap" spacing={2} sx={{ mt: 2 }}>
                  {meeting.facilitator && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <PersonIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        <strong>Facilitator:</strong> {meeting.facilitator}
                      </Typography>
                    </Box>
                  )}
                  {meeting.chairperson_name && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <PersonIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        <strong>Chairperson:</strong> {meeting.chairperson_name}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              )}
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box display="flex" justifyContent="flex-end" alignItems="flex-start">
                <Button 
                  variant="contained" 
                  onClick={() => setShowStatusDialog(true)}
                  fullWidth={isMobile}
                  startIcon={<EditIcon />}
                  sx={{ 
                    bgcolor: statusColors.bg,
                    '&:hover': { bgcolor: statusColors.bg, opacity: 0.9 }
                  }}
                >
                  Update Status
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs Section */}
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, v) => setTabValue(v)} 
            variant={isMobile ? "scrollable" : "fullWidth"}
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#fafafa' }}
          >
            {tabs.map((tab) => (
              <Tab 
                key={tab.value}
                label={tab.label} 
                icon={tab.icon}
                iconPosition="start"
                sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
              />
            ))}
          </Tabs>

          <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
            {tabValue === 0 && (
              <ParticipantList 
                participants={meeting.participants} 
                meetingId={id} 
                isStarted={isStarted} 
                onUpdate={() => dispatch(fetchMeetingById(id))} 
              />
            )}
            {tabValue === 1 && (
              <MinutesAndActions 
                minutes={meeting.minutes} 
                meetingStatus={meeting.status?.name}
                meetingId={id} 
                onUpdate={() => dispatch(fetchMeetingById(id))} 
              />
            )}
            {tabValue === 2 && (
              <MeetingHistory 
                meetingId={id} 
                statusOptions={statusOptions} 
              />
            )}
          </Box>
        </Paper>

        {/* Status Update Dialog */}
        <StatusUpdateDialog 
          open={showStatusDialog} 
          onClose={() => setShowStatusDialog(false)} 
          meeting={meeting} 
          statusOptions={statusOptions} 
          onUpdate={() => dispatch(fetchMeetingById(id))} 
        />

        {/* Snackbar for notifications */}
        <Snackbar 
          open={snackbar.open} 
          autoHideDuration={4000} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            severity={snackbar.severity} 
            variant="filled" 
            sx={{ width: '100%' }}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
};

export default MeetingDetail;