import React, { useEffect, useState, useCallback } from 'react';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineOppositeContent, TimelineDot } from '@mui/lab';
import { Paper, Typography, CircularProgress, Box } from '@mui/material';
import api from '../../../../services/api';

const MeetingHistory = ({ meetingId, statusOptions }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/action-tracker/meetings/${meetingId}/history`);
      setHistory(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [meetingId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) return <CircularProgress />;

  return (
    <Timeline position="right">
      {history.map((h) => (
        <TimelineItem key={h.id}>
          <TimelineOppositeContent color="text.secondary">
            {new Date(h.status_date).toLocaleString()}
          </TimelineOppositeContent>
          <TimelineSeparator>
            <TimelineDot color="primary" />
            <TimelineConnector />
          </TimelineSeparator>
          <TimelineContent>
            <Paper sx={{ p: 2, bgcolor: '#f8fafc' }}>
              <Typography fontWeight="bold">{h.status_shortname?.toUpperCase()}</Typography>
              <Typography variant="body2">{h.comment}</Typography>
              <Typography variant="caption" color="text.secondary">
                Action by: {h.updated_by_name || 'System'}
              </Typography>
            </Paper>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
};

export default MeetingHistory;