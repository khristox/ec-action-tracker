// src/components/layout/MobileBottomNav.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Fade,
  Box,
  Typography,
  Chip,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Event as EventIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Help as HelpIcon,
  Feedback as FeedbackIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
// Font Awesome imports
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome, faCalendarAlt, faTasks, faUsers, 
  faCog, faUser, faSignOutAlt, faQuestionCircle,
  faComment, faSyncAlt, faChartLine, faBell,
  faFolder, faFileAlt, faCheckCircle, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { 
  faFacebook, faTwitter, faGoogle, faGithub 
} from '@fortawesome/free-brands-svg-icons';
import api from '../../services/api';
import { logout } from '../../store/slices/authSlice';

// Font Awesome icon mapping
const fontAwesomeIcons = {
  'fa-home': faHome,
  'fa-tachometer-alt': faHome,
  'fa-calendar-alt': faCalendarAlt,
  'fa-tasks': faTasks,
  'fa-users': faUsers,
  'fa-cog': faCog,
  'fa-user': faUser,
  'fa-sign-out-alt': faSignOutAlt,
  'fa-question-circle': faQuestionCircle,
  'fa-comment': faComment,
  'fa-sync-alt': faSyncAlt,
  'fa-chart-line': faChartLine,
  'fa-bell': faBell,
  'fa-folder': faFolder,
  'fa-file-alt': faFileAlt,
  'fa-check-circle': faCheckCircle,
  'fa-exclamation-triangle': faExclamationTriangle,
  'fab fa-facebook': faFacebook,
  'fab fa-twitter': faTwitter,
  'fab fa-google': faGoogle,
  'fab fa-github': faGithub,
};

// MUI icon mapping
const muiIcons = {
  Dashboard: DashboardIcon,
  Event: EventIcon,
  Assignment: AssignmentIcon,
  People: PeopleIcon,
  Settings: SettingsIcon,
  Person: PersonIcon,
  CalendarMonth: EventIcon,
  List: AssignmentIcon,
  Group: PeopleIcon,
  Description: AssignmentIcon,
  Assessment: AssignmentIcon,
  Folder: AssignmentIcon,
  Warning: AssignmentIcon,
  Task: AssignmentIcon,
  Add: AssignmentIcon,
  PersonAdd: PeopleIcon,
  Upload: AssignmentIcon,
  Download: AssignmentIcon,
  Article: AssignmentIcon,
  TrendingUp: AssignmentIcon,
  Tune: SettingsIcon,
  Badge: SettingsIcon,
  History: SettingsIcon,
  Security: SettingsIcon,
  Notifications: SettingsIcon,
  Calendar: EventIcon,
  Home: DashboardIcon,
  Meeting: EventIcon,
  Action: AssignmentIcon,
  Participant: PeopleIcon,
  Profile: PersonIcon,
};

const getIconComponent = (icon, iconType = 'mui', iconLibrary = 'fas') => {
  if (iconType === 'fontawesome') {
    let iconName = icon;
    if (iconLibrary === 'fab' && icon.startsWith('fa-')) {
      iconName = `fab fa-${icon.replace('fa-', '')}`;
    }
    const faIcon = fontAwesomeIcons[iconName];
    if (faIcon) {
      return <FontAwesomeIcon icon={faIcon} />;
    }
    const withPrefix = `fa-${icon}`;
    const fallbackIcon = fontAwesomeIcons[withPrefix];
    if (fallbackIcon) {
      return <FontAwesomeIcon icon={fallbackIcon} />;
    }
    return <FontAwesomeIcon icon={faHome} />;
  }
  
  if (iconType === 'mui' || iconType === 'material_symbols') {
    const Icon = muiIcons[icon];
    if (Icon) {
      return <Icon />;
    }
    const capitalizedIcon = icon?.charAt(0).toUpperCase() + icon?.slice(1);
    const FallbackIcon = muiIcons[capitalizedIcon];
    if (FallbackIcon) {
      return <FallbackIcon />;
    }
  }
  
  if (iconType === 'custom' && icon) {
    return <img src={icon} alt="icon" style={{ width: 24, height: 24 }} />;
  }
  
  return <DashboardIcon />;
};

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [badgeCounts, setBadgeCounts] = useState({
    meetings: 0,
    actions: 0,
    overdue: 0,
  });
  const open = Boolean(anchorEl);

  // Fetch dynamic menus from backend
  const fetchMenus = useCallback(async () => {
    try {
      const response = await api.get('/menus/mobile');
      const menuData = response.data.data || response.data || [];
      
      const mobileMenus = menuData
        .filter(menu => menu.can_show_mb_bottom === true && menu.is_active === true)
        .sort((a, b) => a.sort_order - b.sort_order)
        .slice(0, 5);
      
      if (mobileMenus.length > 0) {
        setMenus(mobileMenus);
      } else {
        setMenus(getDefaultMenus());
      }
    } catch (error) {
      console.error('Error fetching mobile menus:', error);
      setMenus(getDefaultMenus());
    } finally {
      setLoading(false);
    }
  }, []);

  const getDefaultMenus = () => {
    return [
      { 
        id: 'dashboard', 
        code: 'dashboard', 
        title: 'Home', 
        icon: 'Dashboard', 
        icon_type: 'mui',
        icon_library: 'mui',
        path: '/dashboard', 
        sort_order: 1,
        is_active: true,
        can_show_mb_bottom: true
      },
      { 
        id: 'meetings', 
        code: 'meetings', 
        title: 'Meetings', 
        icon: 'Event', 
        icon_type: 'mui',
        icon_library: 'mui',
        path: '/meetings', 
        sort_order: 2,
        is_active: true,
        can_show_mb_bottom: true
      },
      { 
        id: 'actions', 
        code: 'actions', 
        title: 'Actions', 
        icon: 'Assignment', 
        icon_type: 'mui',
        icon_library: 'mui',
        path: '/actions', 
        sort_order: 3,
        is_active: true,
        can_show_mb_bottom: true
      },
      { 
        id: 'participants', 
        code: 'participants', 
        title: 'People', 
        icon: 'People', 
        icon_type: 'mui',
        icon_library: 'mui',
        path: '/participants', 
        sort_order: 4,
        is_active: true,
        can_show_mb_bottom: true
      },
      { 
        id: 'profile', 
        code: 'profile', 
        title: 'Profile', 
        icon: 'Person', 
        icon_type: 'mui',
        icon_library: 'mui',
        path: '/profile', 
        sort_order: 5,
        is_active: true,
        can_show_mb_bottom: true
      },
    ];
  };

  // Fetch meeting count for the logged-in user
  const fetchMeetingCount = useCallback(async () => {
    try {
      const response = await api.get('/action-tracker/meetings/', {
        params: { 
          limit: 100, 
          upcoming: true,
          user_id: user?.id 
        }
      });
      
      let meetings = response.data.data || response.data || [];
      if (!Array.isArray(meetings)) {
        meetings = meetings.items || [];
      }
      
      const upcomingMeetings = meetings.filter(meeting => {
        if (!meeting || !meeting.meeting_date) return false;
        const meetingDate = new Date(meeting.meeting_date);
        const now = new Date();
        return meetingDate > now;
      });
      
      return upcomingMeetings.length;
    } catch (error) {
      console.error('Error fetching meeting count:', error);
      return 0;
    }
  }, [user?.id]);

  // Fetch action/task count for the logged-in user
  const fetchActionCount = useCallback(async () => {
    try {
      const response = await api.get('/action-tracker/actions/my-tasks', {
        params: { 
          limit: 100, 
          include_completed: false 
        }
      });
      
      let tasks = response.data.data || response.data || [];
      if (!Array.isArray(tasks)) {
        tasks = tasks.items || [];
      }
      
      const pendingTasks = tasks.filter(task => 
        task && !task.completed_at && !task.is_overdue
      );
      
      const overdueTasks = tasks.filter(task => 
        task && task.is_overdue && !task.completed_at
      );
      
      return {
        pending: pendingTasks.length,
        overdue: overdueTasks.length,
        total: tasks.filter(task => task && !task.completed_at).length
      };
    } catch (error) {
      console.error('Error fetching action count:', error);
      return { pending: 0, overdue: 0, total: 0 };
    }
  }, []);

  // Fetch all badge counts based on dynamic menus
  const fetchBadgeCounts = useCallback(async () => {
    try {
      const counts = {
        meetings: 0,
        actions: 0,
        overdue: 0,
      };
      
      // Check if meetings menu exists and fetch meeting count
      const hasMeetings = menus.some(m => m.code === 'meetings');
      if (hasMeetings && user?.id) {
        counts.meetings = await fetchMeetingCount();
      }
      
      // Check if actions menu exists and fetch action count
      const hasActions = menus.some(m => m.code === 'actions');
      if (hasActions && user?.id) {
        const actionCounts = await fetchActionCount();
        counts.actions = actionCounts.pending;
        counts.overdue = actionCounts.overdue;
      }
      
      setBadgeCounts(counts);
    } catch (error) {
      console.error('Error fetching badge counts:', error);
      setBadgeCounts({ meetings: 0, actions: 0, overdue: 0 });
    }
  }, [menus, user?.id, fetchMeetingCount, fetchActionCount]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  useEffect(() => {
    if (menus.length > 0 && user?.id) {
      fetchBadgeCounts();
      const interval = setInterval(fetchBadgeCounts, 60000);
      return () => clearInterval(interval);
    }
  }, [menus, user?.id, fetchBadgeCounts]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && menus.length > 0 && user?.id) {
        fetchBadgeCounts();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [menus, user?.id, fetchBadgeCounts]);

  const getValueFromPath = useCallback(() => {
    const path = location.pathname;
    const index = menus.findIndex(menu => path.startsWith(menu.path));
    return index >= 0 ? index : 0;
  }, [location.pathname, menus]);

  useEffect(() => {
    if (menus.length > 0) {
      setValue(getValueFromPath());
    }
  }, [getValueFromPath, menus]);

  const handleNavigation = (newValue) => {
    setValue(newValue);
    const menu = menus[newValue];
    if (menu && menu.path) {
      navigate(menu.path);
    }
  };

  const handleProfileClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMenuAction = (path) => {
    navigate(path);
    handleClose();
  };

  const handleLogout = async () => {
    handleClose();
    await dispatch(logout());
    navigate('/login');
  };

  const getBadgeContent = (menuCode) => {
    if (menuCode === 'meetings' && badgeCounts.meetings > 0) {
      return badgeCounts.meetings > 99 ? '99+' : badgeCounts.meetings;
    }
    if (menuCode === 'actions' && badgeCounts.actions > 0) {
      return badgeCounts.actions > 99 ? '99+' : badgeCounts.actions;
    }
    return null;
  };

  const getBadgeColor = (menuCode) => {
    if (menuCode === 'meetings' && badgeCounts.meetings > 0) {
      return badgeCounts.meetings > 5 ? 'error' : badgeCounts.meetings > 2 ? 'warning' : 'info';
    }
    if (menuCode === 'actions') {
      if (badgeCounts.overdue > 0) return 'error';
      if (badgeCounts.actions > 0) return 'warning';
    }
    return 'default';
  };

  if (loading) {
    return (
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.drawer + 1,
          py: 1,
          display: 'flex',
          justifyContent: 'center',
          bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
          boxShadow: isDarkMode 
            ? '0 -2px 8px rgba(0, 0, 0, 0.3)' 
            : '0 -2px 8px rgba(0, 0, 0, 0.08)',
        }}
      >
        <CircularProgress size={30} />
      </Paper>
    );
  }

  return (
    <>
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          borderRadius: 0,
          background: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(10px)',
          // Dynamic shadow based on theme mode - removed static elevation
          boxShadow: isDarkMode 
            ? '0 -2px 8px rgba(0, 0, 0, 0.3)' 
            : '0 -2px 8px rgba(0, 0, 0, 0.08)',
        }}
      >
        <BottomNavigation
          showLabels
          value={value}
          onChange={(_, newValue) => handleNavigation(newValue)}
          sx={{
            '& .MuiBottomNavigationAction-root': {
              transition: 'all 0.2s ease',
              '&.Mui-selected': {
                transform: 'translateY(-2px)',
              },
            },
          }}
        >
          {menus.map((menu, index) => {
            const iconElement = getIconComponent(menu.icon, menu.icon_type, menu.icon_library);
            const badgeContent = getBadgeContent(menu.code);
            const badgeColor = getBadgeColor(menu.code);
            
            return (
              <BottomNavigationAction
                key={menu.id || menu.code}
                label={menu.title}
                icon={
                  <Badge
                    badgeContent={badgeContent}
                    color={badgeColor}
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.65rem',
                        height: 18,
                        minWidth: 18,
                        borderRadius: 9,
                      },
                    }}
                  >
                    {iconElement}
                  </Badge>
                }
              />
            );
          })}
        </BottomNavigation>
      </Paper>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        TransitionComponent={Fade}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: {
            mb: 7,
            borderRadius: 2,
            minWidth: 220,
            overflow: 'visible',
            bgcolor: isDarkMode ? 'background.paper' : '#ffffff',
            boxShadow: isDarkMode 
              ? '0 4px 20px rgba(0, 0, 0, 0.5)' 
              : '0 4px 20px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
              {user?.full_name?.[0] || user?.username?.[0] || 'U'}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {user?.full_name || user?.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
          </Box>
        </Box>
        
        <Divider />
        
        <Box sx={{ px: 2, py: 1, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
          {menus.some(m => m.code === 'meetings') && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Upcoming Meetings</Typography>
              <Chip 
                label={badgeCounts.meetings || 0} 
                size="small" 
                color={badgeCounts.meetings > 0 ? 'primary' : 'default'}
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            </Box>
          )}
          
          {menus.some(m => m.code === 'actions') && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">Pending Actions</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {badgeCounts.actions > 0 && (
                  <Chip 
                    label={`${badgeCounts.actions} pending`} 
                    size="small" 
                    color="warning"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
                {badgeCounts.overdue > 0 && (
                  <Chip 
                    label={`${badgeCounts.overdue} overdue`} 
                    size="small" 
                    color="error"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
              </Box>
            </Box>
          )}
        </Box>
        
        <Divider />
        
        <MenuItem onClick={() => handleMenuAction('/profile')}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          <ListItemText>My Profile</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleMenuAction('/settings')}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleMenuAction('/help')}>
          <ListItemIcon><HelpIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Help & Support</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleMenuAction('/feedback')}>
          <ListItemIcon><FeedbackIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Send Feedback</ListItemText>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={fetchBadgeCounts} sx={{ justifyContent: 'center' }}>
          <ListItemIcon sx={{ minWidth: 0, mr: 1 }}><RefreshIcon fontSize="small" /></ListItemIcon>
          <Typography variant="caption" color="text.secondary">Refresh counts</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

export default MobileBottomNav;