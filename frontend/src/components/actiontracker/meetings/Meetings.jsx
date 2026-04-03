import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Pagination,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Event as EventIcon,
  People as PeopleIcon,
  LocationOn as LocationIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

/**
 * Meeting Status Chip
 */
const MeetingStatusChip = ({ status }) => {
  const getStatusConfig = () => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return { label: 'Pending', color: 'warning', icon: <PendingIcon /> };
      case 'started':
        return { label: 'Started', color: 'info', icon: <EventIcon /> };
      case 'ended':
        return { label: 'Ended', color: 'default', icon: <EventIcon /> };
      case 'closed':
        return { label: 'Closed', color: 'success', icon: <EventIcon /> };
      case 'cancelled':
        return { label: 'Cancelled', color: 'error', icon: <CancelIcon /> };
      default:
        return { label: 'Pending', color: 'warning', icon: <PendingIcon /> };
    }
  };

  const config = getStatusConfig();
  return (
    <Chip
      icon={config.icon}
      label={config.label}
      color={config.color}
      size="small"
      sx={{ minWidth: 90, fontWeight: 500 }}
    />
  );
};

/**
 * Individual Meeting Card with Navigation
 */
const MeetingCard = ({ meeting, onView, onEdit }) => (
  <Card 
    sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      transition: 'transform 0.2s',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 },
      cursor: 'pointer'
    }}
    onClick={() => onView(meeting.id)}
  >
    <CardContent sx={{ flexGrow: 1 }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
          {meeting.title}
        </Typography>
        <MeetingStatusChip status={meeting.status} />
      </Box>
      
      <Typography variant="body2" color="text.secondary" mb={3} sx={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden'
      }}>
        {meeting.description}
      </Typography>
      
      <Box display="flex" flexDirection="column" gap={1.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <EventIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="caption" fontWeight={500}>
            {meeting.date} • {meeting.time}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <LocationIcon sx={{ fontSize: 18, color: 'error.light' }} />
          <Typography variant="caption" color="text.secondary">
            {meeting.location}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <PeopleIcon sx={{ fontSize: 18, color: 'info.main' }} />
          <Typography variant="caption" color="text.secondary">
            {meeting.participants} Participants
          </Typography>
        </Box>
      </Box>
    </CardContent>
    <Box p={2} pt={0} display="flex" gap={1}>
      <Button 
        fullWidth 
        variant="contained" 
        size="small" 
        sx={{ borderRadius: 1.5 }}
        onClick={(e) => { e.stopPropagation(); onView(meeting.id); }}
      >
        View Details
      </Button>
      <Button 
        variant="outlined" 
        size="small" 
        sx={{ borderRadius: 1.5, minWidth: 'auto' }}
        onClick={(e) => { e.stopPropagation(); onEdit(meeting.id); }}
      >
        <EditIcon fontSize="small" />
      </Button>
    </Box>
  </Card>
);

/**
 * Main Meetings Component with Navigation
 */
const Meetings = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 6;

  // Mock data for the Electoral Commission style
  const [meetings, setMeetings] = useState([
    { 
      id: 1, 
      title: 'Voter Verification Sync', 
      description: 'Reviewing progress of the national voter registry update.', 
      date: 'April 10, 2026', 
      time: '10:00 AM', 
      location: 'Conference Room B', 
      participants: 12,
      status: 'pending'
    },
    { 
      id: 2, 
      title: 'Field Staff Training', 
      description: 'Technical briefing for district supervisors on the tracker app.', 
      date: 'April 12, 2026', 
      time: '02:00 PM', 
      location: 'Virtual (Zoom)', 
      participants: 45,
      status: 'started'
    },
    { 
      id: 3, 
      title: 'Security Briefing', 
      description: 'Coordination meeting with local security stakeholders.', 
      date: 'April 15, 2026', 
      time: '09:30 AM', 
      location: 'Main Hall', 
      participants: 8,
      status: 'pending'
    },
    { 
      id: 4, 
      title: 'Budget Review Committee', 
      description: 'Quarterly budget assessment and resource allocation.', 
      date: 'April 18, 2026', 
      time: '11:00 AM', 
      location: 'Board Room', 
      participants: 15,
      status: 'pending'
    },
    { 
      id: 5, 
      title: 'Stakeholder Engagement', 
      description: 'Meeting with political party representatives.', 
      date: 'April 20, 2026', 
      time: '01:00 PM', 
      location: 'Virtual', 
      participants: 25,
      status: 'closed'
    },
  ]);

  // Navigation handlers
  const handleCreateMeeting = () => navigate('/meetings/create');
  const handleViewMeeting = (id) => navigate(`/meetings/${id}`);
  const handleEditMeeting = (id) => navigate(`/meetings/${id}/edit`);

  // Filter handlers
  const handleFilterClick = (event) => setFilterAnchorEl(event.currentTarget);
  const handleFilterClose = (status) => {
    if (status) setStatusFilter(status);
    setFilterAnchorEl(null);
    setPage(1);
  };

  // Filter meetings
  const filteredMeetings = meetings.filter(meeting => 
    meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (statusFilter === 'all' || meeting.status === statusFilter)
  );

  // Pagination
  const paginatedMeetings = filteredMeetings.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  const totalPages = Math.ceil(filteredMeetings.length / itemsPerPage);

  // Simulate loading
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '1600px', mx: 'auto' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary" gutterBottom>
            Meetings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            EC Action Tracker — Scheduled Consultations & Briefings
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={handleCreateMeeting}
          sx={{ height: 48, px: 3, borderRadius: 2, fontWeight: 'bold' }}
        >
          Create Meeting
        </Button>
      </Box>

      {/* Search and Filter Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            fullWidth
            placeholder="Search by title, location, or agenda..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <IconButton size="small" onClick={() => setSearchTerm('')}>
                  <CancelIcon />
                </IconButton>
              ),
            }}
          />
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={handleFilterClick}
            endIcon={statusFilter !== 'all' && <Chip label={statusFilter} size="small" />}
            sx={{ minWidth: 120 }}
          >
            Filter
          </Button>
          <Menu
            anchorEl={filterAnchorEl}
            open={Boolean(filterAnchorEl)}
            onClose={() => handleFilterClose()}
          >
            <MenuItem onClick={() => handleFilterClose('all')}>All</MenuItem>
            <MenuItem onClick={() => handleFilterClose('pending')}>Pending</MenuItem>
            <MenuItem onClick={() => handleFilterClose('started')}>Started</MenuItem>
            <MenuItem onClick={() => handleFilterClose('ended')}>Ended</MenuItem>
            <MenuItem onClick={() => handleFilterClose('closed')}>Closed</MenuItem>
            <MenuItem onClick={() => handleFilterClose('cancelled')}>Cancelled</MenuItem>
          </Menu>
        </Box>
      </Paper>

      {/* Meetings Grid */}
      {filteredMeetings.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <EventIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No meetings found</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Get started by creating your first meeting
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateMeeting}>
            Create Meeting
          </Button>
        </Paper>
      ) : (
        <>
          <Grid container spacing={3}>
            {paginatedMeetings.map((meeting) => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={meeting.id}>
                <MeetingCard 
                  meeting={meeting} 
                  onView={handleViewMeeting}
                  onEdit={handleEditMeeting}
                />
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={6}>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={(e, value) => setPage(value)} 
                color="primary" 
                size="large"
                sx={{ '& .MuiPaginationItem-root': { fontWeight: 'bold' } }}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default Meetings;