import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Paper, Typography, Chip,
  Box, CircularProgress
} from '@mui/material';
import api from '../../../../services/api';

const CommentsDialog = ({ open, onClose, action, onUpdate }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchComments = async () => {
    if (!action) return;
    setLoading(true);
    try {
      const response = await api.get(`/action-tracker/actions/${action.id}/comments`);
      setComments(response.data || []);
    } catch (err) {
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && action) {
      fetchComments();
    }
  }, [open, action]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      await api.post(`/action-tracker/actions/${action.id}/comments`, {
        comment: newComment
      });
      setNewComment('');
      await fetchComments();
      onUpdate?.();
    } catch (err) {
      console.error("Failed to add comment", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Comments - {action?.description?.substring(0, 50)}...</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box textAlign="center" py={3}><CircularProgress size={24} /></Box>
        ) : (
          <Stack spacing={2}>
            {comments.length === 0 ? (
              <Typography color="text.secondary" textAlign="center">No comments yet</Typography>
            ) : (
              comments.map((comment) => (
                <Paper key={comment.id} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                  <Typography variant="body2">{comment.comment}</Typography>
                  <Stack direction="row" spacing={1} mt={1}>
                    <Chip size="small" label={`By: ${comment.created_by_name || 'System'}`} variant="outlined" />
                    <Chip size="small" label={formatDateTime(comment.created_at)} variant="outlined" />
                  </Stack>
                </Paper>
              ))
            )}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Add a comment"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={handleAddComment} disabled={!newComment.trim() || loading}>
          Add Comment
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CommentsDialog;