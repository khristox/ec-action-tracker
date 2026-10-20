// src/components/actiontracker/meetings/components/AssignToSelector.jsx
//
// Picks the person an action is assigned to: a system user, a participant of
// the meeting, or a new person typed in by hand.
//
// What changed from the previous version
//  - System users now come from GET /users/available. GET /users/ is ADMIN-ONLY
//    on the API, so every non-admin got a 403 and an empty list. /users/available
//    works for any signed-in user and supports server-side search.
//  - Participants now come from GET /action-tracker/meetings/{id} (its
//    `participants` array), with /members as a fallback. Errors are shown
//    instead of being swallowed.
//  - /users/available masks other people's email/phone as "xxxx". Masked values
//    are treated as "not shown" and are never passed on. System users are
//    identified by `user_id`, and the API reads the real email from the users
//    table.
//  - The selection now carries an explicit `user_id` (system users) or
//    `participant_id` (meeting participants), so a participant's row id is never
//    mistaken for a user id.
//
// onChange receives the same shape as before, plus `user_id` / `participant_id`.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Paper,
  Typography,
  CircularProgress,
  InputAdornment,
  IconButton,
  Avatar,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import api from '../../../../services/api';

// The API replaces other users' contact details with this placeholder.
const MASK = 'xxxx';
const clean = (value) =>
  value && String(value).trim().toLowerCase() !== MASK ? String(value).trim() : '';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0]?.[0]?.toUpperCase() || '?';
};

const scrollableListSx = {
  maxHeight: 400,
  overflowY: 'auto',
  p: 0,
  '&::-webkit-scrollbar': { width: 6 },
  '&::-webkit-scrollbar-track': { bgcolor: 'background.paper' },
  '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.300', borderRadius: 3 },
};

const AssignToSelector = ({
  value,
  onChange,
  disabled,
  label = 'Assign To',
  meetingId,
  placeholder = 'Click to assign to user or participant',
}) => {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [systemUsers, setSystemUsers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loadingSystemUsers, setLoadingSystemUsers] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [activeTab, setActiveTab] = useState('system');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEntry, setManualEntry] = useState({ name: '', email: '', phone: '' });
  const [error, setError] = useState(null);

  const searchInputRef = useRef(null);
  const usersRequestRef = useRef(0); // ignores out-of-date responses while typing

  // ==================== Data loading ====================

  const fetchSystemUsers = useCallback(async (term = '') => {
    const requestId = ++usersRequestRef.current;
    setLoadingSystemUsers(true);
    setError(null);
    try {
      const params = { skip: 0, limit: 100 };
      const trimmed = term.trim();
      if (trimmed.length >= 2) params.search = trimmed; // the API ignores shorter terms

      const response = await api.get('/users/available', { params });
      if (requestId !== usersRequestRef.current) return;

      const rows = Array.isArray(response.data) ? response.data : response.data?.items || [];
      setSystemUsers(
        rows.map((u) => ({
          id: u.id,
          name:
            u.full_name ||
            [u.first_name, u.last_name].filter(Boolean).join(' ') ||
            u.username,
          username: u.username,
          email: clean(u.email),
          phone: clean(u.phone || u.telephone),
          type: 'system',
          is_active: u.is_active,
        }))
      );
    } catch (err) {
      if (requestId !== usersRequestRef.current) return;
      console.error('Failed to fetch system users:', err);
      setError(err.response?.data?.detail || 'Could not load system users. Please try again.');
    } finally {
      if (requestId === usersRequestRef.current) setLoadingSystemUsers(false);
    }
  }, []);

  const fetchParticipants = useCallback(async () => {
    if (!meetingId) {
      setParticipants([]);
      return;
    }
    setLoadingParticipants(true);
    try {
      let rows = [];
      try {
        // The meeting endpoint returns its participants.
        const response = await api.get(`/action-tracker/meetings/${meetingId}`);
        rows = response.data?.participants || [];
      } catch (primaryErr) {
        // Fallback for deployments that expose a dedicated members route.
        const response = await api.get(`/action-tracker/meetings/${meetingId}/members`);
        rows = Array.isArray(response.data) ? response.data : response.data?.items || [];
      }

      setParticipants(
        rows
          .filter((p) => p.is_active !== false)
          .map((p) => ({
            id: p.id, // meeting_participants.id. This is NOT a users.id.
            name: p.name || p.full_name || p.username,
            email: p.email || '',
            phone: p.telephone || p.phone || '',
            title: p.title || p.role || '',
            type: 'participant',
            is_chairperson: Boolean(p.is_chairperson),
            is_secretary: Boolean(p.is_secretary),
          }))
      );
    } catch (err) {
      console.error('Failed to fetch participants:', err);
      setParticipants([]);
      setError(err.response?.data?.detail || 'Could not load the participants of this meeting.');
    } finally {
      setLoadingParticipants(false);
    }
  }, [meetingId]);

  // Dialog opened: reset the search box and focus it.
  useEffect(() => {
    if (searchDialogOpen) {
      setSearchTerm('');
      setError(null);
      const t = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [searchDialogOpen]);

  // System users: load on open and re-query (debounced) as the user types.
  useEffect(() => {
    if (!searchDialogOpen || activeTab !== 'system') return undefined;
    const t = setTimeout(() => fetchSystemUsers(searchTerm), searchTerm.trim() ? 300 : 0);
    return () => clearTimeout(t);
  }, [searchDialogOpen, activeTab, searchTerm, fetchSystemUsers]);

  // Participants: load when the dialog opens (so the tab count is right).
  useEffect(() => {
    if (searchDialogOpen && meetingId) fetchParticipants();
  }, [searchDialogOpen, meetingId, fetchParticipants]);

  // ==================== Filtering ====================

  const filteredSystemUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    // 2+ characters were already searched on the server (that includes email,
    // which the browser cannot see because it is masked).
    if (!term || term.length >= 2) return systemUsers;
    return systemUsers.filter(
      (u) => u.name?.toLowerCase().includes(term) || u.username?.toLowerCase().includes(term)
    );
  }, [systemUsers, searchTerm]);

  const filteredParticipants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return participants;
    return participants.filter(
      (p) => p.name?.toLowerCase().includes(term) || p.email?.toLowerCase().includes(term)
    );
  }, [participants, searchTerm]);

  // ==================== Handlers ====================

  const resetForm = useCallback(() => {
    setSearchTerm('');
    setManualEntry({ name: '', email: '', phone: '' });
    setError(null);
    setShowManualForm(false);
  }, []);

  const handleSelectUser = useCallback(
    (user) => {
      const isSystemUser = user.type === 'system';

      onChange({
        type: isSystemUser ? 'user' : user.type,
        id: user.id,
        // Explicit identity fields. user_id is ONLY set for real system users;
        // participant_id is the meeting_participants row. The API re-checks both.
        user_id: isSystemUser ? user.id : null,
        participant_id: isSystemUser ? null : user.id,
        name: user.name,
        email: user.email || '',
        phone: user.phone || '',
        assigned_to_id: isSystemUser ? user.id : null,
        assigned_to_name: {
          id: user.id,
          name: user.name,
          email: user.email || '',
          phone: user.phone || '',
          title: user.title,
          type: isSystemUser ? 'user' : user.type,
        },
      });
      setSearchDialogOpen(false);
      resetForm();
    },
    [onChange, resetForm]
  );

  const handleAddNewPerson = useCallback(() => {
    if (!manualEntry.name.trim()) {
      setError('Name is required');
      return;
    }

    // Link to a system user only when a REAL email matches. The API also links
    // by email when the action is saved, so this is just a shortcut.
    const typedEmail = manualEntry.email.trim().toLowerCase();
    const existingUser = typedEmail
      ? systemUsers.find((u) => u.email && u.email.toLowerCase() === typedEmail)
      : null;
    if (existingUser) {
      handleSelectUser(existingUser);
      return;
    }

    onChange({
      type: 'manual',
      id: null,
      user_id: null,
      participant_id: null,
      name: manualEntry.name.trim(),
      email: manualEntry.email.trim() || null,
      phone: manualEntry.phone.trim() || null,
      assigned_to_id: null,
      assigned_to_name: {
        name: manualEntry.name.trim(),
        email: manualEntry.email.trim() || null,
        phone: manualEntry.phone.trim() || null,
        type: 'manual',
      },
    });
    setSearchDialogOpen(false);
    resetForm();
  }, [manualEntry, systemUsers, handleSelectUser, onChange, resetForm]);

  // ==================== Rendering ====================

  const renderPersonItem = (person, selected) => (
    <ListItemButton
      key={`${person.type}-${person.id}`}
      onClick={() => handleSelectUser(person)}
      selected={selected}
      sx={{ borderRadius: 1, mb: 0.5 }}
    >
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: selected ? 'primary.main' : 'grey.400' }}>
          {getInitials(person.name)}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primaryTypographyProps={{ component: 'div' }}
        secondaryTypographyProps={{ component: 'div' }}
        primary={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={selected ? 600 : 400}>
              {person.name}
            </Typography>
            {person.type === 'participant' && (
              <Chip
                label="Meeting Participant"
                size="small"
                color="success"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.6rem' }}
              />
            )}
            {person.is_chairperson && (
              <Chip label="Chairperson" size="small" color="primary" sx={{ height: 20, fontSize: '0.6rem' }} />
            )}
            {person.is_secretary && (
              <Chip label="Secretary" size="small" color="secondary" sx={{ height: 20, fontSize: '0.6rem' }} />
            )}
            {person.is_active === false && (
              <Chip label="Inactive" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />
            )}
          </Stack>
        }
        secondary={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {person.email ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" component="span">
                  {person.email}
                </Typography>
              </Box>
            ) : (
              person.type === 'system' && (
                <Chip label="Email private" size="small" color="info" variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />
              )
            )}
            {person.username && (
              <Typography variant="caption" color="text.secondary" component="span">
                @{person.username}
              </Typography>
            )}
            {person.title && (
              <Chip label={person.title} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
            )}
          </Box>
        }
      />
      {selected && <CheckCircleIcon color="primary" sx={{ ml: 1 }} />}
    </ListItemButton>
  );

  const renderLoading = (text) => (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <CircularProgress size={32} />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {text}
      </Typography>
    </Box>
  );

  return (
    <>
      <TextField
        fullWidth
        label={label}
        value={value?.name || ''}
        onClick={() => !disabled && setSearchDialogOpen(true)}
        disabled={disabled}
        placeholder={placeholder}
        slotProps={{
          input: {
            readOnly: true,
            endAdornment: value && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                  }}
                  edge="end"
                  aria-label="clear assignment"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
            startAdornment: value && (
              <InputAdornment position="start">
                <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                  {getInitials(value.name)}
                </Avatar>
              </InputAdornment>
            ),
          },
        }}
      />

      <Dialog
        open={searchDialogOpen}
        onClose={() => setSearchDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionProps={{ onEntered: () => searchInputRef.current?.focus() }}
      >
        <DialogTitle>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={600}>
              Assign To
            </Typography>
            <IconButton onClick={() => setSearchDialogOpen(false)} size="small" aria-label="close dialog">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="caption">
              <strong>Privacy:</strong> other users' email addresses are hidden. You don't need
              them: a system user is linked through their account.
            </Typography>
          </Alert>

          <Stack spacing={2.5}>
            <TextField
              inputRef={searchInputRef}
              fullWidth
              placeholder="Search by name, email, or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')} edge="end">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <ToggleButtonGroup
              value={activeTab}
              exclusive
              onChange={(e, val) => val && setActiveTab(val)}
              fullWidth
              size="small"
              aria-label="user selection mode"
            >
              <ToggleButton value="system" aria-label="system users">
                <PersonIcon fontSize="small" sx={{ mr: 1 }} />
                System Users
                {systemUsers.length > 0 && (
                  <Chip label={systemUsers.length} size="small" sx={{ ml: 1, height: 18, fontSize: '0.6rem' }} />
                )}
              </ToggleButton>
              <ToggleButton value="participants" aria-label="meeting participants">
                <GroupIcon fontSize="small" sx={{ mr: 1 }} />
                Participants
                {participants.length > 0 && (
                  <Chip label={participants.length} size="small" sx={{ ml: 1, height: 18, fontSize: '0.6rem' }} />
                )}
              </ToggleButton>
            </ToggleButtonGroup>

            {activeTab === 'system' && (
              <>
                {loadingSystemUsers && filteredSystemUsers.length === 0 ? (
                  renderLoading('Loading users...')
                ) : filteredSystemUsers.length > 0 ? (
                  <List sx={scrollableListSx}>
                    {filteredSystemUsers.map((user) =>
                      renderPersonItem(user, value?.user_id === user.id || (value?.id === user.id && value?.type === 'user'))
                    )}
                  </List>
                ) : searchTerm ? (
                  <Alert severity="info" icon={<SearchIcon />}>
                    No users found matching "{searchTerm}"
                  </Alert>
                ) : (
                  <Alert severity="info">No system users available</Alert>
                )}
              </>
            )}

            {activeTab === 'participants' && (
              <>
                {loadingParticipants ? (
                  renderLoading('Loading participants...')
                ) : filteredParticipants.length > 0 ? (
                  <List sx={scrollableListSx}>
                    {filteredParticipants.map((p) =>
                      renderPersonItem(p, value?.id === p.id && value?.type === 'participant')
                    )}
                  </List>
                ) : searchTerm ? (
                  <Alert severity="info" icon={<SearchIcon />}>
                    No participants found matching "{searchTerm}"
                  </Alert>
                ) : (
                  <Alert severity="info">
                    {meetingId
                      ? 'This meeting has no participants yet'
                      : 'No meeting is linked to this action, so there are no participants to pick from'}
                  </Alert>
                )}
              </>
            )}

            <Divider />

            {!showManualForm ? (
              <Button
                startIcon={<PersonAddIcon />}
                onClick={() => setShowManualForm(true)}
                fullWidth
                variant="outlined"
                sx={{ borderStyle: 'dashed' }}
              >
                Add New Person
              </Button>
            ) : (
              <Paper variant="outlined" sx={{ p: 2, borderStyle: 'dashed' }}>
                <Stack spacing={2}>
                  <Alert severity="info">
                    If the email matches an existing user, they will be linked automatically.
                  </Alert>

                  <TextField
                    size="small"
                    label="Full Name"
                    value={manualEntry.name}
                    onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                    fullWidth
                    required
                    error={!manualEntry.name.trim() && !!error}
                    helperText={!manualEntry.name.trim() && error ? 'Name is required' : ''}
                  />

                  <TextField
                    size="small"
                    label="Email Address"
                    value={manualEntry.email}
                    onChange={(e) => setManualEntry({ ...manualEntry, email: e.target.value })}
                    fullWidth
                    type="email"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon fontSize="small" color="action" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  <TextField
                    size="small"
                    label="Phone Number"
                    value={manualEntry.phone}
                    onChange={(e) => setManualEntry({ ...manualEntry, phone: e.target.value })}
                    fullWidth
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneIcon fontSize="small" color="action" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      onClick={() => {
                        setShowManualForm(false);
                        setError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleAddNewPerson}
                      disabled={!manualEntry.name.trim()}
                      startIcon={<PersonAddIcon />}
                    >
                      Add Person
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSearchDialogOpen(false)} variant="text">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AssignToSelector;
