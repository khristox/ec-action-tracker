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
  debounce,
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
  ContentCopy as ContentCopyIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import api from '../../../../services/api';

// ==================== Helper Functions ====================
const maskEmail = (email) => {
  if (!email) return '';
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 3) return `${localPart[0]}***@${domain}`;
  return `${localPart.substring(0, 3)}***${localPart.substring(localPart.length - 2)}@${domain}`;
};

const maskPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 4) return '****';
  const last4 = cleaned.slice(-4);
  return `${'*'.repeat(cleaned.length - 4)}${last4}`;
};

// ==================== Compact Stat Strip ====================
// Single horizontal row: Total · Attended · Apology · Absent + progress bar
const StatStrip = memo(({ stats }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const items = [
    { label: 'Total',    value: stats.total,            color: theme.palette.primary.main },
    { label: 'Attended', value: stats.attended,         color: theme.palette.success.main },
    { label: 'Apology',  value: stats.absentWithApology, color: theme.palette.warning.main },
    { label: 'Absent',   value: stats.absent,           color: theme.palette.error.main },
    { label: 'Pending',  value: stats.pending,          color: theme.palette.text.secondary },
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        px: 2,
        py: 1,
        borderRadius: 2,
        bgcolor: isDarkMode ? alpha('#fff', 0.03) : '#fafafa',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={0}
        divider={
          <Box sx={{ width: '1px', height: 20, bgcolor: 'divider', mx: 1.5 }} />
        }
        flexWrap="wrap"
        gap={1}
      >
        {items.map((item) => (
          <Stack key={item.label} direction="row" alignItems="baseline" spacing={0.5}>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{ color: item.color, lineHeight: 1, fontSize: '1.1rem' }}
            >
              {item.value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
              {item.label}
            </Typography>
          </Stack>
        ))}

        {/* Attendance rate + mini bar pushed to the right */}
        <Box sx={{ flex: 1, minWidth: 100 }}>
          <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1}>
            <LinearProgress
              variant="determinate"
              value={parseFloat(stats.attendanceRate)}
              sx={{
                width: 80,
                height: 5,
                borderRadius: 3,
                bgcolor: isDarkMode ? alpha('#fff', 0.08) : '#e5e7eb',
                '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: theme.palette.success.main },
              }}
            />
            <Typography variant="caption" fontWeight={700} color="success.main" sx={{ minWidth: 36 }}>
              {stats.attendanceRate}%
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
});
StatStrip.displayName = 'StatStrip';

// ==================== Remove Participant Dialog ====================
const RemoveParticipantDialog = memo(({ open, onClose, onConfirm, participantName }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const handleConfirm = async () => {
    setIsDeleting(true);
    try { await onConfirm(); onClose(); }
    catch (e) { console.error(e); }
    finally { setIsDeleting(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <DeleteIcon color="error" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700}>Remove Participant</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Remove <strong>{participantName}</strong>? This cannot be undone.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button size="small" onClick={onClose} disabled={isDeleting}>Cancel</Button>
        <Button
          size="small"
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={isDeleting}
          startIcon={isDeleting ? <CircularProgress size={14} /> : <DeleteIcon />}
        >
          {isDeleting ? 'Removing…' : 'Remove'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});
RemoveParticipantDialog.displayName = 'RemoveParticipantDialog';

// ==================== Apology Dialog ====================
const ApologyDialog = memo(({ open, onClose, onSubmit, participantName, initialMessage = '' }) => {
  const [message, setMessage] = useState(initialMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) { setMessage(initialMessage); setSubmitted(false); setIsSubmitting(false); }
  }, [open, initialMessage]);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(message);
      setSubmitted(true);
      setTimeout(() => { onClose(); setSubmitted(false); setMessage(''); }, 1500);
    } catch (e) { console.error(e); }
    finally { setIsSubmitting(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <MessageIcon color="warning" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Absent with Apology</Typography>
          </Stack>
          {!isSubmitting && !submitted && <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>}
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {submitted ? (
          <Alert severity="success">✅ Apology recorded for {participantName}!</Alert>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              Marking <strong>{participantName}</strong> as absent with apology.
            </Alert>
            <TextField
              fullWidth
              label="Apology Reason"
              multiline
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., Family emergency, travel issues, illness…"
              helperText={`${message.length}/500`}
              required
              autoFocus
              inputProps={{ maxLength: 500 }}
              disabled={isSubmitting}
              size="small"
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        {!submitted && (
          <>
            <Button size="small" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button
              size="small"
              variant="contained"
              color="warning"
              onClick={handleSubmit}
              disabled={isSubmitting || !message.trim()}
              startIcon={isSubmitting ? <CircularProgress size={14} /> : <SendIcon />}
            >
              {isSubmitting ? 'Saving…' : 'Save & Send'}
            </Button>
          </>
        )}
        {submitted && <Button size="small" variant="contained" onClick={onClose}>Close</Button>}
      </DialogActions>
    </Dialog>
  );
});
ApologyDialog.displayName = 'ApologyDialog';

// ==================== Add Participant Dialog ====================
const AddParticipantDialog = memo(({ open, onClose, onAdd, existingParticipants = [] }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [participantType, setParticipantType] = useState('existing');
  const [formData, setFormData] = useState({ name: '', email: '', telephone: '', title: '', organization: '' });
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [participantLists, setParticipantLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [listParticipants, setListParticipants] = useState([]);
  const [existingUsers, setExistingUsers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userLoading, setUserLoading] = useState(false);
  const [showMaskedInfo, setShowMaskedInfo] = useState(false);
  const usersPerPage = 10;

  const debouncedSearch = useMemo(() => debounce((v) => { setUserSearchTerm(v); setUserPage(1); }, 500), []);

  useEffect(() => {
    if (open && participantType === 'from_list') fetchParticipantLists();
    if (open && participantType === 'existing') fetchAvailableUsers();
  }, [open, participantType, userPage, userSearchTerm]);

  const fetchParticipantLists = async () => {
    try { const r = await api.get('/action-tracker/participant-lists/'); setParticipantLists(r.data.items || []); }
    catch (e) { console.error(e); }
  };

  const fetchAvailableUsers = async () => {
    setUserLoading(true);
    try {
      const existingEmails = new Set((existingParticipants || []).map(p => p.email?.toLowerCase()));
      const params = { skip: (userPage - 1) * usersPerPage, limit: usersPerPage, is_active: true };
      if (userSearchTerm) params.search = userSearchTerm;
      const r = await api.get('/users/available', { params });
      const users = r.data.items || r.data || [];
      setExistingUsers(users.filter(u => !existingEmails.has(u.email?.toLowerCase())));
      setUserTotal(r.data.total || users.length);
    } catch (e) { console.error(e); }
    finally { setUserLoading(false); }
  };

  const fetchListParticipants = async (listId) => {
    try { const r = await api.get(`/action-tracker/participant-lists/${listId}/members`); setListParticipants(r.data.items || []); }
    catch (e) { console.error(e); }
  };

  const handleListChange = async (listId) => {
    setSelectedList(listId);
    if (listId) await fetchListParticipants(listId);
    else setListParticipants([]);
  };

  const validateForm = () => {
    const e = {};
    if (participantType === 'new') {
      if (!formData.name.trim()) e.name = 'Name is required';
      if (!formData.email.trim() && !formData.telephone.trim()) e.contact = 'Email or telephone required';
      if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Invalid email';
    } else if (participantType === 'existing' && !selectedParticipant) {
      e.participant = 'Please select a participant';
    } else if (participantType === 'from_list' && !selectedList) {
      e.list = 'Please select a list';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      let toAdd = [];
      if (participantType === 'new') toAdd = [formData];
      else if (participantType === 'existing' && selectedParticipant) {
        toAdd = [{
          name: selectedParticipant.full_name || `${selectedParticipant.first_name || ''} ${selectedParticipant.last_name || ''}`.trim() || selectedParticipant.username,
          email: selectedParticipant.email,
          telephone: selectedParticipant.phone || selectedParticipant.telephone,
          title: selectedParticipant.title,
          organization: selectedParticipant.organization,
          user_id: selectedParticipant.id,
        }];
      } else if (participantType === 'from_list') {
        toAdd = listParticipants.map(p => ({ name: p.name, email: p.email, telephone: p.telephone, title: p.title, organization: p.organization }));
      }
      await onAdd(toAdd);
      onClose();
      resetForm();
    } catch (e) { console.error(e); }
    finally { setIsSubmitting(false); }
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', telephone: '', title: '', organization: '' });
    setSelectedParticipant(null); setSelectedList(null); setListParticipants([]);
    setExistingUsers([]); setErrors({}); setParticipantType('existing');
    setUserSearchTerm(''); setUserPage(1); setShowMaskedInfo(false);
  };

  const handleClose = () => { resetForm(); onClose(); };
  const getFullName = (u) => u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || u.email;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <PersonAddIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Add Participants</Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose} disabled={isSubmitting}><CloseIcon fontSize="small" /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Add Method</InputLabel>
            <Select value={participantType} onChange={(e) => setParticipantType(e.target.value)} label="Add Method">
              <MenuItem value="existing"><ListItemText primary="Select Existing User" /></MenuItem>
              <MenuItem value="new"><ListItemText primary="Create New Participant" /></MenuItem>
              <MenuItem value="from_list"><ListItemText primary="From Participant List" /></MenuItem>
            </Select>
          </FormControl>

          {participantType === 'new' && (
            <Stack spacing={1.5}>
              {[
                { label: 'Full Name *', key: 'name', error: errors.name },
                { label: 'Email', key: 'email', type: 'email', error: errors.email },
                { label: 'Telephone', key: 'telephone' },
                { label: 'Title / Position', key: 'title' },
                { label: 'Organization', key: 'organization' },
              ].map(({ label, key, type, error }) => (
                <TextField
                  key={key}
                  size="small"
                  fullWidth
                  label={label}
                  type={type || 'text'}
                  value={formData[key]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  error={!!error}
                  helperText={error}
                />
              ))}
            </Stack>
          )}

          {participantType === 'existing' && (
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <TextField
                  size="small"
                  placeholder="Search users…"
                  onChange={(e) => debouncedSearch(e.target.value)}
                  sx={{ flex: 1 }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                  }}
                />
                <Tooltip title={showMaskedInfo ? 'Hide contact info' : 'Show contact info'}>
                  <IconButton size="small" onClick={() => setShowMaskedInfo(!showMaskedInfo)} sx={{ ml: 1 }}>
                    {showMaskedInfo ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Stack>

              <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
                {userLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={24} /></Box>
                ) : existingUsers.length === 0 ? (
                  <Alert severity="info" sx={{ py: 0.5 }}>No users available</Alert>
                ) : (
                  <Stack spacing={0.5}>
                    {existingUsers.map((user) => {
                      const fullName = getFullName(user);
                      const isSelected = selectedParticipant?.id === user.id;
                      return (
                        <Paper
                          key={user.id}
                          variant="outlined"
                          sx={{
                            px: 1.5, py: 1,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                            borderColor: isSelected ? theme.palette.primary.main : 'divider',
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                          }}
                          onClick={() => setSelectedParticipant(user)}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ width: 30, height: 30, fontSize: '0.8rem', bgcolor: theme.palette.primary.main }}>
                              {fullName[0]?.toUpperCase() || 'U'}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600} noWrap>{fullName}</Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {showMaskedInfo ? user.email : maskEmail(user.email)}
                                {user.phone && ` · ${showMaskedInfo ? user.phone : maskPhone(user.phone)}`}
                              </Typography>
                            </Box>
                            {isSelected && <CheckIcon color="primary" sx={{ fontSize: 16 }} />}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              {userTotal > usersPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Pagination count={Math.ceil(userTotal / usersPerPage)} page={userPage} onChange={(_, v) => setUserPage(v)} color="primary" size="small" />
                </Box>
              )}
            </Stack>
          )}

          {participantType === 'from_list' && (
            <Stack spacing={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Participant List</InputLabel>
                <Select value={selectedList || ''} onChange={(e) => handleListChange(e.target.value)} label="Select Participant List" error={!!errors.list}>
                  <MenuItem value="">None</MenuItem>
                  {participantLists.map(l => (
                    <MenuItem key={l.id} value={l.id}>{l.name} ({l.participant_count || 0})</MenuItem>
                  ))}
                </Select>
                {errors.list && <FormHelperText error>{errors.list}</FormHelperText>}
              </FormControl>
              {selectedList && listParticipants.length > 0 && (
                <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 200, overflow: 'auto' }}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                    {listParticipants.length} participants will be added
                  </Typography>
                  <Stack spacing={0.5}>
                    {listParticipants.map(p => (
                      <Stack key={p.id} direction="row" spacing={1} alignItems="center">
                        <PersonIcon sx={{ fontSize: 14 }} color="action" />
                        <Typography variant="caption">{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.email || p.telephone}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button size="small" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
        <Button
          size="small"
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={14} /> : <SaveIcon />}
        >
          {isSubmitting ? 'Adding…' : 'Add Participants'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});
AddParticipantDialog.displayName = 'AddParticipantDialog';

// ==================== Role Chip / Button ====================
const RoleCell = memo(({ isChairperson, isSecretary, participantId, loading, canEdit, onSetChairperson, onSetSecretary }) => {
  if (!canEdit) {
    if (isChairperson) return <Chip size="small" label="Chair" color="primary" variant="outlined" icon={<StarIcon sx={{ fontSize: '14px !important' }} />} sx={{ height: 20, fontSize: '0.68rem' }} />;
    if (isSecretary) return <Chip size="small" label="Secretary" color="secondary" variant="outlined" icon={<SecretaryIcon sx={{ fontSize: '14px !important' }} />} sx={{ height: 20, fontSize: '0.68rem' }} />;
    return <Typography variant="caption" color="text.secondary">Member</Typography>;
  }
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap">
      {isChairperson ? (
        <Chip size="small" label="Chair" color="primary" icon={<StarIcon sx={{ fontSize: '14px !important' }} />} sx={{ height: 20, fontSize: '0.68rem' }} />
      ) : (
        <Tooltip title="Set as Chairperson">
          <IconButton size="small" onClick={() => onSetChairperson(participantId)} disabled={loading} sx={{ p: 0.4 }}>
            <StarIcon sx={{ fontSize: 15, color: 'action.disabled' }} />
          </IconButton>
        </Tooltip>
      )}
      {isSecretary ? (
        <Chip size="small" label="Sec" color="secondary" icon={<SecretaryIcon sx={{ fontSize: '14px !important' }} />} sx={{ height: 20, fontSize: '0.68rem' }} />
      ) : (
        <Tooltip title="Set as Secretary">
          <IconButton size="small" onClick={() => onSetSecretary(participantId)} disabled={loading} sx={{ p: 0.4 }}>
            <SecretaryIcon sx={{ fontSize: 15, color: 'action.disabled' }} />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
});
RoleCell.displayName = 'RoleCell';

// ==================== Status Chip ====================
const StatusChip = memo(({ status, apologyComment }) => {
  const map = {
    attended:             { label: 'Attended',  color: 'success', icon: <CheckIcon sx={{ fontSize: '13px !important' }} /> },
    absent_with_apology:  { label: 'Apology',   color: 'warning', icon: <MessageIcon sx={{ fontSize: '13px !important' }} /> },
    absent:               { label: 'Absent',    color: 'error',   icon: <CancelIcon sx={{ fontSize: '13px !important' }} /> },
  };
  const cfg = map[status] || { label: 'Pending', color: 'default', icon: <HourglassEmptyIcon sx={{ fontSize: '13px !important' }} /> };
  const chip = <Chip size="small" label={cfg.label} color={cfg.color} icon={cfg.icon} sx={{ height: 20, fontSize: '0.68rem', '& .MuiChip-icon': { fontSize: 13 } }} />;
  if (status === 'absent_with_apology' && apologyComment) {
    return <Tooltip title={apologyComment} arrow>{chip}</Tooltip>;
  }
  return chip;
});
StatusChip.displayName = 'StatusChip';

// ==================== Main ParticipantsTab Component ====================
const ParticipantsTab = ({
  meetingId,
  participants: initialParticipants,
  onRefresh,
  meetingStatus,
  meetingStartTime,
  currentChairpersonId,
  currentSecretaryId,
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState(initialParticipants || []);
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [apologyComments, setApologyComments] = useState({});
  const [chairpersonId, setChairpersonId] = useState(currentChairpersonId || null);
  const [secretaryId, setSecretaryId] = useState(currentSecretaryId || null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showApologyDialog, setShowApologyDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [participantToRemove, setParticipantToRemove] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isMeetingStarted, setIsMeetingStarted] = useState(false);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showContactInfo, setShowContactInfo] = useState(false);

  const canEdit = useMemo(
    () => !isMeetingEnded && meetingStatus?.toLowerCase() !== 'ended' && meetingStatus?.toLowerCase() !== 'cancelled',
    [isMeetingEnded, meetingStatus]
  );

  const getDisplayEmail = (email) => (!email ? '' : showContactInfo ? email : maskEmail(email));
  const getDisplayPhone = (phone) => (!phone ? '' : showContactInfo ? phone : maskPhone(phone));

  const checkMeetingStatus = useCallback(() => {
    const s = meetingStatus?.toLowerCase();
    if (s === 'ended' || s === 'cancelled' || s === 'completed') {
      setIsMeetingEnded(true); setIsMeetingStarted(false); setTimeRemaining(null); return false;
    }
    if (s === 'in_progress' || s === 'started' || s === 'ongoing') {
      setIsMeetingStarted(true); setIsMeetingEnded(false); setTimeRemaining(null); return true;
    }
    if (meetingStartTime) {
      const now = new Date(), start = new Date(meetingStartTime);
      const started = now >= start;
      setIsMeetingStarted(started); setIsMeetingEnded(false);
      if (!started) {
        const diffMins = Math.floor((start - now) / 60000);
        const h = Math.floor(diffMins / 60), m = diffMins % 60;
        setTimeRemaining(h > 0 ? `${h}h ${m}m` : `${diffMins}m`);
      } else { setTimeRemaining(null); }
      return started;
    }
    setIsMeetingStarted(false); setIsMeetingEnded(false); return false;
  }, [meetingStatus, meetingStartTime]);

  useEffect(() => {
    checkMeetingStatus();
    const interval = setInterval(checkMeetingStatus, 60000);
    return () => clearInterval(interval);
  }, [checkMeetingStatus]);

  useEffect(() => {
    if (initialParticipants) {
      setParticipants(initialParticipants);
      const s = {}, c = {};
      initialParticipants.forEach(p => { s[p.id] = p.attendance_status || 'pending'; c[p.id] = p.apology_comment || ''; });
      setAttendanceStatus(s); setApologyComments(c);
    }
  }, [initialParticipants]);

  const showSnack = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const handleAddParticipants = async (newParticipants) => {
    setLoading(true);
    try {
      for (const p of newParticipants) await api.post(`/action-tracker/meetings/${meetingId}/members`, p);
      showSnack(`Added ${newParticipants.length} participant(s)`);
      onRefresh?.();
    } catch (e) { showSnack(e.response?.data?.detail || 'Failed to add participants', 'error'); }
    finally { setLoading(false); }
  };

  const handleSetChairperson = useCallback(async (participantId) => {
    if (!canEdit) { showSnack('Meeting has ended', 'warning'); return; }
    setLoading(true);
    try {
      await api.patch(`/action-tracker/meetings/${meetingId}`, { chairperson_id: participantId });
      setChairpersonId(participantId);
      setParticipants(prev => prev.map(p => ({ ...p, is_chairperson: p.id === participantId })));
      showSnack('Chairperson updated'); onRefresh?.();
    } catch (e) { showSnack(e.response?.data?.detail || 'Failed', 'error'); }
    finally { setLoading(false); }
  }, [meetingId, onRefresh, canEdit]);

  const handleSetSecretary = useCallback(async (participantId) => {
    if (!canEdit) { showSnack('Meeting has ended', 'warning'); return; }
    setLoading(true);
    try {
      await api.patch(`/action-tracker/meetings/${meetingId}`, { secretary_id: participantId });
      setSecretaryId(participantId);
      setParticipants(prev => prev.map(p => ({ ...p, is_secretary: p.id === participantId })));
      showSnack('Secretary updated'); onRefresh?.();
    } catch (e) { showSnack(e.response?.data?.detail || 'Failed', 'error'); }
    finally { setLoading(false); }
  }, [meetingId, onRefresh, canEdit]);

  const handleAttendanceChange = useCallback(async (participantId, status, comment = '') => {
    if (!isMeetingStarted) { showSnack('Meeting has not started yet', 'warning'); return; }
    if (!canEdit) { showSnack('Meeting has ended', 'warning'); return; }
    setLoading(true);
    try {
      await api.patch(`/action-tracker/meetings/${meetingId}/participants/${participantId}`, {
        attendance_status: status, apology_comment: comment,
      });
      setAttendanceStatus(prev => ({ ...prev, [participantId]: status }));
      if (comment) setApologyComments(prev => ({ ...prev, [participantId]: comment }));
      showSnack(status === 'absent_with_apology' ? 'Marked absent with apology' : `Marked as ${status.replace('_', ' ')}`,
        status === 'absent' || status === 'absent_with_apology' ? 'warning' : 'success');
      onRefresh?.();
    } catch (e) { showSnack(e.response?.data?.detail || 'Failed to update attendance', 'error'); }
    finally { setLoading(false); }
  }, [meetingId, isMeetingStarted, canEdit, onRefresh]);

  const handleOpenApologyDialog = useCallback((participant) => {
    if (!isMeetingStarted) { showSnack('Meeting has not started yet', 'warning'); return; }
    if (!canEdit) { showSnack('Meeting has ended', 'warning'); return; }
    setSelectedParticipant(participant); setShowApologyDialog(true);
  }, [isMeetingStarted, canEdit]);

  const handleSubmitApology = useCallback(async (message) => {
    if (!selectedParticipant) return;
    await handleAttendanceChange(selectedParticipant.id, 'absent_with_apology', message);
    try {
      await api.post(`/action-tracker/meetings/${meetingId}/notify-participants`, {
        participant_ids: [selectedParticipant.id],
        notification_type: ['email'],
        custom_message: `Apology Reason: ${message}`,
      });
    } catch (e) { console.error(e); }
  }, [selectedParticipant, handleAttendanceChange, meetingId]);

  const handleRemoveParticipant = useCallback(async (participantId) => {
    setLoading(true);
    try {
      await api.delete(`/action-tracker/meetings/${meetingId}/participants/${participantId}`);
      showSnack('Participant removed'); onRefresh?.();
    } catch (e) { showSnack(e.response?.data?.detail || 'Failed to remove participant', 'error'); }
    finally { setLoading(false); setShowRemoveDialog(false); setParticipantToRemove(null); }
  }, [meetingId, onRefresh]);

  const stats = useMemo(() => {
    const vals = Object.values(attendanceStatus);
    const attended = vals.filter(s => s === 'attended').length;
    const total = participants.length;
    return {
      attended,
      absent: vals.filter(s => s === 'absent').length,
      absentWithApology: vals.filter(s => s === 'absent_with_apology').length,
      pending: vals.filter(s => s === 'pending').length,
      total,
      attendanceRate: total > 0 ? ((attended / total) * 100).toFixed(1) : '0.0',
    };
  }, [attendanceStatus, participants.length]);

  // ---- Shared table ----
  const renderTable = (readOnly = false) => (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow sx={{ bgcolor: isDarkMode ? alpha('#fff', 0.04) : '#f8fafc' }}>
            {[
              { label: 'Participant', width: '28%' },
              { label: 'Contact',     width: '22%' },
              { label: 'Role',        width: '18%' },
              { label: 'Status',      width: '14%' },
              ...(!readOnly ? [{ label: 'Actions', width: '18%', align: 'center' }] : []),
            ].map(({ label, width, align }) => (
              <TableCell
                key={label}
                align={align || 'left'}
                sx={{ fontWeight: 700, fontSize: '0.72rem', py: 0.75, px: 1.5, width, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                {label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {participants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={readOnly ? 4 : 5} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: '0.8rem' }}>
                No participants yet
              </TableCell>
            </TableRow>
          ) : (
            participants.map((participant) => {
              const fullName = participant.name || participant.full_name || `${participant.first_name || ''} ${participant.last_name || ''}`.trim() || participant.email;
              const isChairperson = chairpersonId === participant.id;
              const isSecretary = secretaryId === participant.id;
              const currentStatus = attendanceStatus[participant.id] || participant.attendance_status || 'pending';

              return (
                <TableRow
                  key={participant.id}
                  hover
                  sx={{
                    opacity: readOnly ? 0.85 : 1,
                    '& .MuiTableCell-root': { py: 0.75, px: 1.5, fontSize: '0.8rem' },
                  }}
                >
                  {/* Participant */}
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar
                        sx={{
                          width: 28, height: 28, fontSize: '0.75rem',
                          bgcolor: isChairperson ? theme.palette.primary.main
                                 : isSecretary   ? theme.palette.secondary.main
                                 : '#6366f1',
                          flexShrink: 0,
                        }}
                      >
                        {fullName?.[0]?.toUpperCase() || '?'}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.8rem' }}>
                          {fullName}
                        </Typography>
                        {participant.title && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.68rem' }}>
                            {participant.title}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </TableCell>

                  {/* Contact */}
                  <TableCell>
                    <Stack spacing={0.25}>
                      {participant.email && (
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.4, fontSize: '0.68rem', color: 'text.secondary' }} noWrap>
                          <EmailIcon sx={{ fontSize: 11 }} />
                          {getDisplayEmail(participant.email)}
                        </Typography>
                      )}
                      {participant.telephone && (
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.4, fontSize: '0.68rem', color: 'text.secondary' }} noWrap>
                          <PhoneIcon sx={{ fontSize: 11 }} />
                          {getDisplayPhone(participant.telephone)}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>

                  {/* Role */}
                  <TableCell>
                    <RoleCell
                      isChairperson={isChairperson}
                      isSecretary={isSecretary}
                      participantId={participant.id}
                      loading={loading}
                      canEdit={!readOnly && canEdit}
                      onSetChairperson={handleSetChairperson}
                      onSetSecretary={handleSetSecretary}
                    />
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <StatusChip status={currentStatus} apologyComment={apologyComments[participant.id]} />
                  </TableCell>

                  {/* Actions (active mode only) */}
                  {!readOnly && (
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.25} justifyContent="center">
                        <Tooltip title="Mark Attended">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleAttendanceChange(participant.id, 'attended')}
                              disabled={currentStatus === 'attended' || loading || !isMeetingStarted}
                              sx={{ p: 0.5, color: currentStatus === 'attended' ? 'success.main' : 'action.disabled' }}
                            >
                              <CheckIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Mark Absent">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleAttendanceChange(participant.id, 'absent')}
                              disabled={currentStatus === 'absent' || loading || !isMeetingStarted}
                              sx={{ p: 0.5, color: currentStatus === 'absent' ? 'error.main' : 'action.disabled' }}
                            >
                              <CancelIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Absent with Apology">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenApologyDialog(participant)}
                              disabled={currentStatus === 'absent_with_apology' || loading || !isMeetingStarted}
                              sx={{ p: 0.5, color: currentStatus === 'absent_with_apology' ? 'warning.main' : 'action.disabled' }}
                            >
                              <MessageIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        {!isChairperson && !isSecretary && (
                          <Tooltip title="Remove">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => { setParticipantToRemove(participant); setShowRemoveDialog(true); }}
                                disabled={loading}
                                sx={{ p: 0.5, color: 'action.disabled', '&:hover': { color: 'error.main' } }}
                              >
                                <DeleteIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ---- Shared dialogs ----
  const renderDialogs = () => (
    <>
      <AddParticipantDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddParticipants}
        existingParticipants={participants}
      />
      <ApologyDialog
        open={showApologyDialog}
        onClose={() => setShowApologyDialog(false)}
        onSubmit={handleSubmitApology}
        participantName={selectedParticipant?.name || selectedParticipant?.full_name || ''}
        initialMessage={selectedParticipant ? apologyComments[selectedParticipant.id] || '' : ''}
      />
      <RemoveParticipantDialog
        open={showRemoveDialog}
        onClose={() => { setShowRemoveDialog(false); setParticipantToRemove(null); }}
        onConfirm={() => handleRemoveParticipant(participantToRemove?.id)}
        participantName={participantToRemove?.name || participantToRemove?.full_name || ''}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ fontSize: '0.8rem' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );

  // ---- Read-only mode (meeting ended) ----
  if (!canEdit) {
    return (
      <Fade in>
        <Stack spacing={1.5}>
          {/* Status banner — compact */}
          <Alert
            severity="info"
            icon={<LockIcon sx={{ fontSize: 16 }} />}
            sx={{ py: 0.5, '& .MuiAlert-message': { py: 0.25 } }}
          >
            <Typography variant="caption" fontWeight={600}>View Only — Meeting Ended</Typography>
          </Alert>

          {/* Toolbar */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              {stats.total} participant{stats.total !== 1 ? 's' : ''}
            </Typography>
            <Tooltip title={showContactInfo ? 'Hide contact info' : 'Show contact info'}>
              <IconButton size="small" onClick={() => setShowContactInfo(!showContactInfo)}>
                {showContactInfo ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>

          <StatStrip stats={stats} />
          {renderTable(true)}
          {renderDialogs()}
        </Stack>
      </Fade>
    );
  }

  // ---- Active meeting UI ----
  return (
    <Fade in>
      <Stack spacing={1.5}>
        {/* Compact status banner */}
        <Alert
          severity={isMeetingStarted ? 'success' : 'info'}
          icon={isMeetingStarted ? <PlayCircleIcon sx={{ fontSize: 16 }} /> : <ScheduleIcon sx={{ fontSize: 16 }} />}
          sx={{ py: 0.5, '& .MuiAlert-message': { py: 0.25 } }}
        >
          <Typography variant="caption" fontWeight={600}>
            {isMeetingStarted
              ? 'Meeting in progress — attendance tracking enabled'
              : timeRemaining
                ? `Attendance available in ~${timeRemaining}`
                : 'Attendance tracking will enable when meeting starts'}
          </Typography>
        </Alert>

        {/* Compact toolbar */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Typography variant="body2" fontWeight={600} color="text.secondary">
            <PeopleIcon sx={{ fontSize: 15, mr: 0.5, verticalAlign: 'middle' }} />
            {stats.total} participant{stats.total !== 1 ? 's' : ''}
          </Typography>

          <Stack direction="row" spacing={0.75} alignItems="center">
            {/* Contact info toggle */}
            <Tooltip title={showContactInfo ? 'Hide contact info' : 'Show contact info'}>
              <IconButton size="small" onClick={() => setShowContactInfo(!showContactInfo)}>
                {showContactInfo ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* Refresh */}
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => onRefresh?.()} disabled={loading}>
                {loading ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* Add participants */}
            <Button
              size="small"
              variant="contained"
              startIcon={<PersonAddIcon sx={{ fontSize: 15 }} />}
              onClick={() => setShowAddDialog(true)}
              sx={{ height: 30, fontSize: '0.75rem', px: 1.5, borderRadius: 1.5 }}
            >
              Add
            </Button>
          </Stack>
        </Stack>

        {/* Inline stats strip */}
        <StatStrip stats={stats} />

        {/* Table */}
        {renderTable(false)}

        {/* Dialogs + Snackbar */}
        {renderDialogs()}

        {/* Global loading indicator */}
        {loading && (
          <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
            <CircularProgress size={20} />
          </Box>
        )}
      </Stack>
    </Fade>
  );
};

export { AddParticipantDialog, ApologyDialog, RemoveParticipantDialog };
export default ParticipantsTab;