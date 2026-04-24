// src/components/actiontracker/meetings/EditMeeting.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Alert,
  CircularProgress,
  Snackbar,
  IconButton,
  Stack,
  Container,
  AppBar,
  Toolbar,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  Divider,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Tooltip,
  InputAdornment,
  Checkbox,
  Collapse,
  CardActionArea,
  ToggleButton,
  ToggleButtonGroup,
  Breadcrumbs,
  ListItemButton,
  ListItemIcon,
  Grid
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  LocationOn as LocationIcon,
  Event as EventIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  MyLocation as MyLocationIcon,
  ContentCopy as ContentCopyIcon,
  ContentPaste as PasteIcon,
  GpsFixed as GpsFixedIcon,
  GpsNotFixed as GpsNotFixedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  Apartment as ApartmentIcon,
  Business as BusinessIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon,
  EventSeat as EventSeatIcon,
  ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Work as WorkIcon,
  Title as TitleIcon,
  EditNote as SecretaryIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Redux imports
import {
  fetchMeetingById,
  updateMeeting,
  clearMeetingState,
  selectCurrentMeeting,
  selectMeetingsLoading,
  selectMeetingsError
} from '../../../store/slices/actionTracker/meetingSlice';
import {
  fetchMeetingParticipants,
  addCustomParticipant,
  removeLocalMeetingParticipant,
  setMeetingChairperson,
  clearMeetingParticipants,
  selectMeetingParticipantsAll,
  selectMeetingChairperson,
  selectParticipantsLoading
} from '../../../store/slices/actionTracker/participantSlice';

import api from '../../../services/api';

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

const alpha = (color, opacity) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

// Quill modules
const mobileModules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['clean'],
  ],
};

const desktopModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link', 'clean'],
  ],
};

const formats = ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'link'];

// Location Search Component
const LocationSearch = ({ value, onChange, onClear, error }) => {
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
      const response = await api.get(`/locations/${locationId}/ancestors`);
      const ancestors = response.data || [];
      const fullHierarchy = [...ancestors];
      
      const locationResponse = await api.get(`/locations/${locationId}`);
      if (locationResponse.data) {
        fullHierarchy.push(locationResponse.data);
      }
      setLocationHierarchy(fullHierarchy);
    } catch (err) {
      console.error('Error loading hierarchy:', err);
      setLocationHierarchy([selectedLocation]);
    }
  };

  const loadAddressTree = async () => {
    try {
      const response = await api.get('/locations/tree', { params: { location_mode: 'address', max_depth: 7 } });
      setAddressTree(response.data || []);
    } catch (err) {
      console.error('Error loading address tree:', err);
    }
  };

  const loadBuildingTree = async () => {
    try {
      const response = await api.get('/locations/tree', { params: { location_mode: 'buildings', max_depth: 4 } });
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
        params: {
          search: query,
          location_mode: locationMode === 'all' ? undefined : locationMode,
          limit: 50,
          include_inactive: false
        }
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
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchLocations(searchTerm);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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
    if (onClear) onClear();
  };

  const getLevelInfo = (location) => {
    if (location.location_mode === 'buildings') {
      return BUILDING_LEVELS.find(l => l.level === location.level);
    }
    return ADDRESS_LEVELS.find(l => l.level === location.level);
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const renderTreeNodes = (nodes, depth = 0) => {
    if (!nodes || nodes.length === 0) return null;
    
    return nodes.map(node => {
      const levelInfo = getLevelInfo(node);
      const isExpanded = expandedNodes[node.id];
      const hasChildren = node.children && node.children.length > 0;
      
      return (
        <Box key={node.id} sx={{ ml: depth * 3 }}>
          <ListItemButton
            onClick={() => toggleNode(node.id)}
            sx={{ borderRadius: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {hasChildren ? (
                isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />
              ) : (
                <LocationIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ color: levelInfo?.color }}>
                    {levelInfo?.icon}
                  </Box>
                  <Typography variant="body2">{node.name}</Typography>
                  <Typography variant="caption" color="text.secondary">({node.code})</Typography>
                </Stack>
              }
            />
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectLocation(node);
              }}
            >
              Select
            </Button>
          </ListItemButton>
          {hasChildren && isExpanded && (
            <Box sx={{ ml: 2 }}>
              {renderTreeNodes(node.children, depth + 1)}
            </Box>
          )}
        </Box>
      );
    });
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LocationIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Meeting Location
            </Typography>
            {selectedLocation && (
              <Chip
                label="Location Selected"
                size="small"
                color="success"
                onDelete={handleClearLocation}
              />
            )}
          </Stack>
          
          <ToggleButtonGroup
            value={locationMode}
            exclusive
            onChange={(e, val) => val && setLocationMode(val)}
            size="small"
            fullWidth
          >
            <ToggleButton value="address">
              <PublicIcon sx={{ mr: 1 }} /> Addresses
            </ToggleButton>
            <ToggleButton value="buildings">
              <ApartmentIcon sx={{ mr: 1 }} /> Buildings
            </ToggleButton>
          </ToggleButtonGroup>
          
          <TextField
            fullWidth
            placeholder={`Search for ${locationMode === 'address' ? 'address (Country, District, Village)' : 'building (Office, Building, Room)'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: loading && <CircularProgress size={20} />
            }}
          />
          
          {searchResults.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <List dense>
                {searchResults.map(result => {
                  const levelInfo = getLevelInfo(result);
                  return (
                    <ListItemButton
                      key={result.id}
                      onClick={() => handleSelectLocation(result)}
                      selected={selectedLocation?.id === result.id}
                    >
                      <ListItemIcon>
                        {levelInfo?.icon || <LocationIcon />}
                      </ListItemIcon>
                      <ListItemText
                        primary={result.name}
                        secondary={`${result.code} • ${levelInfo?.name || `Level ${result.level}`} • ${result.location_mode}`}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          )}
          
          {!searchTerm && (
            <>
              <Typography variant="caption" color="text.secondary">
                Or browse from hierarchy:
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List dense>
                  {locationMode === 'address' 
                    ? renderTreeNodes(addressTree)
                    : renderTreeNodes(buildingTree)
                  }
                </List>
              </Paper>
            </>
          )}
          
          {selectedLocation && locationHierarchy.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Selected Location Path:
              </Typography>
              <Breadcrumbs separator={<ChevronRightIcon sx={{ fontSize: 14 }} />}>
                {locationHierarchy.map((item, idx) => {
                  const levelInfo = getLevelInfo(item);
                  return (
                    <Chip
                      key={item.id}
                      label={item.name}
                      size="small"
                      sx={{
                        bgcolor: alpha(levelInfo?.color || theme.palette.primary.main, 0.1),
                        borderColor: levelInfo?.color || theme.palette.primary.main,
                        color: levelInfo?.color || theme.palette.primary.main,
                      }}
                      icon={levelInfo?.icon}
                    />
                  );
                })}
              </Breadcrumbs>
            </Paper>
          )}
          
          {!selectedLocation && (
            <Alert severity="info" variant="outlined">
              Search for or browse to select a location. You can select either an address or a building.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

const EditMeeting = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Redux state
  const currentMeeting = useSelector(selectCurrentMeeting);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingsError);
  const meetingParticipants = useSelector(selectMeetingParticipantsAll);
  const chairperson = useSelector(selectMeetingChairperson);
  const participantsLoading = useSelector(selectParticipantsLoading);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: null,
    start_time: null,
    end_time: null,
    location_text: '',
    location_id: null,
    location_details: null,
    agenda: '',
    secretary_name: '',
    gps_latitude: '',
    gps_longitude: '',
  });
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSupported, setGpsSupported] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [showGpsDetails, setShowGpsDetails] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    name: '',
    email: '',
    telephone: '',
    title: '',
    organization: '',
    is_chairperson: false,
  });

  // Fetch meeting data
 // src/components/actiontracker/meetings/EditMeeting.jsx

// Update the useEffect that fetches data
useEffect(() => {
  const fetchData = async () => {
    if (id) {
      try {
        await dispatch(fetchMeetingById(id)).unwrap();
      } catch (err) {
        console.error('Failed to fetch meeting:', err);
        setSnackbar({ 
          open: true, 
          message: err.message || 'Failed to load meeting details', 
          severity: 'error' 
        });
      }
      
      // Try to fetch participants, but don't fail if it doesn't exist
      try {
        await dispatch(fetchMeetingParticipants(id)).unwrap();
      } catch (err) {
        console.warn('Participants endpoint not available:', err);
        // Don't show error for participants - it's expected if no participants exist
      }
    }
  };
  
  fetchData();
  
  if (!navigator.geolocation) {
    setGpsSupported(false);
  }
  
  return () => {
    dispatch(clearMeetingState());
    dispatch(clearMeetingParticipants());
  };
}, [id, dispatch]);
  // Populate form when meeting data is loaded
  useEffect(() => {
    if (currentMeeting) {
      const meetingDate = new Date(currentMeeting.meeting_date);
      const startTime = new Date(currentMeeting.start_time);
      
      let endTime = null;
      if (currentMeeting.end_time) {
        endTime = new Date(currentMeeting.end_time);
      }

      let gpsLat = '';
      let gpsLng = '';
      let gpsEnabledFlag = false;
      if (currentMeeting.gps_coordinates) {
        const coords = currentMeeting.gps_coordinates.split(',');
        if (coords.length === 2) {
          gpsLat = coords[0].trim();
          gpsLng = coords[1].trim();
          gpsEnabledFlag = true;
        }
      }

      // Load location details if location_id exists
      let locationDetails = null;
      if (currentMeeting.location_id) {
        // Try to get location details from the meeting or fetch them
        locationDetails = {
          id: currentMeeting.location_id,
          name: currentMeeting.location_text || currentMeeting.location_name,
          code: currentMeeting.location_code,
          level: currentMeeting.location_level,
          location_mode: currentMeeting.location_mode
        };
      }

      setFormData({
        title: currentMeeting.title || '',
        description: currentMeeting.description || '',
        meeting_date: meetingDate,
        start_time: startTime,
        end_time: endTime,
        location_text: currentMeeting.location_text || '',
        location_id: currentMeeting.location_id || null,
        location_details: locationDetails,
        agenda: currentMeeting.agenda || '',
        secretary_name: currentMeeting.secretary_name || currentMeeting.facilitator || '',
        gps_latitude: gpsLat,
        gps_longitude: gpsLng,
      });
      setGpsEnabled(gpsEnabledFlag);
    }
  }, [currentMeeting]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDateChange = (date) => {
    setFormData({ ...formData, meeting_date: date });
  };

  const handleStartTimeChange = (time) => {
    setFormData({ ...formData, start_time: time });
  };

  const handleEndTimeChange = (time) => {
    setFormData({ ...formData, end_time: time });
  };

  const handleAgendaChange = (value) => {
    setFormData({ ...formData, agenda: value });
  };

  // Location selection handler
  const handleLocationSelect = (location) => {
    if (location) {
      setFormData(prev => ({
        ...prev,
        location_id: location.id,
        location_text: location.name,
        location_details: {
          id: location.id,
          name: location.name,
          code: location.code,
          level: location.level,
          location_mode: location.location_mode,
          location_type: location.location_type
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        location_id: null,
        location_text: '',
        location_details: null
      }));
    }
  };

  // GPS Functions
  const getCurrentLocation = () => {
    if (!gpsSupported) {
      setSnackbar({ open: true, message: 'Geolocation is not supported', severity: 'error' });
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          gps_latitude: position.coords.latitude.toFixed(6),
          gps_longitude: position.coords.longitude.toFixed(6),
        }));
        setGpsEnabled(true);
        setSnackbar({ open: true, message: 'Location captured!', severity: 'success' });
        setGpsLoading(false);
      },
      (error) => {
        setSnackbar({ open: true, message: 'Unable to get location', severity: 'error' });
        setGpsLoading(false);
      }
    );
  };

  const handleCopyCoordinates = () => {
    const coordinates = `${formData.gps_latitude},${formData.gps_longitude}`;
    navigator.clipboard.writeText(coordinates);
    setSnackbar({ open: true, message: 'Coordinates copied!', severity: 'success' });
  };

  const handlePasteCoordinates = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/([-+]?\d*\.?\d+)\s*[,]\s*([-+]?\d*\.?\d+)/);
      if (match) {
        setFormData(prev => ({
          ...prev,
          gps_latitude: match[1],
          gps_longitude: match[2],
        }));
        setGpsEnabled(true);
        setSnackbar({ open: true, message: 'Coordinates pasted!', severity: 'success' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Unable to paste', severity: 'error' });
    }
  };

  const handleGpsToggle = (event) => {
    const enabled = event.target.checked;
    setGpsEnabled(enabled);
    if (!enabled) {
      setFormData(prev => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
    } else if (!formData.gps_latitude) {
      getCurrentLocation();
    }
  };

  // Participant functions
  const handleAddCustomParticipant = () => {
    if (!newParticipant.name.trim()) {
      setSnackbar({ open: true, message: 'Please enter participant name', severity: 'warning' });
      return;
    }

    dispatch(addCustomParticipant(newParticipant));
    setNewParticipant({
      name: '',
      email: '',
      telephone: '',
      title: '',
      organization: '',
      is_chairperson: false,
    });
    setShowAddParticipantDialog(false);
    setSnackbar({ open: true, message: 'Participant added', severity: 'success' });
  };

  const handleRemoveParticipant = (participantId) => {
    dispatch(removeLocalMeetingParticipant(participantId));
  };

  const handleSetChairperson = (participantId) => {
    dispatch(setMeetingChairperson(participantId));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setSnackbar({ open: true, message: 'Please enter meeting title', severity: 'warning' });
      return;
    }
    if (!formData.meeting_date) {
      setSnackbar({ open: true, message: 'Please select meeting date', severity: 'warning' });
      return;
    }
    if (!formData.start_time) {
      setSnackbar({ open: true, message: 'Please select start time', severity: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const startDateTime = new Date(formData.meeting_date);
      startDateTime.setHours(formData.start_time.getHours(), formData.start_time.getMinutes());

      let endDateTime = null;
      if (formData.end_time) {
        endDateTime = new Date(formData.meeting_date);
        endDateTime.setHours(formData.end_time.getHours(), formData.end_time.getMinutes());
      }

      let gpsCoordinates = null;
      if (gpsEnabled && formData.gps_latitude && formData.gps_longitude) {
        gpsCoordinates = `${formData.gps_latitude},${formData.gps_longitude}`;
      }

      const updatePayload = {
        title: formData.title,
        description: formData.description || null,
        meeting_date: startDateTime.toISOString(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime ? endDateTime.toISOString() : null,
        location_text: formData.location_text || null,
        location_id: formData.location_id || null,
        gps_coordinates: gpsCoordinates,
        agenda: formData.agenda || null,
        secretary: formData.secretary_name || null,
        facilitator: formData.secretary_name || null,
        chairperson_name: chairperson?.name || null,
        custom_participants: meetingParticipants.map((p) => ({
          name: p.name,
          email: p.email || null,
          telephone: p.telephone || null,
          title: p.title || null,
          organization: p.organization || null,
          is_chairperson: p.is_chairperson || false,
          is_secretary: p.name === formData.secretary_name
        })),
      };

      await dispatch(updateMeeting({ id, data: updatePayload })).unwrap();
      
      setSnackbar({ open: true, message: 'Meeting updated successfully!', severity: 'success' });
      setTimeout(() => {
        navigate(`/meetings/${id}`);
      }, 1500);
    } catch (err) {
      console.error('Error updating meeting:', err);
      setSnackbar({ open: true, message: err.message || 'Failed to update meeting', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(`/meetings/${id}`);
  };

  if (loading && !currentMeeting) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading meeting details...</Typography>
      </Container>
    );
  }

  if (error && !currentMeeting) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">
          {typeof error === 'string' ? error : 'Failed to load meeting details'}
        </Alert>
        <Button onClick={() => navigate('/meetings')} sx={{ mt: 2 }}>
          Back to Meetings
        </Button>
      </Container>
    );
  }

  const apiLoading = loading || participantsLoading || submitting;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Mobile Header */}
        {isMobile ? (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar>
              <IconButton edge="start" onClick={handleCancel}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center' }}>
                Edit Meeting
              </Typography>
              <IconButton edge="end" onClick={handleSubmit} disabled={apiLoading}>
                {apiLoading ? <CircularProgress size={24} /> : <SaveIcon />}
              </IconButton>
            </Toolbar>
          </AppBar>
        ) : (
          <Container maxWidth="md" sx={{ py: 3 }}>
            <Paper sx={{ p: 4 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight={700}>Edit Meeting</Typography>
                <Stack direction="row" spacing={2}>
                  <Button variant="outlined" onClick={handleCancel}>Cancel</Button>
                  <Button variant="contained" onClick={handleSubmit} disabled={apiLoading}>
                    {apiLoading ? <CircularProgress size={24} /> : 'Save Changes'}
                  </Button>
                </Stack>
              </Stack>
              <Divider />
            </Paper>
          </Container>
        )}

        <Container maxWidth="md" sx={{ py: 3 }}>
          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, position: 'relative', overflow: 'hidden' }}>
            {apiLoading && (
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.9)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            )}

            <Stack spacing={3}>
              {/* Basic Info */}
              <TextField
                fullWidth
                label="Meeting Title *"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                disabled={apiLoading}
              />

              <TextField
                fullWidth
                label="Description"
                name="description"
                multiline
                rows={3}
                value={formData.description}
                onChange={handleChange}
                disabled={apiLoading}
              />

              {/* Date and Time */}
              <DatePicker
                label="Meeting Date *"
                value={formData.meeting_date}
                onChange={handleDateChange}
                slotProps={{ textField: { fullWidth: true, required: true } }}
                disabled={apiLoading}
              />

              <TimePicker
                label="Start Time *"
                value={formData.start_time}
                onChange={handleStartTimeChange}
                slotProps={{ textField: { fullWidth: true, required: true } }}
                disabled={apiLoading}
              />

              <TimePicker
                label="End Time"
                value={formData.end_time}
                onChange={handleEndTimeChange}
                slotProps={{ textField: { fullWidth: true } }}
                disabled={apiLoading}
              />

              {/* Location Search Component */}
              <LocationSearch 
                value={formData.location_details}
                onChange={handleLocationSelect}
                onClear={() => handleLocationSelect(null)}
              />

              {/* GPS Section */}
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardActionArea onClick={() => setShowGpsDetails(!showGpsDetails)}>
                  <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {gpsEnabled ? <GpsFixedIcon color="success" /> : <GpsNotFixedIcon color="disabled" />}
                      <Typography variant="subtitle1" fontWeight="bold">GPS Coordinates (Optional)</Typography>
                    </Box>
                    <Switch checked={gpsEnabled} onChange={handleGpsToggle} onClick={(e) => e.stopPropagation()} />
                  </Box>
                </CardActionArea>
                <Collapse in={showGpsDetails && gpsEnabled}>
                  <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1}>
                        <Button 
                          size="small" 
                          variant="contained" 
                          startIcon={gpsLoading ? <CircularProgress size={16} /> : <MyLocationIcon />} 
                          onClick={getCurrentLocation}
                        >
                          {gpsLoading ? 'Getting...' : 'Get Current Location'}
                        </Button>
                        <Tooltip title="Copy Coordinates">
                          <IconButton onClick={handleCopyCoordinates} disabled={!formData.gps_latitude} size="small">
                            <ContentCopyIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Paste Coordinates">
                          <IconButton onClick={handlePasteCoordinates} size="small">
                            <PasteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <TextField
                        fullWidth
                        label="Latitude"
                        value={formData.gps_latitude}
                        onChange={(e) => setFormData({ ...formData, gps_latitude: e.target.value })}
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Longitude"
                        value={formData.gps_longitude}
                        onChange={(e) => setFormData({ ...formData, gps_longitude: e.target.value })}
                        size="small"
                      />
                    </Stack>
                  </Box>
                </Collapse>
              </Card>

              {/* Agenda */}
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Agenda</Typography>
                <ReactQuill
                  theme="snow"
                  value={formData.agenda}
                  onChange={handleAgendaChange}
                  modules={isMobile ? mobileModules : desktopModules}
                  formats={formats}
                  style={{ height: '150px', marginBottom: '50px' }}
                />
              </Box>

              {/* Secretary Selection */}
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
                      disabled={apiLoading}
                    >
                      <MenuItem value=""><em>None Selected</em></MenuItem>
                      {meetingParticipants.map((p) => (
                        <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>

              {/* Participants Section */}
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1" fontWeight="bold">Participants</Typography>
                    <Button startIcon={<PersonAddIcon />} onClick={() => setShowAddParticipantDialog(true)} size="small">
                      Add Participant
                    </Button>
                  </Stack>

                  {meetingParticipants.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      No participants added
                    </Typography>
                  ) : (
                    <List sx={{ maxHeight: 300, overflow: 'auto' }}>
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
                                {participant.name.charAt(0).toUpperCase()}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                  <Typography variant="body2" fontWeight={500}>{participant.name}</Typography>
                                  {participant.is_chairperson && <Chip label="Chairperson" size="small" color="primary" />}
                                  {participant.name === formData.secretary_name && <Chip label="Secretary" size="small" color="secondary" />}
                                </Stack>
                              }
                              secondary={
                                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                  {participant.email && (
                                    <Typography variant="caption" display="flex" alignItems="center" gap={0.5}>
                                      <EmailIcon sx={{ fontSize: 12 }} /> {participant.email}
                                    </Typography>
                                  )}
                                  {participant.telephone && (
                                    <Typography variant="caption" display="flex" alignItems="center" gap={0.5}>
                                      <PhoneIcon sx={{ fontSize: 12 }} /> {participant.telephone}
                                    </Typography>
                                  )}
                                  {participant.title && (
                                    <Typography variant="caption" display="flex" alignItems="center" gap={0.5}>
                                      <TitleIcon sx={{ fontSize: 12 }} /> {participant.title}
                                    </Typography>
                                  )}
                                  {participant.organization && (
                                    <Typography variant="caption" display="flex" alignItems="center" gap={0.5}>
                                      <WorkIcon sx={{ fontSize: 12 }} /> {participant.organization}
                                    </Typography>
                                  )}
                                </Stack>
                              }
                            />
                          </ListItem>
                          {!participant.is_chairperson && (
                            <Button size="small" onClick={() => handleSetChairperson(participant.id)} sx={{ ml: 7, mb: 1 }}>
                              Make Chairperson
                            </Button>
                          )}
                          <Divider component="li" />
                        </React.Fragment>
                      ))}
                    </List>
                  )}

                  {chairperson && (
                    <Box mt={2} p={2} bgcolor={alpha(theme.palette.primary.main, 0.08)} borderRadius={1}>
                      <Typography variant="body2">
                        <strong>Current Chairperson:</strong> {chairperson.name}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Paper>
        </Container>

        {/* Add Participant Dialog */}
        <Dialog open={showAddParticipantDialog} onClose={() => setShowAddParticipantDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Participant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Full Name *"
                value={newParticipant.name}
                onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                required
              />
              <TextField
                fullWidth
                label="Email"
                value={newParticipant.email}
                onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
              />
              <TextField
                fullWidth
                label="Phone"
                value={newParticipant.telephone}
                onChange={(e) => setNewParticipant({ ...newParticipant, telephone: e.target.value })}
              />
              <TextField
                fullWidth
                label="Title"
                value={newParticipant.title}
                onChange={(e) => setNewParticipant({ ...newParticipant, title: e.target.value })}
              />
              <TextField
                fullWidth
                label="Organization"
                value={newParticipant.organization}
                onChange={(e) => setNewParticipant({ ...newParticipant, organization: e.target.value })}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newParticipant.is_chairperson}
                    onChange={(e) => setNewParticipant({ ...newParticipant, is_chairperson: e.target.checked })}
                  />
                }
                label="Set as Chairperson"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddParticipantDialog(false)}>Cancel</Button>
            <Button onClick={handleAddCustomParticipant} variant="contained" disabled={!newParticipant.name}>
              Add
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        >
          <Alert severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default EditMeeting;