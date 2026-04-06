import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Container, Typography, Paper, Chip, Button, Tabs, Tab, 
  Stack, Snackbar, Alert, CircularProgress 
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
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/meetings')} sx={{ mb: 2 }}>Back</Button>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h4" fontWeight="bold">{meeting.title}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Created by: **{meeting.created_by_name}** on {new Date(meeting.created_at).toLocaleString()}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip label={meeting.status?.name} color="primary" />
                <Chip icon={<ScheduleIcon />} label={new Date(meeting.meeting_date).toLocaleString()} variant="outlined" />
                <Chip icon={<LocationIcon />} label={meeting.location_text || 'TBD'} variant="outlined" />
              </Stack>
            </Box>
            <Button variant="contained" onClick={() => setShowStatusDialog(true)}>Update Status</Button>
          </Box>
        </Paper>

        <Paper sx={{ borderRadius: 2 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Participants" />
            <Tab label="Minutes & Actions" />
            <Tab label="History" />
          </Tabs>

          <Box sx={{ p: 2 }}>
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
        >
          <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
};

export default MeetingDetail;