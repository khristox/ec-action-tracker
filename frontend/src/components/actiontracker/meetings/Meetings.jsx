import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, IconButton, TextField, InputAdornment,
  Card, CardContent, Grid, Skeleton, Stack, Divider, Menu, MenuItem,
  alpha, useMediaQuery, useTheme, CircularProgress
} from '@mui/material';

import {
  Add as AddIcon, Search as SearchIcon, People as PeopleIcon,
  FilterList as FilterIcon, Edit as EditIcon, Schedule as ScheduleIcon,
  VideoCall as VideoCallIcon, LocationOn as LocationIcon, ArrowForward as ArrowForwardIcon,
  Description as DescriptionIcon, Pending as PendingIcon, CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon, PlayCircle as PlayCircleIcon, StopCircle as StopCircleIcon
} from '@mui/icons-material';

import api from '../../../services/api';

const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  secondary: '#64748b'
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

const LabelValue = ({ label, value, icon: Icon, iconColor, isDescription = false, isTime = false }) => (
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
          wordBreak: 'break-word' 
        }}
      >
        {value || '---'}
      </Typography>
    </Box>
  </Stack>
);

const MeetingCard = ({ meeting, onView, onEdit }) => {
  const statusData = meeting.status || {};
  const metadata = statusData.extra_metadata || {};
  const statusColor = metadata.color || COLORS.secondary;
  const statusIcon = getIconFromName(metadata.icon);
  const statusLabel = statusData.short_name || statusData.name || 'Unknown';
  
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
        width: '100%', // 🟢 Ensures it fills the Grid item
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
          WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word'
        }}>
          {meeting.title}
        </Typography>

        <Box sx={{ minHeight: '4.2em', mb: 2, overflow: 'hidden' }}>
          <LabelValue label="Purpose" value={meeting.description} icon={DescriptionIcon} iconColor={COLORS.primary} isDescription />
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
  const navigate = useNavigate();
  const observer = useRef();
  
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);

  const fetchMeetings = useCallback(async (pageNum, isInitial = false) => {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await api.get('/action-tracker/meetings', {
        params: { 
          page: pageNum,
          limit: 12, 
          ...(statusFilter !== 'all' && { status: statusFilter }), 
          ...(searchTerm && { search: searchTerm }) 
        }
      });

      const newItems = res.data.items || [];
      setMeetings(prev => isInitial ? newItems : [...prev, ...newItems]);
      setHasMore(newItems.length > 0 && meetings.length + newItems.length < res.data.total);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, searchTerm, meetings.length]);

  // Reset and fetch on filter change
  useEffect(() => {
    setPage(1);
    fetchMeetings(1, true);
  }, [statusFilter, searchTerm]);

  // Infinite Scroll Observer
  const lastElementRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => {
          const nextPage = prevPage + 1;
          fetchMeetings(nextPage);
          return nextPage;
        });
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, fetchMeetings]);

return (
    <Box sx={{ width: '100%', p: 0 }}>
      {/* Header and Search remain same */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} px={1}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a' }}>Meetings</Typography>
        {/* ... */}
      </Stack>

      {/* 🟢 Added px: 1 to the Paper search bar to match the Grid alignment */}
      <Paper elevation={0} sx={{ p: 1, mb: 4, mx: 1, borderRadius: 1.2, border: '1px solid #e2e8f0', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* ... */}
      </Paper>

      {/* 🟢 Updated Grid: added width: '100%' and margin: 0 to fix the horizontal scroll/spacing */}
      <Grid 
        container 
        spacing={2} // Reduced to 2 for a tighter, cleaner mobile look
        sx={{ 
          width: '100%', 
          m: 0, 
          '& > .MuiGrid-item': { pt: 2, pl: 2 } 
        }}
      >
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rounded" width="100%" height={300} sx={{ borderRadius: 1.2 }} />
            </Grid>
          ))
        ) : (
          meetings.map((m, index) => (
            <Grid 
              item 
              xs={12} // 📱 Strict 1 column on mobile
              sm={6}  // 📑 2 columns on tablet
              md={4}  // 🖥️ 3 columns on desktop
              key={`${m.id}-${index}`} 
              ref={index === meetings.length - 1 ? lastElementRef : null}
              sx={{ display: 'flex', justifyContent: 'center' }}
            >
              <MeetingCard 
                meeting={m} 
                onView={(id) => navigate(`/meetings/${id}`)} 
                onEdit={(id) => navigate(`/meetings/${id}/edit`)} 
              />
            </Grid>
          ))
        )}
      </Grid>
      
      {/* ... Footer */}
    </Box>
  );
};

export default Meetings;