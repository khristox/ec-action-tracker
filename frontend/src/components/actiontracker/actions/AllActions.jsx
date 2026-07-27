// frontend/src/components/actiontracker/actions/AllActions.jsx
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
  Visibility, Search, Refresh, AccessTime, Assignment,
  Edit, Delete, CheckCircle, Pending, Flag, Schedule, Warning as WarningIcon
} from '@mui/icons-material';
import api from '../../../services/api';

// ==================== Constants & Helpers ====================
const PRIORITY_CONFIG = {
  1: { label: 'High', color: '#EF4444', bgColor: '#FEE2E2', darkBgColor: 'rgba(239, 68, 68, 0.15)', icon: <Flag sx={{ fontSize: 13 }} /> },
  2: { label: 'Medium', color: '#F59E0B', bgColor: '#FEF3C7', darkBgColor: 'rgba(245, 158, 11, 0.15)', icon: <Schedule sx={{ fontSize: 13 }} /> },
  3: { label: 'Low', color: '#10B981', bgColor: '#D1FAE5', darkBgColor: 'rgba(16, 185, 129, 0.15)', icon: <CheckCircle sx={{ fontSize: 13 }} /> },
  4: { label: 'Very Low', color: '#6B7280', bgColor: '#F3F4F6', darkBgColor: 'rgba(107, 114, 128, 0.15)', icon: <Pending sx={{ fontSize: 13 }} /> }
};

const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'Invalid date';
  }
};

const getAssignedToName = (action) => {
  if (action.assigned_to?.full_name) return action.assigned_to.full_name;
  if (action.assigned_to?.username) return action.assigned_to.username;
  if (typeof action.assigned_to_name === 'string') return action.assigned_to_name;
  if (action.assigned_to_name && typeof action.assigned_to_name === 'object') {
    return action.assigned_to_name.name || action.assigned_to_name.email || 'Unassigned';
  }
  return action.assigned_to_display_name || 'Unassigned';
};

const getStatusInfo = (action) => {
  if (action.completed_at || action.overall_progress_percentage === 100) {
    return { label: 'Completed', color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} /> };
  }
  if (action.is_overdue) {
    return { label: 'Overdue', color: 'error', icon: <WarningIcon sx={{ fontSize: 14 }} /> };
  }
  if (action.overall_progress_percentage > 0 && action.overall_progress_percentage < 100) {
    return { label: 'In Progress', color: 'info', icon: <Pending sx={{ fontSize: 14 }} /> };
  }
  return { label: 'Pending', color: 'warning', icon: <Pending sx={{ fontSize: 14 }} /> };
};

// Custom Hook: Debounce
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

const ActionMobileCard = ({ action, isDark, theme, onView, onEdit, onDelete }) => {
  const priorityInfo = PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG[2];
  const statusInfo = getStatusInfo(action);
  const assignedToName = getAssignedToName(action);
  const isOverdue = action.is_overdue && !action.completed_at;
  const progress = action.overall_progress_percentage || 0;

  return (
    <Card
      variant="outlined"
      onClick={() => onView(action.id)}
      sx={{
        mb: 1.25,
        borderRadius: 1.5,
        borderColor: isOverdue ? alpha(theme.palette.error.main, 0.3) : 'divider',
        bgcolor: isOverdue ? alpha(theme.palette.error.main, isDark ? 0.05 : 0.015) : 'background.paper',
        cursor: 'pointer',
        '&:active': { bgcolor: alpha(theme.palette.action.hover, 0.08) }
      }}
    >
      <CardHeader
        sx={{ p: 1.5, pb: 0.5 }}
        avatar={
          <Avatar sx={{
            width: 28, height: 28,
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
            fontSize: '0.75rem',
            fontWeight: 700,
            color: theme.palette.primary.main
          }}>
            {assignedToName[0]?.toUpperCase() || '?'}
          </Avatar>
        }
        title={
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'text.primary', lineHeight: 1.2 }}>
            {action.description}
          </Typography>
        }
        subheader={
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.725rem' }}>
            {action.meeting_title || 'No Meeting'} · {assignedToName}
          </Typography>
        }
        action={
          <Stack direction="row" spacing={0.25} onClick={(e) => e.stopPropagation()}>
            <IconButton size="small" onClick={() => onView(action.id)} color="primary">
              <Visibility fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => onEdit(action.id)} color="warning">
              <Edit fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => onDelete(action.id)} color="error">
              <Delete fontSize="small" />
            </IconButton>
          </Stack>
        }
      />
      <CardContent sx={{ p: 1.5, pt: 0.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
          <Chip
            label={statusInfo.label}
            size="small"
            color={statusInfo.color}
            icon={statusInfo.icon}
            sx={{ fontWeight: 600, height: 20, fontSize: '0.675rem' }}
          />
          <Chip
            label={priorityInfo.label}
            size="small"
            icon={priorityInfo.icon}
            sx={{
              bgcolor: isDark ? priorityInfo.darkBgColor : priorityInfo.bgColor,
              color: priorityInfo.color,
              fontWeight: 600, height: 20, fontSize: '0.675rem'
            }}
          />
        </Stack>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: isOverdue ? 'error.main' : 'text.secondary', fontWeight: isOverdue ? 600 : 400 }}>
            Due {formatDate(action.due_date)}
          </Typography>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            {progress}%
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 4, borderRadius: 2,
            bgcolor: alpha(theme.palette.text.disabled, 0.15),
            '& .MuiLinearProgress-bar': {
              bgcolor: isOverdue ? 'error.main' : (progress >= 100 ? 'success.main' : 'primary.main'),
              borderRadius: 2
            }
          }}
        />
      </CardContent>
    </Card>
  );
};

// ==================== Main Component ====================
const AllActions = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const limit = 10;
  const debouncedSearch = useDebounce(searchTerm, 400);

  const fetchActions = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = {
        skip: (page - 1) * limit,
        limit,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter })
      };

      const response = await api.get('/action-tracker/actions/', { params });

      if (Array.isArray(response.data)) {
        setActions(response.data);
        setTotalPages(Math.ceil(response.data.length / limit));
        setTotalItems(response.data.length);
      } else if (response.data.items) {
        setActions(response.data.items);
        setTotalPages(Math.ceil(response.data.total / limit));
        setTotalItems(response.data.total);
      } else {
        setActions([]);
        setTotalItems(0);
      }
    } catch (err) {
      console.error('Error fetching actions:', err);
      setError(err.response?.data?.detail || 'Failed to load actions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, priorityFilter]);

  const handleViewAction = (id) => navigate(`/actions/${id}`);
  const handleEditAction = (id) => navigate(`/actions/${id}/edit`);

  const handleDeleteAction = async (id) => {
    if (!window.confirm('Are you sure you want to delete this action?')) return;
    try {
      await api.delete(`/action-tracker/actions/${id}`);
      fetchActions(true);
    } catch (err) {
      console.error('Error deleting action:', err);
      setError('Failed to delete action');
    }
  };

  const stats = {
    total: totalItems,
    inProgress: actions.filter(a => a.overall_progress_percentage > 0 && a.overall_progress_percentage < 100 && !a.completed_at).length,
    completed: actions.filter(a => a.completed_at || a.overall_progress_percentage === 100).length,
    overdue: actions.filter(a => a.is_overdue && !a.completed_at).length,
  };

  if (loading && actions.length === 0) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: theme.palette.primary.main }} />
        <Typography sx={{ ml: 2, color: 'text.secondary', fontSize: '0.875rem' }}>Loading actions...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 1.5, sm: 2.5 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 1.5, sm: 2.5 } }}>

        {/* Header Section */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: 'text.primary', fontSize: { xs: '1.25rem', md: '1.5rem' }, lineHeight: 1.2 }}>
              All Actions
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Manage and track all action items across all meetings
            </Typography>
          </Box>
        </Box>

        {/* Stats Summary Section */}
        <Grid container spacing={1.25} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="Total Actions" value={stats.total} baseColor={theme.palette.primary.main} icon={<Assignment sx={{ fontSize: 22 }} />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="In Progress" value={stats.inProgress} baseColor={theme.palette.warning.main} icon={<Pending sx={{ fontSize: 22 }} />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="Completed" value={stats.completed} baseColor={theme.palette.success.main} icon={<CheckCircle sx={{ fontSize: 22 }} />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard label="Overdue" value={stats.overdue} baseColor={theme.palette.error.main} icon={<WarningIcon sx={{ fontSize: 22 }} />} />
          </Grid>
        </Grid>

        {/* Filters & Toolbar */}
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
              placeholder="Search actions by description..."
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
                <InputLabel sx={{ fontSize: '0.85rem' }}>Status</InputLabel>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status" sx={{ fontSize: '0.85rem' }}>
                  <MenuItem value="all" sx={{ fontSize: '0.85rem' }}>All Statuses</MenuItem>
                  <MenuItem value="pending" sx={{ fontSize: '0.85rem' }}>Pending</MenuItem>
                  <MenuItem value="in_progress" sx={{ fontSize: '0.85rem' }}>In Progress</MenuItem>
                  <MenuItem value="completed" sx={{ fontSize: '0.85rem' }}>Completed</MenuItem>
                  <MenuItem value="overdue" sx={{ fontSize: '0.85rem' }}>Overdue</MenuItem>
                </Select>
              </FormControl>

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
            </Stack>

            <Button
              variant="outlined"
              size="small"
              startIcon={refreshing ? <CircularProgress size={14} /> : <Refresh fontSize="small" />}
              onClick={() => fetchActions(true)}
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

        {/* Actions Table / Mobile List */}
        {actions.length === 0 && !loading ? (
          <Paper
            sx={{
              p: 4,
              textAlign: 'center',
              bgcolor: 'background.paper',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1.5
            }}
          >
            <Assignment sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" fontWeight={600} color="text.primary">
              No Actions Found
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No action items have been created yet'}
            </Typography>
          </Paper>
        ) : isMobile ? (
          <>
            <Box>
              {actions.map((action) => (
                <ActionMobileCard
                  key={action.id}
                  action={action}
                  isDark={isDark}
                  theme={theme}
                  onView={handleViewAction}
                  onEdit={handleEditAction}
                  onDelete={handleDeleteAction}
                />
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
              <Table size="small" sx={{ minWidth: isTablet ? 650 : 800 }}>
                <TableHead sx={{ bgcolor: isDark ? alpha(theme.palette.common.white, 0.05) : '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>Description</TableCell>
                    {!isTablet && <TableCell sx={{ fontWeight: 600, py: 1 }}>Meeting</TableCell>}
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>Assigned To</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>Due Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>Status</TableCell>
                    {!isTablet && <TableCell sx={{ fontWeight: 600, py: 1 }}>Progress</TableCell>}
                    <TableCell sx={{ fontWeight: 600, py: 1 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {actions.map((action) => {
                    const priorityConfig = PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG[2];
                    const statusInfo = getStatusInfo(action);
                    const assignedToName = getAssignedToName(action);
                    const isOverdue = action.is_overdue && !action.completed_at;
                    const progress = action.overall_progress_percentage || 0;

                    return (
                      <TableRow
                        key={action.id}
                        hover
                        sx={{
                          bgcolor: isOverdue ? alpha(theme.palette.error.main, isDark ? 0.06 : 0.02) : 'transparent'
                        }}
                      >
                        <TableCell sx={{ py: 1 }}>
                          <Typography variant="body2" fontWeight={600} color="text.primary">
                            {action.description}
                          </Typography>
                          {action.remarks && (
                            <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 260 }}>
                              {action.remarks}
                            </Typography>
                          )}
                          {isTablet && (
                            <Typography variant="caption" color="text.secondary" display="block" noWrap>
                              {action.meeting_title || '—'}
                            </Typography>
                          )}
                        </TableCell>
                        {!isTablet && (
                          <TableCell sx={{ py: 1 }}>
                            {action.meeting_title ? (
                              <Chip
                                label={action.meeting_title}
                                size="small"
                                variant="outlined"
                                onClick={() => navigate(`/meetings/${action.meeting_id}`)}
                                sx={{
                                  cursor: 'pointer',
                                  height: 22,
                                  fontSize: '0.725rem',
                                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
                                }}
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                        )}
                        <TableCell sx={{ py: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar sx={{
                              width: 24, height: 24,
                              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: theme.palette.primary.main
                            }}>
                              {assignedToName[0]?.toUpperCase() || '?'}
                            </Avatar>
                            <Typography variant="body2" color="text.primary">{assignedToName}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <AccessTime sx={{ fontSize: 14, color: isOverdue ? 'error.main' : 'text.secondary' }} />
                            <Typography variant="body2" color={isOverdue ? 'error.main' : 'text.primary'} fontWeight={isOverdue ? 600 : 400}>
                              {formatDate(action.due_date)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          <Chip
                            label={priorityConfig.label}
                            size="small"
                            icon={priorityConfig.icon}
                            sx={{
                              bgcolor: isDark ? priorityConfig.darkBgColor : priorityConfig.bgColor,
                              color: priorityConfig.color,
                              fontWeight: 600, height: 20, fontSize: '0.7rem'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          <Chip
                            label={statusInfo.label}
                            size="small"
                            color={statusInfo.color}
                            icon={statusInfo.icon}
                            sx={{ fontWeight: 600, height: 20, fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        {!isTablet && (
                          <TableCell sx={{ minWidth: 100, py: 1 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Box sx={{ flex: 1, bgcolor: alpha(theme.palette.text.disabled, 0.2), borderRadius: 1, height: 4 }}>
                                <Box sx={{
                                  width: `${progress}%`,
                                  bgcolor: isOverdue ? 'error.main' : (progress >= 100 ? 'success.main' : 'primary.main'),
                                  height: 4, borderRadius: 1
                                }} />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {progress}%
                              </Typography>
                            </Box>
                          </TableCell>
                        )}
                        <TableCell align="center" sx={{ py: 1 }}>
                          <Stack direction="row" spacing={0.25} justifyContent="center">
                            <Tooltip title="View Details">
                              <IconButton size="small" onClick={() => handleViewAction(action.id)} color="primary">
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleEditAction(action.id)} color="warning">
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDeleteAction(action.id)} color="error">
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
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

export default AllActions;