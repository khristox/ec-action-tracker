// src/components/layout/MobileBottomNav.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  BottomNavigation, BottomNavigationAction, Paper, Badge, Avatar,
  Menu, MenuItem, ListItemIcon, ListItemText, Divider, Fade,
  Box, Typography, Chip, CircularProgress, alpha, useTheme,
  Skeleton, Alert, Snackbar, Button
} from '@mui/material';
import {
  Dashboard as DashboardIcon, Event as EventIcon,
  Assignment as AssignmentIcon, People as PeopleIcon,
  Settings as SettingsIcon, Person as PersonIcon,
  Logout as LogoutIcon, Help as HelpIcon,
  Feedback as FeedbackIcon, Refresh as RefreshIcon,
  Warning as WarningIcon, Sync as SyncIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { logout } from '../../store/slices/authSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 60000;
const MAX_BADGE_VALUE = 99;
const MAX_MENU_ITEMS = 5;
const LOCAL_STORAGE_KEY = 'mobile_nav_menus';
const CACHE_DURATION = 5 * 60 * 1000;

// MUI icon map
const MUI_ICONS = {
  Dashboard: DashboardIcon,
  Home: DashboardIcon,
  Event: EventIcon,
  Calendar: EventIcon,
  CalendarMonth: EventIcon,
  Meeting: EventIcon,
  Assignment: AssignmentIcon,
  List: AssignmentIcon,
  Description: AssignmentIcon,
  Assessment: AssignmentIcon,
  Folder: AssignmentIcon,
  Task: AssignmentIcon,
  Action: AssignmentIcon,
  Article: AssignmentIcon,
  TrendingUp: AssignmentIcon,
  Warning: WarningIcon,
  People: PeopleIcon,
  Group: PeopleIcon,
  PersonAdd: PeopleIcon,
  Participant: PeopleIcon,
  Settings: SettingsIcon,
  Tune: SettingsIcon,
  Badge: SettingsIcon,
  History: SettingsIcon,
  Security: SettingsIcon,
  Notifications: SettingsIcon,
  Person: PersonIcon,
  Profile: PersonIcon,
  Sync: SyncIcon,
};

// Default menus
const DEFAULT_MENUS = [
  { id: 'dashboard', code: 'dashboard', title: 'Home', icon: 'Dashboard', icon_type: 'mui', path: '/dashboard', sort_order: 1 },
  { id: 'meetings', code: 'meetings', title: 'Meetings', icon: 'Event', icon_type: 'mui', path: '/meetings', sort_order: 2 },
  { id: 'actions', code: 'actions', title: 'Actions', icon: 'Assignment', icon_type: 'mui', path: '/actions', sort_order: 3 },
  { id: 'participants', code: 'participants', title: 'People', icon: 'People', icon_type: 'mui', path: '/participants', sort_order: 4 },
  { id: 'profile', code: 'profile', title: 'Profile', icon: 'Person', icon_type: 'mui', path: '/profile', sort_order: 5 },
];

// ─── Icon Resolver with null safety ────────────────────────────────────────────

const resolveIcon = (icon, iconType = 'mui', iconLibrary = 'fas') => {
  if (!icon) return <DashboardIcon />;
  
  try {
    if (iconType === 'mui') {
      const iconStr = typeof icon === 'string' ? icon : String(icon);
      const key = iconStr.charAt(0).toUpperCase() + iconStr.slice(1);
      const Icon = MUI_ICONS[iconStr] || MUI_ICONS[key];
      return Icon ? <Icon /> : <DashboardIcon />;
    }

    if (iconType === 'fontawesome') {
      return <DashboardIcon />;
    }

    if (iconType === 'custom' && typeof icon === 'string') {
      return <img src={icon} alt="icon" style={{ width: 24, height: 24 }} onError={(e) => { e.target.style.display = 'none'; }} />;
    }
  } catch (err) {
    console.warn('[MobileBottomNav] Icon render error:', err);
  }

  return <DashboardIcon />;
};

// ─── Caching Helpers ──────────────────────────────────────────────────────────

const getCachedMenus = () => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION && Array.isArray(data)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
};

const setCachedMenus = (menus) => {
  try {
    if (!Array.isArray(menus)) return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      data: menus,
      timestamp: Date.now()
    }));
  } catch (_) {}
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBadge = (n) => {
  if (!n || n <= 0) return null;
  const num = typeof n === 'number' ? n : parseInt(n, 10);
  if (isNaN(num)) return null;
  return num > MAX_BADGE_VALUE ? `${MAX_BADGE_VALUE}+` : num;
};

const getPathFromMenu = (menu) => {
  if (!menu) return '/';
  return menu.path || (menu.code ? `/${menu.code}` : '/');
};

// ─── Component ────────────────────────────────────────────────────────────────

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { user } = useSelector(s => s.auth || {});
  const isDark = theme.palette.mode === 'dark';

  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [navValue, setNavValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [badgeCounts, setBadgeCounts] = useState({ meetings: 0, actions: 0, overdue: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const intervalRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

// ── Fetch menus from database ─────────────────────────────────────────────
  const fetchMenus = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedMenus();
      if (cached && cached.length > 0) {
        if (isMountedRef.current) {
          setMenus(cached);
          setLoading(false);
        }
        return cached;
      }
    }

    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const response = await api.get('/menus/mobile', {
        signal: abortControllerRef.current.signal
      });
      
      let data = [];
      if (response.data && typeof response.data === 'object') {
        data = response.data.data || response.data.items || response.data || [];
      }
      
      if (!Array.isArray(data)) data = [];
      
      const filtered = data
        .filter(menu => menu && menu.can_show_mb_bottom === true && menu.is_active === true)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .slice(0, MAX_MENU_ITEMS);
      
      const finalMenus = filtered.length ? filtered : DEFAULT_MENUS;
      
      if (isMountedRef.current) {
        setMenus(finalMenus);
        setCachedMenus(finalMenus);
      }
      return finalMenus;
    } catch (err) {
      // ✅ FIX: Safely check both Native Abort and Axios CanceledError
      if (err.name === 'AbortError' || err.__CANCEL__ || err.constructor?.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return null; 
      }
      
      console.error('Failed to fetch mobile menus:', err);
      
      if (isMountedRef.current) {
        setError('Could not load navigation menus');
        const cached = getCachedMenus();
        if (cached && cached.length > 0) {
          setMenus(cached);
        } else {
          setMenus(DEFAULT_MENUS);
        }
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // ── Fetch badge counts ───────────────────────────────────────────────────
  const fetchBadgeCounts = useCallback(async () => {
    if (!user?.id || !menus.length) return;
    
    if (isMountedRef.current) setRefreshing(true);
    const counts = { meetings: 0, actions: 0, overdue: 0 };
    
    try {
      if (menus.some(m => m && m.code === 'meetings')) {
        try {
          const res = await api.get('/action-tracker/meetings/', { 
            params: { limit: 1, upcoming: true, show_upcoming: true, show_past: false }
          });
          const total = res.data?.total || 0;
          counts.meetings = typeof total === 'number' ? total : 0;
        } catch { /* ignore */ }
      }

      if (menus.some(m => m && m.code === 'actions')) {
        try {
          const res = await api.get('/action-tracker/actions/my-tasks', { 
            params: { limit: 1, include_completed: false }
          });
          const total = res.data?.total || 0;
          counts.actions = typeof total === 'number' ? total : 0;
          
          const overdueRes = await api.get('/action-tracker/actions/my-tasks', {
            params: { limit: 1, include_completed: false, is_overdue: true }
          });
          const overdueTotal = overdueRes.data?.total || 0;
          counts.overdue = typeof overdueTotal === 'number' ? overdueTotal : 0;
        } catch { /* ignore */ }
      }

      if (isMountedRef.current) {
        setBadgeCounts(counts);
      }
    } catch (err) {
      console.error('Error fetching badge counts:', err);
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  }, [menus, user?.id]);

  // ── Refresh all data ────────────────────────────────────────────────────
  const refreshAllData = useCallback(async () => {
    await fetchMenus(true);
    await fetchBadgeCounts();
    if (isMountedRef.current) {
      setSnackbar({ open: true, message: 'Data refreshed successfully', severity: 'success' });
    }
  }, [fetchMenus, fetchBadgeCounts]);

  // ── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  useEffect(() => {
    if (!menus.length || !user?.id) return;
    
    fetchBadgeCounts();
    intervalRef.current = setInterval(fetchBadgeCounts, REFRESH_INTERVAL_MS);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [menus, user?.id, fetchBadgeCounts]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden && menus.length && user?.id && isMountedRef.current) {
        fetchBadgeCounts();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [menus, user?.id, fetchBadgeCounts]);

  // Sync active tab with route
  useEffect(() => {
    if (!menus.length) return;
    const idx = menus.findIndex(m => m && location.pathname.startsWith(getPathFromMenu(m)));
    if (isMountedRef.current && idx >= 0 && idx !== navValue) {
      setNavValue(idx);
    }
  }, [location.pathname, menus, navValue]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleNav = useCallback((_, newVal) => {
    if (!menus[newVal]) return;
    setNavValue(newVal);
    const menu = menus[newVal];
    const path = getPathFromMenu(menu);
    if (path && path !== '/') {
      navigate(path);
    }
  }, [menus, navigate]);

  const handleProfileClick = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleMenuAction = (path) => {
    if (path && path !== '/') navigate(path);
    handleClose();
  };

  const handleLogout = async () => {
    handleClose();
    try {
      await dispatch(logout()).unwrap();
      navigate('/login');
    } catch (err) {
      if (isMountedRef.current) {
        setSnackbar({ open: true, message: 'Logout failed', severity: 'error' });
      }
    }
  };

  // ─── Badge helpers ───────────────────────────────────────────────────────
  const getBadgeContent = (code) => {
    if (code === 'meetings') return formatBadge(badgeCounts.meetings);
    if (code === 'actions') return formatBadge(badgeCounts.actions);
    return null;
  };

  const getBadgeColor = (code) => {
    if (code === 'meetings') {
      if (badgeCounts.meetings > 5) return 'error';
      if (badgeCounts.meetings > 2) return 'warning';
      if (badgeCounts.meetings > 0) return 'info';
    }
    if (code === 'actions') {
      if (badgeCounts.overdue > 0) return 'error';
      if (badgeCounts.actions > 0) return 'warning';
    }
    return 'default';
  };

  const userInitial = user?.full_name?.[0] || user?.username?.[0] || 'U';
  const totalNotifications = badgeCounts.meetings + badgeCounts.actions;

  // ─── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <Paper sx={{ 
        position: 'fixed', bottom: 0, left: 0, right: 0, 
        zIndex: t => t.zIndex.drawer + 1, py: 1.5, 
        display: 'flex', justifyContent: 'center', gap: 2
      }} elevation={0}>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} variant="circular" width={40} height={40} />
        ))}
      </Paper>
    );
  }

  if (error && (!menus || menus.length === 0)) {
    return (
      <Paper sx={{ 
        position: 'fixed', bottom: 0, left: 0, right: 0, p: 1,
        zIndex: t => t.zIndex.drawer + 1
      }} elevation={0}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={() => fetchMenus(true)}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Paper>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <Paper
        elevation={0}
        sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: t => t.zIndex.drawer + 1,
          borderTop: '1px solid', borderColor: 'divider', borderRadius: 0,
          background: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(10px)',
          boxShadow: isDark ? '0 -2px 8px rgba(0,0,0,0.3)' : '0 -2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <BottomNavigation
          showLabels
          value={navValue}
          onChange={handleNav}
          sx={{
            '& .MuiBottomNavigationAction-root': {
              transition: 'all 0.2s ease',
              '&.Mui-selected': {
                transform: 'translateY(-2px)',
                '& .MuiBottomNavigationAction-label': { fontWeight: 600 },
              },
            },
          }}
        >
          {/* Dynamic Menus */}
          {menus.filter(Boolean).map((menu, index) => {
            const iconEl = resolveIcon(menu.icon, menu.icon_type, menu.icon_library);
            const badgeContent = getBadgeContent(menu.code);
            const badgeColor = getBadgeColor(menu.code);
            const isSelected = navValue === index;

            return (
              <BottomNavigationAction
                // Use the index as part of the primary key to guarantee local uniqueness
                key={`nav-item-${index}-${menu.id || menu.code || 'fallback'}`} 
                label={menu.title || 'Menu'}
                icon={
                  badgeContent ? (
                    <Badge
                      badgeContent={badgeContent}
                      color={badgeColor}
                      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                      sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 18, minWidth: 18, borderRadius: 9 } }}
                    >
                      {iconEl}
                    </Badge>
                  ) : iconEl
                }
                sx={{
                  '& .MuiBottomNavigationAction-label': {
                    fontSize: '0.7rem',
                    fontWeight: isSelected ? 600 : 400
                  }
                }}
              />
            );
          })}

          {/* Profile tab */}
          <BottomNavigationAction
            label="Profile"
            onClick={handleProfileClick}
            icon={
              <Badge
                badgeContent={totalNotifications > 0 ? (totalNotifications > 99 ? '99+' : totalNotifications) : null}
                color="error"
                variant={totalNotifications > 0 ? 'standard' : 'dot'}
                overlap="circular"
                invisible={totalNotifications === 0 && !refreshing}
              >
                <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: 12 }}>
                  {userInitial}
                </Avatar>
              </Badge>
            }
          />
        </BottomNavigation>
      </Paper>

      {/* Profile popup menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        TransitionComponent={Fade}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: { mb: 7, borderRadius: 2, minWidth: 280, overflow: 'visible', maxHeight: '80vh' },
        }}
      >
        {/* User header */}
        <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>{userInitial}</Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                {user?.full_name || user?.username || 'User'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {user?.email || ''}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* Quick stats */}
        {(badgeCounts.meetings > 0 || badgeCounts.actions > 0 || badgeCounts.overdue > 0) && (
          <>
            <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Quick Overview
              </Typography>
              {menus.some(m => m && m.code === 'meetings') && badgeCounts.meetings > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">Upcoming meetings</Typography>
                  <Chip label={badgeCounts.meetings} size="small" color="primary" />
                </Box>
              )}
              {menus.some(m => m && m.code === 'actions') && (badgeCounts.actions > 0 || badgeCounts.overdue > 0) && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                  <Typography variant="body2">Pending actions</Typography>
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    {badgeCounts.actions > 0 && (
                      <Chip label={`${badgeCounts.actions} pending`} size="small" color="warning" />
                    )}
                    {badgeCounts.overdue > 0 && (
                      <Chip label={`${badgeCounts.overdue} overdue`} size="small" color="error" />
                    )}
                  </Box>
                </Box>
              )}
            </Box>
            <Divider />
          </>
        )}

        {/* Navigation items from menus */}
        {menus.filter(Boolean).map((menu) => (
          <MenuItem key={`menu-item-${menu.id || menu.code}`} onClick={() => handleMenuAction(getPathFromMenu(menu))}>
            <ListItemIcon>
              {resolveIcon(menu.icon, menu.icon_type, menu.icon_library)}
            </ListItemIcon>
            <ListItemText primary={menu.title || 'Menu'} />
          </MenuItem>
        ))}

        <Divider />

        <MenuItem onClick={() => handleMenuAction('/profile')}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="My Profile" />
        </MenuItem>

        <MenuItem onClick={() => handleMenuAction('/settings')}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Settings" />
        </MenuItem>

        <MenuItem onClick={() => handleMenuAction('/help')}>
          <ListItemIcon><HelpIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Help & Support" />
        </MenuItem>

        <MenuItem onClick={() => handleMenuAction('/feedback')}>
          <ListItemIcon><FeedbackIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Send Feedback" />
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ color: 'error.main' }} />
        </MenuItem>

        <Divider />

        <MenuItem onClick={refreshAllData} disabled={refreshing} sx={{ justifyContent: 'center' }}>
          {refreshing
            ? <CircularProgress size={16} sx={{ mr: 1 }} />
            : <RefreshIcon fontSize="small" sx={{ mr: 1 }} />}
          <Typography variant="caption" color="text.secondary">
            {refreshing ? 'Refreshing...' : 'Refresh all data'}
          </Typography>
        </MenuItem>
      </Menu>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default MobileBottomNav;