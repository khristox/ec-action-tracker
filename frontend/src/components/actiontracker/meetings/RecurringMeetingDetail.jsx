// src/components/actiontracker/meetings/RecurringMeetingDetail.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Stack, Chip, IconButton,
  Grid, Divider, CircularProgress, Alert, Snackbar,
  Tooltip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, useTheme, useMediaQuery, alpha, Skeleton, Breadcrumbs,
  Link, Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Menu, MenuItem, ListItemIcon, Card, CardContent,
  ButtonGroup, SpeedDial, SpeedDialAction, SpeedDialIcon,
  useScrollTrigger, Fade, TextField, InputAdornment, ToggleButton, ToggleButtonGroup,
  CardHeader, Avatar, Pagination,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as Edit,
  Delete as Delete,
  Add as Add,
  Repeat as RepeatIcon,
  EventNote as EventNoteIcon,
  Today as TodayIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  CalendarToday as CalendarTodayIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Business as BusinessIcon,
  MeetingRoom as MeetingRoomIcon,
  Videocam as VideocamIcon,
  ContentCopy as ContentCopyIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import api from '../../../services/api';
import { COLORS } from './styles/colors';
import { formatDate, formatTime, getRecurrenceDescription } from './utils/helpers';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

const RecurringMeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Core data
  const [recurringMeeting, setRecurringMeeting] = useState(null);
  const [occurrences, setOccurrences] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationDetails, setLocationDetails] = useState(null);

  // Actions
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('table');

  const trigger = useScrollTrigger({ threshold: 100 });

  // Derived stats
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

  // Helpers
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

  // Data fetching
  const fetchRecurringMeetingDetails = useCallback(async () => {
    try {
      const response = await api.get(`/recurring-meetings/${id}`);
      const data = response.data?.data || response.data;
      setRecurringMeeting(data);
      if (data?.location_id) {
        try {
          const locRes = await api.get(`/locations/${data.location_id}`);
          setLocationDetails(locRes.data?.data || locRes.data);
        } catch { /* non-critical */ }
      }
      setError(null);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load recurring meeting';
      setError(msg);
      setSnackbar({ open: true, message: msg, severity: 'error' });
    }
  }, [id]);

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
      setSnackbar({ open: true, message: 'Failed to load occurrences', severity: 'warning' });
    } finally {
      setOccurrencesLoading(false);
    }
  }, [id, page, rowsPerPage, searchTerm, filterStatus, sortOrder]);

  useEffect(() => {
    if (!id) return;
    const init = async () => {
      setLoading(true);
      await fetchRecurringMeetingDetails();
      await fetchOccurrences({ page: 1 });
      setLoading(false);
    };
    init();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id || loading) return;
    fetchOccurrences();
  }, [page, rowsPerPage, filterStatus, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      setPage(1);
      fetchOccurrences({ page: 1, searchTerm });
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers
  const handlePageChange = (_, newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRowsPerPageChange = (newRows) => {
    setRowsPerPage(newRows);
    setPage(1);
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
        meeting: recurringMeeting,
        occurrences,
        location: locationDetails,
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

  // Render helpers
  const renderOccurrenceCard = (occurrence, index) => {
    const isPast = new Date(occurrence.scheduled_date) < new Date();
    const globalIndex = (page - 1) * rowsPerPage + index;
    return (
      <Card
        key={occurrence.id}
        sx={{
          mb: 2,
          opacity: isPast ? 0.7 : 1,
          borderRadius: 3,
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] },
        }}
      >
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: alpha(COLORS.info, 0.1), color: COLORS.info }}>
              <EventNoteIcon />
            </Avatar>
          }
          title={<Typography variant="subtitle1" fontWeight={700}>Occurrence #{globalIndex + 1}</Typography>}
          subheader={<Typography variant="caption" color="text.secondary">{formatDate(occurrence.scheduled_date)}</Typography>}
          action={
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="View">
                <IconButton size="small" onClick={() => navigate(`/meetings/${occurrence.id}`)}>
                  <EventNoteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => navigate(`/meetings/${occurrence.id}/edit`)}>
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          }
        />
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">{formatTime(occurrence.start_time)}</Typography>
            </Stack>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              {getLocationIcon(occurrence.location_text)}
              <Typography variant="body2" color="text.secondary">
                {occurrence.location_text || recurringMeeting?.location_text || 'Online'}
              </Typography>
            </Stack>
            <Chip
              label={occurrence.status || 'Scheduled'}
              size="small"
              sx={{ width: 'fit-content', bgcolor: alpha(COLORS.info, 0.1), color: COLORS.info, fontWeight: 500 }}
            />
          </Stack>
        </CardContent>
      </Card>
    );
  };

  // ── Stat card data ─────────────────────────────────────────────────────────
  const statCards = [
    { value: totalGenerated, label: 'Total Generated', color: COLORS.primary },
    { value: totalCount,     label: 'Total Occurrences', color: COLORS.success },
    { value: upcomingCount,  label: 'Upcoming',          color: COLORS.info    },
    { value: pastCount,      label: 'Past',              color: COLORS.warning },
  ];

  // Loading / error states
  if (loading) {
    return (
      <Box sx={{ p: isMobile ? 2 : 3, maxWidth: 1400, mx: 'auto' }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 3, borderRadius: 2 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={5} lg={4}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid item xs={12} md={7} lg={8}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 3 }} />
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
          action={<Button color="inherit" size="small" onClick={fetchRecurringMeetingDetails}>Retry</Button>}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/meetings')} variant="outlined">
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
          action={<Button color="inherit" size="small" onClick={() => navigate('/meetings')}>Go to Meetings</Button>}
        >
          Recurring meeting not found
        </Alert>
      </Box>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: isMobile ? 2 : 3, maxWidth: 1400, mx: 'auto' }}>

      {/* Breadcrumbs */}
      {!isMobile && (
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            onClick={() => navigate('/meetings')}
            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <EventNoteIcon sx={{ fontSize: 16 }} /> Meetings
          </Link>
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <RepeatIcon sx={{ fontSize: 16 }} /> {recurringMeeting.title}
          </Typography>
        </Breadcrumbs>
      )}

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: 2,
          mb: 3,
        }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <IconButton
            onClick={() => navigate('/meetings')}
            sx={{ bgcolor: alpha(COLORS.primary, 0.1), '&:hover': { bgcolor: alpha(COLORS.primary, 0.2) } }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={800}>
              {recurringMeeting.title}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
              <Chip
                label="Recurring Series"
                size="small"
                icon={<RepeatIcon sx={{ fontSize: 14 }} />}
                sx={{ bgcolor: alpha(COLORS.recurring, 0.15), color: COLORS.recurring, fontWeight: 600 }}
              />
              <Chip
                label={recurringMeeting.status === 'active' ? 'Active' : 'Inactive'}
                size="small"
                icon={
                  recurringMeeting.status === 'active'
                    ? <CheckCircleIcon sx={{ fontSize: 14 }} />
                    : <WarningIcon sx={{ fontSize: 14 }} />
                }
                sx={{
                  bgcolor: recurringMeeting.status === 'active'
                    ? alpha(COLORS.success, 0.15)
                    : alpha(COLORS.warning, 0.15),
                  color: recurringMeeting.status === 'active' ? COLORS.success : COLORS.warning,
                  fontWeight: 600,
                }}
              />
              <Chip label={`${totalGenerated} generated`} size="small" variant="outlined" />
              <Chip label={`${totalCount} total`} size="small" variant="outlined" color="info" />
            </Box>
          </Box>
        </Stack>

        {/* Desktop action buttons */}
        {!isMobile && (
          <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
            <ButtonGroup variant="outlined" size="medium">
              <Tooltip title="Generate Next">
                <Button
                  onClick={handleGenerateNext}
                  disabled={generating}
                  startIcon={generating ? <CircularProgress size={16} /> : <Add />}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Generate Next
                </Button>
              </Tooltip>
              <Tooltip title="Generate 5">
                <Button onClick={() => handleGenerateMultiple(5)} disabled={generating} sx={{ minWidth: 'auto', px: 2 }}>
                  5
                </Button>
              </Tooltip>
              <Tooltip title="Generate 10">
                <Button onClick={() => handleGenerateMultiple(10)} disabled={generating} sx={{ minWidth: 'auto', px: 2 }}>
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
              startIcon={<Edit />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Edit
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => setDeleteDialogOpen(true)}
              startIcon={<Delete />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Delete
            </Button>
          </Stack>
        )}

        {/* Mobile menu */}
        {isMobile && (
          <>
            <IconButton onClick={handleMenuOpen}><MoreVertIcon /></IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
              <MenuItem onClick={handleGenerateNext} disabled={generating}>
                <ListItemIcon><Add fontSize="small" /></ListItemIcon>Generate Next
              </MenuItem>
              <MenuItem onClick={() => handleGenerateMultiple(5)} disabled={generating}>
                <ListItemIcon><CalendarTodayIcon fontSize="small" /></ListItemIcon>Generate 5
              </MenuItem>
              <MenuItem onClick={() => handleGenerateMultiple(10)} disabled={generating}>
                <ListItemIcon><CalendarTodayIcon fontSize="small" /></ListItemIcon>Generate 10
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleExport} disabled={exporting}>
                <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Export Data
              </MenuItem>
              <MenuItem onClick={handleCopyLink}>
                <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>Copy Link
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => navigate(`/recurring-meetings/${id}/edit`)}>
                <ListItemIcon><Edit fontSize="small" /></ListItemIcon>Edit Series
              </MenuItem>
              <MenuItem onClick={() => setDeleteDialogOpen(true)} sx={{ color: COLORS.danger }}>
                <ListItemIcon><Delete fontSize="small" sx={{ color: COLORS.danger }} /></ListItemIcon>
                Delete Series
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map(({ value, label, color }) => (
          <Grid key={label} item xs={6} sm={3}>
            <Card sx={{ bgcolor: alpha(color, 0.05), borderRadius: 3 }}>
              <CardContent sx={{ textAlign: 'center', p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="h3" fontWeight={800} sx={{ color }}>{value}</Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>{label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Main content */}
      <Grid container spacing={3}>

        {/* Left — series details */}
        <Grid item xs={12} md={5} lg={4}>
          <Paper sx={{ p: 3, borderRadius: 3, position: { md: 'sticky' }, top: 20 }}>
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
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                  <TodayIcon sx={{ fontSize: 20, color: COLORS.info }} />
                  <Typography variant="body1" fontWeight={600}>
                    {recurringMeeting.next_occurrence_date
                      ? formatDate(recurringMeeting.next_occurrence_date)
                      : 'Not scheduled'}
                  </Typography>
                </Stack>
              </Box>
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Time
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                  <ScheduleIcon sx={{ fontSize: 20, color: COLORS.info }} />
                  <Typography variant="body1">
                    {recurringMeeting.start_time
                      ? `${formatTime(recurringMeeting.start_time)} – ${formatTime(recurringMeeting.end_time)}`
                      : 'Time not set'}
                  </Typography>
                </Stack>
              </Box>
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Location
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                  {getLocationIcon(recurringMeeting.location_text)}
                  <Typography variant="body1">{getLocationDisplay(recurringMeeting)}</Typography>
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
                    <Typography variant="body2" fontWeight={600} color="primary">{completionRate}%</Typography>
                  </Box>
                  <Box sx={{ height: 10, bgcolor: alpha(COLORS.primary, 0.1), borderRadius: 5, overflow: 'hidden' }}>
                    <Box
                      sx={{
                        width: `${completionRate}%`,
                        height: '100%',
                        bgcolor: completionRate === 100 ? COLORS.success : COLORS.primary,
                        borderRadius: 5,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Right — occurrences */}
        <Grid item xs={12} md={7} lg={8}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>

            {/* Section header */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2,
                mb: 3,
              }}
            >
              <Typography variant="h6" fontWeight={700} sx={{ color: COLORS.primary }}>
                Generated Occurrences
                {totalCount > 0 && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({totalCount} total)
                  </Typography>
                )}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
                  <ToggleButton value="table"><ViewListIcon fontSize="small" /></ToggleButton>
                  <ToggleButton value="card"><ViewModuleIcon fontSize="small" /></ToggleButton>
                </ToggleButtonGroup>
                <Tooltip title="Refresh">
                  <span>
                    <IconButton onClick={() => fetchOccurrences()} size="small" disabled={occurrencesLoading}>
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Box>

            {/* Search & filters */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: 2,
                mb: 3,
              }}
            >
              <TextField
                placeholder="Search by title, date, or location..."
                value={searchTerm}
                onChange={handleSearchChange}
                size="small"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={clearSearch}><ClearIcon fontSize="small" /></IconButton>
                      </InputAdornment>
                    ) : null,
                  },
                }}
                sx={{ flex: 2 }}
              />
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                <ButtonGroup variant="outlined" size="small">
                  {['all', 'upcoming', 'past'].map(s => (
                    <Button
                      key={s}
                      onClick={() => handleFilterStatusChange(s)}
                      variant={filterStatus === s ? 'contained' : 'outlined'}
                      sx={{ textTransform: 'none' }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Button>
                  ))}
                </ButtonGroup>
                <Tooltip title={`Sort: ${sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}`}>
                  <IconButton onClick={toggleSortOrder} size="small">
                    <FilterListIcon
                      sx={{
                        transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>

            {/* Rows per page */}
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Show:</Typography>
              {ROWS_PER_PAGE_OPTIONS.map(n => (
                <Button
                  key={n}
                  size="small"
                  variant={rowsPerPage === n ? 'contained' : 'outlined'}
                  onClick={() => handleRowsPerPageChange(n)}
                  sx={{ minWidth: 40, px: 1, py: 0.25, fontSize: 12 }}
                >
                  {n}
                </Button>
              ))}
            </Stack>

            {/* Loading */}
            {occurrencesLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            )}

            {/* Empty — no occurrences at all */}
            {!occurrencesLoading && occurrences.length === 0 && totalCount === 0 && !searchTerm && filterStatus === 'all' && (
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
                  startIcon={<Add />}
                  onClick={handleGenerateNext}
                  disabled={generating}
                  size="large"
                >
                  {generating ? <CircularProgress size={24} /> : 'Generate First Occurrence'}
                </Button>
              </Box>
            )}

            {/* Empty — filters/search returned nothing */}
            {!occurrencesLoading && occurrences.length === 0 && (searchTerm || filterStatus !== 'all') && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No matching occurrences
                </Typography>
                <Button onClick={() => { clearSearch(); setFilterStatus('all'); }} sx={{ mt: 2 }}>
                  Clear Filters
                </Button>
              </Box>
            )}

            {/* Table view */}
            {!occurrencesLoading && occurrences.length > 0 && viewMode === 'table' && (
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
                      {occurrences.map((occurrence, index) => {
                        const globalIndex = (page - 1) * rowsPerPage + index;
                        const isPast = new Date(occurrence.scheduled_date) < new Date();
                        return (
                          <TableRow
                            key={occurrence.id}
                            hover
                            sx={{
                              opacity: isPast ? 0.7 : 1,
                              backgroundColor: isPast ? alpha('#000', 0.03) : 'transparent',
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
                                <Typography variant="body2">{formatTime(occurrence.start_time)}</Typography>
                              </TableCell>
                            )}
                            <TableCell>
                              <Chip
                                label={occurrence.status || 'Scheduled'}
                                size="small"
                                sx={{ bgcolor: alpha(COLORS.info, 0.1), color: COLORS.info, fontWeight: 500 }}
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
                              <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                                <Tooltip title="View">
                                  <IconButton size="small" onClick={() => navigate(`/meetings/${occurrence.id}`)}>
                                    <EventNoteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <IconButton size="small" onClick={() => navigate(`/meetings/${occurrence.id}/edit`)}>
                                    <Edit fontSize="small" />
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
                    />
                  </Box>
                )}
              </>
            )}

            {/* Card view */}
            {!occurrencesLoading && occurrences.length > 0 && viewMode === 'card' && (
              <>
                <Box>
                  {occurrences.map((occurrence, index) => renderOccurrenceCard(occurrence, index))}
                </Box>
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
                    />
                  </Box>
                )}
              </>
            )}

            {occurrences.length > 0 && totalCount < totalGenerated && (
              <Box sx={{ mt: 3 }}>
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2">
                    <strong>{totalGenerated - totalCount}</strong> occurrences remaining to be generated
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
          onClose={() => setSpeedDialOpen(false)}
          onOpen={() => setSpeedDialOpen(true)}
          open={speedDialOpen}
        >
          <SpeedDialAction icon={<Add />}           tooltipTitle="Generate Next" onClick={handleGenerateNext} />
          <SpeedDialAction icon={<CalendarTodayIcon />} tooltipTitle="Generate 5"    onClick={() => handleGenerateMultiple(5)} />
          <SpeedDialAction icon={<DownloadIcon />}      tooltipTitle="Export"         onClick={handleExport} />
          <SpeedDialAction icon={<Edit />}          tooltipTitle="Edit"           onClick={() => navigate(`/recurring-meetings/${id}/edit`)} />
          <SpeedDialAction icon={<Delete />}        tooltipTitle="Delete"         onClick={() => setDeleteDialogOpen(true)} />
        </SpeedDial>
      </Fade>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Recurring Meeting Series?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>"{recurringMeeting.title}"</strong>?
            This will also delete all <strong>{totalCount}</strong> generated occurrences. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete Series'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RecurringMeetingDetail;