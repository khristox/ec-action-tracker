// SignInCard.jsx - FIXED VERSION (removed React.memo, added hard reload)

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Card, CardContent, TextField, Button, Typography, Box,
  InputAdornment, IconButton, Alert, CircularProgress, Divider,
  Link, Snackbar, Slide, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Paper, FormControlLabel, Checkbox,
  Zoom, Tooltip, useMediaQuery, useTheme, Fade
} from '@mui/material';
import {
  Visibility, VisibilityOff, PersonOutline, LockOutlined,
  Group, CheckCircleOutline, ErrorOutline, EmailOutlined,
  CloseOutlined, Login, SendOutlined
} from '@mui/icons-material';
import { login, clearError, resetLoginSuccess, resendVerification } from '../../store/slices/authSlice';

// ========== CONSTANTS ==========
const VALIDATION_RULES = {
  username: {
    required: true,
    minLength: 3,
    emailPattern: /\S+@\S+\.\S+/
  },
  password: {
    required: true,
    minLength: 6
  }
};

const AUTO_HIDE_DURATION = 6000;
const DEBOUNCE_DELAY = 300;

// ========== TRANSITION COMPONENTS ==========
const SlideTransition = React.forwardRef((props, ref) => <Slide {...props} ref={ref} direction="up" />);
SlideTransition.displayName = 'SlideTransition';

// ========== CUSTOM HOOKS ==========
const useFormValidation = (formData) => {
  const validateField = useCallback((name, value) => {
    const rules = VALIDATION_RULES[name];
    if (!rules) return '';

    if (rules.required && !value?.trim()) {
      return name === 'username' ? 'Email or username is required' : 'Password is required';
    }

    if (name === 'username') {
      if (value.includes('@') && !VALIDATION_RULES.username.emailPattern.test(value)) {
        return 'Please enter a valid email address';
      }
      if (!value.includes('@') && value.trim().length < VALIDATION_RULES.username.minLength) {
        return `Username must be at least ${VALIDATION_RULES.username.minLength} characters`;
      }
    }

    if (name === 'password' && value.length < VALIDATION_RULES.password.minLength) {
      return `Password must be at least ${VALIDATION_RULES.password.minLength} characters`;
    }

    return '';
  }, []);

  const isFormValid = useMemo(() => {
    return !validateField('username', formData.username) && 
           !validateField('password', formData.password);
  }, [formData, validateField]);

  return { validateField, isFormValid };
};

const useCapsLockDetector = () => {
  const [capsLockOn, setCapsLockOn] = useState(false);
  
  const handleKeyPress = useCallback((e) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  }, []);
  
  return { capsLockOn, handleKeyPress };
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};

// ========== MAIN COMPONENT (NO React.memo) ==========
const SignInCard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { isLoading, error, isAuthenticated, loginSuccess, verificationEmailSent } = useSelector((state) => state.auth);
  
  // State
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordCheckbox, setShowPasswordCheckbox] = useState(false);
  const [touched, setTouched] = useState({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);
  const [loginCompleted, setLoginCompleted] = useState(false);
  
  // Custom hooks
  const { capsLockOn, handleKeyPress } = useCapsLockDetector();
  const { validateField, isFormValid } = useFormValidation(formData);
  const debouncedUsername = useDebounce(formData.username, DEBOUNCE_DELAY);
  
  // Refs
  const usernameRef = useRef(null);
  const formRef = useRef(null);
  
  // Memoized values
  const errorMessage = useMemo(() => {
    if (!error) return '';
    return error?.message || (typeof error === 'string' ? error : 'Authentication failed');
  }, [error]);
  
  const isUnverifiedError = useMemo(() => {
    const lowerError = errorMessage.toLowerCase();
    return lowerError.includes('not verified') || 
           lowerError.includes('verification link') ||
           lowerError.includes('unverified');
  }, [errorMessage]);
  
  const getFieldError = useCallback((name) => {
    return touched[name] ? validateField(name, formData[name]) : '';
  }, [touched, formData, validateField]);
  
  // Navigation on auth success - FIXED with hard reload
  useEffect(() => {
    if ((isAuthenticated || loginSuccess) && !loginCompleted) {
      console.log('Authentication successful, redirecting to dashboard...');
      setLoginCompleted(true);
      
      // Use hard reload to ensure all components (Sidebar, Navbar) reload
      window.location.href = '/dashboard';
    }
  }, [isAuthenticated, loginSuccess, loginCompleted]);
  
  // Reset login completed when component mounts
  useEffect(() => {
    return () => {
      setLoginCompleted(false);
    };
  }, []);
  
  // Handle unverified dialog
  useEffect(() => {
    if (isUnverifiedError && !resendDialogOpen) {
      const potentialEmail = debouncedUsername.includes('@') ? debouncedUsername : '';
      setResendEmail(potentialEmail);
      setResendDialogOpen(true);
      setResendSuccess(false);
    }
  }, [isUnverifiedError, debouncedUsername, resendDialogOpen]);
  
  // Handle error snackbar
  useEffect(() => {
    if (errorMessage && !isUnverifiedError) {
      setSnackbarOpen(true);
    }
  }, [errorMessage, isUnverifiedError]);
  
  // Focus username on mount
  useEffect(() => {
    if (usernameRef.current) {
      const timer = setTimeout(() => usernameRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Handle field changes
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Reset login completed flag when user starts typing again
    if (loginCompleted) {
      setLoginCompleted(false);
    }
  }, [loginCompleted]);
  
  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  }, []);
  
  const handleShowPasswordToggle = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);
  
  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ username: true, password: true });
    
    // Validate form
    if (!isFormValid) return;
    
    // Clear previous errors and reset login completed
    dispatch(clearError());
    setLoginCompleted(false);
    
    try {
      const result = await dispatch(login({
        username: formData.username.trim(),
        password: formData.password,
      })).unwrap();
      
      console.log('Login API response:', result);
      // Navigation will happen in useEffect when isAuthenticated or loginSuccess changes
      
    } catch (err) {
      console.debug('Login failed:', err);
      setLoginCompleted(false);
    }
  }, [dispatch, formData, isFormValid]);
  
  // Handle resend verification
  const handleResendVerification = useCallback(async () => {
    const email = resendEmail || formData.username;
    if (!email) return;
    
    try {
      await dispatch(resendVerification(email)).unwrap();
      setResendSuccess(true);
      
      // Auto close dialog after success
      const timer = setTimeout(() => {
        handleCloseDialog();
      }, 3000);
      
      return () => clearTimeout(timer);
    } catch (err) {
      console.error('Resend failed:', err);
    }
  }, [dispatch, resendEmail, formData.username]);
  
  // Close dialog
  const handleCloseDialog = useCallback(() => {
    setResendDialogOpen(false);
    setResendSuccess(false);
    dispatch(clearError());
  }, [dispatch]);
  
  // Close snackbar
  const handleCloseSnackbar = useCallback(() => {
    setSnackbarOpen(false);
  }, []);
  
  // Handle "Enter" key for form submission
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isFormValid && !isLoading) {
        handleSubmit(e);
      }
    }
  }, [isFormValid, isLoading, handleSubmit]);
  
  // Show loading while redirecting
  if (loginCompleted) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, flexDirection: 'column', gap: 2 }}>
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">
          Redirecting to dashboard...
        </Typography>
      </Box>
    );
  }
  
  return (
    <>
      <Card
        elevation={isMobile ? 1 : 3}
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', sm: 480, md: 520 },
          borderRadius: { xs: 3, sm: 4 },
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: isMobile ? 2 : 6,
          },
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Zoom in timeout={500}>
              <Group sx={{ fontSize: { xs: 40, sm: 48 }, color: 'primary.main', mb: 2 }} />
            </Zoom>
            <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700} gutterBottom>
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to manage your meetings and tasks
            </Typography>
          </Box>
          
          {/* Form */}
          <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
            {/* Username Field */}
            <TextField
              ref={usernameRef}
              fullWidth
              label="Email or Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              onBlur={handleBlur}
              margin="normal"
              required
              disabled={isLoading}
              error={!!getFieldError('username')}
              helperText={getFieldError('username')}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutline color="action" />
                    </InputAdornment>
                  ),
                }
              }}
            />
            
            {/* Password Field */}
            <TextField
              fullWidth
              label="Password"
              type={showPassword || showPasswordCheckbox ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyPress={handleKeyPress}
              margin="normal"
              required
              disabled={isLoading}
              error={!!getFieldError('password')}
              helperText={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <span>{getFieldError('password')}</span>
                  {capsLockOn && getFieldError('password') && ' • '}
                  {capsLockOn && (
                    <Typography component="span" variant="caption" color="warning.main" fontWeight="medium">
                      ⚠️ Caps Lock is on
                    </Typography>
                  )}
                </Box>
              }
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showPassword ? "Hide password" : "Show password"}>
                        <IconButton 
                          onClick={handleShowPasswordToggle}
                          onMouseDown={(e) => e.preventDefault()}
                          edge="end"
                          disabled={isLoading}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }
              }}
            />
            
            {/* Options Row */}
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showPasswordCheckbox}
                    onChange={(e) => setShowPasswordCheckbox(e.target.checked)}
                    size="small"
                    disabled={isLoading}
                  />
                }
                label={<Typography variant="caption" color="text.secondary">Show password</Typography>}
              />
              <Link 
                component={RouterLink} 
                to="/forgot-password" 
                variant="body2" 
                underline="hover"
                sx={{ fontSize: '0.875rem' }}
              >
                Forgot password?
              </Link>
            </Box>
            
            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading || !isFormValid}
              startIcon={!isLoading && <Login />}
              sx={{ 
                mt: 3, 
                mb: 2, 
                py: { xs: 1.5, sm: 1.8 },
                transition: 'all 0.2s ease',
              }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>
          
          {/* Divider */}
          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">Don't have an account?</Typography>
          </Divider>
          
          {/* Sign Up Button */}
          <Button
            component={RouterLink} 
            to="/signup"
            fullWidth 
            variant="outlined" 
            size="large"
            disabled={isLoading}
            sx={{ py: 1.5 }}
          >
            Create New Account
          </Button>
        </CardContent>
      </Card>
      
      {/* Verification Dialog */}
      <Dialog
        open={resendDialogOpen}
        onClose={handleCloseDialog}
        TransitionComponent={SlideTransition}
        maxWidth="xs"
        fullWidth
        disableEscapeKeyDown={false}
        slotProps={{
          paper: {
            sx: {
              borderRadius: { xs: 2, sm: 3 },
              overflow: 'hidden',
            }
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmailOutlined color="warning" />
              <Typography variant="h6" component="span">Verify Your Email</Typography>
            </Box>
            <IconButton
              aria-label="close"
              onClick={handleCloseDialog}
              size="small"
              disabled={isLoading}
            >
              <CloseOutlined />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Your account hasn't been verified yet. We'll send a new verification link to:
          </DialogContentText>
          
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              bgcolor: 'action.hover', 
              textAlign: 'center',
              borderRadius: 2,
              borderColor: 'primary.main',
              borderWidth: 1,
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold" color="primary">
              {resendEmail || formData.username || "your email address"}
            </Typography>
          </Paper>
          
          {resendSuccess && (
            <Fade in>
              <Alert 
                severity="success" 
                sx={{ mt: 2 }}
                icon={<CheckCircleOutline />}
              >
                Verification link sent! Please check your inbox and spam folder.
              </Alert>
            </Fade>
          )}
          
          {verificationEmailSent && !resendSuccess && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Verification link has been sent. Please check your email.
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 0, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
          <Button 
            onClick={handleCloseDialog} 
            variant="outlined" 
            fullWidth={isMobile}
            disabled={isLoading}
          >
            Close
          </Button>
          <Button 
            onClick={handleResendVerification}
            variant="contained"
            disabled={isLoading || resendSuccess || verificationEmailSent}
            startIcon={<SendOutlined />}
            fullWidth={isMobile}
            sx={{ position: 'relative', overflow: 'hidden' }}
          >
            {isLoading ? <CircularProgress size={20} /> : 'Resend Verification'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Error Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={AUTO_HIDE_DURATION}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={SlideTransition}
      >
        <Alert 
          severity="error" 
          variant="filled"
          onClose={handleCloseSnackbar}
          icon={<ErrorOutline />}
          sx={{ 
            width: '100%',
            minWidth: { xs: 'auto', sm: 300 },
            boxShadow: 3,
          }}
        >
          <Typography variant="body2" fontWeight="medium">
            {errorMessage}
          </Typography>
        </Alert>
      </Snackbar>
    </>
  );
};

// IMPORTANT: REMOVED React.memo - this was preventing navigation
export default SignInCard;