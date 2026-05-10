// src/components/meetings/MeetingForm/components/ExistingUsersSelector.jsx
import React, { useState, useEffect } from 'react';
import { Stack, TextField, Paper, List, ListItemButton, ListItemAvatar, ListItemText, Avatar, Box, Typography, Button, CircularProgress, InputAdornment } from '@mui/material';
import { Search as SearchIcon, PersonAdd as PersonAddIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUsers, selectUsers, selectUsersLoading } from '../../../../../store/slices/actionTracker/participantSlice';

export const ExistingUsersSelector = ({ onAddUser, existingParticipants, selectedUserIds }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  const dispatch = useDispatch();
  const users = useSelector(selectUsers);
  const usersLoading = useSelector(selectUsersLoading);
  
  useEffect(() => {
    dispatch(fetchUsers({ limit: 100 }));
  }, [dispatch]);
  
  const filteredUsers = users.filter(user => 
    !selectedUserIds.includes(user.id) && (
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
  
  const handleAddUser = () => {
    if (selectedUser) {
      onAddUser({
        id: selectedUser.id,
        name: selectedUser.full_name || selectedUser.username,
        email: selectedUser.email,
        telephone: selectedUser.phone,
        title: selectedUser.title,
        organization: selectedUser.organization,
        is_chairperson: false,
        is_existing: true
      });
      setSelectedUser(null);
      setSearchTerm('');
    }
  };
  
  return (
    <Stack spacing={2}>
      <TextField
        fullWidth
        placeholder="Search users by name, email or username..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        size="small"
        slotProps={{
          input: {
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
          }
        }}
      />
      
      <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
        {usersLoading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={30} /></Box>
        ) : filteredUsers.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No users found</Typography>
          </Box>
        ) : (
          <List dense>
            {filteredUsers.map((user) => (
              <ListItemButton
                key={user.id}
                selected={selectedUser?.id === user.id}
                onClick={() => setSelectedUser(user)}
              >
                <ListItemAvatar>
                  <Avatar>{user.full_name?.[0] || user.username?.[0] || 'U'}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={user.full_name || user.username}
                  secondary={user.email}
                />
                {selectedUser?.id === user.id && <CheckCircleIcon color="primary" fontSize="small" />}
              </ListItemButton>
            ))}
          </List>
        )}
      </Paper>
      
      <Button
        variant="contained"
        onClick={handleAddUser}
        disabled={!selectedUser}
        startIcon={<PersonAddIcon />}
      >
        Add Selected User
      </Button>
    </Stack>
  );
};