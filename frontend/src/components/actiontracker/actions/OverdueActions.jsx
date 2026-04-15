import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Alert, CircularProgress,
  Card, CardContent, Grid
} from '@mui/material';
import { Visibility, AccessTime, Assignment, Warning } from '@mui/icons-material';
import api from '../../../services/api';

const OverdueActions = () => {
  const navigate = useNavigate();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOverdueActions();
  }, []);

  const fetchOverdueActions = async () => {
    setLoading(true);
    try {
      // Fetch all actions and filter overdue on frontend
      const response = await api.get('/action-tracker/actions/');
      const allActions = Array.isArray(response.data) ? response.data : response.data.items || [];
      const overdue = allActions.filter(action => action.is_overdue === true);
      setActions(overdue);
    } catch (err) {
      console.error('Error fetching overdue actions:', err);
      setError(err.response?.data?.detail || 'Failed to load overdue actions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box mb={3}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Overdue Actions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Actions that have passed their due date
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {actions.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Warning sx={{ fontSize: 64, color: '#CBD5E1', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No Overdue Actions</Typography>
          <Typography variant="body2" color="text.secondary">
            All actions are on track!
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#FEF2F2' }}>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Assigned To</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {actions.map((action) => (
                <TableRow key={action.id} hover sx={{ bgcolor: '#FEF2F2' }}>
                  <TableCell>{action.description}</TableCell>
                  <TableCell>
                    {action.assigned_to_name?.name || action.assigned_to_name_display || 'Unassigned'}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <AccessTime fontSize="small" color="error" />
                      <Typography color="error">
                        {action.due_date ? new Date(action.due_date).toLocaleDateString() : 'No due date'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={action.priority === 1 ? 'High' : action.priority === 2 ? 'Medium' : 'Low'}
                      size="small"
                      color={action.priority === 1 ? 'error' : 'warning'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {action.overall_progress_percentage || 0}%
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => navigate(`/actions/${action.id}`)}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default OverdueActions;