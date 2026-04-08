// CombinedMinutesActionsForm.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, IconButton, 
  Divider, Alert, Stack, Paper, CircularProgress, LinearProgress,
  FormControl, InputLabel, Select, MenuItem,
  useMediaQuery, useTheme, Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  Close as CloseIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addMinutes } from 'date-fns';
import AssignToSelector from './AssignToSelector';

const CombinedMinutesActionsForm = ({ 
  open, 
  onClose, 
  onSave, 
  meetingId, 
  editingMinutes = null,
  loading = false 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [formData, setFormData] = useState({
    minutes: {
      topic: editingMinutes?.topic || editingMinutes?.title || '',
      content: editingMinutes?.content || '',
      summary: editingMinutes?.summary || ''
    },
    actions: editingMinutes?.actions || []
  });

  const [newAction, setNewAction] = useState({
    description: '',
    assigned_to: null,
    due_date: null,
    priority: 2,
    remarks: ''
  });

  const [editingActionIndex, setEditingActionIndex] = useState(null);
  const [showActionForm, setShowActionForm] = useState(false);
  const [errors, setErrors] = useState({});
  const [actionError, setActionError] = useState(null);

  // Add or update action
  const handleSaveAction = () => {
    if (!newAction.description.trim()) {
      setActionError("Description is required");
      return;
    }
    
    if (newAction.due_date && newAction.due_date < new Date()) {
      setActionError("Due date must be in the future");
      return;
    }

    setActionError(null);

    if (editingActionIndex !== null) {
      // Update existing action
      setFormData(prev => ({
        ...prev,
        actions: prev.actions.map((action, idx) => 
          idx === editingActionIndex ? { ...newAction, id: action.id } : action
        )
      }));
      setEditingActionIndex(null);
    } else {
      // Add new action
      setFormData(prev => ({
        ...prev,
        actions: [...prev.actions, { ...newAction, id: Date.now() }]
      }));
    }
    
    // Reset action form
    setNewAction({
      description: '',
      assigned_to: null,
      due_date: null,
      priority: 2,
      remarks: ''
    });
    setShowActionForm(false);
  };

  const handleEditAction = (index) => {
    const action = formData.actions[index];
    setNewAction({
      description: action.description || '',
      assigned_to: action.assigned_to || null,
      due_date: action.due_date || null,
      priority: action.priority || 2,
      remarks: action.remarks || ''
    });
    setEditingActionIndex(index);
    setShowActionForm(true);
  };

  const handleRemoveAction = (index) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const handleCancelAction = () => {
    setNewAction({
      description: '',
      assigned_to: null,
      due_date: null,
      priority: 2,
      remarks: ''
    });
    setEditingActionIndex(null);
    setShowActionForm(false);
    setActionError(null);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.minutes.topic.trim()) {
      newErrors.minutesTopic = 'Topic is required';
    }
    if (!formData.minutes.content.trim()) {
      newErrors.minutesContent = 'Minutes content is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    const submitData = {
      minutes: {
        topic: formData.minutes.topic,
        content: formData.minutes.content,
        summary: formData.minutes.summary
      },
      actions: formData.actions.map(action => ({
        description: action.description,
        assigned_to_name: action.assigned_to?.assigned_to_name || null,
        assigned_to_id: action.assigned_to?.assigned_to_id || null,
        priority: action.priority,
        due_date: action.due_date ? action.due_date.toISOString() : null,
        remarks: action.remarks || ''
      }))
    };

    await onSave(submitData);
  };

  const getPriorityLabel = (priority) => {
    switch(priority) {
      case 1: return '🔴 High';
      case 2: return '🟠 Medium';
      case 3: return '🟢 Low';
      case 4: return '⚪ Very Low';
      default: return '🟠 Medium';
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={onClose} 
        fullWidth 
        maxWidth="md"
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ 
          m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          bgcolor: isMobile ? 'primary.main' : 'transparent',
          color: isMobile ? 'white' : 'inherit'
        }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DescriptionIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {editingMinutes ? 'Edit Minutes & Actions' : 'Add Minutes & Actions'}
            </Typography>
          </Stack>
          {isMobile && (
            <IconButton onClick={onClose} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        
        {loading && <LinearProgress />}
        
        <DialogContent dividers sx={{ p: isMobile ? 2 : 3 }}>
          {/* Minutes Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2} color="primary.main">
              Minutes Details
            </Typography>
            
            <TextField
              fullWidth
              label="Topic *"
              value={formData.minutes.topic}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                minutes: { ...prev.minutes, topic: e.target.value }
              }))}
              error={!!errors.minutesTopic}
              helperText={errors.minutesTopic}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Minutes Content *"
              value={formData.minutes.content}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                minutes: { ...prev.minutes, content: e.target.value }
              }))}
              error={!!errors.minutesContent}
              helperText={errors.minutesContent}
              multiline
              rows={8}
              placeholder="Write the meeting minutes here..."
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Summary (Optional)"
              value={formData.minutes.summary}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                minutes: { ...prev.minutes, summary: e.target.value }
              }))}
              multiline
              rows={2}
              placeholder="Brief summary of the minutes..."
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Actions Section */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                Action Items
              </Typography>
              {!showActionForm && (
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setShowActionForm(true)}
                  size="small"
                  variant="outlined"
                >
                  Add Action
                </Button>
              )}
            </Stack>
            
            {/* Existing Actions List */}
            {formData.actions.length > 0 && (
              <Box sx={{ mb: 3 }}>
                {formData.actions.map((action, index) => (
                  <Paper 
                    key={action.id || index} 
                    variant="outlined" 
                    sx={{ p: 2, mb: 2, borderRadius: 2 }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                          {action.description}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" gap={1}>
                          <Chip 
                            label={getPriorityLabel(action.priority)} 
                            size="small"
                            color={action.priority === 1 ? 'error' : action.priority === 2 ? 'warning' : 'default'}
                          />
                          {action.assigned_to && (
                            <Chip 
                              label={`Assigned: ${action.assigned_to.name || action.assigned_to.assigned_to_name?.name || 'User'}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {action.due_date && (
                            <Chip 
                              label={`Due: ${new Date(action.due_date).toLocaleDateString()}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                        {action.remarks && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Note: {action.remarks}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <IconButton size="small" onClick={() => handleEditAction(index)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleRemoveAction(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            )}
            
            {/* Add/Edit Action Form */}
            {showActionForm && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" fontWeight={600} mb={2}>
                  {editingActionIndex !== null ? 'Edit Action Item' : 'New Action Item'}
                </Typography>
                
                {actionError && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
                    {actionError}
                  </Alert>
                )}
                
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Task Description *"
                    multiline
                    rows={2}
                    value={newAction.description}
                    onChange={(e) => setNewAction(prev => ({ ...prev, description: e.target.value }))}
                    required
                  />

                  <AssignToSelector
                    value={newAction.assigned_to}
                    onChange={(userObj) => setNewAction(prev => ({ ...prev, assigned_to: userObj }))}
                    disabled={loading}
                    label="Assign To"
                    meetingId={meetingId}
                  />

                  <DateTimePicker
                    label="Due Date & Time"
                    value={newAction.due_date}
                    onChange={(newValue) => setNewAction(prev => ({ ...prev, due_date: newValue }))}
                    disablePast 
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
                      value={newAction.priority}
                      onChange={(e) => setNewAction(prev => ({ ...prev, priority: e.target.value }))}
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
                    value={newAction.remarks}
                    onChange={(e) => setNewAction(prev => ({ ...prev, remarks: e.target.value }))}
                  />
                </Stack>
                
                <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    onClick={handleSaveAction}
                    disabled={loading || !newAction.description.trim()}
                    size="small"
                  >
                    {editingActionIndex !== null ? 'Update Action' : 'Add Action'}
                  </Button>
                  <Button onClick={handleCancelAction} disabled={loading} size="small">
                    Cancel
                  </Button>
                </Stack>
              </Paper>
            )}
            
            {formData.actions.length === 0 && !showActionForm && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No action items added yet. Click "Add Action" to create one.
              </Alert>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ 
          p: 2, 
          flexDirection: isMobile ? 'column' : 'row',
          gap: 1
        }}>
          <Button
            fullWidth={isMobile}
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || (!formData.minutes.topic.trim() || !formData.minutes.content.trim())}
            sx={{ order: isMobile ? 1 : 2, py: isMobile ? 1.5 : 1 }}
          >
            {loading ? 'Saving...' : editingMinutes ? 'Update Minutes & Actions' : 'Save Minutes & Actions'}
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

export default CombinedMinutesActionsForm;