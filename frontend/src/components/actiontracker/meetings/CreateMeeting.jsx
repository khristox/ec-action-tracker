import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Grid,
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  GroupAdd as GroupAddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../../../services/api';

const CreateMeeting = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
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
    chairperson_name: '',
  });
  
  // Participant related
  const [participantLists, setParticipantLists] = useState([]);
  const [selectedParticipantList, setSelectedParticipantList] = useState(null);
  const [customParticipants, setCustomParticipants] = useState([]);
  const [availableParticipants, setAvailableParticipants] = useState([]);
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    name: '',
    email: '',
    telephone: '',
    title: '',
    organization: '',
  });

  // Fetch data on mount
  useEffect(() => {
    fetchParticipantLists();
    fetchAvailableParticipants();
  }, []);

  const fetchParticipantLists = async () => {
    try {
      const response = await api.get('/action-tracker/participant-lists');
      setParticipantLists(response.data);
    } catch (err) {
      console.error('Error fetching participant lists:', err);
    }
  };

  const fetchAvailableParticipants = async () => {
    try {
      const response = await api.get('/action-tracker/participants', { params: { limit: 100 } });
      setAvailableParticipants(response.data);
    } catch (err) {
      console.error('Error fetching participants:', err);
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

  const handleUseParticipantList = () => {
    if (selectedParticipantList) {
      const list = participantLists.find(l => l.id === selectedParticipantList);
      if (list && list.participants) {
        const newParticipants = list.participants.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          telephone: p.telephone,
          title: p.title,
          organization: p.organization,
          is_chairperson: false,
        }));
        setCustomParticipants(prev => [...prev, ...newParticipants]);
        setSnackbar({
          open: true,
          message: `Added ${newParticipants.length} participants from ${list.name}`,
          severity: 'success'
        });
      }
      setSelectedParticipantList(null);
    }
  };

  const handleAddCustomParticipant = async () => {
    if (!newParticipant.name.trim()) {
      setSnackbar({ open: true, message: 'Please enter participant name', severity: 'warning' });
      return;
    }

    // Check if participant already exists
    const exists = customParticipants.some(p => p.name === newParticipant.name);
    if (exists) {
      setSnackbar({ open: true, message: 'Participant already added', severity: 'warning' });
      return;
    }

    setCustomParticipants([...customParticipants, { ...newParticipant, id: Date.now() }]);
    setNewParticipant({ name: '', email: '', telephone: '', title: '', organization: '' });
    setShowAddParticipantDialog(false);
    setSnackbar({ open: true, message: 'Participant added successfully', severity: 'success' });
  };

  const handleRemoveCustomParticipant = (index) => {
    setCustomParticipants(customParticipants.filter((_, i) => i !== index));
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
    }
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

 const handleSubmit = async () => {
  setApiLoading(true);
  setError(null);
  
  try {
    // Combine date and time properly
    const meetingDate = formData.meeting_date;
    if (!meetingDate) {
      throw new Error("Meeting date is required");
    }
    if (!formData.start_time) {
      throw new Error("Start time is required");
    }
    
    // Create start datetime using the selected date and time
    const startDateTime = new Date(meetingDate);
    startDateTime.setHours(
      formData.start_time.getHours(),
      formData.start_time.getMinutes(),
      0, 0
    );
    
    // Create end datetime if provided
    let endDateTime = null;
    if (formData.end_time) {
      endDateTime = new Date(meetingDate);
      endDateTime.setHours(
        formData.end_time.getHours(),
        formData.end_time.getMinutes(),
        0, 0
      );
      
      // Validate end time is after start time
      if (endDateTime <= startDateTime) {
        setSnackbar({
          open: true,
          message: "End time must be after start time",
          severity: "warning"
        });
        setApiLoading(false);
        return;
      }
    }
    
    const meetingPayload = {
      title: formData.title,
      description: formData.description || null,
      meeting_date: startDateTime.toISOString(),  // Use startDateTime as the meeting datetime
      start_time: startDateTime.toISOString(),
      end_time: endDateTime ? endDateTime.toISOString() : null,
      location_text: formData.location_text || null,
      agenda: formData.agenda || null,
      facilitator: formData.facilitator || null,
      chairperson_name: formData.chairperson_name || null,
      custom_participants: customParticipants.map(p => ({
        name: p.name,
        email: p.email || null,
        telephone: p.telephone || null,
        title: p.title || null,
        organization: p.organization || null,
        is_chairperson: p.is_chairperson || false,
      })),
    };
    
    console.log("Sending to API:", meetingPayload);
    
    const response = await api.post("/action-tracker/meetings", meetingPayload);
    console.log("API Response:", response.data);
    
    setSuccess(true);
    setSnackbar({
      open: true,
      message: `Meeting "${response.data.title}" created successfully!`,
      severity: "success",
    });
    
    setTimeout(() => {
      navigate(`/meetings/${response.data.id}`);
    }, 2000);
  } catch (error) {
    console.error("Error creating meeting:", error);
    
    // Extract validation errors from 422 response
    let errorMessage = "Failed to create meeting. ";
    if (error.response?.status === 422) {
      const details = error.response.data?.error?.details || error.response.data?.detail;
      if (Array.isArray(details)) {
        errorMessage += details.map(d => d.message || d.msg).join(", ");
      } else if (typeof details === "string") {
        errorMessage = details;
      } else {
        errorMessage += JSON.stringify(details);
      }
    } else {
      errorMessage += error.response?.data?.message || error.message;
    }
    
    setError(errorMessage);
    setSnackbar({
      open: true,
      message: errorMessage,
      severity: "error",
    });
  } finally {
    setApiLoading(false);
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

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '900px', mx: 'auto' }}>
        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* Back button */}
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/meetings')} 
          sx={{ mb: 3 }}
          disabled={apiLoading}
        >
          Back to Meetings
        </Button>

        {/* Main form */}
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h4" fontWeight={800} color="primary" gutterBottom>
            Create New Meeting
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            Fill in the details to schedule a new meeting
          </Typography>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Meeting created successfully! Redirecting...
            </Alert>
          )}

          {/* Loading overlay during API call */}
          {apiLoading && (
            <Box sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              bgcolor: 'rgba(255,255,255,0.8)', 
              zIndex: 10, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: 3
            }}>
              <CircularProgress />
            </Box>
          )}

          <Stepper activeStep={activeStep} sx={{ mb: 4, position: 'relative' }}>
            <Step><StepLabel>Meeting Details</StepLabel></Step>
            <Step><StepLabel>Add Participants</StepLabel></Step>
            <Step><StepLabel>Review & Create</StepLabel></Step>
          </Stepper>

          {/* Step 1: Meeting Details */}
          {activeStep === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Meeting Title *"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  disabled={apiLoading}
                  error={!formData.title && formData.title !== ''}
                  helperText={!formData.title && formData.title !== '' ? 'Title is required' : ''}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  disabled={apiLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Meeting Date *"
                  value={formData.meeting_date}
                  onChange={handleDateChange}
                  disabled={apiLoading}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TimePicker
                  label="Start Time *"
                  value={formData.start_time}
                  onChange={handleStartTimeChange}
                  disabled={apiLoading}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TimePicker
                  label="End Time"
                  value={formData.end_time}
                  onChange={handleEndTimeChange}
                  disabled={apiLoading}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Location"
                  name="location_text"
                  value={formData.location_text}
                  onChange={handleChange}
                  disabled={apiLoading}
                  placeholder="Conference Room A, Virtual Meeting, etc."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Agenda"
                  name="agenda"
                  multiline
                  rows={4}
                  value={formData.agenda}
                  onChange={handleChange}
                  disabled={apiLoading}
                  placeholder="1. Welcome and introductions\n2. Review of previous minutes\n3. Main agenda items\n4. Any other business"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Facilitator"
                  name="facilitator"
                  value={formData.facilitator}
                  onChange={handleChange}
                  disabled={apiLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Chairperson"
                  name="chairperson_name"
                  value={formData.chairperson_name}
                  onChange={handleChange}
                  disabled={apiLoading}
                />
              </Grid>
            </Grid>
          )}

          {/* Step 2: Add Participants */}
          {activeStep === 1 && (
            <Box>
              {/* Add from participant list */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Add from Participant List
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={8}>
                    <FormControl fullWidth>
                      <InputLabel>Select Participant List</InputLabel>
                      <Select
                        value={selectedParticipantList || ''}
                        onChange={(e) => setSelectedParticipantList(e.target.value)}
                        label="Select Participant List"
                        disabled={apiLoading}
                      >
                        {participantLists.map((list) => (
                          <MenuItem key={list.id} value={list.id}>
                            {list.name} ({list.participant_count || list.participants?.length || 0} participants)
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<GroupAddIcon />}
                      onClick={handleUseParticipantList}
                      disabled={!selectedParticipantList || apiLoading}
                    >
                      Add List
                    </Button>
                  </Grid>
                </Grid>
              </Paper>

              {/* Individual participants */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Individual Participants
                  </Typography>
                  <Button
                    startIcon={<PersonAddIcon />}
                    onClick={() => setShowAddParticipantDialog(true)}
                    size="small"
                    disabled={apiLoading}
                  >
                    Add Participant
                  </Button>
                </Box>
                
                {customParticipants.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                    No participants added yet. Add participants from a list or individually.
                  </Typography>
                ) : (
                  <List>
                    {customParticipants.map((participant, index) => (
                      <React.Fragment key={participant.id || index}>
                        <ListItem
                          secondaryAction={
                            <IconButton edge="end" onClick={() => handleRemoveCustomParticipant(index)} disabled={apiLoading}>
                              <DeleteIcon />
                            </IconButton>
                          }
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: participant.is_chairperson ? '#1976d2' : '#4caf50' }}>
                              {participant.name.charAt(0)}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                {participant.name}
                                {participant.is_chairperson && (
                                  <Chip label="Chairperson" size="small" color="primary" />
                                )}
                              </Box>
                            }
                            secondary={`${participant.email || ''} ${participant.telephone || ''}`}
                          />
                        </ListItem>
                        <Divider variant="inset" component="li" />
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Paper>
            </Box>
          )}

          {/* Step 3: Review */}
          {activeStep === 2 && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                Please review your meeting details before creating.
              </Alert>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: '#fafafa' }}>
                <Typography variant="subtitle1" fontWeight="bold">Title:</Typography>
                <Typography variant="body2" gutterBottom>{formData.title || 'Not specified'}</Typography>
                
                <Typography variant="subtitle1" fontWeight="bold" mt={2}>Description:</Typography>
                <Typography variant="body2" gutterBottom>{formData.description || 'No description'}</Typography>
                
                <Typography variant="subtitle1" fontWeight="bold" mt={2}>Date & Time:</Typography>
                <Typography variant="body2" gutterBottom>
                  {formData.meeting_date?.toLocaleDateString() || 'Not set'} at {formData.start_time?.toLocaleTimeString() || 'Not set'}
                  {formData.end_time && ` - ${formData.end_time.toLocaleTimeString()}`}
                </Typography>
                
                <Typography variant="subtitle1" fontWeight="bold" mt={2}>Location:</Typography>
                <Typography variant="body2" gutterBottom>{formData.location_text || 'Not specified'}</Typography>
                
                {formData.agenda && (
                  <>
                    <Typography variant="subtitle1" fontWeight="bold" mt={2}>Agenda:</Typography>
                    <Typography variant="body2" whiteSpace="pre-wrap">{formData.agenda}</Typography>
                  </>
                )}
                
                {(formData.facilitator || formData.chairperson_name) && (
                  <>
                    <Typography variant="subtitle1" fontWeight="bold" mt={2}>Meeting Leaders:</Typography>
                    <Typography variant="body2">
                      {formData.facilitator && `Facilitator: ${formData.facilitator}`}
                      {formData.facilitator && formData.chairperson_name && ' • '}
                      {formData.chairperson_name && `Chairperson: ${formData.chairperson_name}`}
                    </Typography>
                  </>
                )}
                
                <Typography variant="subtitle1" fontWeight="bold" mt={2}>Participants:</Typography>
                <Typography variant="body2">{customParticipants.length} participants added</Typography>
                {customParticipants.length > 0 && (
                  <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                    {customParticipants.slice(0, 5).map((p, i) => (
                      <li key={i}>
                        <Typography variant="caption">{p.name}</Typography>
                      </li>
                    ))}
                    {customParticipants.length > 5 && (
                      <li><Typography variant="caption">...and {customParticipants.length - 5} more</Typography></li>
                    )}
                  </Box>
                )}
              </Paper>
            </Box>
          )}

          {/* Navigation Buttons */}
          <Box display="flex" justifyContent="space-between" mt={4}>
            <Button 
              disabled={activeStep === 0 || apiLoading} 
              onClick={handleBack}
            >
              Back
            </Button>
            {activeStep === 2 ? (
              <Button 
                variant="contained" 
                onClick={handleSubmit}
                disabled={apiLoading || success}
              >
                {apiLoading ? <CircularProgress size={24} /> : 'Create Meeting'}
              </Button>
            ) : (
              <Button 
                variant="contained" 
                onClick={handleNext}
                disabled={!isStepValid() || apiLoading}
              >
                Next
              </Button>
            )}
          </Box>
        </Paper>

        {/* Add Participant Dialog */}
        <Dialog open={showAddParticipantDialog} onClose={() => setShowAddParticipantDialog(false)} maxWidth="sm" fullWidth>
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
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Name *"
                  value={newParticipant.name}
                  onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={newParticipant.email}
                  onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Telephone"
                  value={newParticipant.telephone}
                  onChange={(e) => setNewParticipant({ ...newParticipant, telephone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Title"
                  value={newParticipant.title}
                  onChange={(e) => setNewParticipant({ ...newParticipant, title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Organization"
                  value={newParticipant.organization}
                  onChange={(e) => setNewParticipant({ ...newParticipant, organization: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddParticipantDialog(false)}>Cancel</Button>
            <Button onClick={handleAddCustomParticipant} variant="contained" disabled={!newParticipant.name}>
              Add Participant
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateMeeting;