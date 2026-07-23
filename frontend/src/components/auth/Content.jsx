import React from 'react';
import { 
  Box, 
  Typography, 
  useTheme, 
  useMediaQuery, 
  Grid, 
  Card, 
  CardContent, 
  alpha,
  Stack
} from '@mui/material';
import { 
  Event, 
  Group, 
  Assignment, 
  Timeline
} from '@mui/icons-material';

// Logo Path Configuration
const ecLogo = "./logo.png";

// Core features configuration
const features = [
  { icon: <Event />, title: 'Smart Scheduling', desc: 'Physical & online meetings', color: '#4F46E5' },
  { icon: <Group />, title: 'Member Management', desc: 'Coordinate participants', color: '#0EA5E9' },
  { icon: <Assignment />, title: 'Agenda & Resolutions', desc: 'Track key action points', color: '#10B981' },
  { icon: <Timeline />, title: 'Progress Monitoring', desc: 'Follow up on tasks', color: '#F59E0B' },
];

const Content = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isVerySmall = useMediaQuery('(max-width:400px)');

  return (
    <Box sx={{ 
      width: '100%',
      maxWidth: '480px',
      mx: 'auto',
      px: { xs: 1.5, sm: 2 }, 
      py: { xs: 1.5, sm: 2 },
      overflowX: 'hidden' 
    }}>
      {/* Header Section - Balanced with Larger Title & Single Logo */}
      <Stack 
        sx={{
          alignItems: 'center',
          textAlign: 'center',
          mb: 2,
          gap: 1
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontWeight: 800,
            lineHeight: 1.1,
            fontSize: { xs: '1.65rem', sm: '2rem' },
            color: theme.palette.primary.main,
          }}
        >
          Electoral Commission
        </Typography>

        {/* Logo Container with Conditional White Background for Dark Mode */}
        <Box
          sx={{
            p: isDark ? 1.25 : 0,
            borderRadius: isDark ? '12px' : 0,
            bgcolor: isDark ? '#ffffff' : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            my: 0.5,
            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
          }}
        >
          <Box
            component="img"
            src={ecLogo}
            alt="Electoral Commission Logo"
            sx={{
              width: { xs: 75, sm: 95 },
              height: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </Box>

        <Typography 
          variant="caption" 
          sx={{ 
            color: 'text.secondary', 
            fontWeight: 600,
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
            letterSpacing: 0.5,
            textTransform: 'uppercase'
          }}
        >
          Action Tracker
        </Typography>
      </Stack>

      {/* Feature Grid - Compact */}
      <Grid container spacing={1}>
        {features.map((item, idx) => (
          <Grid item xs={6} key={idx}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                borderRadius: 1.5,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: isDark ? alpha(theme.palette.background.paper, 0.05) : 'background.paper',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: alpha(item.color, 0.5),
                  transform: 'translateY(-1px)',
                }
              }}
            >
              <CardContent sx={{ 
                p: { xs: 1, sm: 1.25 }, 
                textAlign: 'center',
                '&:last-child': { pb: { xs: 1, sm: 1.25 } } 
              }}>
                <Box
                  sx={{
                    p: 0.75,
                    borderRadius: '8px',
                    bgcolor: alpha(item.color, 0.1),
                    color: item.color,
                    display: 'inline-flex',
                    mb: 0.5,
                  }}
                >
                  {React.cloneElement(item.icon, { sx: { fontSize: { xs: 18, sm: 20 } } })}
                </Box>
                <Typography 
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '0.7rem', sm: '0.78rem' },
                    mb: 0.25,
                    lineHeight: 1.2
                  }}
                >
                  {item.title}
                </Typography>
                {!isVerySmall && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.secondary', 
                      fontSize: { xs: '0.6rem', sm: '0.68rem' },
                      display: 'block',
                      lineHeight: 1.2
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
    </Box>
  );
};

export default Content;