// Sidebar.jsx - Material UI Icon Mapping Version

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer, Box, List, ListItemButton, ListItemIcon, ListItemText,
  Collapse, Typography, Avatar, alpha, useTheme, Tooltip,
  IconButton, Divider, Stack, TextField, InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  ExpandLess, ExpandMore, Dashboard as DashboardIcon,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  Search as SearchIcon, Clear as ClearIcon,
  People as PeopleIcon, Event as EventIcon, Assignment as AssignmentIcon,
  Settings as SettingsIcon, MeetingRoom as MeetingRoomIcon,
  Description as DescriptionIcon, History as HistoryIcon,
  Group as GroupIcon, Security as SecurityIcon, Article as ArticleIcon,
  MenuBook as MenuBookIcon, CalendarMonth as CalendarMonthIcon,
  Help as HelpIcon, Star as StarIcon, Folder as FolderIcon,
  Home as HomeIcon, Business as BusinessIcon, LocationOn as LocationIcon,
  Person as PersonIcon, Email as EmailIcon, Phone as PhoneIcon,
  Save as SaveIcon, Edit as EditIcon, Delete as DeleteIcon,
  Add as AddIcon, Search as SearchIconAlt, FilterList as FilterIcon,
  Refresh as RefreshIcon, CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon, Warning as WarningIcon, Info as InfoIcon
} from '@mui/icons-material';

import { fetchUserMenus, selectMenus, resetMenuState } from '../../store/slices/menuSlice';
import { selectUser, selectIsAuthenticated } from '../../store/slices/authSlice';

const DRAWER_WIDTHS = { expanded: 280, collapsed: 72 };
const LOGO_PATH = '/logo.png';

// ==================== Material UI Icon Mapping ====================

const materialIconMap = {
  // Dashboard & Overview
  'dashboard': DashboardIcon,
  'dashboard_icon': DashboardIcon,
  'overview': DashboardIcon,
  'home': HomeIcon,
  'home_icon': HomeIcon,
  
  // Meetings
  'meeting': MeetingRoomIcon,
  'meetings': MeetingRoomIcon,
  'meeting_room': MeetingRoomIcon,
  'calendar': CalendarMonthIcon,
  'calendar_month': CalendarMonthIcon,
  'event': EventIcon,
  'schedule': EventIcon,
  
  // People & Users
  'people': PeopleIcon,
  'users': PeopleIcon,
  'user': PersonIcon,
  'profile': PersonIcon,
  'group': GroupIcon,
  'groups': GroupIcon,
  'participant': PeopleIcon,
  'participants': PeopleIcon,
  
  // Tasks & Assignments
  'assignment': AssignmentIcon,
  'tasks': AssignmentIcon,
  'task': AssignmentIcon,
  'action': AssignmentIcon,
  'actions': AssignmentIcon,
  'todo': AssignmentIcon,
  
  // Documents & Reports
  'description': DescriptionIcon,
  'documents': DescriptionIcon,
  'document': DescriptionIcon,
  'reports': ArticleIcon,
  'report': ArticleIcon,
  'article': ArticleIcon,
  'folder': FolderIcon,
  'folders': FolderIcon,
  'file': DescriptionIcon,
  
  // Settings & Admin
  'settings': SettingsIcon,
  'admin': SettingsIcon,
  'configuration': SettingsIcon,
  'security': SecurityIcon,
  'permissions': SecurityIcon,
  'roles': SecurityIcon,
  'audit': HistoryIcon,
  'logs': HistoryIcon,
  
  // History & Tracking
  'history': HistoryIcon,
  'tracking': HistoryIcon,
  'audit_log': HistoryIcon,
  
  // Help & Support
  'help': HelpIcon,
  'support': HelpIcon,
  'faq': HelpIcon,
  
  // Favorites & Starred
  'star': StarIcon,
  'favorite': StarIcon,
  'bookmark': StarIcon,
  
  // Location
  'location': LocationIcon,
  'address': LocationIcon,
  'place': LocationIcon,
  'building': BusinessIcon,
  'office': BusinessIcon,
  
  // CRUD Operations
  'add': AddIcon,
  'create': AddIcon,
  'new': AddIcon,
  'edit': EditIcon,
  'update': EditIcon,
  'delete': DeleteIcon,
  'remove': DeleteIcon,
  'save': SaveIcon,
  'cancel': CancelIcon,
  
  // Actions
  'search': SearchIconAlt,
  'filter': FilterIcon,
  'refresh': RefreshIcon,
  
  // Status
  'success': CheckCircleIcon,
  'completed': CheckCircleIcon,
  'done': CheckCircleIcon,
  'warning': WarningIcon,
  'error': CancelIcon,
  'info': InfoIcon,
  
  // Default
  'default': DashboardIcon
};

const getMaterialIcon = (iconName) => {
  if (!iconName || typeof iconName !== 'string') {
    return DashboardIcon;
  }
  
  const normalizedName = iconName.toLowerCase().trim();
  
  // Direct match
  if (materialIconMap[normalizedName]) {
    return materialIconMap[normalizedName];
  }
  
  // Remove underscores and try again
  const withoutUnderscore = normalizedName.replace(/_/g, '');
  if (materialIconMap[withoutUnderscore]) {
    return materialIconMap[withoutUnderscore];
  }
  
  // Remove spaces and try again
  const withoutSpaces = normalizedName.replace(/\s/g, '');
  if (materialIconMap[withoutSpaces]) {
    return materialIconMap[withoutSpaces];
  }
  
  // Check if it contains any keyword
  for (const [key, value] of Object.entries(materialIconMap)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return value;
    }
  }
  
  // Default fallback
  return DashboardIcon;
};

const renderIcon = (menu) => {
  if (!menu) {
    return <DashboardIcon fontSize="small" />;
  }
  
  // Handle material_symbols type
  if (menu.icon_type === 'material_symbols') {
    return (
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: '22px',
          color: menu.icon_color !== 'inherit' && menu.icon_color !== '#inherit' ? menu.icon_color : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {menu.icon || 'dashboard'}
      </span>
    );
  }
  
  // Handle mui type or default
  const MuiIcon = getMaterialIcon(menu.icon);
  return (
    <MuiIcon 
      fontSize="small" 
      sx={{ 
        color: menu.icon_color !== 'inherit' && menu.icon_color !== '#inherit' ? menu.icon_color : undefined 
      }} 
    />
  );
};

// ==================== Sidebar Component ====================

const Sidebar = ({ isMobile, mobileOpen, onClose, isCollapsed, setIsCollapsed }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);
  const isLoggedIn = useSelector(selectIsAuthenticated);
  const menus = useSelector(selectMenus);
  const menusLoading = useSelector((state) => state.menus?.loading);

  const previousUserId = useRef(null);
  const [openSubmenus, setOpenSubmenus] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Effect 1: Handle logout
  useEffect(() => {
    if (!isLoggedIn) {
      dispatch(resetMenuState());
      setOpenSubmenus({});
      setSearchQuery('');
      previousUserId.current = null;
    }
  }, [isLoggedIn, dispatch]);

  // Effect 2: Fetch menus on login
  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;

    const isFirstLoad = !previousUserId.current;
    const userChanged = previousUserId.current !== null && previousUserId.current !== user.id;
    const menusEmpty = !menus || menus.length === 0;

    if (isFirstLoad || userChanged || menusEmpty) {
      dispatch(resetMenuState());
      dispatch(fetchUserMenus());
      setOpenSubmenus({});
      setSearchQuery('');
    }

    previousUserId.current = user.id;
  }, [isLoggedIn, user?.id, menus, dispatch]);

  // Auto-expand current path
  useEffect(() => {
    const expandPath = (items, path) => {
      for (const item of items) {
        if (item.path === path) {
          setOpenSubmenus(prev => ({ ...prev, [item.id]: true }));
          return true;
        }
        if (item.children?.length > 0) {
          if (expandPath(item.children, path)) {
            setOpenSubmenus(prev => ({ ...prev, [item.id]: true }));
            return true;
          }
        }
      }
      return false;
    };

    if (menus?.length > 0) {
      expandPath(menus, location.pathname);
    }
  }, [menus, location.pathname]);

  // Search logic
  const filteredMenus = useMemo(() => {
    if (!searchQuery.trim()) return menus || [];

    const filterItems = (items) =>
      items
        .map(item => {
          const match = item.title?.toLowerCase().includes(searchQuery.toLowerCase());
          const filteredChildren = item.children ? filterItems(item.children) : [];
          if (match || filteredChildren.length > 0) {
            return { ...item, children: filteredChildren };
          }
          return null;
        })
        .filter(Boolean);

    return filterItems(menus || []);
  }, [menus, searchQuery]);

  // Auto-expand all parents when searching
  useEffect(() => {
    if (searchQuery.trim() && !isCollapsed && filteredMenus.length > 0) {
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
      setOpenSubmenus(prev => ({ ...prev, ...newOpenStates }));
    }
  }, [searchQuery, filteredMenus, isCollapsed]);

  const renderMenuItems = (items, depth = 0) => {
    if (!items?.length) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No menus available
          </Typography>
        </Box>
      );
    }

    return items.map((item) => {
      const isSelected = location.pathname === item.path;
      const hasChildren = item.children?.length > 0;
      const isOpen = openSubmenus[item.id] && !isCollapsed;

      if (!item.title) return null;

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
            px: 2,
            pl: isCollapsed ? 2 : 2 + Math.min(depth * 2, 4),
            borderRadius: 1.5,
            mx: 1,
            mb: 0.5,
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              transform: 'translateX(2px)'
            },
            '&.Mui-selected': {
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.main,
              '& .MuiListItemIcon-root': { color: theme.palette.primary.main },
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) }
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: isCollapsed ? 0 : 2,
              color: 'inherit',
              justifyContent: 'center',
              '& svg': { fontSize: '22px' }
            }}
          >
            {renderIcon(item)}
          </ListItemIcon>

          {!isCollapsed && (
            <>
              <ListItemText
                primary={item.title}
                slotProps={{
                  primary: {
                    fontSize: '0.875rem',
                    fontWeight: isSelected ? 600 : 450,
                    noWrap: true
                  }
                }}
              />
              {hasChildren && (isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />)}
            </>
          )}
        </ListItemButton>
      );

      return (
        <React.Fragment key={item.id || item.title}>
          {isCollapsed ? (
            <Tooltip title={item.title} placement="right" arrow>
              {menuItem}
            </Tooltip>
          ) : (
            menuItem
          )}
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

  // Don't render sidebar if not authenticated
  if (!isLoggedIn) return null;

  // Loading state
  if (menusLoading && (!menus || menus.length === 0)) {
    return (
      <Box
        sx={{
          width: isCollapsed ? DRAWER_WIDTHS.collapsed : DRAWER_WIDTHS.expanded,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  const sidebarContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'background.paper'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          minHeight: 64,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`
        }}
      >
        {!isCollapsed && (
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <Avatar src={LOGO_PATH} sx={{ width: 32, height: 32 }} alt="Logo">
              <DashboardIcon />
            </Avatar>
            <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ letterSpacing: '-0.3px' }}>
              EC Uganda
            </Typography>
          </Stack>
        )}
        {!isMobile && (
          <IconButton
            onClick={() => setIsCollapsed(!isCollapsed)}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.action.hover, 0.5),
              '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.8) }
            }}
          >
            {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        )}
      </Box>

      {/* Search Bar */}
      {!isCollapsed && (
        <Box sx={{ px: 2, py: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')} edge="end">
                      <ClearIcon fontSize="inherit" />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 2,
                  fontSize: '0.8rem',
                  bgcolor: alpha(theme.palette.action.hover, 0.3),
                  '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) }
                }
              }
            }}
          />
        </Box>
      )}

      {/* Menu List */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        <List disablePadding>
          {renderMenuItems(filteredMenus)}
        </List>
      </Box>

      <Divider />

      {/* User Info Footer */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          bgcolor: alpha(theme.palette.action.hover, 0.2)
        }}
      >
        <Avatar
          sx={{
            bgcolor: theme.palette.primary.main,
            width: 36,
            height: 36,
            fontSize: '0.9rem',
            fontWeight: 600
          }}
        >
          {user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
        </Avatar>
        {!isCollapsed && (
          <Box sx={{ ml: 1.5, overflow: 'hidden' }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {user?.full_name || user?.username || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.email || 'user@example.com'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  // Mobile drawer
  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTHS.expanded,
            boxShadow: theme.shadows[5]
          }
        }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  // Desktop sidebar
  return (
    <Box
      component="aside"
      sx={{
        width: isCollapsed ? DRAWER_WIDTHS.collapsed : DRAWER_WIDTHS.expanded,
        height: '100%',
        flexShrink: 0,
        bgcolor: 'background.paper',
        borderRight: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        transition: theme.transitions.create(['width'], {
          duration: theme.transitions.duration.enteringScreen,
          easing: theme.transitions.easing.sharp,
        }),
        overflowX: 'hidden',
      }}
    >
      {sidebarContent}
    </Box>
  );
};

export default Sidebar;