import React, { useState, useCallback, useMemo } from 'react';
import { 
  Box, Button, Alert, Collapse, Snackbar, 
  ToggleButtonGroup, ToggleButton, Typography, Stack, Fade 
} from '@mui/material';
import { 
  Add as AddIcon, 
  Visibility as AllIcon,
  CheckCircleOutline as ActiveIcon,
  DoNotDisturbOn as InactiveIcon,
  EventNote as NoteIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

// Sub-components
import MinutesList from './MinutesList';
import AddMinutesDialog from './AddMinutesDialog';
import AddActionDialog from './AddActionDialog';

const MinutesAndActions = ({ minutes, meetingId, meetingStatus, onUpdate }) => {
  // 1. Status Check
  // Assuming 'Started' is the trigger. Use lowercase for safety.
 const isStarted = meetingStatus?.toLowerCase().endsWith('started');
  // 2. State Management
  const [filter, setFilter] = useState('active');
  const [dialogs, setDialogs] = useState({ minutes: false, action: false });
  const [editingItem, setEditingItem] = useState({ minute: null, action: null });
  const [selectedMinuteId, setSelectedMinuteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // 3. Filter Logic
  const filteredMinutes = useMemo(() => {
    if (!minutes) return [];
    if (filter === 'all') return minutes;
    return minutes.filter(m => {
      const isActive = m.is_active !== false;
      return filter === 'active' ? isActive : !isActive;
    });
  }, [minutes, filter]);

  // 4. Action Handlers
  const closeAllDialogs = useCallback(() => {
    setDialogs({ minutes: false, action: false });
    setEditingItem({ minute: null, action: null });
    setError(null);
  }, []);

  const handleOpenMinutes = (minute = null) => {
    setEditingItem(prev => ({ ...prev, minute }));
    setDialogs(prev => ({ ...prev, minutes: true }));
  };

  const handleSaveMinutes = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      if (editingItem.minute) {
        await api.put(`/action-tracker/minutes/${editingItem.minute.id}`, formData);
      } else {
        await api.post(`/action-tracker/meetings/${meetingId}/minutes`, formData);
      }
      setSuccessMsg(`Minutes ${editingItem.minute ? 'updated' : 'added'} successfully`);
      onUpdate();
      closeAllDialogs();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save minutes.");
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
      onUpdate(); 
    } catch (err) {
      setError("Failed to delete minutes.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAction = (minuteId, action = null) => {
    setSelectedMinuteId(minuteId);
    setEditingItem(prev => ({ ...prev, action }));
    setDialogs(prev => ({ ...prev, action: true }));
  };

  const handleSaveAction = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      if (editingItem.action) {
        await api.put(`/action-tracker/actions/${editingItem.action.id}`, formData);
      } else {
        await api.post(`/action-tracker/actions/minutes/${selectedMinuteId}/actions`, formData);
      }
      onUpdate();
      closeAllDialogs();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save action");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Collapse in={!!error}>
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      </Collapse>

      {/* Header with Filter and Conditional Add Button */}
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

        {/* Status-based Add Button */}
        {isStarted ? (
          <Fade in={isStarted}>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => handleOpenMinutes()} 
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
              Add Minutes
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

      {/* List Component */}
      <MinutesList
        minutes={filteredMinutes}
        onEditMinutes={handleOpenMinutes}
        onDeleteMinutes={handleDeleteMinutes}
        onAddAction={handleOpenAction}
        onUpdate={onUpdate}
        loading={loading}
        isMeetingStarted={isStarted} // Pass this to disable edit/delete if ended
      />

      {/* Dialogs */}
      <AddMinutesDialog
        open={dialogs.minutes}
        onClose={closeAllDialogs}
        onSave={handleSaveMinutes}
        editingMinutes={editingItem.minute}
        loading={loading}
      />

      <AddActionDialog
        open={dialogs.action}
        onClose={closeAllDialogs}
        onSave={handleSaveAction}
        editingAction={editingItem.action}
        meetingId={meetingId}
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