// src/components/dashboard/Dashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Paper, Typography, Box, Card, CardContent, Avatar, Container,
  CircularProgress, Button, List, ListItem, ListItemText, 
  Divider, LinearProgress, Alert, Stack, Chip, IconButton,
  Tooltip, useTheme, useMediaQuery, ToggleButton, ToggleButtonGroup,
  alpha
} from '@mui/material';
import {
  Event as EventIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CalendarMonth as CalendarIcon,
  ChevronRight as ChevronRightIcon,
  AccessTime as AccessTimeIcon,
  Refresh as RefreshIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
} from 'chart.js';
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2';
import { format, subDays, eachDayOfInterval, isValid, parseISO } from 'date-fns';
import api from '../../../services/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

// ==================== Helper Functions ====================
const safeFormatDate = (dateValue, formatStr = 'MMM dd, yyyy') => {
  if (!dateValue) return null;
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return null;
    return format(date, formatStr);
  } catch {
    return null;
  }
};

const safeGetDayOfWeek = (dateValue) => {
  if (!dateValue) return null;
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return null;
    return format(date, 'EEE');
  } catch {
    return null;
  }
};

// ==================== Stat Card Component ====================
const StatCard = ({ title, value, icon, color, loading, trend, subtitle }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  return (
    <Card sx={{ 
      borderRadius: 3, 
      boxShadow: '0 2px 6px rgba(0,0,0,0.04)', 
      height: '100%',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
      bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
      border: isDarkMode ? `1px solid ${alpha(theme.palette.common.white, 0.1)}` : 'none',
    }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Avatar sx={{ 
            bgcolor: isDarkMode ? alpha(color, 0.2) : `${color}12`, 
            color: color, 
            width: 40, 
            height: 40 
          }}>
            {icon}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="textSecondary" noWrap sx={{ 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              display: 'block', 
              fontSize: '0.6rem', 
              letterSpacing: 0.5 
            }}>
              {title}
            </Typography>
            <Typography variant="h5" fontWeight="800" sx={{ lineHeight: 1.2 }}>
              {loading ? <CircularProgress size={16} /> : value}
            </Typography>
            {trend !== undefined && !loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                {trend > 0 ? (
                  <TrendingUpIcon sx={{ fontSize: 12, color: 'success.main' }} />
                ) : trend < 0 ? (
                  <TrendingDownIcon sx={{ fontSize: 12, color: 'error.main' }} />
                ) : null}
                <Typography variant="caption" color={trend > 0 ? 'success.main' : trend < 0 ? 'error.main' : 'text.secondary'}>
                  {Math.abs(trend)}% from last month
                </Typography>
              </Box>
            )}
            {subtitle && !loading && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ==================== Chart Card Component ====================
const ChartCard = ({ title, children, action, height = 300 }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  return (
    <Paper sx={{ 
      borderRadius: 3, 
      p: 2, 
      height: '100%',
      border: '1px solid',
      borderColor: 'divider',
      boxShadow: 'none',
      bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={800} color="text.secondary" textTransform="uppercase" fontSize="0.7rem" letterSpacing={0.5}>
          {title}
        </Typography>
        {action}
      </Box>
      <Box sx={{ height, position: 'relative' }}>
        {children}
      </Box>
    </Paper>
  );
};

// ==================== Main Dashboard Component ====================
const Dashboard = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useSelector((state) => state.auth);
  
  const [stats, setStats] = useState(null);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [chartData, setChartData] = useState({
    weeklyActivity: { labels: [], datasets: [] },
    statusDistribution: { labels: [], datasets: [] },
    monthlyTrend: { labels: [], datasets: [] },
    priorityDistribution: { labels: [], datasets: [] }
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [chartType, setChartType] = useState('bar');

  // Get chart text color based on theme
  const getChartTextColor = useCallback(() => {
    return isDarkMode ? '#e0e0e0' : '#666666';
  }, [isDarkMode]);

  // Get chart grid color based on theme
  const getChartGridColor = useCallback(() => {
    return isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  }, [isDarkMode]);

  // Process chart data from tasks
  const processChartData = useCallback((tasks) => {
    // Weekly Activity (last 7 days)
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    });
    
    const weeklyLabels = last7Days.map(date => format(date, 'EEE'));
    
    const weeklyCompleted = last7Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return tasks.filter(t => {
        if (!t.completed_at) return false;
        const completedDate = safeFormatDate(t.completed_at, 'yyyy-MM-dd');
        return completedDate === dateStr;
      }).length;
    });
    
    const weeklyCreated = last7Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return tasks.filter(t => {
        if (!t.created_at) return false;
        const createdDate = safeFormatDate(t.created_at, 'yyyy-MM-dd');
        return createdDate === dateStr;
      }).length;
    });

    // Status Distribution
    const statusMap = {
      'pending': { count: 0, color: '#ed6c02', label: 'Pending' },
      'in_progress': { count: 0, color: '#1976d2', label: 'In Progress' },
      'completed': { count: 0, color: '#2e7d32', label: 'Completed' },
      'overdue': { count: 0, color: '#d32f2f', label: 'Overdue' },
      'blocked': { count: 0, color: '#9c27b0', label: 'Blocked' }
    };
    
    tasks.forEach(task => {
      if (task.completed_at) {
        statusMap.completed.count++;
      } else if (task.is_overdue) {
        statusMap.overdue.count++;
      } else if (task.overall_progress_percentage > 0 && task.overall_progress_percentage < 100) {
        statusMap.in_progress.count++;
      } else {
        statusMap.pending.count++;
      }
    });

    // Priority Distribution
    const priorityMap = {
      1: { count: 0, color: '#d32f2f', label: 'High' },
      2: { count: 0, color: '#ed6c02', label: 'Medium' },
      3: { count: 0, color: '#2e7d32', label: 'Low' },
      4: { count: 0, color: '#0288d1', label: 'Very Low' }
    };
    
    tasks.forEach(task => {
      if (task.priority && priorityMap[task.priority]) {
        priorityMap[task.priority].count++;
      }
    });

    // Monthly Trend (last 6 months)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      last6Months.push(months[date.getMonth()]);
    }
    
    const monthlyCompleted = last6Months.map((month, idx) => {
      const monthIndex = months.indexOf(month);
      return tasks.filter(t => {
        if (!t.completed_at) return false;
        const completedDate = safeFormatDate(t.completed_at);
        if (!completedDate) return false;
        const date = new Date(completedDate);
        return date.getMonth() === monthIndex;
      }).length;
    });
    
    const monthlyCreated = last6Months.map((month, idx) => {
      const monthIndex = months.indexOf(month);
      return tasks.filter(t => {
        if (!t.created_at) return false;
        const createdDate = safeFormatDate(t.created_at);
        if (!createdDate) return false;
        const date = new Date(createdDate);
        return date.getMonth() === monthIndex;
      }).length;
    });

    setChartData({
      weeklyActivity: {
        labels: weeklyLabels,
        datasets: [
          {
            label: 'Created',
            data: weeklyCreated,
            backgroundColor: '#1976d2',
            borderRadius: 6,
          },
          {
            label: 'Completed',
            data: weeklyCompleted,
            backgroundColor: '#2e7d32',
            borderRadius: 6,
          }
        ]
      },
      statusDistribution: {
        labels: Object.values(statusMap).map(s => s.label),
        datasets: [{
          data: Object.values(statusMap).map(s => s.count),
          backgroundColor: Object.values(statusMap).map(s => s.color),
          borderWidth: 0,
        }]
      },
      monthlyTrend: {
        labels: last6Months,
        datasets: [
          {
            label: 'Tasks Created',
            data: monthlyCreated,
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            fill: true,
            tension: 0.4,
          },
          {
            label: 'Tasks Completed',
            data: monthlyCompleted,
            borderColor: '#2e7d32',
            backgroundColor: 'rgba(46, 125, 50, 0.1)',
            fill: true,
            tension: 0.4,
          }
        ]
      },
      priorityDistribution: {
        labels: Object.values(priorityMap).map(p => p.label),
        datasets: [{
          data: Object.values(priorityMap).map(p => p.count),
          backgroundColor: Object.values(priorityMap).map(p => p.color),
          borderWidth: 0,
        }]
      }
    });
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, tasksRes] = await Promise.all([
        api.get('/action-tracker/dashboard/dashboard/stats'),
        api.get('/action-tracker/actions/my-tasks', { params: { limit: 100, include_completed: true } })
      ]);

      if (statsRes.data.success) setStats(statsRes.data.data);
      
      const allTasks = tasksRes.data.data || tasksRes.data || [];
      if (Array.isArray(allTasks)) {
        const pending = allTasks.filter(t => t.overall_progress_percentage < 100);
        setPendingTasks(pending);
        processChartData(allTasks);
      }
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError("Failed to load dashboard data. Please check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Memoized stats values
  const statsValues = useMemo(() => ({
    totalMeetings: stats?.meetings?.total || 0,
    thisMonthMeetings: stats?.meetings?.this_month || 0,
    pendingTasks: pendingTasks.length,
    completionRate: stats?.tasks?.completion_rate || 0,
    overdueTasks: pendingTasks.filter(t => t.is_overdue).length,
    inProgressTasks: pendingTasks.filter(t => t.overall_progress_percentage > 0 && t.overall_progress_percentage < 100).length,
    totalParticipants: stats?.participants?.total || 0
  }), [stats, pendingTasks]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { 
          boxWidth: 10, 
          fontSize: 10,
          color: getChartTextColor()
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: isDarkMode ? '#424242' : '#ffffff',
        titleColor: isDarkMode ? '#ffffff' : '#000000',
        bodyColor: isDarkMode ? '#e0e0e0' : '#666666',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1
      }
    },
    scales: {
      y: {
        grid: {
          color: getChartGridColor()
        },
        ticks: {
          color: getChartTextColor()
        }
      },
      x: {
        grid: {
          color: getChartGridColor()
        },
        ticks: {
          color: getChartTextColor()
        }
      }
    }
  }), [getChartTextColor, getChartGridColor, isDarkMode]);

  const lineChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'bottom', 
        labels: { 
          boxWidth: 10, 
          fontSize: 10,
          color: getChartTextColor()
        } 
      },
      tooltip: { 
        mode: 'index', 
        intersect: false,
        backgroundColor: isDarkMode ? '#424242' : '#ffffff',
        titleColor: isDarkMode ? '#ffffff' : '#000000',
        bodyColor: isDarkMode ? '#e0e0e0' : '#666666',
      }
    },
    scales: { 
      y: { 
        beginAtZero: true, 
        grid: { 
          display: true,
          color: getChartGridColor()
        },
        ticks: {
          color: getChartTextColor()
        }
      },
      x: {
        grid: {
          color: getChartGridColor()
        },
        ticks: {
          color: getChartTextColor()
        }
      }
    }
  }), [getChartTextColor, getChartGridColor, isDarkMode]);

  if (loading && !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress thickness={5} size={40} />
      </Box>
    );
  }

  return (
    <Container 
      maxWidth="xl" 
      sx={{ 
        py: { xs: 2, md: 4 }, 
        px: { xs: 2, sm: 3 },
        pb: 10,
        bgcolor: 'background.default',
        minHeight: '100vh'
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ color: isDarkMode ? 'primary.light' : 'inherit' }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Welcome back, {user?.full_name || user?.username || 'Officer'}
          </Typography>
        </Box>
        <Tooltip title="Refresh Data">
          <IconButton 
            onClick={handleRefresh} 
            disabled={refreshing}
            sx={{
              color: isDarkMode ? 'primary.light' : 'primary.main',
              '&:hover': {
                bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.primary.main, 0.1)
              }
            }}
          >
            <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        <StatCard 
          title="Total Meetings" 
          value={statsValues.totalMeetings} 
          icon={<EventIcon fontSize="small" />} 
          color="#1976d2" 
          loading={loading}
          trend={stats?.meetings?.trend}
        />
        <StatCard 
          title="This Month" 
          value={statsValues.thisMonthMeetings} 
          icon={<CalendarIcon fontSize="small" />} 
          color="#0288d1" 
          loading={loading}
        />
        <StatCard 
          title="My Pending" 
          value={statsValues.pendingTasks} 
          icon={<AssignmentIcon fontSize="small" />} 
          color="#ed6c02" 
          loading={loading}
          subtitle={`${statsValues.overdueTasks} overdue`}
        />
        <StatCard 
          title="Comp. Rate" 
          value={`${statsValues.completionRate}%`} 
          icon={<TrendingUpIcon fontSize="small" />} 
          color="#2e7d32" 
          loading={loading}
        />
      </Box>

      {/* Charts Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, mb: 4 }}>
        <ChartCard 
          title="Weekly Activity"
          action={
            <ToggleButtonGroup
              size="small"
              value={chartType}
              exclusive
              onChange={(e, val) => val && setChartType(val)}
              sx={{
                '& .MuiToggleButton-root': {
                  color: isDarkMode ? '#e0e0e0' : '#666666',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                  '&.Mui-selected': {
                    bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.primary.main, 0.1),
                    color: isDarkMode ? theme.palette.primary.light : theme.palette.primary.main,
                  }
                }
              }}
            >
              <ToggleButton value="bar"><BarChartIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="line"><TimelineIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          }
          height={300}
        >
          {chartType === 'bar' ? (
            <Bar data={chartData.weeklyActivity} options={chartOptions} />
          ) : (
            <Line data={chartData.weeklyActivity} options={lineChartOptions} />
          )}
        </ChartCard>

        <ChartCard title="Task Status Distribution" height={300}>
          <Doughnut data={chartData.statusDistribution} options={chartOptions} />
        </ChartCard>
      </Box>

      {/* Second Row of Charts */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, mb: 4 }}>
        <ChartCard title="Monthly Trend (Last 6 Months)" height={300}>
          <Line data={chartData.monthlyTrend} options={lineChartOptions} />
        </ChartCard>

        <ChartCard title="Priority Distribution" height={300}>
          <Pie data={chartData.priorityDistribution} options={chartOptions} />
        </ChartCard>
      </Box>

      {/* Pending Tasks and Upcoming Meetings Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Pending Tasks */}
        <Paper sx={{ 
          borderRadius: 3, 
          p: 2, 
          border: '1px solid', 
          borderColor: 'divider', 
          boxShadow: 'none', 
          height: '100%',
          bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" textTransform="uppercase" fontSize="0.7rem" letterSpacing={0.5}>
              My Pending Tasks ({pendingTasks.length})
            </Typography>
            <Button 
              size="small" 
              onClick={() => navigate('/actions/my-tasks')}
              sx={{
                color: isDarkMode ? 'primary.light' : 'primary.main',
              }}
            >
              View All
            </Button>
          </Box>

          {pendingTasks.length > 0 ? (
            <Stack spacing={2}>
              {pendingTasks.slice(0, 5).map((task) => {
                const isOverdue = task.is_overdue && !task.completed_at;
                const dueDateFormatted = task.due_date ? safeFormatDate(task.due_date) : null;
                
                return (
                  <Card 
                    key={task.id} 
                    onClick={() => navigate(`/actions/${task.id}`)}
                    sx={{ 
                      borderRadius: 2, 
                      boxShadow: 'none', 
                      border: '1px solid', 
                      borderColor: 'divider',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      bgcolor: isDarkMode ? 'background.default' : '#ffffff',
                      '&:hover': { 
                        borderColor: 'primary.main', 
                        bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.1) : 'action.hover' 
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ flex: 1, color: isDarkMode ? '#e0e0e0' : 'inherit' }}>
                          {task.title || task.description}
                        </Typography>
                        {isOverdue && (
                          <Chip size="small" label="Overdue" color="error" sx={{ height: 20, fontSize: '0.6rem', ml: 1 }} />
                        )}
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Chip 
                          size="small" 
                          label={dueDateFormatted ? `Due: ${dueDateFormatted}` : 'No Due Date'}
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 500 }}
                        />
                        <Typography variant="caption" fontWeight={800} color="primary.main">
                          {task.overall_progress_percentage}%
                        </Typography>
                      </Box>
                      
                      <LinearProgress 
                        variant="determinate" 
                        value={task.overall_progress_percentage} 
                        sx={{ 
                          height: 4, 
                          borderRadius: 2,
                          bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.1) : undefined,
                        }}
                        color={isOverdue ? 'error' : 'primary'}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">All tasks completed! 🎉</Typography>
            </Box>
          )}
        </Paper>

        {/* Upcoming Meetings */}
        <Paper sx={{ 
          borderRadius: 3, 
          p: 2, 
          border: '1px solid', 
          borderColor: 'divider', 
          boxShadow: 'none', 
          height: '100%',
          bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" textTransform="uppercase" fontSize="0.7rem" letterSpacing={0.5}>
              Upcoming Meetings
            </Typography>
            <Button 
              size="small" 
              onClick={() => navigate('/meetings')}
              sx={{
                color: isDarkMode ? 'primary.light' : 'primary.main',
              }}
            >
              View All
            </Button>
          </Box>

          {stats?.meetings?.upcoming?.length > 0 ? (
            <List disablePadding>
              {stats.meetings.upcoming.slice(0, 5).map((meeting, index, arr) => {
                const meetingDate = meeting.meeting_date || meeting.date;
                const formattedDate = meetingDate ? safeFormatDate(meetingDate, 'MMM dd, h:mm a') : 'Date TBD';
                
                return (
                  <React.Fragment key={meeting.id}>
                    <ListItem 
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                      sx={{ 
                        py: 1.5, 
                        px: 0, 
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.1) : 'action.hover',
                          borderRadius: 1
                        }
                      }}
                    >
                      <Avatar sx={{ 
                        bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.2) : 'action.hover', 
                        mr: 2, 
                        width: 40, 
                        height: 40 
                      }}>
                        <AccessTimeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                      </Avatar>
                      <ListItemText 
                        primary={<Typography variant="body2" fontWeight={700} sx={{ color: isDarkMode ? '#e0e0e0' : 'inherit' }}>{meeting.title}</Typography>}
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {formattedDate}
                          </Typography>
                        }
                      />
                      <ChevronRightIcon fontSize="small" color="disabled" />
                    </ListItem>
                    {index < arr.length - 1 && <Divider sx={{ borderColor: 'divider' }} />}
                  </React.Fragment>
                );
              })}
            </List>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CalendarIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">No upcoming meetings scheduled</Typography>
            </Box>
          )}
        </Paper>
      </Box>

      <Box sx={{ height: 40 }} />
    </Container>
  );
};

export default Dashboard;