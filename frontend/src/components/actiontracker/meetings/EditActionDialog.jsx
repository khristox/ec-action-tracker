// src/components/actiontracker/meetings/EditActionDialog.jsx
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Autocomplete,
  Avatar,
  Alert,
  CircularProgress,
  Chip,
  Button
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Flag as FlagIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../../../services/api';

const EditActionDialog = ({ open, action, onClose, onSave }) => {
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState(2);
  const [remarks, setRemarks] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [assignedToName, setAssignedToName] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch users for assignment
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await api.get('/users/available');
        const usersData = response.data?.items || response.data || [];
        setUsers(usersData);
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    
    if (open) {
      fetchUsers();
    }
  }, [open]);

  // Populate form when action changes
  useEffect(() => {
    if (action) {
      setDescription(action.description || '');
      setDueDate(action.due_date ? format(new Date(action.due_date), 'yyyy-MM-dd') : '');
      setPriority(action.priority || 2);
      setRemarks(action.remarks || '');
      setAssignedToId(action.assigned_to_id || '');
      setAssignedToName(action.assigned_to?.full_name || action.assigned_to_name || '');
    }
  }, [action]);

  const handleSave = async () => {
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const payload = {
        description: description.trim(),
        due_date: dueDate || null,
        priority: priority,
        remarks: remarks.trim() || null,
        assigned_to_id: assignedToId || null
      };
      
      await api.put(`/action-tracker/actions/${action.id}`, payload);
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving action:', err);
      setError(err.response?.data?.detail || 'Failed to save action');
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = users.find(u => u.id === assignedToId) || null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700}>Edit Action</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <Divider />
      
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2.5}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            required
            error={!description.trim() && saving}
            helperText={!description.trim() && saving ? "Description is required" : ""}
            InputProps={{
              startAdornment: <DescriptionIcon sx={{ color: 'action.active', mr: 1, mt: 1 }} />,
            }}
          />
          
          <Autocomplete
            options={users}
            loading={loadingUsers}
            value={selectedUser}
            onChange={(event, newValue) => {
              setAssignedToId(newValue?.id || '');
              setAssignedToName(newValue?.full_name || newValue?.username || '');
            }}
            getOptionLabel={(option) => option.full_name || option.username || option.email || ''}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            renderInput={(params) => {
              const { InputProps, ...rest } = params;
              return (
                <TextField
                  {...rest}
                  label="Assign To"
                  placeholder="Search for a user..."
                  InputProps={{
                    ...InputProps,
                    startAdornment: (
                      <>
                        <PersonIcon sx={{ color: 'action.active', mr: 1 }} />
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
          
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: <ScheduleIcon sx={{ color: 'action.active', mr: 1 }} />,
              }}
            />
            
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                label="Priority"
              >
                <MenuItem value={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 12, height: 12, bgcolor: '#EF4444', borderRadius: 1 }} />
                    <Typography>High</Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 12, height: 12, bgcolor: '#F59E0B', borderRadius: 1 }} />
                    <Typography>Medium</Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value={3}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 12, height: 12, bgcolor: '#10B981', borderRadius: 1 }} />
                    <Typography>Low</Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value={4}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 12, height: 12, bgcolor: '#6B7280', borderRadius: 1 }} />
                    <Typography>Very Low</Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
          </Stack>
          
          <TextField
            fullWidth
            label="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            multiline
            rows={3}
            placeholder="Add any additional notes about this action..."
          />
          
          {action && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Current Status:
              </Typography>
              <Chip
                label={action.completed_at ? 'Completed' : (action.overall_status_name || 'Pending')}
                size="small"
                color={action.completed_at ? 'success' : 'warning'}
              />
              <Typography variant="caption" color="text.secondary">
                Progress: {action.overall_progress_percentage || 0}%
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSave} 
          disabled={saving || !description.trim()}
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          sx={{ minWidth: 120 }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditActionDialog;