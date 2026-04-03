import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Drawer,
  Box,
  List,
  ListItemButton, // Updated from ListItem for better accessibility/styling
  ListItemIcon,
  ListItemText,
  Collapse,
  Typography,
  Divider,
  CircularProgress,
  Avatar,
  alpha,
  useTheme
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Payments as PaymentsIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Apartment as ApartmentIcon,
  Home as HomeIcon,
  Build as BuildIcon,
  Folder as FolderIcon,
  Assessment as AssessmentIcon,
  Analytics as AnalyticsIcon,
  Event as CalendarIcon,
  Tune as TuneIcon,
  Badge as BadgeIcon,
  History as HistoryIcon,
  Backup as BackupIcon,
  Key as KeyIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchUserMenus, selectMenus, selectMenuLoading } from '../../store/slices/menuSlice';
import { selectUser } from '../../store/slices/authSlice';

const ecLogo = "/logo.png";

const iconMap = {
  'Dashboard': <DashboardIcon />,
  'Business': <BusinessIcon />,
  'People': <PeopleIcon />,
  'Description': <DescriptionIcon />,
  'Payments': <PaymentsIcon />,
  'Settings': <SettingsIcon />,
  'Person': <PersonIcon />,
  'Security': <SecurityIcon />,
  'Notifications': <NotificationsIcon />,
  'Apartment': <ApartmentIcon />,
  'Home': <HomeIcon />,
  'Build': <BuildIcon />,
  'Folder': <FolderIcon />,
  'Assessment': <AssessmentIcon />,
  'Analytics': <AnalyticsIcon />,
  'Calendar': <CalendarIcon />,
  'Tune': <TuneIcon />,
  'Badge': <BadgeIcon />,
  'History': <HistoryIcon />,
  'Backup': <BackupIcon />,
  'Key': <KeyIcon />,
};

const Sidebar = ({ open, drawerWidth, isMobile, onClose }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);
  const menus = useSelector(selectMenus);
  const loading = useSelector(selectMenuLoading);
  
  const [openSubmenus, setOpenSubmenus] = useState({});

  useEffect(() => {
    dispatch(fetchUserMenus());
  }, [dispatch, user]);

  const handleToggleSubmenu = (menuId) => {
    setOpenSubmenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const renderMenuItems = (items, depth = 0) => {
    return items.map((item) => {
      const isSelected = location.pathname === item.path;
      const hasChildren = item.children && item.children.length > 0;

      return (
        <React.Fragment key={item.id}>
          <ListItemButton
            onClick={() => {
              if (hasChildren) handleToggleSubmenu(item.id);
              else if (item.path) {
                navigate(item.path);
                if (isMobile) onClose();
              }
            }}
            selected={isSelected}
            sx={{
              pl: depth * 2 + 2,
              py: 1.2,
              mx: 1.5,
              mb: 0.5,
              borderRadius: '12px',
              transition: 'all 0.2s ease',
              position: 'relative',
              '&.Mui-selected': {
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) },
                // Vertical indicator bar
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: -8,
                  height: '70%',
                  width: 4,
                  bgcolor: 'primary.main',
                  borderRadius: '0 4px 4px 0'
                }
              },
              '&:hover': {
                bgcolor: alpha(theme.palette.action.hover, 0.05),
                transform: 'translateX(4px)'
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {iconMap[item.icon] || <DashboardIcon />}
            </ListItemIcon>
            <ListItemText 
              primary={item.title} 
              primaryTypographyProps={{ 
                fontSize: '0.875rem', 
                fontWeight: isSelected ? 700 : 500 
              }} 
            />
            {hasChildren && (openSubmenus[item.id] ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
          
          {hasChildren && (
            <Collapse in={openSubmenus[item.id]} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {renderMenuItems(item.children, depth + 1)}
              </List>
            </Collapse>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? open : true}
      onClose={onClose}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          flexDirection: 'column'
        },
      }}
    >
      {/* 1. Header with Logo */}
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box 
          component="img" 
          src={ecLogo} 
          sx={{ width: 45, height: 'auto', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} 
        />
        <Box>
          <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.2 }}>
            EC Uganda
          </Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Action Tracker
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mx: 2, mb: 2, opacity: 0.6 }} />

      {/* 2. Menu Navigation */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 0.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress size={24} /></Box>
        ) : (
          <List>{renderMenuItems(menus || [])}</List>
        )}
      </Box>

      {/* 3. User Profile Footer */}
      <Box sx={{ p: 2, mt: 'auto', borderTop: `1px solid ${theme.palette.divider}`, bgcolor: 'background.default' }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          p: 1.5, 
          borderRadius: '12px', 
          bgcolor: alpha(theme.palette.primary.main, 0.03) 
        }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '1rem', fontWeight: 600 }}>
            {(user?.username || 'U')[0].toUpperCase()}
          </Avatar>
          <Box sx={{ ml: 1.5, overflow: 'hidden' }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {user?.username || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {user?.email || 'Administrator'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;