import React from 'react';
import { Box, Typography, Stack, useTheme, useMediaQuery, Grid, Paper } from '@mui/material';
import {
  Event as EventIcon,
  Group as GroupIcon,
  Assignment as AssignmentIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';

// Updated to point to your local public/logo.png file
const ecLogo = "./logo.png";

const features = [
  {
    icon: <EventIcon />,
    title: 'Meeting Scheduling',
    description: 'Plan and organize commission meetings',
  },
  {
    icon: <GroupIcon />,
    title: 'Participant Management',
    description: 'Track attendees and roles',
  },
  {
    icon: <AssignmentIcon />,
    title: 'Agenda Tracking',
    description: 'Manage agenda items and action points',
  },
  {
    icon: <TimelineIcon />,
    title: 'Action Monitoring',
    description: 'Follow up on resolutions and progress',
  },
];

const Content = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ maxWidth: 600, mx: isMobile ? 'auto' : 0 }}>
      {/* Header Section */}
      <Box sx={{ textAlign: isMobile ? 'center' : 'left', mb: 4 }}>
        <Box
          component="img"
          src={ecLogo} // This now uses the local path
          alt="Electoral Commission Logo"
          sx={{ 
            width: { xs: 80, md: 100 }, 
            height: 'auto', 
            mb: 2,
            filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.1))'
          }}
        />
        <Typography
          variant={isMobile ? "h4" : "h3"}
          component="h1"
          sx={{
            fontWeight: 800,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            lineHeight: 1.2,
            mb: 1,
          }}
        >
          Commission Action Tracker
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
          Electoral Commission Uganda
        </Typography>
      </Box>

      {!isMobile && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
          Enhance institutional transparency by tracking meetings, agendas, and action items. 
          Ensure accountability and timely follow-up on all resolutions.
        </Typography>
      )}

      {/* Features Grid */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        {features.map((feature, index) => (
          <Grid item xs={12} sm={6} key={index}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: 'background.default',
              }}
            >
              <Box sx={{ color: 'primary.main', display: 'flex' }}>
                {React.cloneElement(feature.icon, { sx: { fontSize: 32 } })}
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {feature.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {feature.description}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Stats Bar */}
      <Stack
        direction="row"
        spacing={2}
        sx={{
          mt: 5,
          pt: 3,
          borderTop: `1px solid ${theme.palette.divider}`,
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        {[
          { label: 'Meetings', value: '200+' },
          { label: 'Actions', value: '500+' },
          { label: 'Completion', value: '90%' },
        ].map((stat, i) => (
          <Box key={i} sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>
              {stat.value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default Content;