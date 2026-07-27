// src/components/actiontracker/actions/MyTasks.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Alert, CircularProgress, Pagination,
  TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  useTheme, alpha, ToggleButton, useMediaQuery, Card, CardContent
} from '@mui/material';
import {
  Visibility, Search, Refresh, AccessTime, Assignment,
  Warning as WarningIcon, CheckCircle as CheckCircleIcon,
  Pending as PendingIcon
} from '@mui/icons-material';
import api from '../../../services/api';

// ==================== Constants ====================

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

// ==================== Custom Hooks ====================

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

// ==================== Main Component ====================

const MyTasks = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [statusOptions, setStatusOptions] = useState([]);

  const limit = 10;
  const debouncedSearch = useDebounce(searchTerm, 500);

  // Fetch status options
  useEffect(() => {
    const fetchStatusOptions = async () => {
      try {
        const response = await api.get('/attribute-groups/ACTION_TRACKER/attributes');
        const allAttributes = response.data.items || response.data.data || response.data || [];

        const actionStatuses = allAttributes
          .filter(attr => attr.code !== 'ACTION_STATUS' && attr.code?.startsWith('ACTION_STATUS_'))
          .map(attr => ({
            id: attr.id,
            value: (attr.short_name || attr.code).toLowerCase().replace('action_status_', ''),
            label: attr.name?.replace('Action Status - ', '') || attr.name,
            code: attr.code,
            shortName: attr.short_name,
            sortOrder: attr.sort_order,
            color: getStatusColor(attr.short_name || attr.code)
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);

        setStatusOptions([
          { value: 'all', label: 'All Status', color: '#6B7280' },
          ...actionStatuses
        ]);
      } catch (err) {
        console.error('Error fetching status options:', err);
        setStatusOptions([
          { value: 'all', label: 'All Status', color: '#6B7280' },
          { value: 'pending', label: 'Pending', color: '#F59E0B' },
          { value: 'in_progress', label: 'In Progress', color: '#3B82F6' },
          { value: 'blocked', label: 'Blocked', color: '#6B7280' },
          { value: 'cancelled', label: 'Cancelled', color: '#EF4444' }
        ]);
      }
    };

    fetchStatusOptions();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, priorityFilter, showOverdueOnly, includeCompleted]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        skip: (page - 1) * limit,
        limit,
        is_overdue: showOverdueOnly,
        include_completed: includeCompleted,
      };

      if (debouncedSearch?.trim()) params.search = debouncedSearch.trim();
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter && priorityFilter !== 'all') params.priority = Number(priorityFilter);

      const response = await api.get('/action-tracker/actions/my-tasks', { params });

      if (response.data) {
        const items = Array.isArray(response.data)
          ? response.data
          : (response.data.items || []);

        setTasks(items);

        if (Array.isArray(response.data)) {
          setTotalPages(items.length < limit ? page : page + 1);
        } else {
          setTotalPages(response.data.totalPages || response.data.pages || 1);
        }
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.response?.data?.detail || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, priorityFilter, showOverdueOnly, includeCompleted]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleViewTask = (taskId) => {
    if (!isValidUUID(taskId)) return;
    navigate(`/actions/${taskId}`);
  };

  const handleRefresh = () => fetchTasks();

  const getStatusDisplay = (task) => {
    if (task.completed_at) {
      return { label: 'Completed', color: '#10B981', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> };
    }
    if (task.is_overdue) {
      return { label: 'Overdue', color: '#EF4444', icon: <WarningIcon sx={{ fontSize: 14 }} /> };
    }

    const option = statusOptions.find(
      opt => opt.value === (task.overall_status_name || '').toLowerCase() ||
        opt.shortName === task.overall_status_name ||
        opt.code === task.overall_status_name ||
        (task.overall_status_id && opt.id === task.overall_status_id)
    );

    if (option) {
      return { label: option.label, color: option.color, icon: <PendingIcon sx={{ fontSize: 14 }} /> };
    }

    return task.overall_progress_percentage === 0
      ? { label: 'Pending', color: '#F59E0B', icon: <PendingIcon sx={{ fontSize: 14 }} /> }
      : { label: 'In Progress', color: '#3B82F6', icon: <PendingIcon sx={{ fontSize: 14 }} /> };
  };

  if (loading && tasks.length === 0) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: theme.palette.primary.main }} />
        <Typography sx={{ ml: 2, color: 'text.secondary', fontSize: '0.875rem' }}>
          Loading your tasks...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 1.5, sm: 2.5 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 1.5, sm: 2.5 } }}>
        
        {/* Header Section */}
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems={{ xs: 'flex-start', sm: 'center' }} 
          mb={2} 
          flexDirection={{ xs: 'column', sm: 'row' }}
          gap={1}
        >
          <Box>
            <Typography 
              variant="h6" 
              fontWeight={700} 
              sx={{ color: 'text.primary', fontSize: { xs: '1.25rem', md: '1.5rem' }, lineHeight: 1.2 }}
            >
              My Tasks
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Track and manage assigned action items
            </Typography>
          </Box>

          <Button
            variant="outlined"
            size="small"
            onClick={handleRefresh}
            disabled={loading}
            startIcon={<Refresh fontSize="small" />}
            sx={{ alignSelf: { xs: 'flex-end', sm: 'auto' }, height: 32, textTransform: 'none', fontSize: '0.8125rem' }}
          >
            Refresh
          </Button>
        </Box>

        {/* Compact Filters Toolbar */}
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            mb: 2,
            backgroundImage: 'none',
            bgcolor: 'background.paper',
            borderColor: 'divider',
            borderRadius: 1.5
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems="stretch">
            <TextField
              fullWidth
              size="small"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                )
              }}
              sx={{ flex: 2, '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
            />

            <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ fontSize: '0.85rem' }}>Status</InputLabel>
                <Select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)} 
                  label="Status"
                  sx={{ fontSize: '0.85rem' }}
                >
                  {statusOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.85rem' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: opt.color }} />
                        {opt.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel sx={{ fontSize: '0.85rem' }}>Priority</InputLabel>
                <Select 
                  value={priorityFilter} 
                  onChange={(e) => setPriorityFilter(e.target.value)} 
                  label="Priority"
                  sx={{ fontSize: '0.85rem' }}
                >
                  <MenuItem value="all" sx={{ fontSize: '0.85rem' }}>All Priorities</MenuItem>
                  <MenuItem value="1" sx={{ fontSize: '0.85rem' }}>High</MenuItem>
                  <MenuItem value="2" sx={{ fontSize: '0.85rem' }}>Medium</MenuItem>
                  <MenuItem value="3" sx={{ fontSize: '0.85rem' }}>Low</MenuItem>
                  <MenuItem value="4" sx={{ fontSize: '0.85rem' }}>Very Low</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
              <ToggleButton
                value="overdue"
                selected={showOverdueOnly}
                onChange={() => setShowOverdueOnly(v => !v)}
                size="small"
                fullWidth={isMobile}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.775rem',
                  px: 1.5,
                  py: 0.5,
                  gap: 0.5,
                  whiteSpace: 'nowrap',
                  color: showOverdueOnly ? '#EF4444' : 'text.secondary',
                  borderColor: showOverdueOnly ? '#EF4444' : 'divider',
                  '&.Mui-selected': {
                    bgcolor: alpha('#EF4444', isDark ? 0.15 : 0.1),
                    borderColor: '#EF4444',
                    '&:hover': { bgcolor: alpha('#EF4444', isDark ? 0.22 : 0.16) }
                  }
                }}
              >
                <WarningIcon sx={{ fontSize: 16 }} />
                Overdue
              </ToggleButton>

              <ToggleButton
                value="completed"
                selected={includeCompleted}
                onChange={() => setIncludeCompleted(v => !v)}
                size="small"
                fullWidth={isMobile}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.775rem',
                  px: 1.5,
                  py: 0.5,
                  gap: 0.5,
                  whiteSpace: 'nowrap',
                  color: includeCompleted ? '#10B981' : 'text.secondary',
                  borderColor: includeCompleted ? '#10B981' : 'divider',
                  '&.Mui-selected': {
                    bgcolor: alpha('#10B981', isDark ? 0.15 : 0.1),
                    borderColor: '#10B981',
                    '&:hover': { bgcolor: alpha('#10B981', isDark ? 0.22 : 0.16) }
                  }
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 16 }} />
                Completed
              </ToggleButton>
            </Stack>
          </Stack>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Empty State */}
        {tasks.length === 0 && !loading ? (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 1.5, border: `1px solid ${theme.palette.divider}` }}>
            <Assignment sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" fontWeight={600} color="text.primary">
              No tasks found
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || showOverdueOnly
                ? 'Try adjusting your filters'
                : 'You have no assigned tasks at the moment'}
            </Typography>
          </Paper>
        ) : (
          <>
            {/* Mobile View: Cards */}
            {isMobile ? (
              <Stack spacing={1.5}>
                {tasks.map((task) => {
                  const priority = PRIORITY[task.priority] || PRIORITY[2];
                  const isOverdue = task.is_overdue && !task.completed_at;
                  const statusDisplay = getStatusDisplay(task);

                  return (
                    <Card
                      key={task.id}
                      variant="outlined"
                      onClick={() => handleViewTask(task.id)}
                      sx={{
                        borderRadius: 1.5,
                        borderColor: isOverdue ? alpha(theme.palette.error.main, 0.4) : 'divider',
                        bgcolor: isOverdue ? alpha(theme.palette.error.main, isDark ? 0.06 : 0.02) : 'background.paper',
                        cursor: 'pointer',
                        '&:active': { bgcolor: alpha(theme.palette.action.hover, 0.08) }
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1} mb={0.5}>
                          <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ lineHeight: 1.3 }}>
                            {task.title || task.description || 'Untitled'}
                          </Typography>
                          <Chip
                            label={priority.label}
                            color={priority.color}
                            size="small"
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
                          />
                        </Box>

                        {task.meeting_title && (
                          <Typography variant="caption" color="text.secondary" display="block" noWrap mb={1}>
                            Meeting: {task.meeting_title}
                          </Typography>
                        )}

                        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mt={1}>
                          <Chip
                            label={statusDisplay.label}
                            icon={statusDisplay.icon}
                            size="small"
                            sx={{
                              bgcolor: statusDisplay.color,
                              color: '#fff',
                              height: 20,
                              fontSize: '0.7rem',
                              '& .MuiChip-icon': { color: '#fff' }
                            }}
                          />

                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <AccessTime sx={{ fontSize: 13, color: isOverdue ? 'error.main' : 'text.secondary' }} />
                            <Typography variant="caption" fontWeight={isOverdue ? 600 : 400} color={isOverdue ? 'error.main' : 'text.secondary'}>
                              {formatDate(task.due_date)}
                            </Typography>
                          </Stack>
                        </Box>

                        {/* Progress Bar */}
                        <Box display="flex" alignItems="center" gap={1} mt={1.25}>
                          <Box sx={{ flex: 1, bgcolor: alpha(theme.palette.text.disabled, 0.15), borderRadius: 1, height: 4 }}>
                            <Box sx={{
                              width: `${task.overall_progress_percentage || 0}%`,
                              bgcolor: isOverdue ? 'error.main' : 'primary.main',
                              height: 4,
                              borderRadius: 1
                            }} />
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', minWidth: 24, textAlign: 'right' }}>
                            {task.overall_progress_percentage || 0}%
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            ) : (
              /* Desktop View: Compact Table */
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 650 }}>
                  <TableHead sx={{ bgcolor: isDark ? alpha(theme.palette.common.white, 0.05) : '#F8FAFC' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Task</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Meeting</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Due Date</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Priority</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Progress</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }} align="center">Actions</TableCell>
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
                            bgcolor: isOverdue ? alpha(theme.palette.error.main, isDark ? 0.08 : 0.03) : 'transparent'
                          }}
                        >
                          <TableCell sx={{ py: 1 }}>
                            <Typography variant="body2" fontWeight={600} color="text.primary">
                              {task.title || task.description || 'Untitled'}
                            </Typography>
                            {task.remarks && (
                              <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 280 }}>
                                {task.remarks}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 180 }}>
                              {task.meeting_title || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <Chip
                              label={statusDisplay.label}
                              icon={statusDisplay.icon}
                              size="small"
                              sx={{
                                bgcolor: statusDisplay.color,
                                color: '#fff',
                                height: 22,
                                fontSize: '0.725rem',
                                '& .MuiChip-icon': { color: '#fff' }
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <AccessTime sx={{ fontSize: 14, color: isOverdue ? 'error.main' : 'text.secondary' }} />
                              <Typography variant="body2" color={isOverdue ? 'error.main' : 'text.primary'} fontWeight={isOverdue ? 600 : 400}>
                                {formatDate(task.due_date)}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <Chip label={priority.label} color={priority.color} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                          </TableCell>
                          <TableCell sx={{ minWidth: 100, py: 1 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Box sx={{ flex: 1, bgcolor: alpha(theme.palette.text.disabled, 0.2), borderRadius: 1, height: 4 }}>
                                <Box sx={{
                                  width: `${task.overall_progress_percentage || 0}%`,
                                  bgcolor: isOverdue ? 'error.main' : 'primary.main',
                                  height: 4,
                                  borderRadius: 1
                                }} />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {task.overall_progress_percentage || 0}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center" sx={{ py: 1 }}>
                            <Tooltip title="View Details">
                              <IconButton size="small" onClick={() => handleViewTask(task.id)} color="primary">
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
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Stack alignItems="center" mt={2}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, val) => setPage(val)}
                  color="primary"
                  size={isMobile ? 'small' : 'medium'}
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