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
} from '@mui/material';
import {
  LanguageOutlined,
  AttachMoneyOutlined,
  AccessTimeOutlined,
  SaveOutlined,
} from '@mui/icons-material';
import { updateProfile } from '../../store/slices/profileSlice';

const PreferenceSettings = ({ profile }) => {
  const dispatch = useDispatch();
  const [isUpdating, setIsUpdating] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

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
      })).unwrap();
      
      setSnackbarMessage('Preferences saved successfully!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage(error.message || 'Failed to save preferences');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
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
    <Box>
      <Typography variant="h6" gutterBottom>
        User Preferences
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Customize your experience
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              <LanguageOutlined sx={{ mr: 1, verticalAlign: 'middle' }} />
              Language & Region
            </Typography>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Language</InputLabel>
                  <Select
                    name="language"
                    value={preferences.language}
                    onChange={handleChange}
                    label="Language"
                  >
                    {languages.map(lang => (
                      <MenuItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Preferred Currency</InputLabel>
                  <Select
                    name="preferred_currency"
                    value={preferences.preferred_currency}
                    onChange={handleChange}
                    label="Preferred Currency"
                    startAdornment={
                      <InputAdornment position="start">
                        <AttachMoneyOutlined />
                      </InputAdornment>
                    }
                  >
                    {currencies.map(currency => (
                      <MenuItem key={currency.code} value={currency.code}>
                        {currency.symbol} - {currency.name} ({currency.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              <AccessTimeOutlined sx={{ mr: 1, verticalAlign: 'middle' }} />
              Time & Date
            </Typography>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Timezone</InputLabel>
                  <Select
                    name="timezone"
                    value={preferences.timezone}
                    onChange={handleChange}
                    label="Timezone"
                  >
                    {timezones.map(tz => (
                      <MenuItem key={tz} value={tz}>
                        {tz.replace('_', ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Date Format</InputLabel>
                  <Select
                    name="date_format"
                    value={preferences.date_format}
                    onChange={handleChange}
                    label="Date Format"
                  >
                    <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (2024-01-15)</MenuItem>
                    <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (15/01/2024)</MenuItem>
                    <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (01/15/2024)</MenuItem>
                    <MenuItem value="DD MMM YYYY">DD MMM YYYY (15 Jan 2024)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Time Format</InputLabel>
                  <Select
                    name="time_format"
                    value={preferences.time_format}
                    onChange={handleChange}
                    label="Time Format"
                  >
                    <MenuItem value="12h">12-hour (02:30 PM)</MenuItem>
                    <MenuItem value="24h">24-hour (14:30)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={isUpdating ? <CircularProgress size={20} /> : <SaveOutlined />}
              onClick={handleSubmit}
              disabled={isUpdating}
            >
              {isUpdating ? 'Saving...' : 'Save Preferences'}
            </Button>
          </Box>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} variant="filled">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PreferenceSettings;