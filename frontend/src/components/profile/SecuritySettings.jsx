// src/components/settings/SecuritySettings.jsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box, Grid, TextField, Button, Alert, Snackbar, CircularProgress,
  InputAdornment, IconButton, Typography, Paper, Stack,
  useTheme, useMediaQuery, alpha, Fade, Container
} from '@mui/material';
import {
  LockOutlined, Visibility, VisibilityOff, SaveOutlined,
  SecurityOutlined, CheckCircleOutline, RadioButtonUnchecked,
} from '@mui/icons-material';
import { changePassword } from '../../store/slices/authSlice';

const SecuritySettings = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Custom palette for a "Deep Sea/Slate" dark mode
  const colors = {
    primary: isDarkMode ? '#818cf8' : '#4f46e5',
    surface: isDarkMode ? alpha('#1e293b', 0.8) : '#ffffff',
    bgGradient: isDarkMode 
      ? `radial-gradient(circle at top left, ${alpha('#1e293b', 0.5)}, ${theme.palette.background.default})`
      : 'transparent',
    border: isDarkMode ? alpha('#94a3b8', 0.1) : alpha('#e2e8f0', 1),
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  };

  const [isUpdating, setIsUpdating] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [fieldErrors, setFieldErrors] = useState({});

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const requirements = [
    { label: '8+ characters', test: passwordData.new_password.length >= 8 },
    { label: 'Uppercase', test: /[A-Z]/.test(passwordData.new_password) },
    { label: 'Lowercase', test: /[a-z]/.test(passwordData.new_password) },
    { label: 'Number', test: /\d/.test(passwordData.new_password) },
    { label: 'Special char', test: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(passwordData.new_password) },
  ];

  const getPasswordStrength = () => {
    const score = requirements.filter(r => r.test).length;
    if (score <= 2) return { score, label: 'Weak', color: colors.error };
    if (score <= 4) return { score, label: 'Fair', color: colors.warning };
    return { score, label: 'Strong', color: colors.success };
  };

  const strength = getPasswordStrength();

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!passwordData.current_password) errors.current_password = 'Required';
    if (!passwordData.new_password) errors.new_password = 'Required';
    if (passwordData.new_password !== passwordData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsUpdating(true);
    try {
      await dispatch(changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      })).unwrap();
      setSnackbar({ open: true, message: 'Password updated successfully', severity: 'success' });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Update failed', severity: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100%', 
      width: '100%',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: colors.bgGradient,
      p: isMobile ? 2 : 4
    }}>
      <Container maxWidth="sm">
        <Fade in timeout={800}>
          <Box>
            {/* Header Section */}
            <Box sx={{ textAlign: 'center', mb: 5 }}>
              <Typography variant="h4" fontWeight={800} letterSpacing="-0.03em" gutterBottom>
                Security Center
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Protect your account by setting a high-security password.
              </Typography>
            </Box>

            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                {/* Current Password */}
                <TextField
                  fullWidth
                  label="Current Password"
                  name="current_password"
                  variant="filled"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onChange={handlePasswordChange}
                  error={!!fieldErrors.current_password}
                  helperText={fieldErrors.current_password}
                  InputProps={{
                    disableUnderline: true,
                    startAdornment: <InputAdornment position="start"><LockOutlined sx={{ color: colors.primary }} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowCurrentPassword(!showCurrentPassword)} edge="end">
                          {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: colors.surface }}}
                />

                {/* New Password & Strength */}
                <Box>
                  <TextField
                    fullWidth
                    label="New Password"
                    name="new_password"
                    variant="filled"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.new_password}
                    onChange={handlePasswordChange}
                    error={!!fieldErrors.new_password}
                    helperText={fieldErrors.new_password}
                    InputProps={{
                      disableUnderline: true,
                      startAdornment: <InputAdornment position="start"><SecurityOutlined sx={{ color: colors.primary }} /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end">
                            {showNewPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: colors.surface }}}
                  />
                  {passwordData.new_password && (
                    <Box sx={{ mt: 2, px: 1 }}>
                      <Stack direction="row" justifyContent="space-between" mb={1}>
                        <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.6 }}>STRENGTH</Typography>
                        <Typography variant="caption" fontWeight={900} sx={{ color: strength.color }}>{strength.label.toUpperCase()}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <Box 
                            key={lvl} 
                            sx={{ 
                              height: 6, flex: 1, borderRadius: 3, 
                              transition: 'all 0.4s ease',
                              bgcolor: lvl <= strength.score ? strength.color : alpha(theme.palette.text.disabled, 0.1),
                              boxShadow: lvl <= strength.score ? `0 0 10px ${alpha(strength.color, 0.3)}` : 'none'
                            }} 
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>

                {/* Confirm Password */}
                <TextField
                  fullWidth
                  label="Confirm New Password"
                  name="confirm_password"
                  variant="filled"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  error={!!fieldErrors.confirm_password}
                  helperText={fieldErrors.confirm_password}
                  InputProps={{
                    disableUnderline: true,
                    startAdornment: <InputAdornment position="start"><LockOutlined sx={{ color: colors.primary }} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: colors.surface }}}
                />

                {/* Requirements Card */}
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 3, 
                    borderRadius: 4, 
                    bgcolor: alpha(colors.surface, 0.4), 
                    borderColor: colors.border,
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <Typography variant="caption" fontWeight={800} display="block" mb={2} color={colors.primary} sx={{ letterSpacing: 1 }}>
                    SECURITY CHECKLIST
                  </Typography>
                  <Grid container spacing={2}>
                    {requirements.map((req, i) => (
                      <Grid item xs={6} key={i}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          {req.test ? 
                            <CheckCircleOutline sx={{ fontSize: 18, color: colors.success }} /> : 
                            <RadioButtonUnchecked sx={{ fontSize: 18, color: alpha(theme.palette.text.disabled, 0.2) }} />
                          }
                          <Typography variant="caption" sx={{ color: req.test ? 'text.primary' : 'text.secondary', fontWeight: req.test ? 600 : 400 }}>
                            {req.label}
                          </Typography>
                        </Stack>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>

                {/* Submit Button */}
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isUpdating}
                  startIcon={isUpdating ? <CircularProgress size={20} color="inherit" /> : <SaveOutlined />}
                  sx={{ 
                    py: 2, 
                    borderRadius: 3, 
                    fontWeight: 800, 
                    fontSize: '1rem',
                    bgcolor: colors.primary,
                    boxShadow: `0 8px 20px ${alpha(colors.primary, 0.3)}`,
                    '&:hover': { 
                      bgcolor: alpha(colors.primary, 0.9),
                      boxShadow: `0 12px 25px ${alpha(colors.primary, 0.4)}`,
                    }
                  }}
                >
                  {isUpdating ? 'Saving Changes...' : 'Update Password'}
                </Button>
              </Stack>
            </form>
          </Box>
        </Fade>
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity} 
          variant="filled" 
          sx={{ borderRadius: 3, fontWeight: 600, boxShadow: theme.shadows[10] }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SecuritySettings;