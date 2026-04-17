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

// Font Awesome icon mapping (same as Sidebar)
const fontAwesomeIcons = {
  // Solid icons
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
  
  // Brand icons
  'fab fa-facebook': faFacebook,
  'fab fa-twitter': faTwitter,
  'fab fa-google': faGoogle,
  'fab fa-github': faGithub,
};

// MUI icon mapping (same as Sidebar)
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
  Dashboard: DashboardIcon,
  Meeting: EventIcon,
  Action: AssignmentIcon,
  Participant: PeopleIcon,
  Profile: PersonIcon,
};

const getIconComponent = (icon, iconType = 'mui', iconLibrary = 'fas') => {
  // Handle Font Awesome icons
  if (iconType === 'fontawesome') {
    // Check if it's a brand icon
    let iconName = icon;
    if (iconLibrary === 'fab' && icon.startsWith('fa-')) {
      iconName = `fab fa-${icon.replace('fa-', '')}`;
    }
    const faIcon = fontAwesomeIcons[iconName];
    if (faIcon) {
      return <FontAwesomeIcon icon={faIcon} />;
    }
    // Try with fa- prefix
    const withPrefix = `fa-${icon}`;
    const fallbackIcon = fontAwesomeIcons[withPrefix];
    if (fallbackIcon) {
      return <FontAwesomeIcon icon={fallbackIcon} />;
    }
    // Default fallback
    return <FontAwesomeIcon icon={faHome} />;
  }
  
  // Handle MUI icons
  if (iconType === 'mui' || iconType === 'material_symbols') {
    const Icon = muiIcons[icon];
    if (Icon) {
      return <Icon />;
    }
    // Try to find by different case
    const capitalizedIcon = icon?.charAt(0).toUpperCase() + icon?.slice(1);
    const FallbackIcon = muiIcons[capitalizedIcon];
    if (FallbackIcon) {
      return <FallbackIcon />;
    }
  }
  
  // Handle custom/image icons
  if (iconType === 'custom' && icon) {
    return <img src={icon} alt="icon" style={{ width: 24, height: 24 }} />;
  }
  
  // Default fallback
  return <DashboardIcon />;
};

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  
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
// Update fetchMenus function
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
      // Fallback to default menus
      setMenus(getDefaultMenus());
    }
  } catch (error) {
    console.error('Error fetching mobile menus:', error);
    // Use default menus on error
    setMenus(getDefaultMenus());
  } finally {
    setLoading(false);
  }
}, []);

// Default menus function
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

  // Fetch badge counts
 // Update the fetchBadgeCounts function to handle API responses correctly
const fetchBadgeCounts = useCallback(async () => {
  try {
    const counts = {};
    
    const hasMeetings = menus.some(m => m.code === 'meetings');
    if (hasMeetings) {
      const meetingsRes = await api.get('/action-tracker/meetings/', {
        params: { limit: 100, upcoming: true }
      });
      // Handle different response structures
      let meetings = meetingsRes.data.data || meetingsRes.data || [];
      if (!Array.isArray(meetings)) {
        meetings = meetings.items || [];
      }
      counts.meetings = meetings.filter(m => m && new Date(m.meeting_date) > new Date()).length;
    }
    
    const hasActions = menus.some(m => m.code === 'actions');
    if (hasActions) {
      const tasksRes = await api.get('/action-tracker/actions/my-tasks', {
        params: { limit: 100, include_completed: false }
      });
      let tasks = tasksRes.data.data || tasksRes.data || [];
      if (!Array.isArray(tasks)) {
        tasks = tasks.items || [];
      }
      counts.actions = tasks.filter(t => t && !t.completed_at && !t.is_overdue).length;
      counts.overdue = tasks.filter(t => t && t.is_overdue && !t.completed_at).length;
    }
    
    setBadgeCounts(counts);
  } catch (error) {
    console.error('Error fetching badge counts:', error);
    // Set default counts on error
    setBadgeCounts({ meetings: 0, actions: 0, overdue: 0 });
  }
}, [menus]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  useEffect(() => {
    if (menus.length > 0) {
      fetchBadgeCounts();
      const interval = setInterval(fetchBadgeCounts, 60000);
      return () => clearInterval(interval);
    }
  }, [menus, fetchBadgeCounts]);

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
        }}
        elevation={3}
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
        }}
        elevation={3}
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