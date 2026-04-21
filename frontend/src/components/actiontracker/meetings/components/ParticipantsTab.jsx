// src/components/actiontracker/meetings/ParticipantsTab.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import api from '../../../../services/api';

const ParticipantsTab = ({ 
  meetingId, 
  participants: initialParticipants, 
  onRefresh, 
  meetingStatus, 
  meetingStartTime 
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState(initialParticipants || []);
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [showApologyDialog, setShowApologyDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [apologyMessage, setApologyMessage] = useState('');
  const [sendingApology, setSendingApology] = useState(false);
  const [apologySent, setApologySent] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [apologyComments, setApologyComments] = useState({});
  const [isMeetingStarted, setIsMeetingStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Check if meeting has started
  const checkMeetingStatus = useCallback(() => {
    // Check by status first
    if (meetingStatus?.toLowerCase()  === 'in_progress' || meetingStatus?.toLowerCase()  === 'started' || meetingStatus?.toLowerCase()  === 'ongoing') {
      setIsMeetingStarted(true);
      setTimeRemaining(null);
      return true;
    }
    
    // Check by start time
    if (meetingStartTime) {
      const now = new Date();
      const startTime = new Date(meetingStartTime);
      const started = now >= startTime;
      setIsMeetingStarted(started);
      
      if (!started) {
        // Calculate time remaining
        const diffMs = startTime - now;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;
        
        if (diffHours > 0) {
          setTimeRemaining(`${diffHours}h ${remainingMins}m`);
        } else {
          setTimeRemaining(`${diffMins} minutes`);
        }
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
    // Check every minute
    const interval = setInterval(checkMeetingStatus, 60000);
    return () => clearInterval(interval);
  }, [checkMeetingStatus]);

  useEffect(() => {
    if (initialParticipants) {
      setParticipants(initialParticipants);
      // Initialize attendance status
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

  const handleAttendanceChange = async (participantId, status, comment = '') => {
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
        { 
          attendance_status: status,
          apology_comment: comment
        }
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
  };

  const handleOpenApologyDialog = (participant) => {
    if (!isMeetingStarted) {
      setSnackbar({
        open: true,
        message: 'Cannot submit apology. Meeting has not started yet.',
        severity: 'warning'
      });
      return;
    }
    setSelectedParticipant(participant);
    setApologyMessage(apologyComments[participant.id] || '');
    setShowApologyDialog(true);
  };

  const handleSendApology = async () => {
    if (!apologyMessage.trim()) {
      setSnackbar({
        open: true,
        message: 'Please enter an apology reason/comment',
        severity: 'warning'
      });
      return;
    }
    
    setSendingApology(true);
    try {
      await handleAttendanceChange(selectedParticipant.id, 'absent_with_apology', apologyMessage);
      
      if (isMeetingStarted) {
        await api.post(`/action-tracker/meetings/${meetingId}/notify-participants`, {
          participant_ids: [selectedParticipant.id],
          notification_type: ['email'],
          custom_message: `Apology Reason: ${apologyMessage}`
        });
      }
      
      setApologySent(true);
      setTimeout(() => {
        setShowApologyDialog(false);
        setApologySent(false);
        setApologyMessage('');
        setSelectedParticipant(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to send apology:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to send apology',
        severity: 'error'
      });
    } finally {
      setSendingApology(false);
    }
  };

  const getStatusChip = (status, apologyComment = '') => {
    switch (status) {
      case 'attended':
        return <Chip size="small" label="Attended" color="success" icon={<CheckIcon />} />;
      case 'absent_with_apology':
        return (
          <Tooltip title={apologyComment || "Apology provided"}>
            <Chip 
              size="small" 
              label="Absent (Apology)" 
              color="warning" 
              icon={<MessageIcon />} 
              variant="outlined"
            />
          </Tooltip>
        );
      case 'absent':
        return <Chip size="small" label="Absent" color="error" icon={<CancelIcon />} />;
      default:
        return <Chip size="small" label="Pending" color="default" icon={<HourglassIcon />} />;
    }
  };

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

  // Read-only mode for meetings that haven't started
  const isReadOnly = !isMeetingStarted;

  // Stats Cards Component
  const StatCard = ({ title, value, icon, color, tooltip }) => (
    <Zoom in={true} style={{ transitionDelay: '100ms' }}>
      <Card variant="outlined" sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: alpha(color, 0.1), color: color, width: 48, height: 48 }}>
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
  );

  // Read-only mode UI
  if (isReadOnly) {
    return (
      <Fade in={true}>
        <Stack spacing={3}>
          {/* Warning Banner */}
          <Alert 
            severity="info" 
            icon={<InfoIcon />}
            sx={{ borderRadius: 2 }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Meeting Not Started - View Only Mode
            </Typography>
            <Typography variant="body2">
              Attendance tracking is disabled until the meeting starts. You can only view participant information.
              {timeRemaining && ` Meeting starts in approximately ${timeRemaining}.`}
            </Typography>
          </Alert>

          {/* Stats Cards */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                title="Total Participants"
                value={stats.total}
                icon={<PeopleIcon />}
                color={theme.palette.primary.main}
                tooltip="Total number of participants"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                title="Pending"
                value={stats.pending}
                icon={<ScheduleIcon />}
                color={theme.palette.warning.main}
                tooltip="Awaiting attendance marking"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                title="Attended"
                value={stats.attended}
                icon={<CheckIcon />}
                color={theme.palette.success.main}
                tooltip="Marked as attended"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                title="Absent"
                value={stats.absent + stats.absentWithApology}
                icon={<CancelIcon />}
                color={theme.palette.error.main}
                tooltip="Total absent (with and without apology)"
              />
            </Grid>
          </Grid>

          {/* Read-only Participants Table */}
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Participant</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Apology Comment</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {participants.map((participant) => (
                  <TableRow key={participant.id} hover sx={{ opacity: 0.8 }}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: '#6366f1' }}>
                          {participant.name?.[0] || participant.full_name?.[0] || participant.username?.[0] || '?'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
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
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon fontSize="small" sx={{ fontSize: 12 }} />
                            {participant.email}
                          </Typography>
                        )}
                        {participant.telephone && (
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon fontSize="small" sx={{ fontSize: 12 }} />
                            {participant.telephone}
                          </Typography>
                        )}
                        {participant.organization && (
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <BusinessIcon fontSize="small" sx={{ fontSize: 12 }} />
                            {participant.organization}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {participant.is_chairperson ? (
                        <Chip size="small" label="Chairperson" color="primary" variant="outlined" />
                      ) : (
                        <Chip size="small" label="Member" color="default" variant="outlined" />
                      )}
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
                          <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

          {/* Locked Message Banner */}
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: alpha(theme.palette.info.main, 0.05) }}>
            <Badge 
              badgeContent={<LockIcon />} 
              color="info" 
              sx={{ '& .MuiBadge-badge': { fontSize: 20, width: 40, height: 40, borderRadius: '50%' } }}
            >
              <ScheduleIcon sx={{ fontSize: 80, color: theme.palette.info.main, mb: 2, opacity: 0.6 }} />
            </Badge>
            <Typography variant="h6" gutterBottom color="text.primary">
              Attendance Tracking Will Start Soon
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 500, mx: 'auto' }}>
              Attendance can only be updated after the meeting has started.
              {meetingStartTime && (
                <Box component="span" display="block" mt={1}>
                  <EventIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                  Scheduled: {format(new Date(meetingStartTime), 'PPP \'at\' p')}
                </Box>
              )}
              {timeRemaining && (
                <Box component="span" display="block" mt={1} fontWeight={600} color="info.main">
                  ⏰ Starting in {timeRemaining}
                </Box>
              )}
            </Typography>
            {participants.length === 0 && (
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={() => window.location.href = `/meetings/${meetingId}/edit`}
              >
                Add Participants
              </Button>
            )}
          </Paper>
        </Stack>
      </Fade>
    );
  }

  // Active meeting UI
  return (
    <Fade in={true}>
      <Stack spacing={3}>
        {/* Active Meeting Banner */}
        <Alert 
          severity="success" 
          icon={<PlayCircleIcon />}
          sx={{ borderRadius: 2 }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            Meeting in Progress
          </Typography>
          <Typography variant="body2">
            You can now mark attendance for participants. Click the buttons below to update attendance status.
          </Typography>
        </Alert>

        {/* Stats Cards */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              title="Total Participants"
              value={stats.total}
              icon={<PeopleIcon />}
              color={theme.palette.primary.main}
              tooltip="Total number of participants"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              title="Attended"
              value={stats.attended}
              icon={<CheckIcon />}
              color={theme.palette.success.main}
              tooltip="Successfully attended"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              title="Absent with Apology"
              value={stats.absentWithApology}
              icon={<MessageIcon />}
              color={theme.palette.warning.main}
              tooltip="Absent but provided apology"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              title="Absent (No Apology)"
              value={stats.absent}
              icon={<CancelIcon />}
              color={theme.palette.error.main}
              tooltip="Absent without apology"
            />
          </Grid>
        </Grid>

        {/* Attendance Rate Progress */}
        <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.05) }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" fontWeight={600}>
              Attendance Rate
            </Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">
              {stats.attendanceRate}%
            </Typography>
          </Stack>
          <LinearProgress 
            variant="determinate" 
            value={parseFloat(stats.attendanceRate)} 
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary" mt={1}>
            {stats.attended} out of {stats.total} participants attended
          </Typography>
        </Paper>

        {/* Participants Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 700 }}>Participant</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Apology Comment</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {participants.map((participant) => (
                <TableRow key={participant.id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: '#6366f1' }}>
                        {participant.name?.[0] || participant.full_name?.[0] || participant.username?.[0] || '?'}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
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
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <EmailIcon fontSize="small" sx={{ fontSize: 12 }} />
                          {participant.email}
                        </Typography>
                      )}
                      {participant.telephone && (
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PhoneIcon fontSize="small" sx={{ fontSize: 12 }} />
                          {participant.telephone}
                        </Typography>
                      )}
                      {participant.organization && (
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <BusinessIcon fontSize="small" sx={{ fontSize: 12 }} />
                          {participant.organization}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {participant.is_chairperson ? (
                      <Chip size="small" label="Chairperson" color="primary" variant="outlined" />
                    ) : (
                      <Chip size="small" label="Member" color="default" variant="outlined" />
                    )}
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
                        <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                      <Tooltip title="Mark Absent (No Apology)">
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

        {/* Loading Overlay */}
        {loading && (
          <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Stack>
    </Fade>
  );
};

export default ParticipantsTab;