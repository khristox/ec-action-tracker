// src/components/actiontracker/participants/CreateParticipant.jsx
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  Avatar,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  Divider,
  Breadcrumbs,
  Link,
  useMediaQuery,
  useTheme,
  Snackbar,
  Fade
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Title as TitleIcon,
  Description as DescriptionIcon,
  Home as HomeIcon,
  GroupAdd as GroupAddIcon
} from '@mui/icons-material';
import { createParticipant, clearError } from '../../../store/slices/actionTracker/participantSlice';

const CreateParticipant = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { loading, error } = useSelector((state) => state.participants);
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    telephone: '',
    title: '',
    organization: '',
    notes: ''
  });
  
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Validation functions
  const validateField = (field, value) => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.length < 2) return 'Name must be at least 2 characters';
        return '';
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Enter a valid email address';
        }
        return '';
      case 'telephone':
        if (value && !/^[\d\s+()-]{8,}$/.test(value)) {
          return 'Enter a valid phone number (min 8 digits)';
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

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      const allTouched = Object.keys(form).reduce((acc, key) => ({ ...acc, [key]: true }), {});
      setTouched(allTouched);
      return;
    }
    
    setSaving(true);
    try {
      const result = await dispatch(createParticipant(form)).unwrap();
      
      setSuccessMessage(`Participant "${result.name}" created successfully!`);
      
      setTimeout(() => {
        navigate('/participants');
      }, 1500);
    } catch (err) {
      console.error('Failed to create participant:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/participants');
  };

  return (
    <Box sx={{ p: isMobile ? 2 : 3 }}>
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link 
          color="inherit" 
          href="/participants" 
          onClick={(e) => { e.preventDefault(); navigate('/participants'); }}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Participants
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PersonAddIcon fontSize="small" />
          Create New Participant
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700}>
            Create New Participant
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add a new person to the participant directory
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSubmit}
            disabled={saving || !isFormValid()}
          >
            {saving ? 'Saving...' : 'Save Participant'}
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {/* Main Form */}
      <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
        <CardContent sx={{ p: isMobile ? 2 : 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Participant Information
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          {/* FIXED: Using new Grid v2 syntax - removed 'item' prop, using 'size' instead of 'xs', 'sm' */}
          <Grid container spacing={3}>
            {/* Full Name - Required */}
            <Grid size={12}>
              <TextField
                fullWidth
                required
                label="Full Name"
                value={form.name}
                onChange={handleChange('name')}
                onBlur={handleBlur('name')}
                error={!!getFieldError('name')}
                helperText={getFieldError('name') || "Enter the participant's full name"}
                placeholder="e.g., John Doe"
                size={isMobile ? "medium" : "small"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonAddIcon color={getFieldError('name') ? "error" : "action"} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Email and Phone - Row */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                onBlur={handleBlur('email')}
                error={!!getFieldError('email')}
                helperText={getFieldError('email') || "Optional - for notifications"}
                placeholder="john.doe@example.com"
                size={isMobile ? "medium" : "small"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color={getFieldError('email') ? "error" : "action"} />
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
                onBlur={handleBlur('telephone')}
                error={!!getFieldError('telephone')}
                helperText={getFieldError('telephone') || "Optional - for SMS updates"}
                placeholder="+254712345678"
                size={isMobile ? "medium" : "small"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon color={getFieldError('telephone') ? "error" : "action"} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Title and Organization - Row */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Title / Role"
                value={form.title}
                onChange={handleChange('title')}
                placeholder="e.g., Project Manager, Director"
                size={isMobile ? "medium" : "small"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <TitleIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                helperText="Optional - Job title or role"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Organization"
                value={form.organization}
                onChange={handleChange('organization')}
                placeholder="e.g., Electoral Commission, Ministry"
                size={isMobile ? "medium" : "small"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BusinessIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                helperText="Optional - Company or organization name"
              />
            </Grid>

            {/* Notes */}
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={isMobile ? 4 : 3}
                label="Additional Notes"
                value={form.notes}
                onChange={handleChange('notes')}
                placeholder="Any additional information about this participant..."
                size={isMobile ? "medium" : "small"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                      <DescriptionIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                helperText="Optional - Extra notes or comments"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Action Buttons at Bottom */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        gap: 2, 
        mt: 3,
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={handleCancel}
          fullWidth={isMobile}
          size="large"
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSubmit}
          disabled={saving || !isFormValid()}
          fullWidth={isMobile}
          size="large"
        >
          {saving ? 'Saving...' : 'Save Participant'}
        </Button>
      </Box>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Fade in={!!successMessage}>
          <Alert 
            severity="success" 
            onClose={() => setSuccessMessage(null)}
            icon={<GroupAddIcon />}
            sx={{ boxShadow: 3 }}
          >
            {successMessage}
          </Alert>
        </Fade>
      </Snackbar>
    </Box>
  );
};

export default CreateParticipant;