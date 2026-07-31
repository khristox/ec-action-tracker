// src/components/meetings/components/NotificationDialog.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
  TextField,
  Button,
  CircularProgress,
  alpha,
  useTheme,
  useMediaQuery,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
  Sms as SmsIcon,
  Send as SendIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { COLORS } from '../styles/colors';

// Security Constants & Whitelists
const ALLOWED_CHANNELS = ['email', 'whatsapp', 'sms'];
const MAX_MESSAGE_LENGTH = 1000;

export const NotificationDialog = ({ open, onClose, meeting, participants = [], onSend }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';

  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [notificationType, setNotificationType] = useState(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Theme-based colors
  const primaryMain = theme.palette.primary.main || COLORS.primary;
  const primaryDark = theme.palette.primary.dark || COLORS.primaryDark;
  const secondaryMain = theme.palette.secondary?.main || COLORS.secondary;

  const dialogBg = isDarkMode 
    ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';

  // Sanitize input participant IDs
  const validParticipantIds = useMemo(() => {
    if (!Array.isArray(participants)) return [];
    return participants
      .map((p) => p?.id)
      .filter((id) => id !== undefined && id !== null);
  }, [participants]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedParticipants([]);
      setNotificationType(['email']);
      setCustomMessage('');
    }
  }, [open]);

  // Derived state for Select All checkbox
  const isAllSelected = useMemo(() => {
    return (
      validParticipantIds.length > 0 &&
      selectedParticipants.length === validParticipantIds.length
    );
  }, [selectedParticipants, validParticipantIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants([...validParticipantIds]);
    }
  };

  const handleToggleParticipant = (id) => {
    if (!id) return;
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleChannel = (channelId) => {
    if (!ALLOWED_CHANNELS.includes(channelId)) return; // Whitelist check
    setNotificationType((prev) =>
      prev.includes(channelId)
        ? prev.filter((t) => t !== channelId)
        : [...prev, channelId]
    );
  };

  const handleSend = async () => {
    if (sending || selectedParticipants.length === 0 || notificationType.length === 0) {
      return;
    }

    setSending(true);

    try {
      // 1. Sanitize payload attributes strictly before sending
      const sanitizedMessage = customMessage.trim().slice(0, MAX_MESSAGE_LENGTH);
      
      const sanitizedChannels = notificationType.filter((t) =>
        ALLOWED_CHANNELS.includes(t)
      );

      // 2. Strip non-primitive payload references
      const payload = {
        participant_ids: selectedParticipants,
        notification_type: sanitizedChannels,
        custom_message: sanitizedMessage
      };

      await onSend(payload);
      handleClose();
    } catch (error) {
      console.error('Failed to send notifications:', error);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return; // Prevent closing mid-in-flight request
    setSelectedParticipants([]);
    setNotificationType(['email']);
    setCustomMessage('');
    onClose();
  };

  const getChannelColor = (type) => {
    switch (type) {
      case 'email': return '#3b82f6';
      case 'whatsapp': return '#25D366';
      case 'sms': return '#f59e0b';
      default: return primaryMain;
    }
  };

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return 'Date TBD';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';

    const formattedDate = date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    
    if (timeStr) {
      const time = new Date(timeStr);
      if (!isNaN(time.getTime())) {
        const formattedTime = time.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        return `${formattedDate} at ${formattedTime}`;
      }
    }
    
    return formattedDate;
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      fullScreen={isMobile}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 4,
          background: dialogBg,
          backdropFilter: 'blur(10px)',
          backgroundImage: 'none',
          boxShadow: isDarkMode 
            ? `0 8px 32px 0 ${alpha('#000', 0.8)}, inset 0 0 0 1px ${alpha(primaryMain, 0.1)}`
            : `0 8px 32px 0 ${alpha('#000', 0.1)}, inset 0 0 0 1px ${alpha('#fff', 0.8)}`,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 2, position: 'relative' }}>
        <Box sx={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: '4px',
          background: `linear-gradient(90deg, ${primaryMain}, ${secondaryMain})`
        }} />
        
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ 
              bgcolor: alpha(primaryMain, isDarkMode ? 0.2 : 0.1), 
              color: primaryMain,
              width: 48, 
              height: 48,
              border: `1px solid ${alpha(primaryMain, isDarkMode ? 0.3 : 0.2)}`
            }}>
              <NotificationsIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.02em', color: isDarkMode ? '#fff' : '#1e293b' }}>
                Notify Participants
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                {meeting?.title || 'Meeting Notification'}
              </Typography>
            </Box>
          </Stack>
          <IconButton 
            onClick={handleClose}
            disabled={sending}
            sx={{ 
              bgcolor: alpha(theme.palette.action.active, isDarkMode ? 0.1 : 0.05),
              '&:hover': { bgcolor: alpha(theme.palette.action.active, isDarkMode ? 0.2 : 0.1) }
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Stack spacing={4}>
          {meeting && (
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                borderRadius: 3,
                bgcolor: alpha(primaryMain, 0.05),
                borderColor: alpha(primaryMain, 0.2),
                borderWidth: '1px'
              }}
            >
              <Typography variant="caption" color="primary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Meeting Details
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                {meeting.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                📅 {formatDateTime(meeting.meeting_date, meeting.start_time)}
                {meeting.location_text && ` • 📍 ${meeting.location_text}`}
              </Typography>
            </Paper>
          )}

          {/* Broadcast Channels */}
          <Box>
            <Typography 
              variant="overline" 
              sx={{ 
                color: primaryMain, 
                fontWeight: 700, 
                mb: 1.5, 
                display: 'block',
                fontSize: '0.75rem',
                letterSpacing: '0.5px'
              }}
            >
              Broadcast Channels
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {[
                { id: 'email', label: 'Email', icon: <EmailIcon /> },
                { id: 'whatsapp', label: 'WhatsApp', icon: <WhatsAppIcon /> },
                { id: 'sms', label: 'SMS', icon: <SmsIcon /> }
              ].map((type) => {
                const isActive = notificationType.includes(type.id);
                const channelColor = getChannelColor(type.id);
                
                return (
                  <Chip
                    key={type.id}
                    icon={type.icon}
                    label={type.label}
                    onClick={() => handleToggleChannel(type.id)}
                    sx={{ 
                      borderRadius: '12px',
                      height: '40px',
                      px: 1,
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      bgcolor: isActive 
                        ? alpha(channelColor, isDarkMode ? 0.25 : 0.1)
                        : isDarkMode ? alpha('#fff', 0.05) : alpha('#000', 0.02),
                      color: isActive ? channelColor : 'text.secondary',
                      border: `1.5px solid ${isActive ? channelColor : alpha(theme.palette.divider, 0.3)}`,
                      '&:hover': { 
                        bgcolor: alpha(channelColor, isDarkMode ? 0.15 : 0.08),
                        transform: 'translateY(-1px)'
                      },
                      '& .MuiChip-icon': {
                        color: isActive ? channelColor : 'inherit'
                      }
                    }}
                  />
                );
              })}
            </Stack>
          </Box>

          {/* Participants */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography 
                variant="overline" 
                sx={{ 
                  color: primaryMain, 
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  letterSpacing: '0.5px'
                }}
              >
                Recipients ({selectedParticipants.length})
              </Typography>
              {validParticipantIds.length > 0 && (
                <Button
                  size="small"
                  onClick={handleToggleSelectAll}
                  disabled={sending}
                  sx={{ 
                    textTransform: 'none', 
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: primaryMain
                  }}
                >
                  {isAllSelected ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </Box>
            
            <Paper 
              variant="outlined" 
              sx={{ 
                maxHeight: isMobile ? 300 : 280, 
                borderRadius: 3,
                bgcolor: isDarkMode ? alpha('#0f172a', 0.6) : alpha('#ffffff', 0.6),
                borderColor: alpha(theme.palette.divider, 0.1),
                overflow: 'auto'
              }}
            >
              {participants?.length > 0 ? (
                participants.map((p, index) => {
                  const isSelected = selectedParticipants.includes(p.id);
                  return (
                    <React.Fragment key={p.id || index}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        sx={{ 
                          p: 2, 
                          transition: 'background 0.2s',
                          '&:hover': { 
                            bgcolor: alpha(primaryMain, isDarkMode ? 0.1 : 0.05),
                            cursor: 'pointer'
                          }
                        }}
                        onClick={() => handleToggleParticipant(p.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={sending}
                          sx={{ 
                            color: alpha(theme.palette.text.primary, 0.3),
                            '&.Mui-checked': { color: primaryMain }
                          }}
                        />
                        <Avatar sx={{ 
                          width: 36, 
                          height: 36, 
                          fontSize: '0.9rem', 
                          bgcolor: alpha(primaryMain, isDarkMode ? 0.2 : 0.1), 
                          color: primaryMain 
                        }}>
                          {p.name?.[0] || p.full_name?.[0] || p.email?.[0] || <PersonIcon fontSize="small" />}
                        </Avatar>
                        <Box sx={{ ml: 2, flex: 1 }}>
                          <Typography variant="body2" fontWeight={700} sx={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                            {p.name || p.full_name || p.email?.split('@')[0] || 'Unnamed Participant'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {p.email || p.phone || 'No contact info'}
                          </Typography>
                        </Box>
                        {isSelected && (
                          <CheckCircleIcon sx={{ fontSize: 18, color: primaryMain }} />
                        )}
                      </Stack>
                      {index < participants.length - 1 && (
                        <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.1) }} />
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <NotificationsIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No participants available for this meeting
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>

          {/* Custom Message Field with Length Constraints */}
          <TextField
            fullWidth
            label="Personalized Message (Optional)"
            placeholder="Add a custom note to your notification..."
            multiline
            rows={3}
            variant="outlined"
            value={customMessage}
            disabled={sending}
            onChange={(e) => setCustomMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            helperText={`${customMessage.length}/${MAX_MESSAGE_LENGTH} characters`}
            sx={{ 
              '& .MuiOutlinedInput-root': { 
                borderRadius: 3,
                bgcolor: isDarkMode ? alpha('#0f172a', 0.4) : alpha('#ffffff', 0.4),
                '&:hover': { bgcolor: isDarkMode ? alpha('#0f172a', 0.6) : alpha('#ffffff', 0.6) },
                '&.Mui-focused': { 
                  bgcolor: isDarkMode ? alpha('#0f172a', 0.6) : alpha('#ffffff', 0.8),
                  borderColor: primaryMain
                }
              }
            }}
          />
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button 
          onClick={handleClose} 
          disabled={sending}
          sx={{ color: 'text.secondary', fontWeight: 600 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={sending || selectedParticipants.length === 0 || notificationType.length === 0}
          startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
          sx={{ 
            borderRadius: '12px', 
            px: 4, 
            py: 1, 
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '0.9rem',
            background: `linear-gradient(135deg, ${primaryMain}, ${primaryDark})`
          }}
        >
          {sending ? 'Sending...' : `Send to ${selectedParticipants.length}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationDialog;