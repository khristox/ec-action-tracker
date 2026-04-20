import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer, Box, List, ListItemButton, ListItemIcon, ListItemText,
  Collapse, Typography, Avatar, alpha, useTheme, Tooltip,
  IconButton, Divider, Stack, TextField, InputAdornment
} from '@mui/material';
import {
  ExpandLess, ExpandMore, Dashboard as DashboardIcon,
  People as PeopleIcon, Description as DescriptionIcon,
  Settings as SettingsIcon, ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon, MeetingRoom as MeetingIcon,
  Search as SearchIcon, Clear as ClearIcon
} from '@mui/icons-material';

// Font Awesome Imports
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import * as fab from '@fortawesome/free-brands-svg-icons';
import * as fas from '@fortawesome/free-solid-svg-icons';
import * as far from '@fortawesome/free-regular-svg-icons';

import { fetchUserMenus, selectMenus } from '../../store/slices/menuSlice';
import { selectUser } from '../../store/slices/authSlice';

const DRAWER_WIDTHS = { expanded: 280, collapsed: 72 };
const LOGO_PATH = '/logo.png'; // Root-absolute path to prevent failing on sub-routes

// ==================== Icon Helper Functions ====================

const getFontAwesomeIcon = (iconName, library) => {
  let camelCaseName = iconName
    .replace(/^fa-/, '')
    .split('-')
    .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  
  camelCaseName = 'fa' + camelCaseName.charAt(0).toUpperCase() + camelCaseName.slice(1);
  
  const iconMappings = {
    'fa-facebook': 'faFacebook', 'fa-twitter': 'faTwitter',
    'fa-linkedin': 'faLinkedin', 'fa-github': 'faGithub',
    'fa-youtube': 'faYoutube', 'fa-whatsapp': 'faWhatsapp',
    'fa-instagram': 'faInstagram', 'fa-telegram': 'faTelegram',
    'fa-discord': 'faDiscord', 'fa-tiktok': 'faTiktok',
  };
  
  const mappedName = iconMappings[iconName] || camelCaseName;
  
  if (library === 'fab' && fab[mappedName]) return fab[mappedName];
  if (library === 'fas' && fas[mappedName]) return fas[mappedName];
  if (library === 'far' && far[mappedName]) return far[mappedName];
  
  if (fab[mappedName]) return fab[mappedName];
  if (fas[mappedName]) return fas[mappedName];
  if (far[mappedName]) return far[mappedName];
  
  return null;
};

const renderIcon = (menu) => {
  if (menu.icon_type === 'material_symbols') {
    return (
      <span className="material-symbols-outlined" style={{ fontSize: '24px', color: menu.icon_color !== 'inherit' ? menu.icon_color : undefined }}>
        {menu.icon}
      </span>
    );
  }
  
  if (menu.icon_type === 'fontawesome') {
    const icon = getFontAwesomeIcon(menu.icon, menu.icon_library);
    if (icon) {
      return <FontAwesomeIcon icon={icon} style={{ color: menu.icon_color !== 'inherit' ? menu.icon_color : undefined, fontSize: '1.1rem' }} />;
    }
    return <DashboardIcon fontSize="small" />;
  }
  
  if (menu.icon_type === 'mui' && menu.icon) {
    const iconMap = {
      Dashboard: DashboardIcon, Event: MeetingIcon, People: PeopleIcon,
      Assignment: DescriptionIcon, Settings: SettingsIcon, History: DescriptionIcon,
      Group: PeopleIcon, Article: DescriptionIcon, Security: SettingsIcon,
    };
    const MuiIcon = iconMap[menu.icon] || DashboardIcon;
    return <MuiIcon fontSize="small" />;
  }
  
  return <DashboardIcon fontSize="small" />;
};

// ==================== Sidebar Component ====================

const Sidebar = ({ isMobile, mobileOpen, onClose, isCollapsed, setIsCollapsed }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);
  const menus = useSelector(selectMenus);

  const [openSubmenus, setOpenSubmenus] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    dispatch(fetchUserMenus());
  }, [dispatch]);

  // Search Logic: Returns items if they match OR if any of their children match
  const filteredMenus = useMemo(() => {
    if (!searchQuery.trim()) return menus || [];

    const filterItems = (items) => {
      return items
        .map(item => {
          const match = item.title.toLowerCase().includes(searchQuery.toLowerCase());
          const filteredChildren = item.children ? filterItems(item.children) : [];
          
          if (match || filteredChildren.length > 0) {
            return { ...item, children: filteredChildren };
          }
          return null;
        })
        .filter(Boolean);
    };

    return filterItems(menus || []);
  }, [menus, searchQuery]);

  // Auto-expand parents when searching
  useEffect(() => {
    if (searchQuery.trim() && !isCollapsed) {
      const newOpenStates = {};
      const expandAll = (items) => {
        items.forEach(item => {
          if (item.children?.length > 0) {
            newOpenStates[item.id] = true;
            expandAll(item.children);
          }
        });
      };
      expandAll(filteredMenus);
      setOpenSubmenus(newOpenStates);
    }
  }, [searchQuery, filteredMenus, isCollapsed]);

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
            borderRadius: 2, mx: 1, mb: 0.5,
            '&.Mui-selected': {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              '& .MuiListItemIcon-root': { color: theme.palette.primary.main }
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 0, mr: isCollapsed ? 0 : 2, color: 'inherit' }}>
            {renderIcon(item)}
          </ListItemIcon>
          
          {!isCollapsed && (
            <>
              <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 400 }} />
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
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', minHeight: 64 }}>
        {!isCollapsed && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar src={LOGO_PATH} sx={{ width: 32, height: 32 }} />
            <Typography variant="subtitle1" fontWeight={700} noWrap>EC Uganda</Typography>
          </Stack>
        )}
        {!isMobile && (
          <IconButton onClick={() => setIsCollapsed(!isCollapsed)} size="small">
            {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        )}
      </Box>

      {!isCollapsed && (
        <Box sx={{ px: 2, pb: 2 }}>
          <TextField
            fullWidth size="small" placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}><ClearIcon fontSize="inherit" /></IconButton>
                </InputAdornment>
              ),
              sx: { borderRadius: 2, fontSize: '0.8rem', bgcolor: alpha(theme.palette.action.hover, 0.5) }
            }}
          />
        </Box>
      )}

      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', py: 2 }}>
        <List disablePadding>{renderMenuItems(filteredMenus)}</List>
      </Box>
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

  return isMobile ? (
    <Drawer variant="temporary" open={mobileOpen} onClose={onClose} sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTHS.expanded } }}>
      {sidebarContent}
    </Drawer>
  ) : (
    <Box component="aside" sx={{
        width: isCollapsed ? DRAWER_WIDTHS.collapsed : DRAWER_WIDTHS.expanded,
        height: '100%', flexShrink: 0, bgcolor: 'background.paper', borderRight: `1px solid ${theme.palette.divider}`,
        transition: theme.transitions.create('width', { duration: theme.transitions.duration.enteringScreen }),
      }}>
      {sidebarContent}
    </Box>
  );
};

export default React.memo(Sidebar);