// src/components/actiontracker/meetings/components/MeetingCard.jsx
import React, { useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Paper,
  alpha,
  useMediaQuery,
  useTheme,
  Avatar,
  AvatarGroup,
} from '@mui/material';
import {
  Edit,
  Delete,
  NotificationsActive,
  Event,
  LocationOn,
  People,
  Videocam,
  AccessTime,
  Repeat,
  CalendarToday,
  ChevronRight
} from '@mui/icons-material';

// ============ COLORS ============
const COLORS = {
  primary: '#1976d2',
  secondary: '#dc004e',
  success: '#2e7d32',
  error: '#d32f2f',
  warning: '#ed6c02',
  info: '#0288d1',
  divider: '#e0e0e0',
  text: {
    primary: '#212121',
    secondary: '#757575',
  },
  background: {
    paper: '#ffffff',
    default: '#f5f5f5',
  }
};

// ============ STATUS MAPPINGS ============
// Map for MUI Chip colors (standard MUI color names)
const STATUS_MUI_COLOR_MAP = {
  'STARTED': 'success',
  'ENDED': 'default',
  'PENDING': 'warning',
  'CANCELED': 'error',
  'SCHEDULED': 'info',
  'POSTPONED': 'warning',
  'DRAFT': 'secondary',
  'IN_PROGRESS': 'success',
  'COMPLETED': 'default',
  'UPCOMING': 'info',
};

// Map for hex colors (for borders, backgrounds, etc.)
const STATUS_HEX_COLOR_MAP = {
  'STARTED': '#2e7d32',
  'ENDED': '#757575',
  'PENDING': '#ed6c02',
  'CANCELED': '#d32f2f',
  'SCHEDULED': '#0288d1',
  'POSTPONED': '#ed6c02',
  'DRAFT': '#9c27b0',
  'IN_PROGRESS': '#2e7d32',
  'COMPLETED': '#757575',
  'UPCOMING': '#0288d1',
};

const STATUS_BG_COLOR_MAP = {
  'STARTED': '#e8f5e9',
  'ENDED': '#f5f5f5',
  'PENDING': '#fff3e0',
  'CANCELED': '#ffebee',
  'SCHEDULED': '#e3f2fd',
  'POSTPONED': '#f3e5f5',
  'DRAFT': '#f3e5f5',
  'IN_PROGRESS': '#e8f5e9',
  'COMPLETED': '#f5f5f5',
  'UPCOMING': '#e3f2fd',
};

const STATUS_LABEL_MAP = {
  'STARTED': 'Started',
  'ENDED': 'Ended',
  'PENDING': 'Pending',
  'CANCELED': 'Canceled',
  'SCHEDULED': 'Scheduled',
  'POSTPONED': 'Postponed',
  'DRAFT': 'Draft',
  'IN_PROGRESS': 'In Progress',
  'COMPLETED': 'Completed',
  'UPCOMING': 'Upcoming',
};

// ============ STATUS EXTRACTION HELPER ============
/**
 * Extract status information from meeting object
 * Handles both string status and object status with short_name
 */
const extractStatusInfo = (meeting) => {
  // DEBUG: Log what we're receiving
  console.log('Extracting status from meeting:', {
    id: meeting?.id,
    title: meeting?.title,
    status: meeting?.status,
    status_type: typeof meeting?.status,
    status_id: meeting?.status_id,
  });

  // Case 1: Status is an object with short_name (API response)
  if (meeting?.status && typeof meeting.status === 'object') {
    const shortName = meeting.status.short_name?.toUpperCase() || '';
    const name = meeting.status.name || '';
    const label = shortName || name || 'Unknown';
    
    // Use color from status object if available, otherwise use mapping
    const color = meeting.status.color || STATUS_MUI_COLOR_MAP[shortName] || 'default';
    const hexColor = meeting.status.hex_color || STATUS_HEX_COLOR_MAP[shortName] || '#757575';
    const bgColor = meeting.status.bg_color || STATUS_BG_COLOR_MAP[shortName] || '#f5f5f5';
    
    return {
      label,
      color, // MUI color name (success, warning, error, etc.)
      hexColor,
      bgColor,
      shortName,
      raw: meeting.status,
    };
  }

  // Case 2: Status is a string
  if (typeof meeting?.status === 'string') {
    const upper = meeting.status.toUpperCase();
    const label = STATUS_LABEL_MAP[upper] || meeting.status;
    const color = STATUS_MUI_COLOR_MAP[upper] || 'default';
    const hexColor = STATUS_HEX_COLOR_MAP[upper] || '#757575';
    const bgColor = STATUS_BG_COLOR_MAP[upper] || '#f5f5f5';
    
    return {
      label,
      color,
      hexColor,
      bgColor,
      shortName: upper,
      raw: meeting.status,
    };
  }

  // Case 3: Try to use status_id with meeting status object
  if (meeting?.status_id && meeting?.status && typeof meeting.status === 'object') {
    const shortName = meeting.status.short_name?.toUpperCase() || '';
    if (shortName) {
      const label = meeting.status.short_name || meeting.status.name || 'Unknown';
      const color = meeting.status.color || STATUS_MUI_COLOR_MAP[shortName] || 'default';
      const hexColor = meeting.status.hex_color || STATUS_HEX_COLOR_MAP[shortName] || '#757575';
      const bgColor = meeting.status.bg_color || STATUS_BG_COLOR_MAP[shortName] || '#f5f5f5';
      
      return {
        label,
        color,
        hexColor,
        bgColor,
        shortName,
        raw: meeting.status,
      };
    }
  }

  // Case 4: No status found
  return {
    label: 'Unknown',
    color: 'default',
    hexColor: '#757575',
    bgColor: '#f5f5f5',
    shortName: '',
    raw: null,
  };
};

// ============ COMPONENTS ============
const StatusChip = React.memo(({ statusInfo }) => {
  // Safely get values with fallbacks
  const label = statusInfo?.label || 'Unknown';
  const color = statusInfo?.color || 'default';
  
  return (
    <Chip
      label={label}
      size="small"
      color={color}
      sx={{
        fontWeight: 700,
        borderRadius: 1.5,
        height: 24,
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        '& .MuiChip-label': { px: 1.2 }
      }}
    />
  );
});

const InfoItem = React.memo(({ icon, label, value, color = '#0288d1' }) => {
  const safeColor = color || '#0288d1';
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1, minWidth: 0 }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 1,
        bgcolor: alpha(safeColor, 0.1),
        flexShrink: 0,
        mt: 0.5
      }}>
        {React.cloneElement(icon, { sx: { fontSize: 16, color: safeColor } })}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography 
          variant="body2" 
          fontWeight={600} 
          sx={{ 
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {value || 'N/A'}
        </Typography>
      </Box>
    </Box>
  );
});

const ParticipantAvatars = React.memo(({ participants, count, max = 3 }) => {
  const displayCount = count || 0;
  
  if (displayCount === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No participants
      </Typography>
    );
  }

  const displayParticipants = participants?.slice(0, max) || [];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <AvatarGroup 
        max={max} 
        sx={{ 
          '& .MuiAvatar-root': { 
            width: 24, 
            height: 24, 
            fontSize: '0.6rem',
            border: '2px solid',
            borderColor: 'background.paper'
          }
        }}
      >
        {displayParticipants.map((p, idx) => (
          <Avatar 
            key={idx} 
            sx={{ 
              bgcolor: COLORS.primary,
              width: 24,
              height: 24,
              fontSize: '0.6rem'
            }}
          >
            {p?.name?.charAt(0) || p?.email?.charAt(0) || 'P'}
          </Avatar>
        ))}
      </AvatarGroup>
      {displayCount > max && (
        <Typography variant="caption" color="text.secondary">
          +{displayCount - max}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
        {displayCount} participant{displayCount > 1 ? 's' : ''}
      </Typography>
    </Box>
  );
});

// ============ MAIN COMPONENT ============
export const MeetingCard = ({ 
  meeting, 
  statusOptions, 
  onView, 
  onEdit, 
  onNotify, 
  onGenerateMeeting,
  onDelete,
  sx = {} 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  // If meeting is undefined, return null
  if (!meeting) {
    console.warn('MeetingCard: meeting prop is undefined');
    return null;
  }

  // Extract status information - THIS IS THE KEY FIX
  const statusInfo = useMemo(() => extractStatusInfo(meeting), [meeting]);
  
  const isRecurring = useMemo(() => 
    meeting?.is_recurring || meeting?.recurring_meeting_id,
    [meeting?.is_recurring, meeting?.recurring_meeting_id]
  );
  
  const locationText = useMemo(() => 
    meeting?.location_text || meeting?.location || 'Online',
    [meeting?.location_text, meeting?.location]
  );
  
  const isVirtual = useMemo(() => {
    const lower = locationText?.toLowerCase() || '';
    return lower.includes('zoom') || 
           lower.includes('meet') || 
           lower.includes('teams') ||
           lower.includes('virtual');
  }, [locationText]);
  
  const participantCount = useMemo(() => 
    meeting?.participants_count || meeting?.participants?.length || 0,
    [meeting?.participants_count, meeting?.participants]
  );

  // Date formatting with safe fallbacks
  const formattedDate = useMemo(() => {
    try {
      if (!meeting?.meeting_date) return 'Date TBD';
      const date = new Date(meeting.meeting_date);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Date TBD';
    }
  }, [meeting?.meeting_date]);
  
  const formattedTime = useMemo(() => {
    try {
      const start = meeting?.start_time 
        ? new Date(meeting.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : 'TBD';
      const end = meeting?.end_time 
        ? new Date(meeting.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : 'TBD';
      return `${start} - ${end}`;
    } catch {
      return 'Time TBD';
    }
  }, [meeting?.start_time, meeting?.end_time]);

  // Event handlers
  const handleCardClick = useCallback(() => {
    if (meeting?.id && onView) {
      onView(meeting.id);
    }
  }, [onView, meeting?.id]);

  const handleEditClick = useCallback((e) => {
    e.stopPropagation();
    if (meeting?.id && onEdit) {
      onEdit(meeting.id);
    }
  }, [onEdit, meeting?.id]);

  const handleNotifyClick = useCallback((e) => {
    e.stopPropagation();
    if (meeting && onNotify) {
      onNotify(meeting);
    }
  }, [onNotify, meeting]);

  const handleGenerateClick = useCallback((e) => {
    e.stopPropagation();
    if (meeting && onGenerateMeeting) {
      onGenerateMeeting(meeting);
    }
  }, [onGenerateMeeting, meeting]);

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation();
    if (meeting?.id && onDelete) {
      onDelete(meeting.id);
    }
  }, [onDelete, meeting?.id]);

  const isCompact = isMobile || isTablet;

  // Safely get colors from statusInfo with fallbacks
  const statusColor = statusInfo?.hexColor || '#757575';
  const statusBgColor = statusInfo?.bgColor || '#f5f5f5';
  const statusMuiColor = statusInfo?.color || 'default';

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
        border: `1px solid ${alpha(statusColor, 0.2)}`,
        bgcolor: alpha(statusColor, 0.02),
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          borderColor: statusColor,
          transform: isMobile ? 'none' : 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          bgcolor: statusColor,
          opacity: 0.3,
        },
        ...sx
      }}
    >
      {/* Top Status Bar */}
      <Box sx={{ 
        height: 3, 
        bgcolor: statusColor,
        width: '100%',
        flexShrink: 0
      }} />

      <CardContent sx={{ 
        p: isMobile ? 1.5 : 2.5, 
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5
      }}>
        {/* Header */}
        <Stack 
          direction="row" 
          justifyContent="space-between" 
          alignItems="flex-start" 
          spacing={1}
        >
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusChip statusInfo={statusInfo} />
            {isRecurring && (
              <Chip
                icon={<Repeat sx={{ fontSize: 14 }} />}
                label="Recurring"
                size="small"
                variant="outlined"
                sx={{
                  height: 24,
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  borderColor: COLORS.primary,
                  color: COLORS.primary,
                  '& .MuiChip-icon': { fontSize: 14 }
                }}
              />
            )}
          </Box>
          <Typography 
            variant="caption" 
            sx={{ 
              fontWeight: 600, 
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <CalendarToday sx={{ fontSize: 14 }} />
            {formattedDate}
          </Typography>
        </Stack>

        {/* Title */}
        <Typography 
          variant={isCompact ? "subtitle1" : "h6"} 
          sx={{ 
            fontWeight: 800, 
            color: 'text.primary',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: isCompact ? '2.4rem' : '3rem',
            '&:hover': { color: statusColor }
          }}
        >
          {meeting.title || 'Untitled Meeting'}
        </Typography>

        {/* Info Grid */}
        <Paper
          elevation={0}
          sx={{
            p: isCompact ? 1 : 1.5,
            bgcolor: alpha(COLORS.info, 0.04),
            borderRadius: 2,
            border: `1px solid ${alpha(COLORS.info, 0.08)}`,
          }}
        >
          <Stack 
            direction={isCompact ? "column" : "row"} 
            spacing={isCompact ? 1 : 2}
          >
            <InfoItem
              icon={<AccessTime />}
              label="Time"
              value={formattedTime}
              color={COLORS.info}
            />
            <InfoItem
              icon={isVirtual ? <Videocam /> : <LocationOn />}
              label="Location"
              value={locationText}
              color={isVirtual ? COLORS.info : COLORS.warning}
            />
          </Stack>
        </Paper>

        {/* Participants */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mt: 'auto',
          pt: 1,
          borderTop: `1px solid ${alpha('#e0e0e0', 0.5)}`,
        }}>
          <ParticipantAvatars 
            participants={meeting.participants} 
            count={participantCount}
            max={isCompact ? 3 : 4}
          />
          
          {meeting.agenda_items?.length > 0 && (
            <Chip
              label={`${meeting.agenda_items.length} items`}
              size="small"
              variant="outlined"
              sx={{ 
                height: 20, 
                fontSize: '0.6rem',
                borderColor: alpha(COLORS.primary, 0.3),
                color: COLORS.primary
              }}
            />
          )}
        </Box>
      </CardContent>

      {/* Action Buttons */}
      <Box sx={{
        px: isMobile ? 1.5 : 2.5,
        py: isMobile ? 1 : 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: `1px solid ${alpha(statusColor, 0.1)}`,
        bgcolor: alpha(statusColor, 0.02),
        flexShrink: 0,
        gap: 1
      }}>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit Meeting" placement="top">
            <IconButton
              size="small"
              onClick={handleEditClick}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: alpha(COLORS.primary, 0.1),
                  color: COLORS.primary
                }
              }}
            >
              <Edit fontSize={isCompact ? "small" : "medium"} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Send Notifications" placement="top">
            <IconButton
              size="small"
              onClick={handleNotifyClick}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: alpha(COLORS.info, 0.1),
                  color: COLORS.info
                }
              }}
            >
              <NotificationsActive fontSize={isCompact ? "small" : "medium"} />
            </IconButton>
          </Tooltip>

          {isRecurring && onGenerateMeeting && (
            <Tooltip title="Generate Next Occurrence" placement="top">
              <IconButton
                size="small"
                onClick={handleGenerateClick}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: alpha('#2e7d32', 0.1),
                    color: '#2e7d32'
                  }
                }}
              >
                <Repeat fontSize={isCompact ? "small" : "medium"} />
              </IconButton>
            </Tooltip>
          )}

          {onDelete && (
            <Tooltip title="Delete Meeting" placement="top">
              <IconButton
                size="small"
                onClick={handleDeleteClick}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: alpha('#d32f2f', 0.1),
                    color: '#d32f2f'
                  }
                }}
              >
                <Delete fontSize={isCompact ? "small" : "medium"} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        <Button
          size="small"
          onClick={handleCardClick}
          endIcon={<ChevronRight />}
          sx={{
            fontWeight: 700,
            textTransform: 'none',
            color: statusColor,
            '&:hover': {
              bgcolor: alpha(statusColor, 0.08)
            }
          }}
        >
          {isCompact ? 'View' : 'View Details'}
        </Button>
      </Box>
    </Card>
  );
};

export default React.memo(MeetingCard);