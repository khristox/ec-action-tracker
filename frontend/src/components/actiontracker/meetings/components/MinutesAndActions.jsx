import React, { useState, useCallback } from 'react';
import { Box, Button, Alert, Collapse, Snackbar } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import api from '../../../../services/api';

// Sub-components
import MinutesList from './MinutesList';
import AddMinutesDialog from './AddMinutesDialog';
import AddActionDialog from './AddActionDialog';

const MinutesAndActions = ({ minutes, meetingId, onUpdate }) => {
  // State Management
  const [dialogs, setDialogs] = useState({ minutes: false, action: false });
  const [editingItem, setEditingItem] = useState({ minute: null, action: null });
  const [selectedMinuteId, setSelectedMinuteId] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Helper to clear error and close dialogs
  const closeAllDialogs = useCallback(() => {
    setDialogs({ minutes: false, action: false });
    setEditingItem({ minute: null, action: null });
    setError(null);
  }, []);

  // Minutes Handlers
  const handleOpenMinutes = (minute = null) => {
    setEditingItem(prev => ({ ...prev, minute }));
    setDialogs(prev => ({ ...prev, minutes: true }));
  };

  const handleSaveMinutes = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      if (editingItem.minute) {
        // Backend usually expects plural 'meeting-minutes' or specific ID path
        await api.put(`/action-tracker/meeting-minutes/${editingItem.minute.id}`, formData);
      } else {
        await api.post(`/action-tracker/meetings/${meetingId}/minutes`, formData);
      }
      setSuccessMsg(`Minutes ${editingItem.minute ? 'updated' : 'added'} successfully`);
      onUpdate();
      closeAllDialogs();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save minutes. Verify backend routes.");
    } finally {
      setLoading(false);
    }
  };

const handleDeleteMinutes = async (minuteId) => {
  if (!window.confirm("Are you sure? This will delete all associated actions.")) return;
  
  setLoading(true);
  try {
    // Try the most likely correct endpoint based on standard FastAPI patterns
    await api.delete(`/action-tracker/minutes/${minuteId}`); 
    
    setSuccessMsg("Minutes deleted successfully");
    onUpdate(); // This triggers the refresh in MeetingDetail
  } catch (err) {
    console.error("Delete Error Detail:", err.response);
    setError(
      err.response?.status === 404 
        ? "Endpoint not found. Check if the route is /minutes/ or /meeting-minutes/ on the backend." 
        : "Failed to delete minutes."
    );
  } finally {
    setLoading(false);
  }
};

  // Action Handlers
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
      {/* Dynamic Error Feedback */}
      <Collapse in={!!error}>
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Collapse>

      <Box display="flex" justifyContent="flex-end" mb={3}>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => handleOpenMinutes()} 
          disabled={loading}
          sx={{ borderRadius: 2, px: 3 }}
        >
          Add Minutes
        </Button>
      </Box>

      <MinutesList
        minutes={minutes}
        onEditMinutes={handleOpenMinutes}
        onDeleteMinutes={handleDeleteMinutes}
        onAddAction={handleOpenAction}
        onUpdate={onUpdate}
        loading={loading}
      />

      {/* Minutes Dialog Wrapper */}
      <AddMinutesDialog
        open={dialogs.minutes}
        onClose={closeAllDialogs}
        onSave={handleSaveMinutes}
        editingMinutes={editingItem.minute}
        loading={loading}
      />

      {/* Action Dialog Wrapper */}
      <AddActionDialog
        open={dialogs.action}
        onClose={closeAllDialogs}
        onSave={handleSaveAction}
        editingAction={editingItem.action}
        meetingId={meetingId}
        loading={loading}
      />

      <Snackbar 
        open={!!successMsg} 
        autoHideDuration={4000} 
        onClose={() => setSuccessMsg(null)}
      >
        <Alert severity="success" variant="filled">{successMsg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default MinutesAndActions;