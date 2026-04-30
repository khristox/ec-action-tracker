// src/components/dashboard/Dashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Paper, Typography, Box, Card, CardContent, Avatar, Container,
  CircularProgress, Button, List, ListItem, ListItemText, 
  Divider, LinearProgress, Alert, Stack, Chip, IconButton,
  Tooltip, useTheme, useMediaQuery, ToggleButton, ToggleButtonGroup,
  alpha, Skeleton, Tab, Tabs, Badge, Collapse
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
  Upcoming as UpcomingIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassEmptyIcon
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

// Meeting Status (from backend status field)
const getMeetingStatusConfig = (status) => {
  // Handle both object and string status
  let statusCode = '';
  let statusShortName = '';
  let statusName = '';
  
  if (typeof status === 'object' && status !== null) {
    statusCode = status.code || '';
    statusShortName = status.short_name || '';
    statusName = status.name || '';
  } else if (typeof status === 'string') {
    statusCode = status;
    statusShortName = status;
    statusName = status;
  }
  
  const configs = {
    'MEETING_STATUS_SCHEDULED': { label: 'Scheduled', color: '#3b82f6', bgAlpha: 0.1, icon: <ScheduleIcon sx={{ fontSize: 12 }} /> },
    'MEETING_STATUS_STARTED': { label: 'In Progress', color: '#f59e0b', bgAlpha: 0.1, icon: <HourglassEmptyIcon sx={{ fontSize: 12 }} /> },
    'MEETING_STATUS_COMPLETED': { label: 'Completed', color: '#10b981', bgAlpha: 0.1, icon: <CheckCircleIcon sx={{ fontSize: 12 }} /> },
    'MEETING_STATUS_CANCELLED': { label: 'Cancelled', color: '#ef4444', bgAlpha: 0.1, icon: <CancelIcon sx={{ fontSize: 12 }} /> },
    'MEETING_STATUS_POSTPONED': { label: 'Postponed', color: '#8b5cf6', bgAlpha: 0.1, icon: <PendingIcon sx={{ fontSize: 12 }} /> },
    'scheduled': { label: 'Scheduled', color: '#3b82f6', bgAlpha: 0.1, icon: <ScheduleIcon sx={{ fontSize: 12 }} /> },
    'started': { label: 'In Progress', color: '#f59e0b', bgAlpha: 0.1, icon: <HourglassEmptyIcon sx={{ fontSize: 12 }} /> },
    'completed': { label: 'Completed', color: '#10b981', bgAlpha: 0.1, icon: <CheckCircleIcon sx={{ fontSize: 12 }} /> },
    'cancelled': { label: 'Cancelled', color: '#ef4444', bgAlpha: 0.1, icon: <CancelIcon sx={{ fontSize: 12 }} /> },
    'postponed': { label: 'Postponed', color: '#8b5cf6', bgAlpha: 0.1, icon: <PendingIcon sx={{ fontSize: 12 }} /> }
  };
  
  // Try to match by code first
  if (configs[statusCode]) return configs[statusCode];
  if (configs[statusShortName]) return configs[statusShortName];
  if (configs[statusName?.toLowerCase()]) return configs[statusName?.toLowerCase()];
  
  return { 
    label: statusShortName || statusName || statusCode || 'Unknown', 
    color: '#6b7280', 
    bgAlpha: 0.1,
    icon: <EventIcon sx={{ fontSize: 12 }} />
  };
};



// Participant Attendance Status
const getAttendanceStatusConfig = (status) => {
  const statusStr = status || 'pending';
  
  const configs = {
    'confirmed': { label: 'Confirmed', color: '#10b981', bgAlpha: 0.1, icon: <CheckCircleIcon sx={{ fontSize: 12 }} /> },
    'attended': { label: 'Attended', color: '#10b981', bgAlpha: 0.1, icon: <CheckCircleIcon sx={{ fontSize: 12 }} /> },
    'pending': { label: 'Pending', color: '#f59e0b', bgAlpha: 0.1, icon: <ScheduleIcon sx={{ fontSize: 12 }} /> },
    'absent': { label: 'Absent', color: '#ef4444', bgAlpha: 0.1, icon: <CancelIcon sx={{ fontSize: 12 }} /> },
    'absent_with_apology': { label: 'Absent (Excused)', color: '#8b5cf6', bgAlpha: 0.1, icon: <PendingIcon sx={{ fontSize: 12 }} /> },
    'excused': { label: 'Excused', color: '#8b5cf6', bgAlpha: 0.1, icon: <PendingIcon sx={{ fontSize: 12 }} /> },
    'maybe': { label: 'Maybe', color: '#06b6d4', bgAlpha: 0.1, icon: <HourglassEmptyIcon sx={{ fontSize: 12 }} /> },
    'declined': { label: 'Declined', color: '#ef4444', bgAlpha: 0.1, icon: <CancelIcon sx={{ fontSize: 12 }} /> }
  };
  
  return configs[statusStr] || { 
    label: statusStr || 'Pending', 
    color: '#6b7280', 
    bgAlpha: 0.1,
    icon: <PendingIcon sx={{ fontSize: 12 }} />
  };
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

// ==================== Meeting Card Component (Enhanced with Statuses) ====================
const MeetingCard = ({ meeting, onClick }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState(false);
  
  const meetingDate = meeting.meeting_date ? parseISO(meeting.meeting_date) : null;
  const isUpcoming = meetingDate && isFuture(meetingDate);
  const daysUntil = meetingDate ? differenceInDays(meetingDate, new Date()) : null;
  
  // Get status configurations
  const meetingStatus = getMeetingStatusConfig(meeting.status || meeting.status_code);
  const attendanceStatus = getAttendanceStatusConfig(meeting.attendance_status);
  
  // Determine if meeting is active/ongoing
  const isActive = meeting.status_code === 'MEETING_STATUS_STARTED' || meeting.status?.code === 'MEETING_STATUS_STARTED';
  
  return (
    <Card 
      onClick={() => onClick(meeting.id)}
      sx={{ 
        borderRadius: 2, 
        boxShadow: 'none', 
        border: isActive ? '2px solid' : '1px solid',
        borderColor: isActive ? 'warning.main' : 'divider',
        cursor: 'pointer',
        transition: 'all 0.2s',
        bgcolor: isDarkMode ? 'background.default' : '#ffffff',
        position: 'relative',
        overflow: 'visible',
        '&:hover': { 
          borderColor: 'primary.main', 
          bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.1) : 'action.hover' 
        }
      }}
    >
      {/* Active indicator badge */}
      {isActive && (
        <Box sx={{
          position: 'absolute',
          top: -8,
          right: 12,
          bgcolor: 'warning.main',
          color: 'white',
          px: 1,
          py: 0.5,
          borderRadius: 20,
          fontSize: '0.65rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          zIndex: 1
        }}>
          <HourglassEmptyIcon sx={{ fontSize: 12 }} />
          Live
        </Box>
      )}
      
      <CardContent sx={{ p: 2 }}>
        {/* Header with Title and Meeting Status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
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
          
          {/* Meeting Status Chip */}
          <Tooltip title={`Meeting Status: ${meetingStatus.label}`}>
            <Chip 
              size="small" 
              label={meetingStatus.label}
              icon={meetingStatus.icon}
              sx={{ 
                height: 24, 
                fontSize: '0.7rem', 
                fontWeight: 500,
                bgcolor: alpha(meetingStatus.color, 0.1),
                color: meetingStatus.color,
                '& .MuiChip-icon': { color: meetingStatus.color, fontSize: 14 }
              }}
            />
          </Tooltip>
        </Box>
        
        {/* Date and Time */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <TodayIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {meeting.meeting_date ? safeFormatDate(meeting.meeting_date, 'MMM dd, yyyy') : 'Date TBD'}
            {meeting.start_time && ` at ${format(parseISO(meeting.start_time), 'h:mm a')}`}
            {meeting.end_time && ` - ${format(parseISO(meeting.end_time), 'h:mm a')}`}
          </Typography>
          {isUpcoming && daysUntil !== null && daysUntil <= 3 && daysUntil > 0 && (
            <Chip 
              size="small" 
              label={daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
              color="warning"
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
          )}
          {isUpcoming && daysUntil === 0 && (
            <Chip 
              size="small" 
              label="Today"
              color="success"
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
          )}
        </Box>
        
        {/* Location */}
        {meeting.location && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            📍 {meeting.location}
          </Typography>
        )}
        
        {/* Participant Status and Role */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mt: 1,
          pt: 1,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Your role: 
              <strong>
                {meeting.is_chairperson && ' Chairperson'}
                {meeting.is_secretary && !meeting.is_chairperson && ' Secretary'}
                {!meeting.is_chairperson && !meeting.is_secretary && ' Participant'}
              </strong>
            </Typography>
          </Box>
          
          {/* Attendance Status Chip */}
          <Tooltip title={`Attendance: ${attendanceStatus.label}`}>
            <Chip 
              size="small" 
              label={attendanceStatus.label}
              icon={attendanceStatus.icon}
              sx={{ 
                height: 22, 
                fontSize: '0.65rem', 
                fontWeight: 500,
                bgcolor: alpha(attendanceStatus.color, 0.1),
                color: attendanceStatus.color,
                '& .MuiChip-icon': { color: attendanceStatus.color, fontSize: 12 }
              }}
            />
          </Tooltip>
        </Box>
        
        {/* Expand for more details */}
        <Button 
          size="small" 
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          sx={{ mt: 1, textTransform: 'none' }}
        >
          {expanded ? 'Show less' : 'Show details'}
        </Button>
        
        <Collapse in={expanded}>
          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 1 }}>
            <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
              Meeting Information
            </Typography>
            {meeting.description && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                📝 {meeting.description}
              </Typography>
            )}
            {meeting.status?.description && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                ℹ️ Status: {meeting.status.description}
              </Typography>
            )}
            {meeting.attendance_status === 'absent_with_apology' && (
              <Typography variant="caption" color="warning.main" display="block">
                ⚠️ You have submitted an apology for this meeting
              </Typography>
            )}
          </Box>
        </Collapse>
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

  // Calculate meeting status statistics
  const meetingStatusStats = useMemo(() => {
    const meetings = myMeetings.upcoming;
    const stats = {
      scheduled: 0,
      started: 0,
      completed: 0,
      cancelled: 0,
      postponed: 0
    };
    
    meetings.forEach(meeting => {
      const statusCode = meeting.status_code || meeting.status?.code || '';
      if (statusCode.includes('SCHEDULED')) stats.scheduled++;
      else if (statusCode.includes('STARTED')) stats.started++;
      else if (statusCode.includes('COMPLETED')) stats.completed++;
      else if (statusCode.includes('CANCELLED')) stats.cancelled++;
      else if (statusCode.includes('POSTPONED')) stats.postponed++;
      else stats.scheduled++;
    });
    
    return stats;
  }, [myMeetings.upcoming]);

  const statsValues = useMemo(() => ({
    totalMeetings: stats?.meetings?.total || 0,
    thisMonthMeetings: stats?.meetings?.this_month || 0,
    pendingTasks: pendingTasks.length,
    completionRate: stats?.tasks?.completion_rate || 0,
    overdueTasks: pendingTasks.filter(t => t.is_overdue).length,
    upcomingMeetings: myMeetings.upcoming.length,
    totalParticipants: stats?.participants?.total || 0,
    activeMeetings: meetingStatusStats.started
  }), [stats, pendingTasks, myMeetings, meetingStatusStats]);

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
        <StatCard 
          title="My Meetings" 
          value={statsValues.upcomingMeetings} 
          icon={<MeetingRoomIcon fontSize="small" />} 
          color="#9c27b0" 
          loading={loading} 
          subtitle={`${statsValues.activeMeetings} active, ${statsValues.upcomingMeetings - statsValues.activeMeetings} upcoming`}
          onClick={() => navigate('/meetings')} 
        />
        <StatCard 
          title="Total Meetings" 
          value={statsValues.totalMeetings} 
          icon={<EventIcon fontSize="small" />} 
          color="#1976d2" 
          loading={loading} 
          trend={stats?.meetings?.trend} 
        />
        <StatCard 
          title="My Pending Tasks" 
          value={statsValues.pendingTasks} 
          icon={<AssignmentIcon fontSize="small" />} 
          color="#ed6c02" 
          loading={loading} 
          subtitle={`${statsValues.overdueTasks} overdue`} 
          onClick={() => navigate('/actions/my-tasks')} 
        />
        <StatCard 
          title="Completion Rate" 
          value={`${statsValues.completionRate}%`} 
          icon={<TrendingUpIcon fontSize="small" />} 
          color="#2e7d32" 
          loading={loading} 
        />
      </Box>

      {/* My Upcoming Meetings Section - Enhanced with Statuses */}
      <Paper sx={{ borderRadius: 3, mb: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.main, 0.05) }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <MeetingRoomIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={800}>My Upcoming Meetings</Typography>
              <Chip label={`${myMeetings.upcoming.length} upcoming`} size="small" color="primary" />
              
              {/* Meeting Status Summary Chips */}
              <Box sx={{ display: 'flex', gap: 0.5, ml: { xs: 0, sm: 2 } }}>
                {meetingStatusStats.scheduled > 0 && (
                  <Tooltip title="Scheduled">
                    <Chip 
                      size="small" 
                      label={meetingStatusStats.scheduled} 
                      sx={{ bgcolor: alpha('#3b82f6', 0.1), color: '#3b82f6', height: 20, fontSize: '0.65rem' }}
                    />
                  </Tooltip>
                )}
                {meetingStatusStats.started > 0 && (
                  <Tooltip title="In Progress">
                    <Chip 
                      size="small" 
                      label={meetingStatusStats.started} 
                      sx={{ bgcolor: alpha('#f59e0b', 0.1), color: '#f59e0b', height: 20, fontSize: '0.65rem' }}
                    />
                  </Tooltip>
                )}
              </Box>
            </Box>
            <Button size="small" onClick={() => navigate('/meetings')} endIcon={<ChevronRightIcon />}>
              View All Meetings
            </Button>
          </Box>
        </Box>
        
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rectangular" height={180} sx={{ m: 2 }} />)
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
          <Tab label={`My Pending Tasks (${pendingTasks.length})`} />
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