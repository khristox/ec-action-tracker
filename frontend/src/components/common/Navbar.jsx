import React, { useState } from 'react';
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
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications,
  Person,
  Logout,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { logout, selectIsLoading } from '../../store/slices/authSlice';

const Navbar = ({ handleDrawerToggle, isMobile }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [anchorElUser, setAnchorElUser] = useState(null);
  const { user } = useSelector((state) => state.auth);
  const isLoading = useSelector(selectIsLoading);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const showBackButton = pathSegments.length > 1 && location.pathname !== '/dashboard';

  const handleLogout = async () => {
    setAnchorElUser(null);
    try {
      await dispatch(logout()).unwrap();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

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
          px: { xs: 1, sm: 2 }   // Reduced padding on mobile
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
              fontSize: { xs: '0.9rem', sm: '1.05rem' }, // Smaller on mobile
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isMobile ? 'Tracker' : 'Action Tracker'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 0.5 } }}>
          <IconButton color="inherit" size="small">
            <Badge badgeContent={3} color="error">
              <Notifications fontSize="small" />
            </Badge>
          </IconButton>

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

      {/* User Menu - same as before */}
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