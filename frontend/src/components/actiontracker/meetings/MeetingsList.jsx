// src/components/actiontracker/meetings/MeetingsList.jsx

import React, { useEffect, useState, useCallback } from 'react';
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
  IconButton,
  Tooltip,
  Stack,
  Divider,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Close as CloseIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
} from '@mui/icons-material';
import { fetchMeetings } from '../../../store/slices/actionTracker/meetingSlice';
import { COLORS } from './styles/colors';
import AddActionDialog from './components/AddActionDialog';
import api from '../../../services/api';

// ============================================================
// STATUS COLOR MAPPING
// ============================================================
const STATUS_COLOR_MAP = {
  'STARTED': 'success',
  'ENDED': 'default',
  'PENDING': 'warning',
  'CANCELED': 'error',
  'SCHEDULED': 'info',
  'POSTPONED': 'warning',
  'DRAFT': 'secondary',
  'IN_PROGRESS': 'success',
  'COMPLETED': 'default',
  'UPCOMING': 'info',
};

const STATUS_LABEL_MAP = {
  'STARTED': 'Started',
  'ENDED': 'Ended',
  'PENDING': 'Pending',
  'CANCELED': 'Canceled',
  'SCHEDULED': 'Scheduled',
  'POSTPONED': 'Postponed',
  'DRAFT': 'Draft',
  'IN_PROGRESS': 'In Progress',
  'COMPLETED': 'Completed',
  'UPCOMING': 'Upcoming',
};

// ============================================================
// MEETING CARD COMPONENT
// ============================================================
const MeetingCard = ({ 
  meeting, 
  onClick,
  onAddAction,
  canAddActions,
}) => {
  const getStatusInfo = () => {
    if (meeting.status && typeof meeting.status === 'object') {
      const shortName = meeting.status.short_name?.toUpperCase() || '';
      const label = meeting.status.short_name || meeting.status.name || 'Unknown';
      const color = meeting.status.color || STATUS_COLOR_MAP[shortName] || 'default';
      return { label, color };
    }
    
    if (typeof meeting.status === 'string') {
      const shortName = meeting.status.toUpperCase();
      const label = STATUS_LABEL_MAP[shortName] || meeting.status;
      const color = STATUS_COLOR_MAP[shortName] || 'default';
      return { label, color };
    }
    
    return { label: 'Unknown', color: 'default' };
  };

  const statusInfo = getStatusInfo();

  const getParticipantsCount = () => {
    if (meeting.participants && Array.isArray(meeting.participants)) {
      return meeting.participants.length;
    }
    if (meeting.participants_count !== undefined && meeting.participants_count !== null) {
      return meeting.participants_count;
    }
    return 0;
  };

  const participantsCount = getParticipantsCount();

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Date TBD';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      return new Date(timeString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const handleAddActionClick = (e) => {
    e.stopPropagation();
    if (onAddAction) {
      onAddAction(meeting);
    }
  };

  return (
    <Card 
      sx={{ 
        cursor: 'pointer', 
        transition: 'all 0.2s ease-in-out',
        '&:hover': { 
          transform: 'translateY(-4px)', 
          boxShadow: (theme) => theme.shadows[8],
          borderColor: COLORS.primary,
        },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }} 
      onClick={() => onClick(meeting.id)}
    >
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Typography 
            variant="h6" 
            fontWeight="bold" 
            sx={{ 
              fontSize: '1rem',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: 1,
              mr: 1,
            }}
          >
            {meeting.title || 'Untitled Meeting'}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip 
              label={statusInfo.label} 
              size="small" 
              color={statusInfo.color}
              sx={{ 
                fontWeight: 600, 
                fontSize: '0.7rem',
                flexShrink: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}
            />
            <Tooltip title={canAddActions ? "Add Action Item" : "Meeting must be in progress to add actions"} placement="top">
              <span>
                <IconButton
                  size="small"
                  onClick={handleAddActionClick}
                  disabled={!canAddActions}
                  sx={{
                    color: canAddActions ? 'text.secondary' : 'action.disabled',
                    '&:hover': {
                      bgcolor: canAddActions ? 'rgba(46, 125, 50, 0.1)' : 'transparent',
                      color: canAddActions ? '#2e7d32' : 'action.disabled',
                    }
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        <Typography 
          variant="body2" 
          color="text.secondary" 
          mb={2} 
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.5rem',
          }}
        >
          {meeting.description || 'No description provided'}
        </Typography>

        <Divider sx={{ my: 1.5 }} />

        <Box display="flex" flexDirection="column" gap={1.2}>
          <Box display="flex" alignItems="center" gap={1}>
            <EventIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {formatDate(meeting.meeting_date)}
              {meeting.start_time && ` at ${formatTime(meeting.start_time)}`}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <LocationIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" noWrap>
              {meeting.location_text || 'Location TBD'}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {participantsCount} participant{participantsCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>

        {meeting.created_at && (
          <Typography variant="caption" color="text.disabled" sx={{ mt: 2, fontSize: '0.6rem' }}>
            Created {new Date(meeting.created_at).toLocaleDateString()}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================
// MAIN MEETINGS LIST COMPONENT
// ============================================================
const MeetingsList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { meetings, loading, pagination } = useSelector((state) => state.meetings || { meetings: [], loading: false, pagination: {} });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('grid');
  const rowsPerPage = 9;

  // ============ ADD ACTION DIALOG STATE ============
  const [addActionDialogOpen, setAddActionDialogOpen] = useState(false);
  const [selectedMeetingForAction, setSelectedMeetingForAction] = useState(null);
  const [minutes, setMinutes] = useState([]);
  const [loadingMinutes, setLoadingMinutes] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [creatingAction, setCreatingAction] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch meetings on mount and when filters change
  useEffect(() => {
    const params = {
      page,
      limit: rowsPerPage,
      sortBy: 'meeting_date',
      sortOrder: 'desc',
    };
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'all') params.status = statusFilter;
    
    dispatch(fetchMeetings(params));
  }, [dispatch, page, searchTerm, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  const handleCreateMeeting = () => navigate('/meetings/create');
  const handleViewMeeting = (id) => navigate(`/meetings/${id}`);

  // ============ ADD ACTION HANDLERS ============
  const handleAddAction = async (meeting) => {
    alert('handleAddAction called'); // TEMP DEBUG
    console.log('Opening add action dialog for meeting:', meeting);
    setSelectedMeetingForAction(meeting);
    setAddActionDialogOpen(true);
    setActionError(null);
    
    // Fetch minutes for this meeting
    setLoadingMinutes(true);
    try {
      const response = await api.get(`/action-tracker/meetings/${meeting.id}/minutes`);
      console.log('Minutes response:', response.data);
      const minutesData = response.data?.items || response.data || [];
      setMinutes(Array.isArray(minutesData) ? minutesData : []);
    } catch (err) {
      console.error('Failed to fetch minutes:', err);
      // Don't show error - just use empty minutes
      setMinutes([]);
    } finally {
      setLoadingMinutes(false);
    }
  };

const handleSaveAction = async (payload) => {
  console.log('📤 Sending action payload:', JSON.stringify(payload, null, 2));
  setCreatingAction(true);
  setActionError(null);
  
  try {
    // Ensure meeting_id is included
    const actionPayload = {
      ...payload,
      meeting_id: selectedMeetingForAction?.id,
    };
    
    // Log the actual request
    console.log('📤 Final payload to send:', JSON.stringify(actionPayload, null, 2));
    
    const response = await api.post('/action-tracker/actions/', actionPayload);
    console.log('✅ Action created successfully:', response.data);
    
    // Show success message
    setSuccessMessage('Action created successfully!');
    
    // Close the dialog
    setAddActionDialogOpen(false);
    setSelectedMeetingForAction(null);
    
    // Refresh the meetings list
    dispatch(fetchMeetings({
      page,
      limit: rowsPerPage,
      sortBy: 'meeting_date',
      sortOrder: 'desc',
      search: searchTerm || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }));
    
    return response.data;
  } catch (err) {
    console.error('❌ Error creating action:', err);
    
    // Log the full error response
    if (err.response) {
      console.error('📥 Error response data:', err.response.data);
      console.error('📥 Error response status:', err.response.status);
      console.error('📥 Error response headers:', err.response.headers);
    }
    
    const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to create action';
    setActionError(errorMessage);
    throw err;
  } finally {
    setCreatingAction(false);
  }
};


  const handleMinuteCreated = async (minuteId) => {
    console.log('Minute created with ID:', minuteId);
    // Refresh minutes list
    if (selectedMeetingForAction) {
      try {
        const response = await api.get(`/action-tracker/meetings/${selectedMeetingForAction.id}/minutes`);
        const minutesData = response.data?.items || response.data || [];
        setMinutes(Array.isArray(minutesData) ? minutesData : []);
      } catch (err) {
        console.error('Failed to refresh minutes:', err);
      }
    }
  };

  // ============ CHECK IF MEETING CAN HAVE ACTIONS ============
  const canAddActions = (meeting) => {
    if (!meeting) return false;
    
    // Check status from various possible locations
    let status = '';
    if (meeting.status && typeof meeting.status === 'object') {
      status = meeting.status.short_name?.toUpperCase() || '';
    } else if (typeof meeting.status === 'string') {
      status = meeting.status.toUpperCase();
    }
    
    // Also check status_id if available
    if (!status && meeting.status_id) {
      // If we have a status_id but no status string, allow it if meeting is not cancelled or ended
      const isCancelled = meeting.is_cancelled || false;
      const isEnded = meeting.is_ended || false;
      return !isCancelled && !isEnded;
    }
    
    const allowedStatuses = ['STARTED', 'IN_PROGRESS', 'ONGOING'];
    return allowedStatuses.includes(status);
  };

  // Get unique statuses from meetings for filter
  const getAvailableStatuses = () => {
    const statusSet = new Set();
    meetings.forEach(meeting => {
      if (meeting.status && typeof meeting.status === 'object' && meeting.status.short_name) {
        statusSet.add(meeting.status.short_name);
      } else if (typeof meeting.status === 'string') {
        statusSet.add(meeting.status);
      }
    });
    return Array.from(statusSet);
  };

  const availableStatuses = getAvailableStatuses();

  const getStatusLabel = (statusValue) => {
    if (!statusValue) return 'All';
    const upper = statusValue.toUpperCase();
    return STATUS_LABEL_MAP[upper] || statusValue;
  };

  const getStatusColor = (statusValue) => {
    if (!statusValue) return 'default';
    const upper = statusValue.toUpperCase();
    return STATUS_COLOR_MAP[upper] || 'default';
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all';

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  // ============ RENDER ============
  if (loading && meetings.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const totalPages = Math.ceil((pagination?.total || meetings.length) / rowsPerPage);

  return (
    <>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h4" fontWeight="bold" sx={{ 
              background: COLORS?.gradient?.primary || 'linear-gradient(135deg, #1976d2, #9c27b0)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}>
              Meetings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage and track all your scheduled meetings
            </Typography>
          </Box>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={handleCreateMeeting}
            sx={{ 
              borderRadius: 2.5,
              px: 3,
              py: 1,
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            Create Meeting
          </Button>
        </Box>

        {/* Success Snackbar */}
        <Snackbar 
          open={!!successMessage} 
          autoHideDuration={4000} 
          onClose={() => setSuccessMessage('')}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert onClose={() => setSuccessMessage('')} severity="success">
            {successMessage}
          </Alert>
        </Snackbar>

        {/* Filters Bar */}
        <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                placeholder="Search meetings by title, description, or location..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                size="small"
                InputProps={{ 
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2 }
                }} 
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <Button 
                fullWidth 
                variant="outlined" 
                startIcon={<FilterIcon />} 
                onClick={(e) => setFilterAnchorEl(e.currentTarget)}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                {statusFilter === 'all' ? 'All Statuses' : getStatusLabel(statusFilter)}
              </Button>
              <Menu 
                anchorEl={filterAnchorEl} 
                open={Boolean(filterAnchorEl)} 
                onClose={() => setFilterAnchorEl(null)}
                sx={{ '& .MuiPaper-root': { borderRadius: 2, minWidth: 180 } }}
              >
                <MenuItem 
                  onClick={() => { setStatusFilter('all'); setFilterAnchorEl(null); }}
                  selected={statusFilter === 'all'}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip label="All" size="small" />
                  </Box>
                </MenuItem>
                {availableStatuses.map((status) => (
                  <MenuItem 
                    key={status} 
                    onClick={() => { setStatusFilter(status); setFilterAnchorEl(null); }}
                    selected={statusFilter === status}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip 
                        label={getStatusLabel(status)} 
                        size="small" 
                        color={getStatusColor(status)} 
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Menu>
            </Grid>
            <Grid item xs={6} md={3}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="Grid View">
                  <IconButton 
                    onClick={() => setViewMode('grid')} 
                    color={viewMode === 'grid' ? 'primary' : 'default'}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                  >
                    <ViewModuleIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="List View">
                  <IconButton 
                    onClick={() => setViewMode('list')} 
                    color={viewMode === 'list' ? 'primary' : 'default'}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                  >
                    <ViewListIcon />
                  </IconButton>
                </Tooltip>
                {hasActiveFilters && (
                  <Button 
                    size="small" 
                    onClick={handleClearFilters}
                    color="error"
                    variant="text"
                    sx={{ ml: 1, textTransform: 'none' }}
                  >
                    Clear Filters
                  </Button>
                )}
              </Stack>
            </Grid>
          </Grid>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
              {searchTerm && (
                <Chip 
                  label={`Search: "${searchTerm}"`} 
                  size="small" 
                  onDelete={() => setSearchTerm('')}
                  sx={{ height: 24 }}
                />
              )}
              {statusFilter !== 'all' && (
                <Chip 
                  label={`Status: ${getStatusLabel(statusFilter)}`} 
                  size="small" 
                  color={getStatusColor(statusFilter)}
                  onDelete={() => setStatusFilter('all')}
                  sx={{ height: 24 }}
                />
              )}
            </Box>
          )}
        </Paper>

        {/* Results Count */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="body2" color="text.secondary">
            Showing {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
            {pagination?.total && pagination.total > meetings.length && ` of ${pagination.total}`}
          </Typography>
        </Box>

        {/* Meeting Cards Grid */}
        {meetings.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom color="text.secondary">
              {hasActiveFilters ? 'No meetings match your filters' : 'No meetings found'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {hasActiveFilters ? 'Try adjusting your search or filters' : 'Get started by creating your first meeting'}
            </Typography>
            {hasActiveFilters ? (
              <Button variant="outlined" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            ) : (
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateMeeting}>
                Create Meeting
              </Button>
            )}
          </Paper>
        ) : viewMode === 'grid' ? (
          <Grid container spacing={3}>
            {meetings.map((meeting) => (
              <Grid item xs={12} sm={6} md={4} key={meeting.id}>
                <MeetingCard 
                  meeting={meeting} 
                  onClick={handleViewMeeting}
                  onAddAction={handleAddAction}
                  canAddActions={canAddActions(meeting)}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            {meetings.map((meeting, index) => {
              const statusInfo = meeting.status && typeof meeting.status === 'object'
                ? { label: meeting.status.short_name || meeting.status.name || 'Unknown', color: meeting.status.color || STATUS_COLOR_MAP[meeting.status.short_name?.toUpperCase()] || 'default' }
                : { label: meeting.status || 'Unknown', color: 'default' };
              
              const canAdd = canAddActions(meeting);
              
              return (
                <Box
                  key={meeting.id}
                  sx={{
                    p: 2,
                    borderBottom: index < meetings.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    '&:hover': { bgcolor: 'action.hover' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1,
                  }}
                  onClick={() => handleViewMeeting(meeting.id)}
                >
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography variant="subtitle1" fontWeight="600">
                      {meeting.title || 'Untitled'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 400 }}>
                      {meeting.description || 'No description'}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Chip label={statusInfo.label} size="small" color={statusInfo.color} />
                    <Typography variant="caption" color="text.secondary">
                      {meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : 'No date'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {meeting.location_text || 'No location'}
                    </Typography>
                    <Tooltip title={canAdd ? "Add Action" : "Meeting must be in progress"} placement="top">
                      <span>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddAction(meeting);
                          }}
                          disabled={!canAdd}
                          sx={{
                            color: canAdd ? 'text.secondary' : 'action.disabled',
                          }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              );
            })}
          </Paper>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={(e, value) => setPage(value)} 
              color="primary" 
              size="large"
              showFirstButton
              showLastButton
            />
          </Box>
        )}
      </Container>

      {/* ============================================================
          ADD ACTION DIALOG
          ============================================================ */}
      {selectedMeetingForAction && (
        <AddActionDialog
          open={addActionDialogOpen}
          onClose={() => {
            setAddActionDialogOpen(false);
            setSelectedMeetingForAction(null);
            setActionError(null);
          }}
          onSave={handleSaveAction}
          meetingId={selectedMeetingForAction?.id}
          minutes={minutes}
          selectedMinuteId={minutes.length > 0 ? minutes[0]?.id : null}
          loading={loadingMinutes}
          error={actionError}
          busy={creatingAction}
          onMinutesCreated={handleMinuteCreated}
        />
      )}
    </>
  );
};

export default MeetingsList;