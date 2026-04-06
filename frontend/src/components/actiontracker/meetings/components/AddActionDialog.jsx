import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, LinearProgress, Alert,
  Grid, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import AssignToSelector from './AssignToSelector';

const AddActionDialog = ({ open, onClose, onSave, editingAction, meetingId, loading, error }) => {
  const [formData, setFormData] = useState({
    description: '',
    assigned_to: null,
    due_date: null,
    priority: 2,
    remarks: ''
  });
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (editingAction) {
      setFormData({
        description: editingAction.description || '',
        assigned_to: editingAction.assigned_to_id ? {
          type: 'user',
          id: editingAction.assigned_to_id,
          name: editingAction.assigned_to_name,
          assigned_to_id: editingAction.assigned_to_id,
          assigned_to_name: editingAction.assigned_to_name
        } : (editingAction.assigned_to_name ? {
          type: 'manual',
          name: editingAction.assigned_to_name,
          assigned_to_name: editingAction.assigned_to_name
        } : null),
        due_date: editingAction.due_date || null,
        priority: editingAction.priority || 2,
        remarks: editingAction.remarks || ''
      });
    } else {
      setFormData({
        description: '',
        assigned_to: null,
        due_date: null,
        priority: 2,
        remarks: ''
      });
    }
  }, [editingAction, open]);

  const handleSave = async () => {
    if (!formData.description.trim()) {
      setLocalError("Description is required");
      return;
    }
    setLocalError(null);

    const payload = {
      description: formData.description.trim(),
      due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      priority: formData.priority,
      remarks: formData.remarks || ''
    };

    // Handle assignment based on selection type
    if (formData.assigned_to) {
      if (formData.assigned_to.type === 'user' && formData.assigned_to.assigned_to_id) {
        payload.assigned_to_id = formData.assigned_to.assigned_to_id;
        payload.assigned_to_name = formData.assigned_to.name;
      } else if (formData.assigned_to.type === 'participant') {
        payload.assigned_to_name = formData.assigned_to.name;
      } else {
        payload.assigned_to_name = formData.assigned_to.name;
      }
    }

    await onSave(payload);
    if (!error) {
      setFormData({
        description: '',
        assigned_to: null,
        due_date: null,
        priority: 2,
        remarks: ''
      });
    }
  };

  const displayError = localError || error;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editingAction ? 'Edit Action' : 'Add Action'}</DialogTitle>
      {loading && <LinearProgress />}
      <DialogContent>
        {displayError && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }} onClose={() => setLocalError(null)}>
            {displayError}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              error={!!localError && !formData.description}
            />
          </Grid>
          <Grid item xs={12}>
            <AssignToSelector
              value={formData.assigned_to}
              onChange={(user) => setFormData({ ...formData, assigned_to: user })}
              disabled={loading}
              label="Assign To"
              meetingId={meetingId}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="datetime-local"
              label="Due Date"
              value={formData.due_date ? new Date(formData.due_date).toISOString().slice(0, 16) : ''}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                label="Priority"
              >
                <MenuItem value={1}>🔴 High - Due within 3 days</MenuItem>
                <MenuItem value={2}>🟠 Medium - Due within 7 days</MenuItem>
                <MenuItem value={3}>🟢 Low - Due within 14 days</MenuItem>
                <MenuItem value={4}>⚪ Very Low - No strict deadline</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Remarks"
              multiline
              rows={2}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || !formData.description.trim()}
        >
          {editingAction ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddActionDialog;