// src/components/actiontracker/actions/OverdueActions.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Alert, CircularProgress, Pagination,
  TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Card, CardContent, CardHeader, Grid, LinearProgress, Avatar,
  useTheme, useMediaQuery, alpha
} from '@mui/material';
import {
  Visibility, AccessTime, Warning, Search, Refresh,
  CheckCircle, Pending, Schedule, Flag, TrendingUp
} from '@mui/icons-material';
import api from '../../../services/api';

// ==================== Constants & Helpers ====================
const PRIORITY = {
  1: { label: 'High', color: '#EF4444', bgColor: '#FEE2E2', darkBgColor: 'rgba(239, 68, 68, 0.15)', icon: <Flag sx={{ fontSize: 14 }} /> },
  2: { label: 'Medium', color: '#F59E0B', bgColor: '#FEF3C7', darkBgColor: 'rgba(245, 158, 11, 0.15)', icon: <Schedule sx={{ fontSize: 14 }} /> },
  3: { label: 'Low', color: '#10B981', bgColor: '#D1FAE5', darkBgColor: 'rgba(16, 185, 129, 0.15)', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  4: { label: 'Very Low', color: '#6B7280', bgColor: '#F3F4F6', darkBgColor: 'rgba(107, 114, 128, 0.15)', icon: <Pending sx={{ fontSize: 14 }} /> }
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
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getAssignedToName = (task) => {
  if (task.assigned_to?.full_name) return task.assigned_to.full_name;
  if (task.assigned_to?.username) return task.assigned_to.username;
  if (typeof task.assigned_to_name === 'string') return task.assigned_to_name;
  if (task.assigned_to_name && typeof task.assigned_to_name === 'object') {
    return task.assigned_to_name.name || task.assigned_to_name.email || 'Unassigned';
  }
  return 'Unassigned';
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

// ==================== Sub-Components ====================
const StyledStatCard = ({ label, value, baseColor, icon }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        backgroundImage: 'none',
        bgcolor: isDark ? alpha(baseColor, 0.1) : alpha(baseColor, 0.06),
        borderColor: isDark ? alpha(baseColor, 0.25) : alpha(baseColor, 0.18),
        borderRadius: 1.5,
      }}
    >
      <CardContent sx={{ p: { xs: 1.25, sm: 1.5 }, '&:last-child': { pb: { xs: 1.25, sm: 1.5 } } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{
              fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
              color: isDark ? alpha(baseColor, 0.95) : baseColor,
              lineHeight: 1
            }}
          >
            {value}
          </Typography>
          {icon && (
            <Box sx={{ color: isDark ? alpha(baseColor, 0.7) : baseColor, display: 'flex' }}>
              {icon}
            </Box>
          )}
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mt: 0.5, display: 'block' }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
};

const OverdueTaskCard = ({ task, isDark, theme, onView }) => {
  const priorityConfig = PRIORITY[task.priority] || PRIORITY[2];
  const overdueDays = getOverdueDays(task.due_date);
  const progress = task.overall_progress_percentage || 0;
  const assignedToName = getAssignedToName(task);

  return (
    <Card
      variant="outlined"
      onClick={() => onView(task.id)}
      sx={{
        mb: 1.25,
        borderRadius: 1.5,
        borderColor: alpha(theme.palette.error.main, isDark ? 0.3 : 0.2),
        bgcolor: alpha(theme.palette.error.main, isDark ? 0.05 : 0.015),
        cursor: 'pointer',
        '&:active': { bgcolor: alpha(theme.palette.action.hover, 0.08) }
      }}
    >
      <CardHeader
        sx={{ p: 1.5, pb: 0.5 }}
        avatar={
          <Avatar sx={{
            width: 28, height: 28,
            bgcolor: alpha(theme.palette.error.main, isDark ? 0.2 : 0.1),
            fontSize: '0.75rem',
            fontWeight: 700,
            color: theme.palette.error.main
          }}>
            {assignedToName[0]?.toUpperCase() || '?'}
          </Avatar>
        }
        title={
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'text.primary', lineHeight: 1.2 }}>
            {task.description}
          </Typography>
        }
        subheader={
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.725rem' }}>
            {task.meeting_title || 'No Meeting'} · {assignedToName}
          </Typography>
        }
        action={
          <Tooltip title="View Details">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onView(task.id); }} color="primary">
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent sx={{ p: 1.5, pt: 0.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
          <Chip
            label={`${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`}
            size="small"
            icon={<AccessTime sx={{ fontSize: 13 }} />}
            sx={{ bgcolor: alpha(theme.palette.error.main, isDark ? 0.15 : 0.1), color: theme.palette.error.main, fontWeight: 600, height: 20, fontSize: '0.675rem' }}
          />
          <Chip
            label={priorityConfig.label}
            size="small"
            icon={priorityConfig.icon}
            sx={{ bgcolor: isDark ? priorityConfig.darkBgColor : priorityConfig.bgColor, color: priorityConfig.color, fontWeight: 600, height: 20, fontSize: '0.675rem' }}
          />
        </Stack>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
            Due {formatDate(task.due_date)}
          </Typography>
          <Typography variant="caption" fontWeight={600} sx={{ color: progress >= 50 ? 'success.main' : 'error.main' }}>
            {progress}%
          </Typography>
        </Box>
        
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 4, borderRadius: 2,
            bgcolor: alpha(theme.palette.error.main, 0.15),
            '& .MuiLinearProgress-bar': {
              bgcolor: progress >= 100 ? 'success.main' : (progress >= 50 ? 'warning.main' : 'error.main'),
              borderRadius: 2
            }
          }}
        />
      </CardContent>
    </Card>
  );
};

// ==================== Main Component ====================
const OverdueActions = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('overdue_days');
  const [page, setPage] = useState(1);
  const limit = 10;

  const debouncedSearch = useDebounce(searchTerm, 400);

  const fetchOverdueActions = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      try {
        const response = await api.get('/action-tracker/actions/overdue');
        const data = Array.isArray(response.data) ? response.data : (response.data?.items || []);
        if (data.length > 0 || response.status === 200) {
          setActions(data);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      } catch (overdueErr) {
        console.log('Overdue endpoint failed, falling back to my-tasks:', overdueErr.message);
      }

      const response = await api.get('/action-tracker/actions/my-tasks', {
        params: { include_completed: false, limit: 500 }
      });

      const allActions = Array.isArray(response.data) ? response.data : (response.data?.items || []);
      const now = new Date();
      const overdue = allActions.filter(action => {
        if (!action.due_date || action.completed_at) return false;
        return new Date(action.due_date) < now;
      });

      setActions(overdue);
    } catch (err) {
      console.error('Error fetching overdue actions:', err);
      setError(err.response?.data?.detail || 'Failed to load overdue actions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverdueActions();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, priorityFilter, sortBy]);

  const getFilteredAndSortedTasks = useCallback(() => {
    let tasks = [...actions];

    if (debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      tasks = tasks.filter(task =>
        task.description?.toLowerCase().includes(term) ||
        task.meeting_title?.toLowerCase().includes(term)
      );
    }

    if (priorityFilter !== 'all') {
      tasks = tasks.filter(task => task.priority === parseInt(priorityFilter));
    }

    const sortedTasks = [...tasks];
    sortedTasks.sort((a, b) => {
      switch (sortBy) {
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
  }, [actions, debouncedSearch, priorityFilter, sortBy]);

  const filteredTasks = getFilteredAndSortedTasks();
  const totalPages = Math.ceil(filteredTasks.length / limit);
  const paginatedTasks = filteredTasks.slice((page - 1) * limit, page * limit);

  const stats = {
    total: filteredTasks.length,
    highPriority: filteredTasks.filter(t => t.priority === 1).length,
    mediumPriority: filteredTasks.filter(t => t.priority === 2).length,
    avgProgress: filteredTasks.length > 0
      ? Math.round(filteredTasks.reduce((sum, t) => sum + (t.overall_progress_percentage || 0), 0) / filteredTasks.length)
      : 0
  };

  const handleViewTask = (taskId) => navigate(`/actions/${taskId}`);

  if (loading && actions.length === 0) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: theme.palette.primary.main }} />
        <Typography sx={{ ml: 2, color: 'text.secondary', fontSize: '0.875rem' }}>Loading overdue actions...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 1.5, sm: 2.5 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 1.5, sm: 2.5 } }}>
        
        {/* Header Section */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Warning sx={{ fontSize: { xs: 24, sm: 28 }, color: theme.palette.error.main }} />
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: 'text.primary', fontSize: { xs: '1.25rem', md: '1.5rem' }, lineHeight: 1.2 }}>
                Overdue Actions
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Actions past due date requiring immediate attention
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Stats Summary Section */}
        <Grid container spacing={1.25} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="Total Overdue" value={stats.total} baseColor={theme.palette.error.main} icon={<Warning sx={{ fontSize: 22 }} />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="High Priority" value={stats.highPriority} baseColor="#EF4444" icon={<Flag sx={{ fontSize: 22 }} />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="Medium Priority" value={stats.mediumPriority} baseColor="#F59E0B" icon={<Schedule sx={{ fontSize: 22 }} />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="Avg Progress" value={`${stats.avgProgress}%`} baseColor={theme.palette.success.main} icon={<TrendingUp sx={{ fontSize: 22 }} />} />
          </Grid>
        </Grid>

        {/* Filters & Actions Bar */}
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
              placeholder="Search actions or meetings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 2, '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
            />

            <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ fontSize: '0.85rem' }}>Priority</InputLabel>
                <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} label="Priority" sx={{ fontSize: '0.85rem' }}>
                  <MenuItem value="all" sx={{ fontSize: '0.85rem' }}>All Priorities</MenuItem>
                  <MenuItem value="1" sx={{ fontSize: '0.85rem' }}>High</MenuItem>
                  <MenuItem value="2" sx={{ fontSize: '0.85rem' }}>Medium</MenuItem>
                  <MenuItem value="3" sx={{ fontSize: '0.85rem' }}>Low</MenuItem>
                  <MenuItem value="4" sx={{ fontSize: '0.85rem' }}>Very Low</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel sx={{ fontSize: '0.85rem' }}>Sort By</InputLabel>
                <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} label="Sort By" sx={{ fontSize: '0.85rem' }}>
                  <MenuItem value="overdue_days" sx={{ fontSize: '0.85rem' }}>Most Overdue First</MenuItem>
                  <MenuItem value="due_date_asc" sx={{ fontSize: '0.85rem' }}>Due Date (Earliest)</MenuItem>
                  <MenuItem value="priority" sx={{ fontSize: '0.85rem' }}>Priority (Highest)</MenuItem>
                  <MenuItem value="progress" sx={{ fontSize: '0.85rem' }}>Progress (Lowest)</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Button
              variant="outlined"
              size="small"
              startIcon={refreshing ? <CircularProgress size={14} /> : <Refresh fontSize="small" />}
              onClick={() => fetchOverdueActions(true)}
              disabled={refreshing}
              sx={{
                height: 38,
                textTransform: 'none',
                fontSize: '0.8125rem',
                minWidth: { xs: '100%', md: 100 }
              }}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Stack>
        </Paper>

        {/* Error Notification */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* List / Table Content */}
        {filteredTasks.length === 0 && !loading ? (
          <Paper
            sx={{
              p: 4,
              textAlign: 'center',
              bgcolor: 'background.paper',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1.5
            }}
          >
            <CheckCircle sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
            <Typography variant="body1" fontWeight={600} color="text.primary">
              No Overdue Actions
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {searchTerm || priorityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'All assigned tasks are on track! Great job!'}
            </Typography>
          </Paper>
        ) : isMobile ? (
          <>
            <Box>
              {paginatedTasks.map((task) => (
                <OverdueTaskCard key={task.id} task={task} isDark={isDark} theme={theme} onView={handleViewTask} />
              ))}
            </Box>
            {totalPages > 1 && (
              <Stack alignItems="center" mt={2}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, val) => setPage(val)}
                  color="primary"
                  size="small"
                />
              </Stack>
            )}
          </>
        ) : (
          <>
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: 1.5, overflowX: 'auto' }}
            >
              <Table size="small" sx={{ minWidth: isTablet ? 600 : 750 }}>
                <TableHead sx={{ bgcolor: isDark ? alpha(theme.palette.common.white, 0.05) : '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>Description</TableCell>
                    {!isTablet && <TableCell sx={{ fontWeight: 600, py: 1 }}>Meeting</TableCell>}
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>Assigned To</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>Due Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>Overdue</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>Priority</TableCell>
                    {!isTablet && <TableCell sx={{ fontWeight: 600, py: 1 }}>Progress</TableCell>}
                    <TableCell sx={{ fontWeight: 600, py: 1 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedTasks.map((task) => {
                    const priorityConfig = PRIORITY[task.priority] || PRIORITY[2];
                    const overdueDays = getOverdueDays(task.due_date);
                    const progress = task.overall_progress_percentage || 0;
                    const assignedToName = getAssignedToName(task);

                    return (
                      <TableRow
                        key={task.id}
                        hover
                        sx={{
                          bgcolor: alpha(theme.palette.error.main, isDark ? 0.06 : 0.02)
                        }}
                      >
                        <TableCell sx={{ py: 1 }}>
                          <Typography variant="body2" fontWeight={600} color="text.primary">
                            {task.description}
                          </Typography>
                          {task.remarks && (
                            <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 260 }}>
                              {task.remarks}
                            </Typography>
                          )}
                          {isTablet && (
                            <Typography variant="caption" color="text.secondary" display="block" noWrap>
                              {task.meeting_title || '—'}
                            </Typography>
                          )}
                        </TableCell>
                        {!isTablet && (
                          <TableCell sx={{ py: 1 }}>
                            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 160 }}>
                              {task.meeting_title || '—'}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell sx={{ py: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar sx={{
                              width: 24, height: 24,
                              bgcolor: alpha(theme.palette.error.main, isDark ? 0.2 : 0.1),
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: theme.palette.error.main
                            }}>
                              {assignedToName[0]?.toUpperCase() || '?'}
                            </Avatar>
                            <Typography variant="body2" color="text.primary">{assignedToName}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <AccessTime sx={{ fontSize: 14, color: 'error.main' }} />
                            <Typography variant="body2" color="error.main" fontWeight={600}>
                              {formatDate(task.due_date)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          <Chip
                            label={`${overdueDays} day${overdueDays !== 1 ? 's' : ''}`}
                            size="small"
                            sx={{
                              bgcolor: alpha(theme.palette.error.main, isDark ? 0.15 : 0.1),
                              color: theme.palette.error.main,
                              fontWeight: 600,
                              height: 20,
                              fontSize: '0.7rem'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          <Chip
                            label={priorityConfig.label}
                            size="small"
                            icon={priorityConfig.icon}
                            sx={{
                              bgcolor: isDark ? priorityConfig.darkBgColor : priorityConfig.bgColor,
                              color: priorityConfig.color,
                              fontWeight: 600,
                              height: 20,
                              fontSize: '0.7rem'
                            }}
                          />
                        </TableCell>
                        {!isTablet && (
                          <TableCell sx={{ minWidth: 100, py: 1 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Box sx={{ flex: 1, bgcolor: alpha(theme.palette.error.main, 0.2), borderRadius: 1, height: 4 }}>
                                <Box sx={{
                                  width: `${progress}%`,
                                  bgcolor: progress >= 100 ? 'success.main' : (progress >= 50 ? 'warning.main' : 'error.main'),
                                  height: 4,
                                  borderRadius: 1
                                }} />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {progress}%
                              </Typography>
                            </Box>
                          </TableCell>
                        )}
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

            {totalPages > 1 && (
              <Stack alignItems="center" mt={2}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, val) => setPage(val)}
                  color="primary"
                  size="medium"
                />
              </Stack>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};

export default OverdueActions;