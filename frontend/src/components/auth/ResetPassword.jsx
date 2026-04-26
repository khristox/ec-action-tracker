// src/components/auth/ResetPassword.jsx
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import {
  Card, CardContent, TextField, Button, Typography, Box,
  InputAdornment, IconButton, Alert, CircularProgress, Divider, Link
} from '@mui/material';
import { LockOutlined, Visibility, VisibilityOff, CheckCircleOutline } from '@mui/icons-material';
import { resetPassword, clearError } from '../../store/slices/authSlice';

const ResetPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useParams();
  const { isLoading, error } = useSelector((state) => state.auth);
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const validatePassword = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
    if (!/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setLocalError(passwordError);
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    
    setLocalError('');
    dispatch(clearError());
    setIsResetting(true);
    
    try {
      await dispatch(resetPassword({ token, newPassword: formData.password })).unwrap();
      setResetSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      console.error('Reset password error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  if (resetSuccess) {
    return (
      <Card sx={{ maxWidth: 500, mx: 'auto', mt: 8, borderRadius: 4 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleOutline sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Password Reset Successful!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your password has been reset successfully. You can now sign in with your new password.
          </Typography>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            fullWidth
          >
            Sign In Now
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
            Reset Password
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please enter your new password
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
            label="New Password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            margin="normal"
            required
            helperText="Minimum 8 characters with uppercase, lowercase, number and special character"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined color="action" />
                </InputAdornment>
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
          
          <TextField
            fullWidth
            label="Confirm New Password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={isLoading || isResetting}
            sx={{ mt: 3, mb: 2, py: 1.5 }}
          >
            {(isLoading || isResetting) ? <CircularProgress size={24} /> : 'Reset Password'}
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
            sx={{ py: 1.5 }}
          >
            Back to Sign In
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ResetPassword;