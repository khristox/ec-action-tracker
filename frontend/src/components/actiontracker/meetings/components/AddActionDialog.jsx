import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, LinearProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  useMediaQuery, useTheme, IconButton, Typography,
  Stack, Box, Chip, Divider
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Description as DescriptionIcon, 
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addMinutes, format } from 'date-fns';
import AssignToSelector from './AssignToSelector';

// Helper function to strip HTML tags for preview
const stripHtmlTags = (html) => {
  if (!html) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
};

// Helper to get plain text preview
const getPlainTextPreview = (html, maxLength = 100) => {
  const plainText = stripHtmlTags(html);
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength) + '...';
};

const AddActionDialog = ({ 
  open, 
  onClose, 
  onSave, 
  editingAction, 
  meetingId, 
  minutes = [],
  selectedMinuteId = null,
  loading, 
  error 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [formData, setFormData] = useState({
    description: '',
    assigned_to: null,
    due_date: null,
    priority: 2,
    remarks: '',
    minute_id: null
  });
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (open) {
      if (editingAction) {
        let parsedAssignment = null;
        
        // Parse assigned_to_name if it exists (for editing existing actions)
        if (editingAction.assigned_to_name) {
          try {
            const data = typeof editingAction.assigned_to_name === 'string' 
              ? JSON.parse(editingAction.assigned_to_name) 
              : editingAction.assigned_to_name;
            
            parsedAssignment = {
              type: data.type || 'manual',
              id: data.id,
              name: data.name || data.full_name || data.username,
              email: data.email,
              phone: data.phone || data.telephone,
              assigned_to_id: editingAction.assigned_to_id || data.id,
              assigned_to_name: data
            };
          } catch (e) {
            // If parsing fails, treat as manual entry
            parsedAssignment = {
              type: 'manual',
              id: null,
              name: editingAction.assigned_to_name,
              email: '',
              phone: '',
              assigned_to_id: null,
              assigned_to_name: { name: editingAction.assigned_to_name, type: 'manual' }
            };
          }
        } else if (editingAction.assigned_to) {
          // If assigned_to relationship is loaded
          parsedAssignment = {
            type: 'user',
            id: editingAction.assigned_to.id,
            name: editingAction.assigned_to.full_name || editingAction.assigned_to.username,
            email: editingAction.assigned_to.email,
            phone: editingAction.assigned_to.phone || editingAction.assigned_to.telephone,
            assigned_to_id: editingAction.assigned_to.id,
            assigned_to_name: {
              id: editingAction.assigned_to.id,
              name: editingAction.assigned_to.full_name || editingAction.assigned_to.username,
              email: editingAction.assigned_to.email,
              phone: editingAction.assigned_to.phone || editingAction.assigned_to.telephone,
              type: 'user'
            }
          };
        }

        setFormData({
          description: editingAction.description || '',
          assigned_to: parsedAssignment,
          due_date: editingAction.due_date ? new Date(editingAction.due_date) : null,
          priority: editingAction.priority || 2,
          remarks: editingAction.remarks || '',
          minute_id: editingAction.minute_id || null
        });
      } else {
        // For new actions, use the selected minute if provided
        setFormData({
          description: '',
          assigned_to: null,
          due_date: null,
          priority: 2,
          remarks: '',
          minute_id: selectedMinuteId || null
        });
      }
    }
  }, [editingAction, open, selectedMinuteId]);

  const handleSave = async () => {
    if (!formData.description.trim()) {
      setLocalError("Description is required");
      return;
    }
    
    // Check if minute is selected for new action
    if (!editingAction && !formData.minute_id) {
      setLocalError("Please select a minute to associate this action with");
      return;
    }
    
    // Check for due date in the future
    if (formData.due_date && formData.due_date < new Date()) {
      setLocalError("Due date must be in the future");
      return;
    }

    setLocalError(null);

    // Build the payload with proper assigned_to structure
    let assignedToName = null;
    let assignedToId = null;

    if (formData.assigned_to) {
      if (formData.assigned_to.type === 'user' && formData.assigned_to.id) {
        // System user - save assigned_to_id and create proper assigned_to_name object
        assignedToId = formData.assigned_to.id;
        assignedToName = {
          id: formData.assigned_to.id,
          name: formData.assigned_to.name,
          email: formData.assigned_to.email || '',
          phone: formData.assigned_to.phone || '',
          type: 'user'
        };
      } else if (formData.assigned_to.type === 'manual') {
        // Manual entry - save only assigned_to_name with full details
        assignedToName = {
          name: formData.assigned_to.name,
          email: formData.assigned_to.email || '',
          phone: formData.assigned_to.phone || '',
          type: 'manual'
        };
        assignedToId = null;
      } else if (formData.assigned_to.assigned_to_name) {
        // Handle the structure from AssignToSelector
        const assignedData = formData.assigned_to.assigned_to_name;
        assignedToName = assignedData;
        assignedToId = formData.assigned_to.assigned_to_id || (assignedData.type === 'user' ? assignedData.id : null);
      } else {
        // Fallback - just use the object as is
        assignedToName = {
          name: formData.assigned_to.name || formData.assigned_to.full_name,
          email: formData.assigned_to.email,
          phone: formData.assigned_to.phone || formData.assigned_to.telephone,
          type: formData.assigned_to.type || 'manual'
        };
        assignedToId = formData.assigned_to.id || (formData.assigned_to.type === 'user' ? formData.assigned_to.id : null);
      }
    }

    const payload = {
      description: formData.description.trim(),
      due_date: formData.due_date ? formData.due_date.toISOString() : null,
      priority: formData.priority,
      remarks: formData.remarks || '',
      minute_id: formData.minute_id,
      assigned_to_id: assignedToId,
      assigned_to_name: assignedToName
    };

    await onSave(payload);
    if (!error) onClose();
  };

  // Get the selected minute details for display
  const getSelectedMinuteDetails = () => {
    if (!formData.minute_id) return null;
    const minute = minutes.find(m => m.id === formData.minute_id);
    if (!minute) return null;
    return minute;
  };

  const selectedMinute = getSelectedMinuteDetails();

  // Get minute preview text
  const getMinutePreview = (minute) => {
    if (minute.topic) return minute.topic;
    if (minute.title) return minute.title;
    if (minute.minute_text) return getPlainTextPreview(minute.minute_text, 80);
    if (minute.discussion) return getPlainTextPreview(minute.discussion, 80);
    return 'Untitled Minute';
  };

  // Get action count display
  const getActionCountDisplay = (minute) => {
    const count = minute.actions?.length || 0;
    if (count === 0) return 'No actions';
    return `${count} action${count !== 1 ? 's' : ''}`;
  };

  // Get completion status
  const getCompletionStatus = (minute) => {
    const actions = minute.actions || [];
    if (actions.length === 0) return null;
    const completed = actions.filter(a => a.completed_at || a.overall_progress_percentage >= 100).length;
    return `${completed}/${actions.length} completed`;
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
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLocalError(null)}>
              {localError || error}
            </Alert>
          )}
          
          <Stack spacing={3} sx={{ mt: 0.5 }}>
            
            {/* Minute Selection - Only show for new actions */}
            {!editingAction && (
              <>
                {minutes.length === 0 ? (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      No minutes available for this meeting.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Please add minutes to the meeting first before creating action items.
                    </Typography>
                  </Alert>
                ) : (
                  <FormControl fullWidth required>
                    <InputLabel>Associated Minute *</InputLabel>
                    <Select
                      value={formData.minute_id || ''}
                      onChange={(e) => setFormData({ ...formData, minute_id: e.target.value })}
                      label="Associated Minute *"
                      renderValue={(selected) => {
                        const minute = minutes.find(m => m.id === selected);
                        if (!minute) return "Select a minute";
                        return (
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <DescriptionIcon fontSize="small" color="primary" />
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {getMinutePreview(minute)}
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="caption" color="text.secondary">
                                  {format(new Date(minute.created_at), 'MMM d, yyyy')}
                                </Typography>
                                <Chip 
                                  label={getActionCountDisplay(minute)} 
                                  size="small" 
                                  variant="outlined"
                                />
                              </Stack>
                            </Box>
                          </Stack>
                        );
                      }}
                      MenuProps={{
                        PaperProps: {
                          style: {
                            maxHeight: 400,
                          },
                        },
                      }}
                    >
                      {minutes.map((minute) => {
                        const actionCount = minute.actions?.length || 0;
                        const completionStatus = getCompletionStatus(minute);
                        const discussionPreview = getPlainTextPreview(minute.discussion, 120);
                        const decisionsPreview = getPlainTextPreview(minute.decisions, 100);
                        
                        return (
                          <MenuItem key={minute.id} value={minute.id}>
                            <Stack spacing={1} sx={{ width: '100%', py: 0.5 }}>
                              {/* Header */}
                              <Stack direction="row" spacing={1.5} alignItems="center">
                                <DescriptionIcon fontSize="small" color="primary" />
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {minute.topic || minute.title || 'Untitled Minute'}
                                </Typography>
                              </Stack>
                              
                              {/* Metadata */}
                              <Stack direction="row" spacing={2} alignItems="center" sx={{ ml: 4 }}>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <AccessTimeIcon fontSize="small" color="action" sx={{ fontSize: 14 }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {format(new Date(minute.created_at), 'MMM d, yyyy')}
                                  </Typography>
                                </Stack>
                                
                                <Chip 
                                  label={`${actionCount} action${actionCount !== 1 ? 's' : ''}`} 
                                  size="small" 
                                  variant="outlined"
                                />
                                
                                {completionStatus && (
                                  <Chip 
                                    label={completionStatus} 
                                    size="small" 
                                    color={completionStatus.includes('completed') ? 'success' : 'default'}
                                    variant="outlined"
                                  />
                                )}
                              </Stack>
                              
                              {/* Discussion Preview */}
                              {discussionPreview && (
                                <Box sx={{ ml: 4, mt: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    <strong>Discussion:</strong> {discussionPreview}
                                  </Typography>
                                </Box>
                              )}
                              
                              {/* Decisions Preview */}
                              {decisionsPreview && decisionsPreview !== '<p></p>' && (
                                <Box sx={{ ml: 4 }}>
                                  <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                                    <strong>Decisions:</strong> {decisionsPreview}
                                  </Typography>
                                </Box>
                              )}
                              
                              <Divider sx={{ mt: 1 }} />
                            </Stack>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                )}
              </>
            )}

            {/* Display selected minute for editing */}
            {editingAction && selectedMinute && (
              <Box sx={{ 
                p: 2, 
                bgcolor: '#f5f5f5', 
                borderRadius: 2,
                border: '1px solid #e0e0e0'
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <DescriptionIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Associated Minute:
                  </Typography>
                </Stack>
                
                <Stack spacing={1} sx={{ ml: 4 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {selectedMinute.topic || selectedMinute.title || 'Untitled Minute'}
                  </Typography>
                  
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      Created: {format(new Date(selectedMinute.created_at), 'MMM d, yyyy')}
                    </Typography>
                    <Chip 
                      label={`${selectedMinute.actions?.length || 0} actions`} 
                      size="small" 
                      variant="outlined"
                    />
                  </Stack>
                  
                  {selectedMinute.discussion && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        <strong>Discussion preview:</strong>
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {getPlainTextPreview(selectedMinute.discussion, 150)}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            {/* Show warning if minute not found for editing */}
            {editingAction && formData.minute_id && !selectedMinute && (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Associated minute not found. The minute may have been deleted.
              </Alert>
            )}

            <TextField
              fullWidth
              label="Task Description *"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              placeholder="Describe the action item in detail..."
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
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                label="Priority"
              >
                <MenuItem value={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>🔴</span>
                    <span>High - Urgent</span>
                  </Stack>
                </MenuItem>
                <MenuItem value={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>🟠</span>
                    <span>Medium - Normal</span>
                  </Stack>
                </MenuItem>
                <MenuItem value={3}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>🟢</span>
                    <span>Low - Flexible</span>
                  </Stack>
                </MenuItem>
                <MenuItem value={4}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>⚪</span>
                    <span>Very Low - Info Only</span>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Remarks / Notes"
              multiline
              rows={2}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Additional notes or context for this action item..."
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
            disabled={loading || !formData.description.trim() || (!editingAction && minutes.length > 0 && !formData.minute_id)}
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