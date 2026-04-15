import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button, TextField,
  MenuItem, Alert, CircularProgress, Stack, Card, CardContent
} from '@mui/material';
import { PersonAdd } from '@mui/icons-material';
import api from '../../../services/api';

const AssignAction = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [action, setAction] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [formData, setFormData] = useState({
    assigned_to_id: '',
    assigned_to_name: ''
  });

  useEffect(() => {
    if (id) {
      fetchActionAndParticipants();
    } else {
      fetchParticipants();
      setFetching(false);
    }
  }, [id]);

  const fetchActionAndParticipants = async () => {
    try {
      const [actionRes, participantsRes] = await Promise.all([
        api.get(`/action-tracker/actions/${id}`),
        api.get('/action-tracker/participants/')
      ]);
      
      setAction(actionRes.data);
      
      // Handle both array and paginated responses for participants
      let participantsData = [];
      if (Array.isArray(participantsRes.data)) {
        participantsData = participantsRes.data;
      } else if (participantsRes.data?.items) {
        participantsData = participantsRes.data.items;
      }
      setParticipants(participantsData);
      
      if (actionRes.data.assigned_to_id) {
        setFormData({
          assigned_to_id: actionRes.data.assigned_to_id,
          assigned_to_name: actionRes.data.assigned_to_name?.name || ''
        });
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setFetching(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await api.get('/action-tracker/participants/');
      // Handle both array and paginated responses
      if (Array.isArray(response.data)) {
        setParticipants(response.data);
      } else if (response.data?.items) {
        setParticipants(response.data.items);
      } else {
        setParticipants([]);
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
      setError('Failed to load participants');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const updateData = {
        assigned_to_id: formData.assigned_to_id || null,
        assigned_to_name: formData.assigned_to_name || null
      };
      
      await api.put(`/action-tracker/actions/${id}`, updateData);
      setSuccess(true);
      setTimeout(() => {
        navigate(`/actions/${id}`);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to assign action');
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
          {id ? 'Assign Action' : 'Bulk Assign Actions'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {id ? `Assign "${action?.description}" to a participant` : 'Assign multiple actions to participants'}
        </Typography>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Action assigned successfully! Redirecting...
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <TextField
                select
                label="Assign To"
                value={formData.assigned_to_id}
                onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value, assigned_to_name: '' })}
                fullWidth
                helperText="Select a participant from the list"
              >
                <MenuItem value="">Unassigned</MenuItem>
                {participants.length > 0 ? (
                  participants.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} {p.email ? `(${p.email})` : ''}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>No participants available</MenuItem>
                )}
              </TextField>

              <TextField
                label="Or Enter Manual Name"
                value={formData.assigned_to_name}
                onChange={(e) => setFormData({ ...formData, assigned_to_name: e.target.value, assigned_to_id: '' })}
                fullWidth
                helperText="For external participants not in the system"
              />

              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button variant="outlined" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <PersonAdd />}
                >
                  {loading ? 'Assigning...' : 'Assign Action'}
                </Button>
              </Stack>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
};

export default AssignAction;