// src/components/actiontracker/meetings/components/AssignUserDialog.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, LinearProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  useMediaQuery, useTheme, IconButton, Typography,
  Stack, Box
} from '@mui/material';
import { Close as CloseIcon, Assignment as AssignmentIcon } from '@mui/icons-material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addMinutes } from 'date-fns';
import { useDispatch } from 'react-redux';
import { updateAction } from '../../../../store/slices/actionTracker/actionSlice';
import AssignToSelector from './AssignToSelector';

const AssignUserDialog = ({ open, action, onClose, onAssign, meetingId }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();

  // Compute effective meeting ID (fallback to action's meeting_id if prop is null)
  const effectiveMeetingId = meetingId || action?.minutes?.meeting_id || action?.meeting_id;
  
  console.log('AssignUserDialog - meetingId prop:', meetingId);
  console.log('AssignUserDialog - effectiveMeetingId:', effectiveMeetingId);
  console.log('AssignUserDialog - action:', action?.id);

  const [formData, setFormData] = useState({
    description: '',
    assigned_to: null,
    due_date: null,
    priority: 2,
    remarks: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load existing data when dialog opens
  useEffect(() => {
    if (open && action) {
      let currentAssignment = null;
      
      // Check for existing assignment
      if (action.assigned_to) {
        currentAssignment = {
          type: 'user',
          id: action.assigned_to.id,
          name: action.assigned_to.full_name || action.assigned_to.username,
          email: action.assigned_to.email,
          phone: action.assigned_to.phone || action.assigned_to.telephone,
          assigned_to_id: action.assigned_to.id,
          assigned_to_name: {
            id: action.assigned_to.id,
            name: action.assigned_to.full_name || action.assigned_to.username,
            email: action.assigned_to.email,
            phone: action.assigned_to.phone || action.assigned_to.telephone,
            type: 'user'
          }
        };
      } else if (action.assigned_to_name) {
        try {
          const data = typeof action.assigned_to_name === 'string' 
            ? JSON.parse(action.assigned_to_name) 
            : action.assigned_to_name;
          
          currentAssignment = {
            type: data.type || 'manual',
            id: data.id,
            name: data.name,
            email: data.email || '',
            phone: data.phone || '',
            assigned_to_id: action.assigned_to_id || data.id,
            assigned_to_name: data
          };
        } catch (e) {
          currentAssignment = null;
        }
      }

      setFormData({
        description: action.description || '',
        assigned_to: currentAssignment,
        due_date: action.due_date ? new Date(action.due_date) : null,
        priority: action.priority || 2,
        remarks: action.remarks || ''
      });
    }
  }, [open, action]);

  const handleUpdateAssignment = async () => {
    if (!formData.assigned_to) {
      setError('Please select a person to assign');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let assignedToName = null;
      let assignedToId = null;

      if (formData.assigned_to) {
        assignedToId = formData.assigned_to.assigned_to_id || 
                      (formData.assigned_to.type === 'user' ? formData.assigned_to.id : null);
        assignedToName = formData.assigned_to.assigned_to_name || {
          id: formData.assigned_to.id,
          name: formData.assigned_to.name,
          email: formData.assigned_to.email || '',
          phone: formData.assigned_to.phone || '',
          type: formData.assigned_to.type || 'manual'
        };
      }

      const payload = {
        assigned_to_id: assignedToId,
        assigned_to_name: assignedToName,
        due_date: formData.due_date ? formData.due_date.toISOString() : null,
        priority: formData.priority,
        remarks: formData.remarks
      };

      console.log('Updating action with payload:', payload);

      const result = await dispatch(updateAction({ 
        id: action.id, 
        actionData: payload 
      })).unwrap();
      
      console.log('Update successful:', result);
      
      if (onAssign) onAssign();
      onClose();
    } catch (err) {
      console.error('Error updating assignment:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to update assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ 
          m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          bgcolor: isMobile ? 'primary.main' : 'transparent',
          color: isMobile ? 'white' : 'inherit'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Update Assignment</Typography>
          {isMobile && (
            <IconButton onClick={onClose} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>

        {loading && <LinearProgress />}
        
        <DialogContent dividers sx={{ p: isMobile ? 2 : 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          <Stack spacing={3}>
            {/* Current Action Card */}
            <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <AssignmentIcon color="primary" sx={{ mt: 0.5 }} />
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">
                    Action Item
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {formData.description}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Assign To Selector - Pass effectiveMeetingId */}
            <AssignToSelector
              value={formData.assigned_to}
              onChange={(userObj) => setFormData({ ...formData, assigned_to: userObj })}
              disabled={loading}
              label="Assign To"
              meetingId={effectiveMeetingId}
            />

            {/* Due Date Picker */}
            <DateTimePicker
              label="Due Date & Time"
              value={formData.due_date}
              onChange={(val) => setFormData({ ...formData, due_date: val })}
              disablePast
              minDateTime={addMinutes(new Date(), 5)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  helperText: "Must be a future date"
                }
              }}
            />

            {/* Priority Selector */}
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                label="Priority"
              >
                <MenuItem value={1}>🔴 High - Urgent</MenuItem>
                <MenuItem value={2}>🟠 Medium - Normal</MenuItem>
                <MenuItem value={3}>🟢 Low - Flexible</MenuItem>
                <MenuItem value={4}>⚪ Very Low - Info Only</MenuItem>
              </Select>
            </FormControl>

            {/* Remarks */}
            <TextField
              fullWidth
              label="Remarks / Notes"
              multiline
              rows={3}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Add any notes about this assignment..."
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ 
          p: 2, 
          flexDirection: isMobile ? 'column' : 'row',
          gap: 1
        }}>
          <Button 
            fullWidth={isMobile} 
            onClick={onClose} 
            disabled={loading}
            color="inherit"
            sx={{ order: isMobile ? 2 : 1 }}
          >
            Cancel
          </Button>
          <Button
            fullWidth={isMobile}
            variant="contained"
            onClick={handleUpdateAssignment}
            disabled={loading || !formData.assigned_to}
            sx={{ order: isMobile ? 1 : 2, py: isMobile ? 1.5 : 1 }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AssignUserDialog;