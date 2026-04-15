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
  Snackbar,
  Slide,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Paper,
  Stack,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  PersonOutline,
  LockOutlined,
  Business,
  CheckCircleOutline,
  ErrorOutline,
  EmailOutlined,
  SendOutlined,
  CloseOutlined,
} from '@mui/icons-material';
import { login, clearError, resetLoginSuccess, resendVerification } from '../../store/slices/authSlice';

function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

const SignInCard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated, loginSuccess, verificationEmailSent } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');

  // Extract error message safely
  const errorMessage = error?.message || (typeof error === 'string' ? error : '');
  const isUnverifiedError = errorMessage.toLowerCase().includes('not verified') || 
                           errorMessage.toLowerCase().includes('verification link');

  // Validation
  const validateField = useCallback((name, value) => {
    switch (name) {
      case 'username':
        if (!value?.trim()) return 'Email or username is required';
        if (value.includes('@') && !/\S+@\S+\.\S+/.test(value)) return 'Please enter a valid email';
        if (!value.includes('@') && value.length < 3) return 'Username must be at least 3 characters';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        return '';
      default:
        return '';
    }
  }, []);

  const getFieldError = useCallback((name) => {
    if (!touched[name]) return '';
    return validateField(name, formData[name]);
  }, [touched, formData, validateField]);

  const isFormValid = () => {
    return formData.username?.trim() && 
           formData.password &&
           !validateField('username', formData.username) &&
           !validateField('password', formData.password);
  };

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Show error snackbar when error occurs
  useEffect(() => {
    if (errorMessage && !isUnverifiedError) {
      setSnackbarOpen(true);
    }
  }, [errorMessage, isUnverifiedError]);

  // Handle unverified email error - only open dialog once
  useEffect(() => {
    if (isUnverifiedError && !resendDialogOpen && !resendSuccess) {
      // Extract email from username field if it looks like an email
      const email = formData.username.includes('@') ? formData.username : '';
      setResendEmail(email);
      setResendDialogOpen(true);
    }
  }, [isUnverifiedError, formData.username, resendDialogOpen, resendSuccess]);

  // Handle login success
  useEffect(() => {
    if (loginSuccess) {
      navigate('/dashboard', { replace: true });
      dispatch(resetLoginSuccess());
    }
  }, [loginSuccess, navigate, dispatch]);

  // Close dialog when verification email is sent successfully
  useEffect(() => {
    if (verificationEmailSent && resendDialogOpen) {
      setResendSuccess(true);
      setResendError('');
      setTimeout(() => {
        setResendDialogOpen(false);
        setResendSuccess(false);
        dispatch(clearError());
      }, 3000);
    }
  }, [verificationEmailSent, resendDialogOpen, dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      dispatch(clearError());
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ username: true, password: true });
    
    if (!isFormValid()) {
      return;
    }
    
    dispatch(clearError());
    
    try {
      await dispatch(login({
        username: formData.username.trim(),
        password: formData.password,
      })).unwrap();
    } catch (err) {
      // Error is handled by the rejected action
      console.error('Login failed:', err);
    }
  };

  const handleResendVerification = async () => {
    const emailToResend = resendEmail || formData.username;
    
    // Validate email format
    if (!emailToResend || !emailToResend.includes('@')) {
      setResendError('Please enter a valid email address');
      return;
    }
    
    setIsResending(true);
    setResendError('');
    
    try {
      // Use the Redux thunk instead of direct fetch
      await dispatch(resendVerification(emailToResend)).unwrap();
      // Success is handled by the useEffect above
    } catch (err) {
      const errorMsg = err?.message || 'Failed to resend verification email. Please try again.';
      setResendError(errorMsg);
      console.error('Failed to resend:', err);
    } finally {
      setIsResending(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
    dispatch(clearError());
  };

  const handleCloseResendDialog = () => {
    setResendDialogOpen(false);
    setResendError('');
    setResendSuccess(false);
    dispatch(clearError());
  };

  return (
    <>
      <Card
        sx={{
          width: { xs: '100%', sm: 450, md: 500 },
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
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to manage your rental properties
            </Typography>
          </Box>

          {/* Unverified Email Alert - Inline */}
          {isUnverifiedError && !resendDialogOpen && (
            <Fade in>
              <Alert 
                severity="warning" 
                icon={<EmailOutlined />}
                sx={{ mb: 3 }}
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={() => setResendDialogOpen(true)}
                    startIcon={<SendOutlined />}
                  >
                    Resend
                  </Button>
                }
                onClose={() => dispatch(clearError())}
              >
                <Typography variant="body2" fontWeight={500}>
                  Email Not Verified
                </Typography>
                <Typography variant="caption" display="block">
                  A verification link has been sent to your email. Please check your inbox (and spam folder).
                </Typography>
              </Alert>
            </Fade>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <TextField
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
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              margin="normal"
              required
              disabled={isLoading}
              error={!!getFieldError('password')}
              helperText={getFieldError('password')}
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
                      edge="end"
                      disabled={isLoading}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ textAlign: 'right', mt: 1 }}>
              <Link 
                component={RouterLink} 
                to="/forgot-password" 
                variant="body2"
                underline="hover"
              >
                Forgot password?
              </Link>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading || !isFormValid()}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
            >
              {isLoading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={20} color="inherit" />
                  <span>Signing in...</span>
                </Stack>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Don't have an account?
            </Typography>
          </Divider>

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
          {errorMessage}
        </Alert>
      </Snackbar>

      {/* Resend Verification Dialog */}
      <Dialog
        open={resendDialogOpen}
        onClose={handleCloseResendDialog}
        aria-labelledby="resend-dialog-title"
        maxWidth="sm"
        fullWidth
        TransitionComponent={SlideTransition}
      >
        <DialogTitle id="resend-dialog-title">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Email Not Verified</Typography>
            <IconButton onClick={handleCloseResendDialog} size="small">
              <CloseOutlined />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText paragraph>
            Your email address has not been verified yet. 
            We can send you a new verification link to:
          </DialogContentText>
          
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              mb: 2, 
              bgcolor: 'action.hover',
              textAlign: 'center',
              borderRadius: 2
            }}
          >
            <Typography variant="body1" fontWeight="bold" color="primary">
              {resendEmail || formData.username || 'your email address'}
            </Typography>
          </Paper>
          
          <DialogContentText variant="body2">
            Please check your inbox and click the verification link to activate your account.
            Don't forget to check your spam folder.
          </DialogContentText>
          
          {resendError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setResendError('')}>
              {resendError}
            </Alert>
          )}
          
          {resendSuccess && (
            <Alert 
              severity="success" 
              icon={<CheckCircleOutline />}
              sx={{ mt: 2 }}
            >
              Verification email resent successfully! Please check your inbox.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={handleCloseResendDialog} color="inherit">
            Close
          </Button>
          <Button 
            onClick={handleResendVerification} 
            variant="contained"
            disabled={isResending || resendSuccess}
            startIcon={isResending ? <CircularProgress size={18} /> : <SendOutlined />}
          >
            {isResending ? 'Sending...' : 'Resend Verification Email'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SignInCard;