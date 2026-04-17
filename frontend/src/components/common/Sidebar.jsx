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

// Import Font Awesome correctly
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import * as fab from '@fortawesome/free-brands-svg-icons';
import * as fas from '@fortawesome/free-solid-svg-icons';
import * as far from '@fortawesome/free-regular-svg-icons';

import { fetchUserMenus, selectMenus } from '../../store/slices/menuSlice';
import { selectUser } from '../../store/slices/authSlice';

const DRAWER_WIDTHS = {
  expanded: 280,
  collapsed: 72
};

// Helper function to get Font Awesome icon by name
const getFontAwesomeIcon = (iconName, library) => {
  // Convert fa-facebook to faFacebook (camelCase)
  let camelCaseName = iconName
    .replace(/^fa-/, '')
    .split('-')
    .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  
  camelCaseName = 'fa' + camelCaseName.charAt(0).toUpperCase() + camelCaseName.slice(1);
  
  // Special mappings for common icons
  const iconMappings = {
    'fa-facebook': 'faFacebook',
    'fa-twitter': 'faTwitter',
    'fa-linkedin': 'faLinkedin',
    'fa-github': 'faGithub',
    'fa-youtube': 'faYoutube',
    'fa-whatsapp': 'faWhatsapp',
    'fa-instagram': 'faInstagram',
    'fa-telegram': 'faTelegram',
    'fa-discord': 'faDiscord',
    'fa-tiktok': 'faTiktok',
  };
  
  const mappedName = iconMappings[iconName] || camelCaseName;
  
  // Get icon from appropriate library
  if (library === 'fab' && fab[mappedName]) {
    return fab[mappedName];
  }
  if (library === 'fas' && fas[mappedName]) {
    return fas[mappedName];
  }
  if (library === 'far' && far[mappedName]) {
    return far[mappedName];
  }
  
  // Try all libraries as fallback
  if (fab[mappedName]) return fab[mappedName];
  if (fas[mappedName]) return fas[mappedName];
  if (far[mappedName]) return far[mappedName];
  
  console.warn(`Icon not found: ${iconName} (mapped to ${mappedName})`);
  return null;
};

// Dynamic icon renderer function
const renderIcon = (menu) => {
  // Handle Material Symbols
  if (menu.icon_type === 'material_symbols') {
    return (
      <span 
        className="material-symbols-outlined"
        style={{ 
          fontSize: '24px',
          color: menu.icon_color !== 'inherit' ? menu.icon_color : undefined
        }}
      >
        {menu.icon}
      </span>
    );
  }
  
  // Handle Font Awesome icons
  if (menu.icon_type === 'fontawesome') {
    const icon = getFontAwesomeIcon(menu.icon, menu.icon_library);
    
    if (icon) {
      return (
        <FontAwesomeIcon 
          icon={icon}
          style={{ 
            color: menu.icon_color !== 'inherit' ? menu.icon_color : undefined,
            fontSize: '1.25rem'
          }}
        />
      );
    }
    
    // Fallback if icon not found
    console.log('FAB icon not found for:', menu.icon);
    return <DashboardIcon fontSize="small" />;
  }
  
  // Handle MUI icons
  if (menu.icon_type === 'mui' && menu.icon) {
    const iconMap = {
      Dashboard: DashboardIcon,
      Event: MeetingIcon,
      People: PeopleIcon,
      Assignment: DescriptionIcon,
      Settings: SettingsIcon,
      Folder: DescriptionIcon,
      Assessment: DescriptionIcon,
      Calendar: MeetingIcon,
      CalendarToday: MeetingIcon,
      LocationOn: DashboardIcon,
      AccountTree: DashboardIcon,
      List: DashboardIcon,
      Task: DashboardIcon,
      Warning: DashboardIcon,
      TrendingUp: DashboardIcon,
      Person: PeopleIcon,
      PersonAdd: PeopleIcon,
      Group: PeopleIcon,
      Upload: DashboardIcon,
      Download: DashboardIcon,
      Article: DescriptionIcon,
      History: DescriptionIcon,
      Security: SettingsIcon,
      Tune: SettingsIcon,
      Badge: DashboardIcon,
      Add: DashboardIcon,
      Description: DescriptionIcon,
      Map: DashboardIcon,
      LocationCity: DashboardIcon,
      Place: DashboardIcon,
      Home: DashboardIcon,
      Business: DashboardIcon,
    };
    
    const MuiIcon = iconMap[menu.icon] || DashboardIcon;
    return <MuiIcon fontSize="small" />;
  }
  
  // Default fallback
  return <DashboardIcon fontSize="small" />;
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

  // Debug: Log menus to see icon data
  useEffect(() => {
    if (menus && menus.length > 0) {
      console.log('Menus loaded:', menus);
      const findFacebook = (items) => {
        for (const item of items) {
          if (item.code === 'facebook') {
            console.log('Facebook menu data:', {
              title: item.title,
              icon: item.icon,
              icon_type: item.icon_type,
              icon_library: item.icon_library,
              icon_color: item.icon_color
            });
            return item;
          }
          if (item.children) {
            const found = findFacebook(item.children);
            if (found) return found;
          }
        }
        return null;
      };
      findFacebook(menus);
    }
  }, [menus]);

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

  // Recursive tree renderer
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
          <ListItemIcon sx={{ 
            minWidth: 0, 
            mr: isCollapsed ? 0 : 2,
            color: item.icon_color !== 'inherit' ? item.icon_color : 'inherit'
          }}>
            {renderIcon(item)}
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
      
      {/* Header: Logo + Toggle Button */}
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

      {/* Tree Menu */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 2 }}>
        <List disablePadding>
          {renderMenuItems(menus || [])}
        </List>
      </Box>

      {/* Footer: User Profile */}
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