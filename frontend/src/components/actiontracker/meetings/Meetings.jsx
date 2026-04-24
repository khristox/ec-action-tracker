// src/components/meetings/Meetings.jsx - Complete with all features

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Divider,
  Menu,
  MenuItem,
  alpha,
  useMediaQuery,
  useTheme,
  CircularProgress,
  Chip,
  Fade,
  Tooltip,
  Zoom,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Snackbar,
  Alert,
  Fab,
  SwipeableDrawer,
  CardActionArea,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  ToggleButton,
  ToggleButtonGroup,
  Pagination,
  PaginationItem,
  Grid,
  Drawer,
  Badge
} from '@mui/material';

import {
  Add as AddIcon,
  Search as SearchIcon,
  People as PeopleIcon,
  FilterList as FilterIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
  ArrowForward as ArrowForwardIcon,
  Pending as PendingIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  PlayCircle as PlayCircleIcon,
  StopCircle as StopCircleIcon,
  Clear as ClearIcon,
  EventNote as EventNoteIcon,
  Today as TodayIcon,
  Schedule as ScheduleOutlinedIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
  Sms as SmsIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon
} from '@mui/icons-material';

import {
  fetchMeetings,
  fetchMeetingStatusOptions,
  selectAllMeetings,
  selectMeetingsLoading,
  selectMeetingError,
  selectStatusOptions,
  selectMeetingPagination
} from '../../../store/slices/actionTracker/meetingSlice';

import api from '../../../services/api';

const COLORS = {
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  primaryDark: '#5B21B6',
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  danger: '#EF4444',
  dangerLight: '#F87171',
  info: '#3B82F6',
  infoLight: '#60A5FA',
  secondary: '#6B7280',
  secondaryLight: '#9CA3AF',
  gradient: {
    primary: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
  }
};

// Status options mapping
const STATUS_CONFIG = {
  STARTED: { icon: 'play_circle', color: COLORS.info, label: 'Started' },
  ENDED: { icon: 'stop_circle', color: COLORS.success, label: 'Ended' },
  CANCELLED: { icon: 'cancel', color: COLORS.danger, label: 'Cancelled' },
  PENDING: { icon: 'pending', color: COLORS.warning, label: 'Pending' },
  SCHEDULED: { icon: 'schedule', color: COLORS.primary, label: 'Scheduled' },
  COMPLETED: { icon: 'check_circle', color: COLORS.success, label: 'Completed' }
};

const getIconFromName = (iconName) => {
  const icons = {
    'pending': <PendingIcon sx={{ fontSize: 14 }} />,
    'schedule': <ScheduleOutlinedIcon sx={{ fontSize: 14 }} />,
    'play_circle': <PlayCircleIcon sx={{ fontSize: 14 }} />,
    'stop_circle': <StopCircleIcon sx={{ fontSize: 14 }} />,
    'check_circle': <CheckCircleIcon sx={{ fontSize: 14 }} />,
    'cancel': <CancelIcon sx={{ fontSize: 14 }} />
  };
  return icons[iconName] || <ScheduleOutlinedIcon sx={{ fontSize: 14 }} />;
};

// Meeting Card Component
const MeetingCard = ({ meeting, statusOptions, onView, onEdit, onNotify }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [menuAnchor, setMenuAnchor] = useState(null);

  const statusInfo = useMemo(() => {
    let statusCode = null;
    if (meeting.status) {
      if (typeof meeting.status === 'string') statusCode = meeting.status;
      else if (meeting.status.short_name) statusCode = meeting.status.short_name;
      else if (meeting.status.code) statusCode = meeting.status.code;
    }
    
    const config = STATUS_CONFIG[statusCode] || STATUS_CONFIG.PENDING;
    return {
      label: config.label,
      color: config.color,
      icon: config.icon
    };
  }, [meeting.status]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'TBD';
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  return (
    <Card elevation={0} sx={{
      height: '100%', 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      borderRadius: isMobile ? 2 : 3, 
      border: `1px solid ${alpha(COLORS.primary, 0.1)}`,
      bgcolor: 'background.paper', 
      transition: 'all 0.3s ease',
      '&:hover': { 
        borderColor: COLORS.primary,
        transform: isMobile ? 'none' : 'translateY(-4px)',
        boxShadow: theme.shadows[8]
      }
    }}>
      <CardActionArea onClick={() => onView(meeting.id)} sx={{ flexGrow: 1 }}>
        <CardContent sx={{ p: isMobile ? 2 : 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Chip 
              label={statusInfo.label}
              size="small"
              icon={getIconFromName(statusInfo.icon)}
              sx={{ 
                bgcolor: alpha(statusInfo.color, 0.12), 
                color: statusInfo.color, 
                fontWeight: 700,
                borderRadius: 1.5,
                fontSize: '0.75rem',
                height: 28,
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                <EventNoteIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                {formatDate(meeting.meeting_date)}
              </Typography>
              <IconButton size="small" onClick={handleMenuOpen} sx={{ display: { xs: 'flex', sm: 'none' } }}>
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Stack>

          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', mb: 1.5, lineHeight: 1.3 }}>
            {meeting.title}
          </Typography>

          <Paper elevation={0} sx={{ p: 1.5, mb: 2, bgcolor: alpha(COLORS.info, 0.04), borderRadius: 2 }}>
            <Stack direction="row" spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <TodayIcon sx={{ fontSize: 18, color: COLORS.info }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatDate(meeting.meeting_date)}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <ScheduleOutlinedIcon sx={{ fontSize: 18, color: COLORS.info }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Time</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 1.5, mb: 2, bgcolor: alpha(COLORS.danger, 0.04), borderRadius: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <LocationIcon sx={{ fontSize: 18, color: COLORS.danger }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Location</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {meeting.location_text || 'No location specified'}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Stack direction="row" spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon sx={{ fontSize: 16, color: COLORS.success }} />
              <Typography variant="body2">
                <strong>{meeting.participants_count || 0}</strong> Participants
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
      
      <Box sx={{ px: isMobile ? 2 : 3, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${alpha(COLORS.primary, 0.08)}` }}>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(meeting.id); }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Send Notifications">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onNotify(meeting); }}>
            <NotificationsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button size="small" endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />} onClick={(e) => { e.stopPropagation(); onView(meeting.id); }} sx={{ fontWeight: 700, textTransform: 'none' }}>
          Details
        </Button>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={() => { handleMenuClose(); onEdit(meeting.id); }}><EditIcon sx={{ fontSize: 18, mr: 1.5 }} /> Edit</MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); onNotify(meeting); }}><NotificationsIcon sx={{ fontSize: 18, mr: 1.5 }} /> Notify</MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); onView(meeting.id); }}><ArrowForwardIcon sx={{ fontSize: 18, mr: 1.5 }} /> Details</MenuItem>
      </Menu>
    </Card>
  );
};

// Table Row Component
const MeetingTableRow = ({ meeting, statusOptions, onView, onEdit, onNotify, isMobile }) => {
  const statusInfo = useMemo(() => {
    let statusCode = null;
    if (meeting.status) {
      if (typeof meeting.status === 'string') statusCode = meeting.status;
      else if (meeting.status.short_name) statusCode = meeting.status.short_name;
      else if (meeting.status.code) statusCode = meeting.status.code;
    }
    const config = STATUS_CONFIG[statusCode] || STATUS_CONFIG.PENDING;
    return { label: config.label, color: config.color, icon: config.icon };
  }, [meeting.status]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'TBD';
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TableRow hover sx={{ '&:hover': { bgcolor: alpha(COLORS.primary, 0.05) } }}>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>{meeting.title}</Typography>
      </TableCell>
      <TableCell>
        <Chip 
          label={statusInfo.label}
          size="small"
          icon={getIconFromName(statusInfo.icon)}
          sx={{ bgcolor: alpha(statusInfo.color, 0.12), color: statusInfo.color, fontWeight: 600 }}
        />
      </TableCell>
      <TableCell>{formatDate(meeting.meeting_date)}</TableCell>
      <TableCell>{formatTime(meeting.start_time)}</TableCell>
      <TableCell>{meeting.participants_count || 0}</TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => onView(meeting.id)}>
              <ArrowForwardIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEdit(meeting.id)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Notify">
            <IconButton size="small" onClick={() => onNotify(meeting)}>
              <NotificationsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
};

const MobileFilterDrawer = ({ open, onClose, statusFilter, setStatusFilter, statusOptions, searchTerm, setSearchTerm, onClearFilters }) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [localStatusFilter, setLocalStatusFilter] = useState(statusFilter);

  useEffect(() => {
    setLocalSearchTerm(searchTerm);
    setLocalStatusFilter(statusFilter);
  }, [searchTerm, statusFilter]);

  const handleApply = () => {
    setSearchTerm(localSearchTerm);
    setStatusFilter(localStatusFilter);
    onClose();
  };

  const handleClear = () => {
    setLocalSearchTerm('');
    setLocalStatusFilter('all');
    onClearFilters();
    onClose();
  };

  return (
    <SwipeableDrawer anchor="bottom" open={open} onClose={onClose} onOpen={() => {}}>
      <Box sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>Filters</Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
        
        <TextField
          fullWidth
          size="small"
          placeholder="Search meetings..."
          value={localSearchTerm}
          onChange={(e) => setLocalSearchTerm(e.target.value)}
          sx={{ mb: 3 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />
        
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>Status</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 3 }}>
          <Chip label="All" onClick={() => setLocalStatusFilter('all')} color={localStatusFilter === 'all' ? 'primary' : 'default'} />
          {statusOptions?.map(opt => (
            <Chip 
              key={opt.value}
              label={opt.label}
              onClick={() => setLocalStatusFilter(opt.value)}
              color={localStatusFilter === opt.value ? 'primary' : 'default'}
            />
          ))}
        </Stack>
        
        <Stack direction="row" spacing={2}>
          <Button fullWidth variant="outlined" onClick={handleClear}>Clear All</Button>
          <Button fullWidth variant="contained" onClick={handleApply}>Apply Filters</Button>
        </Stack>
      </Box>
    </SwipeableDrawer>
  );
};

const Meetings = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  // Redux selectors
  const meetings = useSelector(selectAllMeetings);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingError);
  const statusOptions = useSelector(selectStatusOptions);
  const pagination = useSelector(selectMeetingPagination);
  
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'table'
  const [orderBy, setOrderBy] = useState('meeting_date');
  const [order, setOrder] = useState('desc');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Load status options on mount
  useEffect(() => {
    dispatch(fetchMeetingStatusOptions());
  }, [dispatch]);

  // Load meetings when filters change
  useEffect(() => {
    loadMeetings(1);
  }, [searchTerm, statusFilter, orderBy, order]);

  const loadMeetings = async (pageNum) => {
    try {
      const params = {
        page: pageNum,
        limit: rowsPerPage,
        sortBy: orderBy,
        sortOrder: order
      };
      
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      await dispatch(fetchMeetings(params)).unwrap();
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load meetings:', err);
    }
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    loadMeetings(newPage);
    window.scrollTo(0, 0);
  };

  const handleRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(1);
    loadMeetings(1);
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
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

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPage(1);
  };

  // Statistics
  const stats = useMemo(() => {
    const started = meetings.filter(m => m.status?.short_name === 'STARTED' || m.status?.code?.includes('STARTED')).length;
    const completed = meetings.filter(m => m.status?.short_name === 'ENDED' || m.status?.code?.includes('ENDED')).length;
    const pending = meetings.filter(m => !m.status || m.status?.short_name === 'PENDING').length;
    return { total: pagination.total || meetings.length, started, completed, pending };
  }, [meetings, pagination.total]);

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all';
  const totalPages = Math.ceil(pagination.total / rowsPerPage);

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', pb: isMobile ? 8 : 4, bgcolor: 'background.default' }}>
      <Box sx={{ p: isMobile ? 2 : 3 }}>
        
        {/* Header with New Meeting Button moved to right */}
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
            onClick={() => navigate('/meetings/create')} 
            sx={{ 
              borderRadius: 2.5, 
              px: isMobile ? 2 : 4, 
              py: isMobile ? 1 : 1.2, 
              fontWeight: 700, 
              textTransform: 'none',
              ml: 'auto',
              position: 'sticky',
              right: 16
            }}
          >
            New Meeting
          </Button>
        </Stack>

        {/* Stats */}
        {!loading && stats.total > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 3 }} useFlexGap>
            <Chip label={`Total: ${stats.total}`} size="small" sx={{ fontWeight: 700, bgcolor: alpha(COLORS.primary, 0.1), color: COLORS.primary }} />
            <Chip label={`Started: ${stats.started}`} size="small" sx={{ fontWeight: 700, bgcolor: alpha(COLORS.info, 0.1), color: COLORS.info }} />
            <Chip label={`Completed: ${stats.completed}`} size="small" sx={{ fontWeight: 700, bgcolor: alpha(COLORS.success, 0.1), color: COLORS.success }} />
            <Chip label={`Pending: ${stats.pending}`} size="small" sx={{ fontWeight: 700, bgcolor: alpha(COLORS.warning, 0.1), color: COLORS.warning }} />
          </Stack>
        )}

        {/* Filters and View Mode Toggle */}
        <Paper elevation={0} sx={{ p: isMobile ? 1.5 : 2.5, mb: 4, borderRadius: 3, border: `1px solid ${alpha(COLORS.primary, 0.12)}`, bgcolor: 'background.paper' }}>
          <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems="center">
            <TextField
              fullWidth
              size="small"
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: COLORS.secondary }} /></InputAdornment>,
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}><ClearIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                ),
              }}
            />
            
            {isMobile ? (
              <Button fullWidth variant="outlined" startIcon={<FilterIcon />} onClick={() => setFilterDrawerOpen(true)}>
                {statusFilter === 'all' ? 'Filter Meetings' : `Status: ${statusOptions?.find(o => o.value === statusFilter)?.label || statusFilter}`}
              </Button>
            ) : (
              <FormControl sx={{ minWidth: 200 }} size="small">
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
                  <MenuItem value="all">All Status</MenuItem>
                  {statusOptions?.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getIconFromName(opt.icon)}
                        {opt.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            {/* View Mode Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, val) => val && setViewMode(val)}
              size="small"
              sx={{ ml: isMobile ? 0 : 'auto' }}
            >
              <ToggleButton value="grid">
                <GridViewIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="table">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            
            {hasActiveFilters && !isMobile && (
              <Button onClick={handleClearFilters} startIcon={<ClearIcon />} size="small">Clear</Button>
            )}
          </Stack>
        </Paper>

        {/* Content - Grid View */}
        {viewMode === 'grid' && (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {loading && meetings.length === 0 ? (
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
                  {hasActiveFilters && <Button onClick={handleClearFilters} sx={{ mt: 2 }} variant="outlined">Clear Filters</Button>}
                  {!hasActiveFilters && <Button variant="contained" onClick={() => navigate('/meetings/create')} sx={{ mt: 2 }} startIcon={<AddIcon />}>Create Meeting</Button>}
                </Box>
              ) : (
                meetings.map((meeting) => (
                  <Box key={meeting.id} sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 24px)', lg: '1 1 calc(25% - 24px)' }, display: 'flex' }}>
                    <MeetingCard 
                      meeting={meeting} 
                      statusOptions={statusOptions} 
                      onView={(id) => navigate(`/meetings/${id}`)} 
                      onEdit={(id) => navigate(`/meetings/${id}/edit`)} 
                      onNotify={handleNotifyClick} 
                    />
                  </Box>
                ))
              )}
            </Box>
            
            {/* Pagination for Grid View - Scroll backwards/forwards */}
            {!loading && pagination.total > rowsPerPage && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  size={isMobile ? "small" : "medium"}
                  showFirstButton
                  showLastButton
                  siblingCount={isMobile ? 0 : 1}
                />
              </Box>
            )}
          </>
        )}

        {/* Content - Table View */}
        {viewMode === 'table' && (
          <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid ${alpha(COLORS.primary, 0.12)}` }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table stickyHeader size={isMobile ? "small" : "medium"}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.default' }}>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'title'}
                        direction={orderBy === 'title' ? order : 'asc'}
                        onClick={() => handleSort('title')}
                        sx={{ fontWeight: 700 }}
                      >
                        Title
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'meeting_date'}
                        direction={orderBy === 'meeting_date' ? order : 'asc'}
                        onClick={() => handleSort('meeting_date')}
                        sx={{ fontWeight: 700 }}
                      >
                        Date
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'start_time'}
                        direction={orderBy === 'start_time' ? order : 'asc'}
                        onClick={() => handleSort('start_time')}
                        sx={{ fontWeight: 700 }}
                      >
                        Time
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Participants</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && meetings.length === 0 ? (
                    [...Array(rowsPerPage)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(6)].map((_, j) => (
                          <TableCell key={j}><Skeleton variant="text" width="100%" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : meetings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                        <Typography variant="body1" color="text.secondary">No meetings found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    meetings.map((meeting) => (
                      <MeetingTableRow
                        key={meeting.id}
                        meeting={meeting}
                        statusOptions={statusOptions}
                        onView={(id) => navigate(`/meetings/${id}`)}
                        onEdit={(id) => navigate(`/meetings/${id}/edit`)}
                        onNotify={handleNotifyClick}
                        isMobile={isMobile}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* Table Pagination */}
            {!loading && pagination.total > 0 && (
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={pagination.total}
                rowsPerPage={rowsPerPage}
                page={page - 1}
                onPageChange={(e, newPage) => handlePageChange(e, newPage + 1)}
                onRowsPerPageChange={handleRowsPerPageChange}
                labelRowsPerPage="Rows per page:"
              />
            )}
          </Paper>
        )}
      </Box>

      {/* Mobile FAB Button */}
      {isMobile && (
        <Fab color="primary" sx={{ position: 'fixed', bottom: 16, right: 16 }} onClick={() => navigate('/meetings/create')}>
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
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

// Notification Dialog Component
const NotificationDialog = ({ open, onClose, meeting, participants, onSend }) => {
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [notificationType, setNotificationType] = useState(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (open && participants) {
      setSelectedParticipants(participants.map(p => p.id));
      setSelectAll(true);
    }
  }, [open, participants]);

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend({
        participant_ids: selectedParticipants,
        notification_type: notificationType,
        custom_message: customMessage
      });
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: COLORS.primary, color: 'white' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <NotificationsIcon />
            <Typography variant="h6">Send Notifications</Typography>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700}>{meeting?.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {meeting?.meeting_date && new Date(meeting.meeting_date).toLocaleString()}
            </Typography>
          </Paper>

          <FormControl fullWidth size="small">
            <InputLabel>Notification Type</InputLabel>
            <Select multiple value={notificationType} label="Notification Type" onChange={(e) => setNotificationType(e.target.value)}>
              <MenuItem value="email"><EmailIcon sx={{ mr: 1 }} /> Email</MenuItem>
              <MenuItem value="whatsapp"><WhatsAppIcon sx={{ mr: 1 }} /> WhatsApp</MenuItem>
              <MenuItem value="sms"><SmsIcon sx={{ mr: 1 }} /> SMS</MenuItem>
            </Select>
          </FormControl>

          <TextField label="Custom Message" multiline rows={3} value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSend} disabled={sending || selectedParticipants.length === 0}>
          {sending ? <CircularProgress size={20} /> : `Send to ${selectedParticipants.length}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Meetings;