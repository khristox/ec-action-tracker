// src/components/actiontracker/meetings/components/EditMinuteDialog.jsx
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
  useMediaQuery,
  useTheme,
  Box
} from '@mui/material';
import { Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import api from '../../../../services/api';
import RichTextEditor from './RichTextEditor';

const EditMinuteDialog = ({ open, minute, onClose, onSave, meetingId }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [formData, setFormData] = useState({
    topic: '',
    discussion: '',
    decisions: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && minute) {
      setFormData({
        topic: minute.topic || minute.title || '',
        discussion: minute.discussion || minute.content || '',
        decisions: minute.decisions || ''
      });
    }
  }, [open, minute]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDiscussionChange = (html) => {
    setFormData(prev => ({ ...prev, discussion: html }));
  };

  const handleDecisionsChange = (html) => {
    setFormData(prev => ({ ...prev, decisions: html }));
  };

  const handleSubmit = async () => {
    if (!formData.topic.trim()) {
      setError('Topic is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        topic: formData.topic.trim(),
        discussion: formData.discussion,
        decisions: formData.decisions
      };

      const response = await api.put(`/action-tracker/minutes/${minute.id}`, payload);
      
      if (onSave) onSave(response.data);
      onClose();
    } catch (err) {
      console.error('Error updating minute:', err);
      setError(err.response?.data?.detail || 'Failed to update minute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="md"
      fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ 
        pb: 1,
        bgcolor: isMobile ? 'primary.main' : 'transparent',
        color: isMobile ? 'white' : 'inherit'
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700}>
            Edit Meeting Minutes
          </Typography>
          {isMobile && (
            <IconButton onClick={onClose} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          )}
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2, pb: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Topic Field */}
          <TextField
            fullWidth
            label="Topic"
            name="topic"
            value={formData.topic}
            onChange={handleChange}
            required
            placeholder="e.g., Opening Remarks, Project Update, Q&A Session"
            autoFocus
          />
          
          {/* Discussion Field with Rich Text Editor */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Discussion
            </Typography>
            <RichTextEditor
              value={formData.discussion}
              onChange={handleDiscussionChange}
              placeholder="Record the key discussion points from the meeting..."
              minHeight={200}
            />
          </Box>
          
          {/* Decisions Field with Rich Text Editor */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Decisions
            </Typography>
            <RichTextEditor
              value={formData.decisions}
              onChange={handleDecisionsChange}
              placeholder="Record the decisions made during the meeting..."
              minHeight={150}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, pt: 0 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !formData.topic.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditMinuteDialog;