import React from 'react';
import { 
  Box, 
  Typography, 
  Stack, 
  useTheme, 
  useMediaQuery, 
  Grid, 
  Card, 
  CardContent, 
  Divider,
  alpha // Use MUI's built-in alpha utility
} from '@mui/material';
import { Event, Group, Assignment, Timeline } from '@mui/icons-material';

// Assets - Constant paths moved outside
const ecLogoLight = "./logo.png";
const ecLogoDark = "./logo1.png";

// Features array moved outside to prevent re-declaration on every render
const features = [
  { icon: <Event />, title: 'Smart Scheduling', desc: 'Plan plenary & committee sessions', color: '#4F46E5' },
  { icon: <Group />, title: 'Member Management', desc: 'Manage commissioners & roles', color: '#0EA5E9' },
  { icon: <Assignment />, title: 'Agenda & Resolutions', desc: 'Track action points', color: '#10B981' },
  { icon: <Timeline />, title: 'Progress Monitoring', desc: 'Follow‑up on compliance', color: '#F59E0B' },
];

const Content = () => {
  const theme = useTheme();
  // Standardized breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isVerySmall = useMediaQuery('(max-width:400px)');
  const isDark = theme.palette.mode === 'dark';

  const showDescriptions = !isVerySmall;

  return (
    <Box sx={{ 
      width: '100%',
      px: { xs: 1, sm: 2, md: 3 }, 
      py: { xs: 1.5, sm: 2, md: 3 },
      // Prevent horizontal overflow
      overflowX: 'hidden' 
    }}>
      {/* Header Section */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        alignItems="center"
        spacing={{ xs: 1, sm: 2 }}
        sx={{ mb: { xs: 2, sm: 3 } }}
      >
        <Box
          component="img"
          src={isDark ? ecLogoDark : ecLogoLight}
          alt="Electoral Commission Logo"
          sx={{
            width: { xs: 50, sm: 70, md: 80 },
            height: 'auto',
            objectFit: 'contain'
          }}
        />
        <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
          <Typography
            variant="h1" // Changed to H1 for SEO/Accessibility, style via sx
            sx={{
              fontWeight: 800,
              lineHeight: 1.2,
              fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: theme.palette.primary.main, // Fallback
            }}
          >
            Electoral Commission
          </Typography>
          {!isVerySmall && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Meetings Management System
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Description */}
      {!isVerySmall && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: { xs: 2, sm: 3 },
            textAlign: { xs: 'center', sm: 'left' },
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
            maxWidth: '600px'
          }}
        >
          Streamline commission meetings, track resolutions, and ensure accountability
          across all electoral management activities.
        </Typography>
      )}

      {/* Feature Grid */}
      <Grid container spacing={{ xs: 1, sm: 1.5, md: 2 }}>
        {features.map((item, idx) => (
          <Grid item xs={6} key={idx}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: isDark ? alpha(theme.palette.background.paper, 0.05) : 'background.paper',
                transition: 'transform 0.2s',
                '&:hover': {
                    borderColor: alpha(item.color, 0.5)
                }
              }}
            >
              <CardContent sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                textAlign: 'center',
                // MUI CardContent adds padding-bottom by default, let's normalize it
                '&:last-child': { pb: { xs: 1.5, sm: 2 } } 
              }}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: '12px',
                    bgcolor: alpha(item.color, 0.1),
                    color: item.color,
                    display: 'inline-flex',
                    mb: 1,
                  }}
                >
                  {/* Fixed: Pass sx directly to the icon if it's a valid React element */}
                  {React.isValidElement(item.icon) 
                    ? React.cloneElement(item.icon, { 
                        sx: { fontSize: { xs: 20, sm: 24, md: 26 } } 
                      }) 
                    : item.icon
                  }
                </Box>
                <Typography 
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '0.75rem', sm: '0.85rem', md: '0.95rem' },
                    mb: showDescriptions ? 0.5 : 0,
                    lineHeight: 1.2
                  }}
                >
                  {item.title}
                </Typography>
                {showDescriptions && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.secondary', 
                      fontSize: { xs: '0.65rem', sm: '0.75rem' },
                      display: 'block',
                      lineHeight: 1.3
                    }}
                  >
                    {item.desc}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Footer */}
      {!isVerySmall && (
        <Box sx={{ mt: { xs: 2, sm: 4 } }}>
          <Divider sx={{ mb: 2 }} />
          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              display: 'block',
              color: 'text.disabled',
              fontWeight: 500,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              fontSize: '0.6rem'
            }}
          >
            Enhancing Transparency & Accountability
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Content;