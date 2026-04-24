// frontend/src/components/actiontracker/actions/AllActions.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Stack, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Alert, CircularProgress, Pagination,
  TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Card, CardContent, Grid, LinearProgress, useTheme, alpha
} from '@mui/material';
import {
  Visibility, Search, Refresh, AccessTime, Assignment,
  Edit, Delete, CheckCircle, Pending, Cancel, Warning as WarningIcon
} from '@mui/icons-material';
import api from '../../../services/api';

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

const AllActions = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
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
      setError('Failed to delete action');
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

  const getStatusInfo = (action) => {
    if (action.completed_at || action.overall_progress_percentage === 100) {
      return { label: 'Completed', color: 'success', icon: <CheckCircle fontSize="small" /> };
    }
    if (action.is_overdue) {
      return { label: 'Overdue', color: 'error', icon: <WarningIcon fontSize="small" /> };
    }
    if (action.overall_progress_percentage > 0 && action.overall_progress_percentage < 100) {
      return { label: 'In Progress', color: 'info', icon: <Pending fontSize="small" /> };
    }
    return { label: 'Pending', color: 'warning', icon: <Pending fontSize="small" /> };
  };

  const stats = {
    total: totalItems,
    inProgress: actions.filter(a => a.overall_progress_percentage > 0 && a.overall_progress_percentage < 100 && !a.completed_at).length,
    completed: actions.filter(a => a.completed_at || a.overall_progress_percentage === 100).length,
    overdue: actions.filter(a => a.is_overdue && !a.completed_at).length,
  };

  if (loading && actions.length === 0) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: theme.palette.primary.main }} />
        <Typography sx={{ ml: 2, color: theme.palette.text.secondary }}>Loading actions...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 2, sm: 3, md: 4 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
        {/* Header */}
        <Box mb={4}>
          <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary', fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' } }}>
            All Actions
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Manage and track all action items across all meetings
          </Typography>
        </Box>

        {/* Stats Overview */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={6} sm={3}>
            <StyledStatCard 
              label="Total Actions" 
              value={stats.total} 
              baseColor={theme.palette.primary.main}
              icon={<Assignment sx={{ fontSize: 28 }} />}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard 
              label="In Progress" 
              value={stats.inProgress} 
              baseColor={theme.palette.warning.main}
              icon={<Pending sx={{ fontSize: 28 }} />}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard 
              label="Completed" 
              value={stats.completed} 
              baseColor={theme.palette.success.main}
              icon={<CheckCircle sx={{ fontSize: 28 }} />}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StyledStatCard 
              label="Overdue" 
              value={stats.overdue} 
              baseColor={theme.palette.error.main}
              icon={<WarningIcon sx={{ fontSize: 28 }} />}
            />
          </Grid>
        </Grid>

        {/* Search and Filters */}
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
              sx={{ flex: 2 }}
            />
            
            <FormControl size="small" sx={{ minWidth: 150 }}>
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
              startIcon={<Refresh />} 
              onClick={fetchActions}
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

        {/* Actions Table */}
        {actions.length === 0 ? (
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
              No Actions Found
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No action items have been created yet'}
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
                <TableHead sx={{ bgcolor: isDark ? alpha(theme.palette.common.white, 0.05) : '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Meeting</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Assigned To</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Due Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Progress</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {actions.map((action) => {
                    const priorityInfo = getPriorityInfo(action.priority);
                    const statusInfo = getStatusInfo(action);
                    const dueDate = action.due_date ? new Date(action.due_date).toLocaleDateString() : 'No due date';
                    const isOverdue = action.is_overdue && !action.completed_at;
                    
                    return (
                      <TableRow 
                        key={action.id} 
                        hover 
                        sx={{ 
                          bgcolor: isOverdue ? alpha(theme.palette.error.main, isDark ? 0.08 : 0.03) : 'transparent',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary' }}>
                            {action.description}
                          </Typography>
                          {action.remarks && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                              {action.remarks.length > 80 ? action.remarks.substring(0, 80) + '...' : action.remarks}
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
                              sx={{ 
                                cursor: 'pointer',
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.1)
                                }
                              }}
                            />
                          ) : (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {action.assigned_to_name ? (
                              <Chip
                                label={typeof action.assigned_to_name === 'string' ? action.assigned_to_name : action.assigned_to_name?.name || 'Unassigned'}
                                size="small"
                                avatar={<Assignment sx={{ fontSize: 14 }} />}
                              />
                            ) : (
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {action.assigned_to_display_name || 'Unassigned'}
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <AccessTime fontSize="small" sx={{ color: isOverdue ? 'error.main' : 'action.active' }} />
                            <Typography 
                              variant="body2" 
                              sx={{ color: isOverdue ? 'error.main' : 'text.primary' }}
                              fontWeight={isOverdue ? 600 : 400}
                            >
                              {dueDate}
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
                            label={priorityInfo.label} 
                            size="small"
                            color={priorityInfo.color}
                            sx={{ fontWeight: 500 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={statusInfo.label} 
                            size="small"
                            color={statusInfo.color}
                            icon={statusInfo.icon}
                            sx={{ 
                              '& .MuiChip-icon': { color: 'inherit' }
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box sx={{ 
                              flex: 1, 
                              bgcolor: alpha(theme.palette.text.disabled, 0.2), 
                              borderRadius: 2, 
                              height: 6,
                              overflow: 'hidden'
                            }}>
                              <Box sx={{ 
                                width: `${action.overall_progress_percentage || 0}%`, 
                                bgcolor: isOverdue ? 'error.main' : statusInfo.label === 'Completed' ? 'success.main' : 'primary.main', 
                                height: 6, 
                                borderRadius: 2,
                                transition: 'width 0.3s ease'
                              }} />
                            </Box>
                            <Typography variant="caption" fontWeight={500} sx={{ color: 'text.secondary' }}>
                              {action.overall_progress_percentage || 0}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="View Details">
                              <IconButton size="small" onClick={() => handleViewAction(action.id)}>
                                <Visibility fontSize="small" sx={{ color: 'primary.main' }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleEditAction(action.id)}>
                                <Edit fontSize="small" sx={{ color: 'warning.main' }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDeleteAction(action.id)}>
                                <Delete fontSize="small" sx={{ color: 'error.main' }} />
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
            
            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination 
                  count={totalPages} 
                  page={page} 
                  onChange={(e, value) => setPage(value)}
                  color="primary"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: theme.palette.text.primary,
                    }
                  }}
                />
              </Box>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};

export default AllActions;