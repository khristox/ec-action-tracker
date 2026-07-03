// src/components/actiontracker/meetings/Meetings.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, Stack, Fab, Tabs, Tab,
  Pagination, Skeleton, Snackbar, Alert, useMediaQuery, useTheme,
  CircularProgress, IconButton, Chip, Divider, TextField, InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
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
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
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
    let savedScroll = sessionStorage.getItem(SESSION_KEYS.SCROLL_POSITION);
    
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

  // Helper to get status label
  const getStatusLabel = (statusId) => {
    const status = statusOptions.find(s => s.id === statusId);
    return status ? status.name : 'Unknown';
  };

  // Helper to get status color
  const getStatusColor = (statusId) => {
    const status = statusOptions.find(s => s.id === statusId);
    return status?.color || 'default';
  };

  // Count active filters
  const activeFilterCount = [
    searchTerm ? 1 : 0,
    statusFilter !== 'all' ? 1 : 0,
    !showUpcoming ? 1 : 0,
    showPast ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  // Get grid columns based on screen size
  const getGridColumns = () => {
    if (isMobile) return '1fr';
    if (isTablet) return 'repeat(2, 1fr)';
    return 'repeat(auto-fill, minmax(300px, 1fr))';
  };
  
  return (
    <Box sx={{ 
      width: '100%', 
      minHeight: '100vh', 
      pb: isMobile ? 10 : 4, 
      bgcolor: 'background.default',
      pt: isMobile ? 0 : 2
    }}>
      <Box sx={{ p: isMobile ? 1.5 : 3 }} ref={scrollContainerRef}>
        
        {/* Header - Simplified for mobile */}
        <Stack 
          direction={isMobile ? "column" : "row"} 
          justifyContent="space-between" 
          alignItems={isMobile ? "flex-start" : "center"} 
          mb={isMobile ? 2 : 4}
          spacing={isMobile ? 1.5 : 0}
        >
          <Box>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              fontWeight={900} 
              sx={{ 
                background: COLORS.gradient.primary, 
                backgroundClip: 'text', 
                WebkitBackgroundClip: 'text', 
                color: 'transparent',
                fontSize: isMobile ? '1.5rem' : '2.125rem'
              }}
            >
              Meetings
            </Typography>
            {!isMobile && (
              <Typography variant="body2" color="text.secondary">
                Manage and track all scheduled sessions
              </Typography>
            )}
          </Box>
          
          {/* Desktop - Show both buttons */}
          {!isMobile && (
            <Stack direction="row" spacing={1.5}>
              <Button 
                variant="contained" 
                startIcon={<AddIcon />} 
                onClick={() => navigate('/meetings/create')} 
                sx={{ 
                  borderRadius: 2.5, 
                  px: 3, 
                  py: 1.2, 
                  fontWeight: 700, 
                  textTransform: 'none',
                  ...(tabValue === 1 && { variant: 'outlined' })
                }}
              >
                New Meeting
              </Button>
              <Button 
                variant={tabValue === 1 ? "contained" : "outlined"} 
                startIcon={<AddIcon />} 
                onClick={() => navigate('/recurring-meetings/create')} 
                sx={{ 
                  borderRadius: 2.5, 
                  px: 3, 
                  py: 1.2, 
                  fontWeight: 700, 
                  textTransform: 'none'
                }}
              >
                New Series
              </Button>
            </Stack>
          )}
        </Stack>
        
        {/* Tabs with accurate counts - Remove curve on mobile */}
        <Paper sx={{ 
          borderRadius: isMobile ? 0 : 3, 
          overflow: 'hidden', 
          mb: isMobile ? 0 : 3,
          borderTopLeftRadius: isMobile ? '8px' : undefined,
          borderTopRightRadius: isMobile ? '8px' : undefined,
          boxShadow: isMobile ? 'none' : undefined
        }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ 
              bgcolor: 'background.paper',
              '& .MuiTab-root': { 
                py: isMobile ? 1.5 : 2, 
                fontWeight: 600,
                fontSize: isMobile ? '0.75rem' : '0.875rem',
                minHeight: isMobile ? 44 : 48,
                textTransform: isMobile ? 'none' : 'uppercase'
              },
              '& .Mui-selected': { color: COLORS.primary },
              '& .MuiTabs-indicator': { bgcolor: COLORS.primary, height: isMobile ? 2 : 3 }
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
                        bgcolor: tabValue === 0 ? COLORS.primary : 'action.hover',
                        color: tabValue === 0 ? 'white' : 'text.secondary'
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
                        bgcolor: tabValue === 1 ? COLORS.primary : 'action.hover',
                        color: tabValue === 1 ? 'white' : 'text.secondary'
                      }} 
                    />
                  )}
                </Box>
              } 
            />
          </Tabs>
        </Paper>
        
        {/* Regular Meetings Tab */}
        <TabPanel value={tabValue} index={0}>
          {/* Filters - Mobile Optimized */}
          <Paper elevation={0} sx={{ 
            p: isMobile ? 1 : 2.5, 
            mb: isMobile ? 2 : 4, 
            borderRadius: isMobile ? 2 : 3, 
            border: `1px solid ${COLORS.primary}20`, 
            bgcolor: 'background.paper',
            ...(isMobile && { 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 'none'
            })
          }}>
            {/* Mobile Filter Bar */}
            {isMobile ? (
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
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                        endAdornment: searchTerm && (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => handleSearchTermChange('')}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ),
                        sx: { borderRadius: 2 }
                      }}
                    />
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton 
                      onClick={() => setFilterDrawerOpen(true)}
                      size="small"
                      sx={{ 
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        color: 'text.secondary',
                        ...(activeFilterCount > 0 && { 
                          borderColor: COLORS.primary,
                          color: COLORS.primary,
                          bgcolor: `${COLORS.primary}10`
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
                            bgcolor: COLORS.primary,
                            color: 'white',
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
                        borderColor: 'divider',
                        borderRadius: 2,
                        color: 'text.secondary'
                      }}
                    >
                      {viewMode === 'grid' ? <ViewListIcon fontSize="small" /> : <ViewModuleIcon fontSize="small" />}
                    </IconButton>
                  </Stack>
                </Stack>

                {/* Filter Chips */}
                {hasActiveFilters && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {searchTerm && (
                      <Chip 
                        label={`Search: ${searchTerm}`}
                        size="small"
                        onDelete={() => handleSearchTermChange('')}
                        sx={{ height: 22, fontSize: '0.7rem' }}
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
                        sx={{ height: 22, fontSize: '0.7rem' }}
                      />
                    )}
                    {showPast && (
                      <Chip 
                        label="Show Past"
                        size="small"
                        onDelete={() => handleShowPastChange(false)}
                        sx={{ height: 22, fontSize: '0.7rem' }}
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
              // Desktop - Original MeetingFilters component
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
            )}
          </Paper>
          
          {/* Grid View */}
          {viewMode === 'grid' && (
            <>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: getGridColumns(),
                gap: { xs: 2, sm: 2.5, md: 3 },
                width: '100%'
              }}>
                {loading ? (
                  // Loading skeletons - use the same grid structure
                  Array.from({ length: isMobile ? 3 : 6 }).map((_, i) => (
                    <Skeleton 
                      key={i} 
                      variant="rounded" 
                      height={isMobile ? 320 : 380} 
                      sx={{ 
                        borderRadius: 3,
                        width: '100%'
                      }} 
                    />
                  ))
                ) : meetings.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 8, gridColumn: '1 / -1' }}>
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
                      sx={{ 
                        width: '100%',
                        height: '100%',
                        display: 'flex'
                      }}
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
                    showFirstButton={!isMobile}
                    showLastButton={!isMobile}
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
                    showFirstButton={!isMobile}
                    showLastButton={!isMobile}
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
      
      {/* Mobile FAB - Single button with dropdown or toggle */}
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
          {/* Quick action hint */}
          <Box sx={{ 
            bgcolor: 'background.paper', 
            px: 1.5, 
            py: 0.5, 
            borderRadius: 2,
            boxShadow: 2,
            fontSize: '0.7rem',
            color: 'text.secondary',
            mb: 0.5
          }}>
            {tabValue === 0 ? 'Create Meeting' : 'Create Series'}
          </Box>
          
          <Fab 
            color="primary" 
            sx={{ 
              boxShadow: 3,
              '&:active': { transform: 'scale(0.95)' }
            }} 
            onClick={() => navigate(tabValue === 0 ? '/meetings/create' : '/recurring-meetings/create')}
          >
            <AddIcon />
          </Fab>
        </Stack>
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
        activeFilterCount={activeFilterCount}
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