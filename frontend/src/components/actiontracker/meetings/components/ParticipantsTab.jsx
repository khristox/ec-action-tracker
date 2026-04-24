// src/components/actiontracker/meetings/ParticipantsTab.jsx
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Grid,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Snackbar,
  Divider,
  Badge,
  LinearProgress,
  Fade,
  Zoom,
  useTheme,
  alpha
} from '@mui/material';
import {
  People as PeopleIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassIcon,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Send as SendIcon,
  Close as CloseIcon,
  Message as MessageIcon,
  Lock as LockIcon,
  Event as EventIcon,
  PlayCircle as PlayCircleIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Visibility as VisibilityIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Star as StarIcon,
  AssignmentInd as SecretaryIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import api from '../../../../services/api';

// Memoized Apology Dialog Component to prevent re-renders
const ApologyDialog = memo(({ 
  open, 
  onClose, 
  onSubmit, 
  participantName, 
  initialMessage = '',
  loading 
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [message, setMessage] = useState(initialMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMessage(initialMessage);
      setSubmitted(false);
      setIsSubmitting(false);
    }
  }, [open, initialMessage]);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(message);
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setMessage('');
      }, 1500);
    } catch (error) {
      console.error('Error submitting apology:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !submitted) {
      onClose();
      setMessage('');
      setSubmitted(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <MessageIcon color="warning" />
            <Typography variant="h6" sx={{ color: isDarkMode ? '#ffffff' : 'inherit' }}>
              Mark Absent with Apology
            </Typography>
          </Stack>
          {!isSubmitting && !submitted && (
            <IconButton onClick={handleClose} disabled={isSubmitting}>
              <CloseIcon />
            </IconButton>
          )}
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        {submitted ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            ✅ Apology recorded and notification sent to {participantName}!
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              You're marking <strong>{participantName}</strong> as absent. 
              Please provide an apology reason.
            </Alert>
            
            <TextField
              fullWidth
              label="Apology Reason / Comment"
              multiline
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., Participant had a family emergency, Travel issues, Illness, etc."
              helperText={`${message.length}/500 characters - This comment will be recorded and sent to the participant via email`}
              required
              autoFocus
              inputProps={{ maxLength: 500 }}
              disabled={isSubmitting}
            />
            
            <Divider />
            
            <Alert severity="info" icon={<InfoIcon />}>
              <Typography variant="caption" display="block">
                <strong>What will happen:</strong>
              </Typography>
              <Typography variant="caption" display="block">
                • Participant will be marked as absent with apology
              </Typography>
              <Typography variant="caption" display="block">
                • An email notification with your apology will be sent
              </Typography>
              <Typography variant="caption" display="block">
                • The comment will be saved for reference
              </Typography>
            </Alert>
          </Stack>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5 }}>
        {!submitted && (
          <>
            <Button onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={handleSubmit}
              disabled={isSubmitting || !message.trim()}
              startIcon={isSubmitting ? <CircularProgress size={16} /> : <SendIcon />}
            >
              {isSubmitting ? 'Saving...' : 'Save & Send Apology'}
            </Button>
          </>
        )}
        {submitted && (
          <Button variant="contained" onClick={handleClose}>
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
});

ApologyDialog.displayName = 'ApologyDialog';

const ParticipantsTab = ({
  meetingId,
  participants: initialParticipants,
  onRefresh,
  meetingStatus,
  meetingStartTime,
  currentChairpersonId,
  currentSecretaryId
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState(initialParticipants || []);
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [apologyComments, setApologyComments] = useState({});
  const [chairpersonId, setChairpersonId] = useState(currentChairpersonId || null);
  const [secretaryId, setSecretaryId] = useState(currentSecretaryId || null);

  // Apology Dialog State
  const [showApologyDialog, setShowApologyDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [isMeetingStarted, setIsMeetingStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Check if meeting has started
  const checkMeetingStatus = useCallback(() => {
    if (meetingStatus?.toLowerCase() === 'in_progress' || 
        meetingStatus?.toLowerCase() === 'started' || 
        meetingStatus?.toLowerCase() === 'ongoing') {
      setIsMeetingStarted(true);
      setTimeRemaining(null);
      return true;
    }

    if (meetingStartTime) {
      const now = new Date();
      const startTime = new Date(meetingStartTime);
      const started = now >= startTime;
      setIsMeetingStarted(started);

      if (!started) {
        const diffMs = startTime - now;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;

        setTimeRemaining(diffHours > 0 
          ? `${diffHours}h ${remainingMins}m` 
          : `${diffMins} minutes`
        );
      } else {
        setTimeRemaining(null);
      }
      return started;
    }

    setIsMeetingStarted(false);
    return false;
  }, [meetingStatus, meetingStartTime]);

  useEffect(() => {
    checkMeetingStatus();
    const interval = setInterval(checkMeetingStatus, 60000);
    return () => clearInterval(interval);
  }, [checkMeetingStatus]);

  useEffect(() => {
    if (initialParticipants) {
      setParticipants(initialParticipants);
      const status = {};
      const comments = {};
      initialParticipants.forEach(p => {
        status[p.id] = p.attendance_status || 'pending';
        comments[p.id] = p.apology_comment || '';
      });
      setAttendanceStatus(status);
      setApologyComments(comments);
    }
  }, [initialParticipants]);

  // Update Chairperson
  const handleSetChairperson = useCallback(async (participantId) => {
    setLoading(true);
    try {
      // Get current participants to find current chairperson
      const participantsResponse = await api.get(`/action-tracker/meetings/${meetingId}/participants`);
      const currentParticipants = participantsResponse.data;
      
      // Find current chairperson
      const currentChairperson = currentParticipants.find(p => p.is_chairperson === true);
      
      // Update the selected participant to be chairperson
      await api.patch(
        `/action-tracker/meetings/${meetingId}/participants/${participantId}`,
        { is_chairperson: true }
      );
      
      // If there was a previous chairperson, unset them
      if (currentChairperson && currentChairperson.id !== participantId) {
        await api.patch(
          `/action-tracker/meetings/${meetingId}/participants/${currentChairperson.id}`,
          { is_chairperson: false }
        );
      }
      
      // Also update the meeting's chairperson_id field
      await api.patch(`/action-tracker/meetings/${meetingId}`, {
        chairperson_id: participantId
      });
      
      setChairpersonId(participantId);
      
      // Update local participants state
      setParticipants(prev => prev.map(p => ({
        ...p,
        is_chairperson: p.id === participantId
      })));
      
      setSnackbar({
        open: true,
        message: 'Chairperson updated successfully',
        severity: 'success'
      });

      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to update chairperson:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to update chairperson',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [meetingId, onRefresh]);

  // Update Secretary
  const handleSetSecretary = useCallback(async (participantId) => {
    setLoading(true);
    try {
      // Get current participants to find current secretary
      const participantsResponse = await api.get(`/action-tracker/meetings/${meetingId}/participants`);
      const currentParticipants = participantsResponse.data;
      
      // Find current secretary
      const currentSecretary = currentParticipants.find(p => p.is_secretary === true);
      
      // Update the selected participant to be secretary
      await api.patch(
        `/action-tracker/meetings/${meetingId}/participants/${participantId}`,
        { is_secretary: true }
      );
      
      // If there was a previous secretary, unset them
      if (currentSecretary && currentSecretary.id !== participantId) {
        await api.patch(
          `/action-tracker/meetings/${meetingId}/participants/${currentSecretary.id}`,
          { is_secretary: false }
        );
      }
      
      // Also update the meeting's secretary_id field
      await api.patch(`/action-tracker/meetings/${meetingId}`, {
        secretary_id: participantId
      });
      
      setSecretaryId(participantId);
      
      // Update local participants state
      setParticipants(prev => prev.map(p => ({
        ...p,
        is_secretary: p.id === participantId
      })));
      
      setSnackbar({
        open: true,
        message: 'Secretary updated successfully',
        severity: 'success'
      });

      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to update secretary:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to update secretary',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [meetingId, onRefresh]);

  const handleAttendanceChange = useCallback(async (participantId, status, comment = '') => {
    if (!isMeetingStarted) {
      setSnackbar({
        open: true,
        message: 'Cannot update attendance. Meeting has not started yet.',
        severity: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      await api.patch(
        `/action-tracker/meetings/${meetingId}/participants/${participantId}`,
        { attendance_status: status, apology_comment: comment }
      );

      setAttendanceStatus(prev => ({ ...prev, [participantId]: status }));
      if (comment) {
        setApologyComments(prev => ({ ...prev, [participantId]: comment }));
      }

      setSnackbar({
        open: true,
        message: status === 'absent_with_apology'
          ? `Marked as absent with apology`
          : `Attendance marked as ${status.replace('_', ' ')}`,
        severity: status === 'absent' || status === 'absent_with_apology' ? 'warning' : 'success'
      });

      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to update attendance:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to update attendance',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [meetingId, isMeetingStarted, onRefresh]);

  const handleOpenApologyDialog = useCallback((participant) => {
    if (!isMeetingStarted) {
      setSnackbar({
        open: true,
        message: 'Cannot submit apology. Meeting has not started yet.',
        severity: 'warning'
      });
      return;
    }
    setSelectedParticipant(participant);
    setShowApologyDialog(true);
  }, [isMeetingStarted]);

  const handleCloseApologyDialog = useCallback(() => {
    setShowApologyDialog(false);
    setSelectedParticipant(null);
  }, []);

  const handleSubmitApology = useCallback(async (message) => {
    if (!selectedParticipant) return;
    
    await handleAttendanceChange(selectedParticipant.id, 'absent_with_apology', message);

    // Send notification
    await api.post(`/action-tracker/meetings/${meetingId}/notify-participants`, {
      participant_ids: [selectedParticipant.id],
      notification_type: ['email'],
      custom_message: `Apology Reason: ${message}`
    });
  }, [selectedParticipant, handleAttendanceChange, meetingId]);

  const getStatusChip = useCallback((status, apologyComment = '') => {
    switch (status) {
      case 'attended':
        return <Chip size="small" label="Attended" color="success" icon={<CheckIcon />} />;
      case 'absent_with_apology':
        return (
          <Tooltip title={apologyComment || "Apology provided"}>
            <Chip size="small" label="Absent (Apology)" color="warning" icon={<MessageIcon />} variant="outlined" />
          </Tooltip>
        );
      case 'absent':
        return <Chip size="small" label="Absent" color="error" icon={<CancelIcon />} />;
      default:
        return <Chip size="small" label="Pending" color="default" icon={<HourglassIcon />} />;
    }
  }, []);

  const stats = useMemo(() => ({
    attended: Object.values(attendanceStatus).filter(s => s === 'attended').length,
    absent: Object.values(attendanceStatus).filter(s => s === 'absent').length,
    absentWithApology: Object.values(attendanceStatus).filter(s => s === 'absent_with_apology').length,
    pending: Object.values(attendanceStatus).filter(s => s === 'pending').length,
    total: participants.length,
    attendanceRate: participants.length > 0
      ? ((Object.values(attendanceStatus).filter(s => s === 'attended').length / participants.length) * 100).toFixed(1)
      : 0
  }), [attendanceStatus, participants.length]);

  const isReadOnly = !isMeetingStarted;

  const StatCard = useCallback(({ title, value, icon, color, tooltip }) => (
    <Zoom in={true} style={{ transitionDelay: '100ms' }}>
      <Card 
        variant="outlined" 
        sx={{ 
          height: '100%', 
          transition: 'transform 0.2s', 
          '&:hover': { transform: 'translateY(-4px)' },
          bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
          borderColor: isDarkMode ? alpha(theme.palette.common.white, 0.1) : undefined
        }}
      >
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: alpha(color, isDarkMode ? 0.2 : 0.1), color: color, width: 48, height: 48 }}>
              {icon}
            </Avatar>
            <Box>
              <Tooltip title={tooltip}>
                <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                  {title}
                </Typography>
              </Tooltip>
              <Typography variant="h4" fontWeight={700} color={color}>
                {value}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Zoom>
  ), [isDarkMode, theme]);

  // Read-only mode
  if (isReadOnly) {
    return (
      <Fade in={true}>
        <Stack spacing={3}>
          <Alert 
            severity="info" 
            icon={<InfoIcon />} 
            sx={{ 
              borderRadius: 2,
              bgcolor: isDarkMode ? alpha(theme.palette.info.main, 0.1) : undefined,
              color: isDarkMode ? theme.palette.info.light : undefined
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Meeting Not Started - View Only Mode
            </Typography>
            <Typography variant="body2">
              Attendance tracking is disabled until the meeting starts.
              {timeRemaining && ` Meeting starts in approximately ${timeRemaining}.`}
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard title="Total Participants" value={stats.total} icon={<PeopleIcon />} color={theme.palette.primary.main} tooltip="Total participants" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard title="Pending" value={stats.pending} icon={<ScheduleIcon />} color={theme.palette.warning.main} tooltip="Awaiting attendance" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard title="Attended" value={stats.attended} icon={<CheckIcon />} color={theme.palette.success.main} tooltip="Attended" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard title="Absent" value={stats.absent + stats.absentWithApology} icon={<CancelIcon />} color={theme.palette.error.main} tooltip="Total absent" />
            </Grid>
          </Grid>

          <TableContainer 
            component={Paper} 
            variant="outlined"
            sx={{
              bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
              borderColor: isDarkMode ? alpha(theme.palette.common.white, 0.1) : undefined
            }}
          >
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>Participant</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>Contact</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>Apology Comment</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {participants.map((participant) => (
                  <TableRow key={participant.id} hover sx={{ opacity: 0.8 }}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: '#6366f1' }}>
                          {participant.name?.[0] || participant.full_name?.[0] || '?'}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600} sx={{ color: isDarkMode ? '#e0e0e0' : 'inherit' }}>
                          {participant.name || participant.full_name || participant.username}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {participant.email && (
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                            <EmailIcon fontSize="small" sx={{ fontSize: 12 }} />
                            {participant.email}
                          </Typography>
                        )}
                        {participant.telephone && (
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                            <PhoneIcon fontSize="small" sx={{ fontSize: 12 }} />
                            {participant.telephone}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {participant.is_chairperson && (
                          <Chip size="small" label="Chairperson" color="primary" variant="outlined" icon={<StarIcon />} />
                        )}
                        {participant.is_secretary && (
                          <Chip size="small" label="Secretary" color="secondary" variant="outlined" icon={<SecretaryIcon />} />
                        )}
                        {!participant.is_chairperson && !participant.is_secretary && (
                          <Chip size="small" label="Member" color="default" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(
                        attendanceStatus[participant.id] || participant.attendance_status || 'pending',
                        apologyComments[participant.id]
                      )}
                    </TableCell>
                    <TableCell>
                      {(attendanceStatus[participant.id] === 'absent_with_apology' ||
                        participant.attendance_status === 'absent_with_apology') && (
                        <Tooltip title={apologyComments[participant.id] || participant.apology_comment || 'No comment provided'}>
                          <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                            {apologyComments[participant.id] || participant.apology_comment || 'No comment provided'}
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Only - Meeting Not Started">
                        <IconButton size="small" disabled>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Fade>
    );
  }

  // Active Meeting UI
  return (
    <Fade in={true}>
      <Stack spacing={3}>
        <Alert 
          severity="success" 
          icon={<PlayCircleIcon />} 
          sx={{ 
            borderRadius: 2,
            bgcolor: isDarkMode ? alpha(theme.palette.success.main, 0.1) : undefined,
            color: isDarkMode ? theme.palette.success.light : undefined
          }}
        >
          <Typography variant="subtitle2" fontWeight={600}>Meeting in Progress</Typography>
          <Typography variant="body2">You can now mark attendance and assign roles for participants.</Typography>
        </Alert>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Total Participants" value={stats.total} icon={<PeopleIcon />} color={theme.palette.primary.main} tooltip="Total participants" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Attended" value={stats.attended} icon={<CheckIcon />} color={theme.palette.success.main} tooltip="Attended" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Absent with Apology" value={stats.absentWithApology} icon={<MessageIcon />} color={theme.palette.warning.main} tooltip="Absent with apology" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Absent (No Apology)" value={stats.absent} icon={<CancelIcon />} color={theme.palette.error.main} tooltip="Absent without apology" />
          </Grid>
        </Grid>

        <Paper sx={{ 
          p: 2, 
          bgcolor: isDarkMode ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.success.main, 0.05),
          borderRadius: 2
        }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" fontWeight={600} sx={{ color: isDarkMode ? '#e0e0e0' : 'inherit' }}>
              Attendance Rate
            </Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">{stats.attendanceRate}%</Typography>
          </Stack>
          <LinearProgress 
            variant="determinate" 
            value={parseFloat(stats.attendanceRate)} 
            sx={{ 
              height: 8, 
              borderRadius: 4,
              bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.1) : undefined
            }} 
          />
          <Typography variant="caption" color="text.secondary" mt={1}>
            {stats.attended} out of {stats.total} participants attended
          </Typography>
        </Paper>

        <TableContainer 
          component={Paper} 
          variant="outlined"
          sx={{
            bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
            borderColor: isDarkMode ? alpha(theme.palette.common.white, 0.1) : undefined
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>Participant</TableCell>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>Contact</TableCell>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>Apology Comment</TableCell>
                <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#e0e0e0' : 'inherit' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {participants.map((participant) => (
                <TableRow key={participant.id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ 
                        width: 36, 
                        height: 36, 
                        bgcolor: participant.is_chairperson 
                          ? theme.palette.primary.main 
                          : (participant.is_secretary ? theme.palette.secondary.main : '#6366f1')
                      }}>
                        {participant.name?.[0] || participant.full_name?.[0] || '?'}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ color: isDarkMode ? '#e0e0e0' : 'inherit' }}>
                          {participant.name || participant.full_name || participant.username}
                        </Typography>
                        {participant.title && (
                          <Typography variant="caption" color="text.secondary">
                            {participant.title}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Stack spacing={0.5}>
                      {participant.email && (
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                          <EmailIcon fontSize="small" sx={{ fontSize: 12 }} />
                          {participant.email}
                        </Typography>
                      )}
                      {participant.telephone && (
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                          <PhoneIcon fontSize="small" sx={{ fontSize: 12 }} />
                          {participant.telephone}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {/* Chairperson selection */}
                      {chairpersonId === participant.id ? (
                        <Chip 
                          size="small" 
                          label="Chairperson" 
                          color="primary" 
                          icon={<StarIcon />}
                        />
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<StarIcon />}
                          onClick={() => handleSetChairperson(participant.id)}
                          disabled={loading || participant.is_chairperson}
                          sx={{ 
                            textTransform: 'none',
                            borderColor: isDarkMode ? alpha(theme.palette.common.white, 0.2) : undefined,
                            color: isDarkMode ? '#e0e0e0' : 'inherit'
                          }}
                        >
                          Set as Chairperson
                        </Button>
                      )}
                      
                      {/* Secretary selection */}
                      {secretaryId === participant.id ? (
                        <Chip 
                          size="small" 
                          label="Secretary" 
                          color="secondary" 
                          icon={<SecretaryIcon />}
                        />
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SecretaryIcon />}
                          onClick={() => handleSetSecretary(participant.id)}
                          disabled={loading || participant.is_secretary}
                          sx={{ 
                            textTransform: 'none',
                            borderColor: isDarkMode ? alpha(theme.palette.common.white, 0.2) : undefined,
                            color: isDarkMode ? '#e0e0e0' : 'inherit'
                          }}
                        >
                          Set as Secretary
                        </Button>
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    {getStatusChip(
                      attendanceStatus[participant.id] || participant.attendance_status || 'pending',
                      apologyComments[participant.id]
                    )}
                  </TableCell>

                  <TableCell>
                    {(attendanceStatus[participant.id] === 'absent_with_apology' ||
                      participant.attendance_status === 'absent_with_apology') && (
                      <Tooltip title={apologyComments[participant.id] || participant.apology_comment || 'No comment provided'}>
                        <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                          {apologyComments[participant.id] || participant.apology_comment || 'No comment provided'}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>

                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="Mark Attended">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleAttendanceChange(participant.id, 'attended')}
                          disabled={attendanceStatus[participant.id] === 'attended' || loading}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Mark Absent">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleAttendanceChange(participant.id, 'absent')}
                          disabled={attendanceStatus[participant.id] === 'absent' || loading}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Mark Absent with Apology">
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => handleOpenApologyDialog(participant)}
                          disabled={attendanceStatus[participant.id] === 'absent_with_apology' || loading}
                        >
                          <MessageIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Memoized Apology Dialog */}
        <ApologyDialog
          open={showApologyDialog}
          onClose={handleCloseApologyDialog}
          onSubmit={handleSubmitApology}
          participantName={selectedParticipant?.name || selectedParticipant?.full_name || ''}
          initialMessage={selectedParticipant ? apologyComments[selectedParticipant.id] || '' : ''}
          loading={loading}
        />

        {loading && (
          <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            severity={snackbar.severity} 
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            sx={{
              bgcolor: isDarkMode ? 'background.paper' : undefined,
              color: isDarkMode ? '#e0e0e0' : undefined
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Stack>
    </Fade>
  );
};

export default ParticipantsTab;