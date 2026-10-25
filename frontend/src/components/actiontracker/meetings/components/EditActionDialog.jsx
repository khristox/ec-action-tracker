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
  Box,
  useTheme,
  alpha
} from '@mui/material';
import { 
  Close, 
  Save, 
  Assignment as AssignmentIcon,
  Edit
} from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { updateAction } from '../../../../store/slices/actionTracker/actionSlice';
import { format } from 'date-fns';

const EditActionDialog = ({ open, action, onClose, onSave }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
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
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          // Sleek, elevated dark surface instead of flat pitch black
          backgroundImage: 'none',
          bgcolor: isDarkMode ? '#111827' : 'background.paper', // Deep Slate/Midnight Blue-Gray
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
          boxShadow: isDarkMode 
            ? '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)' 
            : theme.shadows[16],
        }
      }}
    >
      <DialogTitle sx={{ pb: 1.5, pt: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700} color={isDarkMode ? '#f3f4f6' : 'text.primary'}>
            Edit Action Item
          </Typography>
          <IconButton 
            onClick={onClose} 
            size="small"
            sx={{ 
              color: isDarkMode ? 'grey.400' : 'text.secondary',
              '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
            }}
          >
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <Divider sx={{ borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'divider' }} />
      
      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Premium Information Card */}
        <Box 
          sx={{ 
            bgcolor: isDarkMode 
              ? 'rgba(30, 41, 59, 0.5)' // Elegant semi-translucent Indigo/Slate
              : '#f8fafc', 
            p: 2.5, 
            borderRadius: '12px', 
            border: '1px solid',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0', 
            mb: 4,
            boxShadow: isDarkMode ? 'inset 0 1px 1px rgba(255,255,255,0.03)' : 'none'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <AssignmentIcon 
              sx={{ 
                mt: 0.5, 
                color: isDarkMode ? '#60a5fa' : theme.palette.primary.main // Vibrant ice blue in dark mode
              }} 
            />
            <Box flex={1}>
              <Typography variant="caption" fontWeight={600} color={isDarkMode ? 'grey.400' : 'text.secondary'}>
                Current Action
              </Typography>
              <Typography 
                variant="body2" 
                fontWeight={500} 
                color={isDarkMode ? '#f3f4f6' : 'text.primary'} 
                sx={{ mt: 0.5, lineHeight: 1.6 }}
              >
                {action?.description}
              </Typography>
              
              <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap" gap={1}>
                {action?.due_date && (
                  <Typography variant="caption" color={isDarkMode ? 'grey.400' : 'text.secondary'}>
                    📅 Original Due: <strong>{format(new Date(action.due_date), 'MMM d, yyyy')}</strong>
                  </Typography>
                )}
                {action?.priority && (
                  <Typography variant="caption" color={isDarkMode ? 'grey.400' : 'text.secondary'}>
                    ⚡ Priority: <strong>{getPriorityLabel(action.priority)}</strong>
                  </Typography>
                )}
              </Stack>
            </Box>
            <Edit sx={{ color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }} fontSize="small" />
          </Stack>
        </Box>

        {/* Form Fields */}
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
            sx={{
              '& .MuiInputBase-root': {
                bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
              }
            }}
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
            sx={{
              '& .MuiInputBase-root': {
                bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
              }
            }}
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
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiInputBase-root': {
                    bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                  }
                }}
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
                  sx={{
                    bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                  }}
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
      
      <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          sx={{ 
            color: isDarkMode ? 'grey.300' : 'text.secondary',
            '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <Save />}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            bgcolor: isDarkMode ? '#3b82f6' : theme.palette.primary.main, // Premium blue accent
            '&:hover': {
              bgcolor: isDarkMode ? '#2563eb' : theme.palette.primary.dark,
            }
          }}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditActionDialog;