// src/components/actiontracker/participants/ParticipantListsManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Paper, Grid, Button, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  Chip, CircularProgress, Alert, Card, CardContent, CardActions,
  Stack, Avatar, Tooltip, useMediaQuery, useTheme, Divider,
  List, ListItem, ListItemText, ListItemAvatar, Pagination,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Drawer, IconButton as MuiIconButton, Breadcrumbs, Link
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
  Group as GroupIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import {
  fetchParticipantLists,
  createParticipantList,
  updateParticipantList,
  deleteParticipantList,
  fetchListMembers,
  clearError
} from '../../../store/slices/actionTracker/participantSlice';
import AddParticipantsToList from './AddParticipantsToList';

// ==================== List Form Dialog ====================
const ListFormDialog = ({ open, onClose, onSuccess, editList }) => {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ name: '', description: '', is_global: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editList) {
      setForm({
        name: editList.name || '',
        description: editList.description || '',
        is_global: editList.is_global || false
      });
    } else {
      setForm({ name: '', description: '', is_global: false });
    }
    setError(null);
  }, [editList, open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('List name is required');
      return;
    }
    setSaving(true);
    setError(null);
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editList ? 'Edit Participant List' : 'Create New List'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
        <TextField
          fullWidth
          label="List Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          margin="normal"
          required
          autoFocus
        />
        <TextField
          fullWidth
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          margin="normal"
          multiline
          rows={3}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving || !form.name.trim()}>
          {saving ? 'Saving...' : (editList ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== View Members Component (Full Page Style) ====================
const ViewMembersView = ({ list, members, loading, onBack, onAddMembers, onRefresh }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box>
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link 
          color="inherit" 
          href="#" 
          onClick={(e) => { e.preventDefault(); onBack(); }}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
        >
          <HomeIcon fontSize="small" />
          Participant Lists
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PeopleIcon fontSize="small" />
          {list?.name}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700}>
            {list?.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {list?.description || 'No description'} • {members?.length || 0} members
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={onAddMembers}
          >
            Add Members
          </Button>
        </Box>
      </Box>

      {/* Members List */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={5}>
          <CircularProgress />
        </Box>
      ) : members?.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PeopleIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
          <Typography color="text.secondary" gutterBottom>
            No members in this list yet
          </Typography>
          <Button
            variant="outlined"
            startIcon={<PersonAddIcon />}
            onClick={onAddMembers}
            sx={{ mt: 1 }}
          >
            Add your first member
          </Button>
        </Paper>
      ) : isMobile ? (
        // Mobile view - Card based
        <Stack spacing={2}>
          {members.map((member) => (
            <Paper key={member.id} sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Avatar sx={{ bgcolor: '#6366f1', width: 48, height: 48 }}>
                  {member.name?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {member.name}
                  </Typography>
                  {member.email && (
                    <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={0.5} mt={0.5}>
                      <EmailIcon sx={{ fontSize: 14 }} /> {member.email}
                    </Typography>
                  )}
                  {member.telephone && (
                    <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                      <PhoneIcon sx={{ fontSize: 14 }} /> {member.telephone}
                    </Typography>
                  )}
                  {member.organization && (
                    <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                      <BusinessIcon sx={{ fontSize: 14 }} /> {member.organization}
                    </Typography>
                  )}
                  {member.title && (
                    <Chip label={member.title} size="small" variant="outlined" sx={{ mt: 1 }} />
                  )}
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        // Desktop view - Table
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 700 }}>Participant</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Organization</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: '#6366f1' }}>
                        {member.name?.charAt(0)?.toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" fontWeight={600}>
                        {member.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{member.email || '—'}</TableCell>
                  <TableCell>{member.telephone || '—'}</TableCell>
                  <TableCell>{member.organization || '—'}</TableCell>
                  <TableCell>{member.title || '—'}</TableCell>
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { lists, loading, error, listMembers } = useSelector((state) => state.participants);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [selectedList, setSelectedList] = useState(null);
  const [viewingList, setViewingList] = useState(null);
  const [editingList, setEditingList] = useState(null);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = useCallback(() => {
    dispatch(fetchParticipantLists());
  }, [dispatch]);

  const fetchListMembersData = useCallback(async (listId) => {
    setMembersLoading(true);
    try {
      await dispatch(fetchListMembers({ listId, params: { limit: 100 } })).unwrap();
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setMembersLoading(false);
    }
  }, [dispatch]);

  const handleEditList = (list) => {
    setEditingList(list);
    setCreateDialogOpen(true);
  };

  const handleAddMembers = (list) => {
    setSelectedList(list);
    setAddFormOpen(true);
  };

  const handleViewList = async (list) => {
    setViewingList(list);
    await fetchListMembersData(list.id);
  };

  const handleDeleteList = async (list) => {
    if (window.confirm(`Are you sure you want to delete "${list.name}"?`)) {
      try {
        await dispatch(deleteParticipantList(list.id)).unwrap();
        if (viewingList?.id === list.id) {
          setViewingList(null);
        }
        fetchLists();
      } catch (error) {
        console.error('Failed to delete list:', error);
      }
    }
  };

  const handleFormSuccess = () => {
    fetchLists();
    setEditingList(null);
  };

  const handleAddSuccess = () => {
    fetchLists();
    // Refresh members if viewing a list
    if (viewingList) {
      fetchListMembersData(viewingList.id);
    }
  };

  const handleBackToList = () => {
    setViewingList(null);
  };

  const handleRefreshMembers = () => {
    if (viewingList) {
      fetchListMembersData(viewingList.id);
    }
  };

  // Get members for the viewing list
  const members = listMembers[viewingList?.id]?.items || [];

  // If viewing a specific list, show the members view
  if (viewingList) {
    return (
      <Box>
        <ViewMembersView
          list={viewingList}
          members={members}
          loading={membersLoading}
          onBack={handleBackToList}
          onAddMembers={() => handleAddMembers(viewingList)}
          onRefresh={handleRefreshMembers}
        />
        
        <AddParticipantsToList
          open={addFormOpen}
          onClose={() => {
            setAddFormOpen(false);
            setSelectedList(null);
          }}
          onSuccess={handleAddSuccess}
          listId={selectedList?.id}
          listName={selectedList?.name}
        />
      </Box>
    );
  }

  // Otherwise, show the lists grid
  if (loading && lists.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py={5}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h5" fontWeight={700}>
          Participant Lists
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchLists}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create List
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {/* Lists Grid */}
      {lists.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <GroupIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
          <Typography color="text.secondary" gutterBottom>
            No participant lists yet
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create your first list
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {lists.map((list) => (
            <Grid item xs={12} sm={6} md={4} key={list.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
                onClick={() => handleViewList(list)}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      {list.name}
                    </Typography>
                    <Box onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEditList(list)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDeleteList(list)}>
                          <DeleteIcon fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {list.description || 'No description'}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                    <PeopleIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {list.participant_count || 0} members
                    </Typography>
                    {list.is_global && (
                      <Chip label="Global" size="small" color="primary" variant="outlined" />
                    )}
                  </Stack>
                </CardContent>
                <CardActions sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() => handleViewList(list)}
                  >
                    View Members
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<PersonAddIcon />}
                    onClick={() => handleAddMembers(list)}
                  >
                    Add
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialogs */}
      <ListFormDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditingList(null);
        }}
        onSuccess={handleFormSuccess}
        editList={editingList}
      />

      <AddParticipantsToList
        open={addFormOpen}
        onClose={() => {
          setAddFormOpen(false);
          setSelectedList(null);
        }}
        onSuccess={handleAddSuccess}
        listId={selectedList?.id}
        listName={selectedList?.name}
      />
    </Box>
  );
};

export default ParticipantListsManager;