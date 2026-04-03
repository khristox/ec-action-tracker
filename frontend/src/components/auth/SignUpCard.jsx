import React, { useState, useEffect } from 'react';
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
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [localFieldErrors, setLocalFieldErrors] = useState({});
  const [successSnackbarOpen, setSuccessSnackbarOpen] = useState(false);

  const errorMessage = error?.message || (typeof error === 'string' ? error : '');
  
  // Merge local and Redux field errors
  const fieldErrors = { ...localFieldErrors, ...reduxFieldErrors };

  // Show error snackbar when error occurs
  useEffect(() => {
    if (errorMessage) {
      setSnackbarOpen(true);
      // If there's a conflict error (409), show it prominently
      if (error?.status === 409) {
        setSnackbarOpen(true);
      }
    }
  }, [errorMessage, error]);

  // Handle registration success
  useEffect(() => {
    if (registrationSuccess) {
      setSuccessSnackbarOpen(true);
      // Clear any existing errors
      dispatch(clearError());
      
      // Redirect to login after 2 seconds
      const timer = setTimeout(() => {
        navigate('/login', { replace: true });
        dispatch(resetRegistrationSuccess());
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [registrationSuccess, navigate, dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setLocalFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
    // Also clear Redux field errors if any
    if (reduxFieldErrors[name]) {
      dispatch(clearError());
    }
  };

  const validateStep = () => {
    const errors = {};
    
    if (activeStep === 0) {
      if (!formData.full_name.trim()) {
        errors.full_name = 'Full name is required';
      } else if (formData.full_name.trim().length < 2) {
        errors.full_name = 'Full name must be at least 2 characters';
      }
      
      if (!formData.username.trim()) {
        errors.username = 'Username is required';
      } else if (formData.username.length < 3) {
        errors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        errors.username = 'Username can only contain letters, numbers, and underscores';
      }
      
      if (!formData.email.trim()) {
        errors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
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
      // Clear any errors when moving to next step
      dispatch(clearError());
      setLocalFieldErrors({});
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    // Clear errors when going back
    dispatch(clearError());
    setLocalFieldErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all steps before submission
    if (!validateStep()) {
      // If validation fails, go to the step with errors
      if (localFieldErrors.password || localFieldErrors.confirmPassword) {
        setActiveStep(1);
      } else if (localFieldErrors.full_name || localFieldErrors.username || localFieldErrors.email) {
        setActiveStep(0);
      }
      return;
    }
    
    // Clear any previous errors
    dispatch(clearError());
    setLocalFieldErrors({});
    
    try {
      const result = await dispatch(register({
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        full_name: formData.full_name.trim(),
      })).unwrap();
      
      console.log('Registration successful:', result);
      // Success is handled by useEffect
      
    } catch (err) {
      console.error('Registration failed:', err);
      // Error will be shown via snackbar
      
      // If it's a conflict error (user exists), go back to step 0 so user can change email/username
      if (error?.status === 409) {
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

  // Helper to check if a field has an error
  const hasFieldError = (fieldName) => {
    return !!fieldErrors[fieldName];
  };

  // Helper to get field error message
  const getFieldError = (fieldName) => {
    return fieldErrors[fieldName] || '';
  };

  // Get password strength indicator
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

  return (
    <>
      <Card
        sx={{
          width: { xs: '100%', sm: 500, md: 550 },
          maxWidth: '95vw',
          borderRadius: 4,
          boxShadow: '0 12px 40px rgba(0,0,0,0.13)',
          mx: 'auto',
          position: 'relative',
          overflow: 'visible',
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

          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Error Alert - Inline for immediate feedback */}
          {errorMessage && !snackbarOpen && (
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
            >
              Registration successful! Redirecting to login...
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {activeStep === 0 && (
              <Box>
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
                  disabled={isRegistering || registrationSuccess}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <BadgeOutlined color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                
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
                  disabled={isRegistering || registrationSuccess}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutline color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                
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
                  disabled={isRegistering || registrationSuccess}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlined color="action" />
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
                  disabled={isRegistering || registrationSuccess}
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
                          disabled={isRegistering || registrationSuccess}
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
                  disabled={isRegistering || registrationSuccess}
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
                          disabled={isRegistering || registrationSuccess}
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
                    <strong>Full Name:</strong> {formData.full_name}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Username:</strong> {formData.username}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Email:</strong> {formData.email}
                  </Typography>
                </Box>
              </Paper>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                onClick={handleBack}
                disabled={activeStep === 0 || isRegistering || registrationSuccess}
                variant="outlined"
              >
                Back
              </Button>
              
              {activeStep === steps.length - 1 ? (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isRegistering || registrationSuccess}
                  sx={{ minWidth: 120 }}
                >
                  {isRegistering ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Creating...
                    </>
                  ) : (
                    'Sign Up'
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  variant="contained"
                  disabled={isRegistering || registrationSuccess}
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
              disabled={isRegistering}
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
        autoHideDuration={2000}
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
          Registration successful! Redirecting to login...
        </Alert>
      </Snackbar>
    </>
  );
};

export default SignUpCard;