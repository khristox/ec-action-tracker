// components/common/Navbar.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { useColorMode } from '../../context/ThemeProvider';
import {
  AppBar, Toolbar, IconButton, Typography, Box, Avatar, Menu, MenuItem,
  Tooltip, Badge, useTheme, Divider, ListItemIcon, CircularProgress,
  Popover, List, ListItem, ListItemText, ListItemAvatar, Chip, Button,
  Skeleton, alpha, LinearProgress
} from '@mui/material';
import {
  Menu as MenuIcon, Notifications, Person, Logout,
  ArrowBack as ArrowBackIcon, Assignment as AssignmentIcon,
  Warning as WarningIcon, CheckCircle as CheckCircleIcon,
  Brightness4, Brightness7, Settings, Help, Feedback,
  Dashboard as DashboardIcon, Event as EventIcon, People as PeopleIcon
} from '@mui/icons-material';
import { 
  logout, 
  selectIsLoading, 
  fetchProfilePicture, 
  selectProfilePicture,
} from '../../store/slices/authSlice';
import api from '../../services/api';

// Constants
const NOTIFICATION_REFRESH_INTERVAL = 30000; // 30 seconds
const MAX_NOTIFICATIONS_DISPLAY = 5;

// Helper function to safely get user initials
const getUserInitialsSafe = (user) => {
  if (!user) return 'U';
  
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  }
  if (user.full_name && typeof user.full_name === 'string') {
    const parts = user.full_name.split(' ');
    const firstInitial = parts[0]?.[0] || '';
    const lastInitial = parts[1]?.[0] || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }
  if (user.username && typeof user.username === 'string') {
    return user.username[0].toUpperCase();
  }
  if (user.email && typeof user.email === 'string') {
    return user.email[0].toUpperCase();
  }
  return 'U';
};

// Helper to format relative time
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  } catch {
    return null;
  }
};

const Navbar = ({ handleDrawerToggle, isMobile, sidebarWidth }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get theme context
  const { mode, toggleColorMode } = useColorMode();
  const isDarkMode = mode === 'dark';

  const [anchorElUser, setAnchorElUser] = useState(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [profileImageLoading, setProfileImageLoading] = useState(true);
  const [refreshingTasks, setRefreshingTasks] = useState(false);
  
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);
  
  const { user } = useSelector((state) => state.auth || {});
  const profilePicture = useSelector(selectProfilePicture);
  const isLoading = useSelector(selectIsLoading);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Fetch profile picture
  useEffect(() => {
    if (user?.id) {
      dispatch(fetchProfilePicture())
        .unwrap()
        .catch(() => {})
        .finally(() => {
          if (isMountedRef.current) setProfileImageLoading(false);
        });
    } else {
      setProfileImageLoading(false);
    }
  }, [dispatch, user?.id]);

  // Fetch tasks/notifications
  const fetchAllTasks = useCallback(async (showLoading = false) => {
    if (showLoading && isMountedRef.current) {
      setRefreshingTasks(true);
    }
    setLoadingNotifications(true);
    try {
      const response = await api.get('/action-tracker/actions/my-tasks', {
        params: { skip: 0, limit: 100, include_completed: false }
      });
      
      // Safely extract data
      let tasks = [];
      if (response.data?.data && Array.isArray(response.data.data)) {
        tasks = response.data.data;
      } else if (Array.isArray(response.data)) {
        tasks = response.data;
      } else if (response.data?.items && Array.isArray(response.data.items)) {
        tasks = response.data.items;
      }
      
      const notificationItems = tasks.map(task => ({
        id: task.id,
        title: task.title || task.description || 'Untitled Task',
        type: task.is_overdue ? 'overdue' : 'pending',
        due_date: task.due_date,
        progress: task.overall_progress_percentage || 0,
        is_overdue: task.is_overdue,
        priority: task.priority || 'medium'
      }));
      
      if (isMountedRef.current) {
        setNotifications(notificationItems);
        setNotificationCount(notificationItems.length);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      if (isMountedRef.current) {
        setNotifications([]);
        setNotificationCount(0);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingNotifications(false);
        setRefreshingTasks(false);
      }
    }
  }, []);

  // Set up notification refresh interval
  useEffect(() => {
    fetchAllTasks();
    intervalRef.current = setInterval(() => fetchAllTasks(), NOTIFICATION_REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAllTasks]);

  const handleLogout = async () => {
    setAnchorElUser(null);
    try {
      await dispatch(logout()).unwrap();
      navigate('/login', { replace: true });
    } catch (error) { 
      console.error("Logout failed", error); 
    }
  };

  const handleNotificationClick = (notificationId) => {
    setNotificationsAnchor(null);
    navigate(`/actions/${notificationId}`);
  };

  const handleViewAllTasks = () => {
    setNotificationsAnchor(null);
    navigate('/actions/my-tasks');
  };

  const notificationsOpen = Boolean(notificationsAnchor);
  
  // Safe avatar URL extraction
  const avatarUrl = profilePicture && typeof profilePicture === 'string' ? profilePicture : null;
  
  // Get user initials safely
  const getUserInitials = () => getUserInitialsSafe(user);
  
  // Get user display name
  const getUserDisplayName = () => {
    if (!user) return 'User';
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
    if (user.full_name) return user.full_name;
    if (user.username) return user.username;
    if (user.email) return user.email.split('@')[0];
    return 'User';
  };
  
  // Get user email
  const getUserEmail = () => user?.email || '';
  
  // Safe path checking
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const showBackButton = pathSegments.length > 1 && location.pathname !== '/dashboard';

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        height: 56,
        zIndex: theme.zIndex.drawer + 1,
        bgcolor: isDarkMode ? theme.palette.background.paper : '#1976d2',
        color: isDarkMode ? theme.palette.text.primary : '#ffffff',
        borderBottom: isDarkMode ? `1px solid ${theme.palette.divider}` : 'none',
        transition: theme.transitions.create(['background-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      }}
    >
      <Toolbar 
        variant="dense" 
        sx={{ minHeight: 56, justifyContent: 'space-between', px: { xs: 1, sm: 2 } }}
      >
        {/* Left Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={showBackButton ? () => navigate(-1) : handleDrawerToggle}
            sx={{ mr: 1 }}
            size="small"
          >
            {showBackButton ? <ArrowBackIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
          </IconButton>

          <Typography
            variant="subtitle1"
            noWrap
            onClick={() => navigate('/dashboard')}
            sx={{ 
              fontWeight: 800, 
              cursor: 'pointer',
              color: isDarkMode ? theme.palette.primary.light : '#ffffff',
              fontSize: { xs: '0.9rem', sm: '1.05rem' },
              '&:hover': { opacity: 0.9 }
            }}
          >
            {isMobile ? 'Tracker' : 'Action Tracker'}
          </Typography>
        </Box>

        {/* Right Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
          
          {/* Theme Toggle Button */}
          <Tooltip title={isDarkMode ? "Light Mode" : "Dark Mode"}>
            <IconButton 
              onClick={toggleColorMode} 
              sx={{ 
                color: isDarkMode ? 'inherit' : '#ffffff',
                '&:hover': {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                }
              }}
              size="small"
            >
              {isDarkMode ? <Brightness7 fontSize="small" /> : <Brightness4 fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Notifications Bell */}
          <Tooltip title={refreshingTasks ? "Refreshing tasks..." : "My Tasks"}>
            <IconButton 
              color="inherit" 
              size="small" 
              onClick={(e) => setNotificationsAnchor(e.currentTarget)}
              sx={{
                color: isDarkMode ? 'inherit' : '#ffffff',
                '&:hover': {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                }
              }}
            >
              <Badge badgeContent={notificationCount} color="error" max={99}>
                <Notifications fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Notifications Popover */}
          <Popover
            open={notificationsOpen}
            anchorEl={notificationsAnchor}
            onClose={() => setNotificationsAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                width: { xs: 320, sm: 380 },
                maxHeight: 450,
                borderRadius: 2,
                mt: 1,
                bgcolor: 'background.paper',
                backgroundImage: 'none',
                overflow: 'hidden'
              }
            }}
          >
            <Box sx={{ 
              p: 2, 
              borderBottom: `1px solid ${theme.palette.divider}`, 
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>My Pending Tasks</Typography>
                <Typography variant="caption" color="text.secondary">
                  {notificationCount} task{notificationCount !== 1 ? 's' : ''} pending
                </Typography>
              </Box>
              {refreshingTasks && <CircularProgress size={16} />}
            </Box>
            
            <List sx={{ p: 0, maxHeight: 320, overflow: 'auto' }}>
              {loadingNotifications && notifications.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CircularProgress size={30} />
                </Box>
              ) : notifications.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">All caught up!</Typography>
                  <Typography variant="caption" color="text.secondary">No pending tasks</Typography>
                </Box>
              ) : (
                notifications.slice(0, MAX_NOTIFICATIONS_DISPLAY).map((n) => (
                  <ListItem 
                    key={n.id} 
                    component="div"
                    onClick={() => handleNotificationClick(n.id)}
                    sx={{ 
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'transparent' }}>
                        {n.is_overdue ? 
                          <WarningIcon color="error" /> : 
                          <AssignmentIcon color="warning" />
                        }
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {n.title}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip 
                            size="small" 
                            label={n.is_overdue ? 'Overdue' : 'Pending'} 
                            color={n.is_overdue ? 'error' : 'warning'} 
                            sx={{ height: 18, fontSize: '0.6rem' }} 
                          />
                          {n.due_date && (
                            <Typography variant="caption" color="text.secondary">
                              Due: {formatRelativeTime(n.due_date)}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
            
            {notifications.length > 0 && (
              <Box sx={{ p: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button 
                  fullWidth 
                  size="small" 
                  onClick={handleViewAllTasks}
                  sx={{ textTransform: 'none' }}
                >
                  View All Tasks
                </Button>
              </Box>
            )}
          </Popover>

          {/* User Menu */}
          <Tooltip title="Account">
            <IconButton 
              onClick={(e) => setAnchorElUser(e.currentTarget)} 
              sx={{ 
                p: 0.5,
                '&:hover': {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                }
              }}
            >
              {profileImageLoading ? (
                <Skeleton variant="circular" width={30} height={30} />
              ) : (
                <Avatar 
                  src={avatarUrl}
                  sx={{ 
                    width: 30, 
                    height: 30, 
                    bgcolor: !avatarUrl ? (isDarkMode ? 'primary.light' : '#ffffff') : 'transparent',
                    color: !avatarUrl ? (isDarkMode ? '#fff' : '#1976d2') : 'inherit',
                    fontSize: '0.8rem', 
                    fontWeight: 700 
                  }}
                >
                  {!avatarUrl && getUserInitials()}
                </Avatar>
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>

      {/* User Menu Dropdown */}
      <Menu
        anchorEl={anchorElUser}
        open={Boolean(anchorElUser)}
        onClose={() => setAnchorElUser(null)}
        PaperProps={{ 
          sx: { 
            width: 240, 
            borderRadius: 2, 
            mt: 1,
            overflow: 'hidden'
          } 
        }}
      >
        <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {getUserDisplayName()}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {getUserEmail()}
          </Typography>
        </Box>
        <Divider />
        
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/dashboard'); }}>
          <ListItemIcon><DashboardIcon fontSize="small" /></ListItemIcon>
          Dashboard
        </MenuItem>
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/meetings'); }}>
          <ListItemIcon><EventIcon fontSize="small" /></ListItemIcon>
          Meetings
        </MenuItem>
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/actions'); }}>
          <ListItemIcon><AssignmentIcon fontSize="small" /></ListItemIcon>
          Actions
        </MenuItem>
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/participants'); }}>
          <ListItemIcon><PeopleIcon fontSize="small" /></ListItemIcon>
          Participants
        </MenuItem>
        <Divider />
        
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/settings/profile'); }}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/settings'); }}>
          <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/help'); }}>
          <ListItemIcon><Help fontSize="small" /></ListItemIcon>
          Help
        </MenuItem>
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/feedback'); }}>
          <ListItemIcon><Feedback fontSize="small" /></ListItemIcon>
          Feedback
        </MenuItem>
        <Divider />
        
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon><Logout fontSize="small" color="error" /></ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </AppBar>
  );
};

export default Navbar;