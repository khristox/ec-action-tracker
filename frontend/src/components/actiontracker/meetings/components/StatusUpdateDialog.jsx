import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, FormControl, InputLabel, Select,
  MenuItem, Box, Stack, Typography, Divider
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import { useDispatch } from 'react-redux';
import { updateMeetingStatus } from '../../../../store/slices/actionTracker/meetingSlice';

const StatusUpdateDialog = ({ open, onClose, meeting, statusOptions, onUpdate }) => {
  const dispatch = useDispatch();
  
  // Local state for the form
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [statusDate, setStatusDate] = useState(dayjs());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open && meeting?.status) {
      // Find the current status in options to pre-select or default
      const currentVal = meeting.status.code || meeting.status.value;
      setSelectedStatus(currentVal || '');
      setStatusComment('');
      setStatusDate(dayjs());
    }
  }, [open, meeting]);

  const handleSubmit = async () => {
    if (!selectedStatus || !statusComment) return;

    setIsSubmitting(true);
    try {
      const selectedOption = statusOptions.find(opt => opt.value === selectedStatus);
      
      const payload = {
        id: meeting.id,
        status_id: selectedOption?.id,
        status_comment: statusComment,
        status_date: statusDate.toISOString()
      };

      const result = await dispatch(updateMeetingStatus(payload));
      
      if (!result.error) {
        onUpdate(); // Trigger parent refresh
        onClose();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 'bold' }}>Update Meeting Status</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          
          {/* Audit Info: Current Status Summary */}
          <Box sx={{ p: 2, bgcolor: '#f1f5f9', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" uppercase>Current Status</Typography>
            <Typography variant="body1" fontWeight="bold" color="primary">
              {meeting?.status?.name || 'Unknown'}
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              Last changed by: **{meeting?.updated_by_name || 'System'}**
            </Typography>
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
                <MenuItem key={opt.id} value={opt.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box 
                      sx={{ 
                        width: 12, height: 12, borderRadius: '50%', 
                        bgcolor: opt.extra_metadata?.color || opt.color || '#64748b' 
                      }} 
                    />
                    {opt.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <DateTimePicker
            label="Effective Date & Time"
            value={statusDate}
            onChange={(val) => setStatusDate(val)}
            slotProps={{ textField: { fullWidth: true } }}
          />

          <TextField
            fullWidth
            label="Status Change Reason / Comment"
            placeholder="Explain why the status is being changed..."
            multiline
            rows={3}
            required
            value={statusComment}
            onChange={(e) => setStatusComment(e.target.value)}
            helperText="This comment will be saved in the meeting history audit trail."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit} 
          disabled={isSubmitting || !selectedStatus || !statusComment}
        >
          {isSubmitting ? 'Updating...' : 'Confirm Change'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StatusUpdateDialog;