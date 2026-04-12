// src/components/actiontracker/actions/MyTasks.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, IconButton, Tooltip, Alert, CircularProgress, Pagination,
  TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Card, CardContent, Grid, LinearProgress
} from '@mui/material';
import {
  Visibility, Schedule, Person, PriorityHigh,
  CheckCircle, Cancel, Warning, Search, Refresh,
  AccessTime, Event, Assignment
} from '@mui/icons-material';
import { fetchMyTasks } from '../../../store/slices/actionTracker/actionSlice';

const PRIORITY = {
  1: { label: 'High', color: 'error' },
  2: { label: 'Medium', color: 'warning' },
  3: { label: 'Low', color: 'success' },
  4: { label: 'Very Low', color: 'default' }
};

// Helper to validate UUID format
const isValidUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const MyTasks = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { myTasks, loading, error } = useSelector((state) => state.actions);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const limit = 10;

  useEffect(() => {
    fetchTasks();
  }, [page, searchTerm, statusFilter, priorityFilter]);

  const fetchTasks = () => {
    dispatch(fetchMyTasks({
      page,
      limit,
      search: searchTerm,
      status: statusFilter,
      priority: priorityFilter
    }));
  };

  const handleViewTask = (taskId) => {
    // Validate UUID before navigating
    if (!isValidUUID(taskId)) {
      console.error('Invalid task ID:', taskId);
      return;
    }
    navigate(`/actions/${taskId}`);
  };

  const tasks = myTasks.items || [];
  const overdueCount = tasks.filter(t => t.is_overdue === true).length;
  const completedCount = tasks.filter(t => t.completed_at !== null).length;
  const inProgressCount = tasks.filter(t => t.overall_progress_percentage > 0 && t.overall_progress_percentage < 100 && !t.completed_at).length;
  const notStartedCount = tasks.filter(t => t.overall_progress_percentage === 0 && !t.completed_at).length;

  if (loading && tasks.length === 0) {
    return (
      <Container sx={{ py: 4 }}>
        <Stack spacing={2}>
          <CircularProgress />
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          My Tasks
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage and track your assigned action items
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <CardContent>
              <Typography variant="h3" fontWeight={800} color="#2563EB">
                {tasks.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">Total Tasks</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#FEF2F2', border: '1px solid #FEE2E2' }}>
            <CardContent>
              <Typography variant="h3" fontWeight={800} color="#DC2626">
                {overdueCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">Overdue</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#FEFCE8', border: '1px solid #FEF08A' }}>
            <CardContent>
              <Typography variant="h3" fontWeight={800} color="#CA8A04">
                {inProgressCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">In Progress</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#ECFDF5', border: '1px solid #D1FAE5' }}>
            <CardContent>
              <Typography variant="h3" fontWeight={800} color="#059669">
                {completedCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">Completed</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search tasks by description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
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
              <MenuItem value="overdue">Overdue</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="not_started">Not Started</MenuItem>
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
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchTasks}>
            Refresh
          </Button>
        </Stack>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Tasks Table */}
      {tasks.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Assignment sx={{ fontSize: 64, color: '#CBD5E1', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} gutterBottom>
            No Tasks Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm ? 'Try adjusting your search or filters' : 'You have no assigned tasks at the moment'}
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Task</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Meeting</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => {
                  const priority = PRIORITY[task.priority] || PRIORITY[2];
                  const isOverdue = task.is_overdue && !task.completed_at;
                  
                  return (
                    <TableRow 
                      key={task.id} 
                      hover 
                      sx={{ 
                        bgcolor: isOverdue ? '#FEF2F2' : 'transparent',
                        '&:hover': { bgcolor: isOverdue ? '#FEE2E2' : 'action.hover' }
                      }}
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
                          <AccessTime fontSize="small" color={isOverdue ? 'error' : 'action'} />
                          <Typography variant="body2" color={isOverdue ? 'error' : 'inherit'}>
                            {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                          </Typography>
                        </Stack>
                        {isOverdue && (
                          <Typography variant="caption" color="error">
                            Overdue
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={priority.label}
                          color={priority.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box sx={{ flex: 1, bgcolor: '#E5E7EB', borderRadius: 2, height: 6 }}>
                            <Box
                              sx={{
                                width: `${task.overall_progress_percentage}%`,
                                bgcolor: isOverdue ? '#EF4444' : '#3B82F6',
                                borderRadius: 2,
                                height: 6
                              }}
                            />
                          </Box>
                          <Typography variant="caption" fontWeight={500}>
                            {task.overall_progress_percentage}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewTask(task.id)}
                            color="primary"
                          >
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
          
          {myTasks.totalPages > 1 && (
            <Stack alignItems="center" mt={3}>
              <Pagination
                count={myTasks.totalPages}
                page={page}
                onChange={(_, val) => setPage(val)}
                color="primary"
              />
            </Stack>
          )}
        </>
      )}
    </Container>
  );
};

export default MyTasks;