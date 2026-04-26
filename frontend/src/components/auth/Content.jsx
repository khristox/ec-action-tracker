import React from 'react';
import { Box, Typography, Stack, useTheme, useMediaQuery, Grid, Paper } from '@mui/material';
import { Event, Group, Assignment, Timeline } from '@mui/icons-material';

const ecLogoLight = "./logo.png";
const ecLogoDark = "./logo1.png";

const features = [
  { icon: <Event />, title: 'Session Scheduling', desc: 'Plenary & committee meetings' },
  { icon: <Group />, title: 'Member Management', desc: 'Track commissioners & attendees' },
  { icon: <Assignment />, title: 'Agenda Tracking', desc: 'Resolutions & action points' },
  { icon: <Timeline />, title: 'Progress Monitoring', desc: 'Follow-up & compliance' },
];

const stats = [
  { label: 'COMMISSIONS', value: '12' },
  { label: 'SESSIONS', value: '200+' },
  { label: 'RESOLUTIONS', value: '500+' },
  { label: 'COMPLETION', value: '94%' },
];

const Content = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ maxWidth: 600, mx: isMobile ? 'auto' : 0 }}>
      {/* Header - Right Aligned */}
      <Box sx={{ textAlign: 'right', mb: 4 }}>
        <Box component="img" src={isDark ? ecLogoDark : ecLogoLight} alt="EC Logo"
          sx={{ width: { xs: 70, md: 90 }, height: 'auto', mb: 2, ml: 'auto', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} />
        
        <Typography variant={isMobile ? "h5" : "h4"} sx={{
          fontWeight: 800,
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', lineHeight: 1.2, mb: 1
        }}>
          Electoral Commission
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 500 }}>
          Meetings Management System
        </Typography>
      </Box>

      {!isMobile && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right', mb: 3, lineHeight: 1.5 }}>
          Streamline commission meetings, track resolutions, and ensure accountability 
          across all electoral management activities.
        </Typography>
      )}

      {/* Features Grid - Right Aligned Text */}
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {features.map((item, idx) => (
          <Grid item xs={12} sm={6} key={idx}>
            <Paper elevation={0} sx={{
              p: 2, height: '100%', display: 'flex', alignItems: 'center', gap: 2, textAlign: 'right',
              borderRadius: 2, border: `1px solid ${theme.palette.divider}`,
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'background.paper',
              transition: 'all 0.2s', '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', transform: 'translateX(-4px)' }
            }}>
              <Box sx={{ color: 'primary.main', display: 'flex', order: 2 }}>{React.cloneElement(item.icon, { sx: { fontSize: 28 } })}</Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.title}</Typography>
                <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

     
      {/* Footer Note */}
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', display: 'block', mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        Enhancing Transparency & Accountability
      </Typography>
    </Box>
  );
};

export default Content;