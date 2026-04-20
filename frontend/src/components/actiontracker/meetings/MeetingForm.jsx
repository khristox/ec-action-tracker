// src/components/actiontracker/meetings/MeetingForm.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Box, Typography, IconButton,
  FormControl, InputLabel, Select, MenuItem, Chip,
  Alert, Divider, Switch, FormControlLabel, Grid,
  Card, CardContent, Tooltip, Collapse, InputAdornment
} from '@mui/material';
import {
  Close as CloseIcon,
  ZoomIn as ZoomIcon,
  VideoCall as GoogleMeetIcon,
  MeetingRoom as TeamsIcon,
  PersonPin as PhysicalIcon,
  NotificationsActive as NotificationIcon,
  AccessTime as TimeIcon,
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Link as LinkIcon,
  Phone as PhoneIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import api from '../../../services/api';
import ParticipantSelector from './ParticipantSelector';

const meetingPlatforms = [
  { value: 'zoom', label: 'Zoom', icon: <ZoomIcon />, color: '#0B5CFF' },
  { value: 'google_meet', label: 'Google Meet', icon: <GoogleMeetIcon />, color: '#34A853' },
  { value: 'microsoft_teams', label: 'Microsoft Teams', icon: <TeamsIcon />, color: '#6264A7' },
  { value: 'physical', label: 'Physical Meeting', icon: <PhysicalIcon />, color: '#6B7280' },
  { value: 'other', label: 'Other', icon: <LinkIcon />, color: '#F59E0B' }
];

const MeetingForm = ({ open, onClose, onSave, editingMeeting, initialData }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: new Date(),
    location: '',
    platform: 'physical',
    meeting_link: '',
    meeting_id: '',
    passcode: '',
    dial_in_numbers: [],
    send_reminders: true,
    reminder_minutes_before: 30,
    participants: []
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newDialIn, setNewDialIn] = useState({ number: '', instructions: '' });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePlatformChange = (platform) => {
    setFormData(prev => ({ ...prev, platform }));
    
    // Auto-generate meeting link based on platform
    if (platform === 'zoom') {
      generateZoomLink();
    } else if (platform === 'google_meet') {
      generateGoogleMeetLink();
    }
  };

  const generateZoomLink = async () => {
    try {
      // Call your backend to create a Zoom meeting
      const response = await api.post('/meetings/create-zoom-meeting', {
        topic: formData.title,
        start_time: formData.meeting_date,
        duration: 60
      });
      
      setFormData(prev => ({
        ...prev,
        meeting_link: response.data.join_url,
        meeting_id: response.data.id,
        passcode: response.data.password
      }));
    } catch (err) {
      console.error('Failed to create Zoom meeting:', err);
    }
  };

  const generateGoogleMeetLink = () => {
    // Generate a Google Meet link (you might need to use Google Calendar API)
    const meetLink = `https://meet.google.com/new`;
    setFormData(prev => ({ ...prev, meeting_link: meetLink }));
  };

  const handleCopyLink = () => {
    if (formData.meeting_link) {
      navigator.clipboard.writeText(formData.meeting_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddDialInNumber = () => {
    if (newDialIn.number) {
      setFormData(prev => ({
        ...prev,
        dial_in_numbers: [...prev.dial_in_numbers, newDialIn]
      }));
      setNewDialIn({ number: '', instructions: '' });
    }
  };

  const handleRemoveDialInNumber = (index) => {
    setFormData(prev => ({
      ...prev,
      dial_in_numbers: prev.dial_in_numbers.filter((_, i) => i !== index)
    }));
  };

  const handleSendNotification = async () => {
    setLoading(true);
    try {
      await api.post(`/meetings/${editingMeeting?.id}/notify-participants`, {
        participants: formData.participants,
        meeting_details: {
          title: formData.title,
          date: formData.meeting_date,
          platform: formData.platform,
          meeting_link: formData.meeting_link,
          meeting_id: formData.meeting_id,
          passcode: formData.passcode,
          location: formData.location
        }
      });
      alert('Notifications sent successfully!');
    } catch (err) {
      setError('Failed to send notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setError('Meeting title is required');
      return;
    }
    
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save meeting');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlatform = meetingPlatforms.find(p => p.value === formData.platform);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={600}>
            {editingMeeting ? 'Edit Meeting' : 'Create New Meeting'}
          </Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        
        <Stack spacing={3}>
          {/* Basic Information */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Basic Information
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Meeting Title *"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g., Weekly Sprint Planning"
                />
                
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={2}
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Meeting agenda and objectives..."
                />
                
                <DateTimePicker
                  label="Meeting Date & Time"
                  value={formData.meeting_date}
                  onChange={(date) => handleChange('meeting_date', date)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Stack>
            </CardContent>
          </Card>
          
          {/* Meeting Platform */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Meeting Platform
              </Typography>
              
              <Grid container spacing={1} sx={{ mb: 2 }}>
                {meetingPlatforms.map((platform) => (
                  <Grid size={{ xs: 6, sm: 2.4 }} key={platform.value}>
                    <Card
                      variant={formData.platform === platform.value ? 'elevation' : 'outlined'}
                      elevation={formData.platform === platform.value ? 2 : 0}
                      sx={{
                        cursor: 'pointer',
                        textAlign: 'center',
                        p: 1.5,
                        bgcolor: formData.platform === platform.value ? alpha(platform.color, 0.1) : 'transparent',
                        borderColor: formData.platform === platform.value ? platform.color : '#e0e0e0',
                        '&:hover': { bgcolor: alpha(platform.color, 0.05) }
                      }}
                      onClick={() => handlePlatformChange(platform.value)}
                    >
                      <Box sx={{ color: platform.color, mb: 0.5 }}>
                        {platform.icon}
                      </Box>
                      <Typography variant="caption" fontWeight={500}>
                        {platform.label}
                      </Typography>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              
              {/* Platform-specific fields */}
              <Collapse in={formData.platform !== 'physical'}>
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <TextField
                    fullWidth
                    label="Meeting Link"
                    value={formData.meeting_link}
                    onChange={(e) => handleChange('meeting_link', e.target.value)}
                    placeholder="https://..."
                    InputProps={{
                      endAdornment: formData.meeting_link && (
                        <InputAdornment position="end">
                          <Tooltip title={copied ? "Copied!" : "Copy Link"}>
                            <IconButton onClick={handleCopyLink}>
                              {copied ? <CheckIcon color="success" /> : <CopyIcon />}
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      )
                    }}
                  />
                  
                  <Stack direction="row" spacing={2}>
                    <TextField
                      fullWidth
                      label="Meeting ID"
                      value={formData.meeting_id}
                      onChange={(e) => handleChange('meeting_id', e.target.value)}
                    />
                    <TextField
                      fullWidth
                      label="Passcode"
                      value={formData.passcode}
                      onChange={(e) => handleChange('passcode', e.target.value)}
                      type="password"
                    />
                  </Stack>
                  
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Dial-in Numbers
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                      <TextField
                        size="small"
                        placeholder="Phone number"
                        value={newDialIn.number}
                        onChange={(e) => setNewDialIn({ ...newDialIn, number: e.target.value })}
                      />
                      <TextField
                        size="small"
                        placeholder="Instructions (optional)"
                        value={newDialIn.instructions}
                        onChange={(e) => setNewDialIn({ ...newDialIn, instructions: e.target.value })}
                      />
                      <Button onClick={handleAddDialInNumber} startIcon={<AddIcon />}>
                        Add
                      </Button>
                    </Stack>
                    
                    <Stack spacing={1}>
                      {formData.dial_in_numbers.map((dial, idx) => (
                        <Chip
                          key={idx}
                          icon={<PhoneIcon />}
                          label={`${dial.number} ${dial.instructions ? `- ${dial.instructions}` : ''}`}
                          onDelete={() => handleRemoveDialInNumber(idx)}
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </Collapse>
              
              <Collapse in={formData.platform === 'physical'}>
                <TextField
                  fullWidth
                  label="Location"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="Building, Room Number, Address..."
                  sx={{ mt: 2 }}
                />
              </Collapse>
            </CardContent>
          </Card>
          
          {/* Participants */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Participants
              </Typography>
              <ParticipantSelector
                value={formData.participants}
                onChange={(participants) => handleChange('participants', participants)}
                meetingId={editingMeeting?.id}
              />
            </CardContent>
          </Card>
          
          {/* Advanced Settings */}
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight={600}>
                  Notification Settings
                </Typography>
                <Button
                  size="small"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  endIcon={showAdvanced ? <CloseIcon /> : <AddIcon />}
                >
                  {showAdvanced ? 'Less' : 'More'}
                </Button>
              </Stack>
              
              <Collapse in={showAdvanced}>
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.send_reminders}
                        onChange={(e) => handleChange('send_reminders', e.target.checked)}
                      />
                    }
                    label="Send email reminders to participants"
                  />
                  
                  <FormControl fullWidth>
                    <InputLabel>Send Reminder</InputLabel>
                    <Select
                      value={formData.reminder_minutes_before}
                      onChange={(e) => handleChange('reminder_minutes_before', e.target.value)}
                      label="Send Reminder"
                      disabled={!formData.send_reminders}
                    >
                      <MenuItem value={15}>15 minutes before</MenuItem>
                      <MenuItem value={30}>30 minutes before</MenuItem>
                      <MenuItem value={60}>1 hour before</MenuItem>
                      <MenuItem value={120}>2 hours before</MenuItem>
                      <MenuItem value={1440}>1 day before</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Collapse>
            </CardContent>
          </Card>
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<NotificationIcon />}
          onClick={handleSendNotification}
          disabled={!editingMeeting || formData.participants.length === 0}
        >
          Send Notifications ({formData.participants.length})
        </Button>
        
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !formData.title.trim()}
          >
            {loading ? 'Saving...' : (editingMeeting ? 'Update Meeting' : 'Create Meeting')}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default MeetingForm;