// frontend/src/components/actiontracker/participants/ParticipantForm.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  MenuItem,
  Grid,
  Chip,
  InputAdornment,
  useTheme,
  alpha
} from '@mui/material';
import {
  Close as CloseIcon,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const ParticipantForm = ({ open, onClose, onSave, editingParticipant, meetingId, loading: externalLoading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    phone: '',
    title: '',
    department: '',
    location: '',
    notes: ''
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // Populate form when editing
  useEffect(() => {
    if (open && editingParticipant) {
      setFormData({
        name: editingParticipant.name || '',
        email: editingParticipant.email || '',
        organization: editingParticipant.organization || '',
        phone: editingParticipant.phone || '',
        title: editingParticipant.title || '',
        department: editingParticipant.department || '',
        location: editingParticipant.location || '',
        notes: editingParticipant.notes || ''
      });
    } else if (open && !editingParticipant) {
      // Reset form for new participant
      setFormData({
        name: '',
        email: '',
        organization: '',
        phone: '',
        title: '',
        department: '',
        location: '',
        notes: ''
      });
    }
  }, [open, editingParticipant]);

  // Search for existing participants by name/email
  const searchParticipants = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    
    try {
      const response = await api.get('/action-tracker/participants/search', {
        params: { q: query, meeting_id: meetingId }
      });
      setSuggestions(response.data.data || []);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleChange = (field) => (event) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Search for suggestions on name/email
    if (field === 'name' || field === 'email') {
      searchParticipants(event.target.value);
    }
  };

  const handleSelectSuggestion = (participant) => {
    setFormData({
      name: participant.name || '',
      email: participant.email || '',
      organization: participant.organization || '',
      phone: participant.phone || '',
      title: participant.title || '',
      department: participant.department || '',
      location: participant.location || '',
      notes: participant.notes || ''
    });
    setSuggestions([]);
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      const payload = {
        meeting_id: meetingId,
        ...formData
      };
      
      if (editingParticipant) {
        await api.put(`/action-tracker/participants/${editingParticipant.id}`, payload);
      } else {
        await api.post('/action-tracker/participants', payload);
      }
      
      onSave();
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
      setErrors({ submit: err.response?.data?.detail || 'Failed to save participant' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{ 
        sx: { 
          borderRadius: 3,
          bgcolor: 'background.paper',
          backgroundImage: 'none'
        } 
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1,
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper'
      }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PersonAddIcon sx={{ color: theme.palette.primary.main }} />
          <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary' }}>
            {editingParticipant ? 'Edit Participant' : 'Add Participant'}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
        {errors.submit && (
          <Alert 
            severity="error" 
            sx={{ mb: 2, borderRadius: 2 }}
            onClose={() => setErrors(prev => ({ ...prev, submit: '' }))}
          >
            {errors.submit}
          </Alert>
        )}
        
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Existing participants found:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
              {suggestions.map((suggestion) => (
                <Chip
                  key={suggestion.id}
                  label={suggestion.name}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  color="primary"
                  size="small"
                  variant="outlined"
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.1)
                    }
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}
        
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Full Name *"
              value={formData.name}
              onChange={handleChange('name')}
              error={!!errors.name}
              helperText={errors.name}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonAddIcon fontSize="small" sx={{ color: 'action.active' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  }
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              error={!!errors.email}
              helperText={errors.email}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon fontSize="small" sx={{ color: 'action.active' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  }
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={handleChange('phone')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon fontSize="small" sx={{ color: 'action.active' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  }
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Organization"
              value={formData.organization}
              onChange={handleChange('organization')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon fontSize="small" sx={{ color: 'action.active' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  }
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Title / Position"
              value={formData.title}
              onChange={handleChange('title')}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  }
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Department"
              value={formData.department}
              onChange={handleChange('department')}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  }
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Location"
              value={formData.location}
              onChange={handleChange('location')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationIcon fontSize="small" sx={{ color: 'action.active' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  }
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={2}
              value={formData.notes}
              onChange={handleChange('notes')}
              placeholder="Additional notes about the participant..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  }
                }
              }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ 
        p: 2.5, 
        gap: 1,
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper'
      }}>
        <Button 
          onClick={onClose} 
          disabled={loading || externalLoading}
          sx={{ 
            color: 'text.secondary',
            '&:hover': {
              bgcolor: alpha(theme.palette.action.hover, 0.5)
            }
          }}
        >
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit}
          disabled={loading || externalLoading}
          startIcon={loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SaveIcon />}
          sx={{ 
            fontWeight: 600,
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: theme.shadows[4]
            },
            transition: 'all 0.2s'
          }}
        >
          {loading ? 'Saving...' : editingParticipant ? 'Update' : 'Add Participant'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ParticipantForm;