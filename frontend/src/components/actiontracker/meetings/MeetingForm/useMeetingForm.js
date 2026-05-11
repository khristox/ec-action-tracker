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

// Helper function to clean payload - remove all unwanted fields
const cleanPayload = (obj) => {
  // List of fields to KEEP (whitelist approach)
  const allowedFields = [
    'title', 'description', 'meeting_date', 'start_time', 'end_time',
    'location_text', 'location_id', 'gps_coordinates', 'agenda',
    'secretary_name', 'chairperson_name', 'organization_id',
    'visibility', 'restricted_department_id', 'custom_participants'
  ];
  
  const cleaned = {};
  Object.keys(obj).forEach(key => {
    // Only keep allowed fields
    if (allowedFields.includes(key)) {
      const value = obj[key];
      if (value !== undefined && 
          value !== null && 
          value !== '' &&
          !(Array.isArray(value) && value.length === 0)) {
        cleaned[key] = value;
      }
    }
  });
  return cleaned;
};
// Helper to extract error message
const getErrorMessage = (error) => {
  if (error.response?.data?.detail) {
    if (Array.isArray(error.response.data.detail)) {
      return error.response.data.detail[0]?.msg || error.response.data.detail.join(', ');
    }
    return error.response.data.detail;
  }
  return error.message || 'An unexpected error occurred';
};

export const useMeetingForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const dispatch = useDispatch();
  const isEditMode = Boolean(id);
  const returnPath = location.state?.from || '/meetings';

  const initialParticipantsLoaded = useRef(false);
  const isMounted = useRef(true);

  const meetingParticipants = useSelector(selectMeetingParticipantsAll);
  const chairperson = useSelector(selectMeetingChairperson);
  const participantsLoading = useSelector(selectParticipantsLoading);
  const { isLoading: submitting, success } = useSelector(state => state.meetings);

  // Form state
  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [formLoading, setFormLoading] = useState(isEditMode);
  const [formDirty, setFormDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  
  // Meeting data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: null,
    start_time: null,
    end_time: null,
    location_text: '',
    location_id: null,
    location_details: null,
    agenda: '',
    secretary_name: '',
    gps_latitude: '',
    gps_longitude: '',
  });
  
  // Recurrence
  const [recurrence, setRecurrence] = useState(null);
  const [mappingsLoading, setMappingsLoading] = useState(true);
  const [attributeMappings, setAttributeMappings] = useState({
    recurrenceTypes: {},
    recurrenceDays: {},
    recurrenceWeeks: {},
    statuses: {}
  });
  
  // Visibility & department
  const [visibility, setVisibility] = useState('open');
  const [restrictedDepartmentId, setRestrictedDepartmentId] = useState(null);
  const [restrictedDepartmentName, setRestrictedDepartmentName] = useState('');
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);
  
  // Computed values
  const apiLoading = submitting || participantsLoading || formLoading || isSubmitting;
  const chairpersonName = useMemo(() => chairperson?.name || 'Not selected', [chairperson]);
  const pageTitle = isEditMode ? 'Edit Meeting' : 'Create New Meeting';
  const pageSubtitle = isEditMode ? 'Update meeting details' : 'Fill in the details to schedule a new meeting';
  const isRecurring = useMemo(() => recurrence?.enabled === true, [recurrence]);
  const isValid = useMemo(() => 
    formData.title?.trim() && formData.meeting_date && formData.start_time,
    [formData.title, formData.meeting_date, formData.start_time]
  );
  
  const selectedUserIds = useMemo(() => 
    meetingParticipants.filter(p => p.is_existing).map(p => p.id),
    [meetingParticipants]
  );
  
  const selectedParticipantIds = useMemo(() => 
    meetingParticipants.map(p => p.id),
    [meetingParticipants]
  );

  // ==================== Department Helpers ====================
  
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
      
      const transformedDepartments = departmentsData.map(dept => ({
        id: dept.department_id || dept.id,
        name: dept.department_name || dept.name,
        code: dept.code || dept.department_code || '',
        role: dept.role || 'member'
      }));
      
      setDepartmentsList(transformedDepartments);
      return transformedDepartments;
    } catch (error) {
      console.error('Error fetching departments:', error);
      return [];
    }
  }, []);

  const getDepartmentNameById = useCallback((deptId) => {
    if (!deptId) return '';
    const dept = departmentsList.find(d => d.id === deptId);
    return dept?.name || deptId;
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
    setFormDirty(true);
  }, []);

  // ==================== Lifecycle ====================
  
  useEffect(() => {
    isMounted.current = true;
    fetchUserDepartments();
    return () => {
      isMounted.current = false;
    };
  }, [fetchUserDepartments]);

  useEffect(() => {
    const fetchAttributeMappings = async () => {
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
        console.error('Error fetching attribute mappings:', error);
      } finally {
        if (isMounted.current) setMappingsLoading(false);
      }
    };
    
    fetchAttributeMappings();
  }, []);

  useEffect(() => {
    if (isEditMode && id && !initialParticipantsLoaded.current) {
      setFormLoading(true);
      dispatch(fetchMeetingById(id)).unwrap()
        .then(async (meeting) => {
          if (meeting && isMounted.current) {
            const meetingDate = new Date(meeting.meeting_date);
            const startTime = meeting.start_time ? new Date(meeting.start_time) : null;
            const endTime = meeting.end_time ? new Date(meeting.end_time) : null;
            setFormData({
              title: meeting.title || '',
              description: meeting.description || '',
              meeting_date: meetingDate,
              start_time: startTime,
              end_time: endTime,
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
            if (meeting.gps_coordinates) setGpsEnabled(true);
            setVisibility(meeting.visibility || 'open');
            
            const deptId = meeting.restricted_department_id || null;
            setRestrictedDepartmentId(deptId);
            if (deptId) {
              const departments = await fetchUserDepartments();
              const dept = departments.find(d => d.id === deptId);
              setRestrictedDepartmentName(dept?.name || deptId);
            }
            
            dispatch(clearMeetingParticipants());
            if (meeting.participants?.length) {
              meeting.participants.forEach(p => dispatch(addCustomParticipant({ 
                ...p, 
                is_chairperson: p.is_chairperson || false, 
                is_existing: true, 
                id: p.id 
              })));
              const chair = meeting.participants.find(p => p.is_chairperson === true);
              if (chair) setTimeout(() => dispatch(setMeetingChairperson(chair.id)), 150);
            }
            if (meeting.recurrence) setRecurrence(meeting.recurrence);
          }
          setFormLoading(false);
          initialParticipantsLoaded.current = true;
        })
        .catch((error) => {
          if (isMounted.current) {
            setSnackbar({ 
              open: true, 
              message: getErrorMessage(error), 
              severity: 'error' 
            });
            setFormLoading(false);
          }
        });
    }
  }, [isEditMode, id, dispatch, fetchUserDepartments]);

  useEffect(() => {
    dispatch(fetchParticipantLists());
    return () => {
      if (!success) dispatch(clearMeetingParticipants());
      dispatch(clearMeetingState());
      dispatch(clearCurrentMeeting());
    };
  }, [dispatch, success]);

  // ==================== Form Handlers ====================
  
  const handleChange = useCallback((e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setFormDirty(true);
  }, []);

  const handleDateChange = useCallback((date) => {
    setFormData(prev => ({ ...prev, meeting_date: date }));
    setFormDirty(true);
  }, []);

  const handleStartTimeChange = useCallback((time) => {
    setFormData(prev => ({ ...prev, start_time: time }));
    setFormDirty(true);
  }, []);

  const handleEndTimeChange = useCallback((time) => {
    setFormData(prev => ({ ...prev, end_time: time }));
    setFormDirty(true);
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

  // ==================== Participant Handlers ====================
  
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
    setSnackbar({ 
      open: true, 
      message: 'Chairperson updated', 
      severity: 'info' 
    });
  }, [dispatch]);

  const handleRemoveParticipant = useCallback((pid) => {
    dispatch(removeLocalMeetingParticipant(pid));
    setFormDirty(true);
    setSnackbar({ 
      open: true, 
      message: 'Participant removed', 
      severity: 'info' 
    });
  }, [dispatch]);

  // ==================== Navigation Handlers ====================
  
  const handleNext = useCallback(() => {
    if (activeStep === 0 && !isValid) {
      setSnackbar({ 
        open: true, 
        message: 'Please fill in all required fields (Title, Date, Time)', 
        severity: 'warning' 
      });
      return;
    }
    setActiveStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeStep, isValid]);

  const handleBack = useCallback(() => {
    if (activeStep === 0) {
      navigate(returnPath);
    } else {
      setActiveStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeStep, navigate, returnPath]);

  const handleCancel = useCallback(() => {
    if (formDirty && window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
      dispatch(clearMeetingParticipants());
      navigate(returnPath);
    } else if (!formDirty) {
      dispatch(clearMeetingParticipants());
      navigate(returnPath);
    }
  }, [formDirty, navigate, returnPath, dispatch]);

  // ==================== Submission Handler ====================
  
const buildMeetingPayload = useCallback(() => {
  const meetingDate = formData.meeting_date;
  const startDateTime = new Date(meetingDate);
  startDateTime.setHours(formData.start_time.getHours(), formData.start_time.getMinutes());

  let endDateTime = null;
  if (formData.end_time) {
    endDateTime = new Date(meetingDate);
    endDateTime.setHours(formData.end_time.getHours(), formData.end_time.getMinutes());
  }

  const chairpersonParticipant = meetingParticipants.find(p => p.is_chairperson === true);

  // Clean participants - only include allowed fields
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

  const payload = {
    title: formData.title,
    description: formData.description || null,
    meeting_date: startDateTime.toISOString().split('T')[0],
    start_time: startDateTime.toISOString(),
    end_time: endDateTime ? endDateTime.toISOString() : null,
    location_text: formData.location_text || null,
    location_id: formData.location_id || null,
    gps_coordinates: (gpsEnabled && formData.gps_latitude && formData.gps_longitude) 
      ? `${formData.gps_latitude},${formData.gps_longitude}` 
      : null,
    agenda: formData.agenda || null,
    secretary_name: formData.secretary_name || null,
    chairperson_name: chairpersonParticipant?.name || null,
    organization_id: restrictedDepartmentId || null,
    visibility: visibility,
    restricted_department_id: visibility === 'department' ? restrictedDepartmentId : null,
    custom_participants: cleanParticipants,
  };

  // Log the payload before cleaning to debug
 
  
  const cleaned = cleanPayload(payload);
  
  return cleaned;
}, [formData, gpsEnabled, meetingParticipants, visibility, restrictedDepartmentId]);


  const buildRecurringPayload = useCallback((basePayload) => {
    if (!recurrence) return basePayload;

    const recurrenceTypeId = attributeMappings.recurrenceTypes[recurrence.type];
    if (!recurrenceTypeId) {
      throw new Error(`Recurrence type "${recurrence.type}" is not configured`);
    }

    const recurrenceDayIds = (recurrence.days || [])
      .map(day => attributeMappings.recurrenceDays[day])
      .filter(id => id);

    const statusId = attributeMappings.statuses?.active;
    if (!statusId) {
      console.warn('Status ID not found, recurring meeting may fail');
    }

    return {
      ...basePayload,
      recurrence_type_id: recurrenceTypeId,
      recurrence_interval: recurrence.interval || 1,
      recurrence_days: recurrenceDayIds,
      recurrence_day_of_month: recurrence.day_of_month === 'last' ? -1 : (recurrence.day_of_month || null),
      recurrence_end_date: recurrence.end_date ? new Date(recurrence.end_date).toISOString() : null,
      recurrence_max_occurrences: recurrence.max_occurrences || null,
      status_id: statusId,
    };
  }, [recurrence, attributeMappings]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'warning' });
      setActiveStep(0);
      return;
    }

    if (visibility === 'department' && !restrictedDepartmentId) {
      setSnackbar({ open: true, message: 'Please select a department for restricted meeting access', severity: 'warning' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(isEditMode ? 'Updating meeting...' : isRecurring ? 'Creating recurring meeting...' : 'Creating meeting...');

    try {
      const basePayload = buildMeetingPayload();

    
    // Manually remove any remaining unwanted fields
    delete basePayload.has_online_meeting;
    delete basePayload.has_physical_meeting;
    delete basePayload.platform;
    delete basePayload.meeting_link;
    delete basePayload.passcode;
    delete basePayload.dial_in_numbers;
    delete basePayload.venue;
    delete basePayload.address;
    delete basePayload.location_instructions;
    delete basePayload.send_reminders;
    delete basePayload.reminder_minutes_before;
    delete basePayload.meeting_id_online;
    delete basePayload.meeting_id;
    

      if (isRecurring && recurrence) {
        if (mappingsLoading) {
          setSnackbar({ open: true, message: 'Loading recurrence settings, please wait...', severity: 'info' });
          setIsSubmitting(false);
          return;
        }
        const recurringPayload = buildRecurringPayload(basePayload);
         await api.post('/recurring-meetings/', recurringPayload);
        setSnackbar({ open: true, message: 'Recurring meeting created successfully!', severity: 'success' });
      } 
      else if (isEditMode) {
         await dispatch(updateMeeting({ id, data: basePayload })).unwrap();
        setSnackbar({ open: true, message: 'Meeting updated successfully!', severity: 'success' });
      } 
      else {
         await dispatch(createMeeting(basePayload)).unwrap();
        setSnackbar({ open: true, message: 'Meeting created successfully!', severity: 'success' });
      }

      dispatch(clearMeetingParticipants());
      setTimeout(() => {
        setIsSubmitting(false);
        navigate(returnPath, { replace: true });
      }, 1200);

    } catch (error) {
      console.error('Submit error:', error);
      const errorMessage = getErrorMessage(error);
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      setIsSubmitting(false);
    }
  }, [
    isValid, visibility, restrictedDepartmentId, isEditMode, isRecurring,
    recurrence, mappingsLoading, buildMeetingPayload, buildRecurringPayload,
    dispatch, id, navigate, returnPath
  ]);

  return {
    // State
    formData,
    activeStep,
    snackbar,
    formLoading,
    isSubmitting,
    submitMessage,
    recurrence,
    visibility,
    restrictedDepartmentId,
    restrictedDepartmentName,
    gpsEnabled,
    meetingParticipants,
    chairpersonName,
    pageTitle,
    pageSubtitle,
    isRecurring,
    isValid,
    apiLoading,
    selectedUserIds,
    selectedParticipantIds,
    isEditMode,
    returnPath,
    mappingsLoading,
    departmentsList,
    
    // Setters
    setFormData,
    setActiveStep,
    setSnackbar,
    setRecurrence,
    setVisibility,
    setRestrictedDepartmentId,
    setRestrictedDepartmentName,
    setGpsEnabled,
    
    // Department helpers
    getDepartmentNameById,
    handleRestrictedDepartmentChange,
    handleClearRestrictedDepartment,
    fetchUserDepartments,
    
    // Handlers
    handleChange,
    handleDateChange,
    handleStartTimeChange,
    handleEndTimeChange,
    handleAgendaChange,
    handleLocationSelect,
    handleAddExistingUser,
    handleAddManualParticipant,
    handleAddFromList,
    handleSetChairperson,
    handleRemoveParticipant,
    handleNext,
    handleBack,
    handleCancel,
    handleSubmit,
  };
};