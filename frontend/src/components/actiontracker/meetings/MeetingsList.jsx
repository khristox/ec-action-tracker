import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Box,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { fetchMeetings } from '../../../store/slices/actionTracker/meetingSlice';

const MeetingCard = ({ meeting, onClick }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'warning';
      case 'started': return 'info';
      case 'ended': return 'default';
      case 'closed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  return (
    <Card sx={{ cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }} onClick={() => onClick(meeting.id)}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography variant="h6" fontWeight="bold">{meeting.title}</Typography>
          <Chip label={meeting.status || 'Pending'} size="small" color={getStatusColor(meeting.status)} />
        </Box>
        <Typography variant="body2" color="text.secondary" mb={2} noWrap>
          {meeting.description || 'No description'}
        </Typography>
        <Box display="flex" flexDirection="column" gap={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <EventIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {new Date(meeting.meeting_date).toLocaleDateString()}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <LocationIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {meeting.location_text || 'Location TBD'}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {meeting.participants?.length || 0} participants
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const MeetingsList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { meetings, loading } = useSelector((state) => state.meetings);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    dispatch(fetchMeetings());
  }, [dispatch]);

  const handleCreateMeeting = () => navigate('/meetings/create');
  const handleViewMeeting = (id) => navigate(`/meetings/${id}`);

  const filteredMeetings = meetings.filter(meeting => 
    meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (statusFilter === 'all' || meeting.status === statusFilter)
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight="bold">Meetings</Typography>
          <Typography variant="body2" color="text.secondary">Manage and track all your meetings</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateMeeting}>Create Meeting</Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <TextField fullWidth placeholder="Search meetings..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button fullWidth variant="outlined" startIcon={<FilterIcon />} onClick={(e) => setFilterAnchorEl(e.currentTarget)}>Filter by Status</Button>
            <Menu anchorEl={filterAnchorEl} open={Boolean(filterAnchorEl)} onClose={() => setFilterAnchorEl(null)}>
              <MenuItem onClick={() => { setStatusFilter('all'); setFilterAnchorEl(null); }}>All</MenuItem>
              <MenuItem onClick={() => { setStatusFilter('pending'); setFilterAnchorEl(null); }}>Pending</MenuItem>
              <MenuItem onClick={() => { setStatusFilter('started'); setFilterAnchorEl(null); }}>Started</MenuItem>
              <MenuItem onClick={() => { setStatusFilter('ended'); setFilterAnchorEl(null); }}>Ended</MenuItem>
              <MenuItem onClick={() => { setStatusFilter('closed'); setFilterAnchorEl(null); }}>Closed</MenuItem>
            </Menu>
          </Grid>
        </Grid>
      </Paper>

      {filteredMeetings.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>No meetings found</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateMeeting}>Create Meeting</Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredMeetings.map((meeting) => (
            <Grid item xs={12} sm={6} md={4} key={meeting.id}>
              <MeetingCard meeting={meeting} onClick={handleViewMeeting} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default MeetingsList;