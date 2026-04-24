// src/components/actiontracker/actions/MyTasks.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Alert, CircularProgress, Pagination,
  TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Card, CardContent, Grid, useTheme, alpha
} from '@mui/material';
import {
  Visibility, Search, Refresh, AccessTime, Assignment,
  Warning as WarningIcon, CheckCircle as CheckCircleIcon,
  Pending as PendingIcon
} from '@mui/icons-material';
import { fetchMyTasks, selectMyTasks, selectActionsLoading, selectActionsError } from '../../../store/slices/actionTracker/actionSlice';
import api from '../../../services/api';

// ==================== Custom Hooks ====================
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// ==================== Constants & Helpers ====================
const PRIORITY = {
  1: { label: 'High', color: 'error' },
  2: { label: 'Medium', color: 'warning' },
  3: { label: 'Low', color: 'success' },
  4: { label: 'Very Low', color: 'default' }
};

const STATUS_COLOR_MAP = {
  'PENDING': '#F59E0B', 'pending': '#F59E0B',
  'IN_PROGRESS': '#3B82F6', 'in_progress': '#3B82F6',
  'COMPLETED': '#10B981', 'completed': '#10B981',
  'OVERDUE': '#EF4444', 'overdue': '#EF4444',
  'BLOCKED': '#6B7280', 'blocked': '#6B7280',
  'CANCELLED': '#EF4444', 'cancelled': '#EF4444'
};

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const getStatusColor = (statusCode) => STATUS_COLOR_MAP[statusCode] || '#6B7280';

const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'Invalid date';
  }
};

// ==================== Styled Components ====================
const StyledStatCard = ({ label, value, baseColor }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card 
      variant="outlined"
      sx={{ 
        height: '100%',
        backgroundImage: 'none',
        bgcolor: isDark ? alpha(baseColor, 0.1) : alpha(baseColor, 0.08),
        borderColor: isDark ? alpha(baseColor, 0.3) : alpha(baseColor, 0.2),
        transition: 'transform 0.2s ease-in-out',
        '&:hover': { transform: 'translateY(-2px)' }
      }}
    >
      <CardContent>
        <Typography 
          variant="h3" 
          fontWeight={800} 
          sx={{ 
            fontSize: { xs: '1.75rem', sm: '2rem', md: '2.5rem' },
            color: isDark ? alpha(baseColor, 0.9) : baseColor 
          }}
        >
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
};

// ==================== Main Component ====================
const MyTasks = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Use selectors to get data from Redux
  const myTasksData = useSelector(selectMyTasks);
  const loading = useSelector(selectActionsLoading);
  const error = useSelector(selectActionsError);

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusOptions, setStatusOptions] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const limit = 10;
  const debouncedSearch = useDebounce(searchTerm, 500);

  // Fetch status options (run once)
  useEffect(() => {
    const fetchStatusOptions = async () => {
      setLoadingStatus(true);
      try {
        const response = await api.get('/attribute-groups/ACTION_TRACKER/attributes');
        const allAttributes = response.data.items || response.data.data || response.data || [];

        const actionStatuses = allAttributes
          .filter(attr => attr.code !== 'ACTION_STATUS' && attr.code?.startsWith('ACTION_STATUS_'))
          .map(attr => ({
            value: (attr.short_name || attr.code).toLowerCase().replace('action_status_', ''),
            label: attr.name?.replace('Action Status - ', '') || attr.name,
            code: attr.code,
            shortName: attr.short_name,
            sortOrder: attr.sort_order,
            color: getStatusColor(attr.short_name || attr.code),
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const allStatuses = [
          { value: 'all', label: 'All Status', color: '#6B7280' },
          ...actionStatuses,
          { value: 'overdue', label: 'Overdue', color: '#EF4444' },
          { value: 'completed', label: 'Completed', color: '#10B981' }
        ];

        // Deduplicate
        const unique = Array.from(new Map(allStatuses.map(s => [s.value, s])).values());
        setStatusOptions(unique);
      } catch (err) {
        console.error('Error fetching status options:', err);
        setStatusOptions([
          { value: 'all', label: 'All Status', color: '#6B7280' },
          { value: 'pending', label: 'Pending', color: '#F59E0B' },
          { value: 'in_progress', label: 'In Progress', color: '#3B82F6' },
          { value: 'completed', label: 'Completed', color: '#10B981' },
          { value: 'overdue', label: 'Overdue', color: '#EF4444' },
          { value: 'blocked', label: 'Blocked', color: '#6B7280' },
          { value: 'cancelled', label: 'Cancelled', color: '#EF4444' }
        ]);
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchStatusOptions();
  }, []);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, priorityFilter]);

  // Fetch tasks
  const fetchTasks = useCallback(() => {
    const params = { 
      skip: (page - 1) * limit,
      limit: limit 
    };

    if (debouncedSearch?.trim()) {
      params.search = debouncedSearch.trim();
    }
    if (statusFilter && statusFilter !== 'all') {
      params.status = statusFilter;
    }
    if (priorityFilter && priorityFilter !== 'all') {
      params.priority = Number(priorityFilter);
    }

    dispatch(fetchMyTasks(params));
  }, [dispatch, page, limit, debouncedSearch, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Handlers
  const handleViewTask = (taskId) => {
    if (!isValidUUID(taskId)) return;
    navigate(`/actions/${taskId}`);
  };

  const tasks = myTasksData?.items || [];
  const totalPages = myTasksData?.totalPages || 1;

  const stats = {
    total: tasks.length,
    overdue: tasks.filter(t => t.is_overdue && !t.completed_at).length,
    inProgress: tasks.filter(t => t.overall_progress_percentage > 0 && t.overall_progress_percentage < 100 && !t.completed_at).length,
    completed: tasks.filter(t => !!t.completed_at).length,
  };

  const getStatusDisplay = (task) => {
    if (task.completed_at) return { label: 'Completed', color: '#10B981', icon: <CheckCircleIcon fontSize="small" /> };
    if (task.is_overdue) return { label: 'Overdue', color: '#EF4444', icon: <WarningIcon fontSize="small" /> };

    const option = statusOptions.find(opt =>
      opt.value === (task.status || '').toLowerCase() ||
      opt.shortName === task.status ||
      opt.code === task.status
    );

    if (option) {
      return { label: option.label, color: option.color, icon: <PendingIcon fontSize="small" /> };
    }

    return task.overall_progress_percentage === 0
      ? { label: 'Pending', color: '#F59E0B', icon: <PendingIcon fontSize="small" /> }
      : { label: 'In Progress', color: '#3B82F6', icon: <PendingIcon fontSize="small" /> };
  };

  if (loading && tasks.length === 0) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: theme.palette.primary.main }} />
        <Typography sx={{ ml: 2, color: theme.palette.text.secondary }}>Loading your tasks...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 2, sm: 3, md: 4 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
        {/* Header */}
        <Box mb={4}>
          <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary', fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' } }}>
            My Tasks
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Manage and track your assigned action items
          </Typography>
        </Box>

        {/* Dynamic Stats Section */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="Total Tasks" value={stats.total} baseColor={theme.palette.primary.main} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="Overdue" value={stats.overdue} baseColor={theme.palette.error.main} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="In Progress" value={stats.inProgress} baseColor={theme.palette.warning.main} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="Completed" value={stats.completed} baseColor={theme.palette.success.main} />
          </Grid>
        </Grid>

        {/* Filters Toolbar */}
        <Paper 
          variant="outlined" 
          sx={{ 
            p: { xs: 1.5, sm: 2 }, 
            mb: 3, 
            backgroundImage: 'none', 
            bgcolor: 'background.paper',
            borderColor: 'divider' 
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search tasks by description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ 
                startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>,
              }}
              sx={{ flex: 2 }}
            />
            
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)} 
                label="Status"
              >
                {statusOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: opt.color }} />
                      {opt.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
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

            <Button 
              variant="outlined" 
              onClick={fetchTasks}
              startIcon={<Refresh />}
              sx={{ minWidth: 100 }}
            >
              Refresh
            </Button>
          </Stack>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => {}}>
            {error}
          </Alert>
        )}
        
        {loadingStatus && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Loading status options...
          </Alert>
        )}

        {/* Tasks Table */}
        {tasks.length === 0 && !loading ? (
          <Paper 
            sx={{ 
              p: 6, 
              textAlign: 'center',
              bgcolor: 'background.paper',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2
            }}
          >
            <Assignment sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" fontWeight={600} sx={{ color: 'text.primary' }}>
              No Tasks Found
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'You have no assigned tasks at the moment'}
            </Typography>
          </Paper>
        ) : (
          <>
            <TableContainer 
              component={Paper} 
              variant="outlined" 
              sx={{ 
                backgroundImage: 'none', 
                bgcolor: 'background.paper',
                borderRadius: 2,
                overflowX: 'auto'
              }}
            >
              <Table size="small" sx={{ minWidth: 600 }}>
                <TableHead sx={{ bgcolor: isDark ? alpha(theme.palette.common.white, 0.05) : '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Task</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Meeting</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Due Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Progress</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tasks.map((task) => {
                    const priority = PRIORITY[task.priority] || PRIORITY[2];
                    const isOverdue = task.is_overdue && !task.completed_at;
                    const statusDisplay = getStatusDisplay(task);

                    return (
                      <TableRow 
                        key={task.id} 
                        hover 
                        sx={{ 
                          bgcolor: isOverdue ? alpha(theme.palette.error.main, isDark ? 0.08 : 0.03) : 'transparent',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary' }}>
                            {task.description || task.title || 'Untitled'}
                          </Typography>
                          {task.remarks && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                              {task.remarks.length > 100 ? task.remarks.substring(0, 100) + '...' : task.remarks}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {task.meeting_title || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusDisplay.label}
                            icon={statusDisplay.icon}
                            size="small"
                            sx={{ 
                              bgcolor: statusDisplay.color, 
                              color: '#fff', 
                              fontWeight: 500,
                              '& .MuiChip-icon': { color: '#fff' }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <AccessTime fontSize="small" sx={{ color: isOverdue ? 'error.main' : 'action.active' }} />
                            <Typography variant="body2" sx={{ color: isOverdue ? 'error.main' : 'text.primary' }}>
                              {formatDate(task.due_date)}
                            </Typography>
                          </Stack>
                          {isOverdue && (
                            <Typography variant="caption" sx={{ color: 'error.main', display: 'block' }}>
                              Overdue
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={priority.label} 
                            color={priority.color} 
                            size="small"
                            sx={{ fontWeight: 500 }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 100 }}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box sx={{ 
                              flex: 1, 
                              bgcolor: alpha(theme.palette.text.disabled, 0.2), 
                              borderRadius: 2, 
                              height: 6,
                              overflow: 'hidden'
                            }}>
                              <Box sx={{ 
                                width: `${task.overall_progress_percentage || 0}%`, 
                                bgcolor: isOverdue ? 'error.main' : 'primary.main', 
                                height: 6, 
                                borderRadius: 2,
                                transition: 'width 0.3s ease'
                              }} />
                            </Box>
                            <Typography variant="caption" fontWeight={500} sx={{ color: 'text.secondary' }}>
                              {task.overall_progress_percentage || 0}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="View Details">
                            <IconButton 
                              size="small" 
                              onClick={() => handleViewTask(task.id)} 
                              sx={{ color: 'primary.main' }}
                            >
                              <Visibility fontSize="small" />
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
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: 'text.primary',
                    }
                  }}
                />
              </Stack>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};

export default MyTasks;