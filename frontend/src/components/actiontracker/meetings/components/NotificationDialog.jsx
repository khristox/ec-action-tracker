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
  useMediaQuery
} from '@mui/material';
import {
  Close as CloseIcon,
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
  Sms as SmsIcon,
  Send as SendIcon,
  Person as PersonIcon
} from '@mui/icons-material';

function NotificationDialog({ open, onClose, meeting, participants, onSend }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // Detects mobile
  
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [notificationType, setNotificationType] = useState(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Colors for a "Premium" Dark Mode
  const primaryMain = theme.palette.primary.main;
  const glassBg = theme.palette.mode === 'dark' 
    ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend({
        participant_ids: selectedParticipants,
        notification_type: notificationType,
        custom_message: customMessage
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullScreen={isMobile} // FULL SCREEN ON MOBILE
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 4,
          background: glassBg,
          backdropFilter: 'blur(10px)',
          backgroundImage: 'none',
          boxShadow: theme.palette.mode === 'dark' 
            ? `0 8px 32px 0 ${alpha('#000', 0.8)}, inset 0 0 0 1px ${alpha(primaryMain, 0.1)}`
            : theme.shadows[10]
        }
      }}
    >
      {/* Header with Gradient Accent */}
      <DialogTitle sx={{ p: 3, position: 'relative', overflow: 'hidden' }}>
        <Box sx={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: '4px',
          background: `linear-gradient(90deg, ${primaryMain}, ${theme.palette.secondary.main})`
        }} />
        
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ 
              bgcolor: alpha(primaryMain, 0.15), 
              color: primaryMain,
              width: 48, height: 48,
              border: `1px solid ${alpha(primaryMain, 0.2)}`
            }}>
              <NotificationsIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                Notify Team
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                {meeting?.title}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} sx={{ bgcolor: alpha(theme.palette.action.active, 0.05) }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Stack spacing={4}>
          {/* Delivery Methods - Modern Pill Style */}
          <Box>
            <Typography variant="overline" color="primary" fontWeight={700} sx={{ mb: 1.5, display: 'block' }}>
              Broadcast Channels
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {[
                { id: 'email', icon: <EmailIcon />, label: 'Email' },
                { id: 'whatsapp', icon: <WhatsAppIcon />, label: 'WhatsApp' },
                { id: 'sms', icon: <SmsIcon />, label: 'SMS' }
              ].map((type) => {
                const isActive = notificationType.includes(type.id);
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
                      bgcolor: isActive ? alpha(primaryMain, 0.2) : 'transparent',
                      color: isActive ? primaryMain : 'text.secondary',
                      border: `1.5px solid ${isActive ? primaryMain : alpha(theme.palette.divider, 0.1)}`,
                      '&:hover': { bgcolor: alpha(primaryMain, 0.1) }
                    }}
                  />
                );
              })}
            </Stack>
          </Box>

          {/* Participant List - High Contrast Surface */}
          <Box>
             <Typography variant="overline" color="primary" fontWeight={700} sx={{ mb: 1.5, display: 'block' }}>
              Recipients ({selectedParticipants.length})
            </Typography>
            <Paper 
              variant="outlined" 
              sx={{ 
                maxHeight: isMobile ? 'none' : 240, 
                borderRadius: 3,
                bgcolor: alpha(theme.palette.background.default, 0.5),
                borderColor: alpha(theme.palette.divider, 0.1),
                overflow: 'hidden'
              }}
            >
              {participants?.map((p) => (
                <Stack
                  key={p.id}
                  direction="row"
                  alignItems="center"
                  sx={{ 
                    p: 2, 
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                    transition: 'background 0.2s',
                    '&:hover': { bgcolor: alpha(primaryMain, 0.03) }
                  }}
                >
                  <Checkbox
                    checked={selectedParticipants.includes(p.id)}
                    onChange={() => setSelectedParticipants(prev => 
                      prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id]
                    )}
                    sx={{ color: alpha(theme.palette.text.primary, 0.2) }}
                  />
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: alpha(primaryMain, 0.1), color: primaryMain }}>
                    {p.name?.[0] || <PersonIcon fontSize="small" />}
                  </Avatar>
                  <Box sx={{ ml: 2, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{p.name || p.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.email || p.phone}</Typography>
                  </Box>
                </Stack>
              ))}
            </Paper>
          </Box>

          <TextField
            fullWidth
            label="Personalized Note"
            multiline
            rows={3}
            variant="outlined"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            sx={{ 
              '& .MuiOutlinedInput-root': { 
                borderRadius: 3,
                bgcolor: alpha(theme.palette.background.default, 0.5)
              } 
            }}
          />
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, bgcolor: alpha(theme.palette.background.default, 0.3) }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Dismiss
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={sending || selectedParticipants.length === 0}
          sx={{ 
            borderRadius: '12px', 
            px: 4, py: 1.5, 
            fontWeight: 800,
            textTransform: 'none',
            fontSize: '1rem',
            boxShadow: `0 8px 20px ${alpha(primaryMain, 0.3)}`
          }}
        >
          {sending ? <CircularProgress size={24} color="inherit" /> : 'Send Broadcast'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NotificationDialog;