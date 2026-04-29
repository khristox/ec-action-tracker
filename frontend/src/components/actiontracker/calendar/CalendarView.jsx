// src/components/actiontracker/meetings/MeetingCalendar.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Alert,
  Skeleton,
  alpha,
  useTheme,
  useMediaQuery,
  Drawer,
  Card,
  CardContent,
  TextField,
  Fade,
  Grow,
  Snackbar,
  Divider,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Event as EventIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  CalendarMonth as CalendarMonthIcon,
  AccessTime as AccessTimeIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from '@mui/icons-material';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  isToday,
  parseISO,
} from 'date-fns';
import api from '../../../services/api';
import { useSelector as useAppSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

// ==================== Constants ====================
const CACHE_DURATION = 5 * 60 * 1000;
const CACHE_KEY = 'calendar_meetings_cache';

// ==================== Date Helpers ====================
/**
 * Safely parse any date value — handles ISO strings, Date objects, timestamps.
 * Returns null if unparseable.
 */
const safeDate = (value) => {
  if (!value) return null;
  try {
    // Already a Date
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    // ISO string or numeric string
    const d = typeof value === 'string' ? parseISO(value) : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const safeFormat = (value, fmt = 'h:mm a') => {
  const d = safeDate(value);
  if (!d) return '—';
  try { return format(d, fmt); } catch { return '—'; }
};

/**
 * PRIMARY FIX: resolve the canonical meeting date from whatever shape the API
 * returns.  Priority order:
 *   1. meeting_date   ← the correct field per MeetingReportResponse schema
 *   2. start_date     ← legacy / action-item wrapper
 *   3. date           ← fallback
 */
const getMeetingDate = (meeting) => {
  if (!meeting) return null;
  return safeDate(meeting.meeting_date)
      ?? safeDate(meeting.start_date)
      ?? safeDate(meeting.date);
};

const getStartTime = (meeting) => {
  if (!meeting) return null;
  return safeDate(meeting.start_time)
      ?? safeDate(meeting.start_date)
      ?? getMeetingDate(meeting);
};

const getEndTime = (meeting) => {
  if (!meeting) return null;
  return safeDate(meeting.end_time)
      ?? safeDate(meeting.end_date);
};

// ==================== Meeting Extraction ====================
/**
 * Normalise whatever the API returns into a flat meeting object.
 * Handles both direct meeting objects and action-item wrappers.
 */
const normaliseMeeting = (raw) => {
  if (!raw) return null;
  // Action-item wrapper: { meeting: {...}, description: '...' }
  const m = raw.meeting ?? raw;
  return {
    ...m,
    // Always expose a reliable _date field for the calendar
    _date: getMeetingDate(m),
    _startTime: getStartTime(m),
    _endTime: getEndTime(m),
    _title: (m.title || m.topic || 'Untitled Meeting').trim(),
    _actionDescription: raw.description ?? null,
  };
};

// ==================== Status Config ====================
const getStatusConfig = (status) => {
  let code = '';
  if (typeof status === 'string') code = status.toLowerCase();
  else if (status && typeof status === 'object')
    code = (status.code || status.short_name || status.name || '').toLowerCase();

  if (code.includes('ended') || code.includes('completed') || code.includes('closed') || code.includes('finished'))
    return { label: 'Ended',       color: 'success', dot: '#10B981' };
  if (code.includes('in_progress') || code.includes('ongoing') || code.includes('started'))
    return { label: 'In Progress', color: 'info',    dot: '#3B82F6' };
  if (code.includes('cancelled') || code.includes('canceled'))
    return { label: 'Cancelled',   color: 'error',   dot: '#EF4444' };
  if (code.includes('pending') || code.includes('awaiting'))
    return { label: 'Pending',     color: 'warning', dot: '#F59E0B' };

  return { label: 'Draft', color: 'default', dot: '#9CA3AF' };
};

// ==================== Cache ====================
const getCachedData = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts  = localStorage.getItem(`${CACHE_KEY}_time`);
    if (raw && ts && Date.now() - parseInt(ts) < CACHE_DURATION)
      return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
};

const setCachedData = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(`${CACHE_KEY}_time`, Date.now().toString());
  } catch { /* ignore */ }
};

// ==================== Day Cell ====================
const DayCell = React.memo(({ date, meetings, isCurrentMonth, onMeetingClick }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const today  = date ? isToday(date) : false;

  const dayMeetings = useMemo(() => {
    if (!date || !Array.isArray(meetings)) return [];
    return meetings.filter(m => m._date && isSameDay(m._date, date));
  }, [meetings, date]);

  if (!date) {
    return (
      <Box sx={{
        minHeight: { xs: 70, sm: 90 },
        border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
        bgcolor: isDark ? '#0F172A' : '#F8FAFC',
      }} />
    );
  }

  return (
    <Box
      sx={{
        minHeight: { xs: 70, sm: 90 },
        p: 0.5,
        position: 'relative',
        bgcolor: isCurrentMonth
          ? (isDark ? '#1F2937' : '#FFFFFF')
          : (isDark ? '#111827' : '#F9FAFB'),
        border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
        '&:hover': { bgcolor: alpha(isDark ? '#A78BFA' : '#7C3AED', 0.04) },
      }}
    >
      {/* Day number */}
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          top: 3,
          right: 5,
          fontWeight: today ? 700 : 400,
          fontSize: '0.72rem',
          minWidth: 20,
          textAlign: 'center',
          lineHeight: '20px',
          borderRadius: '50%',
          bgcolor: today ? '#F59E0B' : 'transparent',
          color: today ? '#FFFFFF' : (isCurrentMonth
            ? (isDark ? '#D1D5DB' : '#374151')
            : (isDark ? '#4B5563' : '#CBD5E1')),
        }}
      >
        {format(date, 'd')}
      </Typography>

      {/* Meeting pills */}
      {dayMeetings.length > 0 && (
        <Stack spacing={0.3} sx={{ mt: 2.5 }}>
          {dayMeetings.slice(0, 3).map((m, idx) => {
            const sc = getStatusConfig(m.status);
            const time = m._startTime ? format(m._startTime, 'HH:mm') : '—';
            return (
              <Tooltip key={m.id ?? idx} title={`${m._title} · ${sc.label}`} arrow>
                <Box
                  onClick={(e) => { e.stopPropagation(); onMeetingClick(m); }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    px: 0.6,
                    py: 0.25,
                    borderRadius: 0.75,
                    bgcolor: alpha(sc.dot, isDark ? 0.2 : 0.12),
                    borderLeft: `2.5px solid ${sc.dot}`,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(sc.dot, 0.28) },
                    overflow: 'hidden',
                  }}
                >
                  <Typography
                    component="span"
                    sx={{ fontSize: '0.65rem', fontWeight: 600, color: sc.dot, flexShrink: 0, lineHeight: 1.4 }}
                  >
                    {time}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '0.65rem',
                      color: isDark ? '#D1D5DB' : '#374151',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.4,
                    }}
                  >
                    {m._title}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
          {dayMeetings.length > 3 && (
            <Typography
              variant="caption"
              sx={{ fontSize: '0.62rem', color: 'text.secondary', pl: 0.5, lineHeight: 1.4 }}
            >
              +{dayMeetings.length - 3} more
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  );
});
DayCell.displayName = 'DayCell';

// ==================== Meeting Detail Drawer ====================
const MeetingDetailDrawer = React.memo(({ meeting, open, onClose, onViewFull }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!meeting) return null;

  const sc = getStatusConfig(meeting.status);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          bgcolor: isDark ? '#1F2937' : '#FFFFFF',
          borderLeft: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
        },
      }}
    >
      <Box sx={{ p: 2.5 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1, pr: 1, color: isDark ? '#FFFFFF' : '#111827' }}>
            {meeting._title}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Chip
          size="small"
          label={sc.label}
          color={sc.color}
          sx={{ mb: 2, fontWeight: 600, fontSize: '0.72rem' }}
        />

        <Divider sx={{ mb: 2 }} />

        {/* Date */}
        <Stack spacing={1.5}>
          {meeting._date && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <EventIcon sx={{ fontSize: 16, color: isDark ? '#A78BFA' : '#7C3AED', flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Date</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {format(meeting._date, 'EEEE, d MMMM yyyy')}
                </Typography>
              </Box>
            </Stack>
          )}

          {/* Time */}
          {meeting._startTime && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 16, color: isDark ? '#A78BFA' : '#7C3AED', flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Time</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {format(meeting._startTime, 'HH:mm')}
                  {meeting._endTime ? ` – ${format(meeting._endTime, 'HH:mm')}` : ''}
                </Typography>
              </Box>
            </Stack>
          )}

          {/* Location */}
          {(meeting.location_text || meeting.venue || meeting.location) && (
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <LocationIcon sx={{ fontSize: 16, color: isDark ? '#A78BFA' : '#7C3AED', flexShrink: 0, mt: 0.25 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Location</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {meeting.location_text || meeting.venue || meeting.location}
                </Typography>
              </Box>
            </Stack>
          )}

          {/* Chairperson */}
          {meeting.chairperson_name && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <PersonIcon sx={{ fontSize: 16, color: isDark ? '#A78BFA' : '#7C3AED', flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Chairperson</Typography>
                <Typography variant="body2" fontWeight={500}>{meeting.chairperson_name}</Typography>
              </Box>
            </Stack>
          )}

          {/* Secretary */}
          {meeting.facilitator && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <PersonIcon sx={{ fontSize: 16, color: isDark ? '#A78BFA' : '#7C3AED', flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Secretary</Typography>
                <Typography variant="body2" fontWeight={500}>{meeting.facilitator}</Typography>
              </Box>
            </Stack>
          )}

          {/* Description */}
          {meeting.description && (
            <>
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Description</Typography>
                <Typography variant="body2" sx={{ color: isDark ? '#D1D5DB' : '#374151', lineHeight: 1.6 }}>
                  {meeting.description.length > 200
                    ? `${meeting.description.substring(0, 200)}…`
                    : meeting.description}
                </Typography>
              </Box>
            </>
          )}
        </Stack>

        <Button
          variant="contained"
          fullWidth
          onClick={onViewFull}
          endIcon={<ArrowForwardIcon />}
          sx={{
            mt: 3,
            bgcolor: '#7C3AED',
            '&:hover': { bgcolor: '#6D28D9' },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          View Full Meeting Details
        </Button>
      </Box>
    </Drawer>
  );
});
MeetingDetailDrawer.displayName = 'MeetingDetailDrawer';

// ==================== Loading Skeleton ====================
const LoadingSkeleton = () => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Stack spacing={2} sx={{ p: 3 }}>
      <Skeleton variant="rectangular" height={80}  sx={{ borderRadius: 2, bgcolor: isDark ? '#374151' : undefined }} />
      <Skeleton variant="rectangular" height={48}  sx={{ borderRadius: 2, bgcolor: isDark ? '#374151' : undefined }} />
      <Skeleton variant="rectangular" height={460} sx={{ borderRadius: 2, bgcolor: isDark ? '#374151' : undefined }} />
    </Stack>
  );
};

// ==================== Empty State ====================
const EmptyState = ({ searchTerm, onClearSearch }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Fade in timeout={400}>
      <Paper sx={{
        p: 6, textAlign: 'center', borderRadius: 3,
        bgcolor: isDark ? '#1F2937' : '#FFFFFF',
        border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
      }}>
        <EventIcon sx={{ fontSize: 64, color: isDark ? '#4B5563' : '#D1D5DB', mb: 2 }} />
        <Typography variant="h6" gutterBottom sx={{ color: isDark ? '#FFFFFF' : '#374151' }}>
          {searchTerm ? `No results for "${searchTerm}"` : 'No meetings this month'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {searchTerm
            ? 'Try a different search term.'
            : 'Navigate to another month or check back later.'}
        </Typography>
        {searchTerm && (
          <Button size="small" startIcon={<CloseIcon />} onClick={onClearSearch} sx={{ mt: 2 }}>
            Clear Search
          </Button>
        )}
      </Paper>
    </Fade>
  );
};

// ==================== Main Component ====================
const MeetingCalendar = ({ userId }) => {
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark  = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const currentUser = useAppSelector(state => state.auth?.user);
  const currentUserEmail = currentUser?.email;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [meetings, setMeetings]       = useState([]);   // normalised
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState(null);
  const [searchTerm, setSearchTerm]   = useState('');
  const [selected, setSelected]       = useState(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);

  const abortRef = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchMeetings = useCallback(async (forceRefresh = false) => {
    if (!currentUserEmail) { setLoading(false); return; }

    // Serve cache immediately, still refresh in background
    if (!forceRefresh) {
      const cached = getCachedData();
      if (cached?.length) {
        setMeetings(cached.map(normaliseMeeting));
        setLoading(false);
      }
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRefreshing(true);
    setError(null);

    try {
      const response = await api.get('/action-tracker/meetings/participant/action-items', {
        params: {
          email: currentUserEmail,
          upcoming_only: false,
          overdue_only: false,
          include_completed: true,
          limit: 200,
        },
        signal: abortRef.current.signal,
      });

      // ── Normalise response shape ──
      let raw = [];
      if (response.data?.action_items) raw = response.data.action_items;
      else if (Array.isArray(response.data)) raw = response.data;

      // De-duplicate by meeting ID
      const seen = new Map();
      raw.forEach(item => {
        const m = normaliseMeeting(item);
        if (m && m.id && !seen.has(m.id)) seen.set(m.id, m);
        else if (m && !m.id) seen.set(Symbol(), m); // no ID — keep anyway
      });

      const list = Array.from(seen.values());
      setMeetings(list);
      setCachedData(list);
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.error('Calendar fetch error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load meetings.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    fetchMeetings();
    return () => abortRef.current?.abort();
  }, [fetchMeetings]);

  // ── Calendar helpers ───────────────────────────────────────
  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  }, [currentDate]);

  // Leading empty cells so the grid starts on the correct weekday (Mon = 0)
  const leadingEmpties = useMemo(() => {
    const dow = getDay(startOfMonth(currentDate)); // 0=Sun
    return dow === 0 ? 6 : dow - 1;
  }, [currentDate]);

  // ── Filtered meetings ──────────────────────────────────────
  const filteredMeetings = useMemo(() => {
    if (!searchTerm) return meetings;
    const t = searchTerm.toLowerCase();
    return meetings.filter(m =>
      m._title.toLowerCase().includes(t) ||
      (m.location_text || m.venue || m.location || '').toLowerCase().includes(t) ||
      (m.description || '').toLowerCase().includes(t)
    );
  }, [meetings, searchTerm]);

  // ── Stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: filteredMeetings.length,
      today: filteredMeetings.filter(m => m._date && isSameDay(m._date, now)).length,
      upcoming: filteredMeetings.filter(m => m._date && m._date > now).length,
      thisMonth: filteredMeetings.filter(m => m._date && isSameMonth(m._date, currentDate)).length,
    };
  }, [filteredMeetings, currentDate]);

  // ── Handlers ───────────────────────────────────────────────
  const handleMeetingClick = (m) => { setSelected(m); setDrawerOpen(true); };
  const handleViewFull = () => {
    if (selected?.id) {
      setDrawerOpen(false);
      navigate(`/meetings/${selected.id}`);
    }
  };

  // ── Early returns ──────────────────────────────────────────
  if (loading) return <LoadingSkeleton />;

  if (error && meetings.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={<Button size="small" onClick={() => fetchMeetings(true)}>Retry</Button>}>
          {error}
        </Alert>
      </Box>
    );
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <Box sx={{ p: isMobile ? 1.5 : 2.5 }}>

      {/* ── Header ── */}
      <Paper elevation={0} sx={{
        px: 2, py: 1.5, mb: 2, borderRadius: 2,
        bgcolor: isDark ? '#1F2937' : '#FFFFFF',
        border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
      }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5}>
          {/* Title + stats chips */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.5}>
            <CalendarMonthIcon sx={{ color: isDark ? '#A78BFA' : '#7C3AED', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: isDark ? '#FFFFFF' : '#111827' }}>
              My Meetings Calendar
            </Typography>
            <Chip size="small" label={`${stats.total} total`} sx={{ height: 20, fontSize: '0.68rem', bgcolor: alpha('#7C3AED', 0.12), color: '#7C3AED', fontWeight: 600 }} />
            {stats.today > 0 && <Chip size="small" label={`${stats.today} today`} color="warning" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }} />}
            {stats.thisMonth > 0 && <Chip size="small" label={`${stats.thisMonth} this month`} variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />}
          </Stack>

          {/* Search + refresh */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <TextField
              size="small"
              placeholder="Search…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: isMobile ? 140 : 180 }}
              InputProps={{
                sx: { fontSize: '0.8rem', height: 32 },
                startAdornment: <SearchIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.disabled' }} />,
                endAdornment: searchTerm
                  ? <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setSearchTerm('')}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
                  : null,
              }}
            />
            <Tooltip title={refreshing ? 'Refreshing…' : 'Refresh'}>
              <span>
                <IconButton size="small" onClick={() => fetchMeetings(true)} disabled={refreshing}>
                  <RefreshIcon fontSize="small" sx={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* ── Month navigator ── */}
      <Paper elevation={0} sx={{
        px: 1.5, py: 0.75, mb: 2, borderRadius: 2,
        bgcolor: isDark ? '#1F2937' : '#FFFFFF',
        border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton size="small" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography variant="subtitle1" fontWeight={700} sx={{ minWidth: 140, textAlign: 'center', color: isDark ? '#FFFFFF' : '#111827' }}>
              {format(currentDate, 'MMMM yyyy')}
            </Typography>
            <IconButton size="small" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Button
            size="small"
            startIcon={<TodayIcon sx={{ fontSize: 15 }} />}
            onClick={() => setCurrentDate(new Date())}
            sx={{ textTransform: 'none', fontSize: '0.75rem', height: 28, px: 1.5 }}
          >
            Today
          </Button>
        </Stack>
      </Paper>

      {/* ── Calendar grid ── */}
      {filteredMeetings.length > 0 || daysInMonth.length > 0 ? (
        <Paper elevation={0} sx={{
          borderRadius: 2, overflow: 'hidden',
          bgcolor: isDark ? '#1F2937' : '#FFFFFF',
          border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
        }}>
          {/* Weekday labels */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${isDark ? '#374151' : '#E5E7EB'}` }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <Box key={day} sx={{ py: 1, textAlign: 'center', bgcolor: isDark ? '#111827' : '#F9FAFB' }}>
                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.7rem', color: isDark ? '#9CA3AF' : '#6B7280' }}>
                  {isMobile ? day[0] : day}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Day cells */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {/* Leading empties */}
            {Array.from({ length: leadingEmpties }).map((_, i) => (
              <DayCell key={`e-${i}`} date={null} meetings={[]} isCurrentMonth={false} onMeetingClick={() => {}} />
            ))}
            {/* Actual days */}
            {daysInMonth.map(day => (
              <DayCell
                key={day.toISOString()}
                date={day}
                meetings={filteredMeetings}
                isCurrentMonth={isSameMonth(day, currentDate)}
                onMeetingClick={handleMeetingClick}
              />
            ))}
          </Box>
        </Paper>
      ) : (
        <EmptyState searchTerm={searchTerm} onClearSearch={() => setSearchTerm('')} />
      )}

      {/* ── Detail Drawer ── */}
      <MeetingDetailDrawer
        meeting={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onViewFull={handleViewFull}
      />

      {/* ── Error Snackbar ── */}
      <Snackbar open={!!error && meetings.length > 0} autoHideDuration={5000} onClose={() => setError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="warning" variant="filled" onClose={() => setError(null)} sx={{ fontSize: '0.8rem' }}>
          {error}
        </Alert>
      </Snackbar>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Box>
  );
};

export default MeetingCalendar;