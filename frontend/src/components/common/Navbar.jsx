// components/common/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { useColorMode } from '../../context/ThemeProvider';
import {
  AppBar, Toolbar, IconButton, Typography, Box, Avatar, Menu, MenuItem,
  Tooltip, Badge, useTheme, Divider, ListItemIcon, CircularProgress,
  Popover, List, ListItem, ListItemText, ListItemAvatar, Chip, Button
} from '@mui/material';
import {
  Menu as MenuIcon, Notifications, Person, Logout,
  ArrowBack as ArrowBackIcon, Assignment as AssignmentIcon,
  Warning as WarningIcon, CheckCircle as CheckCircleIcon,
  Brightness4, Brightness7 
} from '@mui/icons-material';
import { logout, selectIsLoading } from '../../store/slices/authSlice';
import api from '../../services/api';

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
  
  const { user } = useSelector((state) => state.auth);
  const isLoading = useSelector(selectIsLoading);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const showBackButton = pathSegments.length > 1 && location.pathname !== '/dashboard';

  const fetchAllTasks = async () => {
    setLoadingNotifications(true);
    try {
      const response = await api.get('/action-tracker/actions/my-tasks', {
        params: { skip: 0, limit: 100, include_completed: false }
      });
      const tasks = response.data.data || response.data || [];
      const notificationItems = tasks.map(task => ({
        id: task.id,
        title: task.title || task.description || 'Untitled Task',
        type: task.is_overdue ? 'overdue' : 'pending',
        due_date: task.due_date,
        progress: task.overall_progress_percentage || 0,
        is_overdue: task.is_overdue
      }));
      setNotifications(notificationItems);
      setNotificationCount(notificationItems.length);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
    const interval = setInterval(fetchAllTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setAnchorElUser(null);
    try {
      await dispatch(logout()).unwrap();
      navigate('/login', { replace: true });
    } catch (error) { 
      console.error("Logout failed", error); 
    }
  };

  const notificationsOpen = Boolean(notificationsAnchor);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        height: 48,
        zIndex: theme.zIndex.drawer + 1,
        // Original blue color in light mode, dark background in dark mode
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
        sx={{ minHeight: 48, justifyContent: 'space-between', px: { xs: 1, sm: 2 } }}
      >
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
            }}
          >
            {isMobile ? 'Tracker' : 'Action Tracker'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
          
          {/* THEME TOGGLE BUTTON */}
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
          <Tooltip title="My Tasks">
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

          <Popover
            open={notificationsOpen}
            anchorEl={notificationsAnchor}
            onClose={() => setNotificationsAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                width: { xs: 320, sm: 380 },
                maxHeight: 400,
                borderRadius: 2,
                mt: 1,
                bgcolor: 'background.paper',
                backgroundImage: 'none'
              }
            }}
          >
            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" fontWeight={700}>My Pending Tasks</Typography>
              <Typography variant="caption" color="text.secondary">
                {notificationCount} tasks pending
              </Typography>
            </Box>
            
            <List sx={{ p: 0, maxHeight: 300, overflow: 'auto' }}>
              {notifications.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="body2">All caught up!</Typography>
                </Box>
              ) : (
                notifications.slice(0, 5).map((n) => (
                  <ListItem 
                    key={n.id} 
                    button 
                    onClick={() => { setNotificationsAnchor(null); navigate(`/actions/${n.id}`); }}
                    sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'transparent' }}>
                        {n.type === 'overdue' ? <WarningIcon color="error" /> : <AssignmentIcon color="warning" />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography variant="body2" fontWeight={600}>{n.title}</Typography>}
                      secondary={<Chip size="small" label={n.is_overdue ? 'Overdue' : 'Pending'} color={n.is_overdue ? 'error' : 'warning'} sx={{ height: 16, fontSize: '0.6rem' }} />}
                    />
                  </ListItem>
                ))
              )}
            </List>
            <Box sx={{ p: 1 }}>
              <Button fullWidth size="small" onClick={() => { setNotificationsAnchor(null); navigate('/actions/my-tasks'); }}>
                View All
              </Button>
            </Box>
          </Popover>

          {/* User Menu */}
          <IconButton 
            onClick={(e) => setAnchorElUser(e.currentTarget)} 
            sx={{ 
              p: 0.5,
              '&:hover': {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
              }
            }}
          >
            <Avatar 
              sx={{ 
                width: 28, height: 28, 
                bgcolor: isDarkMode ? 'primary.light' : '#ffffff', 
                color: isDarkMode ? '#fff' : '#1976d2', 
                fontSize: '0.75rem', 
                fontWeight: 700 
              }}
            >
              {user?.full_name?.[0] || user?.username?.[0] || 'U'}
            </Avatar>
          </IconButton>
        </Box>
      </Toolbar>

      <Menu
        anchorEl={anchorElUser}
        open={Boolean(anchorElUser)}
        onClose={() => setAnchorElUser(null)}
        PaperProps={{ sx: { width: 200, borderRadius: 2, mt: 1 } }}
      >
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/settings/profile'); }}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon> Profile
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon><Logout fontSize="small" color="error" /></ListItemIcon> Logout
        </MenuItem>
      </Menu>
    </AppBar>
  );
};

export default Navbar;