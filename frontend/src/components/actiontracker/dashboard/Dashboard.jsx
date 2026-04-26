// src/components/dashboard/Dashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Paper, Typography, Box, Card, CardContent, Avatar, Container,
  CircularProgress, Button, List, ListItem, ListItemText, 
  Divider, LinearProgress, Alert, Stack, Chip, IconButton,
  Tooltip, useTheme, useMediaQuery, ToggleButton, ToggleButtonGroup,
  alpha, Skeleton, Tab, Tabs, Badge
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
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
  MeetingRoom as MeetingRoomIcon,
  Person as PersonIcon,
  Today as TodayIcon,
  Upcoming as UpcomingIcon
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
  Filler,
  BarController,
  LineController,
  DoughnutController,
  PieController
} from 'chart.js';
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2';
import { format, subDays, eachDayOfInterval, isValid, parseISO, isToday, isFuture, differenceInDays } from 'date-fns';
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
  Filler,
  BarController,
  LineController,
  DoughnutController,
  PieController
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

const getMeetingStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'confirmed': return '#10b981';
    case 'attended': return '#10b981';
    case 'pending': return '#f59e0b';
    case 'missed': return '#ef4444';
    case 'excused': return '#8b5cf6';
    default: return '#6b7280';
  }
};

const getMeetingStatusLabel = (status) => {
  switch (status?.toLowerCase()) {
    case 'attended': return 'Attended';
    case 'confirmed': return 'Confirmed';
    case 'pending': return 'Pending';
    case 'missed': return 'Missed';
    case 'excused': return 'Excused';
    default: return status || 'Unknown';
  }
};

// ==================== Stat Card Component ====================
const StatCard = ({ title, value, icon, color, loading, trend, subtitle, onClick }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  return (
    <Card 
      onClick={onClick}
      sx={{ 
        borderRadius: 3, 
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)', 
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: onClick ? 'pointer' : 'default' },
        bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
        border: isDarkMode ? `1px solid ${alpha(theme.palette.common.white, 0.1)}` : 'none',
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'flex-start' }}>
          <Avatar sx={{ 
            bgcolor: isDarkMode ? alpha(color, 0.2) : `${color}12`, 
            color: color, 
            width: 40, 
            height: 40 
          }}>
            {icon}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography 
              variant="caption" 
              color="textSecondary" 
              noWrap 
              sx={{ 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                display: 'block', 
                fontSize: '0.6rem', 
                letterSpacing: 0.5 
              }}
            >
              {title}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={60} height={32} />
            ) : (
              <Typography variant="h5" fontWeight="800" sx={{ lineHeight: 1.2 }}>
                {value}
              </Typography>
            )}
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
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== Meeting Card Component ====================
const MeetingCard = ({ meeting, onClick }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const meetingDate = meeting.meeting_date ? parseISO(meeting.meeting_date) : null;
  const isUpcoming = meetingDate && isFuture(meetingDate);
  const daysUntil = meetingDate ? differenceInDays(meetingDate, new Date()) : null;
  
  return (
    <Card 
      onClick={() => onClick(meeting.id)}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Avatar sx={{ 
              bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.primary.main, 0.1),
              width: 32, 
              height: 32 
            }}>
              <MeetingRoomIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            </Avatar>
            <Typography variant="body2" fontWeight={700} sx={{ color: isDarkMode ? '#e0e0e0' : 'inherit' }}>
              {meeting.title}
            </Typography>
          </Box>
          {isUpcoming && daysUntil !== null && daysUntil <= 3 && (
            <Chip 
              size="small" 
              label={daysUntil === 0 ? "Today" : `${daysUntil} days`}
              color="warning"
              sx={{ height: 20, fontSize: '0.6rem' }}
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TodayIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {meeting.meeting_date ? safeFormatDate(meeting.meeting_date, 'MMM dd, yyyy') : 'Date TBD'}
              {meeting.start_time && ` at ${format(parseISO(meeting.start_time), 'h:mm a')}`}
            </Typography>
          </Box>
          <Chip 
            size="small" 
            label={getMeetingStatusLabel(meeting.attendance_status)}
            sx={{ 
              height: 20, 
              fontSize: '0.65rem', 
              fontWeight: 500,
              bgcolor: alpha(getMeetingStatusColor(meeting.attendance_status), 0.1),
              color: getMeetingStatusColor(meeting.attendance_status),
            }}
          />
        </Box>
        
        {meeting.location && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            📍 {meeting.location}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== Chart Card Component ====================
const ChartCard = ({ title, children, action, height = 300, loading = false }) => {
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
        <Typography 
          variant="subtitle2" 
          fontWeight={800} 
          color="text.secondary" 
          sx={{ 
            textTransform: 'uppercase', 
            fontSize: '0.7rem', 
            letterSpacing: 0.5 
          }}
        >
          {title}
        </Typography>
        {action}
      </Box>
      <Box sx={{ height, position: 'relative' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={40} />
          </Box>
        ) : children}
      </Box>
    </Paper>
  );
};

// ==================== Empty State Component ====================
const EmptyState = ({ icon: Icon, title, message, action }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Icon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: action ? 2 : 0 }}>
        {message}
      </Typography>
      {action}
    </Box>
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
  const [myMeetings, setMyMeetings] = useState({ upcoming: [], weekly_data: null });
  const [chartData, setChartData] = useState({
    weeklyActivity: null,
    statusDistribution: null,
    monthlyTrend: null,
    priorityDistribution: null
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [chartType, setChartType] = useState('bar');
  const [tabValue, setTabValue] = useState(0);

  // Get chart text color based on theme
  const getChartTextColor = useCallback(() => {
    return isDarkMode ? '#e0e0e0' : '#666666';
  }, [isDarkMode]);

  const getChartGridColor = useCallback(() => {
    return isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  }, [isDarkMode]);

  const isValidChartData = useCallback((data) => {
    if (!data || !data.labels || !Array.isArray(data.labels) || data.labels.length === 0) return false;
    if (!data.datasets || !Array.isArray(data.datasets) || data.datasets.length === 0) return false;
    return true;
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      
      const [
        statsRes,
        tasksRes,
        meetingsRes,
        weeklyActivityRes,
        statusDistributionRes,
        monthlyTrendRes,
        priorityDistributionRes
      ] = await Promise.allSettled([
        api.get('/action-tracker/dashboard/dashboard/stats'),
        api.get('/action-tracker/actions/my-tasks', { params: { limit: 100, include_completed: true } }),
        api.get('/meetings/my-meetings/upcoming', { params: { days: 60 } }),
        api.get('/charts/weekly-activity', { params: { days: 7 } }),
        api.get('/charts/status-distribution'),
        api.get('/charts/monthly-trend', { params: { months: 6 } }),
        api.get('/charts/priority-distribution'),
      ]);

      // Process stats
      if (statsRes.status === 'fulfilled' && statsRes.value.data?.success) {
        setStats(statsRes.value.data.data);
      }
      
      // Process tasks
      if (tasksRes.status === 'fulfilled') {
        const allTasks = tasksRes.value.data?.data || tasksRes.value.data || [];
        if (Array.isArray(allTasks)) {
          const pending = allTasks.filter(t => t.overall_progress_percentage < 100);
          setPendingTasks(pending);
        }
      }
      
      // Process meetings
      if (meetingsRes.status === 'fulfilled' && meetingsRes.value.data?.success) {
        setMyMeetings({
          upcoming: meetingsRes.value.data.data?.upcoming_meetings || [],
          weekly_data: meetingsRes.value.data.data
        });
      }
      
      // Process charts
      const newChartData = {};
      if (weeklyActivityRes.status === 'fulfilled' && weeklyActivityRes.value.data?.data) {
        newChartData.weeklyActivity = weeklyActivityRes.value.data.data;
      }
      if (statusDistributionRes.status === 'fulfilled' && statusDistributionRes.value.data?.data) {
        newChartData.statusDistribution = statusDistributionRes.value.data.data;
      }
      if (monthlyTrendRes.status === 'fulfilled' && monthlyTrendRes.value.data?.data) {
        newChartData.monthlyTrend = monthlyTrendRes.value.data.data;
      }
      if (priorityDistributionRes.status === 'fulfilled' && priorityDistributionRes.value.data?.data) {
        newChartData.priorityDistribution = priorityDistributionRes.value.data.data;
      }
      setChartData(newChartData);
      
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

  const statsValues = useMemo(() => ({
    totalMeetings: stats?.meetings?.total || 0,
    thisMonthMeetings: stats?.meetings?.this_month || 0,
    pendingTasks: pendingTasks.length,
    completionRate: stats?.tasks?.completion_rate || 0,
    overdueTasks: pendingTasks.filter(t => t.is_overdue).length,
    upcomingMeetings: myMeetings.upcoming.length,
    totalParticipants: stats?.participants?.total || 0
  }), [stats, pendingTasks, myMeetings]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 }, color: getChartTextColor(), padding: 10 } },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: isDarkMode ? '#424242' : '#ffffff',
        titleColor: isDarkMode ? '#ffffff' : '#000000',
        bodyColor: isDarkMode ? '#e0e0e0' : '#666666',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        callbacks: { label: (context) => `${context.dataset.label || ''}: ${context.raw}` }
      }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: getChartGridColor() }, ticks: { color: getChartTextColor(), stepSize: 1 } },
      x: { grid: { color: getChartGridColor() }, ticks: { color: getChartTextColor() } }
    }
  }), [getChartTextColor, getChartGridColor, isDarkMode]);

  const lineChartOptions = useMemo(() => ({
    ...chartOptions,
    elements: { line: { tension: 0.4 }, point: { radius: 4, hoverRadius: 6 } }
  }), [chartOptions]);

  const renderChart = (chartData, ChartComponent, options, emptyMessage = "No data available") => {
    if (!chartData || !isValidChartData(chartData)) {
      return <EmptyState icon={BarChartIcon} title="No Data" message={emptyMessage} />;
    }
    return <ChartComponent data={chartData} options={options} />;
  };

  if (loading && !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress thickness={5} size={40} />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, px: { xs: 2, sm: 3 }, pb: 10, bgcolor: 'background.default', minHeight: '100vh' }}>
      
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
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)} icon={<ErrorIcon />}>
          {error}
        </Alert>
      )}

      {/* Stats Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        <StatCard title="My Meetings" value={statsValues.upcomingMeetings} icon={<MeetingRoomIcon fontSize="small" />} color="#9c27b0" loading={loading} subtitle="Upcoming meetings" onClick={() => navigate('/meetings')} />
        <StatCard title="Total Meetings" value={statsValues.totalMeetings} icon={<EventIcon fontSize="small" />} color="#1976d2" loading={loading} trend={stats?.meetings?.trend} />
        <StatCard title="My Pending Tasks" value={statsValues.pendingTasks} icon={<AssignmentIcon fontSize="small" />} color="#ed6c02" loading={loading} subtitle={`${statsValues.overdueTasks} overdue`} onClick={() => navigate('/actions/my-tasks')} />
        <StatCard title="Completion Rate" value={`${statsValues.completionRate}%`} icon={<TrendingUpIcon fontSize="small" />} color="#2e7d32" loading={loading} />
      </Box>

      {/* My Upcoming Meetings Section - COMES FIRST */}
      <Paper sx={{ borderRadius: 3, mb: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.main, 0.05) }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MeetingRoomIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={800}>My Upcoming Meetings</Typography>
              <Chip label={`${myMeetings.upcoming.length} upcoming`} size="small" color="primary" />
            </Box>
            <Button size="small" onClick={() => navigate('/meetings')} endIcon={<ChevronRightIcon />}>
              View All Meetings
            </Button>
          </Box>
        </Box>
        
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rectangular" height={100} sx={{ m: 2 }} />)
        ) : myMeetings.upcoming.length > 0 ? (
          <Stack spacing={1.5} sx={{ p: 2 }}>
            {myMeetings.upcoming.slice(0, 5).map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} onClick={(id) => navigate(`/meetings/${id}`)} />
            ))}
          </Stack>
        ) : (
          <EmptyState icon={CalendarIcon} title="No Upcoming Meetings" message="You have no upcoming meetings scheduled." action={
            <Button variant="contained" size="small" onClick={() => navigate('/meetings/create')} sx={{ mt: 1 }}>
              Schedule a Meeting
            </Button>
          } />
        )}
      </Paper>

      {/* Tabs for Charts and Tasks */}
      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Analytics" />
          <Tab label="My Pending Tasks" />
        </Tabs>
      </Box>

      {/* Analytics Tab */}
      {tabValue === 0 && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, mb: 4 }}>
            <ChartCard title="Weekly Activity" loading={loading} action={
              <ToggleButtonGroup size="small" value={chartType} exclusive onChange={(e, val) => val && setChartType(val)}>
                <ToggleButton value="bar"><BarChartIcon fontSize="small" /></ToggleButton>
                <ToggleButton value="line"><TimelineIcon fontSize="small" /></ToggleButton>
              </ToggleButtonGroup>
            } height={300}>
              {chartType === 'bar' 
                ? renderChart(chartData.weeklyActivity, Bar, chartOptions, "No weekly activity data")
                : renderChart(chartData.weeklyActivity, Line, lineChartOptions, "No weekly activity data")}
            </ChartCard>

            <ChartCard title="Task Status Distribution" loading={loading} height={300}>
              {renderChart(chartData.statusDistribution, Doughnut, chartOptions, "No status data")}
            </ChartCard>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, mb: 4 }}>
            <ChartCard title="Monthly Trend" loading={loading} height={300}>
              {renderChart(chartData.monthlyTrend, Line, lineChartOptions, "No monthly trend data")}
            </ChartCard>

            <ChartCard title="Priority Distribution" loading={loading} height={300}>
              {renderChart(chartData.priorityDistribution, Pie, chartOptions, "No priority data")}
            </ChartCard>
          </Box>
        </>
      )}

      {/* Tasks Tab */}
      {tabValue === 1 && (
        <Paper sx={{ borderRadius: 3, p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" textTransform="uppercase">
              My Pending Tasks ({pendingTasks.length})
            </Typography>
            <Button size="small" onClick={() => navigate('/actions/my-tasks')}>View All</Button>
          </Box>

          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rectangular" height={80} sx={{ mb: 2, borderRadius: 2 }} />)
          ) : pendingTasks.length > 0 ? (
            <Stack spacing={2}>
              {pendingTasks.slice(0, 5).map((task) => {
                const isOverdue = task.is_overdue && !task.completed_at;
                const dueDateFormatted = task.due_date ? safeFormatDate(task.due_date) : null;
                
                return (
                  <Card key={task.id} onClick={() => navigate(`/actions/${task.id}`)} sx={{ borderRadius: 2, boxShadow: 'none', border: '1px solid', borderColor: 'divider', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' } }}>
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
                          {task.title || task.description}
                        </Typography>
                        {isOverdue && <Chip size="small" label="Overdue" color="error" sx={{ height: 20, fontSize: '0.6rem', ml: 1 }} />}
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Chip size="small" label={dueDateFormatted ? `Due: ${dueDateFormatted}` : 'No Due Date'} sx={{ height: 20, fontSize: '0.65rem' }} />
                        <Typography variant="caption" fontWeight={800} color="primary.main">{task.overall_progress_percentage}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={task.overall_progress_percentage} sx={{ height: 4, borderRadius: 2 }} color={isOverdue ? 'error' : 'primary'} />
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <EmptyState icon={CheckCircleIcon} title="All Done!" message="You have no pending tasks. Great job!" />
          )}
        </Paper>
      )}

      <Box sx={{ height: 40 }} />
      
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Container>
  );
};

export default Dashboard;