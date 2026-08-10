// src/components/actiontracker/meetings/components/RecurringMeetingCard.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Card, CardContent, CardActionArea, Stack, Typography,
  Chip, IconButton, Tooltip, Button, Paper, alpha, LinearProgress,
  useMediaQuery, useTheme, Divider, Collapse, Drawer, AppBar, Toolbar,
} from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import Add from '@mui/icons-material/Add';
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
import Close from '@mui/icons-material/Close';
import api from '../../../../services/api';
import { formatDate, getRecurrenceDescription } from '../utils/helpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStatus = (meeting) => {
  const isActive = meeting?.status === 'active';
  const hasNext = !!meeting?.next_occurrence_date;
  if (!isActive) return { key: 'inactive', label: 'Paused', color: 'warning', icon: <WarningAmberIcon sx={{ fontSize: 14 }} /> };
  if (!hasNext) return { key: 'completed', label: 'Completed', color: 'info', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> };
  return { key: 'active', label: 'Active', color: 'success', icon: <RepeatIcon sx={{ fontSize: 14 }} /> };
};

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

const formatTimeRange = (start, end) => {
  if (!start && !end) return null;
  const startTime = start ? new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const endTime = end ? new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  if (startTime && endTime) return `${startTime} – ${endTime}`;
  if (startTime) return startTime;
  return null;
};

const InfoIconBox = ({ children, bgcolor, color, size = 30 }) => (
  <Box sx={{
    width: size, height: size, borderRadius: 1.5, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    bgcolor, color,
  }}>
    {children}
  </Box>
);

// ─── Mobile Detail Drawer ─────────────────────────────────────────────────────
const MobileDetailDrawer = ({ open, onClose, meeting, onView, onEdit, onGenerate, status, locationLine, LocationIcon, timeRange, completionPct, totalGenerated, maxOccurrences, progressColor, createdDate, lastOccurrence, hasNext, isPaused, isCompleted, recurrenceInterval }) => {
  const theme = useTheme();

  // Wrapper for onView that passes the recurring-meetings source
  const handleView = useCallback(() => {
    onClose();
    onView(meeting?.id);
  }, [onClose, onView, meeting?.id]);

  // Wrapper for onEdit that passes the recurring-meetings source
  const handleEdit = useCallback(() => {
    onClose();
    onEdit(meeting?.id);
  }, [onClose, onEdit, meeting?.id]);

  // Wrapper for onGenerate
  const handleGenerate = useCallback(() => {
    onClose();
    onGenerate(meeting);
  }, [onClose, onGenerate, meeting]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '92vh',
          pb: 'env(safe-area-inset-bottom)',
        }
      }}
    >
      {/* Drag handle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
      </Box>

      {/* Header */}
      <Box sx={{ px: 2.5, pt: 1.5, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={0.75} flexWrap="wrap">
              <Chip
                size="small"
                color={status.color}
                icon={status.icon}
                label={status.label}
                sx={{ fontWeight: 600, borderRadius: 1.5, height: 24 }}
              />
              <Typography variant="caption" sx={{ border: '0.5px solid', borderColor: 'divider', borderRadius: 20, px: 1, py: 0.25 }}>
                {totalGenerated} generated
              </Typography>
            </Stack>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>
              {meeting?.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {getRecurrenceDescription(meeting)} · Every {recurrenceInterval} week{recurrenceInterval !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ mt: -0.5 }}>
            <Close />
          </IconButton>
        </Stack>
      </Box>

      {/* Scrollable content */}
      <Box sx={{ overflowY: 'auto', px: 2.5, py: 2, flex: 1 }}>
        {/* Progress bar */}
        {completionPct !== null && (
          <Box sx={{ mb: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" mb={0.75}>
              <Typography variant="caption" color="text.secondary">Progress</Typography>
              <Typography variant="caption" fontWeight={600}>{completionPct}%</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={completionPct}
              sx={{
                height: 6, borderRadius: 3,
                bgcolor: alpha(progressColor, 0.15),
                '& .MuiLinearProgress-bar': { bgcolor: progressColor, borderRadius: 3 },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {totalGenerated} of {maxOccurrences} occurrences
            </Typography>
          </Box>
        )}

        {/* Info cards */}
        <Stack spacing={1.5} mb={2.5}>
          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <InfoIconBox bgcolor={alpha(theme.palette.success.main, 0.1)} color="success.main" size={36}>
                <TodayIcon sx={{ fontSize: 18 }} />
              </InfoIconBox>
              <Box>
                <Typography variant="caption" color="text.disabled" display="block">
                  {isCompleted ? 'Series ended' : 'Next meeting'}
                </Typography>
                <Typography variant="body2" fontWeight={600} color={isCompleted ? 'warning.main' : 'text.primary'}>
                  {hasNext ? formatDate(meeting?.next_occurrence_date) : isCompleted ? lastOccurrence || 'Ended' : 'No future dates'}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <InfoIconBox bgcolor={alpha(theme.palette.info.main, 0.1)} color="info.main" size={36}>
                {LocationIcon}
              </InfoIconBox>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.disabled" display="block">Location</Typography>
                <Typography variant="body2" fontWeight={500} noWrap>{locationLine}</Typography>
              </Box>
            </Stack>
          </Paper>

          {timeRange && (
            <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <InfoIconBox bgcolor={alpha(theme.palette.primary.main, 0.1)} color="primary.main" size={36}>
                  <ScheduleIcon sx={{ fontSize: 18 }} />
                </InfoIconBox>
                <Box>
                  <Typography variant="caption" color="text.disabled" display="block">Time</Typography>
                  <Typography variant="body2" fontWeight={500}>{timeRange}</Typography>
                </Box>
              </Stack>
            </Paper>
          )}
        </Stack>

        {/* Additional details */}
        <Typography variant="overline" color="text.disabled" sx={{ letterSpacing: 1.5, fontSize: '0.65rem' }}>
          Details
        </Typography>
        <Stack spacing={1.25} mt={1} mb={3}>
          {createdDate && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CalendarMonthIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">Created: <strong>{createdDate}</strong></Typography>
            </Stack>
          )}
          {lastOccurrence && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">Last occurrence: <strong>{lastOccurrence}</strong></Typography>
            </Stack>
          )}
          {meeting?.recurrence_end_date && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TodayIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">Ends on: <strong>{formatDate(meeting.recurrence_end_date)}</strong></Typography>
            </Stack>
          )}
          {meeting?.platform && meeting.platform !== 'physical' && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <VideocamIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">Platform: <strong>{meeting.platform}</strong></Typography>
            </Stack>
          )}
        </Stack>

        {/* Warnings */}
        {(!hasNext && status.key === 'active') && (
          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.08), border: '1px solid', borderColor: alpha(theme.palette.warning.main, 0.25), mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="body2" color="warning.main" fontWeight={500}>Series has ended</Typography>
            </Stack>
          </Paper>
        )}
        {isPaused && (
          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.08), border: '1px solid', borderColor: alpha(theme.palette.warning.main, 0.25), mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="body2" color="warning.main" fontWeight={500}>Series is paused</Typography>
            </Stack>
          </Paper>
        )}
      </Box>

      {/* Sticky actions */}
      <Box sx={{
        px: 2.5, py: 2, borderTop: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 1,
      }}>
        <Button
          variant="outlined"
          startIcon={<Edit />}
          onClick={handleEdit}
          fullWidth
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Edit
        </Button>
        <Button
          variant="outlined"
          color="success"
          startIcon={<Add />}
          onClick={handleGenerate}
          disabled={!hasNext}
          fullWidth
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Generate
        </Button>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={handleView}
          fullWidth
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          View
        </Button>
      </Box>
    </Drawer>
  );
};

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

  const [locationDetails, setLocationDetails] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!meeting?.location_id || locationDetails || locLoading) return;
    let cancelled = false;
    const fetchLoc = async () => {
      setLocLoading(true);
      try {
        const res = await api.get(`/locations/${meeting.location_id}`);
        if (!cancelled) setLocationDetails(res.data?.data || res.data);
      } catch { /* keep null */ }
      finally { if (!cancelled) setLocLoading(false); }
    };
    fetchLoc();
    return () => { cancelled = true; };
  }, [meeting?.location_id]);

  // ── Derived values ─────────────────────────────────────────────────────────
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
  const createdDate = meeting?.created_at ? formatDate(meeting.created_at) : null;
  const lastOccurrence = meeting?.last_occurrence_date ? formatDate(meeting.last_occurrence_date) : null;
  const recurrenceInterval = meeting?.recurrence_interval || 1;
  const progressColor = isCompleted ? theme.palette.info.main : theme.palette.success.main;

  // ── Event Handlers ────────────────────────────────────────────────────────
  
  /**
   * Handle card click - opens drawer on mobile, navigates on desktop
   * Passes 'recurring-meetings' as the source via navigation state
   */
  const handleCardClick = () => {
    if (isMobile) {
      setDrawerOpen(true);
    } else {
      // Desktop: navigate with state indicating source
      onView(meeting?.id);
    }
  };

  /**
   * Handle "View series" button click - passes 'recurring-meetings' as source
   */
  const handleViewClick = (e) => {
    if (e) e.stopPropagation();
    onView(meeting?.id);
  };

  /**
   * Handle "Edit" button click - passes 'recurring-meetings' as source
   */
  const handleEditClick = (e) => {
    if (e) e.stopPropagation();
    onEdit(meeting?.id);
  };

  /**
   * Handle "Generate" button click
   */
  const handleGenerateClick = (e) => {
    if (e) e.stopPropagation();
    onGenerate(meeting);
  };

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

  const drawerProps = {
    open: drawerOpen,
    onClose: () => setDrawerOpen(false),
    meeting, 
    onView: handleViewClick,  // Pass the wrapped handler
    onEdit: handleEditClick,  // Pass the wrapped handler
    onGenerate: handleGenerateClick,
    status, locationLine, LocationIcon, timeRange,
    completionPct, totalGenerated, maxOccurrences, progressColor,
    createdDate, lastOccurrence, hasNext, isPaused, isCompleted,
    recurrenceInterval,
  };

  return (
    <>
      {/* Mobile bottom sheet */}
      {isMobile && <MobileDetailDrawer {...drawerProps} />}

      <Card
        elevation={0}
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: isMobile ? 2.5 : 3,
          border: `1px solid ${borderColor}`,
          bgcolor: accentBg,
          opacity: isCompleted ? 0.85 : 1,
          transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
          overflow: 'hidden',
          '&:hover': {
            borderColor: theme.palette[status.color]?.main,
            transform: isMobile ? 'none' : 'translateY(-4px)',
            boxShadow: isMobile ? theme.shadows[2] : theme.shadows[6],
          },
        }}
      >
        {/* Progress bar */}
        {completionPct !== null && showStats && (
          <LinearProgress
            variant="determinate"
            value={completionPct}
            sx={{
              height: 3,
              bgcolor: alpha(progressColor, 0.15),
              '& .MuiLinearProgress-bar': { bgcolor: progressColor },
            }}
          />
        )}

        {/* Clickable body */}
        <CardActionArea onClick={handleCardClick} sx={{ flexGrow: 1, alignItems: 'flex-start' }}>
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
              <Typography variant="caption" sx={{
                border: '0.5px solid', borderColor: 'divider',
                borderRadius: 20, px: 1, py: 0.25,
                bgcolor: alpha(theme.palette.background.paper, 0.5)
              }}>
                {totalGenerated} generated
              </Typography>
            </Stack>

            {/* Title */}
            <Typography
              variant="body1"
              fontWeight={700}
              mb={0.75}
              sx={{
                lineHeight: 1.35,
                fontSize: isMobile ? '1rem' : '1.05rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {meeting?.title}
            </Typography>

            {/* Recurrence */}
            <Stack direction="row" alignItems="center" spacing={0.75} mb={1.5}>
              <RepeatIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {getRecurrenceDescription(meeting)} · Every {recurrenceInterval} week{recurrenceInterval !== 1 ? 's' : ''}
              </Typography>
            </Stack>

            {/* Info panel */}
            <Paper elevation={0} sx={{
              px: 1.5, py: 1.25, mb: 1.5, borderRadius: 2,
              bgcolor: alpha(theme.palette.background.default, 0.6),
              border: '0.5px solid', borderColor: 'divider',
            }}>
              <Stack direction="column" spacing={1.25}>
                {/* Next date */}
                <Stack direction="row" spacing={1} alignItems="center">
                  <InfoIconBox bgcolor={alpha(theme.palette.success.main, 0.1)} color="success.main" size={28}>
                    <TodayIcon sx={{ fontSize: 14 }} />
                  </InfoIconBox>
                  <Box>
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                      {isCompleted ? 'Series ended' : 'Next meeting'}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} color={isCompleted ? 'warning.main' : 'text.primary'} sx={{ fontSize: '0.825rem' }}>
                      {hasNext ? formatDate(meeting?.next_occurrence_date) : isCompleted ? lastOccurrence || 'Ended' : 'No future dates'}
                    </Typography>
                  </Box>
                </Stack>

                {/* Location */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <InfoIconBox bgcolor={alpha(theme.palette.info.main, 0.1)} color="info.main" size={28}>
                    {LocationIcon}
                  </InfoIconBox>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                      Location
                    </Typography>
                    <Typography variant="body2" fontWeight={500} noWrap title={locationLine} sx={{ fontSize: '0.825rem' }}>
                      {locationLine}
                    </Typography>
                  </Box>
                </Stack>

                {/* Time (if available) */}
                {timeRange && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <InfoIconBox bgcolor={alpha(theme.palette.primary.main, 0.1)} color="primary.main" size={28}>
                      <ScheduleIcon sx={{ fontSize: 14 }} />
                    </InfoIconBox>
                    <Box>
                      <Typography variant="caption" color="text.disabled" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                        Time
                      </Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.825rem' }}>
                        {timeRange}
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Stack>
            </Paper>

            {/* Stats row — desktop only */}
            {showStats && !isMobile && (
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: progressColor }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {completionPct !== null
                      ? `${totalGenerated} of ${maxOccurrences} (${completionPct}%)`
                      : `${totalGenerated} occurrence${totalGenerated !== 1 ? 's' : ''}`}
                  </Typography>
                </Stack>
              </Stack>
            )}

            {/* Tap hint on mobile */}
            {isMobile && (
              <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', fontSize: '0.65rem' }}>
                Tap for details & actions
              </Typography>
            )}

            {/* Warnings */}
            {(!hasNext && status.key === 'active') && (
              <Stack direction="row" alignItems="center" spacing={0.75} mt={1.5}>
                <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.7rem' }}>Series has ended</Typography>
              </Stack>
            )}
            {isPaused && (
              <Stack direction="row" alignItems="center" spacing={0.75} mt={1.5}>
                <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.7rem' }}>Series is paused</Typography>
              </Stack>
            )}
          </CardContent>
        </CardActionArea>

        {/* Footer actions — desktop only */}
        {!isMobile && (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5, py: 1,
            borderTop: '0.5px solid', borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.default, 0.5),
          }}>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Edit series">
                <IconButton
                  size="small"
                  onClick={handleEditClick}
                  sx={{ borderRadius: 1.5, p: 1, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}
                >
                  <Edit sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              {hasNext ? (
                <Tooltip title="Generate next occurrence">
                  <IconButton
                    size="small"
                    onClick={handleGenerateClick}
                    sx={{ borderRadius: 1.5, p: 1, '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main' } }}
                  >
                    <Add sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Series completed">
                  <IconButton size="small" disabled sx={{ borderRadius: 1.5, p: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 20, opacity: 0.5 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            <Button
              size="small"
              endIcon={<ArrowForwardIcon sx={{ fontSize: '14px' }} />}
              onClick={handleViewClick}
              sx={{
                fontWeight: 600, textTransform: 'none', fontSize: '0.8125rem',
                color: 'text.secondary',
                '&:hover': { bgcolor: 'transparent', color: 'primary.main' },
              }}
            >
              View series
            </Button>
          </Box>
        )}
      </Card>
    </>
  );
};

export default RecurringMeetingCard;