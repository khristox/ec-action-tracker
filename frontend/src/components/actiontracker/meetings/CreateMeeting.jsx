// CreateMeeting.jsx - with Location Search, Hierarchy, and System Users
import React, { useState, useEffect, useCallback } from 'react';
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
  Link as MuiLink,
  Tab,
  Tabs,
  TabContext,
  TabPanel
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
  GroupAdd as GroupAddIcon,
  PersonSearch as PersonSearchIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
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

// Helper function for alpha transparency
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

const steps = [
  { label: 'Details', icon: EventIcon },
  { label: 'Participants', icon: PeopleIcon },
  { label: 'Review', icon: CheckCircleIcon },
];

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
  
  // Load location hierarchy when selected
  useEffect(() => {
    if (selectedLocation?.id) {
      loadLocationHierarchy(selectedLocation.id);
    } else {
      setLocationHierarchy([]);
    }
  }, [selectedLocation]);
  
  // Load address tree on mount
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
          
          {/* Location Mode Toggle */}
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
          
          {/* Search Input */}
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
          
          {/* Search Results */}
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
          
          {/* Location Tree */}
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
          
          {/* Selected Location Display */}
          {selectedLocation && locationHierarchy.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Selected Location Path:
              </Typography>
              <Breadcrumbs separator={<ArrowForwardIcon sx={{ fontSize: 14 }} />}>
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

// System Users Component
const SystemUsersTab = ({ onAddUsers, existingParticipants }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  
  // Fetch system users
  const fetchSystemUsers = async (query = '') => {
    setLoading(true);
    try {
      const params = {
        limit: 50,
        is_active: true
      };
      if (query && query.length >= 2) {
        params.search = query;
      }
      const response = await api.get('/users/', { params });
      const usersList = response.data?.items || response.data || [];
      
      // Filter out users already added as participants
      const existingEmails = new Set(existingParticipants.map(p => p.email?.toLowerCase()).filter(Boolean));
      const filteredUsers = usersList.filter(user => !existingEmails.has(user.email?.toLowerCase()));
      
      setUsers(filteredUsers);
    } catch (err) {
      console.error('Error fetching system users:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSystemUsers();
  }, []);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm && searchTerm.length >= 2) {
        fetchSystemUsers(searchTerm);
      } else if (!searchTerm) {
        fetchSystemUsers();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  const handleToggleUser = (userId) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };
  
 const handleAddSelected = () => {
  const selectedUsersList = users.filter(user => selectedUsers.has(user.id));
  const participants = selectedUsersList.map(user => ({
    id: `system_${user.id}`,
    name: `${user.first_name} ${user.last_name}`.trim() || user.email,
    // Simple email masking: joh***@example.com
    email: user.email ? user.email.replace(/(.{3}).*(@.*)/, '$1***$2') : '',
    // Simple phone masking: +256*****789
    telephone: user.phone || user.telephone ? 
      (user.phone || user.telephone).replace(/(.{3})(.*)(.{3})/, '$1***$3') : '',
    original_email: user.email,
    original_telephone: user.phone || user.telephone,
    title: user.title || '',
    organization: user.organization || '',
    is_chairperson: false,
    is_system_user: true,
    user_id: user.id
  }));
  
  setSelectedParticipants(prev => [...prev, ...participants]);
  setSelectedUsers(new Set());
  setShowUserSelector(false);
};
    onAddUsers(participants);
    setSelectedUsers(new Set());
    setSnackbarMessage(`Added ${participants.length} system users`);
  };
  
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  return (
    <Stack spacing={2}>
      <TextField
        fullWidth
        placeholder="Search system users by name or email..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        size="small"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <PersonSearchIcon />
            </InputAdornment>
          ),
          endAdornment: loading && <CircularProgress size={20} />
        }}
      />
      
      {users.length === 0 && !loading && (
        <Alert severity="info">
          {searchTerm ? 'No system users found' : 'No system users available to add'}
        </Alert>
      )}
      
      {users.length > 0 && (
        <>
          <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
            <List dense>
              {users.map(user => (
                <ListItemButton
                  key={user.id}
                  onClick={() => handleToggleUser(user.id)}
                  selected={selectedUsers.has(user.id)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: selectedUsers.has(user.id) ? 'primary.main' : 'grey.500' }}>
                      {user.first_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
                    secondary={
                      <Stack direction="row" spacing={2} flexWrap="wrap">
                        {user.email && (
                          <Typography variant="caption" display="flex" alignItems="center" gap={0.5}>
                            <EmailIcon sx={{ fontSize: 12 }} /> {user.email}
                          </Typography>
                        )}
                        {user.phone && (
                          <Typography variant="caption" display="flex" alignItems="center" gap={0.5}>
                            <PhoneIcon sx={{ fontSize: 12 }} /> {user.phone}
                          </Typography>
                        )}
                        {user.title && (
                          <Typography variant="caption" display="flex" alignItems="center" gap={0.5}>
                            <WorkIcon sx={{ fontSize: 12 }} /> {user.title}
                          </Typography>
                        )}
                      </Stack>
                    }
                  />
                  {selectedUsers.has(user.id) && <CheckCircleIcon color="success" />}
                </ListItemButton>
              ))}
            </List>
          </Paper>
          
          <Button
            variant="contained"
            onClick={handleAddSelected}
            disabled={selectedUsers.size === 0}
            startIcon={<GroupAddIcon />}
            fullWidth
          >
            Add Selected Users ({selectedUsers.size})
          </Button>
        </>
      )}
      
      {snackbarMessage && (
        <Snackbar
          open={!!snackbarMessage}
          autoHideDuration={3000}
          onClose={() => setSnackbarMessage('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="success">{snackbarMessage}</Alert>
        </Snackbar>
      )}
    </Stack>
  );
};

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
  const { isLoading: meetingLoading, success, error: meetingError } = useSelector(
    (state) => state.meetings
  );

  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [selectedParticipantList, setSelectedParticipantList] = useState(null);
  const [showGpsDetails, setShowGpsDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [participantTab, setParticipantTab] = useState('custom'); // 'custom', 'lists', 'system'

  // Form data
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

  // GPS State
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSupported, setGpsSupported] = useState(true);

  // New participant form with all fields
  const [newParticipant, setNewParticipant] = useState({
    name: '',
    email: '',
    telephone: '',
    title: '',
    organization: '',
    is_chairperson: false,
  });

  const apiLoading = meetingLoading || participantsLoading || submitting;

  // Handle location selection
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

  // Fetch data on mount
  useEffect(() => {
    dispatch(fetchParticipantLists());
    dispatch(fetchParticipants({ limit: 100 }));

    if (!navigator.geolocation) {
      setGpsSupported(false);
      setSnackbar({
        open: true,
        message: 'Geolocation is not supported by your browser',
        severity: 'warning',
      });
    }

    return () => {
      dispatch(clearMeetingState());
      dispatch(clearMeetingParticipants());
    };
  }, [dispatch]);

  // Handle meeting creation success
  useEffect(() => {
    if (success) {
      setSnackbar({
        open: true,
        message: 'Meeting created successfully! Redirecting to Dashboard...',
        severity: 'success',
      });
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    }
  }, [success, navigate]);

  // Handle errors
  useEffect(() => {
    if (meetingError) {
      setSnackbar({
        open: true,
        message: typeof meetingError === 'string' ? meetingError : 'Failed to create meeting',
        severity: 'error',
      });
    }
  }, [meetingError]);

  // GPS Functions
  const getCurrentLocation = () => {
    if (!gpsSupported) {
      setSnackbar({
        open: true,
        message: 'Geolocation is not supported by your browser',
        severity: 'error',
      });
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData((prev) => ({
          ...prev,
          gps_latitude: latitude.toFixed(6),
          gps_longitude: longitude.toFixed(6),
        }));
        setGpsEnabled(true);
        setGpsLoading(false);
      },
      (error) => {
        let errorMessage = 'Unable to get location.';
        setSnackbar({ open: true, message: errorMessage, severity: 'error' });
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleGpsToggle = (event) => {
    const enabled = event.target.checked;
    setGpsEnabled(enabled);
    if (!enabled) {
      setFormData((prev) => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
    } else if (gpsSupported && !formData.gps_latitude) {
      getCurrentLocation();
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDateChange = (date) => setFormData({ ...formData, meeting_date: date });
  const handleStartTimeChange = (time) => setFormData({ ...formData, start_time: time });
  const handleEndTimeChange = (time) => setFormData({ ...formData, end_time: time });
  const handleAgendaChange = (value) => setFormData({ ...formData, agenda: value });

  // Participant handlers
  const handleNewParticipantChange = (field) => (event) => {
    setNewParticipant({ ...newParticipant, [field]: event.target.value });
  };

  const handleUseParticipantList = () => {
    if (selectedParticipantList) {
      const list = participantLists.find((l) => l.id === selectedParticipantList);
      if (list && list.participants) {
        dispatch(
          addParticipantsFromListToMeeting({
            listId: selectedParticipantList,
            participants: list.participants,
          })
        );
        setSnackbar({
          open: true,
          message: `Added ${list.participants.length} participants`,
          severity: 'success',
        });
      }
      setSelectedParticipantList(null);
    }
  };

  const handleAddCustomParticipant = () => {
    if (!newParticipant.name.trim()) return;
    dispatch(addCustomParticipant(newParticipant));
    setNewParticipant({
      name: '', email: '', telephone: '', title: '', organization: '', is_chairperson: false,
    });
    setShowAddParticipantDialog(false);
    setSnackbar({
      open: true,
      message: 'Participant added successfully',
      severity: 'success',
    });
  };

  const handleAddSystemUsers = (users) => {
    users.forEach(user => {
      dispatch(addCustomParticipant(user));
    });
    setSnackbar({
      open: true,
      message: `Added ${users.length} system user${users.length > 1 ? 's' : ''}`,
      severity: 'success',
    });
  };

  const handleRemoveParticipant = (participantId) => {
    dispatch(removeLocalMeetingParticipant(participantId));
  };

  const handleSetChairperson = (participantId) => {
    dispatch(setMeetingChairperson(participantId));
  };

  const handleNext = () => {
    if (activeStep === 0 && !formData.title.trim()) return;
    setActiveStep(activeStep + 1);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (activeStep === 0) navigate('/meetings');
    else setActiveStep(activeStep - 1);
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

      await dispatch(createMeeting(meetingPayload)).unwrap();
      navigate('/dashboard');
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Failed to create meeting', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const chairpersonName = chairperson?.name || 'Not selected';

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 10, sm: 4 } }}>
        {/* Mobile App Bar */}
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
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="primary">Create New Meeting</Typography>
                <Typography variant="body2" color="text.secondary">Fill in the details to schedule a new meeting</Typography>
              </Box>
              <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel} disabled={apiLoading}>Cancel</Button>
            </Box>
          )}

          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 2, md: 3 }, position: 'relative', overflow: 'hidden' }}>
            {apiLoading && (
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.9)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            )}

            <Stepper activeStep={activeStep} sx={{ mb: 4, display: isMobile ? 'none' : 'flex' }}>
              {steps.map((step, index) => (
                <Step key={index}><StepLabel StepIconComponent={step.icon}>{step.label}</StepLabel></Step>
              ))}
            </Stepper>

            {/* Step 1: Meeting Details */}
            {activeStep === 0 && (
              <Stack spacing={2.5}>
                <TextField fullWidth label="Meeting Title *" name="title" required value={formData.title} onChange={handleChange} disabled={apiLoading} />
                <TextField fullWidth label="Description" name="description" multiline rows={isMobile ? 2 : 3} value={formData.description} onChange={handleChange} disabled={apiLoading} />
                <DatePicker label="Meeting Date *" value={formData.meeting_date} onChange={handleDateChange} slotProps={{ textField: { fullWidth: true, required: true } }} />
                <TimePicker label="Start Time *" value={formData.start_time} onChange={handleStartTimeChange} slotProps={{ textField: { fullWidth: true, required: true } }} />
                <TimePicker label="End Time" value={formData.end_time} onChange={handleEndTimeChange} slotProps={{ textField: { fullWidth: true } }} />
                
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
                        <Button size="small" variant="contained" startIcon={<MyLocationIcon />} onClick={getCurrentLocation}>Get Current Location</Button>
                        <TextField fullWidth label="Latitude" value={formData.gps_latitude} size="small" />
                        <TextField fullWidth label="Longitude" value={formData.gps_longitude} size="small" />
                      </Stack>
                    </Box>
                  </Collapse>
                </Card>

                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Agenda</Typography>
                  <ReactQuill theme="snow" value={formData.agenda} onChange={handleAgendaChange} modules={isMobile ? mobileModules : desktopModules} formats={formats} style={{ height: '150px', marginBottom: '50px' }} />
                </Box>
              </Stack>
            )}

            {/* Step 2: Participants */}
            {activeStep === 1 && (
              <Stack spacing={3}>
                {/* Tabs for different participant sources */}
                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                      <Tabs 
                        value={participantTab} 
                        onChange={(e, val) => setParticipantTab(val)}
                        variant="scrollable"
                        scrollButtons="auto"
                      >
                        <Tab label="Add Manually" value="custom" icon={<PersonAddIcon />} iconPosition="start" />
                        <Tab label="Participant Lists" value="lists" icon={<PeopleIcon />} iconPosition="start" />
                        <Tab label="System Users" value="system" icon={<AdminIcon />} iconPosition="start" />
                      </Tabs>
                    </Box>
                    
                    {/* Custom Participant Tab */}
                    {participantTab === 'custom' && (
                      <Stack spacing={2}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2" fontWeight="bold">Add Individual Participant</Typography>
                          <Button 
                            variant="contained" 
                            startIcon={<PersonAddIcon />} 
                            onClick={() => setShowAddParticipantDialog(true)}
                            size="small"
                          >
                            Add
                          </Button>
                        </Box>
                      </Stack>
                    )}
                    
                    {/* Participant Lists Tab */}
                    {participantTab === 'lists' && (
                      <Stack spacing={2}>
                        <FormControl fullWidth size="small">
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
                      </Stack>
                    )}
                    
                    {/* System Users Tab */}
                    {participantTab === 'system' && (
                      <SystemUsersTab 
                        onAddUsers={handleAddSystemUsers}
                        existingParticipants={meetingParticipants}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Current Participants List */}
                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        👤 Meeting Participants ({meetingParticipants.length})
                      </Typography>
                    </Box>

                    {meetingParticipants.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                        No participants added yet. Use the tabs above to add participants.
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
                                  {participant.name?.charAt(0) || 'P'}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                    <Typography variant="body2" fontWeight={500}>{participant.name}</Typography>
                                    {participant.is_chairperson && <Chip label="Chairperson" size="small" color="primary" />}
                                    {participant.is_system_user && <Chip label="System User" size="small" color="info" variant="outlined" />}
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
                              <Button size="small" sx={{ ml: 7, mb: 1 }} onClick={() => handleSetChairperson(participant.id)}>
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

                {/* Secretary Selection */}
                <Card variant="outlined" sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
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
            )}

            {/* Step 3: Review */}
            {activeStep === 2 && (
              <Stack spacing={2}>
                <Alert severity="info">Review meeting details before creating</Alert>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="primary" gutterBottom>Meeting Information</Typography>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2"><strong>Title:</strong> {formData.title}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2"><strong>Chairperson:</strong> {chairpersonName}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2" color="secondary.main"><strong>Secretary:</strong> {formData.secretary_name || 'Not selected'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2"><strong>Location:</strong> {formData.location_text || 'Not specified'}</Typography>
                      </Grid>
                      {formData.location_details && (
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="body2"><strong>Location Type:</strong> {formData.location_details.location_mode} - Level {formData.location_details.level}</Typography>
                        </Grid>
                      )}
                    </Grid>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom>Participants ({meetingParticipants.length})</Typography>
                    <Box component="ul" sx={{ pl: 2, mt: 1, maxHeight: 150, overflow: 'auto' }}>
                      {meetingParticipants.slice(0, 10).map(p => (
                        <li key={p.id}>
                          <Typography variant="body2">
                            {p.name} {p.is_chairperson && '(Chairperson)'}
                            {p.name === formData.secretary_name && ' (Secretary)'}
                            {p.is_system_user && ' (System User)'}
                          </Typography>
                        </li>
                      ))}
                      {meetingParticipants.length > 10 && (
                        <li><Typography variant="body2">...and {meetingParticipants.length - 10} more</Typography></li>
                      )}
                    </Box>
                  </CardContent>
                </Card>
                <Button variant="contained" size="large" onClick={handleSubmit} startIcon={<SaveIcon />} disabled={apiLoading}>
                  {apiLoading ? <CircularProgress size={24} /> : 'Create Meeting dd'}
                </Button>
              </Stack>
            )}

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button onClick={handleBack} startIcon={<ArrowBackIcon />} disabled={apiLoading}>
                {activeStep === 0 ? 'Cancel' : 'Back'}
              </Button>
              {activeStep < 2 && (
                <Button variant="contained" onClick={handleNext} endIcon={<ArrowForwardIcon />} disabled={apiLoading}>
                  Next
                </Button>
              )}
            </Box>
          </Paper>
        </Container>

        {/* Add Participant Dialog with all fields */}
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
                label="Title"
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
            <Button variant="contained" onClick={handleAddCustomParticipant} disabled={!newParticipant.name.trim()}>
              Add Participant
            </Button>
          </DialogActions>
        </Dialog>

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

export default CreateMeeting;