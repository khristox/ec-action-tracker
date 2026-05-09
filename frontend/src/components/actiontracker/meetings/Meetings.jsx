// src/components/actiontracker/meetings/Meetings.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

// Storage keys
const STORAGE_KEYS = {
  SELECTED_TAB: 'meetings_selected_tab',
  VIEW_MODE: 'meetings_view_mode',
  SHOW_UPCOMING: 'meetings_show_upcoming',
  SHOW_PAST: 'meetings_show_past',
  STATUS_FILTER: 'meetings_status_filter'
};

const Meetings = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
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
  
  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_TAB, tabValue.toString());
  }, [tabValue]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VIEW_MODE, viewMode);
  }, [viewMode]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOW_UPCOMING, showUpcoming.toString());
  }, [showUpcoming]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOW_PAST, showPast.toString());
  }, [showPast]);
  
  useEffect(() => {
    if (statusFilter !== 'all') {
      localStorage.setItem(STORAGE_KEYS.STATUS_FILTER, statusFilter);
    } else {
      localStorage.removeItem(STORAGE_KEYS.STATUS_FILTER);
    }
  }, [statusFilter]);
  
  // Load saved status filter on mount
  useEffect(() => {
    const savedStatus = localStorage.getItem(STORAGE_KEYS.STATUS_FILTER);
    if (savedStatus && savedStatus !== 'all') {
      setStatusFilter(savedStatus);
    }
  }, []);
  
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
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, showUpcoming, showPast]);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPage(1);
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
    setPage(1);
    localStorage.removeItem(STORAGE_KEYS.STATUS_FILTER);
    localStorage.removeItem(STORAGE_KEYS.SHOW_UPCOMING);
    localStorage.removeItem(STORAGE_KEYS.SHOW_PAST);
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || showPast || !showUpcoming;

  // Use server-driven total for pagination — do NOT re-filter client-side
  const totalPages = Math.ceil((pagination.total || 0) / rowsPerPage);

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', pb: isMobile ? 8 : 4, bgcolor: 'background.default' }}>
      <Box sx={{ p: isMobile ? 2 : 3 }}>
        
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

        {/* Tabs */}
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
            <Tab label={`Regular Meetings (${pagination.total ?? meetings.length})`} />
            <Tab label={`Recurring Series (${recurringMeetings.length})`} />
          </Tabs>
        </Paper>

        {/* Regular Meetings Tab */}
        <TabPanel value={tabValue} index={0}>
          {/* Filters */}
          <Paper elevation={0} sx={{ p: isMobile ? 1.5 : 2.5, mb: 4, borderRadius: 3, border: `1px solid ${COLORS.primary}20`, bgcolor: 'background.paper' }}>
            <MeetingFilters
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              statusOptions={statusOptions}
              showUpcoming={showUpcoming}
              setShowUpcoming={setShowUpcoming}
              showPast={showPast}
              setShowPast={setShowPast}
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
              
              {/* Pagination — driven by server total */}
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
        setStatusFilter={setStatusFilter}
        statusOptions={statusOptions}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showUpcoming={showUpcoming}
        setShowUpcoming={setShowUpcoming}
        showPast={showPast}
        setShowPast={setShowPast}
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