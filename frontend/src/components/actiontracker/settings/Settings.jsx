import React, { useState } from 'react';
import { Container, Typography, Paper, Box, Tabs, Tab, Grid, TextField, Button, Divider, Avatar, IconButton } from '@mui/material';
import { Settings as SettingsIcon, PhotoCamera as PhotoCameraIcon } from '@mui/icons-material';

const Settings = () => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Manage your account preferences and system settings
      </Typography>

      <Paper sx={{ borderRadius: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, v) => setTabValue(v)} 
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Profile" />
          <Tab label="Security" />
          <Tab label="Notifications" />
          <Tab label="Preferences" />
        </Tabs>

        <Box sx={{ p: 4 }}>
          {/* Profile Tab */}
          {tabValue === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} display="flex" justifyContent="center">
                <Box position="relative">
                  <Avatar sx={{ width: 100, height: 100, bgcolor: 'primary.main' }}>
                    A
                  </Avatar>
                  <IconButton
                    sx={{ position: 'absolute', bottom: 0, right: 0, bgcolor: 'background.paper' }}
                    size="small"
                  >
                    <PhotoCameraIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Full Name" defaultValue="Admin User" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Email" defaultValue="admin@ecactiontracker.com" />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Username" defaultValue="admin" />
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Button variant="contained">Save Changes</Button>
              </Grid>
            </Grid>
          )}

          {/* Security Tab */}
          {tabValue === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField fullWidth type="password" label="Current Password" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth type="password" label="New Password" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth type="password" label="Confirm New Password" />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained">Update Password</Button>
              </Grid>
            </Grid>
          )}

          {/* Notifications Tab */}
          {tabValue === 2 && (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                Notification settings coming soon.
              </Typography>
            </Box>
          )}

          {/* Preferences Tab */}
          {tabValue === 3 && (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                Preference settings coming soon.
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default Settings;