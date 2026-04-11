
// src/components/actiontracker/participants/AddParticipantsToList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Pagination,
  useMediaQuery,
  useTheme,
  Fade,
  Snackbar,
  Paper,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  PersonAdd as PersonAddIcon,
  People as PeopleIcon,
  GroupAdd as GroupAddIcon,
  Clear as ClearIcon,
  CheckCircle as CheckCircleIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  AddCircle as AddCircleIcon
} from '@mui/icons-material';
import {
  fetchAvailableParticipants,
  addMembersToList,
  createParticipant,
  clearError
} from '../../../store/slices/actionTracker/participantSlice';

const AddParticipantsToList = ({ open, onClose, onSuccess, listId, listName }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { availableParticipants, loading } = useSelector((state) => state.participants);
  
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [successMessage, setSuccessMessage] = useState(null);
  const [error, setError] = useState(null);
  
  // New participant form
  const [newParticipant, setNewParticipant] = useState({
    name: '',
    email: '',
    telephone: '',
    title: '',
    organization: '',
    notes: ''
  });
  const [creating, setCreating] = useState(false);
  
  const itemsPerPage = isMobile ? 10 : 20;
  
  // Get available participants data from Redux
  const availableData = availableParticipants[listId] || { items: [], total: 0, pages: 1 };
  const participants = availableData.items || [];
  const totalPages = availableData.pages || 1;
  
  // Fetch available participants
  const fetchData = useCallback(() => {
    if (listId && open && activeTab === 0) {
      dispatch(fetchAvailableParticipants({
        listId,
        params: {
          skip: (page - 1) * itemsPerPage,
          limit: itemsPerPage,
          search: searchTerm || undefined
        }
      }));
    }
  }, [dispatch, listId, open, activeTab, page, searchTerm, itemsPerPage]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Handle participant selection
  const handleToggleParticipant = (participant) => {
    setSelectedParticipants(prev => {
      const isSelected = prev.some(p => p.id === participant.id);
      if (isSelected) {
        return prev.filter(p => p.id !== participant.id);
      } else {
        return [...prev, participant];
      }
    });
  };
  
  // Handle select all on current page
  const handleSelectAll = () => {
    if (selectedParticipants.length === participants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants([...participants]);
    }
  };
  
  // Handle submit selected participants
  const handleSubmitSelected = async () => {
    if (selectedParticipants.length === 0) return;
    
    setSubmitting(true);
    setError(null);
    try {
      await dispatch(addMembersToList({
        listId,
        participantIds: selectedParticipants.map(p => p.id)
      })).unwrap();
      
      setSuccessMessage(`Successfully added ${selectedParticipants.length} participant(s) to "${listName}"`);
      setSelectedParticipants([]);
      
      // Refresh the available participants list
      fetchData();
      
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to add participants');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handle create new participant
  const handleCreateParticipant = async () => {
    if (!newParticipant.name.trim()) {
      setError('Name is required');
      return;
    }
    
    setCreating(true);
    setError(null);
    try {
      const result = await dispatch(createParticipant(newParticipant)).unwrap();
      
      setSuccessMessage(`Participant "${result.name}" created successfully`);
      setNewParticipant({
        name: '',
        email: '',
        telephone: '',
        title: '',
        organization: '',
        notes: ''
      });
      
      // If we have a list, add the new participant to it
      if (listId) {
        await dispatch(addMembersToList({
          listId,
          participantIds: [result.id]
        })).unwrap();
        setSuccessMessage(`Participant "${result.name}" created and added to "${listName}"`);
      }
      
      // Refresh available participants
      fetchData();
      
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to create participant');
    } finally {
      setCreating(false);
    }
  };
  
  const handleClearSelections = () => {
    setSelectedParticipants([]);
  };
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };
  
  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            height: isMobile ? '100%' : '80vh',
            maxHeight: isMobile ? '100%' : '80vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, p: isMobile ? 2 : 2.5 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700}>
                Add Participants to List
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {listName || 'Participant List'}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, v) => setActiveTab(v)}
            sx={{ borderBottom: `1px solid ${theme.palette.divider}`, px: isMobile ? 1 : 2 }}
          >
            <Tab 
              icon={<PeopleIcon />} 
              iconPosition="start" 
              label="Existing Participants" 
              sx={{ textTransform: 'none', minHeight: 48 }}
            />
            <Tab 
              icon={<PersonAddIcon />} 
              iconPosition="start" 
              label="Create New" 
              sx={{ textTransform: 'none', minHeight: 48 }}
            />
          </Tabs>
          
          {/* Tab 1: Existing Participants */}
          {activeTab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Search Bar */}
              <Box sx={{ p: isMobile ? 2 : 2.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <TextField
                  fullWidth
                  placeholder="Search participants by name, email, or organization..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  size={isMobile ? "small" : "medium"}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchTerm('')}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
              
              {/* Selection Summary */}
              {selectedParticipants.length > 0 && (
                <Fade in>
                  <Box sx={{ 
                    p: isMobile ? 1.5 : 2, 
                    bgcolor: '#e8eaf6', 
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 1
                  }}>
                    <Typography variant="body2" fontWeight={500}>
                      {selectedParticipants.length} participant(s) selected
                    </Typography>
                    <Box display="flex" gap={1}>
                      <Button size="small" onClick={handleClearSelections} startIcon={<ClearIcon />}>
                        Clear
                      </Button>
                      <Button 
                        size="small" 
                        variant="contained" 
                        onClick={handleSubmitSelected}
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={16} /> : <GroupAddIcon />}
                      >
                        {submitting ? 'Adding...' : `Add ${selectedParticipants.length}`}
                      </Button>
                    </Box>
                  </Box>
                </Fade>
              )}
              
              {/* Error Alert */}
              {error && (
                <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
              
              {/* Participants List */}
              <Box sx={{ flex: 1, overflow: 'auto', p: isMobile ? 1.5 : 2 }}>
                {loading ? (
                  <Box display="flex" justifyContent="center" py={5}>
                    <CircularProgress />
                  </Box>
                ) : participants.length === 0 ? (
                  <Box textAlign="center" py={5}>
                    <PeopleIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
                    <Typography color="text.secondary" gutterBottom>
                      {searchTerm ? 'No participants match your search' : 'No participants available'}
                    </Typography>
                    {searchTerm && (
                      <Button 
                        size="small" 
                        onClick={() => setSearchTerm('')}
                        sx={{ mt: 1 }}
                      >
                        Clear search
                      </Button>
                    )}
                    {!searchTerm && (
                      <Button
                        variant="outlined"
                        startIcon={<PersonAddIcon />}
                        onClick={() => setActiveTab(1)}
                        sx={{ mt: 2 }}
                      >
                        Create a new participant
                      </Button>
                    )}
                  </Box>
                ) : (
                  <>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        Showing {participants.length} of {availableData.total || participants.length} participants
                      </Typography>
                      <Button size="small" onClick={handleSelectAll} startIcon={<AddCircleIcon />}>
                        {selectedParticipants.length === participants.length ? 'Deselect All' : 'Select All Page'}
                      </Button>
                    </Box>
                    
                    <List dense={!isMobile}>
                      {participants.map((participant, index) => (
                        <ListItem
                          key={participant.id}
                          button
                          onClick={() => handleToggleParticipant(participant)}
                          sx={{
                            borderRadius: 1,
                            mb: 0.5,
                            bgcolor: selectedParticipants.some(p => p.id === participant.id) ? 'action.selected' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <Checkbox
                            checked={selectedParticipants.some(p => p.id === participant.id)}
                            onChange={() => handleToggleParticipant(participant)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: '#6366f1' }}>
                              {participant.name?.charAt(0)?.toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="body1" fontWeight={500}>
                                {participant.name}
                              </Typography>
                            }
                            secondary={
                              <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5} mt={0.5}>
                                {participant.email && (
                                  <Chip 
                                    icon={<EmailIcon sx={{ fontSize: 14 }} />}
                                    label={participant.email} 
                                    size="small" 
                                    variant="outlined" 
                                    sx={{ fontSize: '0.7rem', height: 24 }}
                                  />
                                )}
                                {participant.telephone && (
                                  <Chip 
                                    icon={<PhoneIcon sx={{ fontSize: 14 }} />}
                                    label={participant.telephone} 
                                    size="small" 
                                    variant="outlined" 
                                    sx={{ fontSize: '0.7rem', height: 24 }}
                                  />
                                )}
                                {participant.organization && (
                                  <Chip 
                                    icon={<BusinessIcon sx={{ fontSize: 14 }} />}
                                    label={participant.organization} 
                                    size="small" 
                                    variant="outlined" 
                                    sx={{ fontSize: '0.7rem', height: 24 }}
                                  />
                                )}
                              </Stack>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </Box>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                  <Stack alignItems="center">
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={(_, val) => setPage(val)}
                      color="primary"
                      size={isMobile ? "small" : "medium"}
                      siblingCount={isMobile ? 0 : 1}
                    />
                  </Stack>
                </Box>
              )}
            </Box>
          )}
          
          {/* Tab 2: Create New Participant */}
          {activeTab === 1 && (
            <Box sx={{ p: isMobile ? 2 : 2.5, overflow: 'auto' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Create New Participant
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                After creation, the participant will be automatically added to this list
              </Typography>
              
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
              
              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  required
                  label="Full Name"
                  value={newParticipant.name}
                  onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                  placeholder="Enter participant's full name"
                  size={isMobile ? "medium" : "small"}
                />
                
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  value={newParticipant.email}
                  onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                  placeholder="email@example.com"
                  size={isMobile ? "medium" : "small"}
                />
                
                <TextField
                  fullWidth
                  label="Phone Number"
                  type="tel"
                  value={newParticipant.telephone}
                  onChange={(e) => setNewParticipant({ ...newParticipant, telephone: e.target.value })}
                  placeholder="+256712345678"
                  size={isMobile ? "medium" : "small"}
                />
                
                <TextField
                  fullWidth
                  label="Title / Role"
                  value={newParticipant.title}
                  onChange={(e) => setNewParticipant({ ...newParticipant, title: e.target.value })}
                  placeholder="e.g., Project Manager"
                  size={isMobile ? "medium" : "small"}
                />
                
                <TextField
                  fullWidth
                  label="Organization"
                  value={newParticipant.organization}
                  onChange={(e) => setNewParticipant({ ...newParticipant, organization: e.target.value })}
                  placeholder="Company name"
                  size={isMobile ? "medium" : "small"}
                />
                
                <TextField
                  fullWidth
                  multiline
                  rows={isMobile ? 3 : 2}
                  label="Notes (Optional)"
                  value={newParticipant.notes}
                  onChange={(e) => setNewParticipant({ ...newParticipant, notes: e.target.value })}
                  placeholder="Any additional information..."
                  size={isMobile ? "medium" : "small"}
                />
                
                <Divider />
                
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={creating ? <CircularProgress size={20} /> : <PersonAddIcon />}
                  onClick={handleCreateParticipant}
                  disabled={creating || !newParticipant.name.trim()}
                  sx={{ py: isMobile ? 1.5 : 1 }}
                >
                  {creating ? 'Creating...' : 'Create & Add to List'}
                </Button>
              </Stack>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ 
          p: isMobile ? 2 : 2.5, 
          borderTop: `1px solid ${theme.palette.divider}`,
          flexDirection: isMobile ? 'column-reverse' : 'row',
          gap: isMobile ? 1 : 0
        }}>
          <Button onClick={onClose} fullWidth={isMobile} size="large">
            Cancel
          </Button>
          {activeTab === 0 && (
            <Button 
              variant="contained" 
              onClick={handleSubmitSelected}
              disabled={selectedParticipants.length === 0 || submitting}
              fullWidth={isMobile}
              size="large"
              startIcon={submitting ? <CircularProgress size={20} /> : <GroupAddIcon />}
              sx={{ fontWeight: 600 }}
            >
              {submitting ? 'Adding...' : `Add ${selectedParticipants.length} Participant(s)`}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity="success" 
          onClose={() => setSuccessMessage(null)}
          icon={<CheckCircleIcon fontSize="inherit" />}
          sx={{ boxShadow: 3 }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default AddParticipantsToList;