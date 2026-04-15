import React, { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Switch,
  Divider,
  FormControlLabel,
  Button,
  Alert,
  Snackbar,
  Paper,
} from '@mui/material';
import {
  NotificationsActive,
  EmailOutlined,
  SmsOutlined,
  SaveOutlined,
} from '@mui/icons-material';

const NotificationSettings = () => {
  const [settings, setSettings] = useState({
    email_notifications: true,
    push_notifications: true,
    sms_notifications: false,
    meeting_reminders: true,
    action_updates: true,
    task_assigned: true,
    task_overdue: true,
    weekly_report: false,
    marketing_emails: false,
  });
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleToggle = (setting) => (event) => {
    setSettings(prev => ({ ...prev, [setting]: event.target.checked }));
  };

  const handleSubmit = async () => {
    setIsUpdating(true);
    // Simulate API call
    setTimeout(() => {
      setSnackbarMessage('Notification settings saved successfully!');
      setSnackbarOpen(true);
      setIsUpdating(false);
    }, 500);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Notification Preferences
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose how you want to receive notifications
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              <EmailOutlined sx={{ mr: 1, verticalAlign: 'middle' }} />
              Email Notifications
            </Typography>
            <Divider sx={{ my: 1 }} />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.email_notifications}
                  onChange={handleToggle('email_notifications')}
                />
              }
              label="Enable email notifications"
            />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              <NotificationsActive sx={{ mr: 1, verticalAlign: 'middle' }} />
              Push Notifications
            </Typography>
            <Divider sx={{ my: 1 }} />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.push_notifications}
                  onChange={handleToggle('push_notifications')}
                />
              }
              label="Enable push notifications"
            />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              <SmsOutlined sx={{ mr: 1, verticalAlign: 'middle' }} />
              SMS Notifications
            </Typography>
            <Divider sx={{ my: 1 }} />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.sms_notifications}
                  onChange={handleToggle('sms_notifications')}
                />
              }
              label="Enable SMS notifications"
            />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              What to notify me about
            </Typography>
            <Divider sx={{ my: 1 }} />
            
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.meeting_reminders}
                      onChange={handleToggle('meeting_reminders')}
                    />
                  }
                  label="Meeting reminders"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.action_updates}
                      onChange={handleToggle('action_updates')}
                    />
                  }
                  label="Action updates"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.task_assigned}
                      onChange={handleToggle('task_assigned')}
                    />
                  }
                  label="When I'm assigned a task"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.task_overdue}
                      onChange={handleToggle('task_overdue')}
                    />
                  }
                  label="When a task is overdue"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.weekly_report}
                      onChange={handleToggle('weekly_report')}
                    />
                  }
                  label="Weekly summary report"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.marketing_emails}
                      onChange={handleToggle('marketing_emails')}
                    />
                  }
                  label="Marketing and product updates"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<SaveOutlined />}
              onClick={handleSubmit}
              disabled={isUpdating}
            >
              Save Notification Settings
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
        <Alert onClose={handleCloseSnackbar} severity="success" variant="filled">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NotificationSettings;