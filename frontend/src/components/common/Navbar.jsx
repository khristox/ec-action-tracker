import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  useTheme,
  Divider,
  ListItemIcon,
  CircularProgress,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Chip,
  Button
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications,
  Person,
  Logout,
  ArrowBack as ArrowBackIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { logout, selectIsLoading } from '../../store/slices/authSlice';
import api from '../../services/api';

const Navbar = ({ handleDrawerToggle, isMobile }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [anchorElUser, setAnchorElUser] = useState(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  
  const { user } = useSelector((state) => state.auth);
  const isLoading = useSelector(selectIsLoading);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const showBackButton = pathSegments.length > 1 && location.pathname !== '/dashboard';

  // Fetch notifications count and list
  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      // Fetch user's tasks
      const response = await api.get('/action-tracker/actions/my-tasks');
      const tasks = response.data.data || response.data || [];
      
      // Filter for pending and overdue tasks (IGNORE COMPLETED)
      const now = new Date();
      const pendingTasks = tasks.filter(task => {
        // Skip if completed
        const isCompleted = task.completed_at !== null && task.completed_at !== undefined;
        const statusCompleted = task.status === 'completed' || task.status === 'COMPLETED';
        const progressCompleted = task.overall_progress_percentage === 100;
        
        // IGNORE COMPLETED TASKS
        if (isCompleted || statusCompleted || progressCompleted) {
          return false;
        }
        
        // Include pending, in-progress, and overdue tasks
        const isOverdue = task.is_overdue === true;
        const isInProgress = task.overall_progress_percentage > 0 && task.overall_progress_percentage < 100;
        const isPending = task.status === 'pending' || task.status === 'PENDING' || task.status === 'assigned';
        
        return isOverdue || isInProgress || isPending;
      });
      
      // Create notifications array sorted by overdue first, then due date
      const notificationItems = pendingTasks.map(task => ({
        id: task.id,
        title: task.title || task.description,
        description: task.description,
        type: task.is_overdue ? 'overdue' : 'pending',
        due_date: task.due_date,
        progress: task.overall_progress_percentage || 0,
        meeting_title: task.meeting_title,
        created_at: task.created_at,
        status: task.status
      }));
      
      // Sort: Overdue first, then by due date (closest first)
      notificationItems.sort((a, b) => {
        if (a.type === 'overdue' && b.type !== 'overdue') return -1;
        if (a.type !== 'overdue' && b.type === 'overdue') return 1;
        if (a.due_date && b.due_date) {
          return new Date(a.due_date) - new Date(b.due_date);
        }
        return 0;
      });
      
      setNotifications(notificationItems);
      setNotificationCount(notificationItems.length);
      
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Fetch notifications on component mount and periodically
  useEffect(() => {
    fetchNotifications();
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    
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

  const handleNotificationsOpen = (event) => {
    setNotificationsAnchor(event.currentTarget);
    // Refresh when opening
    fetchNotifications();
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchor(null);
  };

  const handleNotificationClick = (taskId) => {
    setNotificationsAnchor(null);
    navigate(`/actions/${taskId}`);
  };

  const handleViewAllTasks = () => {
    setNotificationsAnchor(null);
    navigate('/actions/my-tasks');
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'overdue':
        return <WarningIcon sx={{ color: '#f44336', fontSize: 20 }} />;
      case 'pending':
        return <AssignmentIcon sx={{ color: '#ff9800', fontSize: 20 }} />;
      default:
        return <ScheduleIcon sx={{ color: '#2196f3', fontSize: 20 }} />;
    }
  };

  const getNotificationColor = (type) => {
    switch(type) {
      case 'overdue':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'info';
    }
  };

  const formatDueDate = (dueDate) => {
    if (!dueDate) return 'No due date';
    const date = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  };

  const notificationsOpen = Boolean(notificationsAnchor);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        height: 48,
        zIndex: theme.zIndex.drawer + 1,
        bgcolor: 'primary.main',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <Toolbar 
        variant="dense" 
        sx={{ 
          minHeight: 48, 
          justifyContent: 'space-between',
          px: { xs: 1, sm: 2 }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={showBackButton ? () => navigate(-1) : handleDrawerToggle}
            sx={{ mr: 1 }}
            size="small"
          >
            {showBackButton ? (
              <ArrowBackIcon fontSize="small" />
            ) : (
              <MenuIcon fontSize="small" />
            )}
          </IconButton>

          <Typography
            variant="subtitle1"
            noWrap
            onClick={() => navigate('/dashboard')}
            sx={{ 
              fontWeight: 800, 
              cursor: 'pointer', 
              letterSpacing: '-0.5px',
              fontSize: { xs: '0.9rem', sm: '1.05rem' },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isMobile ? 'Tracker' : 'Action Tracker'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 0.5 } }}>
          {/* Notifications Bell */}
          <Tooltip title="My Tasks">
            <IconButton 
              color="inherit" 
              size="small"
              onClick={handleNotificationsOpen}
            >
              <Badge 
                badgeContent={notificationCount} 
                color="error"
                max={99}
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.65rem',
                    height: 16,
                    minWidth: 16,
                  }
                }}
              >
                <Notifications fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Notifications Popover */}
          <Popover
            open={notificationsOpen}
            anchorEl={notificationsAnchor}
            onClose={handleNotificationsClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                width: { xs: 320, sm: 380 },
                maxHeight: 400,
                borderRadius: 2,
                mt: 1,
                overflow: 'hidden'
              }
            }}
          >
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700}>
                My Pending Tasks
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {notificationCount} task{notificationCount !== 1 ? 's' : ''} pending your attention
              </Typography>
            </Box>
            
            {loadingNotifications ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : notifications.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 48, color: '#4caf50', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  All caught up! No pending tasks.
                </Typography>
              </Box>
            ) : (
              <>
                <List sx={{ p: 0, maxHeight: 300, overflow: 'auto' }}>
                  {notifications.slice(0, 5).map((notification) => (
                    <ListItem 
                      key={notification.id}
                      button
                      onClick={() => handleNotificationClick(notification.id)}
                      sx={{ 
                        borderBottom: '1px solid #f0f0f0',
                        '&:hover': { bgcolor: '#f5f5f5' }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'transparent' }}>
                          {getNotificationIcon(notification.type)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {notification.title}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Chip 
                              size="small" 
                              label={notification.type === 'overdue' ? 'Overdue' : 'Pending'}
                              color={getNotificationColor(notification.type)}
                              sx={{ height: 18, fontSize: '0.6rem', mr: 1 }}
                            />
                            {notification.due_date && (
                              <Typography variant="caption" color="text.secondary" component="span">
                                {formatDueDate(notification.due_date)}
                              </Typography>
                            )}
                            {notification.progress > 0 && notification.progress < 100 && (
                              <Typography variant="caption" color="primary" component="span" sx={{ ml: 1 }}>
                                {notification.progress}% complete
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
                
                {notifications.length > 5 && (
                  <Box sx={{ p: 1.5, borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
                    <Button size="small" onClick={handleViewAllTasks} fullWidth>
                      View all {notificationCount} tasks
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Popover>

          {/* User Menu */}
          <Tooltip title="Account">
            <IconButton 
              onClick={(e) => setAnchorElUser(e.currentTarget)} 
              sx={{ ml: 0, p: 0.5 }}
              size="small"
            >
              {isLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <Avatar 
                  sx={{ 
                    width: { xs: 26, sm: 28 }, 
                    height: { xs: 26, sm: 28 }, 
                    bgcolor: 'white', 
                    color: 'primary.main', 
                    fontSize: '0.7rem', 
                    fontWeight: 700 
                  }}
                >
                  {user?.full_name?.[0] || user?.username?.[0] || 'A'}
                </Avatar>
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>

      {/* User Menu */}
      <Menu
        anchorEl={anchorElUser}
        open={Boolean(anchorElUser)}
        onClose={() => setAnchorElUser(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ 
          elevation: 4, 
          sx: { width: 200, mt: 1, borderRadius: 2 } 
        }}
      >
        <MenuItem onClick={() => { 
          setAnchorElUser(null); 
          navigate('/settings/profile'); 
        }}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon> 
          Profile
        </MenuItem>
        
        <MenuItem onClick={() => {
          setAnchorElUser(null);
          navigate('/actions/my-tasks');
        }}>
          <ListItemIcon><AssignmentIcon fontSize="small" /></ListItemIcon>
          My Tasks
        </MenuItem>
        
        <Divider />
        
        <MenuItem 
          onClick={handleLogout} 
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <Logout fontSize="small" color="error" />
          </ListItemIcon> 
          Logout
        </MenuItem>
      </Menu>
    </AppBar>
  );
};

export default Navbar;