// src/components/actiontracker/meetings/UpdateMeetingLinkDialog.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Typography,
  IconButton,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Link
} from '@mui/material';
import {
  Close as CloseIcon,
  Link as LinkIcon,
  VideoCall as VideoCallIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

const UpdateMeetingLinkDialog = ({ open, onClose, meeting, onUpdate }) => {
  const [platform, setPlatform] = useState(meeting?.platform || 'zoom');
  const [meetingLink, setMeetingLink] = useState(meeting?.meeting_link || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const platformOptions = [
    { value: 'zoom', label: 'Zoom', icon: '🔵' },
    { value: 'google_meet', label: 'Google Meet', icon: '🟢' },
    { value: 'microsoft_teams', label: 'Microsoft Teams', icon: '🟣' },
    { value: 'webex', label: 'Cisco Webex', icon: '🔴' },
    { value: 'other', label: 'Other', icon: '🌐' }
  ];

  const getPlatformIcon = (platformValue) => {
    const option = platformOptions.find(opt => opt.value === platformValue);
    return option ? option.icon : '🔗';
  };

  const handleSubmit = async () => {
    if (!meetingLink.trim()) {
      setError('Please enter a meeting link');
      return;
    }

    // Basic URL validation
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlPattern.test(meetingLink)) {
      setError('Please enter a valid URL (e.g., https://zoom.us/j/123456789)');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await api.patch(`/action-tracker/meetings/${meeting.id}`, {
        platform: platform,
        meeting_link: meetingLink
      });

      setSuccess(true);
      if (onUpdate) {
        onUpdate(response.data);
      }
      
      // Close dialog after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to update meeting link:', err);
      setError(err.response?.data?.detail || 'Failed to update meeting link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestLink = () => {
    if (meetingLink && meetingLink.trim()) {
      let url = meetingLink.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      window.open(url, '_blank');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <VideoCallIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>Update Meeting Link</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small" disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Current Meeting Info */}
          <Alert severity="info" icon={<LinkIcon />}>
            <Typography variant="body2" fontWeight={600}>
              Current Meeting: {meeting?.title}
            </Typography>
            {meeting?.meeting_link && (
              <Link 
                href={meeting.meeting_link} 
                target="_blank" 
                sx={{ fontSize: '0.875rem', mt: 0.5, display: 'inline-block' }}
              >
                Current Link: {meeting.meeting_link}
              </Link>
            )}
          </Alert>

          {/* Platform Selection */}
          <FormControl fullWidth>
            <InputLabel>Meeting Platform</InputLabel>
            <Select
              value={platform}
              label="Meeting Platform"
              onChange={(e) => setPlatform(e.target.value)}
              disabled={loading}
            >
              {platformOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body1">{option.icon}</Typography>
                    <Typography>{option.label}</Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Meeting Link Input */}
          <TextField
            fullWidth
            label="Meeting Link"
            placeholder="https://zoom.us/j/123456789"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            disabled={loading}
            helperText="Enter the full URL for the meeting (e.g., Zoom, Google Meet, Teams link)"
            error={!!error}
          />

          {/* Quick Tips */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc' }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              💡 Quick Tips:
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                • Zoom: https://zoom.us/j/123456789
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Google Meet: https://meet.google.com/xxx-xxxx-xxx
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Microsoft Teams: https://teams.microsoft.com/l/meetup-join/...
              </Typography>
            </Stack>
          </Paper>

          {/* Error/Success Messages */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success">
              ✓ Meeting link updated successfully!
            </Alert>
          )}
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          onClick={handleTestLink}
          disabled={loading || !meetingLink.trim()}
          startIcon={<LinkIcon />}
        >
          Test Link
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !meetingLink.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {loading ? 'Updating...' : 'Update Meeting Link'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateMeetingLinkDialog;