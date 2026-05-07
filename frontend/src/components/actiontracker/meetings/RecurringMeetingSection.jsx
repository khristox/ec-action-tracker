import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, TextField, Stepper, Step, StepLabel,
  Alert, CircularProgress, Snackbar, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  List, ListItem, ListItemText, ListItemAvatar, ListItemButton, ListItemIcon,
  Avatar, Divider, useMediaQuery, useTheme, Card, CardContent, Stack,
  Container, AppBar, Toolbar, InputAdornment, Grid, Switch, CardActionArea,
  ToggleButton, ToggleButtonGroup, Breadcrumbs, LinearProgress, Backdrop,
  Skeleton, Tooltip, FormHelperText, Badge, Collapse,
} from '@mui/material';
import {
  Delete as DeleteIcon, PersonAdd as PersonAddIcon, Close as CloseIcon,
  Cancel as CancelIcon, ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon, Event as EventIcon, LocationOn as LocationIcon,
  People as PeopleIcon, Save as SaveIcon, MyLocation as MyLocationIcon,
  GpsFixed as GpsFixedIcon, GpsNotFixed as GpsNotFixedIcon,
  ExpandMore as ExpandMoreIcon, EditNote as SecretaryIcon, Search as SearchIcon,
  Apartment as ApartmentIcon, Business as BusinessIcon, Public as PublicIcon,
  Flag as FlagIcon, Terrain as TerrainIcon, Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon, EventSeat as EventSeatIcon,
  ChevronRight as ChevronRightIcon, Phone as PhoneIcon, Email as EmailIcon,
  Work as WorkIcon, Title as TitleIcon, Visibility as VisibilityIcon,
  Update as UpdateIcon, DomainOutlined as StructureIcon, Repeat as RepeatIcon,
  Info as InfoIcon, Preview as PreviewIcon, Today as TodayIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addDays, addWeeks, addMonths, addYears, getDaysInMonth } from 'date-fns';
import api from '../../../services/api';

import {
  fetchParticipantLists, fetchParticipants, addCustomParticipant,
  removeLocalMeetingParticipant, setMeetingChairperson,
  addParticipantsFromListToMeeting, clearMeetingParticipants,
  selectParticipantLists, selectMeetingParticipantsAll,
  selectMeetingChairperson, selectParticipantsLoading,
} from '../../../store/slices/actionTracker/participantSlice';
import {
  createMeeting, updateMeeting, fetchMeetingById,
  clearMeetingState, clearCurrentMeeting,
} from '../../../store/slices/actionTracker/meetingSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const ADDRESS_LEVELS = [
  { level: 1, name: 'Country',   icon: <PublicIcon />,   color: '#4CAF50' },
  { level: 2, name: 'Region',    icon: <FlagIcon />,     color: '#2196F3' },
  { level: 3, name: 'District',  icon: <TerrainIcon />,  color: '#9C27B0' },
  { level: 4, name: 'County',    icon: <BusinessIcon />, color: '#FF9800' },
  { level: 5, name: 'Subcounty', icon: <HomeIcon />,     color: '#795548' },
  { level: 6, name: 'Parish',    icon: <LocationIcon />, color: '#607D8B' },
  { level: 7, name: 'Village',   icon: <HomeIcon />,     color: '#8BC34A' },
];

const BUILDING_LEVELS = [
  { level: 11, name: 'Office',     icon: <ApartmentIcon />,  color: '#E91E63' },
  { level: 12, name: 'Building',   icon: <BusinessIcon />,   color: '#3F51B5' },
  { level: 13, name: 'Room',       icon: <MeetingRoomIcon />,color: '#009688' },
  { level: 14, name: 'Conference', icon: <EventSeatIcon />,  color: '#673AB7' },
];

const RECURRENCE_TYPES = [
  { value: 'daily',     label: 'Daily',     icon: '📅', description: 'Every day',             intervalUnit: 'day(s)'    },
  { value: 'weekly',    label: 'Weekly',    icon: '📆', description: 'Every week on set days', intervalUnit: 'week(s)'   },
  { value: 'biweekly',  label: 'Bi-Weekly', icon: '🔄', description: 'Every two weeks',        intervalUnit: 'weeks (×2)'},
  { value: 'monthly',   label: 'Monthly',   icon: '🗓', description: 'Every month',            intervalUnit: 'month(s)'  },
  { value: 'quarterly', label: 'Quarterly', icon: '📊', description: 'Every 3 months',         intervalUnit: 'quarter(s)'},
  { value: 'yearly',    label: 'Yearly',    icon: '🎉', description: 'Every year',             intervalUnit: 'year(s)'   },
];

const WEEK_DAYS = [
  { value: 'monday',    short: 'Mon', index: 1 },
  { value: 'tuesday',   short: 'Tue', index: 2 },
  { value: 'wednesday', short: 'Wed', index: 3 },
  { value: 'thursday',  short: 'Thu', index: 4 },
  { value: 'friday',    short: 'Fri', index: 5 },
  { value: 'saturday',  short: 'Sat', index: 6 },
  { value: 'sunday',    short: 'Sun', index: 0 },
];

const DAY_INDEX_MAP = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
};

const END_OPTIONS = [
  { value: 'never', label: 'Never'              },
  { value: 'after', label: 'After X occurrences'},
  { value: 'on',    label: 'On date'            },
];

const STEPS = [
  { label: 'Meeting Details', icon: EventIcon,        description: 'Basic info, date & location' },
  { label: 'Participants',    icon: PeopleIcon,        description: 'Add attendees and roles'     },
  { label: 'Recurrence',      icon: RepeatIcon,        description: 'Set repeating schedule'      },
  { label: 'Review & Submit', icon: CheckCircleIcon,   description: 'Verify all information'      },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hexAlpha = (hex, a) => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? `rgba(${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)},${a})`
    : hex;
};

const getLevelInfo = (loc) =>
  loc?.location_mode === 'buildings'
    ? BUILDING_LEVELS.find(l => l.level === loc.level)
    : ADDRESS_LEVELS.find(l => l.level === loc?.level);

const safeScrollToTop = () => {
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  catch { window.scrollTo(0, 0); }
};

/** Always produce a hyphenated UUID string from a uuid.UUID / string / null */
const toUuidStr = (val) => {
  if (!val) return null;
  const s = String(val).replace(/-/g, '');
  if (s.length !== 32) return String(val);
  return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
};

// ─── Date calculation for recurrence preview ──────────────────────────────────

export const calcPreviewDates = (recurrence, startDateStr, count = 8) => {
  if (!startDateStr) return [];
  
  const start = new Date(startDateStr);
  const dates = [];
  const { type, interval, days } = recurrence;

  // Helper to map weekday names to 0-6
  const DAY_MAP = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

  if (type === 'daily') {
    for (let i = 1; i <= count; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i * interval);
      dates.push(d);
    }
  } else if (type === 'weekly' || type === 'biweekly') {
    const step = type === 'biweekly' ? 2 : 1;
    const selectedIndices = days.map(d => DAY_MAP[d]);

    let weeksAdded = 0;
    let currentIteration = 0;

    // Look ahead through weeks until we find 'count' dates
    while (dates.length < count && currentIteration < 50) {
      selectedIndices.forEach(dayIndex => {
        const d = new Date(start);
        // Move to the correct week, then adjust to the specific day
        d.setDate(d.getDate() + (weeksAdded * 7) + (dayIndex - start.getDay()));
        
        if (d > start && dates.length < count) {
          dates.push(new Date(d));
        }
      });
      weeksAdded += step;
      currentIteration++;
    }
  } else if (type === 'monthly') {
    for (let i = 1; i <= count; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i * interval);
      dates.push(d);
    }
  } else if (type === 'quarterly') {
    for (let i = 1; i <= count; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i * 3); // Quarterly is fixed at 3 months
      dates.push(d);
    }
  }

  return dates.sort((a, b) => a - b);
};

const getRecurrenceLabel = (recurrence) => {
  if (!recurrence?.enabled) return null;
  const { type, interval = 1, days = [] } = recurrence;
  const dayNames = days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
  switch (type) {
    case 'daily':     return interval === 1 ? 'Every day' : `Every ${interval} days`;
    case 'weekly':    return (interval === 1 ? 'Weekly' : `Every ${interval} weeks`) + (dayNames ? ` · ${dayNames}` : '');
    case 'biweekly':  return `Every ${interval * 2} weeks` + (dayNames ? ` · ${dayNames}` : '');
    case 'monthly':   return interval === 1 ? 'Monthly' : `Every ${interval} months`;
    case 'quarterly': return 'Every quarter';
    case 'yearly':    return interval === 1 ? 'Yearly' : `Every ${interval} years`;
    default:          return type;
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const HierarchyNode = React.memo(({ node, depth, locationMode, onSelect, selectedId }) => {
  const [open, setOpen]                   = useState(false);
  const [children, setChildren]           = useState([]);
  const [loadingChildren, setLoading]     = useState(false);
  const [childrenLoaded, setLoaded]       = useState(false);
  const levelInfo = getLevelInfo(node);
  const isSelected = selectedId === node.id;
  const maxLevel = locationMode === 'buildings' ? 14 : 7;
  const mightHaveChildren = node.level < maxLevel;

  const handleToggle = useCallback(async (e) => {
    e.stopPropagation();
    if (!open && !childrenLoaded) {
      setLoading(true);
      try {
        const params = new URLSearchParams({ skip: 0, limit: 100, location_mode: locationMode, parent_id: node.id, include_inactive: false });
        const res = await api.get(`/locations/?${params}`);
        setChildren(res.data?.items || res.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); setLoaded(true); }
    }
    setOpen(p => !p);
  }, [open, childrenLoaded, locationMode, node.id]);

  return (
    <Box>
      <ListItemButton
        onClick={() => onSelect(node)}
        selected={isSelected}
        sx={{
          borderRadius: 1, mb: 0.25,
          pl: 1 + depth * 2, pr: 1, minHeight: 40,
          '&.Mui-selected': {
            bgcolor: hexAlpha(levelInfo?.color || '#1976d2', 0.12),
            '&:hover': { bgcolor: hexAlpha(levelInfo?.color || '#1976d2', 0.18) },
          },
        }}
      >
        {mightHaveChildren && (
          <IconButton size="small" onClick={handleToggle} sx={{ mr: 0.5, p: 0.25, color: 'text.secondary' }}>
            {loadingChildren ? <CircularProgress size={14} /> : open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        )}
        <Box sx={{ color: levelInfo?.color || 'text.secondary', display: 'flex', mr: 1, fontSize: 18 }}>
          {levelInfo?.icon || <LocationIcon fontSize="small" />}
        </Box>
        <ListItemText
          primary={<Typography variant="body2" fontWeight={isSelected ? 700 : 400} noWrap>{node.name}</Typography>}
          secondary={<Typography variant="caption" color="text.disabled" noWrap>{node.code} · {levelInfo?.name || `Level ${node.level}`}</Typography>}
        />
        {isSelected && <Chip label="Selected" size="small" color="success" sx={{ ml: 1 }} />}
      </ListItemButton>
      {open && childrenLoaded && children.length > 0 && (
        <Box sx={{ ml: 2 }}>
          {children.map(child => (
            <HierarchyNode key={child.id} node={child} depth={depth + 1}
              locationMode={locationMode} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </Box>
      )}
    </Box>
  );
});

const LocationSearch = React.memo(({ value, onChange, onClear }) => {
  const theme = useTheme();
  const [locationMode, setLocationMode]   = useState('address');
  const [searchTerm, setSearchTerm]       = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addressRoots, setAddressRoots]   = useState([]);
  const [structureRoots, setStructureRoots] = useState([]);
  const [rootsLoading, setRootsLoading]   = useState(false);
  const [rootsLoaded, setRootsLoaded]     = useState({ address: false, structure: false });
  const [selectedLoc, setSelectedLoc]     = useState(value || null);
  const [hierarchy, setHierarchy]         = useState([]);

  useEffect(() => { if (value !== selectedLoc) setSelectedLoc(value); }, [value]);
  useEffect(() => { selectedLoc?.id ? loadHierarchy(selectedLoc.id) : setHierarchy([]); }, [selectedLoc?.id]);

  useEffect(() => {
    const apiMode = locationMode === 'structure' ? 'buildings' : 'address';
    if (rootsLoaded[locationMode]) return;
    const load = async () => {
      setRootsLoading(true);
      try {
        const params = new URLSearchParams({ skip: 0, limit: 100, location_mode: apiMode, include_inactive: false });
        const res = await api.get(`/locations/?${params}`);
        const items = res.data?.items || res.data || [];
        locationMode === 'address' ? setAddressRoots(items) : setStructureRoots(items);
        setRootsLoaded(p => ({ ...p, [locationMode]: true }));
      } catch (err) { console.error(err); }
      finally { setRootsLoading(false); }
    };
    load();
  }, [locationMode, rootsLoaded]);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const apiMode = locationMode === 'structure' ? 'buildings' : 'address';
        const params = new URLSearchParams({ search: searchTerm, location_mode: apiMode, limit: 50, include_inactive: false });
        const res = await api.get(`/locations/?${params}`);
        setSearchResults(res.data?.items || res.data || []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [searchTerm, locationMode]);

  const loadHierarchy = async (id) => {
    try {
      const [anc, self] = await Promise.all([api.get(`/locations/${id}/ancestors`), api.get(`/locations/${id}`)]);
      setHierarchy(self.data ? [...(anc.data || []), self.data] : (anc.data || []));
    } catch { setHierarchy(selectedLoc ? [selectedLoc] : []); }
  };

  const handleSelect = (loc) => { setSelectedLoc(loc); setSearchTerm(''); setSearchResults([]); onChange(loc); };
  const handleClear  = () => { setSelectedLoc(null); setHierarchy([]); onChange(null); onClear?.(); };
  const roots = locationMode === 'address' ? addressRoots : structureRoots;
  const apiMode = locationMode === 'structure' ? 'buildings' : 'address';

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Stack direction="row" alignItems="center" spacing={1}>
              <LocationIcon sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>Meeting Location</Typography>
            </Stack>
            {selectedLoc && <Chip label="Location selected" size="small" color="success" onDelete={handleClear} />}
          </Stack>

          <ToggleButtonGroup value={locationMode} exclusive size="small" fullWidth
            onChange={(_, v) => { if (v) { setLocationMode(v); setSearchTerm(''); setSearchResults([]); } }}>
            <ToggleButton value="address"><PublicIcon sx={{ mr: 0.75, fontSize: 18 }} />Address</ToggleButton>
            <ToggleButton value="structure"><StructureIcon sx={{ mr: 0.75, fontSize: 18 }} />Structure</ToggleButton>
          </ToggleButtonGroup>

          <TextField fullWidth placeholder="Search location…" value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} size="small"
            slotProps={{ input: {
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: searchLoading && <CircularProgress size={18} />,
            }}} />

          {searchResults.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 260, overflow: 'auto', borderRadius: 1.5 }}>
              <List dense disablePadding>
                {searchResults.map(r => {
                  const li = getLevelInfo(r);
                  return (
                    <ListItemButton key={r.id} onClick={() => handleSelect(r)}
                      selected={selectedLoc?.id === r.id} sx={{ py: 0.75 }}>
                      <ListItemIcon sx={{ minWidth: 32, color: li?.color }}>{li?.icon || <LocationIcon fontSize="small" />}</ListItemIcon>
                      <ListItemText primary={r.name} secondary={`${r.code} · ${li?.name || `Level ${r.level}`}`} />
                      {selectedLoc?.id === r.id && <CheckCircleIcon fontSize="small" color="success" />}
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          )}

          {!searchTerm && (
            <>
              <Typography variant="caption" color="text.secondary">Or browse the hierarchy:</Typography>
              <Paper variant="outlined" sx={{ maxHeight: 360, overflow: 'auto', borderRadius: 1.5, p: 0.5 }}>
                {rootsLoading
                  ? <Stack spacing={1} sx={{ p: 1.5 }}>{[1,2,3].map(i => <Skeleton key={i} variant="rounded" height={36} />)}</Stack>
                  : roots.length === 0
                    ? <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.disabled">No items found</Typography></Box>
                    : <List dense disablePadding>
                        {roots.map(n => (
                          <HierarchyNode key={n.id} node={n} depth={0} locationMode={apiMode}
                            onSelect={handleSelect} selectedId={selectedLoc?.id} />
                        ))}
                      </List>
                }
              </Paper>
            </>
          )}

          {selectedLoc && hierarchy.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Selected path:</Typography>
              <Breadcrumbs separator={<ChevronRightIcon sx={{ fontSize: 14 }} />}>
                {hierarchy.map(item => {
                  const li = getLevelInfo(item);
                  return (
                    <Chip key={item.id} label={item.name} size="small" icon={li?.icon}
                      sx={{ bgcolor: hexAlpha(li?.color || theme.palette.primary.main, 0.1), border: '1px solid', borderColor: li?.color || theme.palette.primary.main, color: li?.color || theme.palette.primary.main, fontWeight: 500 }} />
                  );
                })}
              </Breadcrumbs>
            </Paper>
          )}

          {!selectedLoc && (
            <Alert severity="info" variant="outlined" sx={{ borderRadius: 1.5 }}>
              Search or browse to pick a location. You can select an address or a structure.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
});

const ParticipantItem = React.memo(({ participant, onRemove, onMakeChairperson, isChairperson, isSecretary, showActions }) => (
  <ListItem secondaryAction={showActions && (
    <Tooltip title="Remove participant">
      <IconButton edge="end" onClick={() => onRemove(participant.id)}><DeleteIcon /></IconButton>
    </Tooltip>
  )}>
    <ListItemAvatar>
      <Avatar sx={{ bgcolor: isChairperson ? 'primary.main' : 'success.main' }}>
        {participant.name?.charAt(0) || 'P'}
      </Avatar>
    </ListItemAvatar>
    <ListItemText
      primary={
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <Typography variant="body2" fontWeight={500}>{participant.name}</Typography>
          {isChairperson && <Chip label="Chairperson" size="small" color="primary" />}
          {isSecretary   && <Chip label="Secretary"   size="small" color="secondary" />}
        </Stack>
      }
      secondary={
        <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
          {participant.email     && <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><EmailIcon sx={{ fontSize: 12 }} />{participant.email}</Typography>}
          {participant.telephone && <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><PhoneIcon sx={{ fontSize: 12 }} />{participant.telephone}</Typography>}
          {participant.title     && <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><TitleIcon sx={{ fontSize: 12 }} />{participant.title}</Typography>}
          {participant.organization && <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><WorkIcon sx={{ fontSize: 12 }} />{participant.organization}</Typography>}
        </Stack>
      }
    />
    {!isChairperson && showActions && (
      <Button size="small" onClick={() => onMakeChairperson(participant.id)}>Make chairperson</Button>
    )}
  </ListItem>
));

// ─── Recurrence Section ───────────────────────────────────────────────────────

const RecurrenceSection = ({ recurrence, setRecurrence }) => {
  const [showPreview, setShowPreview] = useState(false);
  const isEnabled = !!recurrence?.enabled;

  const handleToggle = (checked) => {
    if (checked) {
      setRecurrence({
        enabled: true,
        type: 'weekly',
        interval: 1,
        days: ['monday', 'wednesday', 'friday'],
        day_of_month: 1,
        end_option: 'never',
        end_date: null,
        max_occurrences: null,
      });
    } else {
      setRecurrence(null);
      setShowPreview(false);
    }
  };

  const update = (field, value) => setRecurrence(prev => ({ ...prev, [field]: value }));

  const handleTypeChange = (type) => {
    setRecurrence(prev => ({
      ...prev,
      type,
      days: (type === 'weekly' || type === 'biweekly')
        ? (prev.days?.length ? prev.days : ['monday'])
        : prev.days,
      day_of_month: type === 'monthly' ? (prev.day_of_month || 1) : prev.day_of_month,
    }));
  };

  const toggleDay = (day) => {
    const cur = recurrence?.days || [];
    update('days', cur.includes(day) ? cur.filter(d => d !== day) : [...cur, day]);
  };

  const previewDates = useMemo(() => {
    if (!showPreview || !isEnabled) return [];
    const fakeStart = new Date();
    return calcPreviewDates(recurrence, fakeStart, 8);
  }, [showPreview, recurrence, isEnabled]);

  const label = getRecurrenceLabel(recurrence);
  const showDays = recurrence?.type === 'weekly' || recurrence?.type === 'biweekly';
  const showDom  = recurrence?.type === 'monthly';

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={3}>
          {/* Toggle row */}
          <Paper variant="outlined" sx={{ p: 2, borderColor: isEnabled ? 'primary.main' : 'divider', transition: 'border-color 0.2s' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Switch checked={isEnabled} onChange={e => handleToggle(e.target.checked)} color="primary" />
                <Stack>
                  <Typography variant="h6" fontWeight={600}>
                    <RepeatIcon sx={{ mr: 1, verticalAlign: 'middle' }} color={isEnabled ? 'primary' : 'action'} />
                    Make this a recurring meeting
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create a series of meetings that repeat on a schedule
                  </Typography>
                </Stack>
              </Stack>
              {isEnabled && label && (
                <Chip icon={<RepeatIcon />} label={label} color="primary" variant="outlined" />
              )}
            </Stack>
          </Paper>

          {/* Configuration */}
          <Collapse in={isEnabled}>
            <Stack spacing={3}>
              <Typography variant="subtitle1" fontWeight={600}>Recurrence pattern</Typography>

              {/* Type grid */}
              <Grid container spacing={1.5}>
                {RECURRENCE_TYPES.map(rt => (
                  <Grid key={rt.value} size={{ xs: 6, sm: 4 }}>
                    <Paper
                      variant="outlined"
                      onClick={() => handleTypeChange(rt.value)}
                      sx={{
                        p: 1.5, cursor: 'pointer', borderRadius: 2, textAlign: 'center',
                        borderColor: recurrence?.type === rt.value ? 'primary.main' : 'divider',
                        bgcolor: recurrence?.type === rt.value ? 'primary.50' : 'background.paper',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' },
                      }}
                    >
                      <Typography fontSize={22}>{rt.icon}</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>{rt.label}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{rt.description}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {/* Interval */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth type="number" label="Repeat every"
                    value={recurrence?.interval || 1}
                    onChange={e => update('interval', Math.max(1, parseInt(e.target.value) || 1))}
                    slotProps={{ input: { inputProps: { min: 1, max: 365 } } }}
                    helperText={RECURRENCE_TYPES.find(t => t.value === recurrence?.type)?.intervalUnit || ''}
                  />
                </Grid>
                {showDom && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth type="number" label="Day of month"
                      value={recurrence?.day_of_month || 1}
                      onChange={e => update('day_of_month', Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                      slotProps={{ input: { inputProps: { min: 1, max: 31 } } }}
                      helperText="Uses last day of month if day doesn't exist"
                    />
                  </Grid>
                )}
              </Grid>

              {/* Day picker */}
              {showDays && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>Repeat on</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {WEEK_DAYS.map(day => {
                      const selected = recurrence?.days?.includes(day.value);
                      return (
                        <ToggleButton
                          key={day.value}
                          value={day.value}
                          selected={selected}
                          onChange={() => toggleDay(day.value)}
                          sx={{
                            width: 52, height: 52, borderRadius: 2, flexDirection: 'column',
                            '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', borderColor: 'primary.main',
                              '&:hover': { bgcolor: 'primary.dark' } },
                          }}
                        >
                          <Typography variant="body2" fontWeight={700} lineHeight={1}>{day.short}</Typography>
                        </ToggleButton>
                      );
                    })}
                  </Stack>
                  {recurrence?.type === 'biweekly' && recurrence?.days?.length > 0 && (
                    <FormHelperText sx={{ mt: 1, color: 'info.main' }}>
                      Meetings will repeat every {(recurrence.interval || 1) * 2} weeks on selected days
                    </FormHelperText>
                  )}
                  {(!recurrence?.days || recurrence.days.length === 0) && (
                    <FormHelperText error>Please select at least one day</FormHelperText>
                  )}
                </Box>
              )}

              {/* End options */}
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>End recurrence</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <Select value={recurrence?.end_option || 'never'}
                      onChange={e => update('end_option', e.target.value)}>
                      {END_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                    </Select>
                  </FormControl>

                  {recurrence?.end_option === 'after' && (
                    <TextField size="small" type="number" label="Occurrences" sx={{ width: 160 }}
                      value={recurrence?.max_occurrences || ''}
                      onChange={e => update('max_occurrences', parseInt(e.target.value) || null)}
                      slotProps={{ input: { inputProps: { min: 1, max: 999 } } }}
                    />
                  )}

                  {recurrence?.end_option === 'on' && (
                    <DatePicker label="End date" value={recurrence?.end_date}
                      onChange={date => update('end_date', date)}
                      slotProps={{ textField: { size: 'small', sx: { width: 220 } } }}
                    />
                  )}
                </Stack>
              </Box>

              {/* Preview toggle */}
              <Stack direction="row" justifyContent="flex-end">
                <Button variant="outlined" size="small" startIcon={<PreviewIcon />}
                  onClick={() => setShowPreview(p => !p)}>
                  {showPreview ? 'Hide preview' : 'Preview occurrences'}
                </Button>
              </Stack>

              {/* Preview list */}
              <Collapse in={showPreview}>
                <Alert severity="info" icon={<CalendarIcon />}
                  action={<IconButton size="small" onClick={() => setShowPreview(false)}><CloseIcon fontSize="small" /></IconButton>}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>Upcoming occurrences (preview)</Typography>
                  {previewDates.length > 0 ? (
                    <Stack spacing={0.75} sx={{ mt: 1 }}>
                      {previewDates.map((date, i) => (
                        <Stack key={i} direction="row" alignItems="center" spacing={1.5}>
                          <Badge badgeContent={i + 1} color="primary" />
                          <TodayIcon fontSize="small" />
                          <Typography variant="body2">
                            {date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No occurrences to show — check your recurrence settings.
                    </Typography>
                  )}
                </Alert>
              </Collapse>

              <Alert severity="info" icon={<InfoIcon />}>
                <Typography variant="body2">
                  <strong>How it works:</strong> Each occurrence is created as a separate meeting.
                  You can modify individual occurrences from the recurring meetings dashboard.
                </Typography>
              </Alert>
            </Stack>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ─── Loading Overlay ──────────────────────────────────────────────────────────

const LoadingOverlay = ({ open, message }) => (
  <Backdrop open={open} sx={{ zIndex: 9999, color: '#fff', flexDirection: 'column', gap: 2, bgcolor: 'rgba(0,0,0,0.8)' }}>
    <CircularProgress color="inherit" size={56} />
    <Typography variant="h6" textAlign="center">{message || 'Processing…'}</Typography>
    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Please do not close this window</Typography>
    <LinearProgress sx={{ width: 200, mt: 1, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }} />
  </Backdrop>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const MeetingForm = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { id }    = useParams();
  const dispatch  = useDispatch();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('sm'));
  const isEditMode = Boolean(id);
  const returnPath = location.state?.from || '/meetings';
  const initialLoaded = useRef(false);

  // Redux
  const participantLists    = useSelector(selectParticipantLists);
  const meetingParticipants = useSelector(selectMeetingParticipantsAll);
  const chairperson         = useSelector(selectMeetingChairperson);
  const participantsLoading = useSelector(selectParticipantsLoading);
  const { isLoading: submitting, success, error: meetingError } = useSelector(s => s.meetings);

  // UI state
  const [activeStep, setActiveStep]             = useState(0);
  const [snackbar, setSnackbar]                 = useState({ open: false, message: '', severity: 'success' });
  const [showAddDialog, setShowAddDialog]       = useState(false);
  const [selectedList, setSelectedList]         = useState(null);
  const [showGpsDetails, setShowGpsDetails]     = useState(false);
  const [formLoading, setFormLoading]           = useState(isEditMode);
  const [gpsEnabled, setGpsEnabled]             = useState(false);
  const [gpsLoading, setGpsLoading]             = useState(false);
  const [gpsSupported, setGpsSupported]         = useState(true);
  const [formDirty, setFormDirty]               = useState(false);
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [submitMessage, setSubmitMessage]       = useState('');
  const [recurrence, setRecurrence]             = useState(null);

  // Attribute mappings
  const [attributeMappings, setAttributeMappings] = useState({
    recurrenceTypes: {}, recurrenceDays: {}, recurrenceWeeks: {}, statuses: {},
  });

  // Form data
  const [formData, setFormData] = useState({
    title: '', description: '', meeting_date: null, start_time: null, end_time: null,
    location_text: '', location_id: null, location_details: null,
    agenda: '', secretary_name: '', gps_latitude: '', gps_longitude: '',
  });

  const [newParticipant, setNewParticipant] = useState({
    name: '', email: '', telephone: '', title: '', organization: '', is_chairperson: false,
  });

  // Derived
  const apiLoading   = submitting || participantsLoading || formLoading || isSubmitting;
  const isRecurring  = useMemo(() => recurrence?.enabled === true, [recurrence]);
  const isValid      = useMemo(() => !!(formData.title.trim() && formData.meeting_date && formData.start_time), [formData]);
  const chairName    = useMemo(() => chairperson?.name || 'Not selected', [chairperson]);

  // ── Fetch attribute mappings ───────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/attribute-groups/RECURRING_MEETING/attributes', {
          params: { active_only: true, detail_level: 'limited', sort_by: 'sort_order', sort_order: 'asc', limit: 100 },
        });
        const attrs = res.data?.items || [];
        const typesMap = {}, daysMap = {}, weeksMap = {}, statusMap = {};

        attrs.forEach(attr => {
          const code  = attr.code || '';
          const meta  = attr.mextra_metadata || {};
          const value = meta?.value;
          // Use attr.id as-is — it should already have hyphens from the API
          const attrId = attr.id;
          if (!value || !attrId) return;

          if (code.includes('RECURRENCE_TYPE_'))   typesMap[value]        = attrId;
          else if (code.includes('RECURRENCE_DAY_')) daysMap[value]        = attrId;
          else if (code.includes('RECURRENCE_WEEK_')) weeksMap[String(value)] = attrId;
          else if (code.includes('RECURRING_STATUS_')) statusMap[value]    = attrId;
        });

        setAttributeMappings({ recurrenceTypes: typesMap, recurrenceDays: daysMap, recurrenceWeeks: weeksMap, statuses: statusMap });
      } catch (err) {
        console.error('Failed to fetch attribute mappings:', err);
      }
    };
    fetch();
  }, []);

  // ── Fetch meeting for edit ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isEditMode || !id || initialLoaded.current) return;
    setFormLoading(true);
    dispatch(fetchMeetingById(id)).unwrap()
      .then(meeting => {
        if (!meeting) return;
        setFormData({
          title: meeting.title || '',
          description: meeting.description || '',
          meeting_date: meeting.meeting_date ? new Date(meeting.meeting_date) : null,
          start_time:   meeting.start_time   ? new Date(meeting.start_time)   : null,
          end_time:     meeting.end_time     ? new Date(meeting.end_time)     : null,
          location_text: meeting.location_text || '',
          location_id:   meeting.location_id   || null,
          location_details: meeting.location_id
            ? { id: meeting.location_id, name: meeting.location_text, code: meeting.location_code, level: meeting.location_level, location_mode: meeting.location_mode }
            : null,
          agenda:         meeting.agenda         || '',
          secretary_name: meeting.secretary_name || '',
          gps_latitude:   meeting.gps_coordinates?.split(',')[0] || '',
          gps_longitude:  meeting.gps_coordinates?.split(',')[1] || '',
        });
        if (meeting.gps_coordinates) setGpsEnabled(true);
        dispatch(clearMeetingParticipants());
        if (meeting.participants?.length) {
          meeting.participants.forEach(p => dispatch(addCustomParticipant({
            ...p, is_chairperson: p.is_chairperson || false,
            id: p.id || `p-${Date.now()}-${Math.random()}`,
          })));
          const chair = meeting.participants.find(p => p.is_chairperson);
          if (chair) setTimeout(() => dispatch(setMeetingChairperson(chair.id)), 150);
        }
        if (meeting.recurrence) setRecurrence(meeting.recurrence);
      })
      .catch(() => setSnackbar({ open: true, message: 'Failed to load meeting', severity: 'error' }))
      .finally(() => { setFormLoading(false); initialLoaded.current = true; });
  }, [isEditMode, id, dispatch]);

  // ── Init effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchParticipantLists());
    dispatch(fetchParticipants({ limit: 100 }));
    if (!navigator.geolocation) {
      setGpsSupported(false);
      setSnackbar({ open: true, message: 'Geolocation is not supported by your browser', severity: 'warning' });
    }
    return () => {
      if (!success) dispatch(clearMeetingParticipants());
      dispatch(clearMeetingState());
      dispatch(clearCurrentMeeting());
    };
  }, [dispatch]);

  // ── Remove secretary if participant removed ────────────────────────────────
  useEffect(() => {
    if (formData.secretary_name && meetingParticipants.length > 0) {
      if (!meetingParticipants.some(p => p.name === formData.secretary_name)) {
        setFormData(prev => ({ ...prev, secretary_name: '' }));
      }
    }
  }, [meetingParticipants, formData.secretary_name]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange     = useCallback(e => { setFormData(p => ({ ...p, [e.target.name]: e.target.value })); setFormDirty(true); }, []);
  const handleDateChange = useCallback(d => { setFormData(p => ({ ...p, meeting_date: d })); setFormDirty(true); }, []);
  const handleStartTime  = useCallback(t => { setFormData(p => ({ ...p, start_time: t })); setFormDirty(true); }, []);
  const handleEndTime    = useCallback(t => { setFormData(p => ({ ...p, end_time: t })); setFormDirty(true); }, []);
  const handleAgenda     = useCallback(e => { setFormData(p => ({ ...p, agenda: e.target.value })); setFormDirty(true); }, []);

  const handleLocationSelect = useCallback(loc => {
    if (loc) {
      setFormData(p => ({
        ...p,
        location_id: loc.id,
        location_text: loc.name,
        location_details: { id: loc.id, name: loc.name, code: loc.code, level: loc.level, location_mode: loc.location_mode },
      }));
    } else {
      setFormData(p => ({ ...p, location_id: null, location_text: '', location_details: null }));
    }
    setFormDirty(true);
  }, []);

  const getCurrentLocation = useCallback(() => {
    if (!gpsSupported) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFormData(p => ({ ...p, gps_latitude: pos.coords.latitude.toFixed(6), gps_longitude: pos.coords.longitude.toFixed(6) }));
        setGpsEnabled(true); setGpsLoading(false); setFormDirty(true);
        setSnackbar({ open: true, message: 'Location captured', severity: 'success' });
      },
      err => {
        const msg = err.code === 1 ? 'Permission denied' : err.code === 2 ? 'Position unavailable' : 'Request timed out';
        setSnackbar({ open: true, message: msg, severity: 'error' }); setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [gpsSupported]);

  const handleGpsToggle = useCallback(e => {
    const on = e.target.checked;
    setGpsEnabled(on);
    if (!on) setFormData(p => ({ ...p, gps_latitude: '', gps_longitude: '' }));
    else if (gpsSupported && !formData.gps_latitude) getCurrentLocation();
    setFormDirty(true);
  }, [gpsSupported, formData.gps_latitude, getCurrentLocation]);

  const handleAddParticipant = useCallback(() => {
    if (!newParticipant.name.trim()) {
      setSnackbar({ open: true, message: 'Name is required', severity: 'warning' }); return;
    }
    dispatch(addCustomParticipant({ ...newParticipant, id: `temp-${Date.now()}-${Math.random()}`, is_custom: true }));
    setNewParticipant({ name: '', email: '', telephone: '', title: '', organization: '', is_chairperson: false });
    setShowAddDialog(false); setFormDirty(true);
    setSnackbar({ open: true, message: 'Participant added', severity: 'success' });
  }, [dispatch, newParticipant]);

  const handleUseList = useCallback(() => {
    const list = participantLists.find(l => l.id === selectedList);
    if (list?.participants) {
      dispatch(addParticipantsFromListToMeeting({ listId: selectedList, participants: list.participants }));
      setFormDirty(true);
      setSnackbar({ open: true, message: `Added ${list.participants.length} participants from "${list.name}"`, severity: 'success' });
    }
    setSelectedList(null);
  }, [selectedList, participantLists, dispatch]);

  const handleSetChairperson = useCallback(pid => {
    dispatch(setMeetingChairperson(pid)); setFormDirty(true);
    setSnackbar({ open: true, message: 'Chairperson updated', severity: 'info' });
  }, [dispatch]);

  const handleRemoveParticipant = useCallback(pid => {
    dispatch(removeLocalMeetingParticipant(pid)); setFormDirty(true);
    setSnackbar({ open: true, message: 'Participant removed', severity: 'info' });
  }, [dispatch]);

  const handleNext = useCallback(() => {
    if (activeStep === 0 && !isValid) {
      setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'warning' }); return;
    }
    setActiveStep(p => p + 1); safeScrollToTop();
  }, [activeStep, isValid]);

  const handleBack = useCallback(() => {
    if (activeStep === 0) navigate(returnPath);
    else { setActiveStep(p => p - 1); safeScrollToTop(); }
  }, [activeStep, navigate, returnPath]);

  const handleCancel = useCallback(() => {
    if (formDirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
    dispatch(clearMeetingParticipants()); navigate(returnPath);
  }, [formDirty, navigate, returnPath, dispatch]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'warning' });
      setActiveStep(0); safeScrollToTop(); return;
    }

    setIsSubmitting(true);
    setSubmitMessage(isEditMode ? 'Updating meeting…' : isRecurring ? 'Creating recurring meeting…' : 'Creating meeting…');

    try {
      const meetingDate = formData.meeting_date;
      const startDT = new Date(meetingDate);
      startDT.setHours(formData.start_time.getHours(), formData.start_time.getMinutes());
      let endDT = null;
      if (formData.end_time) {
        endDT = new Date(meetingDate);
        endDT.setHours(formData.end_time.getHours(), formData.end_time.getMinutes());
      }

      const chairP = meetingParticipants.find(p => p.is_chairperson);
      const basePayload = {
        title:           formData.title,
        description:     formData.description || null,
        meeting_date:    startDT.toISOString(),
        start_time:      startDT.toISOString(),
        end_time:        endDT?.toISOString() || null,
        location_text:   formData.location_text || null,
        location_id:     formData.location_id   || null,
        gps_coordinates: gpsEnabled && formData.gps_latitude && formData.gps_longitude
          ? `${formData.gps_latitude},${formData.gps_longitude}` : null,
        agenda:           formData.agenda         || null,
        secretary_name:   formData.secretary_name || null,
        chairperson_name: chairP?.name            || null,
        custom_participants: meetingParticipants.map(p => ({
          name: p.name, email: p.email || null, telephone: p.telephone || null,
          title: p.title || null, organization: p.organization || null,
          is_chairperson: p.is_chairperson || false,
          is_secretary: p.name === formData.secretary_name,
        })),
      };

      if (isRecurring && recurrence) {
        const recurrenceTypeId = attributeMappings.recurrenceTypes[recurrence.type];
        const recurrenceDayIds = (recurrence.days || [])
          .map(d => attributeMappings.recurrenceDays[d]).filter(Boolean);
        const statusId = attributeMappings.statuses.active;

        if (!recurrenceTypeId) throw new Error(`Recurrence type "${recurrence.type}" not mapped. Available: ${Object.keys(attributeMappings.recurrenceTypes).join(', ')}`);
        if (!statusId)         throw new Error(`Status "active" not mapped. Available: ${Object.keys(attributeMappings.statuses).join(', ')}`);

        const recurringPayload = {
          ...basePayload,
          recurrence_type_id:    recurrenceTypeId,
          recurrence_interval:   recurrence.interval,
          recurrence_days:       recurrenceDayIds,
          recurrence_day_of_month: recurrence.day_of_month === 'last' ? -1 : (recurrence.day_of_month || null),
          recurrence_end_date:   recurrence.end_date      || null,
          recurrence_max_occurrences: recurrence.max_occurrences || null,
          status_id: statusId,
        };

        console.log('Recurring payload:', JSON.stringify(recurringPayload, null, 2));
        await api.post('/recurring-meetings/', recurringPayload);
        setSnackbar({ open: true, message: 'Recurring meeting created!', severity: 'success' });

      } else if (isEditMode) {
        await dispatch(updateMeeting({ id, data: basePayload })).unwrap();
        setSnackbar({ open: true, message: 'Meeting updated!', severity: 'success' });

      } else {
        await dispatch(createMeeting(basePayload)).unwrap();
        setSnackbar({ open: true, message: 'Meeting created!', severity: 'success' });
      }

      dispatch(clearMeetingParticipants());
      setTimeout(() => { setIsSubmitting(false); navigate(returnPath, { replace: true }); }, 1500);

    } catch (err) {
      console.error('Submit error:', err, err.response?.data);
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || err.message || `Failed to ${isEditMode ? 'update' : 'create'} meeting.`,
        severity: 'error',
      });
      setIsSubmitting(false);
      setSubmitMessage('');
    }
  }, [formData, gpsEnabled, meetingParticipants, isEditMode, id, dispatch, isValid, navigate, returnPath, isRecurring, recurrence, attributeMappings]);

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (formLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={56} />
      </Box>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <LoadingOverlay open={isSubmitting} message={submitMessage} />

      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 10, sm: 4 } }}>

        {/* Mobile app bar */}
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={handleCancel}><ArrowBackIcon /></IconButton>
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>
                {isEditMode ? 'Edit Meeting' : 'New Meeting'}
              </Typography>
              <IconButton edge="end" onClick={handleCancel}><CloseIcon /></IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>

          {/* Desktop header */}
          {!isMobile && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="primary">
                  {isEditMode ? 'Edit Meeting' : 'Create New Meeting'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isEditMode ? 'Update meeting details' : 'Fill in the details to schedule a new meeting'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel} disabled={apiLoading}>Cancel</Button>
                {isEditMode && (
                  <Button variant="outlined" color="info" startIcon={<VisibilityIcon />} onClick={() => navigate(`/meetings/${id}`)}>View</Button>
                )}
              </Stack>
            </Box>
          )}

          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 2, md: 3 } }}>

            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 4, display: isMobile ? 'none' : 'flex' }}>
              {STEPS.map((step, i) => (
                <Step key={i}>
                  <StepLabel>
                    <Typography variant="body2" fontWeight={600}>{step.label}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{step.description}</Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* ── Step 0: Details ── */}
            {activeStep === 0 && (
              <Stack spacing={2.5}>
                <TextField fullWidth required label="Meeting Title" name="title"
                  value={formData.title} onChange={handleChange} disabled={apiLoading}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><EventIcon color="action" /></InputAdornment> } }}
                />

                <TextField fullWidth label="Description" name="description" multiline rows={isMobile ? 2 : 3}
                  value={formData.description} onChange={handleChange} disabled={apiLoading} />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker label="Meeting Date *" value={formData.meeting_date} onChange={handleDateChange}
                      slotProps={{ textField: { fullWidth: true, required: true } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TimePicker label="Start Time *" value={formData.start_time} onChange={handleStartTime}
                      slotProps={{ textField: { fullWidth: true, required: true } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TimePicker label="End Time" value={formData.end_time} onChange={handleEndTime}
                      slotProps={{ textField: { fullWidth: true } }} />
                  </Grid>
                </Grid>

                <LocationSearch value={formData.location_details} onChange={handleLocationSelect} onClear={() => handleLocationSelect(null)} />

                {/* GPS */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardActionArea onClick={() => setShowGpsDetails(p => !p)}>
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {gpsEnabled ? <GpsFixedIcon color="success" /> : <GpsNotFixedIcon color="disabled" />}
                        <Typography variant="subtitle1" fontWeight={600}>GPS Coordinates (optional)</Typography>
                      </Stack>
                      <Switch checked={gpsEnabled} onChange={handleGpsToggle} onClick={e => e.stopPropagation()} />
                    </Box>
                  </CardActionArea>
                  <Collapse in={showGpsDetails && gpsEnabled}>
                    <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                      <Stack spacing={1.5}>
                        <Button size="small" variant="contained" startIcon={<MyLocationIcon />}
                          onClick={getCurrentLocation} disabled={gpsLoading}>
                          {gpsLoading ? <CircularProgress size={18} /> : 'Get current location'}
                        </Button>
                        <Grid container spacing={1.5}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField fullWidth size="small" label="Latitude" value={formData.gps_latitude}
                              onChange={e => setFormData(p => ({ ...p, gps_latitude: e.target.value }))} placeholder="e.g. 0.3136" />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField fullWidth size="small" label="Longitude" value={formData.gps_longitude}
                              onChange={e => setFormData(p => ({ ...p, gps_longitude: e.target.value }))} placeholder="e.g. 32.5811" />
                          </Grid>
                        </Grid>
                      </Stack>
                    </Box>
                  </Collapse>
                </Card>

                {/* Agenda */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>Agenda</Typography>
                  <TextField fullWidth multiline rows={6} name="agenda" value={formData.agenda}
                    onChange={handleAgenda} disabled={apiLoading} placeholder="Enter meeting agenda…"
                    helperText="List the agenda items for this meeting" />
                </Box>
              </Stack>
            )}

            {/* ── Step 1: Participants ── */}
            {activeStep === 1 && (
              <Stack spacing={3}>
                {/* From list */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>📋 Add from participant list</Typography>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Select list</InputLabel>
                      <Select value={selectedList || ''} onChange={e => setSelectedList(e.target.value)} label="Select list" disabled={apiLoading}>
                        {participantLists.map(l => <MenuItem key={l.id} value={l.id}>{l.name} ({l.participants?.length || 0})</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Button fullWidth variant="contained" onClick={handleUseList} disabled={!selectedList || apiLoading}>
                      Add selected list
                    </Button>
                  </CardContent>
                </Card>

                {/* Individual */}
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        👤 Participants ({meetingParticipants.length})
                      </Typography>
                      <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setShowAddDialog(true)} disabled={apiLoading}>
                        Add participant
                      </Button>
                    </Box>
                    {meetingParticipants.length === 0 ? (
                      <Alert severity="info" variant="outlined">No participants added yet.</Alert>
                    ) : (
                      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                        {meetingParticipants.map(p => (
                          <React.Fragment key={p.id}>
                            <ParticipantItem participant={p}
                              onRemove={handleRemoveParticipant}
                              onMakeChairperson={handleSetChairperson}
                              isChairperson={p.is_chairperson}
                              isSecretary={p.name === formData.secretary_name}
                              showActions={!apiLoading} />
                            <Divider component="li" />
                          </React.Fragment>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>

                {/* Secretary */}
                <Card variant="outlined" sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                      <SecretaryIcon color="secondary" />
                      <Typography variant="subtitle1" fontWeight={700}>Designate secretary</Typography>
                    </Stack>
                    <FormControl fullWidth>
                      <InputLabel>Select secretary from participants</InputLabel>
                      <Select name="secretary_name" value={formData.secretary_name} onChange={handleChange} label="Select secretary from participants"
                        disabled={apiLoading || meetingParticipants.length === 0}>
                        <MenuItem value=""><em>None selected</em></MenuItem>
                        {meetingParticipants.map(p => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* ── Step 2: Recurrence ── */}
            {activeStep === 2 && (
              <RecurrenceSection recurrence={recurrence} setRecurrence={setRecurrence} />
            )}

            {/* ── Step 3: Review ── */}
            {activeStep === 3 && (
              <Stack spacing={2}>
                <Alert severity="info" icon={<CheckCircleIcon />}>
                  {isEditMode ? 'Review and confirm your changes.' : 'Review all details before creating the meeting.'}
                </Alert>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="primary" gutterBottom fontWeight={700}>Meeting details</Typography>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2"><strong>Title:</strong> {formData.title}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2"><strong>Chairperson:</strong> {chairName}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2" color="secondary.main"><strong>Secretary:</strong> {formData.secretary_name || 'Not selected'}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2"><strong>Location:</strong> {formData.location_text || 'Not specified'}</Typography></Grid>
                      {formData.meeting_date && formData.start_time && (
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="body2">
                            <strong>Date & time:</strong> {formData.meeting_date?.toLocaleDateString()} at {formData.start_time?.toLocaleTimeString()}
                            {formData.end_time && ` – ${formData.end_time?.toLocaleTimeString()}`}
                          </Typography>
                        </Grid>
                      )}
                      {gpsEnabled && formData.gps_latitude && formData.gps_longitude && (
                        <Grid size={{ xs: 12 }}><Typography variant="body2"><strong>GPS:</strong> {formData.gps_latitude}, {formData.gps_longitude}</Typography></Grid>
                      )}
                      {isRecurring && recurrence && (
                        <Grid size={{ xs: 12 }}>
                          <Chip icon={<RepeatIcon />} label={getRecurrenceLabel(recurrence) || 'Recurring'} color="primary" size="medium" />
                        </Grid>
                      )}
                    </Grid>

                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom fontWeight={700}>Agenda</Typography>
                    <Box sx={{ maxHeight: 140, overflow: 'auto', fontSize: '0.875rem', p: 1, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap' }}>
                      {formData.agenda || 'No agenda provided'}
                    </Box>

                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom fontWeight={700}>Participants ({meetingParticipants.length})</Typography>
                    <Box component="ul" sx={{ pl: 2, mt: 1, maxHeight: 140, overflow: 'auto' }}>
                      {meetingParticipants.slice(0, 10).map(p => (
                        <li key={p.id}>
                          <Typography variant="body2">
                            {p.name}
                            {p.is_chairperson && ' (Chairperson)'}
                            {p.name === formData.secretary_name && ' (Secretary)'}
                          </Typography>
                        </li>
                      ))}
                      {meetingParticipants.length > 10 && (
                        <li><Typography variant="body2">…and {meetingParticipants.length - 10} more</Typography></li>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                <Button variant="contained" size="large" onClick={handleSubmit}
                  startIcon={isEditMode ? <UpdateIcon /> : <SaveIcon />}
                  disabled={apiLoading}
                  sx={{ py: 1.5, bgcolor: 'primary.main' }}>
                  {apiLoading
                    ? <CircularProgress size={24} color="inherit" />
                    : isEditMode ? 'Update Meeting' : isRecurring ? 'Create Recurring Meeting' : 'Create Meeting'}
                </Button>
              </Stack>
            )}

            {/* Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button onClick={handleBack} startIcon={<ArrowBackIcon />} disabled={apiLoading}>
                {activeStep === 0 ? 'Cancel' : 'Back'}
              </Button>
              {activeStep < 3 && (
                <Button variant="contained" onClick={handleNext} endIcon={<ArrowForwardIcon />}
                  disabled={apiLoading || (activeStep === 0 && !isValid)}>
                  Next
                </Button>
              )}
            </Box>
          </Paper>
        </Container>

        {/* Add participant dialog */}
        <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add new participant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth required label="Full name" value={newParticipant.name}
                onChange={e => setNewParticipant(p => ({ ...p, name: e.target.value }))} size="small" autoFocus />
              <TextField fullWidth label="Email" type="email" value={newParticipant.email}
                onChange={e => setNewParticipant(p => ({ ...p, email: e.target.value }))} size="small" />
              <TextField fullWidth label="Telephone" value={newParticipant.telephone}
                onChange={e => setNewParticipant(p => ({ ...p, telephone: e.target.value }))} size="small" />
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="Title" value={newParticipant.title}
                    onChange={e => setNewParticipant(p => ({ ...p, title: e.target.value }))} size="small" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="Organisation" value={newParticipant.organization}
                    onChange={e => setNewParticipant(p => ({ ...p, organization: e.target.value }))} size="small" />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddParticipant} disabled={!newParticipant.name.trim()}>
              Add participant
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar open={snackbar.open} autoHideDuration={4000}
          onClose={() => setSnackbar(p => ({ ...p, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}>
          <Alert severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}
            onClose={() => setSnackbar(p => ({ ...p, open: false }))}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default React.memo(MeetingForm);
