import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
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

function NotificationDialog({ open, onClose, meeting, participants, onSend }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [notificationType, setNotificationType] = useState(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  // Get theme-based colors
  const primaryMain = theme.palette.primary.main;
  const primaryLight = theme.palette.primary.light;
  const primaryDark = theme.palette.primary.dark;
  const secondaryMain = theme.palette.secondary.main;
  
  // Dialog background based on mode
  const dialogBg = isDarkMode 
    ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';

  // Handle select all
  useEffect(() => {
    if (selectAll && participants) {
      setSelectedParticipants(participants.map(p => p.id));
    } else if (!selectAll) {
      setSelectedParticipants([]);
    }
  }, [selectAll, participants]);

  // Update selectAll when selections change
  useEffect(() => {
    if (participants && participants.length > 0) {
      setSelectAll(selectedParticipants.length === participants.length);
    }
  }, [selectedParticipants, participants]);

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend({
        participant_ids: selectedParticipants,
        notification_type: notificationType,
        custom_message: customMessage
      });
      // Reset form
      setSelectedParticipants([]);
      setNotificationType(['email']);
      setCustomMessage('');
      setSelectAll(false);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setSelectedParticipants([]);
    setNotificationType(['email']);
    setCustomMessage('');
    setSelectAll(false);
    onClose();
  };

  const getChannelIcon = (type) => {
    switch(type) {
      case 'email': return <EmailIcon />;
      case 'whatsapp': return <WhatsAppIcon />;
      case 'sms': return <SmsIcon />;
      default: return <SendIcon />;
    }
  };

  const getChannelColor = (type) => {
    switch(type) {
      case 'email': return '#3b82f6';
      case 'whatsapp': return '#25D366';
      case 'sms': return '#f59e0b';
      default: return primaryMain;
    }
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
      {/* Header with Gradient Accent */}
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
          {/* Delivery Methods */}
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
                    onClick={() => setNotificationType(prev => 
                      isActive ? prev.filter(t => t !== type.id) : [...prev, type.id]
                    )}
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

          {/* Participant List */}
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
              {participants && participants.length > 0 && (
                <Button
                  size="small"
                  onClick={() => setSelectAll(!selectAll)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  {selectAll ? 'Deselect All' : 'Select All'}
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
                overflow: 'auto',
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: alpha(theme.palette.divider, 0.1),
                  borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: alpha(theme.palette.divider, 0.3),
                  borderRadius: '3px',
                  '&:hover': {
                    background: alpha(theme.palette.divider, 0.5),
                  }
                }
              }}
            >
              {participants?.length > 0 ? (
                participants.map((p, index) => (
                  <React.Fragment key={p.id}>
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
                      onClick={() => setSelectedParticipants(prev => 
                        prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id]
                      )}
                    >
                      <Checkbox
                        checked={selectedParticipants.includes(p.id)}
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
                        {p.name?.[0] || p.full_name?.[0] || <PersonIcon fontSize="small" />}
                      </Avatar>
                      <Box sx={{ ml: 2, flex: 1 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                          {p.name || p.full_name || 'Unnamed Participant'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.email || p.phone || 'No contact info'}
                        </Typography>
                      </Box>
                      {selectedParticipants.includes(p.id) && (
                        <CheckCircleIcon sx={{ fontSize: 18, color: primaryMain }} />
                      )}
                    </Stack>
                    {index < participants.length - 1 && (
                      <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.1) }} />
                    )}
                  </React.Fragment>
                ))
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No participants available
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>

          {/* Custom Message */}
          <TextField
            fullWidth
            label="Personalized Message (Optional)"
            placeholder="Add a custom note to your notification..."
            multiline
            rows={3}
            variant="outlined"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            sx={{ 
              '& .MuiOutlinedInput-root': { 
                borderRadius: 3,
                bgcolor: isDarkMode ? alpha('#0f172a', 0.4) : alpha('#ffffff', 0.4),
                '&:hover': { bgcolor: isDarkMode ? alpha('#0f172a', 0.6) : alpha('#ffffff', 0.6) }
              },
              '& .MuiInputLabel-root': {
                color: 'text.secondary'
              }
            }}
          />
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ 
        p: 3, 
        pt: 2,
        bgcolor: isDarkMode ? alpha('#0f172a', 0.4) : alpha('#f8fafc', 0.6),
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
      }}>
        <Button 
          onClick={handleClose} 
          sx={{ 
            color: 'text.secondary', 
            fontWeight: 600,
            '&:hover': { bgcolor: alpha(theme.palette.action.active, 0.05) }
          }}
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
            background: `linear-gradient(135deg, ${primaryMain}, ${primaryDark})`,
            '&:hover': {
              background: `linear-gradient(135deg, ${primaryDark}, ${primaryMain})`,
              transform: 'translateY(-1px)',
              boxShadow: `0 8px 20px ${alpha(primaryMain, 0.3)}`
            },
            '&:disabled': {
              background: alpha(theme.palette.action.disabled, 0.3),
              color: 'text.disabled'
            }
          }}
        >
          {sending ? 'Sending...' : `Send to ${selectedParticipants.length}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NotificationDialog;