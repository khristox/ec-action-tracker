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
  ListItemButton,
  TextField,
  Alert,
  CircularProgress,
  Snackbar,
  Divider,
  LinearProgress,
  Fade,
  Zoom,
  useTheme,
  alpha,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  FormHelperText
} from '@mui/material';
import {
  People as PeopleIcon,
   HourglassEmpty as HourglassEmptyIcon,  
  Check as CheckIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassIcon,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Send as SendIcon,
  Close as CloseIcon,
  Message as MessageIcon,
  Lock as LockIcon,
  PlayCircle as PlayCircleIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  Star as StarIcon,
  AssignmentInd as SecretaryIcon,
  GroupAdd as GroupAddIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

// ==================== Add Participant Dialog Component ====================
const AddParticipantDialog = memo(({ 
  open, 
  onClose, 
  onAdd, 
  existingParticipants = [],
  loading 
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [participantType, setParticipantType] = useState('new');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    telephone: '',
    title: '',
    organization: ''
  });
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [participantLists, setParticipantLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [listParticipants, setListParticipants] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open && participantType === 'from_list') {
      fetchParticipantLists();
    }
  }, [open, participantType]);

  const fetchParticipantLists = async () => {
    try {
      const response = await api.get('/action-tracker/participant-lists');
      setParticipantLists(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch participant lists:', error);
    }
  };

  const fetchListParticipants = async (listId) => {
    try {
      const response = await api.get(`/action-tracker/participant-lists/${listId}/participants`);
      setListParticipants(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch list participants:', error);
    }
  };

  const handleListChange = async (listId) => {
    setSelectedList(listId);
    if (listId) {
      await fetchListParticipants(listId);
    } else {
      setListParticipants([]);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (participantType === 'new') {
      if (!formData.name.trim()) newErrors.name = 'Name is required';
      if (!formData.email.trim() && !formData.telephone.trim()) {
        newErrors.contact = 'Either email or telephone is required';
      }
      if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Invalid email format';
      }
    } else if (participantType === 'existing' && !selectedParticipant) {
      newErrors.participant = 'Please select a participant';
    } else if (participantType === 'from_list' && (!selectedList || listParticipants.length === 0)) {
      newErrors.list = 'Please select a participant list';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      let participantsToAdd = [];
      
      if (participantType === 'new') {
        participantsToAdd = [formData];
      } else if (participantType === 'existing' && selectedParticipant) {
        participantsToAdd = [{
          name: selectedParticipant.name,
          email: selectedParticipant.email,
          telephone: selectedParticipant.telephone,
          title: selectedParticipant.title,
          organization: selectedParticipant.organization
        }];
      } else if (participantType === 'from_list' && selectedList) {
        participantsToAdd = listParticipants.map(p => ({
          name: p.name,
          email: p.email,
          telephone: p.telephone,
          title: p.title,
          organization: p.organization
        }));
      }
      
      await onAdd(participantsToAdd);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Failed to add participants:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      telephone: '',
      title: '',
      organization: ''
    });
    setSelectedParticipant(null);
    setSelectedList(null);
    setListParticipants([]);
    setErrors({});
    setParticipantType('new');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // FIXED: Changed 'participants' to 'existingParticipants'
  const availableParticipants = (existingParticipants || []).filter(
    p => !existingParticipants.some(ep => ep.email === p.email || ep.telephone === p.telephone)
  );

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
            <PersonAddIcon color="primary" />
            <Typography variant="h6">Add Participants</Typography>
          </Stack>
          <IconButton onClick={handleClose} disabled={isSubmitting}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Add Method</InputLabel>
            <Select
              value={participantType}
              onChange={(e) => setParticipantType(e.target.value)}
              label="Add Method"
            >
              <MenuItem value="new">
                <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Create New Participant" secondary="Add a brand new participant" />
              </MenuItem>
              <MenuItem value="existing">
                <ListItemIcon><PeopleIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Select Existing" secondary="Choose from existing participants" />
              </MenuItem>
              <MenuItem value="from_list">
                <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="From Participant List" secondary="Add multiple participants from a list" />
              </MenuItem>
            </Select>
          </FormControl>

          {participantType === 'new' && (
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Full Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={!!errors.name}
                helperText={errors.name}
                required
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={!!errors.email}
                helperText={errors.email}
              />
              <TextField
                fullWidth
                label="Telephone"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                helperText="Either email or telephone is required"
              />
              <TextField
                fullWidth
                label="Title / Position"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
              <TextField
                fullWidth
                label="Organization"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
              />
            </Stack>
          )}

          {participantType === 'existing' && (
            <Autocomplete
              options={availableParticipants}
              getOptionLabel={(option) => `${option.name} - ${option.email || option.telephone}`}
              value={selectedParticipant}
              onChange={(e, newValue) => setSelectedParticipant(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Participant"
                  placeholder="Search by name, email, or phone"
                  error={!!errors.participant}
                  helperText={errors.participant}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {option.name?.[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{option.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.email} {option.telephone && `| ${option.telephone}`}
                      </Typography>
                    </Box>
                  </Stack>
                </li>
              )}
              isOptionEqualToValue={(option, value) => option.id === value?.id}
            />
          )}

          {participantType === 'from_list' && (
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Select Participant List</InputLabel>
                <Select
                  value={selectedList || ''}
                  onChange={(e) => handleListChange(e.target.value)}
                  label="Select Participant List"
                  error={!!errors.list}
                >
                  <MenuItem value="">None</MenuItem>
                  {participantLists.map(list => (
                    <MenuItem key={list.id} value={list.id}>
                      {list.name} ({list.participant_count || list.participants?.length || 0} participants)
                    </MenuItem>
                  ))}
                </Select>
                {errors.list && <FormHelperText error>{errors.list}</FormHelperText>}
              </FormControl>

              {selectedList && listParticipants.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Participants to add ({listParticipants.length}):
                  </Typography>
                  <Stack spacing={1}>
                    {listParticipants.map(p => (
                      <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2">{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.email || p.telephone}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {isSubmitting ? 'Adding...' : 'Add Participants'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

AddParticipantDialog.displayName = 'AddParticipantDialog';

// ==================== Apology Dialog Component ====================
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
            <Typography variant="h6">Mark Absent with Apology</Typography>
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
              helperText={`${message.length}/500 characters`}
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

// ==================== Stat Card Component ====================
const StatCard = memo(({ title, value, icon, color, tooltip }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  return (
    <Zoom in={true} style={{ transitionDelay: '100ms' }}>
      <Card variant="outlined" sx={{ 
        height: '100%', 
        transition: 'transform 0.2s', 
        '&:hover': { transform: 'translateY(-4px)' },
        bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
        borderColor: isDarkMode ? alpha(theme.palette.common.white, 0.1) : undefined
      }}>
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
  );
});

StatCard.displayName = 'StatCard';

// ==================== Main ParticipantsTab Component ====================
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
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [showApologyDialog, setShowApologyDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isMeetingStarted, setIsMeetingStarted] = useState(false);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  const canEdit = useMemo(() => {
    return !isMeetingEnded && meetingStatus?.toLowerCase() !== 'ended' && meetingStatus?.toLowerCase() !== 'cancelled';
  }, [isMeetingEnded, meetingStatus]);

  const checkMeetingStatus = useCallback(() => {
    const status = meetingStatus?.toLowerCase();
    
    if (status === 'ended' || status === 'cancelled' || status === 'completed') {
      setIsMeetingEnded(true);
      setIsMeetingStarted(false);
      setTimeRemaining(null);
      return false;
    }
    
    if (status === 'in_progress' || status === 'started' || status === 'ongoing') {
      setIsMeetingStarted(true);
      setIsMeetingEnded(false);
      setTimeRemaining(null);
      return true;
    }

    if (meetingStartTime) {
      const now = new Date();
      const startTime = new Date(meetingStartTime);
      const started = now >= startTime;
      setIsMeetingStarted(started);
      setIsMeetingEnded(false);

      if (!started) {
        const diffMs = startTime - now;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;
        setTimeRemaining(diffHours > 0 ? `${diffHours}h ${remainingMins}m` : `${diffMins} minutes`);
      } else {
        setTimeRemaining(null);
      }
      return started;
    }

    setIsMeetingStarted(false);
    setIsMeetingEnded(false);
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

  const handleAddParticipants = async (newParticipants) => {
    setLoading(true);
    try {
      for (const participant of newParticipants) {
        await api.post(`/action-tracker/meetings/${meetingId}/participants`, participant);
      }
      
      setSnackbar({
        open: true,
        message: `Successfully added ${newParticipants.length} participant(s)`,
        severity: 'success'
      });
      
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to add participants:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to add participants',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetChairperson = useCallback(async (participantId) => {
    if (!canEdit) {
      setSnackbar({ open: true, message: 'Cannot modify roles. Meeting has ended.', severity: 'warning' });
      return;
    }
    
    setLoading(true);
    try {
      const participantsResponse = await api.get(`/action-tracker/meetings/${meetingId}/participants`);
      const currentParticipants = participantsResponse.data;
      const currentChairperson = currentParticipants.find(p => p.is_chairperson === true);
      
      await api.patch(`/action-tracker/meetings/${meetingId}/participants/${participantId}`, { is_chairperson: true });
      
      if (currentChairperson && currentChairperson.id !== participantId) {
        await api.patch(`/action-tracker/meetings/${meetingId}/participants/${currentChairperson.id}`, { is_chairperson: false });
      }
      
      await api.patch(`/action-tracker/meetings/${meetingId}`, { chairperson_id: participantId });
      
      setChairpersonId(participantId);
      setParticipants(prev => prev.map(p => ({ ...p, is_chairperson: p.id === participantId })));
      
      setSnackbar({ open: true, message: 'Chairperson updated successfully', severity: 'success' });
      if (onRefresh) onRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Failed to update chairperson', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [meetingId, onRefresh, canEdit]);

  const handleSetSecretary = useCallback(async (participantId) => {
    if (!canEdit) {
      setSnackbar({ open: true, message: 'Cannot modify roles. Meeting has ended.', severity: 'warning' });
      return;
    }
    
    setLoading(true);
    try {
      const participantsResponse = await api.get(`/action-tracker/meetings/${meetingId}/participants`);
      const currentParticipants = participantsResponse.data;
      const currentSecretary = currentParticipants.find(p => p.is_secretary === true);
      
      await api.patch(`/action-tracker/meetings/${meetingId}/participants/${participantId}`, { is_secretary: true });
      
      if (currentSecretary && currentSecretary.id !== participantId) {
        await api.patch(`/action-tracker/meetings/${meetingId}/participants/${currentSecretary.id}`, { is_secretary: false });
      }
      
      await api.patch(`/action-tracker/meetings/${meetingId}`, { secretary_id: participantId });
      
      setSecretaryId(participantId);
      setParticipants(prev => prev.map(p => ({ ...p, is_secretary: p.id === participantId })));
      
      setSnackbar({ open: true, message: 'Secretary updated successfully', severity: 'success' });
      if (onRefresh) onRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Failed to update secretary', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [meetingId, onRefresh, canEdit]);

  const handleAttendanceChange = useCallback(async (participantId, status, comment = '') => {
    if (!isMeetingStarted) {
      setSnackbar({ open: true, message: 'Cannot update attendance. Meeting has not started yet.', severity: 'warning' });
      return;
    }
    
    if (!canEdit) {
      setSnackbar({ open: true, message: 'Cannot update attendance. Meeting has ended.', severity: 'warning' });
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/action-tracker/meetings/${meetingId}/participants/${participantId}`, {
        attendance_status: status,
        apology_comment: comment
      });

      setAttendanceStatus(prev => ({ ...prev, [participantId]: status }));
      if (comment) setApologyComments(prev => ({ ...prev, [participantId]: comment }));

      setSnackbar({
        open: true,
        message: status === 'absent_with_apology' ? 'Marked as absent with apology' : `Attendance marked as ${status.replace('_', ' ')}`,
        severity: status === 'absent' || status === 'absent_with_apology' ? 'warning' : 'success'
      });

      if (onRefresh) onRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Failed to update attendance', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [meetingId, isMeetingStarted, canEdit, onRefresh]);

  const handleOpenApologyDialog = useCallback((participant) => {
    if (!isMeetingStarted) {
      setSnackbar({ open: true, message: 'Cannot submit apology. Meeting has not started yet.', severity: 'warning' });
      return;
    }
    
    if (!canEdit) {
      setSnackbar({ open: true, message: 'Cannot submit apology. Meeting has ended.', severity: 'warning' });
      return;
    }
    
    setSelectedParticipant(participant);
    setShowApologyDialog(true);
  }, [isMeetingStarted, canEdit]);

  const handleSubmitApology = useCallback(async (message) => {
    if (!selectedParticipant) return;
    await handleAttendanceChange(selectedParticipant.id, 'absent_with_apology', message);
    
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
      return <Chip size="small" label="Pending" color="default" icon={<HourglassEmptyIcon />} />;  // Now this works
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

  // Meeting Ended - Read Only Mode
  if (!canEdit) {
    return (
      <Fade in={true}>
        <Stack spacing={3}>
          <Alert severity="info" icon={<LockIcon />} sx={{ borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={600}>Meeting Ended - View Only Mode</Typography>
            <Typography variant="body2">This meeting has ended. Attendance tracking and participant management are disabled.</Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard title="Total Participants" value={stats.total} icon={<PeopleIcon />} color={theme.palette.primary.main} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard title="Attended" value={stats.attended} icon={<CheckIcon />} color={theme.palette.success.main} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard title="Absent with Apology" value={stats.absentWithApology} icon={<MessageIcon />} color={theme.palette.warning.main} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard title="Absent (No Apology)" value={stats.absent} icon={<CancelIcon />} color={theme.palette.error.main} />
            </Grid>
          </Grid>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Participant</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Apology Comment</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {participants.map((participant) => (
                  <TableRow key={participant.id} hover sx={{ opacity: 0.8 }}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar sx={{ width: 36, height: 36 }}>
                          {participant.name?.[0] || participant.full_name?.[0] || '?'}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600}>{participant.name || participant.full_name}</Typography>
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
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {participant.is_chairperson && <Chip size="small" label="Chairperson" color="primary" variant="outlined" icon={<StarIcon />} />}
                        {participant.is_secretary && <Chip size="small" label="Secretary" color="secondary" variant="outlined" icon={<SecretaryIcon />} />}
                        {!participant.is_chairperson && !participant.is_secretary && <Chip size="small" label="Member" color="default" variant="outlined" />}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(attendanceStatus[participant.id] || participant.attendance_status || 'pending', apologyComments[participant.id])}
                    </TableCell>
                    <TableCell>
                      {(attendanceStatus[participant.id] === 'absent_with_apology' || participant.attendance_status === 'absent_with_apology') && (
                        <Tooltip title={apologyComments[participant.id] || participant.apology_comment || 'No comment provided'}>
                          <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {apologyComments[participant.id] || participant.apology_comment || 'No comment provided'}
                          </Typography>
                        </Tooltip>
                      )}
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
          severity={isMeetingStarted ? "success" : "info"} 
          icon={isMeetingStarted ? <PlayCircleIcon /> : <ScheduleIcon />} 
          sx={{ borderRadius: 2 }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            {isMeetingStarted ? "Meeting in Progress" : "Meeting Not Started"}
          </Typography>
          <Typography variant="body2">
            {isMeetingStarted 
              ? "You can now mark attendance, assign roles, and manage participants." 
              : timeRemaining 
                ? `Attendance tracking will be enabled when the meeting starts in approximately ${timeRemaining}.`
                : "Attendance tracking will be enabled when the meeting starts."}
          </Typography>
        </Alert>

        {canEdit && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setShowAddParticipantDialog(true)} sx={{ borderRadius: 2 }}>
              Add Participants
            </Button>
          </Box>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Total Participants" value={stats.total} icon={<PeopleIcon />} color={theme.palette.primary.main} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Attended" value={stats.attended} icon={<CheckIcon />} color={theme.palette.success.main} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Absent with Apology" value={stats.absentWithApology} icon={<MessageIcon />} color={theme.palette.warning.main} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Absent (No Apology)" value={stats.absent} icon={<CancelIcon />} color={theme.palette.error.main} />
          </Grid>
        </Grid>

        <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" fontWeight={600}>Attendance Rate</Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">{stats.attendanceRate}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={parseFloat(stats.attendanceRate)} sx={{ height: 8, borderRadius: 4 }} />
          <Typography variant="caption" color="text.secondary" mt={1}>
            {stats.attended} out of {stats.total} participants attended
          </Typography>
        </Paper>

        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : '#f8fafc' }}>
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
                      <Avatar sx={{ 
                        width: 36, height: 36, 
                        bgcolor: participant.is_chairperson ? theme.palette.primary.main : (participant.is_secretary ? theme.palette.secondary.main : '#6366f1')
                      }}>
                        {participant.name?.[0] || participant.full_name?.[0] || '?'}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{participant.name || participant.full_name}</Typography>
                        {participant.title && <Typography variant="caption" color="text.secondary">{participant.title}</Typography>}
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      {participant.email && (
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <EmailIcon fontSize="small" sx={{ fontSize: 12 }} /> {participant.email}
                        </Typography>
                      )}
                      {participant.telephone && (
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PhoneIcon fontSize="small" sx={{ fontSize: 12 }} /> {participant.telephone}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {chairpersonId === participant.id ? (
                        <Chip size="small" label="Chairperson" color="primary" icon={<StarIcon />} />
                      ) : (
                        <Button size="small" variant="outlined" startIcon={<StarIcon />} onClick={() => handleSetChairperson(participant.id)} disabled={loading}>
                          Set as Chairperson
                        </Button>
                      )}
                      
                      {secretaryId === participant.id ? (
                        <Chip size="small" label="Secretary" color="secondary" icon={<SecretaryIcon />} />
                      ) : (
                        <Button size="small" variant="outlined" startIcon={<SecretaryIcon />} onClick={() => handleSetSecretary(participant.id)} disabled={loading}>
                          Set as Secretary
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {getStatusChip(attendanceStatus[participant.id] || participant.attendance_status || 'pending', apologyComments[participant.id])}
                  </TableCell>
                  <TableCell>
                    {(attendanceStatus[participant.id] === 'absent_with_apology' || participant.attendance_status === 'absent_with_apology') && (
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
                        <IconButton size="small" color="success" onClick={() => handleAttendanceChange(participant.id, 'attended')} disabled={attendanceStatus[participant.id] === 'attended' || loading}>
                          <CheckIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Mark Absent">
                        <IconButton size="small" color="error" onClick={() => handleAttendanceChange(participant.id, 'absent')} disabled={attendanceStatus[participant.id] === 'absent' || loading}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Mark Absent with Apology">
                        <IconButton size="small" color="warning" onClick={() => handleOpenApologyDialog(participant)} disabled={attendanceStatus[participant.id] === 'absent_with_apology' || loading}>
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

        <AddParticipantDialog
          open={showAddParticipantDialog}
          onClose={() => setShowAddParticipantDialog(false)}
          onAdd={handleAddParticipants}
          existingParticipants={participants}
          loading={loading}
        />

        <ApologyDialog
          open={showApologyDialog}
          onClose={() => setShowApologyDialog(false)}
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

        <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Stack>
    </Fade>
  );
};

export default ParticipantsTab;