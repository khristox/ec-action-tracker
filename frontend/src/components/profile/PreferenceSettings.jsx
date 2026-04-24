import React, { useState, useEffect } from 'react';
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
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  useTheme,
  useMediaQuery,
  Fade,
  Grow,
  Stack
} from '@mui/material';
import {
  LanguageOutlined,
  AttachMoneyOutlined,
  AccessTimeOutlined,
  SaveOutlined,
  CheckCircleOutline,
  SettingsOutlined
} from '@mui/icons-material';
import { updateProfile } from '../../store/slices/profileSlice';

const PreferenceSettings = ({ profile }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isUpdating, setIsUpdating] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const [preferences, setPreferences] = useState({
    language: 'en',
    preferred_currency: 'USD',
    timezone: 'UTC',
    date_format: 'YYYY-MM-DD',
    time_format: '24h',
  });

  useEffect(() => {
    if (profile) {
      setPreferences({
        language: profile.language || 'en',
        preferred_currency: profile.preferred_currency || 'USD',
        timezone: profile.timezone || 'UTC',
        date_format: profile.date_format || 'YYYY-MM-DD',
        time_format: profile.time_format || '24h',
      });
    }
  }, [profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPreferences(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setIsUpdating(true);
    try {
      await dispatch(updateProfile({
        language: preferences.language,
        preferred_currency: preferences.preferred_currency,
        timezone: preferences.timezone,
        date_format: preferences.date_format,
        time_format: preferences.time_format,
      })).unwrap();
      
      setSnackbar({
        open: true,
        message: 'Preferences saved successfully!',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Failed to save preferences',
        severity: 'error'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
    { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
    { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'sw', name: 'Kiswahili' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'ar', name: 'العربية' },
  ];

  const timezones = [
    'UTC',
    'Africa/Nairobi',
    'Africa/Kampala',
    'Africa/Dar_es_Salaam',
    'Africa/Lagos',
    'Africa/Johannesburg',
    'America/New_York',
    'Europe/London',
    'Asia/Dubai',
  ];

  return (
    <Box sx={{ 
      p: isMobile ? 2 : 3,
      bgcolor: 'background.default',
      minHeight: '100vh',
      width: '100%'
    }}>
      <Fade in timeout={500}>
        <Box sx={{ mb: 4 }}>
          <Typography variant={isMobile ? "h5" : "h4"} gutterBottom sx={{ 
            fontWeight: 700,
            color: 'text.primary',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 1
          }}>
            <SettingsOutlined sx={{ color: 'primary.main' }} />
            User Preferences
          </Typography>
          <Typography variant="body2" sx={{ 
            color: 'text.secondary',
            pb: 2,
            borderBottom: `2px solid ${theme.palette.divider}`
          }}>
            Customize your experience and application settings
          </Typography>
        </Box>
      </Fade>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Grow in timeout={800}>
            <Paper elevation={0} sx={{ 
              p: isMobile ? 2 : 3, 
              bgcolor: 'background.paper', 
              borderRadius: 2, 
              border: `1px solid ${theme.palette.divider}`,
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: 1
              }
            }}>
              <Typography variant="subtitle1" gutterBottom sx={{ 
                color: 'text.primary',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <LanguageOutlined sx={{ color: 'primary.main' }} />
                Language & Region
              </Typography>
              <Divider sx={{ my: 2, borderColor: 'divider' }} />
              
              <Grid container spacing={isMobile ? 2 : 3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'text.secondary' }}>Language</InputLabel>
                    <Select
                      name="language"
                      value={preferences.language}
                      onChange={handleChange}
                      label="Language"
                      sx={{
                        bgcolor: 'background.default',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 },
                        '& .MuiSelect-select': { color: 'text.primary' }
                      }}
                    >
                      {languages.map(lang => (
                        <MenuItem key={lang.code} value={lang.code} sx={{ color: 'text.primary' }}>
                          {lang.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'text.secondary' }}>Preferred Currency</InputLabel>
                    <Select
                      name="preferred_currency"
                      value={preferences.preferred_currency}
                      onChange={handleChange}
                      label="Preferred Currency"
                      sx={{
                        bgcolor: 'background.default',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 },
                        '& .MuiSelect-select': { color: 'text.primary' }
                      }}
                      startAdornment={
                        <InputAdornment position="start">
                          <AttachMoneyOutlined sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      }
                    >
                      {currencies.map(currency => (
                        <MenuItem key={currency.code} value={currency.code} sx={{ color: 'text.primary' }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography component="span" sx={{ color: 'primary.main' }}>{currency.symbol}</Typography>
                            <Typography component="span">{currency.name} ({currency.code})</Typography>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>
          </Grow>
        </Grid>

        <Grid item xs={12}>
          <Grow in timeout={1000}>
            <Paper elevation={0} sx={{ 
              p: isMobile ? 2 : 3, 
              bgcolor: 'background.paper', 
              borderRadius: 2, 
              border: `1px solid ${theme.palette.divider}`,
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: 1
              }
            }}>
              <Typography variant="subtitle1" gutterBottom sx={{ 
                color: 'text.primary',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <AccessTimeOutlined sx={{ color: 'primary.main' }} />
                Time & Date
              </Typography>
              <Divider sx={{ my: 2, borderColor: 'divider' }} />
              
              <Grid container spacing={isMobile ? 2 : 3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'text.secondary' }}>Timezone</InputLabel>
                    <Select
                      name="timezone"
                      value={preferences.timezone}
                      onChange={handleChange}
                      label="Timezone"
                      sx={{
                        bgcolor: 'background.default',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 },
                        '& .MuiSelect-select': { color: 'text.primary' }
                      }}
                    >
                      {timezones.map(tz => (
                        <MenuItem key={tz} value={tz} sx={{ color: 'text.primary' }}>
                          {tz.replace(/_/g, ' ')}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'text.secondary' }}>Date Format</InputLabel>
                    <Select
                      name="date_format"
                      value={preferences.date_format}
                      onChange={handleChange}
                      label="Date Format"
                      sx={{
                        bgcolor: 'background.default',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 },
                        '& .MuiSelect-select': { color: 'text.primary' }
                      }}
                    >
                      <MenuItem value="YYYY-MM-DD" sx={{ color: 'text.primary' }}>YYYY-MM-DD (2024-01-15)</MenuItem>
                      <MenuItem value="DD/MM/YYYY" sx={{ color: 'text.primary' }}>DD/MM/YYYY (15/01/2024)</MenuItem>
                      <MenuItem value="MM/DD/YYYY" sx={{ color: 'text.primary' }}>MM/DD/YYYY (01/15/2024)</MenuItem>
                      <MenuItem value="DD MMM YYYY" sx={{ color: 'text.primary' }}>DD MMM YYYY (15 Jan 2024)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'text.secondary' }}>Time Format</InputLabel>
                    <Select
                      name="time_format"
                      value={preferences.time_format}
                      onChange={handleChange}
                      label="Time Format"
                      sx={{
                        bgcolor: 'background.default',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 },
                        '& .MuiSelect-select': { color: 'text.primary' }
                      }}
                    >
                      <MenuItem value="12h" sx={{ color: 'text.primary' }}>12-hour (02:30 PM)</MenuItem>
                      <MenuItem value="24h" sx={{ color: 'text.primary' }}>24-hour (14:30)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>
          </Grow>
        </Grid>

        <Grid item xs={12}>
          <Fade in timeout={1200}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={isUpdating ? <CircularProgress size={20} /> : <SaveOutlined />}
                onClick={handleSubmit}
                disabled={isUpdating}
                sx={{ 
                  minWidth: 200,
                  py: isMobile ? 1.5 : 1,
                  px: 4,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { 
                    bgcolor: 'primary.dark',
                    transform: 'translateY(-1px)',
                    boxShadow: 2
                  },
                  '&.Mui-disabled': { 
                    bgcolor: 'action.disabledBackground',
                    color: 'text.disabled'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                {isUpdating ? 'Saving...' : 'Save Preferences'}
              </Button>
            </Box>
          </Fade>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        TransitionComponent={Fade}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ 
            width: '100%',
            bgcolor: snackbar.severity === 'success' ? 'success.dark' : 'error.dark',
            color: snackbar.severity === 'success' ? 'success.contrastText' : 'error.contrastText',
            '& .MuiAlert-icon': { color: 'inherit' }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PreferenceSettings;