import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, FormControl, InputLabel, Select,
  MenuItem, Box, Stack, Typography, Divider, Chip
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import { useDispatch } from 'react-redux';
import { updateMeetingStatus } from '../../../../store/slices/actionTracker/meetingSlice';

const StatusUpdateDialog = ({ open, onClose, meeting, statusOptions, onUpdate }) => {
  const dispatch = useDispatch();
  
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open && meeting?.status) {
      // Get current status value
      const currentStatus = meeting.status?.short_name || 
                           meeting.status?.code || 
                           meeting.status?.value || 
                           meeting.status;
      setSelectedStatus(currentStatus || '');
      setStatusComment('');
    }
  }, [open, meeting]);

  const handleSubmit = async () => {
    if (!selectedStatus) return;

    setIsSubmitting(true);
    try {
      // Find the selected status option to get the correct value
      const selectedOption = statusOptions.find(opt => 
        opt.value === selectedStatus || 
        opt.code === selectedStatus ||
        opt.short_name === selectedStatus
      );
      
      // Get the status value to send to API
      const statusValue = selectedOption?.short_name || 
                          selectedOption?.value || 
                          selectedStatus;
      
      // Call the thunk with the correct payload format
      const result = await dispatch(updateMeetingStatus({
        id: meeting.id,
        status: statusValue,
        comment: statusComment || 'Status updated' // Provide default comment if empty
      }));
      
      if (!result.error) {
        if (onUpdate) onUpdate();
        onClose();
      } else {
        console.error("Update failed:", result.error);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get current status display
  const getCurrentStatusDisplay = () => {
    if (!meeting?.status) return 'Unknown';
    return meeting.status.name || meeting.status.label || meeting.status;
  };

  const getCurrentStatusColor = () => {
    const currentStatus = meeting?.status?.short_name || meeting?.status;
    const option = statusOptions.find(opt => 
      opt.value === currentStatus || 
      opt.short_name === currentStatus
    );
    return option?.color || '#64748b';
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 'bold' }}>
        Update Meeting Status
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          
          {/* Current Status Display */}
          <Box sx={{ p: 2, bgcolor: '#f1f5f9', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase">
              Current Status
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Chip 
                label={getCurrentStatusDisplay()}
                size="small"
                sx={{ 
                  bgcolor: getCurrentStatusColor(),
                  color: '#fff',
                  fontWeight: 500
                }}
              />
            </Box>
            {meeting?.updated_by_name && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                Last changed by: {meeting.updated_by_name}
              </Typography>
            )}
          </Box>

          <Divider />

          <FormControl fullWidth required>
            <InputLabel>New Status</InputLabel>
            <Select
              value={selectedStatus}
              label="New Status"
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              {statusOptions.map((opt) => (
                <MenuItem key={opt.id || opt.value} value={opt.value || opt.short_name}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box 
                      sx={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '50%', 
                        bgcolor: opt.color || '#64748b' 
                      }} 
                    />
                    <Typography>{opt.label || opt.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Status Change Comment"
            placeholder="Explain why the status is being changed (optional)..."
            multiline
            rows={3}
            value={statusComment}
            onChange={(e) => setStatusComment(e.target.value)}
            helperText="This comment will be saved in the meeting history audit trail."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit} 
          disabled={isSubmitting || !selectedStatus}
        >
          {isSubmitting ? 'Updating...' : 'Confirm Change'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StatusUpdateDialog;