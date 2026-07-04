// src/components/actiontracker/meetings/components/MeetingRecorder.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Paper,
  LinearProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Avatar,
  AvatarGroup,
  useTheme,
  useMediaQuery,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  Mic,
  MicOff,
  PlayArrow,
  Pause,
  Stop,
  Save,
  Cancel,
  Delete,
  Edit,
  CheckCircle,        // ✅ Fixed
  Error,              // ✅ Fixed - was ErrorOutlined
  Warning,            // ✅ Fixed - was WarningOutlined
  Info,               // ✅ Fixed - was InfoOutlined
  Timer,
  AccessTime,
  CalendarToday,
  LocationOn,
  People,
  Videocam,
  Close,
} from '@mui/icons-material';
import { format } from 'date-fns';

// ============ CONSTANTS ============
const RECORDING_STATUS = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error',
};

// ============ SUB-COMPONENTS ============
const TimerDisplay = ({ seconds }) => {
  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Timer sx={{ fontSize: 20, color: 'text.secondary' }} />
      <Typography variant="h4" fontWeight="700" fontFamily="monospace">
        {formatTime(seconds)}
      </Typography>
    </Box>
  );
};

const StatusIndicator = ({ status }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case RECORDING_STATUS.RECORDING:
        return { label: 'Recording', color: '#d32f2f', icon: <Mic /> };
      case RECORDING_STATUS.PAUSED:
        return { label: 'Paused', color: '#ed6c02', icon: <Pause /> };
      case RECORDING_STATUS.STOPPED:
        return { label: 'Stopped', color: '#2e7d32', icon: <Stop /> };
      case RECORDING_STATUS.SAVED:
        return { label: 'Saved', color: '#1976d2', icon: <Save /> };
      case RECORDING_STATUS.ERROR:
        return { label: 'Error', color: '#d32f2f', icon: <Error /> };
      default:
        return { label: 'Ready', color: '#9E9E9E', icon: null };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Chip
      label={config.label}
      icon={config.icon}
      size="small"
      sx={{
        bgcolor: alpha(config.color, 0.1),
        color: config.color,
        fontWeight: 600,
        '& .MuiChip-icon': { color: config.color },
      }}
    />
  );
};

// ============ MAIN COMPONENT ============
export const MeetingRecorder = ({
  meeting,
  onSave,
  onCancel,
  onComplete,
  participants = [],
  agendaItems = [],
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  // State
  const [status, setStatus] = useState(RECORDING_STATUS.IDLE);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [recordingName, setRecordingName] = useState('');
  const [selectedAgendaItem, setSelectedAgendaItem] = useState('');
  const [actionItems, setActionItems] = useState([]);
  const [newAction, setNewAction] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isSaving, setIsSaving] = useState(false);

  // Timer ref
  const timerRef = React.useRef(null);

  // Get meeting info for recording name
  const defaultRecordingName = useMemo(() => {
    if (!meeting) return 'Meeting Recording';
    const date = format(new Date(meeting.meeting_date), 'yyyy-MM-dd');
    return `${meeting.title || 'Meeting'} - ${date}`;
  }, [meeting]);

  // Initialize recording name
  useEffect(() => {
    if (!recordingName) {
      setRecordingName(defaultRecordingName);
    }
  }, [defaultRecordingName, recordingName]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Timer logic
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Recording controls
  const handleStartRecording = useCallback(() => {
    setStatus(RECORDING_STATUS.RECORDING);
    startTimer();
    setSnackbar({
      open: true,
      message: 'Recording started...',
      severity: 'info',
    });
  }, [startTimer]);

  const handlePauseRecording = useCallback(() => {
    setStatus(RECORDING_STATUS.PAUSED);
    pauseTimer();
    setSnackbar({
      open: true,
      message: 'Recording paused',
      severity: 'info',
    });
  }, [pauseTimer]);

  const handleResumeRecording = useCallback(() => {
    setStatus(RECORDING_STATUS.RECORDING);
    startTimer();
    setSnackbar({
      open: true,
      message: 'Recording resumed',
      severity: 'info',
    });
  }, [startTimer]);

  const handleStopRecording = useCallback(() => {
    setStatus(RECORDING_STATUS.STOPPED);
    stopTimer();
    setShowSaveDialog(true);
    setSnackbar({
      open: true,
      message: 'Recording stopped. Save your recording.',
      severity: 'info',
    });
  }, [stopTimer]);

  const handleCancelRecording = useCallback(() => {
    stopTimer();
    setElapsedSeconds(0);
    setStatus(RECORDING_STATUS.IDLE);
    setNotes('');
    setActionItems([]);
    if (onCancel) {
      onCancel();
    }
    setSnackbar({
      open: true,
      message: 'Recording cancelled',
      severity: 'warning',
    });
  }, [stopTimer, onCancel]);

  // Save recording
  const handleSaveRecording = useCallback(async () => {
    setIsSaving(true);
    setStatus(RECORDING_STATUS.SAVING);

    try {
      const recordingData = {
        meetingId: meeting?.id,
        name: recordingName || defaultRecordingName,
        duration: elapsedSeconds,
        notes: notes,
        agendaItemId: selectedAgendaItem,
        actionItems: actionItems,
        recordedAt: new Date().toISOString(),
        status: 'completed',
      };

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (onSave) {
        await onSave(recordingData);
      }

      setStatus(RECORDING_STATUS.SAVED);
      setShowSaveDialog(false);
      setSnackbar({
        open: true,
        message: 'Recording saved successfully! ✅',
        severity: 'success',
      });

      if (onComplete) {
        onComplete(recordingData);
      }
    } catch (error) {
      console.error('Error saving recording:', error);
      setStatus(RECORDING_STATUS.ERROR);
      setSnackbar({
        open: true,
        message: 'Failed to save recording. Please try again.',
        severity: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    meeting,
    recordingName,
    defaultRecordingName,
    elapsedSeconds,
    notes,
    selectedAgendaItem,
    actionItems,
    onSave,
    onComplete,
  ]);

  // Add action item
  const handleAddAction = useCallback(() => {
    if (newAction.trim()) {
      setActionItems((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: newAction.trim(),
          completed: false,
          created_at: new Date().toISOString(),
        },
      ]);
      setNewAction('');
    }
  }, [newAction]);

  // Remove action item
  const handleRemoveAction = useCallback((id) => {
    setActionItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Toggle action item completion
  const handleToggleAction = useCallback((id) => {
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  }, []);

  // Close snackbar
  const handleCloseSnackbar = useCallback(() => {
    setSnackbar({ ...snackbar, open: false });
  }, [snackbar]);

  // Close save dialog
  const handleCloseSaveDialog = useCallback(() => {
    if (!isSaving) {
      setShowSaveDialog(false);
    }
  }, [isSaving]);

  // Format duration for display
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Recording controls
  const renderControls = () => {
    const isIdle = status === RECORDING_STATUS.IDLE;
    const isRecording = status === RECORDING_STATUS.RECORDING;
    const isPaused = status === RECORDING_STATUS.PAUSED;
    const isStopped = status === RECORDING_STATUS.STOPPED;
    const isSaving = status === RECORDING_STATUS.SAVING;
    const isSaved = status === RECORDING_STATUS.SAVED;
    const isError = status === RECORDING_STATUS.ERROR;
    const isActive = isRecording || isPaused;

    if (isSaved || isError) {
      return null;
    }

    return (
      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
        {isIdle && (
          <Button
            variant="contained"
            color="error"
            startIcon={<Mic />}
            onClick={handleStartRecording}
            sx={{ borderRadius: 2 }}
          >
            Start Recording
          </Button>
        )}

        {isRecording && (
          <>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<Pause />}
              onClick={handlePauseRecording}
              sx={{ borderRadius: 2 }}
            >
              Pause
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<Stop />}
              onClick={handleStopRecording}
              sx={{ borderRadius: 2 }}
            >
              Stop
            </Button>
          </>
        )}

        {isPaused && (
          <>
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayArrow />}
              onClick={handleResumeRecording}
              sx={{ borderRadius: 2 }}
            >
              Resume
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<Stop />}
              onClick={handleStopRecording}
              sx={{ borderRadius: 2 }}
            >
              Stop
            </Button>
          </>
        )}

        {isActive && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<Cancel />}
            onClick={handleCancelRecording}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
        )}

        {isStopped && !isSaving && (
          <>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Save />}
              onClick={() => setShowSaveDialog(true)}
              sx={{ borderRadius: 2 }}
            >
              Save Recording
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Cancel />}
              onClick={handleCancelRecording}
              sx={{ borderRadius: 2 }}
            >
              Discard
            </Button>
          </>
        )}

        {isSaving && (
          <Button variant="contained" disabled sx={{ borderRadius: 2 }}>
            <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
            Saving...
          </Button>
        )}
      </Stack>
    );
  };

  // Recording status display
  const renderStatus = () => {
    if (status === RECORDING_STATUS.IDLE) {
      return (
        <Alert severity="info" icon={<Info />} sx={{ borderRadius: 2 }}>
          Ready to start recording. Click the "Start Recording" button to begin.
        </Alert>
      );
    }

    if (status === RECORDING_STATUS.RECORDING) {
      return (
        <Alert
          severity="error"
          icon={<Mic />}
          sx={{
            borderRadius: 2,
            bgcolor: alpha('#d32f2f', 0.05),
            '& .MuiAlert-icon': {
              animation: 'pulse 1.5s ease-in-out infinite',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight="600">
              🔴 RECORDING IN PROGRESS
            </Typography>
            <StatusIndicator status={status} />
          </Box>
        </Alert>
      );
    }

    if (status === RECORDING_STATUS.PAUSED) {
      return (
        <Alert severity="warning" icon={<Pause />} sx={{ borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight="600">
              ⏸️ RECORDING PAUSED
            </Typography>
            <StatusIndicator status={status} />
          </Box>
        </Alert>
      );
    }

    if (status === RECORDING_STATUS.STOPPED) {
      return (
        <Alert severity="success" icon={<Stop />} sx={{ borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight="600">
              ⏹️ RECORDING STOPPED
            </Typography>
            <StatusIndicator status={status} />
          </Box>
        </Alert>
      );
    }

    if (status === RECORDING_STATUS.SAVED) {
      return (
        <Alert
          severity="success"
          icon={<CheckCircle />}
          sx={{ borderRadius: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight="600">
              ✅ RECORDING SAVED SUCCESSFULLY
            </Typography>
            <StatusIndicator status={status} />
          </Box>
        </Alert>
      );
    }

    if (status === RECORDING_STATUS.ERROR) {
      return (
        <Alert severity="error" icon={<Error />} sx={{ borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight="600">
              ❌ RECORDING ERROR
            </Typography>
            <StatusIndicator status={status} />
          </Box>
        </Alert>
      );
    }

    return null;
  };

  // Save dialog
  const renderSaveDialog = () => (
    <Dialog
      open={showSaveDialog}
      onClose={handleCloseSaveDialog}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={isSaving}
      PaperProps={{
        sx: { borderRadius: 3, p: isMobile ? 1 : 2 },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Save color="primary" />
            <Typography variant="h6" fontWeight="700">
              Save Recording
            </Typography>
            <Chip
              label={formatDuration(elapsedSeconds)}
              size="small"
              color="primary"
              sx={{ ml: 1 }}
            />
          </Box>
          <IconButton onClick={handleCloseSaveDialog} disabled={isSaving}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          {/* Recording Name */}
          <TextField
            label="Recording Name"
            fullWidth
            value={recordingName}
            onChange={(e) => setRecordingName(e.target.value)}
            disabled={isSaving}
            variant="outlined"
          />

          {/* Meeting Info Display */}
          {meeting && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: alpha('#1976d2', 0.02) }}>
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Meeting Details
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {format(new Date(meeting.meeting_date), 'dd MMM yyyy')}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {meeting.start_time} - {meeting.end_time || 'TBD'}
                    </Typography>
                  </Box>
                </Grid>
                {meeting.location && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {meeting.location}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {participants.length > 0 && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <People sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {participants.length} participants
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Paper>
          )}

          {/* Agenda Item Selection */}
          {agendaItems.length > 0 && (
            <FormControl fullWidth disabled={isSaving}>
              <InputLabel>Agenda Item</InputLabel>
              <Select
                value={selectedAgendaItem}
                onChange={(e) => setSelectedAgendaItem(e.target.value)}
                label="Agenda Item"
              >
                <MenuItem value="">None</MenuItem>
                {agendaItems.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.title || item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Notes */}
          <TextField
            label="Meeting Notes"
            fullWidth
            multiline
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSaving}
            placeholder="Enter meeting notes, decisions, and key points..."
          />

          {/* Action Items */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Action Items
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Add action item..."
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                disabled={isSaving}
                onKeyPress={(e) => e.key === 'Enter' && handleAddAction()}
              />
              <Button
                variant="contained"
                onClick={handleAddAction}
                disabled={!newAction.trim() || isSaving}
                sx={{ flexShrink: 0 }}
              >
                Add
              </Button>
            </Box>

            {actionItems.length > 0 && (
              <Stack spacing={1}>
                {actionItems.map((item) => (
                  <Paper
                    key={item.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      bgcolor: item.completed ? alpha('#2e7d32', 0.04) : 'transparent',
                      opacity: item.completed ? 0.7 : 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleAction(item.id)}
                        color={item.completed ? 'success' : 'default'}
                        disabled={isSaving}
                      >
                        <CheckCircle fontSize="small" />
                      </IconButton>
                      <Typography
                        variant="body2"
                        sx={{
                          textDecoration: item.completed ? 'line-through' : 'none',
                          color: item.completed ? 'text.secondary' : 'text.primary',
                        }}
                      >
                        {item.text}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveAction(item.id)}
                      disabled={isSaving}
                      sx={{ color: 'text.secondary' }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0, gap: 1 }}>
        <Button
          onClick={handleCloseSaveDialog}
          disabled={isSaving}
          variant="outlined"
          startIcon={<Cancel />}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSaveRecording}
          disabled={isSaving}
          variant="contained"
          startIcon={isSaving ? <CircularProgress size={20} /> : <Save />}
          color="primary"
        >
          {isSaving ? 'Saving...' : 'Save Recording'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        {/* Recording Header */}
        <Box
          sx={{
            p: isMobile ? 2 : 3,
            bgcolor: alpha('#1976d2', 0.02),
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              Meeting Recorder
            </Typography>
            <StatusIndicator status={status} />
          </Box>

          {status !== RECORDING_STATUS.IDLE && status !== RECORDING_STATUS.SAVED && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TimerDisplay seconds={elapsedSeconds} />
            </Box>
          )}
        </Box>

        <CardContent sx={{ p: isMobile ? 2 : 3 }}>
          {/* Status Display */}
          <Box sx={{ mb: 3 }}>{renderStatus()}</Box>

          {/* Recording Controls */}
          {renderControls()}

          {/* Recording Info Display */}
          {status !== RECORDING_STATUS.IDLE && status !== RECORDING_STATUS.SAVED && (
            <Box sx={{ mt: 3, p: 2, bgcolor: alpha('#000', 0.02), borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Recording Details
              </Typography>
              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTime fontSize="small" color="action" />
                  <Typography variant="body2">
                    Duration: <strong>{formatDuration(elapsedSeconds)}</strong>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Mic fontSize="small" color="action" />
                  <Typography variant="body2">
                    Status: <strong>{status.toUpperCase()}</strong>
                  </Typography>
                </Box>
                {meeting && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarToday fontSize="small" color="action" />
                    <Typography variant="body2">
                      Meeting: <strong>{meeting.title || 'Untitled'}</strong>
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          )}

          {/* Quick Stats - Show participants and agenda items */}
          {(participants.length > 0 || agendaItems.length > 0) && (
            <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {participants.length > 0 && (
                <Chip
                  icon={<People />}
                  label={`${participants.length} participants`}
                  size="small"
                  variant="outlined"
                />
              )}
              {agendaItems.length > 0 && (
                <Chip
                  icon={<Edit />}
                  label={`${agendaItems.length} agenda items`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Save Dialog */}
      {renderSaveDialog()}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </>
  );
};

export default MeetingRecorder;