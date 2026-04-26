// src/components/auth/ForgotPassword.jsx
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Card, CardContent, TextField, Button, Typography, Box,
  InputAdornment, Alert, CircularProgress, Divider, Link, Paper
} from '@mui/material';
import { EmailOutlined, ArrowBack, SendOutlined } from '@mui/icons-material';
import { forgotPassword, clearError } from '../../store/slices/authSlice';

const ForgotPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useSelector((state) => state.auth);
  
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setLocalError('Email is required');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }
    
    setLocalError('');
    dispatch(clearError());
    setIsSending(true);
    
    try {
      await dispatch(forgotPassword(email)).unwrap();
      setSubmitted(true);
    } catch (err) {
      console.error('Forgot password error:', err);
    } finally {
      setIsSending(false);
    }
  };

  if (submitted) {
    return (
      <Card sx={{ maxWidth: 500, mx: 'auto', mt: 8, borderRadius: 4 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <SendOutlined sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Check Your Email
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            We've sent password reset instructions to:
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary">
              {email}
            </Typography>
          </Paper>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Please check your inbox and spam folder. The link will expire in 1 hour.
          </Typography>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            fullWidth
          >
            Return to Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ maxWidth: 500, mx: 'auto', mt: 8, borderRadius: 4 }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Forgot Password?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your email address and we'll send you a link to reset your password
          </Typography>
        </Box>

        {(error || localError) && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearError())}>
            {localError || (typeof error === 'string' ? error : error?.message || 'An error occurred')}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlined color="action" />
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={isLoading || isSending}
            sx={{ mt: 3, mb: 2, py: 1.5 }}
          >
            {(isLoading || isSending) ? <CircularProgress size={24} /> : 'Send Reset Link'}
          </Button>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">Remember your password?</Typography>
          </Divider>

          <Button
            component={RouterLink}
            to="/login"
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<ArrowBack />}
            sx={{ py: 1.5 }}
          >
            Back to Sign In
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ForgotPassword;