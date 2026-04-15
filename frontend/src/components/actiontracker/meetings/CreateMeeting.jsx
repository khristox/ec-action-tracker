// CreateMeeting.jsx - Complete Fixed Version
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
  setSelectedListForMeeting,
  selectParticipantLists,
  selectMeetingParticipantsAll,
  selectMeetingChairperson,
  selectParticipantsLoading,
} from '../../../store/slices/actionTracker/participantSlice';
import { createMeeting, clearMeetingState } from '../../../store/slices/actionTracker/meetingSlice';

// Quill modules for mobile (simplified)
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

// Fixed formats - removed 'bullet' to avoid warning
const formats = ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'link'];

// Step icons
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

  const apiLoading = meetingLoading || participantsLoading;

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

  // Handle meeting creation success
  useEffect(() => {
    if (success) {
      setSnackbar({
        open: true,
        message: 'Meeting created successfully! Redirecting...',
        severity: 'success',
      });
      setTimeout(() => {
        navigate('/meetings');
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
          gps_latitude: latitude.toString(),
          gps_longitude: longitude.toString(),
        }));
        setGpsEnabled(true);
        setSnackbar({
          open: true,
          message: `Location captured: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          severity: 'success',
        });
        setGpsLoading(false);
      },
      (error) => {
        let errorMessage = 'Unable to get your location. ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Please allow location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out.';
            break;
          default:
            errorMessage += 'Please check your GPS settings.';
        }
        setSnackbar({ open: true, message: errorMessage, severity: 'error' });
        setGpsLoading(false);
        setGpsEnabled(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCopyCoordinates = () => {
    const coordinates = `${formData.gps_latitude},${formData.gps_longitude}`;
    navigator.clipboard
      .writeText(coordinates)
      .then(() => {
        setSnackbar({ open: true, message: 'Coordinates copied to clipboard!', severity: 'success' });
      })
      .catch(() => {
        setSnackbar({ open: true, message: 'Failed to copy coordinates', severity: 'error' });
      });
  };

  const handlePasteCoordinates = async () => {
    try {
      const text = await navigator.clipboard.readText();
      let latitude = null;
      let longitude = null;

      const commaSeparated = text.match(/([-+]?\d*\.?\d+)\s*[,]\s*([-+]?\d*\.?\d+)/);
      const spaceSeparated = text.match(/([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)/);
      const latLonMatch = commaSeparated || spaceSeparated;

      if (latLonMatch) {
        latitude = latLonMatch[1];
        longitude = latLonMatch[2];
      } else {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length >= 2) {
            latitude = parsed[0];
            longitude = parsed[1];
          }
        } catch (e) {
          // Not JSON
          console.warn('Clipboard text is not in expected format:', e.message);
        }
      }

      if (latitude && longitude) {
        setFormData((prev) => ({
          ...prev,
          gps_latitude: latitude,
          gps_longitude: longitude,
        }));
        setGpsEnabled(true);
        setSnackbar({ open: true, message: 'Coordinates pasted successfully!', severity: 'success' });
      } else {
        setSnackbar({
          open: true,
          message: 'Invalid coordinate format. Expected: "lat, lon"',
          severity: 'warning',
        });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Unable to paste. Please allow clipboard access.' + err.message,
        severity: 'error',
      });
    }
  };

  const handleGpsToggle = (event) => {
    const enabled = event.target.checked;
    setGpsEnabled(enabled);

    if (!enabled) {
      setFormData((prev) => ({
        ...prev,
        gps_latitude: '',
        gps_longitude: '',
      }));
    } else if (gpsSupported && !formData.gps_latitude && !formData.gps_longitude) {
      getCurrentLocation();
    }
  };

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
          message: `Added ${list.participants.length} participants from ${list.name}`,
          severity: 'success',
        });
      }
      setSelectedParticipantList(null);
      dispatch(setSelectedListForMeeting(null));
    }
  };

  const handleAddCustomParticipant = () => {
    if (!newParticipant.name.trim()) {
      setSnackbar({ open: true, message: 'Please enter participant name', severity: 'warning' });
      return;
    }

    const exists = meetingParticipants.some((p) => p.name === newParticipant.name);
    if (exists) {
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
    setSnackbar({ open: true, message: 'Participant added successfully', severity: 'success' });
  };

  const handleRemoveParticipant = (participantId) => {
    dispatch(removeLocalMeetingParticipant(participantId));
    setSnackbar({ open: true, message: 'Participant removed', severity: 'info' });
  };

  const handleSetChairperson = (participantId) => {
    dispatch(setMeetingChairperson(participantId));
    const participant = meetingParticipants.find((p) => p.id === participantId);
    if (participant) {
      setSnackbar({
        open: true,
        message: `${participant.name} is now the Chairperson`,
        severity: 'info',
      });
    }
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
      if (isMobile) window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (activeStep === 0) {
      navigate('/meetings');
    } else {
      setActiveStep(activeStep - 1);
      if (isMobile) window.scrollTo(0, 0);
    }
  };

  const handleCancel = () => {
    navigate('/meetings');
  };

  const handleSubmit = async () => {
    try {
      const meetingDate = formData.meeting_date;
      if (!meetingDate) {
        throw new Error('Meeting date is required');
      }
      if (!formData.start_time) {
        throw new Error('Start time is required');
      }

      const startDateTime = new Date(meetingDate);
      startDateTime.setHours(
        formData.start_time.getHours(),
        formData.start_time.getMinutes(),
        0,
        0
      );

      let endDateTime = null;
      if (formData.end_time) {
        endDateTime = new Date(meetingDate);
        endDateTime.setHours(
          formData.end_time.getHours(),
          formData.end_time.getMinutes(),
          0,
          0
        );

        if (endDateTime <= startDateTime) {
          setSnackbar({
            open: true,
            message: 'End time must be after start time',
            severity: 'warning',
          });
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

      await dispatch(createMeeting(meetingPayload)).unwrap();
    } catch (error) {
      console.error('Error creating meeting:', error);
      let errorMessage = 'Failed to create meeting. ';
      if (error.response?.status === 422) {
        const details = error.response.data?.error?.details || error.response.data?.detail;
        if (Array.isArray(details)) {
          errorMessage += details.map((d) => d.message || d.msg).join(', ');
        } else if (typeof details === 'string') {
          errorMessage = details;
        } else {
          errorMessage += JSON.stringify(details);
        }
      } else {
        errorMessage += error.response?.data?.message || error.message;
      }
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    }
  };

  const isStepValid = () => {
    if (activeStep === 0) {
      return formData.title && formData.meeting_date && formData.start_time;
    }
    return true;
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const chairpersonName = chairperson?.name || 'Not selected';

  const DatePickerComponent = isMobile ? MobileDatePicker : DatePicker;
  const TimePickerComponent = isMobile ? MobileTimePicker : TimePicker;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          pb: isMobile ? 8 : 4,
        }}
      >
        {/* Mobile App Bar */}
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={1} sx={{ bgcolor: 'background.paper' }}>
            <Toolbar sx={{ justifyContent: 'space-between' }}>
              <IconButton edge="start" onClick={() => navigate('/meetings')}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" fontWeight={600}>
                Create Meeting
              </Typography>
              <IconButton edge="end" onClick={handleCancel}>
                <CloseIcon />
              </IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Container maxWidth="md" sx={{ px: { xs: 1, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
          {/* Desktop Header */}
          {!isMobile && (
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="primary">
                  Create New Meeting
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fill in the details to schedule a new meeting
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                disabled={apiLoading}
              >
                Cancel
              </Button>
            </Box>
          )}

          {/* Main Form Card */}
          <Paper
            sx={{
              p: { xs: 2, sm: 3, md: 4 },
              borderRadius: { xs: 2, md: 3 },
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Loading Overlay */}
            {apiLoading && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: 'rgba(255,255,255,0.9)',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress />
              </Box>
            )}

            {/* Mobile Stepper */}
            {isMobile ? (
              <>
                <MobileStepper
                  variant="progress"
                  steps={3}
                  position="static"
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
                      sx={{ flex: 1, mx: 0.5, py: 1 }}
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

            {/* ==================== STEP 1: MEETING DETAILS ==================== */}
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
                  size="medium"
                />

                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  disabled={apiLoading}
                  placeholder="Brief overview of the meeting purpose"
                  size="medium"
                />

                <DatePickerComponent
                  label="Meeting Date *"
                  value={formData.meeting_date}
                  onChange={handleDateChange}
                  disabled={apiLoading}
                  slotProps={{ textField: { fullWidth: true, required: true, size: 'medium' } }}
                />

                <TimePickerComponent
                  label="Start Time *"
                  value={formData.start_time}
                  onChange={handleStartTimeChange}
                  disabled={apiLoading}
                  slotProps={{ textField: { fullWidth: true, required: true, size: 'medium' } }}
                />

                <TimePickerComponent
                  label="End Time"
                  value={formData.end_time}
                  onChange={handleEndTimeChange}
                  disabled={apiLoading}
                  slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
                />

                <TextField
                  fullWidth
                  label="Location"
                  name="location_text"
                  value={formData.location_text}
                  onChange={handleChange}
                  disabled={apiLoading}
                  placeholder="Conference Room A, Virtual Meeting, etc."
                  size="medium"
                  InputProps={{
                    startAdornment: <LocationIcon sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />

                {/* GPS Section with Toggle */}
                <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ p: 2, bgcolor: gpsEnabled ? '#e8f5e9' : '#fafafa' }}>
                    <Box
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      flexWrap="wrap"
                      gap={1}
                    >
                      <Box display="flex" alignItems="center" gap={1}>
                        {gpsEnabled ? (
                          <GpsFixedIcon color="success" />
                        ) : (
                          <GpsNotFixedIcon color="disabled" />
                        )}
                        <Typography variant="subtitle1" fontWeight="bold">
                          GPS Coordinates
                        </Typography>
                      </Box>
                      <FormGroup>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={gpsEnabled}
                              onChange={handleGpsToggle}
                              disabled={apiLoading || !gpsSupported}
                              color="primary"
                            />
                          }
                          label={gpsEnabled ? 'Enabled' : 'Disabled'}
                        />
                      </FormGroup>
                    </Box>

                    {!gpsSupported && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Geolocation is not supported by your browser
                      </Alert>
                    )}

                    {gpsEnabled && gpsSupported && (
                      <Stack spacing={2} sx={{ mt: 2 }}>
                        <Box display="flex" gap={1}>
                          <Button
                            variant="contained"
                            startIcon={gpsLoading ? <CircularProgress size={20} /> : <MyLocationIcon />}
                            onClick={getCurrentLocation}
                            disabled={apiLoading || gpsLoading}
                            size="small"
                          >
                            {gpsLoading ? 'Getting Location...' : 'Get Current Location'}
                          </Button>
                          <Tooltip title="Copy coordinates">
                            <IconButton
                              onClick={handleCopyCoordinates}
                              disabled={!formData.gps_latitude || !formData.gps_longitude}
                              size="small"
                            >
                              <ContentCopyIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Paste coordinates">
                            <IconButton onClick={handlePasteCoordinates} size="small">
                              <PasteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                          <TextField
                            fullWidth
                            label="Latitude"
                            name="gps_latitude"
                            type="text"
                            value={formData.gps_latitude}
                            onChange={(e) =>
                              setFormData({ ...formData, gps_latitude: e.target.value })
                            }
                            disabled={apiLoading}
                            placeholder="e.g., 0.3136"
                            size="small"
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Typography color="textSecondary">🌐</Typography>
                                </InputAdornment>
                              ),
                            }}
                          />
                          <TextField
                            fullWidth
                            label="Longitude"
                            name="gps_longitude"
                            type="text"
                            value={formData.gps_longitude}
                            onChange={(e) =>
                              setFormData({ ...formData, gps_longitude: e.target.value })
                            }
                            disabled={apiLoading}
                            placeholder="e.g., 32.5811"
                            size="small"
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Typography color="textSecondary">🌐</Typography>
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Box>

                        {(formData.gps_latitude || formData.gps_longitude) && (
                          <Alert severity="info" icon={<InfoIcon />} sx={{ py: 0 }}>
                            <Typography variant="caption">
                              Coordinates: {formData.gps_latitude || '?'},{' '}
                              {formData.gps_longitude || '?'}
                            </Typography>
                          </Alert>
                        )}
                      </Stack>
                    )}
                  </Box>
                </Card>

                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Agenda
                  </Typography>
                  <ReactQuill
                    theme="snow"
                    value={formData.agenda}
                    onChange={handleAgendaChange}
                    modules={isMobile ? mobileModules : desktopModules}
                    formats={formats}
                    style={{ height: '180px', marginBottom: '50px' }}
                    readOnly={apiLoading}
                    placeholder="Enter meeting agenda..."
                  />
                </Box>
              </Stack>
            )}

            {/* ==================== STEP 2: ADD PARTICIPANTS ==================== */}
            {activeStep === 1 && (
              <Stack spacing={3}>
                {/* Add from participant list */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      📋 Add from Participant List
                    </Typography>
                    <FormControl fullWidth size="medium" sx={{ mb: 2 }}>
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
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<GroupAddIcon />}
                      onClick={handleUseParticipantList}
                      disabled={!selectedParticipantList || apiLoading}
                      size="large"
                    >
                      Add Selected List
                    </Button>
                  </CardContent>
                </Card>

                {/* Individual participants */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        👤 Individual Participants
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<PersonAddIcon />}
                        onClick={() => setShowAddParticipantDialog(true)}
                        disabled={apiLoading}
                        size="small"
                      >
                        Add
                      </Button>
                    </Box>

                    {meetingParticipants.length === 0 ? (
                      <Box textAlign="center" py={4}>
                        <PeopleIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          No participants added yet
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Add participants from a list or individually
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                          {meetingParticipants.map((participant) => (
                            <React.Fragment key={participant.id}>
                              <ListItem
                                sx={{ px: 0, py: 1.5 }}
                                secondaryAction={
                                  <IconButton
                                    edge="end"
                                    onClick={() => handleRemoveParticipant(participant.id)}
                                    disabled={apiLoading}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                }
                              >
                                <ListItemAvatar>
                                  <Avatar
                                    sx={{
                                      bgcolor: participant.is_chairperson ? '#1976d2' : '#4caf50',
                                    }}
                                  >
                                    {participant.name.charAt(0).toUpperCase()}
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                      {participant.name}
                                      {participant.is_chairperson && (
                                        <Chip label="Chairperson" size="small" color="primary" />
                                      )}
                                    </Box>
                                  }
                                  secondary={
                                    <Box component="div" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                                      {participant.email && (
                                        <Typography variant="caption" component="span" color="text.secondary">
                                          {participant.email}
                                        </Typography>
                                      )}
                                      {participant.telephone && (
                                        <Typography variant="caption" component="span" color="text.secondary">
                                          {participant.telephone}
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                />
                              </ListItem>
                              {!participant.is_chairperson && (
                                <Box sx={{ pl: 7, pb: 1 }}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<PersonIcon />}
                                    onClick={() => handleSetChairperson(participant.id)}
                                    disabled={apiLoading}
                                  >
                                    Make Chairperson
                                  </Button>
                                </Box>
                              )}
                              <Divider component="li" />
                            </React.Fragment>
                          ))}
                        </List>

                        <Box mt={2} p={2} bgcolor="#e3f2fd" borderRadius={2}>
                          <Typography variant="body2" fontWeight="bold">
                            👑 Chairperson: {chairpersonName}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Facilitator */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      🎯 Facilitator
                    </Typography>
                    <TextField
                      fullWidth
                      label="Facilitator Name"
                      name="facilitator"
                      value={formData.facilitator}
                      onChange={handleChange}
                      disabled={apiLoading}
                      placeholder="Enter facilitator's name"
                      size="medium"
                    />
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* ==================== STEP 3: REVIEW & CREATE ==================== */}
            {activeStep === 2 && (
              <Stack spacing={2}>
                <Alert severity="info">Please review your meeting details before creating</Alert>

                <Card variant="outlined" sx={{ bgcolor: '#fafafa', borderRadius: 2 }}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary">
                          Basic Information
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2">
                          <strong>Title:</strong> {formData.title || 'Not specified'}
                        </Typography>
                        {formData.description && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Description:</strong> {formData.description}
                          </Typography>
                        )}
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary">
                          Date & Time
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2">
                          <strong>Date:</strong>{' '}
                          {formData.meeting_date?.toLocaleDateString() || 'Not set'}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Start:</strong>{' '}
                          {formData.start_time?.toLocaleTimeString() || 'Not set'}
                        </Typography>
                        {formData.end_time && (
                          <Typography variant="body2">
                            <strong>End:</strong> {formData.end_time.toLocaleTimeString()}
                          </Typography>
                        )}
                      </Box>

                      {formData.location_text && (
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold" color="primary">
                            Location
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="body2">{formData.location_text}</Typography>
                        </Box>
                      )}

                      {gpsEnabled && formData.gps_latitude && formData.gps_longitude && (
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold" color="primary">
                            GPS Coordinates
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="body2">
                            {formData.gps_latitude}, {formData.gps_longitude}
                          </Typography>
                        </Box>
                      )}

                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary">
                          Participants ({meetingParticipants.length})
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2">
                          <strong>Chairperson:</strong> {chairpersonName}
                        </Typography>
                        {formData.facilitator && (
                          <Typography variant="body2">
                            <strong>Facilitator:</strong> {formData.facilitator}
                          </Typography>
                        )}
                        {meetingParticipants.length > 0 && (
                          <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                            {meetingParticipants.slice(0, 5).map((p) => (
                              <li key={p.id}>
                                <Typography variant="body2">
                                  {p.name} {p.is_chairperson && '(Chairperson)'}
                                </Typography>
                              </li>
                            ))}
                            {meetingParticipants.length > 5 && (
                              <li>
                                <Typography variant="caption">
                                  ...and {meetingParticipants.length - 5} more
                                </Typography>
                              </li>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Navigation Buttons */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                mt: 4,
                flexDirection: isMobile ? 'column' : 'row',
              }}
            >
              <Button
                onClick={handleBack}
                disabled={apiLoading}
                startIcon={activeStep === 0 ? <CancelIcon /> : <ArrowBackIcon />}
                size="large"
                fullWidth={isMobile}
                variant="outlined"
              >
                {activeStep === 0 ? 'Cancel' : 'Back'}
              </Button>
              {activeStep === 2 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={apiLoading || success}
                  startIcon={apiLoading ? <CircularProgress size={20} /> : <SaveIcon />}
                  size="large"
                  fullWidth={isMobile}
                >
                  {apiLoading ? 'Creating...' : 'Create Meeting'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!isStepValid() || apiLoading}
                  endIcon={<ArrowForwardIcon />}
                  size="large"
                  fullWidth={isMobile}
                >
                  Next
                </Button>
              )}
            </Box>
          </Paper>
        </Container>

        {/* Mobile FAB */}
        {isMobile && !apiLoading && (
          <Zoom in>
            <Fab
              color="primary"
              sx={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 1000,
              }}
              onClick={activeStep === 2 ? handleSubmit : handleNext}
              disabled={!isStepValid() || apiLoading}
            >
              {activeStep === 2 ? <SaveIcon /> : <ArrowForwardIcon />}
            </Fab>
          </Zoom>
        )}

        {/* Add Participant Dialog */}
        <Dialog
          open={showAddParticipantDialog}
          onClose={() => setShowAddParticipantDialog(false)}
          maxWidth="sm"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            Add Participant
            <IconButton
              sx={{ position: 'absolute', right: 8, top: 8 }}
              onClick={() => setShowAddParticipantDialog(false)}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Full Name *"
                value={newParticipant.name}
                onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                required
                size="medium"
              />
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={newParticipant.email}
                onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                size="medium"
              />
              <TextField
                fullWidth
                label="Phone Number"
                value={newParticipant.telephone}
                onChange={(e) => setNewParticipant({ ...newParticipant, telephone: e.target.value })}
                size="medium"
              />
              <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                <TextField
                  fullWidth
                  label="Title / Role"
                  value={newParticipant.title}
                  onChange={(e) => setNewParticipant({ ...newParticipant, title: e.target.value })}
                  size="medium"
                />
                <TextField
                  fullWidth
                  label="Organization"
                  value={newParticipant.organization}
                  onChange={(e) =>
                    setNewParticipant({ ...newParticipant, organization: e.target.value })
                  }
                  size="medium"
                />
              </Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newParticipant.is_chairperson}
                    onChange={(e) =>
                      setNewParticipant({ ...newParticipant, is_chairperson: e.target.checked })
                    }
                  />
                }
                label="Set as Chairperson"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2, flexDirection: isMobile ? 'column' : 'row', gap: 1 }}>
            <Button onClick={() => setShowAddParticipantDialog(false)} fullWidth={isMobile}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCustomParticipant}
              variant="contained"
              disabled={!newParticipant.name}
              fullWidth={isMobile}
            >
              Add Participant
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateMeeting;