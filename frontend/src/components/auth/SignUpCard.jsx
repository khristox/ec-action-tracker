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
  useMediaQuery,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  PersonOutlined,
  LockOutlined,
  EmailOutlined,
  BadgeOutlined,
  Group,
  CheckCircleOutlined,
  ErrorOutlined,
  InfoOutlined,
  HourglassEmpty,
  Refresh,
  Edit,
  Smartphone,
  MarkEmailReadOutlined,
  SendOutlined,
  VerifiedUserOutlined,
} from '@mui/icons-material';
import { register, clearError, resetRegistrationSuccess, resendVerification } from '../../store/slices/authSlice';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const DARK = {
  bg: '#0B0B0D',
  surface: '#161618',
  surfaceAlt: '#1D1D20',
  surfaceLight: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  textSecondary: '#A3A3AA',
};

const RESEND_COOLDOWN_SECONDS = 60;

// ─── HELPERS ────────────────────────────────────────────────────────────────
function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
const SignUpCard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { 
    isRegistering, 
    error, 
    fieldErrors: reduxFieldErrors, 
    registrationSuccess, 
    verificationEmailSent 
  } = useSelector((state) => state.auth);

  // ─── STATE ──────────────────────────────────────────────────────────────────
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
  const [localFieldErrors, setLocalFieldErrors] = useState({});
  const [waitTimeRemaining, setWaitTimeRemaining] = useState(0);
  const [waitMessage, setWaitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [verificationResendSuccess, setVerificationResendSuccess] = useState(false);
  const [verificationResendError, setVerificationResendError] = useState('');
  
  // ─── SNACKBAR STATE ────────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'error',
    autoHideDuration: 6000,
  });

  // Name splitting preferences
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameSplitOrder, setNameSplitOrder] = useState('first-last');
  const [tempFirstName, setTempFirstName] = useState('');
  const [tempLastName, setTempLastName] = useState('');

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const textFieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: isDarkMode ? DARK.surfaceLight : 'transparent',
      '& fieldset': {
        borderColor: isDarkMode ? DARK.border : 'rgba(0,0,0,0.23)',
      },
      '&:hover fieldset': {
        borderColor: isDarkMode ? DARK.borderStrong : 'rgba(0,0,0,0.4)',
      },
      '&.Mui-focused fieldset': {
        borderColor: 'primary.main',
      },
    },
    '& .MuiInputLabel-root': {
      color: isDarkMode ? DARK.textSecondary : undefined,
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: 'primary.main',
    },
    '& .MuiInputBase-input': {
      color: isDarkMode ? '#FFFFFF' : undefined,
    },
    '& .MuiFormHelperText-root': {
      color: isDarkMode ? 'rgba(255,255,255,0.5)' : undefined,
    },
  };

  const dialogPaperSx = {
    bgcolor: isDarkMode ? DARK.surface : '#FFFFFF',
    backgroundImage: 'none',
    border: isDarkMode ? `1px solid ${DARK.border}` : 'none',
  };

  // ─── UTILITY FUNCTIONS ─────────────────────────────────────────────────────
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

  const generateUsernameSuggestions = useCallback((baseUsername) => {
    const suggestions = [];
    suggestions.push(`${baseUsername}${Math.floor(Math.random() * 1000)}`);
    suggestions.push(`${baseUsername}_${Math.floor(Math.random() * 100)}`);
    suggestions.push(`${baseUsername}${new Date().getFullYear()}`);
    suggestions.push(`${baseUsername}_user`);
    suggestions.push(`${baseUsername}${Math.floor(Math.random() * 10000)}`);
    return suggestions.slice(0, 5);
  }, []);

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

  const formatWaitTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

  // ─── EFFECTS ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (formData.full_name && !formData.first_name && !formData.last_name) {
      const { first_name, last_name } = splitFullName(formData.full_name);
      setFormData(prev => ({ ...prev, first_name, last_name }));
    }
  }, [formData.full_name, formData.first_name, formData.last_name, splitFullName]);

  useEffect(() => {
    if (formData.email && !formData.username) {
      const generatedUsername = generateUsernameFromEmail(formData.email);
      setFormData(prev => ({ ...prev, username: generatedUsername }));
    }
  }, [formData.email, formData.username, generateUsernameFromEmail]);

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
    if (!isRegistering) {
      setIsSubmitting(false);
    }
  }, [isRegistering]);

  useEffect(() => {
    if (registrationSuccess) {
      setIsSubmitting(false);
      setRegisteredEmail(formData.email.trim().toLowerCase());
      
      // Show success snackbar
      setSnackbar({
        open: true,
        message: 'Registration successful! Please verify your email.',
        severity: 'success',
        autoHideDuration: 5000,
      });
      
      // Open verification dialog after a short delay
      setTimeout(() => {
        setVerificationDialogOpen(true);
      }, 1500);
      
      const timer = setTimeout(() => {
        dispatch(resetRegistrationSuccess());
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [registrationSuccess, dispatch]);

  // ─── HANDLERS ──────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'full_name') {
      const { first_name, last_name } = splitFullName(value);
      setFormData(prev => ({ ...prev, first_name, last_name }));
    }
    
    if (localFieldErrors[name]) {
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
      if (localFieldErrors.username) {
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

  // ─── RESEND VERIFICATION HANDLER ──────────────────────────────────────────
  const handleResendVerification = async () => {
    // Prevent multiple clicks
    if (resendDisabled || isSubmitting) return;
    
    // Get the email to send to
    const emailToSend = registeredEmail || formData.email;
    
    if (!emailToSend) {
      setSnackbar({
        open: true,
        message: 'No email address found. Please try again.',
        severity: 'error',
        autoHideDuration: 6000,
      });
      return;
    }

    // Reset states
    setVerificationResendSuccess(false);
    setVerificationResendError('');
    setIsSubmitting(true);
    setResendDisabled(true);
    setResendCountdown(RESEND_COOLDOWN_SECONDS);

    try {
      console.log('🔄 Sending resend verification for:', emailToSend);
      
      // Dispatch the action
      const result = await dispatch(resendVerification(emailToSend)).unwrap();
      
      console.log('✅ Resend verification result:', result);
      
      // Check if the result indicates success
      if (result && result.success === true) {
        setVerificationResendSuccess(true);
        setVerificationResendError('');
        
        setSnackbar({
          open: true,
          message: '✅ Verification email sent successfully! Please check your inbox and spam folder.',
          severity: 'success',
          autoHideDuration: 8000,
        });
      } else {
        // If result doesn't have success: true, treat as error
        throw new Error(result?.message || 'Failed to send verification email');
      }
      
    } catch (err) {
      console.error('❌ Failed to resend verification:', err);
      
      // Extract error message
      let errorMessage = 'Failed to resend verification email. Please try again.';
      
      if (err?.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.detail) {
        errorMessage = err.detail;
      }
      
      setVerificationResendSuccess(false);
      setVerificationResendError(errorMessage);
      
      setSnackbar({
        open: true,
        message: `❌ ${errorMessage}`,
        severity: 'error',
        autoHideDuration: 8000,
      });
      
      // Reset cooldown on error so user can try again immediately
      setResendDisabled(false);
      setResendCountdown(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── VALIDATION ────────────────────────────────────────────────────────────
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

  // ─── SUBMIT HANDLER ────────────────────────────────────────────────────────
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
    
    const emailToRegister = formData.email.trim().toLowerCase();
    setRegisteredEmail(emailToRegister);
    
    const registrationData = {
      email: emailToRegister,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      password: formData.password,
      username: formData.username.trim(),
    };
    
    if (formData.phone) {
      registrationData.phone = formData.phone.trim();
    }
    
    try {
      await dispatch(register(registrationData)).unwrap();
    } catch (err) {
      console.error('❌ Registration failed:', err);
      setIsSubmitting(false);
      
      // Show error snackbar
      const errorMsg = getErrorMessage(err);
      setSnackbar({
        open: true,
        message: `❌ ${errorMsg}`,
        severity: 'error',
        autoHideDuration: 8000,
      });
      
      if (err?.detail?.field) {
        setActiveStep(0);
      } else if (err?.status === 409) {
        setActiveStep(0);
      }
    }
  };

  // ─── NAVIGATION ────────────────────────────────────────────────────────────
  const handleCloseVerificationDialog = () => {
    setVerificationDialogOpen(false);
    navigate('/login');
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
    dispatch(clearError());
  };

  // ─── DERIVED STATE ─────────────────────────────────────────────────────────
  const errorMessage = getErrorMessage(error);
  const responseFieldErrors = getFieldErrorFromResponse(error);
  const fieldErrors = { ...localFieldErrors, ...reduxFieldErrors, ...responseFieldErrors };
  const passwordStrength = getPasswordStrength();
  const isFormDisabled = isRegistering || registrationSuccess || waitTimeRemaining > 0 || isSubmitting;

  const hasFieldError = (fieldName) => !!fieldErrors[fieldName];
  const getFieldError = (fieldName) => fieldErrors[fieldName] || '';

  const steps = ['Personal Information', 'Create Password', 'Review'];

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ─── VERIFICATION DIALOG ───────────────────────────────────────────── */}
      <Dialog 
        open={verificationDialogOpen} 
        onClose={handleCloseVerificationDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={{ borderBottom: isDarkMode ? `1px solid ${DARK.border}` : 'none' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <MarkEmailReadOutlined color="primary" />
            <Typography variant={isMobile ? 'h6' : 'h5'}>Verify Your Email Address</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            We've sent a verification link to:
          </Typography>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              bgcolor: isDarkMode ? DARK.surfaceLight : 'action.hover', 
              textAlign: 'center', 
              mb: 2,
              border: isDarkMode ? `1px solid ${DARK.border}` : undefined,
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ wordBreak: 'break-all' }}>
              {registeredEmail || formData.email}
            </Typography>
          </Paper>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please check your email and click the verification link to activate your account.
            The link will expire in 24 hours.
          </Typography>
          
          {/* Success message after resend */}
          {verificationResendSuccess && (
            <Alert 
              severity="success" 
              icon={<CheckCircleOutlined />}
              sx={{ 
                mt: 2,
                ...(isDarkMode && {
                  bgcolor: alpha('#10B981', 0.12),
                  color: '#6EE7B7',
                  '& .MuiAlert-icon': { color: '#34D399' },
                }),
              }}
            >
              Verification link sent! Please check your inbox and spam folder.
            </Alert>
          )}
          
          {/* Error message after resend */}
          {verificationResendError && (
            <Alert 
              severity="error" 
              icon={<ErrorOutlined />}
              sx={{ 
                mt: 2,
                ...(isDarkMode && {
                  bgcolor: alpha('#EF4444', 0.12),
                  color: '#FCA5A5',
                  '& .MuiAlert-icon': { color: '#F87171' },
                }),
              }}
            >
              {verificationResendError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, flexDirection: 'column', gap: 2, borderTop: isDarkMode ? `1px solid ${DARK.border}` : 'none' }}>
          <Button 
            variant="contained" 
            fullWidth
            onClick={handleCloseVerificationDialog}
            startIcon={<VerifiedUserOutlined />}
          >
            Go to Login
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <Button 
              variant="text" 
              fullWidth
              onClick={handleResendVerification}
              disabled={resendDisabled || isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={16} /> : <SendOutlined />}
            >
              {isSubmitting ? 'Sending...' : 
               resendDisabled ? `Resend available in ${resendCountdown}s` : 
               'Resend Verification Email'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* ─── FULLSCREEN BACKDROP ───────────────────────────────────────────── */}
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          flexDirection: 'column',
          gap: 2,
          bgcolor: isDarkMode ? alpha('#000000', 0.85) : alpha('#000000', 0.6),
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

      {/* ─── NAME EDIT DIALOG ──────────────────────────────────────────────── */}
      <Dialog 
        open={nameDialogOpen} 
        onClose={() => setNameDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={{ borderBottom: isDarkMode ? `1px solid ${DARK.border}` : 'none' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <BadgeOutlined />
            <Typography variant="h6">Edit Name Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
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
                  sx={textFieldSx}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={tempLastName}
                  onChange={(e) => setTempLastName(e.target.value)}
                  margin="normal"
                  sx={textFieldSx}
                />
              </Grid>
            </Grid>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Full Name Preview: {`${tempFirstName} ${tempLastName}`.trim() || 'Enter names above'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: isDarkMode ? `1px solid ${DARK.border}` : 'none' }}>
          <Button onClick={() => setNameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveNameChanges} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── MAIN CARD ──────────────────────────────────────────────────────── */}
      <Card
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', sm: 520, md: 550 },
          mx: 'auto',
          borderRadius: { xs: 3, sm: 4 },
          bgcolor: isDarkMode ? DARK.surface : '#FFFFFF',
          border: isDarkMode ? `1px solid ${DARK.border}` : 'none',
          boxShadow: isDarkMode
            ? `0 8px 32px 0 ${alpha('#000', 0.7)}, inset 0 0 0 1px ${DARK.border}`
            : { xs: '0 8px 24px rgba(0,0,0,0.12)', md: '0 12px 40px rgba(0,0,0,0.13)' },
          position: 'relative',
          overflow: 'visible',
          opacity: isFormDisabled ? 0.5 : 1,
          pointerEvents: isFormDisabled ? 'none' : 'auto',
          transition: 'opacity 0.3s ease',
        }}
      >
        <CardContent sx={{ 
          p: { xs: 2.5, sm: 3.5, md: 4 },
          '&:last-child': { pb: { xs: 2.5, sm: 3.5, md: 4 } }
        }}>
          {/* ─── HEADER ──────────────────────────────────────────────────────── */}
          <Box sx={{ textAlign: 'center', mb: { xs: 2.5, sm: 3 } }}>
            <Group sx={{ fontSize: { xs: 40, sm: 48 }, color: 'primary.main', mb: 1 }} />
            <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={700} gutterBottom sx={{ color: isDarkMode ? '#FFFFFF' : undefined }}>
              Create Account
            </Typography>
            <Typography variant="body2" sx={{ color: isDarkMode ? DARK.textSecondary : 'text.secondary' }}>
              Join us to manage your action items and meetings
            </Typography>
          </Box>

          {/* ─── WAIT TIMER ──────────────────────────────────────────────────── */}
          {waitTimeRemaining > 0 && waitMessage && (
            <Fade in>
              <Alert 
                severity="info" 
                icon={<HourglassEmpty />}
                sx={{
                  mb: 3,
                  ...(isDarkMode && {
                    bgcolor: alpha('#3B82F6', 0.12),
                    color: '#93C5FD',
                    '& .MuiAlert-icon': { color: '#60A5FA' },
                  }),
                }}
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

          {/* ─── STEPPER ────────────────────────────────────────────────────── */}
          <Stepper 
            activeStep={activeStep} 
            sx={{ 
              mb: 4, 
              overflowX: 'auto',
              '& .MuiStepLabel-label': {
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                color: isDarkMode ? DARK.textSecondary : undefined,
                '&.Mui-active': {
                  color: isDarkMode ? '#FFFFFF' : undefined,
                  fontWeight: 600,
                },
                '&.Mui-completed': {
                  color: isDarkMode ? '#A78BFA' : undefined,
                },
              },
              '& .MuiStepIcon-root': {
                color: isDarkMode ? 'rgba(255,255,255,0.15)' : undefined,
                '&.Mui-active': { color: isDarkMode ? '#7C3AED' : undefined },
                '&.Mui-completed': { color: isDarkMode ? '#7C3AED' : undefined },
              },
            }}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* ─── ERROR ALERT ────────────────────────────────────────────────── */}
          {errorMessage && !snackbar.open && !waitMessage && (
            <Fade in>
              <Alert 
                severity="error" 
                icon={<ErrorOutlined />}
                sx={{
                  mb: 3,
                  ...(isDarkMode && {
                    bgcolor: alpha('#EF4444', 0.12),
                    color: '#FCA5A5',
                    '& .MuiAlert-icon': { color: '#F87171' },
                  }),
                }}
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

          {/* ─── FORM ────────────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit}>
            {activeStep === 0 && (
              <Box>
                {/* Email */}
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
                  sx={textFieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlined color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                
                {/* Username */}
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
                  sx={textFieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutlined color="action" />
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
                              edge="end"
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
                    <Typography variant="caption" sx={{ color: isDarkMode ? DARK.textSecondary : 'text.secondary' }}>
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
                          sx={{
                            cursor: 'pointer',
                            ...(isDarkMode && {
                              bgcolor: DARK.surfaceLight,
                              color: '#E5E7EB',
                              border: `1px solid ${DARK.border}`,
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                            }),
                          }}
                          disabled={isFormDisabled}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                
                {/* Full Name */}
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
                    sx={textFieldSx}
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
                          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'grey.400',
                          color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'grey.600',
                        },
                      }}
                      size="small"
                      edge="end"
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                
                {/* Name Preview */}
                {(formData.first_name || formData.last_name) && (
                  <Box sx={{ 
                    mt: 2, mb: 2, p: 2, 
                    bgcolor: isDarkMode ? DARK.surfaceLight : '#f5f5f5', 
                    borderRadius: 2,
                    border: isDarkMode ? `1px solid ${DARK.border}` : 'none',
                  }}>
                    <Typography variant="caption" sx={{ color: isDarkMode ? DARK.textSecondary : 'text.secondary' }} gutterBottom display="block">
                      Will be saved as:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3, mt: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ color: isDarkMode ? '#FFFFFF' : undefined }}>
                        <strong>First Name:</strong> {formData.first_name || '—'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: isDarkMode ? '#FFFFFF' : undefined }}>
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
                
                {/* Phone */}
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
                  sx={textFieldSx}
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
                {/* Password */}
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
                  sx={textFieldSx}
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
                          onMouseDown={(e) => e.preventDefault()}
                          type="button"
                          disabled={isFormDisabled}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                
                {/* Password Strength */}
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
                            bgcolor: level <= passwordStrength.score
                              ? passwordStrength.color
                              : (isDarkMode ? 'rgba(255,255,255,0.12)' : 'grey.300'),
                            borderRadius: 1,
                          }}
                        />
                      ))}
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: isDarkMode ? DARK.textSecondary : 'text.secondary' }}>
                      Minimum 8 characters with uppercase, lowercase, number, and special character
                    </Typography>
                  </Box>
                )}
                
                {/* Confirm Password */}
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
                  sx={textFieldSx}
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
                          onMouseDown={(e) => e.preventDefault()}
                          type="button"
                          disabled={isFormDisabled}
                          edge="end"
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
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3, 
                  bgcolor: isDarkMode ? DARK.surfaceLight : 'background.default', 
                  borderRadius: 2,
                  border: isDarkMode ? `1px solid ${DARK.border}` : 'none',
                }}
              >
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: isDarkMode ? '#FFFFFF' : undefined }}>
                  Review your information:
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all', color: isDarkMode ? '#E5E7EB' : undefined }}>
                    <strong>Email:</strong> {formData.email}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: isDarkMode ? '#E5E7EB' : undefined }}>
                    <strong>Username:</strong> {formData.username}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: isDarkMode ? '#E5E7EB' : undefined }}>
                    <strong>First Name:</strong> {formData.first_name}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: isDarkMode ? '#E5E7EB' : undefined }}>
                    <strong>Last Name:</strong> {formData.last_name}
                  </Typography>
                  {formData.phone && (
                    <Typography variant="body2" sx={{ mt: 1, color: isDarkMode ? '#E5E7EB' : undefined }}>
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
                sx={isDarkMode ? {
                  borderColor: DARK.border,
                  color: DARK.textSecondary,
                  '&:hover': { borderColor: DARK.borderStrong, bgcolor: DARK.surfaceLight },
                } : undefined}
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

          <Divider sx={{ my: 3, borderColor: isDarkMode ? DARK.border : undefined }}>
            <Typography variant="caption" sx={{ color: isDarkMode ? DARK.textSecondary : 'text.secondary' }}>
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

      {/* ─── SNACKBAR ───────────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.autoHideDuration || 6000}
        onClose={handleCloseSnackbar}
        TransitionComponent={SlideTransition}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          variant="filled"
          icon={snackbar.severity === 'success' ? <CheckCircleOutlined /> : <ErrorOutlined />}
          sx={{ width: '100%', boxShadow: 3, maxWidth: 500 }}
        >
          <Typography variant="body2" fontWeight={500}>
            {snackbar.message}
          </Typography>
        </Alert>
      </Snackbar>
    </>
  );
};

export default SignUpCard;