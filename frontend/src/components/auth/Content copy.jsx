import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  useTheme, 
  useMediaQuery, 
  Grid, 
  Card, 
  CardContent, 
  Divider,
  alpha,
  CircularProgress,
  Alert,
  Button,
  Stack,
  Paper
} from '@mui/material';
import { 
  Event, 
  Group, 
  Assignment, 
  Timeline,
  Description,
  CheckCircle,
  Pending,
  Cancel,
  TrendingUp
} from '@mui/icons-material';
import api from '../../services/api';

// Assets
const ecLogoLight = "./logo.png";
const ecLogoDark = "./logo1.png";

// Features configuration
const features = [
  { icon: <Event />, title: 'Smart Scheduling', desc: 'Organize both physical and online meetings', color: '#4F46E5' },
  { icon: <Group />, title: 'Member Management', desc: 'Manage Meeting participants', color: '#0EA5E9' },
  { icon: <Assignment />, title: 'Agenda & Resolutions', desc: 'Track action points', color: '#10B981' },
  { icon: <Timeline />, title: 'Progress Monitoring', desc: 'Follow-up on implementation of assigned tasks', color: '#F59E0B' },
];

// Stats configuration - each stat with icon and color
const getStatsConfig = (stats) => [
  { 
    label: 'Total', 
    value: stats?.total || 0, 
    icon: <Description fontSize="small" />, 
    color: '#6366F1',
    bgColor: alpha('#6366F1', 0.08)
  },
  { 
    label: 'Upcoming', 
    value: stats?.upcoming || 0, 
    icon: <Event fontSize="small" />, 
    color: '#0EA5E9',
    bgColor: alpha('#0EA5E9', 0.08)
  },
  { 
    label: 'In Progress', 
    value: stats?.in_progress || 0, 
    icon: <Pending fontSize="small" />, 
    color: '#F59E0B',
    bgColor: alpha('#F59E0B', 0.08)
  },
  { 
    label: 'Completed', 
    value: stats?.completed || 0, 
    icon: <CheckCircle fontSize="small" />, 
    color: '#10B981',
    bgColor: alpha('#10B981', 0.08)
  },
];

const Content = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isVerySmall = useMediaQuery('(max-width:400px)');
  const isDark = theme.palette.mode === 'dark';
  const showDescriptions = !isVerySmall;

  // State for API data
  const [meetingStats, setMeetingStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data when component mounts
  useEffect(() => {
    const fetchMeetingStats = async () => {
      try {
        setLoading(true);
        const response = await api.get('/action-tracker/meetings/stats');
        console.log('Stats response:', response.data);
        setMeetingStats(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching meeting stats:', err);
        setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to load meeting data');
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingStats();
  }, []);

  // Handler for refreshing data
  const handleRetry = () => {
    window.location.reload();
  };

  const statsConfig = getStatsConfig(meetingStats);

  return (
    <Box sx={{ 
      width: '100%',
      px: { xs: 1, sm: 2, md: 3 }, 
      py: { xs: 1.5, sm: 2, md: 3 },
      overflowX: 'hidden' 
    }}>
      {/* Header Section */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          alignItems: 'center',
          mb: { xs: 2, sm: 3 },
          gap: { xs: 1, sm: 2 }
        }}
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
            variant="h1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.2,
              fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: theme.palette.primary.main,
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

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* ✅ IMPROVED: Less predominant stats - lighter, smaller, more subtle */}
      {!loading && !error && meetingStats && (
        <Paper 
          elevation={0}
          sx={{ 
            mb: 3, 
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            bgcolor: isDark ? alpha(theme.palette.background.paper, 0.4) : 'background.paper',
            border: `1px solid ${isDark ? alpha('#FFFFFF', 0.06) : alpha('#000000', 0.06)}`
          }}
        >
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: { 
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(4, 1fr)' 
            },
            gap: { xs: 1, sm: 1.5 }
          }}>
            {statsConfig.map((stat, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: { xs: 1, sm: 1.5 },
                  py: { xs: 0.75, sm: 1 },
                  borderRadius: 1.5,
                  bgcolor: isDark ? alpha('#FFFFFF', 0.02) : alpha('#000000', 0.02),
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: stat.bgColor,
                    transform: 'translateY(-1px)',
                  }
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: stat.bgColor,
                    color: stat.color,
                    flexShrink: 0
                  }}
                >
                  {stat.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700, 
                      fontSize: { xs: '1rem', sm: '1.1rem' },
                      lineHeight: 1.2,
                      color: 'text.primary'
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.secondary',
                      fontSize: { xs: '0.6rem', sm: '0.65rem' },
                      fontWeight: 500,
                      display: 'block',
                      lineHeight: 1.2,
                      textTransform: 'uppercase',
                      letterSpacing: 0.3
                    }}
                  >
                    {stat.label}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* Feature Grid */}
      <Grid container spacing={{ xs: 1, sm: 1.5, md: 2 }}>
        {features.map((item, idx) => (
          <Grid size={{ xs: 6 }} key={idx}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: isDark ? alpha(theme.palette.background.paper, 0.05) : 'background.paper',
                transition: 'transform 0.2s',
                '&:hover': {
                  borderColor: alpha(item.color, 0.5),
                  transform: 'translateY(-2px)',
                  boxShadow: isDark ? `0 4px 12px ${alpha('#000000', 0.3)}` : `0 4px 12px ${alpha('#000000', 0.06)}`
                }
              }}
            >
              <CardContent sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                textAlign: 'center',
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