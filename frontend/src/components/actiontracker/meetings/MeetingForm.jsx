// src/components/meetings/MeetingForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TextField, Alert, CircularProgress, 
  Snackbar, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, ListItemAvatar, Avatar, Divider,
  Container, InputAdornment, Grid, Card, CardContent, Stack
} from '@mui/material';
import {
  Delete as DeleteIcon, PersonAdd as PersonAddIcon, ArrowBack as ArrowBackIcon,
  Save as SaveIcon, Event as EventIcon, LocationOn as LocationIcon,
  People as PeopleIcon, Update as UpdateIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../../../services/api';

const MeetingForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showParticipantDialog, setShowParticipantDialog] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: null,
    start_time: null,
    end_time: null,
    location: '',
    agenda: ''
  });
  
  const [participants, setParticipants] = useState([]);
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '', phone: '' });
  const [chairpersonId, setChairpersonId] = useState(null);

  // Load meeting data for edit mode
  useEffect(() => {
    if (isEditMode && id) {
      loadMeeting();
    }
  }, [isEditMode, id]);

  const loadMeeting = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/meetings/${id}`);
      const meeting = response.data;
      
      setFormData({
        title: meeting.title || '',
        description: meeting.description || '',
        meeting_date: meeting.meeting_date ? new Date(meeting.meeting_date) : null,
        start_time: meeting.start_time ? new Date(meeting.start_time) : null,
        end_time: meeting.end_time ? new Date(meeting.end_time) : null,
        location: meeting.location_text || '',
        agenda: meeting.agenda || ''
      });
      
      if (meeting.participants) {
        setParticipants(meeting.participants);
        const chair = meeting.participants.find(p => p.is_chairperson);
        if (chair) setChairpersonId(chair.id);
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load meeting', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const addParticipant = () => {
    if (!newParticipant.name.trim()) {
      setSnackbar({ open: true, message: 'Name is required', severity: 'warning' });
      return;
    }
    
    setParticipants([...participants, {
      id: Date.now().toString(),
      ...newParticipant,
      is_chairperson: false
    }]);
    
    setNewParticipant({ name: '', email: '', phone: '' });
    setShowParticipantDialog(false);
    setSnackbar({ open: true, message: 'Participant added', severity: 'success' });
  };

  const removeParticipant = (id) => {
    setParticipants(participants.filter(p => p.id !== id));
    if (chairpersonId === id) setChairpersonId(null);
    setSnackbar({ open: true, message: 'Participant removed', severity: 'info' });
  };

  const setChairperson = (id) => {
    setChairpersonId(id);
    setParticipants(participants.map(p => ({
      ...p,
      is_chairperson: p.id === id
    })));
    setSnackbar({ open: true, message: 'Chairperson updated', severity: 'success' });
  };

  const handleSubmit = async () => {
    // Validate
    if (!formData.title.trim()) {
      setSnackbar({ open: true, message: 'Meeting title is required', severity: 'warning' });
      return;
    }
    if (!formData.meeting_date || !formData.start_time) {
      setSnackbar({ open: true, message: 'Date and time are required', severity: 'warning' });
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

      const payload = {
        title: formData.title,
        description: formData.description,
        meeting_date: startDateTime.toISOString(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime?.toISOString(),
        location_text: formData.location,
        agenda: formData.agenda,
        chairperson_name: participants.find(p => p.id === chairpersonId)?.name,
        custom_participants: participants.map(p => ({
          name: p.name,
          email: p.email,
          telephone: p.phone,
          is_chairperson: p.id === chairpersonId
        }))
      };

      if (isEditMode) {
        await api.put(`/meetings/${id}`, payload);
        setSnackbar({ open: true, message: 'Meeting updated!', severity: 'success' });
      } else {
        await api.post('/meetings', payload);
        setSnackbar({ open: true, message: 'Meeting created!', severity: 'success' });
      }
      
      setTimeout(() => navigate('/meetings'), 1500);
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Something went wrong', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Header */}
        <Box mb={4}>
          <IconButton onClick={() => navigate('/meetings')} sx={{ mb: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" fontWeight="bold" color="primary">
            {isEditMode ? 'Edit Meeting' : 'Create New Meeting'}
          </Typography>
          <Typography color="text.secondary">
            {isEditMode ? 'Update your meeting details' : 'Fill in the details to schedule a meeting'}
          </Typography>
        </Box>

        <Paper sx={{ p: 4, borderRadius: 2 }}>
          <Stack spacing={3}>
            {/* Basic Information */}
            <Typography variant="h6" fontWeight="bold">Meeting Information</Typography>
            
            <TextField
              label="Meeting Title *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><EventIcon color="action" /></InputAdornment>
              }}
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={5}>
                <DatePicker
                  label="Meeting Date *"
                  value={formData.meeting_date}
                  onChange={(date) => setFormData({ ...formData, meeting_date: date })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={6} sm={3.5}>
                <TimePicker
                  label="Start Time *"
                  value={formData.start_time}
                  onChange={(time) => setFormData({ ...formData, start_time: time })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={6} sm={3.5}>
                <TimePicker
                  label="End Time"
                  value={formData.end_time}
                  onChange={(time) => setFormData({ ...formData, end_time: time })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
            </Grid>

            <TextField
              label="Location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              fullWidth
              placeholder="Virtual meeting link or physical address"
              InputProps={{
                startAdornment: <InputAdornment position="start"><LocationIcon color="action" /></InputAdornment>
              }}
            />

            <TextField
              label="Agenda"
              value={formData.agenda}
              onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
              multiline
              rows={4}
              fullWidth
              placeholder="Topics to be discussed..."
            />

            <Divider />

            {/* Participants Section */}
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight="bold">Participants</Typography>
                <Button
                  variant="contained"
                  startIcon={<PersonAddIcon />}
                  onClick={() => setShowParticipantDialog(true)}
                  size="small"
                >
                  Add Person
                </Button>
              </Box>

              {participants.length === 0 ? (
                <Alert severity="info">No participants added yet. Click "Add Person" to get started.</Alert>
              ) : (
                <List>
                  {participants.map((p, index) => (
                    <React.Fragment key={p.id}>
                      <ListItem
                        secondaryAction={
                          <IconButton edge="end" onClick={() => removeParticipant(p.id)}>
                            <DeleteIcon />
                          </IconButton>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: p.id === chairpersonId ? 'primary.main' : 'success.main' }}>
                            {p.name.charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography fontWeight={500}>{p.name}</Typography>
                              {p.id === chairpersonId && (
                                <Typography variant="caption" color="primary" fontWeight="bold">
                                  (Chairperson)
                                </Typography>
                              )}
                            </Box>
                          }
                          secondary={
                            <Stack direction="row" spacing={2}>
                              {p.email && <Typography variant="caption">{p.email}</Typography>}
                              {p.phone && <Typography variant="caption">{p.phone}</Typography>}
                            </Stack>
                          }
                        />
                        {p.id !== chairpersonId && (
                          <Button size="small" onClick={() => setChairperson(p.id)}>
                            Make Chairperson
                          </Button>
                        )}
                      </ListItem>
                      {index < participants.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>

            <Divider />

            {/* Actions */}
            <Box display="flex" gap={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => navigate('/meetings')}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={submitting}
                startIcon={isEditMode ? <UpdateIcon /> : <SaveIcon />}
              >
                {submitting ? <CircularProgress size={24} /> : (isEditMode ? 'Update Meeting' : 'Create Meeting')}
              </Button>
            </Box>
          </Stack>
        </Paper>

        {/* Add Participant Dialog */}
        <Dialog open={showParticipantDialog} onClose={() => setShowParticipantDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Participant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Full Name *"
                value={newParticipant.name}
                onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                fullWidth
                autoFocus
              />
              <TextField
                label="Email"
                type="email"
                value={newParticipant.email}
                onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                fullWidth
              />
              <TextField
                label="Phone Number"
                value={newParticipant.phone}
                onChange={(e) => setNewParticipant({ ...newParticipant, phone: e.target.value })}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowParticipantDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={addParticipant}>Add</Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
};

export default MeetingForm;