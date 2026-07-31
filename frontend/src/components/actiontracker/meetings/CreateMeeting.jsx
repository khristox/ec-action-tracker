// src/components/actiontracker/meetings/CreateMeeting.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Paper,
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
  useMediaQuery,
  useTheme,
  Stack,
  AppBar,
  Toolbar,
  Grid,
  alpha,
  Grow,
  TextField,
} from '@mui/material';
import {
  Delete,
  PersonAdd,
  Close,
  Cancel,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Event as EventIcon,
  People as PeopleIcon,
  Save,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Work as WorkIcon,
  Title as TitleIcon,
  Repeat as RepeatIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../../../services/api';

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
import {
  createMeeting,
  clearMeetingState,
} from '../../../store/slices/actionTracker/meetingSlice';

// Step components
import { MeetingDetailsStep } from './MeetingForm/steps/MeetingDetailsStep';
import { AccessControlStep } from './MeetingForm/steps/AccessControlStep';
import { VISIBILITY, DEFAULT_VISIBILITY,normaliseVisibility } from './MeetingForm/constants';
import { RecurringMeetingSection } from './components/RecurringMeetingSection';

// ==================== Constants ====================

const steps = [
  { label: 'Details', icon: EventIcon },
  { label: 'Access Control', icon: LockIcon },
  { label: 'Participants', icon: PeopleIcon },
  { label: 'Recurrence', icon: RepeatIcon },
  { label: 'Review', icon: CheckCircleIcon },
];

// ==================== Main Component ====================

const CreateMeeting = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const participantLists = useSelector(selectParticipantLists);
  const meetingParticipants = useSelector(selectMeetingParticipantsAll);
  const chairperson = useSelector(selectMeetingChairperson);
  const participantsLoading = useSelector(selectParticipantsLoading);
  const {
    isLoading: meetingLoading,
    success,
    error: meetingError,
  } = useSelector((state) => state.meetings);

  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [selectedParticipantList, setSelectedParticipantList] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Recurrence state
  const [recurrence, setRecurrence] = useState(null);

  // Access control state - initialized to DEFAULT_VISIBILITY ('department')
 const [visibility, setVisibility] = useState(normaliseVisibility(DEFAULT_VISIBILITY));
  const [restrictedDepartmentId, setRestrictedDepartmentId] = useState(null);
  const [restrictedDepartmentName, setRestrictedDepartmentName] = useState(null);

  // Form data state
  const now = new Date();
  const defaultStartTime = new Date();
  defaultStartTime.setHours(9, 0, 0, 0);
  const defaultEndTime = new Date();
  defaultEndTime.setHours(10, 0, 0, 0);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: now,
    start_time: defaultStartTime,
    end_time: defaultEndTime,
    location_text: '',
    location_id: null,
    location_details: null,
    agenda: '',
    secretary_name: '',
    gps_latitude: '',
    gps_longitude: '',
    platform: 'physical',
    meeting_link: '',
  });

  const [gpsEnabled, setGpsEnabled] = useState(false);

  const [newParticipant, setNewParticipant] = useState({
    name: '',
    email: '',
    telephone: '',
    title: '',
    organization: '',
    is_chairperson: false,
  });

  const apiLoading = meetingLoading || participantsLoading || submitting;
  const chairpersonName = useMemo(() => chairperson?.name || 'Not selected', [chairperson]);
  const isRecurring = useMemo(() => recurrence?.enabled === true, [recurrence]);
  const isRestricted = visibility === VISIBILITY.DEPARTMENT;

  // ==================== Effects ====================

  useEffect(() => {
    dispatch(fetchParticipantLists());
    dispatch(fetchParticipants({ limit: 100 }));
    return () => {
      dispatch(clearMeetingState());
      dispatch(clearMeetingParticipants());
    };
  }, [dispatch]);

  useEffect(() => {
    if (success) {
      setSnackbar({
        open: true,
        message: 'Meeting created. Returning to the meetings list…',
        severity: 'success',
      });
      const t = setTimeout(() => navigate('/meetings'), 2000);
      return () => clearTimeout(t);
    }
  }, [success, navigate]);

  useEffect(() => {
    if (meetingError) {
      setSnackbar({
        open: true,
        message:
          typeof meetingError === 'string' ? meetingError : 'The meeting could not be created.',
        severity: 'error',
      });
    }
  }, [meetingError]);

  // ==================== Handlers ====================

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleDateChange = (date) => setFormData({ ...formData, meeting_date: date });
  const handleStartTimeChange = (time) => setFormData({ ...formData, start_time: time });
  const handleEndTimeChange = (time) => setFormData({ ...formData, end_time: time });
  const handleAgendaChange = (value) => setFormData({ ...formData, agenda: value });

  const handleLocationSelect = useCallback((location) => {
    if (location) {
      setFormData((prev) => ({
        ...prev,
        location_id: location.id,
        location_text: location.name,
        location_details: {
          id: location.id,
          name: location.name,
          code: location.code,
          level: location.level,
          location_mode: location.location_mode,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        location_id: null,
        location_text: '',
        location_details: null,
      }));
    }
  }, []);

  const handleRestrictedDepartmentChange = useCallback((id, dept) => {
    setRestrictedDepartmentId(id);
    setRestrictedDepartmentName(dept?.name || null);
  }, []);

  const handleClearRestrictedDepartment = useCallback(() => {
    setRestrictedDepartmentId(null);
    setRestrictedDepartmentName(null);
    setVisibility(VISIBILITY.OPEN);
  }, []);

  const handleNewParticipantChange = (field) => (event) =>
    setNewParticipant({ ...newParticipant, [field]: event.target.value });

  const handleUseParticipantList = () => {
    if (selectedParticipantList) {
      const list = participantLists.find((l) => l.id === selectedParticipantList);
      if (list?.participants) {
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

  const handleRemoveParticipant = (participantId) =>
    dispatch(removeLocalMeetingParticipant(participantId));
  const handleSetChairperson = (participantId) => dispatch(setMeetingChairperson(participantId));

  const handleNext = () => {
    if (activeStep === 0 && !formData.title.trim()) {
      setSnackbar({ open: true, message: 'Enter a meeting title to continue', severity: 'warning' });
      return;
    }
    if (activeStep === 1 && isRestricted && !restrictedDepartmentId) {
      setSnackbar({
        open: true,
        message: 'Select a department, or switch visibility to Open to All',
        severity: 'warning',
      });
      return;
    }
    setActiveStep((prev) => prev + 1);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (activeStep === 0) navigate('/meetings');
    else setActiveStep((prev) => prev - 1);
  };

  const handleCancel = () => navigate('/meetings');

  // ==================== Submit Handler ====================

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const meetingDate = formData.meeting_date;

      const startDateTime = new Date(meetingDate);
      if (
        formData.start_time instanceof Date &&
        !Number.isNaN(formData.start_time.getTime())
      ) {
        startDateTime.setHours(
          formData.start_time.getHours(),
          formData.start_time.getMinutes(),
          0,
          0
        );
      }

      let endDateTime = null;
      if (formData.end_time instanceof Date && !Number.isNaN(formData.end_time.getTime())) {
        endDateTime = new Date(meetingDate);
        endDateTime.setHours(formData.end_time.getHours(), formData.end_time.getMinutes(), 0, 0);
      }

      const meetingPayload = {
        title: formData.title.trim(),
        description: formData.description || null,
        meeting_date: startDateTime.toISOString(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime ? endDateTime.toISOString() : null,
        location_text: formData.location_text || null,
        location_id: formData.location_id || null,
        gps_coordinates:
          gpsEnabled && formData.gps_latitude && formData.gps_longitude
            ? `${formData.gps_latitude},${formData.gps_longitude}`
            : null,
        agenda: formData.agenda || null,
        secretary_name: formData.secretary_name || null,
        chairperson_name: chairperson?.name || null,
        platform: formData.platform || 'physical',
        meeting_link: formData.meeting_link || null,
        visibility,
        restricted_department_id: isRestricted ? restrictedDepartmentId : null,
        custom_participants: meetingParticipants.map((p) => ({
          name: p.name,
          email: p.email || null,
          telephone: p.telephone || null,
          title: p.title || null,
          organization: p.organization || null,
          is_chairperson: p.is_chairperson || false,
          is_secretary: p.name === formData.secretary_name,
        })),
      };

      if (isRecurring && recurrence) {
        const recurringPayload = {
          ...meetingPayload,
          recurrence_type: recurrence.type,
          recurrence_interval: recurrence.interval,
          recurrence_days: recurrence.days || [],
          recurrence_day_of_month:
            recurrence.day_of_month === 'last' ? -1 : recurrence.day_of_month || 1,
          recurrence_end_date: recurrence.end_date
            ? recurrence.end_date.toISOString()
            : null,
          recurrence_max_occurrences: recurrence.max_occurrences || null,
        };
        await api.post('/recurring-meetings/', recurringPayload);
        setSnackbar({ open: true, message: 'Recurring meeting created', severity: 'success' });
      } else {
        await dispatch(createMeeting(meetingPayload)).unwrap();
        setSnackbar({ open: true, message: 'Meeting created', severity: 'success' });
      }

      setTimeout(() => navigate('/meetings'), 2000);
    } catch (error) {
      console.error('Error creating meeting:', error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        'The meeting could not be created.';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = useMemo(() => {
    const date = formData.meeting_date;
    if (!date) return 'Not set';
    if (date instanceof Date && !Number.isNaN(date.getTime())) return date.toLocaleDateString();
    return 'Invalid date';
  }, [formData.meeting_date]);

  const formattedStartTime = useMemo(() => {
    const time = formData.start_time;
    if (!time) return 'Not set';
    if (time instanceof Date && !Number.isNaN(time.getTime())) {
      return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return 'Invalid time';
  }, [formData.start_time]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          pb: { xs: 10, sm: 4 },
        }}
      >
        {isMobile && (
          <AppBar
            position="sticky"
            color="default"
            elevation={0}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={() => navigate('/meetings')}>
                <ArrowBackIcon />
              </IconButton>
              <Typography
                variant="subtitle1"
                sx={{ flex: 1, textAlign: 'center', fontWeight: 600 }}
              >
                Create Meeting
              </Typography>
              <IconButton edge="end" onClick={handleCancel}>
                <Close />
              </IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Box sx={{ width: '100%', px: { xs: 2, sm: 3, md: 4, lg: 6 }, py: { xs: 2, sm: 3 } }}>
          {!isMobile && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2.5,
              }}
            >
             
              <Button
                variant="outlined"
                size="small"
                startIcon={<Cancel />}
                onClick={handleCancel}
                disabled={apiLoading}
              >
                Cancel
              </Button>
            </Box>
          )}

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper
                sx={{
                  p: { xs: 2, sm: 2.5, md: 3 },
                  borderRadius: { xs: 2, md: 3 },
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {apiLoading && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: alpha(theme.palette.background.paper, 0.9),
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CircularProgress />
                  </Box>
                )}

                <Stepper
                  activeStep={activeStep}
                  sx={{ mb: 3, display: isMobile ? 'none' : 'flex' }}
                >
                  {steps.map((step, idx) => (
                    <Step key={idx}>
                      <StepLabel StepIconComponent={step.icon}>
                        <Typography variant="body2">{step.label}</Typography>
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>

                {activeStep === 0 && (
                  <Grow in timeout={300}>
                    <Box>
                      <MeetingDetailsStep
                        formData={formData}
                        setFormData={setFormData}
                        gpsEnabled={gpsEnabled}
                        setGpsEnabled={setGpsEnabled}
                        handleChange={handleChange}
                        handleDateChange={handleDateChange}
                        handleStartTimeChange={handleStartTimeChange}
                        handleEndTimeChange={handleEndTimeChange}
                        handleAgendaChange={handleAgendaChange}
                        handleLocationSelect={handleLocationSelect}
                        apiLoading={apiLoading}
                        isEditMode={false}
                        isMobile={isMobile}
                      />
                    </Box>
                  </Grow>
                )}

                {activeStep === 1 && (
                  <Grow in timeout={300}>
                    <Box>
                      <AccessControlStep
                        visibility={visibility}
                        setVisibility={setVisibility}
                        restrictedDepartmentId={restrictedDepartmentId}
                        setRestrictedDepartmentId={setRestrictedDepartmentId}
                        setRestrictedDepartmentName={setRestrictedDepartmentName}
                        handleRestrictedDepartmentChange={handleRestrictedDepartmentChange}
                        handleClearRestrictedDepartment={handleClearRestrictedDepartment}
                        apiLoading={apiLoading}
                        isSubmitting={submitting}
                      />
                    </Box>
                  </Grow>
                )}

                {activeStep === 2 && (
                  <Grow in timeout={300}>
                    <Stack spacing={2.5}>
                      <Box>
                        <Typography variant="body2" fontWeight={600} gutterBottom>
                          Add from Participant List
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                          <FormControl fullWidth size="small">
                            <InputLabel id="participant-list-label">
                              Select Participant List
                            </InputLabel>
                            <Select
                              labelId="participant-list-label"
                              value={selectedParticipantList || ''}
                              onChange={(e) => setSelectedParticipantList(e.target.value)}
                              label="Select Participant List"
                            >
                              {participantLists.map((list) => (
                                <MenuItem key={list.id} value={list.id}>
                                  {list.name} ({list.participants?.length || 0})
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            variant="contained"
                            onClick={handleUseParticipantList}
                            disabled={!selectedParticipantList}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            Add List
                          </Button>
                        </Stack>
                      </Box>

                      <Divider />

                      <Box>
                        <Stack
                          direction="row"
                          sx={{
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 1.5,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            Individual Participants
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PersonAdd />}
                            onClick={() => setShowAddParticipantDialog(true)}
                          >
                            Add Participant
                          </Button>
                        </Stack>

                        {meetingParticipants.length === 0 ? (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ textAlign: 'center', py: 3 }}
                          >
                            No participants yet. Add one individually or pull in a list above.
                          </Typography>
                        ) : (
                          <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
                            {meetingParticipants.map((participant) => (
                              <React.Fragment key={participant.id}>
                                <ListItem
                                  secondaryAction={
                                    <IconButton
                                      edge="end"
                                      size="small"
                                      onClick={() => handleRemoveParticipant(participant.id)}
                                      aria-label={`Remove ${participant.name}`}
                                    >
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  }
                                >
                                  <ListItemAvatar>
                                    <Avatar
                                      sx={{
                                        width: 32,
                                        height: 32,
                                        fontSize: 14,
                                        bgcolor: participant.is_chairperson
                                          ? 'primary.main'
                                          : 'success.main',
                                      }}
                                    >
                                      {participant.name?.charAt(0) || 'P'}
                                    </Avatar>
                                  </ListItemAvatar>
                                  <ListItemText
                                    primaryTypographyProps={{ component: 'div' }}
                                    secondaryTypographyProps={{ component: 'div' }}
                                    primary={
                                      <Stack
                                        direction="row"
                                        spacing={1}
                                        sx={{ alignItems: 'center' }}
                                      >
                                        <Typography variant="body2" fontWeight={500}>
                                          {participant.name}
                                        </Typography>
                                        {participant.is_chairperson && (
                                          <Chip label="Chairperson" size="small" color="primary" />
                                        )}
                                      </Stack>
                                    }
                                    secondary={
                                      <Stack
                                        direction="row"
                                        spacing={1.5}
                                        sx={{ flexWrap: 'wrap' }}
                                      >
                                        {participant.email && (
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 0.5,
                                            }}
                                          >
                                            <EmailIcon sx={{ fontSize: 12 }} /> {participant.email}
                                          </Typography>
                                        )}
                                        {participant.telephone && (
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 0.5,
                                            }}
                                          >
                                            <PhoneIcon sx={{ fontSize: 12 }} />{' '}
                                            {participant.telephone}
                                          </Typography>
                                        )}
                                        {participant.title && (
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 0.5,
                                            }}
                                          >
                                            <TitleIcon sx={{ fontSize: 12 }} /> {participant.title}
                                          </Typography>
                                        )}
                                        {participant.organization && (
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 0.5,
                                            }}
                                          >
                                            <WorkIcon sx={{ fontSize: 12 }} />{' '}
                                            {participant.organization}
                                          </Typography>
                                        )}
                                      </Stack>
                                    }
                                  />
                                </ListItem>
                                {!participant.is_chairperson && (
                                  <Button
                                    size="small"
                                    sx={{ ml: 6, mb: 0.5 }}
                                    onClick={() => handleSetChairperson(participant.id)}
                                  >
                                    Make Chairperson
                                  </Button>
                                )}
                                <Divider component="li" />
                              </React.Fragment>
                            ))}
                          </List>
                        )}
                      </Box>
                    </Stack>
                  </Grow>
                )}

                {activeStep === 3 && (
                  <Grow in timeout={300}>
                    <Box>
                      <RecurringMeetingSection
                        recurrence={recurrence}
                        setRecurrence={setRecurrence}
                      />
                    </Box>
                  </Grow>
                )}

                {activeStep === 4 && (
                  <Grow in timeout={300}>
                    <Stack spacing={2}>
                      <Alert severity="info" icon={<CheckCircleIcon />}>
                        Review the details before creating the meeting.
                      </Alert>

                      <Box>
                        <Typography variant="body2" fontWeight={600} color="primary" gutterBottom>
                          Meeting Information
                        </Typography>
                        <Grid container spacing={1.5}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="body2">
                              <strong>Title:</strong> {formData.title}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="body2">
                              <strong>Chairperson:</strong> {chairpersonName}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="body2" color="secondary.main">
                              <strong>Secretary:</strong>{' '}
                              {formData.secretary_name || 'Not selected'}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="body2">
                              <strong>Date &amp; Time:</strong> {formattedDate} at{' '}
                              {formattedStartTime}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="body2">
                              <strong>Platform:</strong>{' '}
                              {formData.platform === 'physical' ? 'In-Person' : formData.platform}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="body2">
                              <strong>Location:</strong>{' '}
                              {formData.location_text || 'Not specified'}
                            </Typography>
                          </Grid>

                          <Grid size={{ xs: 12 }}>
                            <Divider sx={{ my: 1 }} />
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              color="primary"
                              gutterBottom
                            >
                              Access Control
                            </Typography>
                            <Typography variant="body2">
                              <strong>Visibility:</strong>{' '}
                              {isRestricted ? 'Restricted to Department' : 'All Departments'}
                            </Typography>
                            {isRestricted && (
                              <Typography variant="body2">
                                <strong>Department:</strong>{' '}
                                {restrictedDepartmentName || 'None selected'}
                              </Typography>
                            )}
                            {isRestricted && !restrictedDepartmentId && (
                              <Alert severity="warning" sx={{ mt: 1 }}>
                                Visibility is restricted but no department is selected. Go back to
                                Access Control and choose one.
                              </Alert>
                            )}
                          </Grid>

                          {isRecurring && recurrence && (
                            <Grid size={{ xs: 12 }}>
                              <Divider sx={{ my: 1 }} />
                              <Chip
                                icon={<RepeatIcon />}
                                label={`Recurring: ${recurrence.type} (every ${
                                  recurrence.interval
                                } ${
                                  recurrence.type === 'daily'
                                    ? 'day(s)'
                                    : recurrence.type === 'weekly'
                                      ? 'week(s)'
                                      : 'month(s)'
                                })`}
                                color="primary"
                                size="small"
                              />
                            </Grid>
                          )}
                        </Grid>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="body2" fontWeight={600} color="primary" gutterBottom>
                          Participants ({meetingParticipants.length})
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, mt: 1, maxHeight: 140, overflow: 'auto' }}>
                          {meetingParticipants.slice(0, 10).map((p) => (
                            <li key={p.id}>
                              <Typography variant="body2">
                                {p.name} {p.is_chairperson && '(Chairperson)'}
                                {p.name === formData.secretary_name && ' (Secretary)'}
                              </Typography>
                            </li>
                          ))}
                          {meetingParticipants.length > 10 && (
                            <li>
                              <Typography variant="body2">
                                …and {meetingParticipants.length - 10} more
                              </Typography>
                            </li>
                          )}
                        </Box>
                      </Box>

                      <Button
                        variant="contained"
                        size="large"
                        onClick={handleSubmit}
                        startIcon={<Save />}
                        disabled={apiLoading || (isRestricted && !restrictedDepartmentId)}
                        sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
                      >
                        {apiLoading ? (
                          <CircularProgress size={24} />
                        ) : isRecurring ? (
                          'Create Recurring Meeting'
                        ) : (
                          'Create Meeting'
                        )}
                      </Button>
                    </Stack>
                  </Grow>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                  <Button onClick={handleBack} startIcon={<ArrowBackIcon />} disabled={apiLoading}>
                    {activeStep === 0 ? 'Cancel' : 'Back'}
                  </Button>
                  {activeStep < steps.length - 1 && (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<ArrowForwardIcon />}
                      disabled={apiLoading}
                      sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
                    >
                      Next
                    </Button>
                  )}
                </Box>
              </Paper>
            </Grid>

            {isDesktop && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper sx={{ p: 2.5, borderRadius: 3, position: 'sticky', top: 24 }}>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Meeting Summary
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={1.75}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Title
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {formData.title || 'Not set'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Date &amp; Time
                      </Typography>
                      <Typography variant="body2">
                        {formattedDate} · {formattedStartTime}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Platform
                      </Typography>
                      <Typography variant="body2">
                        {formData.platform === 'physical' ? 'In-Person' : formData.platform}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Visibility
                      </Typography>
                      <Typography variant="body2">
                        {isRestricted
                          ? restrictedDepartmentName || 'Restricted (no department)'
                          : 'All Departments'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Participants
                      </Typography>
                      <Typography variant="body2">{meetingParticipants.length} added</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Chairperson
                      </Typography>
                      <Typography variant="body2">{chairpersonName}</Typography>
                    </Box>
                    {isRecurring && recurrence && (
                      <Chip
                        icon={<RepeatIcon />}
                        label={`Recurring · ${recurrence.type}`}
                        color="primary"
                        size="small"
                        sx={{ alignSelf: 'flex-start' }}
                      />
                    )}
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Stack direction="row" spacing={1}>
                    {steps.map((step, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          flex: 1,
                          height: 4,
                          borderRadius: 2,
                          bgcolor: idx <= activeStep ? 'primary.main' : 'divider',
                        }}
                      />
                    ))}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: 'block' }}
                  >
                    Step {activeStep + 1} of {steps.length}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>

        <Dialog
          open={showAddParticipantDialog}
          onClose={() => setShowAddParticipantDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add New Participant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Full Name"
                required
                value={newParticipant.name}
                onChange={handleNewParticipantChange('name')}
                size="small"
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newParticipant.email}
                onChange={handleNewParticipantChange('email')}
                size="small"
              />
              <TextField
                fullWidth
                label="Telephone"
                value={newParticipant.telephone}
                onChange={handleNewParticipantChange('telephone')}
                size="small"
              />
              <TextField
                fullWidth
                label="Title/Position"
                value={newParticipant.title}
                onChange={handleNewParticipantChange('title')}
                size="small"
              />
              <TextField
                fullWidth
                label="Organization"
                value={newParticipant.organization}
                onChange={handleNewParticipantChange('organization')}
                size="small"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddParticipantDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAddCustomParticipant}
              disabled={!newParticipant.name.trim()}
              sx={{ bgcolor: '#7C3AED' }}
            >
              Add Participant
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        >
          <Alert
            severity={snackbar.severity}
            variant="filled"
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateMeeting;