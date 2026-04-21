// CreateMeeting.jsx - Redirect to Dashboard after successful creation
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Snackbar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Checkbox,
  FormControlLabel,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  Stack,
  MobileStepper,
  Container,
  AppBar,
  Toolbar,
  Zoom,
  InputAdornment,
  Tooltip,
  Switch,
  FormGroup,
  Fab,
  Collapse,
  CardActionArea
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  GroupAdd as GroupAddIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Save as SaveIcon,
  Info as InfoIcon,
  MyLocation as MyLocationIcon,
  ContentCopy as ContentCopyIcon,
  ContentPaste as PasteIcon,
  GpsFixed as GpsFixedIcon,
  GpsNotFixed as GpsNotFixedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Dashboard as DashboardIcon,
  EditNote as SecretaryIcon // Added for Secretary
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { MobileDatePicker } from '@mui/x-date-pickers/MobileDatePicker';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Redux imports
import {
  fetchParticipantLists,
  fetchParticipants,
  addCustomParticipant,
  removeLocalMeetingParticipant,
  setMeetingChairperson,
  addParticipantsFromListToMeeting,
  clearMeetingParticipants,
  selectParticipantLists,
  selectMeetingParticipantsAll,
  selectMeetingChairperson,
  selectParticipantsLoading,
} from '../../../store/slices/actionTracker/participantSlice';
import { createMeeting, clearMeetingState } from '../../../store/slices/actionTracker/meetingSlice';

// Quill modules
const mobileModules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['clean'],
  ],
};

const desktopModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link', 'clean'],
  ],
};

const formats = ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'link'];

const steps = [
  { label: 'Details', icon: EventIcon },
  { label: 'Participants', icon: PeopleIcon },
  { label: 'Review', icon: CheckCircleIcon },
];

const CreateMeeting = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Redux state
  const participantLists = useSelector(selectParticipantLists);
  const meetingParticipants = useSelector(selectMeetingParticipantsAll);
  const chairperson = useSelector(selectMeetingChairperson);
  const participantsLoading = useSelector(selectParticipantsLoading);
  const { isLoading: meetingLoading, success, error: meetingError } = useSelector(
    (state) => state.meetings
  );

  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [selectedParticipantList, setSelectedParticipantList] = useState(null);
  const [showGpsDetails, setShowGpsDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: null,
    start_time: null,
    end_time: null,
    location_text: '',
    agenda: '',
    secretary_name: '', // Changed from facilitator
    gps_latitude: '',
    gps_longitude: '',
  });

  // GPS State
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSupported, setGpsSupported] = useState(true);

  // New participant form
  const [newParticipant, setNewParticipant] = useState({
    name: '',
    email: '',
    telephone: '',
    title: '',
    organization: '',
    is_chairperson: false,
  });

  const apiLoading = meetingLoading || participantsLoading || submitting;

  // Fetch data on mount
  useEffect(() => {
    dispatch(fetchParticipantLists());
    dispatch(fetchParticipants({ limit: 100 }));

    if (!navigator.geolocation) {
      setGpsSupported(false);
      setSnackbar({
        open: true,
        message: 'Geolocation is not supported by your browser',
        severity: 'warning',
      });
    }

    return () => {
      dispatch(clearMeetingState());
      dispatch(clearMeetingParticipants());
    };
  }, [dispatch]);

  // Handle meeting creation success - Redirect to Dashboard
  useEffect(() => {
    if (success) {
      setSnackbar({
        open: true,
        message: 'Meeting created successfully! Redirecting to Dashboard...',
        severity: 'success',
      });
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    }
  }, [success, navigate]);

  // Handle errors
  useEffect(() => {
    if (meetingError) {
      setSnackbar({
        open: true,
        message: typeof meetingError === 'string' ? meetingError : 'Failed to create meeting',
        severity: 'error',
      });
    }
  }, [meetingError]);

  // GPS Functions
  const getCurrentLocation = () => {
    if (!gpsSupported) {
      setSnackbar({
        open: true,
        message: 'Geolocation is not supported by your browser',
        severity: 'error',
      });
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData((prev) => ({
          ...prev,
          gps_latitude: latitude.toFixed(6),
          gps_longitude: longitude.toFixed(6),
        }));
        setGpsEnabled(true);
        setGpsLoading(false);
      },
      (error) => {
        let errorMessage = 'Unable to get location.';
        setSnackbar({ open: true, message: errorMessage, severity: 'error' });
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCopyCoordinates = () => {
    const coordinates = `${formData.gps_latitude},${formData.gps_longitude}`;
    navigator.clipboard.writeText(coordinates).then(() => {
      setSnackbar({ open: true, message: 'Coordinates copied!', severity: 'success' });
    });
  };

  const handlePasteCoordinates = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/([-+]?\d*\.?\d+)\s*[,]\s*([-+]?\d*\.?\d+)/);
      if (match) {
        setFormData((prev) => ({
          ...prev,
          gps_latitude: match[1],
          gps_longitude: match[2],
        }));
        setGpsEnabled(true);
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Unable to paste', severity: 'error' });
    }
  };

  const handleGpsToggle = (event) => {
    const enabled = event.target.checked;
    setGpsEnabled(enabled);
    if (!enabled) {
      setFormData((prev) => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
    } else if (gpsSupported && !formData.gps_latitude) {
      getCurrentLocation();
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDateChange = (date) => setFormData({ ...formData, meeting_date: date });
  const handleStartTimeChange = (time) => setFormData({ ...formData, start_time: time });
  const handleEndTimeChange = (time) => setFormData({ ...formData, end_time: time });
  const handleAgendaChange = (value) => setFormData({ ...formData, agenda: value });

  const handleUseParticipantList = () => {
    if (selectedParticipantList) {
      const list = participantLists.find((l) => l.id === selectedParticipantList);
      if (list && list.participants) {
        dispatch(
          addParticipantsFromListToMeeting({
            listId: selectedParticipantList,
            participants: list.participants,
          })
        );
        setSnackbar({
          open: true,
          message: `Added ${list.participants.length} participants`,
          severity: 'success',
        });
      }
      setSelectedParticipantList(null);
    }
  };

  const handleAddCustomParticipant = () => {
    if (!newParticipant.name.trim()) return;
    dispatch(addCustomParticipant(newParticipant));
    setNewParticipant({
      name: '', email: '', telephone: '', title: '', organization: '', is_chairperson: false,
    });
    setShowAddParticipantDialog(false);
  };

  const handleRemoveParticipant = (participantId) => {
    dispatch(removeLocalMeetingParticipant(participantId));
  };

  const handleSetChairperson = (participantId) => {
    dispatch(setMeetingChairperson(participantId));
  };

  const handleNext = () => {
    if (activeStep === 0 && !formData.title.trim()) return;
    setActiveStep(activeStep + 1);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (activeStep === 0) navigate('/meetings');
    else setActiveStep(activeStep - 1);
  };

  const handleCancel = () => navigate('/meetings');

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const meetingDate = formData.meeting_date;
      const startDateTime = new Date(meetingDate);
      startDateTime.setHours(formData.start_time.getHours(), formData.start_time.getMinutes());

      let endDateTime = null;
      if (formData.end_time) {
        endDateTime = new Date(meetingDate);
        endDateTime.setHours(formData.end_time.getHours(), formData.end_time.getMinutes());
      }

      const meetingPayload = {
        title: formData.title,
        description: formData.description || null,
        meeting_date: startDateTime.toISOString(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime ? endDateTime.toISOString() : null,
        location_text: formData.location_text || null,
        gps_coordinates: gpsEnabled ? `${formData.gps_latitude},${formData.gps_longitude}` : null,
        agenda: formData.agenda || null,
        secretary: formData.secretary_name || null, // Changed from facilitator
        chairperson_name: chairperson?.name || null,
        custom_participants: meetingParticipants.map((p) => ({
          name: p.name,
          email: p.email || null,
          telephone: p.telephone || null,
          title: p.title || null,
          organization: p.organization || null,
          is_chairperson: p.is_chairperson || false,
          is_secretary: p.name === formData.secretary_name // Tagging the secretary
        })),
      };

      await dispatch(createMeeting(meetingPayload)).unwrap();
      navigate('/dashboard');
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Failed to create meeting', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const chairpersonName = chairperson?.name || 'Not selected';

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 10, sm: 4 } }}>
        {/* Mobile App Bar */}
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={() => navigate('/meetings')}><ArrowBackIcon /></IconButton>
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>Create Meeting</Typography>
              <IconButton edge="end" onClick={handleCancel}><CloseIcon /></IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
          {!isMobile && (
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="primary">Create New Meeting</Typography>
                <Typography variant="body2" color="text.secondary">Fill in the details to schedule a new meeting</Typography>
              </Box>
              <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel} disabled={apiLoading}>Cancel</Button>
            </Box>
          )}

          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 2, md: 3 }, position: 'relative', overflow: 'hidden' }}>
            {apiLoading && (
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.9)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            )}

            <Stepper activeStep={activeStep} sx={{ mb: 4, display: isMobile ? 'none' : 'flex' }}>
              {steps.map((step, index) => (
                <Step key={index}><StepLabel StepIconComponent={step.icon}>{step.label}</StepLabel></Step>
              ))}
            </Stepper>

            {/* Step 1: Meeting Details */}
            {activeStep === 0 && (
              <Stack spacing={2.5}>
                <TextField fullWidth label="Meeting Title *" name="title" required value={formData.title} onChange={handleChange} disabled={apiLoading} />
                <TextField fullWidth label="Description" name="description" multiline rows={isMobile ? 2 : 3} value={formData.description} onChange={handleChange} disabled={apiLoading} />
                <DatePicker label="Meeting Date *" value={formData.meeting_date} onChange={handleDateChange} slotProps={{ textField: { fullWidth: true, required: true } }} />
                <TimePicker label="Start Time *" value={formData.start_time} onChange={handleStartTimeChange} slotProps={{ textField: { fullWidth: true, required: true } }} />
                <TimePicker label="End Time" value={formData.end_time} onChange={handleEndTimeChange} slotProps={{ textField: { fullWidth: true } }} />
                <TextField fullWidth label="Location" name="location_text" value={formData.location_text} onChange={handleChange} InputProps={{ startAdornment: <LocationIcon sx={{ mr: 1, color: 'action.active' }} /> }} />

                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardActionArea onClick={() => setShowGpsDetails(!showGpsDetails)}>
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {gpsEnabled ? <GpsFixedIcon color="success" /> : <GpsNotFixedIcon color="disabled" />}
                        <Typography variant="subtitle1" fontWeight="bold">GPS Coordinates</Typography>
                      </Box>
                      <Switch checked={gpsEnabled} onChange={handleGpsToggle} onClick={(e) => e.stopPropagation()} />
                    </Box>
                  </CardActionArea>
                  <Collapse in={showGpsDetails && gpsEnabled}>
                    <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                      <Stack spacing={2}>
                        <Button size="small" variant="contained" startIcon={<MyLocationIcon />} onClick={getCurrentLocation}>Get Location</Button>
                        <TextField fullWidth label="Latitude" value={formData.gps_latitude} size="small" />
                        <TextField fullWidth label="Longitude" value={formData.gps_longitude} size="small" />
                      </Stack>
                    </Box>
                  </Collapse>
                </Card>

                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Agenda</Typography>
                  <ReactQuill theme="snow" value={formData.agenda} onChange={handleAgendaChange} style={{ height: '150px', marginBottom: '50px' }} />
                </Box>
              </Stack>
            )}

            {/* Step 2: Participants */}
            {activeStep === 1 && (
              <Stack spacing={3}>
                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>📋 Add from Participant List</Typography>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Select Participant List</InputLabel>
                      <Select value={selectedParticipantList || ''} onChange={(e) => setSelectedParticipantList(e.target.value)} label="Select Participant List">
                        {participantLists.map((list) => (
                          <MenuItem key={list.id} value={list.id}>{list.name} ({list.participants?.length || 0})</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button fullWidth variant="contained" onClick={handleUseParticipantList} disabled={!selectedParticipantList}>Add Selected List</Button>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1" fontWeight="bold">👤 Individual Participants</Typography>
                      <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setShowAddParticipantDialog(true)}>Add</Button>
                    </Box>

                    {meetingParticipants.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>No participants added</Typography>
                    ) : (
                      <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {meetingParticipants.map((participant) => (
                          <React.Fragment key={participant.id}>
                            <ListItem secondaryAction={<IconButton onClick={() => handleRemoveParticipant(participant.id)}><DeleteIcon /></IconButton>}>
                              <ListItemAvatar><Avatar sx={{ bgcolor: participant.is_chairperson ? 'primary.main' : 'success.main' }}>{participant.name[0]}</Avatar></ListItemAvatar>
                              <ListItemText primary={participant.name} secondary={participant.is_chairperson ? "Chairperson" : "Member"} />
                            </ListItem>
                            {!participant.is_chairperson && <Button size="small" sx={{ ml: 7 }} onClick={() => handleSetChairperson(participant.id)}>Make Chairperson</Button>}
                            <Divider component="li" />
                          </React.Fragment>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>

                {/* Updated Secretary Selection */}
                <Card variant="outlined" sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                      <SecretaryIcon color="secondary" />
                      <Typography variant="subtitle1" fontWeight="bold">Designate Secretary</Typography>
                    </Stack>
                    <FormControl fullWidth>
                      <InputLabel>Select Secretary from Participants</InputLabel>
                      <Select
                        name="secretary_name"
                        value={formData.secretary_name}
                        onChange={handleChange}
                        label="Select Secretary from Participants"
                      >
                        <MenuItem value=""><em>None Selected</em></MenuItem>
                        {meetingParticipants.map((p) => (
                          <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Step 3: Review */}
            {activeStep === 2 && (
              <Stack spacing={2}>
                <Alert severity="info">Review meeting details</Alert>
                <Card variant="outlined" sx={{ bgcolor: '#fafafa' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="primary">Information</Typography>
                    <Typography variant="body2"><strong>Title:</strong> {formData.title}</Typography>
                    <Typography variant="body2"><strong>Chairperson:</strong> {chairpersonName}</Typography>
                    <Typography variant="body2" color="secondary.main"><strong>Secretary:</strong> {formData.secretary_name || 'Not selected'}</Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="primary">Participants ({meetingParticipants.length})</Typography>
                    <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                      {meetingParticipants.slice(0, 5).map(p => <li key={p.id}><Typography variant="body2">{p.name}</Typography></li>)}
                      {meetingParticipants.length > 5 && <li><Typography variant="body2">...and {meetingParticipants.length - 5} more</Typography></li>}
                    </Box>
                  </CardContent>
                </Card>
                <Button variant="contained" size="large" onClick={handleSubmit} startIcon={<SaveIcon />}>Create Meeting</Button>
              </Stack>
            )}

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button onClick={handleBack} startIcon={<ArrowBackIcon />}>{activeStep === 0 ? 'Cancel' : 'Back'}</Button>
              {activeStep < 2 && <Button variant="contained" onClick={handleNext} endIcon={<ArrowForwardIcon />}>Next</Button>}
            </Box>
          </Paper>
        </Container>

        {/* Add Participant Dialog */}
        <Dialog open={showAddParticipantDialog} onClose={() => setShowAddParticipantDialog(false)}>
          <DialogTitle>Add New Participant</DialogTitle>
          <DialogContent>
            <TextField fullWidth label="Name" margin="dense" value={newParticipant.name} onChange={(e) => setNewParticipant({...newParticipant, name: e.target.value})} />
            <TextField fullWidth label="Email" margin="dense" value={newParticipant.email} onChange={(e) => setNewParticipant({...newParticipant, email: e.target.value})} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddParticipantDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddCustomParticipant}>Add</Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({...snackbar, open: false})} message={snackbar.message} />
      </Box>
    </LocalizationProvider>
  );
};

export default CreateMeeting;