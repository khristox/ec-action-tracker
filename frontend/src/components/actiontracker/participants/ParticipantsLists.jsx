// src/components/actiontracker/participants/ParticipantsList.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Alert, Pagination,
  TextField, Stack, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, Chip, Avatar, InputAdornment, Card, CardContent,
  IconButton, useMediaQuery, useTheme, Fab, Zoom, Menu, MenuItem,
  ListItemIcon, ListItemText, Snackbar, Tooltip, alpha
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Person as PersonIcon,
  Email as EmailIcon, Phone as PhoneIcon, Business as BusinessIcon,
  Close as CloseIcon, Edit as EditIcon, Delete as DeleteIcon,
  MoreVert as MoreVertIcon, Save as SaveIcon, Cancel as CancelIcon,
  Refresh as RefreshIcon, Description as DescriptionIcon
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isEditing = !!editParticipant;
  const dispatch = useDispatch();
  
  const [form, setForm] = useState({
    name: '', email: '', telephone: '', title: '', organization: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
      setForm({ name: '', email: '', telephone: '', title: '', organization: '', notes: '' });
    }
  }, [editParticipant, open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (isEditing) {
        await dispatch(updateParticipant({ id: editParticipant.id, data: form })).unwrap();
      } else {
        await dispatch(createParticipant(meetingId ? { ...form, meeting_id: meetingId } : form)).unwrap();
      }
      onSuccess();
      onClose();
    } catch (err) { setError(err.message); } 
    finally { setSaving(false); }
  };

  return (
    <Dialog 
      open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}
      PaperProps={{
        sx: {
          backgroundImage: 'none',
          bgcolor: isDark ? '#0F172A' : 'background.paper', // Deep Slate Midnight
          borderRadius: isMobile ? 0 : 4,
          border: isDark ? `1px solid ${alpha(theme.palette.primary.main, 0.1)}` : 'none',
          boxShadow: isDark ? `0 24px 50px ${alpha('#000', 0.6)}` : theme.shadows[10]
        }
      }}
    >
      <DialogTitle sx={{ p: 4, pb: 0 }}>
        <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: '-0.03em' }}>
          {isEditing ? 'Update Contact' : 'New Participant'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ p: 4 }}>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth label="Full Name" required value={form.name}
              onChange={(e) => setForm({...form, name: e.target.value})}
              variant="filled"
              InputProps={{ 
                disableUnderline: true, 
                sx: { borderRadius: 3, bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03) } 
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth label="Email" value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})}
              variant="filled"
              InputProps={{ 
                disableUnderline: true, 
                sx: { borderRadius: 3, bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03) } 
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth label="Phone" value={form.telephone}
              onChange={(e) => setForm({...form, telephone: e.target.value})}
              variant="filled"
              InputProps={{ 
                disableUnderline: true, 
                sx: { borderRadius: 3, bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03) } 
              }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 4, pt: 0 }}>
        <Button onClick={onClose} sx={{ fontWeight: 700, color: 'text.secondary' }}>Cancel</Button>
        <Button 
          variant="contained" onClick={handleSubmit} disabled={saving}
          sx={{ borderRadius: 3, px: 4, py: 1.5, fontWeight: 800, textTransform: 'none', boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.4)}` }}
        >
          {saving ? <CircularProgress size={24} /> : 'Confirm Details'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== Main Component ====================
const ParticipantsList = ({ meetingId }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { participants, loading } = useSelector((state) => state.participants);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);

  const fetchParticipantsData = useCallback(() => {
    dispatch(fetchParticipants({ search: searchTerm || undefined }));
  }, [dispatch, searchTerm]);

  useEffect(() => { fetchParticipantsData(); }, [fetchParticipantsData]);

  const { items: participantsList = [], total = 0 } = participants;

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: isDark ? '#020617' : '#F8FAFC', // Near-black Blue background
      p: isMobile ? 2 : 4,
      transition: 'background-color 0.4s ease'
    }}>
      {/* Premium Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={6}>
        <Box>
          <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: '-0.04em', color: 'text.primary' }}>
            Directory
          </Typography>
          <Typography variant="body1" sx={{ color: alpha(theme.palette.text.secondary, 0.7), fontWeight: 500 }}>
            {total} active participants synchronized
          </Typography>
        </Box>
        <Fab 
          color="primary" variant="extended" 
          onClick={() => setDialogOpen(true)}
          sx={{ px: 4, borderRadius: 4, fontWeight: 800, textTransform: 'none' }}
        >
          <AddIcon sx={{ mr: 1 }} /> Add New
        </Fab>
      </Stack>

      {/* Modern Search Field */}
      <TextField
        fullWidth placeholder="Search by name, organization, or email..."
        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon color="primary" /></InputAdornment>,
          sx: { 
            borderRadius: 5,
            px: 2,
            height: 60,
            fontSize: '1.1rem',
            bgcolor: isDark ? '#0F172A' : '#fff',
            border: `1px solid ${isDark ? alpha(theme.palette.primary.main, 0.1) : '#E2E8F0'}`,
            boxShadow: isDark ? '0 10px 30px -10px rgba(0,0,0,0.5)' : '0 10px 15px -3px rgba(0,0,0,0.05)',
            '& fieldset': { border: 'none' },
          }
        }}
        sx={{ mb: 6 }}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress size={60} thickness={2} /></Box>
      ) : (
        <TableContainer 
          component={Paper} 
          sx={{ 
            borderRadius: 6, 
            backgroundImage: 'none', 
            bgcolor: isDark ? '#0F172A' : '#fff', // Deep Navy Card
            border: `1px solid ${isDark ? alpha('#fff', 0.05) : '#F1F5F9'}`,
            overflow: 'hidden'
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: isDark ? alpha('#fff', 0.02) : '#F8FAFC' }}>
                <TableCell sx={{ fontWeight: 800, py: 3, color: alpha(theme.palette.text.primary, 0.5), fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Identity</TableCell>
                <TableCell sx={{ fontWeight: 800, color: alpha(theme.palette.text.primary, 0.5), fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Organization</TableCell>
                <TableCell sx={{ fontWeight: 800, color: alpha(theme.palette.text.primary, 0.5), fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contact</TableCell>
                <TableCell align="right" sx={{ pr: 4 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {participantsList.map((p) => (
                <TableRow key={p.id} hover sx={{ '&:hover': { bgcolor: isDark ? alpha(theme.palette.primary.main, 0.03) : alpha(theme.palette.primary.main, 0.01) } }}>
                  <TableCell sx={{ py: 2.5 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ 
                        width: 44, height: 44, 
                        bgcolor: isDark ? alpha(theme.palette.primary.main, 0.15) : 'primary.light',
                        color: 'primary.main', fontWeight: 900, border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`
                      }}>{p.name?.charAt(0)}</Avatar>
                      <Box>
                        <Typography variant="body1" fontWeight={800} color="text.primary">{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.title || 'No Title'}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} color="text.secondary">{p.organization || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EmailIcon sx={{ fontSize: 14 }} /> {p.email || 'No Email'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon sx={{ fontSize: 14 }} /> {p.telephone || '—'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 4 }}>
                    <IconButton onClick={() => { setEditingParticipant(p); setDialogOpen(true); }} sx={{ color: 'primary.main', bgcolor: isDark ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.main, 0.05), mr: 1 }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton sx={{ color: 'error.main', bgcolor: isDark ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.error.main, 0.05) }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ParticipantFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingParticipant(null); }}
        onSuccess={fetchParticipantsData}
        meetingId={meetingId}
        editParticipant={editingParticipant}
      />
    </Box>
  );
};

export default ParticipantsList;