// src/components/actiontracker/dashboard/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Container,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  Event as EventIcon,
  PendingActions as PendingActionsIcon,
  CheckCircle as CheckCircleIcon,
  Group as GroupIcon,
} from '@mui/icons-material';

const StatCard = ({ title, value, icon, color }) => (
  <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' }, borderRadius: 3 }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1 }}>
          <Typography color="textSecondary" gutterBottom variant="subtitle2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold">
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalMeetings: 12,
    pendingActions: 8,
    completedActions: 24,
    totalParticipants: 45,
  });

  // Simple mock data - replace with API call later
  useEffect(() => {
    // Simulate API call
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: 'primary.main' }}>
          Welcome back, {user?.username || 'Officer'}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          EC Action Tracker System — Operations Overview
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="TOTAL MEETINGS" value={stats.totalMeetings} icon={<EventIcon />} color="#1976d2" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="PENDING ACTIONS" value={stats.pendingActions} icon={<PendingActionsIcon />} color="#ed6c02" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="COMPLETED" value={stats.completedActions} icon={<CheckCircleIcon />} color="#2e7d32" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="PARTICIPANTS" value={stats.totalParticipants} icon={<GroupIcon />} color="#9c27b0" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>Quick Actions</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
              <Button variant="contained" onClick={() => navigate('/meetings/create')}>
                Create Meeting
              </Button>
              <Button variant="outlined" onClick={() => navigate('/participants/create')}>
                Add Participant
              </Button>
              <Button variant="outlined" onClick={() => navigate('/actions/my-tasks')}>
                My Tasks
              </Button>
            </Box>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>System Status</Typography>
            <Typography variant="body2" color="text.secondary">
              Action Tracker is operational. All systems running normally.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;