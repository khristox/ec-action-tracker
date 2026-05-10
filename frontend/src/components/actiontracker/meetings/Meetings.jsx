// src/components/actiontracker/meetings/Meetings.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, Stack, Fab, Tabs, Tab,
  Pagination, Skeleton, Snackbar, Alert, useMediaQuery, useTheme,
  CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { 
  selectMeetingStatusOptions, 
  selectStatusOptions, 
  fetchMeetingStatusOptions 
} from '../../../store/slices/actionTracker/meetingSlice';
import api from '../../../services/api';

import { useMeetings } from './hooks/useMeetings';
import { MeetingCard } from './components/MeetingCard';
import { MeetingFilters } from './components/MeetingFilters';
import { MeetingTableView } from './components/MeetingTableView';
import { MobileFilterDrawer } from './components/MobileFilterDrawer';
import { NotificationDialog } from './components/NotificationDialog';
import { RecurringMeetingsList } from './components/RecurringMeetingsList';
import { TabPanel } from './components/TabPanel';
import { COLORS } from './styles/colors';

// Storage keys - grouped for easy management
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

// Session storage for scroll position (cleared on page close)
const SESSION_KEYS = {
  SCROLL_POSITION: 'meetings_scroll_position_session'
};

const Meetings = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const scrollContainerRef = useRef(null);
  
  const statusOptions = useSelector(selectStatusOptions);
  const {
    meetings,
    loading,
    pagination,
    recurringMeetings,
    loadingRecurring,
    loadMeetings,
    loadRecurringMeetings,
    handleGenerateNextOccurrence
  } = useMeetings();
  
  // Load saved state from localStorage
  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_TERM);
    return saved || '';
  });
  
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STATUS_FILTER);
    return saved || 'all';
  });
  
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_PAGE);
    return saved ? parseInt(saved) : 1;
  });
  
  const [rowsPerPage] = useState(10);
  
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
    // Check URL params first for tab selection
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'recurring') return 1;
    if (tabParam === 'regular') return 0;
    
    // Then check localStorage
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
  
  // Save state to localStorage with debounce for performance
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
  
  // Save scroll position
  const saveScrollPosition = useCallback(() => {
    const scrollY = window.scrollY;
    sessionStorage.setItem(SESSION_KEYS.SCROLL_POSITION, scrollY.toString());
    localStorage.setItem(STORAGE_KEYS.SCROLL_POSITION, scrollY.toString());
  }, []);
  
  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    // Try session storage first (more recent)
    let savedScroll = sessionStorage.getItem(SESSION_KEYS.SCROLL_POSITION);
    
    // Fall back to localStorage
    if (!savedScroll) {
      savedScroll = localStorage.getItem(STORAGE_KEYS.SCROLL_POSITION);
    }
    
    if (savedScroll) {
      const scrollY = parseInt(savedScroll);
      setTimeout(() => {
        window.scrollTo({ top: scrollY, behavior: 'auto' });
      }, 100);
    }
  }, []);
  
  // Save preferences to localStorage when they change
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.SELECTED_TAB, tabValue);
    
    // Update URL with tab parameter for deep linking
    const urlParams = new URLSearchParams(location.search);
    if (tabValue === 0) {
      urlParams.set('tab', 'regular');
    } else if (tabValue === 1) {
      urlParams.set('tab', 'recurring');
    }
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
      saveToLocalStorage(STORAGE_KEYS.STATUS_FILTER, null);
    }
  }, [statusFilter, saveToLocalStorage]);
  
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.SEARCH_TERM, searchTerm || null);
  }, [searchTerm, saveToLocalStorage]);
  
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.CURRENT_PAGE, page);
  }, [page, saveToLocalStorage]);
  
  // Save scroll position on scroll
  useEffect(() => {
    const handleScroll = () => {
      saveScrollPosition();
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [saveScrollPosition]);
  
  // Save scroll position before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveScrollPosition();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveScrollPosition]);
  
  // Load data on mount
  useEffect(() => {
    dispatch(fetchMeetingStatusOptions());
    loadRecurringMeetings();
  }, [dispatch, loadRecurringMeetings]);
  
  // Load meetings when filters/page change — all filtering is server-side
  useEffect(() => {
    const params = {
      page,
      limit: rowsPerPage,
      sortBy: 'meeting_date',
      sortOrder: 'desc',
      show_upcoming: showUpcoming,
      show_past: showPast,
    };
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'all') params.status_id = statusFilter;
    
    loadMeetings(params);
  }, [page, searchTerm, statusFilter, rowsPerPage, showUpcoming, showPast, loadMeetings]);
  
  // Reset to page 1 whenever filters change (but not page itself)
  const [filtersChanged, setFiltersChanged] = useState(false);
  useEffect(() => {
    if (filtersChanged) {
      setPage(1);
      setFiltersChanged(false);
    }
  }, [filtersChanged]);
  
  // Handle filter changes
  const handleSearchTermChange = (value) => {
    setSearchTerm(value);
    setFiltersChanged(true);
  };
  
  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setFiltersChanged(true);
  };
  
  const handleShowUpcomingChange = (value) => {
    setShowUpcoming(value);
    setFiltersChanged(true);
  };
  
  const handleShowPastChange = (value) => {
    setShowPast(value);
    setFiltersChanged(true);
  };
  
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    saveScrollPosition();
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  };
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPage(1);
    setFiltersChanged(false);
    // Reset scroll position when changing tabs
    window.scrollTo({ top: 0, behavior: 'auto' });
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
  
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setShowUpcoming(true);
    setShowPast(false);
    setFiltersChanged(true);
    localStorage.removeItem(STORAGE_KEYS.STATUS_FILTER);
    localStorage.removeItem(STORAGE_KEYS.SHOW_UPCOMING);
    localStorage.removeItem(STORAGE_KEYS.SHOW_PAST);
    localStorage.removeItem(STORAGE_KEYS.SEARCH_TERM);
  };
  
  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || showPast || !showUpcoming;
  
  // Use server-driven total for pagination
  const totalPages = Math.ceil((pagination.total || 0) / rowsPerPage);
  
  // Get accurate counts for tabs
  const regularMeetingsCount = pagination.total ?? meetings.length;
  const recurringMeetingsCount = recurringMeetings.length;
  
  // Restore scroll position after initial load
  useEffect(() => {
    if (!loading && meetings.length > 0) {
      restoreScrollPosition();
    }
  }, [loading, meetings.length, restoreScrollPosition]);
  
  return (
    <Box sx={{ width: '100%', minHeight: '100vh', pb: isMobile ? 8 : 4, bgcolor: 'background.default' }}>
      <Box sx={{ p: isMobile ? 2 : 3 }} ref={scrollContainerRef}>
        
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant={isMobile ? "h5" : "h4"} fontWeight={900} sx={{ background: COLORS.gradient.primary, backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              Meetings
            </Typography>
            <Typography variant="body2" color="text.secondary">Manage and track all scheduled sessions</Typography>
          </Box>
          
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => navigate(tabValue === 0 ? '/meetings/create' : '/recurring-meetings/create')} 
            sx={{ 
              borderRadius: 2.5, 
              px: isMobile ? 2 : 4, 
              py: isMobile ? 1 : 1.2, 
              fontWeight: 700, 
              textTransform: 'none',
              ml: 'auto'
            }}
          >
            New {tabValue === 0 ? 'Meeting' : 'Recurring Series'}
          </Button>
        </Stack>
        
        {/* Tabs with accurate counts */}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden', mb: 3 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ 
              bgcolor: 'background.paper',
              '& .MuiTab-root': { py: 2, fontWeight: 600 },
              '& .Mui-selected': { color: COLORS.primary },
              '& .MuiTabs-indicator': { bgcolor: COLORS.primary, height: 3 }
            }}
          >
            <Tab 
              label={`Regular Meetings ${regularMeetingsCount > 0 ? `(${regularMeetingsCount})` : ''}`} 
            />
            <Tab 
              label={`Recurring Series ${recurringMeetingsCount > 0 ? `(${recurringMeetingsCount})` : ''}`} 
            />
          </Tabs>
        </Paper>
        
        {/* Regular Meetings Tab */}
        <TabPanel value={tabValue} index={0}>
          {/* Filters */}
          <Paper elevation={0} sx={{ p: isMobile ? 1.5 : 2.5, mb: 4, borderRadius: 3, border: `1px solid ${COLORS.primary}20`, bgcolor: 'background.paper' }}>
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
            />
          </Paper>
          
          {/* Grid View */}
          {viewMode === 'grid' && (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {loading ? (
                  [...Array(isMobile ? 3 : 6)].map((_, i) => (
                    <Box key={i} sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 24px)' } }}>
                      <Skeleton variant="rounded" height={isMobile ? 420 : 400} sx={{ borderRadius: 3 }} />
                    </Box>
                  ))
                ) : meetings.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 8, width: '100%' }}>
                    <Typography variant="h6" color="text.secondary">No meetings found</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {hasActiveFilters ? 'Try adjusting your search or filters' : 'Create your first meeting'}
                    </Typography>
                    {hasActiveFilters && (
                      <Button onClick={handleClearFilters} sx={{ mt: 2 }} variant="outlined">
                        Clear Filters
                      </Button>
                    )}
                    {!hasActiveFilters && (
                      <Button variant="contained" onClick={() => navigate('/meetings/create')} sx={{ mt: 2 }} startIcon={<AddIcon />}>
                        Create Meeting
                      </Button>
                    )}
                  </Box>
                ) : (
                  meetings.map((meeting) => (
                    <Box 
                      key={meeting.id} 
                      sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 24px)', lg: '1 1 calc(25% - 24px)' }, display: 'flex' }}
                    >
                      <MeetingCard 
                        meeting={meeting} 
                        statusOptions={statusOptions} 
                        onView={(id) => navigate(`/meetings/${id}`)} 
                        onEdit={(id) => navigate(`/meetings/${id}/edit`)} 
                        onNotify={handleNotifyClick}
                        onGenerateMeeting={handleGenerateMeeting}
                      />
                    </Box>
                  ))
                )}
              </Box>
              
              {/* Pagination */}
              {!loading && totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                    size={isMobile ? "small" : "medium"}
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
          
          {/* Table View */}
          {viewMode === 'table' && (
            <>
              <MeetingTableView 
                meetings={meetings}
                onView={(id) => navigate(`/meetings/${id}`)}
                onEdit={(id) => navigate(`/meetings/${id}/edit`)}
                onNotify={handleNotifyClick}
              />
              
              {/* Pagination for table view */}
              {!loading && totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                    size={isMobile ? "small" : "medium"}
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
        </TabPanel>
        
        {/* Recurring Meetings Tab */}
        <TabPanel value={tabValue} index={1}>
          {loadingRecurring ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <RecurringMeetingsList 
              meetings={recurringMeetings}
              onView={(id) => navigate(`/recurring-meetings/${id}`)}
              onEdit={(id) => navigate(`/recurring-meetings/${id}/edit`)}
              onGenerate={handleGenerateMeeting}
            />
          )}
        </TabPanel>
      </Box>
      
      {/* Mobile FAB */}
      {isMobile && (
        <Fab 
          color="primary" 
          sx={{ position: 'fixed', bottom: 16, right: 16 }} 
          onClick={() => navigate(tabValue === 0 ? '/meetings/create' : '/recurring-meetings/create')}
        >
          <AddIcon />
        </Fab>
      )}
      
      {/* Mobile Filter Drawer */}
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
      />
      
      {/* Notification Dialog */}
      <NotificationDialog 
        open={notificationDialogOpen} 
        onClose={() => setNotificationDialogOpen(false)} 
        meeting={selectedMeeting} 
        participants={participants} 
        onSend={handleSendNotifications} 
      />
      
      {/* Snackbar */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })} 
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Meetings;