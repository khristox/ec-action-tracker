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
  FormHelperText,
  Pagination,
  InputAdornment,
  debounce
} from '@mui/material';
import {
  People as PeopleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
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
  Save as SaveIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

// ==================== Helper Functions ====================
const maskEmail = (email) => {
  if (!email) return '';
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 3) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart.substring(0, 3)}***${localPart.substring(localPart.length - 2)}@${domain}`;
};

const maskPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 4) return '****';
  const last4 = cleaned.slice(-4);
  const firstPart = cleaned.slice(0, -4);
  const masked = firstPart.replace(/./g, '*');
  return `${masked}${last4}`;
};

// ==================== Stat Card Component ====================
const StatCard = memo(({ title, value, icon, color }) => {
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
              <Typography variant="caption" color="text.secondary">
                {title}
              </Typography>
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

// ==================== Remove Participant Dialog Component ====================
const RemoveParticipantDialog = memo(({ 
  open, 
  onClose, 
  onConfirm, 
  participantName,
  loading 
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error removing participant:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <DeleteIcon color="error" />
          <Typography variant="h6">Remove Participant</Typography>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Are you sure you want to remove <strong>{participantName}</strong> from this meeting?
        </Alert>
        <Typography variant="body2" color="text.secondary">
          This action cannot be undone. The participant will be permanently removed from the meeting.
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={isDeleting}
          startIcon={isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />}
        >
          {isDeleting ? 'Removing...' : 'Remove Participant'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

RemoveParticipantDialog.displayName = 'RemoveParticipantDialog';

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
  const [participantType, setParticipantType] = useState('existing');
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
  const [existingUsers, setExistingUsers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Pagination state
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userLoading, setUserLoading] = useState(false);
  const [showMaskedInfo, setShowMaskedInfo] = useState(false);
  const usersPerPage = 10;

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((value) => {
      setUserSearchTerm(value);
      setUserPage(1);
    }, 500),
    []
  );

  useEffect(() => {
    if (open && participantType === 'from_list') {
      fetchParticipantLists();
    }
    if (open && participantType === 'existing') {
      fetchAvailableUsers();
    }
  }, [open, participantType, userPage, userSearchTerm]);

  const fetchParticipantLists = async () => {
    try {
      const response = await api.get('/action-tracker/participant-lists/');
      setParticipantLists(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch participant lists:', error);
    }
  };

  const fetchAvailableUsers = async () => {
    setUserLoading(true);
    try {
      const existingEmails = new Set((existingParticipants || []).map(p => p.email?.toLowerCase()));
      
      const params = {
        skip: (userPage - 1) * usersPerPage,
        limit: usersPerPage,
        is_active: true
      };
      
      if (userSearchTerm) {
        params.search = userSearchTerm;
      }
      
      const response = await api.get('/users/', { params });
      const users = response.data.items || response.data || [];
      const total = response.data.total || users.length;
      
      const availableUsers = users.filter(user => 
        !existingEmails.has(user.email?.toLowerCase())
      );
      
      setExistingUsers(availableUsers);
      setUserTotal(total);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setUserLoading(false);
    }
  };

  const fetchListParticipants = async (listId) => {
    try {
      const response = await api.get(`/action-tracker/participant-lists/${listId}/members`);
      setListParticipants(response.data.items || []);
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

  const handleSearchChange = (event, value) => {
    debouncedSearch(value);
  };

  const handlePageChange = (event, value) => {
    setUserPage(value);
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
          name: selectedParticipant.full_name || `${selectedParticipant.first_name || ''} ${selectedParticipant.last_name || ''}`.trim() || selectedParticipant.username,
          email: selectedParticipant.email,
          telephone: selectedParticipant.phone || selectedParticipant.telephone,
          title: selectedParticipant.title,
          organization: selectedParticipant.organization,
          user_id: selectedParticipant.id
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
    setExistingUsers([]);
    setErrors({});
    setParticipantType('existing');
    setUserSearchTerm('');
    setUserPage(1);
    setShowMaskedInfo(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getFullName = (user) => {
    return user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email;
  };

  const getDisplayEmail = (email) => {
    if (!email) return '';
    return showMaskedInfo ? email : maskEmail(email);
  };

  const getDisplayPhone = (phone) => {
    if (!phone) return '';
    return showMaskedInfo ? phone : maskPhone(phone);
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
              <MenuItem value="existing">
                <ListItemIcon><PeopleIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Select Existing User" secondary="Choose from existing system users" />
              </MenuItem>
              <MenuItem value="new">
                <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Create New Participant" secondary="Add a brand new participant" />
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
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Button
                  size="small"
                  startIcon={showMaskedInfo ? <VisibilityOffIcon /> : <InfoIcon />}
                  onClick={() => setShowMaskedInfo(!showMaskedInfo)}
                >
                  {showMaskedInfo ? 'Hide Contact Info' : 'Show Contact Info'}
                </Button>
              </Box>
            
              <TextField
                fullWidth
                placeholder="Search by name, email, or phone..."
                onChange={handleSearchChange}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {userLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress size={30} />
                  </Box>
                ) : existingUsers.length === 0 ? (
                  <Alert severity="info">No users available</Alert>
                ) : (
                  <Stack spacing={1}>
                    {existingUsers.map((user) => {
                      const fullName = getFullName(user);
                      const displayEmail = getDisplayEmail(user.email);
                      const displayPhone = getDisplayPhone(user.phone);
                      const isSelected = selectedParticipant?.id === user.id;
                      
                      return (
                        <Paper
                          key={user.id}
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                            borderColor: isSelected ? theme.palette.primary.main : 'divider',
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.04),
                              transform: 'translateX(4px)'
                            }
                          }}
                          onClick={() => setSelectedParticipant(user)}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 40, height: 40 }}>
                              {fullName[0]?.toUpperCase() || 'U'}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle2" fontWeight={600}>
                                {fullName}
                              </Typography>
                              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <EmailIcon sx={{ fontSize: 12 }} />
                                  {displayEmail}
                                  {!showMaskedInfo && user.email && (
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(user.email);
                                      }}
                                      sx={{ p: 0.5 }}
                                    >
                                      <ContentCopyIcon sx={{ fontSize: 12 }} />
                                    </IconButton>
                                  )}
                                </Typography>
                                {user.phone && (
                                  <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <PhoneIcon sx={{ fontSize: 12 }} />
                                    {displayPhone}
                                  </Typography>
                                )}
                              </Stack>
                              {user.title && (
                                <Typography variant="caption" color="text.secondary">
                                  {user.title} {user.organization && `• ${user.organization}`}
                                </Typography>
                              )}
                            </Box>
                            {isSelected && <CheckIcon color="primary" fontSize="small" />}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Box>
              
              {userTotal > usersPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination
                    count={Math.ceil(userTotal / usersPerPage)}
                    page={userPage}
                    onChange={handlePageChange}
                    color="primary"
                    size="small"
                  />
                </Box>
              )}
              
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                Showing {Math.min((userPage - 1) * usersPerPage + 1, userTotal)} - {Math.min(userPage * usersPerPage, userTotal)} of {userTotal} users
              </Typography>
            </Stack>
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
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [participantToRemove, setParticipantToRemove] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isMeetingStarted, setIsMeetingStarted] = useState(false);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showMaskedInfo, setShowMaskedInfo] = useState(false);

  const canEdit = useMemo(() => {
    return !isMeetingEnded && meetingStatus?.toLowerCase() !== 'ended' && meetingStatus?.toLowerCase() !== 'cancelled';
  }, [isMeetingEnded, meetingStatus]);

  const getDisplayEmail = (email) => {
    if (!email) return '';
    return showMaskedInfo ? email : maskEmail(email);
  };

  const getDisplayPhone = (phone) => {
    if (!phone) return '';
    return showMaskedInfo ? phone : maskPhone(phone);
  };

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
        await api.post(`/action-tracker/meetings/${meetingId}/members`, participant);
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
    
    try {
      await api.post(`/action-tracker/meetings/${meetingId}/notify-participants`, {
        participant_ids: [selectedParticipant.id],
        notification_type: ['email'],
        custom_message: `Apology Reason: ${message}`
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }, [selectedParticipant, handleAttendanceChange, meetingId]);

  const handleRemoveParticipant = useCallback(async (participantId) => {
    setLoading(true);
    try {
      await api.delete(`/action-tracker/meetings/${meetingId}/participants/${participantId}`);
      
      setSnackbar({
        open: true,
        message: 'Participant removed successfully',
        severity: 'success'
      });
      
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to remove participant:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to remove participant',
        severity: 'error'
      });
    } finally {
      setLoading(false);
      setShowRemoveDialog(false);
      setParticipantToRemove(null);
    }
  }, [meetingId, onRefresh]);

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
        return <Chip size="small" label="Pending" color="default" icon={<HourglassEmptyIcon />} />;
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

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              startIcon={showMaskedInfo ? <VisibilityOffIcon /> : <InfoIcon />}
              onClick={() => setShowMaskedInfo(!showMaskedInfo)}
            >
              {showMaskedInfo ? 'Hide Contact Info' : 'Show Contact Info'}
            </Button>
          </Box>

          {/* Stats Row */}
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

          {/* Participants Table - Read Only */}
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
                {participants.map((participant) => {
                  const fullName = participant.name || participant.full_name || `${participant.first_name || ''} ${participant.last_name || ''}`.trim() || participant.email;
                  return (
                    <TableRow key={participant.id} hover sx={{ opacity: 0.8 }}>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
                            {fullName?.[0]?.toUpperCase() || '?'}
                          </Avatar>
                          <Typography variant="body2" fontWeight={600}>{fullName}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          {participant.email && (
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EmailIcon fontSize="small" sx={{ fontSize: 12 }} />
                              {getDisplayEmail(participant.email)}
                            </Typography>
                          )}
                          {participant.telephone && (
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PhoneIcon fontSize="small" sx={{ fontSize: 12 }} />
                              {getDisplayPhone(participant.telephone)}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          {chairpersonId === participant.id && <Chip size="small" label="Chairperson" color="primary" variant="outlined" icon={<StarIcon />} />}
                          {secretaryId === participant.id && <Chip size="small" label="Secretary" color="secondary" variant="outlined" icon={<SecretaryIcon />} />}
                          {chairpersonId !== participant.id && secretaryId !== participant.id && <Chip size="small" label="Member" color="default" variant="outlined" />}
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
                  );
                })}
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

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            <PeopleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Participants ({stats.total})
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={showMaskedInfo ? <VisibilityOffIcon /> : <InfoIcon />}
              onClick={() => setShowMaskedInfo(!showMaskedInfo)}
            >
              {showMaskedInfo ? 'Hide Contact Info' : 'Show Contact Info'}
            </Button>
            <Button 
              variant="contained" 
              startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />} 
              onClick={() => onRefresh?.()} 
              disabled={loading}
              sx={{ borderRadius: 2 }}
            >
              Refresh
            </Button>
          </Stack>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setShowAddParticipantDialog(true)} sx={{ borderRadius: 2 }}>
            Add Participants
          </Button>
        </Box>

        {/* Stats Row */}
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

        {/* Attendance Rate */}
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

        {/* Participants Table */}
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
              {participants.map((participant) => {
                const fullName = participant.name || participant.full_name || `${participant.first_name || ''} ${participant.last_name || ''}`.trim() || participant.email;
                const isChairperson = chairpersonId === participant.id;
                const isSecretary = secretaryId === participant.id;
                const currentStatus = attendanceStatus[participant.id] || participant.attendance_status || 'pending';
                
                return (
                  <TableRow key={participant.id} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar sx={{ 
                          width: 36, height: 36, 
                          bgcolor: isChairperson ? theme.palette.primary.main : (isSecretary ? theme.palette.secondary.main : '#6366f1')
                        }}>
                          {fullName?.[0]?.toUpperCase() || '?'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{fullName}</Typography>
                          {participant.title && <Typography variant="caption" color="text.secondary">{participant.title}</Typography>}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {participant.email && (
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon fontSize="small" sx={{ fontSize: 12 }} />
                            {getDisplayEmail(participant.email)}
                          </Typography>
                        )}
                        {participant.telephone && (
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon fontSize="small" sx={{ fontSize: 12 }} />
                            {getDisplayPhone(participant.telephone)}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {isChairperson ? (
                          <Chip size="small" label="Chairperson" color="primary" icon={<StarIcon />} />
                        ) : (
                          <Button size="small" variant="outlined" startIcon={<StarIcon />} onClick={() => handleSetChairperson(participant.id)} disabled={loading}>
                            Set as Chairperson
                          </Button>
                        )}
                        
                        {isSecretary ? (
                          <Chip size="small" label="Secretary" color="secondary" icon={<SecretaryIcon />} />
                        ) : (
                          <Button size="small" variant="outlined" startIcon={<SecretaryIcon />} onClick={() => handleSetSecretary(participant.id)} disabled={loading}>
                            Set as Secretary
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(currentStatus, apologyComments[participant.id])}
                    </TableCell>
                    <TableCell>
                      {(currentStatus === 'absent_with_apology') && (
                        <Tooltip title={apologyComments[participant.id] || 'No comment provided'}>
                          <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {apologyComments[participant.id] || 'No comment provided'}
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
                            disabled={currentStatus === 'attended' || loading || !isMeetingStarted}
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Mark Absent">
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => handleAttendanceChange(participant.id, 'absent')} 
                            disabled={currentStatus === 'absent' || loading || !isMeetingStarted}
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Mark Absent with Apology">
                          <IconButton 
                            size="small" 
                            color="warning" 
                            onClick={() => handleOpenApologyDialog(participant)} 
                            disabled={currentStatus === 'absent_with_apology' || loading || !isMeetingStarted}
                          >
                            <MessageIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {!isChairperson && !isSecretary && (
                          <Tooltip title="Remove Participant">
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={() => {
                                setParticipantToRemove(participant);
                                setShowRemoveDialog(true);
                              }} 
                              disabled={loading || !isMeetingStarted}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Dialogs */}
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

        <RemoveParticipantDialog
          open={showRemoveDialog}
          onClose={() => {
            setShowRemoveDialog(false);
            setParticipantToRemove(null);
          }}
          onConfirm={() => handleRemoveParticipant(participantToRemove?.id)}
          participantName={participantToRemove?.name || participantToRemove?.full_name || ''}
          loading={loading}
        />

        {/* Loading Indicator */}
        {loading && (
          <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Snackbar */}
        <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Stack>
    </Fade>
  );
};

// Export components
export { AddParticipantDialog, ApologyDialog, RemoveParticipantDialog, StatCard };
export default ParticipantsTab;