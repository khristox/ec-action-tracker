// src/components/meetings/MeetingForm/useMeetingForm.js
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../../../services/api';
import {
  fetchParticipantLists,
  addCustomParticipant,
  removeLocalMeetingParticipant,
  setMeetingChairperson,
  clearMeetingParticipants,
  selectMeetingParticipantsAll,
  selectMeetingChairperson,
  selectParticipantsLoading,
} from '../../../../store/slices/actionTracker/participantSlice';
import {
  createMeeting,
  updateMeeting,
  fetchMeetingById,
  clearMeetingState,
  clearCurrentMeeting
} from '../../../../store/slices/actionTracker/meetingSlice';

// ============================================================================
// Constants
// ============================================================================

export const VISIBILITY = {
  DEPARTMENT: 'department',
  OPEN: 'open',
};

export const DEFAULT_VISIBILITY = VISIBILITY.DEPARTMENT;

// Default times for new meetings
const DEFAULT_START_TIME = new Date();
DEFAULT_START_TIME.setHours(9, 0, 0, 0);

const DEFAULT_END_TIME = new Date();
DEFAULT_END_TIME.setHours(10, 0, 0, 0);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get error message from API error response
 */
const getErrorMessage = (error) => {
  if (error.response?.data?.detail) {
    if (Array.isArray(error.response.data.detail)) {
      return error.response.data.detail[0]?.msg || error.response.data.detail.join(', ');
    }
    return error.response.data.detail;
  }
  return error.message || 'An unexpected error occurred';
};

/**
 * Safe date parsing - handles string, Date, and ISO formats
 */
const safeParseDate = (date) => {
  if (!date) return null;
  
  // Already a valid Date
  if (date instanceof Date && !isNaN(date.getTime())) {
    return date;
  }
  
  // ISO string or date string
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  console.warn('Invalid date:', date);
  return null;
};

/**
 * Format Date for API (YYYY-MM-DDTHH:mm:ss ISO format)
 */
const formatDateForAPI = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

/**
 * Format date for display (YYYY-MM-DD)
 */
const formatDateForDisplay = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Build clean payload - only include necessary fields
 */
const buildCleanPayload = (data) => {
  const payload = {};
  const allowedFields = {
    title: 'string',
    description: 'string',
    meeting_date: 'string',
    start_time: 'string',
    end_time: 'string',
    location_text: 'string',
    location_id: 'number',
    gps_coordinates: 'string',
    agenda: 'string',
    secretary_name: 'string',
    chairperson_name: 'string',
    organization_id: 'number',
    visibility: 'string',
    restricted_department_id: 'number',
    custom_participants: 'array',
  };

  Object.entries(data).forEach(([key, value]) => {
    if (key in allowedFields && value !== null && value !== undefined && value !== '') {
      payload[key] = value;
    }
  });

  return payload;
};

// ============================================================================
// Main Hook
// ============================================================================

export const useMeetingForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const dispatch = useDispatch();
  
  const isEditMode = Boolean(id);
  const returnPath = location.state?.from || '/meetings';

  // ==========================================================================
  // Refs
  // ==========================================================================
  
  const isMounted = useRef(true);
  const meetingLoadedRef = useRef(false);

  // ==========================================================================
  // Redux Selectors
  // ==========================================================================
  
  const meetingParticipants = useSelector(selectMeetingParticipantsAll);
  const chairperson = useSelector(selectMeetingChairperson);
  const participantsLoading = useSelector(selectParticipantsLoading);
  const { isLoading: submitting, success } = useSelector(state => state.meetings);

  // ==========================================================================
  // Local State
  // ==========================================================================
  
  // Form navigation
  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: '', 
    severity: 'success' 
  });
  
  // Loading states
  const [formLoading, setFormLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [mappingsLoading, setMappingsLoading] = useState(true);
  const [formDirty, setFormDirty] = useState(false);

  // Form data - times stored as Date objects internally
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: null,
    start_time: new Date(DEFAULT_START_TIME),
    end_time: new Date(DEFAULT_END_TIME),
    location_text: '',
    location_id: null,
    location_details: null,
    agenda: '',
    secretary_name: '',
    gps_latitude: '',
    gps_longitude: '',
  });

  // Recurrence state
  const [recurrence, setRecurrence] = useState(null);
  const [attributeMappings, setAttributeMappings] = useState({
    recurrenceTypes: {},
    recurrenceDays: {},
    recurrenceWeeks: {},
    statuses: {}
  });

  // Visibility & department
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  const [restrictedDepartmentId, setRestrictedDepartmentId] = useState(null);
  const [restrictedDepartmentName, setRestrictedDepartmentName] = useState('');
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);

  // ==========================================================================
  // Computed Values
  // ==========================================================================
  
  const apiLoading = submitting || participantsLoading || formLoading || isSubmitting || mappingsLoading;
  
  const chairpersonName = useMemo(
    () => chairperson?.name || 'Not selected',
    [chairperson]
  );
  
  const pageTitle = isEditMode ? 'Edit Meeting' : 'Create New Meeting';
  const pageSubtitle = isEditMode 
    ? 'Update meeting details' 
    : 'Fill in the details to schedule a new meeting';
  
  const isRecurring = useMemo(() => recurrence?.enabled === true, [recurrence]);
  
  const isValid = useMemo(() => {
    return !!(
      formData.title?.trim() && 
      formData.meeting_date && 
      formData.start_time && 
      formData.end_time
    );
  }, [formData.title, formData.meeting_date, formData.start_time, formData.end_time]);

  const selectedUserIds = useMemo(
    () => meetingParticipants.filter(p => p.is_existing).map(p => p.id),
    [meetingParticipants]
  );

  const selectedParticipantIds = useMemo(
    () => meetingParticipants.map(p => p.id),
    [meetingParticipants]
  );

  // ==========================================================================
  // Department Helpers
  // ==========================================================================

  const fetchUserDepartments = useCallback(async () => {
    try {
      const response = await api.get('/auth/me/departments', {
        params: { limit: 100, active_only: true }
      });

      let departmentsData = [];
      if (response.data?.success === true && Array.isArray(response.data.data)) {
        departmentsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        departmentsData = response.data;
      } else if (response.data?.items) {
        departmentsData = response.data.items;
      }

      const transformed = departmentsData.map(dept => ({
        id: dept.department_id || dept.id,
        name: dept.department_name || dept.name,
        code: dept.code || dept.department_code || '',
        role: dept.role || 'member'
      }));

      if (isMounted.current) {
        setDepartmentsList(transformed);
      }
      return transformed;
    } catch (error) {
      console.error('Error fetching departments:', error);
      return [];
    }
  }, []);

  const getDepartmentNameById = useCallback((deptId) => {
    if (!deptId) return '';
    const dept = departmentsList.find(d => d.id === deptId);
    return dept?.name || String(deptId);
  }, [departmentsList]);

  const handleRestrictedDepartmentChange = useCallback((deptId) => {
    setRestrictedDepartmentId(deptId);
    const name = getDepartmentNameById(deptId);
    setRestrictedDepartmentName(name);
    setFormDirty(true);
  }, [getDepartmentNameById]);

  const handleClearRestrictedDepartment = useCallback(() => {
    setRestrictedDepartmentId(null);
    setRestrictedDepartmentName('');
    setVisibility(VISIBILITY.OPEN);
    setFormDirty(true);
  }, []);

  // ==========================================================================
  // Lifecycle - Initialize
  // ==========================================================================

  useEffect(() => {
    isMounted.current = true;
    fetchUserDepartments();
    return () => {
      isMounted.current = false;
    };
  }, [fetchUserDepartments]);

  // Load attribute mappings for recurrence
  useEffect(() => {
    const loadMappings = async () => {
      try {
        const response = await api.get('/attribute-groups/RECURRING_MEETING/attributes', {
          params: { active_only: true, detail_level: 'full', sort_by: 'sort_order', limit: 100 }
        });

        const allAttributes = response.data?.items || [];
        const typesMap = {};
        const daysMap = {};
        const weeksMap = {};
        const statusMap = {};

        allAttributes.forEach(attr => {
          const code = attr.code;
          const metadata = attr.mextra_metadata || {};
          const value = metadata?.value;
          if (!value) return;

          if (code?.includes('RECURRENCE_TYPE_')) typesMap[value] = attr.id;
          else if (code?.includes('RECURRENCE_DAY_')) daysMap[value] = attr.id;
          else if (code?.includes('RECURRENCE_WEEK_')) weeksMap[String(value)] = attr.id;
          else if (code?.includes('RECURRING_STATUS_')) statusMap[value] = attr.id;
        });

        if (isMounted.current) {
          setAttributeMappings({
            recurrenceTypes: typesMap,
            recurrenceDays: daysMap,
            recurrenceWeeks: weeksMap,
            statuses: statusMap
          });
        }
      } catch (error) {
        console.error('Error loading attribute mappings:', error);
      } finally {
        if (isMounted.current) setMappingsLoading(false);
      }
    };

    loadMappings();
  }, []);

  // Load existing meeting when editing
  useEffect(() => {
    if (!isEditMode || !id || meetingLoadedRef.current) return;

    setFormLoading(true);
    meetingLoadedRef.current = true;

    dispatch(fetchMeetingById(id))
      .unwrap()
      .then(async (meeting) => {
        if (!isMounted.current || !meeting) return;

        console.log('📥 Loading meeting:', meeting);

        // Parse dates and times
        const meetingDate = safeParseDate(meeting.meeting_date);
        const startTime = safeParseDate(meeting.start_time);
        const endTime = safeParseDate(meeting.end_time);

        // Update form data
        setFormData({
          title: meeting.title || '',
          description: meeting.description || '',
          meeting_date: meetingDate,
          start_time: startTime || new Date(DEFAULT_START_TIME),
          end_time: endTime || new Date(DEFAULT_END_TIME),
          location_text: meeting.location_text || '',
          location_id: meeting.location_id || null,
          location_details: meeting.location_id ? {
            id: meeting.location_id,
            name: meeting.location_text,
            code: meeting.location_code,
            level: meeting.location_level,
            location_mode: meeting.location_mode
          } : null,
          agenda: meeting.agenda || '',
          secretary_name: meeting.secretary_name || '',
          gps_latitude: meeting.gps_coordinates?.split(',')[0] || '',
          gps_longitude: meeting.gps_coordinates?.split(',')[1] || '',
        });

        // Set GPS enabled if coordinates exist
        if (meeting.gps_coordinates) setGpsEnabled(true);

        // Set visibility
        setVisibility(meeting.visibility || DEFAULT_VISIBILITY);

        // Set department
        const deptId = meeting.restricted_department_id || null;
        setRestrictedDepartmentId(deptId);
        if (deptId) {
          const depts = await fetchUserDepartments();
          const dept = depts.find(d => d.id === deptId);
          setRestrictedDepartmentName(dept?.name || String(deptId));
        }

        // ✅ FIX: Load recurrence if meeting is recurring
        if (meeting.recurrence) {
          console.log('📋 Recurrence found:', meeting.recurrence);
          setRecurrence({
            enabled: true,
            type: meeting.recurrence.type || meeting.recurrence.recurrence_type,
            interval: meeting.recurrence.interval || meeting.recurrence.recurrence_interval || 1,
            days: meeting.recurrence.days || meeting.recurrence.recurrence_days || [],
            day_of_month: meeting.recurrence.day_of_month || meeting.recurrence.recurrence_day_of_month || null,
            end_date: meeting.recurrence.end_date || meeting.recurrence.recurrence_end_date 
              ? safeParseDate(meeting.recurrence.end_date || meeting.recurrence.recurrence_end_date)
              : null,
            max_occurrences: meeting.recurrence.max_occurrences || meeting.recurrence.recurrence_max_occurrences || null,
          });
        } else {
          console.log('📋 Regular meeting (no recurrence)');
          setRecurrence(null);
        }

        // Load participants
        dispatch(clearMeetingParticipants());
        if (meeting.participants?.length > 0) {
          console.log('👥 Loading participants:', meeting.participants.length);
          meeting.participants.forEach(p => {
            dispatch(addCustomParticipant({
              ...p,
              is_chairperson: p.is_chairperson || false,
              is_existing: true,
              id: p.id
            }));
          });

          // Set chairperson if exists
          const chair = meeting.participants.find(p => p.is_chairperson);
          if (chair) {
            setTimeout(() => dispatch(setMeetingChairperson(chair.id)), 150);
          }
        }

        if (isMounted.current) setFormLoading(false);
      })
      .catch((error) => {
        console.error('❌ Error loading meeting:', error);
        if (isMounted.current) {
          setSnackbar({
            open: true,
            message: getErrorMessage(error),
            severity: 'error'
          });
          setFormLoading(false);
        }
      });
  }, [isEditMode, id, dispatch, fetchUserDepartments]);

  // Initialize participant lists on mount
  useEffect(() => {
    dispatch(fetchParticipantLists());
    return () => {
      if (!success) dispatch(clearMeetingParticipants());
      dispatch(clearMeetingState());
      dispatch(clearCurrentMeeting());
    };
  }, [dispatch, success]);

  // ==========================================================================
  // Form Handlers
  // ==========================================================================

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormDirty(true);
  }, []);

  const handleDateChange = useCallback((date) => {
    const parsed = safeParseDate(date);
    setFormData(prev => ({ ...prev, meeting_date: parsed }));
    setFormDirty(true);
  }, []);

  const handleStartTimeChange = useCallback((time) => {
    const parsed = safeParseDate(time);
    if (parsed) {
      setFormData(prev => ({ ...prev, start_time: parsed }));
      setFormDirty(true);
    }
  }, []);

  const handleEndTimeChange = useCallback((time) => {
    const parsed = safeParseDate(time);
    if (parsed) {
      setFormData(prev => ({ ...prev, end_time: parsed }));
      setFormDirty(true);
    }
  }, []);

  const handleAgendaChange = useCallback((content) => {
    setFormData(prev => ({ ...prev, agenda: content }));
    setFormDirty(true);
  }, []);

  const handleLocationSelect = useCallback((loc) => {
    if (loc) {
      setFormData(prev => ({
        ...prev,
        location_id: loc.id,
        location_text: loc.name,
        location_details: {
          id: loc.id,
          name: loc.name,
          code: loc.code,
          level: loc.level,
          location_mode: loc.location_mode
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        location_id: null,
        location_text: '',
        location_details: null
      }));
    }
    setFormDirty(true);
  }, []);

  // ==========================================================================
  // Participant Handlers
  // ==========================================================================

  const handleAddExistingUser = useCallback((user) => {
    dispatch(addCustomParticipant({
      ...user,
      id: user.id,
      is_chairperson: false,
      is_existing: true
    }));
    setFormDirty(true);
    setSnackbar({
      open: true,
      message: `Added ${user.name} to participants`,
      severity: 'success'
    });
  }, [dispatch]);

  const handleAddManualParticipant = useCallback((participant) => {
    dispatch(addCustomParticipant(participant));
    setFormDirty(true);
    setSnackbar({
      open: true,
      message: `Added ${participant.name} to participants`,
      severity: 'success'
    });
  }, [dispatch]);

  const handleAddFromList = useCallback((participants) => {
    participants.forEach(p => dispatch(addCustomParticipant(p)));
    setFormDirty(true);
    setSnackbar({
      open: true,
      message: `Added ${participants.length} participants from list`,
      severity: 'success'
    });
  }, [dispatch]);

  const handleSetChairperson = useCallback((pid) => {
    dispatch(setMeetingChairperson(pid));
    setFormDirty(true);
  }, [dispatch]);

  const handleRemoveParticipant = useCallback((pid) => {
    dispatch(removeLocalMeetingParticipant(pid));
    setFormDirty(true);
  }, [dispatch]);

  // ==========================================================================
  // Navigation Handlers
  // ==========================================================================

  const handleNext = useCallback(() => {
    if (activeStep === 0 && !isValid) {
      setSnackbar({
        open: true,
        message: 'Please fill in all required fields (Title, Date, Start & End Time)',
        severity: 'warning'
      });
      return;
    }
    setActiveStep(prev => Math.min(prev + 1, 6)); // 7 steps (0-6)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeStep, isValid]);

  const handleBack = useCallback(() => {
    if (activeStep === 0) {
      navigate(returnPath);
    } else {
      setActiveStep(prev => Math.max(prev - 1, 0));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeStep, navigate, returnPath]);

  const handleCancel = useCallback(() => {
    if (formDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        dispatch(clearMeetingParticipants());
        navigate(returnPath);
      }
    } else {
      dispatch(clearMeetingParticipants());
      navigate(returnPath);
    }
  }, [formDirty, navigate, returnPath, dispatch]);

  // ==========================================================================
  // Submission Logic
  // ==========================================================================

  const buildMeetingPayload = useCallback(() => {
    const chairpersonParticipant = meetingParticipants.find(p => p.is_chairperson);

    const cleanParticipants = meetingParticipants.map(p => {
      const participant = {
        id: p.is_existing ? p.id : undefined,
        name: p.name,
        email: p.email || null,
        telephone: p.telephone || null,
        title: p.title || null,
        organization: p.organization || null,
        is_chairperson: Boolean(p.is_chairperson),
        is_secretary: p.name === formData.secretary_name,
      };
      // Remove undefined values
      Object.keys(participant).forEach(key => {
        if (participant[key] === undefined) delete participant[key];
      });
      return participant;
    });

    // Build datetime - combine date and time
    let startDateTime = null;
    let endDateTime = null;

    if (formData.meeting_date && formData.start_time) {
      startDateTime = new Date(formData.meeting_date);
      const startTime = formData.start_time;
      startDateTime.setHours(startTime.getHours(), startTime.getMinutes(), startTime.getSeconds());
    }

    if (formData.meeting_date && formData.end_time) {
      endDateTime = new Date(formData.meeting_date);
      const endTime = formData.end_time;
      endDateTime.setHours(endTime.getHours(), endTime.getMinutes(), endTime.getSeconds());
      
      // If end time is before start time, add a day
      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }
    }

    const payload = {
      title: formData.title,
      description: formData.description || null,
      meeting_date: formatDateForDisplay(formData.meeting_date),
      start_time: startDateTime ? formatDateForAPI(startDateTime) : null,
      end_time: endDateTime ? formatDateForAPI(endDateTime) : null,
      location_text: formData.location_text || null,
      location_id: formData.location_id || null,
      gps_coordinates: (gpsEnabled && formData.gps_latitude && formData.gps_longitude)
        ? `${formData.gps_latitude},${formData.gps_longitude}`
        : null,
      agenda: formData.agenda || null,
      secretary_name: formData.secretary_name || null,
      chairperson_name: chairpersonParticipant?.name || null,
      organization_id: restrictedDepartmentId || null,
      visibility,
      restricted_department_id: restrictedDepartmentId || null,
      custom_participants: cleanParticipants,
    };

    return buildCleanPayload(payload);
  }, [formData, gpsEnabled, meetingParticipants, visibility, restrictedDepartmentId]);

  const buildRecurringPayload = useCallback((basePayload) => {
    if (!recurrence || !recurrence.enabled) return basePayload;

    const recurrenceTypeId = attributeMappings.recurrenceTypes[recurrence.type];
    if (!recurrenceTypeId) {
      throw new Error(`Recurrence type "${recurrence.type}" is not configured`);
    }

    const recurrenceDayIds = (recurrence.days || [])
      .map(day => attributeMappings.recurrenceDays[day])
      .filter(id => id);

    const statusId = attributeMappings.statuses?.active;

    return {
      ...basePayload,
      recurrence_type_id: recurrenceTypeId,
      recurrence_interval: recurrence.interval || 1,
      recurrence_days: recurrenceDayIds.length > 0 ? recurrenceDayIds : [],
      recurrence_day_of_month: recurrence.day_of_month === 'last' ? -1 : (recurrence.day_of_month || null),
      recurrence_end_date: recurrence.end_date ? formatDateForAPI(recurrence.end_date) : null,
      recurrence_max_occurrences: recurrence.max_occurrences || null,
      status_id: statusId,
    };
  }, [recurrence, attributeMappings]);

  const handleSubmit = useCallback(async () => {
    // Validation
    if (!isValid) {
      setSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        severity: 'warning'
      });
      setActiveStep(0);
      return;
    }

    if (visibility === VISIBILITY.DEPARTMENT && !restrictedDepartmentId) {
      setSnackbar({
        open: true,
        message: 'Please select a department for restricted meeting access',
        severity: 'warning'
      });
      return;
    }

    // Show loading
    setIsSubmitting(true);
    setSubmitMessage(
      isEditMode
        ? 'Updating meeting...'
        : isRecurring
          ? 'Creating recurring meeting...'
          : 'Creating meeting...'
    );

    try {
      const basePayload = buildMeetingPayload();

      if (isRecurring && recurrence) {
        // Recurrence requires attribute mappings
        if (mappingsLoading) {
          setSnackbar({
            open: true,
            message: 'Loading recurrence settings, please wait...',
            severity: 'info'
          });
          setIsSubmitting(false);
          return;
        }

        console.log('📤 Submitting recurring meeting');
        const recurringPayload = buildRecurringPayload(basePayload);
        await api.post('/recurring-meetings/', recurringPayload);
        setSnackbar({
          open: true,
          message: 'Recurring meeting created successfully!',
          severity: 'success'
        });
      } else if (isEditMode) {
        console.log('📤 Updating regular meeting:', id);
        await dispatch(updateMeeting({ id, data: basePayload })).unwrap();
        setSnackbar({
          open: true,
          message: 'Meeting updated successfully!',
          severity: 'success'
        });
      } else {
        console.log('📤 Creating new meeting');
        await dispatch(createMeeting(basePayload)).unwrap();
        setSnackbar({
          open: true,
          message: 'Meeting created successfully!',
          severity: 'success'
        });
      }

      dispatch(clearMeetingParticipants());

      // Navigate after a brief delay
      setTimeout(() => {
        if (isMounted.current) {
          setIsSubmitting(false);
          navigate(returnPath, { replace: true });
        }
      }, 1200);
    } catch (error) {
      console.error('❌ Submit error:', error);
      if (isMounted.current) {
        setSnackbar({
          open: true,
          message: getErrorMessage(error),
          severity: 'error'
        });
        setIsSubmitting(false);
      }
    }
  }, [
    isValid, visibility, restrictedDepartmentId, isEditMode, isRecurring, recurrence,
    mappingsLoading, buildMeetingPayload, buildRecurringPayload, dispatch, id, navigate, returnPath
  ]);

  // ==========================================================================
  // Return Hook
  // ==========================================================================

  return {
    // State - Form data
    formData,
    setFormData,
    activeStep,
    setActiveStep,

    // State - UI
    snackbar,
    setSnackbar,
    formLoading,
    isSubmitting,
    submitMessage,
    formDirty,

    // State - Recurrence
    recurrence,
    setRecurrence,
    isRecurring,
    mappingsLoading,

    // State - Visibility
    visibility,
    setVisibility,
    restrictedDepartmentId,
    setRestrictedDepartmentId,
    restrictedDepartmentName,
    setRestrictedDepartmentName,

    // State - GPS
    gpsEnabled,
    setGpsEnabled,

    // State - Participants
    meetingParticipants,
    chairpersonName,
    selectedUserIds,
    selectedParticipantIds,

    // State - Display
    pageTitle,
    pageSubtitle,
    isValid,
    apiLoading,
    isEditMode,
    returnPath,
    departmentsList,

    // Department methods
    getDepartmentNameById,
    handleRestrictedDepartmentChange,
    handleClearRestrictedDepartment,
    fetchUserDepartments,

    // Form handlers
    handleChange,
    handleDateChange,
    handleStartTimeChange,
    handleEndTimeChange,
    handleAgendaChange,
    handleLocationSelect,

    // Participant handlers
    handleAddExistingUser,
    handleAddManualParticipant,
    handleAddFromList,
    handleSetChairperson,
    handleRemoveParticipant,

    // Navigation
    handleNext,
    handleBack,
    handleCancel,

    // Submit
    handleSubmit,
  };
};

export default useMeetingForm;