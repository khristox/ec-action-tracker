import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Card, CardContent, TextField, Button, Typography, Box,
  InputAdornment, IconButton, Alert, CircularProgress,
  LinearProgress, Collapse, Divider, Link, Checkbox,
  FormControlLabel, Snackbar, Slide,
} from '@mui/material';
import {
  Visibility, VisibilityOff, PersonOutline, LockOutlined,
  CheckCircleOutline, ErrorOutline,
} from '@mui/icons-material';
import { login, clearError, selectAuth } from '../../store/slices/authSlice';

// Path to your image in the public folder
const ecLogo = "/logo.png";

function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

const SignInCard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoggingIn, error, isAuthenticated } = useSelector(selectAuth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [persistedError, setPersistedError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Persistence logic omitted for brevity, remains the same as your snippet...
  useEffect(() => {
    const savedError = sessionStorage.getItem('last_auth_error');
    const timestamp = sessionStorage.getItem('last_auth_error_time');
    if (savedError && timestamp) {
      const now = Date.now();
      if (now - parseInt(timestamp) < 10000) {
        setPersistedError(savedError);
        setSnackbarOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    const msg = error?.message || (typeof error === 'string' ? error : '');
    if (msg) {
      setPersistedError(msg);
      setSnackbarOpen(true);
      sessionStorage.setItem('last_auth_error', msg);
      sessionStorage.setItem('last_auth_error_time', Date.now().toString());
    }
  }, [error]);

  useEffect(() => {
    if (isAuthenticated) {
      setShowSuccess(true);
      sessionStorage.removeItem('last_auth_error');
      const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password || isLoggingIn) return;
    try {
      dispatch(clearError());
      await dispatch(login({ username, password })).unwrap();
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
    sessionStorage.removeItem('last_auth_error');
  };

  const isDisabled = isLoggingIn || showSuccess;

  return (
    <>
      <Card
        sx={{
          width: { xs: '100%', sm: 440, md: 480 },
          maxWidth: '95vw',
          borderRadius: 4,
          boxShadow: '0 12px 40px rgba(0,0,0,0.13)',
          mx: 'auto',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ height: 4 }}>
          {isLoggingIn && <LinearProgress />}
          {showSuccess && <LinearProgress variant="determinate" value={100} color="success" />}
        </Box>

        <CardContent sx={{ p: { xs: 4, sm: 5 } }}>
          {/* Header Section with Logo */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              component="img"
              src={ecLogo}
              alt="Electoral Commission Logo"
              sx={{ 
                width: 80, 
                height: 'auto', 
                mb: 2,
                // Added a subtle shadow to make the logo pop against the white card
                filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.1))'
              }}
            />
            <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.2, mb: 1 }}>
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Commission Action Tracker
            </Typography>
          </Box>

          <Collapse in={showSuccess}>
            <Alert severity="success" icon={<CheckCircleOutline />} sx={{ mb: 3 }}>
              Login successful! Redirecting…
            </Alert>
          </Collapse>

          <form onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth label="Username or Email"
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              disabled={isDisabled}
              autoFocus
              InputProps={{
                startAdornment: <InputAdornment position="start"><PersonOutline color="action" /></InputAdornment>,
              }}
            />

            <TextField
              fullWidth label="Password"
              variant="outlined"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              disabled={isDisabled}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockOutlined color="action" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((v) => !v)} disabled={isDisabled} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <FormControlLabel
                control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} disabled={isDisabled} color="primary" />}
                label={<Typography variant="body2">Remember me</Typography>}
              />
              <Link component="button" type="button" variant="body2" underline="hover" onClick={() => navigate('/forgot-password')}>
                Forgot password?
              </Link>
            </Box>

            <Button
              type="submit" fullWidth variant="contained" size="large" disabled={isDisabled}
              sx={{ mt: 4, py: 1.8, textTransform: 'none', fontSize: '1.1rem', fontWeight: 600 }}
            >
              {isLoggingIn ? <><CircularProgress size={20} sx={{ mr: 1.5 }} color="inherit" />Signing in...</> : showSuccess ? 'Redirecting...' : 'Sign In'}
            </Button>
          </form>

          <Divider sx={{ my: 4 }}><Typography variant="caption" color="text.secondary">OR</Typography></Divider>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Don't have an account?</Typography>
            <Button component={RouterLink} to="/signup" variant="outlined" fullWidth size="large" sx={{ py: 1.5, textTransform: 'none' }}>
              Create New Account
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={10000}
        onClose={handleCloseSnackbar}
        TransitionComponent={SlideTransition}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity="error" 
          variant="filled"
          icon={<ErrorOutline />}
          sx={{ width: '100%', boxShadow: 6, borderRadius: 2 }}
        >
          {persistedError || 'Login failed. Please check your credentials.'}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SignInCard;