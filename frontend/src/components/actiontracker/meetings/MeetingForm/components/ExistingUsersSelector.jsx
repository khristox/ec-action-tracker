// src/components/meetings/MeetingForm/components/ExistingUsersSelector.jsx

import React, { useState, useEffect } from 'react';
import {
  Stack,
  TextField,
  Paper,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Box,
  Typography,
  Button,
  CircularProgress,
  InputAdornment,
  Chip,
  Badge,
  Checkbox,
  useTheme,
  alpha
} from '@mui/material';
import {
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  CheckCircle as CheckCircleIcon,
  People as PeopleIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUsers, selectUsers, selectUsersLoading } from '../../../../../store/slices/actionTracker/participantSlice';

export const ExistingUsersSelector = ({ 
  onAddUser, 
  existingParticipants, 
  selectedUserIds,
  multiple = true // Enable multiple selection by default
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  
  const dispatch = useDispatch();
  const users = useSelector(selectUsers);
  const usersLoading = useSelector(selectUsersLoading);
  
  useEffect(() => {
    dispatch(fetchUsers({ limit: 100 }));
  }, [dispatch]);
  
  // Reset selection when users list changes
  useEffect(() => {
    setSelectedUsers([]);
  }, [users]);
  
  const filteredUsers = users.filter(user => 
    !selectedUserIds.includes(user.id) && (
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
  
  const handleToggleUser = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };
  
  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers);
    }
  };
  
  const handleAddUsers = () => {
    if (selectedUsers.length === 0) return;
    
    setIsAdding(true);
    
    // Add each selected user
    selectedUsers.forEach(user => {
      onAddUser({
        id: user.id,
        name: user.full_name || user.username,
        email: user.email,
        telephone: user.phone,
        title: user.title,
        organization: user.organization,
        is_chairperson: false,
        is_existing: true
      });
    });
    
    // Clear selection after adding
    setSelectedUsers([]);
    setSearchTerm('');
    setIsAdding(false);
  };
  
  const handleClearSelection = () => {
    setSelectedUsers([]);
  };
  
  const isAllSelected = filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length;
  const isSomeSelected = selectedUsers.length > 0 && selectedUsers.length < filteredUsers.length;
  
  return (
    <Stack spacing={2}>
      {/* Search and Selection Info */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <TextField
          fullWidth
          placeholder="Search users by name, email or username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <Chip 
                    label={`${filteredUsers.length} results`} 
                    size="small" 
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.6rem' }}
                  />
                </InputAdornment>
              )
            }
          }}
        />
        
        {multiple && (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={handleSelectAll}
              disabled={filteredUsers.length === 0}
              sx={{ 
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '0.75rem',
                minWidth: 80
              }}
            >
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </Button>
            
            {selectedUsers.length > 0 && (
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={handleClearSelection}
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  minWidth: 60
                }}
              >
                Clear
              </Button>
            )}
          </Stack>
        )}
      </Stack>
      
      {/* Selected Users Count */}
      {selectedUsers.length > 0 && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          p: 1,
          bgcolor: isLight ? alpha(theme.palette.primary.main, 0.04) : alpha(theme.palette.primary.main, 0.08),
          borderRadius: 2,
          border: 1,
          borderColor: isLight ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.main, 0.2),
          flexWrap: 'wrap'
        }}>
          <PeopleIcon color="primary" sx={{ fontSize: 18 }} />
          <Typography variant="caption" fontWeight={600}>
            {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
            {selectedUsers.slice(0, 5).map(user => (
              <Chip
                key={user.id}
                label={user.full_name || user.username}
                size="small"
                onDelete={() => handleToggleUser(user)}
                sx={{ height: 22, fontSize: '0.65rem' }}
              />
            ))}
            {selectedUsers.length > 5 && (
              <Chip
                label={`+${selectedUsers.length - 5} more`}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.65rem' }}
              />
            )}
          </Box>
        </Box>
      )}
      
      {/* User List */}
      <Paper 
        variant="outlined" 
        sx={{ 
          maxHeight: 300, 
          overflow: 'auto',
          borderRadius: 2,
          '&::-webkit-scrollbar': {
            width: 4,
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: isLight ? '#d0d5dd' : 'rgba(255,255,255,0.2)',
            borderRadius: 2,
          },
        }}
      >
        {usersLoading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress size={30} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Loading users...
            </Typography>
          </Box>
        ) : filteredUsers.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            {searchTerm ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  No users found matching "{searchTerm}"
                </Typography>
                <Button
                  size="small"
                  onClick={() => setSearchTerm('')}
                  sx={{ mt: 1, textTransform: 'none' }}
                >
                  Clear search
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  No available users to add
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                  All users may already be added
                </Typography>
              </>
            )}
          </Box>
        ) : (
          <List dense sx={{ py: 0.5 }}>
            {filteredUsers.map((user) => {
              const isSelected = selectedUsers.some(u => u.id === user.id);
              
              return (
                <ListItemButton
                  key={user.id}
                  selected={isSelected}
                  onClick={() => handleToggleUser(user)}
                  sx={{
                    borderRadius: 1,
                    mx: 0.5,
                    mb: 0.5,
                    '&.Mui-selected': {
                      bgcolor: isLight ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.15),
                      '&:hover': {
                        bgcolor: isLight ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.2),
                      }
                    }
                  }}
                >
                  {multiple && (
                    <Checkbox
                      checked={isSelected}
                      size="small"
                      sx={{ mr: 0.5, p: 0.5 }}
                    />
                  )}
                  
                  <ListItemAvatar>
                    <Avatar 
                      sx={{ 
                        width: 32, 
                        height: 32,
                        bgcolor: isSelected ? 'primary.main' : 'grey.400',
                        fontSize: '0.8rem'
                      }}
                    >
                      {user.full_name?.[0] || user.username?.[0] || 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                        {user.full_name || user.username}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    }
                  />
                  
                  {isSelected && (
                    <CheckCircleIcon color="primary" fontSize="small" sx={{ ml: 1 }} />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Paper>
      
      {/* Action Buttons */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="contained"
          onClick={handleAddUsers}
          disabled={selectedUsers.length === 0 || isAdding}
          startIcon={selectedUsers.length > 1 ? <PeopleIcon /> : <PersonAddIcon />}
          fullWidth
          sx={{ 
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            py: 1,
            position: 'relative'
          }}
        >
          {isAdding ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            `Add ${selectedUsers.length} User${selectedUsers.length !== 1 ? 's' : ''}`
          )}
        </Button>
        
        {selectedUsers.length > 0 && (
          <Button
            variant="outlined"
            color="error"
            onClick={handleClearSelection}
            disabled={isAdding}
            startIcon={<ClearIcon />}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              minWidth: 100
            }}
          >
            Clear All
          </Button>
        )}
      </Stack>
      
      {/* Help Text */}
      {multiple && filteredUsers.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          Click to select multiple users. Selected users will be added all at once.
        </Typography>
      )}
    </Stack>
  );
};

export default React.memo(ExistingUsersSelector);