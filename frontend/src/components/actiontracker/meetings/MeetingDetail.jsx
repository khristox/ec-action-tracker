// src/components/actiontracker/meetings/MeetingDetail.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button,
  IconButton, Divider, Skeleton, Alert, CircularProgress,
  Grid, Avatar, Tooltip, Tabs, Tab,
  Menu, MenuItem, ListItemIcon, ListItemText, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
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
} from '@mui/icons-material';
import { 
  fetchMeetingById, 
  clearMeetingState, 
  updateMeetingStatus,
  fetchActionTrackerAttributes,
  selectCurrentMeeting,
  selectMeetingsLoading,
  selectMeetingsError,
  selectMeetingStatusOptions
} from '../../../store/slices/actionTracker/meetingSlice';
import MeetingMinutes from './MeetingMinutes';
import MeetingActionsList from './MeetingActionsList';
import MeetingDocuments from './MeetingDocuments';

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

const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const currentMeeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingsError);
  const statusOptions = useSelector(selectMeetingStatusOptions);
  
  const [tabValue, setTabValue] = useState(0);
  const [localError, setLocalError] = useState(null);
  const [statusAnchorEl, setStatusAnchorEl] = useState(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
    navigate(`/meetings/edit/${id}`);
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

  if (loading && !currentMeeting) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
        </Stack>
      </Container>
    );
  }

  if (!currentMeeting && !loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Meeting Not Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            The meeting you're looking for doesn't exist or has been deleted.
          </Typography>
          <Button variant="contained" onClick={handleBack}>
            Back to Meetings
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" fontWeight={700}>
            Meeting Details
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Update Status">
            <Button
              variant="outlined"
              startIcon={getStatusIcon(getStatusValue())}
              onClick={handleStatusMenuOpen}
              size="small"
            >
              Status: {getStatusDisplay()}
            </Button>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Meeting">
            <IconButton onClick={handleEdit} color="primary">
              <EditIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

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
        <DialogTitle>Update Meeting Status</DialogTitle>
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
        <DialogActions>
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

      {/* Error Alert */}
      {(error || localError) && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => { setLocalError(null); dispatch(clearMeetingState()); }}>
          {typeof error === 'string' ? error : (localError || 'Failed to load meeting')}
        </Alert>
      )}

      {/* Meeting Details Card */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              {currentMeeting?.title}
            </Typography>
            {currentMeeting?.description && (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {currentMeeting.description}
              </Typography>
            )}
          </Box>
          <Chip
            label={getStatusDisplay()}
            color={getStatusColor(getStatusValue())}
            icon={getStatusIcon(getStatusValue())}
            sx={{ fontWeight: 500, px: 1 }}
          />
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={3}>
          {/* Date and Time */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <CalendarIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Date & Time
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatDate(currentMeeting?.meeting_date)}
                </Typography>
                {currentMeeting?.start_time && (
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(currentMeeting.start_time)}
                    {currentMeeting?.end_time && ` - ${formatTime(currentMeeting.end_time)}`}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Grid>

          {/* Location */}
          {currentMeeting?.location_text && (
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  <LocationIcon />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Location
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {currentMeeting.location_text}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          )}

          {/* Facilitator */}
          {currentMeeting?.facilitator && (
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <PeopleIcon />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Facilitator
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {currentMeeting.facilitator}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          )}

          {/* Chairperson */}
          {currentMeeting?.chairperson_name && (
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <PeopleIcon />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Chairperson
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {currentMeeting.chairperson_name}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          )}
        </Grid>

        {/* Agenda */}
        {currentMeeting?.agenda && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Avatar sx={{ bgcolor: 'success.main' }}>
                <DescriptionIcon />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Agenda
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                  {currentMeeting.agenda}
                </Typography>
              </Box>
            </Stack>
          </Box>
        )}
      </Paper>

      {/* Tabs Section */}
      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            icon={<DescriptionIcon />} 
            iconPosition="start"
            label="Minutes" 
          />
          <Tab 
            icon={<AssignmentIcon />} 
            iconPosition="start"
            label="Actions" 
          />
          <Tab 
            icon={<DescriptionIcon />} 
            iconPosition="start"
            label="Documents" 
          />
        </Tabs>

        {/* Minutes Tab */}
        <TabPanel value={tabValue} index={0}>
          <MeetingMinutes 
            meetingId={id} 
            onRefresh={handleRefresh}
          />
        </TabPanel>

        {/* Actions Tab */}
        <TabPanel value={tabValue} index={1}>
          <MeetingActionsList 
            meetingId={id} 
            onRefresh={handleRefresh}
          />
        </TabPanel>

        {/* Documents Tab */}
        <TabPanel value={tabValue} index={2}>
          <MeetingDocuments 
            meetingId={id} 
            onRefresh={handleRefresh}
          />
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default MeetingDetail;