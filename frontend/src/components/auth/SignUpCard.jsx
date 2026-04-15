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
} from '@mui/icons-material';
import { register, clearError, resetRegistrationSuccess } from '../../store/slices/authSlice';

function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

const SignUpCard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isRegistering, error, fieldErrors: reduxFieldErrors, registrationSuccess } = useSelector((state) => state.auth);

  // Form state
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [localFieldErrors, setLocalFieldErrors] = useState({});
  const [successSnackbarOpen, setSuccessSnackbarOpen] = useState(false);
  const [waitTimeRemaining, setWaitTimeRemaining] = useState(0);
  const [waitMessage, setWaitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // Add this to prevent double submission

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

  // Auto-generate username when email changes
  useEffect(() => {
    if (formData.email && !formData.username) {
      const generatedUsername = generateUsernameFromEmail(formData.email);
      setFormData(prev => ({ ...prev, username: generatedUsername }));
    }
  }, [formData.email, formData.username, generateUsernameFromEmail]);

  // Helper function to extract error message from various response formats
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

  // Helper function to extract field-specific errors
  const getFieldErrorFromResponse = (error) => {
    const fieldErrors = {};
    
    if (error?.detail && typeof error.detail === 'object' && error.detail.field) {
      fieldErrors[error.detail.field] = error.detail.message;
    }
    
    // Extract wait time if present
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
  
  // Merge local, Redux, and response field errors
  const fieldErrors = { ...localFieldErrors, ...reduxFieldErrors, ...responseFieldErrors };

  // Countdown timer for wait period
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

  // Show error snackbar when error occurs
  useEffect(() => {
    if (errorMessage) {
      setSnackbarOpen(true);
    }
  }, [errorMessage]);

  // Reset submitting state when registration completes or fails
  useEffect(() => {
    if (!isRegistering) {
      setIsSubmitting(false);
    }
  }, [isRegistering]);

  // Handle registration success
  useEffect(() => {
    if (registrationSuccess) {
      setSuccessSnackbarOpen(true);
      dispatch(clearError());
      setIsSubmitting(false);
      
      const timer = setTimeout(() => {
        navigate('/login', { replace: true });
        dispatch(resetRegistrationSuccess());
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [registrationSuccess, navigate, dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
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

  const validateStep = () => {
    const errors = {};
    
    if (activeStep === 0) {
      // Email validation first
      if (!formData.email.trim()) {
        errors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }
      
      // Username validation
      if (!formData.username.trim()) {
        errors.username = 'Username is required';
      } else if (formData.username.length < 3) {
        errors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        errors.username = 'Username can only contain letters, numbers, and underscores';
      }
      
      // Full name validation
      if (!formData.full_name.trim()) {
        errors.full_name = 'Full name is required';
      } else if (formData.full_name.trim().length < 2) {
        errors.full_name = 'Full name must be at least 2 characters';
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
    
    // Prevent double submission
    if (isSubmitting || isRegistering || registrationSuccess || waitTimeRemaining > 0) {
      return;
    }
    
    if (!validateStep()) {
      if (localFieldErrors.password || localFieldErrors.confirmPassword) {
        setActiveStep(1);
      } else if (localFieldErrors.full_name || localFieldErrors.username || localFieldErrors.email) {
        setActiveStep(0);
      }
      return;
    }
    
    dispatch(clearError());
    setLocalFieldErrors({});
    
    // Set submitting flag to prevent double submission
    setIsSubmitting(true);
    
    try {
      const result = await dispatch(register({
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        full_name: formData.full_name.trim(),
      })).unwrap();
      
      console.log('Registration successful:', result);
      
    } catch (err) {
      console.error('Registration failed:', err);
      setIsSubmitting(false); // Reset on error so user can try again
      
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

  // Determine if any action is in progress that should disable the form
  const isFormDisabled = isRegistering || registrationSuccess || waitTimeRemaining > 0 || isSubmitting;

  return (
    <>
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
              Join us to manage your rental properties
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

          {/* Error Alert - Inline for immediate feedback */}
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
                <Button color="inherit" size="small" onClick={() => navigate('/login')}>
                  Login Now
                </Button>
              }
            >
              <Typography variant="body2" fontWeight={500}>
                Registration successful!
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                Redirecting to login in 3 seconds...
              </Typography>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {activeStep === 0 && (
              <Box>
                {/* Email Field - First */}
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
                
                {/* Username Field with Regenerate Icon */}
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
                        {/* Wrap disabled button in a span for Tooltip */}
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
                
                {/* Full Name Field */}
                <TextField
                  fullWidth
                  label="Full Name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  margin="normal"
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
                
                {/* Password strength indicator */}
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
                    <strong>Full Name:</strong> {formData.full_name}
                  </Typography>
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

      {/* Error Snackbar Popup */}
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
          {error?.status === 409 && (
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              Try a different email address or{' '}
              <Link 
                component="button" 
                onClick={() => {
                  handleCloseSnackbar();
                  navigate('/login');
                }}
                sx={{ color: 'white', textDecoration: 'underline' }}
              >
                sign in
              </Link>
            </Typography>
          )}
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
            Redirecting to login...
          </Typography>
        </Alert>
      </Snackbar>
    </>
  );
};

export default SignUpCard;