// src/components/actiontracker/actions/OverdueActions.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Alert, CircularProgress, Pagination,
  TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Card, CardContent, Grid, LinearProgress, Avatar
} from '@mui/material';
import {
  Visibility, AccessTime, Assignment, Warning, Search, Refresh,
  CheckCircle, Pending, Person, Schedule, Flag, Error as ErrorIcon,
  TrendingUp, PlayCircle, TaskAlt
} from '@mui/icons-material';
import api from '../../../services/api';

// ==================== Constants & Helpers ====================
const PRIORITY = {
  1: { label: 'High', color: '#EF4444', bgColor: '#FEE2E2', icon: <Flag fontSize="small" /> },
  2: { label: 'Medium', color: '#F59E0B', bgColor: '#FEF3C7', icon: <Schedule fontSize="small" /> },
  3: { label: 'Low', color: '#10B981', bgColor: '#D1FAE5', icon: <CheckCircle fontSize="small" /> },
  4: { label: 'Very Low', color: '#6B7280', bgColor: '#F3F4F6', icon: <Pending fontSize="small" /> }
};

const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'Invalid date';
  }
};

const getOverdueDays = (dueDate) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  const diffTime = now - due;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// ==================== Main Component ====================
const OverdueActions = () => {
  const navigate = useNavigate();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('overdue_days');
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    fetchOverdueActions();
  }, []);

  const fetchOverdueActions = async () => {
    setLoading(true);
    setError(null);
    try {
      // First try the dedicated overdue endpoint
      try {
        const response = await api.get('/action-tracker/actions/overdue');
        const data = Array.isArray(response.data) ? response.data : (response.data?.items || []);
        if (data.length > 0 || response.status === 200) {
          setActions(data);
          setLoading(false);
          return;
        }
      } catch (overdueErr) {
        console.log('Overdue endpoint failed, falling back to my-tasks:', overdueErr.message);
      }
      
      // Fallback: fetch my tasks and filter
      const response = await api.get('/action-tracker/actions/my-tasks', {
        params: { include_completed: false, limit: 500 }
      });
      
      const allActions = Array.isArray(response.data) ? response.data : (response.data?.items || []);
      const now = new Date();
      const overdue = allActions.filter(action => {
        if (!action.due_date || action.completed_at) return false;
        const dueDate = new Date(action.due_date);
        return dueDate < now;
      });
      
      setActions(overdue);
    } catch (err) {
      console.error('Error fetching overdue actions:', err);
      setError(err.response?.data?.detail || 'Failed to load overdue actions');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort tasks - FIXED: Create a new array before sorting
  const getFilteredAndSortedTasks = useCallback(() => {
    // Create a copy of the actions array to avoid mutating state
    let tasks = [...actions];
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      tasks = tasks.filter(task => 
        task.description?.toLowerCase().includes(term) ||
        task.meeting_title?.toLowerCase().includes(term)
      );
    }
    
    // Apply priority filter
    if (priorityFilter !== 'all') {
      tasks = tasks.filter(task => task.priority === parseInt(priorityFilter));
    }
    
    // Apply sorting - create a new sorted array
    const sortedTasks = [...tasks];
    sortedTasks.sort((a, b) => {
      switch(sortBy) {
        case 'overdue_days':
          return getOverdueDays(b.due_date) - getOverdueDays(a.due_date);
        case 'due_date_asc':
          return new Date(a.due_date) - new Date(b.due_date);
        case 'priority':
          return (a.priority || 2) - (b.priority || 2);
        case 'progress':
          return (a.overall_progress_percentage || 0) - (b.overall_progress_percentage || 0);
        default:
          return 0;
      }
    });
    
    return sortedTasks;
  }, [actions, searchTerm, priorityFilter, sortBy]);
  
  const filteredTasks = getFilteredAndSortedTasks();
  const totalPages = Math.ceil(filteredTasks.length / limit);
  const paginatedTasks = filteredTasks.slice((page - 1) * limit, page * limit);
  
  const stats = {
    total: filteredTasks.length,
    highPriority: filteredTasks.filter(t => t.priority === 1).length,
    mediumPriority: filteredTasks.filter(t => t.priority === 2).length,
    lowPriority: filteredTasks.filter(t => t.priority === 3).length,
    avgProgress: filteredTasks.length > 0 
      ? Math.round(filteredTasks.reduce((sum, t) => sum + (t.overall_progress_percentage || 0), 0) / filteredTasks.length)
      : 0
  };

  const handleViewTask = (taskId) => {
    navigate(`/actions/${taskId}`);
  };

  const getPriorityConfig = (priority) => PRIORITY[priority] || PRIORITY[2];

  if (loading && actions.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading overdue actions...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Warning sx={{ fontSize: 40, color: '#EF4444' }} />
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Overdue Actions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Actions that have passed their due date and require immediate attention
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#FEF2F2', border: '1px solid #FEE2E2' }}>
            <CardContent>
              <Typography variant="h3" fontWeight={800} color="#DC2626">{stats.total}</Typography>
              <Typography variant="body2" color="text.secondary">Total Overdue</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#FEE2E2', border: '1px solid #FECACA' }}>
            <CardContent>
              <Typography variant="h3" fontWeight={800} color="#DC2626">{stats.highPriority}</Typography>
              <Typography variant="body2" color="text.secondary">High Priority</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#FEF3C7', border: '1px solid #FDE68A' }}>
            <CardContent>
              <Typography variant="h3" fontWeight={800} color="#D97706">{stats.mediumPriority}</Typography>
              <Typography variant="body2" color="text.secondary">Medium Priority</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#D1FAE5', border: '1px solid #A7F3D0' }}>
            <CardContent>
              <Typography variant="h3" fontWeight={800} color="#059669">{stats.avgProgress}%</Typography>
              <Typography variant="body2" color="text.secondary">Avg Progress</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by description or meeting..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
          />

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Priority</InputLabel>
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} label="Priority">
              <MenuItem value="all">All Priorities</MenuItem>
              <MenuItem value="1">High</MenuItem>
              <MenuItem value="2">Medium</MenuItem>
              <MenuItem value="3">Low</MenuItem>
              <MenuItem value="4">Very Low</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort By</InputLabel>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} label="Sort By">
              <MenuItem value="overdue_days">Most Overdue First</MenuItem>
              <MenuItem value="due_date_asc">Due Date (Earliest First)</MenuItem>
              <MenuItem value="priority">Priority (Highest First)</MenuItem>
              <MenuItem value="progress">Progress (Lowest First)</MenuItem>
            </Select>
          </FormControl>

          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchOverdueActions}>
            Refresh
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {filteredTasks.length === 0 && !loading ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 64, color: '#10B981', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} gutterBottom>No Overdue Actions</Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm || priorityFilter !== 'all' 
              ? 'Try adjusting your filters' 
              : 'All actions are on track! Great job!'}
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#FEF2F2' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Meeting</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Assigned To</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Overdue</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedTasks.map((task) => {
                  const priorityConfig = getPriorityConfig(task.priority);
                  const overdueDays = getOverdueDays(task.due_date);
                  const progress = task.overall_progress_percentage || 0;
                  let assignedToName = 'Unassigned';
                  
                  if (task.assigned_to?.full_name) {
                    assignedToName = task.assigned_to.full_name;
                  } else if (task.assigned_to?.username) {
                    assignedToName = task.assigned_to.username;
                  } else if (typeof task.assigned_to_name === 'string') {
                    assignedToName = task.assigned_to_name;
                  } else if (task.assigned_to_name && typeof task.assigned_to_name === 'object') {
                    assignedToName = task.assigned_to_name.name || task.assigned_to_name.email || 'Unassigned';
                  }

                  return (
                    <TableRow 
                      key={task.id} 
                      hover 
                      sx={{ bgcolor: '#FEF2F2' }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {task.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {task.meeting_title || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: '#FEE2E2', fontSize: '0.75rem', color: '#DC2626' }}>
                            {assignedToName[0]?.toUpperCase() || '?'}
                          </Avatar>
                          <Typography variant="body2">{assignedToName}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <AccessTime fontSize="small" color="error" />
                          <Typography color="error" fontWeight={500}>
                            {formatDate(task.due_date)}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`}
                          size="small"
                          sx={{ bgcolor: '#FEE2E2', color: '#DC2626', fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={priorityConfig.label}
                          size="small"
                          icon={priorityConfig.icon}
                          sx={{ bgcolor: priorityConfig.bgColor, color: priorityConfig.color, fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <Stack spacing={0.5}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" fontWeight={500} color={progress >= 50 ? '#059669' : '#DC2626'}>
                              {progress}%
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={progress} 
                            sx={{ 
                              height: 6, 
                              borderRadius: 3,
                              bgcolor: '#FEE2E2',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: progress >= 100 ? '#10B981' : (progress >= 50 ? '#F59E0B' : '#EF4444'),
                                borderRadius: 3
                              }
                            }} 
                          />
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewTask(task.id)} color="primary">
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Stack alignItems="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, val) => setPage(val)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Stack>
          )}
        </>
      )}
    </Container>
  );
};

export default OverdueActions;