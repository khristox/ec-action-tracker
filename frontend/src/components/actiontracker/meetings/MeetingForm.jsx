// src/components/meetings/MeetingForm.jsx - With Debug Logs
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, TextField, Stepper, Step, StepLabel,
  Alert, CircularProgress, Snackbar, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  List, ListItem, ListItemText, ListItemAvatar, ListItemButton, ListItemIcon,
  Avatar, Divider, useMediaQuery,
  useTheme, Card, CardContent, Stack, Container, AppBar, Toolbar,
  InputAdornment, Grid, Switch, Collapse, CardActionArea, ToggleButton,
  ToggleButtonGroup, Breadcrumbs, LinearProgress,
  Backdrop, Skeleton, Tooltip, FormHelperText, Badge
} from '@mui/material';
import {
  Delete as DeleteIcon, PersonAdd as PersonAddIcon, Close as CloseIcon,
  Cancel as CancelIcon, ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon, Event as EventIcon, LocationOn as LocationIcon,
  People as PeopleIcon, Description as DescriptionIcon, Save as SaveIcon,
  MyLocation as MyLocationIcon, GpsFixed as GpsFixedIcon, GpsNotFixed as GpsNotFixedIcon,
  ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, EditNote as SecretaryIcon,
  Search as SearchIcon, Apartment as ApartmentIcon, Business as BusinessIcon,
  Public as PublicIcon, Flag as FlagIcon, Terrain as TerrainIcon, Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon, EventSeat as EventSeatIcon, ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon, Email as EmailIcon, Work as WorkIcon, Title as TitleIcon,
  Visibility as VisibilityIcon, Update as UpdateIcon,
  DomainOutlined as StructureIcon, Repeat as RepeatIcon, Info as InfoIcon,
  Preview as PreviewIcon, Today as TodayIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../../../services/api';

// Redux imports
import {
  fetchParticipantLists, fetchParticipants, addCustomParticipant,
  removeLocalMeetingParticipant, setMeetingChairperson,
  addParticipantsFromListToMeeting, clearMeetingParticipants,
  selectParticipantLists, selectMeetingParticipantsAll,
  selectMeetingChairperson, selectParticipantsLoading
} from '../../../store/slices/actionTracker/participantSlice';
import {
  createMeeting, updateMeeting, fetchMeetingById,
  clearMeetingState, clearCurrentMeeting
} from '../../../store/slices/actionTracker/meetingSlice';

// ─── Constants ────────────────────────────────────────────────────────────────
const ADDRESS_LEVELS = [
  { level: 1, name: 'Country', icon: <PublicIcon />, color: '#4CAF50' },
  { level: 2, name: 'Region', icon: <FlagIcon />, color: '#2196F3' },
  { level: 3, name: 'District', icon: <TerrainIcon />, color: '#9C27B0' },
  { level: 4, name: 'County', icon: <BusinessIcon />, color: '#FF9800' },
  { level: 5, name: 'Subcounty', icon: <HomeIcon />, color: '#795548' },
  { level: 6, name: 'Parish', icon: <LocationIcon />, color: '#607D8B' },
  { level: 7, name: 'Village', icon: <HomeIcon />, color: '#8BC34A' },
];

const BUILDING_LEVELS = [
  { level: 11, name: 'Office', icon: <ApartmentIcon />, color: '#E91E63' },
  { level: 12, name: 'Building', icon: <BusinessIcon />, color: '#3F51B5' },
  { level: 13, name: 'Room', icon: <MeetingRoomIcon />, color: '#009688' },
  { level: 14, name: 'Conference', icon: <EventSeatIcon />, color: '#673AB7' },
];

// Recurrence Constants
const RECURRENCE_TYPES = [
  { value: 'daily', label: 'Daily', icon: '📅', description: 'Repeats every day', intervalText: 'day(s)' },
  { value: 'weekly', label: 'Weekly', icon: '📆', description: 'Repeats every week on selected days', intervalText: 'week(s)' },
  { value: 'biweekly', label: 'Bi-Weekly', icon: '🔄', description: 'Repeats every two weeks', intervalText: 'week(s)' },
  { value: 'monthly', label: 'Monthly', icon: '📅', description: 'Repeats every month on selected date', intervalText: 'month(s)' },
  { value: 'quarterly', label: 'Quarterly', icon: '📊', description: 'Repeats every 3 months', intervalText: 'quarter(s)' },
  { value: 'yearly', label: 'Yearly', icon: '🎉', description: 'Repeats every year', intervalText: 'year(s)' }
];

const WEEK_DAYS = [
  { value: 'monday', label: 'M', full: 'Monday' },
  { value: 'tuesday', label: 'T', full: 'Tuesday' },
  { value: 'wednesday', label: 'W', full: 'Wednesday' },
  { value: 'thursday', label: 'T', full: 'Thursday' },
  { value: 'friday', label: 'F', full: 'Friday' },
  { value: 'saturday', label: 'S', full: 'Saturday' },
  { value: 'sunday', label: 'S', full: 'Sunday' }
];

const END_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'after', label: 'After X occurrences' },
  { value: 'on', label: 'On date' }
];

const steps = [
  { label: 'Meeting Details', icon: EventIcon, description: 'Basic info, date, location' },
  { label: 'Participants', icon: PeopleIcon, description: 'Add attendees and roles' },
  { label: 'Recurrence', icon: RepeatIcon, description: 'Set up recurring schedule' },
  { label: 'Review & Submit', icon: CheckCircleIcon, description: 'Verify all information' },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────
const hexAlpha = (color, opacity) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (result) {
    const [r, g, b] = [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

const getLevelInfo = (location) => {
  if (location?.location_mode === 'buildings') {
    return BUILDING_LEVELS.find(l => l.level === location.level);
  }
  return ADDRESS_LEVELS.find(l => l.level === location?.level);
};

// ─── Safe Scroll To Top ───────────────────────────────────────────────────────
const safeScrollToTop = () => {
  if (typeof window !== 'undefined' && window.scrollTo) {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  }
};

// ─── HierarchyNode Component ──────────────────────────────────────────────────
const HierarchyNode = React.memo(({ node, depth, locationMode, onSelect, selectedId }) => {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [childrenLoaded, setChildrenLoaded] = useState(false);

  const levelInfo = getLevelInfo(node);
  const isSelected = selectedId === node.id;

  const handleToggle = useCallback(async (e) => {
    e.stopPropagation();
    if (!open && !childrenLoaded) {
      setLoadingChildren(true);
      try {
        const params = new URLSearchParams({
          skip: 0, limit: 100, location_mode: locationMode, parent_id: node.id, include_inactive: false,
        });
        const response = await api.get(`/locations/?${params.toString()}`);
        const items = response.data?.items || response.data || [];
        setChildren(items);
      } catch (err) { console.error('Error loading children:', err);
      } finally { setLoadingChildren(false); setChildrenLoaded(true); }
    }
    setOpen(prev => !prev);
  }, [open, childrenLoaded, locationMode, node.id]);

  const maxLevel = locationMode === 'buildings' ? 14 : 7;
  const mightHaveChildren = node.level < maxLevel;

  return (
    <Box>
      <ListItemButton
        onClick={() => onSelect(node)}
        selected={isSelected}
        sx={{
          borderRadius: 1,
          mb: 0.25,
          pl: 1 + depth * 2,
          pr: 1,
          minHeight: 40,
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
        {isSelected && <Chip label="Selected" size="small" color="success" sx={{ ml: 1, fontWeight: 600 }} />}
      </ListItemButton>
      {open && childrenLoaded && children.length > 0 && (
        <Box sx={{ ml: 2 }}>
          {children.map(child => (
            <HierarchyNode key={child.id} node={child} depth={depth + 1} locationMode={locationMode} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </Box>
      )}
    </Box>
  );
});

// ─── LocationSearch Component ─────────────────────────────────────────────────
const LocationSearch = React.memo(({ value, onChange, onClear }) => {
  const theme = useTheme();
  const [locationMode, setLocationMode] = useState('address');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addressRoots, setAddressRoots] = useState([]);
  const [structureRoots, setStructureRoots] = useState([]);
  const [rootsLoading, setRootsLoading] = useState(false);
  const [rootsLoaded, setRootsLoaded] = useState({ address: false, structure: false });
  const [selectedLocation, setSelectedLocation] = useState(value || null);
  const [locationHierarchy, setLocationHierarchy] = useState([]);

  useEffect(() => { if (value !== selectedLocation) setSelectedLocation(value); }, [value, selectedLocation]);
  useEffect(() => { if (selectedLocation?.id) loadLocationHierarchy(selectedLocation.id); else setLocationHierarchy([]); }, [selectedLocation?.id]);

  useEffect(() => {
    const apiMode = locationMode === 'structure' ? 'buildings' : 'address';
    if (rootsLoaded[locationMode]) return;
    const loadRoots = async () => {
      setRootsLoading(true);
      try {
        const params = new URLSearchParams({ skip: 0, limit: 100, location_mode: apiMode, include_inactive: false });
        const response = await api.get(`/locations/?${params.toString()}`);
        const items = response.data?.items || response.data || [];
        if (locationMode === 'address') setAddressRoots(items);
        else setStructureRoots(items);
        setRootsLoaded(prev => ({ ...prev, [locationMode]: true }));
      } catch (err) { console.error('Error loading roots:', err);
      } finally { setRootsLoading(false); }
    };
    loadRoots();
  }, [locationMode, rootsLoaded]);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const apiMode = locationMode === 'structure' ? 'buildings' : 'address';
        const params = new URLSearchParams({ search: searchTerm, location_mode: apiMode, limit: 50, include_inactive: false });
        const response = await api.get(`/locations/?${params.toString()}`);
        setSearchResults(response.data?.items || response.data || []);
      } catch (err) { console.error('Error searching locations:', err); setSearchResults([]);
      } finally { setSearchLoading(false); }
    }, 450);
    return () => clearTimeout(timer);
  }, [searchTerm, locationMode]);

  const loadLocationHierarchy = async (locationId) => {
    try {
      const res = await api.get(`/locations/${locationId}/ancestors`);
      const ancestors = res.data || [];
      const selfRes = await api.get(`/locations/${locationId}`);
      setLocationHierarchy(selfRes.data ? [...ancestors, selfRes.data] : ancestors);
    } catch { setLocationHierarchy(selectedLocation ? [selectedLocation] : []); }
  };

  const handleSelect = (location) => { setSelectedLocation(location); setSearchTerm(''); setSearchResults([]); onChange(location); };
  const handleClear = () => { setSelectedLocation(null); setLocationHierarchy([]); onChange(null); if (onClear) onClear(); };

  const currentRoots = locationMode === 'address' ? addressRoots : structureRoots;
  const apiMode = locationMode === 'structure' ? 'buildings' : 'address';

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <LocationIcon sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>Meeting Location</Typography>
            </Stack>
            {selectedLocation && (
              <Chip label="Location Selected" size="small" color="success" onDelete={handleClear} />
            )}
          </Stack>

          <ToggleButtonGroup value={locationMode} exclusive onChange={(_, val) => { if (val) { setLocationMode(val); setSearchTerm(''); setSearchResults([]); } }} size="small" fullWidth>
            <ToggleButton value="address"><PublicIcon sx={{ mr: 0.75, fontSize: 18 }} /> Address</ToggleButton>
            <ToggleButton value="structure"><StructureIcon sx={{ mr: 0.75, fontSize: 18 }} /> Structure</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            fullWidth
            placeholder="Search location..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: searchLoading && <CircularProgress size={18} />
              }
            }}
          />

          {searchResults.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 280, overflow: 'auto', borderRadius: 1.5 }}>
              <List dense disablePadding>
                {searchResults.map(result => {
                  const li = getLevelInfo(result);
                  return (
                    <ListItemButton key={result.id} onClick={() => handleSelect(result)} selected={selectedLocation?.id === result.id} sx={{ py: 0.75 }}>
                      <ListItemIcon sx={{ minWidth: 32, color: li?.color }}>{li?.icon || <LocationIcon fontSize="small" />}</ListItemIcon>
                      <ListItemText primary={result.name} secondary={`${result.code} · ${li?.name || `Level ${result.level}`}`} />
                      {selectedLocation?.id === result.id && <CheckCircleIcon fontSize="small" color="success" />}
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          )}

          {!searchTerm && (
            <>
              <Typography variant="caption" color="text.secondary">Or browse the hierarchy:</Typography>
              <Paper variant="outlined" sx={{ maxHeight: 380, overflow: 'auto', borderRadius: 1.5, p: 0.5 }}>
                {rootsLoading ? (
                  <Stack spacing={1} sx={{ p: 1.5 }}>{[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={36} />)}</Stack>
                ) : currentRoots.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.disabled">No items found</Typography></Box>
                ) : (
                  <List dense disablePadding>
                    {currentRoots.map(node => (
                      <HierarchyNode key={node.id} node={node} depth={0} locationMode={apiMode} onSelect={handleSelect} selectedId={selectedLocation?.id} />
                    ))}
                  </List>
                )}
              </Paper>
            </>
          )}

          {selectedLocation && locationHierarchy.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Selected path:</Typography>
              <Breadcrumbs separator={<ChevronRightIcon sx={{ fontSize: 14 }} />}>
                {locationHierarchy.map(item => {
                  const li = getLevelInfo(item);
                  return (
                    <Chip key={item.id} label={item.name} size="small" icon={li?.icon}
                      sx={{ bgcolor: hexAlpha(li?.color || theme.palette.primary.main, 0.1), borderColor: li?.color || theme.palette.primary.main, color: li?.color || theme.palette.primary.main, border: '1px solid', fontWeight: 500 }} />
                  );
                })}
              </Breadcrumbs>
            </Paper>
          )}

          {!selectedLocation && (
            <Alert severity="info" variant="outlined" sx={{ borderRadius: 1.5 }}>
              Search or browse to pick a location. You can select either an address or a structure.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
});

// ─── ParticipantItem Component ────────────────────────────────────────────────
const ParticipantItem = React.memo(({ participant, onRemove, onMakeChairperson, isChairperson, isSecretary, showActions = true }) => (
  <ListItem
    secondaryAction={showActions && (
      <Tooltip title="Remove participant">
        <IconButton edge="end" onClick={() => onRemove(participant.id)}><DeleteIcon /></IconButton>
      </Tooltip>
    )}
  >
    <ListItemAvatar><Avatar sx={{ bgcolor: isChairperson ? 'primary.main' : 'success.main' }}>{participant.name?.charAt(0) || 'P'}</Avatar></ListItemAvatar>
    <ListItemText
      primary={
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <Typography variant="body2" fontWeight={500}>{participant.name}</Typography>
          {isChairperson && <Chip label="Chairperson" size="small" color="primary" />}
          {isSecretary && <Chip label="Secretary" size="small" color="secondary" />}
        </Stack>
      }
      secondary={
        <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
          {participant.email && <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><EmailIcon sx={{ fontSize: 12 }} /> {participant.email}</Typography>}
          {participant.telephone && <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><PhoneIcon sx={{ fontSize: 12 }} /> {participant.telephone}</Typography>}
          {participant.title && <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><TitleIcon sx={{ fontSize: 12 }} /> {participant.title}</Typography>}
          {participant.organization && <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><WorkIcon sx={{ fontSize: 12 }} /> {participant.organization}</Typography>}
        </Stack>
      }
    />
    {!isChairperson && showActions && (
      <Button size="small" onClick={() => onMakeChairperson(participant.id)}>Make Chairperson</Button>
    )}
  </ListItem>
));

// ─── RecurrenceSection Component ──────────────────────────────────────────────
const RecurrenceSection = ({ recurrence, setRecurrence }) => {
  const [isRecurring, setIsRecurring] = useState(!!recurrence?.enabled);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDates, setPreviewDates] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleRecurringToggle = (checked) => {
    console.log('Recurrence toggle:', checked);
    setIsRecurring(checked);
    if (checked) {
      const newRecurrence = { 
        enabled: true, 
        type: 'weekly', 
        interval: 1, 
        days: ['monday'], 
        day_of_month: 1, 
        end_option: 'never', 
        end_date: null, 
        max_occurrences: null 
      };
      setRecurrence(newRecurrence);
      console.log('Recurrence enabled:', newRecurrence);
    } else { 
      setRecurrence(null);
      console.log('Recurrence disabled');
    }
  };

  const updateRecurrence = (field, value) => { 
    setRecurrence(prev => ({ ...prev, [field]: value }));
    console.log(`Updated recurrence ${field}:`, value);
  };

  const fetchPreview = async () => {
    if (!recurrence?.enabled) return;
    setLoadingPreview(true);
    try {
      const mockDates = [];
      let date = new Date();
      for (let i = 0; i < 5; i++) {
        if (recurrence.type === 'daily') date = new Date(date.setDate(date.getDate() + recurrence.interval));
        else if (recurrence.type === 'weekly') date = new Date(date.setDate(date.getDate() + 7 * recurrence.interval));
        else if (recurrence.type === 'monthly') date = new Date(date.setMonth(date.getMonth() + recurrence.interval));
        mockDates.push(new Date(date));
      }
      setPreviewDates(mockDates);
    } catch (error) { console.error('Error fetching preview:', error);
    } finally { setLoadingPreview(false); }
  };

  const toggleDay = (day) => {
    const currentDays = recurrence?.days || [];
    updateRecurrence('days', currentDays.includes(day) ? currentDays.filter(d => d !== day) : [...currentDays, day]);
  };

  useEffect(() => { if (showPreview && recurrence?.enabled) fetchPreview(); }, [showPreview, recurrence]);

  const getIntervalText = () => {
    const type = recurrence?.type;
    const interval = recurrence?.interval || 1;
    const typeConfig = RECURRENCE_TYPES.find(t => t.value === type);
    const unit = typeConfig?.intervalText || 'day(s)';
    return `${interval} ${unit}`;
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: isRecurring ? 'primary.main' : 'divider' }}>
            <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Switch checked={isRecurring} onChange={(e) => handleRecurringToggle(e.target.checked)} color="primary" size="large" />
                <Stack>
                  <Typography variant="h6" fontWeight={600}>
                    <RepeatIcon sx={{ mr: 1, verticalAlign: 'middle' }} color={isRecurring ? 'primary' : 'action'} />
                    Make this a recurring meeting
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Create a series of meetings that repeat on a schedule</Typography>
                </Stack>
              </Stack>
              {isRecurring && <Chip icon={<RepeatIcon />} label={`Repeats ${getIntervalText()}`} color="primary" variant="outlined" />}
            </Stack>
          </Paper>

          {isRecurring && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>Recurrence Pattern</Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Repeats every</InputLabel>
                    <Select value={recurrence?.type || 'weekly'} onChange={(e) => updateRecurrence('type', e.target.value)} label="Repeats every">
                      {RECURRENCE_TYPES.map(type => (
                        <MenuItem key={type.value} value={type.value}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body1">{type.icon}</Typography>
                            <Typography variant="body1">{type.label}</Typography>
                            <Typography variant="caption" color="text.secondary">({type.description})</Typography>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth type="number" label="Repeat every" value={recurrence?.interval || 1}
                    onChange={(e) => updateRecurrence('interval', parseInt(e.target.value) || 1)}
                    InputProps={{ inputProps: { min: 1, max: 365 } }}
                    helperText={RECURRENCE_TYPES.find(t => t.value === recurrence?.type)?.intervalText || 'day(s)'}
                  />
                </Grid>

                {(recurrence?.type === 'weekly' || recurrence?.type === 'biweekly') && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom>Repeat on</Typography>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
                      {WEEK_DAYS.map(day => (
                        <ToggleButton
                          key={day.value}
                          value={day.value}
                          selected={recurrence?.days?.includes(day.value)}
                          onChange={() => toggleDay(day.value)}
                          sx={{ width: 48, height: 48, borderRadius: 2, '&.Mui-selected': { bgcolor: 'primary.main', color: 'white' } }}
                        >
                          <Stack direction="column" alignItems="center">
                            <Typography variant="caption" fontWeight={600}>{day.label}</Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>{day.full.substring(0, 2)}</Typography>
                          </Stack>
                        </ToggleButton>
                      ))}
                    </Stack>
                  </Grid>
                )}

                {recurrence?.type === 'monthly' && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Day of month</InputLabel>
                      <Select value={recurrence?.day_of_month || 1} onChange={(e) => updateRecurrence('day_of_month', e.target.value)} label="Day of month">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => <MenuItem key={day} value={day}>{day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} day</MenuItem>)}
                        <MenuItem value="last">Last day</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>End recurrence</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <Select value={recurrence?.end_option || 'never'} onChange={(e) => updateRecurrence('end_option', e.target.value)}>
                        {END_OPTIONS.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                    {recurrence?.end_option === 'after' && (
                      <TextField size="small" type="number" label="Number of occurrences" sx={{ width: 200 }}
                        value={recurrence?.max_occurrences || ''} onChange={(e) => updateRecurrence('max_occurrences', parseInt(e.target.value) || 0)}
                        InputProps={{ inputProps: { min: 1, max: 999 } }}
                      />
                    )}
                    {recurrence?.end_option === 'on' && (
                      <DatePicker label="End date" value={recurrence?.end_date} onChange={(date) => updateRecurrence('end_date', date)}
                        slotProps={{ textField: { size: 'small', sx: { width: 250 } } }}
                      />
                    )}
                  </Stack>
                </Grid>
              </Grid>

              <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
                <Button variant="outlined" startIcon={<PreviewIcon />} onClick={() => setShowPreview(!showPreview)} size="small">
                  {showPreview ? 'Hide Preview' : 'Preview Occurrences'}
                </Button>
              </Stack>

              {showPreview && (
                <Alert severity="info" sx={{ mt: 2 }} icon={<TodayIcon />} action={
                  <IconButton size="small" onClick={() => setShowPreview(false)}><CloseIcon fontSize="small" /></IconButton>
                }>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>Upcoming Occurrences</Typography>
                  {loadingPreview ? <CircularProgress size={24} /> : previewDates.length > 0 ? (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {previewDates.map((date, idx) => (
                        <Stack key={idx} direction="row" alignItems="center" spacing={2}>
                          <Badge badgeContent={idx + 1} color="primary" />
                          <EventIcon fontSize="small" />
                          <Typography variant="body2">
                            {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  ) : <Typography variant="body2">Click "Preview" to see upcoming dates</Typography>}
                </Alert>
              )}

              <Alert severity="info" sx={{ mt: 2 }} icon={<InfoIcon />}>
                <Typography variant="body2">
                  <strong>How it works:</strong> This will create a series of meetings based on the pattern above.
                  Each occurrence will be created as a separate meeting.
                </Typography>
              </Alert>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

// ─── LoadingOverlay Component ─────────────────────────────────────────────────
const LoadingOverlay = ({ open, message = 'Processing...' }) => {
  if (!open) return null;
  return (
    <Backdrop open={open} sx={{ zIndex: 9999, color: '#fff', flexDirection: 'column', gap: 2, backgroundColor: 'rgba(0,0,0,0.8)' }}>
      <CircularProgress color="primary" size={60} />
      <Typography variant="h6" sx={{ color: 'white', textAlign: 'center' }}>{message}</Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Please do not close this window</Typography>
      <LinearProgress sx={{ width: '200px', mt: 2, backgroundColor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { backgroundColor: 'white' } }} />
    </Backdrop>
  );
};

// ─── Main MeetingForm Component ───────────────────────────────────────────────
const MeetingForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isEditMode = Boolean(id);
  const returnPath = location.state?.from || '/meetings';

  const initialParticipantsLoaded = useRef(false);

  const participantLists = useSelector(selectParticipantLists);
  const meetingParticipants = useSelector(selectMeetingParticipantsAll);
  const chairperson = useSelector(selectMeetingChairperson);
  const participantsLoading = useSelector(selectParticipantsLoading);
  const { isLoading: submitting, success, error: meetingError } = useSelector(state => state.meetings);

  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [selectedParticipantList, setSelectedParticipantList] = useState(null);
  const [showGpsDetails, setShowGpsDetails] = useState(false);
  const [formLoading, setFormLoading] = useState(isEditMode);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSupported, setGpsSupported] = useState(true);
  const [formDirty, setFormDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [recurrence, setRecurrence] = useState(null);
  
  // Attribute mappings state
  const [attributeMappings, setAttributeMappings] = useState({
    recurrenceTypes: {},
    recurrenceDays: {},
    recurrenceWeeks: {},
    statuses: {}
  });

  const [formData, setFormData] = useState({
    title: '', description: '', meeting_date: null, start_time: null, end_time: null,
    location_text: '', location_id: null, location_details: null, agenda: '',
    secretary_name: '', gps_latitude: '', gps_longitude: '',
  });

  const [newParticipant, setNewParticipant] = useState({
    name: '', email: '', telephone: '', title: '', organization: '', is_chairperson: false,
  });

  const apiLoading = submitting || participantsLoading || formLoading || isSubmitting;
  const chairpersonName = useMemo(() => chairperson?.name || 'Not selected', [chairperson]);
  const pageTitle = isEditMode ? 'Edit Meeting' : 'Create New Meeting';
  const pageSubtitle = isEditMode ? 'Update meeting details' : 'Fill in the details to schedule a new meeting';
  const isRecurring = useMemo(() => recurrence?.enabled === true, [recurrence]);
  const isValid = useMemo(() => formData.title.trim() && formData.meeting_date && formData.start_time, [formData.title, formData.meeting_date, formData.start_time]);

  // Fetch attribute mappings for recurring meetings
  useEffect(() => {
    const fetchAttributeMappings = async () => {
      try {
        console.log('🔍 Fetching attributes for group: RECURRING_MEETING');
        
        const response = await api.get('/attribute-groups/RECURRING_MEETING/attributes', {
          params: { 
            active_only: true,
            detail_level: 'limited',
            sort_by: 'sort_order',
            sort_order: 'asc',
            limit: 100
          }
        });
        
        console.log('📦 API Response:', response.data);
        
        const allAttributes = response.data?.items || [];
        console.log(`📊 Total attributes found: ${allAttributes.length}`);
        
        // Build maps - NOTE: use 'mextra_metadata' not 'extra_metadata'
        const typesMap = {};
        const daysMap = {};
        const weeksMap = {};
        const statusMap = {};
        
// In the fetchAttributeMappings function, ensure UUIDs keep their hyphens
// In the fetchAttributeMappings function, ensure ALL UUIDs are formatted
allAttributes.forEach(attr => {
  const code = attr.code;
  const metadata = attr.mextra_metadata || {};
  const value = metadata?.value;
  
  if (!value) return;
  
  // Ensure the ID is stored with hyphens - THIS IS CRITICAL
  const attributeId = attr.id;

  
  if (code && code.includes('RECURRENCE_TYPE_')) {
    typesMap[value] = attributeId;
    console.log(`  ✅ Mapped type: ${value} -> ${attributeId}`);
  }
  else if (code && code.includes('RECURRENCE_DAY_')) {
    daysMap[value] = attributeId;
    console.log(`  ✅ Mapped day: ${value} -> ${attributeId}`);
  }
  else if (code && code.includes('RECURRENCE_WEEK_')) {
    weeksMap[String(value)] = attributeId;
    console.log(`  ✅ Mapped week: ${value} -> ${attributeId}`);
  }
  else if (code && code.includes('RECURRING_STATUS_')) {
    statusMap[value] = attributeId;
    console.log(`  ✅ Mapped status: ${value} -> ${attributeId}`);
  }
});

        console.log('🎯 Final typesMap:', typesMap);
        console.log('🎯 Final daysMap:', daysMap);
        console.log('🎯 Final weeksMap:', weeksMap);
        console.log('🎯 Final statusMap:', statusMap);
        
        setAttributeMappings({
          recurrenceTypes: typesMap,
          recurrenceDays: daysMap,
          recurrenceWeeks: weeksMap,
          statuses: statusMap
        });
        
      } catch (error) {
        console.error('❌ Error fetching attribute mappings:', error);
        console.error('Error details:', error.response?.data);
      }
    };
    
    fetchAttributeMappings();
  }, []);

  // Fetch meeting for edit
  useEffect(() => {
    if (isEditMode && id && !initialParticipantsLoaded.current) {
      setFormLoading(true);
      dispatch(fetchMeetingById(id)).unwrap()
        .then(meeting => {
          if (meeting) {
            const meetingDate = new Date(meeting.meeting_date);
            const startTime = meeting.start_time ? new Date(meeting.start_time) : null;
            const endTime = meeting.end_time ? new Date(meeting.end_time) : null;
            setFormData({
              title: meeting.title || '', description: meeting.description || '', meeting_date: meetingDate,
              start_time: startTime, end_time: endTime,
              location_text: meeting.location_text || '', location_id: meeting.location_id || null,
              location_details: meeting.location_id ? { id: meeting.location_id, name: meeting.location_text, code: meeting.location_code, level: meeting.location_level, location_mode: meeting.location_mode } : null,
              agenda: meeting.agenda || '', secretary_name: meeting.secretary_name || '',
              gps_latitude: meeting.gps_coordinates?.split(',')[0] || '', gps_longitude: meeting.gps_coordinates?.split(',')[1] || '',
            });
            if (meeting.gps_coordinates) setGpsEnabled(true);
            dispatch(clearMeetingParticipants());
            if (meeting.participants?.length) {
              meeting.participants.forEach(p => dispatch(addCustomParticipant({ ...p, is_chairperson: p.is_chairperson || false, id: p.id || `participant-${Date.now()}-${Math.random()}` })));
              const chair = meeting.participants.find(p => p.is_chairperson === true);
              if (chair) setTimeout(() => dispatch(setMeetingChairperson(chair.id)), 150);
            }
            if (meeting.recurrence) setRecurrence(meeting.recurrence);
          }
          setFormLoading(false);
          initialParticipantsLoaded.current = true;
        })
        .catch(() => { setSnackbar({ open: true, message: 'Failed to load meeting data', severity: 'error' }); setFormLoading(false); });
    }
  }, [isEditMode, id, dispatch]);

  useEffect(() => {
    if (formData.secretary_name && meetingParticipants.length > 0) {
      if (!meetingParticipants.some(p => p.name === formData.secretary_name)) {
        setFormData(prev => ({ ...prev, secretary_name: '' }));
        setFormDirty(true);
      }
    }
  }, [meetingParticipants, formData.secretary_name]);

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
  }, [dispatch, success]);

  const handleChange = useCallback((e) => { setFormData(prev => ({ ...prev, [e.target.name]: e.target.value })); setFormDirty(true); }, []);
  const handleDateChange = useCallback((date) => { setFormData(prev => ({ ...prev, meeting_date: date })); setFormDirty(true); }, []);
  const handleStartTimeChange = useCallback((time) => { setFormData(prev => ({ ...prev, start_time: time })); setFormDirty(true); }, []);
  const handleEndTimeChange = useCallback((time) => { setFormData(prev => ({ ...prev, end_time: time })); setFormDirty(true); }, []);
  const handleAgendaChange = useCallback((e) => { setFormData(prev => ({ ...prev, agenda: e.target.value })); setFormDirty(true); }, []);
const handleLocationSelect = useCallback((loc) => {
  if (loc) {
    // Ensure the ID is stored with hyphens
    const locationId = loc.id; // This should already have hyphens
    setFormData(prev => ({ 
      ...prev, 
      location_id: locationId, 
      location_text: loc.name, 
      location_details: { 
        id: locationId, 
        name: loc.name, 
        code: loc.code, 
        level: loc.level, 
        location_mode: loc.location_mode 
      } 
    }));
  } else {
    setFormData(prev => ({ ...prev, location_id: null, location_text: '', location_details: null }));
  }
  setFormDirty(true);
}, []);

  const getCurrentLocation = useCallback(() => {
    if (!gpsSupported) { setSnackbar({ open: true, message: 'Geolocation is not supported', severity: 'error' }); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setFormData(prev => ({ ...prev, gps_latitude: pos.coords.latitude.toFixed(6), gps_longitude: pos.coords.longitude.toFixed(6) })); setGpsEnabled(true); setGpsLoading(false); setFormDirty(true); setSnackbar({ open: true, message: 'Location captured successfully', severity: 'success' }); },
      (err) => { const msg = err.code === 1 ? 'Permission denied' : err.code === 2 ? 'Position unavailable' : 'Request timed out'; setSnackbar({ open: true, message: msg, severity: 'error' }); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [gpsSupported]);

  const handleGpsToggle = useCallback((e) => {
    const enabled = e.target.checked;
    setGpsEnabled(enabled);
    if (!enabled) setFormData(prev => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
    else if (gpsSupported && !formData.gps_latitude) getCurrentLocation();
    setFormDirty(true);
  }, [gpsSupported, formData.gps_latitude, getCurrentLocation]);

  const handleAddCustomParticipant = useCallback(() => {
    if (!newParticipant.name.trim()) { setSnackbar({ open: true, message: 'Participant name is required', severity: 'warning' }); return; }
    dispatch(addCustomParticipant({ ...newParticipant, id: `temp-${Date.now()}-${Math.random()}`, is_custom: true }));
    setNewParticipant({ name: '', email: '', telephone: '', title: '', organization: '', is_chairperson: false });
    setShowAddParticipantDialog(false); setFormDirty(true);
    setSnackbar({ open: true, message: 'Participant added successfully', severity: 'success' });
  }, [dispatch, newParticipant]);

  const handleUseParticipantList = useCallback(() => {
    if (selectedParticipantList) {
      const list = participantLists.find(l => l.id === selectedParticipantList);
      if (list?.participants) {
        dispatch(addParticipantsFromListToMeeting({ listId: selectedParticipantList, participants: list.participants }));
        setFormDirty(true);
        setSnackbar({ open: true, message: `Added ${list.participants.length} participants from "${list.name}"`, severity: 'success' });
      }
      setSelectedParticipantList(null);
    }
  }, [selectedParticipantList, participantLists, dispatch]);

  const handleSetChairperson = useCallback((pid) => { dispatch(setMeetingChairperson(pid)); setFormDirty(true); setSnackbar({ open: true, message: 'Chairperson updated', severity: 'info' }); }, [dispatch]);
  const handleRemoveParticipant = useCallback((pid) => { dispatch(removeLocalMeetingParticipant(pid)); setFormDirty(true); setSnackbar({ open: true, message: 'Participant removed', severity: 'info' }); }, [dispatch]);

  const handleNext = useCallback(() => {
    if (activeStep === 0 && !isValid) { setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'warning' }); return; }
    setActiveStep(prev => prev + 1);
    safeScrollToTop();
  }, [activeStep, isValid]);

  const handleBack = useCallback(() => {
    if (activeStep === 0) navigate(returnPath);
    else setActiveStep(prev => prev - 1);
    safeScrollToTop();
  }, [activeStep, navigate, returnPath]);

  const handleCancel = useCallback(() => {
    if (formDirty) { if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) { dispatch(clearMeetingParticipants()); navigate(returnPath); } }
    else { dispatch(clearMeetingParticipants()); navigate(returnPath); }
  }, [formDirty, navigate, returnPath, dispatch]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) { 
      setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'warning' }); 
      setActiveStep(0); 
      safeScrollToTop(); 
      return; 
    }
    setIsSubmitting(true);
    setSubmitMessage(isEditMode ? 'Updating meeting...' : isRecurring ? 'Creating recurring meeting...' : 'Creating meeting...');
    
    console.log('🚀 Starting submission...');
    console.log('isRecurring:', isRecurring);
    console.log('recurrence:', recurrence);
    console.log('attributeMappings:', attributeMappings);
    
    try {
      const meetingDate = formData.meeting_date;
      const startDateTime = new Date(meetingDate);
      startDateTime.setHours(formData.start_time.getHours(), formData.start_time.getMinutes());
      let endDateTime = null;
      if (formData.end_time) { 
        endDateTime = new Date(meetingDate); 
        endDateTime.setHours(formData.end_time.getHours(), formData.end_time.getMinutes()); 
      }

      const chairpersonParticipant = meetingParticipants.find(p => p.is_chairperson === true);
      const meetingPayload = {
        title: formData.title, description: formData.description || null,
        meeting_date: startDateTime.toISOString(), start_time: startDateTime.toISOString(), end_time: endDateTime?.toISOString() || null,
        location_text: formData.location_text || null, location_id: formData.location_id,
        gps_coordinates: gpsEnabled && formData.gps_latitude && formData.gps_longitude ? `${formData.gps_latitude},${formData.gps_longitude}` : null,
        agenda: formData.agenda || null, secretary_name: formData.secretary_name || null, chairperson_name: chairpersonParticipant?.name || null,
        custom_participants: meetingParticipants.map(p => ({ name: p.name, email: p.email || null, telephone: p.telephone || null, title: p.title || null, organization: p.organization || null, is_chairperson: p.is_chairperson || false, is_secretary: p.name === formData.secretary_name })),
      };

      if (isRecurring && recurrence) {
        console.log('📅 Creating RECURRING meeting...');
        console.log('Recurrence type:', recurrence.type);
        console.log('Recurrence interval:', recurrence.interval);
        console.log('Recurrence days:', recurrence.days);
        
        const recurrenceTypeId = attributeMappings.recurrenceTypes[recurrence.type];
        const recurrenceDayIds = (recurrence.days || []).map(day => attributeMappings.recurrenceDays[day]).filter(id => id);
        const statusId = attributeMappings.statuses.active;
        
        console.log('Mapped recurrenceTypeId:', recurrenceTypeId);
        console.log('Mapped recurrenceDayIds:', recurrenceDayIds);
        console.log('Mapped statusId:', statusId);
        
        if (!recurrenceTypeId) {
          throw new Error(`Invalid recurrence type: ${recurrence.type}. Available types: ${Object.keys(attributeMappings.recurrenceTypes).join(', ')}`);
        }
        
        if (!statusId) {
          throw new Error('Status mapping not found. Available statuses: ' + Object.keys(attributeMappings.statuses).join(', '));
        }
        
        const recurringPayload = {
          ...meetingPayload,
          recurrence_type_id: recurrenceTypeId,
          recurrence_interval: recurrence.interval,
          recurrence_days: recurrenceDayIds,
          recurrence_day_of_month: recurrence.day_of_month === 'last' ? -1 : (recurrence.day_of_month || null),
          recurrence_end_date: recurrence.end_date || null,
          recurrence_max_occurrences: recurrence.max_occurrences || null,
          status_id: statusId,
        };
        
        console.log('📤 Sending recurring payload:', JSON.stringify(recurringPayload, null, 2));
        const response = await api.post('/recurring-meetings/', recurringPayload);
        console.log('✅ Recurring meeting created:', response.data);
        setSnackbar({ open: true, message: 'Recurring meeting created successfully!', severity: 'success' });
      } else if (isEditMode) { 
        console.log('📝 Updating meeting...');
        await dispatch(updateMeeting({ id, data: meetingPayload })).unwrap(); 
        setSnackbar({ open: true, message: 'Meeting updated successfully!', severity: 'success' });
      } else { 
        console.log('📝 Creating single meeting...');
        await dispatch(createMeeting(meetingPayload)).unwrap(); 
        setSnackbar({ open: true, message: 'Meeting created successfully!', severity: 'success' });
      }

      dispatch(clearMeetingParticipants());
      setTimeout(() => { 
        setIsSubmitting(false); 
        navigate(returnPath, { replace: true }); 
      }, 1500);
    } catch (error) {
      console.error('❌ Submit error:', error);
      console.error('Error response:', error.response?.data);
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.detail || error.message || `Failed to ${isEditMode ? 'update' : 'create'} meeting.`, 
        severity: 'error' 
      });
      setIsSubmitting(false); 
      setSubmitMessage('');
    }
  }, [formData, gpsEnabled, meetingParticipants, isEditMode, id, dispatch, isValid, navigate, returnPath, isRecurring, recurrence, attributeMappings]);

  if (formLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <LoadingOverlay open={isSubmitting} message={submitMessage} />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 10, sm: 4 } }}>
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={handleCancel}><ArrowBackIcon /></IconButton>
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>{pageTitle}</Typography>
              <IconButton edge="end" onClick={handleCancel}><CloseIcon /></IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
          {!isMobile && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="primary">{pageTitle}</Typography>
                <Typography variant="body2" color="text.secondary">{pageSubtitle}</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel} disabled={apiLoading}>Cancel</Button>
                {isEditMode && <Button variant="outlined" color="info" startIcon={<VisibilityIcon />} onClick={() => navigate(`/meetings/${id}`)}>View Meeting</Button>}
              </Stack>
            </Box>
          )}

          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 2, md: 3 }, position: 'relative', overflow: 'hidden' }}>
            <Stepper activeStep={activeStep} sx={{ mb: 4, display: isMobile ? 'none' : 'flex' }}>
              {steps.map((step, index) => (
                <Step key={index}>
                  <StepLabel>
                    <Typography variant="body2" fontWeight={600}>{step.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{step.description}</Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Step 1: Meeting Details */}
            {activeStep === 0 && (
              <Stack spacing={2.5}>
                <TextField
                  fullWidth label="Meeting Title *" name="title" required
                  value={formData.title} onChange={handleChange} disabled={apiLoading}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><EventIcon color="action" /></InputAdornment> } }}
                />
                <TextField
                  fullWidth label="Description" name="description" multiline rows={isMobile ? 2 : 3}
                  value={formData.description} onChange={handleChange} disabled={apiLoading}
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker label="Meeting Date *" value={formData.meeting_date} onChange={handleDateChange} slotProps={{ textField: { fullWidth: true, required: true } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TimePicker label="Start Time *" value={formData.start_time} onChange={handleStartTimeChange} slotProps={{ textField: { fullWidth: true, required: true } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TimePicker label="End Time" value={formData.end_time} onChange={handleEndTimeChange} slotProps={{ textField: { fullWidth: true } }} />
                  </Grid>
                </Grid>

                <LocationSearch value={formData.location_details} onChange={handleLocationSelect} onClear={() => handleLocationSelect(null)} />

                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardActionArea onClick={() => setShowGpsDetails(!showGpsDetails)}>
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {gpsEnabled ? <GpsFixedIcon color="success" /> : <GpsNotFixedIcon color="disabled" />}
                        <Typography variant="subtitle1" fontWeight="bold">GPS Coordinates (Optional)</Typography>
                      </Box>
                      <Switch checked={gpsEnabled} onChange={handleGpsToggle} onClick={e => e.stopPropagation()} />
                    </Box>
                  </CardActionArea>
                  {showGpsDetails && gpsEnabled && (
                    <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                      <Stack spacing={2}>
                        <Button size="small" variant="contained" startIcon={<MyLocationIcon />} onClick={getCurrentLocation} disabled={gpsLoading}>
                          {gpsLoading ? <CircularProgress size={20} /> : 'Get Current Location'}
                        </Button>
                        <TextField fullWidth label="Latitude" value={formData.gps_latitude} onChange={e => setFormData(prev => ({ ...prev, gps_latitude: e.target.value }))} size="small" placeholder="e.g., 0.3136" />
                        <TextField fullWidth label="Longitude" value={formData.gps_longitude} onChange={e => setFormData(prev => ({ ...prev, gps_longitude: e.target.value }))} size="small" placeholder="e.g., 32.5811" />
                      </Stack>
                    </Box>
                  )}
                </Card>

                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Agenda</Typography>
                  <TextField
                    fullWidth multiline rows={8} name="agenda" value={formData.agenda}
                    onChange={handleAgendaChange} disabled={apiLoading}
                    placeholder="Enter meeting agenda..."
                    helperText="Enter the meeting agenda here"
                  />
                </Box>
              </Stack>
            )}

            {/* Step 2: Participants */}
            {activeStep === 1 && (
              <Stack spacing={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>📋 Add from Participant List</Typography>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Select Participant List</InputLabel>
                      <Select value={selectedParticipantList || ''} onChange={e => setSelectedParticipantList(e.target.value)} label="Select Participant List" disabled={apiLoading}>
                        {participantLists.map(list => <MenuItem key={list.id} value={list.id}>{list.name} ({list.participants?.length || 0} participants)</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Button fullWidth variant="contained" onClick={handleUseParticipantList} disabled={!selectedParticipantList || apiLoading}>Add Selected List</Button>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">👤 Individual Participants ({meetingParticipants.length})</Typography>
                      <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setShowAddParticipantDialog(true)} disabled={apiLoading}>Add Participant</Button>
                    </Box>
                    {meetingParticipants.length === 0 ? (
                      <Alert severity="info" variant="outlined">No participants added yet.</Alert>
                    ) : (
                      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                        {meetingParticipants.map(p => (
                          <React.Fragment key={p.id}>
                            <ParticipantItem participant={p} onRemove={handleRemoveParticipant} onMakeChairperson={handleSetChairperson} isChairperson={p.is_chairperson} isSecretary={p.name === formData.secretary_name} showActions={!apiLoading} />
                            <Divider component="li" />
                          </React.Fragment>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                      <SecretaryIcon color="secondary" />
                      <Typography variant="subtitle1" fontWeight="bold">Designate Secretary</Typography>
                    </Stack>
                    <FormControl fullWidth>
                      <InputLabel>Select Secretary from Participants</InputLabel>
                      <Select name="secretary_name" value={formData.secretary_name} onChange={handleChange} label="Select Secretary from Participants" disabled={apiLoading || meetingParticipants.length === 0}>
                        <MenuItem value=""><em>None Selected</em></MenuItem>
                        {meetingParticipants.map(p => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Step 3: Recurrence */}
            {activeStep === 2 && (
              <RecurrenceSection recurrence={recurrence} setRecurrence={setRecurrence} />
            )}

            {/* Step 4: Review */}
            {activeStep === 3 && (
              <Stack spacing={2}>
                <Alert severity="info" icon={<CheckCircleIcon />}>{isEditMode ? 'Review meeting details before updating' : 'Review meeting details before creating'}</Alert>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="primary" gutterBottom>Meeting Information</Typography>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2"><strong>Title:</strong> {formData.title}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2"><strong>Chairperson:</strong> {chairpersonName}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2" color="secondary.main"><strong>Secretary:</strong> {formData.secretary_name || 'Not selected'}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography variant="body2"><strong>Location:</strong> {formData.location_text || 'Not specified'}</Typography></Grid>
                      {formData.location_details && <Grid size={{ xs: 12 }}><Typography variant="body2"><strong>Location Type:</strong> {formData.location_details.location_mode} – Level {formData.location_details.level}</Typography></Grid>}
                      {formData.meeting_date && formData.start_time && <Grid size={{ xs: 12 }}><Typography variant="body2"><strong>Date & Time:</strong> {formData.meeting_date?.toLocaleDateString()} at {formData.start_time?.toLocaleTimeString()}{formData.end_time && ` – ${formData.end_time?.toLocaleTimeString()}`}</Typography></Grid>}
                      {gpsEnabled && formData.gps_latitude && formData.gps_longitude && <Grid size={{ xs: 12 }}><Typography variant="body2"><strong>GPS:</strong> {formData.gps_latitude}, {formData.gps_longitude}</Typography></Grid>}
                      {isRecurring && recurrence && <Grid size={{ xs: 12 }}><Chip icon={<RepeatIcon />} label={`Recurring: ${recurrence.type} (every ${recurrence.interval})`} color="primary" size="medium" /></Grid>}
                    </Grid>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom>Agenda Preview</Typography>
                    <Box sx={{ maxHeight: 150, overflow: 'auto', fontSize: '0.875rem', p: 1, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap' }}>{formData.agenda || 'No agenda provided'}</Box>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom>Participants ({meetingParticipants.length})</Typography>
                    <Box component="ul" sx={{ pl: 2, mt: 1, maxHeight: 150, overflow: 'auto' }}>
                      {meetingParticipants.slice(0, 10).map(p => <li key={p.id}><Typography variant="body2">{p.name}{p.is_chairperson && ' (Chairperson)'}{p.name === formData.secretary_name && ' (Secretary)'}</Typography></li>)}
                      {meetingParticipants.length > 10 && <li><Typography variant="body2">…and {meetingParticipants.length - 10} more</Typography></li>}
                    </Box>
                  </CardContent>
                </Card>
                <Button variant="contained" size="large" onClick={handleSubmit} startIcon={isEditMode ? <UpdateIcon /> : <SaveIcon />} disabled={apiLoading} sx={{ py: 1.5, bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>
                  {apiLoading ? <CircularProgress size={24} /> : (isEditMode ? 'Update Meeting' : (isRecurring ? 'Create Recurring Meeting' : 'Create Meeting'))}
                </Button>
              </Stack>
            )}

            {/* Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button onClick={handleBack} startIcon={<ArrowBackIcon />} disabled={apiLoading}>
                {activeStep === 0 ? 'Cancel' : 'Back'}
              </Button>
              {activeStep < 3 && (
                <Button variant="contained" onClick={handleNext} endIcon={<ArrowForwardIcon />} disabled={apiLoading || (activeStep === 0 && !isValid)} sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>
                  Next
                </Button>
              )}
            </Box>
          </Paper>
        </Container>

        {/* Add Participant Dialog */}
        <Dialog open={showAddParticipantDialog} onClose={() => setShowAddParticipantDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add New Participant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth label="Full Name *" value={newParticipant.name} onChange={e => setNewParticipant(prev => ({ ...prev, name: e.target.value }))} required size="small" autoFocus />
              <TextField fullWidth label="Email" value={newParticipant.email} onChange={e => setNewParticipant(prev => ({ ...prev, email: e.target.value }))} type="email" size="small" />
              <TextField fullWidth label="Telephone" value={newParticipant.telephone} onChange={e => setNewParticipant(prev => ({ ...prev, telephone: e.target.value }))} size="small" />
              <TextField fullWidth label="Title" value={newParticipant.title} onChange={e => setNewParticipant(prev => ({ ...prev, title: e.target.value }))} size="small" />
              <TextField fullWidth label="Organization" value={newParticipant.organization} onChange={e => setNewParticipant(prev => ({ ...prev, organization: e.target.value }))} size="small" />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddParticipantDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddCustomParticipant} disabled={!newParticipant.name.trim()} sx={{ bgcolor: '#7C3AED' }}>Add Participant</Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open} autoHideDuration={4000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        >
          <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default React.memo(MeetingForm);