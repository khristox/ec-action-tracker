// src/components/actiontracker/meetings/NotificationDialog.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Alert, CircularProgress,
  List, ListItem, ListItemAvatar, Avatar, ListItemText,
  Chip, Divider, TextField, FormControlLabel, Switch
} from '@mui/material';
import {
  Send as SendIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
  Sms as SmsIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const NotificationDialog = ({ open, onClose, meeting, participants }) => {
  const [sending, setSending] = useState(false);
  const [notificationType, setNotificationType] = useState(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [error, setError] = useState(null);

  const getMeetingInfo = () => {
    let info = `**${meeting.title}**\n\n`;
    info += `📅 Date: ${new Date(meeting.meeting_date).toLocaleString()}\n`;
    if (meeting.location) info += `📍 Location: ${meeting.location}\n`;
    if (meeting.meeting_link) info += `🔗 Link: ${meeting.meeting_link}\n`;
    if (meeting.meeting_id) info += `🆔 Meeting ID: ${meeting.meeting_id}\n`;
    if (meeting.passcode) info += `🔐 Passcode: ${meeting.passcode}\n`;
    if (meeting.dial_in_numbers?.length) {
      info += `\n📞 Dial-in Numbers:\n`;
      meeting.dial_in_numbers.forEach(dial => {
        info += `  • ${dial.number}${dial.instructions ? ` (${dial.instructions})` : ''}\n`;
      });
    }
    return info;
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);
    
    try {
      await api.post(`/meetings/${meeting.id}/notify-participants`, {
        participant_ids: participants.map(p => p.id),
        notification_type: notificationType,
        custom_message: customMessage,
        meeting_details: getMeetingInfo()
      });
      
      onClose();
      alert('Notifications sent successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send notifications');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <SendIcon color="primary" />
          <Typography variant="h6">Send Meeting Notifications</Typography>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Stack spacing={3}>
          <Alert severity="info">
            Sending notifications to {participants.length} participant(s)
          </Alert>
          
          <List dense>
            {participants.map((participant) => (
              <ListItem key={participant.id}>
                <ListItemAvatar>
                  <Avatar>
                    <PersonIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={participant.full_name || participant.username}
                  secondary={participant.email}
                />
              </ListItem>
            ))}
          </List>
          
          <Divider />
          
          <Stack direction="row" spacing={2}>
            <Chip
              icon={<EmailIcon />}
              label="Email"
              color={notificationType.includes('email') ? 'primary' : 'default'}
              onClick={() => {
                if (notificationType.includes('email')) {
                  setNotificationType(notificationType.filter(t => t !== 'email'));
                } else {
                  setNotificationType([...notificationType, 'email']);
                }
              }}
            />
            <Chip
              icon={<WhatsAppIcon />}
              label="WhatsApp"
              color={notificationType.includes('whatsapp') ? 'primary' : 'default'}
              onClick={() => {
                if (notificationType.includes('whatsapp')) {
                  setNotificationType(notificationType.filter(t => t !== 'whatsapp'));
                } else {
                  setNotificationType([...notificationType, 'whatsapp']);
                }
              }}
            />
            <Chip
              icon={<SmsIcon />}
              label="SMS"
              color={notificationType.includes('sms') ? 'primary' : 'default'}
              onClick={() => {
                if (notificationType.includes('sms')) {
                  setNotificationType(notificationType.filter(t => t !== 'sms'));
                } else {
                  setNotificationType([...notificationType, 'sms']);
                }
              }}
            />
          </Stack>
          
          <TextField
            label="Custom Message (Optional)"
            multiline
            rows={4}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add any additional information for participants..."
            helperText="This will be added to the automatic meeting details"
          />
          
          <Alert severity="info" variant="outlined">
            <Typography variant="subtitle2" gutterBottom>Meeting Details to be sent:</Typography>
            <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
              {getMeetingInfo()}
            </pre>
          </Alert>
        </Stack>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={sending || participants.length === 0}
          startIcon={sending ? <CircularProgress size={20} /> : <SendIcon />}
        >
          {sending ? 'Sending...' : `Send to ${participants.length} Participant(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationDialog;