// src/components/actiontracker/actions/OverdueActions.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Alert, CircularProgress, Pagination,
  TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Card, CardContent, Grid, LinearProgress, Avatar, useTheme, alpha
} from '@mui/material';
import {
  Visibility, AccessTime, Assignment, Warning, Search, Refresh,
  CheckCircle, Pending, Person, Schedule, Flag, Error as ErrorIcon,
  TrendingUp, PlayCircle, TaskAlt
} from '@mui/icons-material';
import api from '../../../services/api';

// ==================== Constants & Helpers ====================
const PRIORITY = {
  1: { label: 'High', color: '#EF4444', bgColor: '#FEE2E2', darkBgColor: 'rgba(239, 68, 68, 0.15)', icon: <Flag fontSize="small" /> },
  2: { label: 'Medium', color: '#F59E0B', bgColor: '#FEF3C7', darkBgColor: 'rgba(245, 158, 11, 0.15)', icon: <Schedule fontSize="small" /> },
  3: { label: 'Low', color: '#10B981', bgColor: '#D1FAE5', darkBgColor: 'rgba(16, 185, 129, 0.15)', icon: <CheckCircle fontSize="small" /> },
  4: { label: 'Very Low', color: '#6B7280', bgColor: '#F3F4F6', darkBgColor: 'rgba(107, 114, 128, 0.15)', icon: <Pending fontSize="small" /> }
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

// ==================== Styled Components ====================
const StyledStatCard = ({ label, value, baseColor, icon }) => {
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
        <Stack direction="row" justifyContent="space-between" alignItems="center">
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
          {icon && (
            <Box sx={{ color: isDark ? alpha(baseColor, 0.6) : baseColor }}>
              {icon}
            </Box>
          )}
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, mt: 1 }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
};

// ==================== Main Component ====================
const OverdueActions = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
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

  // Filter and sort tasks
  const getFilteredAndSortedTasks = useCallback(() => {
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
    
    // Apply sorting
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
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: theme.palette.primary.main }} />
        <Typography sx={{ ml: 2, color: theme.palette.text.secondary }}>Loading overdue actions...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 2, sm: 3, md: 4 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
        {/* Header */}
        <Box mb={4}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Warning sx={{ fontSize: 40, color: theme.palette.error.main }} />
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary', fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' } }}>
                Overdue Actions
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Actions that have passed their due date and require immediate attention
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={6} sm={3}>
            <StyledStatCard 
              label="Total Overdue" 
              value={stats.total} 
              baseColor={theme.palette.error.main}
              icon={<Warning sx={{ fontSize: 28 }} />}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard 
              label="High Priority" 
              value={stats.highPriority} 
              baseColor="#EF4444"
              icon={<Flag sx={{ fontSize: 28 }} />}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard 
              label="Medium Priority" 
              value={stats.mediumPriority} 
              baseColor="#F59E0B"
              icon={<Schedule sx={{ fontSize: 28 }} />}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard 
              label="Avg Progress" 
              value={`${stats.avgProgress}%`} 
              baseColor={theme.palette.success.main}
              icon={<TrendingUp sx={{ fontSize: 28 }} />}
            />
          </Grid>
        </Grid>

        {/* Filters */}
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
              placeholder="Search by description or meeting..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 2 }}
            />

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

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sort By</InputLabel>
              <Select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)} 
                label="Sort By"
              >
                <MenuItem value="overdue_days">Most Overdue First</MenuItem>
                <MenuItem value="due_date_asc">Due Date (Earliest First)</MenuItem>
                <MenuItem value="priority">Priority (Highest First)</MenuItem>
                <MenuItem value="progress">Progress (Lowest First)</MenuItem>
              </Select>
            </FormControl>

            <Button 
              variant="outlined" 
              startIcon={<Refresh />} 
              onClick={fetchOverdueActions}
              sx={{ 
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.05)
                }
              }}
            >
              Refresh
            </Button>
          </Stack>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {filteredTasks.length === 0 && !loading ? (
          <Paper 
            sx={{ 
              p: 6, 
              textAlign: 'center',
              bgcolor: 'background.paper',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2
            }}
          >
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" fontWeight={600} sx={{ color: 'text.primary' }}>
              No Overdue Actions
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {searchTerm || priorityFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'All actions are on track! Great job!'}
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
              <Table size="small" sx={{ minWidth: 800 }}>
                <TableHead sx={{ bgcolor: alpha(theme.palette.error.main, isDark ? 0.1 : 0.05) }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary', whiteSpace: 'nowrap' }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary', whiteSpace: 'nowrap' }}>Meeting</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary', whiteSpace: 'nowrap' }}>Assigned To</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary', whiteSpace: 'nowrap' }}>Due Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary', whiteSpace: 'nowrap' }}>Overdue</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary', whiteSpace: 'nowrap' }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary', whiteSpace: 'nowrap' }}>Progress</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary', whiteSpace: 'nowrap' }} align="center">Actions</TableCell>
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
                        sx={{ 
                          bgcolor: alpha(theme.palette.error.main, isDark ? 0.05 : 0.02),
                          transition: 'background-color 0.2s',
                          '&:hover': { 
                            bgcolor: alpha(theme.palette.error.main, isDark ? 0.1 : 0.05)
                          }
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary' }}>
                            {task.description}
                          </Typography>
                          {task.remarks && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                              {task.remarks.length > 80 ? task.remarks.substring(0, 80) + '...' : task.remarks}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {task.meeting_title || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar sx={{ 
                              width: 28, 
                              height: 28, 
                              bgcolor: alpha(theme.palette.error.main, isDark ? 0.2 : 0.1), 
                              fontSize: '0.75rem', 
                              color: theme.palette.error.main 
                            }}>
                              {assignedToName[0]?.toUpperCase() || '?'}
                            </Avatar>
                            <Typography variant="body2" sx={{ color: 'text.primary' }}>{assignedToName}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <AccessTime fontSize="small" sx={{ color: 'error.main' }} />
                            <Typography sx={{ color: 'error.main', fontWeight: 500 }}>
                              {formatDate(task.due_date)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={`${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`}
                            size="small"
                            sx={{ 
                              bgcolor: alpha(theme.palette.error.main, isDark ? 0.15 : 0.1), 
                              color: theme.palette.error.main, 
                              fontWeight: 500 
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={priorityConfig.label}
                            size="small"
                            icon={priorityConfig.icon}
                            sx={{ 
                              bgcolor: isDark ? priorityConfig.darkBgColor : priorityConfig.bgColor, 
                              color: priorityConfig.color, 
                              fontWeight: 500 
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <Stack spacing={0.5}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" fontWeight={500} sx={{ color: progress >= 50 ? 'success.main' : 'error.main' }}>
                                {progress}%
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={progress} 
                              sx={{ 
                                height: 6, 
                                borderRadius: 3,
                                bgcolor: alpha(theme.palette.error.main, 0.2),
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: progress >= 100 ? 'success.main' : (progress >= 50 ? 'warning.main' : 'error.main'),
                                  borderRadius: 3
                                }
                              }} 
                            />
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="View Details">
                            <IconButton 
                              size="small" 
                              onClick={() => handleViewTask(task.id)} 
                              sx={{ color: 'primary.main' }}
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
                      color: theme.palette.text.primary,
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

export default OverdueActions;