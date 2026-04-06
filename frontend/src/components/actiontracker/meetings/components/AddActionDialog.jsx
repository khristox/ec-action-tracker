import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, LinearProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  useMediaQuery, useTheme, IconButton, Typography,
  Stack // <--- Added this to the import list
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addMinutes } from 'date-fns';
import AssignToSelector from './AssignToSelector';

const AddActionDialog = ({ open, onClose, onSave, editingAction, meetingId, loading, error }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [formData, setFormData] = useState({
    description: '',
    assigned_to: null,
    due_date: null,
    priority: 2,
    remarks: ''
  });
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (open) {
      if (editingAction) {
        // ... (Assignment parsing logic from your previous implementation)
        setFormData({
          description: editingAction.description || '',
          assigned_to: null, // Replace with your parsing logic
          due_date: editingAction.due_date ? new Date(editingAction.due_date) : null,
          priority: editingAction.priority || 2,
          remarks: editingAction.remarks || ''
        });
      } else {
        setFormData({ description: '', assigned_to: null, due_date: null, priority: 2, remarks: '' });
      }
    }
  }, [editingAction, open]);

  const handleSave = async () => {
    if (!formData.description.trim()) {
      setLocalError("Description is required");
      return;
    }
    
    // Additional check for due date in the future
    if (formData.due_date && formData.due_date < new Date()) {
        setLocalError("Due date must be in the future");
        return;
    }

    setLocalError(null);

    const payload = {
      description: formData.description.trim(),
      due_date: formData.due_date ? formData.due_date.toISOString() : null,
      priority: formData.priority,
      remarks: formData.remarks || '',
      assigned_to_name: formData.assigned_to?.assigned_to_name || null,
      assigned_to_id: formData.assigned_to?.assigned_to_id || null
    };

    await onSave(payload);
    if (!error) onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={onClose} 
        fullWidth 
        maxWidth="sm"
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ 
          m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          bgcolor: isMobile ? 'primary.main' : 'transparent',
          color: isMobile ? 'white' : 'inherit'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {editingAction ? 'Edit Action Item' : 'New Action Item'}
          </Typography>
          {isMobile && (
            <IconButton onClick={onClose} sx={{ color: 'white' }}><CloseIcon /></IconButton>
          )}
        </DialogTitle>

        {loading && <LinearProgress />}
        
        <DialogContent dividers sx={{ p: isMobile ? 2 : 3 }}>
          {(localError || error) && (
            <Alert severity="error" sx={{ mb: 2 }}>{localError || error}</Alert>
          )}
          
          {/* Stack ensures a strictly vertical, single-column layout */}
          <Stack spacing={3} sx={{ mt: 0.5 }}> 
            
            <TextField
              fullWidth
              label="Task Description"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />

            <AssignToSelector
              value={formData.assigned_to}
              onChange={(userObj) => setFormData({ ...formData, assigned_to: userObj })}
              disabled={loading}
              label="Assign To"
              meetingId={meetingId}
            />

            <DateTimePicker
              label="Due Date & Time"
              value={formData.due_date}
              onChange={(newValue) => setFormData({ ...formData, due_date: newValue })}
              // Standard restriction: User cannot pick a time in the past
              disablePast 
              // Enforce 5 mins from now to avoid immediate expiration
              minDateTime={addMinutes(new Date(), 5)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  helperText: "Must be a future date",
                },
              }}
            />

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

            <TextField
              fullWidth
              label="Remarks / Notes"
              multiline
              rows={2}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
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
            variant="contained"
            onClick={handleSave}
            disabled={loading || !formData.description.trim()}
            sx={{ order: isMobile ? 1 : 2, py: isMobile ? 1.5 : 1 }}
          >
            {editingAction ? 'Update Action' : 'Create Action'}
          </Button>
          <Button 
            fullWidth={isMobile} 
            onClick={onClose} 
            disabled={loading} 
            color="inherit"
            sx={{ order: isMobile ? 2 : 1 }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AddActionDialog;