import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Paper, Box, Grid, Card, CardContent,
  Button, Chip, IconButton, TextField, InputAdornment,
  Stack, LinearProgress, Avatar, Divider, Tooltip, Pagination,
  Skeleton, Alert, Grow, useTheme, useMediaQuery, alpha
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon, Assignment as AssignmentIcon,
  Schedule as ScheduleIcon, Person as PersonIcon, CheckCircle as CheckCircleIcon,
  Warning as WarningIcon, PlayCircle as PlayCircleIcon, Pending as PendingIcon,
  Visibility as VisibilityIcon, Edit as EditIcon, FilterList as FilterIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { 
  fetchMyTasks, updateActionProgress, setFilters 
} from '../../../store/slices/actionTracker/actionSlice';

const ActionsList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { myTasks, loading, filters } = useSelector((state) => state.actions);

  const fetchData = useCallback(() => {
    dispatch(fetchMyTasks({ ...filters, page: myTasks.page }));
  }, [dispatch, myTasks.page, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusFilter = (status) => {
    dispatch(setFilters({ status, page: 1 }));
  };

  const getStatusStyle = (action) => {
    if (action.completed_at) return { color: '#10b981', icon: <CheckCircleIcon fontSize="small"/>, label: 'Completed', bg: alpha('#10b981', 0.1) };
    if (action.is_overdue) return { color: '#ef4444', icon: <WarningIcon fontSize="small"/>, label: 'Overdue', bg: alpha('#ef4444', 0.1) };
    if (action.overall_progress_percentage > 0) return { color: '#3b82f6', icon: <PlayCircleIcon fontSize="small"/>, label: 'In Progress', bg: alpha('#3b82f6', 0.1) };
    return { color: '#f59e0b', icon: <PendingIcon fontSize="small"/>, label: 'Pending', bg: alpha('#f59e0b', 0.1) };
  };

  const FilterStat = ({ title, count, status, icon, color }) => {
    const isActive = filters.status === status;
    return (
      <Paper
        elevation={0}
        onClick={() => handleStatusFilter(status)}
        sx={{
          p: 2, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
          border: '1px solid',
          borderColor: isActive ? color : '#e2e8f0',
          bgcolor: isActive ? alpha(color, 0.05) : 'white',
          transition: 'all 0.2s ease',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderColor: color }
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
          <Avatar sx={{ bgcolor: alpha(color, 0.1), color: color, width: 32, height: 32 }}>
            {React.cloneElement(icon, { sx: { fontSize: 18 } })}
          </Avatar>
          <Box textAlign="left">
            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1 }}>{count}</Typography>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
              {title}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    );
  };

  const ActionCard = ({ action, index }) => {
    const style = getStatusStyle(action);
    
    return (
      <Grow in timeout={index * 100}>
        <Card sx={{ 
          mb: 2.5, borderRadius: 3, 
          transition: 'box-shadow 0.3s',
          border: '1px solid #e2e8f0',
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 8px 24px rgba(149, 157, 165, 0.1)', borderColor: alpha(style.color, 0.3) }
        }}>
          <CardContent sx={{ p: '24px !important' }}>
            {/* Top Row: ID & Status */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Chip 
                label={style.label} 
                size="small" 
                sx={{ bgcolor: style.bg, color: style.color, fontWeight: 800, fontSize: '0.65rem', height: 24 }} 
              />
              <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                #{action.id.slice(0, 8).toUpperCase()}
              </Typography>
            </Stack>

            {/* Middle: Title & Meta */}
            <Typography 
              variant="h6" fontWeight={800} mb={1.5}
              sx={{ color: '#1e293b', cursor: 'pointer', '&:hover': { color: theme.palette.primary.main } }}
              onClick={() => navigate(`/actions/${action.id}`)}
            >
              {action.description}
            </Typography>

            <Stack direction="row" spacing={1.5} mb={3} flexWrap="wrap">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <ScheduleIcon sx={{ fontSize: 14, color: action.is_overdue ? 'error.main' : '#64748b' }} />
                <Typography variant="caption" fontWeight={600} color={action.is_overdue ? 'error.main' : 'text.secondary'}>
                   Due: {new Date(action.due_date).toLocaleDateString()}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <PersonIcon sx={{ fontSize: 14, color: '#64748b' }} />
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  {action.assigned_by_name || 'Admin'}
                </Typography>
              </Stack>
            </Stack>

            {/* Bottom Row: Progress and Actions */}
            <Grid container alignItems="center" spacing={3}>
              <Grid item xs={12} sm={8}>
                 <Box>
                    <Stack direction="row" justifyContent="space-between" mb={1}>
                      <Typography variant="caption" fontWeight={800} sx={{ color: '#475569' }}>Current Progress</Typography>
                      <Typography variant="caption" fontWeight={800} sx={{ color: style.color }}>{action.overall_progress_percentage}%</Typography>
                    </Stack>
                    <LinearProgress 
                      variant="determinate" 
                      value={action.overall_progress_percentage} 
                      sx={{ height: 8, borderRadius: 4, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: style.color, borderRadius: 4 } }}
                    />
                 </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Stack direction="row" spacing={1} justifyContent={isMobile ? 'flex-start' : 'flex-end'}>
                  <Tooltip title="View"><IconButton size="small" sx={{ border: '1px solid #e2e8f0' }} onClick={() => navigate(`/actions/${action.id}`)}><VisibilityIcon fontSize="small" color="primary"/></IconButton></Tooltip>
                  <Tooltip title="Edit"><IconButton size="small" sx={{ border: '1px solid #e2e8f0' }} onClick={() => navigate(`/actions/${action.id}/edit`)}><EditIcon fontSize="small"/></IconButton></Tooltip>
                  {action.overall_progress_percentage < 100 && (
                    <Button 
                      variant="outlined" 
                      color="success" 
                      size="small"
                      startIcon={<TrendingUpIcon />}
                      onClick={() => dispatch(updateActionProgress({ id: action.id, progressData: { overall_progress_percentage: Math.min(action.overall_progress_percentage + 25, 100) }}))}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, fontSize: '0.7rem' }}
                    >
                      +25%
                    </Button>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grow>
    );
  };

  return (
    <Box sx={{ bgcolor: '#f8fafc', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        {/* Header Area */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>Task Board</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>Manage your action items and milestones</Typography>
          </Box>
          <Button 
            variant="contained" 
            disableElevation
            startIcon={<RefreshIcon />} 
            onClick={fetchData} 
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            Refresh
          </Button>
        </Stack>

        {/* Stats Grid */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={2.4}><FilterStat title="All" count={myTasks.total} status="all" icon={<AssignmentIcon />} color="#64748b" /></Grid>
          <Grid item xs={12} sm={6} md={2.4}><FilterStat title="Pending" count={myTasks.pendingCount || 0} status="pending" icon={<PendingIcon />} color="#f59e0b" /></Grid>
          <Grid item xs={12} sm={6} md={2.4}><FilterStat title="In Progress" count={myTasks.inProgressCount || 0} status="in_progress" icon={<PlayCircleIcon />} color="#3b82f6" /></Grid>
          <Grid item xs={12} sm={6} md={2.4}><FilterStat title="Overdue" count={myTasks.overdueCount || 0} status="overdue" icon={<WarningIcon />} color="#ef4444" /></Grid>
          <Grid item xs={12} sm={6} md={2.4}><FilterStat title="Completed" count={myTasks.completedCount || 0} status="completed" icon={<CheckCircleIcon />} color="#10b981" /></Grid>
        </Grid>

        {/* Search Bar */}
        <TextField
          fullWidth
          placeholder="Filter tasks by name, ID or description..."
          value={filters.search}
          onChange={(e) => dispatch(setFilters({ search: e.target.value, page: 1 }))}
          sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'white', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8' }} /></InputAdornment>,
            endAdornment: <InputAdornment position="end"><FilterIcon sx={{ color: '#94a3b8' }} /></InputAdornment>
          }}
        />

        {/* List Area */}
        {loading ? (
          <Stack spacing={2}>{[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={160} sx={{ borderRadius: 3 }} />)}</Stack>
        ) : myTasks.items.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 4, bgcolor: 'white', border: '1px dashed #e2e8f0' }}>
            <AssignmentIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#475569', fontWeight: 700 }}>No tasks found</Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>Try adjusting your filters or search terms</Typography>
          </Paper>
        ) : (
          <Box>
            {myTasks.items.map((action, index) => <ActionCard key={action.id} action={action} index={index} />)}
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination 
                count={myTasks.totalPages} 
                page={myTasks.page} 
                onChange={(e, v) => dispatch(fetchMyTasks({ ...filters, page: v }))} 
                color="primary" 
                shape="rounded"
              />
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default ActionsList;