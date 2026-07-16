// src/components/meetings/components/MeetingOverviewTab.jsx
//
// Renders the meeting's "what, where, when, who" — date/time, location or
// platform (with the agenda collapsed inline underneath), and chairperson/
// secretary. This used to live in a permanently-visible card at the top of
// MeetingDetail; it's now its own tab so the title/status bar can stay slim
// and always-visible while this content only renders when the tab is open.
import React, { useState, useEffect, memo } from 'react';
import {
  Box,
  Grid,
  Stack,
  Typography,
  Avatar,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Chip,
  Breadcrumbs,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon,
  VideoCall as VideoCallIcon,
  Link as LinkIcon,
  Update as UpdateIcon,
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  Apartment as ApartmentIcon,
  MeetingRoom as MeetingRoomIcon,
  EventSeat as EventSeatIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import api from '../../../../services/api';

// Kept in sync with the DARK palette in MeetingDetail.jsx. Duplicated rather
// than imported so this file stays a self-contained drop-in tab.
const DARK = {
  bg: '#0B0B0D',
  surface: '#161618',
  surfaceAlt: '#1D1D20',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  textSecondary: '#A3A3AA',
};

const AGENDA_COLLAPSED_HEIGHT = 72;
const AGENDA_EXPANDED_MAX_HEIGHT = 2000;

// ==================== Location level configurations ====================
const LOCATION_LEVELS = {
  1:  { name: 'Country',    icon: <PublicIcon fontSize="small" />,      color: '#4CAF50' },
  2:  { name: 'Region',     icon: <FlagIcon fontSize="small" />,        color: '#2196F3' },
  3:  { name: 'District',   icon: <TerrainIcon fontSize="small" />,     color: '#9C27B0' },
  4:  { name: 'County',     icon: <BusinessIcon fontSize="small" />,    color: '#FF9800' },
  5:  { name: 'Subcounty',  icon: <HomeIcon fontSize="small" />,        color: '#795548' },
  6:  { name: 'Parish',     icon: <LocationIcon fontSize="small" />,    color: '#607D8B' },
  7:  { name: 'Village',    icon: <HomeIcon fontSize="small" />,        color: '#8BC34A' },
  11: { name: 'Office',     icon: <ApartmentIcon fontSize="small" />,   color: '#E91E63' },
  12: { name: 'Building',   icon: <BusinessIcon fontSize="small" />,    color: '#3F51B5' },
  13: { name: 'Room',       icon: <MeetingRoomIcon fontSize="small" />, color: '#009688' },
  14: { name: 'Conference', icon: <EventSeatIcon fontSize="small" />,   color: '#673AB7' },
};

const getLevelInfo = (level) => LOCATION_LEVELS[level] || { name: `Level ${level}`, icon: <LocationIcon fontSize="small" />, color: '#7C3AED' };

// ==================== Helper Functions ====================
const formatDate = (dateString) => {
  if (!dateString) return 'Date not set';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return 'Invalid date'; }
};

const formatTime = (dateString) => {
  if (!dateString) return 'Time not set';
  try {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return 'Invalid time'; }
};

const isAgendaEmpty = (agenda) => !agenda || agenda.trim() === '' || agenda === '<p></p>';

// ==================== CTE Location Display Component ====================
const CTELocationDisplay = memo(({ locationId, locationData }) => {
  const [locationHierarchy, setLocationHierarchy] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLocationHierarchy = async () => {
      if (!locationId && !locationData) { setLocationHierarchy([]); return; }
      setLoading(true);
      try {
        if (locationData && locationData.ancestors) {
          setLocationHierarchy([...locationData.ancestors, locationData]);
          setLoading(false);
          return;
        }
        const [locationRes, ancestorsRes] = await Promise.all([
          api.get(`/locations/${locationId}`),
          api.get(`/locations/${locationId}/ancestors`),
        ]);
        setLocationHierarchy([...(ancestorsRes.data || []), locationRes.data]);
      } catch (err) {
        console.error('Error loading location hierarchy:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLocationHierarchy();
  }, [locationId, locationData]);

  if (loading) return <Skeleton variant="rounded" width={200} height={32} />;
  if (locationHierarchy.length === 0) {
    return <Typography variant="body2" color="text.secondary">{locationData?.name || 'Location not specified'}</Typography>;
  }

  return (
    <Stack spacing={1}>
      <Breadcrumbs separator={<ChevronRightIcon sx={{ fontSize: 14 }} />} sx={{ flexWrap: 'wrap' }}>
        {locationHierarchy.map((item, index) => {
          const levelInfo = getLevelInfo(item.level);
          const isLast = index === locationHierarchy.length - 1;
          return (
            <Chip
              key={item.id}
              label={item.name}
              size="small"
              icon={levelInfo.icon}
              sx={{
                bgcolor: alpha(levelInfo.color, 0.1),
                borderColor: levelInfo.color,
                color: levelInfo.color,
                border: '1px solid',
                fontWeight: isLast ? 700 : 500,
                ...(isLast && { bgcolor: alpha(levelInfo.color, 0.2) }),
              }}
            />
          );
        })}
      </Breadcrumbs>
    </Stack>
  );
});
CTELocationDisplay.displayName = 'CTELocationDisplay';

// ==================== Rich Text Content Component ====================
const RichTextContent = memo(({ content }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  if (isAgendaEmpty(content)) {
    return (
      <Typography variant="body2" sx={{ fontStyle: 'italic', color: isDarkMode ? DARK.textSecondary : 'text.secondary' }}>
        No agenda provided.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        color: isDarkMode ? '#EDEDEF' : 'inherit',
        '& p': { marginBottom: '12px', lineHeight: 1.7 },
        '& p:last-child': { marginBottom: 0 },
        '& ul, & ol': { paddingLeft: '24px', marginBottom: '12px' },
        '& li': { marginBottom: '6px' },
        '& h1, & h2, & h3': { margin: '16px 0 8px 0', fontWeight: 600 },
        '& blockquote': {
          borderLeft: '4px solid #7C3AED',
          paddingLeft: '16px',
          fontStyle: 'italic',
          margin: '16px 0',
        },
        '& a': { color: '#A78BFA', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
        '& strong, & b': { fontWeight: 700 },
        '& img': { maxWidth: '100%', borderRadius: '8px' },
        '& table': { borderCollapse: 'collapse', width: '100%', marginBottom: '12px' },
        '& th, & td': { border: `1px solid ${isDarkMode ? DARK.border : '#E5E7EB'}`, padding: '6px 10px' },
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
});
RichTextContent.displayName = 'RichTextContent';

// ==================== Agenda Section (compact, inline — lives inside the Location block) ====================
const AgendaSection = memo(({ agenda }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const contentRef = React.useRef(null);

  const hasAgenda = !isAgendaEmpty(agenda);

  useEffect(() => {
    if (!hasAgenda || !contentRef.current) return;
    setNeedsToggle(contentRef.current.scrollHeight > AGENDA_COLLAPSED_HEIGHT + 8);
  }, [agenda, hasAgenda]);

  if (!hasAgenda) return null;

  const cardBg = isDarkMode ? DARK.surface : '#FFFFFF';

  return (
    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${isDarkMode ? DARK.border : '#E5E7EB'}` }}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
        <DescriptionIcon sx={{ fontSize: 14, color: isDarkMode ? DARK.textSecondary : 'text.secondary' }} />
        <Typography
          variant="caption"
          fontWeight={600}
          color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: 0.4, fontSize: '0.66rem' }}
        >
          Agenda
        </Typography>
      </Stack>

      <Box sx={{ position: 'relative' }}>
        <Box
          ref={contentRef}
          sx={{
            maxHeight: expanded ? AGENDA_EXPANDED_MAX_HEIGHT : AGENDA_COLLAPSED_HEIGHT,
            overflow: 'hidden',
            transition: 'max-height 0.3s ease',
            fontSize: '0.875rem',
          }}
        >
          <RichTextContent content={agenda} />
        </Box>

        {!expanded && needsToggle && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 28,
              background: `linear-gradient(to bottom, ${alpha(cardBg, 0)}, ${cardBg})`,
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>

      {needsToggle && (
        <Button
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          endIcon={expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
          sx={{ mt: 0.25, ml: -1, textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', color: '#7C3AED', minHeight: 'auto', py: 0.25 }}
        >
          {expanded ? 'Show less' : 'Show full agenda'}
        </Button>
      )}
    </Box>
  );
});
AgendaSection.displayName = 'AgendaSection';

// ==================== Main export ====================
const MeetingOverviewTab = memo(({ meeting, onUpdateLink, onJoinMeeting }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const isOnlineMeeting = meeting?.platform && meeting?.platform !== 'physical';
  const hasMeetingLink = meeting?.meeting_link;
  const hasKeyPersons = meeting?.chairperson_name || meeting?.facilitator;

  return (
    <Box>
      {meeting?.description && (
        <>
          <Typography variant="body2" sx={{ color: isDarkMode ? DARK.textSecondary : 'text.secondary', mb: 2 }}>
            {meeting.description}
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </>
      )}

      <Grid container spacing={{ xs: 2, sm: 2.5 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ width: 36, height: 36, bgcolor: alpha('#7C3AED', 0.1), color: '#7C3AED' }}>
              <CalendarIcon sx={{ fontSize: 19 }} />
            </Avatar>
            <Box>
              <Typography variant="caption" fontWeight={600} color="text.secondary">DATE & TIME</Typography>
              <Typography variant="body1" fontWeight={600}>{formatDate(meeting?.meeting_date)}</Typography>
              {meeting?.start_time && (
                <Typography variant="body2" color="text.secondary">
                  <AccessTimeIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                  {formatTime(meeting.start_time)}
                  {meeting?.end_time && ` - ${formatTime(meeting.end_time)}`}
                </Typography>
              )}
            </Box>
          </Stack>
        </Grid>

        {/* Location/Platform — the Agenda lives inside this box, collapsed by
            default, so "where and what" sit together as one unit. */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Avatar sx={{ width: 36, height: 36, bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' }}>
              {isOnlineMeeting ? <VideoCallIcon sx={{ fontSize: 19 }} /> : <LocationIcon sx={{ fontSize: 19 }} />}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {isOnlineMeeting ? 'PLATFORM' : 'LOCATION'}
              </Typography>
              {isOnlineMeeting ? (
                <>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body1" fontWeight={600}>
                      {meeting?.platform === 'zoom' ? 'Zoom' : meeting?.platform === 'google_meet' ? 'Google Meet' : meeting?.platform === 'microsoft_teams' ? 'Microsoft Teams' : 'Online Meeting'}
                    </Typography>
                    <Tooltip title="Update Meeting Link"><IconButton size="small" onClick={onUpdateLink}><UpdateIcon fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                  {hasMeetingLink && (
                    <Button size="small" startIcon={<LinkIcon />} onClick={onJoinMeeting} sx={{ mt: 0.5, textTransform: 'none' }}>
                      Join Meeting
                    </Button>
                  )}
                </>
              ) : (
                <CTELocationDisplay locationId={meeting?.location_id} locationData={meeting?.location} />
              )}

              <AgendaSection agenda={meeting?.agenda} />
            </Box>
          </Stack>
        </Grid>
      </Grid>

      {hasKeyPersons && (
        <>
          <Divider sx={{ mt: 2, mb: 1.5 }} />
          <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 1.25 }}>
            {meeting?.chairperson_name && (
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar sx={{ width: 30, height: 30, bgcolor: alpha('#F59E0B', 0.12), color: '#F59E0B' }}>
                  <PeopleIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>CHAIRPERSON</Typography>
                  <Typography variant="body2" fontWeight={600}>{meeting.chairperson_name}</Typography>
                </Box>
              </Stack>
            )}
            {meeting?.facilitator && (
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar sx={{ width: 30, height: 30, bgcolor: alpha('#10B981', 0.12), color: '#10B981' }}>
                  <PeopleIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>SECRETARY</Typography>
                  <Typography variant="body2" fontWeight={600}>{meeting.facilitator}</Typography>
                </Box>
              </Stack>
            )}
          </Stack>
        </>
      )}
    </Box>
  );
});
MeetingOverviewTab.displayName = 'MeetingOverviewTab';

export default MeetingOverviewTab;