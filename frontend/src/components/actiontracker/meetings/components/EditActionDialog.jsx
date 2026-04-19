import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Box
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Save as SaveIcon, 
  Assignment as AssignmentIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { updateAction } from '../../../../store/slices/actionTracker/actionSlice';
import { format } from 'date-fns';

const EditActionDialog = ({ open, action, onClose, onSave }) => {
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    description: '',
    remarks: '',
    due_date: '',
    priority: 2
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (action && open) {
      setFormData({
        description: action.description || '',
        remarks: action.remarks || '',
        due_date: action.due_date ? format(new Date(action.due_date), 'yyyy-MM-dd') : '',
        priority: action.priority || 2
      });
    }
  }, [action, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        description: formData.description,
        remarks: formData.remarks,
        due_date: formData.due_date || null,
        priority: parseInt(formData.priority)
      };

      await dispatch(updateAction({ 
        id: action.id, 
        actionData: payload 
      })).unwrap();
      
      if (onSave) onSave();
      onClose();
    } catch (err) {
      console.error('Error updating action:', err);
      setError(err.message || 'Failed to update action');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      1: '🔴 High - Urgent',
      2: '🟠 Medium - Normal',
      3: '🟢 Low - Flexible',
      4: '⚪ Very Low - Info Only'
    };
    return labels[priority] || labels[2];
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700}>
            Edit Action Item
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Current Action Card */}
        <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 2, border: '1px solid #e2e8f0', mb: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <AssignmentIcon color="primary" sx={{ mt: 0.5 }} />
            <Box flex={1}>
              <Typography variant="caption" color="text.secondary">
                Current Action
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {action?.description}
              </Typography>
              {action?.due_date && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Original Due: {format(new Date(action.due_date), 'MMM d, yyyy')}
                </Typography>
              )}
              {action?.priority && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Current Priority: {getPriorityLabel(action.priority)}
                </Typography>
              )}
            </Box>
            <EditIcon color="action" fontSize="small" />
          </Stack>
        </Box>

        <Stack spacing={3}>
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            multiline
            rows={3}
            placeholder="Update action description..."
          />

          <TextField
            fullWidth
            label="Remarks / Notes"
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            multiline
            rows={2}
            placeholder="Update remarks..."
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Due Date"
                name="due_date"
                type="date"
                value={formData.due_date}
                onChange={handleChange}
                helperText="Select new due date (optional)"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  label="Priority"
                >
                  <MenuItem value={1}>🔴 High - Urgent</MenuItem>
                  <MenuItem value={2}>🟠 Medium - Normal</MenuItem>
                  <MenuItem value={3}>🟢 Low - Flexible</MenuItem>
                  <MenuItem value={4}>⚪ Very Low - Info Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, pt: 0 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditActionDialog;