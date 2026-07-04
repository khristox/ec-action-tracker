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
  ListItemIcon, ListItemButton, LinearProgress, Backdrop,
  Tooltip, Collapse, Skeleton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, Save as Save,
  Repeat as RepeatIcon, LocationOn as LocationIcon,
  Schedule as ScheduleIcon, Cancel as Cancel,
  Event as EventIcon, Update as UpdateIcon,
  Preview as PreviewIcon, Today as TodayIcon,
  Close as Close, ChevronRight as ChevronRightIcon,
  CheckCircle as CheckCircleIcon, Info as InfoIcon,
  Public as PublicIcon, Flag as FlagIcon, Terrain as TerrainIcon,
  Home as HomeIcon, Business as BusinessIcon, Apartment as ApartmentIcon,
  MeetingRoom as MeetingRoomIcon, EventSeat as EventSeatIcon,
  Search as SearchIcon, ExpandMore as ExpandMoreIcon,
  DomainOutlined as StructureIcon, Warning as WarningIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, addWeeks, addMonths, addYears, getDaysInMonth, isAfter, isBefore } from 'date-fns';
import api from '../../../services/api';

// Import day mapping utilities
import { 
  fetchDayAttributes, 
  mapDaysToUUIDsSync, 
  mapUUIDsToDaysSync, 
  getDayOptionsSync,
  isDayMappingLoaded,
  areDaysUUIDs
} from '../../../utils/dayMapping';

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

const END_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'after', label: 'After X occurrences' },
  { value: 'on',    label: 'On date' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: '#10B981' },
  { value: 'paused', label: 'Paused', color: '#F59E0B' },
  { value: 'completed', label: 'Completed', color: '#3B82F6' },
  { value: 'cancelled', label: 'Cancelled', color: '#EF4444' },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

const hexAlpha = (hex, a) => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `rgba(${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}, ${a})` : hex;
};

const getLevelInfo = (loc) =>
  loc?.location_mode === 'buildings'
    ? BUILDING_LEVELS.find(l => l.level === loc.level)
    : ADDRESS_LEVELS.find(l => l.level === loc?.level);

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

const validateRecurrence = (formData) => {
  const errors = [];
  
  if (!formData.title?.trim()) {
    errors.push('Title is required');
  }
  
  if (!formData.start_time) {
    errors.push('Start time is required');
  }
  
  if (formData.recurrence_type === 'weekly' || formData.recurrence_type === 'biweekly') {
    if (!formData.recurrence_days || formData.recurrence_days.length === 0) {
      errors.push('Please select at least one day for weekly recurrence');
    }
  }
  
  if (formData.recurrence_type === 'monthly') {
    const dom = formData.recurrence_day_of_month;
    if (!dom || dom < 1 || dom > 31) {
      errors.push('Day of month must be between 1 and 31');
    }
  }
  
  if (formData.recurrence_end_option === 'after') {
    const occurrences = formData.recurrence_max_occurrences;
    if (!occurrences || occurrences < 1) {
      errors.push('Number of occurrences must be at least 1');
    }
  }
  
  if (formData.recurrence_end_option === 'on' && formData.recurrence_end_date) {
    if (isBefore(formData.recurrence_end_date, formData.start_time)) {
      errors.push('End date must be after start date');
    }
  }
  
  if (formData.end_time && isBefore(formData.end_time, formData.start_time)) {
    errors.push('End time must be after start time');
  }
  
  return errors;
};

// ─── LocationSearch Component ─────────────────────────────────────────────────

const HierarchyNode = React.memo(({ node, depth, locationMode, onSelect, selectedId }) => {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const levelInfo = getLevelInfo(node);
  const isSelected = selectedId === node.id;
  const maxLevel = locationMode === 'buildings' ? 14 : 7;
  const hasChildren = node.level < maxLevel;

  const handleToggle = useCallback(async (e) => {
    e.stopPropagation();
    if (!open && !loaded) {
      setLoading(true);
      try {
        const params = new URLSearchParams({ 
          skip: 0, 
          limit: 100, 
          location_mode: locationMode, 
          parent_id: node.id, 
          include_inactive: false 
        });
        const res = await api.get(`/locations/?${params}`);
        setChildren(res.data?.items || res.data || []);
        setLoaded(true);
      } catch (error) {
        console.error('Failed to load children:', error);
      } finally {
        setLoading(false);
      }
    }
    setOpen(v => !v);
  }, [open, loaded, locationMode, node.id]);

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
        {hasChildren && (
          <IconButton 
            size="small" 
            onClick={handleToggle} 
            sx={{ mr: 0.5, p: 0.25, color: 'text.secondary' }}
          >
            {loading ? (
              <CircularProgress size={14} />
            ) : open ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
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
          {children.map(child => (
            <HierarchyNode 
              key={child.id} 
              node={child} 
              depth={depth + 1}
              locationMode={locationMode} 
              onSelect={onSelect} 
              selectedId={selectedId} 
            />
          ))}
        </Box>
      )}
    </Box>
  );
});

const LocationSearch = React.memo(({ value, onChange, onClear }) => {
  const theme = useTheme();
  const [locMode, setLocMode] = useState('address');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addrRoots, setAddrRoots] = useState([]);
  const [bldgRoots, setBldgRoots] = useState([]);
  const [rootsLoading, setRootsLoading] = useState(false);
  const [rootsLoaded, setRootsLoaded] = useState({ address: false, structure: false });
  const [selected, setSelected] = useState(value || null);
  const [hierarchy, setHierarchy] = useState([]);

  useEffect(() => {
    if (value !== selected) setSelected(value);
  }, [value]);

  useEffect(() => {
    if (selected?.id) {
      loadHierarchy(selected.id);
    } else {
      setHierarchy([]);
    }
  }, [selected?.id]);

  useEffect(() => {
    const apiMode = locMode === 'structure' ? 'buildings' : 'address';
    if (rootsLoaded[locMode]) return;
    
    const loadRoots = async () => {
      setRootsLoading(true);
      try {
        const params = new URLSearchParams({ 
          skip: 0, 
          limit: 100, 
          location_mode: apiMode, 
          include_inactive: false 
        });
        const res = await api.get(`/locations/?${params}`);
        const items = res.data?.items || res.data || [];
        
        if (locMode === 'address') {
          setAddrRoots(items);
        } else {
          setBldgRoots(items);
        }
        setRootsLoaded(prev => ({ ...prev, [locMode]: true }));
      } catch (error) {
        console.error('Failed to load roots:', error);
      } finally {
        setRootsLoading(false);
      }
    };
    
    loadRoots();
  }, [locMode, rootsLoaded]);

  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const apiMode = locMode === 'structure' ? 'buildings' : 'address';
        const params = new URLSearchParams({ 
          search, 
          location_mode: apiMode, 
          limit: 50, 
          include_inactive: false 
        });
        const res = await api.get(`/locations/?${params}`);
        setResults(res.data?.items || res.data || []);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    
    return () => clearTimeout(timeoutId);
  }, [search, locMode]);

  const loadHierarchy = async (id) => {
    try {
      const [ancestorsRes, selfRes] = await Promise.all([
        api.get(`/locations/${id}/ancestors`),
        api.get(`/locations/${id}`)
      ]);
      
      const ancestors = ancestorsRes.data || [];
      const self = selfRes.data;
      
      setHierarchy(self ? [...ancestors, self] : ancestors);
    } catch (error) {
      console.error('Failed to load hierarchy:', error);
      setHierarchy(selected ? [selected] : []);
    }
  };

  const handleSelect = (location) => {
    setSelected(location);
    setSearch('');
    setResults([]);
    onChange(location);
  };

  const handleClear = () => {
    setSelected(null);
    setHierarchy([]);
    onChange(null);
    if (onClear) onClear();
  };

  const roots = locMode === 'address' ? addrRoots : bldgRoots;
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
            {selected && (
              <Chip 
                label="Location selected" 
                size="small" 
                color="success" 
                onDelete={handleClear}
              />
            )}
          </Stack>

          <ToggleButtonGroup 
            value={locMode} 
            exclusive 
            size="small" 
            fullWidth
            onChange={(_, newValue) => {
              if (newValue) {
                setLocMode(newValue);
                setSearch('');
                setResults([]);
              }
            }}
          >
            <ToggleButton value="address">
              <PublicIcon sx={{ mr: 0.75, fontSize: 18 }} />
              Address
            </ToggleButton>
            <ToggleButton value="structure">
              <StructureIcon sx={{ mr: 0.75, fontSize: 18 }} />
              Structure
            </ToggleButton>
          </ToggleButtonGroup>

          <TextField
            fullWidth
            placeholder="Search location…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searching && <CircularProgress size={18} />,
              },
            }}
          />

          {results.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 240, overflow: 'auto', borderRadius: 1.5 }}>
              <List dense disablePadding>
                {results.map(result => {
                  const levelInfo = getLevelInfo(result);
                  return (
                    <ListItemButton 
                      key={result.id} 
                      onClick={() => handleSelect(result)} 
                      selected={selected?.id === result.id} 
                      sx={{ py: 0.75 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, color: levelInfo?.color }}>
                        {levelInfo?.icon || <LocationIcon fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary={result.name} 
                        secondary={`${result.code} · ${levelInfo?.name || `Level ${result.level}`}`} 
                      />
                      {selected?.id === result.id && <CheckCircleIcon fontSize="small" color="success" />}
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          )}

          {!search && (
            <>
              <Typography variant="caption" color="text.secondary">
                Or browse the hierarchy:
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 320, overflow: 'auto', borderRadius: 1.5, p: 0.5 }}>
                {rootsLoading ? (
                  <Stack spacing={1} sx={{ p: 1.5 }}>
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} variant="rounded" height={36} />
                    ))}
                  </Stack>
                ) : roots.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.disabled">
                      No items found
                    </Typography>
                  </Box>
                ) : (
                  <List dense disablePadding>
                    {roots.map(root => (
                      <HierarchyNode 
                        key={root.id} 
                        node={root} 
                        depth={0} 
                        locationMode={apiMode}
                        onSelect={handleSelect} 
                        selectedId={selected?.id} 
                      />
                    ))}
                  </List>
                )}
              </Paper>
            </>
          )}

          {selected && hierarchy.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Selected path:
              </Typography>
              <Breadcrumbs separator={<ChevronRightIcon sx={{ fontSize: 14 }} />}>
                {hierarchy.map(item => {
                  const levelInfo = getLevelInfo(item);
                  return (
                    <Chip 
                      key={item.id} 
                      label={item.name} 
                      size="small" 
                      icon={levelInfo?.icon}
                      sx={{
                        bgcolor: hexAlpha(levelInfo?.color || theme.palette.primary.main, 0.1),
                        border: '1px solid',
                        borderColor: levelInfo?.color || theme.palette.primary.main,
                        color: levelInfo?.color || theme.palette.primary.main,
                        fontWeight: 500,
                      }}
                    />
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

// ─── Loading Overlay ─────────────────────────────────────────────────────────

const LoadingOverlay = ({ open, message }) => (
  <Backdrop open={open} sx={{ zIndex: 9999, color: '#fff', flexDirection: 'column', gap: 2, bgcolor: 'rgba(0,0,0,0.85)' }}>
    <CircularProgress color="inherit" size={56} />
    <Typography variant="h6" textAlign="center">{message || 'Processing…'}</Typography>
    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
      Please do not close this window
    </Typography>
    <LinearProgress sx={{ width: 200, mt: 1, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }} />
  </Backdrop>
);

// ─── Confirmation Dialog ─────────────────────────────────────────────────────

const ConfirmationDialog = ({ open, onClose, onConfirm, title, message }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>
      <Stack direction="row" alignItems="center" spacing={1}>
        <WarningIcon color="warning" />
        <Typography variant="h6">{title || 'Confirm Changes'}</Typography>
      </Stack>
    </DialogTitle>
    <DialogContent>
      <Typography>{message || 'Are you sure you want to save these changes?'}</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={onConfirm} variant="contained" color="primary">
        Confirm
      </Button>
    </DialogActions>
  </Dialog>
);

// ─── Main Component ─────────────────────────────────────────────────────────

const EditRecurringMeeting = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [dayOptions, setDayOptions] = useState([]);
  const [mappingsReady, setMappingsReady] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location_id: null,
    location_text: '',
    location_details: null,
    recurrence_interval: 1,
    recurrence_type: 'weekly',
    recurrence_days: [],
    recurrence_day_of_month: 1,
    start_time: null,
    end_time: null,
    recurrence_end_date: null,
    recurrence_max_occurrences: null,
    recurrence_end_option: 'never',
    status: 'active',
  });

  // Load day mappings on mount
  useEffect(() => {
    const loadDayMappings = async () => {
      try {
        await fetchDayAttributes();
        const options = getDayOptionsSync();
        setDayOptions(options);
        setMappingsReady(true);
      } catch (error) {
        console.error('Failed to load day mappings:', error);
        setSnackbar({ 
          open: true, 
          message: 'Failed to load day configurations. Please refresh the page.', 
          severity: 'error' 
        });
      }
    };
    loadDayMappings();
  }, []);

  // Load meeting data
  const loadMeeting = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/recurring-meetings/${id}`);
      const data = response.data?.data || response.data;

      // Wait for mappings to be ready if needed
      if (!isDayMappingLoaded() && !mappingsReady) {
        await fetchDayAttributes();
      }

      // Convert recurrence_days from UUIDs to day names for UI
      let recurrenceDays = data.recurrence_days || [];
      if (recurrenceDays.length > 0 && areDaysUUIDs(recurrenceDays)) {
        recurrenceDays = mapUUIDsToDaysSync(recurrenceDays);
      }

      // Determine end option
      let endOption = 'never';
      if (data.recurrence_end_date) {
        endOption = 'on';
      } else if (data.recurrence_max_occurrences) {
        endOption = 'after';
      }

      // Build location details
      let locationDetails = null;
      if (data.location_id) {
        try {
          const locResponse = await api.get(`/locations/${data.location_id}`);
          locationDetails = locResponse.data || null;
        } catch (error) {
          console.error('Failed to load location details:', error);
          locationDetails = { 
            id: data.location_id, 
            name: data.location_text || data.location_id 
          };
        }
      }

      setFormData({
        title: data.title || '',
        description: data.description || '',
        location_id: data.location_id || null,
        location_text: data.location_text || '',
        location_details: locationDetails,
        recurrence_interval: data.recurrence_interval || 1,
        recurrence_type: data.recurrence_type || 'weekly',
        recurrence_days: recurrenceDays,
        recurrence_day_of_month: data.recurrence_day_of_month || 1,
        start_time: data.start_time ? new Date(data.start_time) : null,
        end_time: data.end_time ? new Date(data.end_time) : null,
        recurrence_end_date: data.recurrence_end_date ? new Date(data.recurrence_end_date) : null,
        recurrence_max_occurrences: data.recurrence_max_occurrences || null,
        recurrence_end_option: endOption,
        status: data.status || 'active',
      });
    } catch (err) {
      console.error('Failed to load meeting:', err);
      setError(err.response?.data?.detail || 'Failed to load meeting data');
    } finally {
      setLoading(false);
    }
  }, [id, mappingsReady]);

  useEffect(() => {
    if (mappingsReady) {
      loadMeeting();
    }
  }, [loadMeeting, mappingsReady]);

  // Field update helpers
  const updateField = useCallback((field) => (value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleTextFieldChange = useCallback((field) => (event) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
  }, []);

  const handleNumberFieldChange = useCallback((field) => (event) => {
    const value = event.target.value === '' ? null : parseInt(event.target.value, 10);
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleDay = useCallback((dayValue) => {
    setFormData(prev => ({
      ...prev,
      recurrence_days: prev.recurrence_days.includes(dayValue)
        ? prev.recurrence_days.filter(d => d !== dayValue)
        : [...prev.recurrence_days, dayValue],
    }));
  }, []);

  const handleLocationSelect = useCallback((location) => {
    if (location) {
      setFormData(prev => ({
        ...prev,
        location_id: location.id,
        location_text: location.name,
        location_details: location,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        location_id: null,
        location_text: '',
        location_details: null,
      }));
    }
  }, []);

  // Preview dates calculation
  const previewDates = useMemo(() => {
    if (!showPreview || !formData.start_time) return [];
    
    const { recurrence_type, recurrence_interval, recurrence_days, recurrence_day_of_month } = formData;
    let endDate = null;
    let maxOccurrences = 10;
    
    if (formData.recurrence_end_option === 'on' && formData.recurrence_end_date) {
      endDate = formData.recurrence_end_date;
    } else if (formData.recurrence_end_option === 'after' && formData.recurrence_max_occurrences) {
      maxOccurrences = Math.min(formData.recurrence_max_occurrences, 10);
    }
    
    const config = {
      type: recurrence_type,
      interval: recurrence_interval,
      days: recurrence_days,
      day_of_month: recurrence_day_of_month,
      end_date: endDate,
      max_occurrences: maxOccurrences,
    };
    
    // Simple preview calculation
    const dates = [];
    const start = new Date(formData.start_time);
    let current = new Date(start);
    
    for (let i = 0; i < maxOccurrences && dates.length < 10; i++) {
      switch (recurrence_type) {
        case 'daily':
          current = addDays(current, recurrence_interval);
          break;
        case 'weekly':
          current = addWeeks(current, recurrence_interval);
          break;
        case 'biweekly':
          current = addWeeks(current, recurrence_interval * 2);
          break;
        case 'monthly':
          current = addMonths(current, recurrence_interval);
          if (recurrence_day_of_month) {
            const lastDay = getDaysInMonth(current);
            current.setDate(Math.min(recurrence_day_of_month, lastDay));
          }
          break;
        case 'quarterly':
          current = addMonths(current, 3 * recurrence_interval);
          break;
        case 'yearly':
          current = addYears(current, recurrence_interval);
          break;
        default:
          return [];
      }
      
      if (endDate && isAfter(current, endDate)) break;
      dates.push(new Date(current));
    }
    
    return dates;
  }, [showPreview, formData]);

  const recurrenceLabel = useMemo(() => 
    getRecurrenceLabel(formData.recurrence_type, formData.recurrence_interval, formData.recurrence_days),
    [formData.recurrence_type, formData.recurrence_interval, formData.recurrence_days]
  );

  const showDays = formData.recurrence_type === 'weekly' || formData.recurrence_type === 'biweekly';
  const showDom = formData.recurrence_type === 'monthly';

  // Form submission
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    const errors = validateRecurrence(formData);
    if (errors.length > 0) {
      setSnackbar({ 
        open: true, 
        message: errors.join(' · '), 
        severity: 'warning' 
      });
      return;
    }
    
    setPendingSubmit(true);
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmDialog(false);
    setSaving(true);
    
    try {
      // Ensure day mappings are loaded
      if (!isDayMappingLoaded()) {
        await fetchDayAttributes();
      }
      
      // Convert day names to UUIDs for API submission
      const daysAsUUIDs = mapDaysToUUIDsSync(formData.recurrence_days);
      
      const payload = {
        title: formData.title.trim(),
        description: formData.description || null,
        location_id: formData.location_id || null,
        location_text: formData.location_text || null,
        recurrence_interval: formData.recurrence_interval,
        recurrence_type: formData.recurrence_type,
        recurrence_days: daysAsUUIDs,
        recurrence_day_of_month: formData.recurrence_day_of_month,
        start_time: formData.start_time?.toISOString() || null,
        end_time: formData.end_time?.toISOString() || null,
        recurrence_end_date: formData.recurrence_end_option === 'on'
          ? formData.recurrence_end_date?.toISOString() || null
          : null,
        recurrence_max_occurrences: formData.recurrence_end_option === 'after'
          ? formData.recurrence_max_occurrences
          : null,
        status: formData.status,
      };
      
      await api.put(`/recurring-meetings/${id}`, payload);
      
      setSnackbar({ 
        open: true, 
        message: 'Recurring meeting updated successfully!', 
        severity: 'success' 
      });
      
      setTimeout(() => navigate(`/recurring-meetings/${id}`), 1500);
    } catch (err) {
      console.error('Failed to update meeting:', err);
      const detail = err.response?.data?.detail;
      let message = 'Failed to update recurring meeting';
      
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail.map(error => {
          const field = Array.isArray(error.loc) 
            ? error.loc.filter(x => x !== 'body').join(' → ')
            : '';
          return field ? `${field}: ${error.msg}` : error.msg;
        }).join(' · ');
      }
      
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSaving(false);
      setPendingSubmit(false);
    }
  };

  const handleCancel = () => {
    navigate(`/recurring-meetings/${id}`);
  };

  // Loading state
  if (loading || !mappingsReady) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={56} />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button size="small" onClick={loadMeeting} color="inherit">
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/meetings')} 
          sx={{ mt: 2 }} 
          variant="outlined"
        >
          Back to Meetings
        </Button>
      </Box>
    );
  }

  // Main render
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <LoadingOverlay open={saving} message="Updating recurring meeting…" />
      
      <ConfirmationDialog
        open={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setPendingSubmit(false);
        }}
        onConfirm={handleConfirmSubmit}
        title="Save Changes"
        message="Are you sure you want to save these changes? This will affect all future occurrences of this recurring meeting series."
      />

      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 10, sm: 4 } }}>
        {/* Mobile App Bar */}
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={handleCancel}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>
                Edit Recurring Meeting
              </Typography>
              <IconButton edge="end" onClick={handleCancel}>
                <Close />
              </IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
          {/* Desktop Header */}
          {!isMobile && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="primary">
                  Edit Recurring Meeting
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Update the recurring meeting series details
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button 
                  variant="outlined" 
                  startIcon={<Cancel />} 
                  onClick={handleCancel} 
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button 
                  variant="outlined" 
                  color="info" 
                  startIcon={<EventIcon />} 
                  onClick={() => navigate(`/recurring-meetings/${id}`)}
                  disabled={saving}
                >
                  View Series
                </Button>
              </Stack>
            </Box>
          )}

          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 2, md: 3 } }}>
            <form onSubmit={handleSubmit}>
              <Stack spacing={3.5}>
                {/* Basic Information */}
                <Box>
                  <Typography variant="h6" fontWeight={700} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <EventIcon /> Basic Information
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      required
                      fullWidth
                      label="Meeting Title"
                      value={formData.title}
                      onChange={handleTextFieldChange('title')}
                      disabled={saving}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <EventIcon color="action" />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Description"
                      value={formData.description}
                      onChange={handleTextFieldChange('description')}
                      disabled={saving}
                      placeholder="Describe the purpose of this meeting series"
                    />
                    
                    {/* Status Selector */}
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={formData.status}
                        onChange={handleTextFieldChange('status')}
                        label="Status"
                        disabled={saving}
                      >
                        {STATUS_OPTIONS.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: option.color }} />
                              <Typography>{option.label}</Typography>
                            </Stack>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                </Box>

                <Divider />

                {/* Location */}
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
                    fullWidth
                    label="Custom location text (optional)"
                    sx={{ mt: 2 }}
                    value={formData.location_text}
                    onChange={handleTextFieldChange('location_text')}
                    disabled={saving}
                    placeholder="e.g. Zoom link, Conference Room B"
                    helperText="Overrides the selected location label above"
                  />
                </Box>

                <Divider />

                {/* Schedule */}
                <Box>
                  <Typography variant="h6" fontWeight={700} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <ScheduleIcon /> Schedule
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DateTimePicker
                        label="Start Time *"
                        value={formData.start_time}
                        onChange={updateField('start_time')}
                        disabled={saving}
                        slotProps={{
                          textField: { 
                            fullWidth: true, 
                            required: true,
                            helperText: 'When does the meeting typically start?' 
                          },
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DateTimePicker
                        label="End Time"
                        value={formData.end_time}
                        onChange={updateField('end_time')}
                        disabled={saving}
                        slotProps={{
                          textField: { 
                            fullWidth: true, 
                            helperText: 'When does the meeting typically end?' 
                          },
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Recurrence Pattern */}
                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={2}>
                    <Typography variant="h6" fontWeight={700} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RepeatIcon /> Recurrence Pattern
                    </Typography>
                    <Chip 
                      icon={<RepeatIcon />} 
                      label={recurrenceLabel} 
                      color="primary" 
                      variant="outlined" 
                    />
                  </Stack>

                  {/* Recurrence Type Grid */}
                  <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                    {RECURRENCE_TYPES.map(type => (
                      <Grid key={type.value} size={{ xs: 6, sm: 4 }}>
                        <Paper
                          variant="outlined"
                          onClick={() => !saving && updateField('recurrence_type')(type.value)}
                          sx={{
                            p: 1.5,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            borderRadius: 2,
                            textAlign: 'center',
                            borderColor: formData.recurrence_type === type.value ? 'primary.main' : 'divider',
                            bgcolor: formData.recurrence_type === type.value 
                              ? alpha(theme.palette.primary.main, 0.07) 
                              : 'background.paper',
                            transition: 'all 0.15s',
                            opacity: saving ? 0.6 : 1,
                            '&:hover': saving ? {} : {
                              borderColor: 'primary.light',
                              bgcolor: 'action.hover',
                            },
                          }}
                        >
                          <Typography fontSize={22}>{type.icon}</Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                            {type.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {type.description}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Interval and Day of Month */}
                  <Grid container spacing={2} sx={{ mb: (showDays || showDom) ? 2 : 0 }}>
                    <Grid size={{ xs: 12, sm: showDom ? 6 : 12 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Repeat every"
                        value={formData.recurrence_interval}
                        onChange={handleNumberFieldChange('recurrence_interval')}
                        disabled={saving}
                        slotProps={{
                          input: { inputProps: { min: 1, max: 365 } },
                        }}
                        helperText={RECURRENCE_TYPES.find(t => t.value === formData.recurrence_type)?.intervalUnit || ''}
                      />
                    </Grid>
                    {showDom && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Day of month"
                          value={formData.recurrence_day_of_month}
                          onChange={handleNumberFieldChange('recurrence_day_of_month')}
                          disabled={saving}
                          slotProps={{
                            input: { inputProps: { min: 1, max: 31 } },
                          }}
                          helperText="Uses last day of month if day doesn't exist"
                        />
                      </Grid>
                    )}
                  </Grid>

                  {/* Day Picker for Weekly/Bi-weekly */}
                  {showDays && dayOptions.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        Repeat on
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {dayOptions.map(day => {
                          const isSelected = formData.recurrence_days.includes(day.value);
                          return (
                            <ToggleButton
                              key={day.value}
                              value={day.value}
                              selected={isSelected}
                              onChange={() => toggleDay(day.value)}
                              disabled={saving}
                              sx={{
                                width: 52,
                                height: 52,
                                borderRadius: 2,
                                flexDirection: 'column',
                                '&.Mui-selected': {
                                  bgcolor: 'primary.main',
                                  color: 'white',
                                  borderColor: 'primary.main',
                                  '&:hover': { bgcolor: 'primary.dark' },
                                },
                              }}
                            >
                              <Typography variant="body2" fontWeight={700} lineHeight={1}>
                                {day.short}
                              </Typography>
                            </ToggleButton>
                          );
                        })}
                      </Stack>
                      {formData.recurrence_days.length === 0 && !saving && (
                        <FormHelperText error>Please select at least one day</FormHelperText>
                      )}
                      {formData.recurrence_type === 'biweekly' && formData.recurrence_days.length > 0 && (
                        <FormHelperText sx={{ color: 'info.main' }}>
                          Meetings repeat every {formData.recurrence_interval * 2} weeks on selected days
                        </FormHelperText>
                      )}
                    </Box>
                  )}

                  {/* End Options */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      End recurrence
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select
                          value={formData.recurrence_end_option}
                          onChange={handleTextFieldChange('recurrence_end_option')}
                          disabled={saving}
                        >
                          {END_OPTIONS.map(option => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {formData.recurrence_end_option === 'after' && (
                        <TextField
                          size="small"
                          type="number"
                          label="Occurrences"
                          sx={{ width: 160 }}
                          value={formData.recurrence_max_occurrences || ''}
                          onChange={handleNumberFieldChange('recurrence_max_occurrences')}
                          disabled={saving}
                          slotProps={{
                            input: { inputProps: { min: 1, max: 999 } },
                          }}
                          helperText="Stop after this many meetings"
                        />
                      )}

                      {formData.recurrence_end_option === 'on' && (
                        <DatePicker
                          label="End date"
                          value={formData.recurrence_end_date}
                          onChange={updateField('recurrence_end_date')}
                          disabled={saving}
                          slotProps={{
                            textField: { 
                              size: 'small', 
                              sx: { width: 220 },
                              helperText: 'Stop recurring after this date',
                            },
                          }}
                        />
                      )}
                    </Stack>
                  </Box>

                  {/* Preview Toggle */}
                  <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PreviewIcon />}
                      onClick={() => setShowPreview(prev => !prev)}
                      disabled={saving}
                    >
                      {showPreview ? 'Hide preview' : 'Preview occurrences'}
                    </Button>
                  </Stack>

                  {/* Preview Panel */}
                  <Collapse in={showPreview}>
                    <Alert
                      severity="info"
                      sx={{ mt: 2 }}
                      icon={<TodayIcon />}
                      action={
                        <IconButton size="small" onClick={() => setShowPreview(false)}>
                          <Close fontSize="small" />
                        </IconButton>
                      }
                    >
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        Upcoming occurrences (preview)
                      </Typography>
                      {previewDates.length > 0 ? (
                        <Stack spacing={0.75} sx={{ mt: 1 }}>
                          {previewDates.map((date, index) => (
                            <Stack key={index} direction="row" alignItems="center" spacing={1.5}>
                              <Badge badgeContent={index + 1} color="primary" />
                              <TodayIcon fontSize="small" />
                              <Typography variant="body2">
                                {format(date, 'EEEE, MMMM d, yyyy · h:mm a')}
                              </Typography>
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

                  {/* Info Alert */}
                  <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Note:</strong> Changes affect all future occurrences.
                      Already-generated meeting instances are not changed.
                    </Typography>
                  </Alert>
                </Box>

                <Divider />

                {/* Actions */}
                <Stack direction={isMobile ? 'column' : 'row'} spacing={2} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    startIcon={<Cancel />}
                    onClick={handleCancel}
                    disabled={saving}
                    size="large"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <UpdateIcon />}
                    disabled={saving || pendingSubmit}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </Stack>
              </Stack>
            </form>
          </Paper>
        </Container>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={5000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        >
          <Alert
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%' }}
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default EditRecurringMeeting;