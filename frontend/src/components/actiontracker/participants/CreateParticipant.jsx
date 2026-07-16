// src/components/actiontracker/participants/CreateParticipant.jsx
import React, { useState, useEffect } from 'react';
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
  Fade,
  alpha,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as Save,
  Cancel as Cancel,
  PersonAdd as PersonAdd,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Title as TitleIcon,
  Description as DescriptionIcon,
  Home as HomeIcon,
  GroupAdd as GroupAdd,
  ListAlt as ListAltIcon
} from '@mui/icons-material';
import {
  createParticipant,
  clearError,
  fetchParticipantLists,
  selectParticipantLists,
  selectListsLoading
} from '../../../store/slices/actionTracker/participantSlice';

// Phone number formatting function - supports both local (07...) and international (+256...) formats
const formatPhoneNumber = (value) => {
  const hasPlus = value.trim().startsWith('+');
  const digits = value.replace(/\D/g, '');

  if (!digits) return '';

  // International format: +256 7XX XXX XXX
  if (hasPlus || digits.startsWith('256')) {
    const national = digits.startsWith('256') ? digits.slice(3) : digits;
    let formatted = '+256';
    if (national.length > 0) formatted += ` ${national.slice(0, 3)}`;
    if (national.length > 3) formatted += ` ${national.slice(3, 6)}`;
    if (national.length > 6) formatted += ` ${national.slice(6, 9)}`;
    return formatted;
  }

  // Local format: 0712 345 678
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
};

// Normalize any accepted input format into a consistent +256XXXXXXXXX shape for the API
const cleanPhoneNumber = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('256')) return `+${digits}`;
  if (digits.startsWith('0')) return `+256${digits.slice(1)}`;
  return `+${digits}`; // fallback for any other input
};

const CreateParticipant = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { loading, error } = useSelector((state) => state.participants);

  const participantLists = useSelector(selectParticipantLists);
  const listsLoading = useSelector(selectListsLoading);

  // Updated form fields to match backend expectations
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    organization: '',
    notes: '',
    listId: ''            // which participant list this participant belongs to
  });

  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    dispatch(fetchParticipantLists());
  }, [dispatch]);

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
      case 'phone':
        if (value) {
          const digits = value.replace(/\D/g, '');
          const isValidLocal = digits.startsWith('0') && digits.length === 10;
          const isValidIntl = digits.startsWith('256') && digits.length === 12;
          if (!isValidLocal && !isValidIntl) {
            return 'Enter a valid number: 07XXXXXXXX or +256XXXXXXXXX';
          }
        }
        return '';
      case 'listId':
        if (!value) return 'Please select a participant list';
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
    return (
      form.name.trim() !== '' &&
      !!form.listId &&
      !getFieldError('name') &&
      !getFieldError('phone') &&
      !getFieldError('email') &&
      !getFieldError('listId')
    );
  };

  const handleChange = (field) => (e) => {
    let value = e.target.value;

    // Format phone number on change
    if (field === 'phone') {
      value = formatPhoneNumber(value);
    }

    setForm(prev => ({ ...prev, [field]: value }));
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

    // Prepare payload with correct field names for backend
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: cleanPhoneNumber(form.phone) || undefined,
      role: form.role.trim() || undefined,
      organization: form.organization.trim() || undefined,
      notes: form.notes.trim() || undefined,
      _listId: form.listId   // consumed by the thunk, sent as ?participant_list_id=
    };

    // Remove undefined fields (optional fields)
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    console.log('Sending payload to backend:', payload);

    try {
      const result = await dispatch(createParticipant(payload)).unwrap();

      setSuccessMessage(`Participant "${result.name}" created successfully!`);

      setTimeout(() => {
        navigate('/participants');
      }, 1500);
    } catch (err) {
      console.error('Failed to create participant:', err);
      if (err?.response?.data) {
        console.error('Validation errors:', err.response.data);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/participants');
  };

  return (
    <Box sx={{
      p: isMobile ? 2 : 3,
      bgcolor: 'background.default',
      minHeight: '100vh'
    }}>
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs
        sx={{
          mb: 3,
          '& .MuiBreadcrumbs-separator': {
            color: 'text.disabled'
          }
        }}
      >
        <Link
          color="inherit"
          href="/participants"
          onClick={(e) => { e.preventDefault(); navigate('/participants'); }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'text.secondary',
            textDecoration: 'none',
            '&:hover': {
              color: 'primary.main'
            }
          }}
        >
          <HomeIcon fontSize="small" />
          Participants
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PersonAdd fontSize="small" />
          Create New Participant
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography
            variant={isMobile ? "h5" : "h4"}
            fontWeight={800}
            sx={{
              color: 'text.primary',
              background: isDark ? `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.main})` : 'none',
              backgroundClip: isDark ? 'text' : 'none',
              WebkitBackgroundClip: isDark ? 'text' : 'none',
              WebkitTextFillColor: isDark ? 'transparent' : 'inherit'
            }}
          >
            Create New Participant
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Add a new person to the participant directory
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Cancel />}
            onClick={handleCancel}
            sx={{
              borderColor: 'divider',
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'error.main',
                bgcolor: alpha(theme.palette.error.main, 0.1),
                color: 'error.main'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <Save />}
            onClick={handleSubmit}
            disabled={saving || !isFormValid()}
            sx={{
              background: isDark ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})` : undefined,
              boxShadow: isDark ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}` : undefined,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: isDark ? `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}` : undefined,
              },
              transition: 'all 0.2s'
            }}
          >
            {saving ? 'Saving...' : 'Save Participant'}
          </Button>
        </Box>
      </Box>

      {/* Error Alert with Details */}
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.error.main, 0.1),
            backdropFilter: 'blur(8px)',
            '& .MuiAlert-icon': {
              color: theme.palette.error.main
            }
          }}
          onClose={() => dispatch(clearError())}
        >
          <Typography variant="subtitle2" fontWeight="bold">Error Details:</Typography>
          {typeof error === 'object' ? (
            <Box component="pre" sx={{ mt: 1, fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(error, null, 2)}
            </Box>
          ) : (
            error
          )}
        </Alert>
      )}

      {/* Main Form */}
      <Card
        elevation={0}
        sx={{
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 3,
          bgcolor: isDark ? alpha(theme.palette.background.paper, 0.8) : 'background.paper',
          backdropFilter: isDark ? 'blur(10px)' : 'none',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: isDark ? `0 8px 24px ${alpha(theme.palette.common.black, 0.2)}` : theme.shadows[2],
          }
        }}
      >
        <CardContent sx={{ p: isMobile ? 2 : 3 }}>
          <Typography
            variant="h6"
            fontWeight={700}
            gutterBottom
            sx={{
              color: 'text.primary',
              borderLeft: `3px solid ${theme.palette.primary.main}`,
              pl: 2,
              mb: 2
            }}
          >
            Participant Information
          </Typography>
          <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.1) }} />

          <Grid container spacing={3}>
            {/* Participant List - Required */}
            <Grid size={12}>
              <FormControl
                fullWidth
                required
                error={!!getFieldError('listId')}
                size={isMobile ? "medium" : "small"}
              >
                <InputLabel>Participant List</InputLabel>
                <Select
                  value={form.listId}
                  label="Participant List"
                  onChange={handleChange('listId')}
                  onBlur={handleBlur('listId')}
                  startAdornment={
                    <InputAdornment position="start">
                      <ListAltIcon color={getFieldError('listId') ? "error" : "action"} />
                    </InputAdornment>
                  }
                  sx={{
                    bgcolor: alpha(theme.palette.background.paper, 0.6),
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.background.paper, 0.8),
                    },
                    '& fieldset': {
                      borderColor: alpha(theme.palette.divider, 0.5),
                    }
                  }}
                >
                  {listsLoading && (
                    <MenuItem disabled value="">
                      <CircularProgress size={16} sx={{ mr: 1 }} /> Loading lists...
                    </MenuItem>
                  )}
                  {participantLists.map(list => (
                    <MenuItem key={list.id} value={list.id}>
                      {list.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {getFieldError('listId') || 'Choose which list this participant belongs to'}
                </FormHelperText>
              </FormControl>
            </Grid>

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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: alpha(theme.palette.background.paper, 0.6),
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.background.paper, 0.8),
                    },
                    '&.Mui-focused': {
                      bgcolor: alpha(theme.palette.background.paper, 0.9),
                      boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                    },
                    '& fieldset': {
                      borderColor: alpha(theme.palette.divider, 0.5),
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonAdd color={getFieldError('name') ? "error" : "action"} />
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: alpha(theme.palette.background.paper, 0.6),
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.background.paper, 0.8),
                    },
                    '&.Mui-focused': {
                      bgcolor: alpha(theme.palette.background.paper, 0.9),
                      boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                    },
                    '& fieldset': {
                      borderColor: alpha(theme.palette.divider, 0.5),
                    }
                  }
                }}
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
                value={form.phone}
                onChange={handleChange('phone')}
                onBlur={handleBlur('phone')}
                error={!!getFieldError('phone')}
                helperText={getFieldError('phone') || "Optional — e.g. 0712345678 or +256712345678"}
                placeholder="0712 345 678 or +256 712 345 678"
                size={isMobile ? "medium" : "small"}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: alpha(theme.palette.background.paper, 0.6),
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.background.paper, 0.8),
                    },
                    '&.Mui-focused': {
                      bgcolor: alpha(theme.palette.background.paper, 0.9),
                      boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                    },
                    '& fieldset': {
                      borderColor: alpha(theme.palette.divider, 0.5),
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon color={getFieldError('phone') ? "error" : "action"} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Role and Organization - Row */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Role / Title"
                value={form.role}
                onChange={handleChange('role')}
                placeholder="e.g., Project Manager, Director, Commissioner"
                size={isMobile ? "medium" : "small"}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: alpha(theme.palette.background.paper, 0.6),
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.background.paper, 0.8),
                    },
                    '& fieldset': {
                      borderColor: alpha(theme.palette.divider, 0.5),
                    }
                  }
                }}
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
                label="Organization / Company"
                value={form.organization}
                onChange={handleChange('organization')}
                placeholder="e.g., Electoral Commission, Ministry of Finance"
                size={isMobile ? "medium" : "small"}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: alpha(theme.palette.background.paper, 0.6),
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.background.paper, 0.8),
                    },
                    '& fieldset': {
                      borderColor: alpha(theme.palette.divider, 0.5),
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BusinessIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                helperText="Optional - Organization name"
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: alpha(theme.palette.background.paper, 0.6),
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.background.paper, 0.8),
                    },
                    '&.Mui-focused': {
                      bgcolor: alpha(theme.palette.background.paper, 0.9),
                      boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                    },
                    '& fieldset': {
                      borderColor: alpha(theme.palette.divider, 0.5),
                    }
                  }
                }}
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
          startIcon={<Cancel />}
          onClick={handleCancel}
          fullWidth={isMobile}
          size="large"
          sx={{
            borderColor: 'divider',
            color: 'text.secondary',
            '&:hover': {
              borderColor: 'error.main',
              bgcolor: alpha(theme.palette.error.main, 0.1),
              color: 'error.main'
            }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <Save />}
          onClick={handleSubmit}
          disabled={saving || !isFormValid()}
          fullWidth={isMobile}
          size="large"
          sx={{
            background: isDark ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})` : undefined,
            boxShadow: isDark ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}` : undefined,
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: isDark ? `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}` : undefined,
            },
            transition: 'all 0.2s'
          }}
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
            icon={<GroupAdd />}
            sx={{
              boxShadow: 3,
              bgcolor: isDark ? alpha(theme.palette.success.main, 0.9) : theme.palette.success.main,
              color: '#fff',
              '& .MuiAlert-icon': {
                color: '#fff'
              }
            }}
          >
            {successMessage}
          </Alert>
        </Fade>
      </Snackbar>
    </Box>
  );
};

export default CreateParticipant;