// src/components/meetings/MeetingForm/components/ManualParticipantEntry.jsx
import React, { useState } from 'react';
import {
  Stack,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  IconButton,
  InputAdornment,
  Alert
} from '@mui/material';
import {
  PersonAdd as PersonAdd,
  Close as Close,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Work as WorkIcon,
  Title as TitleIcon,
  Badge as BadgeIcon
} from '@mui/icons-material';

export const ManualParticipantEntry = ({ onAddParticipant, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    telephone: '',
    title: '',
    organization: ''
  });
  
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return '';
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Invalid email format';
        }
        return '';
      case 'telephone':
        if (value && !/^[\d\s\+\-\(\)]{8,}$/.test(value.replace(/\s/g, ''))) {
          return 'Invalid phone number';
        }
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleAdd = () => {
    // Validate all fields
    const newErrors = {};
    const fieldsToValidate = ['name'];
    
    // Only validate email and telephone if they have values
    if (formData.email) fieldsToValidate.push('email');
    if (formData.telephone) fieldsToValidate.push('telephone');
    
    fieldsToValidate.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });
    
    // Mark all as touched
    const allTouched = {};
    ['name', 'email', 'telephone', 'title', 'organization'].forEach(field => {
      allTouched[field] = true;
    });
    setTouched(allTouched);
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    if (!formData.name.trim()) return;
    
    onAddParticipant({
      ...formData,
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      is_chairperson: false,
      is_manual: true,
      created_at: new Date().toISOString()
    });
    
    // Reset form
    setFormData({
      name: '',
      email: '',
      telephone: '',
      title: '',
      organization: ''
    });
    setErrors({});
    setTouched({});
  };

  const handleReset = () => {
    setFormData({
      name: '',
      email: '',
      telephone: '',
      title: '',
      organization: ''
    });
    setErrors({});
    setTouched({});
  };

  const isFormValid = formData.name.trim().length >= 2;

  return (
    <Stack spacing={2}>
      <Alert severity="info" variant="outlined" sx={{ mb: 1 }}>
        <Typography variant="body2">
          <strong>Manual Entry:</strong> Add participants who don't have an account in the system.
          Only the name is required, other fields are optional.
        </Typography>
      </Alert>

      <TextField
        fullWidth
        label="Full Name *"
        name="name"
        value={formData.name}
        onChange={handleChange}
        onBlur={handleBlur}
        required
        error={!!errors.name && touched.name}
        helperText={touched.name && errors.name}
        placeholder="Enter participant's full name"
        autoFocus
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <BadgeIcon color="action" />
              </InputAdornment>
            )
          }
        }}
      />

      <TextField
        fullWidth
        label="Email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        onBlur={handleBlur}
        error={!!errors.email && touched.email}
        helperText={touched.email && errors.email}
        placeholder="participant@example.com"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon color="action" />
              </InputAdornment>
            )
          }
        }}
      />

      <TextField
        fullWidth
        label="Telephone"
        name="telephone"
        value={formData.telephone}
        onChange={handleChange}
        onBlur={handleBlur}
        error={!!errors.telephone && touched.telephone}
        helperText={touched.telephone && errors.telephone}
        placeholder="+1234567890"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <PhoneIcon color="action" />
              </InputAdornment>
            )
          }
        }}
      />

      <TextField
        fullWidth
        label="Job Title"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="e.g., Project Manager, Director"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <TitleIcon color="action" />
              </InputAdornment>
            )
          }
        }}
      />

      <TextField
        fullWidth
        label="Organization"
        name="organization"
        value={formData.organization}
        onChange={handleChange}
        placeholder="Company or organization name"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <WorkIcon color="action" />
              </InputAdornment>
            )
          }
        }}
      />

      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={!isFormValid}
          startIcon={<PersonAdd />}
          fullWidth
          size="large"
        >
          Add Participant
        </Button>
        
        {onCancel && (
          <Button
            variant="outlined"
            onClick={onCancel}
            startIcon={<Close />}
            fullWidth
            size="large"
          >
            Cancel
          </Button>
        )}
      </Stack>

      {!isFormValid && formData.name && (
        <Button
          variant="text"
          onClick={handleReset}
          size="small"
          sx={{ alignSelf: 'flex-start' }}
        >
          Clear Form
        </Button>
      )}

      {/* Preview Card */}
      {formData.name && (
        <Card variant="outlined" sx={{ mt: 2, bgcolor: 'action.hover' }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Preview
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Name:</strong> {formData.name}
              </Typography>
              {formData.email && (
                <Typography variant="body2">
                  <strong>Email:</strong> {formData.email}
                </Typography>
              )}
              {formData.telephone && (
                <Typography variant="body2">
                  <strong>Phone:</strong> {formData.telephone}
                </Typography>
              )}
              {formData.title && (
                <Typography variant="body2">
                  <strong>Title:</strong> {formData.title}
                </Typography>
              )}
              {formData.organization && (
                <Typography variant="body2">
                  <strong>Organization:</strong> {formData.organization}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};