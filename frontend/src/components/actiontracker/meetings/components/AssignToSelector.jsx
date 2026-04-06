import React, { useState, useEffect } from 'react';
import {
  Box, Button, Stack, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, Paper, Typography,
  CircularProgress, InputAdornment, IconButton
} from '@mui/material';
import { Search as SearchIcon, PersonAdd as PersonAddIcon } from '@mui/icons-material';
import api from '../../../../services/api';

const AssignToSelector = ({ value, onChange, disabled, label = "Assign To", meetingId }) => {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [searching, setSearching] = useState(false);
  const [manualEntry, setManualEntry] = useState({ name: '', email: '' });

  // Fetch meeting participants when dialog opens
  useEffect(() => {
    if (searchDialogOpen && meetingId) {
      fetchMeetingParticipants();
    }
  }, [searchDialogOpen, meetingId]);

  const fetchMeetingParticipants = async () => {
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/participants`);
      setParticipants(response.data || []);
    } catch (err) {
      console.error("Failed to fetch participants:", err);
      setParticipants([]);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 2) return;
    
    setSearching(true);
    try {
      const response = await api.get(`/users/?skip=0&limit=50`);
      const allUsers = response.data?.items || response.data || [];
      const filtered = allUsers.filter(u => 
        (u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setSearchResults(filtered);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (searchDialogOpen && searchTerm.length >= 2) {
      const timer = setTimeout(handleSearch, 300);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, searchDialogOpen]);

  const handleSelectUser = (user) => {
    onChange({
      type: 'user',
      id: user.id,
      name: user.full_name || user.username,
      email: user.email,
      assigned_to_id: user.id,
      assigned_to_name: user.full_name || user.username
    });
    setSearchDialogOpen(false);
    setSearchTerm('');
  };

  const handleSelectParticipant = (participant) => {
    onChange({
      type: 'participant',
      id: participant.id,
      name: participant.name,
      email: participant.email,
      assigned_to_name: participant.name,
      assigned_to_id: null
    });
    setSearchDialogOpen(false);
    setSearchTerm('');
  };

  const handleAddNew = () => {
    if (!manualEntry.name.trim()) return;
    onChange({
      type: 'new',
      name: manualEntry.name,
      email: manualEntry.email,
      assigned_to_name: manualEntry.name,
      assigned_to_id: null
    });
    setSearchDialogOpen(false);
    setManualEntry({ name: '', email: '' });
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
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setSearchDialogOpen(true)} edge="end">
                <SearchIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      
      <Dialog open={searchDialogOpen} onClose={() => setSearchDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Assign To</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              InputProps={{
                endAdornment: searching && <CircularProgress size={20} />,
              }}
            />
            
            {/* Existing Users */}
            <Typography variant="subtitle2">System Users</Typography>
            {searching ? (
              <Box textAlign="center" py={2}><CircularProgress size={24} /></Box>
            ) : searchResults.length > 0 ? (
              <Stack spacing={1} maxHeight={200} sx={{ overflowY: 'auto' }}>
                {searchResults.map((user) => (
                  <Paper
                    key={user.id}
                    sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                    onClick={() => handleSelectUser(user)}
                  >
                    <Typography fontWeight={600}>{user.full_name || user.username}</Typography>
                    <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                  </Paper>
                ))}
              </Stack>
            ) : searchTerm.length >= 2 ? (
              <Alert severity="info">No users found</Alert>
            ) : null}
            
            {/* Meeting Participants */}
            {participants.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2 }}>Meeting Participants</Typography>
                <Stack spacing={1} maxHeight={200} sx={{ overflowY: 'auto' }}>
                  {participants.map((p) => (
                    <Paper
                      key={p.id}
                      sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                      onClick={() => handleSelectParticipant(p)}
                    >
                      <Typography fontWeight={600}>{p.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{p.email || 'No email'}</Typography>
                    </Paper>
                  ))}
                </Stack>
              </>
            )}
            
            {/* Add New Person */}
            <Typography variant="subtitle2" sx={{ mt: 2 }}>Add New Person</Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                size="small"
                label="Name"
                value={manualEntry.name}
                onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                sx={{ flex: 2 }}
              />
              <TextField
                size="small"
                label="Email (optional)"
                value={manualEntry.email}
                onChange={(e) => setManualEntry({ ...manualEntry, email: e.target.value })}
                sx={{ flex: 3 }}
              />
              <Button 
                variant="contained" 
                onClick={handleAddNew}
                disabled={!manualEntry.name.trim()}
              >
                Add
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AssignToSelector;