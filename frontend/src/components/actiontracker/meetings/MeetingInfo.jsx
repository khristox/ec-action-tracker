// src/components/actiontracker/meetings/MeetingInfo.jsx
import React from 'react';
import {
  Card, CardContent, Typography, Stack, Chip, Box,
  Button, IconButton, Tooltip, Divider, Grid
} from '@mui/material';
import {
  ZoomIn as ZoomIcon,
  VideoCall as GoogleMeetIcon,
  MeetingRoom as TeamsIcon,
  PersonPin as PhysicalIcon,
  Link as LinkIcon,
  ContentCopy as CopyIcon,
  Phone as PhoneIcon,
  Security as SecurityIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  NotificationsActive as NotificationIcon,
  People as PeopleIcon
} from '@mui/icons-material';

const platformConfig = {
  zoom: { icon: <ZoomIcon />, label: 'Zoom', color: '#0B5CFF' },
  google_meet: { icon: <GoogleMeetIcon />, label: 'Google Meet', color: '#34A853' },
  microsoft_teams: { icon: <TeamsIcon />, label: 'Microsoft Teams', color: '#6264A7' },
  physical: { icon: <PhysicalIcon />, label: 'Physical Meeting', color: '#6B7280' },
  other: { icon: <LinkIcon />, label: 'Other', color: '#F59E0B' }
};

const MeetingInfo = ({ meeting, onNotify, onEdit }) => {
  const [copied, setCopied] = React.useState(false);
  
  const handleCopyLink = () => {
    if (meeting.meeting_link) {
      navigator.clipboard.writeText(meeting.meeting_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const platform = platformConfig[meeting.platform] || platformConfig.other;
  
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          {/* Header with Platform Badge */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              {platform.icon}
              <Chip
                label={platform.label}
                size="small"
                sx={{ bgcolor: alpha(platform.color, 0.1), color: platform.color }}
              />
              <Chip
                icon={<PeopleIcon />}
                label={`${meeting.participants?.length || 0} Participants`}
                size="small"
                variant="outlined"
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Send Notifications">
                <IconButton onClick={onNotify} color="primary" size="small">
                  <NotificationIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit Meeting">
                <IconButton onClick={onEdit} size="small">
                  <EditIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
          
          <Divider />
          
          {/* Meeting Details */}
          <Stack spacing={2}>
            {/* Date & Time */}
            <Stack direction="row" spacing={2} alignItems="center">
              <TimeIcon fontSize="small" color="action" />
              <Typography variant="body2">
                {new Date(meeting.meeting_date).toLocaleString()}
              </Typography>
            </Stack>
            
            {/* Location or Meeting Link */}
            {meeting.platform === 'physical' ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <LocationIcon fontSize="small" color="action" />
                <Typography variant="body2">{meeting.location || 'Location TBD'}</Typography>
              </Stack>
            ) : (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LinkIcon fontSize="small" color="action" />
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {meeting.meeting_link || 'Link will be shared before meeting'}
                  </Typography>
                  {meeting.meeting_link && (
                    <Tooltip title={copied ? "Copied!" : "Copy Link"}>
                      <IconButton size="small" onClick={handleCopyLink}>
                        {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                
                {/* Meeting ID & Passcode */}
                {(meeting.meeting_id || meeting.passcode) && (
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    {meeting.meeting_id && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Meeting ID:
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {meeting.meeting_id}
                        </Typography>
                      </Grid>
                    )}
                    {meeting.passcode && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Passcode:
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {meeting.passcode}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                )}
                
                {/* Dial-in Numbers */}
                {meeting.dial_in_numbers?.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Dial-in Numbers:
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {meeting.dial_in_numbers.map((dial, idx) => (
                        <Typography key={idx} variant="body2" fontSize="0.75rem">
                          • {dial.number}{dial.instructions && ` (${dial.instructions})`}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default MeetingInfo;