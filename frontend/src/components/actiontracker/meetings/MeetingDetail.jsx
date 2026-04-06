import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Container, Typography, Paper, Chip, Button, Tabs, Tab, 
  Stack, Snackbar, Alert, CircularProgress, useMediaQuery, useTheme 
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon, 
  Schedule as ScheduleIcon, 
  LocationOn as LocationIcon 
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import { 
  fetchMeetingById, 
  fetchMeetingStatusOptions, 
  selectCurrentMeeting, 
  selectMeetingLoading, 
  selectStatusOptions,
  selectUpdateSuccess,
  clearUpdateSuccess
} from '../../../store/slices/actionTracker/meetingSlice';

// Sub-components
import ParticipantList from './components/ParticipantList';
import MinutesAndActions from './components/MinutesAndActions';
import MeetingHistory from './components/MeetingHistory';
import StatusUpdateDialog from './components/StatusUpdateDialog';

const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const meeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingLoading);
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

  if (loading) return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>;
  if (!meeting) return <Container sx={{ py: 5 }}><Alert severity="warning">Meeting not found</Alert></Container>;

  const isStarted = meeting.status?.short_name?.toUpperCase() === 'STARTED';

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1, sm: 2 } }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/meetings')} 
          sx={{ mb: 2 }}
          size={isMobile ? "small" : "medium"}
        >
          Back
        </Button>

        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
          <Box 
            display="flex" 
            flexDirection={{ xs: 'column', sm: 'row' }} 
            justifyContent="space-between" 
            alignItems={{ xs: 'stretch', sm: 'flex-start' }} 
            gap={2}
          >
            <Box>
              <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">
                {meeting.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom sx={{ mt: 0.5 }}>
                Created by: **{meeting.created_by_name}**
              </Typography>
              
              {/* Chips stack that wraps on mobile */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                <Chip label={meeting.status?.name} color="primary" size="small" />
                <Chip 
                  icon={<ScheduleIcon />} 
                  label={new Date(meeting.meeting_date).toLocaleString()} 
                  variant="outlined" 
                  size="small" 
                />
                <Chip 
                  icon={<LocationIcon />} 
                  label={meeting.location_text || 'TBD'} 
                  variant="outlined" 
                  size="small" 
                />
              </Box>
            </Box>
            
            <Button 
              variant="contained" 
              fullWidth={isMobile}
              onClick={() => setShowStatusDialog(true)}
              sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
            >
              Update Status
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, v) => setTabValue(v)} 
            variant={isMobile ? "scrollable" : "fullWidth"}
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Participants" />
            <Tab label="Minutes & Actions" />
            <Tab label="History" />
          </Tabs>

          <Box sx={{ p: { xs: 1, sm: 2 } }}>
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
                meetingStatus={meeting.status_name}
                meetingId={id} 
                onUpdate={() => dispatch(fetchMeetingById(id))} 
              />
            )}
            {tabValue === 2 && <MeetingHistory meetingId={id} statusOptions={statusOptions} />}
          </Box>
        </Paper>

        <StatusUpdateDialog 
          open={showStatusDialog} 
          onClose={() => setShowStatusDialog(false)} 
          meeting={meeting} 
          statusOptions={statusOptions} 
          onUpdate={() => dispatch(fetchMeetingById(id))} 
        />

        <Snackbar 
          open={snackbar.open} 
          autoHideDuration={3000} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
};

export default MeetingDetail;