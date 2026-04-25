import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Box,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  Link,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Snackbar,
  Slide,
  Fade,
  Backdrop,
  LinearProgress,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Grid,
  Collapse,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  PersonOutline,
  LockOutlined,
  EmailOutlined,
  BadgeOutlined,
  Business,
  CheckCircleOutline,
  ErrorOutline,
  InfoOutlined,
  HourglassEmpty,
  Refresh,
  Edit,
  Smartphone,
  SendOutlined,
  MarkEmailReadOutlined,
} from '@mui/icons-material';
import { register, clearError, resetRegistrationSuccess, resendVerification } from '../../store/slices/authSlice';

function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

const SignUpCard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isRegistering, error, fieldErrors: reduxFieldErrors, registrationSuccess, verificationEmailSent } = useSelector((state) => state.auth);

  // Form state
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [localFieldErrors, setLocalFieldErrors] = useState({});
  const [successSnackbarOpen, setSuccessSnackbarOpen] = useState(false);
  const [waitTimeRemaining, setWaitTimeRemaining] = useState(0);
  const [waitMessage, setWaitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [registeredEmail, setRegisteredEmail] = useState('');
  
  // Name splitting preferences
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameSplitOrder, setNameSplitOrder] = useState('first-last');
  const [tempFirstName, setTempFirstName] = useState('');
  const [tempLastName, setTempLastName] = useState('');

  // Generate username from email
  const generateUsernameFromEmail = useCallback((email) => {
    if (!email) return '';
    let username = email.split('@')[0];
    username = username.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (username.length > 30) username = username.substring(0, 30);
    return username;
  }, []);

  // Generate alternative username suggestions
  const generateUsernameSuggestions = useCallback((baseUsername) => {
    const suggestions = [];
    suggestions.push(`${baseUsername}${Math.floor(Math.random() * 1000)}`);
    suggestions.push(`${baseUsername}_${Math.floor(Math.random() * 100)}`);
    suggestions.push(`${baseUsername}${new Date().getFullYear()}`);
    suggestions.push(`${baseUsername}_user`);
    suggestions.push(`${baseUsername}${Math.floor(Math.random() * 10000)}`);
    return suggestions.slice(0, 5);
  }, []);

  // Split full name into first and last name based on order
  const splitFullName = useCallback((fullName, order = nameSplitOrder) => {
    if (!fullName || !fullName.trim()) {
      return { first_name: '', last_name: '' };
    }
    
    const nameParts = fullName.trim().split(/\s+/);
    
    if (nameParts.length === 1) {
      if (order === 'first-last') {
        return { first_name: nameParts[0], last_name: '' };
      } else {
        return { first_name: '', last_name: nameParts[0] };
      }
    }
    
    if (order === 'first-last') {
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      return { first_name: firstName, last_name: lastName };
    } else {
      const lastName = nameParts[nameParts.length - 1];
      const firstName = nameParts.slice(0, -1).join(' ');
      return { first_name: firstName, last_name: lastName };
    }
  }, [nameSplitOrder]);

  // Update first and last name when full name changes
  useEffect(() => {
    if (formData.full_name && !formData.first_name && !formData.last_name) {
      const { first_name, last_name } = splitFullName(formData.full_name);
      setFormData(prev => ({ ...prev, first_name, last_name }));
    }
  }, [formData.full_name, formData.first_name, formData.last_name, splitFullName]);

  // Auto-generate username when email changes
  useEffect(() => {
    if (formData.email && !formData.username) {
      const generatedUsername = generateUsernameFromEmail(formData.email);
      setFormData(prev => ({ ...prev, username: generatedUsername }));
    }
  }, [formData.email, formData.username, generateUsernameFromEmail]);

  // Handle resend countdown timer
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
    } else {
      setResendDisabled(false);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const getErrorMessage = (error) => {
    if (!error) return '';
    
    if (error.detail) {
      if (typeof error.detail === 'object') {
        return error.detail.message || error.detail.error || 'Registration failed';
      }
      if (typeof error.detail === 'string') {
        return error.detail;
      }
    }
    
    if (error.message) return error.message;
    if (typeof error === 'string') return error;
    
    return 'Registration failed. Please try again.';
  };

  const getFieldErrorFromResponse = (error) => {
    const fieldErrors = {};
    
    if (error?.detail && typeof error.detail === 'object' && error.detail.field) {
      fieldErrors[error.detail.field] = error.detail.message;
    }
    
    if (error?.detail?.wait_minutes) {
      setWaitTimeRemaining(error.detail.wait_minutes * 60);
      setWaitMessage(error.detail.message);
    }
    
    if (error?.errors && Array.isArray(error.errors)) {
      error.errors.forEach(err => {
        if (err.field) {
          fieldErrors[err.field] = err.message;
        }
      });
    }
    
    return fieldErrors;
  };

  const errorMessage = getErrorMessage(error);
  const responseFieldErrors = getFieldErrorFromResponse(error);
  const fieldErrors = { ...localFieldErrors, ...reduxFieldErrors, ...responseFieldErrors };

  useEffect(() => {
    let timer;
    if (waitTimeRemaining > 0) {
      timer = setInterval(() => {
        setWaitTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setWaitMessage('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [waitTimeRemaining]);

  useEffect(() => {
    if (errorMessage) {
      setSnackbarOpen(true);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (!isRegistering) {
      setIsSubmitting(false);
    }
  }, [isRegistering]);

  useEffect(() => {
    if (registrationSuccess) {
      setSuccessSnackbarOpen(true);
      dispatch(clearError());
      setIsSubmitting(false);
      
      // Open verification dialog after successful registration
      setTimeout(() => {
        setVerificationDialogOpen(true);
      }, 1500);
      
      // Reset registration success after showing dialog
      const timer = setTimeout(() => {
        dispatch(resetRegistrationSuccess());
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [registrationSuccess, dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'full_name') {
      const { first_name, last_name } = splitFullName(value);
      setFormData(prev => ({ ...prev, first_name, last_name }));
    }
    
    if (fieldErrors[name]) {
      setLocalFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    dispatch(clearError());
  };

  const handleRegenerateUsername = () => {
    if (formData.email) {
      const baseUsername = generateUsernameFromEmail(formData.email);
      const suggestions = generateUsernameSuggestions(baseUsername);
      const newUsername = suggestions[0];
      setFormData(prev => ({ ...prev, username: newUsername }));
      if (fieldErrors.username) {
        setLocalFieldErrors(prev => ({ ...prev, username: '' }));
      }
    }
  };

  const handleOpenNameDialog = () => {
    setTempFirstName(formData.first_name);
    setTempLastName(formData.last_name);
    setNameDialogOpen(true);
  };

  const handleSaveNameChanges = () => {
    setFormData(prev => ({
      ...prev,
      first_name: tempFirstName,
      last_name: tempLastName,
      full_name: `${tempFirstName} ${tempLastName}`.trim()
    }));
    setNameDialogOpen(false);
  };

  const handleToggleNameOrder = () => {
    const newOrder = nameSplitOrder === 'first-last' ? 'last-first' : 'first-last';
    setNameSplitOrder(newOrder);
    
    if (formData.full_name) {
      const { first_name, last_name } = splitFullName(formData.full_name, newOrder);
      setFormData(prev => ({ ...prev, first_name, last_name }));
    }
  };

  const handleResendVerification = async () => {
    if (resendDisabled) return;
    
    try {
      setResendDisabled(true);
      setResendCountdown(60); // 60 second cooldown
      
      await dispatch(resendVerification(registeredEmail || formData.email)).unwrap();
      
      // Show success message
      setSnackbarOpen(true);
      // You could also show a success notification here
    } catch (err) {
      console.error('Failed to resend verification:', err);
      setResendDisabled(false);
      setResendCountdown(0);
    }
  };

  const validateStep = () => {
    const errors = {};
    
    if (activeStep === 0) {
      if (!formData.email.trim()) {
        errors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }
      
      if (!formData.username.trim()) {
        errors.username = 'Username is required';
      } else if (formData.username.length < 3) {
        errors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        errors.username = 'Username can only contain letters, numbers, and underscores';
      }
      
      if (!formData.full_name.trim()) {
        errors.full_name = 'Full name is required';
      } else if (formData.full_name.trim().length < 2) {
        errors.full_name = 'Full name must be at least 2 characters';
      }
      
      if (!formData.first_name.trim()) {
        errors.first_name = 'First name is required';
      }
      if (!formData.last_name.trim()) {
        errors.last_name = 'Last name is required';
      }
      
      if (formData.phone && !/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(formData.phone)) {
        errors.phone = 'Please enter a valid phone number';
      }
    } else if (activeStep === 1) {
      if (!formData.password) {
        errors.password = 'Password is required';
      } else {
        if (formData.password.length < 8) {
          errors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[A-Z])/.test(formData.password)) {
          errors.password = 'Password must contain at least one uppercase letter';
        } else if (!/(?=.*[a-z])/.test(formData.password)) {
          errors.password = 'Password must contain at least one lowercase letter';
        } else if (!/(?=.*\d)/.test(formData.password)) {
          errors.password = 'Password must contain at least one number';
        } else if (!/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(formData.password)) {
          errors.password = 'Password must contain at least one special character';
        }
      }
      
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setLocalFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep((prev) => prev + 1);
      dispatch(clearError());
      setLocalFieldErrors({});
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    dispatch(clearError());
    setLocalFieldErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting || isRegistering || registrationSuccess || waitTimeRemaining > 0) {
      return;
    }
    
    if (!validateStep()) {
      if (localFieldErrors.password || localFieldErrors.confirmPassword) {
        setActiveStep(1);
      } else if (localFieldErrors.full_name || localFieldErrors.username || localFieldErrors.email || 
                 localFieldErrors.first_name || localFieldErrors.last_name || localFieldErrors.phone) {
        setActiveStep(0);
      }
      return;
    }
    
    dispatch(clearError());
    setLocalFieldErrors({});
    setIsSubmitting(true);
    
    // Store email for resend functionality
    setRegisteredEmail(formData.email.trim().toLowerCase());
    
    const registrationData = {
      email: formData.email.trim().toLowerCase(),
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      password: formData.password,
      username: formData.username.trim(),
      // Do NOT send full_name - backend expects first_name and last_name only
    };
    
    if (formData.phone) {
      registrationData.phone = formData.phone.trim();
    }
    
    try {
      const result = await dispatch(register(registrationData)).unwrap();
      console.log('Registration successful:', result);
    } catch (err) {
      console.error('Registration failed:', err);
      setIsSubmitting(false);
      
      if (err?.detail?.field) {
        setActiveStep(0);
      } else if (err?.status === 409) {
        setActiveStep(0);
      }
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
    dispatch(clearError());
  };

  const handleCloseSuccessSnackbar = () => {
    setSuccessSnackbarOpen(false);
  };

  const handleCloseVerificationDialog = () => {
    setVerificationDialogOpen(false);
    navigate('/login');
  };

  const steps = ['Personal Information', 'Create Password', 'Review'];

  const hasFieldError = (fieldName) => {
    return !!fieldErrors[fieldName];
  };

  const getFieldError = (fieldName) => {
    return fieldErrors[fieldName] || '';
  };

  const getPasswordStrength = () => {
    const password = formData.password;
    if (!password) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;
    
    if (score <= 2) return { score, label: 'Weak', color: 'error.main' };
    if (score <= 3) return { score, label: 'Fair', color: 'warning.main' };
    if (score <= 4) return { score, label: 'Good', color: 'info.main' };
    return { score, label: 'Strong', color: 'success.main' };
  };

  const passwordStrength = getPasswordStrength();

  const formatWaitTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const isFormDisabled = isRegistering || registrationSuccess || waitTimeRemaining > 0 || isSubmitting;

  return (
    <>
      {/* Verification Dialog */}
      <Dialog 
        open={verificationDialogOpen} 
        onClose={handleCloseVerificationDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <MarkEmailReadOutlined color="primary" />
            <Typography variant="h6">Verify Your Email Address</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            We've sent a verification link to:
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', textAlign: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary">
              {registeredEmail || formData.email}
            </Typography>
          </Paper>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please check your email and click the verification link to activate your account.
            The link will expire in 24 hours.
          </Typography>
          {verificationEmailSent && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Verification link sent! Please check your inbox and spam folder.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, flexDirection: 'column', gap: 2 }}>
          <Button 
            variant="contained" 
            fullWidth
            onClick={handleCloseVerificationDialog}
          >
            Go to Login
          </Button>
          <Button 
            variant="text" 
            fullWidth
            onClick={handleResendVerification}
            disabled={resendDisabled}
          >
            {resendDisabled ? `Resend available in ${resendCountdown}s` : 'Resend Verification Email'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fullscreen Backdrop during registration */}
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          flexDirection: 'column',
          gap: 2
        }}
        open={isRegistering || isSubmitting}
      >
        <CircularProgress color="primary" size={60} />
        <Typography variant="h6" sx={{ mt: 2, color: 'white' }}>
          {isSubmitting ? 'Processing...' : 'Creating your account...'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          Please do not close this window
        </Typography>
        <LinearProgress 
          sx={{ 
            width: '200px', 
            mt: 2,
            backgroundColor: 'rgba(255,255,255,0.2)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'white'
            }
          }} 
        />
      </Backdrop>

      {/* Name Modification Dialog */}
      <Dialog open={nameDialogOpen} onClose={() => setNameDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <BadgeOutlined />
            <Typography variant="h6">Edit Name Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={nameSplitOrder === 'last-first'}
                  onChange={handleToggleNameOrder}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2">
                  {nameSplitOrder === 'first-last' 
                    ? 'Order: First Name then Last Name' 
                    : 'Order: Last Name then First Name'}
                </Typography>
              }
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, mb: 2 }}>
              {nameSplitOrder === 'first-last' 
                ? 'First word(s) as First Name, remaining as Last Name' 
                : 'Last word as Last Name, remaining as First Name'}
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={tempFirstName}
                  onChange={(e) => setTempFirstName(e.target.value)}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={tempLastName}
                  onChange={(e) => setTempLastName(e.target.value)}
                  margin="normal"
                />
              </Grid>
            </Grid>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Full Name Preview: {`${tempFirstName} ${tempLastName}`.trim() || 'Enter names above'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveNameChanges} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Card
        sx={{
          width: { xs: '100%', sm: 500, md: 550 },
          maxWidth: '95vw',
          borderRadius: 4,
          boxShadow: '0 12px 40px rgba(0,0,0,0.13)',
          mx: 'auto',
          position: 'relative',
          overflow: 'visible',
          opacity: isFormDisabled ? 0.5 : 1,
          pointerEvents: isFormDisabled ? 'none' : 'auto',
          transition: 'opacity 0.3s ease',
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Business sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Create Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Join us to manage your action items and meetings
            </Typography>
          </Box>

          {/* Wait Timer Alert */}
          {waitTimeRemaining > 0 && waitMessage && (
            <Fade in>
              <Alert 
                severity="info" 
                icon={<HourglassEmpty />}
                sx={{ mb: 3 }}
                onClose={() => {
                  setWaitTimeRemaining(0);
                  setWaitMessage('');
                }}
              >
                <Typography variant="body2" fontWeight={500}>
                  {waitMessage}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} variant="determinate" value={(waitTimeRemaining / 600) * 100} />
                  <Typography variant="caption">
                    Please wait {formatWaitTime(waitTimeRemaining)} before trying again
                  </Typography>
                </Box>
              </Alert>
            </Fade>
          )}

          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Error Alert */}
          {errorMessage && !snackbarOpen && !waitMessage && (
            <Fade in>
              <Alert 
                severity="error" 
                icon={<ErrorOutline />}
                sx={{ mb: 3 }}
                onClose={() => dispatch(clearError())}
              >
                {errorMessage}
                {error?.status === 409 && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Try using a different email address or{' '}
                    <Link component="button" onClick={() => navigate('/login')}>
                      sign in instead
                    </Link>
                  </Typography>
                )}
              </Alert>
            </Fade>
          )}

          {/* Success Alert */}
          {registrationSuccess && (
            <Alert 
              severity="success" 
              icon={<CheckCircleOutline />} 
              sx={{ mb: 3 }}
              action={
                <Button color="inherit" size="small" onClick={() => setVerificationDialogOpen(true)}>
                  Verify Now
                </Button>
              }
            >
              <Typography variant="body2" fontWeight={500}>
                Registration successful!
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                Please verify your email to activate your account.
              </Typography>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {activeStep === 0 && (
              <Box>
                {/* Email Field */}
                <TextField
                  fullWidth
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  margin="normal"
                  required
                  error={hasFieldError('email')}
                  helperText={getFieldError('email')}
                  disabled={isFormDisabled}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlined color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                
                {/* Username Field */}
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  margin="normal"
                  required
                  error={hasFieldError('username')}
                  helperText={getFieldError('username') || 'Letters, numbers, and underscores only'}
                  disabled={isFormDisabled}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutline color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Generate new username">
                          <span>
                            <IconButton 
                              onClick={handleRegenerateUsername}
                              size="small"
                              disabled={isFormDisabled || !formData.email}
                              sx={{ ml: 0.5 }}
                            >
                              <Refresh fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
                
                {/* Username Suggestions */}
                {fieldErrors.username === 'This username is already taken. Please choose another.' && (
                  <Box sx={{ mt: 1, mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Suggestions:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                      {generateUsernameSuggestions(formData.username).map((suggestion, index) => (
                        <Chip
                          key={index}
                          label={suggestion}
                          size="small"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, username: suggestion }));
                            setLocalFieldErrors(prev => ({ ...prev, username: '' }));
                          }}
                          sx={{ cursor: 'pointer' }}
                          disabled={isFormDisabled}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                
                {/* Full Name Field with EDIT BUTTON */}
                <Box sx={{ position: 'relative', mt: 2, mb: 1 }}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    error={hasFieldError('full_name')}
                    helperText={getFieldError('full_name')}
                    disabled={isFormDisabled}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeOutlined color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Tooltip title="Edit First and Last Name Separately">
                    <IconButton
                      onClick={handleOpenNameDialog}
                      disabled={isFormDisabled}
                      sx={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                          transform: 'translateY(-50%) scale(1.05)',
                        },
                        zIndex: 1,
                        '&.Mui-disabled': {
                          backgroundColor: 'grey.400',
                          color: 'grey.600',
                        },
                      }}
                      size="small"
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                
                {/* Display split names */}
                {(formData.first_name || formData.last_name) && (
                  <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Will be saved as:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                      <Typography variant="body2">
                        <strong>First Name:</strong> {formData.first_name || '—'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Last Name:</strong> {formData.last_name || '—'}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      startIcon={<Edit />}
                      onClick={handleOpenNameDialog}
                      sx={{ mt: 1 }}
                      disabled={isFormDisabled}
                    >
                      Edit Names
                    </Button>
                  </Box>
                )}
                
                {/* Phone Field */}
                <TextField
                  fullWidth
                  label="Phone Number (Optional)"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  margin="normal"
                  error={hasFieldError('phone')}
                  helperText={getFieldError('phone') || 'e.g., +256712345678'}
                  disabled={isFormDisabled}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Smartphone color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}

            {activeStep === 1 && (
              <Box>
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  margin="normal"
                  required
                  error={hasFieldError('password')}
                  helperText={getFieldError('password')}
                  disabled={isFormDisabled}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton 
                          onClick={() => setShowPassword(!showPassword)} 
                          type="button"
                          disabled={isFormDisabled}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                
                {formData.password && !hasFieldError('password') && (
                  <Box sx={{ mt: 1, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InfoOutlined sx={{ fontSize: 14, color: passwordStrength.color }} />
                      <Typography variant="caption" sx={{ color: passwordStrength.color }}>
                        Password strength: {passwordStrength.label}
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <Box
                          key={level}
                          sx={{
                            height: 3,
                            flex: 1,
                            bgcolor: level <= passwordStrength.score ? passwordStrength.color : 'grey.300',
                            borderRadius: 1,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                
                <TextField
                  fullWidth
                  label="Confirm Password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  margin="normal"
                  required
                  error={hasFieldError('confirmPassword')}
                  helperText={getFieldError('confirmPassword')}
                  disabled={isFormDisabled}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                          type="button"
                          disabled={isFormDisabled}
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}

            {activeStep === 2 && (
              <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Review your information:
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Email:</strong> {formData.email}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Username:</strong> {formData.username}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>First Name:</strong> {formData.first_name}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Last Name:</strong> {formData.last_name}
                  </Typography>
                  {formData.phone && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Phone:</strong> {formData.phone}
                    </Typography>
                  )}
                </Box>
              </Paper>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                onClick={handleBack}
                disabled={activeStep === 0 || isFormDisabled}
                variant="outlined"
              >
                Back
              </Button>
              
              {activeStep === steps.length - 1 ? (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isFormDisabled}
                  sx={{ minWidth: 120, position: 'relative' }}
                >
                  {isSubmitting || isRegistering ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      {isSubmitting ? 'Processing...' : 'Creating...'}
                    </>
                  ) : (
                    'Sign Up'
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  variant="contained"
                  disabled={isFormDisabled}
                >
                  Next
                </Button>
              )}
            </Box>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Already have an account?
            </Typography>
          </Divider>

          <Box sx={{ textAlign: 'center' }}>
            <Button
              component={RouterLink}
              to="/login"
              variant="text"
              fullWidth
              disabled={isFormDisabled}
            >
              Sign In Instead
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Error Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        TransitionComponent={SlideTransition}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity="error" 
          variant="filled"
          icon={<ErrorOutline />}
          sx={{ width: '100%', boxShadow: 3 }}
        >
          <Typography variant="body2" fontWeight={500}>
            {errorMessage || 'Registration failed. Please try again.'}
          </Typography>
        </Alert>
      </Snackbar>

      {/* Success Snackbar */}
      <Snackbar
        open={successSnackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSuccessSnackbar}
        TransitionComponent={SlideTransition}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSuccessSnackbar} 
          severity="success" 
          variant="filled"
          icon={<CheckCircleOutline />}
          sx={{ width: '100%', boxShadow: 3 }}
        >
          <Typography variant="body2" fontWeight={500}>
            Registration successful!
          </Typography>
          <Typography variant="caption" display="block">
            Please check your email to verify your account.
          </Typography>
        </Alert>
      </Snackbar>
    </>
  );
};

export default SignUpCard;