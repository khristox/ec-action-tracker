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
  Checkbox,
  useTheme,
  alpha
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUsers, selectUsers, selectUsersLoading } from '../../../../../store/slices/actionTracker/participantSlice';

export const ExistingUsersSelector = ({ 
  selectedUserIds = [],
  selectedUsers = [],
  onSelectionChange,
  multiple = true 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  
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
  
  const handleToggleUser = (user) => {
    const isSelected = selectedUsers.some(u => u.id === user.id);
    if (isSelected) {
      onSelectionChange(selectedUsers.filter(u => u.id !== user.id));
    } else {
      onSelectionChange([...selectedUsers, user]);
    }
  };
  
  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredUsers);
    }
  };

  const isAllSelected = filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length;
  const hasSelection = selectedUsers.length > 0;
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1.5, pt: 1 }}>
      {/* 1. SEARCH BAR + SELECT ALL */}
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          fullWidth
          placeholder="Search users by name, email or username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
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
          <Button
            size="small"
            variant="outlined"
            onClick={handleSelectAll}
            disabled={filteredUsers.length === 0}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '0.75rem',
              minWidth: 90,
              height: 40,
              flexShrink: 0
            }}
          >
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </Button>
        )}
      </Stack>
      
      {/* 2. SELECTED USERS SUMMARY CHIPS */}
      {hasSelection && (
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
            {selectedUsers.length} selected:
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1, maxHeight: 60, overflowY: 'auto' }}>
            {selectedUsers.map(user => (
              <Chip
                key={user.id}
                label={user.full_name || user.username}
                size="small"
                onDelete={() => handleToggleUser(user)}
                sx={{ height: 22, fontSize: '0.65rem' }}
              />
            ))}
          </Box>
        </Box>
      )}
      
      {/* 3. SCROLLABLE USER LIST */}
      <Paper 
        variant="outlined" 
        sx={{ 
          flex: 1,
          minHeight: 220,
          maxHeight: 320,
          overflowY: 'auto',
          borderRadius: 2,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            background: isLight ? '#d0d5dd' : 'rgba(255,255,255,0.2)',
            borderRadius: 3,
          },
        }}
      >
        {usersLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={28} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Loading users...
            </Typography>
          </Box>
        ) : filteredUsers.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {searchTerm ? `No users found matching "${searchTerm}"` : 'No available users to add'}
            </Typography>
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
                  
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: isSelected ? 'primary.main' : 'grey.500', fontSize: '0.8rem' }}>
                      {user.full_name?.[0] || user.username?.[0] || 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight={isSelected ? 600 : 400}>{user.full_name || user.username}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary" noWrap>{user.email}</Typography>}
                  />
                  
                  {isSelected && <CheckCircleIcon color="primary" fontSize="small" sx={{ ml: 1 }} />}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Paper>
    </Box>
  );
};

export default React.memo(ExistingUsersSelector);