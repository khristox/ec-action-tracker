// src/components/actiontracker/participants/ParticipantListsManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Paper, Grid, Button, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  Chip, CircularProgress, Alert, Card, CardContent,
  Stack, Avatar, Tooltip, useMediaQuery, useTheme, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Breadcrumbs, Link, alpha, Fab,
  Snackbar, AvatarGroup, Badge
} from '@mui/material';  // Make sure all MUI imports are from here
import {
  Add as Add, Delete as Delete, Edit as Edit,
  People as PeopleIcon, PersonAdd as PersonAdd,
  Refresh as RefreshIcon, Group as GroupIcon,
  Home as HomeIcon, ChevronRight as ChevronRightIcon,
  Close as Close, Visibility as VisibilityIcon,
  Email as EmailIcon, Phone as PhoneIcon, Business as BusinessIcon
} from '@mui/icons-material';
import {
  fetchParticipantLists, createParticipantList,
  updateParticipantList, deleteParticipantList,
  fetchListMembers, clearError, removeMemberFromList
} from '../../../store/slices/actionTracker/participantSlice';
import AddParticipantsToList from './AddParticipantsToList';

// ==================== Premium List Form Dialog ====================
const ListFormDialog = ({ open, onClose, onSuccess, editList }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dispatch = useDispatch();
  const [form, setForm] = useState({ name: '', description: '', is_global: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editList) {
      setForm({ 
        name: editList.name, 
        description: editList.description || '', 
        is_global: editList.is_global || false 
      });
    } else {
      setForm({ name: '', description: '', is_global: false });
    }
  }, [editList, open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('List name is required');
      return;
    }
    setSaving(true);
    try {
      if (editList) {
        await dispatch(updateParticipantList({ id: editList.id, data: form })).unwrap();
      } else {
        await dispatch(createParticipantList(form)).unwrap();
      }
      onSuccess();
      onClose();
    } catch (err) { 
      setError(err.message || 'Failed to save list'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <Dialog 
      open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{
        sx: {
          backgroundImage: 'none',
          bgcolor: isDark ? '#0F172A' : 'background.paper',
          borderRadius: 4,
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 900, pt: 4 }}>{editList ? 'Edit List' : 'New List'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            fullWidth 
            label="List Name" 
            value={form.name} 
            variant="filled"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            slotProps={{ 
              input: { 
                disableUnderline: true, 
                sx: { borderRadius: 3, bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03) } 
              }
            }}
          />
          <TextField
            fullWidth 
            label="Description" 
            value={form.description} 
            variant="filled" 
            multiline 
            rows={3}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            slotProps={{ 
              input: { 
                disableUnderline: true, 
                sx: { borderRadius: 3, bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03) } 
              }
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit} 
          disabled={saving || !form.name.trim()} 
          sx={{ borderRadius: 3, px: 3, fontWeight: 800 }}
        >
          {saving ? 'Saving...' : 'Save List'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== Delete Confirmation Dialog ====================
const DeleteConfirmDialog = ({ open, onClose, onConfirm, listName, deleting }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Dialog 
      open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{
        sx: {
          bgcolor: isDark ? '#0F172A' : 'background.paper',
          borderRadius: 4,
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 900 }}>Delete List</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          Are you sure you want to delete "{listName}"?
        </Alert>
        <Typography variant="body2" color="text.secondary">
          This action cannot be undone. All members will be removed from this list.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={deleting}>Cancel</Button>
        <Button 
          onClick={onConfirm} 
          color="error" 
          variant="contained" 
          disabled={deleting}
          sx={{ borderRadius: 3, fontWeight: 800 }}
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== View Members View ====================
const ViewMembersView = ({ list, members, loading, onBack, onAddMembers, onRefresh, onDeleteMember }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const memberArray = React.useMemo(() => {
    if (Array.isArray(members)) return members;
    if (members?.items) return members.items;
    if (members?.data) return members.data;
    return [];
  }, [members]);

  return (
    <Box>
      <Breadcrumbs separator={<ChevronRightIcon fontSize="small" />} sx={{ mb: 4 }}>
        <Link 
          underline="none" 
          color="primary" 
          onClick={onBack}
          sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}
        >
          <HomeIcon fontSize="inherit" /> Directory
        </Link>
        <Typography color="text.primary" fontWeight={700}>{list?.name}</Typography>
      </Breadcrumbs>

      {/* Use Box with sx instead of Stack for flexbox to avoid prop warnings */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: '-0.04em' }}>{list?.name}</Typography>
          <Typography variant="body1" color="text.secondary">
            {list?.description || 'No description'} • {memberArray.length} Member{memberArray.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <IconButton onClick={onRefresh} sx={{ bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03) }}>
            <RefreshIcon />
          </IconButton>
          <Button 
            variant="contained" 
            startIcon={<PersonAdd />} 
            onClick={onAddMembers} 
            sx={{ borderRadius: 3, px: 3, fontWeight: 800 }}
          >
            Add Members
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={10}>
          <CircularProgress />
        </Box>
      ) : memberArray.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 6, bgcolor: isDark ? '#0F172A' : '#fff' }}>
          <PeopleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>No Members Yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This list doesn't have any members yet.
          </Typography>
          <Button variant="contained" startIcon={<PersonAdd />} onClick={onAddMembers}>
            Add Members
          </Button>
        </Paper>
      ) : (
        <TableContainer 
          component={Paper} 
          sx={{ 
            borderRadius: 6, 
            backgroundImage: 'none', 
            bgcolor: isDark ? '#0F172A' : '#fff', 
            border: isDark ? `1px solid ${alpha('#fff', 0.05)}` : 'none',
            overflowX: 'auto'
          }}
        >
          <Table sx={{ minWidth: isMobile ? 600 : 'auto' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: isDark ? alpha('#fff', 0.02) : '#F8FAFC' }}>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                  Member
                </TableCell>
                {!isMobile && (
                  <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                    Contact
                  </TableCell>
                )}
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                  Organization
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.1em' }} align="center">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {memberArray.map((member, index) => (
                <TableRow key={member.id || index} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.2), color: 'primary.main', fontWeight: 800 }}>
                        {member.name?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase() || '?'}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={800}>{member.name || 'Unnamed'}</Typography>
                        {isMobile && member.email && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 12 }} /> {member.email}
                          </Typography>
                        )}
                        {isMobile && member.telephone && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon sx={{ fontSize: 12 }} /> {member.telephone}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  {!isMobile && (
                    <TableCell>
                      {member.email && (
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <EmailIcon sx={{ fontSize: 12 }} /> {member.email}
                        </Typography>
                      )}
                      {member.telephone && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <PhoneIcon sx={{ fontSize: 12 }} /> {member.telephone}
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      {member.organization || member.department || member.title || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Remove Member">
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => onDeleteMember(member)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

// ==================== Main Component ====================
const ParticipantListsManager = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { lists, loading, listMembers, error } = useSelector((state) => state.participants);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedList, setSelectedList] = useState(null);
  const [viewingList, setViewingList] = useState(null);
  const [editingList, setEditingList] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Fetch lists - handle both paginated and non-paginated responses
  const fetchLists = useCallback(async () => {
    try {
      const result = await dispatch(fetchParticipantLists()).unwrap();
      console.log('Fetched lists:', result);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
      setSnackbar({ open: true, message: 'Failed to load lists', severity: 'error' });
    }
  }, [dispatch]);

  useEffect(() => { 
    fetchLists(); 
  }, [fetchLists]);

  const handleViewList = async (list) => {
    setViewingList(list);
    try {
      const result = await dispatch(fetchListMembers({ listId: list.id, params: { limit: 100 } })).unwrap();
      console.log('Fetched members:', result);
    } catch (err) {
      console.error('Failed to load members:', err);
      setSnackbar({ open: true, message: 'Failed to load members', severity: 'error' });
    }
  };

  const handleDeleteList = async () => {
    if (!selectedList) return;
    setDeleting(true);
    try {
      await dispatch(deleteParticipantList(selectedList.id)).unwrap();
      setSnackbar({ open: true, message: `"${selectedList.name}" deleted successfully`, severity: 'success' });
      fetchLists();
      setDeleteDialogOpen(false);
      setSelectedList(null);
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Failed to delete list', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteMember = async (member) => {
    if (!viewingList) return;
    if (!window.confirm(`Remove "${member.name}" from this list?`)) return;
    
    try {
      await dispatch(removeMemberFromList({ listId: viewingList.id, participantId: member.id })).unwrap();
      setSnackbar({ open: true, message: `"${member.name}" removed from list`, severity: 'success' });
      // Refresh members
      await dispatch(fetchListMembers({ listId: viewingList.id, params: { limit: 100 } })).unwrap();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to remove member', severity: 'error' });
    }
  };

  const handleFormSuccess = () => {
    fetchLists();
    setSnackbar({ open: true, message: editingList ? 'List updated successfully' : 'List created successfully', severity: 'success' });
  };

  // Get lists array - handle both response formats
  const listsArray = React.useMemo(() => {
    if (Array.isArray(lists)) return lists;
    if (lists?.items) return lists.items;
    if (lists?.data) return lists.data;
    return [];
  }, [lists]);

  // Get members for the current viewed list
  const currentMembers = React.useMemo(() => {
    if (!viewingList) return [];
    const membersData = listMembers[viewingList.id];
    if (Array.isArray(membersData)) return membersData;
    if (membersData?.items) return membersData.items;
    if (membersData?.data) return membersData.data;
    return [];
  }, [listMembers, viewingList]);

  if (viewingList) {
    return (
      <Box sx={{ p: isMobile ? 2 : 4, minHeight: '100vh', bgcolor: isDark ? '#020617' : '#F8FAFC' }}>
        <ViewMembersView
          list={viewingList} 
          members={currentMembers}
          loading={loading}
          onBack={() => setViewingList(null)} 
          onRefresh={() => handleViewList(viewingList)}
          onAddMembers={() => { setSelectedList(viewingList); setAddFormOpen(true); }}
          onDeleteMember={handleDeleteMember}
        />
        <AddParticipantsToList 
          open={addFormOpen} 
          onClose={() => setAddFormOpen(false)} 
          listId={selectedList?.id} 
          listName={selectedList?.name} 
          onSuccess={() => handleViewList(viewingList)} 
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 2 : 4, minHeight: '100vh', bgcolor: isDark ? '#020617' : '#F8FAFC' }}>
      {/* Header - using Box with flex instead of Stack */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 6, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: '-0.04em' }}>Group Lists</Typography>
          <Typography variant="body1" color="text.secondary">Organize and manage participant clusters</Typography>
        </Box>
        <Fab color="primary" variant="extended" onClick={() => setCreateDialogOpen(true)} sx={{ px: 4, borderRadius: 4, fontWeight: 800 }}>
          <Add sx={{ mr: 1 }} /> Create List
        </Fab>
      </Box>

      {loading && listsArray.length === 0 ? (
        <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ borderRadius: 3 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      ) : listsArray.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 6, bgcolor: isDark ? '#0F172A' : '#fff' }}>
          <GroupIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>No Lists Yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first participant list to organize your participants.
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateDialogOpen(true)}>
            Create Your First List
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {listsArray.map((list) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={list.id}>
              <Card 
                onClick={() => handleViewList(list)}
                sx={{ 
                  height: '100%', borderRadius: 6, backgroundImage: 'none',
                  bgcolor: isDark ? '#0F172A' : '#fff', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: `1px solid ${isDark ? alpha('#fff', 0.05) : '#F1F5F9'}`,
                  cursor: 'pointer', 
                  '&:hover': { 
                    transform: 'translateY(-8px)', 
                    borderColor: 'primary.main', 
                    boxShadow: isDark ? `0 20px 40px ${alpha('#000', 0.6)}` : theme.shadows[10] 
                  }
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), p: 1, borderRadius: 2 }}>
                      <GroupIcon color="primary" />
                    </Box>
                    <Box sx={{ display: 'flex' }}>
                      <IconButton 
                        size="small" 
                        onClick={(e) => { e.stopPropagation(); setEditingList(list); setCreateDialogOpen(true); }}
                        sx={{ color: 'text.secondary' }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={(e) => { e.stopPropagation(); setSelectedList(list); setDeleteDialogOpen(true); }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="h6" fontWeight={800} gutterBottom>{list.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                    {list.description || 'No description provided.'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
                    <Chip 
                      label={`${list.participant_count || list.member_count || 0} Members`} 
                      size="small" 
                      sx={{ fontWeight: 800, bgcolor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.05) }} 
                    />
                    {list.is_global && <Chip label="Global" color="primary" size="small" sx={{ fontWeight: 800 }} />}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <ListFormDialog 
        open={createDialogOpen} 
        editList={editingList} 
        onClose={() => { setCreateDialogOpen(false); setEditingList(null); }} 
        onSuccess={handleFormSuccess} 
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setSelectedList(null); }}
        onConfirm={handleDeleteList}
        listName={selectedList?.name || ''}
        deleting={deleting}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ParticipantListsManager;