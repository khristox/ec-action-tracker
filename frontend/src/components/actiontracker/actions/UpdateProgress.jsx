import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button, TextField,
  Slider, MenuItem, Alert, CircularProgress, Stack, Card, CardContent,
  LinearProgress
} from '@mui/material';
import { TrendingUp, Save } from '@mui/icons-material';
import api from '../../../services/api';

const UpdateProgress = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [action, setAction] = useState(null);
  const [formData, setFormData] = useState({
    overall_progress_percentage: 0,
    overall_status_id: '',
    remarks: ''
  });
  const [statuses, setStatuses] = useState([]);

  useEffect(() => {
    if (id) {
      fetchActionAndStatuses();
    }
  }, [id]);

  const fetchActionAndStatuses = async () => {
    try {
      const [actionRes, statusesRes] = await Promise.all([
        api.get(`/action-tracker/actions/${id}`),
        api.get('/action-tracker/statuses/').catch(() => ({ data: [] }))
      ]);
      setAction(actionRes.data);
      setStatuses(statusesRes.data || []);
      setFormData({
        overall_progress_percentage: actionRes.data.overall_progress_percentage || 0,
        overall_status_id: actionRes.data.overall_status_id || '',
        remarks: actionRes.data.remarks || ''
      });
    } catch (err) {
      setError('Failed to load action data');
    } finally {
      setFetching(false);
    }
  };

  const handleProgressChange = (e, newValue) => {
    setFormData({ ...formData, overall_progress_percentage: newValue });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await api.put(`/action-tracker/actions/${id}`, formData);
      setSuccess(true);
      setTimeout(() => {
        navigate(`/actions/${id}`);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update progress');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box mb={3}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Update Action Progress
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Update progress for: {action?.description}
        </Typography>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Progress updated successfully! Redirecting...
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <Box>
                <Typography gutterBottom>Progress: {formData.overall_progress_percentage}%</Typography>
                <Slider
                  value={formData.overall_progress_percentage}
                  onChange={handleProgressChange}
                  aria-labelledby="progress-slider"
                  valueLabelDisplay="auto"
                  step={5}
                  marks
                  min={0}
                  max={100}
                />
                <LinearProgress 
                  variant="determinate" 
                  value={formData.overall_progress_percentage} 
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                />
              </Box>

              {statuses.length > 0 && (
                <TextField
                  select
                  label="Status"
                  value={formData.overall_status_id}
                  onChange={(e) => setFormData({ ...formData, overall_status_id: e.target.value })}
                  fullWidth
                >
                  {statuses.map((status) => (
                    <MenuItem key={status.id} value={status.id}>
                      {status.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              <TextField
                label="Remarks / Comments"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                multiline
                rows={3}
                fullWidth
                placeholder="Add notes about progress made..."
              />

              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button variant="outlined" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                >
                  {loading ? 'Updating...' : 'Update Progress'}
                </Button>
              </Stack>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
};

export default UpdateProgress;