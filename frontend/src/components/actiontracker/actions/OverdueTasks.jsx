// src/components/actiontracker/actions/OverdueTasks.jsx
import React, { useState, useEffect } from 'react';
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

const OverdueTasks = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { myTasks, loading, error } = useSelector((state) => state.actions);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const limit = 10;

  useEffect(() => {
    fetchTasks();
  }, [page, searchTerm, priorityFilter]);

  const fetchTasks = () => {
    dispatch(fetchMyTasks({
      page,
      limit,
      search: searchTerm,
      priority: priorityFilter,
      status: 'all'
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

  // Filter for overdue tasks only
  const allTasks = myTasks.items || [];
  const overdueTasks = allTasks.filter(task => task.is_overdue === true && !task.completed_at);
  const totalOverdue = overdueTasks.length;

  if (loading && allTasks.length === 0) {
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
          Overdue Tasks
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Tasks that have passed their due date and require immediate attention
        </Typography>
      </Box>

      {/* Stats Card */}
      <Card sx={{ mb: 3, bgcolor: '#FEF2F2', border: '1px solid #FEE2E2' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Warning sx={{ fontSize: 48, color: '#EF4444' }} />
            <Box>
              <Typography variant="h2" fontWeight={800} color="#DC2626">
                {totalOverdue}
              </Typography>
              <Typography variant="body2" color="error">
                Overdue Task{totalOverdue !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search overdue tasks..."
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

      {/* Overdue Tasks Table */}
      {overdueTasks.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 64, color: '#10B981', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} gutterBottom>
            No Overdue Tasks
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Great job! All your tasks are up to date.
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#FEF2F2' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Task</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Meeting</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overdueTasks.map((task) => {
                  const priority = PRIORITY[task.priority] || PRIORITY[2];
                  const daysOverdue = Math.ceil(
                    (new Date() - new Date(task.due_date)) / (1000 * 60 * 60 * 24)
                  );
                  
                  return (
                    <TableRow key={task.id} hover sx={{ bgcolor: '#FEF2F2' }}>
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
                          <AccessTime fontSize="small" color="error" />
                          <Box>
                            <Typography variant="body2" color="error" fontWeight={500}>
                              {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                            </Typography>
                            <Typography variant="caption" color="error">
                              Overdue by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                        </Stack>
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
                                bgcolor: '#EF4444',
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

export default OverdueTasks;