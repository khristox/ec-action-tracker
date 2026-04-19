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
  Dashboard as DashboardIcon
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
    facilitator: '',
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
        setSnackbar({
          open: true,
          message: 'Location captured successfully!',
          severity: 'success',
        });
        setGpsLoading(false);
      },
      (error) => {
        let errorMessage = 'Unable to get your location. ';
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage += 'Please allow location access.';
        } else if (error.code === error.TIMEOUT) {
          errorMessage += 'Request timed out.';
        } else {
          errorMessage += 'Please check your GPS settings.';
        }
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
        setSnackbar({ open: true, message: 'Coordinates pasted!', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'Invalid format. Use: lat, lon', severity: 'warning' });
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
    if (!newParticipant.name.trim()) {
      setSnackbar({ open: true, message: 'Please enter participant name', severity: 'warning' });
      return;
    }
    if (meetingParticipants.some((p) => p.name === newParticipant.name)) {
      setSnackbar({ open: true, message: 'Participant already added', severity: 'warning' });
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
    setSnackbar({ open: true, message: 'Participant removed', severity: 'info' });
  };

  const handleSetChairperson = (participantId) => {
    dispatch(setMeetingChairperson(participantId));
  };

  const validateStep = () => {
    if (activeStep === 0) {
      if (!formData.title.trim()) {
        setSnackbar({ open: true, message: 'Please enter meeting title', severity: 'warning' });
        return false;
      }
      if (!formData.meeting_date) {
        setSnackbar({ open: true, message: 'Please select meeting date', severity: 'warning' });
        return false;
      }
      if (!formData.start_time) {
        setSnackbar({ open: true, message: 'Please select start time', severity: 'warning' });
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep(activeStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (activeStep === 0) navigate('/meetings');
    else setActiveStep(activeStep - 1);
    window.scrollTo(0, 0);
  };

  const handleCancel = () => navigate('/meetings');

const handleSubmit = async () => {
  setSubmitting(true);
  try {
    const meetingDate = formData.meeting_date;
    if (!meetingDate) throw new Error('Meeting date is required');
    if (!formData.start_time) throw new Error('Start time is required');

    const startDateTime = new Date(meetingDate);
    startDateTime.setHours(formData.start_time.getHours(), formData.start_time.getMinutes());

    let endDateTime = null;
    if (formData.end_time) {
      endDateTime = new Date(meetingDate);
      endDateTime.setHours(formData.end_time.getHours(), formData.end_time.getMinutes());
      if (endDateTime <= startDateTime) {
        setSnackbar({ open: true, message: 'End time must be after start time', severity: 'warning' });
        setSubmitting(false);
        return;
      }
    }

    let gpsCoordinates = null;
    if (gpsEnabled && formData.gps_latitude && formData.gps_longitude) {
      gpsCoordinates = `${formData.gps_latitude},${formData.gps_longitude}`;
    }

    const meetingPayload = {
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

    console.log('Submitting meeting payload:', meetingPayload);
    const result = await dispatch(createMeeting(meetingPayload)).unwrap();
    console.log('Meeting created successfully:', result);
    
    // Show success message
    setSnackbar({
      open: true,
      message: 'Meeting created successfully! Redirecting to Dashboard...',
      severity: 'success',
    });
    
    // Redirect after a short delay
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
    
  } catch (error) {
    console.error('Error creating meeting:', error);
    setSnackbar({
      open: true,
      message: error.message || 'Failed to create meeting',
      severity: 'error',
    });
  } finally {
    setSubmitting(false);
  }
};
  const isStepValid = () => {
    if (activeStep === 0) return formData.title && formData.meeting_date && formData.start_time;
    return true;
  };

  const chairpersonName = chairperson?.name || 'Not selected';

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 10, sm: 4 } }}>
        {/* Mobile App Bar */}
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={() => navigate('/meetings')}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>
                Create Meeting
              </Typography>
              <IconButton edge="end" onClick={handleCancel}>
                <CloseIcon />
              </IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
          {/* Desktop Header */}
          {!isMobile && (
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="primary">Create New Meeting</Typography>
                <Typography variant="body2" color="text.secondary">Fill in the details to schedule a new meeting</Typography>
              </Box>
              <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel} disabled={apiLoading}>
                Cancel
              </Button>
            </Box>
          )}

          {/* Main Form Card */}
          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 2, md: 3 }, position: 'relative', overflow: 'hidden' }}>
            {apiLoading && (
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(255,255,255,0.9)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            )}

            {/* Mobile Stepper */}
            {isMobile ? (
              <>
                <MobileStepper
                  variant="progress"
                  steps={3}
                  activeStep={activeStep}
                  sx={{ mb: 2, bgcolor: 'transparent', p: 0 }}
                  nextButton={null}
                  backButton={null}
                />
                <Box display="flex" justifyContent="space-between" mb={3}>
                  {steps.map((step, index) => (
                    <Chip
                      key={index}
                      label={step.label}
                      icon={<step.icon />}
                      color={index === activeStep ? 'primary' : 'default'}
                      variant={index === activeStep ? 'filled' : 'outlined'}
                      sx={{ flex: 1, mx: 0.5, py: { xs: 1, sm: 1.5 } }}
                    />
                  ))}
                </Box>
              </>
            ) : (
              <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((step, index) => (
                  <Step key={index}>
                    <StepLabel StepIconComponent={step.icon}>{step.label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            )}

            {/* Step 1: Meeting Details */}
            {activeStep === 0 && (
              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  label="Meeting Title *"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  disabled={apiLoading}
                  placeholder="e.g., Quarterly Planning Session"
                />

                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  multiline
                  rows={isMobile ? 2 : 3}
                  value={formData.description}
                  onChange={handleChange}
                  disabled={apiLoading}
                  placeholder="Brief overview of the meeting purpose"
                />

                <DatePicker
                  label="Meeting Date *"
                  value={formData.meeting_date}
                  onChange={handleDateChange}
                  disabled={apiLoading}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />

                <TimePicker
                  label="Start Time *"
                  value={formData.start_time}
                  onChange={handleStartTimeChange}
                  disabled={apiLoading}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />

                <TimePicker
                  label="End Time"
                  value={formData.end_time}
                  onChange={handleEndTimeChange}
                  disabled={apiLoading}
                  slotProps={{ textField: { fullWidth: true } }}
                />

                <TextField
                  fullWidth
                  label="Location"
                  name="location_text"
                  value={formData.location_text}
                  onChange={handleChange}
                  disabled={apiLoading}
                  placeholder="Conference Room A, Virtual Meeting, etc."
                  InputProps={{ startAdornment: <LocationIcon sx={{ mr: 1, color: 'action.active' }} /> }}
                />

                {/* GPS Section */}
                <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <CardActionArea onClick={() => setShowGpsDetails(!showGpsDetails)}>
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {gpsEnabled ? <GpsFixedIcon color="success" /> : <GpsNotFixedIcon color="disabled" />}
                        <Typography variant="subtitle1" fontWeight="bold">GPS Coordinates</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Switch checked={gpsEnabled} onChange={handleGpsToggle} disabled={apiLoading || !gpsSupported} size="small" />
                        <IconButton size="small">{showGpsDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
                      </Box>
                    </Box>
                  </CardActionArea>

                  <Collapse in={showGpsDetails && gpsEnabled}>
                    <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                      <Stack spacing={2}>
                        <Box display="flex" gap={1} flexWrap="wrap">
                          <Button size="small" variant="contained" startIcon={gpsLoading ? <CircularProgress size={16} /> : <MyLocationIcon />} onClick={getCurrentLocation} disabled={apiLoading || gpsLoading}>
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
                        </Box>
                        <TextField
                          fullWidth
                          label="Latitude"
                          value={formData.gps_latitude}
                          onChange={(e) => setFormData({ ...formData, gps_latitude: e.target.value })}
                          size="small"
                          placeholder="0.0000"
                        />
                        <TextField
                          fullWidth
                          label="Longitude"
                          value={formData.gps_longitude}
                          onChange={(e) => setFormData({ ...formData, gps_longitude: e.target.value })}
                          size="small"
                          placeholder="0.0000"
                        />
                      </Stack>
                    </Box>
                  </Collapse>
                </Card>

                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Agenda</Typography>
                  <ReactQuill
                    theme="snow"
                    value={formData.agenda}
                    onChange={handleAgendaChange}
                    modules={isMobile ? mobileModules : desktopModules}
                    formats={formats}
                    style={{ height: '150px', marginBottom: '50px' }}
                    placeholder="Enter meeting agenda..."
                  />
                </Box>
              </Stack>
            )}

            {/* Step 2: Participants */}
            {activeStep === 1 && (
              <Stack spacing={3}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>📋 Add from Participant List</Typography>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Select Participant List</InputLabel>
                      <Select
                        value={selectedParticipantList || ''}
                        onChange={(e) => setSelectedParticipantList(e.target.value)}
                        label="Select Participant List"
                        disabled={apiLoading}
                      >
                        {participantLists.map((list) => (
                          <MenuItem key={list.id} value={list.id}>
                            {list.name} ({list.participant_count || list.participants?.length || 0})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button fullWidth variant="contained" startIcon={<GroupAddIcon />} onClick={handleUseParticipantList} disabled={!selectedParticipantList || apiLoading}>
                      Add Selected List
                    </Button>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
                      <Typography variant="subtitle1" fontWeight="bold">👤 Individual Participants</Typography>
                      <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setShowAddParticipantDialog(true)} disabled={apiLoading} size="small">
                        Add
                      </Button>
                    </Box>

                    {meetingParticipants.length === 0 ? (
                      <Box textAlign="center" py={4}>
                        <PeopleIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">No participants added yet</Typography>
                      </Box>
                    ) : (
                      <>
                        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                          {meetingParticipants.map((participant) => (
                            <React.Fragment key={participant.id}>
                              <ListItem sx={{ px: 0, py: 1.5, flexWrap: 'wrap' }} secondaryAction={
                                <IconButton edge="end" onClick={() => handleRemoveParticipant(participant.id)} disabled={apiLoading}>
                                  <DeleteIcon />
                                </IconButton>
                              }>
                                <ListItemAvatar>
                                  <Avatar sx={{ bgcolor: participant.is_chairperson ? '#1976d2' : '#4caf50' }}>
                                    {participant.name.charAt(0).toUpperCase()}
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={participant.name}
                                  secondary={
                                    <Box component="div">
                                      {participant.email && <Typography variant="caption" component="span" display="block" color="text.secondary">{participant.email}</Typography>}
                                      {participant.telephone && <Typography variant="caption" component="span" display="block" color="text.secondary">{participant.telephone}</Typography>}
                                    </Box>
                                  }
                                />
                              </ListItem>
                              {!participant.is_chairperson && (
                                <Button size="small" variant="outlined" onClick={() => handleSetChairperson(participant.id)} disabled={apiLoading} sx={{ ml: 7, mb: 1 }}>
                                  Make Chairperson
                                </Button>
                              )}
                              <Divider component="li" />
                            </React.Fragment>
                          ))}
                        </List>

                        <Box mt={2} p={2} bgcolor="#e3f2fd" borderRadius={2}>
                          <Typography variant="body2" fontWeight="bold">👑 Chairperson: {chairpersonName}</Typography>
                        </Box>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>🎯 Facilitator</Typography>
                    <TextField fullWidth label="Facilitator Name" name="facilitator" value={formData.facilitator} onChange={handleChange} disabled={apiLoading} placeholder="Enter facilitator's name" />
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Step 3: Review */}
            {activeStep === 2 && (
              <Stack spacing={2}>
                <Alert severity="info">Please review your meeting details before creating</Alert>

                <Card variant="outlined" sx={{ bgcolor: '#fafafa', borderRadius: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary">Basic Information</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2"><strong>Title:</strong> {formData.title || 'Not specified'}</Typography>
                        {formData.description && <Typography variant="body2" sx={{ mt: 1 }}><strong>Description:</strong> {formData.description}</Typography>}
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary">Date & Time</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2"><strong>Date:</strong> {formData.meeting_date?.toLocaleDateString() || 'Not set'}</Typography>
                        <Typography variant="body2"><strong>Start:</strong> {formData.start_time?.toLocaleTimeString() || 'Not set'}</Typography>
                        {formData.end_time && <Typography variant="body2"><strong>End:</strong> {formData.end_time.toLocaleTimeString()}</Typography>}
                      </Box>

                      {formData.location_text && (
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold" color="primary">Location</Typography>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="body2">{formData.location_text}</Typography>
                        </Box>
                      )}

                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary">Participants ({meetingParticipants.length})</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2"><strong>Chairperson:</strong> {chairpersonName}</Typography>
                        {formData.facilitator && <Typography variant="body2"><strong>Facilitator:</strong> {formData.facilitator}</Typography>}
                        {meetingParticipants.length > 0 && (
                          <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                            {meetingParticipants.slice(0, 3).map((p) => (
                              <li key={p.id}><Typography variant="body2">{p.name} {p.is_chairperson && '(Chairperson)'}</Typography></li>
                            ))}
                            {meetingParticipants.length > 3 && <li><Typography variant="caption">...and {meetingParticipants.length - 3} more</Typography></li>}
                          </Box>
                        )}
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 4, flexDirection: isMobile ? 'column' : 'row' }}>
              <Button onClick={handleBack} disabled={apiLoading} startIcon={activeStep === 0 ? <CancelIcon /> : <ArrowBackIcon />} size="large" fullWidth={isMobile} variant="outlined">
                {activeStep === 0 ? 'Cancel' : 'Back'}
              </Button>
              {activeStep === 2 ? (
                <Button variant="contained" onClick={handleSubmit} disabled={apiLoading} startIcon={apiLoading ? <CircularProgress size={20} /> : <SaveIcon />} size="large" fullWidth={isMobile}>
                  {apiLoading ? 'Creating...' : 'Create Meeting'}
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNext} disabled={!isStepValid() || apiLoading} endIcon={<ArrowForwardIcon />} size="large" fullWidth={isMobile}>
                  Next
                </Button>
              )}
            </Box>
          </Paper>
        </Container>

        {/* Mobile FAB */}
        {isMobile && !apiLoading && (
          <Zoom in>
            <Fab color="primary" sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }} onClick={activeStep === 2 ? handleSubmit : handleNext} disabled={!isStepValid() || apiLoading}>
              {activeStep === 2 ? <SaveIcon /> : <ArrowForwardIcon />}
            </Fab>
          </Zoom>
        )}

        {/* Add Participant Dialog */}
        <Dialog open={showAddParticipantDialog} onClose={() => setShowAddParticipantDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
          <DialogTitle>Add Participant</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField fullWidth label="Full Name *" value={newParticipant.name} onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })} required />
              <TextField fullWidth label="Email Address" type="email" value={newParticipant.email} onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })} />
              <TextField fullWidth label="Phone Number" value={newParticipant.telephone} onChange={(e) => setNewParticipant({ ...newParticipant, telephone: e.target.value })} />
              <TextField fullWidth label="Title / Role" value={newParticipant.title} onChange={(e) => setNewParticipant({ ...newParticipant, title: e.target.value })} />
              <TextField fullWidth label="Organization" value={newParticipant.organization} onChange={(e) => setNewParticipant({ ...newParticipant, organization: e.target.value })} />
              <FormControlLabel control={<Checkbox checked={newParticipant.is_chairperson} onChange={(e) => setNewParticipant({ ...newParticipant, is_chairperson: e.target.checked })} />} label="Set as Chairperson" />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2, flexDirection: isMobile ? 'column' : 'row', gap: 1 }}>
            <Button onClick={() => setShowAddParticipantDialog(false)} fullWidth={isMobile}>Cancel</Button>
            <Button onClick={handleAddCustomParticipant} variant="contained" disabled={!newParticipant.name} fullWidth={isMobile}>Add Participant</Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateMeeting;