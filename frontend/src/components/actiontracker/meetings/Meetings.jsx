// src/components/actiontracker/meetings/Meetings.jsx

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, Stack, Fab, Tabs, Tab,
  Pagination, Skeleton, Snackbar, Alert, useMediaQuery, useTheme,
  CircularProgress, IconButton, Chip, TextField, InputAdornment,
  alpha
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import Close from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import { 
  selectMeetingStatusOptions,
  fetchActionTrackerAttributes
} from '../../../store/slices/actionTracker/meetingSlice';
import api from '../../../services/api';
import { meetingsAPI } from '../../../services/meetingsAPI';

import { MeetingCard } from './components/MeetingCard';
import { MeetingFilters } from './components/MeetingFilters';
import { MeetingTableView } from './components/MeetingTableView';
import { MobileFilterDrawer } from './components/MobileFilterDrawer';
import { NotificationDialog } from './components/NotificationDialog';
import { RecurringMeetingsList } from './components/RecurringMeetingsList';
import { TabPanel } from './components/TabPanel';
import { COLORS } from './styles/colors';
import AddActionDialog from './components/AddActionDialog';

// ==================== CONSTANTS ====================
const STORAGE_KEYS = {
  SELECTED_TAB: 'meetings_selected_tab',
  VIEW_MODE: 'meetings_view_mode',
  SHOW_UPCOMING: 'meetings_show_upcoming',
  SHOW_PAST: 'meetings_show_past',
  STATUS_FILTER: 'meetings_status_filter',
  SEARCH_TERM: 'meetings_search_term',
  CURRENT_PAGE: 'meetings_current_page',
  SCROLL_POSITION: 'meetings_scroll_position'
};

const SESSION_KEYS = {
  SCROLL_POSITION: 'meetings_scroll_position_session'
};

// ==================== DARK MODE COLORS ====================
const DARK_MODE = {
  background: '#0F172A',      // Slate 900
  surface: '#1E293B',          // Slate 800
  surfaceLighter: '#334155',   // Slate 700
  text: '#E2E8F0',            // Slate 200
  textSecondary: '#94A3B8',   // Slate 400
  textMuted: '#64748B',       // Slate 500
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.05)',
  primary: '#A78BFA',         // Purple 400
  primaryDark: '#7C3AED',     // Purple 600
  primaryHover: '#6D28D9',    // Purple 700
  success: '#34D399',         // Emerald 400
  successBg: 'rgba(16,185,129,0.1)',
  error: '#F87171',           // Red 400
  errorBg: 'rgba(239,68,68,0.1)',
};

// ==================== MAIN COMPONENT ====================
const Meetings = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDarkMode = theme.palette.mode === 'dark';
  const scrollContainerRef = useRef(null);
  
  // Use dark mode colors
  const dm = isDarkMode ? DARK_MODE : {};
  
  // ==================== REDUX SELECTORS ====================
  const statusOptions = useSelector(selectMeetingStatusOptions);
  
  // ==================== LOCAL STATE ====================
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10 });
  const [recurringMeetings, setRecurringMeetings] = useState([]);
  const [loadingRecurring, setLoadingRecurring] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.SEARCH_TERM) || '';
  });
  
  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.STATUS_FILTER) || 'all';
  });
  
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_PAGE);
    return saved ? parseInt(saved) : 1;
  });
  
  const [rowsPerPage] = useState(isMobile ? 5 : 10);
  
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
    return saved === 'table' ? 'table' : 'grid';
  });
  
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const [tabValue, setTabValue] = useState(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'recurring') return 1;
    if (tabParam === 'regular') return 0;
    const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_TAB);
    return saved ? parseInt(saved) : 0;
  });
  
  const [showUpcoming, setShowUpcoming] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SHOW_UPCOMING);
    return saved !== null ? saved === 'true' : true;
  });
  
  const [showPast, setShowPast] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SHOW_PAST);
    return saved !== null ? saved === 'true' : false;
  });
  
  const [addActionDialogOpen, setAddActionDialogOpen] = useState(false);
  const [selectedMeetingForAction, setSelectedMeetingForAction] = useState(null);
  const [minutes, setMinutes] = useState([]);
  const [loadingMinutes, setLoadingMinutes] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [creatingAction, setCreatingAction] = useState(false);

  // ==================== COMPUTED VALUES ====================
  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || showPast || !showUpcoming;
  const totalPages = Math.ceil((pagination.total || 0) / rowsPerPage);
  const regularMeetingsCount = pagination.total ?? meetings.length;
  const recurringMeetingsCount = recurringMeetings.length;
  
  const activeFilterCount = [
    searchTerm ? 1 : 0,
    statusFilter !== 'all' ? 1 : 0,
    !showUpcoming ? 1 : 0,
    showPast ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  // ==================== HELPER FUNCTIONS ====================
  const getStatusLabel = useCallback((statusId) => {
    if (!statusId) return 'Unknown';
    const status = statusOptions.find(s => s.id === statusId);
    return status?.name || status?.short_name || 'Unknown';
  }, [statusOptions]);

  const getStatusColor = useCallback((statusId) => {
    if (!statusId) return 'default';
    const status = statusOptions.find(s => s.id === statusId);
    return status?.color || 'default';
  }, [statusOptions]);

  const getGridColumns = useCallback(() => {
    if (isMobile) return '1fr';
    if (isTablet) return 'repeat(2, 1fr)';
    return 'repeat(auto-fill, minmax(360px, 1fr))';
  }, [isMobile, isTablet]);

  // ==================== STORAGE HELPERS ====================
  const saveToLocalStorage = useCallback((key, value) => {
    try {
      if (value === undefined || value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value.toString());
      }
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, []);
  
  const saveScrollPosition = useCallback(() => {
    const scrollY = window.scrollY;
    sessionStorage.setItem(SESSION_KEYS.SCROLL_POSITION, scrollY.toString());
    localStorage.setItem(STORAGE_KEYS.SCROLL_POSITION, scrollY.toString());
  }, []);
  
  const restoreScrollPosition = useCallback(() => {
    let savedScroll = sessionStorage.getItem(SESSION_KEYS.SCROLL_POSITION) ||
                      localStorage.getItem(STORAGE_KEYS.SCROLL_POSITION);
    if (savedScroll) {
      setTimeout(() => window.scrollTo({ top: parseInt(savedScroll), behavior: 'auto' }), 100);
    }
  }, []);

  // ==================== DATA FETCHING ====================
  const loadMeetings = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      
      const queryParams = {
        page: params.page || page,
        limit: params.limit || rowsPerPage,
        sort_by: 'meeting_date',
        sort_order: 'desc',
        show_upcoming: params.show_upcoming !== undefined ? params.show_upcoming : showUpcoming,
        show_past: params.show_past !== undefined ? params.show_past : showPast,
      };
      
      if (params.search !== undefined) queryParams.search = params.search;
      else if (searchTerm) queryParams.search = searchTerm;
      
      if (params.status !== undefined) queryParams.status = params.status;
      else if (statusFilter !== 'all') queryParams.status = statusFilter;
      
      const response = await meetingsAPI.getAll(queryParams);
      
      setMeetings(response.data.items || []);
      setPagination({
        total: response.data.total || 0,
        page: response.data.page || 1,
        limit: response.data.limit || rowsPerPage,
      });
    } catch (err) {
      console.error('Error loading meetings:', err);
      setSnackbar({ 
        open: true, 
        message: err.message || 'Failed to load meetings', 
        severity: 'error' 
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, showUpcoming, showPast, searchTerm, statusFilter]);

  const loadRecurringMeetings = useCallback(async () => {
    try {
      setLoadingRecurring(true);
      
      const response = await meetingsAPI.getRecurring({
        limit: 50,
        sort_by: 'meeting_date',
        sort_order: 'desc'
      });
      
      setRecurringMeetings(response.data.data || []);
    } catch (err) {
      console.error('Error loading recurring meetings:', err);
      setSnackbar({ 
        open: true, 
        message: 'Failed to load recurring meetings', 
        severity: 'error' 
      });
    } finally {
      setLoadingRecurring(false);
    }
  }, []);

  const handleGenerateNextOccurrence = useCallback(async (meeting) => {
    try {
      const response = await api.post(`/action-tracker/recurring-meetings/${meeting.id}/generate-next`);
      return {
        success: true,
        message: response.data.message || 'Next occurrence generated successfully'
      };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.detail || err.message || 'Failed to generate next occurrence'
      };
    }
  }, []);

  // ==================== HANDLERS ====================
  const handleSearchTermChange = (value) => {
    setSearchTerm(value);
    setPage(1);
  };
  
  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };
  
  const handleShowUpcomingChange = (value) => {
    setShowUpcoming(value);
    setPage(1);
  };
  
  const handleShowPastChange = (value) => {
    setShowPast(value);
    setPage(1);
  };
  
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    saveScrollPosition();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPage(1);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setShowUpcoming(true);
    setShowPast(false);
    setPage(1);
    meetingsAPI.clearCache();
  };

  const handleNotifyClick = async (meeting) => {
    setSelectedMeeting(meeting);
    setNotificationDialogOpen(true);
    try {
      const res = await api.get(`/action-tracker/meetings/${meeting.id}/participants`);
      setParticipants(res.data?.items || res.data || []);
    } catch (err) { 
      setParticipants([]); 
    }
  };
  
  const handleAddAction = async (meeting) => {
    setSelectedMeetingForAction(meeting);
    setAddActionDialogOpen(true);
    setActionError(null);
    setLoadingMinutes(true);
    try {
      const response = await api.get(`/action-tracker/meetings/${meeting.id}/minutes`);
      const minutesData = response.data?.items || response.data || [];
      setMinutes(Array.isArray(minutesData) ? minutesData : []);
    } catch (err) {
      setMinutes([]);
    } finally {
      setLoadingMinutes(false);
    }
  };

  const handleSaveAction = async (payload) => {
    setCreatingAction(true);
    setActionError(null);
    try {
      const actionPayload = { ...payload, meeting_id: selectedMeetingForAction?.id };
      const response = await api.post('/action-tracker/actions/', actionPayload);
      setSnackbar({ open: true, message: 'Action created successfully!', severity: 'success' });
      setAddActionDialogOpen(false);
      setSelectedMeetingForAction(null);
      meetingsAPI.clearCache();
      loadMeetings({ page, limit: rowsPerPage });
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create action';
      setActionError(errorMessage);
      throw err;
    } finally {
      setCreatingAction(false);
    }
  };

  const handleMinuteCreated = async () => {
    if (selectedMeetingForAction) {
      try {
        const response = await api.get(`/action-tracker/meetings/${selectedMeetingForAction.id}/minutes`);
        const minutesData = response.data?.items || response.data || [];
        setMinutes(Array.isArray(minutesData) ? minutesData : []);
      } catch (err) {
        // ignore
      }
    }
  };

  const handleSendNotifications = async (data) => {
    try {
      const res = await api.post(`/action-tracker/meetings/${selectedMeeting.id}/notify-participants`, data);
      setSnackbar({ open: true, message: `✨ Sent to ${res.data.sent} participants!`, severity: 'success' });
      setNotificationDialogOpen(false);
    } catch (err) { 
      setSnackbar({ open: true, message: 'Failed to send notifications', severity: 'error' }); 
    }
  };
  
  const handleGenerateMeeting = async (meeting) => {
    const result = await handleGenerateNextOccurrence(meeting);
    setSnackbar({ open: true, message: result.message, severity: result.success ? 'success' : 'error' });
    if (result.success) {
      loadRecurringMeetings();
      loadMeetings({ page, limit: rowsPerPage });
    }
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    dispatch(fetchActionTrackerAttributes());
  }, [dispatch]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.SELECTED_TAB, tabValue);
    const urlParams = new URLSearchParams(location.search);
    urlParams.set('tab', tabValue === 0 ? 'regular' : 'recurring');
    navigate({ search: urlParams.toString() }, { replace: true });
  }, [tabValue, navigate, location.search, saveToLocalStorage]);
  
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.VIEW_MODE, viewMode);
  }, [viewMode, saveToLocalStorage]);
  
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.SHOW_UPCOMING, showUpcoming);
  }, [showUpcoming, saveToLocalStorage]);
  
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.SHOW_PAST, showPast);
  }, [showPast, saveToLocalStorage]);
  
  useEffect(() => {
    if (statusFilter !== 'all') {
      saveToLocalStorage(STORAGE_KEYS.STATUS_FILTER, statusFilter);
    } else {
      localStorage.removeItem(STORAGE_KEYS.STATUS_FILTER);
    }
  }, [statusFilter, saveToLocalStorage]);
  
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.SEARCH_TERM, searchTerm || null);
  }, [searchTerm, saveToLocalStorage]);
  
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.CURRENT_PAGE, page);
  }, [page, saveToLocalStorage]);

  useEffect(() => {
    const handleScroll = () => saveScrollPosition();
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('beforeunload', saveScrollPosition);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', saveScrollPosition);
    };
  }, [saveScrollPosition]);

  useEffect(() => {
    loadRecurringMeetings();
  }, [loadRecurringMeetings]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadMeetings({ page, limit: rowsPerPage });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [page, searchTerm, statusFilter, rowsPerPage, showUpcoming, showPast, loadMeetings]);

  useEffect(() => {
    if (!loading && meetings.length > 0) {
      restoreScrollPosition();
    }
  }, [loading, meetings.length, restoreScrollPosition]);

  // ==================== RENDER ====================
  return (
    <Box sx={{ 
      width: '100%', 
      minHeight: '100vh', 
      pb: isMobile ? 10 : 4, 
      bgcolor: isDarkMode ? DARK_MODE.background : 'background.default',
      pt: isMobile ? 0 : 2
    }}>
      <Box sx={{ p: isMobile ? 1.5 : 3 }} ref={scrollContainerRef}>
        
        {/* ==================== HEADER ==================== */}
        <Stack 
          direction={isMobile ? "column" : "row"} 
          mb={isMobile ? 2 : 4}
          spacing={isMobile ? 1.5 : 0}
          sx={{
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'center'
          }}
        >
          <Box>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              fontWeight={900} 
              sx={{ 
                color: isDarkMode ? '#FFFFFF' : COLORS.primary,
                fontSize: isMobile ? '1.5rem' : '2.125rem',
                letterSpacing: '-0.02em',
                textShadow: isDarkMode ? '0 0 40px rgba(167,139,250,0.15)' : 'none',
              }}
            >
              Meetings
            </Typography>
            {!isMobile && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: isDarkMode ? DARK_MODE.textSecondary : 'text.secondary',
                  mt: 0.5
                }}
              >
                Manage and track all scheduled sessions
              </Typography>
            )}
          </Box>
          
          {!isMobile && (
            <Stack direction="row" spacing={1.5}>
              <Button 
                variant="contained" 
                startIcon={<Add />} 
                onClick={() => navigate('/meetings/create')} 
                sx={{ 
                  borderRadius: 2.5, 
                  px: 3, 
                  py: 1.2, 
                  fontWeight: 700, 
                  textTransform: 'none',
                  bgcolor: isDarkMode ? DARK_MODE.primaryDark : undefined,
                  color: isDarkMode ? '#FFFFFF' : undefined,
                  '&:hover': { 
                    bgcolor: isDarkMode ? DARK_MODE.primaryHover : undefined 
                  }
                }}
              >
                New Meeting
              </Button>
            </Stack>
          )}
        </Stack>
        
        {/* ==================== TABS ==================== */}
        <Paper sx={{ 
          borderRadius: isMobile ? 0 : 3, 
          overflow: 'hidden', 
          mb: isMobile ? 0 : 3,
          borderTopLeftRadius: isMobile ? '8px' : undefined,
          borderTopRightRadius: isMobile ? '8px' : undefined,
          boxShadow: isMobile ? 'none' : (isDarkMode ? '0 4px 20px rgba(0,0,0,0.3)' : undefined),
          bgcolor: isDarkMode ? DARK_MODE.surface : 'background.paper',
          border: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none'
        }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ 
              bgcolor: isDarkMode ? DARK_MODE.surface : 'background.paper',
              '& .MuiTab-root': { 
                py: isMobile ? 1.5 : 2, 
                fontWeight: 600,
                fontSize: isMobile ? '0.75rem' : '0.875rem',
                minHeight: isMobile ? 44 : 48,
                textTransform: isMobile ? 'none' : 'uppercase',
                color: isDarkMode ? DARK_MODE.textSecondary : undefined,
                '&.Mui-selected': { 
                  color: isDarkMode ? DARK_MODE.primary : COLORS.primary 
                }
              },
              '& .MuiTabs-indicator': { 
                bgcolor: isDarkMode ? DARK_MODE.primary : COLORS.primary, 
                height: isMobile ? 2 : 3 
              }
            }}
          >
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>Regular</span>
                  {regularMeetingsCount > 0 && (
                    <Chip 
                      label={regularMeetingsCount} 
                      size="small" 
                      sx={{ 
                        height: 18, 
                        fontSize: '0.65rem',
                        bgcolor: tabValue === 0 
                          ? (isDarkMode ? DARK_MODE.primaryDark : COLORS.primary) 
                          : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'action.hover'),
                        color: tabValue === 0 
                          ? '#FFFFFF' 
                          : (isDarkMode ? DARK_MODE.textSecondary : 'text.secondary')
                      }} 
                    />
                  )}
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>Recurring</span>
                  {recurringMeetingsCount > 0 && (
                    <Chip 
                      label={recurringMeetingsCount} 
                      size="small" 
                      sx={{ 
                        height: 18, 
                        fontSize: '0.65rem',
                        bgcolor: tabValue === 1 
                          ? (isDarkMode ? DARK_MODE.primaryDark : COLORS.primary) 
                          : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'action.hover'),
                        color: tabValue === 1 
                          ? '#FFFFFF' 
                          : (isDarkMode ? DARK_MODE.textSecondary : 'text.secondary')
                      }} 
                    />
                  )}
                </Box>
              } 
            />
          </Tabs>
        </Paper>
        
        {/* ==================== REGULAR MEETINGS TAB ==================== */}
        <TabPanel value={tabValue} index={0}>
          <Paper elevation={0} sx={{ 
            p: isMobile ? 1 : 2.5, 
            mb: isMobile ? 2 : 4, 
            borderRadius: isMobile ? 2 : 3, 
            border: `1px solid ${isDarkMode ? DARK_MODE.border : `${COLORS.primary}20`}`,
            bgcolor: isDarkMode ? DARK_MODE.surface : 'background.paper',
            ...(isMobile && { 
              borderRadius: 1,
              border: '1px solid',
              borderColor: isDarkMode ? DARK_MODE.border : 'divider',
              boxShadow: 'none'
            })
          }}>
            {isMobile ? (
              // Mobile Filters
              <>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1, position: 'relative' }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search meetings..."
                      value={searchTerm}
                      onChange={(e) => handleSearchTermChange(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" sx={{ color: isDarkMode ? DARK_MODE.textSecondary : undefined }} />
                          </InputAdornment>
                        ),
                        endAdornment: searchTerm && (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => handleSearchTermChange('')}>
                              <Close fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ),
                        sx: { 
                          borderRadius: 2,
                          color: isDarkMode ? DARK_MODE.text : undefined,
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: isDarkMode ? DARK_MODE.border : undefined,
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : undefined,
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: isDarkMode ? DARK_MODE.primary : undefined,
                          }
                        }
                      }}
                    />
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton 
                      onClick={() => setFilterDrawerOpen(true)}
                      size="small"
                      sx={{ 
                        border: '1px solid',
                        borderColor: isDarkMode ? DARK_MODE.border : 'divider',
                        borderRadius: 2,
                        color: isDarkMode ? DARK_MODE.textSecondary : 'text.secondary',
                        ...(activeFilterCount > 0 && { 
                          borderColor: isDarkMode ? DARK_MODE.primary : COLORS.primary,
                          color: isDarkMode ? DARK_MODE.primary : COLORS.primary,
                          bgcolor: isDarkMode ? alpha(DARK_MODE.primary, 0.1) : `${COLORS.primary}10`
                        })
                      }}
                    >
                      <FilterListIcon fontSize="small" />
                      {activeFilterCount > 0 && (
                        <Chip 
                          label={activeFilterCount} 
                          size="small" 
                          sx={{ 
                            height: 14, 
                            fontSize: '0.5rem', 
                            minWidth: 14, 
                            p: 0,
                            bgcolor: isDarkMode ? DARK_MODE.primaryDark : COLORS.primary,
                            color: '#FFFFFF',
                            ml: 0.5,
                            '& .MuiChip-label': { px: 0.5 }
                          }} 
                        />
                      )}
                    </IconButton>
                    <IconButton 
                      onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
                      size="small"
                      sx={{ 
                        border: '1px solid',
                        borderColor: isDarkMode ? DARK_MODE.border : 'divider',
                        borderRadius: 2,
                        color: isDarkMode ? DARK_MODE.textSecondary : 'text.secondary'
                      }}
                    >
                      {viewMode === 'grid' ? <ViewListIcon fontSize="small" /> : <ViewModuleIcon fontSize="small" />}
                    </IconButton>
                  </Stack>
                </Stack>

                {hasActiveFilters && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {searchTerm && (
                      <Chip 
                        label={`Search: ${searchTerm}`}
                        size="small"
                        onDelete={() => handleSearchTermChange('')}
                        sx={{ 
                          height: 22, 
                          fontSize: '0.7rem',
                          bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : undefined,
                          color: isDarkMode ? DARK_MODE.text : undefined,
                        }}
                      />
                    )}
                    {statusFilter !== 'all' && (
                      <Chip 
                        label={`Status: ${getStatusLabel(statusFilter)}`}
                        size="small"
                        color={getStatusColor(statusFilter)}
                        onDelete={() => handleStatusFilterChange('all')}
                        sx={{ height: 22, fontSize: '0.7rem' }}
                      />
                    )}
                    {!showUpcoming && (
                      <Chip 
                        label="Hide Upcoming"
                        size="small"
                        onDelete={() => handleShowUpcomingChange(true)}
                        sx={{ 
                          height: 22, 
                          fontSize: '0.7rem',
                          bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : undefined,
                          color: isDarkMode ? DARK_MODE.text : undefined,
                        }}
                      />
                    )}
                    {showPast && (
                      <Chip 
                        label="Show Past"
                        size="small"
                        onDelete={() => handleShowPastChange(false)}
                        sx={{ 
                          height: 22, 
                          fontSize: '0.7rem',
                          bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : undefined,
                          color: isDarkMode ? DARK_MODE.text : undefined,
                        }}
                      />
                    )}
                    {hasActiveFilters && (
                      <Chip 
                        label="Clear All"
                        size="small"
                        color="error"
                        onClick={handleClearFilters}
                        sx={{ height: 22, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                )}
              </>
            ) : (
              <MeetingFilters
                searchTerm={searchTerm}
                setSearchTerm={handleSearchTermChange}
                statusFilter={statusFilter}
                setStatusFilter={handleStatusFilterChange}
                statusOptions={statusOptions}
                showUpcoming={showUpcoming}
                setShowUpcoming={handleShowUpcomingChange}
                showPast={showPast}
                setShowPast={handleShowPastChange}
                viewMode={viewMode}
                setViewMode={setViewMode}
                onClearFilters={handleClearFilters}
                onOpenFilterDrawer={() => setFilterDrawerOpen(true)}
                isMobile={isMobile}
                isDarkMode={isDarkMode}
              />
            )}
          </Paper>
          
          {/* ==================== GRID VIEW ==================== */}
          {viewMode === 'grid' && (
            <>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: getGridColumns(),
                gap: { xs: 2, sm: 2.5, md: 3 },
                width: '100%',
                alignItems: 'stretch',
                '& > *': {
                  width: '100%',
                  height: '100%',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }
              }}>
                {loading ? (
                  Array.from({ length: isMobile ? 3 : 6 }).map((_, i) => (
                    <Skeleton 
                      key={i} 
                      variant="rounded" 
                      height={isMobile ? 320 : 380} 
                      sx={{ 
                        borderRadius: 3, 
                        width: '100%',
                        bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : undefined,
                      }} 
                    />
                  ))
                ) : meetings.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 8, gridColumn: '1 / -1' }}>
                    <Typography variant="h6" color={isDarkMode ? DARK_MODE.textSecondary : 'text.secondary'}>
                      No meetings found
                    </Typography>
                    <Typography variant="body2" color={isDarkMode ? DARK_MODE.textMuted : 'text.secondary'} sx={{ mt: 1 }}>
                      {hasActiveFilters ? 'Try adjusting your search or filters' : 'Create your first meeting'}
                    </Typography>
                    {hasActiveFilters && (
                      <Button onClick={handleClearFilters} sx={{ mt: 2 }} variant="outlined">
                        Clear Filters
                      </Button>
                    )}
                    {!hasActiveFilters && (
                      <Button 
                        variant="contained" 
                        onClick={() => navigate('/meetings/create')} 
                        sx={{ 
                          mt: 2,
                          bgcolor: isDarkMode ? DARK_MODE.primaryDark : undefined,
                          color: isDarkMode ? '#FFFFFF' : undefined,
                          '&:hover': { bgcolor: isDarkMode ? DARK_MODE.primaryHover : undefined }
                        }} 
                        startIcon={<Add />}
                      >
                        Create Meeting
                      </Button>
                    )}
                  </Box>
                ) : (
                  meetings.map((meeting) => (
                    <MeetingCard 
                      key={meeting.id}
                      meeting={meeting} 
                      statusOptions={statusOptions} 
                      getStatusLabel={getStatusLabel}
                      getStatusColor={getStatusColor}
                      onView={(id) => navigate(`/meetings/${id}`)} 
                      onEdit={(id) => navigate(`/meetings/${id}/edit`)} 
                      onNotify={handleNotifyClick}
                      onGenerateMeeting={handleGenerateMeeting}
                      onAddAction={handleAddAction}
                      isDarkMode={isDarkMode}
                    />
                  ))
                )}
              </Box>
              
              {!loading && totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                    size={isMobile ? "small" : "medium"}
                    showFirstButton={!isMobile}
                    showLastButton={!isMobile}
                    sx={{
                      '& .MuiPaginationItem-root': {
                        color: isDarkMode ? DARK_MODE.text : undefined,
                        '&.Mui-selected': {
                          bgcolor: isDarkMode ? DARK_MODE.primaryDark : undefined,
                          color: isDarkMode ? '#FFFFFF' : undefined,
                          '&:hover': {
                            bgcolor: isDarkMode ? DARK_MODE.primaryHover : undefined,
                          }
                        },
                        '&:hover': {
                          bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : undefined,
                        }
                      }
                    }}
                  />
                </Box>
              )}
            </>
          )}
          
          {/* ==================== TABLE VIEW ==================== */}
          {viewMode === 'table' && (
            <>
              <MeetingTableView 
                meetings={meetings}
                onView={(id) => navigate(`/meetings/${id}`)}
                onEdit={(id) => navigate(`/meetings/${id}/edit`)}
                onNotify={handleNotifyClick}
                isDarkMode={isDarkMode}
              />
              
              {!loading && totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                    size={isMobile ? "small" : "medium"}
                    showFirstButton={!isMobile}
                    showLastButton={!isMobile}
                    sx={{
                      '& .MuiPaginationItem-root': {
                        color: isDarkMode ? DARK_MODE.text : undefined,
                        '&.Mui-selected': {
                          bgcolor: isDarkMode ? DARK_MODE.primaryDark : undefined,
                          color: isDarkMode ? '#FFFFFF' : undefined,
                          '&:hover': {
                            bgcolor: isDarkMode ? DARK_MODE.primaryHover : undefined,
                          }
                        },
                        '&:hover': {
                          bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : undefined,
                        }
                      }
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </TabPanel>
        
        {/* ==================== RECURRING MEETINGS TAB ==================== */}
        <TabPanel value={tabValue} index={1}>
          {loadingRecurring ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: isDarkMode ? DARK_MODE.primary : undefined }} />
            </Box>
          ) : (
            <RecurringMeetingsList 
              meetings={recurringMeetings}
              onView={(id) => navigate(`/recurring-meetings/${id}`)}
              onEdit={(id) => navigate(`/recurring-meetings/${id}/edit`)}
              onGenerate={handleGenerateMeeting}
              isDarkMode={isDarkMode}
            />
          )}
        </TabPanel>
      </Box>
      
      {/* ==================== MOBILE FAB ==================== */}
      {isMobile && (
        <Stack 
          direction="column" 
          spacing={1} 
          sx={{ 
            position: 'fixed', 
            bottom: 80, 
            right: 16, 
            zIndex: 1000,
            alignItems: 'flex-end'
          }}
        >
          <Box sx={{ 
            bgcolor: isDarkMode ? DARK_MODE.surface : 'background.paper', 
            px: 1.5, 
            py: 0.5, 
            borderRadius: 2,
            boxShadow: 2,
            fontSize: '0.7rem',
            color: isDarkMode ? DARK_MODE.textSecondary : 'text.secondary',
            mb: 0.5,
            border: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none'
          }}>
            {tabValue === 0 ? 'Create Meeting' : 'Create Series'}
          </Box>
          <Fab 
            color="primary" 
            sx={{ 
              boxShadow: 3, 
              '&:active': { transform: 'scale(0.95)' },
              bgcolor: isDarkMode ? DARK_MODE.primaryDark : undefined,
              color: isDarkMode ? '#FFFFFF' : undefined,
              '&:hover': { bgcolor: isDarkMode ? DARK_MODE.primaryHover : undefined }
            }} 
            onClick={() => navigate(tabValue === 0 ? '/meetings/create' : '/recurring-meetings/create')}
          >
            <Add />
          </Fab>
        </Stack>
      )}
      
      {/* ==================== MOBILE FILTER DRAWER ==================== */}
      <MobileFilterDrawer 
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        statusFilter={statusFilter}
        setStatusFilter={handleStatusFilterChange}
        statusOptions={statusOptions}
        searchTerm={searchTerm}
        setSearchTerm={handleSearchTermChange}
        showUpcoming={showUpcoming}
        setShowUpcoming={handleShowUpcomingChange}
        showPast={showPast}
        setShowPast={handleShowPastChange}
        onClearFilters={handleClearFilters}
        activeFilterCount={activeFilterCount}
        isDarkMode={isDarkMode}
      />
      
      {/* ==================== NOTIFICATION DIALOG ==================== */}
      <NotificationDialog 
        open={notificationDialogOpen} 
        onClose={() => setNotificationDialogOpen(false)} 
        meeting={selectedMeeting} 
        participants={participants} 
        onSend={handleSendNotifications}
        isDarkMode={isDarkMode}
      />

      {/* ==================== ADD ACTION DIALOG ==================== */}
      {selectedMeetingForAction && (
        <AddActionDialog
          open={addActionDialogOpen}
          onClose={() => {
            setAddActionDialogOpen(false);
            setSelectedMeetingForAction(null);
            setActionError(null);
          }}
          onSave={handleSaveAction}
          meetingId={selectedMeetingForAction?.id}
          minutes={minutes}
          selectedMinuteId={minutes.length > 0 ? minutes[0]?.id : null}
          loading={loadingMinutes}
          error={actionError}
          busy={creatingAction}
          onMinutesCreated={handleMinuteCreated}
          isDarkMode={isDarkMode}
        />
      )}
      
      {/* ==================== SNACKBAR ==================== */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })} 
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
      >
        <Alert 
          severity={snackbar.severity} 
          variant="filled"
          sx={{
            bgcolor: snackbar.severity === 'success' && isDarkMode ? '#065F46' : undefined,
            color: snackbar.severity === 'success' && isDarkMode ? '#D1FAE5' : undefined,
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Meetings;