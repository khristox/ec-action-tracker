// SignInCard.jsx - FIXED with Account Lock Popup Support

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Card, CardContent, TextField, Button, Typography, Box,
  InputAdornment, IconButton, Alert, CircularProgress, Divider,
  Link, Snackbar, Slide, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Paper, FormControlLabel, Checkbox,
  Zoom, Tooltip, useMediaQuery, useTheme, Fade, LinearProgress,
  Chip
} from '@mui/material';
import {
  Visibility, VisibilityOff, PersonOutlined, LockOutlined,
  Group, CheckCircleOutlined, ErrorOutlined, EmailOutlined,
  CloseOutlined, Login, SendOutlined, WarningAmberOutlined,
  TimerOutlined, LockOutlined as LockIcon, RefreshOutlined
} from '@mui/icons-material';

import { 
  login, 
  clearError, 
  resendVerification,
  updateLockTimer,
  clearRateLimited,
  resetRateLimit,
} from '../../store/slices/authSlice';

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

const AUTO_HIDE_DURATION = 8000;
const DEBOUNCE_DELAY = 300;
const LOCK_COUNTDOWN_INTERVAL = 1000;

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

// ========== MAIN COMPONENT ==========
const SignInCard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Auth selectors
  const { isLoading, error, isAuthenticated, loginSuccess, verificationEmailSent } = useSelector((state) => state.auth);
  const remainingAttempts = useSelector((state) => state.auth.remainingAttempts);
  const isLocked = useSelector((state) => state.auth.isLocked);
  const lockTimeRemaining = useSelector((state) => state.auth.lockTimeRemaining);
  const isRateLimited = useSelector((state) => state.auth.isRateLimited);
  const rateLimitRetryAfter = useSelector((state) => state.auth.rateLimitRetryAfter);
  const failedAttempts = useSelector((state) => state.auth.failedAttempts);
  
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
  
  // NEW: Account Lock Dialog State
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [lockDialogMessage, setLockDialogMessage] = useState('');
  const [lockCountdown, setLockCountdown] = useState(0);
  
  // Custom hooks
  const { capsLockOn, handleKeyPress } = useCapsLockDetector();
  const { validateField, isFormValid } = useFormValidation(formData);
  const debouncedUsername = useDebounce(formData.username, DEBOUNCE_DELAY);
  
  // Refs
  const usernameRef = useRef(null);
  const formRef = useRef(null);
  const lockTimerRef = useRef(null);
  const lockDialogTimerRef = useRef(null);
  
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
  
  // NEW: Improved account lock detection
  const isAccountLockedError = useMemo(() => {
    const lowerError = errorMessage.toLowerCase();
    return lowerError.includes('locked') || 
           lowerError.includes('temporarily locked') ||
           lowerError.includes('account is temporarily locked');
  }, [errorMessage]);
  
  const isRateLimitError = useMemo(() => {
    const lowerError = errorMessage.toLowerCase();
    return lowerError.includes('too many') || 
           lowerError.includes('rate limit') ||
           lowerError.includes('too many requests');
  }, [errorMessage]);
  
  const getFieldError = useCallback((name) => {
    return touched[name] ? validateField(name, formData[name]) : '';
  }, [touched, formData, validateField]);
  
  // NEW: Extract lock time from error message
  const extractLockTime = useCallback((message) => {
    if (!message) return 0;
    const match = message.match(/(\d+)\s*minute/);
    if (match) {
      return parseInt(match[1]) * 60; // Convert minutes to seconds
    }
    const secondMatch = message.match(/(\d+)\s*second/);
    if (secondMatch) {
      return parseInt(secondMatch[1]);
    }
    return 900; // Default 15 minutes
  }, []);
  
  // NEW: Show lock dialog when account locked error is detected
  useEffect(() => {
    if (isAccountLockedError && errorMessage && !lockDialogOpen && !isLocked) {
      const lockDuration = extractLockTime(errorMessage);
      setLockCountdown(lockDuration);
      setLockDialogMessage(errorMessage);
      setLockDialogOpen(true);
      
      // Also set the lock state in Redux if not already set
      if (!isLocked) {
        // The lock state should already be set by the auth slice
        // But we can ensure it's displayed correctly
      }
    }
  }, [isAccountLockedError, errorMessage, lockDialogOpen, isLocked, extractLockTime]);
  
  // NEW: Countdown timer for lock dialog
  useEffect(() => {
    if (lockDialogOpen && lockCountdown > 0) {
      if (lockDialogTimerRef.current) {
        clearInterval(lockDialogTimerRef.current);
      }
      
      lockDialogTimerRef.current = setInterval(() => {
        setLockCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(lockDialogTimerRef.current);
            lockDialogTimerRef.current = null;
            // Auto close dialog when countdown reaches 0
            setLockDialogOpen(false);
            dispatch(resetRateLimit());
            return 0;
          }
          return prev - 1;
        });
      }, LOCK_COUNTDOWN_INTERVAL);
      
      return () => {
        if (lockDialogTimerRef.current) {
          clearInterval(lockDialogTimerRef.current);
          lockDialogTimerRef.current = null;
        }
      };
    }
  }, [lockDialogOpen, lockCountdown, dispatch]);
  
  // Countdown timer for lock state (using Redux)
  useEffect(() => {
    if (isLocked && lockTimeRemaining > 0) {
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
      }
      
      lockTimerRef.current = setInterval(() => {
        dispatch(updateLockTimer());
      }, LOCK_COUNTDOWN_INTERVAL);
      
      return () => {
        if (lockTimerRef.current) {
          clearInterval(lockTimerRef.current);
          lockTimerRef.current = null;
        }
      };
    }
  }, [isLocked, lockTimeRemaining, dispatch]);
  
  // Navigation on auth success
  useEffect(() => {
    if ((isAuthenticated || loginSuccess) && !loginCompleted) {
      console.log('Authentication successful, redirecting to dashboard...');
      setLoginCompleted(true);
      
      const timer = setTimeout(() => {
        window.location.href = '/dashboard';
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loginSuccess, loginCompleted]);
  
  // Reset login completed when component unmounts
  useEffect(() => {
    return () => {
      setLoginCompleted(false);
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
      }
      if (lockDialogTimerRef.current) {
        clearInterval(lockDialogTimerRef.current);
      }
    };
  }, []);
  
  // Handle unverified dialog
  useEffect(() => {
    if (isUnverifiedError && !resendDialogOpen && !isLocked && !isRateLimited && !lockDialogOpen) {
      const potentialEmail = debouncedUsername.includes('@') ? debouncedUsername : '';
      setResendEmail(potentialEmail);
      setResendDialogOpen(true);
      setResendSuccess(false);
    }
  }, [isUnverifiedError, debouncedUsername, resendDialogOpen, isLocked, isRateLimited, lockDialogOpen]);
  
  // Handle error snackbar - Don't show snackbar for lock errors
  useEffect(() => {
    if (errorMessage && !isUnverifiedError && !isAccountLockedError && !isRateLimitError) {
      setSnackbarOpen(true);
    }
  }, [errorMessage, isUnverifiedError, isAccountLockedError, isRateLimitError]);
  
  // Focus username on mount
  useEffect(() => {
    if (usernameRef.current && !isLocked && !isRateLimited) {
      const timer = setTimeout(() => usernameRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isLocked, isRateLimited]);
  
  // Handle field changes
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (loginCompleted) {
      setLoginCompleted(false);
    }
    if (error) {
      dispatch(clearError());
    }
  }, [loginCompleted, error, dispatch]);
  
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
    
    if (isLocked || isRateLimited || lockDialogOpen) {
      return;
    }
    
    setTouched({ username: true, password: true });
    
    if (!isFormValid) return;
    
    dispatch(clearError());
    setLoginCompleted(false);
    
    try {
      const result = await dispatch(login({
        username: formData.username.trim(),
        password: formData.password,
      })).unwrap();
      
      console.log('Login API response:', result);
      
    } catch (err) {
      console.debug('Login failed:', err);
      setLoginCompleted(false);
    }
  }, [dispatch, formData, isFormValid, isLocked, isRateLimited, lockDialogOpen]);
  
  // Handle resend verification
  const handleResendVerification = useCallback(async () => {
    const email = resendEmail || formData.username;
    if (!email) return;
    
    try {
      await dispatch(resendVerification(email)).unwrap();
      setResendSuccess(true);
      
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
  
  // NEW: Close lock dialog
  const handleCloseLockDialog = useCallback(() => {
    setLockDialogOpen(false);
    dispatch(clearError());
    dispatch(resetRateLimit());
    if (lockDialogTimerRef.current) {
      clearInterval(lockDialogTimerRef.current);
      lockDialogTimerRef.current = null;
    }
  }, [dispatch]);
  
  // Close snackbar
  const handleCloseSnackbar = useCallback(() => {
    setSnackbarOpen(false);
  }, []);
  
  // Handle "Enter" key for form submission
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isFormValid && !isLoading && !isLocked && !isRateLimited && !lockDialogOpen) {
        handleSubmit(e);
      }
    }
  }, [isFormValid, isLoading, isLocked, isRateLimited, lockDialogOpen, handleSubmit]);
  
  // Get disabled state for form
  const isFormDisabled = isLoading || isLocked || isRateLimited || lockDialogOpen;
  
  // Get button text based on state
  const getButtonText = useCallback(() => {
    if (isLoading) return <CircularProgress size={24} color="inherit" />;
    if (isLocked || lockDialogOpen) {
      const time = isLocked ? lockTimeRemaining : lockCountdown;
      const mins = Math.floor(time / 60);
      const secs = time % 60;
      if (mins > 0) {
        return `Account Locked (${mins}m ${secs}s)`;
      }
      return `Account Locked (${secs}s)`;
    }
    if (isRateLimited) {
      const mins = Math.floor(rateLimitRetryAfter / 60);
      const secs = rateLimitRetryAfter % 60;
      if (mins > 0) {
        return `Wait ${mins}m ${secs}s`;
      }
      return `Wait ${secs}s`;
    }
    return 'Sign In';
  }, [isLoading, isLocked, isRateLimited, lockDialogOpen, lockTimeRemaining, lockCountdown, rateLimitRetryAfter]);
  
  // Format time helper
  const formatTimeDisplay = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }, []);
  
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
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Rate Limit / Lock Progress Bar */}
        {(isLocked || isRateLimited) && (
          <LinearProgress
            variant="determinate"
            value={isLocked ? ((lockTimeRemaining / (lockTimeRemaining + 1)) * 100) : ((rateLimitRetryAfter / (rateLimitRetryAfter + 1)) * 100)}
            color={isLocked ? "error" : "warning"}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              '& .MuiLinearProgress-bar': {
                transition: 'transform 1s linear',
              }
            }}
          />
        )}
        
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
            
            {/* Failed Attempts Indicator */}
            {!isLocked && !lockDialogOpen && failedAttempts > 0 && (
              <Chip
                icon={<WarningAmberOutlined />}
                label={`${failedAttempts} failed attempt${failedAttempts > 1 ? 's' : ''}`}
                color="warning"
                size="small"
                sx={{ mt: 1.5 }}
                variant="outlined"
              />
            )}
          </Box>
          
          {/* Account Locked Alert - Inline */}
          {isLocked && (
            <Fade in>
              <Alert 
                severity="error" 
                variant="filled"
                icon={<LockIcon />}
                sx={{ mb: 2, borderRadius: 2 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <strong>Account Temporarily Locked</strong>
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TimerOutlined fontSize="small" />
                    <Typography variant="body2" fontWeight="bold">
                      {formatTimeDisplay(lockTimeRemaining)}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Too many failed login attempts. Please wait for the lock to expire.
                </Typography>
              </Alert>
            </Fade>
          )}
          
          {/* Rate Limited Alert */}
          {isRateLimited && (
            <Fade in>
              <Alert 
                severity="warning" 
                variant="filled"
                icon={<WarningAmberOutlined />}
                sx={{ mb: 2, borderRadius: 2 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <strong>Too Many Requests</strong>
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TimerOutlined fontSize="small" />
                    <Typography variant="body2" fontWeight="bold">
                      {formatTimeDisplay(rateLimitRetryAfter)}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Please wait before trying again.
                </Typography>
              </Alert>
            </Fade>
          )}
          
          {/* Remaining Attempts Warning */}
          {!isLocked && !lockDialogOpen && remainingAttempts !== null && remainingAttempts <= 3 && remainingAttempts > 0 && (
            <Fade in>
              <Alert 
                severity={remainingAttempts === 1 ? "error" : "warning"}
                variant="outlined"
                sx={{ mb: 2, borderRadius: 2 }}
                icon={remainingAttempts === 1 ? <ErrorOutlined /> : <WarningAmberOutlined />}
              >
                <Typography variant="body2">
                  {remainingAttempts === 1 
                    ? '⚠️ Last attempt before account lock!'
                    : `${remainingAttempts} attempts remaining before account lock.`
                  }
                </Typography>
              </Alert>
            </Fade>
          )}
          
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
              disabled={isFormDisabled}
              error={!!getFieldError('username')}
              helperText={getFieldError('username')}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlined color="action" />
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
              disabled={isFormDisabled}
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
                          disabled={isFormDisabled}
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
                    disabled={isFormDisabled}
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
              disabled={isFormDisabled || !isFormValid}
              startIcon={!isLoading && !isLocked && !isRateLimited && !lockDialogOpen && <Login />}
              sx={{ 
                mt: 3, 
                mb: 2, 
                py: { xs: 1.5, sm: 1.8 },
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              {getButtonText()}
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
      
      {/* NEW: Account Lock Dialog */}
      <Dialog
        open={lockDialogOpen}
        onClose={handleCloseLockDialog}
        TransitionComponent={SlideTransition}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
        slotProps={{
          paper: {
            sx: {
              borderRadius: { xs: 2, sm: 3 },
              overflow: 'hidden',
              border: '2px solid',
              borderColor: 'error.main',
            }
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'error.main', 
          color: 'white',
          pb: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <LockIcon sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h6" component="span" fontWeight="bold">
                Account Locked
              </Typography>
              <Typography variant="caption" display="block" sx={{ opacity: 0.9 }}>
                Security measure activated
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert 
              severity="error" 
              variant="outlined"
              sx={{ borderRadius: 2 }}
            >
              <Typography variant="body2">
                {lockDialogMessage || 'Account temporarily locked due to multiple failed login attempts.'}
              </Typography>
            </Alert>
            
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 3, 
                textAlign: 'center',
                bgcolor: 'error.light',
                borderRadius: 2,
                borderColor: 'error.main',
              }}
            >
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Time remaining until unlock:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <TimerOutlined color="error" sx={{ fontSize: 28 }} />
                <Typography variant="h3" fontWeight="bold" color="error.main">
                  {formatTimeDisplay(lockCountdown)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(lockCountdown / (lockCountdown + 1)) * 100}
                color="error"
                sx={{ mt: 2, height: 8, borderRadius: 4 }}
              />
            </Paper>
            
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              <Typography variant="body2">
                <strong>Why is this happening?</strong> Too many failed login attempts triggered our security system.
                This protects your account from unauthorized access.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, flexDirection: 'column', gap: 1.5 }}>
          <Button 
            onClick={handleCloseLockDialog}
            variant="contained"
            color="error"
            fullWidth
            disabled={lockCountdown > 0}
            startIcon={lockCountdown > 0 ? <TimerOutlined /> : <RefreshOutlined />}
            sx={{ py: 1.5 }}
          >
            {lockCountdown > 0 ? `Wait ${formatTimeDisplay(lockCountdown)}` : 'Try Again'}
          </Button>
          <Button 
            onClick={() => {
              handleCloseLockDialog();
              navigate('/forgot-password');
            }}
            variant="outlined"
            fullWidth
            sx={{ py: 1.5 }}
          >
            Forgot Password?
          </Button>
        </DialogActions>
      </Dialog>
      
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
                icon={<CheckCircleOutlined />}
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
          icon={<ErrorOutlined />}
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

export default SignInCard;