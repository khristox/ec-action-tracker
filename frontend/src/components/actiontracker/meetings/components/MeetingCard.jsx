// src/components/actiontracker/meetings/components/MeetingCard.jsx
import { Box, Card, CardContent, Stack, Typography, Chip, IconButton, Tooltip, Button, Paper, alpha, useMediaQuery, useTheme } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import EventIcon from '@mui/icons-material/Event';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PeopleIcon from '@mui/icons-material/People';
import VideocamIcon from '@mui/icons-material/Videocam';
import { formatDate, formatTime, getStatusConfig } from '../utils/helpers';
import { COLORS } from '../styles/colors';

export const MeetingCard = ({ meeting, statusOptions, onView, onEdit, onNotify, onGenerateMeeting }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const statusConfig = getStatusConfig(meeting.status);
  const isRecurring = meeting.is_recurring || meeting.recurring_meeting_id;
  const locationText = meeting.location_text || 'Online';
  const isVirtual = locationText.toLowerCase().includes('zoom') || 
                    locationText.toLowerCase().includes('meet') || 
                    locationText.toLowerCase().includes('teams');

  // Handle card click (view details)
  const handleCardClick = () => {
    onView(meeting.id);
  };

  // Handle edit button click (stop propagation to prevent card click)
  const handleEditClick = (e) => {
    e.stopPropagation();
    onEdit(meeting.id);
  };

  // Handle notify button click (stop propagation)
  const handleNotifyClick = (e) => {
    e.stopPropagation();
    onNotify(meeting);
  };

  // Handle generate button click for recurring meetings (stop propagation)
  const handleGenerateClick = (e) => {
    e.stopPropagation();
    if (onGenerateMeeting) {
      onGenerateMeeting(meeting);
    }
  };

  return (
    <Card 
      elevation={0} 
      onClick={handleCardClick}
      sx={{ 
        cursor: 'pointer',
        height: '100%', 
        width: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: isMobile ? 2 : 3, 
        border: `1px solid ${alpha(statusConfig.color, 0.3)}`,
        bgcolor: alpha(statusConfig.color, 0.02),
        transition: 'all 0.3s ease',
        '&:hover': { 
          borderColor: statusConfig.color,
          transform: isMobile ? 'none' : 'translateY(-4px)',
          boxShadow: theme.shadows[8]
        }
      }}
    >
      <CardContent sx={{ p: isMobile ? 2 : 3, flexGrow: 1 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Chip 
            label={statusConfig.label}
            size="small"
            sx={{ 
              bgcolor: statusConfig.bgColor,
              color: statusConfig.color, 
              fontWeight: 700,
              borderRadius: 1.5,
            }}
          />
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            <EventIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
            {formatDate(meeting.meeting_date)}
          </Typography>
        </Stack>

        {/* Title */}
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', mb: 1.5, lineHeight: 1.3 }}>
          {meeting.title}
          {isRecurring && (
            <Chip 
              label="Recurring"
              size="small"
              variant="outlined"
              sx={{ ml: 1, fontSize: '0.65rem', height: 20 }}
            />
          )}
        </Typography>

        {/* Time and Location Info */}
        <Paper elevation={0} sx={{ p: 1.5, mb: 2, bgcolor: alpha(COLORS.info, 0.04), borderRadius: 2 }}>
          <Stack direction="row" spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <EventIcon sx={{ fontSize: 18, color: COLORS.info }} />
              <Box>
                <Typography variant="caption" color="text.secondary">Time</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              {isVirtual ? <VideocamIcon sx={{ fontSize: 18, color: COLORS.info }} /> : <LocationOnIcon sx={{ fontSize: 18, color: COLORS.info }} />}
              <Box>
                <Typography variant="caption" color="text.secondary">Location</Typography>
                <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 150 }}>
                  {locationText}
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Paper>

        {/* Participants */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon sx={{ fontSize: 16, color: COLORS.success }} />
            <Typography variant="body2">
              {meeting.participants_count || 0} participants
            </Typography>
          </Box>
        </Stack>
      </CardContent>
      
      {/* Action Buttons - No nested buttons here now! */}
      <Box sx={{ 
        px: isMobile ? 2 : 3, 
        py: 1, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderTop: `1px solid ${alpha(statusConfig.color, 0.15)}`,
        bgcolor: alpha(statusConfig.color, 0.02)
      }}>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit Meeting">
            <IconButton 
              size="small" 
              onClick={handleEditClick}
              sx={{ '&:hover': { bgcolor: alpha(COLORS.primary, 0.1) } }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Send Notifications">
            <IconButton 
              size="small" 
              onClick={handleNotifyClick}
              sx={{ '&:hover': { bgcolor: alpha(COLORS.info, 0.1) } }}
            >
              <NotificationsActiveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isRecurring && onGenerateMeeting && (
            <Tooltip title="Generate Next Occurrence">
              <IconButton 
                size="small" 
                onClick={handleGenerateClick}
                sx={{ '&:hover': { bgcolor: alpha(COLORS.success, 0.1), color: COLORS.success } }}
              >
                <EventIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Button 
          size="small" 
          onClick={handleEditClick}
          sx={{ fontWeight: 700, textTransform: 'none' }}
        >
          Edit Meeting
        </Button>
      </Box>
    </Card>
  );
};