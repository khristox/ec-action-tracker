import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Container, Typography, Paper, Chip, Grid, Divider, Button,
  List, ListItem, ListItemText, ListItemAvatar, Avatar, Tab, Tabs,
  Card, CardContent, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, CircularProgress, MenuItem, Stack, Snackbar,
  FormControl, InputLabel, Select, LinearProgress,
} from '@mui/material';
import {
  Edit as EditIcon, Delete as DeleteIcon, LocationOn as LocationIcon,
  Schedule as ScheduleIcon, Person as PersonIcon, Description as DescriptionIcon,
  Assignment as AssignmentIcon, Add as AddIcon, CheckCircle as CheckCircleIcon,
  Pending as PendingIcon, Cancel as CancelIcon, ArrowBack as ArrowBackIcon,
  FileUpload as FileUploadIcon, PriorityHigh as PriorityIcon,
  PlayCircle as PlayCircleIcon, StopCircle as StopCircleIcon,
  PendingActions as PendingActionsIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchMeetingById, fetchMeetingStatusOptions, updateMeetingStatus,
  addMeetingAction, updateActionProgress, selectCurrentMeeting,
  selectMeetingLoading, selectMeetingUpdating, selectMeetingError,
  selectStatusOptions, clearError,
} from '../../../store/slices/actionTracker/meetingSlice';

// Helper function to get icon component from icon name string
const getIconFromName = (iconName) => {
  const icons = {
    'schedule': <ScheduleIcon sx={{ fontSize: 16 }} />,
    'pending': <PendingIcon sx={{ fontSize: 16 }} />,
    'play_circle': <PlayCircleIcon sx={{ fontSize: 16 }} />,
    'stop_circle': <StopCircleIcon sx={{ fontSize: 16 }} />,
    'check_circle': <CheckCircleIcon sx={{ fontSize: 16 }} />,
    'cancel': <CancelIcon sx={{ fontSize: 16 }} />,
    'pending_actions': <PendingActionsIcon sx={{ fontSize: 16 }} />,
  };
  return icons[iconName] || <ScheduleIcon sx={{ fontSize: 16 }} />;
};

// Format date as dd MMM yyyy HH:mm:ss
const formatDateTime = (dateString) => {
  if (!dateString) return 'TBD';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
};

// Format date as dd MMM yyyy (without time)
const formatDate = (dateString) => {
  if (!dateString) return 'TBD';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const TabPanel = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ padding: '24px 0' }}>
    {value === index && children}
  </div>
);

const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const meeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingLoading);
  const reduxUpdating = useSelector(selectMeetingUpdating);
  const error = useSelector(selectMeetingError);
  const statusOptions = useSelector(selectStatusOptions);

  const [tabValue, setTabValue] = useState(0);
  const [showAddActionDialog, setShowAddActionDialog] = useState(false);
  const [showEditStatusDialog, setShowEditStatusDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [localUpdating, setLocalUpdating] = useState(false);
  const [newAction, setNewAction] = useState({
    description: '', assigned_to_name: '', due_date: '', priority: 2,
  });

  const updating = reduxUpdating || localUpdating;

  useEffect(() => {
    dispatch(fetchMeetingById(id));
    dispatch(fetchMeetingStatusOptions());
  }, [dispatch, id]);

  // Set selected status using short_name
  useEffect(() => {
    if (meeting?.status) {
      const shortName = meeting.status.short_name?.toLowerCase() || '';
      setSelectedStatus(shortName);
    }
  }, [meeting]);

  useEffect(() => {
    if (error) {
      setSnackbar({ open: true, message: error, severity: 'error' });
      dispatch(clearError());
    }
  }, [error, dispatch]);

  /**
   * Resolve a status object or string to a statusOptions entry.
   * Uses the actual icon and color from extra_metadata when available.
   */
  const getStatusInfo = (statusInput) => {
    if (!statusInput) {
      return {
        value: 'pending',
        label: 'Pending',
        color: '#ed6c02',
        icon: <PendingIcon sx={{ fontSize: 16 }} />,
        description: '',
      };
    }

    let key = '';
    let statusObject = null;

    if (typeof statusInput === 'object') {
      statusObject = statusInput;
      // Use short_name for the key
      key = statusInput.short_name?.toLowerCase() || '';
    } else {
      key = String(statusInput).toLowerCase();
      statusObject = statusOptions.find(opt => 
        opt.value === key || opt.shortName?.toLowerCase() === key
      );
    }

    // If we have a status object with extra_metadata, use that
    if (statusObject?.extra_metadata) {
      const metadata = statusObject.extra_metadata;
      const label = statusObject.short_name || statusObject.name || key;
      return {
        value: key,
        label: label.toUpperCase(),
        color: metadata.color || '#64748b',
        icon: getIconFromName(metadata.icon),
        description: metadata.description || '',
        shortName: statusObject.short_name,
      };
    }

    // Fallback to looking up in statusOptions
    const option = statusOptions.find(opt =>
      opt.value === key || opt.shortName?.toLowerCase() === key
    );

    if (option) {
      if (option.extra_metadata) {
        return {
          value: option.value,
          label: option.short_name?.toUpperCase() || option.label,
          color: option.extra_metadata.color || option.color,
          icon: getIconFromName(option.extra_metadata.icon),
          description: option.extra_metadata.description || option.description,
          shortName: option.short_name,
        };
      }
      return {
        value: option.value,
        label: option.short_name?.toUpperCase() || option.label,
        color: option.color || '#64748b',
        icon: option.icon || <ScheduleIcon sx={{ fontSize: 16 }} />,
        description: option.description || '',
        shortName: option.short_name,
      };
    }

    return {
      value: key,
      label: key.toUpperCase() || 'Unknown',
      color: '#64748b',
      icon: <ScheduleIcon sx={{ fontSize: 16 }} />,
      description: '',
    };
  };

  const handleStatusChange = async (newStatus) => {
    setLocalUpdating(true);
    try {
      const selectedOption = statusOptions.find(opt => opt.value === newStatus);
      // Use short_name for the API call
      const statusValue = selectedOption?.shortName?.toLowerCase() || newStatus;

      const result = await dispatch(updateMeetingStatus({ id, status: statusValue }));

      if (!result.error) {
        setSelectedStatus(newStatus);
        setSnackbar({
          open: true,
          message: `Status updated to ${selectedOption?.short_name?.toUpperCase() || newStatus}`,
          severity: 'success',
        });
        setShowEditStatusDialog(false);
        dispatch(fetchMeetingById(id));
      } else {
        setSnackbar({ open: true, message: result.payload || 'Failed to update status', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to update status',
        severity: 'error',
      });
    } finally {
      setLocalUpdating(false);
    }
  };

  const handleAddAction = async () => {
    const minutesId = meeting?.minutes?.[0]?.id;
    if (!minutesId) {
      setSnackbar({ open: true, message: 'No minutes found for this meeting', severity: 'error' });
      return;
    }
    setLocalUpdating(true);
    const result = await dispatch(addMeetingAction({ minuteId: minutesId, actionData: newAction }));
    if (!result.error) {
      setShowAddActionDialog(false);
      setNewAction({ description: '', assigned_to_name: '', due_date: '', priority: 2 });
      setSnackbar({ open: true, message: 'Action item added successfully', severity: 'success' });
      dispatch(fetchMeetingById(id));
    } else {
      setSnackbar({ open: true, message: result.payload || 'Failed to add action', severity: 'error' });
    }
    setLocalUpdating(false);
  };

  const handleUpdateActionProgress = async (actionId, progress) => {
    setLocalUpdating(true);
    const result = await dispatch(updateActionProgress({ actionId, progress }));
    if (!result.error) {
      setSnackbar({ open: true, message: 'Progress updated', severity: 'success' });
      dispatch(fetchMeetingById(id));
    } else {
      setSnackbar({ open: true, message: result.payload || 'Failed to update progress', severity: 'error' });
    }
    setLocalUpdating(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!meeting) {
    return <Container><Typography>Meeting not found</Typography></Container>;
  }

  const statusInfo = getStatusInfo(meeting.status);
  const currentStatusValue = getStatusInfo(meeting.status).value;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/meetings')} sx={{ mb: 2 }}>
        Back to Meetings
      </Button>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              {meeting.title}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              <Chip
                icon={statusInfo.icon}
                label={statusInfo.label}
                sx={{ bgcolor: `${statusInfo.color}15`, color: statusInfo.color, fontWeight: 600 }}
              />
              <Chip 
                icon={<ScheduleIcon />} 
                label={formatDateTime(meeting.meeting_date)} 
                variant="outlined" 
              />
              <Chip icon={<LocationIcon />} label={meeting.location_text || 'TBD'} variant="outlined" />
              {meeting.facilitator && (
                <Chip icon={<PersonIcon />} label={`Facilitator: ${meeting.facilitator}`} variant="outlined" />
              )}
            </Stack>
            {statusInfo.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {statusInfo.description}
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={() => setShowEditStatusDialog(true)}
              startIcon={<ScheduleIcon />}
              disabled={updating}
            >
              {updating ? <CircularProgress size={20} /> : 'Change Status'}
            </Button>
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => navigate(`/meetings/${id}/edit`)}>
              Edit
            </Button>
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />}>Delete</Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              <DescriptionIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
              Description
            </Typography>
            <Typography variant="body1">{meeting.description || 'No description provided'}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              <AssignmentIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
              Agenda
            </Typography>
            <Typography variant="body1" whiteSpace="pre-wrap">{meeting.agenda || 'No agenda provided'}</Typography>
          </Grid>
        </Grid>

        {(meeting.chairperson_name || meeting.facilitator) && (
          <>
            <Divider sx={{ my: 3 }} />
            <Grid container spacing={2}>
              {meeting.chairperson_name && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">Chairperson</Typography>
                  <Typography variant="body1">{meeting.chairperson_name}</Typography>
                </Grid>
              )}
              {meeting.facilitator && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">Facilitator</Typography>
                  <Typography variant="body1">{meeting.facilitator}</Typography>
                </Grid>
              )}
            </Grid>
          </>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`Participants (${meeting.participants?.length || 0})`} />
          <Tab label={`Minutes & Actions (${meeting.minutes?.length || 0})`} />
          <Tab label="Documents" />
        </Tabs>

        {/* Participants */}
        <TabPanel value={tabValue} index={0}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button startIcon={<AddIcon />} variant="outlined" size="small">Add Participant</Button>
          </Box>
          {!meeting.participants?.length ? (
            <Typography color="text.secondary" textAlign="center" py={4}>No participants added yet</Typography>
          ) : (
            <List>
              {meeting.participants.map((p) => (
                <ListItem key={p.id} sx={{ bgcolor: '#f8fafc', borderRadius: 1, mb: 1 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: p.is_chairperson ? '#1976d2' : '#4caf50' }}>
                      {p.name?.charAt(0) || 'P'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography fontWeight={600}>{p.name}</Typography>
                        {p.is_chairperson && <Chip label="Chairperson" size="small" color="primary" />}
                      </Box>
                    }
                    secondary={[p.email, p.telephone].filter(Boolean).join(' · ')}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Minutes & Actions */}
        <TabPanel value={tabValue} index={1}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => setShowAddActionDialog(true)} disabled={updating}>
              Add Action Item
            </Button>
          </Box>
          {!meeting.minutes?.length ? (
            <Typography color="text.secondary" textAlign="center" py={4}>No minutes recorded yet</Typography>
          ) : (
            meeting.minutes.map((minutes) => (
              <Card key={minutes.id} sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary" fontWeight={600}>{minutes.topic}</Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>{minutes.discussion}</Typography>
                  {minutes.decisions && (
                    <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600}>Decisions Made:</Typography>
                      <Typography variant="body2">{minutes.decisions}</Typography>
                    </Alert>
                  )}
                  {minutes.actions?.length > 0 && (
                    <Box mt={3}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Action Items ({minutes.actions.length})
                      </Typography>
                      {minutes.actions.map((action) => {
                        const actionStatus = action.overall_status;
                        let actionStatusInfo = null;
                        if (actionStatus?.extra_metadata) {
                          actionStatusInfo = {
                            label: actionStatus.short_name?.toUpperCase() || actionStatus.name,
                            color: actionStatus.extra_metadata.color,
                            icon: getIconFromName(actionStatus.extra_metadata.icon),
                          };
                        }
                        return (
                          <Paper key={action.id} sx={{ mb: 2, p: 2, bgcolor: '#fafafa' }} elevation={0}>
                            <Stack spacing={1.5}>
                              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                <Box flex={1}>
                                  <Typography variant="subtitle2" fontWeight={600}>{action.description}</Typography>
                                  <Stack direction="row" spacing={2} mt={1} flexWrap="wrap">
                                    <Chip size="small" icon={<PersonIcon />} label={`Assigned to: ${action.assigned_to_name || 'Unassigned'}`} />
                                    <Chip size="small" icon={<ScheduleIcon />} label={`Due: ${formatDate(action.due_date)}`} />
                                    <Chip size="small" icon={<PriorityIcon />} label={`Priority: ${action.priority}`} color={action.priority <= 2 ? 'error' : 'default'} />
                                    {actionStatusInfo && (
                                      <Chip 
                                        size="small" 
                                        icon={actionStatusInfo.icon}
                                        label={actionStatusInfo.label}
                                        sx={{ bgcolor: `${actionStatusInfo.color}15`, color: actionStatusInfo.color }}
                                      />
                                    )}
                                  </Stack>
                                </Box>
                                <Box textAlign="right" minWidth={120}>
                                  <Typography variant="caption" color="text.secondary">Progress</Typography>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={action.overall_progress_percentage || 0}
                                      sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                    />
                                    <Typography variant="caption" fontWeight={600}>
                                      {action.overall_progress_percentage || 0}%
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                              {action.overall_progress_percentage !== 100 && (
                                <Box display="flex" justifyContent="flex-end">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleUpdateActionProgress(
                                      action.id,
                                      Math.min((action.overall_progress_percentage || 0) + 25, 100)
                                    )}
                                    disabled={updating}
                                  >
                                    Update Progress
                                  </Button>
                                </Box>
                              )}
                              {action.completed_at && (
                                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 1 }}>
                                  Completed on {formatDateTime(action.completed_at)}
                                </Alert>
                              )}
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabPanel>

        {/* Documents */}
        <TabPanel value={tabValue} index={2}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button startIcon={<FileUploadIcon />} variant="outlined" size="small">Upload Document</Button>
          </Box>
          <Typography color="text.secondary" textAlign="center" py={4}>No documents uploaded yet</Typography>
        </TabPanel>
      </Paper>

      {/* Change Status Dialog */}
      <Dialog open={showEditStatusDialog} onClose={() => setShowEditStatusDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Meeting Status</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Current status:{' '}
            <Chip 
              size="small" 
              icon={statusInfo.icon}
              label={statusInfo.label}
              sx={{ bgcolor: `${statusInfo.color}15`, color: statusInfo.color }} 
            />
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>New Status</InputLabel>
            <Select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} label="New Status">
              {statusOptions.map((option) => {
                const metadata = option.extra_metadata || {};
                const icon = getIconFromName(metadata.icon);
                const color = metadata.color || option.color || '#64748b';
                const displayLabel = option.short_name?.toUpperCase() || option.label;
                return (
                  <MenuItem key={option.value} value={option.value}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box sx={{ color: color }}>{icon}</Box>
                      <Box>
                        <Typography variant="body2">{displayLabel}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {metadata.description || option.description}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditStatusDialog(false)}>Cancel</Button>
          <Button
            onClick={() => handleStatusChange(selectedStatus)}
            variant="contained"
            disabled={selectedStatus === currentStatusValue || updating}
          >
            {updating ? <CircularProgress size={20} /> : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Action Dialog */}
      <Dialog open={showAddActionDialog} onClose={() => setShowAddActionDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Action Item</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={12}>
              <TextField fullWidth label="Description" multiline rows={3} value={newAction.description}
                onChange={(e) => setNewAction({ ...newAction, description: e.target.value })} required />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Assigned To" value={newAction.assigned_to_name}
                onChange={(e) => setNewAction({ ...newAction, assigned_to_name: e.target.value })}
                placeholder="Enter person's name" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth type="datetime-local" label="Due Date" InputLabelProps={{ shrink: true }}
                value={newAction.due_date} onChange={(e) => setNewAction({ ...newAction, due_date: e.target.value })} />
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select value={newAction.priority} onChange={(e) => setNewAction({ ...newAction, priority: e.target.value })} label="Priority">
                  <MenuItem value={1}>🔴 High - Due within 3 days</MenuItem>
                  <MenuItem value={2}>🟠 Medium - Due within 7 days</MenuItem>
                  <MenuItem value={3}>🟢 Low - Due within 14 days</MenuItem>
                  <MenuItem value={4}>⚪ Very Low - No strict deadline</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddActionDialog(false)}>Cancel</Button>
          <Button onClick={handleAddAction} variant="contained" disabled={!newAction.description || updating}>
            {updating ? <CircularProgress size={20} /> : 'Add Action'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default MeetingDetail;