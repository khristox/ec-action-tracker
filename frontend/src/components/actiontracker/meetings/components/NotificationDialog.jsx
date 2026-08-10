// src/components/actiontracker/meetings/components/NotificationDialog.jsx
// ✅ FULLY FIXED: Complete ID extraction with comprehensive logging and diagnostics

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
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { COLORS } from '../styles/colors';
import { sendNotifications } from '../../../../services/notifications';
import { useSelector } from 'react-redux';

const ALLOWED_CHANNELS = ['email', 'whatsapp', 'sms'];
const MAX_MESSAGE_LENGTH = 1000;

const maskEmail = (email) => {
  if (!email) return 'xxxx';
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return 'xxxx';
  const maskedLocal = localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1);
  return `${maskedLocal}@${domain}`;
};

export const NotificationDialog = ({ open, onClose, meeting, participants = [] }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';

  const { token } = useSelector((state) => state.auth);

  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [notificationType, setNotificationType] = useState(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const primaryMain = theme.palette.primary.main || COLORS.primary;
  const primaryDark = theme.palette.primary.dark || COLORS.primaryDark;
  const secondaryMain = theme.palette.secondary?.main || COLORS.secondary;

  const dialogBg = isDarkMode
    ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';

  // ✅ DEBUG: Inspect raw participant data structure when dialog opens
  useEffect(() => {
    if (open && participants && participants.length > 0) {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║         RAW PARTICIPANT DATA FROM API (FIRST LOAD)         ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      participants.slice(0, 2).forEach((p, idx) => {
        console.log(`[Participant ${idx}] Raw Object Structure:`);
        console.log('────────────────────────────────────────────────────────────');
        console.log(JSON.stringify(p, null, 2));
        console.log('');
      });

      console.log('════════════════════════════════════════════════════════════\n');
    }
  }, [open, participants]);

  // ✅ FULLY FIXED: Comprehensive participant ID extraction with detailed diagnostics
  const validParticipantIds = useMemo(() => {
    if (!Array.isArray(participants)) {
      console.warn('❌ participants is not an array');
      return [];
    }

    if (participants.length === 0) {
      console.log('ℹ️ No participants provided');
      return [];
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     NOTIFICATION DIALOG: ID EXTRACTION & DIAGNOSTICS      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const ids = [];
    const idMapping = {};

    participants.forEach((p, idx) => {
      console.log(`\n[Participant ${idx + 1}] ${p.name || p.full_name || 'Unknown'}`);
      console.log('────────────────────────────────────────────────────────────');

      // Log all ID fields available
      console.log('Available ID fields:');
      console.log(`  • participant_id: ${p.participant_id || 'MISSING'}`);
      console.log(`  • id: ${p.id || 'MISSING'}`);
      console.log(`  • user_id: ${p.user_id || 'MISSING'}`);
      console.log(`  • created_by_id: ${p.created_by_id || 'MISSING'}`);

      let selectedId = null;
      let selectedSource = null;
      let reason = '';

      // PRIORITY 1: participant_id (most reliable)
      if (p?.participant_id && p.participant_id.toString().trim()) {
        selectedId = p.participant_id;
        selectedSource = 'participant_id';
        reason = '✅ PRIMARY: MeetingParticipant ID';
      }
      // PRIORITY 2: id (if participant_id doesn't exist)
      else if (p?.id && p.id.toString().trim()) {
        selectedId = p.id;
        selectedSource = 'id';
        reason = '⚠️  FALLBACK: Using id field';

        // Check if this looks like it might be wrong
        if (p.created_by_id && p.id === p.created_by_id) {
          console.warn(
            `     ⚠️  WARNING: id matches created_by_id - this might be User ID, not Participant ID!`
          );
        }
      }
      // PRIORITY 3: user_id (last resort)
      else if (p?.user_id && p.user_id.toString().trim()) {
        selectedId = p.user_id;
        selectedSource = 'user_id';
        reason = '❌ LAST RESORT: Using user_id';
      }

      if (selectedId) {
        ids.push(selectedId);
        idMapping[selectedId] = {
          name: p.name || p.full_name || 'Unknown',
          source: selectedSource,
          email: p.email
        };

        console.log(`\n🎯 Selected: ${selectedId}`);
        console.log(`   Source: ${selectedSource}`);
        console.log(`   Reason: ${reason}`);
      } else {
        console.error(
          `❌ CRITICAL: No valid ID found for "${p.name || p.full_name || 'Unknown'}"`
        );
        console.error(`   This participant WILL BE SKIPPED`);
      }
    });

    // Final summary
    console.log('\n════════════════════════════════════════════════════════════');
    console.log(`\n📊 FINAL RESULTS:`);
    console.log(`   Total participants: ${participants.length}`);
    console.log(`   Valid IDs extracted: ${ids.length}`);
    if (ids.length < participants.length) {
      console.warn(`   ⚠️  ${participants.length - ids.length} participant(s) have no valid ID`);
    }

    console.log('\n🔗 ID MAPPING:');
    ids.forEach((id) => {
      const mapping = idMapping[id];
      console.log(`   ${id}`);
      console.log(`   └─ ${mapping.source} → "${mapping.name}" <${mapping.email}>`);
    });

    console.log('\n════════════════════════════════════════════════════════════\n');

    return ids;
  }, [participants]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedParticipants([]);
      setNotificationType(['email']);
      setCustomMessage('');
      setError(null);
      setSuccess(null);
    }
  }, [open]);

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
    if (!ALLOWED_CHANNELS.includes(channelId)) return;
    setNotificationType((prev) =>
      prev.includes(channelId)
        ? prev.filter((t) => t !== channelId)
        : [...prev, channelId]
    );
  };

  // ✅ FULLY FIXED: Comprehensive send logging with ID validation
  const handleSend = async () => {
    if (sending || selectedParticipants.length === 0 || notificationType.length === 0) {
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const sanitizedMessage = customMessage.trim().slice(0, MAX_MESSAGE_LENGTH);
      const sanitizedChannels = notificationType.filter((t) =>
        ALLOWED_CHANNELS.includes(t)
      );

      // Validate selected participants
      if (!Array.isArray(selectedParticipants) || selectedParticipants.length === 0) {
        throw new Error('No participants selected');
      }

      // Build payload with correct IDs
      const payload = {
        meeting_id: meeting.id,
        participant_ids: selectedParticipants,
        notification_type: sanitizedChannels,
        custom_message: sanitizedMessage
      };

      // Pre-send validation and logging
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║           SENDING NOTIFICATION REQUEST - VALIDATED         ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      console.log('📋 REQUEST DETAILS:');
      console.log(`   Meeting ID: ${payload.meeting_id}`);
      console.log(`   Recipients: ${payload.participant_ids.length} participant(s)`);
      payload.participant_ids.forEach((id, idx) => {
        const participant = participants.find(
          (p) => p?.participant_id === id || p?.id === id
        );
        const name = participant?.name || participant?.full_name || 'Unknown';
        const email = participant?.email || 'N/A';
        console.log(`      [${idx + 1}] ${id}`);
        console.log(`          └─ ${name} <${email}>`);
      });
      console.log(`   Channels: ${payload.notification_type.join(', ')}`);
      console.log(`   Message: ${payload.custom_message || '(empty)'}`);

      console.log('\n📤 SENDING TO BACKEND...');
      console.log('════════════════════════════════════════════════════════════\n');

      const response = await sendNotifications(payload, token);

      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║              NOTIFICATION RESPONSE RECEIVED                ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      console.log('📨 RESPONSE:');
      console.log(`   Success: ${response.success ? '✅ YES' : '❌ NO'}`);
      console.log(`   Message: ${response.message}`);

      if (response.results) {
        console.log(`\n   📊 DETAILED RESULTS:`);
        console.log(`      Total recipients: ${response.results.total_recipients}`);
        console.log(`      Sent: ${response.results.total_sent}`);
        console.log(`      Failed: ${response.results.total_failed}`);

        if (response.results.by_channel) {
          console.log(`\n   By Channel:`);
          Object.entries(response.results.by_channel).forEach(([channel, stats]) => {
            console.log(`      ${channel}: ${stats.sent} sent, ${stats.failed} failed`);
          });
        }

        if (response.results.details && Array.isArray(response.results.details)) {
          console.log(`\n   Individual Results:`);
          response.results.details.forEach((detail, idx) => {
            const status = detail.status === 'success' ? '✅' : '❌';
            console.log(`      [${idx + 1}] ${status} ${detail.name || 'Unknown'}`);
            if (detail.error) {
              console.log(`          Error: ${detail.error}`);
            }
          });
        }
      }

      console.log('\n════════════════════════════════════════════════════════════\n');

      if (response.success) {
        console.log('✅ NOTIFICATION SEND SUCCESSFUL');

        setSuccess({
          message: response.message,
          details: response.results
        });

        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        console.error('❌ NOTIFICATION SEND FAILED');
        console.error(`Reason: ${response.message}`);

        setError({
          message: response.message,
          status: 'error'
        });
      }
    } catch (error) {
      console.error('\n❌ EXCEPTION DURING SEND');
      console.error('Error Message:', error.message);
      console.error('Error Type:', error.name);
      if (error.response?.data) {
        console.error('Response Data:', error.response.data);
      }
      console.error('Stack:', error.stack);

      setError({
        message: error.message || 'Failed to send notifications. Please try again.',
        status: 'error'
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    setSelectedParticipants([]);
    setNotificationType(['email']);
    setCustomMessage('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  const getChannelColor = (type) => {
    switch (type) {
      case 'email':
        return '#3b82f6';
      case 'whatsapp':
        return '#25D366';
      case 'sms':
        return '#f59e0b';
      default:
        return primaryMain;
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
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, ${primaryMain}, ${secondaryMain})`
          }}
        />

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              sx={{
                bgcolor: alpha(primaryMain, isDarkMode ? 0.2 : 0.1),
                color: primaryMain,
                width: 48,
                height: 48,
                border: `1px solid ${alpha(primaryMain, isDarkMode ? 0.3 : 0.2)}`
              }}
            >
              <NotificationsIcon />
            </Avatar>
            <Box>
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{ letterSpacing: '-0.02em', color: isDarkMode ? '#fff' : '#1e293b' }}
              >
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
        <Stack spacing={3}>
          {error && (
            <Alert
              severity="error"
              onClose={() => setError(null)}
              icon={<ErrorIcon />}
              sx={{ borderRadius: 2 }}
            >
              <Typography variant="body2" fontWeight={600}>
                {error.message}
              </Typography>
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                {success.message}
              </Typography>
              {success.details && (
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  Sent: {success.details.total_sent} | Failed: {success.details.total_failed}
                </Typography>
              )}
            </Alert>
          )}

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
              <Typography
                variant="caption"
                color="primary"
                fontWeight={700}
                sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >
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
                    disabled={sending}
                    sx={{
                      borderRadius: '12px',
                      height: '40px',
                      px: 1,
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      bgcolor: isActive
                        ? alpha(channelColor, isDarkMode ? 0.25 : 0.1)
                        : isDarkMode
                        ? alpha('#fff', 0.05)
                        : alpha('#000', 0.02),
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
                  // ✅ FULLY FIXED: Extract ID with proper fallback
                  const participantId = (() => {
                    if (p?.participant_id) return p.participant_id;
                    if (p?.id) return p.id;
                    if (p?.user_id) return p.user_id;
                    return null;
                  })();

                  // Skip if no ID
                  if (!participantId) return null;

                  const isSelected = selectedParticipants.includes(participantId);
                  const displayEmail = maskEmail(p.email);

                  return (
                    <React.Fragment key={participantId}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        sx={{
                          p: 2,
                          transition: 'background 0.2s',
                          opacity: sending ? 0.6 : 1,
                          '&:hover': {
                            bgcolor: alpha(primaryMain, isDarkMode ? 0.1 : 0.05),
                            cursor: sending ? 'not-allowed' : 'pointer'
                          }
                        }}
                        onClick={() => !sending && handleToggleParticipant(participantId)}
                        title={`Email: ${p.email}\nID: ${participantId}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={sending}
                          sx={{
                            color: alpha(theme.palette.text.primary, 0.3),
                            '&.Mui-checked': { color: primaryMain }
                          }}
                        />
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            fontSize: '0.9rem',
                            bgcolor: alpha(primaryMain, isDarkMode ? 0.2 : 0.1),
                            color: primaryMain
                          }}
                        >
                          {p.name?.[0] ||
                            p.full_name?.[0] ||
                            p.email?.[0] || (
                              <PersonIcon fontSize="small" />
                            )}
                        </Avatar>
                        <Box sx={{ ml: 2, flex: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{
                              color: isDarkMode ? '#e2e8f0' : '#1e293b'
                            }}
                          >
                            {p.name ||
                              p.full_name ||
                              p.email?.split('@')[0] ||
                              'Unnamed Participant'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {displayEmail}
                          </Typography>
                        </Box>
                        {isSelected && (
                          <CheckCircleIcon sx={{ fontSize: 18, color: primaryMain }} />
                        )}
                      </Stack>
                      {index < participants.length - 1 && (
                        <Divider
                          sx={{
                            borderColor: alpha(theme.palette.divider, 0.1)
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })
                .filter(Boolean)
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
                '&:hover': {
                  bgcolor: isDarkMode ? alpha('#0f172a', 0.6) : alpha('#ffffff', 0.6)
                },
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
          disabled={
            sending ||
            selectedParticipants.length === 0 ||
            notificationType.length === 0
          }
          startIcon={
            sending ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <SendIcon />
            )
          }
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