// src/components/actiontracker/meetings/components/MeetingHistory.jsx

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Timeline, TimelineItem, TimelineSeparator, TimelineConnector, 
  TimelineContent, TimelineOppositeContent, TimelineDot 
} from '@mui/lab';
import { 
  Paper, Typography, CircularProgress, Box, alpha, useTheme, useMediaQuery,
  Avatar, Alert, Button, Fade
} from '@mui/material';
import { 
  History as HistoryIcon, 
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Construction as ConstructionIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

const MeetingHistory = ({ meetingId, onRefresh }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!meetingId) {
      setHistory([]);
      setFeatureAvailable(false);
      setError('Meeting ID is required to view history.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.get(`/action-tracker/meetings/${meetingId}/history`);
      
      // ✅ Handle the actual response format
      let historyData = [];
      if (Array.isArray(res.data)) {
        historyData = res.data;
      } else if (res.data?.items && Array.isArray(res.data.items)) {
        historyData = res.data.items;
      } else if (res.data?.results && Array.isArray(res.data.results)) {
        historyData = res.data.results;
      } else if (res.data && typeof res.data === 'object') {
        // If it's a single object, wrap it in an array
        historyData = [res.data];
      }
      
      setHistory(historyData);
      setFeatureAvailable(true);
    } catch (err) {
      console.debug('Meeting history not available:', err.message);
      
      if (err.response?.status === 404) {
        setFeatureAvailable(false);
        setError('The history feature is not yet available for this meeting.');
      } else if (err.response?.status === 403) {
        setError('You don\'t have permission to view this meeting\'s history.');
      } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        setError('Network error. Please check your connection.');
      } else {
        setError(err.message || 'Failed to load meeting history');
      }
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = () => {
    fetchHistory();
    if (onRefresh) onRefresh();
  };

  // ✅ Get color based on event type
  const getEventColor = (event) => {
    if (!event) return theme.palette.primary.main;
    const e = event.toLowerCase();
    if (e?.includes('created')) return theme.palette.success.main;
    if (e?.includes('updated')) return theme.palette.info.main;
    if (e?.includes('deleted') || e?.includes('cancelled')) return theme.palette.error.main;
    if (e?.includes('status')) return theme.palette.warning.main;
    return theme.palette.primary.main;
  };

  // ✅ Get display name for event
  const getEventDisplayName = (event) => {
    if (!event) return 'Event';
    return event
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // ✅ Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Unknown date';
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  // If feature is not available, show a friendly message
  if (!featureAvailable && !loading) {
    return (
      <Fade in timeout={400}>
        <Paper 
          sx={{ 
            p: { xs: 3, sm: 5 }, 
            textAlign: 'center', 
            borderRadius: 3,
            border: `1px dashed ${theme.palette.divider}`,
            bgcolor: theme.palette.mode === 'dark' 
              ? alpha(theme.palette.background.paper, 0.5)
              : alpha(theme.palette.background.paper, 0.8),
          }}
        >
          <ConstructionIcon 
            sx={{ 
              fontSize: 56, 
              color: theme.palette.warning.main,
              opacity: 0.7,
              mb: 2
            }} 
          />
          <Typography variant="h6" gutterBottom fontWeight={600}>
            History Feature Coming Soon
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}>
            The meeting history feature is currently being developed. 
            Check back later to see all changes and activities for this meeting.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            size="small"
            sx={{ borderRadius: 2 }}
          >
            Refresh
          </Button>
        </Paper>
      </Fade>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress thickness={2} size={40} />
      </Box>
    );
  }

  if (error) {
    return (
      <Fade in timeout={400}>
        <Alert
          severity="info"
          variant="outlined"
          sx={{ 
            borderRadius: 2,
            '& .MuiAlert-icon': {
              color: theme.palette.info.main
            }
          }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleRefresh}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Fade>
    );
  }

  if (history.length === 0) {
    return (
      <Fade in timeout={400}>
        <Box sx={{ textAlign: 'center', p: { xs: 4, sm: 6 }, opacity: 0.7 }}>
          <HistoryIcon sx={{ fontSize: 48, mb: 2, color: 'action.disabled' }} />
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No history logs available for this meeting.
          </Typography>
          <Typography variant="caption" color="text.disabled">
            History will appear here as changes are made.
          </Typography>
        </Box>
      </Fade>
    );
  }

  return (
    <Box sx={{ 
      p: { xs: 1, sm: 3 }, 
      bgcolor: 'transparent',
      position: 'relative'
    }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2,
        px: 1
      }}>
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
          {history.length} {history.length === 1 ? 'event' : 'events'} recorded
        </Typography>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading}
          sx={{ borderRadius: 2 }}
        >
          Refresh
        </Button>
      </Box>

      <Timeline position={isMobile ? "right" : "alternate"} sx={{ p: 0, m: 0 }}>
        {history.map((h, index) => {
          // ✅ Map the actual response fields
          const eventType = h.event || h.type || 'event';
          const eventColor = getEventColor(eventType);
          const eventDisplayName = getEventDisplayName(eventType);
          const isLast = index === history.length - 1;
          
          // Get the user name from the response
          const userName = h.user_name || h.updated_by_name || h.actor_name || 'System';
          
          // Get the description
          const description = h.details || h.description || h.action || 'No details provided';
          
          // Get the timestamp
          const timestamp = h.timestamp || h.status_date || h.created_at;
          
          return (
            <TimelineItem key={h.id || index} sx={{ 
              '&:before': { 
                display: isMobile ? 'none' : 'block' 
              }
            }}>
              {!isMobile && (
                <TimelineOppositeContent 
                  sx={{ 
                    m: 'auto 0', 
                    fontWeight: 600, 
                    fontSize: '0.85rem',
                    flex: 0.3,
                  }}
                  align="right"
                  color="text.secondary"
                >
                  {formatTimestamp(timestamp)}
                </TimelineOppositeContent>
              )}

              <TimelineSeparator>
                {index > 0 && (
                  <TimelineConnector 
                    sx={{ 
                      bgcolor: alpha(eventColor, 0.2), 
                      width: 2,
                      flex: 1
                    }} 
                  />
                )}
                <TimelineDot 
                  sx={{ 
                    bgcolor: alpha(eventColor, 0.1), 
                    border: `2px solid ${eventColor}`,
                    boxShadow: `0 0 20px ${alpha(eventColor, 0.2)}`,
                    p: 1,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      boxShadow: `0 0 30px ${alpha(eventColor, 0.3)}`,
                    }
                  }}
                >
                  <Box sx={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    bgcolor: eventColor,
                    transition: 'all 0.3s ease',
                  }} />
                </TimelineDot>
                {!isLast && (
                  <TimelineConnector 
                    sx={{ 
                      bgcolor: alpha(eventColor, 0.2), 
                      width: 2,
                      flex: 1
                    }} 
                  />
                )}
              </TimelineSeparator>

              <TimelineContent sx={{ py: '12px', px: { xs: 1, sm: 2 } }}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: { xs: 1.5, sm: 2.5 }, 
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    background: theme.palette.mode === 'dark' 
                      ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`
                      : `linear-gradient(135deg, #ffffff 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                    backdropFilter: 'blur(10px)',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: alpha(eventColor, 0.3),
                      boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.06)}`,
                    }
                  }}
                >
                  <Typography 
                    variant="caption" 
                    fontWeight={800} 
                    sx={{ 
                      color: eventColor, 
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      display: 'block',
                      mb: 0.5,
                      fontSize: '0.6rem'
                    }}
                  >
                    {eventDisplayName}
                  </Typography>

                  <Typography 
                    variant="body2" 
                    sx={{ 
                      mb: 1.5, 
                      color: 'text.primary', 
                      lineHeight: 1.6,
                      wordBreak: 'break-word'
                    }}
                  >
                    {description}
                  </Typography>

                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    flexWrap: 'wrap'
                  }}>
                    <Avatar 
                      sx={{ 
                        width: 20, 
                        height: 20, 
                        bgcolor: alpha(theme.palette.text.secondary, 0.1),
                        fontSize: '0.6rem'
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                    </Avatar>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      {userName}
                    </Typography>
                    
                    {isMobile && (
                      <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.6 }}>
                        {formatTimestamp(timestamp)}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>
    </Box>
  );
};

export default MeetingHistory;