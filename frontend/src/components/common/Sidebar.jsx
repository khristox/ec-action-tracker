import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Typography,
  Avatar,
  alpha,
  useTheme,
  Tooltip,
  IconButton,
  Divider,
  Stack,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  MeetingRoom as MeetingIcon,
} from '@mui/icons-material';

import { fetchUserMenus, selectMenus } from '../../store/slices/menuSlice';
import { selectUser } from '../../store/slices/authSlice';

const DRAWER_WIDTHS = {
  expanded: 280,
  collapsed: 72
};

const iconMap = {
  Dashboard: <DashboardIcon />,
  Meetings: <MeetingIcon />,
  People: <PeopleIcon />,
  Description: <DescriptionIcon />,
  Settings: <SettingsIcon />,
};

const Sidebar = ({ isMobile, mobileOpen, onClose, isCollapsed, setIsCollapsed }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);
  const menus = useSelector(selectMenus);

  const [openSubmenus, setOpenSubmenus] = useState({});

  useEffect(() => {
    dispatch(fetchUserMenus());
  }, [dispatch]);

  // Sync open submenus with current URL path for recursive structure
  useEffect(() => {
    if (menus && !isCollapsed) {
      const newOpenStates = {};
      const findActive = (items) => {
        items.forEach(item => {
          if (item.children?.some(child => location.pathname.startsWith(child.path))) {
            newOpenStates[item.id] = true;
          }
          if (item.children) findActive(item.children);
        });
      };
      findActive(menus);
      setOpenSubmenus(prev => ({ ...prev, ...newOpenStates }));
    }
  }, [location.pathname, menus, isCollapsed]);

  // ✅ RECURSIVE TREE RENDERER
  const renderMenuItems = (items, depth = 0) => {
    return items.map((item) => {
      const isSelected = location.pathname === item.path;
      const hasChildren = item.children && item.children.length > 0;
      const isOpen = openSubmenus[item.id] && !isCollapsed;

      const menuItem = (
        <ListItemButton
          onClick={() => {
            if (hasChildren && !isCollapsed) {
              setOpenSubmenus(prev => ({ ...prev, [item.id]: !prev[item.id] }));
            } else if (item.path) {
              navigate(item.path);
              if (isMobile) onClose();
            }
          }}
          selected={isSelected}
          sx={{
            minHeight: 44,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            px: isCollapsed ? 2.5 : 2,
            pl: isCollapsed ? 2.5 : 2 + depth * 2, 
            borderRadius: 2,
            mx: 1,
            mb: 0.5,
            '&.Mui-selected': {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              '& .MuiListItemIcon-root': { color: theme.palette.primary.main }
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 0, mr: isCollapsed ? 0 : 2 }}>
            {iconMap[item.title] || <DashboardIcon fontSize="small" />}
          </ListItemIcon>
          
          {!isCollapsed && (
            <>
              <ListItemText 
                primary={item.title} 
                primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 400 }} 
              />
              {hasChildren && (isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />)}
            </>
          )}
        </ListItemButton>
      );

      return (
        <React.Fragment key={item.id}>
          {isCollapsed ? <Tooltip title={item.title} placement="right">{menuItem}</Tooltip> : menuItem}
          
          {hasChildren && !isCollapsed && (
            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {renderMenuItems(item.children, depth + 1)}
              </List>
            </Collapse>
          )}
        </React.Fragment>
      );
    });
  };

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* 🟢 HEADER: Logo + Toggle Button */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed ? 'center' : 'space-between',
        minHeight: 64 
      }}>
        {!isCollapsed && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar src="./logo.png" sx={{ width: 32, height: 32 }} />
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              EC Uganda
            </Typography>
          </Stack>
        )}
        
        {!isMobile && (
          <IconButton onClick={() => setIsCollapsed(!isCollapsed)} size="small">
            {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* TREE MENU */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 2 }}>
        <List disablePadding>
          {renderMenuItems(menus || [])}
        </List>
      </Box>

      {/* FOOTER: User Profile */}
      <Divider />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
        <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 32, height: 32, fontSize: '0.9rem' }}>
          {user?.username?.[0].toUpperCase()}
        </Avatar>
        {!isCollapsed && (
          <Box sx={{ ml: 1.5, overflow: 'hidden' }}>
            <Typography variant="body2" fontWeight={600} noWrap>{user?.username}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{user?.email}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  const currentWidth = isCollapsed ? DRAWER_WIDTHS.collapsed : DRAWER_WIDTHS.expanded;

  return (
    <>
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onClose}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTHS.expanded } }}
        >
          {sidebarContent}
        </Drawer>
      ) : (
        /* DESKTOP ASIDE: Sits perfectly below Navbar in the Layout flexbox */
        <Box
          component="aside"
          sx={{
            width: currentWidth,
            height: '100%',
            flexShrink: 0,
            bgcolor: 'background.paper',
            borderRight: `1px solid ${theme.palette.divider}`,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }}
        >
          {sidebarContent}
        </Box>
      )}
    </>
  );
};

export default React.memo(Sidebar);