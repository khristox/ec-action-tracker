// src/components/actiontracker/meetings/NotificationDialog.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Typography,
  IconButton,
  Paper,
  Chip,
  Box,
  Avatar,
  Checkbox,
  FormControlLabel,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Badge,
  LinearProgress,
  Backdrop,
  Fade
} from '@mui/material';
import {
  Close as CloseIcon,
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
  Sms as SmsIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

function NotificationDialog({ open, onClose, meeting, participants, onSend }) {
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [notificationType, setNotificationType] = useState(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendStatus, setSendStatus] = useState('idle'); // idle, sending, success, error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (open && participants && participants.length > 0 && !isInitialized) {
      setSelectedParticipants(participants.map(p => p.id));
      setSelectAll(true);
      setIsInitialized(true);
      // Reset status when dialog opens
      setSendStatus('idle');
      setErrorMessage('');
      setSendProgress(0);
    }
    
    if (!open) {
      setIsInitialized(false);
      setCustomMessage('');
      setNotificationType(['email']);
      setSelectedParticipants([]);
      setSelectAll(false);
      setSendStatus('idle');
      setErrorMessage('');
      setSendProgress(0);
    }
  }, [open, participants, isInitialized]);

  useEffect(() => {
    if (participants && participants.length > 0 && open) {
      setSelectAll(selectedParticipants.length === participants.length);
    }
  }, [selectedParticipants, participants, open]);

  // Simulate progress for better UX
  useEffect(() => {
    let interval;
    if (sending) {
      interval = setInterval(() => {
        setSendProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 300);
    } else if (sendStatus === 'success') {
      setSendProgress(100);
    }
    return () => clearInterval(interval);
  }, [sending, sendStatus]);

  const handleToggleParticipant = useCallback((participantId) => {
    setSelectedParticipants(prev => 
      prev.includes(participantId) 
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(participants.map(p => p.id));
    }
    setSelectAll(!selectAll);
  }, [selectAll, participants]);

  const handleNotificationTypeToggle = useCallback((type) => {
    setNotificationType(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  }, []);

  const handleCustomMessageChange = useCallback((e) => {
    setCustomMessage(e.target.value);
  }, []);

  const handleSend = useCallback(async () => {
    if (selectedParticipants.length === 0 || notificationType.length === 0) {
      setErrorMessage('Please select participants and at least one notification method');
      return;
    }

    const notificationData = {
      participant_ids: selectedParticipants,
      notification_type: notificationType,
      custom_message: customMessage
    };

    setSending(true);
    setSendStatus('sending');
    setSendProgress(0);
    setErrorMessage('');
    
    try {
      await onSend(notificationData);
      setSendStatus('success');
      setSendProgress(100);
      
      // Close dialog after 1.5 seconds on success
      setTimeout(() => {
        onClose();
        // Reset after close
        setSending(false);
        setSendStatus('idle');
        setSendProgress(0);
      }, 1500);
    } catch (error) {
      console.error('Failed to send notifications:', error);
      setSendStatus('error');
      setErrorMessage(error.response?.data?.detail || error.message || 'Failed to send notifications');
      setSending(false);
      
      // Auto clear error after 5 seconds
      setTimeout(() => {
        setSendStatus('idle');
        setErrorMessage('');
      }, 5000);
    }
  }, [selectedParticipants, notificationType, customMessage, onSend, onClose]);

  // Safe check for participants
  const hasParticipants = participants && Array.isArray(participants) && participants.length > 0;

  return (
    <Dialog 
      open={open} 
      onClose={!sending ? onClose : null} 
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown={sending}
    >
      {/* Loading Overlay */}
      <Backdrop
        sx={{
          position: 'absolute',
          zIndex: 1,
          color: '#fff',
          borderRadius: 2,
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }}
        open={sending && sendStatus === 'sending'}
      >
        <Fade in={sending && sendStatus === 'sending'}>
          <Stack spacing={2} alignItems="center" sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress size={48} />
            <Typography variant="h6" sx={{ color: 'white' }}>
              Sending Notifications...
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Please wait while we send notifications
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={sendProgress} 
              sx={{ width: 200, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }}
            />
          </Stack>
        </Fade>
      </Backdrop>

      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Badge badgeContent={selectedParticipants.length} color="primary">
              <NotificationsIcon color="primary" />
            </Badge>
            <Typography variant="h6" fontWeight={700}>
              Send Meeting Notifications
            </Typography>
          </Stack>
          <IconButton onClick={onClose} size="small" disabled={sending}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Success Alert */}
          {sendStatus === 'success' && (
            <Alert 
              icon={<CheckCircleIcon fontSize="inherit" />} 
              severity="success"
              sx={{ mb: 2 }}
            >
              <strong>Success!</strong> Notifications have been sent successfully!
            </Alert>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <Alert 
              icon={<ErrorIcon fontSize="inherit" />} 
              severity="error"
              onClose={() => setErrorMessage('')}
              sx={{ mb: 2 }}
            >
              <strong>Error:</strong> {errorMessage}
            </Alert>
          )}

          {/* Meeting Info */}
          <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom color="primary">
              {meeting?.title || 'Meeting Title'}
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                📅 {meeting?.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : 'Date TBD'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                👥 {hasParticipants ? participants.length : 0} participant{hasParticipants && participants.length !== 1 ? 's' : ''}
              </Typography>
              {meeting?.meeting_link && (
                <Typography variant="caption" color="text.secondary">
                  🔗 Meeting link available
                </Typography>
              )}
            </Stack>
          </Paper>

          {/* Notification Types */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Send via
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<EmailIcon />}
                label="Email"
                color={notificationType.includes('email') ? 'primary' : 'default'}
                onClick={() => !sending && handleNotificationTypeToggle('email')}
                disabled={sending}
                sx={{ '& .MuiChip-label': { fontWeight: 600 } }}
              />
              <Chip
                icon={<WhatsAppIcon />}
                label="WhatsApp"
                color={notificationType.includes('whatsapp') ? 'primary' : 'default'}
                onClick={() => !sending && handleNotificationTypeToggle('whatsapp')}
                disabled={sending}
                sx={{ '& .MuiChip-label': { fontWeight: 600 } }}
              />
              <Chip
                icon={<SmsIcon />}
                label="SMS"
                color={notificationType.includes('sms') ? 'primary' : 'default'}
                onClick={() => !sending && handleNotificationTypeToggle('sms')}
                disabled={sending}
                sx={{ '& .MuiChip-label': { fontWeight: 600 } }}
              />
            </Stack>
            {notificationType.length === 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Please select at least one notification method
              </Alert>
            )}
          </Box>

          {/* Participants Selection */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                Select Participants
              </Typography>
              {hasParticipants && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectAll}
                      onChange={handleSelectAll}
                      size="small"
                      disabled={sending}
                    />
                  }
                  label="Select All"
                  sx={{ '& .MuiTypography-root': { fontSize: '0.8rem', fontWeight: 500 } }}
                />
              )}
            </Stack>
            
            {!hasParticipants ? (
              <Alert severity="info">
                No participants found. Please add participants to the meeting first.
              </Alert>
            ) : (
              <Paper variant="outlined" sx={{ maxHeight: 320, overflow: 'auto', borderRadius: 2 }}>
                {participants.map((participant) => (
                  <Stack
                    key={participant.id}
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{ 
                      p: 1.5, 
                      borderBottom: '1px solid #f0f0f0',
                      '&:hover': { bgcolor: '#fafafa' },
                      opacity: sending ? 0.6 : 1
                    }}
                  >
                    <Checkbox
                      checked={selectedParticipants.includes(participant.id)}
                      onChange={() => !sending && handleToggleParticipant(participant.id)}
                      size="small"
                      disabled={sending}
                    />
                    <Avatar sx={{ width: 36, height: 36, bgcolor: '#6366f1', color: 'white' }}>
                      {participant.full_name?.[0] || participant.name?.[0] || participant.username?.[0] || '?'}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {participant.name || participant.full_name || participant.username || 'Unknown'}
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mt: 0.5 }}>
                        {participant.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 12, color: '#666' }} />
                            <Typography variant="caption" color="text.secondary">
                              {participant.email}
                            </Typography>
                          </Box>
                        )}
                        {(participant.telephone || participant.phone || participant.mobile) && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <SmsIcon sx={{ fontSize: 12, color: '#666' }} />
                            <Typography variant="caption" color="text.secondary">
                              {participant.telephone || participant.phone || participant.mobile}
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </Box>
                    {participant.is_chairperson && (
                      <Chip 
                        label="Chair" 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    )}
                  </Stack>
                ))}
              </Paper>
            )}
          </Box>

          {/* Custom Message */}
          <TextField
            label="Custom Message (Optional)"
            multiline
            rows={3}
            value={customMessage}
            onChange={handleCustomMessageChange}
            placeholder="Add any additional information for participants..."
            fullWidth
            disabled={sending}
            helperText="This message will be included along with the meeting details"
          />

          {/* Summary */}
          {selectedParticipants.length > 0 && notificationType.length > 0 && !sending && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <strong>Summary:</strong> Will send {notificationType.join(', ')} notification(s) to {selectedParticipants.length} participant(s).
              {customMessage && ' Custom message will be included.'}
            </Alert>
          )}

          {/* Sending Indicator (inline) */}
          {sending && sendStatus === 'sending' && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={sendProgress} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                Sending... {sendProgress}%
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5 }}>
        <Button 
          onClick={onClose} 
          variant="outlined" 
          disabled={sending}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={sending || selectedParticipants.length === 0 || notificationType.length === 0}
          startIcon={sending ? <CircularProgress size={20} /> : <SendIcon />}
          sx={{ minWidth: 180 }}
        >
          {sending ? 'Sending...' : `Send to ${selectedParticipants.length} Participant(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NotificationDialog;