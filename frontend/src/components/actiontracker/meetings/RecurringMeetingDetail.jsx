// src/components/actiontracker/meetings/RecurringMeetingDetail.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Stack, Chip, IconButton,
  Grid, Divider, CircularProgress, Alert, Snackbar,
  Tooltip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Accordion, AccordionSummary, AccordionDetails,
  useTheme, useMediaQuery, alpha, Skeleton, Breadcrumbs,
  Link, Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Menu, MenuItem, ListItemIcon, Card, CardContent,
  ButtonGroup, SpeedDial, SpeedDialAction, SpeedDialIcon,
  useScrollTrigger, Fade, TextField, InputAdornment, ToggleButton, ToggleButtonGroup,
  CardActions, CardHeader, Avatar, Badge, TablePagination,
  CircularProgress as Loader
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Repeat as RepeatIcon,
  EventNote as EventNoteIcon,
  Today as TodayIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  CalendarToday as CalendarTodayIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Business as BusinessIcon,
  MeetingRoom as MeetingRoomIcon,
  Videocam as VideocamIcon,
  ContentCopy as ContentCopyIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import api from '../../../services/api';
import { COLORS } from './styles/colors';
import { formatDate, formatTime, getRecurrenceDescription } from './utils/helpers';

const RecurringMeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const loadMoreRef = useRef();
  
  // State management
  const [recurringMeeting, setRecurringMeeting] = useState(null);
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [locationDetails, setLocationDetails] = useState(null);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  
  // New states for search, pagination, and view
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('asc');
  const [totalCount, setTotalCount] = useState(0);

  const trigger = useScrollTrigger({
    threshold: 100,
  });

  // Memoized filtered and sorted occurrences
  const filteredAndSortedOccurrences = useMemo(() => {
    let filtered = [...occurrences];
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(occ => 
        occ.title?.toLowerCase().includes(searchLower) ||
        occ.description?.toLowerCase().includes(searchLower) ||
        occ.scheduled_date?.includes(searchLower) ||
        occ.location_text?.toLowerCase().includes(searchLower)
      );
    }
    
    if (filterStatus === 'upcoming') {
      filtered = filtered.filter(occ => new Date(occ.scheduled_date) > new Date());
    } else if (filterStatus === 'past') {
      filtered = filtered.filter(occ => new Date(occ.scheduled_date) <= new Date());
    }
    
    filtered.sort((a, b) => {
      const dateA = new Date(a.scheduled_date);
      const dateB = new Date(b.scheduled_date);
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    
    return filtered;
  }, [occurrences, searchTerm, filterStatus, sortOrder]);

  const totalFilteredCount = filteredAndSortedOccurrences.length;
  
  const paginatedOccurrences = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredAndSortedOccurrences.slice(start, end);
  }, [filteredAndSortedOccurrences, page, rowsPerPage]);

  const totalGenerated = useMemo(() => 
    recurringMeeting?.total_occurrences_generated || 0, 
    [recurringMeeting]
  );
  
  const upcomingOccurrences = useMemo(() => 
    occurrences.filter(occ => new Date(occ.scheduled_date) > new Date()),
    [occurrences]
  );

  const pastOccurrences = useMemo(() => 
    occurrences.filter(occ => new Date(occ.scheduled_date) <= new Date()),
    [occurrences]
  );

  const completionRate = useMemo(() => 
    totalGenerated > 0 ? Math.round((occurrences.length / totalGenerated) * 100) : 0,
    [occurrences.length, totalGenerated]
  );

  const getLocationIcon = useCallback((locationText, locationDetails) => {
    if (!locationText && !locationDetails) return <LocationIcon sx={{ fontSize: 18, color: COLORS.danger }} />;
    
    const text = (locationText || locationDetails?.name || '').toLowerCase();
    if (text.includes('zoom') || text.includes('meet') || text.includes('teams') || text.includes('online')) {
      return <VideocamIcon sx={{ fontSize: 18, color: COLORS.info }} />;
    }
    if (text.includes('room') || text.includes('conference')) {
      return <MeetingRoomIcon sx={{ fontSize: 18, color: COLORS.warning }} />;
    }
    return <BusinessIcon sx={{ fontSize: 18, color: COLORS.danger }} />;
  }, []);

  const getLocationDisplay = useCallback((meeting) => {
    if (meeting.location_text) {
      return meeting.location_text;
    }
    if (meeting.location_name) {
      return meeting.location_name;
    }
    if (locationDetails?.name) {
      const parts = [locationDetails.name];
      if (locationDetails.city) parts.push(locationDetails.city);
      if (locationDetails.country) parts.push(locationDetails.country);
      return parts.join(', ');
    }
    return 'Online meeting';
  }, [locationDetails]);

  // Fixed getStatusColor function - removed reference to theme.palette.action.disabled
  const getStatusColor = useCallback((date) => {
    const occurrenceDate = new Date(date);
    const now = new Date();
    if (occurrenceDate < now) return '#9e9e9e'; // Return a gray color instead of theme color
    if (occurrenceDate.toDateString() === now.toDateString()) return COLORS.warning;
    return COLORS.success;
  }, []);

  const fetchRecurringMeetingDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/recurring-meetings/${id}`);
      const data = response.data?.data || response.data;
      setRecurringMeeting(data);
      
      if (data.location_id) {
        try {
          const locationResponse = await api.get(`/locations/${data.location_id}`);
          const locationData = locationResponse.data?.data || locationResponse.data;
          setLocationDetails(locationData);
        } catch (locErr) {
          console.error('Failed to fetch location details:', locErr);
        }
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch recurring meeting:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load recurring meeting details';
      setError(errorMessage);
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchOccurrences = useCallback(async (loadMore = false, pageNum = 1) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      const response = await api.get(`/recurring-meetings/${id}/occurrences`, {
        params: {
          page: pageNum,
          limit: rowsPerPage,
          search: searchTerm || undefined,
          status_filter: filterStatus !== 'all' ? filterStatus : undefined
        }
      });
      
      const data = response.data?.data || response.data || [];
      const total = response.data?.total || data.length;
      setTotalCount(total);
      
      if (loadMore) {
        setOccurrences(prev => [...prev, ...data]);
        setHasMore(pageNum * rowsPerPage < total);
      } else {
        setOccurrences(Array.isArray(data) ? data : []);
        setHasMore(total > rowsPerPage);
      }
    } catch (err) {
      console.error('Failed to fetch occurrences:', err);
      setOccurrences([]);
      setSnackbar({
        open: true,
        message: 'Failed to load occurrences',
        severity: 'warning'
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [id, rowsPerPage, searchTerm, filterStatus]);

  const loadMoreOccurrences = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchOccurrences(true, nextPage);
  }, [loadingMore, hasMore, page, fetchOccurrences]);

  useEffect(() => {
    if (!loadMoreRef.current || loadingMore || !hasMore) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreOccurrences();
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMoreOccurrences, loadingMore, hasMore]);

  const handleGenerateNext = useCallback(async () => {
    setGenerating(true);
    try {
      const response = await api.post(`/recurring-meetings/${id}/generate-on-demand`);
      await Promise.all([fetchOccurrences(), fetchRecurringMeetingDetails()]);
      setSnackbar({
        open: true,
        message: response.data?.message || 'Successfully generated next occurrence!',
        severity: 'success'
      });
    } catch (err) {
      console.error('Failed to generate occurrence:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to generate next occurrence',
        severity: 'error'
      });
    } finally {
      setGenerating(false);
    }
  }, [id, fetchOccurrences, fetchRecurringMeetingDetails]);

  const handleGenerateMultiple = useCallback(async (count = 5) => {
    setGenerating(true);
    try {
      const promises = [];
      for (let i = 0; i < count; i++) {
        promises.push(api.post(`/recurring-meetings/${id}/generate-on-demand`));
      }
      await Promise.all(promises);
      await Promise.all([fetchOccurrences(), fetchRecurringMeetingDetails()]);
      setSnackbar({
        open: true,
        message: `Successfully generated ${count} occurrences!`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Failed to generate occurrences:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to generate occurrences',
        severity: 'error'
      });
    } finally {
      setGenerating(false);
    }
  }, [id, fetchOccurrences, fetchRecurringMeetingDetails]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await api.delete(`/recurring-meetings/${id}/?delete_occurrences=true`);
      setSnackbar({
        open: true,
        message: 'Recurring meeting series deleted successfully',
        severity: 'success'
      });
      setTimeout(() => navigate('/meetings'), 1500);
    } catch (err) {
      console.error('Failed to delete recurring meeting:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to delete recurring meeting',
        severity: 'error'
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [id, navigate]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const exportData = {
        meeting: recurringMeeting,
        occurrences: filteredAndSortedOccurrences,
        location: locationDetails,
        statistics: {
          totalGenerated,
          upcomingCount: upcomingOccurrences.length,
          pastCount: pastOccurrences.length,
          totalOccurrences: occurrences.length,
          completionRate: completionRate
        },
        exportDate: new Date().toISOString(),
        filters: {
          searchTerm,
          filterStatus,
          sortOrder
        }
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recurring_meeting_${recurringMeeting?.title || id}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSnackbar({
        open: true,
        message: 'Meeting data exported successfully',
        severity: 'success'
      });
    } catch (err) {
      console.error('Failed to export:', err);
      setSnackbar({
        open: true,
        message: 'Failed to export meeting data',
        severity: 'error'
      });
    } finally {
      setExporting(false);
      handleMenuClose();
    }
  }, [recurringMeeting, filteredAndSortedOccurrences, locationDetails, id, totalGenerated, upcomingOccurrences.length, pastOccurrences.length, completionRate, searchTerm, filterStatus, sortOrder]);

  const handleCopyLink = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setSnackbar({
      open: true,
      message: 'Link copied to clipboard!',
      severity: 'success'
    });
    handleMenuClose();
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
    handleMenuClose();
  }, []);

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));
  const handleSpeedDialClose = () => setSpeedDialOpen(false);
  const handleSpeedDialOpen = () => setSpeedDialOpen(true);
  
  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) setViewMode(newMode);
  };
  
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(1);
  };
  
  const clearSearch = () => {
    setSearchTerm('');
    setPage(1);
  };
  
  const handleFilterStatusChange = (newStatus) => {
    setFilterStatus(newStatus);
    setPage(1);
  };
  
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(1);
  };

  useEffect(() => {
    if (id) {
      fetchRecurringMeetingDetails();
      fetchOccurrences();
    }
  }, [id, fetchRecurringMeetingDetails, fetchOccurrences]);

  const renderOccurrenceCard = (occurrence, index) => {
    const isPast = new Date(occurrence.scheduled_date) < new Date();
    const statusColor = getStatusColor(occurrence.scheduled_date);
    const globalIndex = (page - 1) * rowsPerPage + index;
    
    return (
      <Card 
        key={occurrence.id}
        sx={{ 
          mb: 2,
          opacity: isPast ? 0.7 : 1,
          borderRadius: 3,
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[8]
          }
        }}
      >
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: alpha(statusColor, 0.1), color: statusColor }}>
              <EventNoteIcon />
            </Avatar>
          }
          title={
            <Typography variant="subtitle1" fontWeight={700}>
              Occurrence #{globalIndex + 1}
            </Typography>
          }
          subheader={
            <Typography variant="caption" color="text.secondary">
              {formatDate(occurrence.scheduled_date)}
            </Typography>
          }
          action={
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="View Meeting">
                <IconButton 
                  size="small" 
                  onClick={() => navigate(`/meetings/${occurrence.id}`)}
                >
                  <EventNoteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit Meeting">
                <IconButton 
                  size="small" 
                  onClick={() => navigate(`/meetings/${occurrence.id}/edit`)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          }
        />
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={2} alignItems="center">
              <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                {formatTime(occurrence.start_time)}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              {getLocationIcon(occurrence.location_text, locationDetails)}
              <Typography variant="body2" color="text.secondary">
                {occurrence.location_text || recurringMeeting.location_text || 'Online'}
              </Typography>
            </Stack>
            <Chip 
              label={occurrence.status || 'Scheduled'}
              size="small"
              sx={{ 
                width: 'fit-content',
                bgcolor: alpha(COLORS.info, 0.1),
                color: COLORS.info,
                fontWeight: 500
              }}
            />
          </Stack>
        </CardContent>
      </Card>
    );
  };

  if (loading && !loadingMore) {
    return (
      <Box sx={{ p: isMobile ? 2 : 3, maxWidth: 1400, mx: 'auto' }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={5} lg={4}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
          <Grid item xs={12} md={7} lg={8}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={fetchRecurringMeetingDetails}>
              Retry
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/meetings')}
          variant="outlined"
        >
          Back to Meetings
        </Button>
      </Box>
    );
  }

  if (!recurringMeeting) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="warning" 
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/meetings')}>
              Go to Meetings
            </Button>
          }
        >
          Recurring meeting not found
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 2 : 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2, display: isMobile ? 'none' : 'flex' }}>
        <Link 
          color="inherit" 
          onClick={() => navigate('/meetings')} 
          sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <EventNoteIcon sx={{ fontSize: 16 }} />
          Meetings
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <RepeatIcon sx={{ fontSize: 16 }} />
          {recurringMeeting.title}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Stack 
        direction={isMobile ? 'column' : 'row'} 
        justifyContent="space-between" 
        alignItems={isMobile ? 'flex-start' : 'center'} 
        spacing={isMobile ? 2 : 0}
        sx={{ mb: 3 }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton 
            onClick={() => navigate('/meetings')} 
            sx={{ 
              bgcolor: alpha(COLORS.primary, 0.1),
              '&:hover': { bgcolor: alpha(COLORS.primary, 0.2) }
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant={isMobile ? "h5" : "h4"} fontWeight={800}>
              {recurringMeeting.title}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap" gap={1}>
              <Chip 
                label="Recurring Series"
                size="small"
                icon={<RepeatIcon sx={{ fontSize: 14 }} />}
                sx={{ bgcolor: alpha(COLORS.recurring, 0.15), color: COLORS.recurring, fontWeight: 600 }}
              />
              <Chip 
                label={recurringMeeting.status === 'active' ? 'Active' : 'Inactive'}
                size="small"
                icon={recurringMeeting.status === 'active' ? 
                  <CheckCircleIcon sx={{ fontSize: 14 }} /> : 
                  <WarningIcon sx={{ fontSize: 14 }} />
                }
                sx={{ 
                  bgcolor: recurringMeeting.status === 'active' 
                    ? alpha(COLORS.success, 0.15) 
                    : alpha(COLORS.warning, 0.15),
                  color: recurringMeeting.status === 'active' ? COLORS.success : COLORS.warning,
                  fontWeight: 600
                }}
              />
              <Chip 
                label={`${totalGenerated} generated`}
                size="small"
                variant="outlined"
              />
              <Chip 
                label={`${occurrences.length} created`}
                size="small"
                variant="outlined"
                color="info"
              />
            </Stack>
          </Box>
        </Stack>
        
        {!isMobile && (
          <Stack direction="row" spacing={1.5}>
            <ButtonGroup variant="outlined" size="medium">
              <Tooltip title="Generate Next">
                <Button
                  onClick={handleGenerateNext}
                  disabled={generating}
                  startIcon={generating ? <CircularProgress size={16} /> : <AddIcon />}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Generate Next
                </Button>
              </Tooltip>
              <Tooltip title="Generate 5">
                <Button
                  onClick={() => handleGenerateMultiple(5)}
                  disabled={generating}
                  sx={{ minWidth: 'auto', px: 2 }}
                >
                  5
                </Button>
              </Tooltip>
              <Tooltip title="Generate 10">
                <Button
                  onClick={() => handleGenerateMultiple(10)}
                  disabled={generating}
                  sx={{ minWidth: 'auto', px: 2 }}
                >
                  10
                </Button>
              </Tooltip>
            </ButtonGroup>

            <Button
              variant="outlined"
              onClick={handleExport}
              disabled={exporting}
              startIcon={<DownloadIcon />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Export
            </Button>

            <Button
              variant="outlined"
              onClick={() => navigate(`/recurring-meetings/${id}/edit`)}
              startIcon={<EditIcon />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Edit
            </Button>

            <Button
              variant="contained"
              color="error"
              onClick={() => setDeleteDialogOpen(true)}
              startIcon={<DeleteIcon />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Delete
            </Button>
          </Stack>
        )}

        {isMobile && (
          <>
            <IconButton onClick={handleMenuOpen}>
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleGenerateNext} disabled={generating}>
                <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                Generate Next
              </MenuItem>
              <MenuItem onClick={() => handleGenerateMultiple(5)} disabled={generating}>
                <ListItemIcon><CalendarTodayIcon fontSize="small" /></ListItemIcon>
                Generate 5
              </MenuItem>
              <MenuItem onClick={() => handleGenerateMultiple(10)} disabled={generating}>
                <ListItemIcon><CalendarTodayIcon fontSize="small" /></ListItemIcon>
                Generate 10
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleExport} disabled={exporting}>
                <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                Export Data
              </MenuItem>
              <MenuItem onClick={handleCopyLink}>
                <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
                Copy Link
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => navigate(`/recurring-meetings/${id}/edit`)}>
                <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                Edit Series
              </MenuItem>
              <MenuItem onClick={() => setDeleteDialogOpen(true)} sx={{ color: COLORS.danger }}>
                <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: COLORS.danger }} /></ListItemIcon>
                Delete Series
              </MenuItem>
            </Menu>
          </>
        )}
      </Stack>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: alpha(COLORS.primary, 0.05), borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center', p: 2.5 }}>
              <Typography variant="h3" fontWeight={800} color="primary">
                {totalGenerated}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Total Generated
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: alpha(COLORS.success, 0.05), borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center', p: 2.5 }}>
              <Typography variant="h3" fontWeight={800} color="success.main">
                {occurrences.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Meetings Created
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: alpha(COLORS.info, 0.05), borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center', p: 2.5 }}>
              <Typography variant="h3" fontWeight={800} color="info.main">
                {upcomingOccurrences.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Upcoming
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: alpha(COLORS.warning, 0.05), borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center', p: 2.5 }}>
              <Typography variant="h3" fontWeight={800} color="warning.main">
                {pastOccurrences.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Past
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Left Column - Meeting Details */}
        <Grid item xs={12} md={5} lg={4}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%', position: 'sticky', top: 20 }}>
            <Typography variant="h6" fontWeight={700} mb={2} sx={{ color: COLORS.primary }}>
              Series Details
            </Typography>
            
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Description
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {recurringMeeting.description || 'No description provided'}
                </Typography>
              </Box>
              
              <Divider />
              
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Recurrence Pattern
                </Typography>
                <Chip 
                  label={getRecurrenceDescription(recurringMeeting)}
                  icon={<RepeatIcon sx={{ fontSize: 14 }} />}
                  sx={{ mt: 1, bgcolor: alpha(COLORS.recurring, 0.1), fontWeight: 500 }}
                />
              </Box>
              
              <Divider />
              
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Next Occurrence
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                  <TodayIcon sx={{ fontSize: 20, color: COLORS.info }} />
                  <Typography variant="body1" fontWeight={600}>
                    {recurringMeeting.next_occurrence_date ? 
                      formatDate(recurringMeeting.next_occurrence_date) : 
                      'Not scheduled'
                    }
                  </Typography>
                </Stack>
              </Box>
              
              <Divider />
              
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Time
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                  <ScheduleIcon sx={{ fontSize: 20, color: COLORS.info }} />
                  <Typography variant="body1">
                    {recurringMeeting.start_time ? 
                      `${formatTime(recurringMeeting.start_time)} - ${formatTime(recurringMeeting.end_time)}` : 
                      'Time not set'
                    }
                  </Typography>
                </Stack>
              </Box>
              
              <Divider />
              
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Location
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                  {getLocationIcon(recurringMeeting.location_text, locationDetails)}
                  <Typography variant="body1">
                    {getLocationDisplay(recurringMeeting)}
                  </Typography>
                </Stack>
              </Box>
              
              <Divider />
              
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Progress
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Generation Progress</Typography>
                    <Typography variant="body2" fontWeight={600} color="primary">
                      {completionRate}%
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    height: 10, 
                    bgcolor: alpha(COLORS.primary, 0.1), 
                    borderRadius: 5,
                    overflow: 'hidden'
                  }}>
                    <Box sx={{ 
                      width: `${completionRate}%`,
                      height: '100%',
                      bgcolor: completionRate === 100 ? COLORS.success : COLORS.primary,
                      borderRadius: 5,
                      transition: 'width 0.3s ease'
                    }} />
                  </Box>
                </Box>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Right Column - Occurrences List */}
        <Grid item xs={12} md={7} lg={8}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
              <Typography variant="h6" fontWeight={700} sx={{ color: COLORS.primary }}>
                Generated Occurrences
                <Badge badgeContent={totalFilteredCount} color="primary" sx={{ ml: 1 }} showZero>
                  <Chip label={`of ${totalGenerated}`} size="small" sx={{ fontWeight: 600, visibility: 'hidden' }} />
                </Badge>
              </Typography>
              
              <Stack direction="row" spacing={1}>
                <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
                  <ToggleButton value="table" aria-label="table view">
                    <ViewListIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="card" aria-label="card view">
                    <ViewModuleIcon fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>
                
                <Tooltip title="Refresh">
                  <IconButton onClick={() => fetchOccurrences()} size="small">
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Search and Filters */}
            <Stack direction={isMobile ? 'column' : 'row'} spacing={2} sx={{ mb: 3 }}>
              <TextField
                placeholder="Search by title, date, or location..."
                value={searchTerm}
                onChange={handleSearchChange}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={clearSearch}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={{ flex: 2 }}
              />
              
              <Stack direction="row" spacing={1}>
                <ButtonGroup variant="outlined" size="small">
                  <Button
                    onClick={() => handleFilterStatusChange('all')}
                    variant={filterStatus === 'all' ? 'contained' : 'outlined'}
                    sx={{ textTransform: 'none' }}
                  >
                    All
                  </Button>
                  <Button
                    onClick={() => handleFilterStatusChange('upcoming')}
                    variant={filterStatus === 'upcoming' ? 'contained' : 'outlined'}
                    sx={{ textTransform: 'none' }}
                  >
                    Upcoming
                  </Button>
                  <Button
                    onClick={() => handleFilterStatusChange('past')}
                    variant={filterStatus === 'past' ? 'contained' : 'outlined'}
                    sx={{ textTransform: 'none' }}
                  >
                    Past
                  </Button>
                </ButtonGroup>
                
                <Tooltip title={`Sort ${sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}`}>
                  <IconButton onClick={toggleSortOrder} size="small">
                    <FilterListIcon sx={{ transform: sortOrder === 'asc' ? 'rotate(0deg)' : 'rotate(180deg)' }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
            
            {occurrences.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <EventNoteIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No occurrences generated yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Generate the first occurrence to start the series
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleGenerateNext}
                  disabled={generating}
                  size="large"
                >
                  {generating ? <CircularProgress size={24} /> : 'Generate First Occurrence'}
                </Button>
              </Box>
            ) : filteredAndSortedOccurrences.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No matching occurrences found
                </Typography>
                <Button onClick={clearSearch} sx={{ mt: 2 }}>
                  Clear Search
                </Button>
              </Box>
            ) : (
              <>
                {viewMode === 'table' && (
                  <>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size={isMobile ? 'small' : 'medium'}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: alpha(COLORS.primary, 0.05) }}>
                            <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                            {!isTablet && <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>}
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            {!isMobile && <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>}
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedOccurrences.map((occurrence, index) => {
                            const globalIndex = (page - 1) * rowsPerPage + index;
                            const isPast = new Date(occurrence.scheduled_date) < new Date();
                            return (
                              <TableRow 
                                key={occurrence.id} 
                                hover
                                sx={{ 
                                  opacity: isPast ? 0.7 : 1,
                                  backgroundColor: isPast ? alpha('#000', 0.05) : 'transparent'
                                }}
                              >
                                <TableCell>
                                  <Typography variant="body2" fontWeight={600} color="text.secondary">
                                    {globalIndex + 1}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight={600}>
                                    {formatDate(occurrence.scheduled_date)}
                                  </Typography>
                                </TableCell>
                                {!isTablet && (
                                  <TableCell>
                                    <Typography variant="body2">
                                      {formatTime(occurrence.start_time)}
                                    </Typography>
                                  </TableCell>
                                )}
                                <TableCell>
                                  <Chip 
                                    label={occurrence.status || 'Scheduled'}
                                    size="small"
                                    sx={{ 
                                      bgcolor: alpha(COLORS.info, 0.1),
                                      color: COLORS.info,
                                      fontWeight: 500
                                    }}
                                  />
                                </TableCell>
                                {!isMobile && (
                                  <TableCell>
                                    <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                                      {occurrence.location_text || recurringMeeting.location_text || 'Online'}
                                    </Typography>
                                  </TableCell>
                                )}
                                <TableCell align="right">
                                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                    <Tooltip title="View Meeting">
                                      <IconButton size="small" onClick={() => navigate(`/meetings/${occurrence.id}`)}>
                                        <EventNoteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Edit Meeting">
                                      <IconButton size="small" onClick={() => navigate(`/meetings/${occurrence.id}/edit`)}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Stack>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    
                    {totalFilteredCount > rowsPerPage && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Pagination
                          count={Math.ceil(totalFilteredCount / rowsPerPage)}
                          page={page}
                          onChange={handlePageChange}
                          color="primary"
                          size={isMobile ? 'small' : 'medium'}
                          showFirstButton
                          showLastButton
                        />
                      </Box>
                    )}
                  </>
                )}

                {viewMode === 'card' && (
                  <Box sx={{ maxHeight: '600px', overflowY: 'auto', pr: 1 }}>
                    {filteredAndSortedOccurrences.map((occurrence, index) => 
                      renderOccurrenceCard(occurrence, index)
                    )}
                    
                    {hasMore && filteredAndSortedOccurrences.length < totalFilteredCount && (
                      <Box ref={loadMoreRef} sx={{ textAlign: 'center', py: 3 }}>
                        {loadingMore ? <Loader size={32} /> : <Typography variant="body2" color="text.secondary">Scroll for more...</Typography>}
                      </Box>
                    )}
                    
                    {hasMore && !loadingMore && filteredAndSortedOccurrences.length < totalFilteredCount && (
                      <Box sx={{ textAlign: 'center', mt: 2 }}>
                        <Button variant="outlined" onClick={loadMoreOccurrences} size="small">
                          Load More ({filteredAndSortedOccurrences.length} of {totalFilteredCount})
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
              </>
            )}
            
            {occurrences.length > 0 && occurrences.length < totalGenerated && (
              <Box sx={{ mt: 3 }}>
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2">
                    <strong>{totalGenerated - occurrences.length}</strong> occurrences remaining to be generated
                  </Typography>
                </Alert>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Speed Dial */}
      <Fade in={trigger}>
        <SpeedDial
          ariaLabel="Quick Actions"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon />}
          onClose={handleSpeedDialClose}
          onOpen={handleSpeedDialOpen}
          open={speedDialOpen}
        >
          <SpeedDialAction icon={<AddIcon />} tooltipTitle="Generate Next" onClick={handleGenerateNext} tooltipOpen />
          <SpeedDialAction icon={<CalendarTodayIcon />} tooltipTitle="Generate 5" onClick={() => handleGenerateMultiple(5)} tooltipOpen />
          <SpeedDialAction icon={<DownloadIcon />} tooltipTitle="Export" onClick={handleExport} tooltipOpen />
          <SpeedDialAction icon={<EditIcon />} tooltipTitle="Edit" onClick={() => navigate(`/recurring-meetings/${id}/edit`)} tooltipOpen />
          <SpeedDialAction icon={<DeleteIcon />} tooltipTitle="Delete" onClick={() => setDeleteDialogOpen(true)} tooltipOpen />
        </SpeedDial>
      </Fade>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Recurring Meeting Series?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>"{recurringMeeting.title}"</strong>? 
            This will also delete all <strong>{occurrences.length}</strong> generated occurrences.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Series'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RecurringMeetingDetail;