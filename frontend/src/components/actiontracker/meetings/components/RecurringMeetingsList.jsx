// src/components/actiontracker/meetings/components/RecurringMeetingsList.jsx
import { Grid, Typography, Box, CircularProgress, Alert, Button, Stack, Paper, useMediaQuery, useTheme, Container } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { RecurringMeetingCard } from './RecurringMeetingCard';

export const RecurringMeetingsList = ({ 
  meetings = [], 
  loading = false,
  error = null,
  onView, 
  onEdit, 
  onGenerate,
  onRefresh 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  // Ensure meetings is always an array
  const meetingsArray = Array.isArray(meetings) ? meetings : [];
  
  // Sort by next occurrence date (upcoming first)
  const sortedMeetings = [...meetingsArray].sort((a, b) => {
    const dateA = a.next_occurrence_date ? new Date(a.next_occurrence_date) : new Date(8640000000000000);
    const dateB = b.next_occurrence_date ? new Date(b.next_occurrence_date) : new Date(8640000000000000);
    return dateA - dateB;
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ py: 4, px: isMobile ? 2 : 0 }}>
        <Alert 
          severity="error" 
          action={
            onRefresh && (
              <Button color="inherit" size="small" onClick={onRefresh} startIcon={<RefreshIcon />}>
                Retry
              </Button>
            )
          }
          sx={{ borderRadius: 2 }}
        >
          {error}
        </Alert>
      </Box>
    );
  }
  
  if (meetingsArray.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, px: isMobile ? 2 : 0 }}>
        <Box sx={{ 
          width: isMobile ? 80 : 100, 
          height: isMobile ? 80 : 100, 
          mx: 'auto', 
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          bgcolor: 'action.hover'
        }}>
          <Typography variant={isMobile ? "h3" : "h2"}>📅</Typography>
        </Box>
        <Typography variant={isMobile ? "h6" : "h5"} color="text.secondary" gutterBottom fontWeight={600}>
          No recurring meetings found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 400, mx: 'auto' }}>
          Create your first recurring meeting series to get started
        </Typography>
      </Box>
    );
  }

  // For mobile: full width cards, no container padding
  if (isMobile) {
    return (
      <Box sx={{ width: '100%', px: 0 }}>
        {/* Header Stats for Mobile */}
        <Stack 
          direction="row" 
          spacing={1} 
          sx={{ 
            mb: 2, 
            p: 2, 
            bgcolor: 'background.paper', 
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            mx: 2
          }}
        >
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Total</Typography>
            <Typography variant="h6" fontWeight={700} color="primary">
              {meetingsArray.length}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Active</Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">
              {meetingsArray.filter(m => m.status === 'active' && m.next_occurrence_date).length}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Generated</Typography>
            <Typography variant="h6" fontWeight={700} color="info.main">
              {meetingsArray.reduce((sum, m) => sum + (m.total_occurrences_generated || 0), 0)}
            </Typography>
          </Box>
        </Stack>

        {/* Mobile List - Full width cards */}
        <Stack spacing={2} sx={{ width: '100%' }}>
          {sortedMeetings.map((meeting, index) => (
            <Box 
              key={meeting.id}
              sx={{ 
                width: '100%',
                px: 0, // Remove padding to allow card to be full width
                animation: `fadeInUp 0.3s ease ${index * 0.05}s both`,
                '@keyframes fadeInUp': {
                  from: { opacity: 0, transform: 'translateY(20px)' },
                  to: { opacity: 1, transform: 'translateY(0)' }
                }
              }}
            >
              <RecurringMeetingCard
                meeting={meeting}
                onView={onView}
                onEdit={onEdit}
                onGenerate={onGenerate}
                showStats={false}
                compact={true}
              />
            </Box>
          ))}
        </Stack>

        {/* Load More Button */}
        {meetingsArray.length > 10 && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', pb: 2 }}>
            <Button 
              variant="outlined" 
              onClick={onRefresh}
              startIcon={<RefreshIcon />}
              sx={{ borderRadius: 2 }}
            >
              Load More
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  // For tablet and desktop: grid layout with proper spacing
  return (
    <Container maxWidth="xl" sx={{ px: { sm: 2, md: 3 } }}>
      {/* Header Stats for Tablet/Desktop */}
      <Stack 
        direction="row" 
        spacing={2} 
        sx={{ 
          mb: 3, 
          p: 2, 
          bgcolor: 'background.paper', 
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">Total:</Typography>
          <Typography variant="h6" fontWeight={700} color="primary">{meetingsArray.length}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">Active:</Typography>
          <Typography variant="h6" fontWeight={700} color="success.main">
            {meetingsArray.filter(m => m.status === 'active' && m.next_occurrence_date).length}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">Generated:</Typography>
          <Typography variant="h6" fontWeight={700} color="info.main">
            {meetingsArray.reduce((sum, m) => sum + (m.total_occurrences_generated || 0), 0)}
          </Typography>
        </Box>
      </Stack>

      {/* Grid Layout */}
      <Grid container spacing={3}>
        {sortedMeetings.map((meeting) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={meeting.id}>
            <RecurringMeetingCard
              meeting={meeting}
              onView={onView}
              onEdit={onEdit}
              onGenerate={onGenerate}
              showStats={true}
              compact={false}
            />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};