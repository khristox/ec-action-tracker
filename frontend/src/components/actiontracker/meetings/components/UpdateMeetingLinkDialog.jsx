import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Avatar,
  Tooltip,
  Divider,
  Grid,
  Paper,
  InputAdornment,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Close as CloseIcon,
  VideoCall as VideoCallIcon,
  Link as LinkIcon,
  ContentCopy as ContentCopyIcon,
  CheckCircle as CheckCircleIcon,
  Save as SaveIcon,
  Phone as PhoneIcon,
  Security as SecurityIcon,
  AccessTime as AccessTimeIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

const platformOptions = [
  { value: 'zoom', label: 'Zoom', icon: '🔵', color: '#0B5CFF', example: 'https://zoom.us/j/123456789' },
  { value: 'google_meet', label: 'Google Meet', icon: '🟢', color: '#0F9D58', example: 'https://meet.google.com/xxx-xxxx-xxx' },
  { value: 'microsoft_teams', label: 'Microsoft Teams', icon: '🟣', color: '#464EB8', example: 'https://teams.microsoft.com/l/meetup-join/...' },
  { value: 'webex', label: 'Cisco Webex', icon: '🔴', color: '#E31C3D', example: 'https://company.webex.com/meet/username' },
  { value: 'other', label: 'Other', icon: '🌐', color: '#8B5CF5', example: 'https://...' }
];

const UpdateMeetingLinkDialog = ({ open, onClose, meeting, onUpdate }) => {
  const [formData, setFormData] = useState({
    is_online: false,
    is_physical: false,
    platform: 'zoom',
    meeting_link: '',
    meeting_id: '',
    passcode: '',
    location_text: '',
    dial_in_numbers: [],
    send_reminders: true,
    reminder_minutes_before: 30,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newDialIn, setNewDialIn] = useState({ number: '', instructions: '' });

  // Initialize form with meeting data
  useEffect(() => {
    if (meeting && open) {
      setFormData({
        // A meeting is online if it has a link or platform assigned
        is_online: !!(meeting.meeting_link || meeting.platform && meeting.platform !== 'physical'),
        // A meeting is physical if it has location text
        is_physical: !!meeting.location_text,
        platform: meeting.platform && meeting.platform !== 'physical' ? meeting.platform : 'zoom',
        meeting_link: meeting.meeting_link || '',
        meeting_id: meeting.meeting_id || '',
        passcode: meeting.passcode || '',
        location_text: meeting.location_text || '',
        dial_in_numbers: meeting.dial_in_numbers || [],
        send_reminders: meeting.send_reminders !== undefined ? meeting.send_reminders : true,
        reminder_minutes_before: meeting.reminder_minutes_before || 30,
      });
    }
  }, [meeting, open]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleToggleMode = (mode) => {
    setFormData(prev => ({ ...prev, [mode]: !prev[mode] }));
    setError(null);
  };

  const handleAddDialInNumber = () => {
    if (newDialIn.number.trim()) {
      setFormData(prev => ({
        ...prev,
        dial_in_numbers: [...prev.dial_in_numbers, { ...newDialIn, id: Date.now() }]
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

  const handleCopyLink = () => {
    if (formData.meeting_link) {
      navigator.clipboard.writeText(formData.meeting_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTestLink = () => {
    if (formData.meeting_link) {
      let url = formData.meeting_link.trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      window.open(url, '_blank');
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.is_online && !formData.is_physical) {
      setError('Please select at least one meeting mode (Online or Physical)');
      return;
    }

    if (formData.is_online && !formData.meeting_link.trim()) {
      setError('Please enter a meeting link for the online portion');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        platform: formData.is_online ? formData.platform : null,
        meeting_link: formData.is_online ? formData.meeting_link : null,
        meeting_id: formData.is_online ? formData.meeting_id : null,
        passcode: formData.is_online ? formData.passcode : null,
        location_text: formData.is_physical ? formData.location_text : null,
        dial_in_numbers: formData.dial_in_numbers,
        send_reminders: formData.send_reminders,
        reminder_minutes_before: formData.reminder_minutes_before,
      };

      const response = await api.patch(`/action-tracker/meetings/${meeting.id}`, payload);

      setSuccess(true);
      if (onUpdate) onUpdate(response.data);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update meeting');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlatform = platformOptions.find(opt => opt.value === formData.platform);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1, bgcolor: '#f8fafc' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
              <VideoCallIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Update Meeting Settings</Typography>
              <Typography variant="caption" color="text.secondary">Configure how participants will join</Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} disabled={loading}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers sx={{ pt: 3 }}>
        <Stack spacing={4}>
          
          {/* 1. Mode Selection (Toggles) */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Meeting Type (Select all that apply)</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Paper
                  variant="outlined"
                  onClick={() => handleToggleMode('is_online')}
                  sx={{
                    p: 2, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                    borderColor: formData.is_online ? 'primary.main' : '#e0e0e0',
                    bgcolor: formData.is_online ? 'primary.50' : 'transparent',
                    borderWidth: formData.is_online ? 2 : 1,
                    '&:hover': { transform: 'translateY(-2px)', bgcolor: formData.is_online ? 'primary.50' : '#f8fafc' }
                  }}
                >
                  <VideoCallIcon color={formData.is_online ? "primary" : "disabled"} sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="body1" fontWeight={700}>Online Meeting</Typography>
                  <Typography variant="caption" color="text.secondary">Zoom, Meet, Teams, etc.</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper
                  variant="outlined"
                  onClick={() => handleToggleMode('is_physical')}
                  sx={{
                    p: 2, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                    borderColor: formData.is_physical ? 'secondary.main' : '#e0e0e0',
                    bgcolor: formData.is_physical ? '#faf5ff' : 'transparent',
                    borderWidth: formData.is_physical ? 2 : 1,
                    '&:hover': { transform: 'translateY(-2px)', bgcolor: formData.is_physical ? '#faf5ff' : '#f8fafc' }
                  }}
                >
                  <LocationIcon color={formData.is_physical ? "secondary" : "disabled"} sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="body1" fontWeight={700}>Physical Meeting</Typography>
                  <Typography variant="caption" color="text.secondary">Conference Room, Office, etc.</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          {/* 2. Online Section */}
          {formData.is_online && (
            <Box sx={{ p: 2.5, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fbfbff' }}>
              <Stack spacing={2.5}>
                <Typography variant="subtitle1" fontWeight={700} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VideoCallIcon fontSize="small" /> Online Configuration
                </Typography>
                
                <FormControl fullWidth size="small">
                  <InputLabel>Platform</InputLabel>
                  <Select
                    value={formData.platform}
                    label="Platform"
                    onChange={(e) => handleChange('platform', e.target.value)}
                  >
                    {platformOptions.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>
                        <Box component="span" sx={{ mr: 1 }}>{opt.icon}</Box> {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Meeting Link"
                  placeholder={selectedPlatform?.example}
                  value={formData.meeting_link}
                  onChange={(e) => handleChange('meeting_link', e.target.value)}
                  InputProps={{
                    endAdornment: formData.meeting_link && (
                      <InputAdornment position="end">
                        <IconButton onClick={handleCopyLink} size="small">
                          {copied ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField 
                      fullWidth label="Meeting ID" size="small" 
                      value={formData.meeting_id} 
                      onChange={(e) => handleChange('meeting_id', e.target.value)} 
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField 
                      fullWidth label="Passcode" size="small" 
                      value={formData.passcode} 
                      onChange={(e) => handleChange('passcode', e.target.value)} 
                    />
                  </Grid>
                </Grid>

                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom>Dial-in Numbers</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <TextField 
                      size="small" placeholder="Number" sx={{ flex: 1 }} 
                      value={newDialIn.number} 
                      onChange={(e) => setNewDialIn({...newDialIn, number: e.target.value})}
                    />
                    <Button variant="outlined" size="small" onClick={handleAddDialInNumber} startIcon={<AddIcon />}>Add</Button>
                  </Stack>
                  <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
                    {formData.dial_in_numbers.map((dial, idx) => (
                      <Chip key={idx} label={dial.number} size="small" onDelete={() => handleRemoveDialInNumber(idx)} />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          )}

          {/* 3. Physical Section */}
          {formData.is_physical && (
            <Box sx={{ p: 2.5, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fdfbff' }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={700} color="secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationIcon fontSize="small" /> Physical Location
                </Typography>
                <TextField
                  fullWidth
                  label="Address / Room Name"
                  placeholder="e.g. Building A, Room 302"
                  value={formData.location_text}
                  onChange={(e) => handleChange('location_text', e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><LocationIcon color="action" /></InputAdornment>
                  }}
                />
              </Stack>
            </Box>
          )}

          {/* 4. Global Settings */}
          <Box>
            <Divider sx={{ mb: 2 }}><Chip label="Notifications" size="small" /></Divider>
            <FormControlLabel
              control={<Switch checked={formData.send_reminders} onChange={(e) => handleChange('send_reminders', e.target.checked)} />}
              label="Send automatic email reminders to participants"
            />
            {formData.send_reminders && (
              <Box sx={{ mt: 1, ml: 4 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Timing</InputLabel>
                  <Select
                    value={formData.reminder_minutes_before}
                    label="Timing"
                    onChange={(e) => handleChange('reminder_minutes_before', e.target.value)}
                  >
                    <MenuItem value={15}>15 minutes before</MenuItem>
                    <MenuItem value={30}>30 minutes before</MenuItem>
                    <MenuItem value={60}>1 hour before</MenuItem>
                    <MenuItem value={1440}>1 day before</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>

          {success && <Alert severity="success">Changes saved successfully!</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Stack direction="row" spacing={1}>
          {formData.is_online && formData.meeting_link && (
            <Button variant="outlined" onClick={handleTestLink} startIcon={<LinkIcon />}>Test Link</Button>
          )}
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            sx={{ minWidth: 120 }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateMeetingLinkDialog;