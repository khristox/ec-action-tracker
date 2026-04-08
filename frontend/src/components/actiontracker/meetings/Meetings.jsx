import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, IconButton, TextField, InputAdornment,
  Card, CardContent, Skeleton, Stack, Divider, Menu, MenuItem,
  alpha, useMediaQuery, useTheme, CircularProgress, Chip
} from '@mui/material';

import {
  Add as AddIcon, Search as SearchIcon, People as PeopleIcon,
  FilterList as FilterIcon, Edit as EditIcon, Schedule as ScheduleIcon,
  VideoCall as VideoCallIcon, LocationOn as LocationIcon, ArrowForward as ArrowForwardIcon,
  Description as DescriptionIcon, Pending as PendingIcon, CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon, PlayCircle as PlayCircleIcon, StopCircle as StopCircleIcon,
  ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';

import api from '../../../services/api';
import { fetchMeetingStatusOptions } from '../../../store/slices/actionTracker/meetingSlice';

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
                    meeting.location_text?.toLowerCase().includes('zoom');

  const dateObj = new Date(meeting.meeting_date);
  const formattedDate = `${dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const formatTime = (timeString) => {
    if (!timeString) return 'TBD';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <Card elevation={0} sx={{
      height: '100%', 
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0, 
      borderRadius: 1.2, 
      border: '1px solid #e2e8f0',
      bgcolor: 'white', 
      transition: 'all 0.2s ease-in-out',
      '&:hover': { borderColor: COLORS.primary, boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }
    }}>
      <CardContent sx={{ p: 2, cursor: 'pointer', flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }} onClick={() => onView(meeting.id)}>
        <Stack direction="row" justifyContent="space-between" mb={2} alignItems="center">
          <Box sx={{ 
            px: 1, py: 0.3, borderRadius: 0.8, bgcolor: alpha(statusColor, 0.1), 
            color: statusColor, fontSize: '0.6rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 0.5
          }}>
            {statusIcon}
            <span>{statusLabel}</span>
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', fontSize: '0.7rem' }}>
            {formattedDate}
          </Typography>
        </Stack>

        <Typography variant="subtitle2" sx={{ 
          fontWeight: 900, color: '#0f172a', mb: 1.5, lineHeight: 1.3, 
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
              <LabelValue label="Time" value={formatTime(meeting.start_time)} icon={ScheduleIcon} iconColor={COLORS.info} isTime />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <LabelValue label="Attendees" value={meeting.participants_count || 0} icon={PeopleIcon} iconColor={COLORS.success} />
            </Box>
          </Stack>
          <LabelValue label="Location" value={meeting.location_text || 'Not specified'} icon={isVirtual ? VideoCallIcon : LocationIcon} iconColor={COLORS.danger} />
        </Stack>
      </CardContent>
      
      <Box px={2} py={1} sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <IconButton size="small" sx={{ color: '#94a3b8' }} onClick={(e) => { e.stopPropagation(); onEdit(meeting.id); }}>
          <EditIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Button 
          size="small" endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />} 
          onClick={(e) => { e.stopPropagation(); onView(meeting.id); }} 
          sx={{ fontWeight: 800, textTransform: 'none', color: COLORS.primary, fontSize: '0.75rem' }}
        >
          Details
        </Button>
      </Box>
    </Card>
  );
};

const Meetings = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const observer = useRef();
  
  // Get status options from Redux state
  const statusOptions = useSelector((state) => state.meetings?.statusOptions || []);
  const statusOptionsLoading = useSelector((state) => state.meetings?.statusOptionsLoading || false);
  
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [sortAnchorEl, setSortAnchorEl] = useState(null);

  // Fetch status options from Redux when component mounts
  useEffect(() => {
    if (statusOptions.length === 0 && !statusOptionsLoading) {
      dispatch(fetchMeetingStatusOptions());
    }
  }, [dispatch, statusOptions.length, statusOptionsLoading]);

  const fetchMeetings = useCallback(async (pageNum, isInitial = false) => {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = {
        page: pageNum,
        limit: 12,
        sort_by: 'meeting_date',
        sort_order: sortOrder,
      };
      
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      
      const res = await api.get('/action-tracker/meetings', { params });

      const newItems = res.data.items || [];
      setMeetings(prev => isInitial ? newItems : [...prev, ...newItems]);
      setHasMore(newItems.length > 0 && (meetings.length + newItems.length) < (res.data.total || 0));
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, searchTerm, sortOrder, meetings.length]);

  // Fetch meetings when filters change
  useEffect(() => {
    setPage(1);
    setMeetings([]);
    fetchMeetings(1, true);
  }, [statusFilter, searchTerm, sortOrder]);

  const lastElementRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => {
          const next = prev + 1;
          fetchMeetings(next);
          return next;
        });
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, fetchMeetings]);

  const handleSortChange = (order) => {
    setSortOrder(order);
    setSortAnchorEl(null);
  };

  // Get status label for filter button
  const getStatusFilterLabel = () => {
    if (statusFilter === 'all') return 'All Status';
    const option = statusOptions.find(opt => opt.value === statusFilter);
    return option?.label || statusFilter;
  };

  // Sort meetings locally as backup
  const sortedMeetings = [...meetings].sort((a, b) => {
    const dateA = new Date(a.meeting_date);
    const dateB = new Date(b.meeting_date);
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  return (
    <Box sx={{ width: '100%', p: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a' }}>Meetings</Typography>
        <Button 
          variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/meetings/create')}
          sx={{ bgcolor: COLORS.primary, borderRadius: 1.2, textTransform: 'none', fontWeight: 800, px: 3, py: 1 }}
        >
          New Meeting
        </Button>
      </Stack>

      <Paper elevation={0} sx={{ p: 1.5, mb: 4, borderRadius: 1.2, border: '1px solid #e2e8f0' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
          <TextField
            fullWidth size="small" placeholder="Search meetings..." 
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 2 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} /></InputAdornment>,
              sx: { borderRadius: 0.8, bgcolor: '#f8fafc', '& fieldset': { border: 'none' } }
            }}
          />
          
          <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
            <Button 
              variant="outlined" 
              startIcon={<FilterIcon />} 
              onClick={(e) => setAnchorEl(e.currentTarget)}
              disabled={statusOptionsLoading}
              sx={{ 
                borderRadius: 1, 
                borderColor: '#e2e8f0', 
                color: '#475569', 
                textTransform: 'none', 
                fontWeight: 700,
                flex: 1
              }}
            >
              {statusOptionsLoading ? 'Loading...' : getStatusFilterLabel()}
            </Button>
            
            <Button 
              variant="outlined" 
              startIcon={sortOrder === 'desc' ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
              onClick={(e) => setSortAnchorEl(e.currentTarget)}
              sx={{ 
                borderRadius: 1, 
                borderColor: '#e2e8f0', 
                color: '#475569', 
                textTransform: 'none', 
                fontWeight: 700,
                flex: 1
              }}
            >
              {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Status Filter Menu - Populated from Redux state */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => { setStatusFilter('all'); setAnchorEl(null); }}>
          <Chip 
            label="All Status" 
            size="small" 
            sx={{ 
              bgcolor: statusFilter === 'all' ? COLORS.primary : 'transparent',
              color: statusFilter === 'all' ? 'white' : 'default',
              width: '100%',
              justifyContent: 'flex-start'
            }} 
          />
        </MenuItem>
        {statusOptions.map((option) => (
          <MenuItem key={option.value} onClick={() => { setStatusFilter(option.value); setAnchorEl(null); }}>
            <Chip 
              label={option.label}
              size="small"
              sx={{ 
                bgcolor: statusFilter === option.value ? (option.color || COLORS.info) : 'transparent',
                color: statusFilter === option.value ? 'white' : 'default',
                borderColor: option.color,
                width: '100%',
                justifyContent: 'flex-start'
              }}
              variant={statusFilter === option.value ? 'filled' : 'outlined'}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Sort Menu */}
      <Menu anchorEl={sortAnchorEl} open={Boolean(sortAnchorEl)} onClose={() => setSortAnchorEl(null)}>
        <MenuItem onClick={() => handleSortChange('desc')}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ArrowDownwardIcon sx={{ fontSize: 16, color: sortOrder === 'desc' ? COLORS.primary : '#94a3b8' }} />
            <Typography variant="body2" sx={{ fontWeight: sortOrder === 'desc' ? 800 : 400 }}>
              Newest First
            </Typography>
          </Stack>
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('asc')}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ArrowUpwardIcon sx={{ fontSize: 16, color: sortOrder === 'asc' ? COLORS.primary : '#94a3b8' }} />
            <Typography variant="body2" sx={{ fontWeight: sortOrder === 'asc' ? 800 : 400 }}>
              Oldest First
            </Typography>
          </Stack>
        </MenuItem>
      </Menu>

      {/* Meetings Grid */}
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 3,
        width: '100%',
        alignItems: 'stretch'
      }}>
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Box key={i} sx={{ 
              flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 24px)' : '1 1 calc(33.333% - 24px)',
              minWidth: 0
            }}>
              <Skeleton variant="rounded" width="100%" height={380} sx={{ borderRadius: 1.2 }} />
            </Box>
          ))
        ) : (
          sortedMeetings.map((meeting, index) => (
            <Box 
              key={`${meeting.id}-${index}`} 
              ref={index === sortedMeetings.length - 1 ? lastElementRef : null}
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
          ))
        )}
      </Box>

      {loadingMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, width: '100%' }}>
          <CircularProgress size={24} sx={{ color: COLORS.primary }} />
        </Box>
      )}

      {!hasMore && meetings.length > 0 && (
        <Typography variant="body2" sx={{ textAlign: 'center', color: '#94a3b8', mt: 4, mb: 2, width: '100%' }}>
          You've reached the end of the list
        </Typography>
      )}
      
      {!loading && meetings.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8, width: '100%' }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No meetings found
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => navigate('/meetings/create')}
            sx={{ mt: 2, textTransform: 'none' }}
          >
            Create your first meeting
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default Meetings;