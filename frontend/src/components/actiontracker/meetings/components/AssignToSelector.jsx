// src/components/actiontracker/meetings/components/AssignToSelector.jsx

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
  ListItem,
  ListItemAvatar,
  ListItemText,
  Tooltip
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
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const obfuscateEmail = (email) => {
  if (!email) return null;
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  if (localPart.length <= 2) return email;
  const firstTwo = localPart.slice(0, 2);
  const lastOne = localPart.slice(-1);
  return `${firstTwo}***${lastOne}@${domain}`;
};

const AssignToSelector = ({ 
  value, 
  onChange, 
  disabled, 
  label = "Assign To", 
  meetingId,
  placeholder = "Click to assign to user or participant"
}) => {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [systemUsers, setSystemUsers] = useState([]);
  const [filteredSystemUsers, setFilteredSystemUsers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [filteredParticipants, setFilteredParticipants] = useState([]);
  const [loadingSystemUsers, setLoadingSystemUsers] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [activeTab, setActiveTab] = useState('system');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEntry, setManualEntry] = useState({ name: '', email: '', phone: '' });
  const [error, setError] = useState(null);
  const [showFullEmail, setShowFullEmail] = useState({});
  const searchInputRef = useRef(null);

  const debouncedSearch = useMemo(
    () => debounce((term) => filterUsers(term), 300),
    [systemUsers, participants]
  );

  const filterUsers = useCallback((term) => {
    if (!term) {
      setFilteredSystemUsers(systemUsers);
      setFilteredParticipants(participants);
    } else {
      const lowerTerm = term.toLowerCase();
      setFilteredSystemUsers(
        systemUsers.filter(u => 
          u.name?.toLowerCase().includes(lowerTerm) ||
          u.email?.toLowerCase().includes(lowerTerm) ||
          u.username?.toLowerCase().includes(lowerTerm)
        )
      );
      setFilteredParticipants(
        participants.filter(p => 
          p.name?.toLowerCase().includes(lowerTerm) ||
          p.email?.toLowerCase().includes(lowerTerm)
        )
      );
    }
  }, [systemUsers, participants]);

  const handleSearchChange = useCallback((e) => {
    const term = e.target.value;
    setSearchTerm(term);
    debouncedSearch(term);
  }, [debouncedSearch]);

  // ✅ FIXED: Use the correct /members endpoint
  const fetchSystemUsers = useCallback(async () => {
    setLoadingSystemUsers(true);
    setError(null);
    try {
      const response = await api.get('/users/', {
        params: { skip: 0, limit: 100, is_active: true }
      });
      const users = response.data?.items || response.data || [];
      
      let currentParticipants = [];
      if (meetingId) {
        try {
          // ✅ FIXED: Use /members endpoint instead of /participants
          const participantResponse = await api.get(`/action-tracker/meetings/${meetingId}/members`);
          currentParticipants = participantResponse.data?.items || participantResponse.data || [];
        } catch (err) {
          console.warn('Could not fetch participants for privacy check:', err);
        }
      }
      
      setSystemUsers(users.map(u => {
        const isParticipant = currentParticipants.some(p => 
          p.email?.toLowerCase() === u.email?.toLowerCase() ||
          p.id === u.id
        );
        return {
          id: u.id,
          name: u.full_name || (u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username),
          username: u.username,
          email: u.email,
          phone: u.phone || u.telephone,
          type: 'system',
          is_active: u.is_active,
          is_participant: isParticipant,
          original_email: u.email
        };
      }));
    } catch (err) {
      console.error("Failed to fetch system users:", err);
      setError('Could not load system users. Please try again.');
    } finally {
      setLoadingSystemUsers(false);
    }
  }, [meetingId]);

  // ✅ FIXED: Use the correct /members endpoint for participants
  const fetchParticipants = useCallback(async () => {
    if (!meetingId) {
      setParticipants([]);
      return;
    }
    setLoadingParticipants(true);
    setError(null);
    try {
      // ✅ FIXED: Use /members endpoint instead of /participants
      const response = await api.get(`/action-tracker/meetings/${meetingId}/members`);
      const participantsData = response.data?.items || response.data || [];
      setParticipants(participantsData.map(p => ({
        id: p.user_id || p.id,
        name: p.name || p.full_name || p.username,
        email: p.email,
        phone: p.phone || p.telephone,
        title: p.title || p.role,
        type: 'participant',
        original_email: p.email,
        is_chairperson: p.is_chairperson || false,
        is_secretary: p.is_secretary || false,
        attendance_status: p.attendance_status || 'pending'
      })));
    } catch (err) {
      console.error("Failed to fetch participants:", err);
      // Don't show error to user, just set empty array
      setParticipants([]);
    } finally {
      setLoadingParticipants(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (searchDialogOpen) {
      setSearchTerm('');
      setError(null);
      setShowFullEmail({});
      if (activeTab === 'system') fetchSystemUsers();
      else if (activeTab === 'participants' && meetingId) fetchParticipants();
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchDialogOpen, activeTab, fetchSystemUsers, fetchParticipants, meetingId]);

  useEffect(() => {
    filterUsers(searchTerm);
  }, [systemUsers, participants, filterUsers, searchTerm]);

  const toggleEmailVisibility = useCallback((userId) => {
    setShowFullEmail(prev => ({ ...prev, [userId]: !prev[userId] }));
  }, []);

  const getDisplayEmail = useCallback((user) => {
    if (!user.email) return null;
    const isParticipant = participants.some(p => 
      p.email?.toLowerCase() === user.email?.toLowerCase() ||
      p.id === user.id
    );
    if (isParticipant || showFullEmail[user.id]) return user.email;
    return obfuscateEmail(user.email);
  }, [participants, showFullEmail]);

  const handleSelectUser = useCallback((user) => {
    const isVerifiedSystemUser = user.type === 'system';

    const assignedTo = {
      type: isVerifiedSystemUser ? 'user' : user.type,
      id: user.id,
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      assigned_to_id: isVerifiedSystemUser ? user.id : null,
      assigned_to_name: {
        id: user.id,
        name: user.name,
        email: user.email || '',
        phone: user.phone || '',
        title: user.title,
        type: isVerifiedSystemUser ? 'user' : user.type
      }
    };
    onChange(assignedTo);
    setSearchDialogOpen(false);
    resetForm();
  }, [onChange]);

  const handleAddNewPerson = useCallback(() => {
    if (!manualEntry.name.trim()) {
      setError('Name is required');
      return;
    }
    const existingUser = systemUsers.find(u => 
      u.email?.toLowerCase() === manualEntry.email?.toLowerCase()
    );
    if (existingUser) {
      handleSelectUser(existingUser);
      return;
    }
    const newUser = {
      type: 'manual',
      id: null,
      name: manualEntry.name,
      email: manualEntry.email || null,
      phone: manualEntry.phone || null,
      assigned_to_id: null,
      assigned_to_name: {
        name: manualEntry.name,
        email: manualEntry.email || null,
        phone: manualEntry.phone || null,
        type: 'manual'
      }
    };
    onChange(newUser);
    setSearchDialogOpen(false);
    resetForm();
  }, [manualEntry, systemUsers, handleSelectUser, onChange]);

  const resetForm = useCallback(() => {
    setSearchTerm('');
    setManualEntry({ name: '', email: '', phone: '' });
    setError(null);
    setShowManualForm(false);
  }, []);

  const getInitials = useCallback((name) => {
    if (!name) return '?';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return parts[0][0] + parts[parts.length - 1][0];
    return parts[0]?.[0]?.toUpperCase() || '?';
  }, []);

  const displayValue = value?.name || '';

  const UserItem = useCallback(({ user, selected }) => {
    const displayEmail = getDisplayEmail(user);
    const isParticipant = user.is_participant || participants.some(p => 
      p.email?.toLowerCase() === user.email?.toLowerCase() ||
      p.id === user.id
    );
    const showRevealButton = !isParticipant && user.email;
    
    return (
      <ListItem
        component="div"
        onClick={() => handleSelectUser(user)}
        selected={selected}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-selected': {
            bgcolor: 'primary.50',
            '&:hover': { bgcolor: 'primary.100' },
          },
        }}
      >
        <ListItemAvatar>
          <Avatar sx={{ bgcolor: selected ? 'primary.main' : 'grey.400' }}>
            {getInitials(user.name)}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" fontWeight={selected ? 600 : 400}>
                {user.name}
              </Typography>
              {isParticipant && (
                <Chip
                  label="Meeting Participant"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.6rem' }}
                />
              )}
              {user.is_active === false && (
                <Chip
                  label="Inactive"
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.6rem' }}
                />
              )}
            </Stack>
          }
          secondary={
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
              {displayEmail && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EmailIcon fontSize="small" sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary" component="span">
                    {displayEmail}
                  </Typography>
                  {showRevealButton && (
                    <Tooltip title={showFullEmail[user.id] ? "Hide email" : "Show full email"}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEmailVisibility(user.id);
                        }}
                        sx={{ p: 0.5 }}
                      >
                        {showFullEmail[user.id] ? (
                          <VisibilityOffIcon sx={{ fontSize: 14 }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  )}
                  {!isParticipant && !showFullEmail[user.id] && (
                    <Tooltip title="Email hidden for privacy. Click eye icon to reveal.">
                      <Chip
                        label="Private"
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.55rem' }}
                      />
                    </Tooltip>
                  )}
                </Box>
              )}
              {user.username && (
                <Typography variant="caption" color="text.secondary">
                  @{user.username}
                </Typography>
              )}
              {user.title && (
                <Chip
                  label={user.title}
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.6rem' }}
                />
              )}
            </Box>
          }
        />
        {selected && (
          <CheckCircleIcon color="primary" sx={{ ml: 1 }} />
        )}
      </ListItem>
    );
  }, [getDisplayEmail, participants, showFullEmail, toggleEmailVisibility, handleSelectUser, getInitials]);

  return (
    <>
      <TextField
        fullWidth
        label={label}
        value={displayValue}
        onClick={() => setSearchDialogOpen(true)}
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
            )
          }
        }}
      />
      
      <Dialog 
        open={searchDialogOpen} 
        onClose={() => setSearchDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        TransitionProps={{
          onEntered: () => searchInputRef.current?.focus(),
        }}
        slotProps={{
          modal: {}
        }}
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
              <strong>Privacy:</strong> Email addresses are hidden by default. 
              Only participants in this meeting can see full emails. 
              You can click the eye icon to reveal individual emails.
            </Typography>
          </Alert>
          
          <Stack spacing={2.5}>
            <TextField
              inputRef={searchInputRef}
              fullWidth
              placeholder="Search by name, email, or username..."
              value={searchTerm}
              onChange={handleSearchChange}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          setSearchTerm('');
                          filterUsers('');
                        }}
                        edge="end"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }
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
                  <Chip
                    label={systemUsers.length}
                    size="small"
                    sx={{ ml: 1, height: 18, fontSize: '0.6rem' }}
                  />
                )}
              </ToggleButton>
              <ToggleButton value="participants" aria-label="meeting participants">
                <GroupIcon fontSize="small" sx={{ mr: 1 }} />
                Participants
                {participants.length > 0 && (
                  <Chip
                    label={participants.length}
                    size="small"
                    sx={{ ml: 1, height: 18, fontSize: '0.6rem' }}
                  />
                )}
              </ToggleButton>
            </ToggleButtonGroup>

            {activeTab === 'system' && (
              <>
                {loadingSystemUsers ? (
                  <Box textAlign="center" py={4}>
                    <CircularProgress size={32} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Loading users...
                    </Typography>
                  </Box>
                ) : filteredSystemUsers.length > 0 ? (
                  <List 
                    sx={{ 
                      maxHeight: 400, 
                      overflowY: 'auto',
                      p: 0,
                      '&::-webkit-scrollbar': {
                        width: 6,
                      },
                      '&::-webkit-scrollbar-track': {
                        bgcolor: 'background.paper',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        bgcolor: 'grey.300',
                        borderRadius: 3,
                      },
                    }}
                  >
                    {filteredSystemUsers.map((user) => (
                      <UserItem
                        key={user.id}
                        user={user}
                        selected={value?.id === user.id && value?.type === 'user'}
                      />
                    ))}
                  </List>
                ) : searchTerm ? (
                  <Alert severity="info" icon={<SearchIcon />}>
                    No users found matching "{searchTerm}"
                  </Alert>
                ) : (
                  <Alert severity="info">
                    No system users available
                  </Alert>
                )}
              </>
            )}

            {activeTab === 'participants' && (
              <>
                {loadingParticipants ? (
                  <Box textAlign="center" py={4}>
                    <CircularProgress size={32} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Loading participants...
                    </Typography>
                  </Box>
                ) : filteredParticipants.length > 0 ? (
                  <List 
                    sx={{ 
                      maxHeight: 400, 
                      overflowY: 'auto',
                      p: 0,
                      '&::-webkit-scrollbar': {
                        width: 6,
                      },
                      '&::-webkit-scrollbar-track': {
                        bgcolor: 'background.paper',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        bgcolor: 'grey.300',
                        borderRadius: 3,
                      },
                    }}
                  >
                    {filteredParticipants.map((p) => (
                      <UserItem
                        key={p.id}
                        user={p}
                        selected={value?.id === p.id && value?.type === 'participant'}
                      />
                    ))}
                  </List>
                ) : searchTerm ? (
                  <Alert severity="info" icon={<SearchIcon />}>
                    No participants found matching "{searchTerm}"
                  </Alert>
                ) : (
                  <Alert severity="info">
                    {meetingId ? 'No participants found for this meeting' : 'No meeting selected'}
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
                    label="Full Name *"
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
                      }
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
                      }
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