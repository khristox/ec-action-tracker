// src/components/actiontracker/actions/AssignAction.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Button, TextField,
  FormControl, InputLabel, Select, MenuItem, Chip, Alert,
  CircularProgress, Grid, Divider, FormHelperText
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import api from '../../../services/api';
import { 
  fetchActionById, 
  updateAction, 
  createActionFromMinutes,  // Import the new thunk
  clearCurrentAction,
  clearError
} from '../../../store/slices/actionTracker/actionSlice';

const AssignAction = () => {
  const { id, minuteId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Use selectors from the slice
  const { currentAction, loading, error } = useSelector((state) => state.actions);
  const { user } = useSelector((state) => state.auth);
  
  const [formData, setFormData] = useState({
    description: '',
    assigned_to_id: '',
    due_date: null,
    priority: 2,
    estimated_hours: '',
    remarks: '',
  });
  const [users, setUsers] = useState([]);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [loadingMeeting, setLoadingMeeting] = useState(false);

  const isEditMode = id && id !== 'undefined' && id !== 'null';
  const isCreateMode = minuteId && minuteId !== 'undefined' && minuteId !== 'null';

  const fetchMeetingInfo = useCallback(async () => {
    if (!isCreateMode) return;
    
    setLoadingMeeting(true);
    try {
      const minutesRes = await api.get(`/action-tracker/minutes/${minuteId}`);
      const minutes = minutesRes.data;
      const meetingId = minutes.meeting_id;
      
      const meetingRes = await api.get(`/action-tracker/meetings/${meetingId}`);
      setMeetingInfo(meetingRes.data);
    } catch (err) {
      console.error('Error fetching meeting info:', err);
      setLocalError('Could not load meeting information');
    } finally {
      setLoadingMeeting(false);
    }
  }, [minuteId, isCreateMode]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/users/', {
        params: { skip: 0, limit: 100, is_active: true }
      });
      const usersData = response.data.data || response.data || [];
      setUsers(usersData);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, []);

  // Fetch action data if in edit mode using the slice
  const fetchAction = useCallback(async () => {
    if (!isEditMode) return;
    
    try {
      const result = await dispatch(fetchActionById(id)).unwrap();
      if (result) {
        setFormData({
          description: result.description || '',
          assigned_to_id: result.assigned_to_id || '',
          due_date: result.due_date ? new Date(result.due_date) : null,
          priority: result.priority || 2,
          estimated_hours: result.estimated_hours || '',
          remarks: result.remarks || '',
        });
      }
    } catch (err) {
      console.error('Error fetching action:', err);
      setLocalError('Failed to load action data');
    }
  }, [id, dispatch, isEditMode]);

  useEffect(() => {
    fetchUsers();
    if (isEditMode) {
      fetchAction();
    }
    if (isCreateMode) {
      fetchMeetingInfo();
    }
    
    return () => {
      dispatch(clearCurrentAction());
      dispatch(clearError());
    };
  }, [fetchUsers, fetchAction, fetchMeetingInfo, isEditMode, isCreateMode, dispatch]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDateChange = (date) => {
    setFormData({ ...formData, due_date: date });
  };

  const validateForm = () => {
    if (!formData.description?.trim()) {
      setLocalError('Description is required');
      return false;
    }
    if (!formData.assigned_to_id) {
      setLocalError('Please select a user to assign this action');
      return false;
    }
    if (!formData.due_date) {
      setLocalError('Due date is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setSubmitting(true);
    setLocalError('');
    
    try {
      const payload = {
        description: formData.description,
        assigned_to_id: formData.assigned_to_id,
        due_date: formData.due_date?.toISOString(),
        priority: parseInt(formData.priority),
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        remarks: formData.remarks,
      };
      
      let response;
      if (isEditMode) {
        // Use the slice's updateAction thunk
        response = await dispatch(updateAction({ id, actionData: payload })).unwrap();
      } else if (isCreateMode) {
        // Use the slice's createActionFromMinutes thunk - CORRECT URL
        response = await dispatch(createActionFromMinutes({ minuteId, actionData: payload })).unwrap();
      } else {
        throw new Error('Invalid mode: neither edit nor create');
      }
      
      if (response) {
        // Navigate back to the meeting detail page if coming from there
        if (isCreateMode && meetingInfo) {
          navigate(`/meetings/${meetingInfo.id}`);
        } else {
          navigate('/actions/my-tasks');
        }
      }
    } catch (err) {
      console.error('Error saving action:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save action';
      if (err.response?.data?.detail && Array.isArray(err.response.data.detail)) {
        setLocalError(err.response.data.detail.map(d => d.msg || d.message).join(', '));
      } else {
        setLocalError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isCreateMode && meetingInfo) {
      navigate(`/meetings/${meetingInfo.id}`);
    } else {
      navigate('/actions/my-tasks');
    }
  };

  const priorities = [
    { value: 1, label: 'High', color: 'error' },
    { value: 2, label: 'Medium', color: 'warning' },
    { value: 3, label: 'Low', color: 'success' },
    { value: 4, label: 'Very Low', color: 'default' },
  ];

  // Use loading from Redux state
  if ((loading || (loading && isEditMode)) || (loadingMeeting && isCreateMode)) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const getPageTitle = () => {
    if (isEditMode) return 'Edit Action';
    if (isCreateMode && meetingInfo) return `Add Action to: ${meetingInfo.title}`;
    return 'Assign New Action';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: 3 }}>
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <AssignmentIcon color="primary" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h5" fontWeight={700}>
                {getPageTitle()}
              </Typography>
              {isCreateMode && meetingInfo && (
                <Typography variant="body2" color="text.secondary">
                  Meeting: {meetingInfo.title} • {new Date(meetingInfo.meeting_date).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          {/* Error Alert - show both local and Redux errors */}
          {(localError || error) && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => { 
              setLocalError(''); 
              dispatch(clearError()); 
            }}>
              {localError || (typeof error === 'string' ? error : JSON.stringify(error))}
            </Alert>
          )}
          
          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Action Description"
                name="description"
                multiline
                rows={3}
                value={formData.description}
                onChange={handleChange}
                required
                placeholder="Describe the action item to be completed..."
              />
              
              <FormControl fullWidth required>
                <InputLabel>Assign To</InputLabel>
                <Select
                  name="assigned_to_id"
                  value={formData.assigned_to_id}
                  onChange={handleChange}
                  label="Assign To"
                >
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.full_name || user.username} {user.email ? `(${user.email})` : ''}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Select the person responsible for this action</FormHelperText>
              </FormControl>
              
              <DatePicker
                label="Due Date"
                value={formData.due_date}
                onChange={handleDateChange}
                slotProps={{ textField: { fullWidth: true, required: true } }}
              />
              
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  label="Priority"
                >
                  {priorities.map((priority) => (
                    <MenuItem key={priority.value} value={priority.value}>
                      <Chip 
                        label={priority.label} 
                        color={priority.color} 
                        size="small"
                        sx={{ fontWeight: 500 }}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                label="Estimated Hours"
                name="estimated_hours"
                type="number"
                inputProps={{ step: 0.5, min: 0 }}
                value={formData.estimated_hours}
                onChange={handleChange}
                placeholder="Estimated time to complete (in hours)"
              />
              
              <TextField
                fullWidth
                label="Additional Remarks"
                name="remarks"
                multiline
                rows={2}
                value={formData.remarks}
                onChange={handleChange}
                placeholder="Any additional notes or instructions..."
              />
              
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={handleCancel}
                    disabled={submitting}
                    size="large"
                  >
                    Cancel
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={submitting ? <CircularProgress size={20} /> : <SaveIcon />}
                    type="submit"
                    disabled={submitting}
                    size="large"
                  >
                    {submitting ? 'Saving...' : (isEditMode ? 'Update Action' : 'Create Action')}
                  </Button>
                </Grid>
              </Grid>
            </Stack>
          </form>
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default AssignAction;