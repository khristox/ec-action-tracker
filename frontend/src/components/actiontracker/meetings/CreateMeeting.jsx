// CreateMeeting.jsx - Complete working version with Recurring Meetings

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Snackbar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  ListItemButton,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  Stack,
  Container,
  AppBar,
  Toolbar,
  InputAdornment,
  Tooltip,
  ListItemIcon,
  Grid,
  Switch,
  Collapse,
  CardActionArea,
  ToggleButton,
  ToggleButtonGroup,
  Breadcrumbs,
  alpha,
  Badge,
  Grow,
  FormHelperText,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Save as SaveIcon,
  MyLocation as MyLocationIcon,
  GpsFixed as GpsFixedIcon,
  GpsNotFixed as GpsNotFixedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  EditNote as SecretaryIcon,
  Search as SearchIcon,
  Apartment as ApartmentIcon,
  Business as BusinessIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon,
  EventSeat as EventSeatIcon,
  Clear as ClearIcon,
  ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Work as WorkIcon,
  Title as TitleIcon,
  Repeat as RepeatIcon,
  Info as InfoIcon,
  Preview as PreviewIcon,
  Today as TodayIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { format } from 'date-fns';
import api from '../../../services/api';

// Redux imports
import {
  fetchParticipantLists,
  fetchParticipants,
  addCustomParticipant,
  removeLocalMeetingParticipant,
  setMeetingChairperson,
  addParticipantsFromListToMeeting,
  clearMeetingParticipants,
  selectParticipantLists,
  selectMeetingParticipantsAll,
  selectMeetingChairperson,
  selectParticipantsLoading,
} from '../../../store/slices/actionTracker/participantSlice';
import { createMeeting, clearMeetingState } from '../../../store/slices/actionTracker/meetingSlice';
import { selectUserPermissions } from '../../../store/slices/authSlice';

// Location Levels
const ADDRESS_LEVELS = [
  { level: 1, name: 'Country', icon: <PublicIcon />, color: '#4CAF50' },
  { level: 2, name: 'Region', icon: <FlagIcon />, color: '#2196F3' },
  { level: 3, name: 'District', icon: <TerrainIcon />, color: '#9C27B0' },
  { level: 4, name: 'County', icon: <BusinessIcon />, color: '#FF9800' },
  { level: 5, name: 'Subcounty', icon: <HomeIcon />, color: '#795548' },
  { level: 6, name: 'Parish', icon: <LocationIcon />, color: '#607D8B' },
  { level: 7, name: 'Village', icon: <HomeIcon />, color: '#8BC34A' }
];

const BUILDING_LEVELS = [
  { level: 11, name: 'Office', icon: <ApartmentIcon />, color: '#E91E63' },
  { level: 12, name: 'Building', icon: <BusinessIcon />, color: '#3F51B5' },
  { level: 13, name: 'Room', icon: <MeetingRoomIcon />, color: '#009688' },
  { level: 14, name: 'Conference', icon: <EventSeatIcon />, color: '#673AB7' }
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

// Helper functions
const alphaHelper = (color, opacity) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

const getLevelInfo = (location) => {
  if (location?.location_mode === 'buildings') {
    return BUILDING_LEVELS.find(l => l.level === location.level);
  }
  return ADDRESS_LEVELS.find(l => l.level === location.level);
};

// Steps - NOW WITH 4 STEPS including Recurrence
const steps = [
  { label: 'Details', icon: EventIcon },
  { label: 'Participants', icon: PeopleIcon },
  { label: 'Recurrence', icon: RepeatIcon },
  { label: 'Review', icon: CheckCircleIcon },
];

// Quill configurations
const quillModules = (isMobile) => ({
  toolbar: isMobile
    ? [['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }], ['clean']]
    : [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'clean'],
      ]
});

const quillFormats = ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'link'];

// ==================== Location Search Component ====================
const LocationSearch = memo(({ value, onChange, onClear }) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locationMode, setLocationMode] = useState('address');
  const [selectedLocation, setSelectedLocation] = useState(value);
  const [locationHierarchy, setLocationHierarchy] = useState([]);
  const [addressTree, setAddressTree] = useState([]);
  const [buildingTree, setBuildingTree] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState({});

  useEffect(() => {
    if (selectedLocation?.id) {
      loadLocationHierarchy(selectedLocation.id);
    } else {
      setLocationHierarchy([]);
    }
  }, [selectedLocation]);

  useEffect(() => {
    loadAddressTree();
    loadBuildingTree();
  }, []);

  const loadLocationHierarchy = async (locationId) => {
    try {
      const [ancestorsRes, locationRes] = await Promise.all([
        api.get(`/locations/${locationId}/ancestors`),
        api.get(`/locations/${locationId}`)
      ]);
      const hierarchy = [...(ancestorsRes.data || []), locationRes.data];
      setLocationHierarchy(hierarchy);
    } catch (err) {
      console.error('Error loading hierarchy:', err);
      setLocationHierarchy([selectedLocation]);
    }
  };

  const loadAddressTree = async () => {
    try {
      const response = await api.get('/locations/tree', { 
        params: { location_mode: 'address', max_depth: 7 } 
      });
      setAddressTree(response.data || []);
    } catch (err) {
      console.error('Error loading address tree:', err);
    }
  };

  const loadBuildingTree = async () => {
    try {
      const response = await api.get('/locations/tree', { 
        params: { location_mode: 'buildings', max_depth: 4 } 
      });
      setBuildingTree(response.data || []);
    } catch (err) {
      console.error('Error loading building tree:', err);
    }
  };

  const searchLocations = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const response = await api.get('/locations/', {
        params: { search: query, location_mode: locationMode, limit: 50 }
      });
      setSearchResults(response.data?.items || []);
    } catch (err) {
      console.error('Error searching locations:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchLocations(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm, locationMode]);

  const handleSelectLocation = (location) => {
    setSelectedLocation(location);
    setSearchTerm('');
    setSearchResults([]);
    onChange(location);
  };

  const handleClearLocation = () => {
    setSelectedLocation(null);
    setLocationHierarchy([]);
    onChange(null);
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const renderTreeNodes = (nodes, depth = 0) => {
    if (!nodes?.length) return null;
    return nodes.map(node => {
      const levelInfo = getLevelInfo(node);
      const isExpanded = expandedNodes[node.id];
      const hasChildren = node.children?.length > 0;

      return (
        <Box key={node.id} sx={{ ml: depth * 3 }}>
          <ListItemButton onClick={() => toggleNode(node.id)} sx={{ borderRadius: 1, mb: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              {hasChildren ? (isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />) : <LocationIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText
              primary={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ color: levelInfo?.color }}>{levelInfo?.icon}</Box>
                  <Typography variant="body2">{node.name}</Typography>
                  <Typography variant="caption" color="text.secondary">({node.code})</Typography>
                </Stack>
              }
            />
            <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); handleSelectLocation(node); }}>
              Select
            </Button>
          </ListItemButton>
          {hasChildren && isExpanded && <Box sx={{ ml: 2 }}>{renderTreeNodes(node.children, depth + 1)}</Box>}
        </Box>
      );
    });
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <LocationIcon sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>Meeting Location</Typography>
            </Stack>
            {selectedLocation && (
              <Chip label="Location Selected" size="small" color="success" onDelete={handleClearLocation} />
            )}
          </Stack>

          <ToggleButtonGroup value={locationMode} exclusive onChange={(e, val) => val && setLocationMode(val)} size="small" fullWidth>
            <ToggleButton value="address"><PublicIcon sx={{ mr: 1 }} /> Addresses</ToggleButton>
            <ToggleButton value="buildings"><ApartmentIcon sx={{ mr: 1 }} /> Buildings</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            fullWidth
            placeholder={`Search for ${locationMode === 'address' ? 'address (Country, District, Village)' : 'building (Office, Building, Room)'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                endAdornment: loading && <CircularProgress size={20} />
              }
            }}
          />

          {searchResults.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <List dense>
                {searchResults.map(result => {
                  const levelInfo = getLevelInfo(result);
                  return (
                    <ListItemButton key={result.id} onClick={() => handleSelectLocation(result)} selected={selectedLocation?.id === result.id}>
                      <ListItemIcon>{levelInfo?.icon || <LocationIcon />}</ListItemIcon>
                      <ListItemText primary={result.name} secondary={`${result.code} • ${levelInfo?.name || `Level ${result.level}`}`} />
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          )}

          {!searchTerm && (
            <>
              <Typography variant="caption" color="text.secondary">Or browse from hierarchy:</Typography>
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List dense>{locationMode === 'address' ? renderTreeNodes(addressTree) : renderTreeNodes(buildingTree)}</List>
              </Paper>
            </>
          )}

          {selectedLocation && locationHierarchy.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">Selected Location Path:</Typography>
              <Breadcrumbs separator={<ArrowForwardIcon sx={{ fontSize: 14 }} />}>
                {locationHierarchy.map((item, idx) => {
                  const levelInfo = getLevelInfo(item);
                  return (
                    <Chip key={item.id} label={item.name} size="small" icon={levelInfo?.icon}
                      sx={{ bgcolor: alphaHelper(levelInfo?.color || theme.palette.primary.main, 0.1), borderColor: levelInfo?.color, color: levelInfo?.color }} />
                  );
                })}
              </Breadcrumbs>
            </Paper>
          )}

          {!selectedLocation && (
            <Alert severity="info" variant="outlined">Search for or browse to select a location. You can select either an address or a building.</Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
});

LocationSearch.displayName = 'LocationSearch';

// ==================== Recurring Meeting Section ====================
const RecurringMeetingSection = ({ recurrence, setRecurrence }) => {
  const theme = useTheme();
  const [isRecurring, setIsRecurring] = useState(!!recurrence?.enabled);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDates, setPreviewDates] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Initialize recurrence when toggled
  const handleRecurringToggle = (checked) => {
    setIsRecurring(checked);
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
    }
  };

  const updateRecurrence = (field, value) => {
    setRecurrence(prev => ({ ...prev, [field]: value }));
  };

  // Fetch preview dates
  const fetchPreview = async () => {
    if (!recurrence?.enabled) return;
    
    setLoadingPreview(true);
    try {
      // This would call your API
      // const response = await api.post('/recurring-meetings/preview', {
      //   recurrence_type: recurrence.type,
      //   recurrence_interval: recurrence.interval,
      //   recurrence_days: recurrence.days,
      //   recurrence_day_of_month: recurrence.day_of_month,
      //   start_date: new Date(),
      //   max_occurrences: 10
      // });
      // setPreviewDates(response.data);
      
      // Mock preview for demo
      const mockDates = [];
      let date = new Date();
      for (let i = 0; i < 5; i++) {
        if (recurrence.type === 'daily') {
          date = new Date(date.setDate(date.getDate() + recurrence.interval));
        } else if (recurrence.type === 'weekly') {
          date = new Date(date.setDate(date.getDate() + 7 * recurrence.interval));
        } else if (recurrence.type === 'monthly') {
          date = new Date(date.setMonth(date.getMonth() + recurrence.interval));
        }
        mockDates.push(new Date(date));
      }
      setPreviewDates(mockDates);
    } catch (error) {
      console.error('Error fetching preview:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (showPreview && recurrence?.enabled) {
      fetchPreview();
    }
  }, [showPreview, recurrence]);

  const toggleDay = (day) => {
    const currentDays = recurrence?.days || [];
    updateRecurrence('days', currentDays.includes(day) ? currentDays.filter(d => d !== day) : [...currentDays, day]);
  };

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
          {/* Recurring Toggle */}
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              bgcolor: isRecurring ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
              borderColor: isRecurring ? theme.palette.primary.main : 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Switch 
                  checked={isRecurring} 
                  onChange={(e) => handleRecurringToggle(e.target.checked)} 
                  color="primary" 
                  size="large"
                />
                <Stack>
                  <Typography variant="h6" fontWeight={600}>
                    <RepeatIcon sx={{ mr: 1, verticalAlign: 'middle' }} color={isRecurring ? 'primary' : 'action'} />
                    Make this a recurring meeting
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create a series of meetings that repeat on a schedule
                  </Typography>
                </Stack>
              </Stack>
              {isRecurring && (
                <Chip 
                  icon={<RepeatIcon />} 
                  label={`Repeats ${getIntervalText()}`} 
                  color="primary" 
                  variant="outlined"
                />
              )}
            </Stack>
          </Paper>

          {/* Recurrence Configuration */}
          <Collapse in={isRecurring}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Recurrence Pattern
              </Typography>
              
              <Grid container spacing={3}>
                {/* Recurrence Type */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Repeats every</InputLabel>
                    <Select 
                      value={recurrence?.type || 'weekly'} 
                      onChange={(e) => updateRecurrence('type', e.target.value)} 
                      label="Repeats every"
                    >
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

                {/* Interval */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Repeat every"
                    value={recurrence?.interval || 1}
                    onChange={(e) => updateRecurrence('interval', parseInt(e.target.value) || 1)}
                    InputProps={{
                      inputProps: { min: 1, max: 365 },
                      endAdornment: (
                        <Typography variant="body2" color="text.secondary">
                          {RECURRENCE_TYPES.find(t => t.value === recurrence?.type)?.intervalText || 'day(s)'}
                        </Typography>
                      )
                    }}
                  />
                </Grid>

                {/* Weekly: Day Selection */}
                {(recurrence?.type === 'weekly' || recurrence?.type === 'biweekly') && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom>Repeat on</Typography>
                    <Stack direction="row" spacing={1} justifyContent="center">
                      {WEEK_DAYS.map(day => (
                        <ToggleButton 
                          key={day.value} 
                          value={day.value} 
                          selected={recurrence?.days?.includes(day.value)}
                          onChange={() => toggleDay(day.value)} 
                          sx={{ 
                            width: 48, 
                            height: 48,
                            borderRadius: 2,
                            '&.Mui-selected': {
                              bgcolor: theme.palette.primary.main,
                              color: 'white',
                            }
                          }}
                        >
                          <Stack direction="column" alignItems="center">
                            <Typography variant="caption" fontWeight={600}>{day.label}</Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>{day.full.substring(0, 2)}</Typography>
                          </Stack>
                        </ToggleButton>
                      ))}
                    </Stack>
                    {(!recurrence?.days || recurrence?.days.length === 0) && (
                      <FormHelperText error>Please select at least one day</FormHelperText>
                    )}
                  </Grid>
                )}

                {/* Monthly: Day of Month */}
                {recurrence?.type === 'monthly' && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Day of month</InputLabel>
                      <Select 
                        value={recurrence?.day_of_month || 1} 
                        onChange={(e) => updateRecurrence('day_of_month', e.target.value)} 
                        label="Day of month"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <MenuItem key={day} value={day}>
                            {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} day
                          </MenuItem>
                        ))}
                        <MenuItem value="last">Last day</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {/* End Options */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>End recurrence</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <Select 
                        value={recurrence?.end_option || 'never'} 
                        onChange={(e) => updateRecurrence('end_option', e.target.value)}
                      >
                        {END_OPTIONS.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                    
                    {recurrence?.end_option === 'after' && (
                      <TextField 
                        size="small" 
                        type="number" 
                        label="Number of occurrences" 
                        sx={{ width: 200 }}
                        value={recurrence?.max_occurrences || ''}
                        onChange={(e) => updateRecurrence('max_occurrences', parseInt(e.target.value) || 0)}
                        InputProps={{ inputProps: { min: 1, max: 999 } }}
                      />
                    )}
                    
                    {recurrence?.end_option === 'on' && (
                      <DatePicker
                        label="End date"
                        value={recurrence?.end_date}
                        onChange={(date) => updateRecurrence('end_date', date)}
                        slotProps={{ textField: { size: 'small', sx: { width: 250 } } }}
                      />
                    )}
                  </Stack>
                </Grid>
              </Grid>

              {/* Preview Button */}
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button 
                  variant="outlined" 
                  startIcon={<PreviewIcon />} 
                  onClick={() => setShowPreview(!showPreview)}
                  size="small"
                >
                  {showPreview ? 'Hide Preview' : 'Preview Occurrences'}
                </Button>
              </Stack>

              {/* Preview Section */}
              <Collapse in={showPreview}>
                <Alert 
                  severity="info" 
                  sx={{ mt: 2 }} 
                  icon={<TodayIcon />}
                  action={
                    <IconButton size="small" onClick={() => setShowPreview(false)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Upcoming Occurrences
                  </Typography>
                  {loadingPreview ? (
                    <CircularProgress size={24} />
                  ) : previewDates.length > 0 ? (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {previewDates.map((date, idx) => (
                        <Stack key={idx} direction="row" alignItems="center" spacing={2}>
                          <Badge badgeContent={idx + 1} color="primary" />
                          <EventIcon fontSize="small" />
                          <Typography variant="body2">
                            {date.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2">Click "Preview" to see upcoming dates</Typography>
                  )}
                </Alert>
              </Collapse>

              {/* Info Alert */}
              <Alert severity="info" sx={{ mt: 2 }} icon={<InfoIcon />}>
                <Typography variant="body2">
                  <strong>How it works:</strong> This will create a series of meetings based on the pattern above. 
                  Each occurrence will be created as a separate meeting. You can modify individual occurrences later 
                  from the Recurring Meetings dashboard.
                </Typography>
              </Alert>
            </Box>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ==================== Main Component ====================
const CreateMeeting = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Redux state
  const participantLists = useSelector(selectParticipantLists);
  const meetingParticipants = useSelector(selectMeetingParticipantsAll);
  const chairperson = useSelector(selectMeetingChairperson);
  const participantsLoading = useSelector(selectParticipantsLoading);
  const userPermissions = useSelector(selectUserPermissions);
  const { isLoading: meetingLoading, success, error: meetingError } = useSelector(state => state.meetings);

  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [selectedParticipantList, setSelectedParticipantList] = useState(null);
  const [showGpsDetails, setShowGpsDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Recurrence state
  const [recurrence, setRecurrence] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: new Date(),
    start_time: new Date(),
    end_time: null,
    location_text: '',
    location_id: null,
    location_details: null,
    agenda: '',
    secretary_name: '',
    gps_latitude: '',
    gps_longitude: '',
    platform: 'physical',
    meeting_link: '',
  });

  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSupported, setGpsSupported] = useState(true);

  const [newParticipant, setNewParticipant] = useState({
    name: '', email: '', telephone: '', title: '', organization: '', is_chairperson: false,
  });

  const apiLoading = meetingLoading || participantsLoading || submitting;

  // Memoized values
  const chairpersonName = useMemo(() => chairperson?.name || 'Not selected', [chairperson]);
  const isRecurring = useMemo(() => recurrence?.enabled === true, [recurrence]);

  // Effects
  useEffect(() => {
    dispatch(fetchParticipantLists());
    dispatch(fetchParticipants({ limit: 100 }));
    if (!navigator.geolocation) {
      setGpsSupported(false);
      setSnackbar({ open: true, message: 'Geolocation is not supported by your browser', severity: 'warning' });
    }
    return () => {
      dispatch(clearMeetingState());
      dispatch(clearMeetingParticipants());
    };
  }, [dispatch]);

  useEffect(() => {
    if (success) {
      setSnackbar({ open: true, message: 'Meeting created successfully! Redirecting...', severity: 'success' });
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  }, [success, navigate]);

  useEffect(() => {
    if (meetingError) {
      setSnackbar({ open: true, message: typeof meetingError === 'string' ? meetingError : 'Failed to create meeting', severity: 'error' });
    }
  }, [meetingError]);

  // GPS Functions
  const getCurrentLocation = useCallback(() => {
    if (!gpsSupported) {
      setSnackbar({ open: true, message: 'Geolocation is not supported by your browser', severity: 'error' });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({ ...prev, gps_latitude: position.coords.latitude.toFixed(6), gps_longitude: position.coords.longitude.toFixed(6) }));
        setGpsEnabled(true);
        setGpsLoading(false);
      },
      () => { setSnackbar({ open: true, message: 'Unable to get location.', severity: 'error' }); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [gpsSupported]);

  const handleGpsToggle = (event) => {
    const enabled = event.target.checked;
    setGpsEnabled(enabled);
    if (!enabled) {
      setFormData(prev => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
    } else if (gpsSupported && !formData.gps_latitude) {
      getCurrentLocation();
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleDateChange = (date) => setFormData({ ...formData, meeting_date: date });
  const handleStartTimeChange = (time) => setFormData({ ...formData, start_time: time });
  const handleEndTimeChange = (time) => setFormData({ ...formData, end_time: time });
  const handleAgendaChange = (value) => setFormData({ ...formData, agenda: value });
  
  const handleLocationSelect = useCallback((location) => {
    if (location) {
      setFormData(prev => ({
        ...prev,
        location_id: location.id,
        location_text: location.name,
        location_details: { id: location.id, name: location.name, code: location.code, level: location.level, location_mode: location.location_mode }
      }));
    } else {
      setFormData(prev => ({ ...prev, location_id: null, location_text: '', location_details: null }));
    }
  }, []);

  // Participant handlers
  const handleNewParticipantChange = (field) => (event) => setNewParticipant({ ...newParticipant, [field]: event.target.value });
  
  const handleUseParticipantList = () => {
    if (selectedParticipantList) {
      const list = participantLists.find(l => l.id === selectedParticipantList);
      if (list?.participants) {
        dispatch(addParticipantsFromListToMeeting({ listId: selectedParticipantList, participants: list.participants }));
        setSnackbar({ open: true, message: `Added ${list.participants.length} participants`, severity: 'success' });
      }
      setSelectedParticipantList(null);
    }
  };

  const handleAddCustomParticipant = () => {
    if (!newParticipant.name.trim()) return;
    dispatch(addCustomParticipant(newParticipant));
    setNewParticipant({ name: '', email: '', telephone: '', title: '', organization: '', is_chairperson: false });
    setShowAddParticipantDialog(false);
    setSnackbar({ open: true, message: 'Participant added successfully', severity: 'success' });
  };

  const handleRemoveParticipant = (participantId) => dispatch(removeLocalMeetingParticipant(participantId));
  const handleSetChairperson = (participantId) => dispatch(setMeetingChairperson(participantId));

  const handleNext = () => {
    if (activeStep === 0 && !formData.title.trim()) {
      setSnackbar({ open: true, message: 'Please enter a meeting title', severity: 'warning' });
      return;
    }
    setActiveStep(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (activeStep === 0) navigate('/meetings');
    else setActiveStep(prev => prev - 1);
  };

  const handleCancel = () => navigate('/meetings');

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const meetingDate = formData.meeting_date;
      const startDateTime = new Date(meetingDate);
      startDateTime.setHours(formData.start_time.getHours(), formData.start_time.getMinutes());

      let endDateTime = null;
      if (formData.end_time) {
        endDateTime = new Date(meetingDate);
        endDateTime.setHours(formData.end_time.getHours(), formData.end_time.getMinutes());
      }

      const meetingPayload = {
        title: formData.title,
        description: formData.description || null,
        meeting_date: startDateTime.toISOString(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime ? endDateTime.toISOString() : null,
        location_text: formData.location_text || null,
        location_id: formData.location_id || null,
        gps_coordinates: gpsEnabled ? `${formData.gps_latitude},${formData.gps_longitude}` : null,
        agenda: formData.agenda || null,
        secretary: formData.secretary_name || null,
        chairperson_name: chairperson?.name || null,
        platform: formData.platform,
        meeting_link: formData.meeting_link,
        custom_participants: meetingParticipants.map(p => ({
          name: p.name, email: p.email || null, telephone: p.telephone || null,
          title: p.title || null, organization: p.organization || null,
          is_chairperson: p.is_chairperson || false,
          is_secretary: p.name === formData.secretary_name
        })),
      };

      // Check if recurring
      if (isRecurring && recurrence) {
        console.log('Creating RECURRING meeting:', { ...meetingPayload, recurrence });
        
        const recurringPayload = {
          ...meetingPayload,
          recurrence_type: recurrence.type,
          recurrence_interval: recurrence.interval,
          recurrence_days: recurrence.days,
          recurrence_day_of_month: recurrence.day_of_month === 'last' ? -1 : recurrence.day_of_month,
          recurrence_end_date: recurrence.end_date,
          recurrence_max_occurrences: recurrence.max_occurrences,
        };
        
        await api.post('/recurring-meetings/', recurringPayload);
        setSnackbar({ open: true, message: 'Recurring meeting created successfully!', severity: 'success' });
      } else {
        console.log('Creating SINGLE meeting');
        await dispatch(createMeeting(meetingPayload)).unwrap();
        setSnackbar({ open: true, message: 'Meeting created successfully!', severity: 'success' });
      }
      
      setTimeout(() => navigate('/meetings'), 2000);
    } catch (error) {
      console.error('Error creating meeting:', error);
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Failed to create meeting', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 10, sm: 4 } }}>
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={() => navigate('/meetings')}><ArrowBackIcon /></IconButton>
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>Create Meeting</Typography>
              <IconButton edge="end" onClick={handleCancel}><CloseIcon /></IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
          {!isMobile && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="primary">Create New Meeting</Typography>
                <Typography variant="body2" color="text.secondary">Fill in the details to schedule a new meeting</Typography>
              </Box>
              <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel} disabled={apiLoading}>Cancel</Button>
            </Box>
          )}

          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 2, md: 3 }, position: 'relative', overflow: 'hidden' }}>
            {apiLoading && (
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: alpha(theme.palette.background.paper, 0.9), zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            )}

            <Stepper activeStep={activeStep} sx={{ mb: 4, display: isMobile ? 'none' : 'flex' }}>
              {steps.map((step, idx) => (
                <Step key={idx}>
                  <StepLabel StepIconComponent={step.icon}>{step.label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Step 1: Meeting Details */}
            {activeStep === 0 && (
              <Grow in timeout={300}>
                <Stack spacing={2.5}>
                  <TextField 
                    fullWidth 
                    label="Meeting Title *" 
                    name="title" 
                    required 
                    value={formData.title} 
                    onChange={handleChange} 
                    disabled={apiLoading}
                    helperText="Give your meeting a clear, descriptive title"
                  />
                  
                  <TextField 
                    fullWidth 
                    label="Description" 
                    name="description" 
                    multiline 
                    rows={isMobile ? 2 : 3} 
                    value={formData.description} 
                    onChange={handleChange} 
                    disabled={apiLoading}
                    helperText="Optional: Provide additional context about the meeting"
                  />
                  
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DatePicker 
                        label="Meeting Date *" 
                        value={formData.meeting_date} 
                        onChange={handleDateChange} 
                        slotProps={{ textField: { fullWidth: true, required: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TimePicker 
                        label="Start Time *" 
                        value={formData.start_time} 
                        onChange={handleStartTimeChange} 
                        slotProps={{ textField: { fullWidth: true, required: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TimePicker 
                        label="End Time" 
                        value={formData.end_time} 
                        onChange={handleEndTimeChange} 
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </Grid>
                  </Grid>

                  <FormControl fullWidth>
                    <InputLabel>Meeting Platform</InputLabel>
                    <Select
                      name="platform"
                      value={formData.platform}
                      onChange={handleChange}
                      label="Meeting Platform"
                    >
                      <MenuItem value="physical">📍 Physical / In-Person</MenuItem>
                      <MenuItem value="zoom">🎥 Zoom</MenuItem>
                      <MenuItem value="google_meet">🎬 Google Meet</MenuItem>
                      <MenuItem value="microsoft_teams">💻 Microsoft Teams</MenuItem>
                      <MenuItem value="other">🌐 Other (Link required)</MenuItem>
                    </Select>
                  </FormControl>

                  {formData.platform !== 'physical' && (
                    <TextField
                      fullWidth
                      label="Meeting Link"
                      name="meeting_link"
                      value={formData.meeting_link}
                      onChange={handleChange}
                      placeholder="https://..."
                      helperText="Participants will use this link to join the meeting"
                    />
                  )}
                  
                  <LocationSearch value={formData.location_details} onChange={handleLocationSelect} />

                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardActionArea onClick={() => setShowGpsDetails(!showGpsDetails)}>
                      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {gpsEnabled ? <GpsFixedIcon color="success" /> : <GpsNotFixedIcon color="disabled" />}
                          <Typography variant="subtitle1" fontWeight="bold">Add GPS Coordinates (Optional)</Typography>
                        </Box>
                        <Switch checked={gpsEnabled} onChange={handleGpsToggle} onClick={(e) => e.stopPropagation()} />
                      </Box>
                    </CardActionArea>
                    <Collapse in={showGpsDetails && gpsEnabled}>
                      <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                        <Stack spacing={2}>
                          <Button 
                            size="small" 
                            variant="contained" 
                            startIcon={<MyLocationIcon />} 
                            onClick={getCurrentLocation} 
                            disabled={gpsLoading}
                          >
                            {gpsLoading ? <CircularProgress size={20} /> : 'Use Current Location'}
                          </Button>
                          <TextField 
                            fullWidth 
                            label="Latitude" 
                            value={formData.gps_latitude} 
                            size="small" 
                            onChange={handleChange} 
                            name="gps_latitude" 
                            placeholder="e.g., 0.3136"
                          />
                          <TextField 
                            fullWidth 
                            label="Longitude" 
                            value={formData.gps_longitude} 
                            size="small" 
                            onChange={handleChange} 
                            name="gps_longitude" 
                            placeholder="e.g., 32.5811"
                          />
                        </Stack>
                      </Box>
                    </Collapse>
                  </Card>

                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Agenda</Typography>
                    <ReactQuill 
                      theme="snow" 
                      value={formData.agenda} 
                      onChange={handleAgendaChange} 
                      modules={quillModules(isMobile)} 
                      formats={quillFormats} 
                      style={{ height: '200px', marginBottom: '50px' }} 
                      placeholder="Outline the meeting agenda here..."
                    />
                  </Box>
                </Stack>
              </Grow>
            )}

            {/* Step 2: Participants */}
            {activeStep === 1 && (
              <Grow in timeout={300}>
                <Stack spacing={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        📋 Add from Participant List
                      </Typography>
                      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>Select Participant List</InputLabel>
                        <Select 
                          value={selectedParticipantList || ''} 
                          onChange={(e) => setSelectedParticipantList(e.target.value)} 
                          label="Select Participant List"
                        >
                          {participantLists.map((list) => (
                            <MenuItem key={list.id} value={list.id}>
                              {list.name} ({list.participants?.length || 0} participants)
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button 
                        fullWidth 
                        variant="contained" 
                        onClick={handleUseParticipantList} 
                        disabled={!selectedParticipantList}
                      >
                        Add Selected List
                      </Button>
                    </CardContent>
                  </Card>

                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">👤 Individual Participants</Typography>
                        <Button 
                          variant="outlined" 
                          startIcon={<PersonAddIcon />} 
                          onClick={() => setShowAddParticipantDialog(true)}
                        >
                          Add Participant
                        </Button>
                      </Box>

                      {meetingParticipants.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                          No participants added yet. Add from a list or individually.
                        </Typography>
                      ) : (
                        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                          {meetingParticipants.map((participant) => (
                            <React.Fragment key={participant.id}>
                              <ListItem 
                                secondaryAction={
                                  <IconButton edge="end" onClick={() => handleRemoveParticipant(participant.id)}>
                                    <DeleteIcon />
                                  </IconButton>
                                }
                              >
                                <ListItemAvatar>
                                  <Avatar sx={{ bgcolor: participant.is_chairperson ? 'primary.main' : 'success.main' }}>
                                    {participant.name?.charAt(0) || 'P'}
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                      <Typography variant="body2" fontWeight={500}>{participant.name}</Typography>
                                      {participant.is_chairperson && <Chip label="Chairperson" size="small" color="primary" />}
                                    </Stack>
                                  }
                                  secondary={
                                    <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                      {participant.email && (
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <EmailIcon sx={{ fontSize: 12 }} /> {participant.email}
                                        </Typography>
                                      )}
                                      {participant.telephone && (
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <PhoneIcon sx={{ fontSize: 12 }} /> {participant.telephone}
                                        </Typography>
                                      )}
                                      {participant.title && (
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <TitleIcon sx={{ fontSize: 12 }} /> {participant.title}
                                        </Typography>
                                      )}
                                      {participant.organization && (
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <WorkIcon sx={{ fontSize: 12 }} /> {participant.organization}
                                        </Typography>
                                      )}
                                    </Stack>
                                  }
                                />
                              </ListItem>
                              {!participant.is_chairperson && (
                                <Button 
                                  size="small" 
                                  sx={{ ml: 7, mb: 1 }} 
                                  onClick={() => handleSetChairperson(participant.id)}
                                >
                                  Make Chairperson
                                </Button>
                              )}
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
                        <Select 
                          name="secretary_name" 
                          value={formData.secretary_name} 
                          onChange={handleChange} 
                          label="Select Secretary from Participants"
                        >
                          <MenuItem value=""><em>None Selected</em></MenuItem>
                          {meetingParticipants.map((p) => (
                            <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </CardContent>
                  </Card>
                </Stack>
              </Grow>
            )}

            {/* Step 3: Recurrence - NOW VISIBLE */}
            {activeStep === 2 && (
              <Grow in timeout={300}>
                <RecurringMeetingSection 
                  recurrence={recurrence} 
                  setRecurrence={setRecurrence} 
                />
              </Grow>
            )}

            {/* Step 4: Review */}
            {activeStep === 3 && (
              <Grow in timeout={300}>
                <Stack spacing={2}>
                  <Alert severity="info" icon={<CheckCircleIcon />}>
                    Review meeting details before creating
                  </Alert>
                  
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="primary" gutterBottom>Meeting Information</Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="body2"><strong>Title:</strong> {formData.title}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="body2"><strong>Chairperson:</strong> {chairpersonName}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="body2" color="secondary.main">
                            <strong>Secretary:</strong> {formData.secretary_name || 'Not selected'}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="body2">
                            <strong>Date & Time:</strong> {formData.meeting_date?.toLocaleDateString()} at {formData.start_time?.toLocaleTimeString()}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="body2">
                            <strong>Platform:</strong> {formData.platform === 'physical' ? 'In-Person' : formData.platform}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="body2">
                            <strong>Location:</strong> {formData.location_text || 'Not specified'}
                          </Typography>
                        </Grid>
                        
                        {isRecurring && recurrence && (
                          <Grid size={{ xs: 12 }}>
                            <Divider sx={{ my: 1 }} />
                            <Chip 
                              icon={<RepeatIcon />} 
                              label={`Recurring: ${recurrence.type} (every ${recurrence.interval} ${recurrence.type === 'daily' ? 'day(s)' : recurrence.type === 'weekly' ? 'week(s)' : 'month(s)'})`} 
                              color="primary" 
                              size="medium"
                            />
                          </Grid>
                        )}
                      </Grid>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        Participants ({meetingParticipants.length})
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, mt: 1, maxHeight: 150, overflow: 'auto' }}>
                        {meetingParticipants.slice(0, 10).map(p => (
                          <li key={p.id}>
                            <Typography variant="body2">
                              {p.name} {p.is_chairperson && '(Chairperson)'}
                              {p.name === formData.secretary_name && ' (Secretary)'}
                            </Typography>
                          </li>
                        ))}
                        {meetingParticipants.length > 10 && (
                          <li><Typography variant="body2">...and {meetingParticipants.length - 10} more</Typography></li>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                  
                  <Button 
                    variant="contained" 
                    size="large" 
                    onClick={handleSubmit} 
                    startIcon={<SaveIcon />} 
                    disabled={apiLoading}
                    sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
                  >
                    {apiLoading ? <CircularProgress size={24} /> : (isRecurring ? 'Create Recurring Meeting' : 'Create Meeting')}
                  </Button>
                </Stack>
              </Grow>
            )}

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button 
                onClick={handleBack} 
                startIcon={<ArrowBackIcon />} 
                disabled={apiLoading}
              >
                {activeStep === 0 ? 'Cancel' : 'Back'}
              </Button>
              {activeStep < steps.length - 1 && (
                <Button 
                  variant="contained" 
                  onClick={handleNext} 
                  endIcon={<ArrowForwardIcon />} 
                  disabled={apiLoading}
                  sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
                >
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
              <TextField 
                fullWidth 
                label="Full Name *" 
                value={newParticipant.name} 
                onChange={handleNewParticipantChange('name')} 
                required 
                size="small" 
              />
              <TextField 
                fullWidth 
                label="Email" 
                type="email" 
                value={newParticipant.email} 
                onChange={handleNewParticipantChange('email')} 
                size="small" 
              />
              <TextField 
                fullWidth 
                label="Telephone" 
                value={newParticipant.telephone} 
                onChange={handleNewParticipantChange('telephone')} 
                size="small" 
              />
              <TextField 
                fullWidth 
                label="Title/Position" 
                value={newParticipant.title} 
                onChange={handleNewParticipantChange('title')} 
                size="small" 
              />
              <TextField 
                fullWidth 
                label="Organization" 
                value={newParticipant.organization} 
                onChange={handleNewParticipantChange('organization')} 
                size="small" 
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddParticipantDialog(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={handleAddCustomParticipant} 
              disabled={!newParticipant.name.trim()}
              sx={{ bgcolor: '#7C3AED' }}
            >
              Add Participant
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar 
          open={snackbar.open} 
          autoHideDuration={4000} 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        >
          <Alert 
            severity={snackbar.severity} 
            variant="filled" 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateMeeting;