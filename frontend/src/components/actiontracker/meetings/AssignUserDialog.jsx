// src/components/actiontracker/meetings/AssignUserDialog.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Typography,
  IconButton,
  Divider,
  Card,
  Autocomplete,
  TextField,
  Button,
  Avatar,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  PersonAdd as PersonAddIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const AssignUserDialog = ({ open, action, onClose, onAssign }) => {
  const [assignedToId, setAssignedToId] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/users/');
        const usersData = response.data?.items || response.data || [];
        setUsers(usersData);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (open) {
      fetchUsers();
      if (action) {
        setAssignedToId(action.assigned_to_id || '');
      }
    }
  }, [open, action]);

  const handleAssign = async () => {
    if (!assignedToId) {
      setError('Please select a user to assign');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      await api.patch(`/action-tracker/actions/${action.id}/assign`, {
        assigned_to_id: assignedToId
      });
      onAssign();
      onClose();
    } catch (err) {
      console.error('Error assigning action:', err);
      setError(err.response?.data?.detail || 'Failed to assign action. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedUser = users.find(u => u.id === assignedToId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700}>
            Assign Action
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <Divider />
      
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2.5}>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          
          {/* Task Card */}
          <Card variant="outlined" sx={{ bgcolor: '#f8fafc', p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <PersonIcon sx={{ color: 'primary.main', mt: 0.5 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Task to Assign
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {action?.description || 'Loading...'}
                </Typography>
              </Box>
            </Stack>
          </Card>
          
          {/* User Selection */}
          <Autocomplete
            options={users}
            loading={loading}
            value={selectedUser || null}
            onChange={(event, newValue) => {
              setAssignedToId(newValue?.id || '');
              setError('');
            }}
            getOptionLabel={(option) => option.full_name || option.username || option.email || ''}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            renderInput={(params) => {
              const { InputProps, ...rest } = params;
              return (
                <TextField
                  {...rest}
                  label="Select User"
                  placeholder="Search for a user to assign..."
                  required
                  InputProps={{
                    ...InputProps,
                    startAdornment: (
                      <>
                        <PersonAddIcon sx={{ color: 'action.active', mr: 1 }} />
                        {InputProps?.startAdornment}
                      </>
                    ),
                  }}
                />
              );
            }}
            renderOption={(props, option) => (
              <li {...props}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
                    {(option.full_name?.[0] || option.username?.[0] || '?').toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {option.full_name || option.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email}
                    </Typography>
                  </Box>
                </Stack>
              </li>
            )}
          />
          
          {/* Info Message */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            The assigned user will receive a notification and be able to track this task.
          </Typography>
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleAssign} 
          disabled={!assignedToId || submitting || loading}
          startIcon={submitting ? <CircularProgress size={16} /> : <PersonAddIcon />}
          sx={{ minWidth: 120 }}
        >
          {submitting ? 'Assigning...' : 'Assign Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignUserDialog;