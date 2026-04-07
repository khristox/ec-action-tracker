import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Paper, Typography, Box, Card, CardContent, Avatar, Container,
  CircularProgress, Button, List, ListItem, ListItemText, 
  Divider, LinearProgress, Alert, Stack, Chip
} from '@mui/material';
import {
  Event as EventIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  CalendarMonth as CalendarIcon,
  ChevronRight as ChevronRightIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const StatCard = ({ title, value, icon, color, loading }) => (
  <Card sx={{ borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', height: '100%' }}>
    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar sx={{ bgcolor: `${color}12`, color: color, width: 36, height: 36 }}>
          {icon}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="textSecondary" noWrap sx={{ fontWeight: 700, textTransform: 'uppercase', display: 'block', fontSize: '0.6rem', letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h6" fontWeight="800" sx={{ lineHeight: 1.2 }}>
            {loading ? <CircularProgress size={12} /> : value}
          </Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [stats, setStats] = useState(null);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, tasksRes] = await Promise.all([
        api.get('/action-tracker/dashboard/dashboard/stats'),
        api.get('/action-tracker/actions/my-tasks')
      ]);

      if (statsRes.data.success) setStats(statsRes.data.data);
      
      const allTasks = tasksRes.data.data || tasksRes.data;
      if (Array.isArray(allTasks)) {
        setPendingTasks(allTasks.filter(t => t.overall_progress_percentage < 100));
      }
    } catch (err) {
      setError("Sync failed. Check connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, []);

  if (loading && !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress thickness={5} size={40} />
      </Box>
    );
  }

  return (
    <Container 
      maxWidth="lg" 
      sx={{ 
        py: { xs: 2, md: 4 }, 
        px: { xs: 2, sm: 3 },
        pb: 10 // Extra bottom padding for comfortable mobile scrolling
      }}
    >
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={900}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome, {user?.full_name || user?.username || 'Officer'}
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={1.5} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <StatCard title="Total Meetings" value={stats?.meetings?.total || 0} icon={<EventIcon fontSize="small" />} color="#1976d2" loading={loading} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title="This Month" value={stats?.meetings?.this_month || 0} icon={<CalendarIcon fontSize="small" />} color="#0288d1" loading={loading} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title="My Pending" value={pendingTasks.length} icon={<AssignmentIcon fontSize="small" />} color="#ed6c02" loading={loading} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title="Comp. Rate" value={`${stats?.tasks?.completion_rate || 0}%`} icon={<TrendingUpIcon fontSize="small" />} color="#2e7d32" loading={loading} />
        </Grid>
      </Grid>

      <Stack spacing={4}>
        {/* ROW 1: Pending Tasks */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={800}>My Pending Tasks</Typography>
            <Button 
              size="small" 
              sx={{ fontWeight: 700, textTransform: 'none' }} 
              onClick={() => navigate('/actions/my-tasks')}
            >
              See All ({pendingTasks.length})
            </Button>
          </Stack>

          {pendingTasks.length > 0 ? (
            <Stack spacing={1.5}>
              {pendingTasks.slice(0, 5).map((task) => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                return (
                  <Card 
                    key={task.id} 
                    onClick={() => navigate(`/actions/${task.id}`)}
                    sx={{ 
                      borderRadius: 3, 
                      boxShadow: 'none', 
                      border: '1px solid', 
                      borderColor: 'divider',
                      cursor: 'pointer',
                      '&:active': { bgcolor: 'action.hover' }
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="body2" fontWeight="700" sx={{ mb: 1 }}>
                        {task.title || task.description}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Chip 
                          size="small" 
                          label={task.due_date ? `Due: ${new Date(task.due_date).toLocaleDateString()}` : 'No Due Date'}
                          sx={{ 
                            height: 20, 
                            fontSize: '0.65rem', 
                            fontWeight: 700,
                            bgcolor: isOverdue ? 'error.main' : 'action.hover',
                            color: isOverdue ? 'white' : 'text.secondary'
                          }} 
                        />
                        <Typography variant="caption" fontWeight="800" color="primary.main">{task.overall_progress_percentage}%</Typography>
                      </Box>
                      
                      <LinearProgress 
                        variant="determinate" 
                        value={task.overall_progress_percentage} 
                        sx={{ height: 6, borderRadius: 3 }} 
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">All tasks completed! 🎉</Typography>
            </Paper>
          )}
        </Box>

        {/* ROW 2: Upcoming Meetings */}
        <Box>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Upcoming Meetings</Typography>
          <Paper sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            {stats?.meetings?.upcoming?.length > 0 ? (
              <List disablePadding>
                {stats.meetings.upcoming.slice(0, 4).map((meeting, index, arr) => (
                  <React.Fragment key={meeting.id}>
                    <ListItem 
                      button 
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                      sx={{ py: 1.5 }}
                    >
                      <Avatar sx={{ bgcolor: 'action.hover', mr: 2, width: 40, height: 40 }}>
                        <AccessTimeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                      </Avatar>
                      <ListItemText 
                        primary={<Typography variant="body2" fontWeight="700" sx={{ mb: 0.5 }}>{meeting.title}</Typography>}
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {new Date(meeting.meeting_date || meeting.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        }
                      />
                      <ChevronRightIcon fontSize="small" color="disabled" />
                    </ListItem>
                    {index < arr.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">No upcoming meetings scheduled</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Stack>

      {/* Invisible Spacer for Bottom Scrollability */}
      <Box sx={{ height: 40 }} />
    </Container>
  );
};

export default Dashboard;