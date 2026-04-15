// frontend/src/components/actiontracker/actions/AllActions.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Alert, CircularProgress, Pagination,
  TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Card, CardContent, Grid, LinearProgress
} from '@mui/material';
import {
  Visibility, Search, Refresh, AccessTime, Assignment,
  Edit, Delete, CheckCircle, Pending, Cancel
} from '@mui/icons-material';
import api from '../../../services/api';

const AllActions = () => {
  const navigate = useNavigate();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const limit = 10;

  // Fetch all actions
  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        skip: (page - 1) * limit,
        limit,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter })
      };
      
      const response = await api.get('/action-tracker/actions/', { params });
      
      if (Array.isArray(response.data)) {
        setActions(response.data);
        setTotalPages(Math.ceil(response.data.length / limit));
      } else if (response.data.items) {
        setActions(response.data.items);
        setTotalPages(Math.ceil(response.data.total / limit));
      } else {
        setActions([]);
      }
    } catch (err) {
      console.error('Error fetching actions:', err);
      setError(err.response?.data?.detail || 'Failed to load actions');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchTerm, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleViewAction = (id) => {
    navigate(`/actions/${id}`);
  };

  const handleEditAction = (id) => {
    navigate(`/actions/${id}/edit`);
  };

  const handleDeleteAction = async (id) => {
    if (!window.confirm('Are you sure you want to delete this action?')) return;
    try {
      await api.delete(`/action-tracker/actions/${id}`);
      fetchActions();
    } catch (err) {
      console.error('Error deleting action:', err);
    }
  };

  const getPriorityInfo = (priority) => {
    const priorities = {
      1: { label: 'High', color: 'error' },
      2: { label: 'Medium', color: 'warning' },
      3: { label: 'Low', color: 'success' },
      4: { label: 'Very Low', color: 'default' }
    };
    return priorities[priority] || priorities[2];
  };

  const getStatusInfo = (status) => {
    const statuses = {
      'pending': { label: 'Pending', color: 'warning', icon: <Pending /> },
      'in_progress': { label: 'In Progress', color: 'info', icon: <Pending /> },
      'completed': { label: 'Completed', color: 'success', icon: <CheckCircle /> },
      'cancelled': { label: 'Cancelled', color: 'error', icon: <Cancel /> },
      'overdue': { label: 'Overdue', color: 'error', icon: <Cancel /> }
    };
    return statuses[status?.toLowerCase()] || statuses['pending'];
  };

  if (loading && actions.length === 0) {
    return (
      <Container sx={{ py: 4 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography>Loading actions...</Typography>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          All Actions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage and track all action items across all meetings
        </Typography>
      </Box>

      {/* Stats Overview */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" fontWeight={700}>
                {actions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">Total Actions</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#FEFCE8' }}>
            <CardContent>
              <Typography variant="h4" fontWeight={700} color="#CA8A04">
                {actions.filter(a => a.overall_progress_percentage > 0 && a.overall_progress_percentage < 100).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">In Progress</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#ECFDF5' }}>
            <CardContent>
              <Typography variant="h4" fontWeight={700} color="#059669">
                {actions.filter(a => a.completed_at || a.overall_progress_percentage === 100).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">Completed</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#FEF2F2' }}>
            <CardContent>
              <Typography variant="h4" fontWeight={700} color="#DC2626">
                {actions.filter(a => a.is_overdue).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">Overdue</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search actions by description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              label="Priority"
            >
              <MenuItem value="all">All Priorities</MenuItem>
              <MenuItem value="1">High</MenuItem>
              <MenuItem value="2">Medium</MenuItem>
              <MenuItem value="3">Low</MenuItem>
              <MenuItem value="4">Very Low</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchActions}>
            Refresh
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Actions Table */}
      {actions.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Assignment sx={{ fontSize: 64, color: '#CBD5E1', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No Actions Found</Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm ? 'Try adjusting your search' : 'No action items have been created yet'}
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Meeting</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Assigned To</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {actions.map((action) => {
                  const priorityInfo = getPriorityInfo(action.priority);
                  const statusInfo = getStatusInfo(action.status);
                  const dueDate = action.due_date ? new Date(action.due_date).toLocaleDateString() : 'No due date';
                  const isOverdue = action.is_overdue;
                  
                  return (
                    <TableRow key={action.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {action.description}
                        </Typography>
                        {action.notes && (
                          <Typography variant="caption" color="text.secondary">
                            {action.notes.substring(0, 60)}...
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {action.meeting_title ? (
                          <Chip 
                            label={action.meeting_title} 
                            size="small" 
                            variant="outlined"
                            onClick={() => navigate(`/meetings/${action.meeting_id}`)}
                            sx={{ cursor: 'pointer' }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {action.assigned_to_name ? (
                        <Chip
                          label={action.assigned_to_name.name || action.assigned_to_name.email || 'Unassigned'}
                          size="small"
                          avatar={<Assignment sx={{ fontSize: 14 }} />}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {action.assigned_to_name_display || 'Unassigned'}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTime fontSize="small" color={isOverdue ? 'error' : 'action'} />
                          <Typography 
                            variant="body2" 
                            color={isOverdue ? 'error' : 'text.primary'}
                            fontWeight={isOverdue ? 500 : 400}
                          >
                            {dueDate}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={priorityInfo.label} 
                          size="small"
                          color={priorityInfo.color}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={statusInfo.label} 
                          size="small"
                          color={statusInfo.color}
                          icon={statusInfo.icon}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={action.overall_progress_percentage || 0}
                              sx={{ height: 6, borderRadius: 3 }}
                              color={action.overall_progress_percentage === 100 ? 'success' : 'primary'}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {action.overall_progress_percentage || 0}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewAction(action.id)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditAction(action.id)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteAction(action.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={(e, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default AllActions;