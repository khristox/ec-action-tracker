// src/components/actiontracker/meetings/components/RecurringMeetingCard.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Card, CardContent, CardActionArea, Stack, Typography,
  Chip, IconButton, Tooltip, Button, Paper, alpha, LinearProgress,
  useMediaQuery, useTheme, Divider, Collapse,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TodayIcon from '@mui/icons-material/Today';
import RepeatIcon from '@mui/icons-material/Repeat';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BusinessIcon from '@mui/icons-material/Business';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import api from '../../../../services/api';
import { formatDate, getRecurrenceDescription } from '../utils/helpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a status tuple from the meeting object */
const getStatus = (meeting) => {
  const isActive = meeting?.status === 'active';
  const hasNext = !!meeting?.next_occurrence_date;

  if (!isActive) return { key: 'inactive', label: 'Paused', color: 'warning', icon: <WarningAmberIcon sx={{ fontSize: 14 }} /> };
  if (!hasNext) return { key: 'completed', label: 'Completed', color: 'info', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> };
  return { key: 'active', label: 'Active', color: 'success', icon: <RepeatIcon sx={{ fontSize: 14 }} /> };
};

/** Pick a location icon by scanning the location text */
const pickLocationIcon = (text = '') => {
  const t = text.toLowerCase();
  if (t.includes('zoom') || t.includes('meet') || t.includes('teams') || t.includes('virtual') || t.includes('online'))
    return <VideocamIcon sx={{ fontSize: 16 }} />;
  if (t.includes('room') || t.includes('conference') || t.includes('boardroom'))
    return <MeetingRoomIcon sx={{ fontSize: 16 }} />;
  if (t.includes('office') || t.includes('building') || t.includes('headquarters'))
    return <BusinessIcon sx={{ fontSize: 16 }} />;
  return <LocationOnIcon sx={{ fontSize: 16 }} />;
};

/** Format time range */
const formatTimeRange = (start, end) => {
  if (!start && !end) return null;
  const startTime = start ? new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const endTime = end ? new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  if (startTime && endTime) return `${startTime} – ${endTime}`;
  if (startTime) return `${startTime}`;
  return null;
};

/** Icon container with a soft coloured background */
const InfoIconBox = ({ children, bgcolor, color, size = 30 }) => (
  <Box sx={{
    width: size, height: size, borderRadius: 1.5, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    bgcolor, color,
  }}>
    {children}
  </Box>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const RecurringMeetingCard = ({
  meeting,
  onView,
  onEdit,
  onGenerate,
  showStats = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  const [locationDetails, setLocationDetails] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // ── Fetch full location object once ───────────────────────────────────────
  useEffect(() => {
    if (!meeting?.location_id || locationDetails || locLoading) return;
    let cancelled = false;
    const fetch = async () => {
      setLocLoading(true);
      try {
        const res = await api.get(`/locations/${meeting.location_id}`);
        if (!cancelled) setLocationDetails(res.data?.data || res.data);
      } catch { /* keep null */ }
      finally { if (!cancelled) setLocLoading(false); }
    };
    fetch();
    return () => { cancelled = true; };
  }, [meeting?.location_id]);

  // ── Derived values with safety checks ─────────────────────────────────────
  const status = getStatus(meeting);
  const totalGenerated = meeting?.total_occurrences_generated || 0;
  const maxOccurrences = meeting?.recurrence_max_occurrences;
  const hasNext = status.key === 'active';
  const isCompleted = status.key === 'completed';
  const isPaused = status.key === 'inactive';

  const completionPct = maxOccurrences && totalGenerated
    ? Math.min(100, Math.round((totalGenerated / maxOccurrences) * 100))
    : null;

  const locationText = meeting?.location_text || locationDetails?.name || '';
  const locationLine = locationText || (locLoading ? 'Loading...' : 'Online meeting');
  const LocationIcon = pickLocationIcon(locationText);
  const timeRange = formatTimeRange(meeting?.start_time, meeting?.end_time);
  
  // Additional derived values
  const createdDate = meeting?.created_at ? formatDate(meeting.created_at) : null;
  const lastOccurrence = meeting?.last_occurrence_date ? formatDate(meeting.last_occurrence_date) : null;
  const recurrenceInterval = meeting?.recurrence_interval || 1;

  const progressColor = isCompleted ? theme.palette.info.main : theme.palette.success.main;

  // ── Styles ────────────────────────────────────────────────────────────────
  const borderColor = {
    active: alpha(theme.palette.success.main, 0.35),
    inactive: alpha(theme.palette.warning.main, 0.35),
    completed: alpha(theme.palette.info.main, 0.25),
  }[status.key];

  const accentBg = {
    active: alpha(theme.palette.success.main, 0.03),
    inactive: alpha(theme.palette.warning.main, 0.03),
    completed: alpha(theme.palette.info.main, 0.02),
  }[status.key];

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: isMobile ? 2 : 3,
        border: `0.5px solid ${borderColor}`,
        bgcolor: accentBg,
        opacity: isCompleted ? 0.85 : 1,
        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        overflow: 'hidden',
        '&:hover': {
          borderColor: theme.palette[status.color]?.main,
          transform: isMobile ? 'none' : 'translateY(-4px)',
          boxShadow: theme.shadows[4],
        },
      }}
    >
      {/* Progress bar — only when max occurrences is set */}
      {completionPct !== null && showStats && (
        <LinearProgress
          variant="determinate"
          value={completionPct}
          sx={{
            height: 3,
            bgcolor: alpha(progressColor, 0.15),
            '& .MuiLinearProgress-bar': { bgcolor: progressColor, transition: 'transform 0.3s ease' },
          }}
        />
      )}

      {/* ── Clickable body ── */}
      <CardActionArea onClick={() => onView(meeting?.id)} sx={{ flexGrow: 1, alignItems: 'flex-start' }}>
        <CardContent sx={{ p: isMobile ? 2 : 2.5, pb: '12px !important' }}>

          {/* Header row */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={1.5}>
            <Chip
              size="small"
              color={status.color}
              icon={status.icon}
              label={status.label}
              sx={{ fontWeight: 600, borderRadius: 1.5, height: 26 }}
            />
            <Typography 
              variant="caption" 
              sx={{ 
                border: '0.5px solid', 
                borderColor: 'divider', 
                borderRadius: 20, 
                px: 1, 
                py: 0.25,
                bgcolor: alpha(theme.palette.background.paper, 0.5)
              }}
            >
              {totalGenerated} generated
            </Typography>
          </Stack>

          {/* Title */}
          <Typography
            variant="body1"
            fontWeight={700}
            mb={1}
            sx={{ 
              lineHeight: 1.35, 
              fontSize: isMobile ? '1rem' : '1.1rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {meeting?.title}
          </Typography>

          {/* Recurrence pattern */}
          <Stack direction="row" alignItems="center" spacing={0.75} mb={1.5}>
            <RepeatIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {getRecurrenceDescription(meeting)} • Every {recurrenceInterval} week{recurrenceInterval !== 1 ? 's' : ''}
            </Typography>
          </Stack>

          {/* Info panel */}
          <Paper
            elevation={0}
            sx={{
              px: 1.5, py: 1.25, mb: 1.5, borderRadius: 2,
              bgcolor: alpha(theme.palette.background.default, 0.6),
              border: '0.5px solid', borderColor: 'divider',
            }}
          >
            <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 1.5 : 2}>

              {/* Next date */}
              <Stack direction="row" spacing={1} alignItems="flex-start" flex={1}>
                <InfoIconBox
                  bgcolor={alpha(theme.palette.success.main, 0.1)}
                  color="success.main"
                  size={isMobile ? 28 : 30}
                >
                  <TodayIcon sx={{ fontSize: isMobile ? 14 : 16 }} />
                </InfoIconBox>
                <Box>
                  <Typography variant="caption" color="text.disabled" display="block" sx={{ fontSize: '0.65rem' }}>
                    {isCompleted ? 'Series ended' : 'Next meeting'}
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    color={isCompleted ? 'warning.main' : 'text.primary'}
                    sx={{ fontSize: isMobile ? '0.8rem' : '0.875rem' }}
                  >
                    {hasNext
                      ? formatDate(meeting?.next_occurrence_date)
                      : isCompleted
                        ? lastOccurrence || 'Ended'
                        : 'No future dates'}
                  </Typography>
                </Box>
              </Stack>

              {/* Location */}
              <Stack direction="row" spacing={1} alignItems="flex-start" flex={1} sx={{ minWidth: 0 }}>
                <InfoIconBox
                  bgcolor={alpha(theme.palette.info.main, 0.1)}
                  color="info.main"
                  size={isMobile ? 28 : 30}
                >
                  {LocationIcon}
                </InfoIconBox>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" color="text.disabled" display="block" sx={{ fontSize: '0.65rem' }}>
                    Location
                  </Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight={500} 
                    noWrap 
                    title={locationLine}
                    sx={{ fontSize: isMobile ? '0.8rem' : '0.875rem' }}
                  >
                    {locationLine}
                  </Typography>
                </Box>
              </Stack>

            </Stack>
          </Paper>

          {/* Stats row */}
          {showStats && (
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: progressColor }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {completionPct !== null
                    ? `${totalGenerated} of ${maxOccurrences} (${completionPct}%)`
                    : `${totalGenerated} occurrence${totalGenerated !== 1 ? 's' : ''}`}
                </Typography>
              </Stack>

              {timeRange && (
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <ScheduleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {timeRange}
                  </Typography>
                </Stack>
              )}
            </Stack>
          )}

          {/* Expandable additional info - Always visible on mobile? No, collapsible */}
          <Button
            size="small"
            onClick={handleToggleExpand}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ 
              mt: 1.5, 
              textTransform: 'none', 
              color: 'text.secondary',
              '&:hover': { bgcolor: 'transparent' }
            }}
          >
            {expanded ? 'Show less' : 'More details'}
          </Button>
          
          <Collapse in={expanded}>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1.5}>
              {/* Creation date */}
              {createdDate && (
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <CalendarMonthIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">
                    Created: {createdDate}
                  </Typography>
                </Stack>
              )}
              
              {/* Last occurrence */}
              {lastOccurrence && (
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <AccessTimeIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">
                    Last occurrence: {lastOccurrence}
                  </Typography>
                </Stack>
              )}
              
              {/* End condition */}
              {meeting?.recurrence_end_date && (
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <TodayIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">
                    Ends on: {formatDate(meeting.recurrence_end_date)}
                  </Typography>
                </Stack>
              )}
              
              {/* Platform info */}
              {meeting?.platform && meeting.platform !== 'physical' && (
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <VideocamIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">
                    Platform: {meeting.platform}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Collapse>

          {/* Series-ended warning */}
          {!hasNext && status.key === 'active' && (
            <Stack direction="row" alignItems="center" spacing={0.75} mt={1.5}>
              <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
              <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.7rem' }}>
                Series has ended
              </Typography>
            </Stack>
          )}

          {/* Paused warning */}
          {isPaused && (
            <Stack direction="row" alignItems="center" spacing={0.75} mt={1.5}>
              <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
              <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.7rem' }}>
                Series is paused
              </Typography>
            </Stack>
          )}
        </CardContent>
      </CardActionArea>

      {/* ── Footer actions ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: isMobile ? 2 : 2.5,
          py: 1,
          borderTop: '0.5px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.default, 0.5),
        }}
      >
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit series">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onEdit(meeting?.id); }}
              sx={{ 
                borderRadius: 1.5, 
                p: isMobile ? 0.75 : 1,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } 
              }}
            >
              <EditIcon sx={{ fontSize: isMobile ? 18 : 20 }} />
            </IconButton>
          </Tooltip>

          {hasNext ? (
            <Tooltip title="Generate next occurrence">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onGenerate(meeting); }}
                sx={{ 
                  borderRadius: 1.5,
                  p: isMobile ? 0.75 : 1,
                  '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main' } 
                }}
              >
                <AddIcon sx={{ fontSize: isMobile ? 18 : 20 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Series completed">
              <IconButton size="small" disabled sx={{ borderRadius: 1.5, p: isMobile ? 0.75 : 1 }}>
                <CheckCircleIcon sx={{ fontSize: isMobile ? 18 : 20, opacity: 0.5 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        <Button
          size="small"
          endIcon={<ArrowForwardIcon sx={{ fontSize: isMobile ? '12px' : '14px' }} />}
          onClick={(e) => { e.stopPropagation(); onView(meeting?.id); }}
          sx={{
            fontWeight: 600,
            textTransform: 'none',
            fontSize: isMobile ? '0.75rem' : '0.8125rem',
            color: 'text.secondary',
            '&:hover': { bgcolor: 'transparent', color: 'primary.main' },
          }}
        >
          View {isMobile ? '' : 'series'}
        </Button>
      </Box>
    </Card>
  );
};

export default RecurringMeetingCard;