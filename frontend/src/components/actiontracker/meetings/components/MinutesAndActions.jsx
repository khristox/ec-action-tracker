// MinutesAndActions.jsx - Improved with action editing
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Box, Button, Alert, Collapse, Snackbar, 
  ToggleButtonGroup, ToggleButton, Typography, Stack, Fade, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, LinearProgress,
  IconButton  // Add this import
} from '@mui/material';

import { 
  Add as AddIcon, 
  Visibility as AllIcon,
  CheckCircleOutline as ActiveIcon,
  DoNotDisturbOn as InactiveIcon,
  EventNote as NoteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addMinutes } from 'date-fns';
import api from '../../../../services/api';
import MinutesList from './MinutesList';
import CombinedMinutesActionsForm from './CombinedMinutesActionsForm';
import AssignToSelector from './AssignToSelector';

const MinutesAndActions = ({ minutes: initialMinutes, meetingId, meetingStatus, onUpdate }) => {
  const isStarted = meetingStatus?.toLowerCase().endsWith('started');
  const [filter, setFilter] = useState('active');
  const [formOpen, setFormOpen] = useState(false);
  const [editingMinutes, setEditingMinutes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [minutesWithActions, setMinutesWithActions] = useState([]);
  const [loadingActions, setLoadingActions] = useState(false);
  
  // Action dialog state
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [selectedMinuteId, setSelectedMinuteId] = useState(null);
  const [actionFormData, setActionFormData] = useState({
    description: '',
    assigned_to: null,
    due_date: null,
    priority: 2,
    remarks: ''
  });
  const [actionError, setActionError] = useState(null);
  const [savingAction, setSavingAction] = useState(false);

  // Fetch actions for a specific minute
  const fetchActionsForMinute = useCallback(async (minuteId) => {
    try {
      const response = await api.get(`/action-tracker/minutes/${minuteId}/actions`);
      const actions = response.data.data || response.data || [];
      return actions;
    } catch (err) {
      console.error(`Error fetching actions for minute ${minuteId}:`, err);
      return [];
    }
  }, []);

  // Load minutes with their actions
  const loadMinutesWithActions = useCallback(async () => {
    if (!initialMinutes || initialMinutes.length === 0) {
      setMinutesWithActions([]);
      return;
    }

    setLoadingActions(true);
    try {
      const minutesWithActionsData = await Promise.all(
        initialMinutes.map(async (minute) => {
          const actions = await fetchActionsForMinute(minute.id);
          return {
            ...minute,
            actions: actions || []
          };
        })
      );
      setMinutesWithActions(minutesWithActionsData);
    } catch (err) {
      console.error('Error loading minutes with actions:', err);
      setMinutesWithActions(initialMinutes.map(m => ({ ...m, actions: [] })));
    } finally {
      setLoadingActions(false);
    }
  }, [initialMinutes, fetchActionsForMinute]);

  useEffect(() => {
    loadMinutesWithActions();
  }, [loadMinutesWithActions]);

  const handleRefresh = useCallback(async () => {
    if (onUpdate) {
      await onUpdate();
      setTimeout(() => {
        loadMinutesWithActions();
      }, 500);
    }
  }, [onUpdate, loadMinutesWithActions]);

  const filteredMinutes = useMemo(() => {
    if (!minutesWithActions || minutesWithActions.length === 0) return [];
    if (filter === 'all') return minutesWithActions;
    return minutesWithActions.filter(m => {
      const isActive = m.is_active !== false;
      return filter === 'active' ? isActive : !isActive;
    });
  }, [minutesWithActions, filter]);

  const handleOpenForm = (minutesData = null) => {
    if (minutesData) {
      const loadMinuteWithActions = async () => {
        setLoading(true);
        const actions = await fetchActionsForMinute(minutesData.id);
        setEditingMinutes({
          ...minutesData,
          actions: actions
        });
        setFormOpen(true);
        setLoading(false);
      };
      loadMinuteWithActions();
    } else {
      setEditingMinutes(null);
      setFormOpen(true);
    }
  };

  // Handle editing an action
  const handleEditAction = useCallback((minuteId, action) => {
    setSelectedMinuteId(minuteId);
    setEditingAction(action);
    setActionFormData({
      description: action.description || '',
      assigned_to: action.assigned_to_name ? {
        assigned_to_id: action.assigned_to_id,
        assigned_to_name: action.assigned_to_name
      } : null,
      due_date: action.due_date ? new Date(action.due_date) : null,
      priority: action.priority || 2,
      remarks: action.remarks || ''
    });
    setActionError(null);
    setActionDialogOpen(true);
  }, []);

  // Handle adding a new action
  const handleAddAction = useCallback((minuteId) => {
    setSelectedMinuteId(minuteId);
    setEditingAction(null);
    setActionFormData({
      description: '',
      assigned_to: null,
      due_date: null,
      priority: 2,
      remarks: ''
    });
    setActionError(null);
    setActionDialogOpen(true);
  }, []);

  // Handle saving action (create or update)
  const handleSaveAction = async () => {
    if (!actionFormData.description.trim()) {
      setActionError("Description is required");
      return;
    }
    
    if (actionFormData.due_date && actionFormData.due_date < new Date()) {
      setActionError("Due date must be in the future");
      return;
    }

    setSavingAction(true);
    setActionError(null);
    
    try {
      const payload = {
        description: actionFormData.description.trim(),
        assigned_to_name: actionFormData.assigned_to?.assigned_to_name || null,
        assigned_to_id: actionFormData.assigned_to?.assigned_to_id || null,
        priority: actionFormData.priority,
        due_date: actionFormData.due_date ? actionFormData.due_date.toISOString() : null,
        remarks: actionFormData.remarks || ''
      };

      if (editingAction) {
        // Update existing action
        await api.put(`/action-tracker/actions/${editingAction.id}`, payload);
        setSuccessMsg('Action updated successfully');
      } else {
        // Create new action
        await api.post(`/action-tracker/actions/minutes/${selectedMinuteId}/actions`, payload);
        setSuccessMsg('Action added successfully');
      }
      
      handleRefresh();
      setActionDialogOpen(false);
      setEditingAction(null);
      setSelectedMinuteId(null);
    } catch (err) {
      console.error('Save action failed', err);
      setActionError(err.response?.data?.detail || 'Failed to save action');
    } finally {
      setSavingAction(false);
    }
  };

  const handleSaveCombined = async (data) => {
    setLoading(true);
    setError(null);
    
    try {
      if (editingMinutes) {
        await api.put(`/action-tracker/minutes/${editingMinutes.id}`, {
          topic: data.minutes.topic,
          content: data.minutes.content,
          summary: data.minutes.summary
        });
        
        for (const action of data.actions) {
          if (action.id && !action.isNew) {
            await api.put(`/action-tracker/actions/${action.id}`, {
              description: action.description,
              assigned_to_name: action.assigned_to?.assigned_to_name || null,
              assigned_to_id: action.assigned_to?.assigned_to_id || null,
              priority: action.priority,
              due_date: action.due_date ? new Date(action.due_date).toISOString() : null,
              remarks: action.remarks || ''
            });
          } else if (action.description) {
            await api.post(`/action-tracker/actions/minutes/${editingMinutes.id}/actions`, {
              description: action.description,
              assigned_to_name: action.assigned_to?.assigned_to_name || null,
              assigned_to_id: action.assigned_to?.assigned_to_id || null,
              priority: action.priority,
              due_date: action.due_date ? new Date(action.due_date).toISOString() : null,
              remarks: action.remarks || ''
            });
          }
        }
        setSuccessMsg('Minutes and actions updated successfully');
      } else {
        const minutesResponse = await api.post(`/action-tracker/meetings/${meetingId}/minutes`, {
          topic: data.minutes.topic,
          content: data.minutes.content,
          summary: data.minutes.summary
        });
        const newMinutesId = minutesResponse.data.id;
        
        if (data.actions.length > 0) {
          const actionPromises = data.actions.map(action =>
            api.post(`/action-tracker/actions/minutes/${newMinutesId}/actions`, {
              description: action.description,
              assigned_to_name: action.assigned_to?.assigned_to_name || null,
              assigned_to_id: action.assigned_to?.assigned_to_id || null,
              priority: action.priority,
              due_date: action.due_date ? new Date(action.due_date).toISOString() : null,
              remarks: action.remarks || ''
            })
          );
          await Promise.all(actionPromises);
        }
        setSuccessMsg(`Minutes and ${data.actions.length} action(s) added successfully`);
      }
      
      handleRefresh();
      setFormOpen(false);
      setEditingMinutes(null);
    } catch (err) {
      console.error('Save failed', err);
      setError(err.response?.data?.detail || 'Failed to save minutes and actions');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMinutes = async (minuteId) => {
    if (!window.confirm("Are you sure? This will deactivate these minutes.")) return;
    setLoading(true);
    try {
      await api.delete(`/action-tracker/minutes/${minuteId}`);
      setSuccessMsg("Minutes deactivated");
      handleRefresh();
    } catch (err) {
      setError("Failed to delete minutes.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMinutes = async (minute) => {
    // Optional: Implement copy functionality
    console.log('Copy minutes:', minute);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 2 }}>
        <Collapse in={!!error}>
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        </Collapse>

        {/* Header */}
        <Stack 
          direction={{ xs: 'column', md: 'row' }} 
          justifyContent="space-between" 
          alignItems={{ xs: 'flex-start', md: 'flex-end' }} 
          spacing={2} 
          mb={4}
        >
          <Box>
            <Typography variant="overline" sx={{ fontWeight: 'bold', color: 'text.secondary', ml: 0.5 }}>
              Filter Records
            </Typography>
            <ToggleButtonGroup
              value={filter}
              exclusive
              onChange={(e, next) => next && setFilter(next)}
              size="small"
              color="primary"
              sx={{ display: 'flex', bgcolor: 'background.paper' }}
            >
              <ToggleButton value="active" sx={{ px: 3, textTransform: 'none' }}>
                <ActiveIcon fontSize="inherit" sx={{ mr: 1 }} /> Active
              </ToggleButton>
              <ToggleButton value="inactive" sx={{ px: 3, textTransform: 'none' }}>
                <InactiveIcon fontSize="inherit" sx={{ mr: 1 }} /> Inactive
              </ToggleButton>
              <ToggleButton value="all" sx={{ px: 3, textTransform: 'none' }}>
                <AllIcon fontSize="inherit" sx={{ mr: 1 }} /> All
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {isStarted ? (
            <Fade in={isStarted}>
              <Button 
                variant="contained" 
                startIcon={<AddIcon />} 
                onClick={() => handleOpenForm()} 
                disabled={loading}
                sx={{ 
                  borderRadius: 2.5, 
                  px: 4, 
                  height: 42, 
                  boxShadow: 2,
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                Add Minutes & Actions
              </Button>
            </Fade>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', pr: 1 }}>
              <NoteIcon fontSize="small" />
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                Add Minutes is enabled when the meeting is <strong>Started</strong>.
              </Typography>
            </Box>
          )}
        </Stack>

        {/* Loading indicator for actions */}
        {loadingActions && (
          <Box display="flex" justifyContent="center" alignItems="center" my={4}>
            <CircularProgress size={32} />
            <Typography variant="body2" sx={{ ml: 2 }}>Loading actions...</Typography>
          </Box>
        )}

        {/* Minutes List Component */}
        {!loadingActions && (
          <MinutesList
            minutes={filteredMinutes}
            onEditMinutes={handleOpenForm}
            onDeleteMinutes={handleDeleteMinutes}
            onAddAction={handleAddAction}
            onEditAction={handleEditAction}
            onCopyMinutes={handleCopyMinutes}
            onUpdate={handleRefresh}
            loading={loading}
            isMeetingStarted={isStarted}
          />
        )}

        {/* Combined Form Dialog */}
        <CombinedMinutesActionsForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingMinutes(null);
          }}
          onSave={handleSaveCombined}
          meetingId={meetingId}
          editingMinutes={editingMinutes}
          loading={loading}
        />

        {/* Action Dialog for Create/Edit */}
        <Dialog 
          open={actionDialogOpen} 
          onClose={() => setActionDialogOpen(false)} 
          maxWidth="sm" 
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            pb: 1
          }}>
            <Typography variant="h6" fontWeight={700}>
              {editingAction ? 'Edit Action Item' : 'Add Action Item'}
            </Typography>
            <IconButton onClick={() => setActionDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          {savingAction && <LinearProgress />}
          
          <DialogContent dividers>
            {actionError && (
              <Alert severity="error" sx={{ mb: 2, mt: 1 }} onClose={() => setActionError(null)}>
                {actionError}
              </Alert>
            )}
            
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Task Description *"
                multiline
                rows={3}
                value={actionFormData.description}
                onChange={(e) => setActionFormData(prev => ({ ...prev, description: e.target.value }))}
                required
                placeholder="Describe the action item..."
              />
              
              <AssignToSelector
                value={actionFormData.assigned_to}
                onChange={(userObj) => setActionFormData(prev => ({ ...prev, assigned_to: userObj }))}
                disabled={savingAction}
                label="Assign To"
                meetingId={meetingId}
              />
              
              <DateTimePicker
                label="Due Date & Time"
                value={actionFormData.due_date}
                onChange={(newValue) => setActionFormData(prev => ({ ...prev, due_date: newValue }))}
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
                  value={actionFormData.priority}
                  onChange={(e) => setActionFormData(prev => ({ ...prev, priority: e.target.value }))}
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
                value={actionFormData.remarks}
                onChange={(e) => setActionFormData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Additional notes or comments..."
              />
            </Stack>
          </DialogContent>
          
          <DialogActions sx={{ p: 2.5, gap: 1 }}>
            <Button onClick={() => setActionDialogOpen(false)} disabled={savingAction}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSaveAction}
              disabled={savingAction || !actionFormData.description.trim()}
            >
              {savingAction ? 'Saving...' : editingAction ? 'Update Action' : 'Create Action'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Notifications */}
        <Snackbar 
          open={!!successMsg} 
          autoHideDuration={4000} 
          onClose={() => setSuccessMsg(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="success" variant="filled" sx={{ width: '100%', borderRadius: 2 }}>
            {successMsg}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default MinutesAndActions;