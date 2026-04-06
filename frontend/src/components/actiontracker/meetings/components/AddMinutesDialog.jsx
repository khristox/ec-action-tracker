import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, LinearProgress, Alert,
  Box, Typography
} from '@mui/material';
import RichTextEditor from './RichTextEditor';

const AddMinutesDialog = ({ open, onClose, onSave, editingMinutes, loading, error }) => {
  const [formData, setFormData] = useState({
    topic: '',
    discussion: '',
    decisions: ''
  });
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (editingMinutes) {
      setFormData({
        topic: editingMinutes.topic || '',
        discussion: editingMinutes.discussion || '',
        decisions: editingMinutes.decisions || ''
      });
    } else {
      setFormData({ topic: '', discussion: '', decisions: '' });
    }
  }, [editingMinutes, open]);

  const handleSave = async () => {
    if (!formData.topic.trim()) {
      setLocalError("Topic is required");
      return;
    }
    setLocalError(null);
    await onSave(formData);
    if (!error) {
      setFormData({ topic: '', discussion: '', decisions: '' });
    }
  };

  const displayError = localError || error;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editingMinutes ? 'Edit Minutes' : 'Add Minutes'}</DialogTitle>
      {loading && <LinearProgress />}
      <DialogContent>
        {displayError && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }} onClose={() => setLocalError(null)}>
            {displayError}
          </Alert>
        )}
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Topic"
            fullWidth
            required
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            error={!!localError && !formData.topic}
            helperText={!!localError && !formData.topic ? "Topic is required" : ""}
          />
          
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Discussion
            </Typography>
            <RichTextEditor
              value={formData.discussion}
              onChange={(value) => setFormData({ ...formData, discussion: value })}
              placeholder="Enter discussion points... Use the toolbar to format text, add lists, images, etc."
              minHeight={200}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Decisions Made
            </Typography>
            <RichTextEditor
              value={formData.decisions}
              onChange={(value) => setFormData({ ...formData, decisions: value })}
              placeholder="Enter decisions made during the meeting..."
              minHeight={150}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || !formData.topic.trim()}
        >
          {editingMinutes ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddMinutesDialog;