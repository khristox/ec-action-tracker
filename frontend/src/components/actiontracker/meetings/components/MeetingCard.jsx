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
import { formatDate, formatTime, getStatusConfig } from '../utils/helpers';

// ============ COLORS - Define locally to avoid import issues ============
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

// ============ DEFAULT STATUS CONFIG ============
const DEFAULT_STATUS_CONFIG = {
  label: 'Unknown',
  color: '#9E9E9E',
  bgColor: '#F5F5F5',
  textColor: '#424242'
};

// ============ HELPERS ============
const getStatusColor = (status) => {
  const statusMap = {
    'scheduled': '#1976d2',
    'in_progress': '#ed6c02',
    'completed': '#2e7d32',
    'cancelled': '#d32f2f',
    'postponed': '#9c27b0',
    'pending': '#0288d1',
  };
  return statusMap[status] || '#9E9E9E';
};

const getStatusBgColor = (status) => {
  const statusMap = {
    'scheduled': '#e3f2fd',
    'in_progress': '#fff3e0',
    'completed': '#e8f5e9',
    'cancelled': '#fbe9e7',
    'postponed': '#f3e5f5',
    'pending': '#e1f5fe',
  };
  return statusMap[status] || '#f5f5f5';
};

const getStatusLabel = (status) => {
  const statusMap = {
    'scheduled': 'Scheduled',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'postponed': 'Postponed',
    'pending': 'Pending',
  };
  return statusMap[status] || 'Unknown';
};

// ============ SUB-COMPONENTS ============
const StatusChip = React.memo(({ status, config }) => {
  // Safe fallback if config is undefined
  const safeConfig = config || DEFAULT_STATUS_CONFIG;
  const label = safeConfig.label || getStatusLabel(status) || 'Unknown';
  const color = safeConfig.color || getStatusColor(status) || '#9E9E9E';
  const bgColor = safeConfig.bgColor || getStatusBgColor(status) || '#F5F5F5';
  
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: bgColor,
        color: color,
        fontWeight: 700,
        borderRadius: 1.5,
        height: 24,
        fontSize: '0.7rem',
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
  
  // Memoize computed values with safe fallbacks
  const statusConfig = useMemo(() => {
    try {
      // Try to get config from statusOptions if provided
      if (statusOptions && meeting?.status) {
        const found = statusOptions.find(s => s.id === meeting.status || s.value === meeting.status);
        if (found) {
          return {
            label: found.label || found.name || getStatusLabel(meeting.status),
            color: found.color || getStatusColor(meeting.status),
            bgColor: found.bgColor || found.backgroundColor || getStatusBgColor(meeting.status),
            textColor: found.textColor || found.color || '#424242'
          };
        }
      }
      
      // Fallback to default status mapping
      return {
        label: getStatusLabel(meeting?.status),
        color: getStatusColor(meeting?.status),
        bgColor: getStatusBgColor(meeting?.status),
        textColor: getStatusColor(meeting?.status) || '#424242'
      };
    } catch (error) {
      console.warn('Error getting status config:', error);
      return DEFAULT_STATUS_CONFIG;
    }
  }, [meeting?.status, statusOptions]);
  
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

  const formattedDate = useMemo(() => {
    try {
      return formatDate(meeting?.meeting_date) || 'Date TBD';
    } catch {
      return 'Date TBD';
    }
  }, [meeting?.meeting_date]);
  
  const formattedTime = useMemo(() => {
    try {
      const start = formatTime(meeting?.start_time) || 'TBD';
      const end = formatTime(meeting?.end_time) || 'TBD';
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

  // If meeting is undefined, return null
  if (!meeting) {
    return null;
  }

  // Safely get colors with fallbacks
  const statusColor = statusConfig?.color || getStatusColor(meeting.status) || '#9E9E9E';
  const statusBgColor = statusConfig?.bgColor || getStatusBgColor(meeting.status) || '#F5F5F5';

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
            <StatusChip status={meeting.status} config={statusConfig} />
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