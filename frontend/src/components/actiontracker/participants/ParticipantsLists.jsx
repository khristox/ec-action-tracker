import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Alert, Pagination,
  TextField, Stack, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, Chip, Avatar, InputAdornment, Card, CardContent,
  IconButton, useMediaQuery, useTheme, Fab, Zoom, Menu, MenuItem,
  ListItemIcon, ListItemText, Snackbar, Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { 
  fetchParticipants, 
  createParticipant,
  updateParticipant,
  deleteParticipant,
  clearError 
} from '../../../store/slices/actionTracker/participantSlice';

// ==================== Add/Edit Participant Dialog ====================
const ParticipantFormDialog = ({ open, onClose, onSuccess, meetingId, editParticipant }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isEditing = !!editParticipant;
  
  const [form, setForm] = useState({
    name: '', email: '', telephone: '', title: '', organization: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState({});

  // Initialize form when editing
  useEffect(() => {
    if (editParticipant) {
      setForm({
        name: editParticipant.name || '',
        email: editParticipant.email || '',
        telephone: editParticipant.telephone || '',
        title: editParticipant.title || '',
        organization: editParticipant.organization || '',
        notes: editParticipant.notes || '',
      });
    } else {
      setForm({
        name: '', email: '', telephone: '', title: '', organization: '', notes: '',
      });
    }
    setTouched({});
    setError(null);
  }, [editParticipant, open]);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const validateField = (field, value) => {
    switch (field) {
      case 'name':
        return !value.trim() ? 'Name is required' : '';
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Enter a valid email address';
        }
        return '';
      case 'telephone':
        if (value && !/^[\d\s+()-]{8,}$/.test(value)) {
          return 'Enter a valid phone number';
        }
        return '';
      default:
        return '';
    }
  };

  const getFieldError = (field) => {
    if (!touched[field]) return '';
    return validateField(field, form[field]);
  };

  const isFormValid = () => {
    return form.name.trim() !== '' && !getFieldError('name');
  };

  const handleSubmit = async () => {
    const allTouched = Object.keys(form).reduce((acc, key) => ({ ...acc, [key]: true }), {});
    setTouched(allTouched);
    
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      if (isEditing) {
        await dispatch(updateParticipant({ 
          id: editParticipant.id, 
          data: form 
        })).unwrap();
      } else {
        const submitData = meetingId ? { ...form, meeting_id: meetingId } : form;
        await dispatch(createParticipant(submitData)).unwrap();
      }
      setForm({ name: '', email: '', telephone: '', title: '', organization: '', notes: '' });
      setTouched({});
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || `Failed to ${isEditing ? 'update' : 'create'} participant.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          m: isMobile ? 0 : 2,
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '90vh',
          borderRadius: isMobile ? 0 : 2,
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <DialogTitle sx={{ 
        fontWeight: 700, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 2,
        borderBottom: isMobile ? `1px solid ${theme.palette.divider}` : 'none',
        px: isMobile ? 2 : 3,
        py: isMobile ? 2 : 2.5,
      }}>
        <Typography variant={isMobile ? "h6" : "h5"} component="span" fontWeight={700}>
          {isEditing ? 'Edit Participant' : 'Add Participant'}
        </Typography>
        {isMobile && (
          <IconButton edge="end" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      
      <DialogContent sx={{ 
        flex: 1, 
        overflowY: 'auto',
        px: isMobile ? 2 : 3,
        py: isMobile ? 2 : 2.5,
      }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={isMobile ? 2.5 : 2}>
          <Grid size={12}>
            <TextField
              fullWidth
              required
              label="Full Name"
              value={form.name}
              onChange={handleChange('name')}
              error={!!getFieldError('name')}
              helperText={getFieldError('name')}
              placeholder="Enter participant's full name"
              size={isMobile ? "medium" : "small"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon fontSize="small" color={getFieldError('name') ? "error" : "action"} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              error={!!getFieldError('email')}
              helperText={getFieldError('email') || 'Optional'}
              placeholder="email@example.com"
              size={isMobile ? "medium" : "small"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon fontSize="small" color={getFieldError('email') ? "error" : "action"} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Phone Number"
              type="tel"
              value={form.telephone}
              onChange={handleChange('telephone')}
              error={!!getFieldError('telephone')}
              helperText={getFieldError('telephone') || 'Optional'}
              placeholder="+1234567890"
              size={isMobile ? "medium" : "small"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon fontSize="small" color={getFieldError('telephone') ? "error" : "action"} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Title / Role"
              value={form.title}
              onChange={handleChange('title')}
              placeholder="e.g., Project Manager"
              size={isMobile ? "medium" : "small"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Organization"
              value={form.organization}
              onChange={handleChange('organization')}
              placeholder="Company name"
              size={isMobile ? "medium" : "small"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={isMobile ? 4 : 3}
              label="Additional Notes"
              value={form.notes}
              onChange={handleChange('notes')}
              placeholder="Any additional information..."
              size={isMobile ? "medium" : "small"}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ 
        p: isMobile ? 2 : 2.5,
        flexDirection: isMobile ? 'column-reverse' : 'row',
        gap: isMobile ? 1.5 : 1,
        borderTop: isMobile ? `1px solid ${theme.palette.divider}` : 'none',
      }}>
        <Button 
          onClick={onClose} 
          disabled={saving}
          fullWidth={isMobile}
          size="large"
          startIcon={isMobile && <CancelIcon />}
          sx={{ py: isMobile ? 1.5 : 1 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !isFormValid()}
          fullWidth={isMobile}
          size="large"
          startIcon={saving ? <CircularProgress size={isMobile ? 20 : 16} /> : (isEditing ? <SaveIcon /> : <AddIcon />)}
          sx={{ py: isMobile ? 1.5 : 1, fontWeight: 600 }}
        >
          {saving ? 'Saving...' : (isEditing ? 'Update' : 'Add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== Delete Confirmation Dialog ====================
const DeleteConfirmDialog = ({ open, onClose, onConfirm, participantName, deleting }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Delete Participant
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Are you sure you want to delete "{participantName}"?
        </Alert>
        <Typography variant="body2" color="text.secondary">
          This action cannot be undone. The participant will be permanently removed from the system.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, flexDirection: isMobile ? 'column-reverse' : 'row', gap: 1 }}>
        <Button onClick={onClose} disabled={deleting} fullWidth={isMobile}>
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          color="error" 
          variant="contained" 
          disabled={deleting}
          fullWidth={isMobile}
          startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== Participant Card with Actions (Mobile) ====================
const ParticipantCard = ({ participant, onEdit, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    onEdit(participant);
    handleClose();
  };

  const handleDelete = () => {
    onDelete(participant);
    handleClose();
  };

  return (
    <Card sx={{ mb: 2, borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar sx={{ width: 48, height: 48, bgcolor: '#6366f1' }}>
            {participant.name?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="subtitle1" fontWeight={700}>
                {participant.name}
              </Typography>
              <IconButton
                aria-label="more"
                id="long-button"
                aria-controls={open ? 'long-menu' : undefined}
                aria-expanded={open ? 'true' : undefined}
                aria-haspopup="true"
                onClick={handleClick}
                size="small"
              >
                <MoreVertIcon />
              </IconButton>
              <Menu
                id="long-menu"
                MenuListProps={{
                  'aria-labelledby': 'long-button',
                }}
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                  style: {
                    width: '20ch',
                  },
                }}
              >
                <MenuItem onClick={handleEdit}>
                  <ListItemIcon>
                    <EditIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Edit</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText>Delete</ListItemText>
                </MenuItem>
              </Menu>
            </Box>
            {participant.organization && (
              <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={0.5} mt={0.5}>
                <BusinessIcon sx={{ fontSize: 14 }} /> {participant.organization}
              </Typography>
            )}
            {participant.title && (
              <Chip label={participant.title} size="small" variant="outlined" sx={{ mt: 1, fontSize: '0.7rem' }} />
            )}
            <Stack spacing={0.5} mt={1}>
              {participant.email && (
                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                  <EmailIcon sx={{ fontSize: 12 }} /> {participant.email}
                </Typography>
              )}
              {participant.telephone && (
                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                  <PhoneIcon sx={{ fontSize: 12 }} /> {participant.telephone}
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ==================== Main Component ====================
const ParticipantsList = ({ meetingId }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { participants, loading, error } = useSelector((state) => state.participants);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const searchTimeoutRef = useRef(null);
  const initialLoadRef = useRef(false);

  const fetchParticipantsData = useCallback(() => {
    const params = {
      page,
      limit: isMobile ? 10 : 20,
      search: searchTerm || undefined,
    };
    dispatch(fetchParticipants(params));
  }, [dispatch, page, searchTerm, isMobile]);

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      fetchParticipantsData();
    }
  }, [fetchParticipantsData]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (searchTerm && page !== 1) {
        setPage(1);
      } else if (initialLoadRef.current) {
        fetchParticipantsData();
      }
    }, 500);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, page, fetchParticipantsData]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleEdit = (participant) => {
    setEditingParticipant(participant);
    setDialogOpen(true);
  };

  const handleDeleteClick = (participant) => {
    setParticipantToDelete(participant);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!participantToDelete) return;
    
    setDeleting(true);
    try {
      await dispatch(deleteParticipant(participantToDelete.id)).unwrap();
      setSnackbar({
        open: true,
        message: `"${participantToDelete.name}" has been deleted successfully.`,
        severity: 'success'
      });
      fetchParticipantsData();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.message || 'Failed to delete participant.',
        severity: 'error'
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setParticipantToDelete(null);
    }
  };

  const handleFormSuccess = () => {
    fetchParticipantsData();
    setSnackbar({
      open: true,
      message: editingParticipant ? 'Participant updated successfully!' : 'Participant added successfully!',
      severity: 'success'
    });
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingParticipant(null);
  };

  const { items: participantsList = [], total = 0, pages = 1 } = participants;

  return (
    <Box sx={{ pb: isMobile ? 8 : 0 }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'stretch' : 'center', 
        mb: 3,
        gap: isMobile ? 2 : 0
      }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Box>
            <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700}>
              Participants
            </Typography>
            {!loading && (
              <Typography variant="body2" color="text.secondary">
                {total} participant{total !== 1 ? 's' : ''} total
              </Typography>
            )}
          </Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchParticipantsData} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ 
            fontWeight: 700, 
            textTransform: 'none',
            flex: isMobile ? 1 : 'auto'
          }}
          fullWidth={isMobile}
        >
          Add Participant
        </Button>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }} 
          onClose={() => dispatch(clearError())}
        >
          {error}
        </Alert>
      )}

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search by name, email, or organization..."
        variant="outlined"
        size={isMobile ? "small" : "medium"}
        sx={{ mb: 2 }}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
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

      {/* Loading State */}
      {loading && (
        <Box display="flex" justifyContent="center" py={5}>
          <CircularProgress size={isMobile ? 32 : 40} />
        </Box>
      )}

      {/* Content */}
      {!loading && (
        <>
          {/* Mobile Card View */}
          {isMobile && participantsList.length > 0 && (
            <Box>
              {participantsList.map((participant) => (
                <ParticipantCard
                  key={participant.id}
                  participant={participant}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                />
              ))}
            </Box>
          )}

          {/* Desktop Table View */}
          {!isMobile && participantsList.length > 0 && (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflowX: 'auto' }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Participant
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Organization
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Contact
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Title
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {participantsList.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar sx={{ width: 34, height: 34, bgcolor: '#6366f1', fontSize: '0.85rem', fontWeight: 700 }}>
                            {p.name?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" fontWeight={600}>
                            {p.name}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {p.organization || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.3}>
                          {p.email && (
                            <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                              <EmailIcon sx={{ fontSize: 12 }} /> {p.email}
                            </Typography>
                          )}
                          {p.telephone && (
                            <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                              <PhoneIcon sx={{ fontSize: 12 }} /> {p.telephone}
                            </Typography>
                          )}
                          {!p.email && !p.telephone && '—'}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {p.title ? (
                          <Chip label={p.title} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(p)}
                              sx={{ color: '#6366f1' }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteClick(p)}
                              sx={{ color: '#ef4444' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Empty State */}
          {participantsList.length === 0 && (
            <Box textAlign="center" py={6}>
              <PersonIcon sx={{ fontSize: isMobile ? 48 : 64, color: '#cbd5e1', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {searchTerm ? 'No participants match your search.' : 'No participants yet.'}
              </Typography>
              {!searchTerm && (
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setDialogOpen(true)}
                  sx={{ mt: 2, textTransform: 'none' }}
                >
                  Add the first participant
                </Button>
              )}
            </Box>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <Stack alignItems="center" mt={3}>
              <Pagination
                count={pages}
                page={page}
                onChange={(_, val) => setPage(val)}
                color="primary"
                size={isMobile ? "small" : "medium"}
                siblingCount={isMobile ? 0 : 1}
                boundaryCount={isMobile ? 1 : 2}
              />
            </Stack>
          )}
        </>
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <Zoom in={!dialogOpen}>
          <Fab
            color="primary"
            aria-label="add"
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 1000,
            }}
            onClick={() => setDialogOpen(true)}
          >
            <AddIcon />
          </Fab>
        </Zoom>
      )}

      {/* Dialogs */}
      <ParticipantFormDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSuccess={handleFormSuccess}
        meetingId={meetingId}
        editParticipant={editingParticipant}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        participantName={participantToDelete?.name || ''}
        deleting={deleting}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ParticipantsList;