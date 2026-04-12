import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Paper, Box, Grid, Card, CardContent,
  Button, Chip, IconButton, TextField, InputAdornment,
  Stack, LinearProgress, Avatar, Skeleton, Pagination,
  Tooltip, Grow, useTheme, useMediaQuery, alpha, CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon, Assignment as AssignmentIcon,
  Schedule as ScheduleIcon, Person as PersonIcon, CheckCircle as CheckCircleIcon,
  Warning as WarningIcon, PlayCircle as PlayCircleIcon, Pending as PendingIcon,
  Visibility as VisibilityIcon, Edit as EditIcon, FilterList as FilterIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';

// Store & API
import { fetchMyTasks, updateActionProgress, setFilters } from '../../../store/slices/actionTracker/actionSlice';
import api from '../../../services/api';

const ActionsList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { myTasks, loading, filters } = useSelector((state) => state.actions);

  // --- STATE ---
  const [statusOptions, setStatusOptions] = useState([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // Fetch Tasks
  const fetchData = useCallback(() => {
    dispatch(fetchMyTasks({ ...filters, page: myTasks.page }));
  }, [dispatch, filters, myTasks.page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- AUTO-LOAD STATUSES ---
  useEffect(() => {
    const fetchStatuses = async () => {
      setLoadingStatuses(true);
      try {
        const res = await api.get('/attribute-groups/ACTION_TRACKER/attributes');
        // Handle various response structures (items vs direct array)
        const attributes = res.data?.items || res.data || [];
        console.log("DEBUG STATUS OPTIONS:", attributes); // Check this in console
        setStatusOptions(attributes);
      } catch (e) {
        console.error("Failed to fetch status attributes", e);
      } finally {
        setLoadingStatuses(false);
      }
    };
    fetchStatuses();
  }, []);

  const handleQuickProgress = async (action) => {
    // 1. Calculate next percentage
    const currentProgress = action.overall_progress_percentage || 0;
    const nextProgress = Math.min(currentProgress + 25, 100);
    
    // 2. Resolve UUID
    // We search by code (standard) and name (fallback)
    const inProgressStatus = statusOptions.find(s => 
      s.code === 'ACTION_STATUS_IN_PROGRESS' || 
      s.name?.toLowerCase().includes('in progress')
    );

    // Prioritize the ID already on the action, then our found ID
    const statusId = action.overall_status_id || inProgressStatus?.id;

    if (!statusId) {
      console.error("Missing Status UUID for action:", action.id);
      console.log("Current state of statusOptions:", statusOptions);
      return;
    }

    setUpdatingId(action.id);

    try {
      await dispatch(updateActionProgress({ 
        id: action.id, 
        progressData: { 
          progress_percentage: nextProgress,
          individual_status_id: statusId, 
          remarks: `Progress updated to ${nextProgress}%`
        } 
      })).unwrap();
      
      fetchData(); 
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusStyle = (action) => {
    if (action.completed_at || action.overall_progress_percentage === 100) 
      return { color: '#10b981', icon: <CheckCircleIcon fontSize="small"/>, label: 'Completed', bg: alpha('#10b981', 0.1) };
    if (action.is_overdue) return { color: '#ef4444', icon: <WarningIcon fontSize="small"/>, label: 'Overdue', bg: alpha('#ef4444', 0.1) };
    if (action.overall_progress_percentage > 0) return { color: '#3b82f6', icon: <PlayCircleIcon fontSize="small"/>, label: 'In Progress', bg: alpha('#3b82f6', 0.1) };
    return { color: '#f59e0b', icon: <PendingIcon fontSize="small"/>, label: 'Pending', bg: alpha('#f59e0b', 0.1) };
  };

  const ActionCard = ({ action, index }) => {
    const style = getStatusStyle(action);
    const isUpdating = updatingId === action.id;
    
    return (
      <Grow in timeout={index * 50}>
        <Card sx={{ 
          mb: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none',
          position: 'relative', overflow: 'hidden',
          '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.05)', borderColor: alpha(style.color, 0.3) }
        }}>
          {isUpdating && (
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          )}

          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" mb={2}>
              <Chip label={style.label} size="small" sx={{ bgcolor: style.bg, color: style.color, fontWeight: 800, fontSize: '0.65rem' }} />
              <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                #{action.id.slice(0, 8).toUpperCase()}
              </Typography>
            </Stack>

            <Typography 
              variant="h6" fontWeight={800} mb={1} 
              onClick={() => navigate(`/actions/${action.id}`)} 
              sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
            >
              {action.description}
            </Typography>

            <Stack direction="row" spacing={2} mb={3}>
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

            <Grid container alignItems="center" spacing={3}>
              <Grid item xs={12} sm={8}>
                 <Box>
                    <Stack direction="row" justifyContent="space-between" mb={1}>
                      <Typography variant="caption" fontWeight={800} sx={{ color: '#475569' }}>Progress</Typography>
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
                      variant="contained" 
                      color="success" 
                      size="small"
                      disableElevation
                      startIcon={loadingStatuses ? <CircularProgress size={14} color="inherit" /> : <TrendingUpIcon />}
                      onClick={() => handleQuickProgress(action)}
                      disabled={loadingStatuses || isUpdating}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                    >
                      {loadingStatuses ? 'Syncing...' : '+25%'}
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
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ color: '#0f172a' }}>Task Board</Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>Manage your tasks effectively</Typography>
          </Box>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchData}>Refresh</Button>
        </Stack>

        <TextField
          fullWidth
          placeholder="Filter tasks..."
          value={filters.search || ''}
          onChange={(e) => dispatch(setFilters({ search: e.target.value, page: 1 }))}
          sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'white' } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon color="disabled" /></InputAdornment>
          }}
        />

        {loading && !myTasks.items.length ? (
          <Stack spacing={2}>{[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={160} sx={{ borderRadius: 3 }} />)}</Stack>
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