// src/components/actiontracker/meetings/MeetingForm.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, TextField, Stepper, Step, StepLabel,
  Alert, CircularProgress, Snackbar, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  List, ListItem, ListItemText, ListItemAvatar, ListItemButton, ListItemIcon,
  Avatar, Divider, useMediaQuery, useTheme, Card, CardContent, Stack,
  Container, AppBar, Toolbar, InputAdornment, Grid, Switch, CardActionArea,
  ToggleButton, ToggleButtonGroup, Breadcrumbs, LinearProgress, Backdrop,
  Skeleton, Tooltip, FormHelperText, Badge, Collapse, SpeedDial, SpeedDialAction,
  SpeedDialIcon, useScrollTrigger, Fade,
} from '@mui/material';
import {
  Delete as Delete, PersonAdd as PersonAdd, Close as Close,
  Cancel as Cancel, ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon, Event as EventIcon, LocationOn as LocationIcon,
  People as PeopleIcon, Save as Save, MyLocation as MyLocationIcon,
  GpsFixed as GpsFixedIcon, GpsNotFixed as GpsNotFixedIcon,
  ExpandMore as ExpandMoreIcon, EditNote as SecretaryIcon, Search as SearchIcon,
  Apartment as ApartmentIcon, Business as BusinessIcon, Public as PublicIcon,
  Flag as FlagIcon, Terrain as TerrainIcon, Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon, EventSeat as EventSeatIcon,
  ChevronRight as ChevronRightIcon, Phone as PhoneIcon, Email as EmailIcon,
  Work as WorkIcon, Title as TitleIcon, Visibility as VisibilityIcon,
  Update as UpdateIcon, DomainOutlined as StructureIcon, Repeat as RepeatIcon,
  Info as InfoIcon, Preview as PreviewIcon, Today as TodayIcon,
  CalendarToday as CalendarIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addDays, addWeeks, addMonths, addYears, getDaysInMonth, format } from 'date-fns';
import api from '../../../services/api';

// Store imports
import {
  fetchParticipantLists, fetchParticipants, addCustomParticipant,
  removeLocalMeetingParticipant, setMeetingChairperson,
  addParticipantsFromListToMeeting, clearMeetingParticipants,
  selectParticipantLists, selectMeetingParticipantsAll,
  selectMeetingChairperson, selectParticipantsLoading,
  fetchUsers, selectUsers, selectUsersLoading,
} from '../../../store/slices/actionTracker/participantSlice';
import {
  createMeeting, updateMeeting, fetchMeetingById,
  clearMeetingState, clearCurrentMeeting,
} from '../../../store/slices/actionTracker/meetingSlice';

// Constants
import { STORAGE_KEY, ROWS_PER_PAGE_OPTIONS, GENERATION_OPTIONS } from './constants/formConstants';
import { ADDRESS_LEVELS, BUILDING_LEVELS, RECURRENCE_TYPES, WEEK_DAYS, END_OPTIONS, STEPS } from './constants/formConstants';
import { hexAlpha, getLevelInfo, safeScrollToTop, toUuidStr, getRecurrenceLabel, calcPreviewDates } from './utils/formHelpers';

// Components
import { LocationSearch } from './components/LocationSearch';
import { ParticipantItem } from './components/ParticipantItem';
import { RecurrenceSection } from './components/RecurrenceSection';
import { LoadingOverlay } from './components/LoadingOverlay';
import { OrganizationSelector } from './components/OrganizationSelector';

// Custom hooks
const useDebounce = (value, delay = 400) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
};

const useAutoSave = (formData, recurrence, isEditMode, formDirty, saveState) => {
  useEffect(() => {
    if (!isEditMode && formDirty && (formData.title || formData.description || formData.agenda)) {
      const timer = setTimeout(() => saveState(), 3000);
      return () => clearTimeout(timer);
    }
  }, [formData, formDirty, isEditMode, saveState]);
};

const useBeforeUnloadWarning = (formDirty, isEditMode) => {
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (formDirty && !isEditMode) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formDirty, isEditMode]);
};

// Main Component
const MeetingForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isEditMode = Boolean(id);
  const returnPath = location.state?.from || '/meetings';
  const initialLoaded = useRef(false);
  const isMounted = useRef(true);

  // Redux selectors
  const participantLists = useSelector(selectParticipantLists);
  const meetingParticipants = useSelector(selectMeetingParticipantsAll);
  const chairperson = useSelector(selectMeetingChairperson);
  const participantsLoading = useSelector(selectParticipantsLoading);
  const users = useSelector(selectUsers);
  const usersLoading = useSelector(selectUsersLoading);
  const { isLoading: submitting, success, error: meetingError } = useSelector(s => s.meetings);

  // UI State
  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [participantTab, setParticipantTab] = useState('existing');
  const [selectedListId, setSelectedListId] = useState(null);
  const [showGpsDetails, setShowGpsDetails] = useState(false);
  const [formLoading, setFormLoading] = useState(isEditMode);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSupported, setGpsSupported] = useState(true);
  const [formDirty, setFormDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [recurrence, setRecurrence] = useState(null);
  const [attributeMappings, setAttributeMappings] = useState({
    recurrenceTypes: {}, recurrenceDays: {}, recurrenceWeeks: {}, statuses: {},
  });
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const trigger = useScrollTrigger({ threshold: 100 });

  // Organization/Department state
  const [organizationId, setOrganizationId] = useState('');
  const [visibility, setVisibility] = useState('open');
  const [restrictedDepartmentId, setRestrictedDepartmentId] = useState(null);

  // Form Data
  const [formData, setFormData] = useState({
    title: '', description: '', meeting_date: null, start_time: null, end_time: null,
    location_text: '', location_id: null, location_details: null,
    agenda: '', secretary_name: '', gps_latitude: '', gps_longitude: '',
  });

  const [newParticipant, setNewParticipant] = useState({
    name: '', email: '', telephone: '', title: '', organization: '', is_chairperson: false,
  });

  // Derived state
  const apiLoading = submitting || participantsLoading || formLoading || isSubmitting || usersLoading;
  const isRecurring = useMemo(() => recurrence?.enabled === true, [recurrence]);
  const isValid = useMemo(() => !!(formData.title.trim() && formData.meeting_date && formData.start_time && organizationId), [formData, organizationId]);
  const chairName = useMemo(() => chairperson?.name || 'Not selected', [chairperson]);
  const selectedUserIds = useMemo(() => meetingParticipants.filter(p => p.is_existing).map(p => p.id), [meetingParticipants]);
  const selectedParticipantIds = useMemo(() => meetingParticipants.map(p => p.id), [meetingParticipants]);

  // Cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Auto-save and before unload hooks
  const savePageState = useCallback(() => {
    if (!isEditMode) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        step: activeStep,
        formData: {
          title: formData.title,
          description: formData.description,
          meeting_date: formData.meeting_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          location_text: formData.location_text,
          agenda: formData.agenda,
          secretary_name: formData.secretary_name,
        },
        recurrence,
        organizationId,
        visibility,
        restrictedDepartmentId,
        timestamp: Date.now(),
      }));
    }
  }, [isEditMode, activeStep, formData, recurrence, organizationId, visibility, restrictedDepartmentId]);

  const clearSavedState = useCallback(() => sessionStorage.removeItem(STORAGE_KEY), []);

  useAutoSave(formData, recurrence, isEditMode, formDirty, savePageState);
  useBeforeUnloadWarning(formDirty, isEditMode);

  // Fetch attribute mappings
  useEffect(() => {
    const fetchAttributeMappings = async () => {
      try {
        const res = await api.get('/attribute-groups/RECURRING_MEETING/attributes', {
          params: { active_only: true, detail_level: 'limited', sort_by: 'sort_order', sort_order: 'asc', limit: 100 },
        });
        const attrs = res.data?.items || [];
        const typesMap = {}, daysMap = {}, weeksMap = {}, statusMap = {};

        attrs.forEach(attr => {
          const code = attr.code || '';
          const meta = attr.mextra_metadata || {};
          const value = meta?.value;
          const attrId = attr.id;
          if (!value || !attrId) return;

          if (code.includes('RECURRENCE_TYPE_')) typesMap[value] = attrId;
          else if (code.includes('RECURRENCE_DAY_')) daysMap[value] = attrId;
          else if (code.includes('RECURRENCE_WEEK_')) weeksMap[String(value)] = attrId;
          else if (code.includes('RECURRING_STATUS_')) statusMap[value] = attrId;
        });

        if (isMounted.current) {
          setAttributeMappings({ recurrenceTypes: typesMap, recurrenceDays: daysMap, recurrenceWeeks: weeksMap, statuses: statusMap });
        }
      } catch (err) {
        console.error('Failed to fetch attribute mappings:', err);
      }
    };
    fetchAttributeMappings();
  }, []);

  // Fetch meeting for edit mode
  useEffect(() => {
    if (!isEditMode || !id || initialLoaded.current) return;
    setFormLoading(true);
    dispatch(fetchMeetingById(id)).unwrap()
      .then(meeting => {
        if (!meeting || !isMounted.current) return;
        setFormData({
          title: meeting.title || '',
          description: meeting.description || '',
          meeting_date: meeting.meeting_date ? new Date(meeting.meeting_date) : null,
          start_time: meeting.start_time ? new Date(meeting.start_time) : null,
          end_time: meeting.end_time ? new Date(meeting.end_time) : null,
          location_text: meeting.location_text || '',
          location_id: meeting.location_id || null,
          location_details: meeting.location_id ? {
            id: meeting.location_id, name: meeting.location_text,
            code: meeting.location_code, level: meeting.location_level,
            location_mode: meeting.location_mode,
          } : null,
          agenda: meeting.agenda || '',
          secretary_name: meeting.secretary_name || '',
          gps_latitude: meeting.gps_coordinates?.split(',')[0] || '',
          gps_longitude: meeting.gps_coordinates?.split(',')[1] || '',
        });
        if (meeting.gps_coordinates) setGpsEnabled(true);
        setOrganizationId(meeting.organization_id || '');
        setVisibility(meeting.visibility || 'open');
        setRestrictedDepartmentId(meeting.restricted_department_id || null);
        dispatch(clearMeetingParticipants());
        if (meeting.participants?.length) {
          meeting.participants.forEach(p => dispatch(addCustomParticipant({
            ...p, is_chairperson: p.is_chairperson || false,
            id: p.id || `p-${Date.now()}-${Math.random()}`,
          })));
          const chair = meeting.participants.find(p => p.is_chairperson);
          if (chair) setTimeout(() => dispatch(setMeetingChairperson(chair.id)), 150);
        }
        if (meeting.recurrence) setRecurrence(meeting.recurrence);
      })
      .catch(() => {
        if (isMounted.current) setSnackbar({ open: true, message: 'Failed to load meeting', severity: 'error' });
      })
      .finally(() => {
        if (isMounted.current) { setFormLoading(false); initialLoaded.current = true; }
      });
  }, [isEditMode, id, dispatch]);

  // Initialize component
  useEffect(() => {
    if (!isMounted.current) return;
    dispatch(fetchParticipantLists());
    dispatch(fetchUsers({ limit: 100 }));
    if (!navigator.geolocation) {
      setGpsSupported(false);
      setSnackbar({ open: true, message: 'Geolocation is not supported by your browser', severity: 'warning' });
    }
    return () => {
      if (!success) dispatch(clearMeetingParticipants());
      dispatch(clearMeetingState());
      dispatch(clearCurrentMeeting());
    };
  }, [dispatch, success]);

  // Remove secretary if participant removed
  useEffect(() => {
    if (formData.secretary_name && meetingParticipants.length > 0) {
      if (!meetingParticipants.some(p => p.name === formData.secretary_name)) {
        setFormData(prev => ({ ...prev, secretary_name: '' }));
      }
    }
  }, [meetingParticipants, formData.secretary_name]);

  // Handlers
  const handleChange = useCallback(e => { setFormData(p => ({ ...p, [e.target.name]: e.target.value })); setFormDirty(true); }, []);
  const handleDateChange = useCallback(d => { setFormData(p => ({ ...p, meeting_date: d })); setFormDirty(true); }, []);
  const handleStartTime = useCallback(t => { setFormData(p => ({ ...p, start_time: t })); setFormDirty(true); }, []);
  const handleEndTime = useCallback(t => { setFormData(p => ({ ...p, end_time: t })); setFormDirty(true); }, []);
  const handleAgenda = useCallback(e => { setFormData(p => ({ ...p, agenda: e.target.value })); setFormDirty(true); }, []);

  const handleLocationSelect = useCallback(loc => {
    if (loc) {
      setFormData(p => ({
        ...p,
        location_id: loc.id,
        location_text: loc.name,
        location_details: { id: loc.id, name: loc.name, code: loc.code, level: loc.level, location_mode: loc.location_mode },
      }));
    } else {
      setFormData(p => ({ ...p, location_id: null, location_text: '', location_details: null }));
    }
    setFormDirty(true);
  }, []);

  const getCurrentLocation = useCallback(() => {
    if (!gpsSupported) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFormData(p => ({ ...p, gps_latitude: pos.coords.latitude.toFixed(6), gps_longitude: pos.coords.longitude.toFixed(6) }));
        setGpsEnabled(true); setFormDirty(true);
        setSnackbar({ open: true, message: 'Location captured', severity: 'success' });
        setGpsLoading(false);
      },
      err => {
        const msg = err.code === 1 ? 'Permission denied' : err.code === 2 ? 'Position unavailable' : 'Request timed out';
        setSnackbar({ open: true, message: msg, severity: 'error' });
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [gpsSupported]);

  const handleGpsToggle = useCallback(e => {
    const on = e.target.checked;
    setGpsEnabled(on);
    if (!on) setFormData(p => ({ ...p, gps_latitude: '', gps_longitude: '' }));
    else if (gpsSupported && !formData.gps_latitude) getCurrentLocation();
    setFormDirty(true);
  }, [gpsSupported, formData.gps_latitude, getCurrentLocation]);

  const handleAddParticipant = useCallback((participant) => {
    dispatch(addCustomParticipant(participant));
    setFormDirty(true);
    setSnackbar({ open: true, message: `Added ${participant.name} to participants`, severity: 'success' });
    setShowAddDialog(false);
  }, [dispatch]);

  const handleAddFromList = useCallback((participants) => {
    participants.forEach(p => dispatch(addCustomParticipant(p)));
    setFormDirty(true);
    setSnackbar({ open: true, message: `Added ${participants.length} participants from list`, severity: 'success' });
    setShowAddDialog(false);
  }, [dispatch]);

  const handleSetChairperson = useCallback(pid => {
    dispatch(setMeetingChairperson(pid)); setFormDirty(true);
    setSnackbar({ open: true, message: 'Chairperson updated', severity: 'info' });
  }, [dispatch]);

  const handleRemoveParticipant = useCallback(pid => {
    dispatch(removeLocalMeetingParticipant(pid)); setFormDirty(true);
    setSnackbar({ open: true, message: 'Participant removed', severity: 'info' });
  }, [dispatch]);

  const handleNext = useCallback(() => {
    if (activeStep === 0 && !isValid) {
      setSnackbar({ open: true, message: 'Please fill in all required fields (Title, Date, Time, and Organization)', severity: 'warning' });
      return;
    }
    setActiveStep(p => p + 1);
    safeScrollToTop();
  }, [activeStep, isValid]);

  const handleBack = useCallback(() => {
    if (activeStep === 0) navigate(returnPath);
    else setActiveStep(p => p - 1);
    safeScrollToTop();
  }, [activeStep, navigate, returnPath]);

  const handleCancel = useCallback(() => {
    if (formDirty && !window.confirm('You have unsaved changes. Save draft and leave?')) return;
    savePageState();
    dispatch(clearMeetingParticipants());
    navigate(returnPath);
  }, [formDirty, navigate, returnPath, dispatch, savePageState]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      setSnackbar({ open: true, message: 'Please fill in all required fields (Title, Date, Time, and Organization)', severity: 'warning' });
      setActiveStep(0);
      safeScrollToTop();
      return;
    }

    if (visibility === 'department' && !restrictedDepartmentId) {
      setSnackbar({ open: true, message: 'Please select a department for restricted meeting access', severity: 'warning' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(isEditMode ? 'Updating meeting…' : isRecurring ? 'Creating recurring meeting…' : 'Creating meeting…');

    try {
      const meetingDate = formData.meeting_date;
      const startDT = new Date(meetingDate);
      startDT.setHours(formData.start_time.getHours(), formData.start_time.getMinutes());
      let endDT = null;
      if (formData.end_time) {
        endDT = new Date(meetingDate);
        endDT.setHours(formData.end_time.getHours(), formData.end_time.getMinutes());
      }

      const chairP = meetingParticipants.find(p => p.is_chairperson);
      const basePayload = {
        title: formData.title,
        description: formData.description || null,
        meeting_date: startDT.toISOString(),
        start_time: startDT.toISOString(),
        end_time: endDT?.toISOString() || null,
        location_text: formData.location_text || null,
        location_id: formData.location_id || null,
        gps_coordinates: gpsEnabled && formData.gps_latitude && formData.gps_longitude
          ? `${formData.gps_latitude},${formData.gps_longitude}` : null,
        agenda: formData.agenda || null,
        secretary_name: formData.secretary_name || null,
        chairperson_name: chairP?.name || null,
        organization_id: organizationId,
        visibility: visibility,
        restricted_department_id: visibility === 'department' ? restrictedDepartmentId : null,
        custom_participants: meetingParticipants.map(p => ({
          id: p.is_existing ? p.id : undefined,
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
        const recurrenceTypeId = attributeMappings.recurrenceTypes[recurrence.type];
        const recurrenceDayIds = (recurrence.days || []).map(d => attributeMappings.recurrenceDays[d]).filter(Boolean);
        const statusId = attributeMappings.statuses.active;

        if (!recurrenceTypeId) throw new Error(`Recurrence type "${recurrence.type}" not configured`);
        if ((recurrence.type === 'weekly' || recurrence.type === 'biweekly') && (!recurrence.days || recurrence.days.length === 0)) {
          throw new Error('Please select at least one day for weekly recurrence');
        }

        const recurringPayload = {
          ...basePayload,
          recurrence_type_id: recurrenceTypeId,
          recurrence_interval: recurrence.interval || 1,
          recurrence_days: recurrenceDayIds,
          recurrence_day_of_month: recurrence.day_of_month === 'last' ? -1 : (recurrence.day_of_month || null),
          recurrence_end_date: recurrence.end_date ? new Date(recurrence.end_date).toISOString() : null,
          recurrence_max_occurrences: recurrence.max_occurrences || null,
          status_id: statusId,
        };

        await api.post('/recurring-meetings/', recurringPayload);
        setSnackbar({ open: true, message: 'Recurring meeting created successfully!', severity: 'success' });
      } else if (isEditMode) {
        await dispatch(updateMeeting({ id, data: basePayload })).unwrap();
        setSnackbar({ open: true, message: 'Meeting updated successfully!', severity: 'success' });
      } else {
        await dispatch(createMeeting(basePayload)).unwrap();
        setSnackbar({ open: true, message: 'Meeting created successfully!', severity: 'success' });
      }

      clearSavedState();
      dispatch(clearMeetingParticipants());
      setTimeout(() => {
        setIsSubmitting(false);
        navigate(returnPath, { replace: true });
      }, 1500);

    } catch (err) {
      console.error('Submit error:', err);
      let errorMessage = err.response?.data?.detail || err.message || `Failed to ${isEditMode ? 'update' : 'create'} meeting.`;
      if (Array.isArray(err.response?.data?.detail)) {
        errorMessage = err.response.data.detail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join(', ');
      }
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      setIsSubmitting(false);
      setSubmitMessage('');
    }
  }, [formData, gpsEnabled, meetingParticipants, isEditMode, id, dispatch, isValid, navigate,
      returnPath, isRecurring, recurrence, attributeMappings, organizationId, visibility,
      restrictedDepartmentId, clearSavedState]);

  // Loading state
  if (formLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={56} />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <LoadingOverlay open={isSubmitting} message={submitMessage} />

      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 10, sm: 4 } }}>

        {/* Mobile App Bar */}
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={handleCancel}><ArrowBackIcon /></IconButton>
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>
                {isEditMode ? 'Edit Meeting' : 'New Meeting'}
              </Typography>
              <IconButton edge="end" onClick={handleCancel}><Close /></IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>

          {/* Desktop Header */}
          

          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 2, md: 3 } }}>

            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 4, display: isMobile ? 'none' : 'flex' }}>
              {STEPS.map((step, i) => (
                <Step key={i}>
                  <StepLabel>
                    <Typography variant="body2" fontWeight={600}>{step.label}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{step.description}</Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Step 0: Meeting Details */}
            {activeStep === 0 && (
              <Stack spacing={2.5}>
                <OrganizationSelector
                  value={organizationId}
                  onChange={setOrganizationId}
                  disabled={apiLoading || isEditMode}
                />

                <TextField
                  fullWidth required label="Meeting Title" name="title"
                  value={formData.title} onChange={handleChange} disabled={apiLoading}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><EventIcon color="action" /></InputAdornment> } }}
                />

                <TextField
                  fullWidth label="Description" name="description" multiline rows={isMobile ? 2 : 3}
                  value={formData.description} onChange={handleChange} disabled={apiLoading}
                />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker label="Meeting Date *" value={formData.meeting_date} onChange={handleDateChange}
                      slotProps={{ textField: { fullWidth: true, required: true } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TimePicker label="Start Time *" value={formData.start_time} onChange={handleStartTime}
                      slotProps={{ textField: { fullWidth: true, required: true } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TimePicker label="End Time" value={formData.end_time} onChange={handleEndTime}
                      slotProps={{ textField: { fullWidth: true } }} />
                  </Grid>
                </Grid>

                {/* Access & Visibility Card */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Access & Visibility
                    </Typography>
                    
                    <FormControl fullWidth>
                      <InputLabel>Meeting Visibility</InputLabel>
                      <Select
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value)}
                        label="Meeting Visibility"
                        disabled={apiLoading}
                      >
                        <MenuItem value="open">Open to All</MenuItem>
                        <MenuItem value="department">Department Only</MenuItem>
                      </Select>
                      <FormHelperText>
                        {visibility === 'open'
                          ? "Anyone can view and join this meeting"
                          : "Only members of the selected department can access this meeting"}
                      </FormHelperText>
                    </FormControl>

                    <Collapse in={visibility === 'department'} sx={{ mt: 2 }}>
                      <OrganizationSelector
                        value={restrictedDepartmentId}
                        onChange={setRestrictedDepartmentId}
                        disabled={apiLoading}
                      />
                    </Collapse>
                  </CardContent>
                </Card>

                <LocationSearch value={formData.location_details} onChange={handleLocationSelect} onClear={() => handleLocationSelect(null)} />

                {/* GPS Section */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardActionArea onClick={() => setShowGpsDetails(p => !p)}>
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {gpsEnabled ? <GpsFixedIcon color="success" /> : <GpsNotFixedIcon color="disabled" />}
                        <Typography variant="subtitle1" fontWeight={600}>GPS Coordinates (optional)</Typography>
                      </Stack>
                      <Switch checked={gpsEnabled} onChange={handleGpsToggle} onClick={e => e.stopPropagation()} />
                    </Box>
                  </CardActionArea>
                  <Collapse in={showGpsDetails && gpsEnabled}>
                    <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                      <Stack spacing={1.5}>
                        <Button size="small" variant="contained" startIcon={<MyLocationIcon />}
                          onClick={getCurrentLocation} disabled={gpsLoading}>
                          {gpsLoading ? <CircularProgress size={18} /> : 'Get current location'}
                        </Button>
                        <Grid container spacing={1.5}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField fullWidth size="small" label="Latitude" value={formData.gps_latitude}
                              onChange={e => setFormData(p => ({ ...p, gps_latitude: e.target.value }))} placeholder="e.g. 0.3136" />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField fullWidth size="small" label="Longitude" value={formData.gps_longitude}
                              onChange={e => setFormData(p => ({ ...p, gps_longitude: e.target.value }))} placeholder="e.g. 32.5811" />
                          </Grid>
                        </Grid>
                      </Stack>
                    </Box>
                  </Collapse>
                </Card>

                {/* Agenda */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>Agenda</Typography>
                  <TextField fullWidth multiline rows={6} name="agenda" value={formData.agenda}
                    onChange={handleAgenda} disabled={apiLoading} placeholder="Enter meeting agenda…"
                    helperText="List the agenda items for this meeting" />
                </Box>
              </Stack>
            )}

            {/* Step 1: Participants */}
            {activeStep === 1 && (
              <Stack spacing={3}>
                {/* Participant List Selection */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>Add from participant list</Typography>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Select list</InputLabel>
                      <Select value={selectedListId || ''} onChange={e => setSelectedListId(e.target.value)} label="Select list" disabled={apiLoading}>
                        {participantLists.map(l => <MenuItem key={l.id} value={l.id}>{l.name} ({l.participants?.length || 0})</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Button fullWidth variant="contained" onClick={() => {
                      const list = participantLists.find(l => l.id === selectedListId);
                      if (list?.participants) {
                        handleAddFromList(list.participants.map(p => ({
                          ...p, is_chairperson: false, from_list: true, list_id: list.id
                        })));
                      }
                      setSelectedListId(null);
                    }} disabled={!selectedListId || apiLoading}>
                      Add selected list
                    </Button>
                  </CardContent>
                </Card>

                {/* Participants List */}
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        Participants ({meetingParticipants.length})
                      </Typography>
                      <Button variant="outlined" startIcon={<PersonAdd />} onClick={() => setShowAddDialog(true)} disabled={apiLoading}>
                        Add participant
                      </Button>
                    </Box>
                    {meetingParticipants.length === 0 ? (
                      <Alert severity="info" variant="outlined">No participants added yet. Use the options above to add participants.</Alert>
                    ) : (
                      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                        {meetingParticipants.map(p => (
                          <React.Fragment key={p.id}>
                            <ParticipantItem
                              participant={p}
                              onRemove={handleRemoveParticipant}
                              onMakeChairperson={handleSetChairperson}
                              isChairperson={p.is_chairperson}
                              isSecretary={p.name === formData.secretary_name}
                              showActions={!apiLoading}
                            />
                            <Divider component="li" />
                          </React.Fragment>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>

                {/* Secretary Selection */}
                <Card variant="outlined" sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                      <SecretaryIcon color="secondary" />
                      <Typography variant="subtitle1" fontWeight={700}>Designate secretary</Typography>
                    </Stack>
                    <FormControl fullWidth>
                      <InputLabel>Select secretary from participants</InputLabel>
                      <Select name="secretary_name" value={formData.secretary_name} onChange={handleChange}
                        label="Select secretary from participants" disabled={apiLoading || meetingParticipants.length === 0}>
                        <MenuItem value=""><em>None selected</em></MenuItem>
                        {meetingParticipants.map(p => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Step 2: Recurrence */}
            {activeStep === 2 && (
              <RecurrenceSection recurrence={recurrence} setRecurrence={setRecurrence} startDate={formData.start_time} />
            )}

            {/* Step 3: Review & Submit */}
            {activeStep === 3 && (
              <Stack spacing={2}>
                <Alert severity="info" icon={<CheckCircleIcon />}>
                  {isEditMode ? 'Review and confirm your changes before updating.' : 'Review all details before creating the meeting.'}
                </Alert>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="primary" gutterBottom fontWeight={700}>Meeting Information</Typography>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2"><strong>Title:</strong> {formData.title}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2"><strong>Chairperson:</strong> {chairName}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2" color="secondary.main"><strong>Secretary:</strong> {formData.secretary_name || 'Not selected'}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2"><strong>Location:</strong> {formData.location_text || 'Not specified'}</Typography></Grid>
                      {formData.location_details && (
                        <Grid size={{ xs: 12 }}><Typography variant="body2"><strong>Location Type:</strong> {formData.location_details.location_mode} – Level {formData.location_details.level}</Typography></Grid>
                      )}
                      {formData.meeting_date && formData.start_time && (
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="body2">
                            <strong>Date & Time:</strong> {formData.meeting_date?.toLocaleDateString()} at {formData.start_time?.toLocaleTimeString()}
                            {formData.end_time && ` – ${formData.end_time?.toLocaleTimeString()}`}
                          </Typography>
                        </Grid>
                      )}
                      {gpsEnabled && formData.gps_latitude && formData.gps_longitude && (
                        <Grid size={{ xs: 12 }}><Typography variant="body2"><strong>GPS:</strong> {formData.gps_latitude}, {formData.gps_longitude}</Typography></Grid>
                      )}
                      <Grid size={{ xs: 12 }}><Typography variant="body2"><strong>Visibility:</strong> {visibility === 'open' ? 'Open to All' : 'Restricted to Department'}</Typography></Grid>
                      {isRecurring && recurrence && (
                        <Grid size={{ xs: 12 }}>
                          <Chip icon={<RepeatIcon />} label={getRecurrenceLabel(recurrence) || 'Recurring'} color="primary" size="medium" />
                          {recurrence.days && recurrence.days.length > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                              On: {recurrence.days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                            </Typography>
                          )}
                        </Grid>
                      )}
                    </Grid>

                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom fontWeight={700}>Agenda Preview</Typography>
                    <Box sx={{ maxHeight: 200, overflow: 'auto', fontSize: '0.875rem', p: 1, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap' }}>
                      {formData.agenda || 'No agenda provided'}
                    </Box>

                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom fontWeight={700}>Participants ({meetingParticipants.length})</Typography>
                    <Box component="ul" sx={{ pl: 2, mt: 1, maxHeight: 150, overflow: 'auto' }}>
                      {meetingParticipants.slice(0, 10).map(p => (
                        <li key={p.id}>
                          <Typography variant="body2">
                            {p.name}
                            {p.is_chairperson && ' (Chairperson)'}
                            {p.name === formData.secretary_name && ' (Secretary)'}
                          </Typography>
                        </li>
                      ))}
                      {meetingParticipants.length > 10 && (
                        <li><Typography variant="body2">…and {meetingParticipants.length - 10} more</Typography></li>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSubmit}
                  startIcon={isEditMode ? <UpdateIcon /> : <Save />}
                  disabled={apiLoading}
                  sx={{ py: 1.5 }}
                >
                  {apiLoading ? <CircularProgress size={24} /> : (isEditMode ? 'Update Meeting' : (isRecurring ? 'Create Recurring Meeting' : 'Create Meeting'))}
                </Button>
              </Stack>
            )}

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button onClick={handleBack} startIcon={<ArrowBackIcon />} disabled={apiLoading}>
                {activeStep === 0 ? 'Cancel' : 'Back'}
              </Button>
              {activeStep < 3 && (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  endIcon={<ArrowForwardIcon />}
                  disabled={apiLoading || (activeStep === 0 && !isValid)}
                >
                  Next
                </Button>
              )}
            </Box>
          </Paper>
        </Container>

        {/* Speed Dial for Mobile */}
        <Fade in={trigger}>
          <SpeedDial
            ariaLabel="Quick Actions"
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
            icon={<SpeedDialIcon />}
            onClose={() => setSpeedDialOpen(false)}
            onOpen={() => setSpeedDialOpen(true)}
            open={speedDialOpen}
          >
            <SpeedDialAction icon={<Save />} tooltipTitle="Save Draft" onClick={savePageState} />
            <SpeedDialAction icon={<RefreshIcon />} tooltipTitle="Reset" onClick={() => {
              if (window.confirm('Reset all form fields?')) {
                setFormData({
                  title: '', description: '', meeting_date: null, start_time: null, end_time: null,
                  location_text: '', location_id: null, location_details: null,
                  agenda: '', secretary_name: '', gps_latitude: '', gps_longitude: '',
                });
                setRecurrence(null);
                setFormDirty(true);
              }
            }} />
          </SpeedDial>
        </Fade>

        {/* Add Participant Dialog */}
        <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Participant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth required label="Full name" value={newParticipant.name}
                onChange={e => setNewParticipant(p => ({ ...p, name: e.target.value }))} size="small" autoFocus />
              <TextField fullWidth label="Email" type="email" value={newParticipant.email}
                onChange={e => setNewParticipant(p => ({ ...p, email: e.target.value }))} size="small" />
              <TextField fullWidth label="Telephone" value={newParticipant.telephone}
                onChange={e => setNewParticipant(p => ({ ...p, telephone: e.target.value }))} size="small" />
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="Title" value={newParticipant.title}
                    onChange={e => setNewParticipant(p => ({ ...p, title: e.target.value }))} size="small" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="Organization" value={newParticipant.organization}
                    onChange={e => setNewParticipant(p => ({ ...p, organization: e.target.value }))} size="small" />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={() => {
              handleAddParticipant({
                ...newParticipant,
                id: `manual-${Date.now()}-${Math.random()}`,
                is_chairperson: false,
                is_manual: true
              });
              setNewParticipant({ name: '', email: '', telephone: '', title: '', organization: '', is_chairperson: false });
            }} disabled={!newParticipant.name.trim()}>
              Add Participant
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar Notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar(p => ({ ...p, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        >
          <Alert severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}
            onClose={() => setSnackbar(p => ({ ...p, open: false }))}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default React.memo(MeetingForm);