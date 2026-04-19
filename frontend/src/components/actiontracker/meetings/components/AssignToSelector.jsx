import React, { useState, useEffect, useCallback } from 'react';
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
  ToggleButtonGroup
} from '@mui/material';
import {
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

const AssignToSelector = ({ value, onChange, disabled, label = "Assign To", meetingId }) => {
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

  // Fetch system users - wrapped in useCallback
  const fetchSystemUsers = useCallback(async () => {
    setLoadingSystemUsers(true);
    setError(null);
    try {
      const response = await api.get(`/users/?skip=0&limit=100&active_only=true`);
      const users = response.data?.items || response.data || [];
      setSystemUsers(users.map(u => ({
        id: u.id,
        name: u.full_name || u.username,
        email: u.email,
        phone: u.phone || u.telephone,
        type: 'system'
      })));
    } catch (err) {
      console.error("Failed to fetch system users:", err);
      setError('Could not load system users');
    } finally {
      setLoadingSystemUsers(false);
    }
  }, []);

  // Fetch meeting participants - wrapped in useCallback
  const fetchParticipants = useCallback(async () => {
    if (!meetingId) {
      console.error('No meetingId provided');
      setError('Meeting ID not available');
      return;
    }
    
    setLoadingParticipants(true);
    setError(null);
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/participants`);
      const participantsData = response.data?.items || response.data || [];
      setParticipants(participantsData.map(p => ({
        id: p.user_id || p.id,
        name: p.name || p.full_name || p.username,
        email: p.email,
        phone: p.phone || p.telephone,
        title: p.title,
        type: 'participant'
      })));
    } catch (err) {
      console.error("Failed to fetch participants:", err);
      setError('Could not load meeting participants');
    } finally {
      setLoadingParticipants(false);
    }
  }, [meetingId]);

  // Fetch system users when dialog opens and system tab is active
  useEffect(() => {
    if (searchDialogOpen && activeTab === 'system') {
      fetchSystemUsers();
    }
  }, [searchDialogOpen, activeTab, fetchSystemUsers]);

  // Fetch meeting participants when dialog opens and participants tab is active
  useEffect(() => {
    if (searchDialogOpen && activeTab === 'participants' && meetingId) {
      fetchParticipants();
    }
  }, [searchDialogOpen, activeTab, meetingId, fetchParticipants]);

  // Filter users based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredSystemUsers(systemUsers);
      setFilteredParticipants(participants);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredSystemUsers(systemUsers.filter(u => 
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
      ));
      setFilteredParticipants(participants.filter(p => 
        p.name?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term)
      ));
    }
  }, [searchTerm, systemUsers, participants]);

  const handleSelectUser = (user) => {
    onChange({
      type: user.type === 'system' ? 'user' : user.type,
      id: user.id,
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      assigned_to_id: user.type === 'system' ? user.id : null,
      assigned_to_name: {
        id: user.id,
        name: user.name,
        email: user.email || '',
        phone: user.phone || '',
        title: user.title,
        type: user.type === 'system' ? 'user' : user.type
      }
    });
    setSearchDialogOpen(false);
    resetForm();
  };

  const handleAddNewPerson = () => {
    if (!manualEntry.name.trim()) {
      setError('Name is required');
      return;
    }
    
    // Check if email matches existing system user
    const existingUser = systemUsers.find(u => 
      u.email?.toLowerCase() === manualEntry.email?.toLowerCase()
    );
    
    if (existingUser) {
      handleSelectUser(existingUser);
    } else {
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
    }
  };

  const resetForm = () => {
    setSearchTerm('');
    setManualEntry({ name: '', email: '', phone: '' });
    setError(null);
    setShowManualForm(false);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayValue = value ? value.name : '';

  return (
    <>
      <TextField
        fullWidth
        label={label}
        value={displayValue}
        onClick={() => setSearchDialogOpen(true)}
        disabled={disabled}
        placeholder="Click to assign to user or participant"
        InputProps={{
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
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          )
        }}
      />
      
      <Dialog open={searchDialogOpen} onClose={() => setSearchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Assign To</Typography>
            <IconButton onClick={() => setSearchDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Search Field */}
            <TextField
              fullWidth
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            {/* Toggle Buttons */}
            <ToggleButtonGroup
              value={activeTab}
              exclusive
              onChange={(e, val) => val && setActiveTab(val)}
              fullWidth
              size="small"
            >
              <ToggleButton value="system">
                <PersonIcon fontSize="small" sx={{ mr: 1 }} />
                System Users ({systemUsers.length})
              </ToggleButton>
              <ToggleButton value="participants">
                <GroupIcon fontSize="small" sx={{ mr: 1 }} />
                Participants ({participants.length})
              </ToggleButton>
            </ToggleButtonGroup>

            {/* System Users Tab */}
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
                  <Stack spacing={1} maxHeight={400} sx={{ overflowY: 'auto' }}>
                    {filteredSystemUsers.map((user) => (
                      <Paper
                        key={user.id}
                        sx={{ p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                        onClick={() => handleSelectUser(user)}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Avatar>{getInitials(user.name)}</Avatar>
                          <Box flex={1}>
                            <Typography fontWeight={600}>{user.name}</Typography>
                            {user.email && (
                              <Typography variant="caption" color="text.secondary">
                                {user.email}
                              </Typography>
                            )}
                          </Box>
                          {value?.id === user.id && value?.type === 'user' && (
                            <CheckCircleIcon color="primary" />
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : searchTerm ? (
                  <Alert severity="info">No users found matching "{searchTerm}"</Alert>
                ) : (
                  <Alert severity="info">No system users found</Alert>
                )}
              </>
            )}

            {/* Participants Tab */}
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
                  <Stack spacing={1} maxHeight={400} sx={{ overflowY: 'auto' }}>
                    {filteredParticipants.map((p) => (
                      <Paper
                        key={p.id}
                        sx={{ p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                        onClick={() => handleSelectUser(p)}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Avatar>{getInitials(p.name)}</Avatar>
                          <Box flex={1}>
                            <Typography fontWeight={600}>{p.name}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              {p.email && (
                                <Typography variant="caption" color="text.secondary">
                                  {p.email}
                                </Typography>
                              )}
                              {p.title && (
                                <Typography variant="caption" color="text.secondary">
                                  • {p.title}
                                </Typography>
                              )}
                            </Stack>
                          </Box>
                          {value?.id === p.id && value?.type === 'participant' && (
                            <CheckCircleIcon color="primary" />
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : searchTerm ? (
                  <Alert severity="info">No participants found matching "{searchTerm}"</Alert>
                ) : (
                  <Alert severity="info">No participants found for this meeting: "{meetingId}"</Alert>
                )}
              </>
            )}

            <Divider />

            {/* Add New Person Section */}
            {!showManualForm ? (
              <Button
                startIcon={<PersonAddIcon />}
                onClick={() => setShowManualForm(true)}
                fullWidth
                variant="outlined"
              >
                Add New Person
              </Button>
            ) : (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Alert severity="info">
                    If the email matches an existing system user, they will be linked automatically.
                  </Alert>
                  
                  <TextField
                    size="small"
                    label="Name *"
                    value={manualEntry.name}
                    onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                    fullWidth
                    required
                  />
                  
                  <TextField
                    size="small"
                    label="Email"
                    value={manualEntry.email}
                    onChange={(e) => setManualEntry({ ...manualEntry, email: e.target.value })}
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  
                  <TextField
                    size="small"
                    label="Phone"
                    value={manualEntry.phone}
                    onChange={(e) => setManualEntry({ ...manualEntry, phone: e.target.value })}
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" onClick={() => setShowManualForm(false)}>
                      Cancel
                    </Button>
                    <Button 
                      size="small" 
                      variant="contained" 
                      onClick={handleAddNewPerson}
                      disabled={!manualEntry.name.trim()}
                    >
                      Add Person
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setSearchDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AssignToSelector;