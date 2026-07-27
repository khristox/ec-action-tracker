// src/components/actiontracker/meetings/RecurringMeetingDetail.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Stack, Chip, IconButton,
  Grid, Divider, CircularProgress, Alert, Snackbar,
  Tooltip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, useTheme, useMediaQuery, alpha, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Menu, MenuItem, ListItemIcon, Card, CardContent,
  ButtonGroup, SpeedDial, SpeedDialAction, SpeedDialIcon,
  useScrollTrigger, Fade, TextField, InputAdornment, ToggleButton, ToggleButtonGroup,
  Avatar, Pagination, LinearProgress, Tabs, Tab, Collapse,
  Container,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon,
  Repeat as RepeatIcon, EventNote as EventNoteIcon, Today as TodayIcon,
  Schedule as ScheduleIcon, LocationOn as LocationIcon, Refresh as RefreshIcon,
  MoreVert as MoreVertIcon, Download as DownloadIcon, CalendarToday as CalendarTodayIcon,
  CheckCircle as CheckCircleIcon, Warning as WarningIcon, Business as BusinessIcon,
  MeetingRoom as MeetingRoomIcon, Videocam as VideocamIcon, ContentCopy as ContentCopyIcon,
  Search as SearchIcon, Clear as ClearIcon, ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon, FilterList as FilterListIcon, CalendarMonth as CalendarMonthIcon,
  Timeline as TimelineIcon, Check as CheckIcon,
  Close as CloseIcon, Circle as CircleIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import api from '../../../services/api';
import { COLORS } from './styles/colors';
import { formatDate, formatTime, getRecurrenceDescription } from './utils/helpers';

// Mini stat pill component - compact for mobile
const TopStatPill = ({ label, value, icon, color }) => (
  <Stack 
    direction="row" 
    alignItems="center" 
    spacing={1} 
    sx={{ 
      px: 1.5, 
      py: 0.8, 
      borderRadius: 2, 
      bgcolor: alpha(color, 0.08),
      border: '1px solid',
      borderColor: alpha(color, 0.15),
      flex: '1 1 auto',
      minWidth: { xs: 'calc(50% - 4px)', sm: 'auto' },
      maxWidth: { xs: 'calc(50% - 4px)', sm: 'none' },
    }}
  >
    <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography 
        variant="caption" 
        color="text.secondary" 
        fontWeight={600} 
        display="block" 
        sx={{ 
          lineHeight: 1, 
          fontSize: { xs: '0.55rem', sm: '0.6rem' }, 
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Typography>
      <Typography 
        variant="body2" 
        fontWeight={800} 
        sx={{ 
          color: 'text.primary', 
          lineHeight: 1.2, 
          fontSize: { xs: '0.75rem', sm: '0.85rem' },
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </Typography>
    </Box>
  </Stack>
);

const RecurringMeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const isInitialBootRef = useRef(true);

  // Core data states
  const [recurringMeeting, setRecurringMeeting] = useState(null);
  const [occurrences, setOccurrences] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationDetails, setLocationDetails] = useState(null);

  // Main Tab Navigation state ('details' vs 'occurrences')
  const [activeTab, setActiveTab] = useState('details');

  // Stats visibility state for mobile view
  const [statsExpanded, setStatsExpanded] = useState(true);

  // Actions states
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Pagination & filter states
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('table');

  const trigger = useScrollTrigger({ threshold: 100 });

  // Derived metrics
  const totalGenerated = recurringMeeting?.total_occurrences_generated || 0;
  const upcomingCount = useMemo(
    () => occurrences.filter(o => new Date(o.scheduled_date) > new Date()).length,
    [occurrences]
  );
  const pastCount = useMemo(
    () => occurrences.filter(o => new Date(o.scheduled_date) <= new Date()).length,
    [occurrences]
  );
  const completionRate = useMemo(
    () => (totalGenerated > 0 ? Math.round((totalCount / totalGenerated) * 100) : 0),
    [totalCount, totalGenerated]
  );
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  const mostRecentOccurrence = useMemo(() => {
    if (!occurrences || occurrences.length === 0) return null;
    const sorted = [...occurrences].sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));
    return sorted[0];
  }, [occurrences]);

  const getLocationIcon = useCallback((locationText) => {
    if (!locationText) return <LocationIcon sx={{ fontSize: 18, color: COLORS.danger }} />;
    const t = locationText.toLowerCase();
    if (t.includes('zoom') || t.includes('meet') || t.includes('teams') || t.includes('online'))
      return <VideocamIcon sx={{ fontSize: 18, color: COLORS.info }} />;
    if (t.includes('room') || t.includes('conference'))
      return <MeetingRoomIcon sx={{ fontSize: 18, color: COLORS.warning }} />;
    return <BusinessIcon sx={{ fontSize: 18, color: COLORS.danger }} />;
  }, []);

  const getLocationDisplay = useCallback((meeting) => {
    if (meeting?.location_text) return meeting.location_text;
    if (meeting?.location_name) return meeting.location_name;
    if (locationDetails?.name) {
      return [locationDetails.name, locationDetails.city, locationDetails.country]
        .filter(Boolean).join(', ');
    }
    return 'Online meeting';
  }, [locationDetails]);

  const fetchOccurrences = useCallback(async (opts = {}) => {
    const currentPage   = opts.page        ?? page;
    const currentLimit  = opts.rowsPerPage ?? rowsPerPage;
    const currentSearch = opts.searchTerm  ?? searchTerm;
    const currentFilter = opts.filterStatus ?? filterStatus;
    const currentSort   = opts.sortOrder   ?? sortOrder;

    setOccurrencesLoading(true);
    try {
      const params = { page: currentPage, limit: currentLimit, sort_order: currentSort };
      if (currentSearch)           params.search        = currentSearch;
      if (currentFilter !== 'all') params.status_filter = currentFilter;

      const response = await api.get(`/recurring-meetings/${id}/occurrences`, { params });
      const data  = response.data?.data  || response.data  || [];
      const total = response.data?.total ?? (Array.isArray(data) ? data.length : 0);

      setOccurrences(Array.isArray(data) ? data : []);
      setTotalCount(total);
    } catch (err) {
      console.error('Failed to fetch occurrences:', err);
      setOccurrences([]);
      setTotalCount(0);
    } finally {
      setOccurrencesLoading(false);
    }
  }, [id, page, rowsPerPage, searchTerm, filterStatus, sortOrder]);

  const fetchRecurringMeetingDetails = useCallback(async () => {
    try {
      const response = await api.get(`/recurring-meetings/${id}`);
      const data = response.data?.data || response.data;
      setRecurringMeeting(data);
      if (data?.location_id) {
        try {
          const locRes = await api.get(`/locations/${data.location_id}`);
          setLocationDetails(locRes.data?.data || locRes.data);
        } catch { /* Suppress non-critical faults */ }
      }
      setError(null);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load recurring meeting';
      setError(msg);
      setSnackbar({ open: true, message: msg, severity: 'error' });
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const bootstrapWorkspace = async () => {
      setLoading(true);
      await fetchRecurringMeetingDetails();
      await fetchOccurrences({ page: 1, rowsPerPage, searchTerm, filterStatus, sortOrder });
      setLoading(false);
      isInitialBootRef.current = false;
    };
    bootstrapWorkspace();
  }, [id]);

  useEffect(() => {
    if (loading || isInitialBootRef.current) return;
    fetchOccurrences();
  }, [page, rowsPerPage, filterStatus, sortOrder]);

  useEffect(() => {
    if (loading || isInitialBootRef.current) return;
    const delayTimer = setTimeout(() => {
      setPage(1);
      fetchOccurrences({ page: 1, searchTerm });
    }, 400);
    return () => clearTimeout(delayTimer);
  }, [searchTerm]);

  const handlePageChange = (_, newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchChange = (e) => setSearchTerm(e.target.value);
  const clearSearch = () => { setSearchTerm(''); setPage(1); };
  const handleFilterStatusChange = (s) => { setFilterStatus(s); setPage(1); };
  const toggleSortOrder = () => { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setPage(1); };
  const handleViewModeChange = (_, newMode) => { if (newMode !== null) setViewMode(newMode); };
  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));

  const handleGenerateNext = useCallback(async () => {
    setGenerating(true);
    try {
      const response = await api.post(`/recurring-meetings/${id}/generate-on-demand`);
      await Promise.all([fetchRecurringMeetingDetails(), fetchOccurrences({ page: 1 })]);
      setPage(1);
      setSnackbar({ open: true, message: response.data?.message || 'Generated next occurrence!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to generate', severity: 'error' });
    } finally {
      setGenerating(false);
    }
  }, [id, fetchRecurringMeetingDetails, fetchOccurrences]);

  const handleGenerateMultiple = useCallback(async (count = 5) => {
    setGenerating(true);
    try {
      for (let i = 0; i < count; i++) {
        await api.post(`/recurring-meetings/${id}/generate-on-demand`);
      }
      await Promise.all([fetchRecurringMeetingDetails(), fetchOccurrences({ page: 1 })]);
      setPage(1);
      setSnackbar({ open: true, message: `Generated ${count} occurrences!`, severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to generate', severity: 'error' });
    } finally {
      setGenerating(false);
    }
  }, [id, fetchRecurringMeetingDetails, fetchOccurrences]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await api.delete(`/recurring-meetings/${id}/?delete_occurrences=true`);
      setSnackbar({ open: true, message: 'Recurring meeting deleted', severity: 'success' });
      setTimeout(() => navigate('/meetings'), 1500);
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to delete', severity: 'error' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [id, navigate]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const exportData = {
        meeting: recurringMeeting, occurrences, location: locationDetails,
        statistics: { totalGenerated, upcomingCount, pastCount, totalCount, completionRate },
        exportDate: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `recurring_meeting_${recurringMeeting?.title || id}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'Exported successfully', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to export', severity: 'error' });
    } finally {
      setExporting(false);
      handleMenuClose();
    }
  }, [recurringMeeting, occurrences, locationDetails, id, totalGenerated, upcomingCount, pastCount, totalCount, completionRate]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setSnackbar({ open: true, message: 'Link copied!', severity: 'success' });
    handleMenuClose();
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: isMobile ? 2 : 4, maxWidth: 1600, mx: 'auto' }}>
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rectangular" height={500} sx={{ borderRadius: 3 }} />
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, maxWidth: 1600, mx: 'auto' }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchRecurringMeetingDetails}>Retry</Button>} sx={{ mb: 2 }}>{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/meetings')} variant="outlined">Back to Meetings</Button>
      </Box>
    );
  }

  if (!recurringMeeting) {
    return (
      <Box sx={{ p: 4, maxWidth: 1600, mx: 'auto' }}><Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => navigate('/meetings')}>Go to Meetings</Button>}>Recurring meeting not found</Alert></Box>
    );
  }

  return (
    <Box sx={{ 
      p: isMobile ? 1 : 2, 
      maxWidth: 1600, 
      mx: 'auto', 
      pb: 10,
      width: '100%',
      overflowX: 'hidden',
    }}>
      {/* Unified Top Row Header & Stats Bar */}
      <Paper elevation={0} sx={{ 
        p: isMobile ? 1.5 : 2.5, 
        borderRadius: 3, 
        mb: 3,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.primary.main, 0.01)} 100%)`,
        border: '1px solid',
        borderColor: 'divider',
        width: '100%',
      }}>
        <Stack spacing={1.5}>
          {/* Top Line: Back Button, Title, Chips & Mobile Menu Trigger */}
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <IconButton 
                onClick={() => navigate('/meetings')} 
                size={isMobile ? 'small' : 'medium'}
                sx={{ 
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                  flexShrink: 0,
                  p: isMobile ? 0.8 : 1,
                  '&:hover': { bgcolor: 'background.paper', boxShadow: 2 }
                }}
              >
                <ArrowBackIcon fontSize={isMobile ? 'small' : 'medium'} />
              </IconButton>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography 
                  variant={isMobile ? 'subtitle1' : 'h5'} 
                  fontWeight={800} 
                  noWrap
                  sx={{ fontSize: isMobile ? '0.95rem' : '1.5rem' }}
                >
                  {recurringMeeting.title}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                  <Chip 
                    label="Recurring" 
                    size="small" 
                    icon={<RepeatIcon sx={{ fontSize: 11 }} />} 
                    sx={{ 
                      bgcolor: alpha(COLORS.recurring, 0.1), 
                      color: COLORS.recurring, 
                      fontWeight: 600,
                      borderRadius: 1.5,
                      height: 20,
                      fontSize: '0.6rem',
                      '& .MuiChip-label': { px: 0.8 },
                    }} 
                  />
                  <Chip 
                    label={recurringMeeting.status === 'active' ? 'Active' : 'Inactive'} 
                    size="small" 
                    icon={recurringMeeting.status === 'active' ? <CheckCircleIcon sx={{ fontSize: 11 }} /> : <WarningIcon sx={{ fontSize: 11 }} />} 
                    sx={{ 
                      bgcolor: recurringMeeting.status === 'active' ? alpha(COLORS.success, 0.1) : alpha(COLORS.warning, 0.1), 
                      color: recurringMeeting.status === 'active' ? COLORS.success : COLORS.warning, 
                      fontWeight: 600,
                      borderRadius: 1.5,
                      height: 20,
                      fontSize: '0.6rem',
                      '& .MuiChip-label': { px: 0.8 },
                    }} 
                  />
                  {!isMobile && (
                    <>
                      <Chip 
                        label={`${totalGenerated} generated`} 
                        size="small" 
                        variant="outlined" 
                        sx={{ 
                          borderRadius: 1.5,
                          height: 20,
                          fontSize: '0.6rem',
                          '& .MuiChip-label': { px: 0.8 },
                        }} 
                      />
                      <Chip 
                        label={`${totalCount} total`} 
                        size="small" 
                        variant="outlined" 
                        color="info" 
                        sx={{ 
                          borderRadius: 1.5,
                          height: 20,
                          fontSize: '0.6rem',
                          '& .MuiChip-label': { px: 0.8 },
                        }} 
                      />
                    </>
                  )}
                </Stack>
              </Box>
            </Stack>

            {/* Desktop Action Buttons */}
            {!isMobile ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                <ButtonGroup 
                  variant="contained" 
                  size="small" 
                  sx={{ 
                    boxShadow: 'none', 
                    borderRadius: 2, 
                    overflow: 'hidden',
                    bgcolor: 'primary.main',
                    '& .MuiButton-root': {
                      borderColor: 'primary.dark',
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      px: 1.5,
                      py: 0.5,
                    }
                  }}
                >
                  <Button 
                    onClick={handleGenerateNext} 
                    disabled={generating} 
                    startIcon={generating ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
                  >
                    Generate
                  </Button>
                  <Button onClick={() => handleGenerateMultiple(5)} disabled={generating} sx={{ minWidth: 32, px: 1 }}>5</Button>
                  <Button onClick={() => handleGenerateMultiple(10)} disabled={generating} sx={{ minWidth: 32, px: 1 }}>10</Button>
                </ButtonGroup>

                <IconButton onClick={handleExport} size="small" disabled={exporting} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.8 }}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
                <IconButton onClick={() => navigate(`/recurring-meetings/${id}/edit`)} size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.8 }}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton onClick={() => setDeleteDialogOpen(true)} size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.8, color: COLORS.danger }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ) : (
              <IconButton onClick={handleMenuOpen} size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 0.8 }}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>

          {/* Stat Pills Section - Responsive grid for mobile */}
          {isMobile ? (
            <Box sx={{ pt: 0.5, width: '100%' }}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={() => setStatsExpanded(prev => !prev)}
                startIcon={<BarChartIcon fontSize="small" />}
                endIcon={statsExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                sx={{
                  textTransform: 'none',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  fontWeight: 600,
                  borderRadius: 2,
                  justifyContent: 'space-between',
                  px: 2,
                  py: 0.8,
                  fontSize: '0.75rem',
                }}
              >
                {statsExpanded ? 'Hide Statistics' : `View Statistics (${totalGenerated} Generated)`}
              </Button>
              <Collapse in={statsExpanded}>
                <Box sx={{ pt: 1.5 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    <TopStatPill label="Generated" value={`${totalGenerated} (${completionRate}%)`} icon={<RepeatIcon sx={{ fontSize: 13 }} />} color={COLORS.primary} />
                    <TopStatPill label="Occurrences" value={totalCount} icon={<EventNoteIcon sx={{ fontSize: 13 }} />} color={COLORS.success} />
                    <TopStatPill label="Upcoming" value={upcomingCount} icon={<CalendarTodayIcon sx={{ fontSize: 13 }} />} color={COLORS.info} />
                    <TopStatPill label="Past" value={pastCount} icon={<TimelineIcon sx={{ fontSize: 13 }} />} color={COLORS.warning} />
                  </Box>
                </Box>
              </Collapse>
            </Box>
          ) : (
            <Box sx={{ pt: 0.5 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                <TopStatPill label="Generated" value={`${totalGenerated} (${completionRate}%)`} icon={<RepeatIcon sx={{ fontSize: 13 }} />} color={COLORS.primary} />
                <TopStatPill label="Occurrences" value={totalCount} icon={<EventNoteIcon sx={{ fontSize: 13 }} />} color={COLORS.success} />
                <TopStatPill label="Upcoming" value={upcomingCount} icon={<CalendarTodayIcon sx={{ fontSize: 13 }} />} color={COLORS.info} />
                <TopStatPill label="Past" value={pastCount} icon={<TimelineIcon sx={{ fontSize: 13 }} />} color={COLORS.warning} />
              </Box>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Mobile Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 180, mt: 1 } }}
      >
        <MenuItem onClick={() => { handleMenuClose(); handleGenerateNext(); }}>
          <ListItemIcon><AddIcon fontSize="small" color="primary" /></ListItemIcon>
          Generate Next
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); handleGenerateMultiple(5); }}>
          <ListItemIcon><CalendarTodayIcon fontSize="small" color="primary" /></ListItemIcon>
          Generate 5
        </MenuItem>
        <MenuItem onClick={handleExport}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          Export Data
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); navigate(`/recurring-meetings/${id}/edit`); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          Edit Series
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { handleMenuClose(); setDeleteDialogOpen(true); }} sx={{ color: COLORS.danger }}>
          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: COLORS.danger }} /></ListItemIcon>
          Delete Series
        </MenuItem>
      </Menu>

      {/* Main Content Tabs Container */}
      <Paper elevation={0} sx={{ 
        borderRadius: 3, 
        border: '1px solid', 
        borderColor: 'divider', 
        overflow: 'hidden',
        width: '100%',
      }}>
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider', 
          px: isMobile ? 1 : 3, 
          pt: 0.5, 
          bgcolor: alpha(theme.palette.background.default, 0.5),
          overflowX: 'auto',
        }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, val) => setActiveTab(val)}
            variant={isMobile ? 'fullWidth' : 'standard'}
            sx={{ 
              '& .MuiTab-root': { 
                textTransform: 'none', 
                fontWeight: 600, 
                fontSize: isMobile ? '0.75rem' : '0.95rem', 
                minHeight: isMobile ? 40 : 48,
                minWidth: isMobile ? 'auto' : undefined,
                px: isMobile ? 1.5 : 3,
              },
              '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
            }}
          >
            <Tab 
              label="Details" 
              value="details" 
              icon={<RepeatIcon fontSize={isMobile ? 'small' : 'medium'} />} 
              iconPosition="start" 
            />
            <Tab 
              label={`History (${totalCount})`} 
              value="occurrences" 
              icon={<EventNoteIcon fontSize={isMobile ? 'small' : 'medium'} />} 
              iconPosition="start" 
            />
          </Tabs>
        </Box>

        {/* TAB 1: Series Details & Metrics Overview Screen */}
        {activeTab === 'details' && (
          <Box sx={{ p: isMobile ? 1.5 : 4 }}>
            <Grid container spacing={isMobile ? 2 : 4}>
              {/* Core Information & Schedule */}
              <Grid item xs={12} lg={6}>
                <Stack spacing={isMobile ? 2 : 3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                      Description
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5, color: 'text.primary', fontSize: isMobile ? '0.9rem' : '1rem' }}>
                      {recurringMeeting.description || 'No description provided'}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                      Recurrence Pattern
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip 
                        label={getRecurrenceDescription(recurringMeeting)} 
                        icon={<RepeatIcon sx={{ fontSize: 14 }} />}
                        sx={{ 
                          bgcolor: alpha(COLORS.recurring, 0.08), 
                          fontWeight: 500, 
                          borderRadius: 2, 
                          height: isMobile ? 28 : 32,
                          fontSize: isMobile ? '0.75rem' : '0.875rem',
                          '& .MuiChip-label': { px: 1.5 },
                        }} 
                      />
                    </Box>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" sx={{ mb: 1.5, display: 'block', fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                      Time & Location Setup
                    </Typography>
                    <Stack spacing={1.5}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <ScheduleIcon sx={{ fontSize: isMobile ? 18 : 20, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ fontSize: isMobile ? '0.85rem' : '0.875rem' }}>
                          {recurringMeeting.start_time ? `${formatTime(recurringMeeting.start_time)} – ${formatTime(recurringMeeting.end_time)}` : 'Time not set'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {getLocationIcon(recurringMeeting.location_text)}
                        <Typography variant="body2" sx={{ fontSize: isMobile ? '0.85rem' : '0.875rem' }}>
                          {getLocationDisplay(recurringMeeting)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                      Generation Progress
                    </Typography>
                    <Box sx={{ mt: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
                          {totalCount} of {totalGenerated} generated
                        </Typography>
                        <Typography variant="body2" fontWeight={600} color="primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
                          {completionRate}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={completionRate} 
                        sx={{ 
                          height: isMobile ? 6 : 8, 
                          borderRadius: 4, 
                          bgcolor: alpha(COLORS.primary, 0.1),
                          '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: completionRate === 100 ? COLORS.success : COLORS.primary }
                        }} 
                      />
                    </Box>
                  </Box>

                  {/* Mobile Generate Button */}
                  {isMobile && (
                    <Button 
                      fullWidth 
                      variant="contained" 
                      startIcon={<AddIcon />}
                      onClick={handleGenerateNext}
                      disabled={generating}
                      sx={{ 
                        borderRadius: 2, 
                        textTransform: 'none', 
                        fontWeight: 600, 
                        py: 1.2,
                        mt: 1,
                      }}
                    >
                      {generating ? <CircularProgress size={20} /> : 'Generate Next Occurrence'}
                    </Button>
                  )}
                </Stack>
              </Grid>

              {/* Next and Most Recent Occurrences */}
              <Grid item xs={12} lg={6}>
                <Stack spacing={isMobile ? 2 : 3}>
                  <Card variant="outlined" sx={{ borderRadius: 3, p: isMobile ? 2 : 2.5, bgcolor: alpha(COLORS.info, 0.02) }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                      Next Scheduled Occurrence
                    </Typography>
                    <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: alpha(COLORS.info, 0.1), color: COLORS.info, width: isMobile ? 36 : 44, height: isMobile ? 36 : 44 }}>
                        <CalendarTodayIcon sx={{ fontSize: isMobile ? 18 : 24 }} />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: isMobile ? '0.9rem' : '1rem' }}>
                          {recurringMeeting.next_occurrence_date ? formatDate(recurringMeeting.next_occurrence_date) : 'Not scheduled'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                          {recurringMeeting.next_occurrence_date ? 'Upcoming active session' : 'Generate an occurrence to schedule'}
                        </Typography>
                      </Box>
                    </Box>
                  </Card>

                  <Card variant="outlined" sx={{ borderRadius: 3, p: isMobile ? 2 : 2.5, bgcolor: alpha(COLORS.success, 0.02) }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                      Most Recent Occurrence
                    </Typography>
                    {mostRecentOccurrence ? (
                      <Box 
                        sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        onClick={() => navigate(`/meetings/${mostRecentOccurrence.id}`)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                          <Avatar sx={{ bgcolor: alpha(COLORS.success, 0.1), color: COLORS.success, width: isMobile ? 36 : 44, height: isMobile ? 36 : 44 }}>
                            <CheckCircleIcon sx={{ fontSize: isMobile ? 18 : 24 }} />
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: isMobile ? '0.9rem' : '1rem' }}>
                              {formatDate(mostRecentOccurrence.scheduled_date)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem', display: 'block' }}>
                              Status: {mostRecentOccurrence.status || 'Completed/Scheduled'}
                            </Typography>
                          </Box>
                        </Box>
                        <Button size="small" variant="text" sx={{ textTransform: 'none', fontSize: isMobile ? '0.7rem' : '0.875rem' }}>
                          View →
                        </Button>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: isMobile ? '0.85rem' : '0.875rem' }}>
                        No generated occurrences found yet.
                      </Typography>
                    )}
                  </Card>

                  {/* Desktop Generate Button */}
                  {!isMobile && (
                    <Box sx={{ pt: 2 }}>
                      <Button 
                        fullWidth 
                        variant="contained" 
                        startIcon={<AddIcon />}
                        onClick={handleGenerateNext}
                        disabled={generating}
                        sx={{ 
                          borderRadius: 2, 
                          textTransform: 'none', 
                          fontWeight: 600, 
                          py: 1.2,
                          fontSize: '0.875rem',
                        }}
                      >
                        {generating ? <CircularProgress size={20} /> : 'Generate Next Occurrence'}
                      </Button>
                    </Box>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* TAB 2: Occurrences History */}
        {activeTab === 'occurrences' && (
          <Box sx={{ p: isMobile ? 1.5 : 4 }}>
            <Box sx={{ mb: 3 }}>
              <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 1.5 : 2}>
                <TextField
                  placeholder="Search occurrences..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  size="small"
                  fullWidth
                  sx={{ flex: 2 }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment>,
                    endAdornment: searchTerm ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={clearSearch}><ClearIcon fontSize="small" /></IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
                <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, flexWrap: 'wrap', gap: 0.5 }}>
                  <ButtonGroup variant="outlined" size="small" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
                    {['all', 'upcoming', 'past'].map(s => (
                      <Button 
                        key={s} 
                        onClick={() => handleFilterStatusChange(s)} 
                        variant={filterStatus === s ? 'contained' : 'outlined'}
                        sx={{ 
                          textTransform: 'none', 
                          fontWeight: filterStatus === s ? 600 : 400, 
                          px: isMobile ? 1 : 2, 
                          fontSize: isMobile ? '0.7rem' : '0.8rem',
                          py: isMobile ? 0.3 : 0.5,
                        }}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Button>
                    ))}
                  </ButtonGroup>
                  <IconButton onClick={toggleSortOrder} size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: isMobile ? 0.5 : 0.8 }}>
                    <FilterListIcon fontSize="small" sx={{ transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </IconButton>
                  <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small" sx={{ '& .MuiToggleButton-root': { border: '1px solid', borderColor: 'divider', px: isMobile ? 0.5 : 1, borderRadius: '8px !important', ml: 0.5, py: isMobile ? 0.3 : 0.5 } }}>
                    <ToggleButton value="table"><Tooltip title="Table View"><ViewListIcon fontSize="small" /></Tooltip></ToggleButton>
                    <ToggleButton value="card"><Tooltip title="Card View"><ViewModuleIcon fontSize="small" /></Tooltip></ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              </Stack>
            </Box>

            {occurrencesLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={40} /></Box>
            )}

            {!occurrencesLoading && occurrences.length === 0 && totalCount === 0 && !searchTerm && filterStatus === 'all' && (
              <Box sx={{ textAlign: 'center', py: isMobile ? 4 : 8 }}>
                <Avatar sx={{ width: isMobile ? 60 : 80, height: isMobile ? 60 : 80, bgcolor: alpha(COLORS.primary, 0.08), color: COLORS.primary, mx: 'auto', mb: 2 }}>
                  <EventNoteIcon sx={{ fontSize: isMobile ? 30 : 40 }} />
                </Avatar>
                <Typography variant="h6" gutterBottom sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>No occurrences generated yet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: isMobile ? '0.85rem' : '0.875rem' }}>
                  Generate your first occurrence to start tracking this recurring meeting
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleGenerateNext} disabled={generating} size="large" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                  {generating ? <CircularProgress size={24} /> : 'Generate First Occurrence'}
                </Button>
              </Box>
            )}

            {!occurrencesLoading && occurrences.length === 0 && (searchTerm || filterStatus !== 'all') && (
              <Box sx={{ textAlign: 'center', py: isMobile ? 4 : 6 }}>
                <SearchIcon sx={{ fontSize: isMobile ? 48 : 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>No matching occurrences</Typography>
                <Button onClick={() => { clearSearch(); setFilterStatus('all'); }} sx={{ mt: 2, fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
                  Clear Filters
                </Button>
              </Box>
            )}

            {!occurrencesLoading && occurrences.length > 0 && (
              <>
                {viewMode === 'table' ? (
                  <>
                    <TableContainer sx={{ overflowX: 'auto', width: '100%' }}>
                      <Table size={isMobile ? 'small' : 'medium'}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: isMobile ? '0.7rem' : '0.875rem' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: isMobile ? '0.7rem' : '0.875rem' }}>Date</TableCell>
                            {!isTablet && <TableCell sx={{ fontWeight: 700, fontSize: isMobile ? '0.7rem' : '0.875rem' }}>Time</TableCell>}
                            <TableCell sx={{ fontWeight: 700, fontSize: isMobile ? '0.7rem' : '0.875rem' }}>Status</TableCell>
                            {!isMobile && <TableCell sx={{ fontWeight: 700, fontSize: isMobile ? '0.7rem' : '0.875rem' }}>Location</TableCell>}
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: isMobile ? '0.7rem' : '0.875rem' }}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {occurrences.map((occurrence, index) => {
                            const globalIndex = (page - 1) * rowsPerPage + index;
                            const isPast = new Date(occurrence.scheduled_date) < new Date();
                            return (
                              <TableRow 
                                key={occurrence.id} 
                                hover 
                                sx={{ 
                                  opacity: isPast ? 0.6 : 1, 
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                                }}
                                onClick={() => navigate(`/meetings/${occurrence.id}`)}
                              >
                                <TableCell>
                                  <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}>
                                    {globalIndex + 1}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Stack direction="row" alignItems="center" spacing={0.5}>
                                    {isPast ? 
                                      <CheckCircleIcon sx={{ fontSize: isMobile ? 14 : 16, color: COLORS.success }} /> : 
                                      <CircleIcon sx={{ fontSize: isMobile ? 14 : 16, color: COLORS.info }} />
                                    }
                                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}>
                                      {formatDate(occurrence.scheduled_date)}
                                    </Typography>
                                  </Stack>
                                </TableCell>
                                {!isTablet && (
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}>
                                      {formatTime(occurrence.start_time)}
                                    </Typography>
                                  </TableCell>
                                )}
                                <TableCell>
                                  <Chip 
                                    label={occurrence.status || 'Scheduled'} 
                                    size="small" 
                                    sx={{ 
                                      bgcolor: alpha(COLORS.info, 0.08), 
                                      color: COLORS.info, 
                                      fontWeight: 500, 
                                      borderRadius: 1.5,
                                      height: isMobile ? 20 : 24,
                                      fontSize: isMobile ? '0.6rem' : '0.75rem',
                                      '& .MuiChip-label': { px: isMobile ? 0.8 : 1 },
                                    }} 
                                  />
                                </TableCell>
                                {!isMobile && (
                                  <TableCell>
                                    <Typography variant="body2" noWrap sx={{ maxWidth: 120, fontSize: isMobile ? '0.7rem' : '0.875rem' }}>
                                      {occurrence.location_text || recurringMeeting.location_text || 'Online'}
                                    </Typography>
                                  </TableCell>
                                )}
                                <TableCell align="right">
                                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                                    <IconButton 
                                      size="small" 
                                      onClick={(e) => { e.stopPropagation(); navigate(`/meetings/${occurrence.id}`); }}
                                      sx={{ p: isMobile ? 0.5 : 0.8 }}
                                    >
                                      <EventNoteIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton 
                                      size="small" 
                                      onClick={(e) => { e.stopPropagation(); navigate(`/meetings/${occurrence.id}/edit`); }}
                                      sx={{ p: isMobile ? 0.5 : 0.8 }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {totalPages > 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Pagination 
                          count={totalPages} 
                          page={page} 
                          onChange={handlePageChange} 
                          color="primary" 
                          size={isMobile ? 'small' : 'medium'} 
                          showFirstButton 
                          showLastButton
                          sx={{ '& .MuiPaginationItem-root': { fontSize: isMobile ? '0.7rem' : '0.875rem' } }}
                        />
                      </Box>
                    )}
                  </>
                ) : (
                  <>
                    <Grid container spacing={isMobile ? 1 : 2}>
                      {occurrences.map((occurrence, index) => {
                        const globalIndex = (page - 1) * rowsPerPage + index;
                        const isPast = new Date(occurrence.scheduled_date) < new Date();
                        return (
                          <Grid item xs={12} sm={6} lg={4} key={occurrence.id}>
                            <Card 
                              variant="outlined"
                              sx={{ 
                                borderRadius: 3,
                                transition: 'all 0.2s ease',
                                '&:hover': { 
                                  transform: isMobile ? 'none' : 'translateY(-2px)', 
                                  boxShadow: isMobile ? 'none' : theme.shadows[2], 
                                  borderColor: 'primary.light' 
                                },
                                opacity: isPast ? 0.7 : 1,
                                cursor: 'pointer',
                              }}
                              onClick={() => navigate(`/meetings/${occurrence.id}`)}
                            >
                              <CardContent sx={{ p: isMobile ? 1.5 : 2.5 }}>
                                <Stack spacing={isMobile ? 1.5 : 2}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem' }}>
                                        #{globalIndex + 1}
                                      </Typography>
                                      <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: isMobile ? '0.85rem' : '1rem' }}>
                                        {formatDate(occurrence.scheduled_date)}
                                      </Typography>
                                    </Box>
                                    <Chip 
                                      label={occurrence.status || 'Scheduled'} 
                                      size="small" 
                                      sx={{ 
                                        bgcolor: alpha(COLORS.info, 0.08), 
                                        color: COLORS.info, 
                                        fontWeight: 500, 
                                        borderRadius: 1.5,
                                        height: isMobile ? 20 : 24,
                                        fontSize: isMobile ? '0.55rem' : '0.75rem',
                                        '& .MuiChip-label': { px: isMobile ? 0.6 : 1 },
                                      }} 
                                    />
                                  </Stack>
                                  <Divider />
                                  <Stack spacing={isMobile ? 0.5 : 1}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <ScheduleIcon sx={{ fontSize: isMobile ? 14 : 16, color: 'text.secondary' }} />
                                      <Typography variant="body2" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
                                        {formatTime(occurrence.start_time)}
                                      </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      {getLocationIcon(occurrence.location_text)}
                                      <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
                                        {occurrence.location_text || recurringMeeting.location_text || 'Online'}
                                      </Typography>
                                    </Stack>
                                  </Stack>
                                </Stack>
                              </CardContent>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                    {totalPages > 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Pagination 
                          count={totalPages} 
                          page={page} 
                          onChange={handlePageChange} 
                          color="primary" 
                          size={isMobile ? 'small' : 'medium'} 
                          showFirstButton 
                          showLastButton
                          sx={{ '& .MuiPaginationItem-root': { fontSize: isMobile ? '0.7rem' : '0.875rem' } }}
                        />
                      </Box>
                    )}
                  </>
                )}
              </>
            )}
          </Box>
        )}
      </Paper>

      {/* FAB Speed Dial - hidden on mobile to reduce clutter */}
      {!isMobile && (
        <Fade in={trigger}>
          <SpeedDial 
            ariaLabel="Quick Actions" 
            sx={{ position: 'fixed', bottom: 72, right: 16 }} 
            icon={<SpeedDialIcon />} 
            onClose={() => setSpeedDialOpen(false)} 
            onOpen={() => setSpeedDialOpen(true)} 
            open={speedDialOpen}
          >
            <SpeedDialAction 
              icon={<AddIcon />} 
              tooltipTitle="Generate Next" 
              onClick={handleGenerateNext} 
              FabProps={{ sx: { bgcolor: COLORS.primary, '&:hover': { bgcolor: COLORS.primaryDark } } }}
            />
            <SpeedDialAction 
              icon={<CalendarTodayIcon />} 
              tooltipTitle="Generate 5" 
              onClick={() => handleGenerateMultiple(5)} 
            />
            <SpeedDialAction 
              icon={<DownloadIcon />} 
              tooltipTitle="Export" 
              onClick={handleExport} 
            />
            <SpeedDialAction 
              icon={<EditIcon />} 
              tooltipTitle="Edit" 
              onClick={() => navigate(`/recurring-meetings/${id}/edit`)} 
            />
            <SpeedDialAction 
              icon={<DeleteIcon />} 
              tooltipTitle="Delete" 
              onClick={() => setDeleteDialogOpen(true)} 
              FabProps={{ sx: { bgcolor: COLORS.danger, '&:hover': { bgcolor: COLORS.dangerDark } } }}
            />
          </SpeedDial>
        </Fade>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: 3, p: 1, maxWidth: isMobile ? '95%' : 'auto' } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: alpha(COLORS.danger, 0.1), color: COLORS.danger, width: isMobile ? 32 : 40, height: isMobile ? 32 : 40 }}>
              <DeleteIcon sx={{ fontSize: isMobile ? 18 : 24 }} />
            </Avatar>
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>Delete Series?</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: isMobile ? '0.85rem' : '1rem' }}>
            Are you sure you want to delete <strong>"{recurringMeeting.title}"</strong>?
          </DialogContentText>
          <Box sx={{ mt: 2, p: 2, bgcolor: alpha(COLORS.warning, 0.08), borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
              This will also delete all <strong>{totalCount}</strong> generated occurrences. This action cannot be undone.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting} sx={{ textTransform: 'none', fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            disabled={deleting} 
            variant="contained" 
            sx={{ 
              textTransform: 'none', 
              fontWeight: 600, 
              borderRadius: 2, 
              bgcolor: COLORS.danger, 
              '&:hover': { bgcolor: COLORS.dangerDark },
              fontSize: isMobile ? '0.8rem' : '0.875rem',
            }}
          >
            {deleting ? <CircularProgress size={20} /> : 'Delete Series'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={handleCloseSnackbar} 
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled" 
          sx={{ 
            borderRadius: 2,
            fontSize: isMobile ? '0.8rem' : '0.875rem',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RecurringMeetingDetail;  