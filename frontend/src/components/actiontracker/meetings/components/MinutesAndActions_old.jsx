import React, { useState, useEffect } from 'react';
import { 
  Card, CardContent, Typography, Box, Button, 
  Stack, Chip, Divider, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Collapse, LinearProgress, Alert,
  Paper, Grid, FormControl, InputLabel, Select, MenuItem,
  CircularProgress, InputAdornment
} from '@mui/material';
import { 
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, 
  Person as PersonIcon, Schedule as ScheduleIcon, 
  Comment as CommentIcon, PriorityHigh as PriorityIcon,
  CheckCircle as CheckCircleIcon, Search as SearchIcon,
  PersonAdd as PersonAddIcon, Group as GroupIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

// User/Participant Search Component
const AssignToSelector = ({ value, onChange, disabled, label = "Assign To", meetingId }) => {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], participants: [] });
  const [searching, setSearching] = useState(false);
  const [searchType, setSearchType] = useState('users'); // 'users', 'participants', 'new'
  const [manualEntry, setManualEntry] = useState({ name: '', email: '' });
  const [addingNew, setAddingNew] = useState(false);

  // Search users and participants
  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 2) return;
    
    setSearching(true);
    try {
      // Search users
      const userResponse = await api.get(`/users/?skip=0&limit=50`);
      const allUsers = userResponse.data?.items || userResponse.data || [];
      const filteredUsers = allUsers.filter(u => 
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      // Search participants from current meeting (if meetingId provided)
      let participants = [];
      if (meetingId) {
        try {
          const participantResponse = await api.get(`/action-tracker/meetings/${meetingId}/participants`);
          participants = participantResponse.data || [];
          const filteredParticipants = participants.filter(p =>
            p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchTerm.toLowerCase())
          );
          setSearchResults({ users: filteredUsers, participants: filteredParticipants });
        } catch (err) {
          setSearchResults({ users: filteredUsers, participants: [] });
        }
      } else {
        setSearchResults({ users: filteredUsers, participants: [] });
      }
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults({ users: [], participants: [] });
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (searchDialogOpen && searchTerm.length >= 2) {
      const debounce = setTimeout(handleSearch, 300);
      return () => clearTimeout(debounce);
    }
  }, [searchTerm, searchDialogOpen]);

  const handleSelectUser = (user) => {
    onChange({
      type: 'user',
      id: user.id,
      name: user.full_name || user.username,
      email: user.email,
      assigned_to_id: user.id,
      assigned_to_name: user.full_name || user.username
    });
    setSearchDialogOpen(false);
    setSearchTerm('');
  };

  const handleSelectParticipant = (participant) => {
    onChange({
      type: 'participant',
      id: participant.id,
      name: participant.name,
      email: participant.email,
      assigned_to_name: participant.name,
      assigned_to_id: null
    });
    setSearchDialogOpen(false);
    setSearchTerm('');
  };

  const handleAddNew = () => {
    if (!manualEntry.name.trim()) return;
    
    onChange({
      type: 'new',
      name: manualEntry.name,
      email: manualEntry.email,
      assigned_to_name: manualEntry.name,
      assigned_to_id: null,
      metadata: {
        name: manualEntry.name,
        email: manualEntry.email
      }
    });
    setSearchDialogOpen(false);
    setManualEntry({ name: '', email: '' });
    setAddingNew(false);
  };

  const displayValue = value ? value.name : '';

  return (
    <>
      <TextField
        fullWidth
        label={label}
        value={displayValue}
        onClick={() => setSearchDialogOpen(true)}
        disabled={disabled}
        placeholder="Click to search for user or participant"
        InputProps={{
          readOnly: true,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setSearchDialogOpen(true)} edge="end">
                <SearchIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      
      {/* Search Dialog */}
      <Dialog open={searchDialogOpen} onClose={() => setSearchDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Assign To</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Search Input */}
            <TextField
              fullWidth
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              InputProps={{
                endAdornment: searching && <CircularProgress size={20} />,
              }}
            />
            
            {/* Tabs for different sources */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 2 }}>
              <Button 
                size="small" 
                variant={searchType === 'users' ? 'contained' : 'text'}
                onClick={() => setSearchType('users')}
                startIcon={<PersonIcon />}
              >
                Users
              </Button>
              <Button 
                size="small" 
                variant={searchType === 'participants' ? 'contained' : 'text'}
                onClick={() => setSearchType('participants')}
                startIcon={<GroupIcon />}
              >
                Meeting Participants
              </Button>
              <Button 
                size="small" 
                variant={searchType === 'new' ? 'contained' : 'text'}
                onClick={() => setSearchType('new')}
                startIcon={<PersonAddIcon />}
              >
                Add New Person
              </Button>
            </Box>
            
            {/* Users List */}
            {searchType === 'users' && (
              <>
                {searchResults.users.length === 0 && searchTerm.length >= 2 && !searching ? (
                  <Alert severity="info">No users found. Try searching participants or add a new person.</Alert>
                ) : (
                  <Stack spacing={1} maxHeight={400} sx={{ overflowY: 'auto' }}>
                    {searchResults.users.map((user) => (
                      <Paper
                        key={user.id}
                        sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                        onClick={() => handleSelectUser(user)}
                      >
                        <Typography fontWeight={600}>{user.full_name || user.username}</Typography>
                        <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </>
            )}
            
            {/* Participants List */}
            {searchType === 'participants' && (
              <>
                {searchResults.participants.length === 0 && searchTerm.length >= 2 && !searching ? (
                  <Alert severity="info">No participants found. Try searching users or add a new person.</Alert>
                ) : (
                  <Stack spacing={1} maxHeight={400} sx={{ overflowY: 'auto' }}>
                    {searchResults.participants.map((participant) => (
                      <Paper
                        key={participant.id}
                        sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                        onClick={() => handleSelectParticipant(participant)}
                      >
                        <Typography fontWeight={600}>{participant.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{participant.email || 'No email'}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </>
            )}
            
            {/* Add New Person Form */}
            {searchType === 'new' && (
              <Stack spacing={2}>
                <Alert severity="info">
                  This person will be saved with the action. They will appear in meeting participants if added.
                </Alert>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={manualEntry.name}
                  onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                  required
                />
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={manualEntry.email}
                  onChange={(e) => setManualEntry({ ...manualEntry, email: e.target.value })}
                  placeholder="optional@example.com"
                />
                <Button 
                  variant="contained" 
                  onClick={handleAddNew}
                  disabled={!manualEntry.name.trim()}
                >
                  Add and Assign
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const MinutesAndActions = ({ minutes, meetingId, onUpdate }) => {
  // Minutes state
  const [openMinutesDialog, setOpenMinutesDialog] = useState(false);
  const [editingMinutes, setEditingMinutes] = useState(null);
  const [minutesFormData, setMinutesFormData] = useState({ topic: '', discussion: '', decisions: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedDiscussions, setExpandedDiscussions] = useState({});
  const [expandedDecisions, setExpandedDecisions] = useState({});

  // Actions state
  const [openActionDialog, setOpenActionDialog] = useState(false);
  const [selectedMinuteId, setSelectedMinuteId] = useState(null);
  const [editingAction, setEditingAction] = useState(null);
  const [actionFormData, setActionFormData] = useState({
    description: '',
    assigned_to: null,
    due_date: null,
    priority: 2,
    remarks: ''
  });
  const [updatingProgress, setUpdatingProgress] = useState(false);

  // Comments state
  const [openCommentsDialog, setOpenCommentsDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const toggleDiscussion = (id) => {
    setExpandedDiscussions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDecisions = (id) => {
    setExpandedDecisions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ==================== MINUTES CRUD ====================
  const handleOpenMinutesDialog = (minutes = null) => {
    if (minutes) {
      setEditingMinutes(minutes);
      setMinutesFormData({ 
        topic: minutes.topic, 
        discussion: minutes.discussion || '', 
        decisions: minutes.decisions || '' 
      });
    } else {
      setEditingMinutes(null);
      setMinutesFormData({ topic: '', discussion: '', decisions: '' });
    }
    setOpenMinutesDialog(true);
  };

  const handleSaveMinutes = async () => {
    if (!minutesFormData.topic.trim()) {
      setError("Topic is required");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const payload = {
        topic: minutesFormData.topic.trim(),
        discussion: minutesFormData.discussion || '',
        decisions: minutesFormData.decisions || ''
      };
      
      if (editingMinutes) {
        await api.put(`/action-tracker/minutes/${editingMinutes.id}`, payload);
      } else {
        await api.post(`/action-tracker/meetings/${meetingId}/minutes`, payload);
      }
      onUpdate();
      setOpenMinutesDialog(false);
      setMinutesFormData({ topic: '', discussion: '', decisions: '' });
    } catch (err) {
      console.error("Save failed", err);
      setError(err.response?.data?.detail || "Failed to save minutes");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMinutes = async (id) => {
    if (!window.confirm("Delete these minutes? All associated actions will be deleted.")) return;
    setLoading(true);
    try {
      await api.delete(`/action-tracker/minutes/${id}`);
      onUpdate();
    } catch (err) { 
      setError("Failed to delete minutes");
    } finally {
      setLoading(false);
    }
  };

  // ==================== ACTIONS CRUD ====================
  const handleOpenActionDialog = (minuteId, action = null) => {
    setSelectedMinuteId(minuteId);
    if (action) {
      setEditingAction(action);
      setActionFormData({
        description: action.description || '',
        assigned_to: action.assigned_to_id ? {
          type: 'user',
          id: action.assigned_to_id,
          name: action.assigned_to_name || action.assigned_to?.username,
          assigned_to_id: action.assigned_to_id,
          assigned_to_name: action.assigned_to_name
        } : (action.assigned_to_name ? {
          type: 'manual',
          name: action.assigned_to_name,
          assigned_to_name: action.assigned_to_name
        } : null),
        due_date: action.due_date || null,
        priority: action.priority || 2,
        remarks: action.remarks || ''
      });
    } else {
      setEditingAction(null);
      setActionFormData({
        description: '',
        assigned_to: null,
        due_date: null,
        priority: 2,
        remarks: ''
      });
    }
    setOpenActionDialog(true);
  };

    const handleSaveAction = async () => {
    if (!actionFormData.description.trim()) {
        setError("Description is required");
        return;
    }

    setLoading(true);
    setError(null);
    try {
        const payload = {
        description: actionFormData.description.trim(),
        due_date: actionFormData.due_date ? new Date(actionFormData.due_date).toISOString() : null,
        priority: actionFormData.priority,
        remarks: actionFormData.remarks || ''
        };
        
        // Handle assignment based on selection type
        if (actionFormData.assigned_to) {
        if (actionFormData.assigned_to.type === 'user' && actionFormData.assigned_to.assigned_to_id) {
            // Existing user - save to assigned_to_id and assigned_to_name
            payload.assigned_to_id = actionFormData.assigned_to.assigned_to_id;
            payload.assigned_to_name = actionFormData.assigned_to.name;
            console.log("Assigning to existing user:", payload.assigned_to_name);
        } else if (actionFormData.assigned_to.type === 'participant') {
            // Meeting participant - save name only
            payload.assigned_to_name = actionFormData.assigned_to.name;
            console.log("Assigning to participant:", payload.assigned_to_name);
        } else {
            // New person - save to assigned_to_name
            payload.assigned_to_name = actionFormData.assigned_to.name;
            console.log("Assigning to new person:", payload.assigned_to_name);
        }
        }
        
        console.log("Sending payload:", payload);
        
        let response;
        if (editingAction) {
        response = await api.put(`/action-tracker/actions/${editingAction.id}`, payload);
        } else {
        response = await api.post(`/action-tracker/actions/minutes/${selectedMinuteId}/actions`, payload);
        }
        
        console.log("Response:", response.data);
        onUpdate();
        setOpenActionDialog(false);
        setActionFormData({
        description: '',
        assigned_to: null,
        due_date: null,
        priority: 2,
        remarks: ''
        });
    } catch (err) {
        console.error("Save action failed", err);
        console.error("Error response:", err.response?.data);
        setError(err.response?.data?.detail || "Failed to save action");
    } finally {
        setLoading(false);
    }
    };

  const handleDeleteAction = async (actionId) => {
    if (!window.confirm("Delete this action item?")) return;
    setLoading(true);
    try {
      await api.delete(`/action-tracker/actions/${actionId}`);
      onUpdate();
    } catch (err) {
      setError("Failed to delete action");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async (actionId, currentProgress) => {
    setUpdatingProgress(true);
    try {
      await api.post(`/action-tracker/actions/${actionId}/progress`, {
        overall_progress_percentage: Math.min(currentProgress + 25, 100)
      });
      onUpdate();
    } catch (err) {
      setError("Failed to update progress");
    } finally {
      setUpdatingProgress(false);
    }
  };

  // ==================== COMMENTS CRUD ====================
  const handleViewComments = async (action) => {
    setSelectedAction(action);
    setOpenCommentsDialog(true);
    setLoadingComments(true);
    try {
      const response = await api.get(`/action-tracker/actions/${action.id}/comments`);
      setComments(response.data || []);
    } catch (err) {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      await api.post(`/action-tracker/actions/${selectedAction.id}/comments`, {
        comment: newComment
      });
      setNewComment('');
      const response = await api.get(`/action-tracker/actions/${selectedAction.id}/comments`);
      setComments(response.data || []);
      onUpdate();
    } catch (err) {
      setError("Failed to add comment");
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return 'error';
      case 2: return 'warning';
      case 3: return 'info';
      default: return 'default';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 1: return 'High';
      case 2: return 'Medium';
      case 3: return 'Low';
      default: return 'Very Low';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => handleOpenMinutesDialog()}
          disabled={loading}
        >
          Add Minutes
        </Button>
      </Box>

      {/* Minutes List */}
      {minutes?.length === 0 ? (
        <Alert severity="info">No minutes recorded. Click "Add Minutes" to get started.</Alert>
      ) : (
        minutes?.map((minute) => {
          const hasDiscussion = minute.discussion && minute.discussion.trim() !== '';
          const hasDecisions = minute.decisions && minute.decisions.trim() !== '';

          return (
            <Card key={minute.id} variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
              <CardContent>
                {/* Minutes Header */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="h6" color="primary" fontWeight={600}>
                    {minute.topic}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Edit Minutes">
                      <IconButton size="small" onClick={() => handleOpenMinutesDialog(minute)} disabled={loading}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Minutes">
                      <IconButton size="small" color="error" onClick={() => handleDeleteMinutes(minute.id)} disabled={loading}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                {/* Minutes Audit Info */}
                <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
                  <Chip 
                    icon={<PersonIcon />} 
                    label={`Recorded by: ${minute.recorded_by_name || minute.created_by_name || 'System'}`} 
                    size="small" 
                    variant="outlined"
                  />
                  <Chip 
                    icon={<ScheduleIcon />} 
                    label={`Created: ${formatDateTime(minute.created_at)}`} 
                    size="small" 
                    variant="outlined"
                  />
                  {minute.updated_at && minute.updated_at !== minute.created_at && (
                    <Chip 
                      label={`Updated: ${formatDateTime(minute.updated_at)}`} 
                      size="small" 
                      variant="outlined"
                      color="secondary"
                    />
                  )}
                </Stack>

                {/* Discussion */}
                {hasDiscussion && (
                  <>
                    <Typography 
                      variant="subtitle2" 
                      onClick={() => toggleDiscussion(minute.id)} 
                      sx={{ cursor: 'pointer', color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      {expandedDiscussions[minute.id] ? '▼' : '▶'} Discussion
                    </Typography>
                    <Collapse in={expandedDiscussions[minute.id]}>
                      <Typography variant="body2" sx={{ mt: 1, pl: 2, whiteSpace: 'pre-wrap' }}>
                        {minute.discussion}
                      </Typography>
                    </Collapse>
                  </>
                )}

                {/* Decisions */}
                {hasDecisions && (
                  <>
                    <Typography 
                      variant="subtitle2" 
                      onClick={() => toggleDecisions(minute.id)} 
                      sx={{ cursor: 'pointer', color: 'success.main', mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      {expandedDecisions[minute.id] ? '▼' : '▶'} Decisions
                    </Typography>
                    <Collapse in={expandedDecisions[minute.id]}>
                      <Typography variant="body2" sx={{ mt: 1, pl: 2, whiteSpace: 'pre-wrap' }}>
                        {minute.decisions}
                      </Typography>
                    </Collapse>
                  </>
                )}

                {/* Actions Section */}
                <Box mt={3}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Action Items ({minute.actions?.length || 0})
                    </Typography>
                    <Button 
                      size="small" 
                      startIcon={<AddIcon />} 
                      onClick={() => handleOpenActionDialog(minute.id)}
                      disabled={loading}
                    >
                      Add Action
                    </Button>
                  </Box>

                  {minute.actions?.length > 0 ? (
                    <Stack spacing={2}>
                      {minute.actions.map((action) => (
                        <Paper key={action.id} sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2 }} elevation={0}>
                          <Stack spacing={1.5}>
                            {/* Action Header */}
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                              <Box flex={1}>
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {action.description}
                                </Typography>
                                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                                  <Chip 
                                    size="small" 
                                    icon={<PersonIcon />} 
                                    label={`Assigned to: ${action.assigned_to_name || action.assigned_to?.username || 'Unassigned'}`} 
                                  />
                                  <Chip 
                                    size="small" 
                                    icon={<ScheduleIcon />} 
                                    label={`Due: ${formatDate(action.due_date)}`} 
                                  />
                                  <Chip 
                                    size="small" 
                                    icon={<PriorityIcon />} 
                                    label={`Priority: ${getPriorityLabel(action.priority)}`}
                                    color={getPriorityColor(action.priority)}
                                  />
                                  <Chip 
                                    size="small" 
                                    icon={<CommentIcon />} 
                                    label={`Comments: ${action.comments?.length || 0}`}
                                    onClick={() => handleViewComments(action)}
                                    sx={{ cursor: 'pointer' }}
                                  />
                                </Stack>
                                {action.remarks && (
                                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                    <strong>Remarks:</strong> {action.remarks}
                                  </Typography>
                                )}
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

                            {/* Action Buttons */}
                            <Box display="flex" justifyContent="flex-end" gap={1}>
                              {action.overall_progress_percentage !== 100 && (
                                <Button 
                                  size="small" 
                                  variant="outlined"
                                  onClick={() => handleUpdateProgress(action.id, action.overall_progress_percentage || 0)}
                                  disabled={updatingProgress}
                                >
                                  Update Progress (+25%)
                                </Button>
                              )}
                              <Button 
                                size="small" 
                                startIcon={<EditIcon />}
                                onClick={() => handleOpenActionDialog(minute.id, action)}
                                disabled={loading}
                              >
                                Edit
                              </Button>
                              <Button 
                                size="small" 
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => handleDeleteAction(action.id)}
                                disabled={loading}
                              >
                                Delete
                              </Button>
                            </Box>

                            {/* Completion Status */}
                            {action.completed_at && (
                              <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 1 }}>
                                Completed on {formatDateTime(action.completed_at)}
                              </Alert>
                            )}

                            {/* Action Audit Info */}
                            <Divider />
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Chip 
                                size="small" 
                                label={`Created by: ${action.created_by_name || 'System'} on ${formatDateTime(action.created_at)}`}
                                variant="outlined"
                              />
                              {action.updated_at && action.updated_at !== action.created_at && (
                                <Chip 
                                  size="small" 
                                  label={`Updated by: ${action.updated_by_name || 'System'} on ${formatDateTime(action.updated_at)}`}
                                  variant="outlined"
                                  color="secondary"
                                />
                              )}
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      No action items. Click "Add Action" to create one.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Add/Edit Minutes Dialog */}
      <Dialog open={openMinutesDialog} onClose={() => setOpenMinutesDialog(false)} fullWidth maxWidth="md">
        <DialogTitle>{editingMinutes ? 'Edit Minutes' : 'Add Minutes'}</DialogTitle>
        {loading && <LinearProgress />}
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField 
              label="Topic" 
              fullWidth 
              required
              value={minutesFormData.topic} 
              onChange={(e) => setMinutesFormData({...minutesFormData, topic: e.target.value})} 
            />
            <TextField
              fullWidth
              label="Discussion"
              multiline
              rows={6}
              value={minutesFormData.discussion}
              onChange={(e) => setMinutesFormData({...minutesFormData, discussion: e.target.value})}
              placeholder="Enter discussion points..."
            />
            <TextField
              fullWidth
              label="Decisions Made"
              multiline
              rows={4}
              value={minutesFormData.decisions}
              onChange={(e) => setMinutesFormData({...minutesFormData, decisions: e.target.value})}
              placeholder="Enter decisions made..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMinutesDialog(false)} disabled={loading}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveMinutes} disabled={loading || !minutesFormData.topic.trim()}>
            {editingMinutes ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Action Dialog with User Search */}
      <Dialog open={openActionDialog} onClose={() => setOpenActionDialog(false)} fullWidth maxWidth="md">
        <DialogTitle>{editingAction ? 'Edit Action' : 'Add Action'}</DialogTitle>
        {loading && <LinearProgress />}
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={actionFormData.description}
                onChange={(e) => setActionFormData({...actionFormData, description: e.target.value})}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <AssignToSelector
                value={actionFormData.assigned_to}
                onChange={(user) => setActionFormData({...actionFormData, assigned_to: user})}
                disabled={loading}
                label="Assign To"
                meetingId={meetingId}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Due Date"
                value={actionFormData.due_date ? new Date(actionFormData.due_date).toISOString().slice(0, 16) : ''}
                onChange={(e) => setActionFormData({...actionFormData, due_date: e.target.value ? new Date(e.target.value).toISOString() : null})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={actionFormData.priority}
                  onChange={(e) => setActionFormData({...actionFormData, priority: e.target.value})}
                  label="Priority"
                >
                  <MenuItem value={1}>🔴 High - Due within 3 days</MenuItem>
                  <MenuItem value={2}>🟠 Medium - Due within 7 days</MenuItem>
                  <MenuItem value={3}>🟢 Low - Due within 14 days</MenuItem>
                  <MenuItem value={4}>⚪ Very Low - No strict deadline</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Remarks"
                multiline
                rows={2}
                value={actionFormData.remarks}
                onChange={(e) => setActionFormData({...actionFormData, remarks: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenActionDialog(false)} disabled={loading}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAction} disabled={loading || !actionFormData.description.trim()}>
            {editingAction ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={openCommentsDialog} onClose={() => setOpenCommentsDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Comments - {selectedAction?.description?.substring(0, 50)}...</DialogTitle>
        <DialogContent>
          {loadingComments ? (
            <Box textAlign="center" py={3}><CircularProgress size={24} /></Box>
          ) : (
            <Stack spacing={2}>
              {comments.length === 0 ? (
                <Typography color="text.secondary" textAlign="center">No comments yet</Typography>
              ) : (
                comments.map((comment) => (
                  <Paper key={comment.id} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                    <Typography variant="body2">{comment.comment}</Typography>
                    <Stack direction="row" spacing={1} mt={1}>
                      <Chip size="small" label={`By: ${comment.created_by_name || 'System'}`} variant="outlined" />
                      <Chip size="small" label={formatDateTime(comment.created_at)} variant="outlined" />
                    </Stack>
                  </Paper>
                ))
              )}
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Add a comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCommentsDialog(false)}>Close</Button>
          <Button variant="contained" onClick={handleAddComment} disabled={!newComment.trim() || loading}>
            Add Comment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MinutesAndActions;