import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  Grid,
  TextField,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  InputAdornment,
  IconButton,
  Typography,
  Paper,
  Stack,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  LockOutlined,
  Visibility,
  VisibilityOff,
  SaveOutlined,
  SecurityOutlined,
  CheckCircleOutline,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import { changePassword } from '../../store/slices/authSlice';

const SecuritySettings = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }));
  };

  const requirements = [
    { label: '8+ characters', test: passwordData.new_password.length >= 8 },
    { label: 'Uppercase', test: /[A-Z]/.test(passwordData.new_password) },
    { label: 'Lowercase', test: /[a-z]/.test(passwordData.new_password) },
    { label: 'Number', test: /\d/.test(passwordData.new_password) },
    { label: 'Special char', test: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(passwordData.new_password) },
  ];

  const getPasswordStrength = () => {
    const score = requirements.filter(r => r.test).length;
    if (score <= 2) return { score, label: 'Weak', color: theme.palette.error.main };
    if (score <= 4) return { score, label: 'Fair', color: theme.palette.warning.main };
    return { score, label: 'Strong', color: theme.palette.success.main };
  };

  const strength = getPasswordStrength();

  const validatePasswordForm = () => {
    const errors = {};
    if (!passwordData.current_password) errors.current_password = 'Required';
    if (!passwordData.new_password) errors.new_password = 'Required';
    if (passwordData.new_password !== passwordData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    setIsUpdating(true);
    try {
      await dispatch(changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      })).unwrap();
      setSnackbar({ open: true, message: 'Password changed successfully!', severity: 'success' });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      setSnackbar({ open: true, message: error.detail?.message || 'Failed to update', severity: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 0 }}>
      <Typography variant={isMobile ? "h6" : "h5"} gutterBottom>
        Security Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Update your password to keep your account secure.
      </Typography>

      <form onSubmit={handleSubmit}>
        <Stack spacing={isMobile ? 2 : 3}>
          <TextField
            fullWidth
            label="Current Password"
            name="current_password"
            type={showCurrentPassword ? 'text' : 'password'}
            value={passwordData.current_password}
            onChange={handlePasswordChange}
            error={!!fieldErrors.current_password}
            helperText={fieldErrors.current_password}
            size={isMobile ? "small" : "medium"}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockOutlined fontSize="small" /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                    {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box>
            <TextField
              fullWidth
              label="New Password"
              name="new_password"
              type={showNewPassword ? 'text' : 'password'}
              value={passwordData.new_password}
              onChange={handlePasswordChange}
              error={!!fieldErrors.new_password}
              helperText={fieldErrors.new_password}
              size={isMobile ? "small" : "medium"}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SecurityOutlined fontSize="small" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowNewPassword(!showNewPassword)}>
                      {showNewPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {passwordData.new_password && (
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption" sx={{ color: strength.color, fontWeight: 'bold' }}>
                    Strength: {strength.label}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5}>
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <Box key={lvl} sx={{ height: 4, flex: 1, borderRadius: 1, bgcolor: lvl <= strength.score ? strength.color : theme.palette.action.hover }} />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>

          <TextField
            fullWidth
            label="Confirm New Password"
            name="confirm_password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={passwordData.confirm_password}
            onChange={handlePasswordChange}
            error={!!fieldErrors.confirm_password}
            helperText={fieldErrors.confirm_password}
            size={isMobile ? "small" : "medium"}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockOutlined fontSize="small" /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.background.default }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
              PASSWORD REQUIREMENTS
            </Typography>
            <Grid container spacing={1}>
              {requirements.map((req, i) => (
                <Grid item xs={6} key={i}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    {req.test ? 
                      <CheckCircleOutline sx={{ fontSize: 14, color: 'success.main' }} /> : 
                      <RadioButtonUnchecked sx={{ fontSize: 14, color: 'text.disabled' }} />
                    }
                    <Typography variant="caption" color={req.test ? "text.primary" : "text.secondary"}>
                      {req.label}
                    </Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Paper>

          <Button
            fullWidth={isMobile}
            type="submit"
            variant="contained"
            size="large"
            disabled={isUpdating}
            startIcon={isUpdating ? <CircularProgress size={20} color="inherit" /> : <SaveOutlined />}
            sx={{ alignSelf: isMobile ? 'stretch' : 'flex-end', py: isMobile ? 1.5 : 1 }}
          >
            {isUpdating ? 'Updating...' : 'Change Password'}
          </Button>
        </Stack>
      </form>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SecuritySettings;