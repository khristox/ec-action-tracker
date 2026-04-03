import React from 'react';
import { useSelector } from 'react-redux';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Chip,
  Divider,
  LinearProgress,
  Container,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Event as EventIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  PendingActions as PendingActionsIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Today as TodayIcon,
  Group as GroupIcon,
} from '@mui/icons-material';

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1 }}>
          <Typography 
            color="textSecondary" 
            gutterBottom 
            variant="subtitle2"
            sx={{
              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem' },
              fontWeight: 500,
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="h4" 
            component="div" 
            fontWeight="bold"
            sx={{
              fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
              mb: 0.5
            }}
          >
            {value}
          </Typography>
          {subtitle && (
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        <Avatar 
          sx={{ 
            bgcolor: color, 
            width: { xs: 48, sm: 56, md: 64 }, 
            height: { xs: 48, sm: 56, md: 64 },
            boxShadow: 2
          }}
        >
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

const ActionItem = ({ action }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'overdue': return 'error';
      case 'blocked': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon sx={{ fontSize: 16 }} />;
      case 'in_progress': return <PendingActionsIcon sx={{ fontSize: 16 }} />;
      case 'overdue': return <WarningIcon sx={{ fontSize: 16 }} />;
      default: return <ScheduleIcon sx={{ fontSize: 16 }} />;
    }
  };

  return (
    <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.5 }}>
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: getStatusColor(action.status) + '.main', width: 32, height: 32 }}>
          {getStatusIcon(action.status)}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              {action.title}
            </Typography>
            <Chip 
              label={action.status.replace('_', ' ').toUpperCase()} 
              size="small" 
              color={getStatusColor(action.status)}
              sx={{ height: 24, fontSize: '0.7rem', fontWeight: 500 }}
            />
          </Box>
        }
        secondary={
          <Box sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Assigned to: {action.assigned_to}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Due: {action.due_date}
            </Typography>
            {action.progress > 0 && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={action.progress} 
                  sx={{ height: 4, borderRadius: 2 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {action.progress}% complete
                </Typography>
              </Box>
            )}
          </Box>
        }
      />
    </ListItem>
  );
};

const UpcomingMeeting = ({ meeting }) => (
  <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.5 }}>
    <ListItemAvatar>
      <Avatar sx={{ bgcolor: '#2196F3', width: 40, height: 40 }}>
        <EventIcon />
      </Avatar>
    </ListItemAvatar>
    <ListItemText
      primary={
        <Typography variant="body2" fontWeight="medium">
          {meeting.title}
        </Typography>
      }
      secondary={
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            📅 {meeting.date} at {meeting.time}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            📍 {meeting.location} • 👥 {meeting.participants} participants
          </Typography>
          {meeting.agenda && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              📋 {meeting.agenda}
            </Typography>
          )}
        </Box>
      }
    />
  </ListItem>
);

const Dashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useSelector((state) => state.auth);

  const stats = {
    totalMeetings: 12,
    pendingActions: 8,
    completedActions: 24,
    totalParticipants: 45,
    overdueActions: 3,
    inProgressActions: 5,
  };

  const upcomingMeetings = [
    {
      id: 1,
      title: "Electoral Commission Weekly Review",
      date: "2024-12-15",
      time: "10:00 AM",
      location: "Conference Room A",
      participants: 12,
      agenda: "Review of voter registration progress"
    },
    {
      id: 2,
      title: "Budget Planning Committee",
      date: "2024-12-16",
      time: "2:00 PM",
      location: "Board Room",
      participants: 8,
      agenda: "Q1 2025 budget allocation"
    },
    {
      id: 3,
      title: "Stakeholder Engagement",
      date: "2024-12-18",
      time: "11:00 AM",
      location: "Virtual Meeting",
      participants: 15,
      agenda: "Election observation updates"
    }
  ];

  const pendingActions = [
    {
      id: 1,
      title: "Review voter registration data",
      assigned_to: "John Commissioner",
      due_date: "2024-12-10",
      status: "overdue",
      progress: 0
    },
    {
      id: 2,
      title: "Prepare quarterly report",
      assigned_to: "Sarah Secretary",
      due_date: "2024-12-20",
      status: "in_progress",
      progress: 45
    },
    {
      id: 3,
      title: "Update participant contact list",
      assigned_to: "Michael Officer",
      due_date: "2024-12-25",
      status: "pending",
      progress: 0
    },
    {
      id: 4,
      title: "Finalize meeting minutes",
      assigned_to: "Grace Legal",
      due_date: "2024-12-22",
      status: "in_progress",
      progress: 75
    }
  ];

  const recentActivities = [
    {
      id: 1,
      action: "Meeting minutes approved",
      meeting: "Electoral Commission Strategy Meeting",
      date: "2024-12-02",
      user: "John Commissioner"
    },
    {
      id: 2,
      action: "Action item completed",
      meeting: "Budget Planning Committee",
      date: "2024-12-01",
      user: "Sarah Secretary"
    },
    {
      id: 3,
      action: "New meeting scheduled",
      meeting: "Stakeholder Engagement",
      date: "2024-11-30",
      user: "Michael Officer"
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
      {/* Welcome Section */}
      <Box sx={{ mb: { xs: 3, sm: 4 } }}>
        <Typography 
          variant="h4" 
          gutterBottom
          sx={{
            fontSize: { xs: '1.75rem', sm: '2rem', md: '2.5rem' },
            fontWeight: 600,
            mb: 1
          }}
        >
          Welcome back, {user?.username || 'Admin'}!
        </Typography>
        <Typography 
          variant="body1" 
          color="text.secondary"
          sx={{
            fontSize: { xs: '0.875rem', sm: '1rem' },
          }}
        >
          Track your meetings, actions, and participant activities at the Electoral Commission.
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid 
        container 
        spacing={{ xs: 2, sm: 2, md: 3 }} 
        sx={{ mb: { xs: 3, sm: 4 } }}
      >
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="TOTAL MEETINGS"
            value={stats.totalMeetings}
            icon={<EventIcon sx={{ fontSize: { xs: 24, sm: 28, md: 32 } }} />}
            color="#1976d2"
            subtitle="This quarter"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="PENDING ACTIONS"
            value={stats.pendingActions}
            icon={<PendingActionsIcon sx={{ fontSize: { xs: 24, sm: 28, md: 32 } }} />}
            color="#ed6c02"
            subtitle={`${stats.overdueActions} overdue`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="COMPLETED ACTIONS"
            value={stats.completedActions}
            icon={<CheckCircleIcon sx={{ fontSize: { xs: 24, sm: 28, md: 32 } }} />}
            color="#2e7d32"
            subtitle="This year"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="TOTAL PARTICIPANTS"
            value={stats.totalParticipants}
            icon={<GroupIcon sx={{ fontSize: { xs: 24, sm: 28, md: 32 } }} />}
            color="#9c27b0"
            subtitle="Across all meetings"
          />
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid 
        container 
        spacing={{ xs: 2, sm: 2, md: 3 }}
      >
        {/* Pending Actions Section */}
        <Grid item xs={12} md={6}>
          <Paper 
            sx={{ 
              p: { xs: 2, sm: 2.5, md: 3 },
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography 
                variant="h6" 
                sx={{
                  fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
                  fontWeight: 600
                }}
              >
                Pending Actions
              </Typography>
              <Chip 
                label={`${stats.pendingActions} pending`} 
                color="warning" 
                size="small"
                sx={{ fontWeight: 500 }}
              />
            </Box>
            <Divider sx={{ mb: 2 }} />
            <List disablePadding sx={{ flex: 1 }}>
              {pendingActions.map((action, index) => (
                <React.Fragment key={action.id}>
                  <ActionItem action={action} />
                  {index < pendingActions.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
            {pendingActions.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No pending actions. Great job!
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Upcoming Meetings Section */}
        <Grid item xs={12} md={6}>
          <Paper 
            sx={{ 
              p: { xs: 2, sm: 2.5, md: 3 },
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography 
                variant="h6" 
                sx={{
                  fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
                  fontWeight: 600
                }}
              >
                Upcoming Meetings
              </Typography>
              <Chip 
                label={`${upcomingMeetings.length} upcoming`} 
                color="info" 
                size="small"
                sx={{ fontWeight: 500 }}
              />
            </Box>
            <Divider sx={{ mb: 2 }} />
            <List disablePadding sx={{ flex: 1 }}>
              {upcomingMeetings.map((meeting, index) => (
                <React.Fragment key={meeting.id}>
                  <UpcomingMeeting meeting={meeting} />
                  {index < upcomingMeetings.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
            {upcomingMeetings.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No upcoming meetings scheduled.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Recent Activities Section - Full Width */}
        <Grid item xs={12}>
          <Paper 
            sx={{ 
              p: { xs: 2, sm: 2.5, md: 3 },
              mt: { xs: 0, sm: 0 }
            }}
          >
            <Typography 
              variant="h6" 
              gutterBottom
              sx={{
                fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
                fontWeight: 600,
                mb: 2
              }}
            >
              Recent Activities
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              {recentActivities.map((activity, index) => (
                <React.Fragment key={activity.id}>
                  <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.5 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#4caf50', width: 40, height: 40 }}>
                        <DescriptionIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight="medium">
                          {activity.action}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Meeting: {activity.meeting}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            By {activity.user} • {activity.date}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < recentActivities.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
            {recentActivities.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No recent activities to display.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;