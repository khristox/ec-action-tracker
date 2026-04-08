// MinutesAndActions.jsx - Complete working version
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Box, Button, Alert, Collapse, Snackbar, 
  ToggleButtonGroup, ToggleButton, Typography, Stack, Fade, CircularProgress
} from '@mui/material';
import { 
  Add as AddIcon, 
  Visibility as AllIcon,
  CheckCircleOutline as ActiveIcon,
  DoNotDisturbOn as InactiveIcon,
  EventNote as NoteIcon
} from '@mui/icons-material';
import api from '../../../../services/api';
import MinutesList from './MinutesList';
import CombinedMinutesActionsForm from './CombinedMinutesActionsForm';

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

  // Fetch actions for a specific minute
  const fetchActionsForMinute = useCallback(async (minuteId) => {
    try {
      const response = await api.get(`/action-tracker/minutes/${minuteId}/actions`);
      const actions = response.data.data || response.data || [];
      console.log(`Fetched ${actions.length} actions for minute ${minuteId}`, actions);
      return actions;
    } catch (err) {
      console.error(`Error fetching actions for minute ${minuteId}:`, err);
      return [];
    }
  }, []);

  // Load minutes with their actions
  const loadMinutesWithActions = useCallback(async () => {
    if (!initialMinutes || initialMinutes.length === 0) {
      console.log('No initial minutes provided');
      setMinutesWithActions([]);
      return;
    }

    console.log('Loading actions for minutes:', initialMinutes.length);
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
      console.log('Minutes with actions loaded:', minutesWithActionsData.length);
      setMinutesWithActions(minutesWithActionsData);
    } catch (err) {
      console.error('Error loading minutes with actions:', err);
      // Fallback: set minutes without actions
      setMinutesWithActions(initialMinutes.map(m => ({ ...m, actions: [] })));
    } finally {
      setLoadingActions(false);
    }
  }, [initialMinutes, fetchActionsForMinute]);

  // Reload when initialMinutes changes
  useEffect(() => {
    loadMinutesWithActions();
  }, [loadMinutesWithActions]);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    if (onUpdate) {
      await onUpdate();
      // After parent updates, reload actions
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
      // When editing, also fetch the actions for this minute
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

  const handleSaveCombined = async (data) => {
    setLoading(true);
    setError(null);
    
    try {
      if (editingMinutes) {
        // Update existing minutes
        await api.put(`/action-tracker/minutes/${editingMinutes.id}`, {
          topic: data.minutes.topic,
          content: data.minutes.content,
          summary: data.minutes.summary
        });
        
        // Update or create actions
        for (const action of data.actions) {
          if (action.id && !action.isNew) {
            // Update existing action
            await api.put(`/action-tracker/actions/${action.id}`, {
              description: action.description,
              assigned_to_name: action.assigned_to?.assigned_to_name || null,
              assigned_to_id: action.assigned_to?.assigned_to_id || null,
              priority: action.priority,
              due_date: action.due_date ? new Date(action.due_date).toISOString() : null,
              remarks: action.remarks || ''
            });
          } else if (action.description) {
            // Create new action
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
        // Create new minutes
        const minutesResponse = await api.post(`/action-tracker/meetings/${meetingId}/minutes`, {
          topic: data.minutes.topic,
          content: data.minutes.content,
          summary: data.minutes.summary
        });
        const newMinutesId = minutesResponse.data.id;
        
        // Create all actions for this minutes
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
      
      handleRefresh(); // Refresh data
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

  const handleAddAction = (minuteId) => {
    // This will open the combined form with the minute pre-selected
    const minute = minutesWithActions.find(m => m.id === minuteId);
    if (minute) {
      handleOpenForm(minute);
    }
  };

  return (
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
  );
};

export default MinutesAndActions;