import React from 'react';
import { useSelector } from 'react-redux';
import {
  Grid, Paper, Typography, Box, Card, CardContent, Avatar, List, ListItem,
  ListItemText, ListItemAvatar, Chip, Divider, LinearProgress, Container,
  useTheme, useMediaQuery,
} from '@mui/material';
import {
  Event as EventIcon, CheckCircle as CheckCircleIcon, Warning as WarningIcon,
  Schedule as ScheduleIcon, PendingActions as PendingActionsIcon,
  Description as DescriptionIcon, Group as GroupIcon,
} from '@mui/icons-material';

const StatCard = ({ title, value, icon, color, subtitle }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <Card 
      sx={{ 
        height: '100%', 
        transition: 'transform 0.2s', 
        '&:hover': { transform: 'translateY(-4px)' },
        // Use a subtle border in dark mode instead of heavy shadows
        border: isDarkMode ? `1px solid ${theme.palette.divider}` : 'none',
        bgcolor: 'background.paper',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Typography 
              color="text.secondary" // Use semantic text colors
              gutterBottom 
              variant="subtitle2"
              sx={{ fontWeight: 600, letterSpacing: 0.5 }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h4" 
              fontWeight="bold"
              sx={{ color: 'text.primary' }} // Ensures visibility in both modes
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar 
            sx={{ 
              bgcolor: color, // Passed from parent (should use theme keys)
              width: 56, height: 56,
              boxShadow: isDarkMode ? '0 0 15px rgba(0,0,0,0.5)' : 2
            }}
          >
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
};

const ActionItem = ({ action }) => {
  const theme = useTheme();
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return theme.palette.success.main;
      case 'in_progress': return theme.palette.info.main;
      case 'overdue': return theme.palette.error.main;
      default: return theme.palette.text.disabled;
    }
  };

  return (
    <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.5 }}>
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: 'action.hover', color: getStatusColor(action.status), width: 32, height: 32 }}>
          {action.status === 'completed' ? <CheckCircleIcon fontSize="small" /> : <ScheduleIcon fontSize="small" />}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {action.title}
            </Typography>
            <Chip 
              label={action.status.toUpperCase()} 
              size="small" 
              sx={{ 
                height: 20, 
                fontSize: '0.65rem', 
                bgcolor: `${getStatusColor(action.status)}22`, // Subtle transparent bg
                color: getStatusColor(action.status),
                border: `1px solid ${getStatusColor(action.status)}44`
              }}
            />
          </Box>
        }
        secondary={
          <Box sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Due: {action.due_date}
            </Typography>
            {action.progress > 0 && (
              <LinearProgress 
                variant="determinate" 
                value={action.progress} 
                sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: 'action.hover' }} 
              />
            )}
          </Box>
        }
      />
    </ListItem>
  );
};

const Dashboard = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const { user } = useSelector((state) => state.auth);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          sx={{ fontWeight: 800, color: 'text.primary' }}
        >
          Welcome back, {user?.username || 'Admin'}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track meetings and actions for the Electoral Commission.
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="TOTAL MEETINGS"
            value="12"
            icon={<EventIcon />}
            color={theme.palette.primary.main}
            subtitle="This quarter"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="OVERDUE"
            value="3"
            icon={<WarningIcon />}
            color={theme.palette.error.main}
            subtitle="Immediate attention"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="COMPLETED"
            value="24"
            icon={<CheckCircleIcon />}
            color={theme.palette.success.main}
            subtitle="Great progress"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="PARTICIPANTS"
            value="45"
            icon={<GroupIcon />}
            color={theme.palette.secondary.main}
            subtitle="Total active"
          />
        </Grid>
      </Grid>

      {/* Content Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              borderRadius: 4, 
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.paper'
            }}
          >
            <Typography variant="h6" fontWeight={700} gutterBottom>Pending Actions</Typography>
            <Divider sx={{ mb: 2 }} />
            <List disablePadding>
              <ActionItem action={{ title: "Review voter data", status: "overdue", due_date: "2024-12-10", progress: 0 }} />
              <ActionItem action={{ title: "Prepare report", status: "in_progress", due_date: "2024-12-20", progress: 45 }} />
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              borderRadius: 4, 
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.paper'
            }}
          >
            <Typography variant="h6" fontWeight={700} gutterBottom>Upcoming Meetings</Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <EventIcon color="disabled" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">Next meeting scheduled for tomorrow</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;