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
  Divider,
  alpha,
  Tooltip,
  Zoom,
  Card,
  CardContent,
  Grid,
  FormHelperText
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
  AddCircle as AddCircleIcon,
  Check as CheckIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Badge as BadgeIcon,
  Star as StarIcon,
  Work as WorkIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchAvailableParticipants,
  addMembersToList,
  createParticipant,
  clearError
} from '../../../store/slices/actionTracker/participantSlice';
import api from '../../../services/api';

const AddParticipantsToList = ({ open, onClose, onSuccess, listId, listName }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDark = theme.palette.mode === 'dark';
  
  const dispatch = useDispatch();
  const { availableParticipants, loading } = useSelector((state) => state.participants);
  
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [successMessage, setSuccessMessage] = useState(null);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [fieldFocus, setFieldFocus] = useState({});
  
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
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);
  
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
      console.error('Failed to add participants:', err);
      setError(err.message || 'Failed to add participants');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Validate new participant form
  const validateNewParticipant = () => {
    const errors = {};
    
    if (!newParticipant.name.trim()) {
      errors.name = 'Name is required';
    } else if (newParticipant.name.length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    
    if (newParticipant.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newParticipant.email)) {
      errors.email = 'Enter a valid email address';
    }
    
    if (newParticipant.telephone) {
      const phoneDigits = newParticipant.telephone.replace(/\D/g, '');
      if (phoneDigits.length < 8 || phoneDigits.length > 15) {
        errors.telephone = 'Phone number must have 8-15 digits';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Check if participant exists by email - with better error handling
  const checkIfParticipantExists = async (email) => {
    if (!email || skipDuplicateCheck) return null;
    
    try {
      const response = await api.get('/action-tracker/participants/search', {
        params: { q: email, limit: 5,list_id: listId  },
        timeout: 5000
      });
      const items = response.data?.items || response.data || [];
      return items.find(p => p.email === email);
    } catch (err) {
      console.warn('Error checking existing participant (will proceed with creation):', err.message);
      return null;
    }
  };
  
  // Handle create new participant
// In AddParticipantsToList.jsx - handleCreateParticipant function
const handleCreateParticipant = async () => {
  if (!validateNewParticipant()) {
    return;
  }
  
  setCreating(true);
  setError(null);
  setValidationErrors({});
  
  try {
    const participantData = {
      name: newParticipant.name.trim(),
      email: newParticipant.email?.trim() || null,
      telephone: newParticipant.telephone?.trim() || null,
      title: newParticipant.title?.trim() || null,
      organization: newParticipant.organization?.trim() || null,
      notes: newParticipant.notes?.trim() || null
    };
    
    // Create the participant and add to list in ONE request
    const response = await api.post('/action-tracker/participants/', participantData, {
      params: {
        participant_list_id: listId  // Send the list ID as query parameter
      }
    });
    
    const result = response.data;
    
    setSuccessMessage(`Participant "${result.name}" created and added to "${listName}"`);
    setNewParticipant({
      name: '',
      email: '',
      telephone: '',
      title: '',
      organization: '',
      notes: ''
    });
    
    fetchData();
    
    setTimeout(() => {
      if (onSuccess) onSuccess();
      onClose();
    }, 1500);
  } catch (err) {
    console.error('Failed to create participant:', err);
    
    if (err.response?.status === 400 && err.response?.data?.detail) {
      const errorDetail = err.response.data.detail;
      if (typeof errorDetail === 'string' && errorDetail.includes('already exists')) {
        setError({
          type: 'duplicate',
          message: errorDetail,
          participant: null
        });
      } else {
        setError({ type: 'general', message: errorDetail });
      }
    } else if (err.response?.data?.detail && Array.isArray(err.response.data.detail)) {
      const fieldErrors = {};
      err.response.data.detail.forEach((errorItem) => {
        const field = errorItem.loc?.[1];
        const message = errorItem.msg;
        if (field === 'telephone') fieldErrors.telephone = message;
        else if (field === 'email') fieldErrors.email = message;
        else if (field === 'name') fieldErrors.name = message;
      });
      
      if (Object.keys(fieldErrors).length > 0) {
        setValidationErrors(fieldErrors);
        setError(null);
      } else {
        setError({ type: 'general', message: 'Please check the form for errors' });
      }
    } else if (err.message) {
      setError({ type: 'general', message: err.message });
    } else {
      setError({ type: 'general', message: 'Failed to create participant. Please check the form fields.' });
    }
  } finally {
    setCreating(false);
  }
};
  
  const handleAddExistingDuplicate = async (participant) => {
    if (!listId || !participant) return;
    
    setCreating(true);
    try {
      await dispatch(addMembersToList({
        listId,
        participantIds: [participant.id]
      })).unwrap();
      setSuccessMessage(`"${participant.name}" added to "${listName}" successfully!`);
      fetchData();
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError({ type: 'general', message: 'Failed to add existing participant to list' });
    } finally {
      setCreating(false);
      setError(null);
    }
  };
  
  const handleClearSelections = () => {
    setSelectedParticipants([]);
  };
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };
  
  const handleNewParticipantChange = (field) => (e) => {
    setNewParticipant(prev => ({ ...prev, [field]: e.target.value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
    if (error) {
      setError(null);
    }
    if (field === 'email') {
      setSkipDuplicateCheck(false);
    }
  };
  
  const handleFieldFocus = (field) => {
    setFieldFocus(prev => ({ ...prev, [field]: true }));
  };
  
  const handleFieldBlur = (field) => {
    setFieldFocus(prev => ({ ...prev, [field]: false }));
  };
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError(null);
    setSelectedParticipants([]);
    setSearchTerm('');
    setValidationErrors({});
    setSkipDuplicateCheck(false);
  };
  
  // Get gradient colors based on theme
  const primaryGradient = isDark 
    ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.dark, 0.05)} 100%)`
    : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.light, 0.03)} 100%)`;
  
  const successGradient = isDark
    ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${alpha(theme.palette.success.dark, 0.04)} 100%)`
    : `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.06)} 0%, ${alpha(theme.palette.success.light, 0.02)} 100%)`;

  // Floating label animation variants
  const inputVariants = {
    focused: {
      scale: 1.01,
      transition: { duration: 0.2 }
    },
    blurred: {
      scale: 1,
      transition: { duration: 0.2 }
    }
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
        TransitionComponent={Zoom}
        PaperProps={{
          sx: {
            height: isMobile ? '100%' : '85vh',
            maxHeight: isMobile ? '100%' : '85vh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: theme.palette.background.paper,
            backgroundImage: isDark 
              ? `radial-gradient(circle at 10% 20%, ${alpha(theme.palette.primary.main, 0.03)} 0%, transparent 70%)`
              : 'none',
            borderRadius: isMobile ? 0 : 3,
            overflow: 'hidden',
            backdropFilter: isDark ? 'blur(0px)' : 'none'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: `1px solid ${theme.palette.divider}`,
          p: isMobile ? 2 : 3,
          background: primaryGradient,
          position: 'relative',
          overflow: 'hidden',
          '&::before': isDark ? {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
          } : {}
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} sx={{ 
                background: isDark ? `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.main})` : 'none',
                backgroundClip: isDark ? 'text' : 'none',
                WebkitBackgroundClip: isDark ? 'text' : 'none',
                WebkitTextFillColor: isDark ? 'transparent' : 'inherit'
              }}>
                Add Participants
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                to <strong style={{ color: theme.palette.primary.main }}>{listName || 'Participant List'}</strong>
              </Typography>
            </Box>
            <Tooltip title="Close">
              <IconButton onClick={onClose} size="small" sx={{ 
                bgcolor: alpha(theme.palette.grey[500], 0.1),
                '&:hover': {
                  bgcolor: alpha(theme.palette.grey[500], 0.2),
                  transform: 'rotate(90deg)'
                },
                transition: 'all 0.3s'
              }}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            sx={{ 
              borderBottom: `1px solid ${theme.palette.divider}`,
              px: isMobile ? 1 : 2,
              '& .MuiTab-root': {
                textTransform: 'none',
                minHeight: 48,
                fontWeight: 600,
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.04)
                }
              },
              '& .Mui-selected': {
                color: theme.palette.primary.main,
              }
            }}
          >
            <Tab 
              icon={<PeopleIcon />} 
              iconPosition="start" 
              label="Existing Participants" 
            />
            <Tab 
              icon={<PersonAddIcon />} 
              iconPosition="start" 
              label="Create New" 
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
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.1)}`
                      },
                      '&.Mui-focused': {
                        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`
                      }
                    }
                  }}
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
              <AnimatePresence>
                {selectedParticipants.length > 0 && (
                  <Fade in>
                    <Box sx={{ 
                      p: isMobile ? 1.5 : 2, 
                      background: primaryGradient,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 1
                    }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <CheckCircleIcon sx={{ color: theme.palette.primary.main }} />
                        <Typography variant="body2" fontWeight={600}>
                          {selectedParticipants.length} participant(s) selected
                        </Typography>
                      </Box>
                      <Box display="flex" gap={1}>
                        <Button 
                          size="small" 
                          onClick={handleClearSelections} 
                          startIcon={<ClearIcon />}
                          sx={{ borderRadius: 2 }}
                        >
                          Clear
                        </Button>
                        <Button 
                          size="small" 
                          variant="contained" 
                          onClick={handleSubmitSelected}
                          disabled={submitting}
                          startIcon={submitting ? <CircularProgress size={16} /> : <GroupAddIcon />}
                          sx={{ borderRadius: 2, fontWeight: 600 }}
                        >
                          {submitting ? 'Adding...' : `Add ${selectedParticipants.length}`}
                        </Button>
                      </Box>
                    </Box>
                  </Fade>
                )}
              </AnimatePresence>
              
              {/* Error Alert */}
              {error && !error.type && (
                <Alert 
                  severity="error" 
                  sx={{ m: 2, borderRadius: 2 }} 
                  onClose={() => setError(null)}
                  icon={<WarningIcon />}
                >
                  {error.message || error}
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
                    <Paper sx={{ 
                      p: 4, 
                      textAlign: 'center',
                      bgcolor: alpha(theme.palette.background.paper, 0.6),
                      borderRadius: 3,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                    }}>
                      <PeopleIcon sx={{ fontSize: 64, color: theme.palette.text.disabled, mb: 2, opacity: 0.5 }} />
                      <Typography color="text.secondary" gutterBottom variant="h6">
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
                    </Paper>
                  </Box>
                ) : (
                  <>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        Showing {participants.length} of {availableData.total || participants.length} participants
                      </Typography>
                      <Button 
                        size="small" 
                        onClick={handleSelectAll} 
                        startIcon={<AddCircleIcon />}
                        sx={{ borderRadius: 2 }}
                      >
                        {selectedParticipants.length === participants.length ? 'Deselect All' : 'Select All Page'}
                      </Button>
                    </Box>
                    
                    <List dense={!isMobile} sx={{ bgcolor: 'transparent' }}>
                      <AnimatePresence>
                        {participants.map((participant, index) => (
                          <motion.div
                            key={participant.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                          >
                            <ListItem
                              button
                              onClick={() => handleToggleParticipant(participant)}
                              sx={{
                                borderRadius: 2,
                                mb: 1,
                                bgcolor: selectedParticipants.some(p => p.id === participant.id) 
                                  ? alpha(theme.palette.primary.main, 0.08)
                                  : 'transparent',
                                border: `1px solid ${selectedParticipants.some(p => p.id === participant.id) 
                                  ? alpha(theme.palette.primary.main, 0.3)
                                  : alpha(theme.palette.divider, 0.5)}`,
                                transition: 'all 0.2s',
                                '&:hover': { 
                                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                                  transform: 'translateX(4px)',
                                  borderColor: alpha(theme.palette.primary.main, 0.2)
                                }
                              }}
                            >
                              <Checkbox
                                checked={selectedParticipants.some(p => p.id === participant.id)}
                                onChange={() => handleToggleParticipant(participant)}
                                onClick={(e) => e.stopPropagation()}
                                icon={<CheckCircleIcon sx={{ color: theme.palette.text.disabled }} />}
                                checkedIcon={<CheckCircleIcon sx={{ color: theme.palette.primary.main }} />}
                              />
                              <ListItemAvatar>
                                <Avatar sx={{ 
                                  bgcolor: selectedParticipants.some(p => p.id === participant.id)
                                    ? theme.palette.primary.main
                                    : theme.palette.grey[isDark ? 700 : 400],
                                  transition: 'all 0.2s',
                                  background: selectedParticipants.some(p => p.id === participant.id) && isDark
                                    ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                                    : 'none'
                                }}>
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
                                        sx={{ 
                                          fontSize: '0.7rem', 
                                          height: 24,
                                          borderColor: alpha(theme.palette.primary.main, 0.2),
                                          bgcolor: alpha(theme.palette.background.paper, 0.5)
                                        }}
                                      />
                                    )}
                                    {participant.telephone && (
                                      <Chip 
                                        icon={<PhoneIcon sx={{ fontSize: 14 }} />}
                                        label={participant.telephone} 
                                        size="small" 
                                        variant="outlined" 
                                        sx={{ 
                                          fontSize: '0.7rem', 
                                          height: 24,
                                          borderColor: alpha(theme.palette.primary.main, 0.2),
                                          bgcolor: alpha(theme.palette.background.paper, 0.5)
                                        }}
                                      />
                                    )}
                                    {participant.organization && (
                                      <Chip 
                                        icon={<BusinessIcon sx={{ fontSize: 14 }} />}
                                        label={participant.organization} 
                                        size="small" 
                                        variant="outlined" 
                                        sx={{ 
                                          fontSize: '0.7rem', 
                                          height: 24,
                                          borderColor: alpha(theme.palette.primary.main, 0.2),
                                          bgcolor: alpha(theme.palette.background.paper, 0.5)
                                        }}
                                      />
                                    )}
                                  </Stack>
                                }
                              />
                              {selectedParticipants.some(p => p.id === participant.id) && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 500 }}
                                >
                                  <CheckIcon sx={{ color: theme.palette.primary.main, ml: 1 }} />
                                </motion.div>
                              )}
                            </ListItem>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </List>
                  </>
                )}
              </Box>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ 
                  p: 2, 
                  borderTop: `1px solid ${theme.palette.divider}`, 
                  bgcolor: alpha(theme.palette.background.paper, 0.8),
                  backdropFilter: isDark ? 'blur(10px)' : 'none'
                }}>
                  <Stack alignItems="center">
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={(_, val) => setPage(val)}
                      color="primary"
                      size={isMobile ? "small" : "medium"}
                      siblingCount={isMobile ? 0 : 1}
                      sx={{
                        '& .MuiPaginationItem-root': {
                          borderRadius: 1.5,
                          transition: 'all 0.2s',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.08)
                          }
                        }
                      }}
                    />
                  </Stack>
                </Box>
              )}
            </Box>
          )}
          
          {/* Tab 2: Create New Participant - Enhanced Design */}
          {activeTab === 1 && (
            <Box sx={{ p: isMobile ? 2 : 2.5, overflow: 'auto' }}>
              {/* Info Card */}
              <Card sx={{ 
                mb: 3, 
                borderRadius: 3,
                background: successGradient,
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      display: 'inline-flex'
                    }}>
                      <InfoIcon sx={{ color: theme.palette.success.main, fontSize: 32 }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        Create New Participant
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {listName && `After creation, will be added to "${listName}"`}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
              
              {/* Error Alert with Action */}
              {error && error.type === 'duplicate' && (
                <Alert 
                  severity="warning" 
                  sx={{ mb: 2, borderRadius: 2 }}
                  icon={<WarningIcon />}
                  action={
                    <Stack direction="row" spacing={1}>
                      <Button 
                        color="inherit" 
                        size="small" 
                        onClick={() => {
                          setActiveTab(0);
                          setSearchTerm(newParticipant.email);
                          setError(null);
                        }}
                      >
                        Search
                      </Button>
                      {error.participant && (
                        <Button 
                          color="primary" 
                          size="small" 
                          variant="outlined"
                          onClick={() => handleAddExistingDuplicate(error.participant)}
                          disabled={creating}
                        >
                          Add Existing
                        </Button>
                      )}
                    </Stack>
                  }
                >
                  <Typography variant="body2">
                    {error.message}
                    {error.participant && ` "${error.participant.name}" already exists.`}
                  </Typography>
                </Alert>
              )}
              
              {error && error.type === 'general' && (
                <Alert 
                  severity="error" 
                  sx={{ mb: 2, borderRadius: 2 }} 
                  onClose={() => setError(null)}
                  icon={<WarningIcon />}
                >
                  {error.message}
                </Alert>
              )}
              
              <form onSubmit={(e) => { e.preventDefault(); handleCreateParticipant(); }}>
                <Stack spacing={3}>
                  {/* Name Field - Required */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      <BadgeIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Full Name <span style={{ color: theme.palette.error.main }}>*</span>
                      </Typography>
                    </Box>
                    <motion.div
                      animate={fieldFocus.name ? 'focused' : 'blurred'}
                      variants={inputVariants}
                    >
                      <TextField
                        fullWidth
                        value={newParticipant.name}
                        onChange={handleNewParticipantChange('name')}
                        onFocus={() => handleFieldFocus('name')}
                        onBlur={() => handleFieldBlur('name')}
                        placeholder="Enter participant's full name"
                        size={isMobile ? "medium" : "small"}
                        error={!!validationErrors.name}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            transition: 'all 0.2s',
                            bgcolor: alpha(theme.palette.background.paper, 0.6),
                            '&:hover': {
                              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.1)}`
                            },
                            '&.Mui-focused': {
                              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`
                            }
                          }
                        }}
                      />
                    </motion.div>
                    {validationErrors.name && (
                      <FormHelperText error sx={{ mt: 0.5, ml: 1 }}>
                        {validationErrors.name}
                      </FormHelperText>
                    )}
                  </Box>
                  
                  {/* Email Field */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      <EmailIcon sx={{ fontSize: 20, color: theme.palette.info.main }} />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Email Address
                      </Typography>
                      <Chip label="Optional" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    </Box>
                    <motion.div
                      animate={fieldFocus.email ? 'focused' : 'blurred'}
                      variants={inputVariants}
                    >
                      <TextField
                        fullWidth
                        type="email"
                        value={newParticipant.email}
                        onChange={handleNewParticipantChange('email')}
                        onFocus={() => handleFieldFocus('email')}
                        onBlur={() => handleFieldBlur('email')}
                        placeholder="email@example.com"
                        size={isMobile ? "medium" : "small"}
                        error={!!validationErrors.email}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            transition: 'all 0.2s',
                            bgcolor: alpha(theme.palette.background.paper, 0.6),
                            '&:hover': {
                              boxShadow: `0 0 0 2px ${alpha(theme.palette.info.main, 0.1)}`
                            },
                            '&.Mui-focused': {
                              boxShadow: `0 0 0 3px ${alpha(theme.palette.info.main, 0.15)}`
                            }
                          }
                        }}
                      />
                    </motion.div>
                    {validationErrors.email && (
                      <FormHelperText error sx={{ mt: 0.5, ml: 1 }}>
                        {validationErrors.email}
                      </FormHelperText>
                    )}
                    {!validationErrors.email && (
                      <FormHelperText sx={{ mt: 0.5, ml: 1 }}>
                        Used for email notifications
                      </FormHelperText>
                    )}
                  </Box>
                  
                  {/* Phone Field */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      <PhoneIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Phone Number
                      </Typography>
                      <Chip label="Optional" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    </Box>
                    <motion.div
                      animate={fieldFocus.telephone ? 'focused' : 'blurred'}
                      variants={inputVariants}
                    >
                      <TextField
                        fullWidth
                        type="tel"
                        value={newParticipant.telephone}
                        onChange={handleNewParticipantChange('telephone')}
                        onFocus={() => handleFieldFocus('telephone')}
                        onBlur={() => handleFieldBlur('telephone')}
                        placeholder="+256712345678"
                        size={isMobile ? "medium" : "small"}
                        error={!!validationErrors.telephone}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            transition: 'all 0.2s',
                            bgcolor: alpha(theme.palette.background.paper, 0.6),
                            '&:hover': {
                              boxShadow: `0 0 0 2px ${alpha(theme.palette.warning.main, 0.1)}`
                            },
                            '&.Mui-focused': {
                              boxShadow: `0 0 0 3px ${alpha(theme.palette.warning.main, 0.15)}`
                            }
                          }
                        }}
                      />
                    </motion.div>
                    {validationErrors.telephone && (
                      <FormHelperText error sx={{ mt: 0.5, ml: 1 }}>
                        {validationErrors.telephone}
                      </FormHelperText>
                    )}
                    {!validationErrors.telephone && (
                      <FormHelperText sx={{ mt: 0.5, ml: 1 }}>
                        Format: Country code + number (8-15 digits)
                      </FormHelperText>
                    )}
                  </Box>
                  
                  <Grid container spacing={2}>
                    {/* Title Field */}
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                        <WorkIcon sx={{ fontSize: 20, color: theme.palette.secondary.main }} />
                        <Typography variant="subtitle2" fontWeight={600}>
                          Title / Role
                        </Typography>
                      </Box>
                      <TextField
                        fullWidth
                        value={newParticipant.title}
                        onChange={handleNewParticipantChange('title')}
                        placeholder="e.g., Project Manager"
                        size={isMobile ? "medium" : "small"}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            transition: 'all 0.2s',
                            bgcolor: alpha(theme.palette.background.paper, 0.6),
                            '&:hover': {
                              boxShadow: `0 0 0 2px ${alpha(theme.palette.secondary.main, 0.1)}`
                            }
                          }
                        }}
                      />
                    </Grid>
                    
                    {/* Organization Field */}
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                        <BusinessIcon sx={{ fontSize: 20, color: theme.palette.success.main }} />
                        <Typography variant="subtitle2" fontWeight={600}>
                          Organization
                        </Typography>
                      </Box>
                      <TextField
                        fullWidth
                        value={newParticipant.organization}
                        onChange={handleNewParticipantChange('organization')}
                        placeholder="Company name"
                        size={isMobile ? "medium" : "small"}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            transition: 'all 0.2s',
                            bgcolor: alpha(theme.palette.background.paper, 0.6),
                            '&:hover': {
                              boxShadow: `0 0 0 2px ${alpha(theme.palette.success.main, 0.1)}`
                            }
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                  
                  {/* Notes Field */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      <NotesIcon sx={{ fontSize: 20, color: theme.palette.grey[500] }} />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Notes
                      </Typography>
                      <Chip label="Optional" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={isMobile ? 3 : 2}
                      value={newParticipant.notes}
                      onChange={handleNewParticipantChange('notes')}
                      placeholder="Any additional information about this participant..."
                      size={isMobile ? "medium" : "small"}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'all 0.2s',
                          bgcolor: alpha(theme.palette.background.paper, 0.6),
                          '&:hover': {
                            boxShadow: `0 0 0 2px ${alpha(theme.palette.grey[500], 0.1)}`
                          }
                        }
                      }}
                    />
                  </Box>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  {/* Submit Button */}
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={creating ? <CircularProgress size={20} /> : <PersonAddIcon />}
                      onClick={handleCreateParticipant}
                      disabled={creating}
                      sx={{ 
                        py: isMobile ? 1.5 : 1.2,
                        borderRadius: 2,
                        fontWeight: 700,
                        textTransform: 'none',
                        fontSize: '1rem',
                        background: isDark 
                          ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                          : undefined,
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 3
                        }
                      }}
                    >
                      {creating ? 'Creating...' : '✨ Create & Add to List'}
                    </Button>
                  </motion.div>
                </Stack>
              </form>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ 
          p: isMobile ? 2 : 2.5, 
          borderTop: `1px solid ${theme.palette.divider}`,
          flexDirection: isMobile ? 'column-reverse' : 'row',
          gap: isMobile ? 1 : 0,
          bgcolor: alpha(theme.palette.background.paper, 0.9),
          backdropFilter: isDark ? 'blur(10px)' : 'none'
        }}>
          <Button 
            onClick={onClose} 
            fullWidth={isMobile} 
            size="large"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          {activeTab === 0 && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ width: isMobile ? '100%' : 'auto' }}
            >
              <Button 
                variant="contained" 
                onClick={handleSubmitSelected}
                disabled={selectedParticipants.length === 0 || submitting}
                fullWidth={isMobile}
                size="large"
                startIcon={submitting ? <CircularProgress size={20} /> : <GroupAddIcon />}
                sx={{ 
                  fontWeight: 700,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3
                  }
                }}
              >
                {submitting ? 'Adding...' : `Add ${selectedParticipants.length} Participant(s)`}
              </Button>
            </motion.div>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={Zoom}
      >
        <Alert 
          severity="success" 
          onClose={() => setSuccessMessage(null)}
          icon={<CheckCircleIcon fontSize="inherit" />}
          sx={{ 
            boxShadow: 3,
            borderRadius: 2,
            fontWeight: 600,
            bgcolor: theme.palette.success.main,
            color: theme.palette.success.contrastText,
            '& .MuiAlert-icon': {
              color: theme.palette.success.contrastText
            }
          }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default AddParticipantsToList;