// src/components/actiontracker/meetings/EditMeeting.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Alert,
  CircularProgress,
  Snackbar,
  IconButton,
  Stack,
  Container,
  AppBar,
  Toolbar,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  Divider,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  FormGroup,
  Tooltip,
  InputAdornment,
  Checkbox
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  GroupAdd as GroupAddIcon,
  LocationOn as LocationIcon,
  Event as EventIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  MyLocation as MyLocationIcon,
  ContentCopy as ContentCopyIcon,
  ContentPaste as PasteIcon,
  GpsFixed as GpsFixedIcon,
  GpsNotFixed as GpsNotFixedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Redux imports
import {
  fetchMeetingById,
  updateMeeting,
  clearMeetingState,
  selectCurrentMeeting,
  selectMeetingsLoading,
  selectMeetingsError
} from '../../../store/slices/actionTracker/meetingSlice';
import {
  fetchMeetingParticipants,
  addCustomParticipant,
  removeLocalMeetingParticipant,
  setMeetingChairperson,
  clearMeetingParticipants,
  selectMeetingParticipantsAll,
  selectMeetingChairperson,
  selectParticipantsLoading
} from '../../../store/slices/actionTracker/participantSlice';

// Quill modules
const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link', 'clean'],
  ],
};

const formats = ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'link'];

const EditMeeting = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Redux state
  const currentMeeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingsError);
  const meetingParticipants = useSelector(selectMeetingParticipantsAll);
  const chairperson = useSelector(selectMeetingChairperson);
  const participantsLoading = useSelector(selectParticipantsLoading);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: null,
    start_time: null,
    end_time: null,
    location_text: '',
    agenda: '',
    facilitator: '',
    gps_latitude: '',
    gps_longitude: '',
  });
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSupported, setGpsSupported] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [showGpsDetails, setShowGpsDetails] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    name: '',
    email: '',
    telephone: '',
    title: '',
    organization: '',
    is_chairperson: false,
  });

  // Fetch meeting data
  useEffect(() => {
    if (id) {
      dispatch(fetchMeetingById(id));
      dispatch(fetchMeetingParticipants(id));
    }

    if (!navigator.geolocation) {
      setGpsSupported(false);
    }

    return () => {
      dispatch(clearMeetingState());
      dispatch(clearMeetingParticipants());
    };
  }, [id, dispatch]);

  // Populate form when meeting data is loaded
  useEffect(() => {
    if (currentMeeting) {
      const meetingDate = new Date(currentMeeting.meeting_date);
      const startTime = new Date(currentMeeting.start_time);
      
      let endTime = null;
      if (currentMeeting.end_time) {
        endTime = new Date(currentMeeting.end_time);
      }

      // Parse GPS coordinates if they exist
      let gpsLat = '';
      let gpsLng = '';
      let gpsEnabledFlag = false;
      if (currentMeeting.gps_coordinates) {
        const coords = currentMeeting.gps_coordinates.split(',');
        if (coords.length === 2) {
          gpsLat = coords[0].trim();
          gpsLng = coords[1].trim();
          gpsEnabledFlag = true;
        }
      }

      setFormData({
        title: currentMeeting.title || '',
        description: currentMeeting.description || '',
        meeting_date: meetingDate,
        start_time: startTime,
        end_time: endTime,
        location_text: currentMeeting.location_text || '',
        agenda: currentMeeting.agenda || '',
        facilitator: currentMeeting.facilitator || '',
        gps_latitude: gpsLat,
        gps_longitude: gpsLng,
      });
      setGpsEnabled(gpsEnabledFlag);
    }
  }, [currentMeeting]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDateChange = (date) => {
    setFormData({ ...formData, meeting_date: date });
  };

  const handleStartTimeChange = (time) => {
    setFormData({ ...formData, start_time: time });
  };

  const handleEndTimeChange = (time) => {
    setFormData({ ...formData, end_time: time });
  };

  const handleAgendaChange = (value) => {
    setFormData({ ...formData, agenda: value });
  };

  // GPS Functions
  const getCurrentLocation = () => {
    if (!gpsSupported) {
      setSnackbar({ open: true, message: 'Geolocation is not supported', severity: 'error' });
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          gps_latitude: position.coords.latitude.toFixed(6),
          gps_longitude: position.coords.longitude.toFixed(6),
        }));
        setGpsEnabled(true);
        setSnackbar({ open: true, message: 'Location captured!', severity: 'success' });
        setGpsLoading(false);
      },
      (error) => {
        setSnackbar({ open: true, message: 'Unable to get location', severity: 'error' });
        setGpsLoading(false);
      }
    );
  };

  const handleCopyCoordinates = () => {
    const coordinates = `${formData.gps_latitude},${formData.gps_longitude}`;
    navigator.clipboard.writeText(coordinates);
    setSnackbar({ open: true, message: 'Coordinates copied!', severity: 'success' });
  };

  const handlePasteCoordinates = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/([-+]?\d*\.?\d+)\s*[,]\s*([-+]?\d*\.?\d+)/);
      if (match) {
        setFormData(prev => ({
          ...prev,
          gps_latitude: match[1],
          gps_longitude: match[2],
        }));
        setGpsEnabled(true);
        setSnackbar({ open: true, message: 'Coordinates pasted!', severity: 'success' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Unable to paste', severity: 'error' });
    }
  };

  const handleGpsToggle = (event) => {
    const enabled = event.target.checked;
    setGpsEnabled(enabled);
    if (!enabled) {
      setFormData(prev => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
    } else if (!formData.gps_latitude) {
      getCurrentLocation();
    }
  };

  // Participant functions
  const handleAddCustomParticipant = () => {
    if (!newParticipant.name.trim()) {
      setSnackbar({ open: true, message: 'Please enter participant name', severity: 'warning' });
      return;
    }

    dispatch(addCustomParticipant(newParticipant));
    setNewParticipant({
      name: '',
      email: '',
      telephone: '',
      title: '',
      organization: '',
      is_chairperson: false,
    });
    setShowAddParticipantDialog(false);
    setSnackbar({ open: true, message: 'Participant added', severity: 'success' });
  };

  const handleRemoveParticipant = (participantId) => {
    dispatch(removeLocalMeetingParticipant(participantId));
  };

  const handleSetChairperson = (participantId) => {
    dispatch(setMeetingChairperson(participantId));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setSnackbar({ open: true, message: 'Please enter meeting title', severity: 'warning' });
      return;
    }
    if (!formData.meeting_date) {
      setSnackbar({ open: true, message: 'Please select meeting date', severity: 'warning' });
      return;
    }
    if (!formData.start_time) {
      setSnackbar({ open: true, message: 'Please select start time', severity: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const startDateTime = new Date(formData.meeting_date);
      startDateTime.setHours(formData.start_time.getHours(), formData.start_time.getMinutes());

      let endDateTime = null;
      if (formData.end_time) {
        endDateTime = new Date(formData.meeting_date);
        endDateTime.setHours(formData.end_time.getHours(), formData.end_time.getMinutes());
      }

      let gpsCoordinates = null;
      if (gpsEnabled && formData.gps_latitude && formData.gps_longitude) {
        gpsCoordinates = `${formData.gps_latitude},${formData.gps_longitude}`;
      }

      const updatePayload = {
        title: formData.title,
        description: formData.description || null,
        meeting_date: startDateTime.toISOString(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime ? endDateTime.toISOString() : null,
        location_text: formData.location_text || null,
        gps_coordinates: gpsCoordinates,
        agenda: formData.agenda || null,
        facilitator: formData.facilitator || null,
        chairperson_name: chairperson?.name || null,
        custom_participants: meetingParticipants.map((p) => ({
          name: p.name,
          email: p.email || null,
          telephone: p.telephone || null,
          title: p.title || null,
          organization: p.organization || null,
          is_chairperson: p.is_chairperson || false,
        })),
      };

      await dispatch(updateMeeting({ id, data: updatePayload })).unwrap();
      
      setSnackbar({ open: true, message: 'Meeting updated successfully!', severity: 'success' });
      setTimeout(() => {
        navigate(`/meetings/${id}`);
      }, 1500);
    } catch (err) {
      console.error('Error updating meeting:', err);
      setSnackbar({ open: true, message: err.message || 'Failed to update meeting', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(`/meetings/${id}`);
  };

  if (loading && !currentMeeting) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading meeting details...</Typography>
      </Container>
    );
  }

  if (error && !currentMeeting) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">
          {typeof error === 'string' ? error : 'Failed to load meeting details'}
        </Alert>
        <Button onClick={() => navigate('/meetings')} sx={{ mt: 2 }}>
          Back to Meetings
        </Button>
      </Container>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Header */}
        {isMobile ? (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar>
              <IconButton edge="start" onClick={handleCancel}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center' }}>
                Edit Meeting
              </Typography>
              <IconButton edge="end" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <CircularProgress size={24} /> : <SaveIcon />}
              </IconButton>
            </Toolbar>
          </AppBar>
        ) : (
          <Container maxWidth="md" sx={{ py: 3 }}>
            <Paper sx={{ p: 4 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight={700}>Edit Meeting</Typography>
                <Stack direction="row" spacing={2}>
                  <Button variant="outlined" onClick={handleCancel}>Cancel</Button>
                  <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <CircularProgress size={24} /> : 'Save Changes'}
                  </Button>
                </Stack>
              </Stack>
              <Divider />
            </Paper>
          </Container>
        )}

        <Container maxWidth="md" sx={{ py: 3 }}>
          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
            <Stack spacing={3}>
              {/* Basic Info */}
              <TextField
                fullWidth
                label="Meeting Title *"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />

              <TextField
                fullWidth
                label="Description"
                name="description"
                multiline
                rows={3}
                value={formData.description}
                onChange={handleChange}
              />

              {/* Date and Time */}
              <DatePicker
                label="Meeting Date *"
                value={formData.meeting_date}
                onChange={handleDateChange}
                slotProps={{ textField: { fullWidth: true } }}
              />

              <TimePicker
                label="Start Time *"
                value={formData.start_time}
                onChange={handleStartTimeChange}
                slotProps={{ textField: { fullWidth: true } }}
              />

              <TimePicker
                label="End Time"
                value={formData.end_time}
                onChange={handleEndTimeChange}
                slotProps={{ textField: { fullWidth: true } }}
              />

              {/* Location */}
              <TextField
                fullWidth
                label="Location"
                name="location_text"
                value={formData.location_text}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <LocationIcon sx={{ mr: 1, color: 'action.active' }} />,
                }}
              />

              {/* GPS Section */}
              <Card variant="outlined">
                <Box sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" gap={1}>
                      {gpsEnabled ? <GpsFixedIcon color="success" /> : <GpsNotFixedIcon color="disabled" />}
                      <Typography variant="subtitle1" fontWeight="bold">GPS Coordinates</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center">
                      <Switch checked={gpsEnabled} onChange={handleGpsToggle} size="small" />
                      <IconButton size="small" onClick={() => setShowGpsDetails(!showGpsDetails)}>
                        {showGpsDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Stack>
                  </Stack>

                  {showGpsDetails && gpsEnabled && (
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="contained" startIcon={gpsLoading ? <CircularProgress size={16} /> : <MyLocationIcon />} onClick={getCurrentLocation}>
                          {gpsLoading ? 'Getting...' : 'Get Location'}
                        </Button>
                        <Tooltip title="Copy">
                          <IconButton onClick={handleCopyCoordinates} disabled={!formData.gps_latitude} size="small">
                            <ContentCopyIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Paste">
                          <IconButton onClick={handlePasteCoordinates} size="small">
                            <PasteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <TextField
                        fullWidth
                        label="Latitude"
                        value={formData.gps_latitude}
                        onChange={(e) => setFormData({ ...formData, gps_latitude: e.target.value })}
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Longitude"
                        value={formData.gps_longitude}
                        onChange={(e) => setFormData({ ...formData, gps_longitude: e.target.value })}
                        size="small"
                      />
                    </Stack>
                  )}
                </Box>
              </Card>

              {/* Agenda */}
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Agenda</Typography>
                <ReactQuill
                  theme="snow"
                  value={formData.agenda}
                  onChange={handleAgendaChange}
                  modules={modules}
                  formats={formats}
                  style={{ height: '200px', marginBottom: '50px' }}
                />
              </Box>

              {/* Facilitator */}
              <TextField
                fullWidth
                label="Facilitator"
                name="facilitator"
                value={formData.facilitator}
                onChange={handleChange}
              />

              {/* Participants Section */}
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1" fontWeight="bold">Participants</Typography>
                    <Button startIcon={<PersonAddIcon />} onClick={() => setShowAddParticipantDialog(true)} size="small">
                      Add Participant
                    </Button>
                  </Stack>

                  {meetingParticipants.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      No participants added
                    </Typography>
                  ) : (
                    <List>
                      {meetingParticipants.map((participant) => (
                        <React.Fragment key={participant.id}>
                          <ListItem
                            secondaryAction={
                              <IconButton edge="end" onClick={() => handleRemoveParticipant(participant.id)}>
                                <DeleteIcon />
                              </IconButton>
                            }
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: participant.is_chairperson ? 'primary.main' : 'success.main' }}>
                                {participant.name.charAt(0).toUpperCase()}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={participant.name}
                              secondary={participant.email || participant.telephone}
                            />
                          </ListItem>
                          {!participant.is_chairperson && (
                            <Button size="small" onClick={() => handleSetChairperson(participant.id)} sx={{ ml: 7, mb: 1 }}>
                              Make Chairperson
                            </Button>
                          )}
                          <Divider component="li" />
                        </React.Fragment>
                      ))}
                    </List>
                  )}

                  {chairperson && (
                    <Box mt={2} p={2} bgcolor="#e3f2fd" borderRadius={1}>
                      <Typography variant="body2">
                        <strong>Chairperson:</strong> {chairperson.name}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Paper>
        </Container>

        {/* Add Participant Dialog */}
        <Dialog open={showAddParticipantDialog} onClose={() => setShowAddParticipantDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Participant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Full Name *"
                value={newParticipant.name}
                onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                required
              />
              <TextField
                fullWidth
                label="Email"
                value={newParticipant.email}
                onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
              />
              <TextField
                fullWidth
                label="Phone"
                value={newParticipant.telephone}
                onChange={(e) => setNewParticipant({ ...newParticipant, telephone: e.target.value })}
              />
              <TextField
                fullWidth
                label="Title"
                value={newParticipant.title}
                onChange={(e) => setNewParticipant({ ...newParticipant, title: e.target.value })}
              />
              <TextField
                fullWidth
                label="Organization"
                value={newParticipant.organization}
                onChange={(e) => setNewParticipant({ ...newParticipant, organization: e.target.value })}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newParticipant.is_chairperson}
                    onChange={(e) => setNewParticipant({ ...newParticipant, is_chairperson: e.target.checked })}
                  />
                }
                label="Set as Chairperson"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddParticipantDialog(false)}>Cancel</Button>
            <Button onClick={handleAddCustomParticipant} variant="contained" disabled={!newParticipant.name}>
              Add
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default EditMeeting;