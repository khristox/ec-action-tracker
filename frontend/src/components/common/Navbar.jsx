import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
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
  CircularProgress, // Added for loading state
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications,
  Person,
  Settings,
  Logout,
  Dashboard,
} from '@mui/icons-material';

import { logout, selectIsLoading } from '../../store/slices/authSlice';

const Navbar = ({ open, handleDrawerToggle, drawerWidth, isMobile }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [anchorElNotif, setAnchorElNotif] = useState(null);
  
  const { user } = useSelector((state) => state.auth);
  const isLoading = useSelector(selectIsLoading); // Use the unified loading state

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);
  const handleOpenNotifMenu = (event) => setAnchorElNotif(event.currentTarget);
  const handleCloseNotifMenu = () => setAnchorElNotif(null);

  /**
   * Improved Logout Handler
   * 1. Closes menu immediately for better UX.
   * 2. Executes thunk and waits for completion.
   * 3. Redirects to login using { replace: true } to clear history stack.
   */
  const handleLogout = async () => {
    handleCloseUserMenu();
    try {
      // .unwrap() allows us to wait for the action to finish
      await dispatch(logout()).unwrap();
    } catch (error) {
      console.error("Logout failed, but proceeding to login page", error);
    } finally {
      // Always redirect to login, ensuring user isn't stuck on a private route
      navigate('/login', { replace: true });
    }
  };

  // Helper for generic navigation
  const handleNav = (path) => {
    handleCloseUserMenu();
    navigate(path);
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: theme.zIndex.drawer + 1,
        width: { sm: `calc(100% - ${open && !isMobile ? drawerWidth : 0}px)` },
        ml: { sm: `${open && !isMobile ? drawerWidth : 0}px` },
        transition: theme.transitions.create(['width', 'margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
      }}
    >
      <Toolbar>
        {(isMobile || !open) && (
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
        )}
        
        <Typography
          variant="h6"
          noWrap
          component="div"
          onClick={() => navigate('/dashboard')}
          sx={{
            flexGrow: 1,
            fontSize: { xs: '1rem', sm: '1.25rem' },
            cursor: 'pointer',
            '&:hover': { opacity: 0.8 },
          }}
        >
          Action Tracker
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton color="inherit" onClick={handleOpenNotifMenu}>
            <Badge badgeContent={3} color="error">
              <Notifications />
            </Badge>
          </IconButton>
          
          <Tooltip title="Account settings">
            <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }} disabled={isLoading}>
              {/* Show loading spinner if auth is busy */}
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <Avatar 
                  alt={user?.full_name || user?.username || 'User'} 
                  src={user?.avatar_url}
                  sx={{ width: 32, height: 32, border: `1px solid ${theme.palette.divider}` }}
                >
                  {user?.full_name?.[0] || user?.username?.[0] || 'U'}
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
        onClose={handleCloseUserMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 220, mt: 1.5 } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1" fontWeight="bold" noWrap>
            {user?.full_name || user?.username || 'User'}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: '0.75rem' }}>
            {user?.email}
          </Typography>
        </Box>
        <Divider />
        
        <MenuItem onClick={() => handleNav('/dashboard')}>
          <ListItemIcon><Dashboard fontSize="small" /></ListItemIcon>
          Dashboard
        </MenuItem>
        
        <MenuItem onClick={() => handleNav('/settings/profile')}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon>
          Profile
        </MenuItem>
        
        <MenuItem onClick={() => handleNav('/settings')}>
          <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
          Settings
        </MenuItem>
        
        <Divider />
        
        {/* Improved Logout Item */}
        <MenuItem 
          onClick={handleLogout} 
          sx={{ 
            color: 'error.main',
            '&:hover': { backgroundColor: 'error.light', color: 'white' } 
          }}
        >
          <ListItemIcon>
            <Logout fontSize="small" color="inherit" />
          </ListItemIcon>
          {isLoading ? 'Logging out...' : 'Logout'}
        </MenuItem>
      </Menu>

      {/* Notifications Menu remains same... */}
    </AppBar>
  );
};

export default Navbar;  