import React from 'react';
import { ListItem, ListItemAvatar, Avatar, ListItemText, Typography } from '@mui/material';
import { Event as EventIcon } from '@mui/icons-material';

const UpcomingMeetingItem = ({ meeting }) => (
  <ListItem sx={{ px: 0, py: 1.5 }}>
    <ListItemAvatar>
      <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main' }}>
        <EventIcon />
      </Avatar>
    </ListItemAvatar>
    <ListItemText 
      primary={<Typography variant="body2" fontWeight="700">{meeting.title}</Typography>}
      secondary={`${new Date(meeting.meeting_date).toLocaleDateString()} at ${meeting.start_time} • ${meeting.location_text || meeting.location_name || 'TBD'}`}
    />
  </ListItem>
);

export default UpcomingMeetingItem;