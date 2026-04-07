import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Paper, Box, Grid, Card, CardContent,
  Button, Chip, IconButton, TextField, InputAdornment,
  Stack, LinearProgress, Avatar, Divider, Tooltip, Pagination,
  Skeleton, Alert, Grow, useTheme, useMediaQuery
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon, Assignment as AssignmentIcon,
  Schedule as ScheduleIcon, Person as PersonIcon, CheckCircle as CheckCircleIcon,
  Warning as WarningIcon, PlayCircle as PlayCircleIcon, Pending as PendingIcon,
  Visibility as VisibilityIcon, Edit as EditIcon, AccessTime as AccessTimeIcon,
  Close as CloseIcon, FilterList as FilterIcon
} from '@mui/icons-material';
import { 
  fetchMyTasks, updateActionProgress, setFilters 
} from '../../../store/slices/actionTracker/actionSlice';

const ActionsList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { myTasks, loading, updatingProgress, filters, error } = useSelector((state) => state.actions);

  const fetchData = useCallback(() => {
    dispatch(fetchMyTasks({ ...filters, page: myTasks.page }));
  }, [dispatch, myTasks.page, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusFilter = (status) => {
    dispatch(setFilters({ status, page: 1 }));
  };

  const getStatusStyle = (action) => {
    if (action.completed_at) return { color: '#4caf50', icon: <CheckCircleIcon fontSize="small"/>, label: 'Completed' };
    if (action.is_overdue) return { color: '#f44336', icon: <WarningIcon fontSize="small"/>, label: 'Overdue' };
    if (action.overall_progress_percentage > 0) return { color: '#2196f3', icon: <PlayCircleIcon fontSize="small"/>, label: 'In Progress' };
    return { color: '#ff9800', icon: <PendingIcon fontSize="small"/>, label: 'Pending' };
  };

  // --- Sub-Component: Stat Card Filter ---
  const FilterStat = ({ title, count, status, icon, color }) => {
    const isActive = filters.status === status;
    return (
      <Paper
        elevation={isActive ? 4 : 0}
        onClick={() => handleStatusFilter(status)}
        sx={{
          p: 2, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
          border: '2px solid',
          borderColor: isActive ? color : 'transparent',
          bgcolor: isActive ? `${color}08` : 'background.paper',
          transition: 'all 0.2s ease',
          '&:hover': { transform: 'translateY(-3px)', bgcolor: `${color}12` }
        }}
      >
        <Avatar sx={{ bgcolor: `${color}15`, color: color, mx: 'auto', mb: 1, width: 40, height: 40 }}>
          {icon}
        </Avatar>
        <Typography variant="h5" fontWeight={800}>{count}</Typography>
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase' }}>
          {title}
        </Typography>
      </Paper>
    );
  };

  // --- Sub-Component: Action Card ---
  const ActionCard = ({ action, index }) => {
    const status = getStatusStyle(action);
    
    return (
      <Grow in timeout={index * 100}>
        <Card sx={{ 
          mb: 2, borderRadius: 4, display: 'flex', 
          borderLeft: `6px solid ${status.color}`,
          boxShadow: '0 2px 12px rgba(0,0,0,0.05)'
        }}>
          <CardContent sx={{ flex: 1, p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
              <Typography variant="overline" fontWeight={700} sx={{ color: status.color }}>
                {status.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID: {action.id.slice(0, 8)}
              </Typography>
            </Box>

            <Typography 
              variant="h6" fontWeight={700} gutterBottom 
              sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
              onClick={() => navigate(`/actions/${action.id}`)}
            >
              {action.description}
            </Typography>

            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
              <Chip size="small" icon={<ScheduleIcon />} label={new Date(action.due_date).toLocaleDateString()} variant="outlined" />
              <Chip size="small" icon={<PersonIcon />} label={action.assigned_by_name || 'Admin'} variant="outlined" />
              {action.is_overdue && !action.completed_at && <Chip size="small" label="URGENT" color="error" sx={{ fontWeight: 900 }} />}
            </Stack>

            <Box sx={{ mt: 2 }}>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" fontWeight={700}>Progress</Typography>
                <Typography variant="caption" fontWeight={700}>{action.overall_progress_percentage}%</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={action.overall_progress_percentage} 
                sx={{ height: 6, borderRadius: 3, bgcolor: '#eee', '& .MuiLinearProgress-bar': { bgcolor: status.color } }}
              />
            </Box>
          </CardContent>
          
          <Divider orientation="vertical" flexItem />
          
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', p: 1, gap: 1, bgcolor: '#fafafa' }}>
            <Tooltip title="View Details"><IconButton onClick={() => navigate(`/actions/${action.id}`)}><VisibilityIcon color="primary"/></IconButton></Tooltip>
            <Tooltip title="Edit Task"><IconButton onClick={() => navigate(`/actions/${action.id}/edit`)}><EditIcon /></IconButton></Tooltip>
            {action.overall_progress_percentage < 100 && (
               <Tooltip title="Quick Progress (+25%)">
                 <IconButton color="success" onClick={() => dispatch(updateActionProgress({ id: action.id, progressData: { overall_progress_percentage: Math.min(action.overall_progress_percentage + 25, 100) }}))}>
                    <PlayCircleIcon />
                 </IconButton>
               </Tooltip>
            )}
          </Box>
        </Card>
      </Grow>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Area */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={900} color="primary.main">My Task Board</Typography>
          <Typography variant="body2" color="text.secondary">Real-time action item tracking</Typography>
        </Box>
        <IconButton onClick={fetchData} sx={{ bgcolor: 'white', boxShadow: 1 }}><RefreshIcon /></IconButton>
      </Box>

      {/* Hero Stats - Replaces Tabs */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4} md={2.4}><FilterStat title="All" count={myTasks.total} status="all" icon={<AssignmentIcon />} color="#607d8b" /></Grid>
        <Grid item xs={6} sm={4} md={2.4}><FilterStat title="Pending" count={myTasks.pendingCount || 0} status="pending" icon={<PendingIcon />} color="#ff9800" /></Grid>
        <Grid item xs={6} sm={4} md={2.4}><FilterStat title="In Progress" count={myTasks.inProgressCount || 0} status="in_progress" icon={<PlayCircleIcon />} color="#2196f3" /></Grid>
        <Grid item xs={6} sm={4} md={2.4}><FilterStat title="Overdue" count={myTasks.overdueCount || 0} status="overdue" icon={<WarningIcon />} color="#f44336" /></Grid>
        <Grid item xs={6} sm={4} md={2.4}><FilterStat title="Done" count={myTasks.completedCount || 0} status="completed" icon={<CheckCircleIcon />} color="#4caf50" /></Grid>
      </Grid>

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search tasks..."
        variant="outlined"
        value={filters.search}
        onChange={(e) => dispatch(setFilters({ search: e.target.value, page: 1 }))}
        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: 'white' } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
          endAdornment: <InputAdornment position="end"><FilterIcon color="action" /></InputAdornment>
        }}
      />

      {/* List Area */}
      {loading ? (
        <Stack spacing={2}>{[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: 4 }} />)}</Stack>
      ) : myTasks.items.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 5, bgcolor: '#f9f9f9', border: '2px dashed #ddd' }}>
          <AssignmentIcon sx={{ fontSize: 60, color: '#ccc', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No tasks found for this filter</Typography>
        </Paper>
      ) : (
        <Box>
          {myTasks.items.map((action, index) => <ActionCard key={action.id} action={action} index={index} />)}
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination count={myTasks.totalPages} page={myTasks.page} onChange={(e, v) => dispatch(fetchMyTasks({ ...filters, page: v }))} color="primary" />
          </Box>
        </Box>
      )}
    </Container>
  );
};

export default ActionsList;