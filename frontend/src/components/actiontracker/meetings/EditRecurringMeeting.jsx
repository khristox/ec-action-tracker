// src/components/actiontracker/meetings/EditRecurringMeeting.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Stack, TextField, MenuItem,
  Grid, Divider, CircularProgress, Alert, Snackbar, IconButton,
  FormControl, InputLabel, Select, FormHelperText, Chip,
  useTheme, useMediaQuery, alpha, Breadcrumbs,
  InputAdornment, Card, CardContent, Container, AppBar, Toolbar,
  ToggleButton, ToggleButtonGroup, Badge, Dialog, DialogTitle,
  DialogContent, DialogActions, List, ListItem, ListItemText,
  ListItemIcon, ListItemButton, Avatar, LinearProgress, Backdrop,
  Tooltip, Collapse, Skeleton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, Save as SaveIcon,
  Repeat as RepeatIcon, LocationOn as LocationIcon,
  Schedule as ScheduleIcon, Cancel as CancelIcon,
  Event as EventIcon, Update as UpdateIcon,
  Preview as PreviewIcon, Today as TodayIcon,
  Close as CloseIcon, ChevronRight as ChevronRightIcon,
  CheckCircle as CheckCircleIcon, Info as InfoIcon,
  Public as PublicIcon, Flag as FlagIcon, Terrain as TerrainIcon,
  Home as HomeIcon, Business as BusinessIcon, Apartment as ApartmentIcon,
  MeetingRoom as MeetingRoomIcon, EventSeat as EventSeatIcon,
  Search as SearchIcon, ExpandMore as ExpandMoreIcon,
  DomainOutlined as StructureIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, addWeeks, addMonths, addYears, getDaysInMonth } from 'date-fns';
import api from '../../../services/api';

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
  { level: 11, name: 'Office',     icon: <ApartmentIcon />,   color: '#E91E63' },
  { level: 12, name: 'Building',   icon: <BusinessIcon />,    color: '#3F51B5' },
  { level: 13, name: 'Room',       icon: <MeetingRoomIcon />, color: '#009688' },
  { level: 14, name: 'Conference', icon: <EventSeatIcon />,   color: '#673AB7' },
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
  { value: 'never', label: 'Never'               },
  { value: 'after', label: 'After X occurrences' },
  { value: 'on',    label: 'On date'             },
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

/** Calculate upcoming preview dates from a recurrence config */
const calcPreviewDates = (rec, startDate, max = 8) => {
  if (!rec || !startDate) return [];
  const { type, interval = 1, days = [], day_of_month, end_date, max_occurrences } = rec;
  const limit   = Math.min(max_occurrences || max, max);
  const endDate = end_date ? new Date(end_date) : null;
  const start   = new Date(startDate);
  const dates   = [];

  if (type === 'daily') {
    let c = new Date(start);
    for (let i = 0; i < limit; i++) {
      c = addDays(c, interval);
      if (endDate && c > endDate) break;
      dates.push(new Date(c));
    }
  } else if (type === 'weekly' || type === 'biweekly') {
    const iw = type === 'biweekly' ? interval * 2 : interval;
    const selectedIdx = days.map(d => DAY_INDEX_MAP[d]).sort((a, b) => a - b);
    if (!selectedIdx.length) return [];
    const dow = start.getDay();
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    let anchor = addDays(start, -daysFromMon);
    anchor.setHours(start.getHours(), start.getMinutes(), 0, 0);
    let attempts = 0;
    while (dates.length < limit && attempts < 300) {
      attempts++;
      for (const di of selectedIdx) {
        const off = di === 0 ? 6 : di - 1;
        const occ = addDays(anchor, off);
        occ.setHours(start.getHours(), start.getMinutes(), 0, 0);
        if (occ > start) {
          if (endDate && occ > endDate) return dates;
          dates.push(new Date(occ));
          if (dates.length >= limit) return dates;
        }
      }
      anchor = addWeeks(anchor, iw);
    }
  } else if (type === 'monthly') {
    let c = new Date(start);
    for (let i = 0; i < limit; i++) {
      c = addMonths(c, interval);
      if (day_of_month) c.setDate(Math.min(day_of_month, getDaysInMonth(c)));
      if (endDate && c > endDate) break;
      dates.push(new Date(c));
    }
  } else if (type === 'quarterly') {
    let c = new Date(start);
    for (let i = 0; i < limit; i++) {
      c = addMonths(c, 3 * interval);
      if (endDate && c > endDate) break;
      dates.push(new Date(c));
    }
  } else if (type === 'yearly') {
    let c = new Date(start);
    for (let i = 0; i < limit; i++) {
      c = addYears(c, interval);
      if (endDate && c > endDate) break;
      dates.push(new Date(c));
    }
  }
  return dates;
};

const getRecurrenceLabel = (type, interval, days = []) => {
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

// ─── LocationSearch (full hierarchical picker) ────────────────────────────────

const HierarchyNode = React.memo(({ node, depth, locationMode, onSelect, selectedId }) => {
  const [open, setOpen]             = useState(false);
  const [children, setChildren]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [loaded, setLoaded]         = useState(false);
  const levelInfo  = getLevelInfo(node);
  const isSelected = selectedId === node.id;
  const maxLevel   = locationMode === 'buildings' ? 14 : 7;
  const hasChildren = node.level < maxLevel;

  const handleToggle = useCallback(async (e) => {
    e.stopPropagation();
    if (!open && !loaded) {
      setLoading(true);
      try {
        const p = new URLSearchParams({ skip: 0, limit: 100, location_mode: locationMode, parent_id: node.id, include_inactive: false });
        const res = await api.get(`/locations/?${p}`);
        setChildren(res.data?.items || res.data || []);
      } catch { /* ignore */ }
      finally { setLoading(false); setLoaded(true); }
    }
    setOpen(v => !v);
  }, [open, loaded, locationMode, node.id]);

  return (
    <Box>
      <ListItemButton
        onClick={() => onSelect(node)}
        selected={isSelected}
        sx={{
          borderRadius: 1, mb: 0.25, pl: 1 + depth * 2, pr: 1, minHeight: 40,
          '&.Mui-selected': {
            bgcolor: hexAlpha(levelInfo?.color || '#1976d2', 0.12),
            '&:hover': { bgcolor: hexAlpha(levelInfo?.color || '#1976d2', 0.18) },
          },
        }}
      >
        {hasChildren && (
          <IconButton size="small" onClick={handleToggle} sx={{ mr: 0.5, p: 0.25, color: 'text.secondary' }}>
            {loading ? <CircularProgress size={14} /> : open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
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
      {open && loaded && children.length > 0 && (
        <Box sx={{ ml: 2 }}>
          {children.map(c => (
            <HierarchyNode key={c.id} node={c} depth={depth + 1}
              locationMode={locationMode} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </Box>
      )}
    </Box>
  );
});

const LocationSearch = React.memo(({ value, onChange, onClear }) => {
  const theme = useTheme();
  const [locMode, setLocMode]           = useState('address');
  const [search, setSearch]             = useState('');
  const [results, setResults]           = useState([]);
  const [searching, setSearching]       = useState(false);
  const [addrRoots, setAddrRoots]       = useState([]);
  const [bldgRoots, setBldgRoots]       = useState([]);
  const [rootsLoading, setRootsLoading] = useState(false);
  const [rootsLoaded, setRootsLoaded]   = useState({ address: false, structure: false });
  const [selected, setSelected]         = useState(value || null);
  const [hierarchy, setHierarchy]       = useState([]);

  useEffect(() => { if (value !== selected) setSelected(value); }, [value]);
  useEffect(() => { selected?.id ? loadHierarchy(selected.id) : setHierarchy([]); }, [selected?.id]);

  useEffect(() => {
    const apiMode = locMode === 'structure' ? 'buildings' : 'address';
    if (rootsLoaded[locMode]) return;
    const load = async () => {
      setRootsLoading(true);
      try {
        const p = new URLSearchParams({ skip: 0, limit: 100, location_mode: apiMode, include_inactive: false });
        const res = await api.get(`/locations/?${p}`);
        const items = res.data?.items || res.data || [];
        locMode === 'address' ? setAddrRoots(items) : setBldgRoots(items);
        setRootsLoaded(prev => ({ ...prev, [locMode]: true }));
      } catch { /* ignore */ }
      finally { setRootsLoading(false); }
    };
    load();
  }, [locMode, rootsLoaded]);

  useEffect(() => {
    if (!search || search.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const apiMode = locMode === 'structure' ? 'buildings' : 'address';
        const p = new URLSearchParams({ search, location_mode: apiMode, limit: 50, include_inactive: false });
        const res = await api.get(`/locations/?${p}`);
        setResults(res.data?.items || res.data || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [search, locMode]);

  const loadHierarchy = async (id) => {
    try {
      const [anc, self] = await Promise.all([api.get(`/locations/${id}/ancestors`), api.get(`/locations/${id}`)]);
      setHierarchy(self.data ? [...(anc.data || []), self.data] : (anc.data || []));
    } catch { setHierarchy(selected ? [selected] : []); }
  };

  const handleSelect = (loc) => { setSelected(loc); setSearch(''); setResults([]); onChange(loc); };
  const handleClear  = ()    => { setSelected(null); setHierarchy([]); onChange(null); onClear?.(); };
  const roots   = locMode === 'address' ? addrRoots : bldgRoots;
  const apiMode = locMode === 'structure' ? 'buildings' : 'address';

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Stack direction="row" alignItems="center" spacing={1}>
              <LocationIcon sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>Meeting Location</Typography>
            </Stack>
            {selected && <Chip label="Location selected" size="small" color="success" onDelete={handleClear} />}
          </Stack>

          <ToggleButtonGroup value={locMode} exclusive size="small" fullWidth
            onChange={(_, v) => { if (v) { setLocMode(v); setSearch(''); setResults([]); } }}>
            <ToggleButton value="address"><PublicIcon sx={{ mr: 0.75, fontSize: 18 }} />Address</ToggleButton>
            <ToggleButton value="structure"><StructureIcon sx={{ mr: 0.75, fontSize: 18 }} />Structure</ToggleButton>
          </ToggleButtonGroup>

          <TextField fullWidth placeholder="Search location…" value={search}
            onChange={e => setSearch(e.target.value)} size="small"
            slotProps={{ input: {
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: searching && <CircularProgress size={18} />,
            }}} />

          {results.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 240, overflow: 'auto', borderRadius: 1.5 }}>
              <List dense disablePadding>
                {results.map(r => {
                  const li = getLevelInfo(r);
                  return (
                    <ListItemButton key={r.id} onClick={() => handleSelect(r)} selected={selected?.id === r.id} sx={{ py: 0.75 }}>
                      <ListItemIcon sx={{ minWidth: 32, color: li?.color }}>{li?.icon || <LocationIcon fontSize="small" />}</ListItemIcon>
                      <ListItemText primary={r.name} secondary={`${r.code} · ${li?.name || `Level ${r.level}`}`} />
                      {selected?.id === r.id && <CheckCircleIcon fontSize="small" color="success" />}
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          )}

          {!search && (
            <>
              <Typography variant="caption" color="text.secondary">Or browse the hierarchy:</Typography>
              <Paper variant="outlined" sx={{ maxHeight: 320, overflow: 'auto', borderRadius: 1.5, p: 0.5 }}>
                {rootsLoading
                  ? <Stack spacing={1} sx={{ p: 1.5 }}>{[1,2,3].map(i => <Skeleton key={i} variant="rounded" height={36} />)}</Stack>
                  : roots.length === 0
                    ? <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.disabled">No items found</Typography></Box>
                    : <List dense disablePadding>
                        {roots.map(n => (
                          <HierarchyNode key={n.id} node={n} depth={0} locationMode={apiMode}
                            onSelect={handleSelect} selectedId={selected?.id} />
                        ))}
                      </List>
                }
              </Paper>
            </>
          )}

          {selected && hierarchy.length > 0 && (
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

          {!selected && (
            <Alert severity="info" variant="outlined" sx={{ borderRadius: 1.5 }}>
              Search or browse to pick a location.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
});

// ─── Loading Overlay ──────────────────────────────────────────────────────────

const LoadingOverlay = ({ open, message }) => (
  <Backdrop open={open} sx={{ zIndex: 9999, color: '#fff', flexDirection: 'column', gap: 2, bgcolor: 'rgba(0,0,0,0.85)' }}>
    <CircularProgress color="inherit" size={56} />
    <Typography variant="h6" textAlign="center">{message || 'Processing…'}</Typography>
    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Please do not close this window</Typography>
    <LinearProgress sx={{ width: 200, mt: 1, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }} />
  </Backdrop>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const EditRecurringMeeting = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('sm'));

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [snackbar, setSnackbar]   = useState({ open: false, message: '', severity: 'success' });
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title:                    '',
    description:              '',
    location_id:              null,
    location_text:            '',
    location_details:         null,   // full location object for LocationSearch
    recurrence_interval:      1,
    recurrence_type:          'weekly',
    recurrence_days:          [],
    recurrence_day_of_month:  1,
    start_time:               null,
    end_time:                 null,
    recurrence_end_date:      null,
    recurrence_max_occurrences: null,
    recurrence_end_option:    'never',
    status:                   'active',
  });

  // ── Load meeting ───────────────────────────────────────────────────────────
  const loadMeeting = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await api.get(`/recurring-meetings/${id}`);
      const data = res.data?.data || res.data;

      // Determine end option
      const endOption = data.recurrence_end_date ? 'on'
        : data.recurrence_max_occurrences ? 'after' : 'never';

      // Build location_details so LocationSearch can show the selected path
      let locationDetails = null;
      if (data.location_id) {
        try {
          const locRes = await api.get(`/locations/${data.location_id}`);
          locationDetails = locRes.data || null;
        } catch {
          // Fallback: minimal object so the chip still shows
          locationDetails = { id: data.location_id, name: data.location_text || data.location_id };
        }
      }

      setFormData({
        title:                    data.title                    || '',
        description:              data.description              || '',
        location_id:              data.location_id              || null,
        location_text:            data.location_text            || '',
        location_details:         locationDetails,
        recurrence_interval:      data.recurrence_interval      || 1,
        recurrence_type:          data.recurrence_type          || 'weekly',
        recurrence_days:          data.recurrence_days          || [],
        recurrence_day_of_month:  data.recurrence_day_of_month  || 1,
        start_time:               data.start_time ? new Date(data.start_time) : null,
        end_time:                 data.end_time   ? new Date(data.end_time)   : null,
        recurrence_end_date:      data.recurrence_end_date ? new Date(data.recurrence_end_date) : null,
        recurrence_max_occurrences: data.recurrence_max_occurrences || null,
        recurrence_end_option:    endOption,
        status:                   data.status || 'active',
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load meeting data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadMeeting(); }, [loadMeeting]);

  // ── Field helpers ──────────────────────────────────────────────────────────
  const set = (field) => (val) =>
    setFormData(prev => ({ ...prev, [field]: val }));

  const handleTextField = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleNumberField = (field) => (e) => {
    const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
    setFormData(prev => ({ ...prev, [field]: v }));
  };

  const toggleDay = (day) =>
    setFormData(prev => ({
      ...prev,
      recurrence_days: prev.recurrence_days.includes(day)
        ? prev.recurrence_days.filter(d => d !== day)
        : [...prev.recurrence_days, day],
    }));

  const handleLocationSelect = useCallback((loc) => {
    if (loc) {
      setFormData(prev => ({
        ...prev,
        location_id:      loc.id,
        location_text:    loc.name,
        location_details: loc,
      }));
    } else {
      setFormData(prev => ({ ...prev, location_id: null, location_text: '', location_details: null }));
    }
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setSnackbar({ open: true, message: 'Title is required', severity: 'warning' }); return;
    }
    if (!formData.start_time) {
      setSnackbar({ open: true, message: 'Start time is required', severity: 'warning' }); return;
    }

    setSaving(true);
    try {
      const payload = {
        title:                     formData.title,
        description:               formData.description          || null,
        location_id:               formData.location_id          || null,
        location_text:             formData.location_text        || null,
        recurrence_interval:       formData.recurrence_interval,
        recurrence_type:           formData.recurrence_type,
        recurrence_days:           formData.recurrence_days,
        recurrence_day_of_month:   formData.recurrence_day_of_month,
        start_time:                formData.start_time?.toISOString()           || null,
        end_time:                  formData.end_time?.toISOString()             || null,
        recurrence_end_date:       formData.recurrence_end_option === 'on'
                                     ? formData.recurrence_end_date?.toISOString() || null
                                     : null,
        recurrence_max_occurrences: formData.recurrence_end_option === 'after'
                                     ? formData.recurrence_max_occurrences
                                     : null,
        status: formData.status,
      };

      await api.put(`/recurring-meetings/${id}`, payload);
      setSnackbar({ open: true, message: 'Recurring meeting updated successfully!', severity: 'success' });
      setTimeout(() => navigate(`/recurring-meetings/${id}`), 1500);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to update recurring meeting',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Preview dates ──────────────────────────────────────────────────────────
  const previewDates = useMemo(() => {
    if (!showPreview || !formData.start_time) return [];
    return calcPreviewDates({
      type:              formData.recurrence_type,
      interval:          formData.recurrence_interval,
      days:              formData.recurrence_days,
      day_of_month:      formData.recurrence_day_of_month,
      end_date:          formData.recurrence_end_option === 'on' ? formData.recurrence_end_date : null,
      max_occurrences:   formData.recurrence_end_option === 'after' ? formData.recurrence_max_occurrences : null,
    }, formData.start_time, 10);
  }, [showPreview, formData]);

  const recurrenceLabel = useMemo(() =>
    getRecurrenceLabel(formData.recurrence_type, formData.recurrence_interval, formData.recurrence_days),
  [formData.recurrence_type, formData.recurrence_interval, formData.recurrence_days]);

  const showDays = formData.recurrence_type === 'weekly' || formData.recurrence_type === 'biweekly';
  const showDom  = formData.recurrence_type === 'monthly';

  // ── Loading / error screens ────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={56} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={<Button size="small" onClick={loadMeeting}>Retry</Button>}>{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/meetings')} sx={{ mt: 2 }} variant="outlined">
          Back to Meetings
        </Button>
      </Box>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <LoadingOverlay open={saving} message="Updating recurring meeting…" />

      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 10, sm: 4 } }}>

        {/* Mobile app bar */}
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={() => navigate(`/recurring-meetings/${id}`)}><ArrowBackIcon /></IconButton>
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>Edit Recurring Meeting</Typography>
              <IconButton edge="end" onClick={() => navigate(`/recurring-meetings/${id}`)}><CloseIcon /></IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>

          {/* Desktop header */}
          {!isMobile && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="primary">Edit Recurring Meeting</Typography>
                <Typography variant="body2" color="text.secondary">Update the recurring meeting series details</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<CancelIcon />} onClick={() => navigate(`/recurring-meetings/${id}`)} disabled={saving}>Cancel</Button>
                <Button variant="outlined" color="info" startIcon={<EventIcon />} onClick={() => navigate(`/recurring-meetings/${id}`)}>View Series</Button>
              </Stack>
            </Box>
          )}

          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 2, md: 3 } }}>
            <form onSubmit={handleSubmit}>
              <Stack spacing={3.5}>

                {/* ── Basic info ── */}
                <Box>
                  <Typography variant="h6" fontWeight={700} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <EventIcon /> Basic Information
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      required fullWidth label="Meeting Title"
                      value={formData.title} onChange={handleTextField('title')}
                      slotProps={{ input: { startAdornment: <InputAdornment position="start"><EventIcon color="action" /></InputAdornment> } }}
                    />
                    <TextField
                      fullWidth multiline rows={3} label="Description"
                      value={formData.description} onChange={handleTextField('description')}
                      placeholder="Describe the purpose of this meeting series"
                    />
                  </Stack>
                </Box>

                <Divider />

                {/* ── Location (hierarchical picker) ── */}
                <Box>
                  <Typography variant="h6" fontWeight={700} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <LocationIcon /> Location
                  </Typography>
                  <LocationSearch
                    value={formData.location_details}
                    onChange={handleLocationSelect}
                    onClear={() => handleLocationSelect(null)}
                  />
                  <TextField
                    fullWidth label="Custom location text (optional)" sx={{ mt: 2 }}
                    value={formData.location_text} onChange={handleTextField('location_text')}
                    placeholder="e.g. Zoom link, Conference Room B"
                    helperText="Overrides the selected location label above"
                  />
                </Box>

                <Divider />

                {/* ── Schedule ── */}
                <Box>
                  <Typography variant="h6" fontWeight={700} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <ScheduleIcon /> Schedule
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DateTimePicker
                        label="Start Time *"
                        value={formData.start_time}
                        onChange={set('start_time')}
                        slotProps={{ textField: { fullWidth: true, required: true, helperText: 'When does the meeting typically start?' } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DateTimePicker
                        label="End Time"
                        value={formData.end_time}
                        onChange={set('end_time')}
                        slotProps={{ textField: { fullWidth: true, helperText: 'When does the meeting typically end?' } }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* ── Recurrence pattern ── */}
                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={2}>
                    <Typography variant="h6" fontWeight={700} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RepeatIcon /> Recurrence Pattern
                    </Typography>
                    <Chip icon={<RepeatIcon />} label={recurrenceLabel} color="primary" variant="outlined" />
                  </Stack>

                  {/* Type grid */}
                  <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                    {RECURRENCE_TYPES.map(rt => (
                      <Grid key={rt.value} size={{ xs: 6, sm: 4 }}>
                        <Paper
                          variant="outlined"
                          onClick={() => setFormData(prev => ({ ...prev, recurrence_type: rt.value }))}
                          sx={{
                            p: 1.5, cursor: 'pointer', borderRadius: 2, textAlign: 'center',
                            borderColor: formData.recurrence_type === rt.value ? 'primary.main' : 'divider',
                            bgcolor: formData.recurrence_type === rt.value ? alpha(theme.palette.primary.main, 0.07) : 'background.paper',
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
                  <Grid container spacing={2} sx={{ mb: showDays || showDom ? 2 : 0 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth type="number" label="Repeat every"
                        value={formData.recurrence_interval}
                        onChange={handleNumberField('recurrence_interval')}
                        slotProps={{ input: { inputProps: { min: 1, max: 365 } } }}
                        helperText={RECURRENCE_TYPES.find(t => t.value === formData.recurrence_type)?.intervalUnit || ''}
                      />
                    </Grid>
                    {showDom && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth type="number" label="Day of month"
                          value={formData.recurrence_day_of_month}
                          onChange={handleNumberField('recurrence_day_of_month')}
                          slotProps={{ input: { inputProps: { min: 1, max: 31 } } }}
                          helperText="Uses last day of month if day doesn't exist"
                        />
                      </Grid>
                    )}
                  </Grid>

                  {/* Day picker */}
                  {showDays && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>Repeat on</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {WEEK_DAYS.map(day => {
                          const sel = formData.recurrence_days.includes(day.value);
                          return (
                            <ToggleButton
                              key={day.value} value={day.value} selected={sel}
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
                      {formData.recurrence_days.length === 0 && (
                        <FormHelperText error>Please select at least one day</FormHelperText>
                      )}
                      {formData.recurrence_type === 'biweekly' && formData.recurrence_days.length > 0 && (
                        <FormHelperText sx={{ color: 'info.main' }}>
                          Meetings repeat every {formData.recurrence_interval * 2} weeks on selected days
                        </FormHelperText>
                      )}
                    </Box>
                  )}

                  {/* End options */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>End recurrence</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select value={formData.recurrence_end_option} onChange={handleTextField('recurrence_end_option')}>
                          {END_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </Select>
                      </FormControl>

                      {formData.recurrence_end_option === 'after' && (
                        <TextField size="small" type="number" label="Occurrences" sx={{ width: 160 }}
                          value={formData.recurrence_max_occurrences || ''}
                          onChange={handleNumberField('recurrence_max_occurrences')}
                          slotProps={{ input: { inputProps: { min: 1, max: 999 } } }}
                          helperText="Stop after this many meetings"
                        />
                      )}

                      {formData.recurrence_end_option === 'on' && (
                        <DatePicker
                          label="End date" value={formData.recurrence_end_date}
                          onChange={set('recurrence_end_date')}
                          slotProps={{ textField: { size: 'small', sx: { width: 220 }, helperText: 'Stop recurring after this date' } }}
                        />
                      )}
                    </Stack>
                  </Box>

                  {/* Preview */}
                  <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                    <Button variant="outlined" size="small" startIcon={<PreviewIcon />}
                      onClick={() => setShowPreview(p => !p)}>
                      {showPreview ? 'Hide preview' : 'Preview occurrences'}
                    </Button>
                  </Stack>

                  <Collapse in={showPreview}>
                    <Alert severity="info" sx={{ mt: 2 }} icon={<TodayIcon />}
                      action={<IconButton size="small" onClick={() => setShowPreview(false)}><CloseIcon fontSize="small" /></IconButton>}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>Upcoming occurrences (preview)</Typography>
                      {previewDates.length > 0 ? (
                        <Stack spacing={0.75} sx={{ mt: 1 }}>
                          {previewDates.map((d, i) => (
                            <Stack key={i} direction="row" alignItems="center" spacing={1.5}>
                              <Badge badgeContent={i + 1} color="primary" />
                              <TodayIcon fontSize="small" />
                              <Typography variant="body2">{format(d, 'EEEE, MMMM d, yyyy · h:mm a')}</Typography>
                            </Stack>
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No occurrences to show — check your recurrence settings and start time.
                        </Typography>
                      )}
                    </Alert>
                  </Collapse>

                  <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Note:</strong> Changes affect all future occurrences.
                      Already-generated meeting instances are not changed.
                    </Typography>
                  </Alert>
                </Box>

                <Divider />

                {/* ── Actions ── */}
                <Stack direction={isMobile ? 'column' : 'row'} spacing={2} justifyContent="flex-end">
                  <Button variant="outlined" startIcon={<CancelIcon />}
                    onClick={() => navigate(`/recurring-meetings/${id}`)} disabled={saving} size="large">
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" size="large"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <UpdateIcon />}
                    disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </Stack>

              </Stack>
            </form>
          </Paper>
        </Container>

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

export default EditRecurringMeeting;