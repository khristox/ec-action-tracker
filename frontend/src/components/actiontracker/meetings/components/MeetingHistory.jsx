import React, { useEffect, useState, useCallback } from 'react';
import { 
  Timeline, TimelineItem, TimelineSeparator, TimelineConnector, 
  TimelineContent, TimelineOppositeContent, TimelineDot 
} from '@mui/lab';
import { 
  Paper, Typography, CircularProgress, Box, alpha, useTheme, useMediaQuery ,Avatar
} from '@mui/material';
import { History as HistoryIcon, Person as PersonIcon } from '@mui/icons-material';
import api from '../../../../services/api';

const MeetingHistory = ({ meetingId }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/action-tracker/meetings/${meetingId}/history`);
      setHistory(res.data || []);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  }, [meetingId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Dynamic colors for timeline dots based on status
  const getStatusColor = (status) => {
    const s = status?.toLowerCase();
    if (s?.includes('ended') || s?.includes('completed')) return theme.palette.success.main;
    if (s?.includes('started') || s?.includes('ongoing')) return theme.palette.info.main;
    if (s?.includes('pending')) return theme.palette.warning.main;
    if (s?.includes('cancelled')) return theme.palette.error.main;
    return theme.palette.primary.main;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress thickness={2} size={40} />
      </Box>
    );
  }

  if (history.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 6, opacity: 0.6 }}>
        <HistoryIcon sx={{ fontSize: 48, mb: 2 }} />
        <Typography>No history logs available for this meeting.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: { xs: 1, sm: 3 }, 
      bgcolor: 'transparent'
    }}>
      <Timeline position={isMobile ? "right" : "alternate"} sx={{ p: 0 }}>
        {history.map((h, index) => {
          const statusColor = getStatusColor(h.status_shortname);
          
          return (
            <TimelineItem key={h.id}>
              {!isMobile && (
                <TimelineOppositeContent 
                  sx={{ m: 'auto 0', fontWeight: 600, fontSize: '0.85rem' }}
                  align="right"
                  color="text.secondary"
                >
                  {new Date(h.status_date).toLocaleDateString()}
                  <Typography variant="caption" display="block" sx={{ opacity: 0.7 }}>
                    {new Date(h.status_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </TimelineOppositeContent>
              )}

              <TimelineSeparator>
                <TimelineConnector sx={{ bgcolor: alpha(statusColor, 0.2), width: 2 }} />
                <TimelineDot 
                  sx={{ 
                    bgcolor: alpha(statusColor, 0.1), 
                    border: `2px solid ${statusColor}`,
                    boxShadow: `0 0 10px ${alpha(statusColor, 0.4)}`,
                    p: 1
                  }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: statusColor }} />
                </TimelineDot>
                <TimelineConnector sx={{ bgcolor: alpha(statusColor, 0.2), width: 2 }} />
              </TimelineSeparator>

              <TimelineContent sx={{ py: '12px', px: 2 }}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 2.5, 
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    background: theme.palette.mode === 'dark' 
                      ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`
                      : `linear-gradient(135deg, #ffffff 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                    backdropFilter: 'blur(10px)',
                    position: 'relative',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: alpha(statusColor, 0.4)
                    }
                  }}
                >
                  {/* Status Badge */}
                  <Typography 
                    variant="caption" 
                    fontWeight={800} 
                    sx={{ 
                      color: statusColor, 
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      display: 'block',
                      mb: 0.5
                    }}
                  >
                    {h.status_shortname}
                  </Typography>

                  {/* Comment */}
                  <Typography variant="body2" sx={{ mb: 1.5, color: 'text.primary', lineHeight: 1.6 }}>
                    {h.comment || "No comment provided."}
                  </Typography>

                  {/* Footer Info */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 20, height: 20, bgcolor: alpha(theme.palette.text.secondary, 0.1) }}>
                      <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    </Avatar>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      {h.updated_by_name || 'System'}
                    </Typography>
                    {isMobile && (
                       <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.6 }}>
                        {new Date(h.status_date).toLocaleDateString()}
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