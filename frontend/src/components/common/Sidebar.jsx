import React, { useEffect, useState, useMemo } from 'react';
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
  People as PeopleIcon, Description as DescriptionIcon,
  Settings as SettingsIcon, ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon, MeetingRoom as MeetingIcon,
  Search as SearchIcon, Clear as ClearIcon,
  Event as EventIcon, Assignment as AssignmentIcon,
  History as HistoryIcon, Group as GroupIcon,
  Security as SecurityIcon, Article as ArticleIcon,
  MenuBook as MenuBookIcon, CalendarMonth as CalendarMonthIcon,
  Help as HelpIcon, Star as StarIcon, Folder as FolderIcon
} from '@mui/icons-material';

// Font Awesome Imports
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import * as fab from '@fortawesome/free-brands-svg-icons';
import * as fas from '@fortawesome/free-solid-svg-icons';
import * as far from '@fortawesome/free-regular-svg-icons';

import { fetchUserMenus, selectMenus } from '../../store/slices/menuSlice';
import { selectUser } from '../../store/slices/authSlice';

const DRAWER_WIDTHS = { expanded: 280, collapsed: 72 };
const LOGO_PATH = '/logo.png';

// ==================== Icon Mapping ====================

// Material Icons mapping
const materialIconMap = {
  dashboard: DashboardIcon,
  event: EventIcon,
  meeting: MeetingIcon,
  people: PeopleIcon,
  assignment: AssignmentIcon,
  settings: SettingsIcon,
  history: HistoryIcon,
  group: GroupIcon,
  article: ArticleIcon,
  security: SecurityIcon,
  calendar: CalendarMonthIcon,
  Calendar_month: CalendarMonthIcon,  // Add this for underscore version
  calendarMonth: CalendarMonthIcon,   // Add camelCase version
  calendarmonth: CalendarMonthIcon,  
  menu_book: MenuBookIcon,
  help: HelpIcon,
  star: StarIcon,
  folder: FolderIcon,
  description: DescriptionIcon,
  meetings: MeetingIcon,
  tasks: AssignmentIcon,
  users: PeopleIcon,
  roles: SecurityIcon,
  permissions: SecurityIcon,
  documents: DescriptionIcon,
  reports: ArticleIcon,
  analytics: DashboardIcon,
  default: DashboardIcon
};

// Font Awesome icon name mapping
const faIconMapping = {
  'fa-dashboard': 'faTachometerAlt',
  'fa-calendar': 'faCalendar',
  'fa-users': 'faUsers',
  'fa-tasks': 'faTasks',
  'fa-cog': 'faCog',
  'fa-gear': 'faCog',
  'fa-file': 'faFile',
  'fa-folder': 'faFolder',
  'fa-chart': 'faChartLine',
  'fa-chart-line': 'faChartLine',
  'fa-chart-bar': 'faChartBar',
  'fa-bell': 'faBell',
  'fa-envelope': 'faEnvelope',
  'fa-user': 'faUser',
  'fa-user-plus': 'faUserPlus',
  'fa-sign-out': 'faSignOutAlt',
  'fa-sign-in': 'faSignInAlt',
  'fa-lock': 'faLock',
  'fa-unlock': 'faUnlock',
  'fa-key': 'faKey',
  'fa-search': 'faSearch',
  'fa-print': 'faPrint',
  'fa-download': 'faDownload',
  'fa-upload': 'faUpload',
  'fa-edit': 'faEdit',
  'fa-trash': 'faTrash',
  'fa-plus': 'faPlus',
  'fa-minus': 'faMinus',
  'fa-check': 'faCheck',
  'fa-times': 'faTimes',
  'fa-exclamation': 'faExclamation',
  'fa-question': 'faQuestion',
  'fa-info': 'faInfo',
  'fa-warning': 'faExclamationTriangle',
  'fa-calendar-alt': 'faCalendarAlt',
  'fa-clock': 'faClock',
  'fa-hourglass': 'faHourglass',
  'fa-list': 'faList',
  'fa-table': 'faTable',
  'fa-th': 'faTh',
  'fa-th-large': 'faThLarge',
  'fa-th-list': 'faThList',
  'fa-check-circle': 'faCheckCircle',
  'fa-times-circle': 'faTimesCircle',
  'fa-exclamation-circle': 'faExclamationCircle',
  'fa-info-circle': 'faInfoCircle',
  'fa-question-circle': 'faQuestionCircle'
};

// ==================== Icon Helper Functions ====================

const getFontAwesomeIcon = (iconName, library) => {
  // Handle direct icon names
  let camelCaseName = iconName
    .replace(/^fa-/, '')
    .split('-')
    .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  
  camelCaseName = 'fa' + camelCaseName.charAt(0).toUpperCase() + camelCaseName.slice(1);
  
  // Check mapping first
  const mappedName = faIconMapping[iconName] || camelCaseName;
  
  // Try each library
  if (library === 'fab' && fab[mappedName]) return fab[mappedName];
  if (library === 'fas' && fas[mappedName]) return fas[mappedName];
  if (library === 'far' && far[mappedName]) return far[mappedName];
  
  // Try all libraries as fallback
  if (fab[mappedName]) return fab[mappedName];
  if (fas[mappedName]) return fas[mappedName];
  if (far[mappedName]) return far[mappedName];
  
  // Try common variations
  const variations = [
    mappedName,
    camelCaseName,
    `fa${iconName}`,
    iconName,
    iconName.replace(/[_-]/g, '')
  ];
  
  for (const variation of variations) {
    if (fab[variation]) return fab[variation];
    if (fas[variation]) return fas[variation];
    if (far[variation]) return far[variation];
  }
  
  return null;
};

const getMaterialIcon = (iconName) => {
  if (!iconName) return materialIconMap.default;
  
  const normalizedName = iconName.toLowerCase().trim();
  
  // Direct match
  if (materialIconMap[normalizedName]) {
    return materialIconMap[normalizedName];
  }
  
  // Try without underscores
  const withoutUnderscore = normalizedName.replace(/_/g, '');
  if (materialIconMap[withoutUnderscore]) {
    return materialIconMap[withoutUnderscore];
  }
  
  // Try without spaces
  const withoutSpaces = normalizedName.replace(/\s/g, '');
  if (materialIconMap[withoutSpaces]) {
    return materialIconMap[withoutSpaces];
  }
  
  return materialIconMap.default;
};

const renderIcon = (menu) => {
  // Material Symbols
  if (menu.icon_type === 'material_symbols') {
    return (
      <span className="material-symbols-outlined" style={{ 
        fontSize: '22px', 
        color: menu.icon_color !== 'inherit' && menu.icon_color !== '#inherit' ? menu.icon_color : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {menu.icon || 'dashboard'}
      </span>
    );
  }
  
  // Font Awesome
  if (menu.icon_type === 'fontawesome') {
    const icon = getFontAwesomeIcon(menu.icon, menu.icon_library);
    if (icon) {
      return (
        <FontAwesomeIcon 
          icon={icon} 
          style={{ 
            color: menu.icon_color !== 'inherit' && menu.icon_color !== '#inherit' ? menu.icon_color : undefined, 
            fontSize: '1.1rem',
            width: '22px',
            height: '22px'
          }} 
        />
      );
    }
    // Fallback to default if icon not found
    console.warn(`FontAwesome icon not found: ${menu.icon}`);
    return <DashboardIcon fontSize="small" />;
  }
  
  // MUI Icons
  if (menu.icon_type === 'mui' || !menu.icon_type) {
    const MuiIcon = getMaterialIcon(menu.icon);
    return <MuiIcon fontSize="small" sx={{ color: menu.icon_color !== 'inherit' ? menu.icon_color : undefined }} />;
  }
  
  // Default fallback
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
  const menusLoading = useSelector((state) => state.menus?.loading);

  const [openSubmenus, setOpenSubmenus] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!menus || menus.length === 0) {
      dispatch(fetchUserMenus());
    }
  }, [dispatch, menus]);

  // Auto-expand current path
  useEffect(() => {
    const expandPath = (items, path) => {
      for (const item of items) {
        if (item.path === path) {
          setOpenSubmenus(prev => ({ ...prev, [item.id]: true }));
          return true;
        }
        if (item.children && item.children.length > 0) {
          if (expandPath(item.children, path)) {
            setOpenSubmenus(prev => ({ ...prev, [item.id]: true }));
            return true;
          }
        }
      }
      return false;
    };
    
    if (menus && menus.length > 0) {
      expandPath(menus, location.pathname);
    }
  }, [menus, location.pathname]);

  // Search Logic
  const filteredMenus = useMemo(() => {
    if (!searchQuery.trim()) return menus || [];

    const filterItems = (items) => {
      return items
        .map(item => {
          const match = item.title?.toLowerCase().includes(searchQuery.toLowerCase());
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
      setOpenSubmenus(prev => ({ ...prev, ...newOpenStates }));
    }
  }, [searchQuery, filteredMenus, isCollapsed]);

  const renderMenuItems = (items, depth = 0) => {
    if (!items || items.length === 0) {
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
      const hasChildren = item.children && item.children.length > 0;
      const isOpen = openSubmenus[item.id] && !isCollapsed;
      
      // Skip rendering if no title
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
            px: isCollapsed ? 2 : 2,
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
              '& .MuiListItemIcon-root': { 
                color: theme.palette.primary.main,
              },
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.16),
              }
            },
          }}
        >
          <ListItemIcon sx={{ 
            minWidth: 0, 
            mr: isCollapsed ? 0 : 2, 
            color: 'inherit',
            justifyContent: 'center',
            '& svg, & .material-symbols-outlined': {
              fontSize: '22px'
            }
          }}>
            {renderIcon(item)}
          </ListItemIcon>
          
          {!isCollapsed && (
            <>
              <ListItemText 
                primary={item.title}
                primaryTypographyProps={{ 
                  fontSize: '0.875rem', 
                  fontWeight: isSelected ? 600 : 450,
                  noWrap: true
                }} 
              />
              {hasChildren && (
                isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />
              )}
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

  // Loading state
  if (menusLoading) {
    return (
      <Box sx={{ 
        width: isCollapsed ? DRAWER_WIDTHS.collapsed : DRAWER_WIDTHS.expanded,
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  const sidebarContent = (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      overflow: 'hidden',
      bgcolor: 'background.paper'
    }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed ? 'center' : 'space-between', 
        minHeight: 64,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`
      }}>
        {!isCollapsed && (
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Avatar 
              src={LOGO_PATH} 
              sx={{ width: 32, height: 32 }}
              alt="Logo"
            >
              {!LOGO_PATH && <DashboardIcon />}
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

      {/* Search Bar - Only show when expanded */}
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
                '&:hover': {
                  bgcolor: alpha(theme.palette.action.hover, 0.5),
                }
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
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        bgcolor: alpha(theme.palette.action.hover, 0.2)
      }}>
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

export default React.memo(Sidebar);