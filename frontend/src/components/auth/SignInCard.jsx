import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Card, CardContent, TextField, Button, Typography, Box,
  InputAdornment, IconButton, Alert, CircularProgress, Divider,
  Link, Snackbar, Slide, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Paper, Stack, Fade
} from '@mui/material';
import {
  Visibility, VisibilityOff, PersonOutline, LockOutlined,
  Business, CheckCircleOutline, ErrorOutline, EmailOutlined,Group,
  SendOutlined, CloseOutlined
} from '@mui/icons-material';
import { login, clearError, resetLoginSuccess, resendVerification } from '../../store/slices/authSlice';

const SlideTransition = (props) => <Slide {...props} direction="up" />;

const SignInCard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated, loginSuccess, verificationEmailSent } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState('');

  const errorMessage = useMemo(() => 
    error?.message || (typeof error === 'string' ? error : ''), 
  [error]);

  const isUnverifiedError = useMemo(() => 
    errorMessage.toLowerCase().includes('not verified') || 
    errorMessage.toLowerCase().includes('verification link'),
  [errorMessage]);

  // Full Validation Logic
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
      default: return '';
    }
  }, []);

  const getFieldError = (name) => touched[name] ? validateField(name, formData[name]) : '';

  // Lifecycle & Navigation
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (loginSuccess) {
      navigate('/dashboard', { replace: true });
      dispatch(resetLoginSuccess());
    }
  }, [loginSuccess, navigate, dispatch]);

  // Handle Unverified State
  useEffect(() => {
    if (isUnverifiedError && !resendDialogOpen) {
      const email = formData.username.includes('@') ? formData.username : '';
      setResendEmail(email);
      setResendDialogOpen(true);
    }
  }, [isUnverifiedError, formData.username, resendDialogOpen]);

  useEffect(() => {
    if (errorMessage && !isUnverifiedError) setSnackbarOpen(true);
  }, [errorMessage, isUnverifiedError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ username: true, password: true });
    
    if (validateField('username', formData.username) || validateField('password', formData.password)) return;
    
    dispatch(clearError());
    try {
      await dispatch(login({
        username: formData.username.trim(),
        password: formData.password,
      })).unwrap();
    } catch (err) { 
      console.debug('Login failed:', err); 
    }
  };

  // Function to close dialog and clear related states
  const handleCloseDialog = () => {
    setResendDialogOpen(false);
    // Clear the verification email sent state after dialog closes
    dispatch(clearError());
  };

  return (
    <>
      <Card
        sx={{
          width: { xs: '100%', sm: 450, md: 500 },
          borderRadius: 4,
          boxShadow: '0 12px 40px rgba(0,0,0,0.13)',
          mx: 'auto',
          p: { xs: 1, sm: 2 }
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Group sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" fontWeight={700} gutterBottom>Welcome Back</Typography>
            <Typography variant="body2" color="text.secondary">Sign in to manage your Meetings</Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email or Username"
              name="username"
              value={formData.username}
              onChange={(e) => setFormData(p => ({ ...p, username: e.target.value }))}
              onBlur={() => setTouched(p => ({ ...p, username: true }))}
              margin="normal"
              required
              error={!!getFieldError('username')}
              helperText={getFieldError('username')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><PersonOutline color="action" /></InputAdornment>
                ),
              }}
            />
            
            <TextField
              fullWidth
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
              onBlur={() => setTouched(p => ({ ...p, password: true }))}
              margin="normal"
              required
              error={!!getFieldError('password')}
              helperText={getFieldError('password')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><LockOutlined color="action" /></InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ textAlign: 'right', mt: 1 }}>
              <Link component={RouterLink} to="/forgot-password" variant="body2" underline="hover">
                Forgot password?
              </Link>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{ mt: 3, mb: 2, py: 1.8 }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">Don't have an account?</Typography>
          </Divider>

          <Button
            component={RouterLink} to="/signup"
            fullWidth variant="outlined" size="large" sx={{ py: 1.5 }}
          >
            Create New Account
          </Button>
        </CardContent>
      </Card>

      {/* Verification Dialog - FIXED Close Button */}
      <Dialog
        open={resendDialogOpen}
        onClose={handleCloseDialog}
        TransitionComponent={SlideTransition}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          Verify Your Email
          <IconButton
            aria-label="close"
            onClick={handleCloseDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseOutlined />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Your account is unverified. We can send a new link to:
          </DialogContentText>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary">
              {resendEmail || formData.username || "your email"}
            </Typography>
          </Paper>
          {verificationEmailSent && (
            <Alert severity="success" sx={{ mt: 2 }}>Link sent! Check your inbox.</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDialog} variant="outlined">
            Close
          </Button>
          <Button 
            onClick={() => dispatch(resendVerification(resendEmail || formData.username))}
            variant="contained"
            disabled={isLoading || verificationEmailSent}
          >
            Resend Email
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setSnackbarOpen(false)}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SignInCard;