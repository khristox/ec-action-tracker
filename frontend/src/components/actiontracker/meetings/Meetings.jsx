import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Grow,
  Tooltip,
  Zoom
} from '@mui/material';

import {
  Add as AddIcon,
  Search as SearchIcon,
  People as PeopleIcon,
  FilterList as FilterIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  VideoCall as VideoCallIcon,
  LocationOn as LocationIcon,
  ArrowForward as ArrowForwardIcon,
  Description as DescriptionIcon,
  Pending as PendingIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  PlayCircle as PlayCircleIcon,
  StopCircle as StopCircleIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  CalendarToday as CalendarIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';

import {
  fetchMeetings,
  fetchMeetingStatusOptions,
  clearError,
  clearMeetings,
  setFilters,
  resetFilters,
  selectAllMeetings,
  selectMeetingLoading,
  selectMeetingError,
  selectStatusOptions,
  selectMeetingsTotal,
  selectMeetingsHasMore,
  selectMeetingsFilters,
  selectFilteredMeetings,
  selectUpcomingMeetings,
  selectMeetingsStatistics
} from '../../../store/slices/actionTracker/meetingSlice';

const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  secondary: '#64748b',
  gray: '#94a3b8'
};

const getIconFromName = (iconName) => {
  const icons = {
    'pending': <PendingIcon sx={{ fontSize: 14 }} />,
    'schedule': <ScheduleIcon sx={{ fontSize: 14 }} />,
    'event': <ScheduleIcon sx={{ fontSize: 14 }} />,
    'play_circle': <PlayCircleIcon sx={{ fontSize: 14 }} />,
    'stop_circle': <StopCircleIcon sx={{ fontSize: 14 }} />,
    'check_circle': <CheckCircleIcon sx={{ fontSize: 14 }} />,
    'cancel': <CancelIcon sx={{ fontSize: 14 }} />,
    'pending_actions': <PendingIcon sx={{ fontSize: 14 }} />
  };
  return icons[iconName] || <ScheduleIcon sx={{ fontSize: 14 }} />;
};

const LabelValue = ({ label, value, icon: Icon, iconColor, isDescription = false, isTime = false }) => {
  const displayValue = value === undefined || value === null ? '---' : String(value);
  
  return (
    <Stack direction="row" spacing={1} alignItems={isDescription ? "flex-start" : "center"} sx={{ width: '100%', minWidth: 0 }}>
      <Box sx={{ 
        p: 0.7, borderRadius: 1, bgcolor: alpha(iconColor || '#94a3b8', 0.08), 
        color: iconColor || '#64748b', display: 'flex', mt: isDescription ? 0.3 : 0, flexShrink: 0
      }}>
        <Icon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ 
          fontWeight: 800, color: 'text.disabled', textTransform: 'uppercase', 
          mb: 0.1, display: 'block', letterSpacing: '0.02em', fontSize: '0.65rem' 
        }}>
          {label}
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: isTime ? 900 : 700, 
            color: isTime ? COLORS.info : '#1e293b',
            fontSize: '0.75rem',
            display: '-webkit-box',
            WebkitLineClamp: isDescription ? 2 : 1, 
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.4,
            wordBreak: 'break-all' 
          }}
        >
          {displayValue}
        </Typography>
      </Box>
    </Stack>
  );
};

const MeetingCard = ({ meeting, statusOptions, onView, onEdit }) => {
  // Find status option from Redux state
  let statusOption = null;
  const meetingStatus = meeting.status;
  
  if (typeof meetingStatus === 'string') {
    statusOption = statusOptions.find(opt => opt.value === meetingStatus);
  } else if (typeof meetingStatus === 'object' && meetingStatus !== null) {
    statusOption = statusOptions.find(opt => 
      opt.value === meetingStatus?.value || 
      opt.value === meetingStatus?.code ||
      opt.value === meetingStatus?.name ||
      opt.shortName === meetingStatus?.short_name
    );
  }
  
  const statusColor = statusOption?.color || COLORS.secondary;
  const statusIcon = getIconFromName(statusOption?.icon);
  
  let statusLabel = 'Unknown';
  if (statusOption?.label) {
    statusLabel = statusOption.label;
  } else if (typeof meetingStatus === 'string') {
    statusLabel = meetingStatus;
  } else if (meetingStatus?.short_name) {
    statusLabel = meetingStatus.short_name;
  } else if (meetingStatus?.name) {
    statusLabel = meetingStatus.name;
  } else if (meetingStatus?.label) {
    statusLabel = meetingStatus.label;
  }
  
  const isVirtual = meeting.location_text?.toLowerCase().includes('virtual') || 
                    meeting.location_text?.toLowerCase().includes('zoom') ||
                    meeting.location_text?.toLowerCase().includes('meet');

  const dateObj = new Date(meeting.meeting_date);
  const formattedDate = `${dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const formatTime = (timeString) => {
    if (!timeString) return 'TBD';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <Zoom in style={{ transitionDelay: '50ms' }}>
      <Card elevation={0} sx={{
        height: '100%', 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0, 
        borderRadius: 2, 
        border: '1px solid #e2e8f0',
        bgcolor: 'white', 
        transition: 'all 0.2s ease-in-out',
        '&:hover': { 
          borderColor: COLORS.primary, 
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          transform: 'translateY(-2px)'
        }
      }}>
        <CardContent sx={{ p: 2.5, cursor: 'pointer', flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }} onClick={() => onView(meeting.id)}>
          <Stack direction="row" justifyContent="space-between" mb={2} alignItems="center">
            <Chip 
              label={statusLabel}
              size="small"
              icon={statusIcon}
              sx={{ 
                bgcolor: alpha(statusColor, 0.1), 
                color: statusColor,
                fontWeight: 600,
                '& .MuiChip-icon': { color: statusColor }
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.7rem' }}>
              {formattedDate}
            </Typography>
          </Stack>

          <Typography variant="subtitle1" sx={{ 
            fontWeight: 800, color: '#0f172a', mb: 1.5, lineHeight: 1.3, 
            height: '2.8em', display: '-webkit-box', WebkitLineClamp: 2, 
            WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-all'
          }}>
            {meeting.title}
          </Typography>

          <Box sx={{ minHeight: '4.5em', mb: 2, overflow: 'hidden' }}>
            <LabelValue label="Purpose" value={meeting.description || meeting.purpose} icon={DescriptionIcon} iconColor={COLORS.primary} isDescription />
          </Box>

          <Box sx={{ flexGrow: 1 }} />
          <Divider sx={{ my: 2, borderColor: '#f1f5f9' }} />

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <LabelValue label="Time" value={formatTime(meeting.start_time)} icon={AccessTimeIcon} iconColor={COLORS.info} isTime />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <LabelValue label="Attendees" value={meeting.participants_count || meeting.participants?.length || 0} icon={PeopleIcon} iconColor={COLORS.success} />
              </Box>
            </Stack>
            <LabelValue label="Location" value={meeting.location_text || 'Not specified'} icon={isVirtual ? VideoCallIcon : LocationIcon} iconColor={COLORS.danger} />
          </Stack>
        </CardContent>
        
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', bgcolor: '#fafafa', borderTop: '1px solid #f1f5f9', borderRadius: '0 0 8px 8px' }}>
          <Tooltip title="Edit Meeting">
            <IconButton size="small" sx={{ color: '#94a3b8' }} onClick={(e) => { e.stopPropagation(); onEdit(meeting.id); }}>
              <EditIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Details">
            <Button 
              size="small" 
              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />} 
              onClick={(e) => { e.stopPropagation(); onView(meeting.id); }} 
              sx={{ fontWeight: 700, textTransform: 'none', color: COLORS.primary, fontSize: '0.75rem' }}
            >
              Details
            </Button>
          </Tooltip>
        </Box>
      </Card>
    </Zoom>
  );
};

const Meetings = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const observer = useRef();
  
  // Memoized selectors from Redux
  const meetings = useSelector(selectAllMeetings);
  const loading = useSelector(selectMeetingLoading);
  const error = useSelector(selectMeetingError);
  const statusOptions = useSelector(selectStatusOptions);
  const total = useSelector(selectMeetingsTotal);
  const hasMore = useSelector(selectMeetingsHasMore);
  const filters = useSelector(selectMeetingsFilters);
  const filteredMeetings = useSelector(selectFilteredMeetings);
  const upcomingMeetings = useSelector(selectUpcomingMeetings);
  const statistics = useSelector(selectMeetingsStatistics);
  
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
  const [sortOrder, setSortOrder] = useState(filters.sortOrder || 'desc');
  const [page, setPage] = useState(1);
  const [anchorEl, setAnchorEl] = useState(null);
  const [sortAnchorEl, setSortAnchorEl] = useState(null);
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);
  
  const itemsPerPage = 12;

  // Fetch status options on mount
  useEffect(() => {
    if (statusOptions.length === 0) {
      dispatch(fetchMeetingStatusOptions());
    }
  }, [dispatch, statusOptions.length]);

  // Fetch meetings when filters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      dispatch(fetchMeetings({
        page: 1,
        limit: itemsPerPage,
        search: searchTerm,
        status: statusFilter !== 'all' ? statusFilter : '',
        sortBy: 'meeting_date',
        sortOrder: sortOrder
      }));
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [dispatch, searchTerm, statusFilter, sortOrder, itemsPerPage]);

  // Update Redux filters when local filters change
  useEffect(() => {
    dispatch(setFilters({
      search: searchTerm,
      status: statusFilter !== 'all' ? statusFilter : '',
      sortOrder: sortOrder
    }));
  }, [dispatch, searchTerm, statusFilter, sortOrder]);

  const handleRefresh = () => {
    dispatch(clearMeetings());
    dispatch(fetchMeetings({
      page: 1,
      limit: itemsPerPage,
      search: searchTerm,
      status: statusFilter !== 'all' ? statusFilter : '',
      sortBy: 'meeting_date',
      sortOrder: sortOrder
    }));
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortOrder('desc');
    setShowUpcomingOnly(false);
    dispatch(resetFilters());
    dispatch(fetchMeetings({
      page: 1,
      limit: itemsPerPage,
      search: '',
      status: '',
      sortBy: 'meeting_date',
      sortOrder: 'desc'
    }));
  };

  const handleSortChange = (order) => {
    setSortOrder(order);
    setSortAnchorEl(null);
  };

  const getStatusFilterLabel = () => {
    if (statusFilter === 'all') return 'All Status';
    const option = statusOptions.find(opt => opt.value === statusFilter);
    return option?.label || statusFilter;
  };

  // Display meetings based on filter
  const displayMeetings = showUpcomingOnly ? upcomingMeetings : filteredMeetings;
  const paginatedMeetings = displayMeetings.slice(0, itemsPerPage);
  const hasMoreMeetings = displayMeetings.length > itemsPerPage;

  // Clear error
  const handleClearError = () => {
    dispatch(clearError());
  };

  return (
    <Box sx={{ width: '100%', p: 0 }}>
      {/* Header Section */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} mb={3} spacing={2}>
        <Box>
          <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 900, color: '#0f172a' }}>
            Meetings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage and track all your meetings
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Tooltip title="Refresh">
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />} 
              onClick={handleRefresh}
              disabled={loading}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Refresh
            </Button>
          </Tooltip>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => navigate('/meetings/create')}
            sx={{ 
              bgcolor: COLORS.primary, 
              borderRadius: 2, 
              textTransform: 'none', 
              fontWeight: 700, 
              px: 3, 
              py: 1,
              '&:hover': { bgcolor: '#4f46e5' }
            }}
          >
            New Meeting
          </Button>
        </Stack>
      </Stack>

      {/* Error Alert */}
      {error && (
        <Fade in>
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 2 }}>
            <Typography color="error" variant="body2">{error}</Typography>
            <Button size="small" onClick={handleClearError} sx={{ mt: 1, textTransform: 'none' }}>
              Dismiss
            </Button>
          </Paper>
        </Fade>
      )}

      {/* Statistics Cards */}
      {!loading && meetings.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Overview
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Chip 
              label={`Total: ${statistics.total}`}
              sx={{ bgcolor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}
            />
            <Chip 
              label={`Scheduled: ${statistics.scheduled}`}
              sx={{ bgcolor: '#EFF6FF', color: '#2563EB' }}
            />
            <Chip 
              label={`Ongoing: ${statistics.ongoing}`}
              sx={{ bgcolor: '#FFFBEB', color: '#D97706' }}
            />
            <Chip 
              label={`Completed: ${statistics.completed}`}
              sx={{ bgcolor: '#ECFDF5', color: '#059669' }}
            />
            <Chip 
              label={`Avg Participants: ${statistics.averageParticipants}`}
              sx={{ bgcolor: '#F3E8FF', color: '#7C3AED' }}
            />
          </Stack>
        </Box>
      )}

      {/* Search and Filter Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 4, borderRadius: 2, border: '1px solid #e2e8f0' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            fullWidth
            size="small"
            placeholder="Search meetings by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 2 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} /></InputAdornment>,
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
              sx: { borderRadius: 1.5, bgcolor: '#f8fafc', '& fieldset': { border: 'none' } }
            }}
          />
          
          <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
            <Button 
              variant="outlined" 
              startIcon={<FilterIcon />} 
              onClick={(e) => setAnchorEl(e.currentTarget)}
              disabled={statusOptions.length === 0}
              sx={{ 
                borderRadius: 1.5, 
                borderColor: '#e2e8f0', 
                color: '#475569', 
                textTransform: 'none', 
                fontWeight: 600,
                flex: 1,
                '&:hover': { borderColor: COLORS.primary, color: COLORS.primary }
              }}
            >
              {statusOptions.length === 0 ? 'Loading...' : getStatusFilterLabel()}
            </Button>
            
            <Button 
              variant="outlined" 
              startIcon={sortOrder === 'desc' ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
              onClick={(e) => setSortAnchorEl(e.currentTarget)}
              sx={{ 
                borderRadius: 1.5, 
                borderColor: '#e2e8f0', 
                color: '#475569', 
                textTransform: 'none', 
                fontWeight: 600,
                flex: 1,
                '&:hover': { borderColor: COLORS.primary, color: COLORS.primary }
              }}
            >
              {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </Button>
          </Stack>
        </Stack>
        
        {/* Active Filters Display */}
        {(searchTerm || statusFilter !== 'all' || showUpcomingOnly) && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary">Active filters:</Typography>
            {searchTerm && (
              <Chip 
                label={`Search: ${searchTerm}`} 
                size="small" 
                onDelete={() => setSearchTerm('')}
                sx={{ height: 24, fontSize: '0.7rem' }}
              />
            )}
            {statusFilter !== 'all' && (
              <Chip 
                label={`Status: ${getStatusFilterLabel()}`} 
                size="small" 
                onDelete={() => setStatusFilter('all')}
                sx={{ height: 24, fontSize: '0.7rem' }}
              />
            )}
            {showUpcomingOnly && (
              <Chip 
                label="Upcoming Only" 
                size="small" 
                onDelete={() => setShowUpcomingOnly(false)}
                sx={{ height: 24, fontSize: '0.7rem' }}
              />
            )}
            <Button size="small" onClick={handleClearFilters} sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
              Clear all
            </Button>
          </Stack>
        )}
      </Paper>

      {/* Status Filter Menu */}
      <Menu 
        anchorEl={anchorEl} 
        open={Boolean(anchorEl)} 
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { borderRadius: 2, mt: 1, minWidth: 180 } }}
      >
        <MenuItem onClick={() => { setStatusFilter('all'); setAnchorEl(null); }} sx={{ py: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label="All Status" size="small" variant="outlined" />
          </Stack>
        </MenuItem>
        {statusOptions.map((option) => (
          <MenuItem key={option.value} onClick={() => { setStatusFilter(option.value); setAnchorEl(null); }} sx={{ py: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip 
                label={option.label}
                size="small"
                sx={{ 
                  bgcolor: alpha(option.color, 0.1),
                  color: option.color,
                  borderColor: option.color
                }}
                variant="outlined"
              />
            </Stack>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => { setShowUpcomingOnly(!showUpcomingOnly); setAnchorEl(null); }} sx={{ py: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip 
              label="Upcoming Only" 
              size="small" 
              variant={showUpcomingOnly ? "filled" : "outlined"}
              color={showUpcomingOnly ? "primary" : "default"}
            />
          </Stack>
        </MenuItem>
      </Menu>

      {/* Sort Menu */}
      <Menu 
        anchorEl={sortAnchorEl} 
        open={Boolean(sortAnchorEl)} 
        onClose={() => setSortAnchorEl(null)}
        PaperProps={{ sx: { borderRadius: 2, mt: 1, minWidth: 160 } }}
      >
        <MenuItem onClick={() => handleSortChange('desc')} sx={{ py: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ArrowDownwardIcon sx={{ fontSize: 18, color: sortOrder === 'desc' ? COLORS.primary : '#94a3b8' }} />
            <Typography variant="body2" sx={{ fontWeight: sortOrder === 'desc' ? 700 : 400 }}>
              Newest First
            </Typography>
          </Stack>
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('asc')} sx={{ py: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ArrowUpwardIcon sx={{ fontSize: 18, color: sortOrder === 'asc' ? COLORS.primary : '#94a3b8' }} />
            <Typography variant="body2" sx={{ fontWeight: sortOrder === 'asc' ? 700 : 400 }}>
              Oldest First
            </Typography>
          </Stack>
        </MenuItem>
      </Menu>

      {/* Loading State */}
      {loading && meetings.length === 0 ? (
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 3,
          width: '100%'
        }}>
          {[...Array(6)].map((_, i) => (
            <Box key={i} sx={{ 
              flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 24px)' : '1 1 calc(33.333% - 24px)',
              minWidth: 0
            }}>
              <Skeleton variant="rounded" width="100%" height={420} sx={{ borderRadius: 2 }} />
            </Box>
          ))}
        </Box>
      ) : paginatedMeetings.length === 0 ? (
        /* Empty State */
        <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 2 }}>
          <CalendarIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} gutterBottom>
            No meetings found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchTerm || statusFilter !== 'all' || showUpcomingOnly 
              ? 'Try adjusting your search or filters' 
              : 'Get started by creating your first meeting'}
          </Typography>
          {(searchTerm || statusFilter !== 'all' || showUpcomingOnly) ? (
            <Button variant="outlined" onClick={handleClearFilters} startIcon={<ClearIcon />}>
              Clear Filters
            </Button>
          ) : (
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => navigate('/meetings/create')}
              sx={{ bgcolor: COLORS.primary, textTransform: 'none' }}
            >
              Create Meeting
            </Button>
          )}
        </Paper>
      ) : (
        /* Meetings Grid */
        <>
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 3,
            width: '100%',
            alignItems: 'stretch'
          }}>
            {paginatedMeetings.map((meeting, index) => (
              <Box 
                key={meeting.id} 
                sx={{ 
                  flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 24px)' : '1 1 calc(33.333% - 24px)',
                  minWidth: 0,
                  display: 'flex'
                }}
              >
                <MeetingCard 
                  meeting={meeting}
                  statusOptions={statusOptions}
                  onView={(id) => navigate(`/meetings/${id}`)} 
                  onEdit={(id) => navigate(`/meetings/${id}/edit`)} 
                />
              </Box>
            ))}
          </Box>
          
          {/* Load More Button */}
          {hasMoreMeetings && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button 
                variant="outlined" 
                onClick={() => setPage(page + 1)}
                disabled={loading}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {loading ? <CircularProgress size={20} /> : 'Load More'}
              </Button>
            </Box>
          )}
          
          {/* End of List Indicator */}
          {!hasMoreMeetings && meetings.length > 0 && (
            <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', color: '#94a3b8', mt: 4 }}>
              You've reached the end of the list
            </Typography>
          )}
        </>
      )}
      
      {/* Loading More Indicator */}
      {loading && meetings.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={32} sx={{ color: COLORS.primary }} />
        </Box>
      )}
    </Box>
  );
};

export default Meetings;